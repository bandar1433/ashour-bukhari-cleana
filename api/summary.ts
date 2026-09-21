import { query } from './_lib/db.js';
import { handleError, json, requireAccess } from './_lib/http.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  if (!requireAccess(req, res)) return;
  try {
    const rows = await query<any>(`
      select
        (select count(*) from centers)::text as centers,
        (select count(*) from circles)::text as circles,
        (select count(*) from students)::text as students,
        (select count(*) from users where role = 'teacher')::text as teachers,
        (select count(*) from users)::text as users,
        (select count(*) from users where is_active = true)::text as active_users,
        (select count(*) from attendance)::text as attendance,
        (select count(*) from memorization_records)::text as memorization,
        (select count(*) from weekly_plans)::text as plans,
        (select count(*) from news_events)::text as news
    `);
    const row = rows[0];
    return json(res, 200, {
      centers:+row.centers,circles:+row.circles,students:+row.students,teachers:+row.teachers,
      users:+row.users,activeUsers:+row.active_users,attendance:+row.attendance,
      memorization:+row.memorization,plans:+row.plans,news:+row.news
    });
  } catch (error) { return handleError(res, error); }
}
