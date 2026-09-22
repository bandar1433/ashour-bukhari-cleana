import { query } from './_lib/db.js';
import { getActor } from './_lib/actor.js';
import { handleError,json } from './_lib/http.js';

export default async function handler(req:any,res:any){
 try{
  const u=await getActor(req,res);if(!u)return;
  if(req.method==='GET'){
   const rows=await query(`
    select c.id,c.name,c.center_id,c.teacher_user_id,c.schedule,c.circle_type,c.start_time,c.grace_minutes,c.student_track,c.quran_track,c.is_active,
      ce.name center_name,t.full_name teacher_name,t.email teacher_email,count(s.id)::int students_count
    from circles c
    left join centers ce on ce.id=c.center_id
    left join users t on t.id=c.teacher_user_id
    left join students s on s.circle_id=c.id
    where $1='system_admin'
       or ($1 in ('center_manager','supervisor') and c.center_id=$2::uuid)
       or ($1='teacher' and c.teacher_user_id=$3::uuid)
    group by c.id,ce.name,t.full_name,t.email order by c.name limit 200
   `,[u.role,u.center_id,u.id]);
   return json(res,200,{items:rows});
  }
  if(req.method==='POST'){
   if(!['system_admin','center_manager'].includes(u.role))return json(res,403,{error:'Forbidden',message:'إضافة الحلقات غير متاحة لهذا الحساب.'});
   const b=req.body||{}; if(!b.name?.trim()||!b.center_id)return json(res,400,{error:'اسم الحلقة والمركز مطلوبان'});
   if(u.role!=='system_admin'&&b.center_id!==u.center_id)return json(res,403,{error:'Forbidden',message:'لا يمكنك إضافة حلقة خارج مركزك.'});
   const rows=await query(`insert into circles(center_id,name,teacher_user_id,schedule,circle_type,start_time,grace_minutes,student_track,quran_track,is_active) values($1,$2,$3,$4,$5,$6,$7,$8,$9,true) returning *`,[b.center_id,b.name.trim(),b.teacher_user_id||null,b.schedule||null,b.circle_type||'memorization',b.start_time||null,b.grace_minutes===''||b.grace_minutes==null?10:Number(b.grace_minutes),b.student_track||null,b.quran_track||null]);
   return json(res,201,rows[0]);
  }
  if(req.method==='PUT'){
   if(!['system_admin','center_manager'].includes(u.role))return json(res,403,{error:'Forbidden',message:'تعديل الحلقات غير متاح لهذا الحساب.'});
   const b=req.body||{}; if(!b.id)return json(res,400,{error:'معرف الحلقة مطلوب'});
   const e=(await query<any>('select * from circles where id=$1',[b.id]))[0];
   if(!e)return json(res,404,{error:'الحلقة غير موجودة'});
   if(u.role!=='system_admin'&&e.center_id!==u.center_id)return json(res,403,{error:'Forbidden',message:'الحلقة خارج مركزك.'});
   const rows=await query(`update circles set name=coalesce($2,name),center_id=coalesce($3::uuid,center_id),teacher_user_id=$4,schedule=$5,circle_type=coalesce($6,circle_type),start_time=$7,grace_minutes=coalesce($8,grace_minutes),student_track=$9,quran_track=$10,is_active=coalesce($11,is_active) where id=$1 returning *`,
    [b.id,b.name?.trim()||null,u.role==='system_admin'?(b.center_id||null):u.center_id,b.teacher_user_id===undefined?e.teacher_user_id:(b.teacher_user_id||null),b.schedule===undefined?e.schedule:(b.schedule||null),b.circle_type||null,b.start_time===undefined?e.start_time:(b.start_time||null),b.grace_minutes===undefined?e.grace_minutes:Number(b.grace_minutes),b.student_track===undefined?e.student_track:(b.student_track||null),b.quran_track===undefined?e.quran_track:(b.quran_track||null),b.is_active===undefined?e.is_active:Boolean(b.is_active)]);
   return json(res,200,rows[0]);
  }
  return json(res,405,{error:'Method not allowed'});
 }catch(e){return handleError(res,e)}
}