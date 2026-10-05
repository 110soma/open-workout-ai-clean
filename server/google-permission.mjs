import { GoogleSheets } from './google-sheets.mjs';
// Metadata GET only: no write test, no new account or delegated user auth.
export async function readEditCapability({email,privateKey,spreadsheetId,fetchImpl=fetch}) {
 try {
  const auth=new GoogleSheets({email,privateKey,spreadsheetId,fetchImpl,scope:'https://www.googleapis.com/auth/drive.metadata.readonly'});
  const response=await fetchImpl(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}?fields=id%2Ccapabilities%28canEdit%29&supportsAllDrives=true`,
   {headers:{Authorization:`Bearer ${await auth.accessToken()}`},signal:AbortSignal.timeout(12000)});
  if(!response.ok) return {can_edit:null,provider:'google_drive',http_status:response.status,error_category:'metadata_permission_unverified'};
  const data=await response.json();
  if(data.id!==spreadsheetId||typeof data.capabilities?.canEdit!=='boolean') return {can_edit:null,provider:'google_drive',http_status:200,error_category:'capability_missing'};
  return {can_edit:data.capabilities.canEdit,provider:'google_drive',http_status:200};
 } catch {return {can_edit:null,provider:'google_drive',http_status:null,error_category:'metadata_permission_unverified'};}
}
