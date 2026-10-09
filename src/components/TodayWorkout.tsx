import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { activatePlannedWorkout, createAdditionalWorkout, loadOrCreateTodayWorkout, loadPrescriptionBundle, newSetFrom, replaceLiveWorkout, saveLiveWorkout } from "../liveWorkout";
import { recordMetric } from "../performance";
import { CLOUD_STATE_EVENT } from "../sync/cloudSync";
import type { Exercise, LiveWorkout, LiveWorkoutExercise, LiveWorkoutSet, WorkoutSet } from "../types";
import { db } from '../db';
import { getPreviousExerciseSets } from '../repository';
import { appendExerciseSet, previousWeight, renumberSets } from '../workoutEditing';
import { isDemoMode } from '../runtimeMode';
import { RestTimerDial } from './RestTimerDial';
import { nextSelectableWeight } from "../weightSteps";
import { completedLogicalSetCount, logicalSetCount, logicalSets, pendingLogicalSetCount } from "../workoutSetCounts";

const numberOrNull = (value: string): number | null => value === "" ? null : Number(value);
const targetReps = (set: LiveWorkoutSet): string =>
  set.target_reps_min === set.target_reps_max
    ? `${set.target_reps_min ?? "—"}`
    : `${set.target_reps_min ?? "—"}–${set.target_reps_max ?? "—"}`;
const exerciseArt = (_name: string): string => "/images/exercise/placeholder.svg";
const sideLabel = (side: LiveWorkoutSet["side"]): string => side === "R" ? "右" : side === "L" ? "左" : "";
const equipmentLabels: Record<string, string> = {
  plate_loaded: "プレートロード",
  machine: "マシン",
  machine_or_ez: "マシン／EZバー",
  ez_bar: "EZバー",
  dumbbell: "ダンベル",
  cable: "ケーブル"
};
const attachmentLabels: Record<string, string> = {
  wide_bar: "ワイドバー",
  preacher_bench: "プリチャーベンチ",
  straight_bar: "ストレートバー",
  rope: "ロープ"
};
const gripLabels: Record<string, string> = {
  wide_pronated: "ワイド・順手",
  neutral: "ニュートラル",
  supinated: "逆手",
  pronated: "順手"
};
const displayCode = (value: string | null, labels: Record<string, string>): string => value ? labels[value] ?? value : "—";
const prescriptionDate = (workout: LiveWorkout): string | null => workout.source_prescription_date?.replaceAll("-", "/") ?? null;
const syncLabel = (workout: LiveWorkout): string => {
  if (isDemoMode) return 'デモ完了・外部送信なし';
  if (workout.official_save_status === 'saved') return '正式保存済み';
  if (workout.submission && (workout.status === 'committed' || workout.sync_status === 'synced')) return 'クラウド保存済み・正式記録は確認待ち';
  if (workout.status === "committed" || workout.sync_status === "synced") return "クラウド保存済み";
  if (workout.sync_status === "syncing") return "クラウドへ同期中";
  if (workout.sync_status === "error" || workout.sync_status === "conflict") return "同期エラー・端末には保存済み";
  return "クラウド保存待ち";
};

interface TodayWorkoutProps {
  onOpenHistory: () => void;
}

const allSets = (workout: LiveWorkout) => workout.exercises.flatMap((exercise) => exercise.sets);
const durationMinutes = (workout: LiveWorkout): number => {
  if (!workout.started_at || !workout.completed_at) return 0;
  return Math.max(1, Math.round((new Date(workout.completed_at).getTime() - new Date(workout.started_at).getTime()) / 60_000));
};

