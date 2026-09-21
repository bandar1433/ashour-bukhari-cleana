import { query } from './_lib/db.js';
import { getActor,validDate } from './_lib/actor.js';
import { handleError,json } from './_lib/http.js';

export default async function handler(req:any,res:any){
  if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
  try{
    const u=await getActor(req,res); if(!u)return;
    const from=validDate(req.query?.from)||new Date().toISOString().slice(0,10);
    const to=validDate(req.query?.to)||from;
    const rows=await query<any>(`
      with days as (
        select s.id student_id,s.full_name,d::date day,(d::date-((extract(dow from d)::int+1)%7))::date week_start
        from students s cross join generate_series($4::date,$5::date,'1 day') d
        where (
          $1='system_admin' or
          ($1 in ('center_manager','supervisor') and s.center_id=$2::uuid) or
          ($1='teacher' and exists(select 1 from circles h where h.id=s.circle_id and h.teacher_user_id=$3::uuid)) or
          ($1='student' and s.user_id=$3::uuid)
        )
      ), plans as (
        select w.student_id,w.week_start,
          sum(case when w.new_target like 'صفحات مصحف المدينة:%' then greatest(0,(substring(w.new_target from '–([0-9]+)')::numeric)-(substring(w.new_target from ': ([0-9]+)')::numeric)+1) else 0 end)/6.0 new_daily_target,
          sum(case when w.review_target like 'صفحات مصحف المدينة:%' then greatest(0,(substring(w.review_target from '–([0-9]+)')::numeric)-(substring(w.review_target from ': ([0-9]+)')::numeric)+1) else 0 end)/6.0 review_daily_target
        from weekly_plans w group by w.student_id,w.week_start
      ), done as (
        select student_id,record_date,
          sum(case when record_type='new' then coalesce((substring(notes from '— ([0-9]+) صفحة'))::numeric,0) else 0 end) new_pages,
          sum(case when record_type='review' then coalesce((substring(notes from '— ([0-9]+) صفحة'))::numeric,0) else 0 end) review_pages
        from memorization_records where record_date between $4 and $5 group by student_id,record_date
      ), att as (
        select student_id,attendance_date,status,late_minutes,points_penalty from attendance where attendance_date between $4 and $5
      )
      select days.student_id,days.full_name,days.day,att.status,
        round(coalesce(done.new_pages,0),2) new_pages,round(coalesce(done.review_pages,0),2) review_pages,
        round(coalesce(plans.new_daily_target,0),2) new_daily_target,round(coalesce(plans.review_daily_target,0),2) review_daily_target,
        case when coalesce(plans.new_daily_target,0)>0 then least(100,round(100*coalesce(done.new_pages,0)/plans.new_daily_target))::int else 0 end new_grade,
        case when coalesce(plans.review_daily_target,0)>0 then least(100,round(100*coalesce(done.review_pages,0)/plans.review_daily_target))::int else 0 end review_grade,
        case when att.status='excused' then null when att.status='absent' then 0 when att.status in ('present','late') then greatest(0,least(30,30+coalesce(att.points_penalty,0))) else 0 end attendance_score,
        case when att.status='excused' then null else
          least(30,round(30*least(1,coalesce(done.new_pages,0)/nullif(plans.new_daily_target,0))))::int+
          least(40,round(40*least(1,coalesce(done.review_pages,0)/nullif(plans.review_daily_target,0))))::int+
          case when att.status='absent' then 0 when att.status in ('present','late') then greatest(0,least(30,30+coalesce(att.points_penalty,0))) else 0 end
        end daily_score
      from days left join plans on plans.student_id=days.student_id and plans.week_start=days.week_start
      left join done on done.student_id=days.student_id and done.record_date=days.day
      left join att on att.student_id=days.student_id and att.attendance_date=days.day
      order by days.day desc,days.full_name
    `,[u.role,u.center_id,u.id,from,to]);
    const scored=rows.filter(r=>r.daily_score!==null);
    const average=scored.length?Math.round(scored.reduce((n,r)=>n+Number(r.daily_score),0)/scored.length):0;
    return json(res,200,{rows,weights:{new:30,review:40,attendance:30},formula:'الصفحات المنجزة ÷ المطلوب اليومي من الخطة الأسبوعية',average});
  }catch(e){return handleError(res,e)}
}
