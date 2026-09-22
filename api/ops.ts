import { getPool, query } from './_lib/db.js';
import { getActor,isStaff,validDate,validMonth,validUuid } from './_lib/actor.js';
import { handleError,json } from './_lib/http.js';

const managers=['system_admin','center_manager','supervisor'];
const today=()=>new Date().toISOString().slice(0,10);
const int=(v:any,min=0,max=100000)=>{const n=Number(v);if(!Number.isInteger(n)||n<min||n>max)throw new Error('قيمة رقمية غير صالحة');return n};
const txt=(v:any,max=1000)=>String(v??'').trim().slice(0,max);

async function ensureExtendedSchema(){
  await query(`CREATE TABLE IF NOT EXISTS circle_tasks(
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id uuid NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    name text NOT NULL, answer_type text NOT NULL CHECK(answer_type IN ('done','count')),
    points_per_unit integer NOT NULL DEFAULT 1,max_units integer NOT NULL DEFAULT 1,
    is_active boolean NOT NULL DEFAULT true,created_by uuid REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now())`);
  await query(`CREATE TABLE IF NOT EXISTS task_entries(
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),task_id uuid NOT NULL REFERENCES circle_tasks(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,entry_date date NOT NULL,
    units integer NOT NULL DEFAULT 0,points integer NOT NULL DEFAULT 0,updated_by uuid REFERENCES users(id),
    updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(task_id,student_id,entry_date))`);
  await query(`ALTER TABLE rewards ADD COLUMN IF NOT EXISTS circle_id uuid REFERENCES circles(id) ON DELETE CASCADE`);
  await query(`ALTER TABLE rewards ADD COLUMN IF NOT EXISTS image_path text`);
  await query(`CREATE TABLE IF NOT EXISTS reward_requests(
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reward_id uuid NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,status text NOT NULL DEFAULT 'pending',
    requested_at timestamptz NOT NULL DEFAULT now(),decided_by uuid REFERENCES users(id),decided_at timestamptz)`);
}
async function scopedStudent(u:any,idValue:any){
  const sid=validUuid(idValue); if(!sid)return null;
  return (await query<any>(`select s.*,h.teacher_user_id from students s left join circles h on h.id=s.circle_id where s.id=$4 and
    ($1='system_admin' or ($1 in ('center_manager','supervisor') and s.center_id=$2::uuid) or
     ($1='teacher' and h.teacher_user_id=$3::uuid) or ($1='student' and s.user_id=$3::uuid))`,
    [u.role,u.center_id,u.id,sid]))[0]||null;
}
async function summary(req:any,res:any,u:any){
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
async function teacherToday(req:any,res:any,u:any){
  if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
  if(!isStaff(u.role))return json(res,403,{error:'Forbidden',message:'ليست لديك صلاحية لهذه الشاشة.'});
  const d=validDate(req.query?.date)||today();
  const students=await query<any>(`select s.id,s.full_name,h.id circle_id,h.name circle_name,a.status attendance_status,
    coalesce((select count(*) from memorization_records m where m.student_id=s.id and m.record_date=$4 and m.record_type='new'),0)::int new_records,
    coalesce((select count(*) from memorization_records m where m.student_id=s.id and m.record_date=$4 and m.record_type='review'),0)::int review_records,
    coalesce((select round(avg(m.grade))::int from memorization_records m where m.student_id=s.id and m.record_date=$4),0)::int grade
    from students s join circles h on h.id=s.circle_id left join attendance a on a.student_id=s.id and a.attendance_date=$4
    where s.status='active' and ($1='system_admin' or ($1 in ('center_manager','supervisor') and s.center_id=$2::uuid) or ($1='teacher' and h.teacher_user_id=$3::uuid))
    order by h.name,s.full_name`,[u.role,u.center_id,u.id,d]);
  const approvals=await query<any>(`select da.id,da.circle_id,da.approval_date,da.approved_at from day_approvals da join circles h on h.id=da.circle_id
    where da.approval_date=$4 and ($1='system_admin' or ($1 in ('center_manager','supervisor') and h.center_id=$2::uuid) or ($1='teacher' and h.teacher_user_id=$3::uuid))`,
    [u.role,u.center_id,u.id,d]);
  return json(res,200,{date:d,students,approvals});
}
async function circleRegister(req:any,res:any,u:any){
  if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
  if(!isStaff(u.role))return json(res,403,{error:'Forbidden',message:'ليست لديك صلاحية لهذه الشاشة.'});
  const month=validMonth(req.query?.month)||today().slice(0,7);
  const students=await query<any>(`select s.id,s.full_name,h.id circle_id,h.name circle_name,
    coalesce(json_agg(json_build_object('date',d.day,'approved',exists(select 1 from day_approvals da where da.circle_id=h.id and da.approval_date=d.day),
    'status',a.status,'late_minutes',coalesce(a.late_minutes,0),'check_in_at',a.check_in_at,'check_out_at',a.check_out_at,
    'review',(select json_build_object('surah_no',m.surah_no,'from_ayah',m.from_ayah,'to_ayah',m.to_ayah,'grade',m.grade) from memorization_records m where m.student_id=s.id and m.record_date=d.day and m.record_type='review' order by m.created_at desc limit 1),
    'new',(select json_build_object('surah_no',m.surah_no,'from_ayah',m.from_ayah,'to_ayah',m.to_ayah,'grade',m.grade) from memorization_records m where m.student_id=s.id and m.record_date=d.day and m.record_type='new' order by m.created_at desc limit 1))
    order by d.day) filter(where a.id is not null or exists(select 1 from memorization_records mm where mm.student_id=s.id and mm.record_date=d.day)),'[]'::json) days
    from students s join circles h on h.id=s.circle_id cross join generate_series(($4||'-01')::date,(($4||'-01')::date+interval '1 month-1 day')::date,interval '1 day') d(day)
    left join attendance a on a.student_id=s.id and a.attendance_date=d.day where s.status='active' and
    ($1='system_admin' or ($1 in ('center_manager','supervisor') and s.center_id=$2::uuid) or ($1='teacher' and h.teacher_user_id=$3::uuid))
    group by s.id,s.full_name,h.id,h.name order by h.name,s.full_name`,[u.role,u.center_id,u.id,month]);
  return json(res,200,{month,students});
}
async function evaluations(req:any,res:any,u:any){
  if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
  const from=validDate(req.query?.from)||today(), to=validDate(req.query?.to)||from;
  const settings=(await query<any>('select memorization_weight,review_weight,discipline_weight from operational_settings where id=1'))[0]||{memorization_weight:30,review_weight:40,discipline_weight:30};
  const rows=await query<any>(`with days as (
    select s.id student_id,s.full_name,d::date record_day,(d::date-((extract(dow from d)::int+1)%7))::date week_start
    from students s cross join generate_series($4::date,$5::date,'1 day') d where
    ($1='system_admin' or ($1 in ('center_manager','supervisor') and s.center_id=$2::uuid) or
     ($1='teacher' and exists(select 1 from circles h where h.id=s.circle_id and h.teacher_user_id=$3::uuid)) or ($1='student' and s.user_id=$3::uuid))
  ), plans as (
    select w.student_id,w.week_start,
    sum(case when w.new_target like 'صفحات مصحف المدينة:%' then greatest(0,(substring(w.new_target from '–([0-9]+)')::numeric)-(substring(w.new_target from ': ([0-9]+)')::numeric)+1) else 0 end)/6.0 new_daily_target,
    sum(case when w.review_target like 'صفحات مصحف المدينة:%' then greatest(0,(substring(w.review_target from '–([0-9]+)')::numeric)-(substring(w.review_target from ': ([0-9]+)')::numeric)+1) else 0 end)/6.0 review_daily_target
    from weekly_plans w group by w.student_id,w.week_start
  ), done as (
    select student_id,record_date,sum(case when record_type='new' then coalesce((substring(notes from '— ([0-9]+) صفحة'))::numeric,0) else 0 end) new_pages,
    sum(case when record_type='review' then coalesce((substring(notes from '— ([0-9]+) صفحة'))::numeric,0) else 0 end) review_pages
    from memorization_records where record_date between $4 and $5 group by student_id,record_date
  ), att as (select student_id,attendance_date,status,points_penalty from attendance where attendance_date between $4 and $5)
  select days.student_id,days.full_name,days.record_day as day,att.status,round(coalesce(done.new_pages,0),2) new_pages,round(coalesce(done.review_pages,0),2) review_pages,
  round(coalesce(plans.new_daily_target,0),2) new_daily_target,round(coalesce(plans.review_daily_target,0),2) review_daily_target,
  case when coalesce(plans.new_daily_target,0)>0 then least(100,round(100*coalesce(done.new_pages,0)/plans.new_daily_target))::int else 0 end new_grade,
  case when coalesce(plans.review_daily_target,0)>0 then least(100,round(100*coalesce(done.review_pages,0)/plans.review_daily_target))::int else 0 end review_grade,
  case when att.status='excused' then null when att.status='absent' then 0 when att.status in ('present','late') then greatest(0,100+coalesce(att.points_penalty,0)) else 0 end attendance_score,
  case when att.status='excused' then null else
    round(
      ($6::numeric * case when coalesce(plans.new_daily_target,0)>0 then least(1,coalesce(done.new_pages,0)/plans.new_daily_target) else 0 end)+
      ($7::numeric * case when coalesce(plans.review_daily_target,0)>0 then least(1,coalesce(done.review_pages,0)/plans.review_daily_target) else 0 end)+
      ($8::numeric * case when att.status='absent' then 0 when att.status in ('present','late') then greatest(0,least(1,(100+coalesce(att.points_penalty,0))/100.0)) else 0 end)
    )::int
  end daily_score
  from days left join plans on plans.student_id=days.student_id and plans.week_start=days.week_start
  left join done on done.student_id=days.student_id and done.record_date=days.record_day left join att on att.student_id=days.student_id and att.attendance_date=days.record_day
  order by days.record_day desc,days.full_name`,[u.role,u.center_id,u.id,from,to,settings.memorization_weight,settings.review_weight,settings.discipline_weight]);
  const scored=rows.filter((r:any)=>r.daily_score!==null);
  return json(res,200,{rows,weights:{new:settings.memorization_weight,review:settings.review_weight,attendance:settings.discipline_weight},
    formula:'الإنجاز اليومي مقارنة بالخطة الأسبوعية مع وزن الانضباط',average:scored.length?Math.round(scored.reduce((n:number,r:any)=>n+Number(r.daily_score),0)/scored.length):0});
}
async function studentProfile(req:any,res:any,u:any){
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
  const b=req.body||{},circleId=validUuid(b.circle_id),d=validDate(b.approval_date);
  if(!circleId||!d)return json(res,400,{error:'بيانات الاعتماد غير مكتملة'});
  const allowed=(await query<any>(`select id from circles where id=$1 and ($2='system_admin' or ($2 in ('center_manager','supervisor') and center_id=$3::uuid) or ($2='teacher' and teacher_user_id=$4::uuid))`,[circleId,u.role,u.center_id,u.id]))[0];
  if(!allowed)return json(res,403,{error:'Forbidden',message:'الحلقة خارج نطاق صلاحيتك.'});
  const row=(await query<any>(`insert into day_approvals(circle_id,approval_date,approved_by) values($1,$2,$3) on conflict(circle_id,approval_date) do update set approved_by=excluded.approved_by,approved_at=now() returning *`,[circleId,d,u.id]))[0];
  return json(res,200,row);
}
async function selfService(req:any,res:any,u:any){
  if(u.role!=='student')return json(res,403,{error:'Forbidden',message:'هذه الخدمة مخصصة لحساب الطالب.'});
  const s=(await query<any>(`select s.*,h.name circle_name,c.name center_name from students s left join circles h on h.id=s.circle_id left join centers c on c.id=s.center_id where s.user_id=$1 limit 1`,[u.id]))[0];
  if(!s)return json(res,404,{error:'لم يتم ربط حسابك بسجل الطالب'});
  if(req.method==='GET'){
    const att=(await query<any>('select attendance_date,status,check_in_at,check_out_at from attendance where student_id=$1 and attendance_date=current_date',[s.id]))[0]||null;
    const recent=await query<any>('select record_date,record_type,surah_no,from_ayah,to_ayah,grade from memorization_records where student_id=$1 order by record_date desc,created_at desc limit 12',[s.id]);
    return json(res,200,{student:s,attendance:att,recent});
  }
  if(req.method==='POST'){
    const kind=String(req.query?.kind||'');
    if(kind==='punch'){
      if(!s.circle_id||s.status!=='active')return json(res,400,{error:'يلزم طالب نشط مرتبط بحلقة'});
      const action=String(req.body?.action||'');
      if(!['check_in','check_out'].includes(action))return json(res,400,{error:'إجراء الحضور غير صالح'});
      let a=(await query<any>('select * from attendance where student_id=$1 and attendance_date=current_date',[s.id]))[0];
      if(!a&&action==='check_out')return json(res,400,{error:'سجّل الحضور أولاً قبل تسجيل الانصراف'});
      if(!a)a=(await query<any>(`insert into attendance(student_id,circle_id,attendance_date,status,recorded_by,late_minutes,points_penalty,check_in_at) values($1,$2,current_date,'present',$3,0,0,now()) returning *`,[s.id,s.circle_id,u.id]))[0];
      else if(action==='check_in'&&!a.check_in_at)a=(await query<any>('update attendance set check_in_at=now(),recorded_by=$1 where id=$2 returning *',[u.id,a.id]))[0];
      else if(action==='check_out'&&!a.check_out_at)a=(await query<any>('update attendance set check_out_at=now(),recorded_by=$1 where id=$2 returning *',[u.id,a.id]))[0];
      return json(res,200,a);
    }
    if(kind==='quran'){
      const approved=(await query<any>('select id from day_approvals where circle_id=$1 and approval_date=current_date',[s.circle_id]))[0];
      if(approved)return json(res,403,{error:'تم اعتماد سجل اليوم ولا يمكن إضافة تسميع جديد'});
      const b=req.body||{},recordType=String(b.record_type||'new');
      if(!['new','review','recitation'].includes(recordType))return json(res,400,{error:'نوع السجل غير صالح'});
      const surah=int(b.surah_no,1,114),from=int(b.from_ayah,1,286),to=int(b.to_ayah,from,286);
      const row=(await query<any>(`insert into memorization_records(student_id,record_type,surah_no,from_ayah,to_ayah,ayah_count,grade,notes,qiraah,approved,record_date)
        values($1,$2,$3,$4,$5,$6,$7,$8,'حفص عن عاصم',false,current_date) returning *`,
        [s.id,recordType,surah,from,to,to-from+1,b.grade?Number(b.grade):null,txt(b.notes,1000)||null]))[0];
      return json(res,201,row);
    }
  }
  return json(res,405,{error:'Method not allowed'});
}
async function motivation(req:any,res:any,u:any){
  await ensureExtendedSchema();
  const sub=String(req.query?.sub||'list');
  if(sub==='list'&&req.method==='GET'){
    const month=validMonth(req.query?.month)||today().slice(0,7);
    let target:any=null;
    if(req.query?.student_id)target=await scopedStudent(u,req.query.student_id);
    if(!target&&u.role==='student')target=(await query<any>('select * from students where user_id=$1',[u.id]))[0];
    let circleId=validUuid(req.query?.circle_id)||target?.circle_id||null;
    if(!circleId&&u.role==='teacher')circleId=(await query<any>('select id from circles where teacher_user_id=$1 order by name limit 1',[u.id]))[0]?.id||null;
    if(!circleId&&managers.includes(u.role))circleId=(await query<any>(`select id from circles where $1='system_admin' or center_id=$2::uuid order by name limit 1`,[u.role,u.center_id]))[0]?.id||null;
    if(!circleId)return json(res,200,{month,tasks:[],students:[],entries:[],rewards:[],requests:[],rankings:[]});
    const allowed=(await query<any>(`select id,name from circles where id=$1 and ($2='system_admin' or ($2 in ('center_manager','supervisor') and center_id=$3::uuid) or ($2='teacher' and teacher_user_id=$4::uuid) or exists(select 1 from students s where s.circle_id=circles.id and s.user_id=$4::uuid))`,[circleId,u.role,u.center_id,u.id]))[0];
    if(!allowed)return json(res,403,{error:'الحلقة خارج نطاق صلاحيتك'});
    const [tasks,students,entries,rewards,requests,rankings]=await Promise.all([
      query<any>('select * from circle_tasks where circle_id=$1 and is_active order by created_at',[circleId]),
      query<any>(`select id,full_name,points_balance from students where circle_id=$1 and status='active' order by full_name`,[circleId]),
      query<any>(`select e.*,t.name task_name from task_entries e join circle_tasks t on t.id=e.task_id where t.circle_id=$1 and to_char(e.entry_date,'YYYY-MM')=$2 and ($3::uuid is null or e.student_id=$3)`,[circleId,month,target?.id||null]),
      query<any>('select * from rewards where is_active and circle_id=$1 order by points_cost',[circleId]),
      query<any>(`select rr.*,r.name reward_name,s.full_name from reward_requests rr join rewards r on r.id=rr.reward_id join students s on s.id=rr.student_id where r.circle_id=$1 and ($2::uuid is null or rr.student_id=$2) order by rr.requested_at desc`,[circleId,target?.id||null]),
      query<any>(`select s.id,s.full_name,s.points_balance,coalesce((select round(avg(m.grade))::int from memorization_records m where m.student_id=s.id and m.record_date>=current_date-29),0) quran_average,
        coalesce((select round(100.0*count(*) filter(where a.status in ('present','late'))/nullif(count(*),0))::int from attendance a where a.student_id=s.id and a.attendance_date>=current_date-29),0) attendance_rate
        from students s where s.circle_id=$1 and s.status='active' order by s.points_balance desc,quran_average desc,attendance_rate desc limit 30`,[circleId])
    ]);
    return json(res,200,{month,circle:allowed,student:target,tasks,students,entries,rewards,requests,rankings});
  }
  if(sub==='task'&&req.method==='POST'){
    if(!isStaff(u.role))return json(res,403,{error:'Forbidden'});
    const b=req.body||{},circleId=validUuid(b.circle_id);if(!circleId)return json(res,400,{error:'اختر الحلقة'});
    const allowed=(await query<any>(`select id from circles where id=$1 and ($2='system_admin' or ($2 in ('center_manager','supervisor') and center_id=$3::uuid) or ($2='teacher' and teacher_user_id=$4::uuid))`,[circleId,u.role,u.center_id,u.id]))[0];
    if(!allowed)return json(res,403,{error:'الحلقة خارج نطاق صلاحيتك'});
    const answer=String(b.answer_type||'done');if(!['done','count'].includes(answer))return json(res,400,{error:'نوع المهمة غير صالح'});
    const row=(await query<any>('insert into circle_tasks(circle_id,name,answer_type,points_per_unit,max_units,created_by) values($1,$2,$3,$4,$5,$6) returning *',
      [circleId,txt(b.name,200),answer,int(b.points_per_unit,1,1000),answer==='done'?1:int(b.max_units,1,20),u.id]))[0];
    return json(res,201,row);
  }
  if(sub==='entry'&&req.method==='POST'){
    const b=req.body||{};let s:any;
    if(u.role==='student')s=(await query<any>('select * from students where user_id=$1',[u.id]))[0];
    else s=await scopedStudent(u,b.student_id);
    if(!s)return json(res,404,{error:'الطالب غير موجود أو خارج النطاق'});
    const d=validDate(b.entry_date)||today();if(u.role==='student'&&d!==today())return json(res,403,{error:'يمكن للطالب التسجيل في اليوم الحالي فقط'});
    const task=(await query<any>('select * from circle_tasks where id=$1 and circle_id=$2 and is_active',[validUuid(b.task_id),s.circle_id]))[0];
    if(!task)return json(res,400,{error:'المهمة غير متاحة'});
    const units=int(b.units,0,Number(task.max_units)),points=units*Number(task.points_per_unit);
    const old=(await query<any>('select points from task_entries where task_id=$1 and student_id=$2 and entry_date=$3',[task.id,s.id,d]))[0];
    const row=(await query<any>(`insert into task_entries(task_id,student_id,entry_date,units,points,updated_by) values($1,$2,$3,$4,$5,$6)
      on conflict(task_id,student_id,entry_date) do update set units=excluded.units,points=excluded.points,updated_by=excluded.updated_by,updated_at=now() returning *`,
      [task.id,s.id,d,units,points,u.id]))[0];
    const delta=points-Number(old?.points||0);
    if(delta){
      await query('update students set points_balance=greatest(0,points_balance+$1) where id=$2',[delta,s.id]);
      await query(`insert into points_ledger(student_id,points,reason,source_type,created_by) values($1,$2,$3,'circle_task',$4)`,[s.id,delta,`مهمة: ${task.name}`,u.id]);
    }
    return json(res,200,row);
  }
  if(sub==='reward'&&req.method==='POST'){
    if(!isStaff(u.role))return json(res,403,{error:'Forbidden'});
    const b=req.body||{},circleId=validUuid(b.circle_id);if(!circleId)return json(res,400,{error:'اختر الحلقة'});
    const allowed=(await query<any>(`select id from circles where id=$1 and ($2='system_admin' or ($2 in ('center_manager','supervisor') and center_id=$3::uuid) or ($2='teacher' and teacher_user_id=$4::uuid))`,[circleId,u.role,u.center_id,u.id]))[0];
    if(!allowed)return json(res,403,{error:'الحلقة خارج نطاق صلاحيتك'});
    return json(res,201,(await query<any>('insert into rewards(name,points_cost,stock,circle_id) values($1,$2,$3,$4) returning *',[txt(b.name,200),int(b.points_cost,1,100000),int(b.stock,0,100000),circleId]))[0]);
  }
  if(sub==='reward-request'&&req.method==='POST'){
    if(u.role!=='student')return json(res,403,{error:'هذه الخدمة للطالب'});
    const s=(await query<any>('select * from students where user_id=$1',[u.id]))[0];if(!s)return json(res,404,{error:'لم يتم ربط الحساب بالطالب'});
    const reward=(await query<any>('select * from rewards where id=$1 and circle_id=$2 and is_active',[validUuid(req.body?.reward_id),s.circle_id]))[0];
    if(!reward||Number(reward.stock)<1)return json(res,400,{error:'الجائزة غير متاحة'});
    if(Number(s.points_balance)<Number(reward.points_cost))return json(res,400,{error:'رصيد النقاط غير كاف'});
    const pending=(await query<any>(`select id from reward_requests where reward_id=$1 and student_id=$2 and status='pending'`,[reward.id,s.id]))[0];
    if(pending)return json(res,400,{error:'لديك طلب قائم لهذه الجائزة'});
    return json(res,201,(await query<any>('insert into reward_requests(reward_id,student_id) values($1,$2) returning *',[reward.id,s.id]))[0]);
  }
  if(sub==='reward-approve'&&req.method==='POST'){
    if(!isStaff(u.role))return json(res,403,{error:'Forbidden'});
    const requestId=validUuid(req.body?.request_id);if(!requestId)return json(res,400,{error:'طلب غير صالح'});
    const client=await getPool().connect();
    try{
      await client.query('begin');
      const rr=(await client.query(`select rr.*,r.points_cost,r.stock,r.circle_id,c.teacher_user_id,c.center_id from reward_requests rr join rewards r on r.id=rr.reward_id join circles c on c.id=r.circle_id where rr.id=$1 for update`,[requestId])).rows[0];
      if(!rr||rr.status!=='pending')throw new Error('الطلب غير متاح');
      const allowed=u.role==='system_admin'||(managers.includes(u.role)&&u.center_id===rr.center_id)||(u.role==='teacher'&&u.id===rr.teacher_user_id);
      if(!allowed)throw new Error('الطلب خارج نطاق صلاحيتك');
      if(Number(rr.stock)<1)throw new Error('نفدت الكمية');
      const changed=await client.query('update students set points_balance=points_balance-$1 where id=$2 and points_balance>=$1 returning id',[rr.points_cost,rr.student_id]);
      if(!changed.rowCount)throw new Error('رصيد الطالب لم يعد كافيًا');
      await client.query('update rewards set stock=stock-1 where id=$1',[rr.reward_id]);
      await client.query(`update reward_requests set status='approved',decided_by=$1,decided_at=now() where id=$2`,[u.id,requestId]);
      await client.query(`insert into points_ledger(student_id,points,reason,source_type,created_by) values($1,$2,'استبدال جائزة','reward',$3)`,[rr.student_id,-rr.points_cost,u.id]);
      await client.query('commit');return json(res,200,{success:true});
    }catch(e){await client.query('rollback');throw e}finally{client.release()}
  }
  return json(res,405,{error:'Method not allowed'});
}
async function notifications(req:any,res:any,u:any){
  if(req.method==='GET')return json(res,200,await query<any>('select * from inapp_notifications where user_id=$1 order by created_at desc limit 100',[u.id]));
  const sub=String(req.query?.sub||'');
  if(req.method==='POST'&&sub==='send'){
    if(!managers.includes(u.role))return json(res,403,{error:'Forbidden'});
    const b=req.body||{},centerId=u.role==='system_admin'?(validUuid(b.center_id)||null):u.center_id;
    const rows=await query<any>(`insert into inapp_notifications(user_id,title,body,kind) select id,$1,$2,'admin' from users where is_active and ($3::uuid is null or center_id=$3::uuid) returning id`,
      [txt(b.title,200),txt(b.body,2000),centerId]);return json(res,200,{sent:rows.length});
  }
  if(req.method==='PUT'&&sub==='read'){
    const id=validUuid(req.query?.id);if(!id)return json(res,400,{error:'إشعار غير صالح'});
    await query('update inapp_notifications set is_read=true where id=$1 and user_id=$2',[id,u.id]);return json(res,200,{success:true});
  }
  return json(res,405,{error:'Method not allowed'});
}
async function competitions(req:any,res:any,u:any){
  const sub=String(req.query?.sub||'list');
  if(req.method==='GET'){
    const rows=u.role==='system_admin'
      ?await query<any>(`select c.*,coalesce((select json_agg(x order by x.score desc) from (select ce.score,ce.notes,s.id student_id,s.full_name from competition_entries ce join students s on s.id=ce.student_id where ce.competition_id=c.id)x),'[]'::json) entries from competitions c order by c.start_date desc`)
      :await query<any>(`select c.*,coalesce((select json_agg(x order by x.score desc) from (select ce.score,ce.notes,s.id student_id,s.full_name from competition_entries ce join students s on s.id=ce.student_id where ce.competition_id=c.id)x),'[]'::json) entries from competitions c where c.center_id is null or c.center_id=$1::uuid order by c.start_date desc`,[u.center_id]);
    return json(res,200,rows);
  }
  if(req.method==='POST'&&sub==='create'){
    if(!managers.includes(u.role))return json(res,403,{error:'Forbidden'});
    const b=req.body||{},start=validDate(b.start_date),end=validDate(b.end_date);if(!start||!end||start>end)return json(res,400,{error:'تواريخ المسابقة غير صالحة'});
    const centerId=u.role==='system_admin'?(validUuid(b.center_id)||null):u.center_id;
    return json(res,201,(await query<any>('insert into competitions(center_id,title,start_date,end_date,created_by) values($1,$2,$3,$4,$5) returning *',[centerId,txt(b.title,300),start,end,u.id]))[0]);
  }
  if(req.method==='POST'&&sub==='score'){
    if(!isStaff(u.role))return json(res,403,{error:'Forbidden'});
    const b=req.body||{},s=await scopedStudent(u,b.student_id),competitionId=validUuid(b.competition_id);
    if(!s||!competitionId)return json(res,400,{error:'بيانات الطالب أو المسابقة غير صالحة'});
    const allowed=(await query<any>('select id from competitions where id=$1 and (center_id is null or center_id=$2)',[competitionId,s.center_id]))[0];
    if(!allowed)return json(res,403,{error:'المسابقة غير متاحة لهذا الطالب'});
    const row=(await query<any>(`insert into competition_entries(competition_id,student_id,score,notes,updated_by) values($1,$2,$3,$4,$5)
      on conflict(competition_id,student_id) do update set score=excluded.score,notes=excluded.notes,updated_by=excluded.updated_by,updated_at=now() returning *`,
      [competitionId,s.id,int(b.score,0,1000),txt(b.notes,1000)||null,u.id]))[0];return json(res,200,row);
  }
  return json(res,405,{error:'Method not allowed'});
}
async function managementReport(req:any,res:any,u:any){
  if(req.method!=='GET'||!isStaff(u.role))return json(res,403,{error:'Forbidden'});
  const from=validDate(req.query?.from)||new Date(Date.now()-29*86400000).toISOString().slice(0,10),to=validDate(req.query?.to)||today();
  let filter='true',args:any[]=[from,to];
  if(u.role==='teacher'){filter='c.id=$3::uuid and h.teacher_user_id=$4::uuid';args=[from,to,u.center_id,u.id]}
  else if(u.role!=='system_admin'){filter='c.id=$3::uuid';args=[from,to,u.center_id]}
  const circles=await query<any>(`select h.id,h.name,c.name center_name,u.full_name teacher_name,count(distinct s.id)::int students,
    coalesce(round(avg((select case when count(*)=0 then null else 100.0*count(*) filter(where a.status in ('present','late'))/count(*) end from attendance a where a.student_id=s.id and a.attendance_date between $1 and $2)))::int,0) attendance_rate,
    coalesce(round(avg((select avg(m.grade) from memorization_records m where m.student_id=s.id and m.record_date between $1 and $2)))::int,0) quran_average
    from circles h join centers c on c.id=h.center_id left join users u on u.id=h.teacher_user_id left join students s on s.circle_id=h.id and s.status='active'
    where ${filter} group by h.id,h.name,c.name,u.full_name order by attendance_rate desc,quran_average desc`,args);
  const scoped=u.role==='system_admin'?'true':u.role==='teacher'?'s.center_id=$3::uuid and h.teacher_user_id=$4::uuid':'s.center_id=$3::uuid';
  const follow=await query<any>(`select s.id,s.full_name,c.name center_name,h.name circle_name,
    coalesce((select round(100.0*count(*) filter(where a.status in ('present','late'))/nullif(count(*),0))::int from attendance a where a.student_id=s.id and a.attendance_date between $1 and $2),0) attendance_rate,
    coalesce((select round(avg(m.grade))::int from memorization_records m where m.student_id=s.id and m.record_date between $1 and $2),0) quran_average
    from students s join centers c on c.id=s.center_id left join circles h on h.id=s.circle_id where ${scoped} and s.status='active'
    and (coalesce((select 100.0*count(*) filter(where a.status in ('present','late'))/nullif(count(*),0) from attendance a where a.student_id=s.id and a.attendance_date between $1 and $2),0)<75
    or coalesce((select avg(m.grade) from memorization_records m where m.student_id=s.id and m.record_date between $1 and $2),0)<70)
    order by attendance_rate,quran_average limit 30`,args);
  return json(res,200,{from,to,circles,needs_followup:follow});
}
async function adminOperations(req:any,res:any,u:any){
  if(!managers.includes(u.role))return json(res,403,{error:'Forbidden',message:'هذه الشاشة للإدارة والإشراف.'});
  const sub=String(req.query?.sub||'dashboard');
  if(sub==='dashboard'&&req.method==='GET'){
    const scope=u.role==='system_admin'?[]:[u.center_id];
    const centerWhere=u.role==='system_admin'?'true':'id=$1::uuid',circleWhere=u.role==='system_admin'?'true':'center_id=$1::uuid',studentWhere=u.role==='system_admin'?'true':'center_id=$1::uuid';
    const [centers,circles,students,teachers,settings,holidays,audit]=await Promise.all([
      query<any>(`select count(*)::int n from centers where ${centerWhere}`,scope),
      query<any>(`select count(*)::int n,count(*) filter(where teacher_user_id is not null)::int assigned from circles where ${circleWhere}`,scope),
      query<any>(`select count(*)::int n,count(*) filter(where circle_id is not null)::int assigned from students where ${studentWhere} and status='active'`,scope),
      u.role==='system_admin'?query<any>(`select count(*)::int n from users where role='teacher' and is_active`):query<any>(`select count(*)::int n from users where center_id=$1::uuid and role='teacher' and is_active`,scope),
      query<any>('select * from operational_settings where id=1'),
      u.role==='system_admin'?query<any>('select * from holidays order by holiday_date desc limit 40'):query<any>('select * from holidays where center_id is null or center_id=$1 order by holiday_date desc limit 40',scope),
      u.role==='system_admin'?query<any>(`select a.*,u.full_name actor_name from audit_logs a left join users u on u.id=a.actor_user_id order by a.created_at desc limit 60`):query<any>(`select a.*,u.full_name actor_name from audit_logs a left join users u on u.id=a.actor_user_id where u.center_id=$1 order by a.created_at desc limit 60`,scope)
    ]);
    const data={database_configured:Boolean(process.env.DATABASE_URL),centers:centers[0]?.n||0,circles:circles[0]?.n||0,circles_with_teacher:circles[0]?.assigned||0,
      active_students:students[0]?.n||0,students_in_circle:students[0]?.assigned||0,active_teachers:teachers[0]?.n||0,settings:settings[0]||null,holidays,audit};
    const checks=[{label:'اتصال قاعدة البيانات',ok:data.database_configured},{label:'إضافة مركز واحد على الأقل',ok:data.centers>0},
      {label:'ربط المعلمين بالحلقات',ok:data.circles>0&&data.circles===data.circles_with_teacher},{label:'ربط الطلاب بالحلقات',ok:data.active_students>0&&data.active_students===data.students_in_circle},
      {label:'وجود حساب معلم نشط',ok:data.active_teachers>0},{label:'إعدادات التشغيل متوفرة',ok:!!data.settings}];
    return json(res,200,{...data,checks,ready:checks.every(x=>x.ok)});
  }
  if(sub==='settings'&&req.method==='PUT'){
    const b=req.body||{},mw=int(b.memorization_weight,0,100),rw=int(b.review_weight,0,100),dw=int(b.discipline_weight,0,100);
    if(mw+rw+dw!==100)return json(res,400,{error:'يجب أن يكون مجموع أوزان التقييم 100%'});
    const row=(await query<any>(`update operational_settings set grace_minutes=$1,minor_late_penalty=$2,major_late_penalty=$3,memorization_weight=$4,review_weight=$5,discipline_weight=$6,edit_window_days=$7,updated_by=$8,updated_at=now() where id=1 returning *`,
      [int(b.grace_minutes,0,120),int(b.minor_late_penalty,0,1000),int(b.major_late_penalty,0,1000),mw,rw,dw,int(b.edit_window_days,1,30),u.id]))[0];
    await query(`insert into audit_logs(actor_user_id,action,entity_type,entity_id,after_json) values($1,'update','operational_settings','1',$2::jsonb)`,[u.id,JSON.stringify(row)]);
    return json(res,200,row);
  }
  if(sub==='holiday'&&req.method==='POST'){
    const b=req.body||{},d=validDate(b.holiday_date);if(!d)return json(res,400,{error:'تاريخ الإجازة غير صالح'});
    const centerId=u.role==='system_admin'?(validUuid(b.center_id)||null):u.center_id,kind=['official','special'].includes(String(b.kind))?String(b.kind):'official';
    const row=(await query<any>(`insert into holidays(center_id,holiday_date,title,kind,created_by) values($1,$2,$3,$4,$5) returning *`,
      [centerId,d,txt(b.title,300),kind,u.id]))[0];
    return json(res,201,row);
  }
  if(sub==='edit-exception'&&req.method==='POST'){
    const s=await scopedStudent(u,req.body?.student_id),d=validDate(req.body?.record_date);if(!s||!d)return json(res,400,{error:'بيانات الطالب أو التاريخ غير صالحة'});
    return json(res,201,(await query<any>(`insert into edit_exceptions(student_id,record_date,reason,approved_by) values($1,$2,$3,$4) returning *`,
      [s.id,d,txt(req.body?.reason,1000),u.id]))[0]);
  }
  return json(res,405,{error:'Method not allowed'});
}
export default async function handler(req:any,res:any){
  try{
    const u=await getActor(req,res);if(!u)return;
    const action=String(req.query?.action||'');
    if(action==='summary')return summary(req,res,u);
    if(action==='teacher-today')return teacherToday(req,res,u);
    if(action==='circle-register')return circleRegister(req,res,u);
    if(action==='evaluations')return evaluations(req,res,u);
    if(action==='student-profile')return studentProfile(req,res,u);
    if(action==='day-approve')return dayApprove(req,res,u);
    if(action==='self-service')return selfService(req,res,u);
    if(action==='motivation')return motivation(req,res,u);
    if(action==='notifications')return notifications(req,res,u);
    if(action==='competitions')return competitions(req,res,u);
    if(action==='management-report')return managementReport(req,res,u);
    if(action==='admin-operations')return adminOperations(req,res,u);
    return json(res,404,{error:'Unknown operation'});
  }catch(e){return handleError(res,e)}
}
