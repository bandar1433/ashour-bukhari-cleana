import { query } from '../_lib/db.js';
import { isStaff,validDate,validMonth,validUuid } from '../_lib/actor.js';
import { json } from '../_lib/http.js';
import { scopedStudent,today } from './shared.js';

const targetPages=(v:any)=>{const s=String(v||'').trim();if(/^\d+(?:\.\d+)?$/.test(s))return Number(s);const pref=s.match(/^(\d+(?:\.\d+)?)\s*\|/);if(pref)return Number(pref[1]);const m=s.match(/(\d+)\D+(\d+)\s*$/);return m?Math.max(0,Number(m[2])-Number(m[1])+1):0};
function scoreDay(r:any){
  const reviewTarget=targetPages(r.review_target),newTarget=targetPages(r.new_target);
  const reviewDone=Number(r.review?.page_count||0),newDone=Number(r.new_record?.page_count||0);
  const hasPlan=reviewTarget>0||newTarget>0;
  const attendanceScore=r.status==='excused'?null:r.status==='absent'?0:r.status?Number(r.late_minutes||0)<=30?30:Number(r.late_minutes||0)<=60?20:10:0;
  const reviewScore=reviewTarget>0?Math.min(40,Math.round(40*reviewDone/reviewTarget)):40;
  const newScore=newTarget>0?Math.min(30,Math.round(30*newDone/newTarget)):30;
  const totalTarget=reviewTarget+newTarget,totalDone=reviewDone+newDone;
  return {...r,review_target_pages:reviewTarget,new_target_pages:newTarget,review_done:reviewDone,new_done:newDone,
    review_remaining:Math.max(0,reviewTarget-reviewDone),new_remaining:Math.max(0,newTarget-newDone),
    progress:totalTarget>0?Math.min(100,Math.round(100*totalDone/totalTarget)):null,
    attendance_score:attendanceScore,review_score:reviewScore,new_score:newScore,
    daily_score:!hasPlan||attendanceScore===null?null:attendanceScore+reviewScore+newScore};
}
async function studentDayRows(studentId:string,circleId:string|null,from:string,to:string){
  const rows=await query<any>(`with days as (
    select g.day::date record_date,
      (g.day::date-((extract(dow from g.day)::int+1)%7))::date week_start,
      case extract(dow from g.day)::int when 6 then 'السبت' when 0 then 'الأحد' when 1 then 'الاثنين' when 2 then 'الثلاثاء' when 3 then 'الأربعاء' when 4 then 'الخميس' else 'الجمعة' end day_name
    from generate_series($2::date,$3::date,'1 day') g(day) where extract(dow from g.day)<>5
  )
  select d.record_date,d.week_start,d.day_name,a.status,a.late_minutes,a.check_in_at,a.check_out_at,
    exists(select 1 from day_approvals da where da.circle_id=$4::uuid and da.approval_date=d.record_date) approved,
    exists(select 1 from weekly_locks wl where wl.circle_id=$4::uuid and wl.week_start=d.week_start) week_locked,
    w.new_target,w.review_target,w.goals,
    (select json_build_object('id',m.id,'surah_no',m.surah_no,'to_surah_no',coalesce(m.to_surah_no,m.surah_no),'from_ayah',m.from_ayah,'to_ayah',m.to_ayah,'from_page',m.from_page,'to_page',m.to_page,'page_count',m.page_count)
      from memorization_records m where m.student_id=$1 and m.record_date=d.record_date and m.record_type='review' order by m.created_at desc limit 1) review,
    (select json_build_object('id',m.id,'surah_no',m.surah_no,'to_surah_no',coalesce(m.to_surah_no,m.surah_no),'from_ayah',m.from_ayah,'to_ayah',m.to_ayah,'from_page',m.from_page,'to_page',m.to_page,'page_count',m.page_count)
      from memorization_records m where m.student_id=$1 and m.record_date=d.record_date and m.record_type='new' order by m.created_at desc limit 1) new_record
  from days d
  left join attendance a on a.student_id=$1 and a.attendance_date=d.record_date
  left join weekly_plans w on w.student_id=$1 and w.week_start=d.week_start and w.day_name=d.day_name
  order by d.record_date`,[studentId,from,to,circleId]);
  return rows.map(scoreDay);
}


