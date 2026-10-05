import { createClient } from '@supabase/supabase-js';
import { autoFinalize } from '../server/auto-finalize.mjs';
import { CommitJournal,snapshotHash } from '../server/commit-journal.mjs';
import { GoogleSheets } from '../server/google-sheets.mjs';
import { SheetsGateway } from '../server/sheets-gateway.mjs';
export const config={maxDuration:60};

export default async function handler(req, res) {
  res.setHeader('Cache-Control','private, no-store');
  if (req.method !== 'POST') return res.status(405).json({status:'review_required'});
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  const authorization = req.headers.authorization;
  if (!url || !key || !authorization?.startsWith('Bearer ')) return res.status(401).json({status:'review_required'});
  const token = authorization.slice(7);
  const client = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:authorization}}});
  const {data,error} = await client.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({status:'review_required'});
  const sessionId = req.body?.session_id;
  if (typeof sessionId !== 'string' || !/^[A-Za-z0-9_-]{8,120}$/.test(sessionId)) return res.status(400).json({status:'review_required'});
  let expectedHash;
  const cloud = { async readWorkout(userId,id) {
    const a = await client.from('workout_sessions').select('*').eq('user_id',userId).eq('session_id',id).single();
    const b = await client.from('workout_sets').select('*').eq('user_id',userId).eq('session_id',id);
    if (a.error || b.error) throw new Error('cloud_read_failed');
    const c=await client.from('workout_sessions').select('local_updated_at').eq('user_id',userId).eq('session_id',id).single();
    if(c.error||c.data.local_updated_at!==a.data.local_updated_at) throw new Error('cloud_changed_during_read');
    const payloadSets=(a.data.workout_payload?.exercises??[]).flatMap(e=>e.sets??[]);
    if(payloadSets.length!==b.data.length||new Set(payloadSets.map(s=>s.set_id)).size!==payloadSets.length) throw new Error('cloud_snapshot_incomplete');
    for(const row of b.data) {
      const p=payloadSets.find(s=>s.set_id===row.set_id);
      if(!p||['actual_weight_kg','actual_reps','actual_rir','completed'].some(k=>(p[k]??null)!==(row[k]??null))) throw new Error('cloud_snapshot_inconsistent');
    }
    const hash=snapshotHash(a.data,b.data);
    if(expectedHash&&expectedHash!==hash) throw new Error('cloud_snapshot_changed');
    expectedHash=hash;
    return {session:a.data,sets:b.data};
  }};
  // These names have NO VITE_ prefix and are imported by the server only.
  const enabled=process.env.WORKOUT_AUTO_FINALIZE_ENABLED==='true';
  const secret=process.env.SUPABASE_COMMIT_SECRET;
  const email=process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey=process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  const spreadsheetId=process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  let result={status:'review_required',session_id:sessionId,commit_match_status:null,reason:'server_gateway_unavailable'};
  try {
    if(enabled&&secret&&email&&privateKey&&spreadsheetId) {
      const initial=await cloud.readWorkout(data.user.id,sessionId);
      const submittedAt=Date.parse(initial.session.workout_payload?.submission?.submitted_at??'');
      const notBefore=Date.parse(process.env.WORKOUT_AUTO_FINALIZE_NOT_BEFORE??'');
      // Enabling the new route must NOT automatically commit old submitted records.
      if(!Number.isFinite(submittedAt)||!Number.isFinite(notBefore)||submittedAt<notBefore||submittedAt>Date.now()+120000) throw new Error('submission_outside_activation_window');
      const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
      const journal=new CommitJournal(admin,data.user.id,sessionId,expectedHash);
      const sheets=new SheetsGateway(new GoogleSheets({email,privateKey,spreadsheetId}),journal,cloud,data.user.id,sessionId);
      result=await autoFinalize({userId:data.user.id,sessionId,cloud,sheets,enabled});
    }
  } catch {result.reason='finalization_needs_review';}
  return res.status(result.status==='official_saved'?200:202).json(result);
}
