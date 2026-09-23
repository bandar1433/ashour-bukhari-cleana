import { getPool, query } from '../_lib/db.js';
import { isStaff,validDate,validMonth,validUuid } from '../_lib/actor.js';
import { json } from '../_lib/http.js';
import { managers,today,int,txt,scopedStudent } from './shared.js';
import {ensureWeeklyLocks,weekStart} from '../_lib/weeklyLock.js';

export async function managementReport(req:any,res:any,u:any){
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

export async function adminOperations(req:any,res:any,u:any){
  if(!managers.includes(u.role))return json(res,403,{error:'Forbidden',message:'هذه الشاشة للإدارة والإشراف.'});
  const sub=String(req.query?.sub||'dashboard');
  if(sub==='dashboard'&&req.method==='GET'){
    await ensureWeeklyLocks();
    const scope=u.role==='system_admin'?[]:[u.center_id];
    const centerWhere=u.role==='system_admin'?'true':'id=$1::uuid',circleWhere=u.role==='system_admin'?'true':'center_id=$1::uuid',studentWhere=u.role==='system_admin'?'true':'center_id=$1::uuid';
    const [centers,circles,students,teachers,settings,holidays,audit,weeklyLocks]=await Promise.all([
      query<any>(`select count(*)::int n from centers where ${centerWhere}`,scope),
      query<any>(`select count(*)::int n,count(*) filter(where teacher_user_id is not null)::int assigned from circles where ${circleWhere}`,scope),
      query<any>(`select count(*)::int n,count(*) filter(where circle_id is not null)::int assigned from students where ${studentWhere} and status='active'`,scope),
      u.role==='system_admin'?query<any>(`select count(*)::int n from users where role='teacher' and is_active`):query<any>(`select count(*)::int n from users where center_id=$1::uuid and role='teacher' and is_active`,scope),
      query<any>('select * from operational_settings where id=1'),
      u.role==='system_admin'?query<any>('select * from holidays order by holiday_date desc limit 40'):query<any>('select * from holidays where center_id is null or center_id=$1 order by holiday_date desc limit 40',scope),
      u.role==='system_admin'?query<any>(`select a.*,u.full_name actor_name from audit_logs a left join users u on u.id=a.actor_user_id order by a.created_at desc limit 60`):query<any>(`select a.*,u.full_name actor_name from audit_logs a left join users u on u.id=a.actor_user_id where u.center_id=$1 order by a.created_at desc limit 60`,scope),
      u.role==='system_admin'?query<any>(`select wl.*,c.name circle_name from weekly_locks wl join circles c on c.id=wl.circle_id order by wl.week_start desc,wl.locked_at desc limit 60`):query<any>(`select wl.*,c.name circle_name from weekly_locks wl join circles c on c.id=wl.circle_id where c.center_id=$1 order by wl.week_start desc,wl.locked_at desc limit 60`,scope)
    ]);
    const data={database_configured:Boolean(process.env.DATABASE_URL),centers:centers[0]?.n||0,circles:circles[0]?.n||0,circles_with_teacher:circles[0]?.assigned||0,
      active_students:students[0]?.n||0,students_in_circle:students[0]?.assigned||0,active_teachers:teachers[0]?.n||0,settings:settings[0]||null,holidays,audit,weekly_locks:weeklyLocks};
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
  if(sub==='weekly-lock'&&req.method==='POST'){
    await ensureWeeklyLocks();const circleId=validUuid(req.body?.circle_id),raw=validDate(req.body?.week_start);if(!circleId||!raw)return json(res,400,{error:'الحلقة وبداية الأسبوع مطلوبتان'});
    const c=(await query<any>('select id,center_id from circles where id=$1',[circleId]))[0];if(!c)return json(res,404,{error:'الحلقة غير موجودة'});
    if(u.role!=='system_admin'&&c.center_id!==u.center_id)return json(res,403,{error:'الحلقة خارج مركزك'});
    const w=weekStart(raw),lock=String(req.body?.locked||'true')!=='false';
    const existing=(await query<any>('select id from weekly_locks where circle_id=$1 and week_start=$2::date order by locked_at desc limit 1',[circleId,w]))[0];
    if(lock&&!existing)await query('insert into weekly_locks(circle_id,week_start,locked_by) values($1,$2::date,$3)',[circleId,w,u.id]);
    if(!lock&&existing)await query('delete from weekly_locks where circle_id=$1 and week_start=$2::date',[circleId,w]);
    return json(res,200,{success:true,circle_id:circleId,week_start:w,locked:lock});
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
