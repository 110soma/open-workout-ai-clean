import type { DayHistory, Exercise, LiveWorkout, WorkoutSession, WorkoutSet } from "./types";
import { db, type WorkoutDatabase } from "./db";
import { measureAsync } from "./performance";

export function monthBounds(year: number, monthIndex: number): [string, string] {
  const start = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
  const endDate = new Date(year, monthIndex + 1, 0);
  const end = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
  return [start, end];
}

function completed(workout: LiveWorkout): boolean {
  return workout.status === "completed_local" || workout.status === "committed";
}

function liveSession(workout: LiveWorkout): WorkoutSession {
  const duration = workout.started_at && workout.completed_at
    ? Math.max(1, Math.round((Date.parse(workout.completed_at) - Date.parse(workout.started_at)) / 60_000))
    : null;
  const startTime = workout.started_at
    ? new Date(workout.started_at).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false })
    : null;
  return {
    session_id: workout.workout_id, date: workout.date, split: workout.bodypart, gym: null,
    start_time: startTime, duration_min: duration, session_rpe: null, condition: null,
    bodyweight_kg: null, source: "Workout_PWA_v2", note: null, created_at: workout.created_at,
    estimated_min_low: null, estimated_min_high: null, time_outcome: null
  };
}

function liveSets(workout: LiveWorkout): WorkoutSet[] {
  return workout.exercises.flatMap((exercise) => exercise.sets.filter((set) => set.completed).map((set) => ({
    set_id: set.set_id, session_id: workout.workout_id, session_date: workout.date,
    exercise_id: exercise.exercise_id, exercise_order: exercise.order, set_no: set.set_no,
    side: set.side === "R" ? "右" : set.side === "L" ? "左" : "両", set_type: "working",
    load_type: "external", load_kg: set.actual_weight_kg, reps: set.actual_reps, RPE: null,
    RIR: set.actual_rir, rest_sec: exercise.rest_sec, completed: true, note: exercise.note || null,
    volume_kg: set.actual_weight_kg !== null && set.actual_reps !== null ? set.actual_weight_kg * set.actual_reps : null,
    estimated_1RM: null, is_pr: null, created_at: set.completed_at,
    technique_variant_id: null, technique_variant_source: null, technique_variant_version: null,
    variant_status: null
  })));
}

export async function getMonthlySessions(
  year: number,
  monthIndex: number,
  database: WorkoutDatabase = db
): Promise<WorkoutSession[]> {
  return measureAsync("query:month:sessions", async () => {
    const [start, end] = monthBounds(year, monthIndex);
    const [official, local] = await Promise.all([
      database.sessions.where("date").between(start, end, true, true).sortBy("date"),
      database.liveWorkouts.where("date").between(start, end, true, true).filter(completed).toArray()
    ]);
    const merged = new Map(official.map((row) => [row.session_id, row]));
    for (const workout of local) if (!merged.has(workout.workout_id)) merged.set(workout.workout_id, liveSession(workout));
    return [...merged.values()].sort((a, b) => a.date.localeCompare(b.date));
  });
}

export async function getDayHistory(date: string, database: WorkoutDatabase = db): Promise<DayHistory> {
  const [officialSessions, localWorkouts] = await measureAsync("query:day:sessions", () => Promise.all([
    database.sessions.where("date").equals(date).sortBy("session_id"),
    database.liveWorkouts.where("date").equals(date).filter(completed).toArray()
  ]));
  const sessionMap = new Map(officialSessions.map((row) => [row.session_id, row]));
  for (const workout of localWorkouts) {
    const official = sessionMap.get(workout.workout_id);
    sessionMap.set(workout.workout_id, official ? { ...official, source: "Workout_PWA_v2" } : liveSession(workout));
  }
  const sessions = [...sessionMap.values()];
  if (sessions.length === 0) {
    return { sessions, setsBySession: new Map(), exercisesById: new Map() };
  }

  const officialSets = await measureAsync("query:day:sets", () => database.sets.where("session_date").equals(date).toArray());
  const setMap = new Map(officialSets.map((row) => [row.set_id, row]));
  for (const workout of localWorkouts) for (const set of liveSets(workout)) if (!setMap.has(set.set_id)) setMap.set(set.set_id, set);
  const sets = [...setMap.values()];
  sets.sort((a, b) =>
    (a.exercise_order ?? Number.MAX_SAFE_INTEGER) - (b.exercise_order ?? Number.MAX_SAFE_INTEGER) ||
    (a.set_no ?? Number.MAX_SAFE_INTEGER) - (b.set_no ?? Number.MAX_SAFE_INTEGER)
  );

  const exerciseIds = [...new Set(sets.map((set) => set.exercise_id))];
  const exercises = await measureAsync("query:day:exercises", async () => {
    const rows = await database.exercises.bulkGet(exerciseIds);
    return rows.filter((row): row is Exercise => Boolean(row));
  });
  const exercisesById = new Map(exercises.map((exercise) => [exercise.exercise_id, exercise]));
  for (const workout of localWorkouts) for (const exercise of workout.exercises) {
    if (!exercisesById.has(exercise.exercise_id)) exercisesById.set(exercise.exercise_id, {
      exercise_id: exercise.exercise_id, exercise_name: exercise.exercise_name, aliases: null,
      category: null, movement: null, equipment: exercise.equipment, unilateral: null,
      primary_bodypart: null, enabled: true
    });
  }

  const setsBySession = new Map<string, WorkoutSet[]>();
  for (const set of sets) {
    const rows = setsBySession.get(set.session_id) ?? [];
    rows.push(set);
    setsBySession.set(set.session_id, rows);
  }

  return {
    sessions,
    setsBySession,
    exercisesById
  };
}

