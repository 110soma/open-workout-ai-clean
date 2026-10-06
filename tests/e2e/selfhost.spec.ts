import { test, expect } from '@playwright/test';
import { examplePrescriptionRow } from '../../scripts/example-prescription-sql.mjs';

test('connected clean-start, active recovery and account switch isolate pending data', async ({ page }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), 'Local mock self-host test only.');
  const a = '00000000-0000-4000-8000-000000000001';
  const b = '00000000-0000-4000-8000-000000000002';
  const date = new Date().toLocaleDateString('en-CA');
  let user = a;
  const uploads: Array<{ user_id: string; session_id: string }> = [];
  const errors: string[] = [];
  const privateFileRequests: string[] = [];
  const externalRequests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === 'http://127.0.0.1:4175') {
      if (url.pathname.startsWith('/data/')) privateFileRequests.push(url.pathname);
      return route.continue();
    }
    if (url.origin !== 'https://example.supabase.co') { externalRequests.push(url.origin); return route.abort(); }
    // Every Supabase-looking request is fulfilled locally by this fixture.
    const profile = { id: user, aud: 'authenticated', role: 'authenticated', email: user === a ? 'a@example.org' : 'b@example.org', app_metadata: {}, user_metadata: {}, created_at: '2030-01-01T00:00:00Z' };
    if (url.pathname.endsWith('/token')) {
      user = JSON.parse(request.postData()!).email === 'a@example.org' ? a : b;
      return route.fulfill({ json: { access_token: `fixture-access-${user}`, refresh_token: 'fixture-refresh-token', expires_in: 3600, token_type: 'bearer', user: { ...profile, id: user, email: user === a ? 'a@example.org' : 'b@example.org' } } });
    }
    if (url.pathname.endsWith('/user')) return route.fulfill({ json: profile });
    if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204 });
    if (url.pathname.endsWith('/prescriptions')) {
      const row = examplePrescriptionRow(a, date);
      return route.fulfill({ json: user === a ? { ...row, server_updated_at: `${date}T00:00:00Z` } : null });
    }
    if (url.pathname.endsWith('/workout_sessions') && request.method() === 'POST') {
      const row = JSON.parse(request.postData()!); uploads.push(row);
      return route.fulfill({ json: { server_updated_at: `${date}T00:00:00Z` } });
    }
    if (url.pathname.endsWith('/workout_sets') && request.method() === 'POST') {
      for (const row of JSON.parse(request.postData()!)) uploads.push(row);
      return route.fulfill({ status: 201, json: [] });
    }
    if (url.pathname.startsWith('/rest/v1/')) return route.fulfill({ json: [] });
    return route.fulfill({ status: 404, json: { error: 'fixture_route_missing' } });
  });
  async function login(email: string) {
    await page.getByLabel('メールアドレス', { exact: true }).fill(email);
    await page.getByLabel('パスワード', { exact: true }).fill('fixture-password');
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
  }
  async function logout() {
    await page.locator('.compact-sync').click();
    await page.getByRole('button', { name: 'ログアウト', exact: true }).click();
    await expect(page.getByLabel('メールアドレス', { exact: true })).toBeVisible();
  }
  await page.goto('http://127.0.0.1:4175');
  await expect(page.getByLabel('メールアドレス', { exact: true })).toBeVisible();
  await login('a@example.org');
  await page.getByRole('button', { name: 'トレーニングを始める', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Example Press', exact: true })).toBeVisible();
  await page.getByRole('spinbutton', { name: /実際の重量$/ }).first().fill('42');
  await expect.poll(async () => page.evaluate(async () => {
    const names = (await indexedDB.databases()).map(item => item.name!);
    const name = names.find(value => value.endsWith(':00000000-0000-4000-8000-000000000001'))!;
    return new Promise(resolve => { const request = indexedDB.open(name); request.onsuccess = () => {
      const database = request.result; const read = database.transaction('liveWorkouts').objectStore('liveWorkouts').getAll();
      read.onsuccess = () => { resolve(read.result.find(row => row.status === 'active')?.exercises[0].sets[0].actual_weight_kg); database.close(); };
    }; });
  })).toBe(42);
  await page.reload();
  await page.getByRole('button', { name: '続きから', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: /実際の重量$/ }).first()).toHaveValue('42');
  // Add an unsynced fixture directly to A's DB, without triggering cloud sync.
  await page.evaluate(async () => {
    const name = (await indexedDB.databases()).map(item => item.name!).find(value => value.endsWith(':00000000-0000-4000-8000-000000000001'))!;
    await new Promise<void>(resolve => { const request = indexedDB.open(name); request.onsuccess = () => {
      const database = request.result; const transaction = database.transaction('liveWorkouts', 'readwrite');
      const store = transaction.objectStore('liveWorkouts'); const read = store.getAll();
      read.onsuccess = () => store.put({ ...read.result[0], workout_id: 'fixture-pending-user-a', date: '2030-01-01', status: 'completed_local', dirty: true });
      transaction.oncomplete = () => { database.close(); resolve(); };
    }; });
  });
  await logout();
  await login('b@example.org');
  await expect(page.getByText('今日のメニューはまだありません', { exact: true })).toBeVisible();
  await expect(page.getByText('Example Press', { exact: true })).toHaveCount(0);
  expect(uploads.filter(row => row.user_id === b)).toEqual([]);
  await logout();
  await login('a@example.org');
  await page.getByRole('button', { name: '続きから', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: /実際の重量$/ }).first()).toHaveValue('42');
  await expect.poll(() => uploads.filter(row => row.session_id === 'fixture-pending-user-a').length).toBeGreaterThan(0);
  expect(uploads.every(row => row.user_id === a)).toBe(true);
  expect(privateFileRequests).toEqual([]);
  expect(externalRequests).toEqual([]);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
