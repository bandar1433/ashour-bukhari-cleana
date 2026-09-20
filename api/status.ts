import { hasDatabaseUrl, query } from './_lib/db.js';
import { json } from './_lib/http.js';

export default async function handler(req: any, res: any) {
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
