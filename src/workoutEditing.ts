import type { LiveWorkoutExercise, LiveWorkoutSet } from './types';
import { newSetFrom } from './liveWorkout';

/** Renumber only the current draft; stable IDs and actual values never change. */
export function renumberSets(sets: LiveWorkoutSet[]): LiveWorkoutSet[] {
  const numbers = new Map<string, number>();
  return sets.map(set => {
    const key = set.pair_id ?? set.set_id;
    if (!numbers.has(key)) numbers.set(key, numbers.size + 1);
    const number = numbers.get(key)!;
    return { ...set, set_no: number, pair_no: set.pair_id ? number : set.pair_no };
  });
}

export function appendExerciseSet(exercise: LiveWorkoutExercise): LiveWorkoutSet[] {
  const template = newSetFrom(exercise);
  const paired = exercise.sets.some(s => s.pair_id && s.side === 'R') && exercise.sets.some(s => s.pair_id && s.side === 'L');
  if (!paired) return renumberSets([...exercise.sets, { ...template, pair_id: null, pair_no: null }]);
  const pair = crypto.randomUUID();
  return renumberSets([...exercise.sets,
    { ...template, set_id: crypto.randomUUID(), pair_id: pair, side: 'R' },
    { ...template, set_id: crypto.randomUUID(), pair_id: pair, side: 'L' }
  ]);
}

export function previousWeight(exercise: LiveWorkoutExercise, setId: string): number | null {
  const index = exercise.sets.findIndex(s => s.set_id === setId);
  const side = exercise.sets[index]?.side;
  return [...exercise.sets.slice(0, index)].reverse().find(s => s.side === side && s.actual_weight_kg !== null)?.actual_weight_kg ?? null;
}
