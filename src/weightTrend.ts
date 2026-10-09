import type { WorkoutSet } from './types';

export type TrendRange = 'six' | '3m' | '6m' | '1y';
export type WeightSeries = 'left' | 'right' | 'both' | 'unknown';
export interface WeightDay { date: string; sets: WorkoutSet[]; weights: Partial<Record<WeightSeries, number>> }
export function weightSide(side: string | null, unilateral: boolean | null): WeightSeries {
  if (side === 'L' || side === '左') return 'left';
  if (side === 'R' || side === '右') return 'right';
  if (side === '両' || side === 'both') return 'both';
  // Only an explicitly bilateral master can resolve a missing side.
  // Unknown master metadata (null) must not be treated as false.
  return side === null && unilateral === false ? 'both' : 'unknown';
}
export function validWeight(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0;
}
export function validDay(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
}
export function rangeStart(today: string, range: TrendRange): string {
  const date = new Date(`${today}T00:00:00Z`);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - (range === '3m' ? 3 : range === '6m' ? 6 : 12));
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.toISOString().slice(0, 10);
}
export function weightDays(history: WorkoutSet[], unilateral: boolean | null, range: TrendRange, today: string): WeightDay[] {
  const byDate = new Map<string, WorkoutSet[]>();
  const seen = new Set<string>();
  for (const set of history) {
    if (seen.has(set.set_id) || set.completed === false || set.set_type === 'warmup' || !validDay(set.session_date) || set.session_date > today || (set.load_kg === null && set.reps === null)) continue;
    seen.add(set.set_id);
    const rows = byDate.get(set.session_date) ?? [];
    rows.push(set); byDate.set(set.session_date, rows);
  }
  const dates = [...byDate.keys()].sort();
  const chosen = range === 'six' ? dates.slice(-6) : dates.filter(date => date >= rangeStart(today, range));
  return chosen.map(date => {
    const sets = byDate.get(date)!.sort((a, b) => a.session_id.localeCompare(b.session_id) || (a.set_no ?? 0) - (b.set_no ?? 0) || a.set_id.localeCompare(b.set_id));
    const weights: WeightDay['weights'] = {};
    for (const set of sets) if (validWeight(set.load_kg)) {
      const side = weightSide(set.side, unilateral);
      weights[side] = Math.max(weights[side] ?? set.load_kg, set.load_kg);
    }
    return { date, sets, weights };
  });
}
export function weightAxis(values: number[]): { min: number; max: number; ticks: number[] } {
  const low = Math.min(...values), high = Math.max(...values);
  const padding = Math.max(1, (high - low) * .15, high * .05);
  const raw = (high - low + padding * 2) / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(n => n * power).find(n => n >= raw)!;
  const min = Math.max(0, Math.floor((low - padding) / step) * step);
  const max = Math.ceil((high + padding) / step) * step;
  const ticks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => Number((min + i * step).toFixed(5)));
  return { min, max, ticks };
}
