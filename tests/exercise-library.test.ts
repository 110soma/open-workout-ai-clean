import { describe, expect, it } from "vitest";
import { groupFor } from "../src/components/ExerciseLibrary";
import type { ExerciseLibraryItem } from "../src/repository";

const item = (primaryBodypart: string, category = "isolation"): ExerciseLibraryItem => ({
  exercise_id: primaryBodypart,
  exercise_name: `${primaryBodypart}の種目`,
  aliases: null,
  category,
  movement: "elbow_flexion",
  equipment: "machine",
  unilateral: false,
  primary_bodypart: primaryBodypart,
  enabled: true,
  lastUsedDate: null,
  recordedSetCount: 0,
});

describe("exercise library categories", () => {
  it("uses the authoritative primary bodypart before text inference", () => {
    expect(groupFor(item("腕"))).toBe("腕");
    expect(groupFor(item("脚"))).toBe("脚");
    expect(groupFor(item("腹"))).toBe("腹");
  });
});
