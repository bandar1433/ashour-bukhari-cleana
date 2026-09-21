import { hasDatabaseUrl, query } from './_lib/db.js';
import { handleError, issueAdminSession, json } from './_lib/http.js';

async function exchangeAuthSession(req:any,res:any){
  const sessionToken=String(req.headers['x-neon-session-token']||'').trim();
  if(!sessionToken) return json(res,401,{error:'Unauthorized',message:'جلسة Neon Auth غير موجودة.'});

  const neon=(await query<any>(`
    select u.id::text id,u.email,u.name,s."expiresAt"
    from neon_auth.session s
    join neon_auth."user" u on u.id=s."userId"
    where s.token=$1 and s."expiresAt">now()
    limit 1
  `,[sessionToken]))[0];

  if(!neon) return json(res,401,{error:'Unauthorized',message:'جلسة الدخول غير صالحة أو انتهت.'});

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
    await query(`
      insert into login_requests(auth_subject,email,full_name,status,requested_at)
      values($1,$2,$3,'pending',now())
      on conflict(email) do update set
        auth_subject=excluded.auth_subject,
        full_name=excluded.full_name,
        status='pending',
        requested_at=now()
    `,[neon.id,neon.email,neon.name||null]);
    return json(res,200,{
      pending:true,
      code:'PENDING_APPROVAL',
      message:'تم تسجيل الدخول بحساب Google، والحساب بانتظار اعتماد الإدارة وربطه بالصلاحية المناسبة.'
    });
  }

  if(!resolvedUser.is_active) return json(res,403,{error:'Inactive',message:'هذا الحساب غير نشط. راجع إدارة المنصة.'});

  const session=issueAdminSession({sub:neon.id,userId:resolvedUser.id,role:resolvedUser.role});
  return json(res,200,{
    token:session,
    user:{id:resolvedUser.id,full_name:resolvedUser.full_name,email:resolvedUser.email,role:resolvedUser.role}
  });
}

export default async function handler(req: any, res: any) {
  if(req.method==='POST'){
    try{return await exchangeAuthSession(req,res)}
    catch(error){return handleError(res,error)}
  }

  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const configured = hasDatabaseUrl();

  if (!configured) {
    return json(res, 200, {
      configured: false,
      database: 'missing DATABASE_URL',
    });
  }

  try {
    await query('select 1 as ok');
    return json(res, 200, {
      configured: true,
      database: 'connected',
      app: 'ashour-clean-platform-v1',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    return json(res, 500, {
      configured: true,
      database: 'error',
      error: message,
    });
  }
}
