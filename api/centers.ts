import { query } from './_lib/db.js';
import { getActor } from './_lib/actor.js';
import { handleError,json } from './_lib/http.js';

export default async function handler(req:any,res:any){
  try{
    const u=await getActor(req,res); if(!u)return;
    if(req.method==='GET'){
      const rows=await query(`
        select c.id,c.name,c.location,c.manager_user_id,c.is_active,u2.full_name manager_name,count(ci.id)::int circles_count
        from centers c
        left join users u2 on u2.id=c.manager_user_id
        left join circles ci on ci.center_id=c.id
        where $1='system_admin' or c.id=$2::uuid
        group by c.id,u2.full_name order by c.name
      `,[u.role,u.center_id]);
      return json(res,200,{items:rows});
    }
    if(req.method==='POST'){
      if(u.role!=='system_admin')return json(res,403,{error:'Forbidden',message:'إضافة المراكز متاحة لمدير النظام فقط.'});
      const b=req.body||{};if(!b.name?.trim())return json(res,400,{error:'اسم المركز مطلوب'});
      const rows=await query(`insert into centers(name,location,manager_user_id,is_active) values($1,$2,$3,true) returning *`,[b.name.trim(),b.location||null,b.manager_user_id||null]);
      return json(res,201,rows[0]);
    }
    return json(res,405,{error:'Method not allowed'});
  }catch(e){return handleError(res,e)}
}