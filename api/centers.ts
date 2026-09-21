import { query } from './_lib/db.js';
import { handleError, json, requireAccess } from './_lib/http.js';

export default async function handler(req:any,res:any){
  if(!requireAccess(req,res)) return;
  try{
    if(req.method==='GET'){
      const rows=await query(`
        select c.id,c.name,c.location,c.manager_user_id,c.is_active,
          u.full_name as manager_name,count(ci.id)::int as circles_count
        from centers c
        left join users u on u.id=c.manager_user_id
        left join circles ci on ci.center_id=c.id
        group by c.id,u.full_name
        order by c.name
      `);
      return json(res,200,{items:rows});
    }
    if(req.method==='POST'){
      const b=req.body||{};
      if(!b.name?.trim()) return json(res,400,{error:'اسم المركز مطلوب'});
      const rows=await query(`
        insert into centers(name,location,manager_user_id,is_active)
        values($1,$2,$3,true) returning *
      `,[b.name.trim(),b.location||null,b.manager_user_id||null]);
      return json(res,201,rows[0]);
    }
    return json(res,405,{error:'Method not allowed'});
  }catch(e){return handleError(res,e)}
}
