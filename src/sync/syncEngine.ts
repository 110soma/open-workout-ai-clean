import type { WorkoutDatabase } from "../db";
import type { LiveWorkout } from "../types";

export interface WorkoutPushGateway {
  pushWorkout(workout: LiveWorkout): Promise<{ server_updated_at: string }>;
}

export async function syncWorkoutRecord(
  workout: LiveWorkout,
  gateway: WorkoutPushGateway,
  database: WorkoutDatabase,
  online = true
): Promise<LiveWorkout> {
  if (!online || workout.status !== "completed_local") return workout;

  const syncing: LiveWorkout = { ...workout, sync_status: "syncing", dirty: true };
  await database.liveWorkouts.put(syncing);
  try {
    const result = await gateway.pushWorkout(syncing);
    const synced: LiveWorkout = {
      ...syncing,
      status: "committed",
      sync_status: "synced",
      dirty: false,
      server_updated_at: result.server_updated_at
    };
    await database.liveWorkouts.put(synced);
    return synced;
  } catch (reason) {
    console.error("Cloud sync failed; local workout was preserved", reason);
    const failed: LiveWorkout = {
      ...workout,
      status: "completed_local",
      sync_status: "error",
      dirty: true
    };
    await database.liveWorkouts.put(failed);
    return failed;
  }
}

export async function syncPendingWorkouts(
  gateway: WorkoutPushGateway,
  database: WorkoutDatabase,
  online = true
): Promise<LiveWorkout[]> {
  const pending = await database.liveWorkouts
    .where("status")
    .equals("completed_local")
    .filter((workout) => workout.dirty !== false)
    .toArray();
  const results: LiveWorkout[] = [];
  for (const workout of pending) results.push(await syncWorkoutRecord(workout, gateway, database, online));
  return results;
}
