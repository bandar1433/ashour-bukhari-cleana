import { query } from '../_lib/db.js';
import { getActor,validMonth,validUuid } from '../_lib/actor.js';
import { handleError,json } from '../_lib/http.js';

export default async function handler(req:any,res:any){
  if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
  try{
    const u=await getActor(req,res); if(!u)return;
    const raw=String(req.query?.id||'');
    let s:any;
    if(raw==='me'){
      s=(await query<any>(`select s.*,c.name center_name,h.name circle_name from students s left join centers c on c.id=s.center_id left join circles h on h.id=s.circle_id where s.user_id=$1 limit 1`,[u.id]))[0];
    }else{
      const studentId=validUuid(raw); if(!studentId)return json(res,400,{error:'معرف الطالب غير صالح'});
      s=(await query<any>(`
        select s.*,c.name center_name,h.name circle_name
        from students s left join centers c on c.id=s.center_id left join circles h on h.id=s.circle_id
        where s.id=$4 and (
          $1='system_admin' or
          ($1 in ('center_manager','supervisor') and s.center_id=$2::uuid) or
          ($1='teacher' and exists(select 1 from circles x where x.id=s.circle_id and x.teacher_user_id=$3::uuid)) or
          ($1='student' and s.user_id=$3::uuid)
        ) limit 1
      `,[u.role,u.center_id,u.id,studentId]))[0];
    }
    if(!s)return json(res,404,{error:'الطالب غير موجود أو خارج نطاق صلاحيتك'});
    const month=validMonth(req.query?.month)||new Date().toISOString().slice(0,7);
    const [attendance,quran,plans,points,monthly,recent]=await Promise.all([
      query(`select count(*)::int total,count(*) filter(where status in ('present','late'))::int attended,count(*) filter(where status='absent')::int absent,count(*) filter(where status='late')::int late from attendance where student_id=$1 and to_char(attendance_date,'YYYY-MM')=$2`,[s.id,month]),
      query(`select count(*) filter(where record_type='new')::int new_sessions,count(*) filter(where record_type='review')::int review_sessions,count(*) filter(where record_type='recitation')::int recitation_sessions,coalesce(sum(ayah_count) filter(where record_type='new'),0)::int new_ayahs,coalesce(sum(ayah_count) filter(where record_type='review'),0)::int review_ayahs,coalesce(round(avg(grade))::int,0) average_grade from memorization_records where student_id=$1 and to_char(record_date,'YYYY-MM')=$2`,[s.id,month]),
      query(`select * from weekly_plans where student_id=$1 order by week_start desc,id desc limit 14`,[s.id]),
      query(`select created_at,points,reason from points_ledger where student_id=$1 order by created_at desc limit 30`,[s.id]),
      query(`select d.day::date record_date,a.status,a.late_minutes,a.points_penalty,a.check_in_at,a.check_out_at,exists(select 1 from day_approvals da where da.circle_id=s.circle_id and da.approval_date=d.day) approved from students s cross join generate_series(($2||'-01')::date,(($2||'-01')::date+interval '1 month-1 day')::date,interval '1 day') d(day) left join attendance a on a.student_id=s.id and a.attendance_date=d.day where s.id=$1 order by d.day`,[s.id,month]),
      query(`select record_date,record_type,surah_no,from_ayah,to_ayah,from_page,to_page,grade,notes from memorization_records where student_id=$1 order by record_date desc,created_at desc limit 60`,[s.id])
    ]);
    return json(res,200,{student:s,month,attendance:attendance[0]||{},quran:quran[0]||{},plans,points,monthly,recent});
  }catch(e){return handleError(res,e)}
}
