import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkoutDatabase } from "../src/db";
import { activatePlannedWorkout } from "../src/liveWorkout";
import { adaptPrescriptionBundle } from "../src/prescriptionAdapter";
import { syncWorkoutRecord, type WorkoutPushGateway } from "../src/sync/syncEngine";
import type { LiveWorkout, PrescriptionBundle } from "../src/types";

const bundle = JSON.parse(readFileSync(resolve("examples/prescription.example.json"), "utf8")) as PrescriptionBundle;
const databases: WorkoutDatabase[] = [];

function completedWorkout(): LiveWorkout {
  const workout = activatePlannedWorkout(adaptPrescriptionBundle(bundle, "2030-01-15"), "2030-01-15T02:51:00.000Z");
  return {
    ...workout,
    status: "completed_local",
    sync_status: "pending",
    dirty: true,
    completed_at: "2030-01-15T03:00:00.000Z",
    local_updated_at: "2030-01-15T03:00:00.000Z"
  };
}

async function database(): Promise<WorkoutDatabase> {
  const db = new WorkoutDatabase(`sync-test-${crypto.randomUUID()}`);
  databases.push(db);
  await db.open();
  return db;
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((db) => db.delete()));
});

describe("Local-First cloud sync", () => {
  it("オフラインでは送信せずcompleted_localを保持する", async () => {
    const db = await database();
    const workout = completedWorkout();
    await db.liveWorkouts.put(workout);
    let calls = 0;
    const gateway: WorkoutPushGateway = { pushWorkout: async () => { calls += 1; return { server_updated_at: "x" }; } };
    const result = await syncWorkoutRecord(workout, gateway, db, false);
    expect(calls).toBe(0);
    expect(result.status).toBe("completed_local");
    expect((await db.liveWorkouts.get(workout.workout_id))?.dirty).toBe(true);
  });

  it("成功時はcommitted/syncedになり、同じ固定IDの再送で重複しない", async () => {
    const db = await database();
    const workout = completedWorkout();
    await db.liveWorkouts.put(workout);
    const sessions = new Map<string, LiveWorkout>();
    const setIds = new Set<string>();
    const gateway: WorkoutPushGateway = {
      pushWorkout: async (row) => {
        sessions.set(row.workout_id, row);
        row.exercises.flatMap((exercise) => exercise.sets).forEach((set) => setIds.add(set.set_id));
        return { server_updated_at: "2030-01-15T03:01:00.000Z" };
      }
    };
    const first = await syncWorkoutRecord(workout, gateway, db, true);
    await syncWorkoutRecord(workout, gateway, db, true);
    expect(first.status).toBe("committed");
    expect(first.sync_status).toBe("synced");
    expect(first.dirty).toBe(false);
    expect(sessions.size).toBe(1);
    expect(setIds.size).toBe(workout.exercises.flatMap((exercise) => exercise.sets).length);
  });

  it("同期失敗時もローカルデータを消さない", async () => {
    const db = await database();
    const workout = completedWorkout();
    await db.liveWorkouts.put(workout);
    const gateway: WorkoutPushGateway = { pushWorkout: async () => { throw new Error("network unavailable"); } };
    const result = await syncWorkoutRecord(workout, gateway, db, true);
    expect(result.status).toBe("completed_local");
    expect(result.sync_status).toBe("error");
    expect(result.dirty).toBe(true);
    expect(await db.liveWorkouts.get(workout.workout_id)).toBeDefined();
  });
});
