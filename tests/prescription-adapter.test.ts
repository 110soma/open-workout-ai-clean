import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { adaptPrescriptionBundle } from "../src/prescriptionAdapter";
import type { PrescriptionBundle } from "../src/types";

const bundle = JSON.parse(readFileSync(resolve("examples/prescription.example.json"), "utf8")) as PrescriptionBundle;

describe("Prescription Adapter", () => {
  it("Example Prescriptionを内部Workoutへ変換する", () => {
    const workout = adaptPrescriptionBundle(bundle, "2030-01-15");
    expect(workout.source).toBe("prescription_snapshot");
    expect(workout.source_prescription_date).toBe("2030-01-15");
    expect(workout.exercises).toHaveLength(2);
    expect(workout.exercises[0].exercise_name).toBe("Example Press");
    expect(workout.exercises.flatMap((exercise) => exercise.sets)).toHaveLength(7);
  });

  it("Prescription行ごとの重量・回数・余力を保ち、未入力の実績値を作らない", () => {
    const workout = adaptPrescriptionBundle(bundle, "2030-01-15");
    const press = workout.exercises[0];
    expect(press.sets.map((set) => set.target_rir)).toEqual([2, 2, 2]);
    expect(press.sets.every((set) => set.target_weight_kg === 40)).toBe(true);
    expect(press.sets.every((set) => set.actual_rir === null)).toBe(true);
  });

  it("unilateralがtrueの種目だけ固定pair_id付きの右左セットへ展開する", () => {
    const workout = adaptPrescriptionBundle(bundle, "2030-01-15");
    const unilateral = workout.exercises.find((exercise) => exercise.exercise_id === "EXAMPLE_ROW");
    expect(unilateral?.sets.map((set) => set.side)).toEqual(["R", "L", "R", "L"]);
    expect(unilateral?.sets[0].pair_id).toBe(unilateral?.sets[1].pair_id);
    expect(workout.exercises[0].sets.every((set) => set.side === null && set.pair_id === null)).toBe(true);
  });
});
