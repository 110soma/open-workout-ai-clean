import { describe, expect, it } from "vitest";
import { nextSelectableWeight, normalizePrescriptionWeight } from "../src/weightSteps";

describe("器具別の重量刻み", () => {
  it("ダンベルは10kgまで1kg、その後2kg系列", () => {
    expect(nextSelectableWeight(9, 1, "dumbbell", 2)).toBe(10);
    expect(nextSelectableWeight(10, 1, "dumbbell", 2)).toBe(12);
    expect(nextSelectableWeight(12, -1, "dumbbell", 2)).toBe(10);
  });

  it("バーベルはexercise固有の2.5kg刻み", () => {
    expect(nextSelectableWeight(57.5, 1, "barbell", 2.5)).toBe(60);
    expect(nextSelectableWeight(60, 1, "barbell", 2.5)).toBe(62.5);
  });

  it("Cableは単一スタック5kg、左右合計設定なら10kg刻み", () => {
    expect(nextSelectableWeight(20, 1, "cable", 5)).toBe(25);
    expect(nextSelectableWeight(40, 1, "cable", 10)).toBe(50);
  });

  it("手入力値は丸めず、操作時もexercise固有stepを相対適用する", () => {
    expect(nextSelectableWeight(29.2, 1, "plate_loaded", 2.5)).toBe(31.7);
    expect(nextSelectableWeight(41.7, -1, "plate_loaded", 2.5)).toBe(39.2);
  });

  it("増量Prescriptionは安全側へ実現可能重量に合わせる", () => {
    expect(normalizePrescriptionWeight(61.3, "barbell", 2.5, "increase")).toBe(60);
    expect(normalizePrescriptionWeight(11.7, "dumbbell", 2, "increase")).toBe(10);
    expect(normalizePrescriptionWeight(27.4, "machine", 5, "increase")).toBe(25);
    expect(normalizePrescriptionWeight(29.2, "plate_loaded", 2.5, "increase")).toBe(29.2);
  });
});
