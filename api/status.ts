import { createRemoteJWKSet, jwtVerify } from 'jose';
import { hasDatabaseUrl, query } from './_lib/db.js';
import { handleError, issueAdminSession, json } from './_lib/http.js';

const NEON_AUTH_BASE_URL=process.env.NEON_AUTH_BASE_URL||'https://ep-withered-flower-aeyxaru7.neonauth.c-2.us-east-2.aws.neon.tech/ashour_bukhari/auth';
const AUTH_ORIGIN=new URL(NEON_AUTH_BASE_URL).origin;
const JWKS=createRemoteJWKSet(new URL(`${NEON_AUTH_BASE_URL}/.well-known/jwks.json`));

async function exchangeAuthSession(req:any,res:any){
  let draft:any={};try{draft=JSON.parse(String(req.headers['x-signup-draft']||'{}'))}catch{}
  const authorization=String(req.headers.authorization||'');
  const token=authorization.startsWith('Bearer ')?authorization.slice(7).trim():'';
  if(!token) return json(res,401,{error:'Unauthorized',message:'رمز جلسة Google غير موجود.'});

  const {payload}=await jwtVerify(token,JWKS,{issuer:AUTH_ORIGIN});
  const neon={
    id:String(payload.sub||payload.id||''),
    email:String(payload.email||''),
    name:String(payload.name||'')
  };
  if(!neon.id) return json(res,401,{error:'Unauthorized',message:'تعذر التحقق من هوية حساب Google.'});

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
      await query('update public.users set auth_subject=$1 where id=$2',[neon.id,byEmail.id]);
      resolvedUser=byEmail;
    }
  }

  if(!resolvedUser){
    const requestedRole=['supervisor','teacher','student','guardian'].includes(String(draft.role))?String(draft.role):null;
    const fullName=String(draft.name||neon.name||'').trim()||null,documentNo=String(draft.documentNo||'').trim()||null,phone=String(draft.phone||'').trim()||null;
    await query(`alter table login_requests add column if not exists requested_role text`);
    await query(`alter table login_requests add column if not exists phone text`);
    await query(`alter table login_requests add column if not exists document_no text`);
    await query(`alter table login_requests add column if not exists center_id uuid`);
    await query(`alter table login_requests add column if not exists circle_id uuid`);
    await query(`insert into login_requests(auth_subject,email,full_name,status,requested_at,requested_role,phone,document_no,center_id,circle_id)
      values($1,$2,$3,'pending',now(),$4,$5,$6,$7::uuid,$8::uuid)
      on conflict(email) do update set auth_subject=excluded.auth_subject,full_name=excluded.full_name,status='pending',requested_at=now(),
      requested_role=excluded.requested_role,phone=excluded.phone,document_no=excluded.document_no,center_id=excluded.center_id,circle_id=excluded.circle_id`,
      [neon.id,neon.email||null,fullName,requestedRole,phone,documentNo,draft.centerId||null,draft.circleId||null]);
    return json(res,200,{pending:true,code:'PENDING_APPROVAL',role:requestedRole,message:requestedRole==='student'?'تم التسجيل وإرسال طلب الانضمام. لن يتفعّل الحساب حتى قبول الحلقة.':requestedRole==='guardian'?'تم التسجيل. ينتظر حساب ولي الأمر ربط الطالب من المعلم أو المشرف أو الإدارة.':'تم التسجيل والحساب بانتظار الاعتماد.'});
  }

  if(!resolvedUser.is_active) return json(res,403,{error:'Inactive',message:'هذا الحساب غير نشط. راجع إدارة المنصة.'});

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
      return json(res,401,{error:'Unauthorized',message:'تعذر التحقق من جلسة Google. أعد تسجيل الدخول.'});
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
