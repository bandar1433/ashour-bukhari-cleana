import { query } from './_lib/db.js';
import { handleError, issueAdminSession, json } from './_lib/http.js';

export default async function handler(req:any,res:any){
  if(req.method!=='POST') return json(res,405,{error:'Method not allowed'});
  try{
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

    if(!appUser){
      await query(`
        insert into login_requests(auth_subject,email,full_name,status,requested_at)
        values($1,$2,$3,'pending',now())
        on conflict(email) do update set
          auth_subject=excluded.auth_subject,
          full_name=excluded.full_name,
          status='pending',
          requested_at=now()
      `,[neon.id,neon.email,neon.name||null]);
      return json(res,403,{
        error:'Pending approval',
        code:'PENDING_APPROVAL',
        message:'تم إنشاء حساب الدخول بنجاح، وهو الآن بانتظار اعتماد الإدارة وربطه بحساب المنصة.'
      });
    }

    if(!appUser.is_active) return json(res,403,{error:'Inactive',message:'هذا الحساب غير نشط. راجع إدارة المنصة.'});
    if(appUser.role!=='system_admin'){
      return json(res,403,{
        error:'Role not enabled',
        code:'ROLE_NOT_ENABLED',
        message:'تم التحقق من الحساب وربطه، لكن الدخول إلى لوحة الإدارة متاح حاليًا لمدير النظام فقط أثناء مرحلة الانتقال.'
      });
    }

    const session=issueAdminSession({sub:neon.id,userId:appUser.id});
    return json(res,200,{
      token:session,
      user:{id:appUser.id,full_name:appUser.full_name,email:appUser.email,role:appUser.role}
    });
  }catch(e){return handleError(res,e)}
}
