import {query} from '../_lib/db.js';
import {validUuid} from '../_lib/actor.js';
import {json} from '../_lib/http.js';
import {makkahAsrTime} from '../_lib/prayer.js';
import {today,int} from './shared.js';

async function allowedCircle(u:any,circleId:string){
 return (await query<any>(`select c.* from circles c where c.id=$1 and
  ($2='system_admin' or ($2 in ('center_manager','supervisor') and c.center_id=$3::uuid) or ($2='teacher' and is_circle_teacher(c.id,$4::uuid)))`,
  [circleId,u.role,u.center_id,u.id]))[0]||null;
}
function timeValue(v:any){
 const s=String(v||'').trim();if(!s)return null;
 return /^([01]\d|2[0-3]):[0-5]\d$/.test(s)?s:null;
}
export async function circleSettings(req:any,res:any,u:any){
 if(!['system_admin','center_manager','supervisor','teacher'].includes(u.role))return json(res,403,{error:'Forbidden'});
 const circleId=validUuid(req.method==='GET'?req.query?.circle_id:req.body?.circle_id);if(!circleId)return json(res,400,{error:'اختر الحلقة.'});
 const circle=await allowedCircle(u,circleId);if(!circle)return json(res,403,{error:'الحلقة خارج نطاق صلاحيتك.'});
 if(req.method==='GET'){
  const d=today(),tasks=await query<any>('select * from circle_tasks where circle_id=$1 order by is_active desc,sort_order,created_at',[circleId]),rewards=await query<any>('select * from rewards where circle_id=$1 order by is_active desc,points_cost',[circleId]);
  return json(res,200,{circle:{...circle,attendance_token:String(circle.attendance_token),effective_start_time:String(circle.start_time||makkahAsrTime(d)).slice(0,5),automatic_start:!circle.start_time},tasks,rewards,defaults:{start:'أذان العصر في مكة',late_after_minutes:70,deduction_after_minutes:90,major_deduction_after_minutes:120,attendance_scores:[30,20,10,0]}});
 }
 if(req.method==='PUT'){
  const b=req.body||{},start=b.start_time===null||b.start_time===''?null:timeValue(b.start_time);if(b.start_time&&start===null)return json(res,400,{error:'وقت بدء الحلقة غير صالح.'});
  const late=int(b.late_after_minutes,0,240),deduct=int(b.deduction_after_minutes,0,300),major=int(b.major_deduction_after_minutes,0,360);
  if(!(late<deduct&&deduct<major))return json(res,400,{error:'يجب أن يكون بدء التأخر قبل الخصم الأول، والخصم الأول قبل الخصم الثاني.'});
  const before={start_time:circle.start_time,late_after_minutes:circle.late_after_minutes,deduction_after_minutes:circle.deduction_after_minutes,major_deduction_after_minutes:circle.major_deduction_after_minutes};
  const row=(await query<any>('update circles set start_time=$2::time,late_after_minutes=$3,deduction_after_minutes=$4,major_deduction_after_minutes=$5 where id=$1 returning *',[circleId,start,late,deduct,major]))[0];
  await query(`insert into audit_logs(actor_user_id,action,entity_type,entity_id,before_json,after_json,reason) values($1,'update','circle_settings',$2,$3::jsonb,$4::jsonb,'تحديث إعدادات الحلقة')`,[u.id,circleId,JSON.stringify(before),JSON.stringify({start_time:row.start_time,late_after_minutes:row.late_after_minutes,deduction_after_minutes:row.deduction_after_minutes,major_deduction_after_minutes:row.major_deduction_after_minutes})]);
  return json(res,200,row);
 }
 if(req.method==='POST'&&String(req.query?.sub||'')==='regenerate-qr'){
  const row=(await query<any>('update circles set attendance_token=gen_random_uuid() where id=$1 returning attendance_token',[circleId]))[0];
  await query(`insert into audit_logs(actor_user_id,action,entity_type,entity_id,after_json,reason) values($1,'regenerate_qr','circle_settings',$2,$3::jsonb,'إصدار رمز حضور ثابت جديد')`,[u.id,circleId,JSON.stringify({attendance_token:String(row.attendance_token)})]);
  return json(res,200,{attendance_token:String(row.attendance_token)});
 }
 return json(res,405,{error:'Method not allowed'});
}