export async function summary(req:any,res:any,u:any){
  if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
  if(!isStaff(u.role))return json(res,403,{error:'Forbidden',message:'ليست لديك صلاحية لعرض ملخص الإدارة.'});

  const row=(await query<any>(`
    with scoped_circles as (
      select c.*
      from circles c
      where $1='system_admin'
         or ($1 in ('center_manager','supervisor') and c.center_id=$2::uuid)
         or ($1='teacher' and c.teacher_user_id=$3::uuid)
    ),
    scoped_students as (
      select s.*
      from students s
      where $1='system_admin'
         or ($1 in ('center_manager','supervisor') and s.center_id=$2::uuid)
         or ($1='teacher' and exists(select 1 from scoped_circles c where c.id=s.circle_id))
    ),
    active_students as (
      select * from scoped_students where status='active'
    ),
    scoped_users as (
      select x.*
      from users x
      where $1='system_admin'
         or ($1 in ('center_manager','supervisor') and x.center_id=$2::uuid)
         or ($1='teacher' and x.id=$3::uuid)
    ),
    today_attendance as (
      select a.*
      from attendance a
      join active_students s on s.id=a.student_id
      where a.attendance_date=current_date
    ),
    today_memorization as (
      select m.*
      from memorization_records m
      join active_students s on s.id=m.student_id
      where m.record_date=current_date
    ),
    current_plans as (
      select w.*
      from weekly_plans w
      join active_students s on s.id=w.student_id
      where w.week_start=(current_date-((extract(dow from current_date)::int+1)%7))::date
    )
    select
      case
        when $1='system_admin' then 'جميع المراكز'
        when $1 in ('center_manager','supervisor') then coalesce((select name from centers where id=$2::uuid),'المركز')
        else coalesce((select string_agg(name,'، ' order by name) from scoped_circles),'حلقتي')
      end scope_label,
      case when $1='system_admin'
        then (select count(*) from centers)
        else (select count(distinct center_id) from scoped_circles)
      end::int centers,
      (select count(*) from scoped_circles)::int circles,
      (select count(*) from scoped_circles where is_active)::int active_circles,
      (select count(*) from scoped_students)::int students,
      (select count(*) from active_students)::int active_students,
      case
        when $1='teacher' then 1
        else (select count(*) from scoped_users where role='teacher')
      end::int teachers,
      (select count(*) from scoped_users where role='supervisor')::int supervisors,
      (select count(*) from scoped_users where role='center_manager')::int center_managers,
      (select count(*) from scoped_users)::int users,
      (select count(*) from scoped_users where is_active)::int active_users,
      (select count(*) from attendance a join scoped_students s on s.id=a.student_id)::int attendance,
      (select count(*) from memorization_records m join scoped_students s on s.id=m.student_id)::int memorization,
      (select count(*) from weekly_plans w join scoped_students s on s.id=w.student_id)::int plans,
      case when $1='system_admin' then (select count(*) from news_events) else 0 end::int news,
      (select count(*) from today_attendance)::int attendance_today,
      (select count(*) from today_attendance where status in ('present','late'))::int present_today,
      (select count(*) from today_attendance where status='absent')::int absent_today,
      (select count(*) from today_attendance where status='late' or coalesce(late_minutes,0)>0)::int late_today,
      (select count(*) from active_students)-(select count(distinct student_id) from today_attendance)::int unrecorded_attendance_today,
      case when (select count(*) from active_students)>0
        then round(100.0*(select count(*) from today_attendance where status in ('present','late'))/(select count(*) from active_students))::int
        else 0
      end attendance_rate,
      coalesce((select sum(coalesce(page_count,0)) from today_memorization),0)::int quran_pages_today,
      (select count(distinct student_id) from today_memorization)::int memorization_students_today,
      (select count(distinct student_id) from current_plans)::int planned_students_this_week,
      case when (select count(*) from active_students)>0
        then round(100.0*(select count(distinct student_id) from current_plans)/(select count(*) from active_students))::int
        else 0
      end plan_coverage,
      case
        when $1='system_admin' then (select count(*) from login_requests where status='pending')
        when $1 in ('center_manager','supervisor') then (select count(*) from login_requests where status='pending' and center_id=$2::uuid)
        else 0
      end::int pending_requests,
      (select count(*) from circle_join_requests r where r.status='pending' and exists(select 1 from scoped_circles c where c.id=r.circle_id))::int pending_join_requests,
      (select count(*) from scoped_circles where is_active and teacher_user_id is null)::int unassigned_circles,
      (select count(*) from scoped_students where circle_id is null)::int unassigned_students,
      (select count(*) from scoped_users where not is_active)::int inactive_users,
      (select count(*) from scoped_users su where su.role='teacher' and su.is_active and not exists(select 1 from scoped_circles c where c.teacher_user_id=su.id))::int teachers_without_circle,
      (select count(*) from day_approvals da where da.approval_date=current_date and exists(select 1 from scoped_circles c where c.id=da.circle_id))::int approved_circles_today
  `,[u.role,u.center_id,u.id]))[0];

  const result={
    role:u.role,
    scopeLabel:row.scope_label,
    centers:Number(row.centers||0),
    circles:Number(row.circles||0),
    activeCircles:Number(row.active_circles||0),
    students:Number(row.students||0),
    activeStudents:Number(row.active_students||0),
    teachers:Number(row.teachers||0),
    supervisors:Number(row.supervisors||0),
    centerManagers:Number(row.center_managers||0),
    users:Number(row.users||0),
    activeUsers:Number(row.active_users||0),
    attendance:Number(row.attendance||0),
    memorization:Number(row.memorization||0),
    plans:Number(row.plans||0),
    news:Number(row.news||0),
    attendanceToday:Number(row.attendance_today||0),
    presentToday:Number(row.present_today||0),
    absentToday:Number(row.absent_today||0),
    lateToday:Number(row.late_today||0),
    unrecordedAttendanceToday:Math.max(0,Number(row.unrecorded_attendance_today||0)),
    attendanceRate:Number(row.attendance_rate||0),
    quranPagesToday:Number(row.quran_pages_today||0),
    memorizationStudentsToday:Number(row.memorization_students_today||0),
    plannedStudentsThisWeek:Number(row.planned_students_this_week||0),
    planCoverage:Number(row.plan_coverage||0),
    pendingRequests:Number(row.pending_requests||0),
    pendingJoinRequests:Number(row.pending_join_requests||0),
    unassignedCircles:Number(row.unassigned_circles||0),
    unassignedStudents:Number(row.unassigned_students||0),
    inactiveUsers:Number(row.inactive_users||0),
    teachersWithoutCircle:Number(row.teachers_without_circle||0),
    approvedCirclesToday:Number(row.approved_circles_today||0),
  };
  return json(res,200,result);
}

