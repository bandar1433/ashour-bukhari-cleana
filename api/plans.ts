import { query } from './_lib/db.js';
import { getActor,isStaff } from './_lib/actor.js';
import { handleError,json } from './_lib/http.js';

export default async function handler(req:any,res:any){
  try{
    const u=await getActor(req,res);if(!u)return;
    if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
    if(!isStaff(u.role)&&u.role!=='student')return json(res,403,{error:'Forbidden'});
    const rows=await query(`
      select w.id,w.week_start,w.day_name,w.new_target,w.review_target,w.goals,coalesce(s.full_name,us.full_name,'بدون اسم') full_name
      from weekly_plans w join students s on s.id=w.student_id left join users us on us.id=s.user_id left join circles c on c.id=s.circle_id
      where $1='system_admin'
        or ($1 in ('center_manager','supervisor') and s.center_id=$2::uuid)
        or ($1='teacher' and c.teacher_user_id=$3::uuid)
        or ($1='student' and s.user_id=$3::uuid)
      order by w.week_start desc,w.created_at desc limit 300
    `,[u.role,u.center_id,u.id]);
    return json(res,200,{items:rows});
  }catch(e){return handleError(res,e)}
}