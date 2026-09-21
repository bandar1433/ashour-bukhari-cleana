import { getPool, query } from './_lib/db.js';
import { handleError, json, requireAccess } from './_lib/http.js';

export default async function handler(req:any,res:any){
  if(!requireAccess(req,res)) return;
  try{
    if(req.method==='GET'){
      const roles=await query(`
        select r.code,r.name,r.is_system,
          coalesce(array_agg(p.code order by p.category,p.code) filter(where p.code is not null),array[]::text[]) permissions
        from roles r
        left join role_permissions rp on rp.role_id=r.id
        left join permissions p on p.id=rp.permission_id
        group by r.id
        order by case r.code
          when 'system_admin' then 1 when 'center_manager' then 2 when 'supervisor' then 3
          when 'teacher' then 4 when 'student' then 5 when 'guardian' then 6 else 7 end
      `);
      const permissions=await query('select code,name,category from permissions order by category,name');
      return json(res,200,{roles,permissions});
    }
    if(req.method==='PUT'){
      const b=req.body||{};
      if(!b.role_code||!Array.isArray(b.permissions)) return json(res,400,{error:'الدور والصلاحيات مطلوبان'});
      if(b.role_code==='system_admin') return json(res,400,{error:'صلاحيات مدير النظام ثابتة ولا تُقيد'});
      const client=await getPool().connect();
      try{
        await client.query('begin');
        const rr=await client.query('select id from roles where code=$1',[b.role_code]);
        if(!rr.rows[0]){await client.query('rollback');return json(res,404,{error:'الدور غير موجود'})}
        await client.query('delete from role_permissions where role_id=$1',[rr.rows[0].id]);
        if(b.permissions.length){
          await client.query(`
            insert into role_permissions(role_id,permission_id)
            select $1,p.id from permissions p where p.code=any($2::text[])
          `,[rr.rows[0].id,b.permissions]);
        }
        await client.query('commit');
      }catch(e){await client.query('rollback');throw e}finally{client.release()}
      return json(res,200,{ok:true});
    }
    return json(res,405,{error:'Method not allowed'});
  }catch(e){return handleError(res,e)}
}
