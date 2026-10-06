import { afterEach, expect, it, vi } from 'vitest';
import { isSheetsOwnerAllowed } from '../server/sheets-access.mjs';
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn(), createClient: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
import handler from '../api/workout-finalize.mjs';
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
const owner = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';

it('allows exactly one configured owner, and fails closed on missing/multiple/malformed owners', () => {
  expect(isSheetsOwnerAllowed(owner, owner)).toBe(true);
  for (const config of [undefined, '', 'invalid', `${owner},${other}`, other]) {
    expect(isSheetsOwnerAllowed(owner, config)).toBe(false);
  }
});

it.each([undefined, '', other, `${owner},${other}`])('stops the API before cloud/Sheets reads for a disallowed owner', async configuredOwner => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'sb_publishable_example_key');
  vi.stubEnv('WORKOUT_AUTO_FINALIZE_ENABLED', 'true');
  vi.stubEnv('WORKOUT_SHEETS_OWNER_USER_ID', configuredOwner);
  mocks.getUser.mockResolvedValue({ data: { user: { id: owner } }, error: null });
  mocks.createClient.mockReturnValue({ auth: { getUser: mocks.getUser }, from: mocks.from });
  const response = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() };
  response.status.mockReturnValue(response);
  await handler({ method: 'POST', headers: { authorization: 'Bearer fixture-token' }, body: { session_id: 'fixture-session' } }, response);
  expect(response.status).toHaveBeenCalledWith(403);
  expect(response.json).toHaveBeenCalledWith({ status: 'review_required', reason: 'sheets_owner_not_allowed' });
  expect(mocks.from).not.toHaveBeenCalled();
  expect(mocks.createClient).toHaveBeenCalledOnce();
});
