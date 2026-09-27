import { createRemoteJWKSet, jwtVerify } from 'jose';
import { hasDatabaseUrl, query } from './_lib/db.js';
import { handleError, issueAdminSession, json } from './_lib/http.js';

const NEON_AUTH_BASE_URL=process.env.NEON_AUTH_BASE_URL||'https://ep-withered-flower-aeyxaru7.neonauth.c-2.us-east-2.aws.neon.tech/ashour_bukhari/auth';
const AUTH_ORIGIN=new URL(NEON_AUTH_BASE_URL).origin;
const JWKS=createRemoteJWKSet(new URL(`${NEON_AUTH_BASE_URL}/.well-known/jwks.json`));

async function exchangeAuthSession(req:any,res:any){
  let draft:any={};try{draft=JSON.parse(String(req.headers['x-signup-draft']||'{}'))}catch{}
  const authorization=String(req.headers.authorization||'');
  const bearer=authorization.startsWith('Bearer ')?authorization.slice(7).trim():'';
  const token=bearer||String(req.headers['x-neon-session-token']||'').trim();
  if(!token) return json(res,401,{error:'Unauthorized',message:'رمز جلسة المصادقة غير موجود.'});

  const {payload}=await jwtVerify(token,JWKS,{issuer:AUTH_ORIGIN});
  const neon={
    id:String(payload.sub||payload.id||''),
    email:String(payload.email||(payload as any).user?.email||(payload as any).user_email||'').trim(),
    name:String(payload.name||(payload as any).user?.name||(payload as any).display_name||'').trim()
  };
  if(!neon.id) return json(res,401,{error:'Unauthorized',message:'تعذر التحقق من هوية حساب المصادقة.'});
  if(!neon.email) return json(res,400,{error:'EMAIL_REQUIRED',message:'جلسة المصادقة لم تُرجع البريد الإلكتروني الموثق. أعد تسجيل الدخول بالبريد الإلكتروني أو Google.'});

  const appUser=(await query<any>(`
    select id,full_name,email,role::text role,is_active
    from public.users
    where auth_subject=$1
    limit 1
  `,[neon.id]))[0];

  let resolvedUser=appUser;
  if(!resolvedUser && neon.email){
    const byEmail=(await query<any>(`
      select id,full_name,email,role::text role,is_active
      from public.users
      where lower(email)=lower($1)
      limit 1
    `,[neon.email]))[0];
    if(byEmail){
      await query('update public.users set auth_subject=$1,email=$2,updated_at=now() where id=$3',[neon.id,neon.email,byEmail.id]);
      resolvedUser={...byEmail,email:neon.email};
    }
  }

  if(!resolvedUser && draft.documentNo && draft.phone){
    const documentNo=String(draft.documentNo||'').trim();
    const phone=String(draft.phone||'').replace(/[\s-]/g,'').trim();
    const legacyMatches=await query<any>(`
      select distinct u.id,u.full_name,u.email,u.role::text role,u.is_active
      from public.users u
      join public.students s on s.user_id=u.id
      where s.document_no=$1
        and regexp_replace(coalesce(s.mobile,u.phone,''),'[\\s-]','','g')=$2
      limit 2
    `,[documentNo,phone]);
    if(legacyMatches.length===1){
      const legacy=legacyMatches[0];
      await query('update public.users set auth_subject=$1,email=$2,phone=coalesce(phone,$3),updated_at=now() where id=$4',[neon.id,neon.email,phone,legacy.id]);
      resolvedUser={...legacy,email:neon.email};
    }else if(legacyMatches.length>1){
      return json(res,409,{error:'AMBIGUOUS_LEGACY_ACCOUNT',message:'وجد أكثر من ملف مطابق للهوية والجوال. راجع مدير النظام لربط الحساب الصحيح.'});
    }
  }

  if(!resolvedUser){
    const requestedRole=['supervisor','teacher','student','guardian'].includes(String(draft.role))?String(draft.role):null;
    const fullName=String(draft.name||neon.name||'').trim()||null;
    const documentNo=String(draft.documentNo||'').trim()||null;
    const phone=String(draft.phone||'').replace(/[\s-]/g,'').trim()||null;
    const centerId=String(draft.centerId||'').trim()||null;
    const circleId=String(draft.circleId||'').trim()||null;
    if(!requestedRole||!fullName||!documentNo||!phone)return json(res,400,{error:'INCOMPLETE_SIGNUP',message:'أكمل الاسم ورقم الهوية ورقم الجوال ونوع الحساب من شاشة تسجيل جديد.'});
    if(['student','teacher','supervisor'].includes(requestedRole)&&!centerId)return json(res,400,{error:'CENTER_REQUIRED',message:'اختر المركز قبل إكمال التسجيل.'});
    if(requestedRole==='student'&&!circleId)return json(res,400,{error:'CIRCLE_REQUIRED',message:'اختر الحلقة قبل إكمال تسجيل الطالب.'});

    await query(`alter table login_requests add column if not exists requested_role text`);
    await query(`alter table login_requests add column if not exists phone text`);
    await query(`alter table login_requests add column if not exists document_no text`);
    await query(`alter table login_requests add column if not exists center_id uuid`);
    await query(`alter table login_requests add column if not exists circle_id uuid`);

    if(requestedRole==='guardian'){
      let gu=(await query<any>('select id from users where lower(email)=lower($1) limit 1',[neon.email]))[0];
      if(gu) await query(`update users set full_name=$2,phone=$3,role='guardian',is_active=true,auth_subject=$4,updated_at=now() where id=$1`,[gu.id,fullName,phone,neon.id]);
      else gu=(await query<any>(`insert into users(full_name,email,phone,role,is_active,auth_subject) values($1,$2,$3,'guardian',true,$4) returning id`,[fullName,neon.email||null,phone,neon.id]))[0];
      const session=issueAdminSession({sub:neon.id,userId:gu.id,role:'guardian'});
      return json(res,200,{token:session,user:{id:gu.id,full_name:fullName,email:neon.email,role:'guardian'},message:'تم إنشاء حساب ولي الأمر. سيظهر الأبناء بعد ربطهم من المعلم أو المشرف أو الإدارة.'});
    }

    let pending=(await query<any>('select id from users where lower(email)=lower($1) limit 1',[neon.email]))[0];
    if(pending){
      await query(`update users set full_name=$2,phone=$3,role=$4::app_role,center_id=$5::uuid,is_active=false,auth_subject=$6,updated_at=now() where id=$1`,
        [pending.id,fullName,phone,requestedRole,centerId,neon.id]);
    }else{
      pending=(await query<any>(`insert into users(full_name,email,phone,role,center_id,is_active,auth_subject) values($1,$2,$3,$4::app_role,$5::uuid,false,$6) returning id`,
        [fullName,neon.email||null,phone,requestedRole,centerId,neon.id]))[0];
    }

    const lr=(await query<any>('select id from login_requests where lower(email)=lower($1) order by requested_at desc limit 1',[neon.email]))[0];
    if(lr) await query(`update login_requests set auth_subject=$2,full_name=$3,status='pending',requested_at=now(),requested_role=$4,phone=$5,document_no=$6,center_id=$7::uuid,circle_id=$8::uuid where id=$1`,
      [lr.id,neon.id,fullName,requestedRole,phone,documentNo,centerId,circleId]);
    else await query(`insert into login_requests(auth_subject,email,full_name,status,requested_at,requested_role,phone,document_no,center_id,circle_id)
      values($1,$2,$3,'pending',now(),$4,$5,$6,$7::uuid,$8::uuid)`,
      [neon.id,neon.email||null,fullName,requestedRole,phone,documentNo,centerId,circleId]);

    if(requestedRole==='student'){
      const existingJoin=(await query<any>(`select id from circle_join_requests where user_id=$1 and circle_id=$2 and status='pending' limit 1`,[pending.id,circleId]))[0];
      if(!existingJoin)await query(`insert into circle_join_requests(user_id,circle_id,requested_role,status) values($1,$2,'student','pending')`,[pending.id,circleId]);
    }
    return json(res,200,{pending:true,code:'PENDING_APPROVAL',role:requestedRole,message:requestedRole==='student'?'تم التسجيل وإرسال طلب الانضمام. لن يتفعّل الحساب حتى قبول الحلقة.':requestedRole==='teacher'?'تم التسجيل. حساب المعلم بانتظار اعتماد مشرف المركز.':'تم التسجيل. حساب المشرف بانتظار الاعتماد.'});
  }
  if(!resolvedUser.is_active){
    const lr=(await query<any>("select status,requested_role from login_requests where auth_subject=$1 order by requested_at desc limit 1",[neon.id]))[0];
    if(lr?.status==='pending')return json(res,200,{pending:true,code:'PENDING_APPROVAL',role:lr.requested_role,message:'الحساب مسجل وبانتظار الاعتماد.'});
    return json(res,200,{pending:true,code:'INACTIVE_ACCOUNT',role:resolvedUser.role,message:'تم ربط حساب Google بالملف الموجود، لكن الحساب موقوف حاليًا. راجع إدارة المنصة لإعادة التفعيل.'});
  }

  const session=issueAdminSession({sub:neon.id,userId:resolvedUser.id,role:resolvedUser.role});
  return json(res,200,{
    token:session,
    user:{id:resolvedUser.id,full_name:resolvedUser.full_name,email:resolvedUser.email,role:resolvedUser.role}
  });
}

export default async function handler(req:any,res:any){
  if(req.method==='POST'){
    try{return await exchangeAuthSession(req,res)}
    catch(error){
      console.error('[auth-exchange] failed',error);
      return json(res,401,{error:'Unauthorized',message:'تعذر التحقق من جلسة الدخول. أعد تسجيل الدخول.'});
    }
  }

  if(req.method!=='GET') return json(res,405,{error:'Method not allowed'});
  const configured=hasDatabaseUrl();
  if(!configured) return json(res,200,{configured:false,database:'missing DATABASE_URL'});
  try{
    await query('select 1 as ok');
    return json(res,200,{configured:true,database:'connected',app:'ashour-clean-platform-v1'});
  }catch(error){
    const message=error instanceof Error?error.message:'Unknown database error';
    return json(res,500,{configured:true,database:'error',error:message});
  }
}
