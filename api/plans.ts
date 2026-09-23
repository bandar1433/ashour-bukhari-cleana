import { query } from './_lib/db.js';
import { getActor,isStaff } from './_lib/actor.js';
import { handleError,json } from './_lib/http.js';

export default async function handler(req:any,res:any){
  try{
    const u=await getActor(req,res);if(!u)return;
    if(!isStaff(u.role)&&u.role!=='student')return json(res,403,{error:'Forbidden'});
    if(req.method==='POST'||req.method==='PUT'){
      if(!isStaff(u.role))return json(res,403,{error:'Forbidden'});
      const b=req.body||{},week=String(b.week_start||'');
      const student=(await query<any>(`select s.id,s.center_id,s.circle_id,c.teacher_user_id from students s left join circles c on c.id=s.circle_id where s.id=$1`,[b.student_id]))[0];
      if(!student)return json(res,404,{error:'الطالب غير موجود'});
      const allowed=u.role==='system_admin'||(['center_manager','supervisor'].includes(u.role)&&student.center_id===u.center_id)||(u.role==='teacher'&&student.teacher_user_id===u.id);
      if(!allowed)return json(res,403,{error:'Forbidden',message:'الطالب خارج نطاق صلاحيتك.'});
      if(!/^\d{4}-\d{2}-\d{2}$/.test(week))return json(res,400,{error:'بداية الأسبوع مطلوبة'});
      const days=['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'];
      const distribute=(v:any)=>{const n=Math.max(0,Math.floor(Number(v)||0)),q=Math.floor(n/6),r=n%6;return days.map((_,i)=>q+(i<r?1:0))};
      if(b.weekly_new_total!==undefined||b.weekly_review_total!==undefined){
        const nw=distribute(b.weekly_new_total),rv=distribute(b.weekly_review_total),rows:any[]=[];
        for(let i=0;i<6;i++){rows.push((await query<any>(`insert into weekly_plans(student_id,week_start,day_name,new_target,review_target,goals,created_by) values($1,$2::date,$3,$4,$5,$6,$7) on conflict(student_id,week_start,day_name) do update set new_target=excluded.new_target,review_target=excluded.review_target,goals=excluded.goals,created_by=excluded.created_by returning *`,[student.id,week,days[i],String(nw[i]),String(rv[i]),b.goals||null,u.id]))[0])}
        return json(res,200,{items:rows,distribution:{new:nw,review:rv},days});
      }
      if(!days.includes(String(b.day_name||'')))return json(res,400,{error:'اليوم يجب أن يكون من السبت إلى الخميس'});
      const row=(await query<any>(`insert into weekly_plans(student_id,week_start,day_name,new_target,review_target,goals,created_by) values($1,$2::date,$3,$4,$5,$6,$7) on conflict(student_id,week_start,day_name) do update set new_target=excluded.new_target,review_target=excluded.review_target,goals=excluded.goals,created_by=excluded.created_by returning *`,[student.id,week,b.day_name,b.new_target||null,b.review_target||null,b.goals||null,u.id]))[0];
      return json(res,200,row);
    }
    if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
    const rows=await query(`
      select w.id,w.student_id,w.week_start,w.day_name,w.new_target,w.review_target,w.goals,coalesce(s.full_name,us.full_name,'بدون اسم') full_name
      from weekly_plans w join students s on s.id=w.student_id left join users us on us.id=s.user_id left join circles c on c.id=s.circle_id
      where $1='system_admin'
        or ($1 in ('center_manager','supervisor') and s.center_id=$2::uuid)
        or ($1='teacher' and c.teacher_user_id=$3::uuid)
        or ($1='student' and s.user_id=$3::uuid)
      order by w.week_start desc,w.created_at desc limit 300
    `,[u.role,u.center_id,u.id]);
    return json(res,200,{items:rows});
  }catch(e){return handleError(res,e)}
}