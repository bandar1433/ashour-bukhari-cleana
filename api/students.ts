import { query } from './_lib/db';
import { handleError, json, requireAccess } from './_lib/http';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  if (!requireAccess(req, res)) return;

  try {
    const rows = await query(`
      select
        s.id,
        u.id as user_id,
        coalesce(u.full_name, u.email, 'بدون اسم') as full_name,
        u.email,
        u.is_active,
        c.name as circle_name,
        ce.name as center_name
      from students s
      left join users u on u.id = s.user_id
      left join circles c on c.id = s.circle_id
      left join centers ce on ce.id = u.center_id
      order by full_name nulls last
      limit 500
    `);

    return json(res, 200, { items: rows });
  } catch (error) {
    return handleError(res, error);
  }
}