export async function teacherToday(req:any,res:any,u:any){
  if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
  if(!isStaff(u.role))return json(res,403,{error:'Forbidden',message:'ليست لديك صلاحية لهذه الشاشة.'});
  const d=validDate(req.query?.date)||today();
  const students=await query<any>(`select s.id,s.full_name,h.id circle_id,h.name circle_name,a.status attendance_status,a.late_minutes,a.check_in_at,a.check_out_at,
    (select json_build_object('id',m.id,'surah_no',m.surah_no,'from_ayah',m.from_ayah,'to_surah_no',coalesce(m.to_surah_no,m.surah_no),'to_ayah',m.to_ayah,'from_page',m.from_page,'to_page',m.to_page,'page_count',m.page_count,'grade',m.grade) from memorization_records m where m.student_id=s.id and m.record_date=$4 and m.record_type='new' order by m.created_at desc limit 1) new_record,
    (select json_build_object('id',m.id,'surah_no',m.surah_no,'from_ayah',m.from_ayah,'to_surah_no',coalesce(m.to_surah_no,m.surah_no),'to_ayah',m.to_ayah,'from_page',m.from_page,'to_page',m.to_page,'page_count',m.page_count,'grade',m.grade) from memorization_records m where m.student_id=s.id and m.record_date=$4 and m.record_type='review' order by m.created_at desc limit 1) review_record,
    coalesce((select count(*) from memorization_records m where m.student_id=s.id and m.record_date=$4 and m.record_type='new'),0)::int new_records,
    coalesce((select count(*) from memorization_records m where m.student_id=s.id and m.record_date=$4 and m.record_type='review'),0)::int review_records,
    coalesce((select round(avg(m.grade))::int from memorization_records m where m.student_id=s.id and m.record_date=$4),0)::int grade
    from students s join circles h on h.id=s.circle_id left join attendance a on a.student_id=s.id and a.attendance_date=$4
    where s.status='active' and ($1='system_admin' or ($1 in ('center_manager','supervisor') and s.center_id=$2::uuid) or ($1='teacher' and h.teacher_user_id=$3::uuid))
    order by h.name,s.full_name`,[u.role,u.center_id,u.id,d]);
  const dayNames=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  const dateObj=new Date(d+'T00:00:00Z'),dayName=dayNames[dateObj.getUTCDay()],offset=(dateObj.getUTCDay()+1)%7;
  const weekDate=new Date(dateObj);weekDate.setUTCDate(weekDate.getUTCDate()-offset);const weekStart=weekDate.toISOString().slice(0,10);
  const ids=students.map((x:any)=>x.id);
  const planRows=ids.length?await query<any>('select student_id,new_target,review_target,goals from weekly_plans where student_id=any($1::uuid[]) and week_start=$2::date and day_name=$3 order by created_at desc',[ids,weekStart,dayName]):[];
  const planMap=new Map<string,any>();for(const p of planRows)if(!planMap.has(p.student_id))planMap.set(p.student_id,p);
  const isFriday=dateObj.getUTCDay()===5;
  const scoredStudents=students.map((r:any)=>{const p=planMap.get(r.id)||{},reviewTarget=targetPages(p.review_target),newTarget=targetPages(p.new_target),reviewDone=Number(r.review_record?.page_count||0),newDone=Number(r.new_record?.page_count||0);
    const attendanceScore=isFriday?null:r.attendance_status==='excused'?null:r.attendance_status==='absent'?0:r.attendance_status?Number(r.late_minutes||0)<=30?30:Number(r.late_minutes||0)<=60?20:10:0;
    const reviewScore=reviewTarget>0?Math.min(40,Math.round(40*reviewDone/reviewTarget)):40;
    const newScore=newTarget>0?Math.min(30,Math.round(30*newDone/newTarget)):30;
    return {...r,review_target:p.review_target||'',new_target:p.new_target||'',goals:p.goals||'',attendance_score:attendanceScore,review_score:reviewScore,new_score:newScore,daily_score:attendanceScore===null?null:attendanceScore+reviewScore+newScore};
  });
  const approvals=await query<any>(`select da.id,da.circle_id,da.approval_date,da.approved_at from day_approvals da join circles h on h.id=da.circle_id
    where da.approval_date=$4 and ($1='system_admin' or ($1 in ('center_manager','supervisor') and h.center_id=$2::uuid) or ($1='teacher' and h.teacher_user_id=$3::uuid))`,
    [u.role,u.center_id,u.id,d]);
  return json(res,200,{date:d,students:scoredStudents,approvals});
}

