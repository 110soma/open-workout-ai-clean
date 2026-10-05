import { describe, expect, it } from "vitest";
import type { LiveWorkoutSet } from "../src/types";
import { completedLogicalSetCount, logicalSetCount, pendingLogicalSetCount } from "../src/workoutSetCounts";

const makeSet = (set_id: string, pair_id: string | null, completed: boolean): LiveWorkoutSet => ({
  set_id, set_no: 1, pair_id, pair_no: pair_id ? 1 : null, side: pair_id ? (set_id.endsWith("R") ? "R" : "L") : null,
  target_weight_kg: 20, target_reps_min: 10, target_reps_max: 12, target_rir: 2,
  actual_weight_kg: null, actual_reps: null, actual_rir: null, completed, completed_at: null
});

describe("左右セットの表示用カウント", () => {
  it("右左2記録を1ワーキングセットとして数える", () => {
    const sets = [makeSet("pair-R", "pair-1", true), makeSet("pair-L", "pair-1", true), makeSet("single", null, false)];
    expect(logicalSetCount(sets)).toBe(2);
    expect(completedLogicalSetCount(sets)).toBe(1);
    expect(pendingLogicalSetCount(sets)).toBe(1);
  });

  it("片側だけ完了したpairは未完了として数える", () => {
    const sets = [makeSet("pair-R", "pair-1", true), makeSet("pair-L", "pair-1", false)];
    expect(completedLogicalSetCount(sets)).toBe(0);
    expect(pendingLogicalSetCount(sets)).toBe(1);
  });
});
