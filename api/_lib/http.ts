import crypto from 'node:crypto';

export function json(res: any, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function methodNotAllowed(res: any) {
  return json(res, 405, { error: 'Method not allowed' });
}

export type AppRole='system_admin'|'center_manager'|'supervisor'|'teacher'|'student'|'guardian';
export type AppSessionPayload = { sub:string; userId:string; role:AppRole; exp:number };

function sessionSecret() {
  const secret = process.env.ADMIN_ACCESS_CODE;
  if (!secret) throw new Error('ADMIN_ACCESS_CODE is not configured');
  return secret;
}

function signValue(value: string) {
  return crypto.createHmac('sha256', sessionSecret()).update(value).digest('base64url');
}

export function issueAdminSession(input: { sub: string; userId: string; role?: AppRole }) {
  const payload: AppSessionPayload = {
    sub: input.sub,
    userId: input.userId,
    role: input.role || 'system_admin',
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `ashour1.${encoded}.${signValue(encoded)}`;
}

export function verifyAppSession(token: string): AppSessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'ashour1') return null;
  const [, encoded, signature] = parts;
  const expected = signValue(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as AppSessionPayload;
    if (!payload.sub || !payload.userId || !payload.role || payload.exp <= Math.floor(Date.now()/1000)) return null;
    return payload;
  } catch { return null; }
}

function permitted(payload:AppSessionPayload,req:any){
  if(payload.role==='system_admin') return true;
  const method=String(req.method||'GET').toUpperCase();
  const path=String(req.url||'').split('?')[0];
  const staff=['center_manager','supervisor','teacher'].includes(payload.role);
  if(!staff) return false;
  if(method==='GET' && ['/api/summary','/api/centers','/api/students','/api/circles','/api/attendance','/api/memorization','/api/plans'].includes(path)) return true;
  if(['POST','PUT'].includes(method) && ['/api/attendance','/api/memorization','/api/plans'].includes(path)) return true;
  if(payload.role==='center_manager' && method==='GET' && path==='/api/users') return true;
  return false;
}

export function requireAccess(req: any, res: any): boolean {
  const expected = process.env.ADMIN_ACCESS_CODE;
  if (!expected) {
    json(res, 500, { error: 'ADMIN_ACCESS_CODE is not configured', message: 'أضف متغير ADMIN_ACCESS_CODE في Vercel على كل البيئات.' });
    return false;
  }
  const received = req.headers['x-access-code'];
  if (received === expected) return true;
  const authorization = String(req.headers.authorization || '');
  if (authorization.startsWith('Bearer ')) {
    const token = authorization.slice(7).trim();
    const payload=token ? verifyAppSession(token) : null;
    if(payload && permitted(payload,req)) return true;
    if(payload){
      json(res,403,{error:'Forbidden',message:'ليس لهذا الحساب صلاحية الوصول إلى هذا القسم.'});
      return false;
    }
  }
  json(res, 401, { error: 'Unauthorized', message: 'جلسة الدخول غير صالحة أو انتهت. سجّل الدخول من جديد.' });
  return false;
}

export function handleError(res: any, error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return json(res, 500, { error: message });
}
