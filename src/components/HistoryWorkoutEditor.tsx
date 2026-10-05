import { useEffect, useState } from "react";
import { db } from "../db";
import { correctCompletedWorkout, type HistorySetCorrection } from "../liveWorkout";
import type { LiveWorkout } from "../types";

const numeric = (value: string): number | null => value === "" ? null : Number(value);

export function HistoryWorkoutEditor({ sessionId, onCancel, onSaved }: {
  sessionId: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [workout, setWorkout] = useState<LiveWorkout | null>(null);
  const [rows, setRows] = useState<HistorySetCorrection[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void db.liveWorkouts.get(sessionId).then((value) => {
      setWorkout(value ?? null);
      setRows(value?.exercises.flatMap((exercise) => exercise.sets.filter((set) => set.completed).map((set) => ({
        set_id: set.set_id, actual_weight_kg: set.actual_weight_kg,
        actual_reps: set.actual_reps, actual_rir: set.actual_rir
      }))) ?? []);
    });
  }, [sessionId]);

  function change(setId: string, field: keyof Omit<HistorySetCorrection, "set_id">, value: string) {
    setRows((current) => current.map((row) => row.set_id === setId ? { ...row, [field]: numeric(value) } : row));
  }

  async function save() {
    try {
      await correctCompletedWorkout(sessionId, rows);
      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  if (!workout) return <div className="status-card">Sessionを読み込み中…</div>;
  return (
    <section className="history-editor">
      <span className="eyebrow">同じSessionを修正</span>
      <h3>{workout.bodypart}</h3>
      {error && <p className="input-error">{error}</p>}
      {workout.exercises.map((exercise) => {
        const completedSets = exercise.sets.filter((set) => set.completed);
        if (!completedSets.length) return null;
        return <article key={exercise.workout_exercise_id}>
          <strong>{exercise.exercise_name}</strong>
          {completedSets.map((set) => {
            const row = rows.find((item) => item.set_id === set.set_id);
            return <div className="history-edit-row" key={set.set_id}>
              <span>セット {set.set_no}</span>
              <label>重量<input type="number" inputMode="decimal" value={row?.actual_weight_kg ?? ""} onChange={(event) => change(set.set_id, "actual_weight_kg", event.target.value)} /></label>
              <label>回数<input type="number" inputMode="numeric" value={row?.actual_reps ?? ""} onChange={(event) => change(set.set_id, "actual_reps", event.target.value)} /></label>
              <label>RIR<input type="number" inputMode="decimal" min="0" max="4" value={row?.actual_rir ?? ""} onChange={(event) => change(set.set_id, "actual_rir", event.target.value)} /></label>
            </div>;
          })}
        </article>;
      })}
      <div className="history-editor-actions"><button onClick={onCancel}>戻る</button><button onClick={() => void save()}>同じSessionを保存</button></div>
    </section>
  );
}
