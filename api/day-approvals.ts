import { query } from './_lib/db.js';
import { getActor,isStaff,validDate,validUuid } from './_lib/actor.js';
import { handleError,json } from './_lib/http.js';

export default async function handler(req:any,res:any){
  try{
    const u=await getActor(req,res); if(!u)return;
    if(!isStaff(u.role))return json(res,403,{error:'Forbidden',message:'ليست لديك صلاحية لاعتماد اليوم.'});
    if(req.method==='POST'){
      const b=req.body||{}; const circleId=validUuid(b.circle_id); const d=validDate(b.approval_date);
      if(!circleId||!d)return json(res,400,{error:'بيانات الاعتماد غير مكتملة'});
      const allowed=(await query<any>(`select id from circles where id=$1 and ($2='system_admin' or ($2 in ('center_manager','supervisor') and center_id=$3::uuid) or ($2='teacher' and teacher_user_id=$4::uuid))`,[circleId,u.role,u.center_id,u.id]))[0];
      if(!allowed)return json(res,403,{error:'Forbidden',message:'الحلقة خارج نطاق صلاحيتك.'});
      const row=(await query(`insert into day_approvals(circle_id,approval_date,approved_by) values($1,$2,$3) on conflict(circle_id,approval_date) do update set approved_by=excluded.approved_by,approved_at=now() returning *`,[circleId,d,u.id]))[0];
      return json(res,200,row);
    }
    return json(res,405,{error:'Method not allowed'});
  }catch(e){return handleError(res,e)}
}
