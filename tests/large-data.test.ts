import { afterEach, describe, expect, it } from "vitest";
import { WorkoutDatabase, importBundle } from "../src/db";
import { getDayHistory, getMonthlySessions } from "../src/repository";
import type { ImportBundle, WorkoutSession, WorkoutSet } from "../src/types";

function makeBundle(setCount: number): ImportBundle {
  const sessions: WorkoutSession[] = [];
  const sets: WorkoutSet[] = [];
  const sessionCount = Math.ceil(setCount / 20);
  for (let index = 0; index < sessionCount; index += 1) {
    const day = String((index % 28) + 1).padStart(2, "0");
    const sessionId = `session-${index}`;
    sessions.push({ session_id: sessionId, date: `2026-09-${day}`, split: "Test", gym: null, start_time: null, duration_min: null, session_rpe: null, condition: null, bodyweight_kg: null, source: "synthetic", note: null, created_at: null, estimated_min_low: null, estimated_min_high: null, time_outcome: null });
    for (let setIndex = 0; setIndex < 20 && sets.length < setCount; setIndex += 1) {
      sets.push({ set_id: `set-${sets.length}`, session_id: sessionId, session_date: `2026-09-${day}`, exercise_id: `exercise-${setIndex % 10}`, exercise_order: setIndex % 10, set_no: Math.floor(setIndex / 10) + 1, side: setIndex % 2 ? "左" : "右", set_type: "working", load_type: "external", load_kg: 40, reps: 10, RPE: null, RIR: null, rest_sec: null, completed: true, note: null, volume_kg: 400, estimated_1RM: null, is_pr: false, created_at: null, technique_variant_id: null, technique_variant_source: null, technique_variant_version: null, variant_status: null });
    }
  }
  return {
    schemaVersion: 1,
    dataRevision: `large-${setCount}`,
    source: { spreadsheetTitle: "synthetic", spreadsheetId: "none", exportedAt: "2026-10-01", tabs: [] },
    sessions,
    sets,
    exercises: Array.from({ length: 10 }, (_, index) => ({ exercise_id: `exercise-${index}`, exercise_name: `Exercise ${index}`, aliases: null, category: null, movement: null, equipment: null, unilateral: true, primary_bodypart: null, enabled: true })),
    validation: { sessionCount, setCount, exerciseCount: 10, orphanSetCount: 0, unknownExerciseCount: 0 }
  };
}

describe.each([5_000, 20_000])("large data: %i Sets", (setCount) => {
  let database: WorkoutDatabase;
  afterEach(async () => { if (database) await database.delete(); });

  it("imports and queries indexed month/day paths", async () => {
    database = new WorkoutDatabase(`large-${setCount}-${crypto.randomUUID()}`);
    const bundle = makeBundle(setCount);
    const importStarted = performance.now();
    await importBundle(bundle, database);
    const importMs = performance.now() - importStarted;

    const monthStarted = performance.now();
    const month = await getMonthlySessions(2026, 8, database);
    const monthMs = performance.now() - monthStarted;

    const dayStarted = performance.now();
    const day = await getDayHistory("2026-09-01", database);
    const dayMs = performance.now() - dayStarted;

    console.info(JSON.stringify({ setCount, importMs: +importMs.toFixed(2), monthMs: +monthMs.toFixed(2), dayMs: +dayMs.toFixed(2), daySessions: day.sessions.length }));
    expect(await database.sets.count()).toBe(setCount);
    expect(month).toHaveLength(bundle.sessions.length);
    expect(day.sessions.length).toBeGreaterThan(0);
    expect(dayMs).toBeLessThan(1_000);
  });
});
