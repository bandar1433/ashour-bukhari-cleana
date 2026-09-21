import { query } from './_lib/db.js';
import { handleError, json, requireAccess } from './_lib/http.js';

export default async function handler(req:any,res:any){
  if(!requireAccess(req,res)) return;
  try{
    if(req.method==='GET'){
      const rows=await query(`
        select s.id,s.user_id,s.center_id,s.circle_id,s.full_name,
          u.email,coalesce(u.is_active,true) as is_active,s.status,s.points_balance,
          c.name as circle_name,ce.name as center_name
        from students s
        left join users u on u.id=s.user_id
        left join circles c on c.id=s.circle_id
        left join centers ce on ce.id=s.center_id
        order by s.full_name
        limit 500
      `);
      return json(res,200,{items:rows});
    }
    if(req.method==='POST'){
      const b=req.body||{};
      if(!b.full_name?.trim()) return json(res,400,{error:'اسم الطالب مطلوب'});
      let centerId=b.center_id||null;
      if(b.circle_id){
        const circle=(await query<any>('select center_id from circles where id=$1',[b.circle_id]))[0];
        if(!circle) return json(res,400,{error:'الحلقة المحددة غير موجودة'});
        centerId=circle.center_id;
      }
      const rows=await query(`
        insert into students(full_name,center_id,circle_id,birth_date,grade_level,registration_date,status)
        values($1,$2,$3,$4,$5,coalesce($6::date,current_date),coalesce($7::student_status,'active'::student_status))
        returning *
      `,[b.full_name.trim(),centerId,b.circle_id||null,b.birth_date||null,b.grade_level||null,b.registration_date||null,b.status||null]);
      return json(res,201,rows[0]);
    }
    return json(res,405,{error:'Method not allowed'});
  }catch(e){return handleError(res,e)}
}