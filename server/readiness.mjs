import { createClient } from '@supabase/supabase-js';
import { GoogleSheets } from './google-sheets.mjs';
import { SheetsGateway } from './sheets-gateway.mjs';
import { readEditCapability } from './google-permission.mjs';
export async function checkServerReadiness(env=process.env) {
 const required=['VITE_SUPABASE_URL','SUPABASE_COMMIT_SECRET','GOOGLE_SHEETS_CLIENT_EMAIL','GOOGLE_SHEETS_PRIVATE_KEY','GOOGLE_SHEETS_SPREADSHEET_ID'];
 if(required.some(k=>!env[k])) return {status:'SETUP_REQUIRED'};
 try {
  const client=createClient(env.VITE_SUPABASE_URL,env.SUPABASE_COMMIT_SECRET,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error}=await client.from('workout_commit_requests').select('session_id').limit(0);
  const mutex=await client.from('workout_commit_mutex').select('owner_token').eq('id',1).single();
  if(error||mutex.error) return {status:'MIGRATION_REQUIRED'};
  if(mutex.data.owner_token) return {status:'LOCK_REVIEW_REQUIRED'};
  const sheets=new SheetsGateway(new GoogleSheets({email:env.GOOGLE_SHEETS_CLIENT_EMAIL,privateKey:env.GOOGLE_SHEETS_PRIVATE_KEY,spreadsheetId:env.GOOGLE_SHEETS_SPREADSHEET_ID}),null,null,null,null);
  await sheets.load();
  const permission=await readEditCapability({email:env.GOOGLE_SHEETS_CLIENT_EMAIL,privateKey:env.GOOGLE_SHEETS_PRIVATE_KEY,spreadsheetId:env.GOOGLE_SHEETS_SPREADSHEET_ID});
  return {status:permission.can_edit===false?'EDITOR_SHARE_REQUIRED':'READY_FOR_PREVIEW_PILOT',writes:0,
   write_permission:permission.can_edit===true?'editor_verified':permission.can_edit===false?'not_editor':'unverified_requires_editor_share',
   permission_diagnostic:permission,enabled:env.WORKOUT_AUTO_FINALIZE_ENABLED==='true'};
 } catch {return {status:'SERVER_CONFIG_REVIEW_REQUIRED'};}
}
