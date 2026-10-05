import { describe, expect, it, vi } from "vitest";
import { adaptWorkoutResult } from "../scripts/phase4/workout-result-adapter.mjs";
import { buildCommitPlan, commitWithGateway, rowsToValues } from "../scripts/phase4/commit-planner.mjs";

const sourceSession = {
  session_id: "session-production-1",
  session_date: "2026-10-03",
  status: "committed",
  record_mode: "production",
  bodypart: "背中",
  prescription_id: "rx-1",
  started_at: "2026-10-03T09:00:00.000Z",
  completed_at: "2026-10-03T09:45:00.000Z",
  created_at: "2026-10-03T08:59:50.000Z",
  workout_payload: { exercises: [{ exercise_id: "ROW", exercise_name: "ロウ", order: 1, sets: [{ set_id: "set-production-1" }] }] }
};
const sourceSet = {
  set_id: "set-production-1", session_id: "session-production-1", exercise_id: "ROW",
  set_no: 1, side: "R", actual_weight_kg: 30, actual_reps: 10, actual_rir: null,
  completed: true, completed_at: "2026-10-03T09:10:00.000Z"
};
const context = {
  exerciseIds: new Set(["ROW"]), exerciseNames: new Map([["ROW", "ロウ"]]),
  historySets: [], sessionDates: new Map(), stagingRows: [], variantKeys: new Set()
};

function result(mode: "test" | "production" = "production") {
  return adaptWorkoutResult({ session: { ...sourceSession, record_mode: mode }, sets: [sourceSet] }, context);
}

describe("Phase 4 explicit COMMIT", () => {
  it("仮想productionを01/02向けpayloadへ変換し、未入力RIR等は空欄のままにする", () => {
    const plan = buildCommitPlan(result(), { sourceSession, sourceSets: [sourceSet] });
    expect(plan.status).toBe("commit_candidate");
    expect(plan.session.session_id).toBe("session-production-1");
    expect(plan.sets[0]).toMatchObject({ set_id: "set-production-1", side: "右", load_kg: 30, reps: 10, RIR: null });
    expect(plan.sets[0].RPE).toBeNull();
    expect(plan.sets[0].is_pr).toBeNull();
    expect(rowsToValues(plan).session).toHaveLength(15);
    expect(rowsToValues(plan).sets[0]).toHaveLength(23);
  });

  it("testまたは未分類SessionはCOMMIT候補にしない", () => {
    const testPlan = buildCommitPlan(result("test"), { sourceSession, sourceSets: [sourceSet] });
    expect(testPlan.status).toBe("blocked");
    expect(testPlan.reasons).toContain("record_mode_not_production");
  });

  it("既存session_idまたはset_idの再実行をBLOCKする", () => {
    const plan = buildCommitPlan(result(), {
      sourceSession, sourceSets: [sourceSet],
      historySessions: [{ session_id: "session-production-1" }],
      historySets: [{ set_id: "set-production-1" }]
    });
    expect(plan.status).toBe("blocked");
    expect(plan.reasons).toEqual(expect.arrayContaining([
      "session_id_already_committed", "set_id_already_committed:set-production-1"
    ]));
  });

  it("確認トークンと直前重複確認が通った場合だけGatewayを1回呼ぶ", async () => {
    const plan = buildCommitPlan(result(), { sourceSession, sourceSets: [sourceSet] });
    const gateway = { checkDuplicate: vi.fn().mockResolvedValue(false), commit: vi.fn().mockResolvedValue(undefined) };
    await expect(commitWithGateway(plan, "wrong", gateway)).rejects.toThrow("確認トークン");
    expect(gateway.commit).not.toHaveBeenCalled();
    await expect(commitWithGateway(plan, plan.confirmation_token, gateway)).resolves.toMatchObject({ session_count: 1, set_count: 1 });
    expect(gateway.checkDuplicate).toHaveBeenCalledOnce();
    expect(gateway.commit).toHaveBeenCalledOnce();
  });
});