export function TodayWorkout({ onOpenHistory }: TodayWorkoutProps) {
  const [workout, setWorkout] = useState<LiveWorkout | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [restRenderStarted, setRestRenderStarted] = useState<number | null>(null);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [pendingRir, setPendingRir] = useState<{ exerciseId: string; setId: string } | null>(null);
  const [focusSetId, setFocusSetId] = useState<string | null>(null);
  const [previous, setPrevious] = useState<Record<string, WorkoutSet[]>>({});
  const [catalog, setCatalog] = useState<Exercise[]>([]);
  const [addingExercise, setAddingExercise] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [extraWeight, setExtraWeight] = useState('');
  const [extraReps, setExtraReps] = useState('10');
  const [extraRest, setExtraRest] = useState('90');
  const [extraPaired, setExtraPaired] = useState(false);

  useEffect(() => { void db.exercises.filter(e => e.enabled !== false).toArray().then(setCatalog); }, []);
  const exerciseIdentity = workout?.exercises.map(e => e.exercise_id).join('|');
  useEffect(() => {
    if (!workout) return;
    let current = true;
    void Promise.all(workout.exercises.map(async e => [e.exercise_id, await getPreviousExerciseSets(e.exercise_id, workout.workout_id, workout.date)] as const))
      .then(rows => { if (current) setPrevious(Object.fromEntries(rows)); }).catch(() => { if (current) setPrevious({}); });
    return () => { current = false; };
  }, [workout?.workout_id, exerciseIdentity]);

  useLayoutEffect(() => {
    if (!focusSetId || workout?.rest_end_at) return;
    const element = document.querySelector<HTMLElement>(`[data-set-id="${focusSetId}"]`);
    element?.scrollIntoView({ block: 'start', behavior: 'instant' });
    setFocusSetId(null);
  }, [focusSetId, workout?.rest_end_at]);

  useEffect(() => {
    let active = true;
    loadOrCreateTodayWorkout()
      .then((value) => { if (active) setWorkout(value); })
      .catch((reason) => { if (active) setError(String(reason)); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const refresh = () => void loadOrCreateTodayWorkout().then(setWorkout);
    window.addEventListener(CLOUD_STATE_EVENT, refresh);
    return () => window.removeEventListener(CLOUD_STATE_EVENT, refresh);
  }, []);

  useEffect(() => {
    if (!workout?.rest_end_at) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [workout?.rest_end_at]);

  useLayoutEffect(() => {
    if (workout?.rest_end_at && restRenderStarted !== null) {
      recordMetric("today:set-complete-to-rest", performance.now() - restRenderStarted);
      setRestRenderStarted(null);
    }
  }, [restRenderStarted, workout?.rest_end_at]);

  const pendingSets = useMemo(() => workout?.exercises
    .flatMap((exercise) => exercise.sets.map((set) => ({ exercise, set })))
    .filter(({ set }) => !set.completed) ?? [], [workout]);

  function update(transform: (current: LiveWorkout) => LiveWorkout) {
    setWorkout((current) => {
      if (!current) return current;
      const next = transform(current);
      void saveLiveWorkout(next);
      return next;
    });
  }

  function updateSet(exerciseId: string, setId: string, field: "actual_weight_kg" | "actual_reps" | "actual_rir", value: string) {
    update((current) => ({
      ...current,
      updated_at: new Date().toISOString(),
      exercises: current.exercises.map((exercise) => exercise.workout_exercise_id !== exerciseId ? exercise : {
        ...exercise,
        sets: exercise.sets.map((set) => set.set_id === setId ? { ...set, [field]: numberOrNull(value) } : set)
      })
    }));
  }

  function adjustSet(exerciseId: string, setId: string, field: "actual_weight_kg" | "actual_reps", delta: number) {
    update((current) => ({
      ...current,
      updated_at: new Date().toISOString(),
      exercises: current.exercises.map((exercise) => exercise.workout_exercise_id !== exerciseId ? exercise : {
        ...exercise,
        sets: exercise.sets.map((set) => {
          if (set.set_id !== setId) return set;
          const fallback = field === "actual_weight_kg" ? set.target_weight_kg : set.target_reps_min;
          const currentValue = set[field] ?? fallback ?? 0;
          const nextValue = field === "actual_weight_kg"
            ? nextSelectableWeight(currentValue, delta < 0 ? -1 : 1, exercise.equipment, exercise.weight_step_kg)
            : Math.max(0, Math.round(currentValue + delta));
          return { ...set, [field]: nextValue };
        })
      })
    }));
  }

  function requestSetCompletion(exerciseId: string, setId: string) {
    const exercise = workout?.exercises.find((item) => item.workout_exercise_id === exerciseId);
    const set = exercise?.sets.find((item) => item.set_id === setId);
    if (!exercise || !set) return;
    if ((set.actual_weight_kg ?? set.target_weight_kg) === null || (set.actual_reps ?? set.target_reps_min) === null) {
      setError("実際の重量と回数を入力してください。実際のRIRは未入力でも保存できます。");
      return;
    }
    setError(null);
    setPendingRir({ exerciseId, setId });
  }

  function completeSet(actualRir: number | null) {
    if (!pendingRir) return;
    const { exerciseId, setId } = pendingRir;
    const exercise = workout?.exercises.find((item) => item.workout_exercise_id === exerciseId);
    const set = exercise?.sets.find((item) => item.set_id === setId);
    if (!exercise || !set) return;
    const started = performance.now();
    const restStartedAt = new Date();
    const restEndAt = new Date(restStartedAt.getTime() + exercise.rest_sec * 1000);
    setRestRenderStarted(started);
    update((current) => ({
      ...current,
      rest_started_at: restStartedAt.toISOString(),
      rest_end_at: restEndAt.toISOString(),
      last_completed_set_id: setId,
      updated_at: restStartedAt.toISOString(),
      exercises: current.exercises.map((item) => item.workout_exercise_id !== exerciseId ? item : {
        ...item,
        sets: item.sets.map((row) => row.set_id === setId ? {
          ...row,
          actual_weight_kg: row.actual_weight_kg ?? row.target_weight_kg,
          actual_reps: row.actual_reps ?? row.target_reps_min,
          actual_rir: actualRir,
          completed: true,
          completed_at: restStartedAt.toISOString()
        } : row)
      })
    }));
    setPendingRir(null);
  }

  function addSet(exerciseId: string) {
    update((current) => ({
      ...current,
      updated_at: new Date().toISOString(),
      exercises: current.exercises.map((exercise) => exercise.workout_exercise_id === exerciseId
        ? { ...exercise, sets: appendExerciseSet(exercise) }
        : exercise)
    }));
  }

  function deleteSet(exerciseId: string, setId: string) {
    update((current) => ({
      ...current,
      rest_started_at: current.last_completed_set_id === setId ? null : current.rest_started_at,
      rest_end_at: current.last_completed_set_id === setId ? null : current.rest_end_at,
      last_completed_set_id: current.last_completed_set_id === setId ? null : current.last_completed_set_id,
      updated_at: new Date().toISOString(),
      exercises: current.exercises.map((exercise) => exercise.workout_exercise_id === exerciseId
        ? { ...exercise, sets: renumberSets(exercise.sets.filter((set) => set.set_id !== setId)) }
        : exercise)
    }));
  }

  function adjustRest(seconds: number) {
    update((current) => ({
      ...current,
      rest_end_at: new Date(new Date(current.rest_end_at ?? Date.now()).getTime() + seconds * 1000).toISOString(),
      updated_at: new Date().toISOString()
    }));
  }

  function resumeWorkout() {
    const started = performance.now();
    setFocusSetId(pendingSets[0]?.set.set_id ?? null);
    update((current) => ({
      ...current,
      rest_started_at: null,
      rest_end_at: null,
      last_completed_set_id: null,
      updated_at: new Date().toISOString()
    }));
    requestAnimationFrame(() => recordMetric("today:resume", performance.now() - started));
  }

  function startWorkout() {
    const startedAt = new Date().toISOString();
    setWorkout((current) => {
      if (!current) return current;
      const active = activatePlannedWorkout(current, startedAt);
      void replaceLiveWorkout(current.workout_id, active);
      return active;
    });
  }

  function finishWorkout() {
    const completedAt = new Date().toISOString();
    update((current) => ({
      ...current,
      status: "completed_local",
      submission: { entry_source: 'structured_web_ui', user_submit: true, submitted_at: completedAt },
      official_save_status: 'pending',
      completed_at: completedAt,
      rest_started_at: null,
      rest_end_at: null,
      last_completed_set_id: null,
      updated_at: completedAt
    }));
    setConfirmingEnd(false);
  }

  async function addWorkoutSession() {
    setWorkout(await createAdditionalWorkout());
  }

  async function addExercise() {
    const master = catalog.find(e => e.exercise_id === selectedExercise);
    const weight = Number(extraWeight), reps = Number(extraReps), rest = Number(extraRest);
    if (!master || extraWeight === '' || !Number.isFinite(weight) || weight < 0 || !Number.isInteger(reps) || reps < 1 || !Number.isFinite(rest) || rest < 0) {
      setError('種目・重量・回数・休憩を確認してください。'); return;
    }
    const bundle = await loadPrescriptionBundle();
    const source = bundle?.exercises.find(e => e.exercise_id === master.exercise_id);
    const exercise: LiveWorkoutExercise = {
      workout_exercise_id: `exercise-${crypto.randomUUID()}`, exercise_id: master.exercise_id,
      exercise_name: master.exercise_name, equipment: master.equipment,
      target_muscles: master.primary_bodypart, attachment: null, grip: null, technique_variant: null,
      weight_step_kg: source?.increment_kg ?? 1, rest_sec: rest,
      order: Math.max(0, ...(workout?.exercises.map(e => e.order) ?? [])) + 1, sets: []
    };
    const set = { ...newSetFrom(exercise), target_weight_kg: weight, target_reps_min: reps, target_reps_max: reps, target_rir: null };
    if (extraPaired) {
      const pair = crypto.randomUUID();
      exercise.sets = [{ ...set, side: 'R', pair_id: pair, pair_no: 1 }, { ...set, set_id: crypto.randomUUID(), side: 'L', pair_id: pair, pair_no: 1 }];
    } else exercise.sets = [set];
    update(w => ({ ...w, exercises: [...w.exercises, exercise], updated_at: new Date().toISOString() }));
    setFocusSetId(exercise.sets[0].set_id); setAddingExercise(false); setSelectedExercise(''); setExtraWeight(''); setExtraPaired(false); setError(null);
  }

  if (workout === undefined) return <div className="status-card"><strong>今日のメニューを準備中</strong><span>{error ?? "端末内データから読み込んでいます…"}</span></div>;
  if (workout === null) return <section className="empty-state"><span className="eyebrow">今日のトレーニング</span><h2>今日のメニューはまだありません</h2><p>メニューを承認・同期すると、ここに表示されます。</p></section>;

  if (workout.status === "planned") {
    return (
      <section className="planned-workout">
        <span className="eyebrow">実際の処方を端末に保存済み</span>
        <h2>今日のメニュー</h2>
        {prescriptionDate(workout) && <p className="prescription-source">元の処方日 {prescriptionDate(workout)}（最新の実データ）</p>}
        <section className="body-summary">
          <div className="body-summary-art"><img src="/images/exercise/placeholder.svg" alt="" /></div>
          <div><small>今日鍛える部位</small><strong>{workout.bodypart}</strong><span>{workout.exercises.length}種目・{logicalSetCount(allSets(workout))}セット</span></div>
        </section>
        <div className="planned-menu-list">
          {workout.exercises.map((exercise, index) => <article className="menu-exercise-card" key={exercise.workout_exercise_id}>
            <div className="menu-exercise-art"><img src={exerciseArt(exercise.exercise_name)} alt="" /></div>
            <div className="menu-exercise-info">
              <small>種目 {index + 1}</small><h3>{exercise.exercise_name}</h3>
              <p>{[displayCode(exercise.equipment, equipmentLabels), displayCode(exercise.attachment, attachmentLabels), displayCode(exercise.grip, gripLabels)].filter((value) => value !== "—").join("｜")}</p>
              {exercise.target_muscles && <p className="muscle-focus">効かせる筋肉：{exercise.target_muscles}</p>}
              {logicalSets(exercise.sets).slice(0, 3).map((set) => <div className="planned-set-line" key={set.set_id}><b>{set.set_no}</b><span>{set.target_weight_kg ?? "—"}kg × {targetReps(set)}回</span><em>RIR {set.target_rir ?? "—"}</em></div>)}
            </div>
          </article>)}
        </div>
        <button className="primary-action" onClick={startWorkout}>トレーニングを始める</button>
      </section>
    );
  }

  if (workout.status === "completed_local" || workout.status === "committed") {
    return (
      <section className="completed-summary">
        <div className="complete-check">✓</div>
        <strong>今日のトレーニング完了</strong>
        <p>{workout.bodypart}｜{completedLogicalSetCount(allSets(workout))}セット｜{durationMinutes(workout)}分</p>
        <span>{syncLabel(workout)}</span>
        <button onClick={onOpenHistory}>履歴を見る</button>
        {!isDemoMode && <button className="secondary-action" onClick={() => void addWorkoutSession()}>追加トレーニング</button>}
      </section>
    );
  }

  if (workout.rest_end_at) {
    const remainingSeconds = Math.max(0, Math.ceil((new Date(workout.rest_end_at).getTime() - now) / 1000));
    const restExercise = workout.exercises.find((exercise) => exercise.sets.some((set) => set.set_id === workout.last_completed_set_id));
    const progress = Math.min(100, Math.max(0, remainingSeconds / Math.max(1, restExercise?.rest_sec ?? remainingSeconds) * 100));
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = String(remainingSeconds % 60).padStart(2, "0");
    const next = pendingSets[0];
    return (
      <section className={`rest-view ${remainingSeconds === 0 ? "rest-finished" : ""}`} aria-label="休憩タイマー">
        {isDemoMode && <span className="demo-status">操作デモ・外部送信なし</span>}
        <span className="eyebrow" aria-live="polite">{remainingSeconds === 0 ? "休憩終了" : "休憩"}</span>
        <div className="rest-top">
        <RestTimerDial progress={progress} minutes={minutes} seconds={seconds} />
        <div className="rest-adjust">
          <button onClick={() => adjustRest(-15)}>−15秒</button>
          <button onClick={() => adjustRest(15)}>＋15秒</button>
        </div>
        </div>
        {isDemoMode && remainingSeconds > 0 && <button className="demo-expire" onClick={() => update(w => ({...w,rest_end_at:new Date(Date.now()-1000).toISOString(),updated_at:new Date().toISOString()}))}>休憩終了の光り方を見る</button>}
        <article className="next-set-card">
          {next ? <>
            <h2>{next.exercise.exercise_name}</h2>
            <p className="rest-set-position">{next.set.side ? `${sideLabel(next.set.side)}・` : ""}{logicalSets(next.exercise.sets).findIndex(s => (s.pair_id ?? s.set_id) === (next.set.pair_id ?? next.set.set_id)) + 1} / {logicalSetCount(next.exercise.sets)} セット目</p>
            <p className="rest-dose"><b>{next.set.actual_weight_kg ?? next.set.target_weight_kg ?? "—"}</b><small>kg</small><span>×</span><b>{targetReps(next.set)}</b><small>回</small></p>
            <p className="rest-secondary">目標RIR {next.set.target_rir ?? "—"}　·　全体の残り {pendingLogicalSetCount(allSets(workout))}セット</p>
          </> : <h2>全セット完了</h2>}
        </article>
        <button className="primary-action" onClick={resumeWorkout}>{next ? "次のセットへ" : "トレーニングへ戻る"}</button>
      </section>
    );
  }

  return (
    <section className="today-view">
      <div className="today-heading">
        <div><span className="eyebrow">端末内保存・シート未送信</span><h2>今日のトレーニング</h2></div>
        <span>{workout.date}</span>
      </div>
      {error && <p className="input-error" role="alert">{error}</p>}
      {[...workout.exercises].sort((a, b) => a.order - b.order).map((exercise) => (
        <article className="workout-exercise-card" key={exercise.workout_exercise_id}>
          <header><div className="workout-thumb"><img src={exerciseArt(exercise.exercise_name)} alt="" /></div><div className="workout-exercise-title"><span>種目 {String(exercise.order).padStart(2, "0")}</span><h3>{exercise.exercise_name}</h3><p>{[displayCode(exercise.equipment, equipmentLabels), displayCode(exercise.attachment, attachmentLabels), displayCode(exercise.grip, gripLabels)].filter((value) => value !== "—").join("｜")}</p></div><b>{logicalSetCount(exercise.sets)}セット</b></header>
          <dl className="prescription-grid">
            <div className="muscle-cell"><dt>効かせる筋肉</dt><dd>{exercise.target_muscles ?? "—"}</dd></div>
            <div><dt>器具</dt><dd>{displayCode(exercise.equipment, equipmentLabels)}</dd></div>
            <div><dt>アタッチメント</dt><dd>{displayCode(exercise.attachment, attachmentLabels)}</dd></div>
            <div><dt>グリップ</dt><dd>{displayCode(exercise.grip, gripLabels)}</dd></div>
            <div><dt>フォーム</dt><dd>{exercise.technique_variant ?? "—"}</dd></div>
            <div><dt>休憩</dt><dd>{exercise.rest_sec}秒</dd></div>
          </dl>
          <label className="exercise-note">種目メモ<textarea aria-label={`${exercise.exercise_name}のメモ`} placeholder="気付き・器具設定など" value={exercise.note ?? ''} onChange={event => update(w => ({ ...w, updated_at: new Date().toISOString(), exercises: w.exercises.map(e => e.workout_exercise_id === exercise.workout_exercise_id ? { ...e, note: event.target.value } : e) }))} /></label>
          {previous[exercise.exercise_id]?.length > 0 && <details className="previous-session"><summary>前回 {previous[exercise.exercise_id][0].session_date} の記録</summary><p>{previous[exercise.exercise_id].map(s => `${s.set_no}セット${s.side === '右' || s.side === '左' ? `・${s.side}` : ''}：${s.load_kg ?? '—'}kg × ${s.reps ?? '—'}回${s.RIR != null ? `・RIR ${s.RIR}` : ''}`).join(' ／ ')}</p></details>}
          <div className="live-set-list">
            {exercise.sets.map((set) => (
              <details open={set.completed ? undefined : true} className={`live-set ${set.completed ? "completed" : ""}`} key={set.set_id} data-set-id={set.set_id}>
                <summary className="completed-set-summary">✓ セット {set.set_no}{sideLabel(set.side)} <b>{set.actual_weight_kg ?? '—'}kg × {set.actual_reps ?? '—'}回</b><span>RIR {set.actual_rir ?? '未入力'}・修正</span></summary>
                <div className="live-set-title"><strong>セット {set.set_no}{set.side ? `・${sideLabel(set.side)}` : ""}</strong><span>{set.target_weight_kg ?? "—"}kg・{targetReps(set)}回・RIR {set.target_rir ?? "—"}</span></div>
                <div className="set-inputs">
                  <div className="stepper-field">
                    <span>実際の重量</span>
                    <div className="stepper-control">
                      <button aria-label={`セット${set.set_no}${sideLabel(set.side)}の実際の重量を減らす`} onClick={() => adjustSet(exercise.workout_exercise_id, set.set_id, "actual_weight_kg", -exercise.weight_step_kg)}>−</button>
                      <label><input aria-label={`セット${set.set_no}${sideLabel(set.side)}の実際の重量`} inputMode="decimal" type="number" step="any" value={set.actual_weight_kg ?? set.target_weight_kg ?? ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateSet(exercise.workout_exercise_id, set.set_id, "actual_weight_kg", event.target.value)} /><small>kg</small></label>
                      <button aria-label={`セット${set.set_no}${sideLabel(set.side)}の実際の重量を増やす`} onClick={() => adjustSet(exercise.workout_exercise_id, set.set_id, "actual_weight_kg", exercise.weight_step_kg)}>＋</button>
                    </div>
                    <button className="reuse-weight" disabled={previousWeight(exercise, set.set_id) === null} onClick={() => updateSet(exercise.workout_exercise_id, set.set_id, 'actual_weight_kg', String(previousWeight(exercise, set.set_id)))}>↻ 前セットの重量</button>
                  </div>
                  <div className="stepper-field">
                    <span>実際の回数</span>
                    <div className="stepper-control">
                      <button aria-label={`セット${set.set_no}${sideLabel(set.side)}の実際の回数を減らす`} onClick={() => adjustSet(exercise.workout_exercise_id, set.set_id, "actual_reps", -1)}>−</button>
                      <label><input aria-label={`セット${set.set_no}${sideLabel(set.side)}の実際の回数`} inputMode="numeric" type="number" step="1" value={set.actual_reps ?? set.target_reps_min ?? ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateSet(exercise.workout_exercise_id, set.set_id, "actual_reps", event.target.value)} /><small>回</small></label>
                      <button aria-label={`セット${set.set_no}${sideLabel(set.side)}の実際の回数を増やす`} onClick={() => adjustSet(exercise.workout_exercise_id, set.set_id, "actual_reps", 1)}>＋</button>
                    </div>
                  </div>
                  <div className="rir-status"><span>実際のRIR</span><strong>{set.completed ? set.actual_rir ?? "未入力" : "セット完了時に選択"}</strong>{set.completed && <select aria-label={`セット${set.set_no}${sideLabel(set.side)}のRIRを修正`} value={set.actual_rir ?? ''} onChange={event => updateSet(exercise.workout_exercise_id, set.set_id, 'actual_rir', event.target.value)}><option value="">未入力</option>{[0,1,2,3,4].map(r => <option key={r} value={r}>{r === 4 ? '4+' : r}</option>)}</select>}</div>
                </div>
                <div className="set-actions">
                  <button className="delete-set" onClick={() => deleteSet(exercise.workout_exercise_id, set.set_id)}>削除</button>
                  <button className="complete-set" disabled={set.completed} onClick={() => requestSetCompletion(exercise.workout_exercise_id, set.set_id)}>{set.completed ? "完了済み" : "セット完了"}</button>
                </div>
              </details>
            ))}
          </div>
          <button className="add-set" onClick={() => addSet(exercise.workout_exercise_id)}>＋ セット追加</button>
        </article>
      ))}
      <button className="add-exercise" onClick={() => setAddingExercise(!addingExercise)}>＋ 種目を追加</button>
      {addingExercise && <section className="extra-exercise-form" aria-label="追加種目">
        <label>種目<select aria-label="追加する種目" value={selectedExercise} onChange={e => setSelectedExercise(e.target.value)}><option value="">選択してください</option>{catalog.filter(e => !workout.exercises.some(w => w.exercise_id === e.exercise_id)).map(e => <option key={e.exercise_id} value={e.exercise_id}>{e.exercise_name}</option>)}</select></label>
        <label>重量（kg）<input aria-label="追加種目の重量" type="number" step="any" inputMode="decimal" value={extraWeight} onChange={e => setExtraWeight(e.target.value)} /></label>
        <label>目標回数<input aria-label="追加種目の目標回数" type="number" inputMode="numeric" value={extraReps} onChange={e => setExtraReps(e.target.value)} /></label>
        <label>休憩（秒）<input aria-label="追加種目の休憩" type="number" inputMode="numeric" value={extraRest} onChange={e => setExtraRest(e.target.value)} /></label>
        <label className="pair-choice"><input type="checkbox" checked={extraPaired} onChange={e => setExtraPaired(e.target.checked)} />右・左を別々に記録する</label>
        <p>1セット追加します。必要なセット数は追加後に増やせます。</p>
        <button onClick={() => void addExercise()}>この種目を追加</button><button onClick={() => setAddingExercise(false)}>閉じる</button>
      </section>}
      {pendingRir && (
        <div className="rir-sheet-backdrop" role="presentation">
          <section className="rir-sheet" role="dialog" aria-label="実際のRIRを選択">
            <i />
            <span className="eyebrow">セット完了</span>
            <h2>実際のRIR</h2>
            <p>あと何回できそうでしたか？</p>
            <div className="rir-options">
              {[0, 1, 2, 3, 4].map((value) => <button key={value} onClick={() => completeSet(value)}>{value === 4 ? "4+" : value}</button>)}
              <button onClick={() => completeSet(null)}>未入力</button>
            </div>
            <button className="rir-cancel" onClick={() => setPendingRir(null)}>戻る</button>
          </section>
        </div>
      )}
      {confirmingEnd ? (
        <section className="finish-confirm" role="dialog" aria-label="トレーニング終了の最終確認">
          <strong>このトレーニングを終了しますか？</strong>
          <p>終了後の修正は、履歴画面から行う予定です。</p>
          <p>{isDemoMode ? 'デモ専用の端末内データだけに保存します。外部送信は行いません。' : '送信すると、入力内容を正式記録として保存することに同意します。記録の確認が必要な場合は端末・クラウドに保持します。'}</p>
          <div><button onClick={() => setConfirmingEnd(false)}>戻る</button><button onClick={finishWorkout}>{isDemoMode ? 'デモを終了（送信なし）' : '送信して終了'}</button></div>
        </section>
      ) : <button className="end-workout" onClick={() => setConfirmingEnd(true)}>トレーニング終了</button>}
    </section>
  );
}

export function TodayStatusCard({ onOpenToday, onOpenHistory }: { onOpenToday: () => void; onOpenHistory: () => void }) {
  const [workout, setWorkout] = useState<LiveWorkout | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    loadOrCreateTodayWorkout().then((value) => { if (active) setWorkout(value); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const refresh = () => void loadOrCreateTodayWorkout().then(setWorkout);
    window.addEventListener(CLOUD_STATE_EVENT, refresh);
    return () => window.removeEventListener(CLOUD_STATE_EVENT, refresh);
  }, []);

  async function openWorkout() {
    if (workout?.status === "planned") {
      const startedAt = new Date().toISOString();
      const activeWorkout = activatePlannedWorkout(workout, startedAt);
      setWorkout(activeWorkout);
      await replaceLiveWorkout(workout.workout_id, activeWorkout);
    }
    onOpenToday();
  }

  async function addWorkoutSession() {
    const additional = await createAdditionalWorkout();
    setWorkout(additional);
    onOpenToday();
  }

  if (workout === undefined) return <article className="home-workout-card"><span>今日のメニューを確認中…</span></article>;
  if (workout === null) return <article className="home-workout-card"><span className="eyebrow">今日のメニュー</span><strong>今日のメニューはまだありません</strong><button onClick={onOpenToday}>確認する</button></article>;
  if (workout.status === "completed_local" || workout.status === "committed") {
    return (
      <article className="home-workout-card completed">
        <strong>✓ 今日のトレーニング完了</strong>
        <p>{workout.bodypart}｜{completedLogicalSetCount(allSets(workout))}セット｜{durationMinutes(workout)}分</p>
        <span>{syncLabel(workout)}</span>
        <button onClick={onOpenHistory}>履歴を見る</button>
        {!isDemoMode && <button className="secondary-action" onClick={() => void addWorkoutSession()}>追加トレーニング</button>}
      </article>
    );
  }
  return (
    <article className="home-workout-card">
      <span className="eyebrow">{workout.status === "active" ? "トレーニング中" : "今日のメニュー"}</span>
      <strong>{workout.bodypart}｜{logicalSetCount(allSets(workout))}セット</strong>
      <button onClick={() => void openWorkout()}>{workout.status === "active" ? "続きから" : "トレーニングを始める"}</button>
    </article>
  );
}
