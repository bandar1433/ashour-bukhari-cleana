import { query } from './_lib/db.js';
import { getActor,isStaff,validDate,validMonth,validUuid } from './_lib/actor.js';
import { handleError,json } from './_lib/http.js';

async function summary(req:any,res:any,u:any){
  if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
  if(!isStaff(u.role))return json(res,403,{error:'Forbidden',message:'ليست لديك صلاحية لعرض ملخص الإدارة.'});
  const row=(await query<any>(`
    select
      (select count(*) from centers)::text as centers,
      (select count(*) from circles)::text as circles,
      (select count(*) from students)::text as students,
      (select count(*) from users where role='teacher')::text as teachers,
      (select count(*) from users)::text as users,
      (select count(*) from users where is_active=true)::text as active_users,
      (select count(*) from attendance)::text as attendance,
      (select count(*) from memorization_records)::text as memorization,
      (select count(*) from weekly_plans)::text as plans,
      (select count(*) from news_events)::text as news
  `))[0];
  return json(res,200,{
    centers:+row.centers,circles:+row.circles,students:+row.students,teachers:+row.teachers,
    users:+row.users,activeUsers:+row.active_users,attendance:+row.attendance,
    memorization:+row.memorization,plans:+row.plans,news:+row.news
  });
}

async function teacherToday(req:any,res:any,u:any){
  if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
  if(!isStaff(u.role))return json(res,403,{error:'Forbidden',message:'ليست لديك صلاحية لهذه الشاشة.'});
  const d=validDate(req.query?.date)||new Date().toISOString().slice(0,10);
  const students=await query<any>(`
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
  const approvals=await query<any>(`
    select da.id,da.circle_id,da.approval_date,da.approved_at
    from day_approvals da join circles h on h.id=da.circle_id
    where da.approval_date=$4 and (
      $1='system_admin' or
      ($1 in ('center_manager','supervisor') and h.center_id=$2::uuid) or
      ($1='teacher' and h.teacher_user_id=$3::uuid)
    )
  `,[u.role,u.center_id,u.id,d]);
  return json(res,200,{date:d,students,approvals});
}

async function circleRegister(req:any,res:any,u:any){
  if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
  if(!isStaff(u.role))return json(res,403,{error:'Forbidden',message:'ليست لديك صلاحية لهذه الشاشة.'});
  const month=validMonth(req.query?.month)||new Date().toISOString().slice(0,7);
  const students=await query<any>(`
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
}

async function evaluations(req:any,res:any,u:any){
  if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
  const from=validDate(req.query?.from)||new Date().toISOString().slice(0,10);
  const to=validDate(req.query?.to)||from;
  const rows=await query<any>(`
    with days as (
      select s.id student_id,s.full_name,d::date day,(d::date-((extract(dow from d)::int+1)%7))::date week_start
      from students s cross join generate_series($4::date,$5::date,'1 day') d
      where (
        $1='system_admin' or
        ($1 in ('center_manager','supervisor') and s.center_id=$2::uuid) or
        ($1='teacher' and exists(select 1 from circles h where h.id=s.circle_id and h.teacher_user_id=$3::uuid)) or
        ($1='student' and s.user_id=$3::uuid)
      )
    ), plans as (
      select w.student_id,w.week_start,
        sum(case when w.new_target like 'صفحات مصحف المدينة:%' then greatest(0,(substring(w.new_target from '–([0-9]+)')::numeric)-(substring(w.new_target from ': ([0-9]+)')::numeric)+1) else 0 end)/6.0 new_daily_target,
        sum(case when w.review_target like 'صفحات مصحف المدينة:%' then greatest(0,(substring(w.review_target from '–([0-9]+)')::numeric)-(substring(w.review_target from ': ([0-9]+)')::numeric)+1) else 0 end)/6.0 review_daily_target
      from weekly_plans w group by w.student_id,w.week_start
    ), done as (
      select student_id,record_date,
        sum(case when record_type='new' then coalesce((substring(notes from '— ([0-9]+) صفحة'))::numeric,0) else 0 end) new_pages,
        sum(case when record_type='review' then coalesce((substring(notes from '— ([0-9]+) صفحة'))::numeric,0) else 0 end) review_pages
      from memorization_records where record_date between $4 and $5 group by student_id,record_date
    ), att as (
      select student_id,attendance_date,status,late_minutes,points_penalty from attendance where attendance_date between $4 and $5
    )
    select days.student_id,days.full_name,days.day,att.status,
      round(coalesce(done.new_pages,0),2) new_pages,round(coalesce(done.review_pages,0),2) review_pages,
      round(coalesce(plans.new_daily_target,0),2) new_daily_target,round(coalesce(plans.review_daily_target,0),2) review_daily_target,
      case when coalesce(plans.new_daily_target,0)>0 then least(100,round(100*coalesce(done.new_pages,0)/plans.new_daily_target))::int else 0 end new_grade,
      case when coalesce(plans.review_daily_target,0)>0 then least(100,round(100*coalesce(done.review_pages,0)/plans.review_daily_target))::int else 0 end review_grade,
      case when att.status='excused' then null when att.status='absent' then 0 when att.status in ('present','late') then greatest(0,least(30,30+coalesce(att.points_penalty,0))) else 0 end attendance_score,
      case when att.status='excused' then null else
        least(30,round(30*least(1,coalesce(done.new_pages,0)/nullif(plans.new_daily_target,0))))::int+
        least(40,round(40*least(1,coalesce(done.review_pages,0)/nullif(plans.review_daily_target,0))))::int+
        case when att.status='absent' then 0 when att.status in ('present','late') then greatest(0,least(30,30+coalesce(att.points_penalty,0))) else 0 end
      end daily_score
    from days left join plans on plans.student_id=days.student_id and plans.week_start=days.week_start
    left join done on done.student_id=days.student_id and done.record_date=days.day
    left join att on att.student_id=days.student_id and att.attendance_date=days.day
    order by days.day desc,days.full_name
  `,[u.role,u.center_id,u.id,from,to]);
  const scored=rows.filter((r:any)=>r.daily_score!==null);
  const average=scored.length?Math.round(scored.reduce((n:number,r:any)=>n+Number(r.daily_score),0)/scored.length):0;
  return json(res,200,{rows,weights:{new:30,review:40,attendance:30},formula:'الصفحات المنجزة ÷ المطلوب اليومي من الخطة الأسبوعية',average});
}

async function studentProfile(req:any,res:any,u:any){
  if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
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
    query<any>(`select count(*)::int total,count(*) filter(where status in ('present','late'))::int attended,count(*) filter(where status='absent')::int absent,count(*) filter(where status='late')::int late from attendance where student_id=$1 and to_char(attendance_date,'YYYY-MM')=$2`,[s.id,month]),
    query<any>(`select count(*) filter(where record_type='new')::int new_sessions,count(*) filter(where record_type='review')::int review_sessions,count(*) filter(where record_type='recitation')::int recitation_sessions,coalesce(sum(ayah_count) filter(where record_type='new'),0)::int new_ayahs,coalesce(sum(ayah_count) filter(where record_type='review'),0)::int review_ayahs,coalesce(round(avg(grade))::int,0) average_grade from memorization_records where student_id=$1 and to_char(record_date,'YYYY-MM')=$2`,[s.id,month]),
    query<any>(`select * from weekly_plans where student_id=$1 order by week_start desc,id desc limit 14`,[s.id]),
    query<any>(`select created_at,points,reason from points_ledger where student_id=$1 order by created_at desc limit 30`,[s.id]),
    query<any>(`select d.day::date record_date,a.status,a.late_minutes,a.points_penalty,a.check_in_at,a.check_out_at,exists(select 1 from day_approvals da where da.circle_id=s.circle_id and da.approval_date=d.day) approved from students s cross join generate_series(($2||'-01')::date,(($2||'-01')::date+interval '1 month-1 day')::date,interval '1 day') d(day) left join attendance a on a.student_id=s.id and a.attendance_date=d.day where s.id=$1 order by d.day`,[s.id,month]),
    query<any>(`select record_date,record_type,surah_no,from_ayah,to_ayah,from_page,to_page,grade,notes from memorization_records where student_id=$1 order by record_date desc,created_at desc limit 60`,[s.id])
  ]);
  return json(res,200,{student:s,month,attendance:attendance[0]||{},quran:quran[0]||{},plans,points,monthly,recent});
}

