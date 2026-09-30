import { getPool,query } from './_lib/db.js';
import { getActor,validUuid } from './_lib/actor.js';
import { handleError,json } from './_lib/http.js';

function teacherIds(body:any){
  const raw=Array.isArray(body?.teacher_user_ids)?body.teacher_user_ids:(body?.teacher_user_id?[body.teacher_user_id]:[]);
  return [...new Set(raw.map((x:any)=>validUuid(x)).filter(Boolean))] as string[];
}
async function validateTeachers(ids:string[],centerId:string){
  if(!ids.length)return;
  const rows=await query<any>(`select id from users where id=any($1::uuid[]) and role='teacher' and is_active and center_id=$2::uuid`,[ids,centerId]);
  if(rows.length!==ids.length)throw new Error('بعض المعلمين غير نشطين أو لا يتبعون مركز الحلقة');
}
async function replaceTeachers(circleId:string,ids:string[],assignedBy:string|null){
  const client=await getPool().connect();
  try{
    await client.query('begin');
    await client.query('delete from circle_teachers where circle_id=$1',[circleId]);
    for(let i=0;i<ids.length;i++)await client.query(
      'insert into circle_teachers(circle_id,teacher_user_id,is_primary,assigned_by) values($1,$2,$3,$4)',
      [circleId,ids[i],i===0,assignedBy]
    );
    await client.query('update circles set teacher_user_id=$2 where id=$1',[circleId,ids[0]||null]);
    await client.query('commit');
  }catch(e){await client.query('rollback');throw e}finally{client.release()}
}

export default async function handler(req:any,res:any){
 try{
  const u=await getActor(req,res);if(!u)return;
  if(req.method==='GET'){
   const rows=await query(`
    select c.id,c.name,c.center_id,c.teacher_user_id,c.schedule,c.circle_type,c.start_time,c.grace_minutes,c.student_track,c.quran_track,c.is_active,
      ce.name center_name,
      coalesce((select json_agg(json_build_object('id',t.id,'full_name',t.full_name,'email',t.email,'is_primary',ct.is_primary) order by ct.is_primary desc,t.full_name)
        from circle_teachers ct join users t on t.id=ct.teacher_user_id where ct.circle_id=c.id),'[]'::json) teachers,
      coalesce((select string_agg(t.full_name,'، ' order by ct.is_primary desc,t.full_name)
        from circle_teachers ct join users t on t.id=ct.teacher_user_id where ct.circle_id=c.id),'') teacher_names,
      (select count(*)::int from students s where s.circle_id=c.id) students_count
    from circles c
    left join centers ce on ce.id=c.center_id
    where $1='system_admin'
       or ($1 in ('center_manager','supervisor') and c.center_id=$2::uuid)
       or ($1='teacher' and is_circle_teacher(c.id,$3::uuid))
    order by c.name limit 200
   `,[u.role,u.center_id,u.id]);
   return json(res,200,{items:rows});
  }
  if(req.method==='POST'){
   if(!['system_admin','center_manager','supervisor'].includes(u.role))return json(res,403,{error:'Forbidden',message:'إضافة الحلقات غير متاحة لهذا الحساب.'});
   const b=req.body||{}; if(!b.name?.trim()||!b.center_id)return json(res,400,{error:'اسم الحلقة والمركز مطلوبان'});
   if(u.role!=='system_admin'&&b.center_id!==u.center_id)return json(res,403,{error:'Forbidden',message:'لا يمكنك إضافة حلقة خارج مركزك.'});
   const ids=teacherIds(b);await validateTeachers(ids,b.center_id);
   const row=(await query<any>(`insert into circles(center_id,name,teacher_user_id,schedule,circle_type,start_time,grace_minutes,student_track,quran_track,is_active) values($1,$2,$3,$4,$5,$6,$7,$8,$9,true) returning *`,[b.center_id,b.name.trim(),ids[0]||null,b.schedule||null,b.circle_type||'memorization',b.start_time||null,b.grace_minutes===''||b.grace_minutes==null?10:Number(b.grace_minutes),b.student_track||null,b.quran_track||null]))[0];
   await replaceTeachers(row.id,ids,u.id);return json(res,201,row);
  }
  if(req.method==='PUT'){
   if(!['system_admin','center_manager','supervisor','teacher'].includes(u.role))return json(res,403,{error:'Forbidden',message:'تعديل الحلقات غير متاح لهذا الحساب.'});
   const b=req.body||{}; if(!b.id)return json(res,400,{error:'معرف الحلقة مطلوب'});
   const e=(await query<any>('select * from circles where id=$1',[b.id]))[0];
   if(!e)return json(res,404,{error:'الحلقة غير موجودة'});
   if(u.role==='teacher'&&!(await query<any>('select is_circle_teacher($1,$2) ok',[e.id,u.id]))[0]?.ok)return json(res,403,{error:'Forbidden',message:'الحلقة خارج نطاقك.'});
   if(u.role!=='system_admin'&&u.role!=='teacher'&&e.center_id!==u.center_id)return json(res,403,{error:'Forbidden',message:'الحلقة خارج مركزك.'});
   if(u.role==='teacher'){const rows=await query('update circles set start_time=$2 where id=$1 returning *',[e.id,b.start_time===undefined?e.start_time:(b.start_time||null)]);return json(res,200,rows[0])}
   const centerId=u.role==='system_admin'?(b.center_id||e.center_id):u.center_id;
   const rows=await query(`update circles set name=coalesce($2,name),center_id=$3::uuid,schedule=$4,circle_type=coalesce($5,circle_type),start_time=$6,grace_minutes=coalesce($7,grace_minutes),student_track=$8,quran_track=$9,is_active=coalesce($10,is_active) where id=$1 returning *`,
    [b.id,b.name?.trim()||null,centerId,b.schedule===undefined?e.schedule:(b.schedule||null),b.circle_type||null,b.start_time===undefined?e.start_time:(b.start_time||null),b.grace_minutes===undefined?e.grace_minutes:Number(b.grace_minutes),b.student_track===undefined?e.student_track:(b.student_track||null),b.quran_track===undefined?e.quran_track:(b.quran_track||null),b.is_active===undefined?e.is_active:Boolean(b.is_active)]);
   if(b.teacher_user_ids!==undefined||b.teacher_user_id!==undefined){const ids=teacherIds(b);await validateTeachers(ids,centerId);await replaceTeachers(e.id,ids,u.id)}
   return json(res,200,rows[0]);
  }
  return json(res,405,{error:'Method not allowed'});
 }catch(e){return handleError(res,e)}
}
