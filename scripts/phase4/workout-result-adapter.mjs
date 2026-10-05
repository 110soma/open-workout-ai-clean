export const STAGING_HEADERS = [
  "batch_id", "received_at", "source", "source_date", "raw_exercise_name",
  "matched_exercise_id", "exercise_order", "set_no", "side", "set_type",
  "load_type", "load_kg", "reps", "RPE", "RIR", "note", "parser_confidence",
  "duplicate_key", "duplicate_status", "validation_status", "action",
  "committed_session_id", "committed_set_id", "committed_at", "RIR_relation",
  "time_outcome", "master_id_status", "commit_match_status", "technique_variant_id",
  "variant_match_status", "technique_variant_version", "variant_status",
  "entry_source", "user_submit", "source_session_id", "source_set_id",
  "record_mode", "import_status"
];

const COMMITTABLE_ENTRY_SOURCES = new Set(["structured_web_ui", "user_provided_text"]);

function present(value) {
  return value !== null && value !== undefined && value !== "";
}

function normalizeSide(side) {
  if (side === "L" || side === "左") return "左";
  if (side === "R" || side === "右") return "右";
  if (side === null || side === undefined || side === "" || side === "両") return "両";
  return null;
}

function duplicateKey(row) {
  return [row.source_date, row.matched_exercise_id, row.side, row.set_no, row.load_type, row.load_kg, row.reps].join("|");
}

function comparableKey(row) {
  return [row.source_date, row.matched_exercise_id, row.side, row.set_no].join("|");
}

function payloadSetMetadata(session, sourceSetId) {
  for (const exercise of session.workout_payload?.exercises ?? []) {
    const set = (exercise.sets ?? []).find((item) => item.set_id === sourceSetId);
    if (set) return { exercise, set };
  }
  return { exercise: null, set: null };
}

function historyDuplicateKey(set, sessionDates) {
  const date = sessionDates.get(set.session_id);
  if (!date) return null;
  return [date, set.exercise_id, set.side, set.set_no, set.load_type, set.load_kg, set.reps].join("|");
}

function evaluateDuplicate(row, context) {
  if (context.historySets.some((item) => item.set_id === row.source_set_id)) return "duplicate";
  if (context.stagingRows.some((item) => item.source_set_id === row.source_set_id)) return "duplicate";

  // A separate, explicitly created Session may legitimately repeat the same
  // exercise/set values on the same date. Composite-key checks therefore apply
  // within the same source Session. Rows without a stable source Session keep
  // the legacy composite-key behavior.
  const sameSourceSession = (itemSessionId) =>
    context.strictDuplicateKey || !row.source_session_id || !itemSessionId || itemSessionId === row.source_session_id;
  const exactKeys = new Set([
    ...context.historySets
      .filter((item) => sameSourceSession(item.session_id))
      .map((item) => historyDuplicateKey(item, context.sessionDates))
      .filter(Boolean),
    ...context.stagingRows
      .filter((item) => sameSourceSession(item.source_session_id))
      .map((item) => item.duplicate_key)
      .filter(Boolean)
  ]);
  if (exactKeys.has(row.duplicate_key)) return "duplicate";

  const comparable = comparableKey(row);
  const similarHistory = context.historySets.some((item) => {
    if (!sameSourceSession(item.session_id)) return false;
    const date = context.sessionDates.get(item.session_id);
    return [date, item.exercise_id, item.side, item.set_no].join("|") === comparable;
  });
  const similarStaging = context.stagingRows.some((item) =>
    sameSourceSession(item.source_session_id) && comparableKey({
      source_date: item.source_date,
      matched_exercise_id: item.matched_exercise_id,
      side: item.side,
      set_no: item.set_no
    }) === comparable
  );
  return similarHistory || similarStaging ? "possible_duplicate" : "unique";
}

function validate(row, context) {
  const issues = [];
  if (!context.exerciseIds.has(row.matched_exercise_id)) issues.push("exercise_id_not_found");
  if (!present(row.source_session_id)) issues.push("session_id_missing");
  if (!present(row.source_set_id)) issues.push("set_id_missing");
  if (!Number.isInteger(row.set_no) || row.set_no < 1) issues.push("set_no_invalid");
  if (!["両", "右", "左"].includes(row.side)) issues.push("side_invalid");
  if (!present(row.load_type)) issues.push("load_type_missing");
  if (!Number.isFinite(row.load_kg)) issues.push("load_kg_invalid");
  if (!Number.isInteger(row.reps) || row.reps < 0) issues.push("reps_invalid");
  if (present(row.RIR) && (!Number.isFinite(row.RIR) || row.RIR < 0 || row.RIR > 4)) issues.push("RIR_invalid");
  if (present(row.technique_variant_id) && !context.variantKeys.has(`${row.matched_exercise_id}|${row.technique_variant_id}|${row.technique_variant_version ?? ""}`)) {
    issues.push("technique_variant_invalid");
  }
  if (row.user_submit !== true) issues.push("user_submit_missing");
  if (!COMMITTABLE_ENTRY_SOURCES.has(row.entry_source)) issues.push("entry_source_invalid");
  return issues;
}

