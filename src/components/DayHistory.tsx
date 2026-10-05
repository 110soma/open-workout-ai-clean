import { useLayoutEffect } from "react";
import { formatLongDate } from "../date";
import { recordMetric } from "../performance";
import type { DayHistory as DayHistoryData, WorkoutSet } from "../types";

interface DayHistoryProps {
  date: string;
  history: DayHistoryData | null;
  loading: boolean;
  clickedAt: number | null;
  onEditSession?: (sessionId: string) => void;
}

const shown = (value: unknown): string => value === null || value === undefined || value === "" ? "—" : String(value);

function loadLabel(set: WorkoutSet): string {
  if (set.load_kg === null) return "—";
  return `${set.load_kg} kg`;
}

function effortLabel(set: WorkoutSet): string {
  const values: string[] = [];
  if (set.RIR !== null) values.push(`RIR ${set.RIR}`);
  if (set.RPE !== null) values.push(`負荷感 ${set.RPE}`);
  return values.length ? values.join(" / ") : "—";
}

export function DayHistory({ date, history, loading, clickedAt, onEditSession }: DayHistoryProps) {
  useLayoutEffect(() => {
    if (!loading && history && clickedAt !== null) {
      recordMetric("ui:day:render", performance.now() - clickedAt);
    }
  }, [clickedAt, history, loading]);

  return (
    <section className="day-history" aria-live="polite">
      <header className="day-heading">
        <div>
          <span className="eyebrow">トレーニング履歴</span>
          <h2>{formatLongDate(date)}</h2>
        </div>
        {history && <span className="session-count">{history.sessions.length}件</span>}
      </header>

      {loading && <div className="status-card">ローカル履歴を読み込み中…</div>}
      {!loading && history?.sessions.length === 0 && (
        <div className="status-card empty"><strong>トレーニング記録なし</strong><span>この日には記録がありません。</span></div>
      )}

      {!loading && history?.sessions.map((session) => {
        const sets = history.setsBySession.get(session.session_id) ?? [];
        const grouped = new Map<string, WorkoutSet[]>();
        sets.forEach((set) => {
          const list = grouped.get(set.exercise_id) ?? [];
          list.push(set);
          grouped.set(set.exercise_id, list);
        });
        return (
          <article className="session-card" key={session.session_id} data-session-id={session.session_id}>
            <div className="session-header">
              <div>
                <span className="eyebrow">セッション</span>
                <h3>{session.split || "トレーニング"}</h3>
              </div>
              {session.duration_min !== null && <span className="duration">{session.duration_min}分</span>}
            </div>
            <dl className="session-meta">
              {session.start_time && <><dt>開始</dt><dd>{session.start_time.slice(0, 5)}</dd></>}
              {session.gym && <><dt>場所</dt><dd>{session.gym}</dd></>}
              {session.session_rpe !== null && <><dt>セッション負荷感</dt><dd>{session.session_rpe}</dd></>}
            </dl>
            {session.source === "Workout_PWA_v2" && onEditSession && <button className="edit-history" onClick={() => onEditSession(session.session_id)}>記録を修正</button>}
            {[...grouped.entries()].map(([exerciseId, exerciseSets]) => {
              const exercise = history.exercisesById.get(exerciseId);
              return (
                <section className="exercise-block" key={exerciseId}>
                  <div className="exercise-title">
                    <h4>{exercise?.exercise_name ?? exerciseId}</h4>
                    <span>{exerciseSets.length}セット</span>
                  </div>
                  <div className="set-table" role="table" aria-label={`${exercise?.exercise_name ?? exerciseId}のセット`}>
                    <div className="set-row set-head" role="row">
                      <span>セット</span><span>重量</span><span>回数</span><span>RIR</span>
                    </div>
                    {exerciseSets.map((set) => (
                      <div className="set-row" role="row" key={set.set_id}>
                        <span className="set-number">{shown(set.set_no)}{set.side && set.side !== "両" ? <small>{set.side}</small> : null}</span>
                        <strong>{loadLabel(set)}</strong>
                        <strong>{set.reps === null ? "—" : `${set.reps} 回`}</strong>
                        <span className="effort">{effortLabel(set)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </article>
        );
      })}
    </section>
  );
}
