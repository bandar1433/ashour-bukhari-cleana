import { query } from './_lib/db.js';
import { getActor,isStaff } from './_lib/actor.js';
import { handleError,json } from './_lib/http.js';

export default async function handler(req:any,res:any){
  try{
    const u=await getActor(req,res);if(!u)return;
    if(req.method==='GET'){
      if(!isStaff(u.role))return json(res,403,{error:'Forbidden'});
      const rows=await query(`
        select a.id,a.attendance_date,a.status,a.late_minutes,a.points_penalty,coalesce(s.full_name,us.full_name,'بدون اسم') full_name,c.name circle_name
        from attendance a join students s on s.id=a.student_id left join users us on us.id=s.user_id left join circles c on c.id=a.circle_id
        where $1='system_admin'
          or ($1 in ('center_manager','supervisor') and s.center_id=$2::uuid)
          or ($1='teacher' and c.teacher_user_id=$3::uuid)
        order by a.attendance_date desc,a.created_at desc limit 300
      `,[u.role,u.center_id,u.id]);
      return json(res,200,{items:rows});
    }
    if(req.method==='POST'){
      if(!isStaff(u.role))return json(res,403,{error:'Forbidden'});
      const b=req.body||{};
      const s=(await query<any>(`select s.id,s.circle_id,s.center_id,c.teacher_user_id from students s left join circles c on c.id=s.circle_id where s.id=$1`,[b.student_id]))[0];
      if(!s?.circle_id)return json(res,400,{error:'الطالب غير مرتبط بحلقة'});
      const allowed=u.role==='system_admin'||(['center_manager','supervisor'].includes(u.role)&&s.center_id===u.center_id)||(u.role==='teacher'&&s.teacher_user_id===u.id);
      if(!allowed)return json(res,403,{error:'Forbidden',message:'الطالب خارج نطاق صلاحيتك.'});
      const rows=await query(`insert into attendance(student_id,circle_id,attendance_date,status,late_minutes,points_penalty,notes,recorded_by) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(student_id,attendance_date) do update set status=excluded.status,late_minutes=excluded.late_minutes,points_penalty=excluded.points_penalty,notes=excluded.notes,recorded_by=excluded.recorded_by returning *`,
        [b.student_id,s.circle_id,b.attendance_date,b.status||'present',Number(b.late_minutes||0),Number(b.points_penalty||0),b.notes||null,u.id]);
      return json(res,200,rows[0]);
    }
    return json(res,405,{error:'Method not allowed'});
  }catch(e){return handleError(res,e)}
}