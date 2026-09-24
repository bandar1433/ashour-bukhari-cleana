import { query } from '../_lib/db.js';
import { isStaff,validDate,validMonth,validUuid } from '../_lib/actor.js';
import { json } from '../_lib/http.js';
import { scopedStudent,today } from './shared.js';
import { operationalDay } from '../_lib/operationalDay.js';
import {attendanceScore, getOperationalSettings, progressScore} from '../_lib/operationalSettings.js';

export async function summary(req:any,res:any,u:any){
  if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
  if(!isStaff(u.role))return json(res,403,{error:'Forbidden',message:'ليست لديك صلاحية لعرض ملخص الإدارة.'});
  const row=(await query<any>(`select
    (select count(*) from centers)::text centers,(select count(*) from circles)::text circles,
    (select count(*) from students)::text students,(select count(*) from users where role='teacher')::text teachers,
    (select count(*) from users)::text users,(select count(*) from users where is_active)::text active_users,
    (select count(*) from attendance)::text attendance,(select count(*) from memorization_records)::text memorization,
    (select count(*) from weekly_plans)::text plans,(select count(*) from news_events)::text news`))[0];
  return json(res,200,{centers:+row.centers,circles:+row.circles,students:+row.students,teachers:+row.teachers,
    users:+row.users,activeUsers:+row.active_users,attendance:+row.attendance,memorization:+row.memorization,plans:+row.plans,news:+row.news});
}