export async function circleRegister(req:any,res:any,u:any){
  if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
  if(!isStaff(u.role))return json(res,403,{error:'Forbidden',message:'ليست لديك صلاحية لهذه الشاشة.'});
  const month=validMonth(req.query?.month)||today().slice(0,7);
  const students=await query<any>(`select s.id,s.full_name,h.id circle_id,h.name circle_name,
    coalesce(json_agg(json_build_object('date',d.day,
    'approved',exists(select 1 from day_approvals da where da.circle_id=h.id and da.approval_date=d.day),
    'week_locked',exists(select 1 from weekly_locks wl where wl.circle_id=h.id and wl.week_start=(d.day::date-((extract(dow from d.day)::int+1)%7))::date),
    'status',a.status,'late_minutes',coalesce(a.late_minutes,0),'check_in_at',a.check_in_at,'check_out_at',a.check_out_at,
    'review_target',(select w.review_target from weekly_plans w where w.student_id=s.id and w.week_start=(d.day::date-((extract(dow from d.day)::int+1)%7))::date and w.day_name=case extract(dow from d.day)::int when 6 then 'السبت' when 0 then 'الأحد' when 1 then 'الاثنين' when 2 then 'الثلاثاء' when 3 then 'الأربعاء' when 4 then 'الخميس' else 'الجمعة' end order by w.created_at desc limit 1),
    'new_target',(select w.new_target from weekly_plans w where w.student_id=s.id and w.week_start=(d.day::date-((extract(dow from d.day)::int+1)%7))::date and w.day_name=case extract(dow from d.day)::int when 6 then 'السبت' when 0 then 'الأحد' when 1 then 'الاثنين' when 2 then 'الثلاثاء' when 3 then 'الأربعاء' when 4 then 'الخميس' else 'الجمعة' end order by w.created_at desc limit 1),
    'review',(select json_build_object('id',m.id,'surah_no',m.surah_no,'to_surah_no',coalesce(m.to_surah_no,m.surah_no),'from_ayah',m.from_ayah,'to_ayah',m.to_ayah,'from_page',m.from_page,'to_page',m.to_page,'pages',m.page_count) from memorization_records m where m.student_id=s.id and m.record_date=d.day and m.record_type='review' order by m.created_at desc limit 1),
    'new',(select json_build_object('id',m.id,'surah_no',m.surah_no,'to_surah_no',coalesce(m.to_surah_no,m.surah_no),'from_ayah',m.from_ayah,'to_ayah',m.to_ayah,'from_page',m.from_page,'to_page',m.to_page,'pages',m.page_count) from memorization_records m where m.student_id=s.id and m.record_date=d.day and m.record_type='new' order by m.created_at desc limit 1))
    order by d.day),'[]'::json) days
    from students s join circles h on h.id=s.circle_id cross join generate_series(($4||'-01')::date,(($4||'-01')::date+interval '1 month' - interval '1 day')::date,interval '1 day') d(day)
    left join attendance a on a.student_id=s.id and a.attendance_date=d.day where s.status='active' and extract(dow from d.day)<>5 and
    ($1='system_admin' or ($1 in ('center_manager','supervisor') and s.center_id=$2::uuid) or ($1='teacher' and h.teacher_user_id=$3::uuid))
    group by s.id,s.full_name,h.id,h.name order by h.name,s.full_name`,[u.role,u.center_id,u.id,month]);
  return json(res,200,{month,students});
}

