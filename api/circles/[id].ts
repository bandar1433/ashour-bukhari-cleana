import { query } from '../_lib/db.js';
import { handleError, json, requireAccess } from '../_lib/http.js';

export default async function handler(req:any,res:any){
  if(!requireAccess(req,res)) return;
  if(req.method!=='PUT') return json(res,405,{error:'Method not allowed'});
  try{
    const id=String(req.query?.id||'');
    const b=req.body||{};
    const existing=(await query<any>('select * from circles where id=$1',[id]))[0];
    if(!existing) return json(res,404,{error:'الحلقة غير موجودة'});
    const rows=await query(`
      update circles set
        name=coalesce($2,name),
        center_id=coalesce($3::uuid,center_id),
        teacher_user_id=$4,
        schedule=$5,
        circle_type=coalesce($6,circle_type),
        start_time=$7,
        grace_minutes=coalesce($8,grace_minutes),
        student_track=$9,
        quran_track=$10,
        is_active=coalesce($11,is_active)
      where id=$1 returning *
    `,[
      id,b.name?.trim()||null,b.center_id||null,
      b.teacher_user_id===undefined?existing.teacher_user_id:(b.teacher_user_id||null),
      b.schedule===undefined?existing.schedule:(b.schedule||null),
      b.circle_type||null,
      b.start_time===undefined?existing.start_time:(b.start_time||null),
      b.grace_minutes===undefined?existing.grace_minutes:Number(b.grace_minutes),
      b.student_track===undefined?existing.student_track:(b.student_track||null),
      b.quran_track===undefined?existing.quran_track:(b.quran_track||null),
      b.is_active===undefined?existing.is_active:Boolean(b.is_active)
    ]);
    return json(res,200,rows[0]);
  }catch(e){return handleError(res,e)}
}
