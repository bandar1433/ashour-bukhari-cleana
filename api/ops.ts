import { getPool, query } from './_lib/db.js';
import { getActor,isStaff,validDate,validMonth,validUuid } from './_lib/actor.js';
import { handleError,json } from './_lib/http.js';

import { managers,today,int,txt,scopedStudent } from './_ops/shared.js';
import { summary,teacherToday,circleRegister,evaluations,studentProfile,dayApprove } from './_ops/teacher.js';








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
      const fromPage=b.from_page?int(b.from_page,1,604):null,toPage=b.to_page?int(b.to_page,fromPage||1,604):null;
      const pages=fromPage&&toPage?Math.max(1,toPage-fromPage+1):null;
      const notes=[txt(b.notes,800),pages?`— ${pages} صفحة`:''].filter(Boolean).join(' ');
      const row=(await query<any>(`insert into memorization_records(student_id,record_type,surah_no,from_ayah,to_ayah,from_page,to_page,ayah_count,grade,notes,qiraah,approved,record_date)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'حفص عن عاصم',false,current_date) returning *`,
        [s.id,recordType,surah,from,to,fromPage,toPage,to-from+1,b.grade?Number(b.grade):null,notes||null]))[0];
      return json(res,201,row);
    }
  }
  return json(res,405,{error:'Method not allowed'});
}
async function joinRequests(req:any,res:any,u:any){
  const sub=String(req.query?.sub||'list');
  if(sub==='circles'&&req.method==='GET'){
    return json(res,200,{items:await query<any>("select h.id,h.name,c.name center_name from circles h join centers c on c.id=h.center_id where h.is_active order by c.name,h.name")});
  }
  if(sub==='request'&&req.method==='POST'){
    if(!['student','guardian'].includes(u.role))return json(res,403,{error:'هذه الخدمة للطالب أو ولي الأمر'});
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
      let st=(await query<any>('select * from students where user_id=$1',[jr.user_id]))[0];
      if(st)await query('update students set center_id=$1,circle_id=$2,status=\'active\',updated_at=now() where id=$3',[jr.center_id,jr.circle_id,st.id]);
      else await query('insert into students(user_id,center_id,circle_id,full_name,status) values($1,$2,$3,$4,\'active\')',[jr.user_id,jr.center_id,jr.circle_id,jr.full_name||'طالب']);
    }
    await query('update circle_join_requests set status=$1,decided_by=$2,decided_at=now() where id=$3',[decision,u.id,id]);
    return json(res,200,{success:true});
  }
  return json(res,405,{error:'Method not allowed'});
}
async function motivation(req:any,res:any,u:any){
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
    return json(res,201,(await query<any>('insert into rewards(name,description,points_cost,stock,circle_id,image_path) values($1,$2,$3,$4,$5,$6) returning *',[txt(b.name,200),txt(b.description,1000)||null,int(b.points_cost,1,100000),int(b.stock,0,100000),circleId,txt(b.image_path,1000)||null]))[0]);
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
    const rr=(await query<any>(`select rr.*,r.circle_id,c.teacher_user_id,c.center_id from reward_requests rr join rewards r on r.id=rr.reward_id join circles c on c.id=r.circle_id where rr.id=$1`,[requestId]))[0];
    if(!rr||rr.status!=='pending')return json(res,400,{error:'الطلب غير متاح'});
    const allowed=u.role==='system_admin'||(managers.includes(u.role)&&u.center_id===rr.center_id)||(u.role==='teacher'&&u.id===rr.teacher_user_id);
    if(!allowed)return json(res,403,{error:'الطلب خارج نطاق صلاحيتك'});
    await query(`update reward_requests set status='approved',decided_by=$1,decided_at=now() where id=$2`,[u.id,requestId]);
    return json(res,200,{success:true,status:'approved'});
  }
  if(sub==='reward-deliver'&&req.method==='POST'){
    if(!isStaff(u.role))return json(res,403,{error:'Forbidden'});
    const requestId=validUuid(req.body?.request_id);if(!requestId)return json(res,400,{error:'طلب غير صالح'});
    const client=await getPool().connect();
    try{
      await client.query('begin');
      const rr=(await client.query(`select rr.*,r.points_cost,r.stock,r.circle_id,c.teacher_user_id,c.center_id from reward_requests rr join rewards r on r.id=rr.reward_id join circles c on c.id=r.circle_id where rr.id=$1 for update`,[requestId])).rows[0];
      if(!rr||rr.status!=='approved')throw new Error('يجب اعتماد الطلب أولاً');
      const allowed=u.role==='system_admin'||(managers.includes(u.role)&&u.center_id===rr.center_id)||(u.role==='teacher'&&u.id===rr.teacher_user_id);
      if(!allowed)throw new Error('الطلب خارج نطاق صلاحيتك');
      if(Number(rr.stock)<1)throw new Error('نفدت الكمية');
      const changed=await client.query('update students set points_balance=points_balance-$1 where id=$2 and points_balance>=$1 returning id',[rr.points_cost,rr.student_id]);
      if(!changed.rowCount)throw new Error('رصيد الطالب لم يعد كافيًا');
      await client.query('update rewards set stock=stock-1 where id=$1',[rr.reward_id]);
      await client.query(`update reward_requests set status='delivered',delivered_by=$1,delivered_at=now() where id=$2`,[u.id,requestId]);
      await client.query(`insert into points_ledger(student_id,points,reason,source_type,created_by) values($1,$2,'تسليم جائزة','reward',$3)`,[rr.student_id,-rr.points_cost,u.id]);
      await client.query('commit');return json(res,200,{success:true,status:'delivered'});
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
    if(action==='join-requests')return joinRequests(req,res,u);
    if(action==='motivation')return motivation(req,res,u);
    if(action==='notifications')return notifications(req,res,u);
    if(action==='competitions')return competitions(req,res,u);
    if(action==='management-report')return managementReport(req,res,u);
    if(action==='admin-operations')return adminOperations(req,res,u);
    return json(res,404,{error:'Unknown operation'});
  }catch(e){return handleError(res,e)}
}
