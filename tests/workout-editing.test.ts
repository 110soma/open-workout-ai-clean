import { describe, expect, it } from 'vitest';
import { createDemoWorkout } from '../src/liveWorkout';
import { appendExerciseSet, previousWeight, renumberSets } from '../src/workoutEditing';

describe('Pilot editing safety', () => {
  it('renumbers after deletion without changing IDs or actual values', () => {
    const e = createDemoWorkout().exercises[0];
    e.sets[1].actual_weight_kg = 29.2;
    const after = renumberSets(e.sets.slice(1));
    expect(after.map(s => s.set_no)).toEqual([1, 2]);
    expect(after.map(s => s.set_id)).toEqual(e.sets.slice(1).map(s => s.set_id));
    expect(after[0].actual_weight_kg).toBe(29.2);
    expect(after[0].actual_rir).toBeNull();
    expect(e.sets[1].set_no).toBe(2);
  });
  it('keeps pair identity while renumbering both sides together', () => {
    const e = createDemoWorkout().exercises[1];
    const result = renumberSets(e.sets);
    expect(result.map(s => s.set_no)).toEqual([1,1]);
    expect(result.map(s => s.side)).toEqual(['R','L']);
    expect(result.map(s => s.pair_id)).toEqual(e.sets.map(s => s.pair_id));
  });
  it('adds a new right/left pair without reusing another pair ID', () => {
    const e = createDemoWorkout().exercises[1];
    const result = appendExerciseSet(e);
    expect(result).toHaveLength(4);
    expect(result.slice(2).map(s => s.set_no)).toEqual([2,2]);
    expect(result[2].pair_id).toBe(result[3].pair_id);
    expect(result[2].pair_id).not.toBe(result[0].pair_id);
    expect(new Set(result.map(s => s.set_id)).size).toBe(4);
    expect(result[2].actual_rir).toBeNull();
  });
  it('copies only the previous entered weight on the same side', () => {
    const e = createDemoWorkout().exercises[0];
    e.sets[0].actual_weight_kg = 41.7;
    expect(previousWeight(e, e.sets[1].set_id)).toBe(41.7);
    expect(previousWeight(e, e.sets[0].set_id)).toBeNull();
    const paired = createDemoWorkout().exercises[1];
    paired.sets[0].actual_weight_kg = 20;
    expect(previousWeight(paired, paired.sets[1].set_id)).toBeNull();
  });
});
