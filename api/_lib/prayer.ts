const MAKKAH_LAT=21.4225,MAKKAH_LON=39.8262,TZ=3;
const rad=(x:number)=>x*Math.PI/180,deg=(x:number)=>x*180/Math.PI;
export function riyadhDate(d=new Date()){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
}
export function riyadhClockMinutes(d=new Date()){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Riyadh',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(d);
  const h=Number(parts.find(x=>x.type==='hour')?.value||0),m=Number(parts.find(x=>x.type==='minute')?.value||0);return h*60+m;
}
export function makkahAsrPlus70(dateStr:string){
  const d=new Date(dateStr+'T12:00:00Z'),start=new Date(Date.UTC(d.getUTCFullYear(),0,0));
  const n=Math.floor((d.getTime()-start.getTime())/86400000);
  const g=2*Math.PI/365*(n-1);
  const eq=229.18*(0.000075+0.001868*Math.cos(g)-0.032077*Math.sin(g)-0.014615*Math.cos(2*g)-0.040849*Math.sin(2*g));
  const dec=0.006918-0.399912*Math.cos(g)+0.070257*Math.sin(g)-0.006758*Math.cos(2*g)+0.000907*Math.sin(2*g)-0.002697*Math.cos(3*g)+0.00148*Math.sin(3*g);
  const lat=rad(MAKKAH_LAT),alt=Math.atan(1/(1+Math.tan(Math.abs(lat-dec))));
  const cosH=(Math.sin(alt)-Math.sin(lat)*Math.sin(dec))/(Math.cos(lat)*Math.cos(dec));
  const H=deg(Math.acos(Math.max(-1,Math.min(1,cosH))));
  let mins=(720-4*MAKKAH_LON-eq+TZ*60)+(H*4)+70;mins=((mins%1440)+1440)%1440;
  const h=Math.floor(mins/60),m=Math.round(mins%60);const hh=(h+(m===60?1:0))%24,mm=m===60?0:m;
  return String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0');
}
export function lateMinutes(dateStr:string,startTime:string|undefined|null,instant=new Date()){
  if(riyadhDate(instant)!==dateStr)return 0;
  const start=String(startTime||makkahAsrPlus70(dateStr)).slice(0,5),[h,m]=start.split(':').map(Number);
  return Math.max(0,riyadhClockMinutes(instant)-(h*60+m));
}
