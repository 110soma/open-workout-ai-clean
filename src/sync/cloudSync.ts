import type { Session } from "@supabase/supabase-js";
import { assertAccountOwner, db } from "../db";
import { dateKey } from "../date";
import { flushWorkoutSaves, isPrescriptionForDate, reconcilePrescriptionWorkout } from "../liveWorkout";
import type { LiveWorkout, PrescriptionBundle } from "../types";
import { isSupabaseConfigured, supabase } from "./supabaseClient";
import { syncPendingWorkouts, type WorkoutPushGateway } from "./syncEngine";
import { applyCloudWorkoutRestore, type CloudWorkoutSessionRow, type CloudWorkoutSetRow } from "./cloudRestore";
import { requestOfficialSave } from './officialSave';

export const CLOUD_STATE_EVENT = "workout-cloud-state";

export interface CloudState {
  configured: boolean;
  session: Session | null;
  syncing: boolean;
  lastError: string | null;
  prescriptionRevision: string | null;
  accountChanging: boolean;
}

let state: CloudState = {
  configured: isSupabaseConfigured,
  session: null,
  syncing: false,
  lastError: null,
  prescriptionRevision: null,
  accountChanging: false
};
let syncPromise: Promise<void> | null = null;
const configuredRecordMode = import.meta.env.VITE_WORKOUT_RECORD_MODE;

function publish(patch: Partial<CloudState> = {}): void {
  state = { ...state, ...patch };
  window.dispatchEvent(new CustomEvent(CLOUD_STATE_EVENT, { detail: state }));
}

export function getCloudState(): CloudState {
  return state;
}

class SupabaseWorkoutGateway implements WorkoutPushGateway {
  constructor(private readonly userId: string) {}

  async pushWorkout(workout: LiveWorkout): Promise<{ server_updated_at: string }> {
    if (!supabase) throw new Error("Supabase is not configured");
    assertAccountOwner(db, this.userId);
    const { data: auth } = await supabase.auth.getSession();
    if (state.accountChanging || auth.session?.user.id !== this.userId) throw new Error('account_changed_before_upload');
    const now = workout.local_updated_at ?? workout.updated_at;
    const sessionRow = {
      session_id: workout.workout_id,
      user_id: this.userId,
      prescription_id: workout.source_prescription_session_id ?? null,
      session_date: workout.date,
      status: "committed",
      bodypart: workout.bodypart,
      title: workout.title,
      workout_payload: workout,
      started_at: workout.started_at,
      completed_at: workout.completed_at,
      sync_status: "synced",
      local_updated_at: now
    };
    if (configuredRecordMode === "test" || configuredRecordMode === "production") {
      Object.assign(sessionRow, { record_mode: configuredRecordMode });
    }
    const { data: session, error: sessionError } = await supabase
      .from("workout_sessions")
      .upsert(sessionRow, { onConflict: "session_id" })
      .select("server_updated_at")
      .single();
    if (sessionError) throw sessionError;

    const setRows = workout.exercises.flatMap((exercise) => exercise.sets.map((set) => ({
      set_id: set.set_id,
      user_id: this.userId,
      session_id: workout.workout_id,
      exercise_id: exercise.exercise_id,
      set_no: set.set_no,
      pair_id: set.pair_id,
      pair_no: set.pair_no,
      side: set.side,
      target_weight_kg: set.target_weight_kg,
      target_reps_min: set.target_reps_min,
      target_reps_max: set.target_reps_max,
      target_rir: set.target_rir,
      actual_weight_kg: set.actual_weight_kg,
      actual_reps: set.actual_reps,
      actual_rir: set.actual_rir,
      completed: set.completed,
      completed_at: set.completed_at,
      local_updated_at: now
    })));
    if (setRows.length > 0) {
      const { data: auth } = await supabase.auth.getSession();
      if (state.accountChanging || auth.session?.user.id !== this.userId) throw new Error('account_changed_before_upload');
      const { error: setsError } = await supabase.from("workout_sets").upsert(setRows, { onConflict: "set_id" });
      if (setsError) throw setsError;
    }
    return { server_updated_at: session.server_updated_at as string };
  }
}

