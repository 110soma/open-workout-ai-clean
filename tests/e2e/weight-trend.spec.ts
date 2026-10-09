import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
test.use({ hasTouch: true });
test('empty history and missing weights remain usable without navigation obstruction', async ({page}) => {
  await page.goto('/?demo=1');
  await expect(page.locator('.app-header h1')).toContainText(`v${version}`);
  await page.getByRole('button',{name:'次のセットへ',exact:true}).click();
  await page.locator('.bottom-nav button').filter({hasText:'種目'}).click();
  await page.getByRole('button',{name:/ベンチプレス/}).click();
  for(const label of ['直近6回','3か月','半年','1年']) {
    await page.getByRole('button',{name:label,exact:true}).click();
    await expect(page.locator('.weight-plot svg')).toHaveCount(0);
    await expect(page.locator('.weight-trend')).toContainText('この期間の重量記録はありません');
  }
  await page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('open-workout-ai-demo');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
    const d=new Date(); const date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    await new Promise<void>((resolve,reject)=>{const t=db.transaction('sets','readwrite');t.objectStore('sets').put({set_id:'missing-weight-fixture',session_id:'missing-weight-session',exercise_id:'BENCH_PRESS',session_date:date,side:null,set_no:1,set_type:'working',completed:true,load_kg:null,reps:10,RIR:null,estimated_1RM:null});t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error)});db.close();
  });
  await page.reload();
  await page.locator('.bottom-nav button').filter({hasText:'種目'}).click();
  await page.getByRole('button',{name:/ベンチプレス/}).click();
  await expect(page.locator('.weight-plot svg')).toHaveCount(0);
  await expect(page.locator('.weight-day-detail')).toContainText('— kg × 10回');
  const control=page.getByLabel('記録日',{exact:true});await control.scrollIntoViewIfNeeded();
  const bounds=await control.boundingBox(), nav=await page.locator('.bottom-nav').boundingBox();
  expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(nav!.y);
  const center={x:bounds!.x+bounds!.width/2,y:bounds!.y+bounds!.height/2};
  expect(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.tagName,center)).toBe('SELECT');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('missing side and unknown master display as unknown, not simultaneous', async ({page}) => {
  await page.goto('/?demo=1');
  await page.getByRole('button',{name:'次のセットへ',exact:true}).click();
  await page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('open-workout-ai-demo');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
    await new Promise<void>((resolve,reject)=>{
      const t=db.transaction(['exercises','sets'],'readwrite');
      const exercise=t.objectStore('exercises').get('BENCH_PRESS');
      exercise.onsuccess=()=>t.objectStore('exercises').put({...exercise.result,unilateral:null});
      const d=new Date();const date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      t.objectStore('sets').put({set_id:'unknown-side-fixture',session_id:'unknown-side-session',session_date:date,exercise_id:'BENCH_PRESS',set_no:1,side:null,set_type:'working',load_kg:40,reps:10,RIR:null,estimated_1RM:null,completed:true});
      t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);
    });db.close();
  });
  await page.locator('.bottom-nav button').filter({hasText:'種目'}).click();
  await page.getByRole('button',{name:/ベンチプレス/}).click();
  await expect(page.locator('.weight-legend')).toHaveText('左右未記載');
  await expect(page.locator('.weight-day-detail')).toContainText('左右未記載');
  await expect(page.locator('.weight-day-detail')).not.toContainText('左右同時');
});
test('weight trend uses real dates, separates sides and preserves source records', async ({ page, baseURL }) => {
  const storedSets = () => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request=indexedDB.open('open-workout-ai-demo'); request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error); });
    const rows = await new Promise<unknown[]>((resolve,reject)=>{const request=db.transaction('sets','readonly').objectStore('sets').getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    db.close(); return rows;
  });
  const errors: string[] = [], outgoing: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (new URL(request.url()).origin !== new URL(baseURL!).origin) outgoing.push(request.url()); });
  await page.goto('/?demo=1');
  await page.getByLabel('休憩タイマー').waitFor();
  await page.getByRole('button', { name: '次のセットへ', exact: true }).click();
  const dates = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('open-workout-ai-demo'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const dates = [-300,-180,-100,-60,-30,-10,-4,0].map(offset => {
      const date = new Date(); date.setDate(date.getDate() + offset);
      return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    });
    await new Promise<void>((resolve,reject) => {
      const transaction = db.transaction('sets','readwrite');
      dates.forEach((date,i) => ['L','R'].forEach((side,j) => transaction.objectStore('sets').put({set_id:`weight-fixture-${i}-${side}`,session_id:`weight-fixture-session-${i}`,session_date:date,exercise_id:'ONE_ARM_DB_ROW',set_no:1,side,set_type:'working',load_kg:i===7&&j===1?null:10+i+j,reps:10,RIR:null,estimated_1RM:null,completed:true})));
      transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error);
    }); db.close(); return dates;
  });
  const before = await storedSets();
  await page.locator('.bottom-nav button').filter({ hasText: '種目' }).click();
  await page.getByRole('button',{ name:/片手ダンベルロー/ }).click();
  const trend = page.getByRole('region',{ name:'重量推移' });
  await expect(trend.getByRole('button',{name:'直近6回',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(trend.getByLabel('記録日', { exact:true })).toHaveCount(1);
  await expect(trend.locator('select option')).toHaveCount(6);
  await expect(trend.locator('.weight-legend')).toContainText('左');
  await expect(trend.locator('.weight-legend')).toContainText('右');
  await expect(trend.locator('.weight-day-detail')).toContainText('— kg × 10回');
  await expect(trend.locator('.weight-day-detail')).toContainText('RIR —');
  const xs = await trend.locator('.weight-series-left circle').evaluateAll(nodes => nodes.map(node=>Number(node.getAttribute('cx'))));
  expect(xs[1]-xs[0]).toBeGreaterThan((xs.at(-1)!-xs.at(-2)!)*3);
  await trend.getByRole('button',{name:'3か月',exact:true}).click(); await expect(trend.locator('select option')).toHaveCount(5);
  await trend.getByRole('button',{name:'半年',exact:true}).click(); await expect(trend.locator('select option')).toHaveCount(7);
  await trend.getByRole('button',{name:'1年',exact:true}).click(); await expect(trend.locator('select option')).toHaveCount(8);
  await trend.getByLabel('記録日', { exact:true }).selectOption(dates[0]); await expect(trend.locator('.weight-day-detail')).toContainText(dates[0].replaceAll('-','/'));
  await trend.getByRole('button',{name:'直近6回',exact:true}).click();
  const svg = trend.locator('svg'), box = await svg.boundingBox();
  await svg.scrollIntoViewIfNeeded();
  const point=await trend.locator('.weight-series-left circle').first().boundingBox();
  if(page.viewportSize()!.width<500) await page.touchscreen.tap(point!.x+point!.width/2,point!.y+point!.height/2);
  else await page.mouse.click(point!.x+point!.width/2,point!.y+point!.height/2);
  await expect(trend.getByLabel('記録日', { exact:true })).toHaveValue(dates[2]);
  expect(box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  const detail=trend.locator('.weight-set-row strong').last();await detail.scrollIntoViewIfNeeded();
  const detailBox=await detail.boundingBox(), navBox=await page.locator('.bottom-nav').boundingBox();
  expect(detailBox!.y+detailBox!.height).toBeLessThanOrEqual(navBox!.y);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.reload();
  await page.locator('.bottom-nav button').filter({hasText:'種目'}).click(); await page.getByRole('button',{name:/片手ダンベルロー/}).click();
  await expect(page.locator('.weight-trend select option')).toHaveCount(6);
  expect(await storedSets()).toEqual(before);
  expect(errors).toEqual([]); expect(outgoing).toEqual([]);
});
