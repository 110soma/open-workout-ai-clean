import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

export function verifyApproval(plan, sessionId, token) {
  const { confirmation_token, values, ...payload } = plan;
  const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
  if (!token || token !== confirmation_token || hash !== confirmation_token) throw new Error('確認トークンが不正、またはpayloadが変更されています。');
  if (plan.status !== 'commit_candidate') throw new Error('COMMIT候補ではありません。');
  if (plan.source_session_id !== sessionId || plan.session.session_id !== sessionId) throw new Error('Sessionが一致しません。');
  if (!plan.sets.length || new Set(plan.sets.map(s => s.set_id)).size !== plan.sets.length || plan.sets.some(s => s.session_id !== sessionId)) throw new Error('SetのIDまたは紐付けが不正です。');
  return plan;
}

export const blanks = value => value === '' || value === undefined ? null : value;
export function recordsMatch(actual, expected) {
  return actual.length === expected.length && expected.every(row => {
    const matches = actual.filter(a => (row.set_id ? a.set_id === row.set_id : a.session_id === row.session_id));
    return matches.length === 1 && Object.keys(row).every(key => isDeepStrictEqual(blanks(matches[0][key]), blanks(row[key])));
  });
}

// A gateway must use a fresh Sheets read and an atomic batch for 01/02.
// No success is reported until all read-back and audit checks pass.
export async function finalizeApprovedCommit({ plan, sessionId, token, gateway }) {
  verifyApproval(plan, sessionId, token);
  const current = await gateway.inspect(sessionId, plan.sets.map(s => s.set_id));
  if (current.record_mode !== 'production') throw new Error('test／未分類はCOMMIT禁止です。');
  if (!current.staging?.length || current.staging.length !== plan.sets.length) throw new Error('Staging件数が一致しません。');
  for (const row of current.staging) {
    if (row.source_session_id !== sessionId || !plan.sets.some(s => s.set_id === row.source_set_id) ||
        row.record_mode !== 'production' || row.user_submit !== true || !['structured_web_ui','user_provided_text'].includes(row.entry_source) || row.validation_status !== 'ready' || row.master_id_status !== 'valid') throw new Error('Stagingの検証が未完了です。');
    const approvedSet = plan.sets.find(s => s.set_id === row.source_set_id);
    for (const [stagingKey, setKey] of [['matched_exercise_id','exercise_id'], ['set_no','set_no'], ['side','side'], ['load_type','load_type'], ['load_kg','load_kg'], ['reps','reps'], ['RIR','RIR']]) {
      if (!isDeepStrictEqual(blanks(row[stagingKey]), blanks(approvedSet[setKey]))) throw new Error('Stagingと承認Setの内容が一致しません。');
    }
  }
  if (current.sessions.length || current.sets.length) {
    if (!recordsMatch(current.sessions, [plan.session]) || !recordsMatch(current.sets, plan.sets)) throw new Error('既存記録が不完全または不一致です。手動reviewが必要です。');
    if (!current.staging.every(r => r.import_status === 'committed' && r.commit_match_status === 'match')) throw new Error('記録済みですがStaging確定が未完了です。手動reviewが必要です。');
    return { status: 'already_committed', session_id: sessionId, writes: 0, commit_match_status: 'match' };
  }
  if (current.duplicate_status !== 'unique' || current.staging.some(r => r.duplicate_status !== 'unique' || r.import_status === 'committed')) throw new Error('直前重複確認で停止しました。');
  if (current.freshPlan?.status !== 'commit_candidate') throw new Error('直前validation／master確認で停止しました。');
  if (!recordsMatch([current.freshPlan.session], [plan.session]) || !recordsMatch(current.freshPlan.sets, plan.sets)) throw new Error('承認後に実績が変更されています。Dry Runを再実行してください。');
  await gateway.commitAtomic(plan);
  const readback = await gateway.readback(sessionId);
  if (!recordsMatch(readback.sessions, [plan.session]) || !recordsMatch(readback.sets, plan.sets)) throw new Error('READ BACK不一致。成功扱いにしません。');
  await gateway.markStagingCommitted(sessionId, token);
  const staging = await gateway.readStaging(sessionId);
  if (staging.length !== plan.sets.length || !staging.every(r => r.import_status === 'committed' && r.commit_match_status === 'match')) throw new Error('Staging読み戻しが一致しません。');
  await gateway.audit({ session_id: sessionId, token, session_count: 1, set_count: plan.sets.length, commit_match_status: 'match' });
  return { status: 'committed', session_id: sessionId, session_count: 1, set_count: plan.sets.length, commit_match_status: 'match' };
}
