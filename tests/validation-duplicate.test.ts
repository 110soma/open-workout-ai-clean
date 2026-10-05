import { describe, expect, it } from "vitest";
import { adaptWorkoutResult } from "../scripts/phase4/workout-result-adapter.mjs";

const exerciseIds = new Set(["ROW"]);
const exerciseNames = new Map([["ROW", "ロウ"]]);

function session(recordMode = "test") {
  return {
    session_id: "local-rx-test",
    session_date: "2026-10-02",
    status: "committed",
    record_mode: recordMode,
    bodypart: "背中・肩・腕",
    prescription_id: "fixture-prescription-01",
    started_at: "2026-10-02T03:00:00.000Z",
    completed_at: "2026-10-02T03:09:00.000Z",
    workout_payload: { exercises: [{ exercise_id: "ROW", exercise_name: "ロウ", order: 1, sets: [{ set_id: "set-r" }, { set_id: "set-l" }] }] }
  };
}

function set(id = "set-r", side: "L" | "R" | null = "R", rir: number | null = null) {
  return {
    set_id: id,
    session_id: "local-rx-test",
    exercise_id: "ROW",
    set_no: 1,
    side,
    actual_weight_kg: 30,
    actual_reps: 10,
    actual_rir: rir,
    completed: true
  };
}

const base = { exerciseIds, exerciseNames, historySets: [], sessionDates: new Map(), stagingRows: [], variantKeys: new Set() };

describe("Phase 4 Workout Result Adapter", () => {
  it("test sessionはvalidation readyでもCOMMITを遮断し、RIR空欄を維持する", () => {
    const result = adaptWorkoutResult({ session: session("test"), sets: [set()] }, base);
    expect(result.session.duration_min).toBe(9);
    expect(result.rows[0].row.RIR).toBeNull();
    expect(result.rows[0].row.side).toBe("右");
    expect(result.rows[0].row.parser_confidence).toBeNull();
    expect(result.rows[0].row.validation_status).toBe("ready");
    expect(result.rows[0].row.duplicate_status).toBe("unique");
    expect(result.rows[0].row.entry_source).toBe("structured_web_ui");
    expect(result.rows[0].commitEligible).toBe(false);
    expect(result.rows[0].row.import_status).toBe("staged_test_blocked");
  });

  it("record_mode未設定は推測せずCOMMIT候補にしない", () => {
    const unclassified = { ...session("production"), record_mode: undefined };
    const result = adaptWorkoutResult({ session: unclassified, sets: [set()] }, base);
    expect(result.session.record_mode).toBe("unclassified");
    expect(result.rows[0].commitEligible).toBe(false);
    expect(result.rows[0].row.import_status).toBe("validation_review");
  });

  it("同じ内容のproduction sessionはDry Run上COMMIT候補になる", () => {
    const result = adaptWorkoutResult({ session: session("production"), sets: [set("set-r", "R", 2)] }, base);
    expect(result.rows[0].row.validation_status).toBe("ready");
    expect(result.rows[0].row.duplicate_status).toBe("unique");
    expect(result.rows[0].row.user_submit).toBe(true);
    expect(result.rows[0].commitEligible).toBe(true);
    expect(result.rows[0].row.action).toBe("HOLD");
    expect(result.summary.sheets_commit_count).toBe(0);
  });

  it("ユーザー提示テキストは専用sourceを維持し、structured_web_uiへ偽装しない", () => {
    const manual = {
      ...session("production"),
      entry_source: "user_provided_text",
      user_submit: true,
      source: "user_text:2026-10-02_chest",
      session_source: "user_provided_text"
    };
    const result = adaptWorkoutResult({ session: manual, sets: [set("set-r", "R", null)] }, base);
    expect(result.rows[0].row.entry_source).toBe("user_provided_text");
    expect(result.rows[0].row.parser_confidence).toBeNull();
    expect(result.rows[0].commitEligible).toBe(true);
    expect(result.session.source).toBe("user_provided_text");
  });

  it("同じsource_set_idの再取込はduplicateでCOMMIT不可", () => {
    const first = adaptWorkoutResult({ session: session("production"), sets: [set()] }, base);
    const second = adaptWorkoutResult(
      { session: session("production"), sets: [set()] },
      { ...base, stagingRows: first.rows.map((item: any) => item.row) }
    );
    expect(second.rows[0].row.duplicate_status).toBe("duplicate");
    expect(second.rows[0].commitEligible).toBe(false);
  });

  it("同一Sessionのduplicate key一致をduplicate、値差をpossible_duplicateにする", () => {
    const historySessionDates = new Map([["local-rx-test", "2026-10-02"]]);
    const exact = adaptWorkoutResult(
      { session: session("production"), sets: [set()] },
      { ...base, sessionDates: historySessionDates, historySets: [{ set_id: "old-set", session_id: "local-rx-test", exercise_id: "ROW", side: "右", set_no: 1, load_type: "external", load_kg: 30, reps: 10 }] }
    );
    expect(exact.rows[0].row.duplicate_status).toBe("duplicate");

    const changed = adaptWorkoutResult(
      { session: session("production"), sets: [{ ...set(), actual_reps: 11 }] },
      { ...base, sessionDates: historySessionDates, historySets: [{ set_id: "old-set", session_id: "local-rx-test", exercise_id: "ROW", side: "右", set_no: 1, load_type: "external", load_kg: 30, reps: 10 }] }
    );
    expect(changed.rows[0].row.duplicate_status).toBe("possible_duplicate");
    expect(changed.rows[0].commitEligible).toBe(false);
  });

  it("別Sessionの追加トレーニングは同じ実績値でもduplicateにしない", () => {
    const historySessionDates = new Map([["previous-session", "2026-10-02"]]);
    const result = adaptWorkoutResult(
      { session: session("production"), sets: [set()] },
      { ...base, sessionDates: historySessionDates, historySets: [{ set_id: "old-set", session_id: "previous-session", exercise_id: "ROW", side: "右", set_no: 1, load_type: "external", load_kg: 30, reps: 10 }] }
    );
    expect(result.rows[0].row.duplicate_status).toBe("unique");
    expect(result.rows[0].commitEligible).toBe(true);
  });

  it("左右は独立行になり、未知sideや不正RIRはreviewになる", () => {
    const left = adaptWorkoutResult({ session: session("production"), sets: [set("set-l", "L", 1)] }, base);
    expect(left.rows[0].row.side).toBe("左");
    const invalid = adaptWorkoutResult(
      { session: session("production"), sets: [{ ...set(), side: "X", actual_rir: 5 }] },
      base
    );
    expect(invalid.rows[0].row.validation_status).toBe("review");
    expect(invalid.rows[0].issues).toEqual(expect.arrayContaining(["side_invalid", "RIR_invalid"]));
  });
});
