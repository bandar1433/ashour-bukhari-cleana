import { query } from '../_lib/db.js';
import { getActor,isStaff,validDate } from '../_lib/actor.js';
import { handleError,json } from '../_lib/http.js';

export default async function handler(req:any,res:any){
  if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
  try{
    const u=await getActor(req,res); if(!u)return;
    if(!isStaff(u.role))return json(res,403,{error:'Forbidden',message:'ليست لديك صلاحية لهذه الشاشة.'});
    const d=validDate(req.query?.date)||new Date().toISOString().slice(0,10);
    const students=await query(`
      select s.id,s.full_name,h.id circle_id,h.name circle_name,a.status attendance_status,
        coalesce((select count(*) from memorization_records m where m.student_id=s.id and m.record_date=$4 and m.record_type='new'),0)::int new_records,
        coalesce((select count(*) from memorization_records m where m.student_id=s.id and m.record_date=$4 and m.record_type='review'),0)::int review_records,
        coalesce((select round(avg(m.grade))::int from memorization_records m where m.student_id=s.id and m.record_date=$4),0)::int grade
      from students s join circles h on h.id=s.circle_id
      left join attendance a on a.student_id=s.id and a.attendance_date=$4
      where s.status='active' and (
        $1='system_admin' or
        ($1 in ('center_manager','supervisor') and s.center_id=$2::uuid) or
        ($1='teacher' and h.teacher_user_id=$3::uuid)
      )
      order by h.name,s.full_name
    `,[u.role,u.center_id,u.id,d]);
    const approvals=await query(`
      select da.id,da.circle_id,da.approval_date,da.approved_at
      from day_approvals da join circles h on h.id=da.circle_id
      where da.approval_date=$4 and (
        $1='system_admin' or
        ($1 in ('center_manager','supervisor') and h.center_id=$2::uuid) or
        ($1='teacher' and h.teacher_user_id=$3::uuid)
      )
    `,[u.role,u.center_id,u.id,d]);
    return json(res,200,{date:d,students,approvals});
  }catch(e){return handleError(res,e)}
}
