import type { LiveWorkout } from "../types";
import type { WorkoutDatabase } from "../db";

export interface CloudWorkoutSessionRow {
  session_id: string;
  session_date: string;
  status: string;
  record_mode?: string | null;
  workout_payload: unknown;
  local_updated_at: string;
  server_updated_at: string;
}

export interface CloudWorkoutSetRow {
  set_id: string;
  session_id: string;
  actual_weight_kg: number | null;
  actual_reps: number | null;
  actual_rir: number | null;
  completed: boolean;
  completed_at: string | null;
}

export type RestoreDecision = "insert" | "replace" | "keep-local" | "conflict" | "invalid";

function isLiveWorkout(value: unknown, sessionId: string): value is LiveWorkout {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<LiveWorkout>;
  return row.workout_id === sessionId && typeof row.date === "string" && Array.isArray(row.exercises);
}

export function hydrateCloudWorkout(
  session: CloudWorkoutSessionRow,
  sets: CloudWorkoutSetRow[]
): LiveWorkout | null {
  if (session.status !== "committed" || session.record_mode === "test" || !isLiveWorkout(session.workout_payload, session.session_id)) return null;
  const values = new Map(sets.filter((set) => set.session_id === session.session_id).map((set) => [set.set_id, set]));
  const payload = session.workout_payload;
  return {
    ...payload,
    date: session.session_date,
    status: "committed",
    official_save_status: payload.submission?.user_submit ? "pending" : undefined,
    sync_status: "synced",
    dirty: false,
    local_updated_at: session.local_updated_at,
    server_updated_at: session.server_updated_at,
    updated_at: session.local_updated_at,
    exercises: payload.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => {
        const cloud = values.get(set.set_id);
        return cloud ? {
          ...set,
          actual_weight_kg: cloud.actual_weight_kg,
          actual_reps: cloud.actual_reps,
          actual_rir: cloud.actual_rir,
          completed: cloud.completed,
          completed_at: cloud.completed_at
        } : set;
      })
    }))
  };
}

export function decideCloudRestore(local: LiveWorkout | undefined, remote: LiveWorkout | null): {
  decision: RestoreDecision;
  workout: LiveWorkout | null;
} {
  if (!remote) return { decision: "invalid", workout: null };
  if (!local) return { decision: "insert", workout: remote };
  if (local.status === "planned" || local.status === "active" || local.status === "completed_local" || local.dirty) {
    return { decision: "keep-local", workout: local };
  }
  const localTime = Date.parse(local.local_updated_at ?? local.updated_at);
  const remoteTime = Date.parse(remote.local_updated_at ?? remote.updated_at);
  if (Number.isFinite(localTime) && Number.isFinite(remoteTime) && localTime > remoteTime) {
    return { decision: "conflict", workout: { ...local, sync_status: "conflict" } };
  }
  // The server receipt is local UI metadata, not a cloud actual. Preserve it
  // only for the SAME immutable cloud revision; changed records must revalidate.
  const sameRevision = localTime === remoteTime && JSON.stringify(local.exercises) === JSON.stringify(remote.exercises);
  return { decision: "replace", workout: sameRevision && local.official_save_status === "saved"
    ? { ...remote, official_save_status: "saved" } : remote };
}

export async function applyCloudWorkoutRestore(
  sessions: CloudWorkoutSessionRow[],
  sets: CloudWorkoutSetRow[],
  database: WorkoutDatabase
): Promise<{ restored: number; conflicts: number }> {
  let restored = 0;
  let conflicts = 0;
  await database.transaction("rw", database.liveWorkouts, database.meta, async () => {
    for (const row of sessions) {
      const remote = hydrateCloudWorkout(row, sets);
      const local = await database.liveWorkouts.get(row.session_id);
      const result = decideCloudRestore(local, remote);
      if (result.workout && (result.decision === "insert" || result.decision === "replace")) {
        await database.liveWorkouts.put(result.workout);
        restored += 1;
      } else if (result.decision === "conflict" && result.workout) {
        await database.liveWorkouts.put(result.workout);
        conflicts += 1;
      }
    }
    await database.meta.put({ key: "cloudWorkoutRestoreAt", value: new Date().toISOString() });
  });
  return { restored, conflicts };
}
