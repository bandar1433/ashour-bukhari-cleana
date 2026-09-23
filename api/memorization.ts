import { query } from './_lib/db.js';
import { getActor,isStaff } from './_lib/actor.js';
import { handleError,json } from './_lib/http.js';
import {findPage,getAyahCountInSurah} from 'quran-meta/hafs';
import {riyadhDate} from './_lib/prayer.js';
import {isWeekLocked} from './_lib/weeklyLock.js';

export default async function handler(req:any,res:any){
  try{
    const u=await getActor(req,res);if(!u)return;
    if(req.method==='GET'){
      if(!isStaff(u.role))return json(res,403,{error:'Forbidden'});
      const rows=await query(`
        select m.id,m.student_id,m.record_date,m.record_type,m.surah_no,m.from_ayah,m.to_surah_no,m.to_ayah,m.from_page,m.to_page,m.page_count,m.grade,m.notes,m.qiraah,m.approved,
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
      const b=req.body||{};if(b.record_type&&!['new','review'].includes(String(b.record_type)))return json(res,400,{error:'النوع المسموح: الحفظ الجديد أو المراجعة فقط'});
      const recordDate=String(b.record_date||riyadhDate());
      const fromSurah=Number(b.surah_no),toSurah=Number(b.to_surah_no||b.surah_no),fromAyah=Number(b.from_ayah),toAyah=Number(b.to_ayah);
      if(!Number.isInteger(fromSurah)||fromSurah<1||fromSurah>114||!Number.isInteger(toSurah)||toSurah<1||toSurah>114)return json(res,400,{error:'السورة غير صالحة'});
      if(!Number.isInteger(fromAyah)||fromAyah<1||fromAyah>Number(getAyahCountInSurah(fromSurah as any))||!Number.isInteger(toAyah)||toAyah<1||toAyah>Number(getAyahCountInSurah(toSurah as any)))return json(res,400,{error:'رقم الآية غير صالح للسورة المحددة'});
      if(toSurah<fromSurah||(toSurah===fromSurah&&toAyah<fromAyah))return json(res,400,{error:'نهاية الورد يجب أن تكون بعد بدايته'});
      const fromPage=Number(findPage(fromSurah as any,fromAyah as any)),toPage=Number(findPage(toSurah as any,toAyah as any)),pageCount=Math.max(1,toPage-fromPage+1);
      const s=(await query<any>(`select s.id,s.center_id,s.circle_id,c.teacher_user_id from students s left join circles c on c.id=s.circle_id where s.id=$1`,[b.student_id]))[0];
      if(!s)return json(res,404,{error:'الطالب غير موجود'});
      const allowed=u.role==='system_admin'||(['center_manager','supervisor'].includes(u.role)&&s.center_id===u.center_id)||(u.role==='teacher'&&s.teacher_user_id===u.id);
      if(!allowed)return json(res,403,{error:'Forbidden',message:'الطالب خارج نطاق صلاحيتك.'});
      const locked=(await query<any>('select id from day_approvals where circle_id=$1 and approval_date=$2',[s.circle_id,recordDate]))[0];const weekLocked=s.circle_id?await isWeekLocked(s.circle_id,recordDate):false;
      const exception=(await query<any>("select id from edit_exceptions where student_id=$1 and record_date=$2 and status='approved' and expires_at>now()",[s.id,recordDate]))[0];
      if((locked||weekLocked)&&u.role==='teacher'&&!exception)return json(res,403,{error:weekLocked?'الأسبوع مقفل':'تم اعتماد اليوم',message:weekLocked?'تم إقفال هذا الأسبوع من الإشراف. اطلب فتحه قبل التعديل.':'تم اعتماد هذا اليوم. اطلب فتح تعديل استثنائي من الإدارة.'});
      if(req.method==='PUT'){
        if(!b.id)return json(res,400,{error:'معرف السجل القرآني مطلوب'});
        const existing=(await query<any>('select * from memorization_records where id=$1 and student_id=$2',[b.id,b.student_id]))[0];
        if(!existing)return json(res,404,{error:'السجل القرآني غير موجود'});
        const rows=await query(`update memorization_records set record_type=coalesce($3,record_type),surah_no=coalesce($4,surah_no),from_ayah=coalesce($5,from_ayah),to_surah_no=coalesce($6,to_surah_no,surah_no),to_ayah=coalesce($7,to_ayah),from_page=$8,to_page=$9,page_count=case when $8::int is not null and $9::int is not null then greatest(1,$9::int-$8::int+1) else null end,ayah_count=case when coalesce($6,to_surah_no,surah_no)=coalesce($4,surah_no) then coalesce($7,to_ayah)-coalesce($5,from_ayah)+1 else ayah_count end,grade=$10,notes=$11,qiraah=coalesce($12,qiraah),recorded_by=$13 where id=$1 and student_id=$2 returning *`,
          [b.id,b.student_id,b.record_type||null,fromSurah,fromAyah,toSurah,toAyah,fromPage,toPage,b.grade!==undefined&&b.grade!==''?Number(b.grade):null,b.notes??existing.notes,b.qiraah||null,u.id]);
        return json(res,200,rows[0]);
      }
      const rows=await query(`insert into memorization_records(student_id,record_type,surah_no,from_ayah,to_surah_no,to_ayah,from_page,to_page,page_count,ayah_count,grade,notes,qiraah,approved,record_date,recorded_by) values($1,$2,$3,$4,$5,$6,$7,$8,case when $7::int is not null and $8::int is not null then greatest(1,$8::int-$7::int+1) else null end,case when $5::int=$3::int then $6::int-$4::int+1 else null end,$9,$10,$11,$12,$13,$14) returning *`,
        [b.student_id,b.record_type||'new',fromSurah,fromAyah,toSurah,toAyah,fromPage,toPage,b.grade!==undefined&&b.grade!==''?Number(b.grade):null,b.notes||null,b.qiraah||'حفص عن عاصم',!!b.approved,recordDate,u.id]);
      return json(res,201,rows[0]);
    }
    return json(res,405,{error:'Method not allowed'});
  }catch(e){return handleError(res,e)}
}