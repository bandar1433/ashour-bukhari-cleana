import { getPool, query } from '../_lib/db.js';
import { isStaff,validDate,validMonth,validUuid } from '../_lib/actor.js';
import { json } from '../_lib/http.js';
import { managers,today,int,txt,scopedStudent } from './shared.js';

export async function joinRequests(req:any,res:any,u:any){
  const sub=String(req.query?.sub||'list');
  if(sub==='circles'&&req.method==='GET'){
    return json(res,200,{items:await query<any>("select h.id,h.name,c.name center_name from circles h join centers c on c.id=h.center_id where h.is_active order by c.name,h.name")});
  }
  if(sub==='request'&&req.method==='POST'){
    if(u.role!=='student')return json(res,403,{error:'طلبات الانضمام للحلقات متاحة للطالب فقط'});
    const circleId=validUuid(req.body?.circle_id);if(!circleId)return json(res,400,{error:'اختر الحلقة'});
    const exists=(await query<any>("select id from circle_join_requests where user_id=$1 and circle_id=$2 and status='pending'",[u.id,circleId]))[0];
    if(exists)return json(res,400,{error:'يوجد طلب قائم لهذه الحلقة'});
    return json(res,201,(await query<any>("insert into circle_join_requests(user_id,circle_id,requested_role,status) values($1,$2,$3,'pending') returning *",[u.id,circleId,u.role]))[0]);
  }
  if(sub==='list'&&req.method==='GET'){
    if(!isStaff(u.role))return json(res,403,{error:'Forbidden'});
    const rows=await query<any>(`select jr.*,coalesce(us.full_name,us.email) applicant_name,us.email,h.name circle_name,c.name center_name
      from circle_join_requests jr join users us on us.id=jr.user_id join circles h on h.id=jr.circle_id join centers c on c.id=h.center_id
      where jr.status='pending' and ($1='system_admin' or ($1 in ('center_manager','supervisor') and c.id=$2::uuid) or ($1='teacher' and h.teacher_user_id=$3::uuid))
      order by jr.requested_at desc`,[u.role,u.center_id,u.id]);
    return json(res,200,{items:rows});
  }
  if(sub==='decide'&&req.method==='POST'){
    if(!isStaff(u.role))return json(res,403,{error:'Forbidden'});
    const id=validUuid(req.body?.request_id),decision=String(req.body?.decision||'');
    if(!id||!['approved','rejected'].includes(decision))return json(res,400,{error:'بيانات القرار غير صالحة'});
    const jr=(await query<any>(`select jr.*,h.center_id,h.teacher_user_id,us.full_name from circle_join_requests jr join circles h on h.id=jr.circle_id join users us on us.id=jr.user_id where jr.id=$1`,[id]))[0];
    if(!jr)return json(res,404,{error:'الطلب غير موجود'});
    const allowed=u.role==='system_admin'||(['center_manager','supervisor'].includes(u.role)&&u.center_id===jr.center_id)||(u.role==='teacher'&&u.id===jr.teacher_user_id);
    if(!allowed)return json(res,403,{error:'الطلب خارج نطاق صلاحيتك'});
    if(decision==='approved'&&jr.requested_role==='student'){
      await query('alter table students add column if not exists document_no text');
      await query('alter table students add column if not exists mobile text');
      const lr=(await query<any>('select document_no,phone from login_requests where auth_subject=(select auth_subject from users where id=$1) order by requested_at desc limit 1',[jr.user_id]))[0]||{};
      let st=(await query<any>('select * from students where user_id=$1',[jr.user_id]))[0];
      if(st)await query('update students set center_id=$1,circle_id=$2,status=\'active\',document_no=coalesce($3,document_no),mobile=coalesce($4,mobile),updated_at=now() where id=$5',[jr.center_id,jr.circle_id,lr.document_no||null,lr.phone||null,st.id]);
      else await query('insert into students(user_id,center_id,circle_id,full_name,status,document_no,mobile) values($1,$2,$3,$4,\'active\',$5,$6)',[jr.user_id,jr.center_id,jr.circle_id,jr.full_name||'طالب',lr.document_no||null,lr.phone||null]);
      await query("update users set is_active=true,role='student',center_id=$2 where id=$1",[jr.user_id,jr.center_id]);
      await query("update login_requests set status='approved' where auth_subject=(select auth_subject from users where id=$1) and status='pending'",[jr.user_id]);
    }
    await query('update circle_join_requests set status=$1,decided_by=$2,decided_at=now() where id=$3',[decision,u.id,id]);
    if(jr.requested_role==='student'&&decision==='rejected'){
      await query("update users set is_active=false where id=$1",[jr.user_id]);
      await query("update login_requests set status='rejected' where auth_subject=(select auth_subject from users where id=$1) and status='pending'",[jr.user_id]);
    }
    return json(res,200,{success:true});
  }
  return json(res,405,{error:'Method not allowed'});
}

