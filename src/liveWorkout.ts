import { db, type WorkoutDatabase } from "./db";
import { dateKey } from "./date";
import { measureAsync } from "./performance";
import { recordMetric } from "./performance";
import { adaptPrescriptionBundle } from "./prescriptionAdapter";
import { requestBackgroundSync } from "./sync/cloudSync";
import type { LiveWorkout, LiveWorkoutExercise, LiveWorkoutSet, PrescriptionBundle } from "./types";

const makeId = (prefix: string): string =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;

function makeSet(
  setNo: number,
  targetWeight: number,
  targetRepsMin: number,
  targetRepsMax: number,
  targetRir: number,
  side: "L" | "R" | null = null,
  pairId: string | null = null,
  pairNo: number | null = null
): LiveWorkoutSet {
  return {
    set_id: makeId("set"),
    set_type: 'working',
    set_no: setNo,
    pair_id: pairId,
    pair_no: pairNo,
    side,
    target_weight_kg: targetWeight,
    target_reps_min: targetRepsMin,
    target_reps_max: targetRepsMax,
    target_rir: targetRir,
    actual_weight_kg: null,
    actual_reps: null,
    actual_rir: null,
    completed: false,
    completed_at: null
  };
}

export function createDemoWorkout(date = dateKey(new Date())): LiveWorkout {
  const now = new Date().toISOString();
  const rowPair = makeId("pair");
  const exercises: LiveWorkoutExercise[] = [
    {
      workout_exercise_id: makeId("exercise"),
      exercise_id: "BENCH_PRESS",
      exercise_name: "Barbell Bench Press",
      target_muscles: "胸",
      equipment: "Barbell",
      attachment: "Bench",
      grip: "Medium",
      technique_variant: "Paused",
      weight_step_kg: 2.5,
      rest_sec: 90,
      order: 1,
      sets: [1, 2, 3].map((setNo) => makeSet(setNo, 60, 6, 10, 2))
    },
    {
      workout_exercise_id: makeId("exercise"),
      exercise_id: "ONE_ARM_DB_ROW",
      exercise_name: "One-arm Dumbbell Row",
      target_muscles: "背中",
      equipment: "Dumbbell",
      attachment: "Bench",
      grip: "Neutral",
      technique_variant: "Supported",
      weight_step_kg: 2,
      rest_sec: 75,
      order: 2,
      sets: [
        makeSet(1, 24, 8, 12, 2, "R", rowPair, 1),
        makeSet(2, 24, 8, 12, 2, "L", rowPair, 1)
      ]
    }
  ];
  return {
    workout_id: `local-demo-${date}`,
    date,
    title: "TODAY WORKOUT",
    bodypart: "胸・背中",
    source: "local_demo",
    status: "planned",
    exercises,
    rest_started_at: null,
    rest_end_at: null,
    last_completed_set_id: null,
    started_at: null,
    completed_at: null,
    created_at: now,
    updated_at: now
  };
}

export const isPrescriptionForDate = (bundle: PrescriptionBundle, date: string): boolean =>
  bundle.latestPrescriptionDate === date;

export async function loadOrCreateTodayWorkout(database: WorkoutDatabase = db): Promise<LiveWorkout | null> {
  return measureAsync("today:load", async () => {
    const date = dateKey(new Date());
    const rows = await database.liveWorkouts.where("date").equals(date).toArray();
    const protectedWorkout =
      rows.find((row) => row.status === "active") ??
      [...rows]
        .filter((row) => row.status === "completed_local" || row.status === "committed")
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
    if (protectedWorkout) return protectedWorkout;
    const bundle = await loadPrescriptionBundle(database);
    if (!bundle || !isPrescriptionForDate(bundle, date)) return null;
    return reconcilePrescriptionWorkout(bundle, date, database);
  });
}

export async function reconcilePrescriptionWorkout(
  bundle: PrescriptionBundle,
  date: string,
  database: WorkoutDatabase = db
): Promise<LiveWorkout> {
  const rows = await database.liveWorkouts.where("date").equals(date).toArray();
  const protectedWorkout =
    rows.find((row) => row.status === "active") ??
    [...rows]
      .filter((row) => row.status === "completed_local" || row.status === "committed")
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  if (protectedWorkout) return protectedWorkout;

  const matchingPlanned = rows.find((row) =>
    row.status === "planned" &&
    row.source === "prescription_snapshot" &&
    row.source_prescription_session_id === bundle.targetSessionId &&
    row.source_revision === bundle.dataRevision
  );
  if (matchingPlanned) return matchingPlanned;

  const workout = adaptPrescriptionBundle(bundle, date);
  const stalePlannedIds = rows.filter((row) => row.status === "planned").map((row) => row.workout_id);
  await database.transaction("rw", database.liveWorkouts, async () => {
    if (stalePlannedIds.length > 0) await database.liveWorkouts.bulkDelete(stalePlannedIds);
    await database.liveWorkouts.put(workout);
  });
  return workout;
}

export async function createAdditionalWorkout(): Promise<LiveWorkout> {
  const date = dateKey(new Date());
  const currentDraft = await db.liveWorkouts
    .where("date")
    .equals(date)
    .filter((row) => row.status === "planned" || row.status === "active")
    .first();
  if (currentDraft) return currentDraft;

  const bundle = await loadPrescriptionBundle();
  if (!bundle || !isPrescriptionForDate(bundle, date)) throw new Error("今日のメニューはまだありません。");
  const workout = adaptPrescriptionBundle(bundle, date);
  await db.liveWorkouts.put(workout);
  return workout;
}

