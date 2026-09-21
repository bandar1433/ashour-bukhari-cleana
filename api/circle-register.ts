import { query } from './_lib/db.js';
import { getActor,isStaff,validMonth } from './_lib/actor.js';
import { handleError,json } from './_lib/http.js';

export default async function handler(req:any,res:any){
  if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
  try{
    const u=await getActor(req,res); if(!u)return;
    if(!isStaff(u.role))return json(res,403,{error:'Forbidden',message:'ليست لديك صلاحية لهذه الشاشة.'});
    const month=validMonth(req.query?.month)||new Date().toISOString().slice(0,7);
    const students=await query(`
      select s.id,s.full_name,h.id circle_id,h.name circle_name,
      coalesce(json_agg(json_build_object(
        'date',d.day,
        'approved',exists(select 1 from day_approvals da where da.circle_id=h.id and da.approval_date=d.day),
        'status',a.status,'late_minutes',coalesce(a.late_minutes,0),
        'check_in_at',a.check_in_at,'check_out_at',a.check_out_at,
        'review',(select json_build_object('surah_no',m.surah_no,'from_ayah',m.from_ayah,'to_ayah',m.to_ayah,'grade',m.grade) from memorization_records m where m.student_id=s.id and m.record_date=d.day and m.record_type='review' order by m.created_at desc limit 1),
        'new',(select json_build_object('surah_no',m.surah_no,'from_ayah',m.from_ayah,'to_ayah',m.to_ayah,'grade',m.grade) from memorization_records m where m.student_id=s.id and m.record_date=d.day and m.record_type='new' order by m.created_at desc limit 1)
      ) order by d.day) filter(where a.id is not null or exists(select 1 from memorization_records mm where mm.student_id=s.id and mm.record_date=d.day)),'[]'::json) days
      from students s join circles h on h.id=s.circle_id
      cross join generate_series(($4||'-01')::date,(($4||'-01')::date+interval '1 month-1 day')::date,interval '1 day') d(day)
      left join attendance a on a.student_id=s.id and a.attendance_date=d.day
      where s.status='active' and (
        $1='system_admin' or
        ($1 in ('center_manager','supervisor') and s.center_id=$2::uuid) or
        ($1='teacher' and h.teacher_user_id=$3::uuid)
      )
      group by s.id,s.full_name,h.id,h.name order by h.name,s.full_name
    `,[u.role,u.center_id,u.id,month]);
    return json(res,200,{month,students});
  }catch(e){return handleError(res,e)}
}