let motivationSchemaReady:Promise<void>|null=null;
async function ensureMotivationSchema(){
  if(!motivationSchemaReady)motivationSchemaReady=(async()=>{
    await query('alter table circle_tasks add column if not exists max_points numeric(10,2)');
    await query('alter table circle_tasks add column if not exists sort_order integer not null default 0');
    await query('alter table circles add column if not exists task_defaults_version integer not null default 0');
    await query('alter table circle_tasks alter column points_per_unit type numeric(10,4) using points_per_unit::numeric');
    await query('alter table task_entries alter column points type numeric(10,2) using points::numeric');
    await query('alter table students alter column points_balance type numeric(12,2) using points_balance::numeric');
    await query('alter table points_ledger alter column points type numeric(12,2) using points::numeric');
    await query('update circle_tasks set max_points=round((points_per_unit*greatest(max_units,1))::numeric,2) where max_points is null');
  })();
  return motivationSchemaReady;
}
function decimal(value:any,min=0,max=100000){
  const n=Number(value);if(!Number.isFinite(n))return min;return Math.min(max,Math.max(min,Math.round(n*100)/100));
}
async function seedDefaultTasks(circleId:string,creatorId:string){
  await query(`with marked as (
      update circles set task_defaults_version=1 where id=$1 and task_defaults_version<1 returning id
    ), defaults(name,answer_type,points_per_unit,max_units,max_points,sort_order) as (values
      ('الوتر','done',2::numeric,1,2::numeric,1),
      ('سورة الملك','done',2::numeric,1,2::numeric,2),
      ('أذكار الصباح والمساء','done',2::numeric,1,2::numeric,3),
      ('صلاة الجماعة','count',1::numeric,5,5::numeric,4),
      ('السنن الرواتب','count',0.1667::numeric,12,2::numeric,5)
    )
    insert into circle_tasks(circle_id,name,answer_type,points_per_unit,max_units,max_points,sort_order,created_by)
    select marked.id,d.name,d.answer_type,d.points_per_unit,d.max_units,d.max_points,d.sort_order,$2
    from marked cross join defaults d
    where not exists(select 1 from circle_tasks t where t.circle_id=marked.id and t.name=d.name)`,[circleId,creatorId]);
}
async function allowedCircle(u:any,circleId:string){
  return (await query<any>(`select id,name,center_id from circles where id=$1 and ($2='system_admin' or ($2 in ('center_manager','supervisor') and center_id=$3::uuid) or ($2='teacher' and teacher_user_id=$4::uuid) or exists(select 1 from students s where s.circle_id=circles.id and s.user_id=$4::uuid))`,[circleId,u.role,u.center_id,u.id]))[0]||null;
}

