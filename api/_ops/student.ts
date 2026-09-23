import { getPool, query } from '../_lib/db.js';
import { isStaff,validDate,validMonth,validUuid } from '../_lib/actor.js';
import { json } from '../_lib/http.js';
import { managers,today,int,txt,scopedStudent } from './shared.js';
import {lateMinutes,makkahAsrPlus70} from '../_lib/prayer.js';
import {findPage,getAyahCountInSurah} from 'quran-meta/hafs';

export async function selfService(req:any,res:any,u:any){
  if(u.role!=='student')return json(res,403,{error:'Forbidden',message:'هذه الخدمة مخصصة لحساب الطالب.'});
  const s=(await query<any>(`select s.*,h.name circle_name,h.start_time,h.grace_minutes,c.name center_name from students s left join circles h on h.id=s.circle_id left join centers c on c.id=s.center_id where s.user_id=$1 limit 1`,[u.id]))[0];
  if(!s)return json(res,404,{error:'لم يتم ربط حسابك بسجل الطالب'});
  if(req.method==='GET'){
    const d=today();const att=(await query<any>('select attendance_date,status,check_in_at,check_out_at from attendance where student_id=$1 and attendance_date=$2::date',[s.id,d]))[0]||null;
    const recent=await query<any>("select record_date,record_type,surah_no,from_ayah,to_ayah,grade from memorization_records where student_id=$1 and record_type in ('new','review') order by record_date desc,created_at desc limit 12",[s.id]);
    return json(res,200,{student:{...s,effective_start_time:String(s.start_time||makkahAsrPlus70(d)).slice(0,5),automatic_start:!s.start_time},attendance:att,recent});
  }
  if(req.method==='POST'){
    const kind=String(req.query?.kind||'');
    if(kind==='punch'){
      if(!s.circle_id||s.status!=='active')return json(res,400,{error:'يلزم طالب نشط مرتبط بحلقة'});
      const action=String(req.body?.action||'');
      if(!['check_in','check_out'].includes(action))return json(res,400,{error:'إجراء الحضور غير صالح'});
      const d=today();let a=(await query<any>('select * from attendance where student_id=$1 and attendance_date=$2::date',[s.id,d]))[0];
      if(!a&&action==='check_out')return json(res,400,{error:'سجّل الحضور أولاً قبل تسجيل الانصراف'});
      if(!a){const late=lateMinutes(d,s.start_time),status=late>30?'late':'present';a=(await query<any>(`insert into attendance(student_id,circle_id,attendance_date,status,recorded_by,late_minutes,points_penalty,check_in_at) values($1,$2,$3::date,$4,$5,$6,0,now()) returning *`,[s.id,s.circle_id,d,status,u.id,late]))[0];}
      else if(action==='check_in'&&!a.check_in_at)a=(await query<any>('update attendance set check_in_at=now(),recorded_by=$1 where id=$2 returning *',[u.id,a.id]))[0];
      else if(action==='check_out'&&!a.check_out_at)a=(await query<any>('update attendance set check_out_at=now(),recorded_by=$1 where id=$2 returning *',[u.id,a.id]))[0];
      return json(res,200,a);
    }
    if(kind==='quran'){
      const approved=(await query<any>('select id from day_approvals where circle_id=$1 and approval_date=$2::date',[s.circle_id,today()]))[0];
      if(approved)return json(res,403,{error:'تم اعتماد سجل اليوم ولا يمكن إضافة سجل قرآني جديد'});
      const b=req.body||{},recordType=String(b.record_type||'new');
      if(!['new','review'].includes(recordType))return json(res,400,{error:'نوع السجل غير صالح'});
      const surah=int(b.surah_no,1,114),toSurah=int(b.to_surah_no||b.surah_no,1,114),from=int(b.from_ayah,1,Number(getAyahCountInSurah(surah as any))),to=int(b.to_ayah,1,Number(getAyahCountInSurah(toSurah as any)));
      if(toSurah<surah||(toSurah===surah&&to<from))return json(res,400,{error:'نهاية الورد يجب أن تكون بعد بدايته'});
      const fromPage=Number(findPage(surah as any,from as any)),toPage=Number(findPage(toSurah as any,to as any)),pages=Math.max(1,toPage-fromPage+1);
      const notes=[txt(b.notes,800),`— ${pages} صفحة`].filter(Boolean).join(' ');
      const row=(await query<any>(`insert into memorization_records(student_id,record_type,surah_no,from_ayah,to_surah_no,to_ayah,from_page,to_page,page_count,ayah_count,grade,notes,qiraah,approved,record_date)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,case when $5::int=$3::int then $6::int-$4::int+1 else null end,null,$10,'حفص عن عاصم',false,$11::date) returning *`,
        [s.id,recordType,surah,from,toSurah,to,fromPage,toPage,pages,notes||null,today()]))[0];
      return json(res,201,row);
    }
  }
  return json(res,405,{error:'Method not allowed'});
}
