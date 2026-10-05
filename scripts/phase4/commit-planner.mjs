import { createHash } from "node:crypto";

export const SESSION_HEADERS = [
  "session_id", "date", "split", "gym", "start_time", "duration_min", "session_rpe",
  "condition", "bodyweight_kg", "source", "note", "created_at", "estimated_min_low",
  "estimated_min_high", "time_outcome"
];

export const SET_HEADERS = [
  "set_id", "session_id", "exercise_id", "exercise_order", "set_no", "side", "set_type",
  "load_type", "load_kg", "reps", "RPE", "RIR", "rest_sec", "completed", "note",
  "volume_kg", "estimated_1RM", "is_pr", "created_at", "technique_variant_id",
  "technique_variant_source", "technique_variant_version", "variant_status"
];

function tokyoParts(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function tokyoTime(value) {
  const parts = tokyoParts(value);
  return parts ? `${parts.hour}:${parts.minute}:${parts.second}` : null;
}

function tokyoDateTime(value) {
  const parts = tokyoParts(value);
  return parts ? `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}:${parts.second}` : null;
}

function eligible(row) {
  return ["structured_web_ui", "user_provided_text"].includes(row.entry_source) &&
    row.user_submit === true &&
    row.record_mode === "production" &&
    row.validation_status === "ready" &&
    row.duplicate_status === "unique" &&
    row.master_id_status === "valid" &&
    Boolean(row.source_session_id) &&
    Boolean(row.source_set_id);
}

function hashPlan(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

export function buildCommitPlan(adapterResult, options = {}) {
  const sourceSession = options.sourceSession ?? {};
  const sourceSets = new Map((options.sourceSets ?? []).map((row) => [row.set_id, row]));
  const historySessionIds = new Set((options.historySessions ?? []).map((row) => row.session_id));
  const historySetIds = new Set((options.historySets ?? []).map((row) => row.set_id));
  const rows = adapterResult.rows ?? [];
  const reasons = [];

  if (rows.length === 0) reasons.push("no_completed_sets");
  if (adapterResult.session?.record_mode !== "production") reasons.push("record_mode_not_production");
  if (historySessionIds.has(adapterResult.session?.session_id)) reasons.push("session_id_already_committed");
  for (const item of rows) {
    if (!eligible(item.row)) reasons.push(`row_not_eligible:${item.row.source_set_id ?? "unknown"}`);
    if (historySetIds.has(item.row.source_set_id)) reasons.push(`set_id_already_committed:${item.row.source_set_id}`);
  }

  const session = adapterResult.session ?? {};
  const sessionRow = {
    session_id: session.session_id ?? null,
    date: session.date ?? null,
    split: session.bodypart ?? null,
    gym: null,
    start_time: tokyoTime(session.start_time),
    duration_min: session.duration_min ?? null,
    session_rpe: null,
    condition: null,
    bodyweight_kg: null,
    source: session.source ?? "Workout_PWA_v2",
    note: session.note ?? null,
    created_at: tokyoDateTime(sourceSession.created_at ?? session.end_time),
    estimated_min_low: null,
    estimated_min_high: null,
    time_outcome: null
  };

  const setRows = rows.map(({ row }) => {
    const sourceSet = sourceSets.get(row.source_set_id) ?? {};
    return {
      set_id: row.source_set_id,
      session_id: row.source_session_id,
      exercise_id: row.matched_exercise_id,
      exercise_order: row.exercise_order,
      set_no: row.set_no,
      side: row.side,
      set_type: row.set_type,
      load_type: row.load_type,
      load_kg: row.load_kg,
      reps: row.reps,
      RPE: null,
      RIR: row.RIR,
      rest_sec: null,
      completed: true,
      note: row.note,
      volume_kg: Number.isFinite(row.load_kg) && Number.isFinite(row.reps) ? row.load_kg * row.reps : null,
      estimated_1RM: null,
      is_pr: null,
      created_at: tokyoDateTime(sourceSet.completed_at),
      technique_variant_id: row.technique_variant_id,
      technique_variant_source: null,
      technique_variant_version: row.technique_variant_version,
      variant_status: row.variant_status
    };
  });

  const payload = {
    status: reasons.length === 0 ? "commit_candidate" : "blocked",
    reasons: [...new Set(reasons)],
    source_session_id: session.session_id ?? null,
    session: sessionRow,
    sets: setRows,
    sheets: { sessions: "01_Sessions", sets: "02_Sets" }
  };
  return { ...payload, confirmation_token: hashPlan(payload) };
}

export function rowsToValues(plan) {
  return {
    session: SESSION_HEADERS.map((header) => plan.session[header] ?? null),
    sets: plan.sets.map((row) => SET_HEADERS.map((header) => row[header] ?? null))
  };
}

export async function commitWithGateway(plan, confirmationToken, gateway) {
  if (plan.status !== "commit_candidate") throw new Error(`COMMIT不可: ${plan.reasons.join(",")}`);
  if (!confirmationToken || confirmationToken !== plan.confirmation_token) throw new Error("確認トークンが一致しません。");
  const duplicate = await gateway.checkDuplicate(plan.source_session_id, plan.sets.map((row) => row.set_id));
  if (duplicate) throw new Error("COMMIT直前の重複確認でBLOCKされました。");
  await gateway.commit(plan);
  return { status: "committed", session_count: 1, set_count: plan.sets.length };
}
