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
          when 'center_manager' then 2
          when 'supervisor' then 3
          when 'teacher' then 4
          when 'student' then 5
          when 'guardian' then 6
          else 7
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
