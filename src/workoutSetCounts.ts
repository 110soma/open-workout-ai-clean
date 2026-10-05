import type { LiveWorkoutSet } from "./types";

const groupKey = (set: LiveWorkoutSet): string => set.pair_id ?? set.set_id;

export function logicalSets(sets: LiveWorkoutSet[]): LiveWorkoutSet[] {
  const seen = new Set<string>();
  return sets.filter((set) => {
    const key = groupKey(set);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function logicalSetCount(sets: LiveWorkoutSet[]): number {
  return logicalSets(sets).length;
}

export function completedLogicalSetCount(sets: LiveWorkoutSet[]): number {
  const groups = new Map<string, LiveWorkoutSet[]>();
  for (const set of sets) groups.set(groupKey(set), [...(groups.get(groupKey(set)) ?? []), set]);
  return [...groups.values()].filter((group) => group.every((set) => set.completed)).length;
}

export function pendingLogicalSetCount(sets: LiveWorkoutSet[]): number {
  const keys = new Set(sets.filter((set) => !set.completed).map(groupKey));
  return keys.size;
}
