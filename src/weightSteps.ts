export type WeightDirection = -1 | 1;

const roundKg = (value: number): number => Math.round(value * 10) / 10;

function dumbbellSeries(limit = 100): number[] {
  const values: number[] = [];
  for (let value = 1; value <= 10; value += 1) values.push(value);
  for (let value = 12; value <= limit; value += 2) values.push(value);
  return values;
}

export function nextSelectableWeight(
  current: number,
  direction: WeightDirection,
  equipment: string | null,
  fixedStepKg: number
): number {
  if (equipment === "dumbbell") {
    const series = dumbbellSeries(Math.max(100, current + 4));
    if (direction > 0) return series.find((value) => value > current) ?? roundKg(current + 2);
    return [...series].reverse().find((value) => value < current) ?? 0;
  }
  const step = Number.isFinite(fixedStepKg) && fixedStepKg > 0 ? fixedStepKg : 1;
  return Math.max(0, roundKg(current + direction * step));
}

function isIncrease(action: string | null): boolean {
  return action ? /increase|progress|up|増量/i.test(action) : false;
}

export function normalizePrescriptionWeight(
  value: number | null,
  equipment: string | null,
  fixedStepKg: number,
  progressionAction: string | null
): number | null {
  if (value === null || !Number.isFinite(value)) return value;
  if (equipment === "dumbbell") {
    const series = dumbbellSeries(Math.max(100, value + 4));
    if (isIncrease(progressionAction)) {
      return [...series].reverse().find((candidate) => candidate <= value) ?? series[0];
    }
    return series.reduce((best, candidate) =>
      Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best
    );
  }

  // Barbell/Smith and cable stacks have a zero-based selectable series.
  // Plate-loaded and other machines may include a machine-specific base load;
  // keep their prescribed value intact unless that anchor is explicitly known.
  const canUseZeroAnchor = equipment === "barbell" || equipment === "smith_machine" || equipment === "cable" || equipment === "machine";
  if (!canUseZeroAnchor || !Number.isFinite(fixedStepKg) || fixedStepKg <= 0) return value;
  const scaled = value / fixedStepKg;
  const snapped = isIncrease(progressionAction) ? Math.floor(scaled) : Math.round(scaled);
  return roundKg(Math.max(0, snapped * fixedStepKg));
}
