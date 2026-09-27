import { getPool, query } from './_lib/db.js';
import { handleError, issueAdminSession, json } from './_lib/http.js';

const allowedRoles=['supervisor','teacher','student','guardian'];

function cleanPhone(value:unknown){
  return String(value||'').replace(/[\s-]/g,'').trim();
}

function bodyOf(req:any){
  if(req.body && typeof req.body==='object') return req.body;
  if(typeof req.body==='string'){
    try{return JSON.parse(req.body)}catch{return {}}
  }
  return {};
}

async function verifiedAuthSession(sessionToken:string,sessionId:string){
  if(!sessionToken&&!sessionId)return null;
  return (await query<any>(`
    select
      s.id::text session_id,
      s."expiresAt" expires_at,
      au.id::text auth_user_id,
      au.name auth_name,
      au.email auth_email,
      au."emailVerified" email_verified,
      coalesce(au.banned,false) banned
    from neon_auth.session s
    join neon_auth."user" au on au.id=s."userId"
    where (
      ($1<>'' and s.token=$1)
      or ($2<>'' and s.id::text=$2)
    )
      and s."expiresAt">now()
    limit 1
  `,[sessionToken,sessionId]))[0]||null;
}

async function appUserFor(authUserId:string,email:string){
  let user=(await query<any>(`
    select id,full_name,email,phone,role::text role,center_id,is_active,auth_subject
    from public.users where auth_subject=$1 limit 1
  `,[authUserId]))[0];

  if(!user){
    user=(await query<any>(`
      select id,full_name,email,phone,role::text role,center_id,is_active,auth_subject
      from public.users where lower(email)=lower($1) limit 1
    `,[email]))[0];

    if(user){
      await query('update public.users set auth_subject=$1,email=$2,updated_at=now() where id=$3',[authUserId,email,user.id]);
      user={...user,auth_subject:authUserId,email};
    }
  }
  return user||null;
}

async function pendingState(authUserId:string,email:string,role:string){
  const lr=(await query<any>(`
    select status,requested_role
    from public.login_requests
    where auth_subject=$1 or lower(email)=lower($2)
    order by requested_at desc
    limit 1
  `,[authUserId,email]))[0];

  if(lr?.status==='pending'){
    return {pending:true,code:'PENDING_APPROVAL',role:lr.requested_role||role,message:'الحساب مسجل وبانتظار الاعتماد.'};
  }
  return {pending:true,code:'INACTIVE_ACCOUNT',role,message:'الحساب موقوف حاليًا. راجع إدارة المنصة لإعادة التفعيل.'};
}

