import { query } from './_lib/db.js'; import { handleError,json } from './_lib/http.js';
export default async function handler(req:any,res:any){if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});try{
const [stats,news,circles]=await Promise.all([
query<any>(`select (select count(*) from students where status='active')::int students,(select count(*) from users where role='teacher' and is_active)::int teachers,(select count(*) from circles where is_active)::int circles,(select count(*) from centers where is_active)::int centers`),
query(`select id,kind,title,body,image_url,video_url,event_date,published_at from news_events where status='published' order by coalesce(published_at,event_date,created_at) desc limit 12`),
query(`select c.id,c.name,c.age_stage,c.schedule,c.student_track,c.quran_track,ce.name center_name,u.full_name teacher_name from circles c left join centers ce on ce.id=c.center_id left join users u on u.id=c.teacher_user_id where c.is_active order by ce.name,c.name limit 100`)
]);return json(res,200,{stats:stats[0],news,circles});}catch(e){return handleError(res,e)}}
