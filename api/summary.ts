import { query } from './_lib/db.js';
import { handleError, json, requireAccess } from './_lib/http.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  if (!requireAccess(req, res)) return;

  try {
    const rows = await query<{
      centers: string;
      circles: string;
      students: string;
      teachers: string;
      users: string;
      active_users: string;
    }>(`
      select
        (select count(*) from centers)::text as centers,
        (select count(*) from circles)::text as circles,
        (select count(*) from students)::text as students,
        (select count(*) from users where role = 'teacher')::text as teachers,
        (select count(*) from users)::text as users,
        (select count(*) from users where is_active = true)::text as active_users
    `);

    const row = rows[0];

    return json(res, 200, {
      centers: Number(row.centers),
      circles: Number(row.circles),
      students: Number(row.students),
      teachers: Number(row.teachers),
      users: Number(row.users),
      activeUsers: Number(row.active_users),
    });
  } catch (error) {
    return handleError(res, error);
  }
}
