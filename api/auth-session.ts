import { createRemoteJWKSet, jwtVerify } from 'jose';
import { query } from './_lib/db.js';
import { handleError, issueAdminSession, json } from './_lib/http.js';

const JWKS_URL =
  process.env.NEON_AUTH_JWKS_URL ||
  'https://ep-withered-flower-aeyxaru7.neonauth.c-2.us-east-2.aws.neon.tech/ashour_bukhari/auth/.well-known/jwks.json';

const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const authorization = String(req.headers.authorization || '');
    if (!authorization.startsWith('Bearer ')) {
      return json(res, 401, { error: 'Unauthorized', message: 'جلسة Neon Auth غير موجودة.' });
    }

    const token = authorization.slice(7).trim();
    const { payload } = await jwtVerify(token, JWKS);
    const subject = String(payload.sub || '');
    if (!subject) {
      return json(res, 401, { error: 'Unauthorized', message: 'تعذر تحديد هوية المستخدم.' });
    }

    const neon = (
      await query<any>(
        'select id::text id,email,name from neon_auth."user" where id::text=$1 limit 1',
        [subject],
      )
    )[0];

    if (!neon) {
      return json(res, 401, { error: 'Unauthorized', message: 'المستخدم غير موجود في Neon Auth.' });
    }

    const appUser = (
      await query<any>(
        `select id,full_name,email,role::text role,is_active
         from public.users
         where auth_subject=$1
         limit 1`,
        [subject],
      )
    )[0];

    if (!appUser) {
      await query(
        `insert into login_requests(auth_subject,email,full_name,status,requested_at)
         values($1,$2,$3,'pending',now())
         on conflict(email) do update set
           auth_subject=excluded.auth_subject,
           full_name=excluded.full_name,
           status='pending',
           requested_at=now()`,
        [subject, neon.email, neon.name || null],
      );

      return json(res, 403, {
        error: 'Pending approval',
        code: 'PENDING_APPROVAL',
        message: 'تم إنشاء حساب الدخول بنجاح، وهو الآن بانتظار اعتماد الإدارة وربطه بحساب المنصة.',
      });
    }

    if (!appUser.is_active) {
      return json(res, 403, { error: 'Inactive', message: 'هذا الحساب غير نشط. راجع إدارة المنصة.' });
    }

    if (appUser.role !== 'system_admin') {
      return json(res, 403, {
        error: 'Role not enabled',
        code: 'ROLE_NOT_ENABLED',
        message: 'تم التحقق من الحساب وربطه، لكن الدخول إلى لوحة الإدارة متاح حاليًا لمدير النظام فقط أثناء مرحلة الانتقال.',
      });
    }

    const session = issueAdminSession({ sub: subject, userId: appUser.id });
    return json(res, 200, {
      token: session,
      user: {
        id: appUser.id,
        full_name: appUser.full_name,
        email: appUser.email,
        role: appUser.role,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
}
