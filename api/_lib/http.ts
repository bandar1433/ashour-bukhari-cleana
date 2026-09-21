import crypto from 'node:crypto';

export function json(res: any, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function methodNotAllowed(res: any) {
  return json(res, 405, { error: 'Method not allowed' });
}

type AdminSessionPayload = {
  sub: string;
  userId: string;
  role: 'system_admin';
  exp: number;
};

function sessionSecret() {
  const secret = process.env.ADMIN_ACCESS_CODE;
  if (!secret) throw new Error('ADMIN_ACCESS_CODE is not configured');
  return secret;
}

function signValue(value: string) {
  return crypto.createHmac('sha256', sessionSecret()).update(value).digest('base64url');
}

export function issueAdminSession(input: { sub: string; userId: string }) {
  const payload: AdminSessionPayload = {
    sub: input.sub,
    userId: input.userId,
    role: 'system_admin',
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `ashour1.${encoded}.${signValue(encoded)}`;
}

function verifyAdminSession(token: string): AdminSessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'ashour1') return null;
  const [, encoded, signature] = parts;
  const expected = signValue(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as AdminSessionPayload;
    if (
      payload.role !== 'system_admin' ||
      !payload.sub ||
      !payload.userId ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) return null;
    return payload;
  } catch {
    return null;
  }
}

export function requireAccess(req: any, res: any): boolean {
  const expected = process.env.ADMIN_ACCESS_CODE;

  if (!expected) {
    json(res, 500, {
      error: 'ADMIN_ACCESS_CODE is not configured',
      message: 'أضف متغير ADMIN_ACCESS_CODE في Vercel على كل البيئات.',
    });
    return false;
  }

  const received = req.headers['x-access-code'];
  if (received === expected) return true;

  const authorization = String(req.headers.authorization || '');
  if (authorization.startsWith('Bearer ')) {
    const token = authorization.slice(7).trim();
    if (token && verifyAdminSession(token)) return true;
  }

  json(res, 401, {
    error: 'Unauthorized',
    message: 'جلسة الدخول غير صالحة أو انتهت. سجّل الدخول من جديد.',
  });
  return false;
}

export function handleError(res: any, error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return json(res, 500, { error: message });
}
