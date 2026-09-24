import { query } from './_lib/db.js';
import { getActor,isStaff } from './_lib/actor.js';
import { handleError,json } from './_lib/http.js';
import {lateMinutes,riyadhDate} from './_lib/prayer.js';
import {isWeekLocked} from './_lib/weeklyLock.js';
import {operationalDay} from './_lib/operationalDay.js';

export default async function handler(req:any,res:any){
  try{
    const u=await getActor(req,res);if(!u)return;
    if(req.method==='GET'){
      if(!isStaff(u.role))return json(res,403,{error:'Forbidden'});
      const rows=await query(`
        select a.id,a.student_id,a.circle_id,a.attendance_date,a.status,a.late_minutes,a.points_penalty,a.check_in_at,a.check_out_at,a.notes,coalesce(s.full_name,us.full_name,'بدون اسم') full_name,c.name circle_name
        from attendance a join students s on s.id=a.student_id left join users us on us.id=s.user_id left join circles c on c.id=a.circle_id
        where $1='system_admin'
          or ($1 in ('center_manager','supervisor') and s.center_id=$2::uuid)
          or ($1='teacher' and c.teacher_user_id=$3::uuid)
        order by a.attendance_date desc,a.created_at desc limit 300
      `,[u.role,u.center_id,u.id]);
      return json(res,200,{items:rows});
    }
    if(req.method==='POST'||req.method==='PUT'){
      if(!isStaff(u.role))return json(res,403,{error:'Forbidden'});
      const b=req.body||{};
      const recordDate=String(b.attendance_date||riyadhDate());
      if(!/^\d{4}-\d{2}-\d{2}$/.test(recordDate)||!Number.isFinite(Date.parse(recordDate)))return json(res,400,{error:'تاريخ الحضور غير صالح'});
      const allowedStatuses=['present','late','absent','excused'];if(!allowedStatuses.includes(String(b.status||'present')))return json(res,400,{error:'حالة الحضور غير صالحة'});
      const s=(await query<any>(`select s.id,s.circle_id,s.center_id,c.teacher_user_id,c.start_time from students s left join circles c on c.id=s.circle_id where s.id=$1`,[b.student_id]))[0];
      if(!s?.circle_id)return json(res,400,{error:'الطالب غير مرتبط بحلقة'});
      const allowed=u.role==='system_admin'||(['center_manager','supervisor'].includes(u.role)&&s.center_id===u.center_id)||(u.role==='teacher'&&s.teacher_user_id===u.id);
      if(!allowed)return json(res,403,{error:'Forbidden',message:'الطالب خارج نطاق صلاحيتك.'});
      const operational=await operationalDay(recordDate,s.center_id);if(!operational.open)return json(res,409,{error:'NON_OPERATIONAL_DAY',message:operational.reason});
      const locked=(await query<any>('select id from day_approvals where circle_id=$1 and approval_date=$2',[s.circle_id,recordDate]))[0];const weekLocked=await isWeekLocked(s.circle_id,recordDate);
      const exception=(await query<any>("select id from edit_exceptions where student_id=$1 and record_date=$2 and status='approved' and expires_at>now()",[s.id,recordDate]))[0];
      if(weekLocked&&u.role==='teacher')return json(res,403,{error:'الأسبوع مقفل',message:'تم إقفال هذا الأسبوع نهائيًا من الإشراف.'});
      if(locked&&u.role==='teacher'&&!exception)return json(res,403,{error:'تم اعتماد اليوم',message:'تم اعتماد هذا اليوم. اطلب فتح تعديل استثنائي من الإدارة.'});
      let checkIn=b.check_in_at||null,checkOut=b.check_out_at||null,late=0,status=String(b.status||'present');
      if(status==='present'||status==='late'){
        if(!checkIn)checkIn=new Date().toISOString();
        const parsed=new Date(checkIn);if(!Number.isFinite(parsed.getTime()))return json(res,400,{error:'وقت الوصول غير صالح'});
        late=lateMinutes(recordDate,s.start_time,parsed);status=late>30?'late':'present';
      }else{checkIn=null;checkOut=null;late=0}
      if(checkOut&&!checkIn)return json(res,400,{error:'لا يمكن تسجيل الانصراف قبل الحضور'});
      if(checkOut&&!Number.isFinite(new Date(checkOut).getTime()))return json(res,400,{error:'وقت الانصراف غير صالح'});
      const rows=await query(`insert into attendance(student_id,circle_id,attendance_date,status,late_minutes,points_penalty,notes,recorded_by,check_in_at,check_out_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10::timestamptz) on conflict(student_id,attendance_date) do update set status=excluded.status,late_minutes=excluded.late_minutes,points_penalty=excluded.points_penalty,notes=excluded.notes,recorded_by=excluded.recorded_by,check_in_at=coalesce(excluded.check_in_at,attendance.check_in_at),check_out_at=coalesce(excluded.check_out_at,attendance.check_out_at) returning *`,
        [b.student_id,s.circle_id,recordDate,status,late,Number(b.points_penalty||0),b.notes||null,u.id,checkIn,checkOut]);
      return json(res,200,rows[0]);
    }
    return json(res,405,{error:'Method not allowed'});
  }catch(e){return handleError(res,e)}
}