export async function motivation(req:any,res:any,u:any){
  await ensureMotivationSchema();
  const sub=String(req.query?.sub||'list');
  if(sub==='list'&&req.method==='GET'){
    const month=validMonth(req.query?.month)||today().slice(0,7);
    let target:any=null;
    if(req.query?.student_id)target=await scopedStudent(u,req.query.student_id);
    if(!target&&u.role==='student')target=(await query<any>('select * from students where user_id=$1',[u.id]))[0];
    let circleId=validUuid(req.query?.circle_id)||target?.circle_id||null;
    if(!circleId&&u.role==='teacher')circleId=(await query<any>('select id from circles where teacher_user_id=$1 and is_active order by name limit 1',[u.id]))[0]?.id||null;
    if(!circleId&&managers.includes(u.role))circleId=(await query<any>(`select id from circles where $1='system_admin' or center_id=$2::uuid order by name limit 1`,[u.role,u.center_id]))[0]?.id||null;
    if(!circleId)return json(res,200,{month,tasks:[],students:[],entries:[],rewards:[],requests:[],rankings:[],top3:[],centerTop10:[],mostImproved:[],centerMostImproved:[]});
    const circle=await allowedCircle(u,circleId);if(!circle)return json(res,403,{error:'الحلقة خارج نطاق صلاحيتك'});
    await seedDefaultTasks(circleId,u.id);
    const [tasks,students,entries,rewards,requests,rankings]=await Promise.all([
      query<any>(`select t.* from circle_tasks t where t.circle_id=$1 and (t.is_active or exists(select 1 from task_entries e where e.task_id=t.id and to_char(e.entry_date,'YYYY-MM')=$2)) order by t.sort_order,t.created_at`,[circleId,month]),
      query<any>(`select id,full_name,points_balance from students where circle_id=$1 and status='active' order by full_name`,[circleId]),
      query<any>(`select e.*,t.name task_name,t.answer_type,t.max_units,t.max_points,t.is_active from task_entries e join circle_tasks t on t.id=e.task_id where t.circle_id=$1 and to_char(e.entry_date,'YYYY-MM')=$2 and ($3::uuid is null or e.student_id=$3) order by e.entry_date,e.created_at`,[circleId,month,target?.id||null]),
      query<any>('select * from rewards where is_active and circle_id=$1 order by points_cost',[circleId]),
      query<any>(`select rr.*,r.name reward_name,s.full_name from reward_requests rr join rewards r on r.id=rr.reward_id join students s on s.id=rr.student_id where r.circle_id=$1 and ($2::uuid is null or rr.student_id=$2) order by rr.requested_at desc`,[circleId,target?.id||null]),
      query<any>(`select s.id,s.full_name,s.points_balance,coalesce((select round(avg(m.grade))::int from memorization_records m where m.student_id=s.id and m.record_date>=current_date-29),0) quran_average,
        coalesce((select round(100.0*count(*) filter(where a.status in ('present','late'))/nullif(count(*),0))::int from attendance a where a.student_id=s.id and a.attendance_date>=current_date-29),0) attendance_rate
        from students s where s.circle_id=$1 and s.status='active' order by s.points_balance desc,quran_average desc,attendance_rate desc limit 30`,[circleId])
    ]);
    const top3=rankings.slice(0,3);
    const centerTop10=await query<any>(`select s.id,s.full_name,h.name circle_name,s.points_balance from students s left join circles h on h.id=s.circle_id where s.center_id=$1 and s.status='active' order by s.points_balance desc limit 10`,[circle.center_id]);
    const mostImproved=await query<any>(`select s.id,s.full_name,
      round(coalesce((select avg(m.grade) from memorization_records m where m.student_id=s.id and m.record_date between current_date-6 and current_date),0))::int current_avg,
      round(coalesce((select avg(m.grade) from memorization_records m where m.student_id=s.id and m.record_date between current_date-13 and current_date-7),0))::int previous_avg
      from students s where s.circle_id=$1 and s.status='active' order by
      (coalesce((select avg(m.grade) from memorization_records m where m.student_id=s.id and m.record_date between current_date-6 and current_date),0)-
       coalesce((select avg(m.grade) from memorization_records m where m.student_id=s.id and m.record_date between current_date-13 and current_date-7),0)) desc limit 10`,[circleId]);
    const centerMostImproved=await query<any>(`select s.id,s.full_name,h.name circle_name,
      round(coalesce((select avg(m.grade) from memorization_records m where m.student_id=s.id and m.record_date between current_date-6 and current_date),0))::int current_avg,
      round(coalesce((select avg(m.grade) from memorization_records m where m.student_id=s.id and m.record_date between current_date-13 and current_date-7),0))::int previous_avg
      from students s left join circles h on h.id=s.circle_id where s.center_id=$1 and s.status='active'
      order by (coalesce((select avg(m.grade) from memorization_records m where m.student_id=s.id and m.record_date between current_date-6 and current_date),0)-coalesce((select avg(m.grade) from memorization_records m where m.student_id=s.id and m.record_date between current_date-13 and current_date-7),0)) desc limit 10`,[circle.center_id]);
    return json(res,200,{month,circle,student:target,tasks,students,entries,rewards,requests,rankings,top3,centerTop10,mostImproved,centerMostImproved});
  }
  if(sub==='task'&&req.method==='POST'){
    if(!isStaff(u.role))return json(res,403,{error:'Forbidden'});
    const b=req.body||{},circleId=validUuid(b.circle_id);if(!circleId)return json(res,400,{error:'اختر الحلقة'});
    const circle=await allowedCircle(u,circleId);if(!circle)return json(res,403,{error:'الحلقة خارج نطاق صلاحيتك'});
    const name=txt(b.name,200);if(!name)return json(res,400,{error:'اسم المهمة مطلوب'});
    const answer=String(b.answer_type||'done');if(!['done','count'].includes(answer))return json(res,400,{error:'نوع المهمة غير صالح'});
    const maxUnits=answer==='done'?1:int(b.max_units,1,100),maxPoints=decimal(b.max_points||b.points_per_unit||1,0.01,1000),perUnit=Math.round(maxPoints/maxUnits*10000)/10000;
    const row=(await query<any>('insert into circle_tasks(circle_id,name,answer_type,points_per_unit,max_units,max_points,sort_order,created_by) values($1,$2,$3,$4,$5,$6,$7,$8) returning *',
      [circleId,name,answer,perUnit,maxUnits,maxPoints,int(b.sort_order,0,1000),u.id]))[0];
    return json(res,201,row);
  }
  if(sub==='task-edit'&&req.method==='PUT'){
    if(!isStaff(u.role))return json(res,403,{error:'Forbidden'});
    const b=req.body||{},id=validUuid(b.task_id||b.id);if(!id)return json(res,400,{error:'المهمة غير صالحة'});
    const task=(await query<any>('select t.*,c.center_id,c.teacher_user_id from circle_tasks t join circles c on c.id=t.circle_id where t.id=$1',[id]))[0];if(!task)return json(res,404,{error:'المهمة غير موجودة'});
    const allowed=u.role==='system_admin'||(['center_manager','supervisor'].includes(u.role)&&task.center_id===u.center_id)||(u.role==='teacher'&&task.teacher_user_id===u.id);if(!allowed)return json(res,403,{error:'المهمة خارج نطاق صلاحيتك'});
    const answer=String(b.answer_type||task.answer_type);if(!['done','count'].includes(answer))return json(res,400,{error:'نوع المهمة غير صالح'});
    const maxUnits=answer==='done'?1:int(b.max_units??task.max_units,1,100),maxPoints=decimal(b.max_points??task.max_points??1,0.01,1000),perUnit=Math.round(maxPoints/maxUnits*10000)/10000;
    const row=(await query<any>('update circle_tasks set name=$2,answer_type=$3,points_per_unit=$4,max_units=$5,max_points=$6,sort_order=$7 where id=$1 returning *',
      [id,txt(b.name||task.name,200),answer,perUnit,maxUnits,maxPoints,int(b.sort_order??task.sort_order,0,1000)]))[0];
    return json(res,200,row);
  }
  if(sub==='task-delete'&&req.method==='POST'){
    if(!isStaff(u.role))return json(res,403,{error:'Forbidden'});
    const id=validUuid(req.body?.task_id);if(!id)return json(res,400,{error:'المهمة غير صالحة'});
    const task=(await query<any>('select t.*,c.center_id,c.teacher_user_id from circle_tasks t join circles c on c.id=t.circle_id where t.id=$1',[id]))[0];if(!task)return json(res,404,{error:'المهمة غير موجودة'});
    const allowed=u.role==='system_admin'||(['center_manager','supervisor'].includes(u.role)&&task.center_id===u.center_id)||(u.role==='teacher'&&task.teacher_user_id===u.id);if(!allowed)return json(res,403,{error:'المهمة خارج نطاق صلاحيتك'});
    await query('update circle_tasks set is_active=false where id=$1',[id]);return json(res,200,{success:true});
  }
  if(sub==='entry'&&req.method==='POST'){
    const b=req.body||{};let s:any;
    if(u.role==='student')s=(await query<any>('select * from students where user_id=$1',[u.id]))[0];
    else s=await scopedStudent(u,b.student_id);
    if(!s)return json(res,404,{error:'الطالب غير موجود أو خارج النطاق'});
    const d=validDate(b.entry_date)||today();if(u.role==='student'&&d!==today())return json(res,403,{error:'يمكن للطالب التسجيل في اليوم الحالي فقط'});
    const task=(await query<any>('select * from circle_tasks where id=$1 and circle_id=$2 and is_active',[validUuid(b.task_id),s.circle_id]))[0];if(!task)return json(res,400,{error:'المهمة غير متاحة'});
    const maxUnits=Math.max(1,Number(task.max_units||1)),units=int(b.units,0,maxUnits),maxPoints=Number(task.max_points??Number(task.points_per_unit||0)*maxUnits),points=Math.round((units/maxUnits)*maxPoints*100)/100;
    const old=(await query<any>('select points from task_entries where task_id=$1 and student_id=$2 and entry_date=$3',[task.id,s.id,d]))[0];
    const row=(await query<any>(`insert into task_entries(task_id,student_id,entry_date,units,points,updated_by) values($1,$2,$3,$4,$5,$6)
      on conflict(task_id,student_id,entry_date) do update set units=excluded.units,points=excluded.points,updated_by=excluded.updated_by,updated_at=now() returning *`,
      [task.id,s.id,d,units,points,u.id]))[0];
    const delta=Math.round((points-Number(old?.points||0))*100)/100;
    if(delta){
      await query('update students set points_balance=greatest(0,points_balance+$1::numeric) where id=$2',[delta,s.id]);
      await query(`insert into points_ledger(student_id,points,reason,source_type,created_by) values($1,$2,$3,'circle_task',$4)`,[s.id,delta,`مهمة: ${task.name}`,u.id]);
    }
    return json(res,200,row);
  }
  if(sub==='reward'&&req.method==='POST'){
    if(!isStaff(u.role))return json(res,403,{error:'Forbidden'});
    const b=req.body||{},circleId=validUuid(b.circle_id);if(!circleId)return json(res,400,{error:'اختر الحلقة'});
    const circle=await allowedCircle(u,circleId);if(!circle)return json(res,403,{error:'الحلقة خارج نطاق صلاحيتك'});
    return json(res,201,(await query<any>('insert into rewards(name,description,points_cost,stock,circle_id,image_path) values($1,$2,$3,$4,$5,$6) returning *',[txt(b.name,200),txt(b.description,1000)||null,int(b.points_cost,1,100000),int(b.stock,0,100000),circleId,txt(b.image_path,1000)||null]))[0]);
  }
  if(sub==='reward-request'&&req.method==='POST'){
    if(u.role!=='student')return json(res,403,{error:'هذه الخدمة للطالب'});
    const s=(await query<any>('select * from students where user_id=$1',[u.id]))[0];if(!s)return json(res,404,{error:'لم يتم ربط الحساب بالطالب'});
    const reward=(await query<any>('select * from rewards where id=$1 and circle_id=$2 and is_active',[validUuid(req.body?.reward_id),s.circle_id]))[0];
    if(!reward||Number(reward.stock)<1)return json(res,400,{error:'الجائزة غير متاحة'});
    if(Number(s.points_balance)<Number(reward.points_cost))return json(res,400,{error:'رصيد النقاط غير كاف'});
    const pending=(await query<any>(`select id from reward_requests where reward_id=$1 and student_id=$2 and status='pending'`,[reward.id,s.id]))[0];if(pending)return json(res,400,{error:'لديك طلب قائم لهذه الجائزة'});
    return json(res,201,(await query<any>('insert into reward_requests(reward_id,student_id) values($1,$2) returning *',[reward.id,s.id]))[0]);
  }
  if(sub==='reward-approve'&&req.method==='POST'){
    if(!isStaff(u.role))return json(res,403,{error:'Forbidden'});
    const requestId=validUuid(req.body?.request_id);if(!requestId)return json(res,400,{error:'طلب غير صالح'});
    const rr=(await query<any>(`select rr.*,r.circle_id,c.teacher_user_id,c.center_id from reward_requests rr join rewards r on r.id=rr.reward_id join circles c on c.id=r.circle_id where rr.id=$1`,[requestId]))[0];
    if(!rr||rr.status!=='pending')return json(res,400,{error:'الطلب غير متاح'});
    const allowed=u.role==='system_admin'||(managers.includes(u.role)&&u.center_id===rr.center_id)||(u.role==='teacher'&&u.id===rr.teacher_user_id);if(!allowed)return json(res,403,{error:'الطلب خارج نطاق صلاحيتك'});
    await query(`update reward_requests set status='approved',decided_by=$1,decided_at=now() where id=$2`,[u.id,requestId]);return json(res,200,{success:true,status:'approved'});
  }
  if(sub==='reward-deliver'&&req.method==='POST'){
    if(!isStaff(u.role))return json(res,403,{error:'Forbidden'});
    const requestId=validUuid(req.body?.request_id);if(!requestId)return json(res,400,{error:'طلب غير صالح'});
    const client=await getPool().connect();
    try{
      await client.query('begin');
      const rr=(await client.query(`select rr.*,r.points_cost,r.stock,r.circle_id,c.teacher_user_id,c.center_id from reward_requests rr join rewards r on r.id=rr.reward_id join circles c on c.id=r.circle_id where rr.id=$1 for update`,[requestId])).rows[0];
      if(!rr||rr.status!=='approved')throw new Error('يجب اعتماد الطلب أولاً');
      const allowed=u.role==='system_admin'||(managers.includes(u.role)&&u.center_id===rr.center_id)||(u.role==='teacher'&&u.id===rr.teacher_user_id);if(!allowed)throw new Error('الطلب خارج نطاق صلاحيتك');
      if(Number(rr.stock)<1)throw new Error('نفدت الكمية');
      const changed=await client.query('update students set points_balance=points_balance-$1 where id=$2 and points_balance>=$1 returning id',[rr.points_cost,rr.student_id]);if(!changed.rowCount)throw new Error('رصيد الطالب لم يعد كافيًا');
      await client.query('update rewards set stock=stock-1 where id=$1',[rr.reward_id]);
      await client.query(`update reward_requests set status='delivered',delivered_by=$1,delivered_at=now() where id=$2`,[u.id,requestId]);
      await client.query(`insert into points_ledger(student_id,points,reason,source_type,created_by) values($1,$2,'تسليم جائزة','reward',$3)`,[rr.student_id,-Number(rr.points_cost),u.id]);
      await client.query('commit');return json(res,200,{success:true,status:'delivered'});
    }catch(e){await client.query('rollback');throw e}finally{client.release()}
  }
  return json(res,405,{error:'Method not allowed'});
}