async function createPendingAccount(auth:any,draft:any){
  const role=allowedRoles.includes(String(draft?.role))?String(draft.role):'';
  const fullName=String(draft?.name||auth.auth_name||'').trim();
  const documentNo=String(draft?.documentNo||'').trim();
  const phone=cleanPhone(draft?.phone);
  const centerId=String(draft?.centerId||'').trim()||null;
  const circleId=String(draft?.circleId||'').trim()||null;

  if(!role||!fullName||!documentNo||!phone){
    return {status:400,body:{error:'INCOMPLETE_SIGNUP',message:'أكمل الاسم ورقم الهوية ورقم الجوال ونوع الحساب.'}};
  }
  if(['student','teacher','supervisor'].includes(role)&&!centerId){
    return {status:400,body:{error:'CENTER_REQUIRED',message:'اختر المركز قبل إكمال التسجيل.'}};
  }
  if(role==='student'&&!circleId){
    return {status:400,body:{error:'CIRCLE_REQUIRED',message:'اختر الحلقة قبل إكمال التسجيل.'}};
  }

  if(centerId){
    const center=(await query<any>('select id from public.centers where id=$1',[centerId]))[0];
    if(!center)return {status:400,body:{error:'INVALID_CENTER',message:'المركز المحدد غير موجود.'}};
  }
  if(role==='student'){
    const circle=(await query<any>('select id from public.circles where id=$1 and center_id=$2',[circleId,centerId]))[0];
    if(!circle)return {status:400,body:{error:'INVALID_CIRCLE',message:'الحلقة المحددة لا تتبع المركز المختار.'}};
  }

  const client=await getPool().connect();
  try{
    await client.query('begin');

    if(role==='guardian'){
      const created=(await client.query(`
        insert into public.users(full_name,email,phone,national_id,role,is_active,auth_subject)
        values($1,$2,$3,$4,'guardian',true,$5)
        returning id,full_name,email,role::text role
      `,[fullName,auth.auth_email,phone,documentNo,auth.auth_user_id])).rows[0];

      await client.query('commit');
      return {
        status:200,
        body:{
          token:issueAdminSession({sub:auth.auth_user_id,userId:created.id,role:'guardian'}),
          user:created,
          message:'تم إنشاء حساب ولي الأمر.'
        }
      };
    }

    const created=(await client.query(`
      insert into public.users(full_name,email,phone,national_id,role,center_id,is_active,auth_subject)
      values($1,$2,$3,$4,$5::app_role,$6::uuid,false,$7)
      returning id,full_name,email,role::text role
    `,[fullName,auth.auth_email,phone,documentNo,role,centerId,auth.auth_user_id])).rows[0];

    await client.query(`
      insert into public.login_requests(
        auth_subject,email,full_name,status,requested_at,requested_role,phone,national_id,center_id,requested_circle_id
      )
      values($1,$2,$3,'pending',now(),$4,$5,$6,$7::uuid,$8::uuid)
      on conflict(email) do update set
        auth_subject=excluded.auth_subject,
        full_name=excluded.full_name,
        status='pending',
        requested_at=now(),
        requested_role=excluded.requested_role,
        phone=excluded.phone,
        national_id=excluded.national_id,
        center_id=excluded.center_id,
        requested_circle_id=excluded.requested_circle_id
    `,[auth.auth_user_id,auth.auth_email,fullName,role,phone,documentNo,centerId,circleId]);

    if(role==='student'){
      await client.query(`
        insert into public.circle_join_requests(user_id,circle_id,requested_role,status)
        select $1,$2,'student','pending'
        where not exists(
          select 1 from public.circle_join_requests
          where user_id=$1 and circle_id=$2 and status='pending'
        )
      `,[created.id,circleId]);
    }

    await client.query('commit');
    return {
      status:200,
      body:{
        pending:true,
        code:'PENDING_APPROVAL',
        role,
        message:role==='student'
          ?'تم التسجيل وإرسال طلب الانضمام. سيُفعّل الحساب بعد اعتماد الحلقة.'
          :role==='teacher'
            ?'تم التسجيل. حساب المعلم بانتظار اعتماد إدارة المركز.'
            :'تم التسجيل. حساب المشرف بانتظار الاعتماد.'
      }
    };
  }catch(error){
    await client.query('rollback');
    throw error;
  }finally{
    client.release();
  }
}

export default async function handler(req:any,res:any){
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});

  try{
    const body=bodyOf(req);
    const sessionToken=String(body.sessionToken||'').trim();
    const sessionId=String(body.sessionId||'').trim();
    const draft=body.draft&&typeof body.draft==='object'?body.draft:null;

    const auth=await verifiedAuthSession(sessionToken,sessionId);
    if(!auth)return json(res,401,{error:'AUTH_SESSION_INVALID',message:'جلسة Google غير صالحة أو انتهت. سجّل الدخول من جديد.'});
    if(auth.banned)return json(res,403,{error:'AUTH_ACCOUNT_BANNED',message:'حساب المصادقة موقوف.'});
    if(!auth.email_verified)return json(res,401,{error:'EMAIL_NOT_VERIFIED',message:'البريد الإلكتروني غير موثق.'});

    const resolved=await appUserFor(auth.auth_user_id,auth.auth_email);

    if(resolved){
      if(!resolved.is_active){
        return json(res,200,await pendingState(auth.auth_user_id,auth.auth_email,resolved.role));
      }
      const token=issueAdminSession({sub:auth.auth_user_id,userId:resolved.id,role:resolved.role as any});
      return json(res,200,{
        token,
        user:{id:resolved.id,full_name:resolved.full_name,email:resolved.email,role:resolved.role}
      });
    }

    if(!draft){
      return json(res,200,{
        profile_required:true,
        verified:{name:auth.auth_name,email:auth.auth_email}
      });
    }

    const created=await createPendingAccount(auth,draft);
    return json(res,created.status,created.body);
  }catch(error){
    console.error('[auth] failed',error);
    return handleError(res,error);
  }
}
