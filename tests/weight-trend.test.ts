import { expect, test } from 'vitest';
import type { WorkoutSet } from '../src/types';
import { rangeStart, validDay, weightAxis, weightDays, weightSide } from '../src/weightTrend';
const set = (id: string, date: string, load: number | null, extra: Partial<WorkoutSet> = {}) => ({ set_id: id, session_id: `fixture-${id}`, session_date: date, load_kg: load, reps: 10, side: null, set_no: 1, completed: true, set_type: 'working', RIR: null, ...extra } as WorkoutSet);

test('daily maximum merges sessions without mutating sets or inventing RIR', () => {
  const rows = [set('a', '2025-05-01', 40), set('b', '2025-05-01', 45), set('c', '2025-05-01', null)];
  const before = JSON.stringify(rows);
  const days = weightDays(rows, false, 'six', '2025-05-29');
  expect(days).toHaveLength(1); expect(days[0].weights).toEqual({ both: 45 });
  expect(days[0].sets).toHaveLength(3); expect(days[0].sets.every(row => row.RIR === null)).toBe(true);
  expect(JSON.stringify(rows)).toBe(before);
});
test('left and right stay separate; unknown side is never assigned or summed', () => {
  const rows = [set('a', '2025-05-01', 12, { side: 'L' }), set('b', '2025-05-01', 10, { side: '右' }), set('c', '2025-05-01', 9)];
  expect(weightDays(rows, true, 'six', '2025-05-29')[0].weights).toEqual({ left: 12, right: 10, unknown: 9 });
  expect(weightSide('R', false)).toBe('right');
});
test('missing weights are not zero; real zero is preserved', () => {
  const days = weightDays([set('a', '2025-05-01', null), set('b', '2025-05-02', 0)], false, 'six', '2025-05-29');
  expect(days[0].weights).toEqual({}); expect(days[0].sets[0].load_kg).toBeNull(); expect(days[1].weights.both).toBe(0);
});
test('last six means six unique days, not six sets, sorted chronologically', () => {
  const rows = Array.from({ length: 8 }, (_, i) => set(`a${i}`, `2025-05-0${i + 1}`, 40));
  rows.push(set('extra', '2025-05-08', 45));
  const days = weightDays(rows.reverse(), false, 'six', '2025-05-29');
  expect(days.map(day => day.date)).toEqual(['2025-05-03','2025-05-04','2025-05-05','2025-05-06','2025-05-07','2025-05-08']);
  expect(days.at(-1)!.weights.both).toBe(45);
});
test('calendar periods clamp month ends and include the boundary, not future data', () => {
  expect(rangeStart('2025-05-31', '3m')).toBe('2025-02-28');
  expect(rangeStart('2024-02-29', '1y')).toBe('2023-02-28');
  expect(rangeStart('2025-08-31', '6m')).toBe('2025-02-28');
  const rows = [set('a','2025-02-27',40),set('b','2025-02-28',42),set('c','2025-06-01',45)];
  expect(weightDays(rows,false,'3m','2025-05-31').map(d=>d.date)).toEqual(['2025-02-28']);
});
test('explicit warmups, unfinished sets, invalid weights/dates and duplicates cannot inflate maximum', () => {
  const rows = [set('a','2025-05-01',40),set('a','2025-05-01',90),set('w','2025-05-01',100,{set_type:'warmup'}),set('u','2025-05-01',110,{completed:false}),set('n','2025-05-01',NaN),set('m','2025-05-01',-1),set('d','2025-02-30',300)];
  expect(weightDays(rows,false,'six','2025-05-29')[0].weights.both).toBe(40);
  expect(validDay('2025-02-30')).toBe(false);
});
test('axis covers values, handles equal/zero values and gives finite increasing ticks', () => {
  for (const values of [[40,50],[40],[0],[29.2,41.7],[10000,20000]]) {
    const axis = weightAxis(values);
    expect(axis.min).toBeLessThanOrEqual(Math.min(...values)); expect(axis.max).toBeGreaterThanOrEqual(Math.max(...values));
    expect(axis.max).toBeGreaterThan(axis.min); expect(axis.ticks.every(Number.isFinite)).toBe(true);
  }
});
test('empty/single-day history is safe and unknown set type remains unknown', () => {
  expect(weightDays([],false,'six','2025-05-29')).toEqual([]);
  const days = weightDays([set('a','2025-05-01',29.2,{set_type:null})],false,'six','2025-05-29');
  expect(days).toHaveLength(1); expect(days[0].weights.both).toBe(29.2); expect(days[0].sets[0].set_type).toBeNull();
});
