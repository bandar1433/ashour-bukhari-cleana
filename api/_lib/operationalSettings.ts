import { query } from './db.js';

export type OperationalSettings={
  grace_minutes:number;
  minor_late_penalty:number;
  major_late_penalty:number;
  memorization_weight:number;
  review_weight:number;
  discipline_weight:number;
  edit_window_days:number;
};

const FALLBACK:OperationalSettings={
  grace_minutes:30,
  minor_late_penalty:10,
  major_late_penalty:20,
  memorization_weight:30,
  review_weight:40,
  discipline_weight:30,
  edit_window_days:7,
};

const n=(value:any,fallback:number,min=0,max=10000)=>{
  const x=Number(value);
  return Number.isFinite(x)?Math.min(max,Math.max(min,x)):fallback;
};

export async function getOperationalSettings():Promise<OperationalSettings>{
  const row=(await query<any>(`select grace_minutes,minor_late_penalty,major_late_penalty,
    memorization_weight,review_weight,discipline_weight,edit_window_days
    from operational_settings where id=1 limit 1`))[0];
  if(!row)return {...FALLBACK};
  const settings:OperationalSettings={
    grace_minutes:n(row.grace_minutes,FALLBACK.grace_minutes,0,120),
    minor_late_penalty:n(row.minor_late_penalty,FALLBACK.minor_late_penalty,0,100),
    major_late_penalty:n(row.major_late_penalty,FALLBACK.major_late_penalty,0,100),
    memorization_weight:n(row.memorization_weight,FALLBACK.memorization_weight,0,100),
    review_weight:n(row.review_weight,FALLBACK.review_weight,0,100),
    discipline_weight:n(row.discipline_weight,FALLBACK.discipline_weight,0,100),
    edit_window_days:n(row.edit_window_days,FALLBACK.edit_window_days,1,30),
  };
  if(settings.memorization_weight+settings.review_weight+settings.discipline_weight!==100)return {...FALLBACK};
  return settings;
}

export function progressScore(done:any,target:any,weight:number){
  const d=Math.max(0,Number(done)||0),t=Math.max(0,Number(target)||0),w=Math.max(0,Number(weight)||0);
  return t>0?Math.min(w,Math.round(w*d/t)):w;
}

export function attendanceScore(status:any,lateMinutes:any,settings:OperationalSettings):number|null{
  const s=String(status||'');
  if(s==='excused')return null;
  if(s==='absent')return 0;
  if(!['present','late'].includes(s))return 0;
  const late=Math.max(0,Number(lateMinutes)||0);
  if(late<=settings.grace_minutes)return settings.discipline_weight;
  if(late<=settings.grace_minutes*2)return Math.max(0,settings.discipline_weight-settings.minor_late_penalty);
  return Math.max(0,settings.discipline_weight-settings.major_late_penalty);
}

export function latePenalty(lateMinutes:any,settings:OperationalSettings):number{
  const late=Math.max(0,Number(lateMinutes)||0);
  if(late<=settings.grace_minutes)return 0;
  if(late<=settings.grace_minutes*2)return settings.minor_late_penalty;
  return settings.major_late_penalty;
}
