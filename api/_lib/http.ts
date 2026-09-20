export function json(res: any, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function methodNotAllowed(res: any) {
  return json(res, 405, { error: 'Method not allowed' });
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

  if (received !== expected) {
    json(res, 401, {
      error: 'Unauthorized',
      message: 'رمز الدخول غير صحيح أو غير موجود.',
    });
    return false;
  }

  return true;
}

export function handleError(res: any, error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return json(res, 500, { error: message });
}