export async function notifications(req:any,res:any,u:any){
  if(req.method==='GET')return json(res,200,await query<any>('select * from inapp_notifications where user_id=$1 order by created_at desc limit 100',[u.id]));
  const sub=String(req.query?.sub||'');
  if(req.method==='POST'&&sub==='student-message'){
    if(!isStaff(u.role))return json(res,403,{error:'Forbidden'});
    const s=await scopedStudent(u,req.body?.student_id);if(!s)return json(res,404,{error:'الطالب غير موجود أو خارج نطاقك'});
    const target=(await query<any>('select s.id,s.user_id,s.mobile,us.phone from students s left join users us on us.id=s.user_id where s.id=$1',[s.id]))[0];
    const title=txt(req.body?.title||'رسالة من المعلم',200),body=txt(req.body?.body,2000);if(!body)return json(res,400,{error:'نص الرسالة مطلوب'});
    if(target?.user_id)await query("insert into inapp_notifications(user_id,title,body,kind) values($1,$2,$3,'teacher_message')",[target.user_id,title,body]);
    return json(res,200,{success:true,inapp_sent:Boolean(target?.user_id),mobile_prepared:Boolean(target?.mobile||target?.phone),mobile_sent:false,phone:target?.mobile||target?.phone||null,message:'تم حفظ الرسالة داخل المنصة. إرسال الجوال مجهز وغير مفعل حاليًا.'});
  }
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

export async function competitions(req:any,res:any,u:any){
  await query('alter table competitions add column if not exists circle_id uuid references circles(id)');
  await query('alter table competitions add column if not exists max_points integer not null default 100');
  const sub=String(req.query?.sub||'list'),canManage=['system_admin','center_manager','supervisor'].includes(u.role);
  if(req.method==='GET'){
    let rows:any[]=[];
    if(u.role==='system_admin')rows=await query<any>(`select c.*,h.name circle_name,ce.name center_name,coalesce((select json_agg(x order by x.score desc) from (select e.score,e.notes,s.id student_id,s.full_name,ch.name student_circle from competition_entries e join students s on s.id=e.student_id left join circles ch on ch.id=s.circle_id where e.competition_id=c.id)x),'[]'::json) entries from competitions c left join circles h on h.id=c.circle_id left join centers ce on ce.id=c.center_id order by c.start_date desc`);
    else if(u.role==='teacher')rows=await query<any>(`select c.*,h.name circle_name,ce.name center_name,coalesce((select json_agg(x order by x.score desc) from (select e.score,e.notes,s.id student_id,s.full_name,ch.name student_circle from competition_entries e join students s on s.id=e.student_id left join circles ch on ch.id=s.circle_id where e.competition_id=c.id)x),'[]'::json) entries from competitions c left join circles h on h.id=c.circle_id left join centers ce on ce.id=c.center_id where c.center_id=$1::uuid and (c.circle_id is null or c.circle_id in(select id from circles where teacher_user_id=$2)) order by c.start_date desc`,[u.center_id,u.id]);
    else rows=await query<any>(`select c.*,h.name circle_name,ce.name center_name,coalesce((select json_agg(x order by x.score desc) from (select e.score,e.notes,s.id student_id,s.full_name,ch.name student_circle from competition_entries e join students s on s.id=e.student_id left join circles ch on ch.id=s.circle_id where e.competition_id=c.id)x),'[]'::json) entries from competitions c left join circles h on h.id=c.circle_id left join centers ce on ce.id=c.center_id where c.center_id=$1::uuid order by c.start_date desc`,[u.center_id]);
    return json(res,200,rows);
  }
  if(req.method==='POST'&&sub==='create'){
    if(!canManage)return json(res,403,{error:'إنشاء سجل مسابقات المركز من صلاحيات إدارة المركز'});
    const b=req.body||{},start=validDate(b.start_date),end=validDate(b.end_date),title=txt(b.title,300);if(!title)return json(res,400,{error:'اسم المسابقة مطلوب'});if(!start||!end||start>end)return json(res,400,{error:'تواريخ المسابقة غير صالحة'});
    const centerId=u.role==='system_admin'?validUuid(b.center_id):u.center_id;if(!centerId)return json(res,400,{error:'اختر المركز'});
    const row=(await query<any>('insert into competitions(center_id,circle_id,title,start_date,end_date,max_points,created_by) values($1,null,$2,$3,$4,$5,$6) returning *',[centerId,title,start,end,int(b.max_points,1,10000),u.id]))[0];
    return json(res,201,row);
  }
  if(req.method==='PUT'&&sub==='edit'){
    if(!canManage)return json(res,403,{error:'تعديل سجل مسابقات المركز من صلاحيات إدارة المركز'});
    const b=req.body||{},id=validUuid(b.id);if(!id)return json(res,400,{error:'المسابقة غير صالحة'});
    const c=(await query<any>('select * from competitions where id=$1',[id]))[0];if(!c)return json(res,404,{error:'المسابقة غير موجودة'});
    if(u.role!=='system_admin'&&c.center_id!==u.center_id)return json(res,403,{error:'المسابقة خارج مركزك'});
    const row=(await query<any>('update competitions set title=coalesce($2,title),start_date=coalesce($3::date,start_date),end_date=coalesce($4::date,end_date),max_points=coalesce($5,max_points) where id=$1 returning *',[id,b.title?txt(b.title,300):null,b.start_date||null,b.end_date||null,b.max_points?int(b.max_points,1,10000):null]))[0];
    return json(res,200,row);
  }
  if(req.method==='POST'&&sub==='score'){
    if(!isStaff(u.role))return json(res,403,{error:'Forbidden'});
    const b=req.body||{},s=await scopedStudent(u,b.student_id),competitionId=validUuid(b.competition_id);if(!s||!competitionId)return json(res,400,{error:'بيانات الطالب أو المسابقة غير صالحة'});
    const comp=(await query<any>('select id,center_id,circle_id,max_points from competitions where id=$1 and center_id=$2',[competitionId,s.center_id]))[0];if(!comp||(comp.circle_id&&comp.circle_id!==s.circle_id))return json(res,403,{error:'المسابقة غير متاحة لهذا الطالب'});
    if(u.role==='teacher'&&comp.circle_id&&!(await query<any>('select id from circles where id=$1 and teacher_user_id=$2',[comp.circle_id,u.id]))[0])return json(res,403,{error:'المسابقة خارج نطاق حلقتك'});
    const row=(await query<any>(`insert into competition_entries(competition_id,student_id,score,notes,updated_by) values($1,$2,$3,$4,$5)
      on conflict(competition_id,student_id) do update set score=excluded.score,notes=excluded.notes,updated_by=excluded.updated_by,updated_at=now() returning *`,
      [competitionId,s.id,int(b.score,0,Number(comp.max_points||100)),txt(b.notes,1000)||null,u.id]))[0];
    return json(res,200,row);
  }
  return json(res,405,{error:'Method not allowed'});
}
