import { query } from './_lib/db.js';
import { handleError, json, requireAccess } from './_lib/http.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  if (!requireAccess(req, res)) return;

  try {
    const rows = await query(`
      select
        c.id,
        c.name,
        ce.name as center_name,
        t.full_name as teacher_name,
        t.email as teacher_email,
        count(s.id)::int as students_count
      from circles c
      left join centers ce on ce.id = c.center_id
      left join users t on t.id = c.teacher_user_id
      left join students s on s.circle_id = c.id
      group by c.id, c.name, ce.name, t.full_name, t.email
      order by c.name
      limit 200
    `);

    return json(res, 200, { items: rows });
  } catch (error) {
    return handleError(res, error);
  }
}
