import {query} from './db.js';

export type EvalCriterion={
 id:string;name:string;kind:'quran'|'attendance'|'task';system_key:string|null;
 weight:number;target_pages:number;sort_order:number;set_id:string;effective_month:string;
};

export const monthStart=(value:string)=>String(value||'').slice(0,7)+'-01';
export function nextMonth(value:string){
 const d=new Date(monthStart(value)+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);return d.toISOString().slice(0,7)+'-01';
}
export async function ensureEvaluationSet(circleId:string,value:string,createdBy?:string|null){
 const month=monthStart(value);
 let set=(await query<any>('select * from circle_evaluation_sets where circle_id=$1 and effective_month=$2::date limit 1',[circleId,month]))[0];
 if(set)return set;
 const previous=(await query<any>('select * from circle_evaluation_sets where circle_id=$1 and effective_month<$2::date order by effective_month desc limit 1',[circleId,month]))[0];
 set=(await query<any>('insert into circle_evaluation_sets(circle_id,effective_month,created_by) values($1,$2::date,$3) on conflict(circle_id,effective_month) do update set updated_at=now() returning *',[circleId,month,createdBy||null]))[0];
 if(previous){
  await query(`insert into circle_evaluation_criteria(set_id,name,kind,system_key,weight,target_pages,sort_order)
    select $1,name,kind,system_key,weight,target_pages,sort_order from circle_evaluation_criteria where set_id=$2
    on conflict do nothing`,[set.id,previous.id]);
 }else{
  await query(`insert into circle_evaluation_criteria(set_id,name,kind,system_key,weight,target_pages,sort_order) values
   ($1,'الحفظ الجديد','quran','new',30,0,10),
   ($1,'المراجعة','quran','review',40,0,20),
   ($1,'الحضور والانضباط','attendance','attendance',30,0,30)`,[set.id]);
 }
 return set;
}
export async function criteriaForCircle(circleId:string,value:string,createdBy?:string|null):Promise<EvalCriterion[]>{
 const set=await ensureEvaluationSet(circleId,value,createdBy);
 const rows=await query<any>(`select c.*,s.effective_month from circle_evaluation_criteria c join circle_evaluation_sets s on s.id=c.set_id where c.set_id=$1 order by c.sort_order,c.created_at`,[set.id]);
 return rows.map((r:any)=>({...r,weight:Number(r.weight),target_pages:Number(r.target_pages||0),effective_month:String(r.effective_month).slice(0,10)}));
}
export function attendancePercent(status:any,late:any){
 if(status==='excused')return null;
 if(status==='absent'||!status)return 0;
 const m=Number(late||0);return m<=30?100:m<=60?67:33;
}
export function scoreCriteria(criteria:EvalCriterion[],row:any,customRecords:any[]=[]){
 const custom=new Map(customRecords.map((x:any)=>[String(x.criterion_id),x]));
 const items=criteria.map(c=>{
  let done=0,target=Number(c.target_pages||0),percent:number|null=0,record:any=null;
  if(c.system_key==='attendance'){percent=attendancePercent(row.status??row.attendance_status,row.late_minutes);done=percent===null?0:percent;target=100}
  else if(c.system_key==='new'){record=row.new_record||row.new||null;done=Number(record?.page_count??record?.pages??row.new_done??0);target=Number(row.new_target_pages||target||0);percent=target>0?Math.min(100,100*done/target):null}
  else if(c.system_key==='review'){record=row.review_record||row.review||null;done=Number(record?.page_count??record?.pages??row.review_done??0);target=Number(row.review_target_pages||target||0);percent=target>0?Math.min(100,100*done/target):null}
  else {
   record=custom.get(String(c.id))||null;
   if(c.kind==='quran'){done=Number(record?.page_count||0);percent=target>0?Math.min(100,100*done/target):null}
   else if(c.kind==='task'){done=record?.completed?1:0;target=1;percent=done?100:0}
  }
  const points=percent===null?null:Math.round((Number(c.weight)*percent/100)*100)/100;
  return {...c,done,target,percent:percent===null?null:Math.round(percent*10)/10,points,record};
 });
 const scorable=items.filter(x=>x.points!==null);
 const usedWeight=scorable.reduce((n,x)=>n+Number(x.weight),0);
 const points=scorable.reduce((n,x)=>n+Number(x.points||0),0);
 const score=usedWeight>0?Math.round((points*100/usedWeight)*10)/10:null;
 return {items,score,used_weight:usedWeight};
}
export function bandFor(score:number){return score>=85?'green':score>=75?'yellow':'red'}
