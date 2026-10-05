export interface WorkoutSession {
  session_id: string;
  date: string;
  split: string | null;
  gym: string | null;
  start_time: string | null;
  duration_min: number | null;
  session_rpe: number | null;
  condition: string | null;
  bodyweight_kg: number | null;
  source: string | null;
  note: string | null;
  created_at: string | null;
  estimated_min_low: number | null;
  estimated_min_high: number | null;
  time_outcome: string | null;
}

export interface WorkoutSet {
  set_id: string;
  session_id: string;
  /** Local-only derived field copied from the linked Session for indexed day reads. */
  session_date: string;
  exercise_id: string;
  exercise_order: number | null;
  set_no: number | null;
  side: string | null;
  set_type: string | null;
  load_type: string | null;
  load_kg: number | null;
  reps: number | null;
  RPE: number | null;
  RIR: number | string | null;
  rest_sec: number | null;
  completed: boolean | null;
  note: string | null;
  volume_kg: number | null;
  estimated_1RM: number | null;
  is_pr: boolean | null;
  created_at: string | null;
  technique_variant_id: string | null;
  technique_variant_source: string | null;
  technique_variant_version: string | null;
  variant_status: string | null;
}

export interface Exercise {
  exercise_id: string;
  exercise_name: string;
  aliases: string | null;
  category: string | null;
  movement: string | null;
  equipment: string | null;
  unilateral: boolean | null;
  primary_bodypart: string | null;
  enabled: boolean | null;
}

export interface ImportBundle {
  schemaVersion: 1;
  dataRevision: string;
  source: {
    spreadsheetTitle: string;
    spreadsheetId: string;
    exportedAt: string;
    tabs: string[];
  };
  sessions: WorkoutSession[];
  sets: WorkoutSet[];
  exercises: Exercise[];
  validation: {
    sessionCount: number;
    setCount: number;
    exerciseCount: number;
    orphanSetCount: number;
    unknownExerciseCount: number;
  };
}

export interface DayHistory {
  sessions: WorkoutSession[];
  setsBySession: Map<string, WorkoutSet[]>;
  exercisesById: Map<string, Exercise>;
}

export interface LiveWorkoutSet {
  set_type?: 'working' | 'warmup';
  set_id: string;
  set_no: number;
  pair_id: string | null;
  pair_no: number | null;
  side: "L" | "R" | null;
  target_weight_kg: number | null;
  target_reps_min: number | null;
  target_reps_max: number | null;
  target_rir: number | null;
  actual_weight_kg: number | null;
  actual_reps: number | null;
  actual_rir: number | null;
  completed: boolean;
  completed_at: string | null;
}

export interface LiveWorkoutExercise {
  note?: string;
  workout_exercise_id: string;
  exercise_id: string;
  exercise_name: string;
  target_muscles: string | null;
  equipment: string | null;
  attachment: string | null;
  grip: string | null;
  technique_variant: string | null;
  weight_step_kg: number;
  rest_sec: number;
  order: number;
  sets: LiveWorkoutSet[];
}

export interface PrescriptionRow {
  prescription_id: string;
  target_session_id: string;
  exercise_id: string;
  exercise_order: number;
  target_sets: number;
  target_load_kg: number | null;
  target_rep_min: number | null;
  target_rep_max: number | null;
  target_RPE: number | null;
  target_RIR: number | null;
  target_rest_sec: number | null;
  progression_action: string | null;
  rationale: string | null;
  created_at: string;
  status: string;
  rule_version: string | null;
  tempo: string | null;
  technique_variant_id: string | null;
  technique_variant_version: string | null;
  variant_status: string | null;
  equipment: string | null;
  attachment: string | null;
  grip: string | null;
}

export interface PrescriptionExerciseRow {
  exercise_id: string;
  exercise_name: string;
  equipment: string | null;
  increment_kg: number | null;
  unilateral: boolean;
  note: string | null;
  primary_bodypart: string | null;
}

export interface PrescriptionGuideRow {
  exercise_id: string;
  technique_variant_id: string | null;
  variant_name: string | null;
  target_muscles: string | null;
  is_default: boolean;
  profile_status: string | null;
}

export interface PrescriptionSlotRoleRow {
  exercise_id: string;
  bodypart: string | null;
  equipment: string | null;
  attachment: string | null;
  grip: string | null;
  technique_variant_id: string | null;
  technique_variant_version: string | null;
  approval_status: string | null;
  active: boolean;
}

export interface PrescriptionBundle {
  schemaVersion: 1;
  dataRevision: string;
  source: {
    spreadsheetTitle: string;
    spreadsheetId: string;
    exportedAt: string;
    mode: "read_only_snapshot";
    tabs: string[];
  };
  latestPrescriptionDate: string;
  targetSessionId: string;
  prescriptions: PrescriptionRow[];
  exercises: PrescriptionExerciseRow[];
  guides: PrescriptionGuideRow[];
  slotRoles: PrescriptionSlotRoleRow[];
}

export interface PrescriptionCacheRecord {
  prescription_id: string;
  date: string;
  revision: string;
  updated_at: string;
  bundle: PrescriptionBundle;
}

export interface LiveWorkout {
  submission?: { entry_source: 'structured_web_ui'; user_submit: true; submitted_at: string };
  official_save_status?: 'pending' | 'review_required' | 'saved';
  workout_id: string;
  date: string;
  title: string;
  bodypart: string;
  source: "local_demo" | "prescription_snapshot";
  source_prescription_date?: string;
  source_prescription_session_id?: string;
  source_revision?: string;
  sync_status?: "local_only" | "pending" | "syncing" | "synced" | "conflict" | "error";
  dirty?: boolean;
  local_updated_at?: string;
  server_updated_at?: string | null;
  status: "planned" | "active" | "completed_local" | "committed";
  exercises: LiveWorkoutExercise[];
  rest_started_at: string | null;
  rest_end_at: string | null;
  last_completed_set_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}