async function dayApprove(req:any,res:any,u:any){
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
  if(!isStaff(u.role))return json(res,403,{error:'Forbidden',message:'ليست لديك صلاحية لاعتماد اليوم.'});
  const b=req.body||{}; const circleId=validUuid(b.circle_id); const d=validDate(b.approval_date);
  if(!circleId||!d)return json(res,400,{error:'بيانات الاعتماد غير مكتملة'});
  const allowed=(await query<any>(`select id from circles where id=$1 and ($2='system_admin' or ($2 in ('center_manager','supervisor') and center_id=$3::uuid) or ($2='teacher' and teacher_user_id=$4::uuid))`,[circleId,u.role,u.center_id,u.id]))[0];
  if(!allowed)return json(res,403,{error:'Forbidden',message:'الحلقة خارج نطاق صلاحيتك.'});
  const row=(await query<any>(`insert into day_approvals(circle_id,approval_date,approved_by) values($1,$2,$3) on conflict(circle_id,approval_date) do update set approved_by=excluded.approved_by,approved_at=now() returning *`,[circleId,d,u.id]))[0];
  return json(res,200,row);
}

export default async function handler(req:any,res:any){
  try{
    const u=await getActor(req,res); if(!u)return;
    const action=String(req.query?.action||'');
    if(action==='summary')return summary(req,res,u);
    if(action==='teacher-today')return teacherToday(req,res,u);
    if(action==='circle-register')return circleRegister(req,res,u);
    if(action==='evaluations')return evaluations(req,res,u);
    if(action==='student-profile')return studentProfile(req,res,u);
    if(action==='day-approve')return dayApprove(req,res,u);
    return json(res,404,{error:'Unknown operation'});
  }catch(e){return handleError(res,e)}
}
