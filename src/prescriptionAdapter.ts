import type {
  LiveWorkout,
  LiveWorkoutExercise,
  LiveWorkoutSet,
  PrescriptionBundle,
  PrescriptionExerciseRow,
  PrescriptionRow
} from "./types";
import { normalizePrescriptionWeight } from "./weightSteps";

const requiredPrescriptionKeys: Array<keyof PrescriptionRow> = [
  "prescription_id", "target_session_id", "exercise_id", "exercise_order", "target_sets",
  "target_load_kg", "target_rep_min", "target_rep_max", "target_RIR", "target_rest_sec",
  "created_at", "status"
];

function assertBundle(bundle: PrescriptionBundle): void {
  if (bundle.schemaVersion !== 1 || !bundle.targetSessionId || bundle.prescriptions.length === 0) {
    throw new Error("Prescriptionデータの形式が正しくありません。");
  }
  for (const row of bundle.prescriptions) {
    for (const key of requiredPrescriptionKeys) {
      if (!(key in row)) throw new Error(`05_Prescriptionsに必要な列がありません: ${key}`);
    }
  }
}

function makeSet(
  row: PrescriptionRow,
  targetWeightKg: number | null,
  setNo: number,
  side: "L" | "R" | null,
  pairId: string | null,
  pairNo: number | null,
  sourceIndex: number
): LiveWorkoutSet {
  return {
    set_id: `rx-${row.prescription_id}-${sourceIndex}-${side ?? "B"}`,
    set_type: 'working',
    set_no: setNo,
    pair_id: pairId,
    pair_no: pairNo,
    side,
    target_weight_kg: targetWeightKg,
    target_reps_min: row.target_rep_min,
    target_reps_max: row.target_rep_max,
    target_rir: row.target_RIR,
    actual_weight_kg: null,
    actual_reps: null,
    actual_rir: null,
    completed: false,
    completed_at: null
  };
}

function expandSets(rows: PrescriptionRow[], exercise: PrescriptionExerciseRow): LiveWorkoutSet[] {
  const sets: LiveWorkoutSet[] = [];
  let logicalSetNo = 0;
  let sourceIndex = 0;
  for (const row of rows) {
    const targetWeightKg = normalizePrescriptionWeight(
      row.target_load_kg,
      exercise.equipment,
      exercise.increment_kg ?? 1,
      row.progression_action
    );
    for (let index = 0; index < row.target_sets; index += 1) {
      logicalSetNo += 1;
      sourceIndex += 1;
      if (exercise.unilateral) {
        const pairId = `pair-${row.prescription_id}-${sourceIndex}`;
        sets.push(makeSet(row, targetWeightKg, logicalSetNo, "R", pairId, logicalSetNo, sourceIndex));
        sets.push(makeSet(row, targetWeightKg, logicalSetNo, "L", pairId, logicalSetNo, sourceIndex));
      } else {
        sets.push(makeSet(row, targetWeightKg, logicalSetNo, null, null, null, sourceIndex));
      }
    }
  }
  return sets;
}

export function adaptPrescriptionBundle(bundle: PrescriptionBundle, workoutDate: string): LiveWorkout {
  assertBundle(bundle);
  const rows = bundle.prescriptions
    .filter((row) => row.target_session_id === bundle.targetSessionId && row.status === "issued")
    .sort((a, b) => a.exercise_order - b.exercise_order || a.prescription_id.localeCompare(b.prescription_id));
  const exercisesById = new Map(bundle.exercises.map((row) => [row.exercise_id, row]));
  const rowsByExercise = new Map<string, PrescriptionRow[]>();
  for (const row of rows) rowsByExercise.set(row.exercise_id, [...(rowsByExercise.get(row.exercise_id) ?? []), row]);

  const exercises: LiveWorkoutExercise[] = [...rowsByExercise.entries()].map(([exerciseId, exerciseRows]) => {
    const exercise = exercisesById.get(exerciseId);
    if (!exercise) throw new Error(`03_Exercisesに種目がありません: ${exerciseId}`);
    const guide = bundle.guides.find((row) => row.exercise_id === exerciseId && row.is_default && row.profile_status === "ACTIVE");
    const slot = bundle.slotRoles.find((row) => row.exercise_id === exerciseId && row.active && row.approval_status === "approved");
    const first = exerciseRows[0];
    return {
      workout_exercise_id: `rx-exercise-${bundle.targetSessionId}-${exerciseId}`,
      exercise_id: exerciseId,
      exercise_name: exercise.exercise_name,
      target_muscles: guide?.target_muscles ?? exercise.note ?? exercise.primary_bodypart,
      equipment: first.equipment ?? slot?.equipment ?? exercise.equipment,
      attachment: first.attachment ?? slot?.attachment ?? null,
      grip: first.grip ?? slot?.grip ?? null,
      technique_variant: guide?.variant_name ?? first.technique_variant_id ?? slot?.technique_variant_id ?? null,
      weight_step_kg: exercise.increment_kg ?? 1,
      rest_sec: first.target_rest_sec ?? 0,
      order: first.exercise_order,
      sets: expandSets(exerciseRows, exercise)
    };
  }).sort((a, b) => a.order - b.order);

  const bodyparts = [...new Set(exercises.map((item) => exercisesById.get(item.exercise_id)?.primary_bodypart).filter(Boolean))];
  const now = new Date().toISOString();
  return {
    workout_id: `local-rx-${workoutDate}-${bundle.targetSessionId}`,
    date: workoutDate,
    title: "今日のメニュー",
    bodypart: bodyparts.join("・") || "—",
    source: "prescription_snapshot",
    source_prescription_date: bundle.latestPrescriptionDate,
    source_prescription_session_id: bundle.targetSessionId,
    source_revision: bundle.dataRevision,
    status: "planned",
    exercises,
    rest_started_at: null,
    rest_end_at: null,
    last_completed_set_id: null,
    started_at: null,
    completed_at: null,
    sync_status: "local_only",
    dirty: false,
    local_updated_at: now,
    server_updated_at: null,
    created_at: now,
    updated_at: now
  };
}