export async function evaluations(req:any,res:any,u:any){
  if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
  const from=validDate(req.query?.from)||today(),to=validDate(req.query?.to)||from;
  const rows=await query<any>(`with days as (
    select s.id student_id,s.full_name,d::date record_day,(d::date-((extract(dow from d)::int+1)%7))::date week_start,
      case extract(dow from d)::int when 6 then 'السبت' when 0 then 'الأحد' when 1 then 'الاثنين' when 2 then 'الثلاثاء' when 3 then 'الأربعاء' when 4 then 'الخميس' else 'الجمعة' end day_name
    from students s cross join generate_series($4::date,$5::date,'1 day') d where extract(dow from d)<>5 and
    ($1='system_admin' or ($1 in ('center_manager','supervisor') and s.center_id=$2::uuid) or ($1='teacher' and exists(select 1 from circles h where h.id=s.circle_id and h.teacher_user_id=$3::uuid)) or ($1='student' and s.user_id=$3::uuid))
  ), plan as (
    select d.student_id,d.record_day,
      case when coalesce(w.new_target,'')~'^\\d+(\\.\\d+)?\\s*\\|' then trim(split_part(w.new_target,'|',1))::numeric when coalesce(w.new_target,'')~'^\\d+(\\.\\d+)?$' then w.new_target::numeric else 0 end new_target,
      case when coalesce(w.review_target,'')~'^\\d+(\\.\\d+)?\\s*\\|' then trim(split_part(w.review_target,'|',1))::numeric when coalesce(w.review_target,'')~'^\\d+(\\.\\d+)?$' then w.review_target::numeric else 0 end review_target
    from days d left join weekly_plans w on w.student_id=d.student_id and w.week_start=d.week_start and w.day_name=d.day_name
  ), done as (
    select student_id,record_date,sum(case when record_type='new' then coalesce(page_count,0) else 0 end)::numeric new_pages,
      sum(case when record_type='review' then coalesce(page_count,0) else 0 end)::numeric review_pages
    from memorization_records where record_date between $4 and $5 group by student_id,record_date
  )
  select d.student_id,d.full_name,d.record_day as record_date,a.status,coalesce(done.new_pages,0) new_pages,coalesce(done.review_pages,0) review_pages,
    coalesce(p.new_target,0) new_daily_target,coalesce(p.review_target,0) review_daily_target,
    case when coalesce(p.new_target,0)>0 then least(30,round(30*coalesce(done.new_pages,0)/p.new_target))::int else 30 end new_grade,
    case when coalesce(p.review_target,0)>0 then least(40,round(40*coalesce(done.review_pages,0)/p.review_target))::int else 40 end review_grade,
    case when a.status='excused' then null when a.status='absent' then 0 when a.status in ('present','late') and coalesce(a.late_minutes,0)<=30 then 30 when a.status in ('present','late') and coalesce(a.late_minutes,0)<=60 then 20 when a.status in ('present','late') then 10 else 0 end attendance_score
  from days d left join plan p on p.student_id=d.student_id and p.record_day=d.record_day left join done on done.student_id=d.student_id and done.record_date=d.record_day
  left join attendance a on a.student_id=d.student_id and a.attendance_date=d.record_day order by d.record_day desc,d.full_name`,[u.role,u.center_id,u.id,from,to]);
  const enriched=rows.map((r:any)=>({...r,daily_score:r.attendance_score===null?null:Number(r.new_grade)+Number(r.review_grade)+Number(r.attendance_score)}));
  const scored=enriched.filter((r:any)=>r.daily_score!==null);
  return json(res,200,{rows:enriched,weights:{new:30,review:40,attendance:30},formula:'الحفظ الجديد 30 + المراجعة 40 + الحضور 30',average:scored.length?Math.round(scored.reduce((n:number,r:any)=>n+Number(r.daily_score),0)/scored.length):0});
}

