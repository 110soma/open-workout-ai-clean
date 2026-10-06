import Dexie, { type EntityTable } from "dexie";
import type { Exercise, ImportBundle, LiveWorkout, PrescriptionCacheRecord, WorkoutSession, WorkoutSet } from "./types";
import { measureAsync, recordMetric } from "./performance";
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

  constructor(name = "open-workout-ai", readonly accountId: string | null = null) {
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

// Connected storage is selected once, before mounting data-bearing screens.
// The old unowned database is deliberately never imported into an account.
export let db = new WorkoutDatabase(isDemoMode ? 'open-workout-ai-demo' : 'open-workout-ai-signed-out');

export async function openAccountDatabase(accountId: string, projectUrl: string): Promise<WorkoutDatabase> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(accountId)) throw new Error('invalid_account_id');
  const project = new URL(projectUrl).origin;
  const database = new WorkoutDatabase(`open-workout-ai:${encodeURIComponent(project)}:${accountId}`, accountId);
  await database.open();
  try {
    await database.transaction('rw', database.meta, async () => {
      const owner = await database.meta.get('authUserId');
      const storedProject = await database.meta.get('authProject');
      if ((owner && owner.value !== accountId) || (storedProject && storedProject.value !== project)) {
        throw new Error('local_account_owner_mismatch');
      }
      await database.meta.put({ key: 'authUserId', value: accountId });
      await database.meta.put({ key: 'authProject', value: project });
    });
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

export async function bindAccountDatabase(accountId: string, projectUrl: string): Promise<void> {
  if (isDemoMode) throw new Error('demo_account_binding_forbidden');
  const selected = await openAccountDatabase(accountId, projectUrl);
  db.close();
  db = selected;
}

export function assertAccountOwner(database: WorkoutDatabase, accountId: string): void {
  if (!database.accountId || database.accountId !== accountId) throw new Error('local_account_owner_mismatch');
}

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
