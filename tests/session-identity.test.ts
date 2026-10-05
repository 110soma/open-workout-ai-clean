import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkoutDatabase } from "../src/db";
import { activatePlannedWorkout, correctCompletedWorkout, replaceLiveWorkout } from "../src/liveWorkout";
import { adaptPrescriptionBundle } from "../src/prescriptionAdapter";
import { getDayHistory, getMonthlySessions } from "../src/repository";
import type { PrescriptionBundle } from "../src/types";

const bundle = JSON.parse(readFileSync(resolve("examples/prescription.example.json"), "utf8")) as PrescriptionBundle;
const databases: WorkoutDatabase[] = [];

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()));
});

describe("Workout Session identity", () => {
  it("同じPrescriptionから開始した別Workoutは異なるSession/Set IDを持つ", () => {
    const first = activatePlannedWorkout(adaptPrescriptionBundle(bundle, "2030-01-15"));
    const second = activatePlannedWorkout(adaptPrescriptionBundle(bundle, "2030-01-15"));

    expect(first.workout_id).not.toBe(second.workout_id);
    expect(first.source_prescription_session_id).toBe(second.source_prescription_session_id);
    const firstSetIds = new Set(first.exercises.flatMap((exercise) => exercise.sets.map((set) => set.set_id)));
    expect(second.exercises.flatMap((exercise) => exercise.sets).every((set) => !firstSetIds.has(set.set_id))).toBe(true);
  });

  it("開始時にdraftを置き換え、再読み込みでは同じSessionを復元できる", async () => {
    const database = new WorkoutDatabase(`session-identity-${crypto.randomUUID()}`);
    databases.push(database);
    await database.open();
    const planned = adaptPrescriptionBundle(bundle, "2030-01-15");
    await database.liveWorkouts.put(planned);
    const active = activatePlannedWorkout(planned, "2030-01-15T03:00:00.000Z");

    await replaceLiveWorkout(planned.workout_id, active, database);

    expect(await database.liveWorkouts.get(planned.workout_id)).toBeUndefined();
    expect((await database.liveWorkouts.get(active.workout_id))?.status).toBe("active");
    expect((await database.liveWorkouts.get(active.workout_id))?.workout_id).toBe(active.workout_id);
  });

  it("履歴修正は同じSession/Set IDを更新し、新Sessionを作らない", async () => {
    const database = new WorkoutDatabase(`history-correction-${crypto.randomUUID()}`);
    databases.push(database);
    await database.open();
    const active = activatePlannedWorkout(adaptPrescriptionBundle(bundle, "2030-01-15"), "2030-01-15T03:00:00.000Z");
    const firstSet = active.exercises[0].sets[0];
    const completed = {
      ...active,
      status: "committed" as const,
      sync_status: "synced" as const,
      completed_at: "2030-01-15T03:30:00.000Z",
      exercises: active.exercises.map((exercise, index) => index ? exercise : {
        ...exercise,
        sets: exercise.sets.map((set, setIndex) => setIndex ? set : {
          ...set, completed: true, actual_weight_kg: 40, actual_reps: 10, actual_rir: 2
        })
      })
    };
    await database.liveWorkouts.put(completed);

    const corrected = await correctCompletedWorkout(completed.workout_id, [{
      set_id: firstSet.set_id, actual_weight_kg: 41.7, actual_reps: 11, actual_rir: null
    }], database);
    expect(corrected.workout_id).toBe(completed.workout_id);
    expect(corrected.exercises[0].sets[0]).toMatchObject({ set_id: firstSet.set_id, actual_weight_kg: 41.7, actual_reps: 11, actual_rir: null });
    expect(corrected.status).toBe("completed_local");
    expect(await database.liveWorkouts.count()).toBe(1);

    const history = await getDayHistory("2030-01-15", database);
    expect(history.sessions.map((row) => row.session_id)).toContain(completed.workout_id);
    expect(history.setsBySession.get(completed.workout_id)?.[0].reps).toBe(11);
    expect(await getMonthlySessions(2030, 0, database)).toHaveLength(1);
  });
});