export async function teacherToday(req:any,res:any,u:any){
  if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
  if(!isStaff(u.role))return json(res,403,{error:'Forbidden',message:'ليست لديك صلاحية لهذه الشاشة.'});
  const d=validDate(req.query?.date)||today();
  const settings=await getOperationalSettings();
  const students=await query<any>(`select s.id,s.full_name,s.center_id,h.id circle_id,h.name circle_name,a.status attendance_status,a.late_minutes,a.check_in_at,a.check_out_at,
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
  const targetPages=(v:any)=>{const s=String(v||'').trim();if(/^\\d+(?:\\.\\d+)?$/.test(s))return Number(s);const m=s.match(/(\\d+)\\D+(\\d+)\\s*$/);return m?Math.max(0,Number(m[2])-Number(m[1])+1):0};
  const isFriday=dateObj.getUTCDay()===5;
  const centerIds=[...new Set(students.map((x:any)=>String(x.center_id||'')).filter(Boolean))];
  const operationalPairs=await Promise.all(centerIds.map(async centerId=>[centerId,await operationalDay(d,centerId)] as const));
  const operationalMap=new Map(operationalPairs);
  const scoredStudents=students.map((r:any)=>{const p=planMap.get(r.id)||{},reviewTarget=targetPages(p.review_target),newTarget=targetPages(p.new_target),reviewDone=Number(r.review_record?.page_count||0),newDone=Number(r.new_record?.page_count||0);
    const operational=operationalMap.get(String(r.center_id||''))||{open:!isFriday,reason:isFriday?'يوم الجمعة إجازة أسبوعية.':null};
    const disciplineScore=operational.open?attendanceScore(r.attendance_status,r.late_minutes,settings):null;
    const reviewScore=progressScore(reviewDone,reviewTarget,settings.review_weight);
    const newScore=progressScore(newDone,newTarget,settings.memorization_weight);
    return {...r,review_target:p.review_target||'',new_target:p.new_target||'',goals:p.goals||'',attendance_score:disciplineScore,review_score:reviewScore,new_score:newScore,daily_score:disciplineScore===null?null:disciplineScore+reviewScore+newScore,operational_day:operational.open,operational_reason:operational.reason};
  });
  const approvals=await query<any>(`select da.id,da.circle_id,da.approval_date,da.approved_at from day_approvals da join circles h on h.id=da.circle_id
    where da.approval_date=$4 and ($1='system_admin' or ($1 in ('center_manager','supervisor') and h.center_id=$2::uuid) or ($1='teacher' and h.teacher_user_id=$3::uuid))`,
    [u.role,u.center_id,u.id,d]);
  return json(res,200,{date:d,students:scoredStudents,approvals,weights:{new:settings.memorization_weight,review:settings.review_weight,attendance:settings.discipline_weight}});
}

export async function circleRegister(req:any,res:any,u:any){
  if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
  if(!isStaff(u.role))return json(res,403,{error:'Forbidden',message:'ليست لديك صلاحية لهذه الشاشة.'});
  const month=validMonth(req.query?.month)||today().slice(0,7);
  const students=await query<any>(`select s.id,s.full_name,h.id circle_id,h.name circle_name,
    coalesce(json_agg(json_build_object('date',d.day,'approved',exists(select 1 from day_approvals da where da.circle_id=h.id and da.approval_date=d.day),
    'status',a.status,'late_minutes',coalesce(a.late_minutes,0),'check_in_at',a.check_in_at,'check_out_at',a.check_out_at,
    'review',(select json_build_object('surah_no',m.surah_no,'from_ayah',m.from_ayah,'to_ayah',m.to_ayah,'from_page',m.from_page,'to_page',m.to_page,'pages',case when m.from_page is not null and m.to_page is not null then greatest(1,m.to_page-m.from_page+1) else null end,'grade',m.grade) from memorization_records m where m.student_id=s.id and m.record_date=d.day and m.record_type='review' order by m.created_at desc limit 1),
    'new',(select json_build_object('surah_no',m.surah_no,'from_ayah',m.from_ayah,'to_ayah',m.to_ayah,'from_page',m.from_page,'to_page',m.to_page,'pages',case when m.from_page is not null and m.to_page is not null then greatest(1,m.to_page-m.from_page+1) else null end,'grade',m.grade) from memorization_records m where m.student_id=s.id and m.record_date=d.day and m.record_type='new' order by m.created_at desc limit 1))
    order by d.day) filter(where a.id is not null or exists(select 1 from memorization_records mm where mm.student_id=s.id and mm.record_date=d.day)),'[]'::json) days
    from students s join circles h on h.id=s.circle_id cross join generate_series(($4||'-01')::date,(($4||'-01')::date+interval '1 month' - interval '1 day')::date,interval '1 day') d(day)
    left join attendance a on a.student_id=s.id and a.attendance_date=d.day where s.status='active' and
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
    from students s cross join generate_series($4::date,$5::date,'1 day') d where extract(dow from d)<>5
    and not exists(select 1 from holidays hd where hd.holiday_date=d::date and (hd.center_id is null or hd.center_id=s.center_id)) and
    ($1='system_admin' or ($1 in ('center_manager','supervisor') and s.center_id=$2::uuid) or ($1='teacher' and exists(select 1 from circles h where h.id=s.circle_id and h.teacher_user_id=$3::uuid)) or ($1='student' and s.user_id=$3::uuid))
  ), plan as (
    select d.student_id,d.record_day,case when coalesce(w.new_target,'')~'^\\d+(\\.\\d+)?$' then w.new_target::numeric else 0 end new_target,
      case when coalesce(w.review_target,'')~'^\\d+(\\.\\d+)?$' then w.review_target::numeric else 0 end review_target
    from days d left join weekly_plans w on w.student_id=d.student_id and w.week_start=d.week_start and w.day_name=d.day_name
  ), done as (
    select student_id,record_date,sum(case when record_type='new' then coalesce(page_count,0) else 0 end)::numeric new_pages,
      sum(case when record_type='review' then coalesce(page_count,0) else 0 end)::numeric review_pages
    from memorization_records where record_date between $4 and $5 group by student_id,record_date
  )
  select d.student_id,d.full_name,d.record_day as record_date,a.status,a.late_minutes,coalesce(done.new_pages,0) new_pages,coalesce(done.review_pages,0) review_pages,
    coalesce(p.new_target,0) new_daily_target,coalesce(p.review_target,0) review_daily_target
  from days d left join plan p on p.student_id=d.student_id and p.record_day=d.record_day left join done on done.student_id=d.student_id and done.record_date=d.record_day
  left join attendance a on a.student_id=d.student_id and a.attendance_date=d.record_day order by d.record_day desc,d.full_name`,[u.role,u.center_id,u.id,from,to]);
  const settings=await getOperationalSettings();
  const enriched=rows.map((r:any)=>{const newGrade=progressScore(r.new_pages,r.new_daily_target,settings.memorization_weight),reviewGrade=progressScore(r.review_pages,r.review_daily_target,settings.review_weight),discipline=attendanceScore(r.status,r.late_minutes,settings);return {...r,new_grade:newGrade,review_grade:reviewGrade,attendance_score:discipline,daily_score:discipline===null?null:newGrade+reviewGrade+discipline}});
  const scored=enriched.filter((r:any)=>r.daily_score!==null);
  return json(res,200,{rows:enriched,weights:{new:settings.memorization_weight,review:settings.review_weight,attendance:settings.discipline_weight},formula:'الحفظ الجديد '+settings.memorization_weight+' + المراجعة '+settings.review_weight+' + الحضور '+settings.discipline_weight,average:scored.length?Math.round(scored.reduce((n:number,r:any)=>n+Number(r.daily_score),0)/scored.length):0});
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
  const month=validMonth(req.query?.month)||today().slice(0,7);
  const [attendance,quran,plans,points,monthly,recent]=await Promise.all([
    query<any>(`select count(*) filter(where status<>'excused')::int total,count(*) filter(where status in ('present','late'))::int attended,count(*) filter(where status='absent')::int absent,count(*) filter(where status='late')::int late,count(*) filter(where status='excused')::int excused from attendance where student_id=$1 and to_char(attendance_date,'YYYY-MM')=$2`,[s.id,month]),
    query<any>(`select count(*) filter(where record_type='new')::int new_sessions,count(*) filter(where record_type='review')::int review_sessions,coalesce(sum(ayah_count) filter(where record_type='new'),0)::int new_ayahs,coalesce(sum(ayah_count) filter(where record_type='review'),0)::int review_ayahs,coalesce(round(avg(grade))::int,0) average_grade from memorization_records where student_id=$1 and to_char(record_date,'YYYY-MM')=$2`,[s.id,month]),
    query<any>(`select * from weekly_plans where student_id=$1 order by week_start desc,id desc limit 14`,[s.id]),
    query<any>(`select created_at,points,reason from points_ledger where student_id=$1 order by created_at desc limit 30`,[s.id]),
    query<any>(`select d.day::date record_date,a.status,a.late_minutes,a.points_penalty,a.check_in_at,a.check_out_at,exists(select 1 from day_approvals da where da.circle_id=s.circle_id and da.approval_date=d.day) approved from students s cross join generate_series(($2||'-01')::date,(($2||'-01')::date+interval '1 month' - interval '1 day')::date,interval '1 day') d(day) left join attendance a on a.student_id=s.id and a.attendance_date=d.day where s.id=$1 order by d.day`,[s.id,month]),
    query<any>(`select record_date,record_type,surah_no,from_ayah,to_ayah,from_page,to_page,grade,notes from memorization_records where student_id=$1 order by record_date desc,created_at desc limit 60`,[s.id])
  ]);
  return json(res,200,{student:s,month,attendance:attendance[0]||{},quran:quran[0]||{},plans,points,monthly,recent});
}

export async function dayApprove(req:any,res:any,u:any){
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
  if(!isStaff(u.role))return json(res,403,{error:'Forbidden',message:'ليست لديك صلاحية لاعتماد اليوم.'});
  const b=req.body||{},circleId=validUuid(b.circle_id),d=validDate(b.approval_date);
  if(!circleId||!d)return json(res,400,{error:'بيانات الاعتماد غير مكتملة'});
  const allowed=(await query<any>(`select id,center_id from circles where id=$1 and ($2='system_admin' or ($2 in ('center_manager','supervisor') and center_id=$3::uuid) or ($2='teacher' and teacher_user_id=$4::uuid))`,[circleId,u.role,u.center_id,u.id]))[0];
  if(!allowed)return json(res,403,{error:'Forbidden',message:'الحلقة خارج نطاق صلاحيتك.'});
  const operational=await operationalDay(d,allowed.center_id);if(!operational.open)return json(res,409,{error:'NON_OPERATIONAL_DAY',message:operational.reason});
  const dateObj=new Date(d+'T00:00:00.000Z'),dayNames=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'],dayName=dayNames[dateObj.getUTCDay()];
  const back=(dateObj.getUTCDay()+1)%7,weekDate=new Date(dateObj);weekDate.setUTCDate(weekDate.getUTCDate()-back);const weekStart=weekDate.toISOString().slice(0,10);
  const rows=await query<any>(`select s.id,s.full_name,a.status,
      w.new_target,w.review_target,
      exists(select 1 from memorization_records m where m.student_id=s.id and m.record_date=$2::date and m.record_type='new') has_new,
      exists(select 1 from memorization_records m where m.student_id=s.id and m.record_date=$2::date and m.record_type='review') has_review
    from students s
    left join attendance a on a.student_id=s.id and a.attendance_date=$2::date
    left join weekly_plans w on w.student_id=s.id and w.week_start=$3::date and w.day_name=$4
    where s.circle_id=$1 and s.status='active'
    order by s.full_name`,[circleId,d,weekStart,dayName]);
  const targetPages=(v:any)=>{const raw=String(v||'').trim();if(/^\\d+(?:\\.\\d+)?$/.test(raw))return Number(raw);const m=raw.match(/(\\d+)\\D+(\\d+)\\s*$/);return m?Math.max(0,Number(m[2])-Number(m[1])+1):0};
  const missing:string[]=[];
  for(const row of rows){
    const needs:string[]=[];
    if(!row.status)needs.push('الحضور');
    if(['present','late'].includes(String(row.status||''))){
      if(targetPages(row.review_target)>0&&!row.has_review)needs.push('المراجعة');
      if(targetPages(row.new_target)>0&&!row.has_new)needs.push('الحفظ الجديد');
    }
    if(needs.length)missing.push(`${row.full_name}: ${needs.join('، ')}`);
  }
  if(missing.length)return json(res,409,{error:'DAY_INCOMPLETE',message:`لا يمكن اعتماد اليوم قبل استكمال السجلات: ${missing.slice(0,6).join(' | ')}${missing.length>6?` | +${missing.length-6} طالب`:''}`});
  const row=(await query<any>(`insert into day_approvals(circle_id,approval_date,approved_by) values($1,$2,$3) on conflict(circle_id,approval_date) do update set approved_by=excluded.approved_by,approved_at=now() returning *`,[circleId,d,u.id]))[0];
  return json(res,200,row);
}
