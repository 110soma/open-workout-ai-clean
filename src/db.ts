import Dexie, { type EntityTable } from "dexie";
import type { Exercise, ImportBundle, LiveWorkout, PrescriptionCacheRecord, WorkoutSession, WorkoutSet } from "./types";
import { measureAsync, recordMetric } from "./performance";
import { BUNDLED_DATA_REVISION } from "./generated/dataRevision";
import { isDemoMode } from './runtimeMode';

export interface MetaRecord {
  key: string;
  value: string;
}

export class WorkoutDatabase extends Dexie {
  sessions!: EntityTable<WorkoutSession, "session_id">;
  sets!: EntityTable<WorkoutSet, "set_id">;
  exercises!: EntityTable<Exercise, "exercise_id">;
  meta!: EntityTable<MetaRecord, "key">;
  liveWorkouts!: EntityTable<LiveWorkout, "workout_id">;
  prescriptions!: EntityTable<PrescriptionCacheRecord, "prescription_id">;

  constructor(name = "open-workout-ai") {
    super(name);
    this.version(1).stores({
      sessions: "&session_id,date,[date+session_id]",
      sets: "&set_id,session_id,session_date,exercise_id,[session_id+exercise_id],[session_id+exercise_order]",
      exercises: "&exercise_id,exercise_name",
      meta: "&key"
    });
    this.version(2).stores({
      sessions: "&session_id,date,[date+session_id]",
      sets: "&set_id,session_id,session_date,exercise_id,[session_id+exercise_id],[session_id+exercise_order]",
      exercises: "&exercise_id,exercise_name",
      meta: "&key",
      liveWorkouts: "&workout_id,date,status,updated_at"
    });
    this.version(3).stores({
      sessions: "&session_id,date,[date+session_id]",
      sets: "&set_id,session_id,session_date,exercise_id,[session_id+exercise_id],[session_id+exercise_order]",
      exercises: "&exercise_id,exercise_name",
      meta: "&key",
      liveWorkouts: "&workout_id,date,status,updated_at",
      prescriptions: "&prescription_id,date,revision,updated_at"
    });
  }
}

export const db = new WorkoutDatabase(isDemoMode ? 'open-workout-ai-demo' : 'open-workout-ai');

export async function initializeDatabase(database: WorkoutDatabase = db): Promise<void> {
  await measureAsync("db:initialize", async () => {
    await database.open();
  });
}

export async function importBundle(
  bundle: ImportBundle,
  database: WorkoutDatabase = db
): Promise<boolean> {
  const current = await database.meta.get("dataRevision");
  if (current?.value === bundle.dataRevision) {
    recordMetric("db:import:skipped", 0);
    return false;
  }

  await measureAsync("db:import", async () => {
    await database.transaction("rw", database.sessions, database.sets, database.exercises, database.meta, async () => {
      await Promise.all([
        database.sessions.clear(),
        database.sets.clear(),
        database.exercises.clear()
      ]);
      await database.sessions.bulkPut(bundle.sessions);
      await database.sets.bulkPut(bundle.sets);
      await database.exercises.bulkPut(bundle.exercises);
      await database.meta.put({ key: "dataRevision", value: bundle.dataRevision });
      await database.meta.put({ key: "importedAt", value: new Date().toISOString() });
    });
  });
  return true;
}

export async function seedFromStaticBundle(
  database: WorkoutDatabase = db,
  expectedRevision = BUNDLED_DATA_REVISION
): Promise<boolean> {
  const localRevision = await database.meta.get("dataRevision");
  if (localRevision?.value === expectedRevision) {
    recordMetric("db:seed:local-only", 0);
    return false;
  }
  const response = await fetch("/data/history-v1.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(`履歴データを読み込めませんでした (${response.status})`);
  const bundle = (await response.json()) as ImportBundle;
  return importBundle(bundle, database);
}
