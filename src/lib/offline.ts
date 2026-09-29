import {apiPost,getSessionUserId} from './api';

export type OfflineKind='punch'|'quran';
export type OfflineOperation={
  id:string;
  userId:string;
  kind:OfflineKind;
  body:any;
  event_at:string;
  record_date:string;
  created_at:string;
  last_error?:string;
};

const QUEUE_KEY='ashour_offline_queue_v1';
const PROFILE_PREFIX='ashour_student_profile_cache_v1:';

export function riyadhDateNow(d=new Date()){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
}
function readQueue():OfflineOperation[]{
  try{const x=JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]');return Array.isArray(x)?x:[]}catch{return []}
}
function writeQueue(items:OfflineOperation[]){
  localStorage.setItem(QUEUE_KEY,JSON.stringify(items.slice(-50)));
  window.dispatchEvent(new CustomEvent('ashour:offline-queue',{detail:{pending:items.length}}));
}
export function pendingOfflineOperations(){
  const uid=getSessionUserId();
  return readQueue().filter(x=>!uid||x.userId===uid);
}
export function pendingOfflineCount(){return pendingOfflineOperations().length}
export function queueOfflineOperation(kind:OfflineKind,body:any,event=new Date()){
  const userId=getSessionUserId();
  if(!userId)throw new Error('يلزم تسجيل الدخول مرة واحدة بالإنترنت قبل استخدام التسجيل دون اتصال.');
  const op:OfflineOperation={
    id:crypto.randomUUID(),
    userId,
    kind,
    body,
    event_at:event.toISOString(),
    record_date:riyadhDateNow(event),
    created_at:new Date().toISOString()
  };
  const q=readQueue();
  q.push(op);writeQueue(q);
  return op;
}
export function offlinePunchState(){
  const q=pendingOfflineOperations().filter(x=>x.kind==='punch');
  const checkIn=[...q].reverse().find(x=>x.body?.action==='check_in');
  const checkOut=[...q].reverse().find(x=>x.body?.action==='check_out');
  return {checkIn,checkOut};
}
export async function syncOfflineOperations(){
  if(typeof navigator!=='undefined'&&!navigator.onLine)return {synced:0,pending:pendingOfflineCount()};
  const uid=getSessionUserId();if(!uid)return {synced:0,pending:pendingOfflineCount()};
  let q=readQueue(),synced=0;
  const mine=q.filter(x=>x.userId===uid).sort((a,b)=>a.created_at.localeCompare(b.created_at));
  for(const op of mine){
    try{
      await apiPost('/api/ops?action=self-service&kind='+op.kind,{
        ...op.body,
        offline_operation_id:op.id,
        offline_event_at:op.event_at,
        offline_record_date:op.record_date
      });
      q=q.filter(x=>x.id!==op.id);writeQueue(q);synced++;
    }catch(error:any){
      const msg=String(error?.message||error||'تعذر المزامنة');
      if(!navigator.onLine||/Failed to fetch|NetworkError|Load failed/i.test(msg))break;
      q=q.map(x=>x.id===op.id?{...x,last_error:msg}:x);writeQueue(q);
      break;
    }
  }
  return {synced,pending:q.filter(x=>x.userId===uid).length};
}
export function cacheStudentProfile(data:any){
  const uid=getSessionUserId();if(!uid||!data)return;
  localStorage.setItem(PROFILE_PREFIX+uid,JSON.stringify({saved_at:new Date().toISOString(),data}));
}
export function getCachedStudentProfile(){
  const uid=getSessionUserId();if(!uid)return null;
  try{return JSON.parse(localStorage.getItem(PROFILE_PREFIX+uid)||'null')?.data||null}catch{return null}
}
export function isNetworkFailure(error:any){
  const msg=String(error?.message||error||'');
  return typeof navigator!=='undefined'&&!navigator.onLine||/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(msg);
}