export async function getDatabaseCounts(database: WorkoutDatabase = db) {
  const [sessions, sets, exercises] = await Promise.all([
    database.sessions.count(),
    database.sets.count(),
    database.exercises.count()
  ]);
  return { sessions, sets, exercises };
}

export interface RecentSessionSummary {
  session_id: string;
  date: string;
  bodypart: string;
  exerciseCount: number;
  setCount: number;
}

export async function getRecentSessionSummaries(
  limit = 3,
  database: WorkoutDatabase = db
): Promise<RecentSessionSummary[]> {
  const [official, local] = await Promise.all([
    database.sessions.orderBy("date").reverse().toArray(),
    database.liveWorkouts.orderBy("date").reverse().filter(completed).toArray()
  ]);
  const merged = new Map(official.map((row) => [row.session_id, row]));
  for (const workout of local) if (!merged.has(workout.workout_id)) merged.set(workout.workout_id, liveSession(workout));
  const sessions = [...merged.values()]
    .sort((a, b) => b.date.localeCompare(a.date) || b.session_id.localeCompare(a.session_id))
    .slice(0, limit);
  return Promise.all(sessions.map(async (session) => {
    const officialSets = await database.sets.where("session_id").equals(session.session_id).toArray();
    const localWorkout = await database.liveWorkouts.get(session.session_id);
    const sets = officialSets.length ? officialSets : localWorkout ? liveSets(localWorkout) : [];
    return {
      session_id: session.session_id,
      date: session.date,
      bodypart: session.split || "トレーニング",
      exerciseCount: new Set(sets.map((set) => set.exercise_id)).size,
      setCount: sets.length
    };
  }));
}

export interface ExerciseLibraryItem extends Exercise {
  lastUsedDate: string | null;
  recordedSetCount: number;
}

export async function getExerciseLibrary(database: WorkoutDatabase = db): Promise<ExerciseLibraryItem[]> {
  const [exercises, sets] = await Promise.all([database.exercises.toArray(), database.sets.toArray()]);
  const usage = new Map<string, { lastUsedDate: string; count: number }>();
  for (const set of sets) {
    const current = usage.get(set.exercise_id);
    usage.set(set.exercise_id, {
      lastUsedDate: !current || set.session_date > current.lastUsedDate ? set.session_date : current.lastUsedDate,
      count: (current?.count ?? 0) + 1
    });
  }
  return exercises.map((exercise) => ({
    ...exercise,
    lastUsedDate: usage.get(exercise.exercise_id)?.lastUsedDate ?? null,
    recordedSetCount: usage.get(exercise.exercise_id)?.count ?? 0
  })).sort((a, b) => (b.lastUsedDate ?? "").localeCompare(a.lastUsedDate ?? "") || a.exercise_name.localeCompare(b.exercise_name, "ja"));
}

export async function getExerciseHistory(exerciseId: string, database: WorkoutDatabase = db): Promise<WorkoutSet[]> {
  return database.sets.where("exercise_id").equals(exerciseId).reverse().sortBy("session_date");
}

export async function getPreviousExerciseSets(exerciseId: string, currentSessionId: string, date: string, database: WorkoutDatabase = db): Promise<WorkoutSet[]> {
  const [official, local] = await Promise.all([
    database.sets.where('exercise_id').equals(exerciseId).toArray(),
    database.liveWorkouts.where('date').belowOrEqual(date).filter(w => completed(w) && w.workout_id !== currentSessionId).toArray()
  ]);
  const byId = new Map(official.filter(s => s.session_id !== currentSessionId && s.session_date <= date).map(s => [s.set_id, s]));
  for (const w of local) for (const s of liveSets(w).filter(s => s.exercise_id === exerciseId)) if (!byId.has(s.set_id)) byId.set(s.set_id, s);
  const rows = [...byId.values()].sort((a,b) => b.session_date.localeCompare(a.session_date) || (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  const latest = rows[0]?.session_id;
  return rows.filter(s => s.session_id === latest).sort((a,b) => (a.set_no ?? 0) - (b.set_no ?? 0));
}
