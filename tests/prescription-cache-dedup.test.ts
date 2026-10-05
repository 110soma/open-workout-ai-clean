import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkoutDatabase } from "../src/db";
import { isPrescriptionForDate, loadPrescriptionBundle, reconcilePrescriptionWorkout } from "../src/liveWorkout";
import { adaptPrescriptionBundle } from "../src/prescriptionAdapter";
import type { PrescriptionBundle } from "../src/types";

const bundle = JSON.parse(readFileSync(resolve("examples/prescription.example.json"), "utf8")) as PrescriptionBundle;
const databases: WorkoutDatabase[] = [];

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()));
});

describe("Prescription cache identity", () => {
  it("日付が違う古いPrescriptionを今日のメニューとして扱わない", () => {
    expect(isPrescriptionForDate(bundle, bundle.latestPrescriptionDate)).toBe(true);
    expect(isPrescriptionForDate(bundle, "2030-01-16")).toBe(false);
  });

  it("同じExample Prescriptionをbundled→cloudで保存しても1件のまま", async () => {
    const database = new WorkoutDatabase(`prescription-dedup-${crypto.randomUUID()}`);
    databases.push(database);
    await database.open();
    const record = {
      prescription_id: bundle.targetSessionId,
      date: bundle.latestPrescriptionDate,
      revision: bundle.dataRevision,
      updated_at: new Date().toISOString(),
      bundle
    };

    await database.prescriptions.put(record);
    await database.prescriptions.put({ ...record, updated_at: new Date().toISOString() });
    expect(await database.prescriptions.count()).toBe(1);

    const first = adaptPrescriptionBundle(bundle, "2030-01-15");
    const second = adaptPrescriptionBundle(bundle, "2030-01-15");
    await database.liveWorkouts.put(first);
    await database.liveWorkouts.put(second);
    expect(await database.liveWorkouts.count()).toBe(1);
  });

  it("同じrevisionでも新しいprescription_idを選択できる", async () => {
    const database = new WorkoutDatabase(`prescription-current-${crypto.randomUUID()}`);
    databases.push(database);
    await database.open();
    const next = { ...bundle, targetSessionId: "example-20300116-01", latestPrescriptionDate: "2030-01-16" };
    await database.prescriptions.bulkPut([
      { prescription_id: bundle.targetSessionId, date: bundle.latestPrescriptionDate, revision: bundle.dataRevision, updated_at: "2030-01-15T00:00:00Z", bundle },
      { prescription_id: next.targetSessionId, date: next.latestPrescriptionDate, revision: next.dataRevision, updated_at: "2030-01-16T00:00:00Z", bundle: next }
    ]);
    await database.meta.put({ key: "prescriptionId", value: next.targetSessionId });
    await database.meta.put({ key: "prescriptionRevision", value: next.dataRevision });

    expect((await loadPrescriptionBundle(database)).targetSessionId).toBe("example-20300116-01");
  });

  it("古い未開始メニューだけを差し替え、activeは上書きしない", async () => {
    const database = new WorkoutDatabase(`prescription-reconcile-${crypto.randomUUID()}`);
    databases.push(database);
    await database.open();
    const date = "2030-01-16";
    const oldPlanned = adaptPrescriptionBundle(bundle, date);
    await database.liveWorkouts.put(oldPlanned);
    const next = { ...bundle, targetSessionId: "example-20300116-01", latestPrescriptionDate: date, dataRevision: "example-2" };

    const replaced = await reconcilePrescriptionWorkout(next, date, database);
    expect(replaced.source_prescription_session_id).toBe("example-20300116-01");
    expect(await database.liveWorkouts.get(oldPlanned.workout_id)).toBeUndefined();

    await database.liveWorkouts.put({ ...replaced, status: "active", workout_id: "active-session" });
    const newer = { ...next, targetSessionId: "example-20300116-02", dataRevision: "example-3" };
    const preserved = await reconcilePrescriptionWorkout(newer, date, database);
    expect(preserved.workout_id).toBe("active-session");
    expect(preserved.status).toBe("active");
  });
});
