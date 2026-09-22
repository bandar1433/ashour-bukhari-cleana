import { query } from './_lib/db.js';
import { getActor,isStaff } from './_lib/actor.js';
import { handleError,json } from './_lib/http.js';

export default async function handler(req:any,res:any){
  try{
    const u=await getActor(req,res);if(!u)return;
    if(req.method==='GET'){
      if(!isStaff(u.role))return json(res,403,{error:'Forbidden'});
      const rows=await query(`
        select m.id,m.student_id,m.record_date,m.record_type,m.surah_no,m.from_ayah,m.to_ayah,m.from_page,m.to_page,m.grade,m.notes,m.qiraah,m.approved,
          coalesce(s.full_name,us.full_name,'بدون اسم') full_name
        from memorization_records m join students s on s.id=m.student_id left join users us on us.id=s.user_id left join circles c on c.id=s.circle_id
        where $1='system_admin'
          or ($1 in ('center_manager','supervisor') and s.center_id=$2::uuid)
          or ($1='teacher' and c.teacher_user_id=$3::uuid)
        order by m.record_date desc,m.created_at desc limit 300
      `,[u.role,u.center_id,u.id]);
      return json(res,200,{items:rows});
    }
    if(req.method==='POST'||req.method==='PUT'){
      if(!isStaff(u.role))return json(res,403,{error:'Forbidden'});
      const b=req.body||{};
      const recordDate=String(b.record_date||new Date().toISOString().slice(0,10));
      const s=(await query<any>(`select s.id,s.center_id,s.circle_id,c.teacher_user_id from students s left join circles c on c.id=s.circle_id where s.id=$1`,[b.student_id]))[0];
      if(!s)return json(res,404,{error:'الطالب غير موجود'});
      const allowed=u.role==='system_admin'||(['center_manager','supervisor'].includes(u.role)&&s.center_id===u.center_id)||(u.role==='teacher'&&s.teacher_user_id===u.id);
      if(!allowed)return json(res,403,{error:'Forbidden',message:'الطالب خارج نطاق صلاحيتك.'});
      const locked=(await query<any>('select id from day_approvals where circle_id=$1 and approval_date=$2',[s.circle_id,recordDate]))[0];
      const exception=(await query<any>("select id from edit_exceptions where student_id=$1 and record_date=$2 and status='approved' and expires_at>now()",[s.id,recordDate]))[0];
      if(locked&&u.role==='teacher'&&!exception)return json(res,403,{error:'تم اعتماد اليوم',message:'تم اعتماد هذا اليوم. اطلب فتح تعديل استثنائي من الإدارة.'});
      if(req.method==='PUT'){
        if(!b.id)return json(res,400,{error:'معرف سجل التسميع مطلوب'});
        const existing=(await query<any>('select * from memorization_records where id=$1 and student_id=$2',[b.id,b.student_id]))[0];
        if(!existing)return json(res,404,{error:'سجل التسميع غير موجود'});
        const rows=await query(`update memorization_records set record_type=coalesce($3,record_type),surah_no=coalesce($4,surah_no),from_ayah=coalesce($5,from_ayah),to_ayah=coalesce($6,to_ayah),from_page=$7,to_page=$8,ayah_count=coalesce($6,to_ayah)-coalesce($5,from_ayah)+1,grade=$9,notes=$10,qiraah=coalesce($11,qiraah),recorded_by=$12 where id=$1 and student_id=$2 returning *`,
          [b.id,b.student_id,b.record_type||null,b.surah_no?Number(b.surah_no):null,b.from_ayah?Number(b.from_ayah):null,b.to_ayah?Number(b.to_ayah):null,b.from_page?Number(b.from_page):null,b.to_page?Number(b.to_page):null,b.grade!==undefined&&b.grade!==''?Number(b.grade):null,b.notes??existing.notes,b.qiraah||null,u.id]);
        return json(res,200,rows[0]);
      }
      const rows=await query(`insert into memorization_records(student_id,record_type,surah_no,from_ayah,to_ayah,from_page,to_page,ayah_count,grade,notes,qiraah,approved,record_date,recorded_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning *`,
        [b.student_id,b.record_type||'new',Number(b.surah_no),Number(b.from_ayah),Number(b.to_ayah),b.from_page?Number(b.from_page):null,b.to_page?Number(b.to_page):null,Number(b.to_ayah)-Number(b.from_ayah)+1,b.grade?Number(b.grade):null,b.notes||null,b.qiraah||'حفص عن عاصم',!!b.approved,recordDate,u.id]);
      return json(res,201,rows[0]);
    }
    return json(res,405,{error:'Method not allowed'});
  }catch(e){return handleError(res,e)}
}