import { adaptWorkoutResult } from '../scripts/phase4/workout-result-adapter.mjs';
import { buildCommitPlan } from '../scripts/phase4/commit-planner.mjs';
import { finalizeApprovedCommit } from '../scripts/phase4/finalize-commit.mjs';

export async function autoFinalize({ userId, sessionId, cloud, sheets, enabled }) {
  const pending = { status: 'review_required', session_id: sessionId, commit_match_status: null };
  if (!enabled || !sheets) return { ...pending, reason: 'server_gateway_unavailable' };
  try {
    // The server gateway must provide a durable cross-request lock, not an in-memory mutex.
    return await sheets.withSessionLock(sessionId, async () => {
      const { session, sets } = await cloud.readWorkout(userId, sessionId);
      if (session?.user_id !== userId || session.session_id !== sessionId || session.record_mode !== 'production' ||
          session.status !== 'committed' || session.workout_payload?.submission?.user_submit !== true ||
          session.workout_payload?.submission?.entry_source !== 'structured_web_ui') throw new Error('submission_not_eligible');
      if (!sets.length || sets.some(s => s.session_id !== sessionId || s.user_id !== userId || !s.set_id) || new Set(sets.map(s => s.set_id)).size !== sets.length) throw new Error('invalid_stable_ids');
      const receipt = await sheets.getVerifiedReceipt(sessionId);
      if (receipt) {
        await sheets.verifyReceiptReadback(receipt);
        return { status: 'official_saved', session_id: sessionId, commit_match_status: 'match' };
      }
      if (sheets.recoverPlan && await sheets.recoverPlan()) return {status:'official_saved',session_id:sessionId,commit_match_status:'match'};
      const context = await sheets.readValidationContext(sessionId);
      const adapter = adaptWorkoutResult({session: {...session, entry_source:'structured_web_ui',user_submit:true}, sets}, context);
      const plan = buildCommitPlan(adapter, {sourceSession:session, sourceSets:sets, historySessions:context.historySessions, historySets:context.historySets});
      if (plan.status !== 'commit_candidate') throw new Error('validation_or_duplicate_block');
      if (sheets.preparePlan) await sheets.preparePlan(plan);
      await sheets.stageValidated(adapter);
      const result = await finalizeApprovedCommit({plan, sessionId, token:plan.confirmation_token, gateway:sheets});
      if (result.commit_match_status !== 'match') throw new Error('readback_not_match');
      await sheets.storeVerifiedReceipt(sessionId, plan);
      return {status:'official_saved',session_id:sessionId,commit_match_status:'match'};
    });
  } catch {
    // Do not delete or rewrite cloud/local workout records on any finalization failure.
    return {...pending,reason:'finalization_needs_review'};
  }
}