export async function refreshPrescriptionFromCloud(session: Session): Promise<boolean> {
  if (!supabase) return false;
  assertAccountOwner(db, session.user.id);
  const { data, error } = await supabase
    .from("prescriptions")
    .select("prescription_id,prescription_date,source_revision,payload,server_updated_at")
    .eq("user_id", session.user.id)
    .order("prescription_date", { ascending: false })
    .order("server_updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return false;
  const bundle = data.payload as PrescriptionBundle;
  if (bundle.targetSessionId !== data.prescription_id || bundle.latestPrescriptionDate !== data.prescription_date) {
    throw new Error("Supabase PrescriptionのIDまたは日付がpayloadと一致しません。");
  }
  const identity = `${data.prescription_id}:${data.source_revision}:${data.server_updated_at}`;
  const cloudIdentity = await db.meta.get("cloudPrescriptionIdentity");

  const updatedAt = new Date().toISOString();
  await db.transaction("rw", db.prescriptions, db.meta, async () => {
    await db.prescriptions.put({
      prescription_id: data.prescription_id,
      date: data.prescription_date,
      revision: data.source_revision,
      updated_at: updatedAt,
      bundle
    });
    await db.meta.put({ key: "prescriptionId", value: data.prescription_id });
    await db.meta.put({ key: "prescriptionRevision", value: data.source_revision });
    await db.meta.put({ key: "cloudPrescriptionRevision", value: data.source_revision });
    await db.meta.put({ key: "cloudPrescriptionIdentity", value: identity });
    await db.meta.put({ key: "prescriptionImportedAt", value: updatedAt });
  });

  // The example/import payload is also the initial exercise catalogue.
  await db.exercises.bulkPut(bundle.exercises.map(exercise => ({
    exercise_id: exercise.exercise_id, exercise_name: exercise.exercise_name,
    equipment: exercise.equipment ?? null, primary_bodypart: exercise.primary_bodypart ?? null,
    unilateral: exercise.unilateral ?? false, aliases: null, category: null, movement: null, enabled: true
  })));

  const today = dateKey(new Date());
  if (isPrescriptionForDate(bundle, today)) await reconcilePrescriptionWorkout(bundle, today);
  publish();
  return cloudIdentity?.value !== identity;
}

export async function restoreCompletedWorkoutsFromCloud(session: Session): Promise<{ restored: number; conflicts: number }> {
  if (!supabase) return { restored: 0, conflicts: 0 };
  assertAccountOwner(db, session.user.id);
  const sessionResult = await supabase
    .from("workout_sessions")
    .select("session_id,session_date,status,record_mode,workout_payload,local_updated_at,server_updated_at")
    .eq("user_id", session.user.id)
    .eq("status", "committed")
    .eq("record_mode", "production")
    .order("session_date", { ascending: false })
    .limit(500);
  if (sessionResult.error) throw sessionResult.error;
  const cloudSessions = (sessionResult.data ?? []) as CloudWorkoutSessionRow[];
  if (!cloudSessions.length) return { restored: 0, conflicts: 0 };

  const cloudSets: CloudWorkoutSetRow[] = [];
  const sessionIds = cloudSessions.map((row) => row.session_id);
  for (let index = 0; index < sessionIds.length; index += 75) {
    const setResult = await supabase
      .from("workout_sets")
      .select("set_id,session_id,actual_weight_kg,actual_reps,actual_rir,completed,completed_at")
      .eq("user_id", session.user.id)
      .in("session_id", sessionIds.slice(index, index + 75));
    if (setResult.error) throw setResult.error;
    cloudSets.push(...((setResult.data ?? []) as CloudWorkoutSetRow[]));
  }
  return applyCloudWorkoutRestore(cloudSessions, cloudSets, db);
}

export function requestBackgroundSync(): void {
  if (!isSupabaseConfigured || !supabase || syncPromise || state.accountChanging || !db.accountId || !navigator.onLine) return;
  syncPromise = (async () => {
    publish({ syncing: true, lastError: null });
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const session = data.session;
      publish({ session });
      if (!session) return;
      assertAccountOwner(db, session.user.id);
      const issues: string[] = [];
      let restore = { restored: 0, conflicts: 0 };
      try { restore = await restoreCompletedWorkoutsFromCloud(session); }
      catch { issues.push("クラウド履歴を復元できませんでした。"); }
      try { await refreshPrescriptionFromCloud(session); }
      catch { issues.push("最新メニューを取得できませんでした。"); }
      const cloudPrescription = await db.meta.get("cloudPrescriptionRevision");
      await syncPendingWorkouts(new SupabaseWorkoutGateway(session.user.id), db, true);
      const submitted = await db.liveWorkouts.where('status').equals('committed').filter(row => Boolean(row.submission?.user_submit) && row.official_save_status !== 'saved').toArray();
      for (const row of submitted) await requestOfficialSave(row.workout_id);
      if (restore.conflicts) issues.push("クラウド履歴と端末履歴の差を確認してください。");
      publish({ session, lastError: issues.length ? issues.join(" ") : null, prescriptionRevision: cloudPrescription?.value ?? null });
    } catch (reason) {
      publish({ lastError: reason instanceof Error ? reason.message : String(reason) });
    } finally {
      publish({ syncing: false });
      syncPromise = null;
    }
  })();
}

export function startCloudSync(): () => void {
  if (!supabase) return () => undefined;
  const onOnline = () => requestBackgroundSync();
  const onVisible = () => { if (document.visibilityState === "visible") requestBackgroundSync(); };
  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisible);
  const handleSession = (session: Session | null) => {
    if ((session?.user.id ?? null) !== db.accountId) {
      publish({ session, accountChanging: true, prescriptionRevision: null });
      // A full remount prevents stale component state and in-flight callbacks
      // from being reused under another account. Existing local DBs are retained.
      queueMicrotask(() => { void flushWorkoutSaves().then(() => window.location.reload()); });
      return;
    }
    publish({ session });
    if (session) queueMicrotask(requestBackgroundSync);
  };
  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => handleSession(session));
  void supabase.auth.getSession().then(({ data }) => {
    handleSession(data.session);
  });
  return () => {
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisible);
    listener.subscription.unsubscribe();
  };
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error("Supabaseが設定されていません。");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  requestBackgroundSync();
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  publish({ accountChanging: true });
  await flushWorkoutSaves();
  const { error } = await supabase.auth.signOut();
  if (error) { publish({ accountChanging: false }); throw error; }
  publish({ session: null });
}
