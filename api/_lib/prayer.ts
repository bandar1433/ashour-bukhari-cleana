import {riyadhDate as stableRiyadhDate} from './date.js';
const MAKKAH_LAT=21.4225,MAKKAH_LON=39.8262,TZ=3;
const rad=(x:number)=>x*Math.PI/180,deg=(x:number)=>x*180/Math.PI;
export function riyadhDate(d=new Date()){return stableRiyadhDate(d)}
export function riyadhClockMinutes(d=new Date()){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Riyadh',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(d);
  const h=Number(parts.find(x=>x.type==='hour')?.value||0),m=Number(parts.find(x=>x.type==='minute')?.value||0);return h*60+m;
}
export function makkahAsrMinutes(dateStr:string){
  const d=new Date(dateStr+'T12:00:00Z'),start=new Date(Date.UTC(d.getUTCFullYear(),0,0));
  const n=Math.floor((d.getTime()-start.getTime())/86400000);
  const g=2*Math.PI/365*(n-1);
  const eq=229.18*(0.000075+0.001868*Math.cos(g)-0.032077*Math.sin(g)-0.014615*Math.cos(2*g)-0.040849*Math.sin(2*g));
  const dec=0.006918-0.399912*Math.cos(g)+0.070257*Math.sin(g)-0.006758*Math.cos(2*g)+0.000907*Math.sin(2*g)-0.002697*Math.cos(3*g)+0.00148*Math.sin(3*g);
  const lat=rad(MAKKAH_LAT),alt=Math.atan(1/(1+Math.tan(Math.abs(lat-dec))));
  const cosH=(Math.sin(alt)-Math.sin(lat)*Math.sin(dec))/(Math.cos(lat)*Math.cos(dec));
  const H=deg(Math.acos(Math.max(-1,Math.min(1,cosH))));
  let mins=(720-4*MAKKAH_LON-eq+TZ*60)+(H*4);mins=((mins%1440)+1440)%1440;
  return Math.round(mins);
}
export function clockText(minutes:number){
  const x=((Math.round(minutes)%1440)+1440)%1440,h=Math.floor(x/60),m=x%60;
  return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
}
export function makkahAsrTime(dateStr:string){return clockText(makkahAsrMinutes(dateStr))}
export function makkahAsrPlus70(dateStr:string){return clockText(makkahAsrMinutes(dateStr)+70)}
export function circleStartMinutes(dateStr:string,startTime?:string|null){
  const raw=String(startTime||'').slice(0,5);
  if(/^\d{2}:\d{2}$/.test(raw)){const [h,m]=raw.split(':').map(Number);if(h>=0&&h<24&&m>=0&&m<60)return h*60+m}
  return makkahAsrMinutes(dateStr);
}
export function attendanceTiming(dateStr:string,startTime:string|undefined|null,instant=new Date(),lateAfter=70,deductionAfter=90,majorAfter=120){
  const elapsed=riyadhDate(instant)===dateStr?Math.max(0,riyadhClockMinutes(instant)-circleStartMinutes(dateStr,startTime)):0;
  const late=Math.max(0,elapsed-Math.max(0,lateAfter));
  const status=elapsed>lateAfter?'late':'present';
  const percent=elapsed<=deductionAfter?100:elapsed<=majorAfter?67:33;
  const pointsPenalty=percent===100?0:percent>=67?10:20;
  return {elapsed_minutes:elapsed,late_minutes:late,status,attendance_percent:percent,points_penalty:pointsPenalty};
}
// Backward-compatible helper: minutes after the configured circle start.
export function lateMinutes(dateStr:string,startTime:string|undefined|null,instant=new Date()){
  if(riyadhDate(instant)!==dateStr)return 0;
  return Math.max(0,riyadhClockMinutes(instant)-circleStartMinutes(dateStr,startTime));
}