export async function studentProfile(req:any,res:any,u:any){
  if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
  const raw=String(req.query?.id||''); let s:any;
  if(raw==='me') s=(await query<any>(`select s.*,c.name center_name,h.name circle_name from students s left join centers c on c.id=s.center_id left join circles h on h.id=s.circle_id where s.user_id=$1 limit 1`,[u.id]))[0];
  else {
    const sid=validUuid(raw); if(!sid)return json(res,400,{error:'معرف الطالب غير صالح'});
    s=await scopedStudent(u,sid);
    if(s){const names=(await query<any>(`select c.name center_name,h.name circle_name from students s left join centers c on c.id=s.center_id left join circles h on h.id=s.circle_id where s.id=$1`,[s.id]))[0];s={...s,...names}}
  }
  if(!s)return json(res,404,{error:'الطالب غير موجود أو خارج نطاق صلاحيتك'});
  const month=validMonth(req.query?.month)||today().slice(0,7),monthStart=month+'-01';
  const monthDate=new Date(monthStart+'T00:00:00Z'),monthEndDate=new Date(Date.UTC(monthDate.getUTCFullYear(),monthDate.getUTCMonth()+1,0)),monthEnd=monthEndDate.toISOString().slice(0,10);
  const current=today(),currentDate=new Date(current+'T00:00:00Z'),offset=(currentDate.getUTCDay()+1)%7,weekStartDate=new Date(currentDate);weekStartDate.setUTCDate(weekStartDate.getUTCDate()-offset);
  const weekEndDate=new Date(weekStartDate);weekEndDate.setUTCDate(weekEndDate.getUTCDate()+5);const weekStart=weekStartDate.toISOString().slice(0,10),weekEnd=weekEndDate.toISOString().slice(0,10);
  const [attendance,quran,plans,points,monthly,recent,weekly]=await Promise.all([
    query<any>(`select count(*)::int total,count(*) filter(where status in ('present','late'))::int attended,count(*) filter(where status='absent')::int absent,count(*) filter(where status='late')::int late from attendance where student_id=$1 and to_char(attendance_date,'YYYY-MM')=$2`,[s.id,month]),
    query<any>(`select count(*) filter(where record_type='new')::int new_sessions,count(*) filter(where record_type='review')::int review_sessions,coalesce(sum(ayah_count) filter(where record_type='new'),0)::int new_ayahs,coalesce(sum(ayah_count) filter(where record_type='review'),0)::int review_ayahs,coalesce(round(avg(grade))::int,0) average_grade from memorization_records where student_id=$1 and to_char(record_date,'YYYY-MM')=$2`,[s.id,month]),
    query<any>(`select * from weekly_plans where student_id=$1 order by week_start desc,id desc limit 42`,[s.id]),
    query<any>(`select created_at,points,reason from points_ledger where student_id=$1 order by created_at desc limit 30`,[s.id]),
    studentDayRows(s.id,s.circle_id,monthStart,monthEnd),
    query<any>(`select record_date,record_type,surah_no,to_surah_no,from_ayah,to_ayah,from_page,to_page,page_count,grade,notes from memorization_records where student_id=$1 order by record_date desc,created_at desc limit 60`,[s.id]),
    studentDayRows(s.id,s.circle_id,weekStart,weekEnd)
  ]);
  return json(res,200,{student:s,month,today:current,week_start:weekStart,week_end:weekEnd,attendance:attendance[0]||{},quran:quran[0]||{},plans,points,monthly,recent,weekly});
}

export async function dayApprove(req:any,res:any,u:any){
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
  if(!isStaff(u.role))return json(res,403,{error:'Forbidden',message:'ليست لديك صلاحية لاعتماد اليوم.'});
  const b=req.body||{},circleId=validUuid(b.circle_id),d=validDate(b.approval_date);
  if(!circleId||!d)return json(res,400,{error:'بيانات الاعتماد غير مكتملة'});
  const allowed=(await query<any>(`select id from circles where id=$1 and ($2='system_admin' or ($2 in ('center_manager','supervisor') and center_id=$3::uuid) or ($2='teacher' and teacher_user_id=$4::uuid))`,[circleId,u.role,u.center_id,u.id]))[0];
  if(!allowed)return json(res,403,{error:'Forbidden',message:'الحلقة خارج نطاق صلاحيتك.'});
  const row=(await query<any>(`insert into day_approvals(circle_id,approval_date,approved_by) values($1,$2,$3) on conflict(circle_id,approval_date) do update set approved_by=excluded.approved_by,approved_at=now() returning *`,[circleId,d,u.id]))[0];
  return json(res,200,row);
}