export function adaptWorkoutResult(input, options = {}) {
  const session = input.session;
  const sets = input.sets.filter((item) => item.session_id === session.session_id && item.completed === true);
  const context = {
    exerciseIds: options.exerciseIds ?? new Set(),
    exerciseNames: options.exerciseNames ?? new Map(),
    historySets: options.historySets ?? [],
    sessionDates: options.sessionDates ?? new Map(),
    stagingRows: options.stagingRows ?? [],
    variantKeys: options.variantKeys ?? new Set(),
    strictDuplicateKey: options.strictDuplicateKey === true
  };
  const recordMode = session.record_mode ?? "unclassified";
  const entrySource = session.entry_source ?? "structured_web_ui";
  const userSubmit = session.user_submit ?? session.status === "committed";
  const receivedAt = options.receivedAt ?? new Date().toISOString();

  const rows = sets.map((sourceSet) => {
    const metadata = payloadSetMetadata(session, sourceSet.set_id);
    const side = normalizeSide(sourceSet.side);
    const row = {
      batch_id: session.batch_id ?? `SUPABASE_${session.session_id}`,
      received_at: receivedAt,
      source: session.source ?? `supabase:${session.session_id}`,
      source_date: session.session_date,
      raw_exercise_name: sourceSet.exercise_name ?? context.exerciseNames.get(sourceSet.exercise_id) ?? metadata.exercise?.exercise_name ?? "",
      matched_exercise_id: sourceSet.exercise_id,
      exercise_order: Number.isInteger(sourceSet.exercise_order) ? sourceSet.exercise_order : (Number.isInteger(metadata.exercise?.order) ? metadata.exercise.order : null),
      set_no: sourceSet.set_no,
      side,
      set_type: sourceSet.set_type ?? metadata.set?.set_type ?? null,
      load_type: sourceSet.load_type ?? (Number.isFinite(sourceSet.actual_weight_kg) ? "external" : null),
      load_kg: sourceSet.actual_weight_kg,
      reps: sourceSet.actual_reps,
      RPE: null,
      RIR: sourceSet.actual_rir,
      note: sourceSet.note ?? metadata.exercise?.note ?? null,
      parser_confidence: null,
      duplicate_key: "",
      duplicate_status: "unique",
      validation_status: "review",
      action: "REVIEW",
      committed_session_id: null,
      committed_set_id: null,
      committed_at: null,
      RIR_relation: null,
      time_outcome: null,
      master_id_status: "valid",
      commit_match_status: "not_committed",
      technique_variant_id: sourceSet.technique_variant_id ?? null,
      variant_match_status: sourceSet.technique_variant_id ? "unverified" : "unknown",
      technique_variant_version: sourceSet.technique_variant_version ?? null,
      variant_status: sourceSet.variant_status ?? "unknown",
      entry_source: entrySource,
      user_submit: userSubmit,
      source_session_id: session.session_id,
      source_set_id: sourceSet.set_id,
      record_mode: recordMode,
      import_status: "review"
    };
    row.duplicate_key = duplicateKey(row);
    row.duplicate_status = evaluateDuplicate(row, context);
    const issues = validate(row, context);
    row.master_id_status = issues.includes("exercise_id_not_found") ? "invalid" : "valid";
    row.validation_status = issues.length === 0 ? "ready" : "review";
    const commitEligible =
      COMMITTABLE_ENTRY_SOURCES.has(row.entry_source) &&
      row.user_submit === true &&
      row.validation_status === "ready" &&
      row.duplicate_status === "unique" &&
      row.record_mode === "production" &&
      row.master_id_status === "valid";
    if (row.record_mode === "test") {
      row.action = "REJECT";
      row.import_status = "staged_test_blocked";
    } else if (row.duplicate_status !== "unique") {
      row.action = "REJECT";
      row.import_status = "duplicate_blocked";
    } else if (commitEligible) {
      row.action = "HOLD";
      row.import_status = "commit_candidate_dry_run";
    } else {
      row.action = "HOLD";
      row.import_status = "validation_review";
    }
    return { row, issues, commitEligible };
  });

  return {
    session: {
      session_id: session.session_id,
      date: session.session_date,
      start_time: session.started_at ?? null,
      end_time: session.completed_at ?? null,
      duration_min: session.started_at && session.completed_at
        ? Math.round((Date.parse(session.completed_at) - Date.parse(session.started_at)) / 60000)
        : null,
      bodypart: session.bodypart ?? null,
      prescription_id: session.prescription_id ?? null,
      source: session.session_source ?? (entrySource === "structured_web_ui" ? "supabase_pwa_v2" : "user_provided_text"),
      note: null,
      record_mode: recordMode
    },
    rows,
    summary: {
      source_set_count: sets.length,
      ready_count: rows.filter((item) => item.row.validation_status === "ready").length,
      unique_count: rows.filter((item) => item.row.duplicate_status === "unique").length,
      duplicate_count: rows.filter((item) => item.row.duplicate_status !== "unique").length,
      commit_candidate_count: rows.filter((item) => item.commitEligible).length,
      blocked_test_count: rows.filter((item) => item.row.record_mode === "test").length,
      sheets_commit_count: 0
    }
  };
}

export function stagingRowsToValues(rows) {
  return rows.map(({ row }) => STAGING_HEADERS.map((header) => row[header] ?? null));
}
