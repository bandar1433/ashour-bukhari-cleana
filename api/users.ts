import { query } from './_lib/db.js';
import { handleError, json } from './_lib/http.js';
import { getActor } from './_lib/actor.js';

const allowedRoles=['system_admin','center_manager','supervisor','teacher','student','guardian'];

export default async function handler(req:any,res:any){
  try{
    const u=await getActor(req,res);if(!u)return;
    if(req.method==='GET'){
      if(!['system_admin','center_manager','supervisor'].includes(u.role))return json(res,403,{error:'Forbidden'});
      const rows=await query(`
        select id,coalesce(full_name,email,'بدون اسم') full_name,email,phone,role,
          center_id,is_active,case when auth_subject is null then false else true end linked
        from users
        where $1='system_admin' or center_id=$2::uuid or id=$3::uuid
        order by case role::text
          when 'system_admin' then 1 when 'center_manager' then 2 when 'supervisor' then 3
          when 'teacher' then 4 when 'student' then 5 when 'guardian' then 6 else 7 end,
          full_name nulls last,email nulls last
        limit 500
      `,[u.role,u.center_id,u.id]);
      const requests=await query(`
        select id,auth_subject,email,full_name,status,requested_at,requested_role,phone,document_no,center_id,circle_id
        from login_requests
        where status='pending' and ($1='system_admin' or center_id=$2::uuid)
        order by requested_at desc
        limit 200
      `,[u.role,u.center_id]);
      return json(res,200,{items:rows,requests});
    }
    if(req.method==='POST'){
      if(!['system_admin','center_manager','supervisor'].includes(u.role))return json(res,403,{error:'Forbidden'});
      const b=req.body||{};
      if(!b.full_name?.trim()) return json(res,400,{error:'اسم المستخدم مطلوب'});
      if(!allowedRoles.includes(b.role)) return json(res,400,{error:'الدور غير صحيح'});
      if(u.role!=='system_admin'&&['system_admin','center_manager','supervisor'].includes(b.role))return json(res,403,{error:'Forbidden',message:'اعتماد الأدوار الإدارية العليا من صلاحية الإدارة العامة فقط.'});
      if(u.role!=='system_admin'&&b.center_id!==u.center_id)return json(res,403,{error:'Forbidden',message:'لا يمكنك إضافة مستخدم خارج مركزك.'});
      const rows=await query(`
        insert into users(full_name,email,phone,role,center_id,is_active)
        values($1,$2,$3,$4::app_role,$5,coalesce($6,true))
        returning id,full_name,email,phone,role,center_id,is_active
      `,[b.full_name.trim(),b.email?.trim()||null,b.phone?.trim()||null,b.role,b.center_id||null,b.is_active===undefined?true:Boolean(b.is_active)]);
      return json(res,201,rows[0]);
    }
    if(req.method==='PUT'){
      if(!['system_admin','center_manager','supervisor'].includes(u.role))return json(res,403,{error:'Forbidden'});
      const b=req.body||{};
      if(b.request_id&&b.request_decision==='rejected'){
        const lr=(await query<any>('select id,auth_subject,center_id,circle_id,requested_role from login_requests where id=$1 and status=\'pending\'',[b.request_id]))[0];
        if(!lr)return json(res,404,{error:'طلب الاعتماد غير موجود'});
        if(u.role!=='system_admin'&&lr.center_id!==u.center_id)return json(res,403,{error:'Forbidden',message:'طلب الاعتماد خارج مركزك.'});
        await query("update login_requests set status='rejected' where id=$1",[lr.id]);
        if(lr.auth_subject){
          const pendingUser=(await query<any>('select id from users where auth_subject=$1',[lr.auth_subject]))[0];
          if(pendingUser){
            await query('update users set is_active=false where id=$1',[pendingUser.id]);
            if(lr.circle_id)await query("update circle_join_requests set status='rejected',decided_by=$2,decided_at=now() where user_id=$1 and circle_id=$3 and status='pending'",[pendingUser.id,u.id,lr.circle_id]);
          }
        }
        return json(res,200,{success:true,status:'rejected'});
      }
      if(!b.id) return json(res,400,{error:'معرف المستخدم مطلوب'});
      if(b.role!==undefined&&!allowedRoles.includes(b.role)) return json(res,400,{error:'الدور غير صحيح'});
      if(u.role!=='system_admin'&&b.role!==undefined&&['system_admin','center_manager','supervisor'].includes(b.role))return json(res,403,{error:'Forbidden',message:'لا يمكنك منح دور إداري أعلى.'});
      const e=(await query<any>('select * from users where id=$1',[b.id]))[0];
      if(!e) return json(res,404,{error:'المستخدم غير موجود'});
      if(u.role!=='system_admin'&&e.center_id!==u.center_id&&e.id!==u.id)return json(res,403,{error:'Forbidden',message:'المستخدم خارج مركزك.'});
      if(u.role!=='system_admin'&&b.center_id!==undefined&&(b.center_id||null)!==e.center_id)return json(res,403,{error:'Forbidden',message:'نقل المستخدم بين المراكز من صلاحية الإدارة العامة فقط.'});
      if(u.role!=='system_admin'&&b.role!==undefined&&['system_admin','center_manager','supervisor'].includes(b.role)&&b.role!==e.role)return json(res,403,{error:'Forbidden',message:'منح الأدوار الإدارية العليا من صلاحية الإدارة العامة فقط.'});
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
        const lr=(await query<any>('select requested_role,circle_id,center_id,document_no,phone from login_requests where id=$1 and auth_subject=$2',[b.request_id,b.auth_subject]))[0];
        if(!lr)return json(res,404,{error:'طلب الاعتماد غير موجود'});
        if(lr.requested_role==='student'&&lr.circle_id){
          await query('alter table students add column if not exists document_no text');
          await query('alter table students add column if not exists mobile text');
          const st=(await query<any>('select id from students where user_id=$1',[b.id]))[0];
          if(st)await query("update students set center_id=coalesce($1,center_id),circle_id=$2,status='active',document_no=coalesce($3,document_no),mobile=coalesce($4,mobile),updated_at=now() where id=$5",[lr.center_id,lr.circle_id,lr.document_no||null,lr.phone||null,st.id]);
          else await query("insert into students(user_id,center_id,circle_id,full_name,status,document_no,mobile) select id,coalesce($2,center_id),$3,full_name,'active',$4,$5 from users where id=$1",[b.id,lr.center_id,lr.circle_id,lr.document_no||null,lr.phone||null]);
          await query("update circle_join_requests set status='approved',decided_by=$3,decided_at=now() where user_id=$1 and circle_id=$2 and status='pending'",[b.id,lr.circle_id,u.id]);
          await query("update users set is_active=true where id=$1",[b.id]);
        }
        await query("update login_requests set status='approved' where id=$1 and auth_subject=$2",[b.request_id,b.auth_subject]);
      }
      const finalRow=(await query<any>("select id,full_name,email,phone,role,center_id,is_active,case when auth_subject is null then false else true end linked from users where id=$1",[b.id]))[0];
      return json(res,200,finalRow||rows[0]);
    }
    return json(res,405,{error:'Method not allowed'});
  }catch(e){return handleError(res,e)}
}
