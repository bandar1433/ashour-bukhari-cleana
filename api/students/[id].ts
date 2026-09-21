import { query } from '../_lib/db.js';
import { handleError, json, requireAccess } from '../_lib/http.js';

export default async function handler(req:any,res:any){
  if(!requireAccess(req,res)) return;
  if(req.method!=='PUT') return json(res,405,{error:'Method not allowed'});
  try{
    const id=String(req.query?.id||'');
    const b=req.body||{};
    const existing=(await query<any>('select * from students where id=$1',[id]))[0];
    if(!existing) return json(res,404,{error:'الطالب غير موجود'});

    let centerId=b.center_id!==undefined?(b.center_id||null):existing.center_id;
    let circleId=b.circle_id!==undefined?(b.circle_id||null):existing.circle_id;
    if(circleId){
      const circle=(await query<any>('select center_id from circles where id=$1',[circleId]))[0];
      if(!circle) return json(res,400,{error:'الحلقة المحددة غير موجودة'});
      centerId=circle.center_id;
    }

    const rows=await query(`
      update students set
        full_name=coalesce($2,full_name),
        center_id=$3,
        circle_id=$4,
        grade_level=coalesce($5,grade_level),
        status=coalesce($6::student_status,status),
        updated_at=now()
      where id=$1 returning *
    `,[id,b.full_name?.trim()||null,centerId,circleId,b.grade_level||null,b.status||null]);
    return json(res,200,rows[0]);
  }catch(e){return handleError(res,e)}
}
