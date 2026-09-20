import { query } from './_lib/db.js';
import { handleError, json, requireAccess } from './_lib/http.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  if (!requireAccess(req, res)) return;

  try {
    const rows = await query(`
      select
        id,
        coalesce(full_name, email, 'بدون اسم') as full_name,
        email,
        role,
        center_id,
        is_active,
        case when auth_subject is null then false else true end as linked
      from users
      order by
        case role
          when 'system_admin' then 1
          when 'center_admin' then 2
          when 'teacher' then 3
          when 'student' then 4
          else 5
        end,
        full_name nulls last,
        email nulls last
      limit 500
    `);

    return json(res, 200, { items: rows });
  } catch (error) {
    return handleError(res, error);
  }
}
