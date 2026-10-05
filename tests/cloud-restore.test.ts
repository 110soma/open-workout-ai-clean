import { describe, expect, it } from "vitest";
import { applyCloudWorkoutRestore, decideCloudRestore, hydrateCloudWorkout } from "../src/sync/cloudRestore";
import { createDemoWorkout } from "../src/liveWorkout";
import { WorkoutDatabase } from "../src/db";

function cloudFixture() {
  const payload = createDemoWorkout("2026-10-04");
  payload.workout_id = "session-cloud-1";
  payload.status = "committed";
  payload.updated_at = "2026-10-04T10:00:00.000Z";
  const first = payload.exercises[0].sets[0];
  return {
    payload,
    session: {
      session_id: payload.workout_id,
      session_date: payload.date,
      status: "committed",
      record_mode: "production",
      workout_payload: payload,
      local_updated_at: "2026-10-04T10:00:00.000Z",
      server_updated_at: "2026-10-04T10:01:00.000Z"
    },
    set: {
      set_id: first.set_id,
      session_id: payload.workout_id,
      actual_weight_kg: 42.5,
      actual_reps: 9,
      actual_rir: null,
      completed: true,
      completed_at: "2026-10-04T09:59:00.000Z"
    }
  };
}

describe("cloud workout restore", () => {
  it("クラウドpayloadの正式保存済みを信用せず、同じ版のローカル確認済みだけを保持", () => {
    const fixture = cloudFixture();
    fixture.payload.submission = {entry_source:'structured_web_ui',user_submit:true,submitted_at:'2026-10-04T10:00:00.000Z'};
    fixture.payload.official_save_status = 'saved';
    const remote = hydrateCloudWorkout(fixture.session,[fixture.set])!;
    expect(remote.official_save_status).toBe('pending');
    expect(decideCloudRestore({...remote,official_save_status:'saved'},remote).workout?.official_save_status).toBe('saved');
    const changed = {...remote,exercises:remote.exercises.map((e,i)=>i?e:{...e,sets:e.sets.map((s,j)=>j?s:{...s,actual_reps:99})})};
    expect(decideCloudRestore({...remote,official_save_status:'saved'},changed).workout?.official_save_status).toBe('pending');
  });
  it("終了済みproduction Workoutを復元し、Set実績を適用する", () => {
    const fixture = cloudFixture();
    const restored = hydrateCloudWorkout(fixture.session, [fixture.set]);
    expect(restored?.status).toBe("committed");
    expect(restored?.sync_status).toBe("synced");
    expect(restored?.exercises[0].sets[0].actual_weight_kg).toBe(42.5);
    expect(decideCloudRestore(undefined, restored).decision).toBe("insert");
  });

  it("test recordは復元しない", () => {
    const fixture = cloudFixture();
    expect(hydrateCloudWorkout({ ...fixture.session, record_mode: "test" }, [fixture.set])).toBeNull();
  });

  it("active Workoutをクラウドで上書きしない", () => {
    const fixture = cloudFixture();
    const restored = hydrateCloudWorkout(fixture.session, [fixture.set]);
    const active = { ...fixture.payload, status: "active" as const };
    const result = decideCloudRestore(active, restored);
    expect(result.decision).toBe("keep-local");
    expect(result.workout?.status).toBe("active");
  });

  it("同じSessionはinsertせず新しいクラウド版でreplaceする", () => {
    const fixture = cloudFixture();
    const restored = hydrateCloudWorkout(fixture.session, [fixture.set])!;
    const local = { ...restored, local_updated_at: "2026-10-04T09:00:00.000Z" };
    expect(decideCloudRestore(local, restored).decision).toBe("replace");
  });

  it("空のIndexedDBへ復元し、再実行しても同じSessionを増やさない", async () => {
    const fixture = cloudFixture();
    const database = new WorkoutDatabase(`restore-${crypto.randomUUID()}`);
    await database.open();
    await applyCloudWorkoutRestore([fixture.session], [fixture.set], database);
    await applyCloudWorkoutRestore([fixture.session], [fixture.set], database);
    expect(await database.liveWorkouts.count()).toBe(1);
    expect((await database.liveWorkouts.get(fixture.session.session_id))?.exercises[0].sets[0].actual_reps).toBe(9);
    await database.delete();
  });
});