export function activatePlannedWorkout(workout: LiveWorkout, startedAt = new Date().toISOString()): LiveWorkout {
  if (workout.status !== "planned") return workout;

  const sessionId = makeId(`session-${workout.date}`);
  const pairIds = new Map<string, string>();
  const exercises = workout.exercises.map((exercise, exerciseIndex) => ({
    ...exercise,
    workout_exercise_id: `${sessionId}-exercise-${exerciseIndex + 1}`,
    sets: exercise.sets.map((set) => {
      let pairId: string | null = null;
      if (set.pair_id) {
        pairId = pairIds.get(set.pair_id) ?? makeId("pair");
        pairIds.set(set.pair_id, pairId);
      }
      return { ...set, set_id: makeId("set"), pair_id: pairId };
    })
  }));

  return {
    ...workout,
    workout_id: sessionId,
    status: "active",
    exercises,
    started_at: startedAt,
    created_at: startedAt,
    updated_at: startedAt,
    local_updated_at: startedAt,
    sync_status: "pending",
    dirty: true
  };
}

export async function loadPrescriptionBundle(database: WorkoutDatabase = db): Promise<PrescriptionBundle | null> {
  return measureAsync("prescription:idb:get", async () => {
    const [selectedId, revision] = await Promise.all([
      database.meta.get("prescriptionId"),
      database.meta.get("prescriptionRevision")
    ]);
    const selected = selectedId?.value ? await database.prescriptions.get(selectedId.value) : undefined;
    if (selected) {
      recordMetric("prescription:local-only", 0);
      return selected.bundle;
    }
    if (revision?.value) {
      const matching = await database.prescriptions.where("revision").equals(revision.value).sortBy("updated_at");
      const cached = matching.at(-1);
      if (cached) {
        recordMetric("prescription:local-only", 0);
        return cached.bundle;
      }
    }
    return null;
  });
}

let saveQueue = Promise.resolve();

export function flushWorkoutSaves(): Promise<void> { return saveQueue; }

export function replaceLiveWorkout(previousWorkoutId: string, workout: LiveWorkout, database: WorkoutDatabase = db): Promise<void> {
  const snapshot = structuredClone(workout);
  saveQueue = saveQueue.then(() => database.transaction("rw", database.liveWorkouts, async () => {
    if (previousWorkoutId !== snapshot.workout_id) await database.liveWorkouts.delete(previousWorkoutId);
    await database.liveWorkouts.put(snapshot);
  })).catch((reason) => {
    console.error("Failed to activate live workout", reason);
  });
  return saveQueue;
}

export function saveLiveWorkout(workout: LiveWorkout, database: WorkoutDatabase = db): Promise<void> {
  const snapshot = structuredClone({
    ...workout,
    sync_status: workout.status === "committed" ? "synced" : workout.status === "planned" ? "local_only" : "pending",
    dirty: workout.status !== "planned" && workout.status !== "committed",
    local_updated_at: workout.updated_at
  } satisfies LiveWorkout);
  saveQueue = saveQueue.then(() => measureAsync("today:save", async () => {
    await database.liveWorkouts.put(snapshot);
    if (database === db && snapshot.status === "completed_local") queueMicrotask(requestBackgroundSync);
  })).catch((reason) => {
    console.error("Failed to save live workout", reason);
  });
  return saveQueue;
}

export interface HistorySetCorrection {
  set_id: string;
  actual_weight_kg: number | null;
  actual_reps: number | null;
  actual_rir: number | null;
}

export async function correctCompletedWorkout(
  workoutId: string,
  corrections: HistorySetCorrection[],
  database: WorkoutDatabase = db
): Promise<LiveWorkout> {
  const workout = await database.liveWorkouts.get(workoutId);
  if (!workout || (workout.status !== "completed_local" && workout.status !== "committed")) {
    throw new Error("終了済みSessionが見つかりません。");
  }
  const byId = new Map(corrections.map((row) => [row.set_id, row]));
  const updatedAt = new Date().toISOString();
  const next: LiveWorkout = {
    ...workout,
    status: "completed_local",
    sync_status: "pending",
    dirty: true,
    updated_at: updatedAt,
    local_updated_at: updatedAt,
    exercises: workout.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => byId.has(set.set_id) ? { ...set, ...byId.get(set.set_id) } : set)
    }))
  };
  await saveLiveWorkout(next, database);
  return next;
}

export function newSetFrom(exercise: LiveWorkoutExercise): LiveWorkoutSet {
  const latest = [...exercise.sets].sort((a, b) => b.set_no - a.set_no)[0];
  return makeSet(
    (latest?.set_no ?? 0) + 1,
    latest?.target_weight_kg ?? 0,
    latest?.target_reps_min ?? 8,
    latest?.target_reps_max ?? 12,
    latest?.target_rir ?? 2,
    latest?.side ?? null,
    latest?.pair_id ?? null,
    latest?.pair_no !== null && latest?.pair_no !== undefined ? latest.pair_no + 1 : null
  );
}
