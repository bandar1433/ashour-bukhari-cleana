import { query } from './_lib/db.js';
import { handleError, json, requireAccess } from './_lib/http.js';
export default async function handler(req:any,res:any){
 if(!requireAccess(req,res))return;
 try{
  if(req.method==='GET'){
   const rows=await query(`select c.id,c.name,c.center_id,c.teacher_user_id,c.schedule,c.circle_type,c.start_time,c.grace_minutes,c.student_track,c.quran_track,ce.name center_name,t.full_name teacher_name,t.email teacher_email,count(s.id)::int students_count from circles c left join centers ce on ce.id=c.center_id left join users t on t.id=c.teacher_user_id left join students s on s.circle_id=c.id group by c.id,ce.name,t.full_name,t.email order by c.name limit 200`);
   return json(res,200,{items:rows});
  }
  if(req.method==='POST'){
   const b=req.body||{}; if(!b.name?.trim()||!b.center_id)return json(res,400,{error:'اسم الحلقة والمركز مطلوبان'});
   const rows=await query(`insert into circles(center_id,name,teacher_user_id,schedule,circle_type,start_time,grace_minutes,student_track,quran_track,is_active) values($1,$2,$3,$4,$5,$6,$7,$8,$9,true) returning *`,[b.center_id,b.name.trim(),b.teacher_user_id||null,b.schedule||null,b.circle_type||'memorization',b.start_time||null,b.grace_minutes===''||b.grace_minutes==null?10:Number(b.grace_minutes),b.student_track||null,b.quran_track||null]);
   return json(res,201,rows[0]);
  }
  return json(res,405,{error:'Method not allowed'});
 }catch(e){return handleError(res,e)}
}