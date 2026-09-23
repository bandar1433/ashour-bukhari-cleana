import { query } from './_lib/db.js';
import { handleError, json, requireAccess } from './_lib/http.js';

const allowedRoles=['system_admin','center_manager','supervisor','teacher','student','guardian'];

export default async function handler(req:any,res:any){
  if(!requireAccess(req,res)) return;
  try{
    if(req.method==='GET'){
      const rows=await query(`
        select id,coalesce(full_name,email,'بدون اسم') full_name,email,phone,role,
          center_id,is_active,case when auth_subject is null then false else true end linked
        from users
        order by case role::text
          when 'system_admin' then 1 when 'center_manager' then 2 when 'supervisor' then 3
          when 'teacher' then 4 when 'student' then 5 when 'guardian' then 6 else 7 end,
          full_name nulls last,email nulls last
        limit 500
      `);
      const requests=await query(`
        select id,auth_subject,email,full_name,status,requested_at,requested_role,phone,document_no,center_id,circle_id
        from login_requests
        where status='pending'
        order by requested_at desc
        limit 200
      `);
      return json(res,200,{items:rows,requests});
    }
    if(req.method==='POST'){
      const b=req.body||{};
      if(!b.full_name?.trim()) return json(res,400,{error:'اسم المستخدم مطلوب'});
      if(!allowedRoles.includes(b.role)) return json(res,400,{error:'الدور غير صحيح'});
      const rows=await query(`
        insert into users(full_name,email,phone,role,center_id,is_active)
        values($1,$2,$3,$4::app_role,$5,coalesce($6,true))
        returning id,full_name,email,phone,role,center_id,is_active
      `,[b.full_name.trim(),b.email?.trim()||null,b.phone?.trim()||null,b.role,b.center_id||null,b.is_active===undefined?true:Boolean(b.is_active)]);
      return json(res,201,rows[0]);
    }
    if(req.method==='PUT'){
      const b=req.body||{};
      if(!b.id) return json(res,400,{error:'معرف المستخدم مطلوب'});
      if(b.role!==undefined&&!allowedRoles.includes(b.role)) return json(res,400,{error:'الدور غير صحيح'});
      const e=(await query<any>('select * from users where id=$1',[b.id]))[0];
      if(!e) return json(res,404,{error:'المستخدم غير موجود'});
      const rows=await query(`
        update users set
          full_name=coalesce($2,full_name),
          email=$3,
          phone=$4,
          role=coalesce($5::app_role,role),
          center_id=$6,
          is_active=coalesce($7,is_active),
          auth_subject=$8,
          updated_at=now()
        where id=$1
        returning id,full_name,email,phone,role,center_id,is_active,
          case when auth_subject is null then false else true end linked
      `,[
        b.id,b.full_name?.trim()||null,
        b.email===undefined?e.email:(b.email?.trim()||null),
        b.phone===undefined?e.phone:(b.phone?.trim()||null),
        b.role||null,
        b.center_id===undefined?e.center_id:(b.center_id||null),
        b.is_active===undefined?e.is_active:Boolean(b.is_active),
        b.auth_subject===undefined?e.auth_subject:(b.auth_subject||null)
      ]);
      if(b.request_id&&b.auth_subject){
        await query("update login_requests set status='approved' where id=$1 and auth_subject=$2",[b.request_id,b.auth_subject]);
      }
      return json(res,200,rows[0]);
    }
    return json(res,405,{error:'Method not allowed'});
  }catch(e){return handleError(res,e)}
}
