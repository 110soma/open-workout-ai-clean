import { createPrivateKey, sign } from 'node:crypto';
const writable=new Set(['01_Sessions','02_Sets','15_AutoLogStaging','16_UpdateLog']);
export class GoogleSheets {
 constructor({email,privateKey,spreadsheetId,fetchImpl=fetch,scope='https://www.googleapis.com/auth/spreadsheets'}) {
  if(!spreadsheetId) throw new Error('spreadsheet_id_missing');
  Object.assign(this,{email,privateKey,spreadsheetId,fetchImpl,scope});
 }
 async accessToken() {
  if(this.token && Date.now()<this.expires) return this.token;
  const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const now=Math.floor(Date.now()/1000);
  const part=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:this.email,scope:this.scope,
   aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
  const jwt=part+'.'+sign('RSA-SHA256',Buffer.from(part),createPrivateKey(this.privateKey.replace(/\\n/g,'\n'))).toString('base64url');
  const response=await this.fetchImpl('https://oauth2.googleapis.com/token',{method:'POST',
   headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt}),signal:AbortSignal.timeout(12000)});
  if(!response.ok) throw new Error('google_auth_failed');
  const data=await response.json(); if(!data.access_token) throw new Error('google_auth_failed');
  this.token=data.access_token; this.expires=Date.now()+3000000; return this.token;
 }
 async request(path,body) {
  const response=await this.fetchImpl(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}${path}`,{
   method:body?'POST':'GET',headers:{Authorization:`Bearer ${await this.accessToken()}`,'Content-Type':'application/json'},
   ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(18000)});
  // Writes are NEVER automatically retried, including 429/5xx/timeouts.
  if(!response.ok) throw new Error('sheets_request_failed');
  return response.json();
 }
 async read() {
  const meta=await this.request('?fields=sheets.properties');
  this.tabs=new Map(meta.sheets.map(s=>[s.properties.title,s.properties]));
  const names=['01_Sessions','02_Sets','03_Exercises','15_AutoLogStaging','16_UpdateLog','17_TechniqueVariants'];
  const ends=['O','W','X','AL','J','Z'];
  const q=names.map((n,i)=>`ranges=${encodeURIComponent("'"+n+"'!A1:"+ends[i])}`).join('&');
  const data=await this.request('/values:batchGet?valueRenderOption=UNFORMATTED_VALUE&'+q);
  return Object.fromEntries(names.map((name,i)=>{
   const [headers=[],...values]=data.valueRanges[i].values??[];
   return [name,{headers,rows:values.map((v,j)=>Object.assign(Object.fromEntries(headers.map((h,k)=>[h,v[k]??null])),{_row:j+1}))}];
  }));
 }
 cell(value) {return value===null||value===undefined||value===''?{}:{userEnteredValue:typeof value==='number'?{numberValue:value}:typeof value==='boolean'?{boolValue:value}:{stringValue:String(value)}};}
 append(name,headers,rows) {
  if(!writable.has(name)||!this.tabs?.has(name)) throw new Error('sheet_write_not_allowed');
  return {appendCells:{sheetId:this.tabs.get(name).sheetId,rows:rows.map(r=>({values:headers.map(h=>this.cell(r[h]))})),fields:'userEnteredValue'}};
 }
 update(name,headers,row) {
  if(!writable.has(name)||!Number.isInteger(row._row)||row._row<1) throw new Error('sheet_write_not_allowed');
  return {updateCells:{start:{sheetId:this.tabs.get(name).sheetId,rowIndex:row._row,columnIndex:0},
   rows:[{values:headers.map(h=>this.cell(row[h]))}],fields:'userEnteredValue'}};
 }
 async batch(requests) {if(requests.length) await this.request(':batchUpdate',{requests});}
}
