import { query } from '../_lib/db.js';
import { json } from '../_lib/http.js';
import {today} from './shared.js';
import {lateMinutes,makkahAsrPlus70} from '../_lib/prayer.js';
import {isWeekLocked} from '../_lib/weeklyLock.js';
import {findPage,getAyahCountInSurah} from 'quran-meta/hafs';

export async function selfService(req:any,res:any,u:any){
  if(u.role!=='student')return json(res,403,{error:'Forbidden',message:'هذه الخدمة مخصصة لحساب الطالب.'});
  const s=(await query<any>(`select s.*,h.name circle_name,h.start_time,h.grace_minutes,c.name center_name from students s left join circles h on h.id=s.circle_id left join centers c on c.id=s.center_id where s.user_id=$1 limit 1`,[u.id]))[0];
  if(!s)return json(res,404,{error:'لم يتم ربط حسابك بسجل الطالب'});
  if(req.method==='GET'){
    const d=today();const att=(await query<any>('select attendance_date,status,late_minutes,check_in_at,check_out_at from attendance where student_id=$1 and attendance_date=$2::date',[s.id,d]))[0]||null;
    const recent=await query<any>("select record_date,record_type,surah_no,from_ayah,to_ayah,from_page,to_page,page_count,grade from memorization_records where student_id=$1 and record_type in ('new','review') order by record_date desc,created_at desc limit 12",[s.id]);
    const dateObj=new Date(d+'T00:00:00Z'),offset=(dateObj.getUTCDay()+1)%7,wd=new Date(dateObj);wd.setUTCDate(wd.getUTCDate()-offset);const weekStart=wd.toISOString().slice(0,10);
    const dayNames=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'],dayName=dayNames[dateObj.getUTCDay()];
    const plan=(await query<any>('select new_target,review_target,goals from weekly_plans where student_id=$1 and week_start=$2::date and day_name=$3 order by created_at desc limit 1',[s.id,weekStart,dayName]))[0]||{};
    const done=(await query<any>("select record_type,coalesce(sum(page_count),0)::numeric pages from memorization_records where student_id=$1 and record_date=$2::date and record_type in ('new','review') group by record_type",[s.id,d]));
    const dm:any={};for(const x of done)dm[x.record_type]=Number(x.pages||0);
    const target=(v:any)=>/^\d+(?:\.\d+)?$/.test(String(v||''))?Number(v):0,nt=target(plan.new_target),rt=target(plan.review_target);
    const attendanceScore=att?.status==='excused'?null:att?.status==='absent'?0:att?.status?Number(att.late_minutes||0)<=30?30:Number(att.late_minutes||0)<=60?20:10:0;
    const newScore=nt>0?Math.min(30,Math.round(30*(dm.new||0)/nt)):30,reviewScore=rt>0?Math.min(40,Math.round(40*(dm.review||0)/rt)):40;
    return json(res,200,{student:{...s,effective_start_time:String(s.start_time||makkahAsrPlus70(d)).slice(0,5),automatic_start:!s.start_time},attendance:att,recent,today:{date:d,week_start:weekStart,is_friday:dateObj.getUTCDay()===5,new_target:nt,review_target:rt,new_done:dm.new||0,review_done:dm.review||0,attendance_score:attendanceScore,new_score:newScore,review_score:reviewScore,daily_score:dateObj.getUTCDay()===5||attendanceScore===null?null:attendanceScore+newScore+reviewScore,goals:plan.goals||''}});
  }
  if(req.method==='POST'){
    const kind=String(req.query?.kind||'');
    if(kind==='punch'){
      if(!s.circle_id||s.status!=='active')return json(res,400,{error:'يلزم طالب نشط مرتبط بحلقة'});
      const action=String(req.body?.action||'');
      if(!['check_in','check_out'].includes(action))return json(res,400,{error:'إجراء الحضور غير صالح'});
      const d=today(),dateObj=new Date(d+'T00:00:00Z');
      if(dateObj.getUTCDay()===5)return json(res,403,{error:'يوم الجمعة إجازة ولا يوجد تسجيل حضور.'});
      if(await isWeekLocked(s.circle_id,d))return json(res,403,{error:'الأسبوع مقفل',message:'تم إقفال الأسبوع من الإشراف.'});
      const approved=(await query<any>('select id from day_approvals where circle_id=$1 and approval_date=$2::date',[s.circle_id,d]))[0];
      if(approved)return json(res,403,{error:'تم اعتماد اليوم',message:'تم اعتماد سجل اليوم ولا يمكن للطالب تعديله.'});
      let a=(await query<any>('select * from attendance where student_id=$1 and attendance_date=$2::date',[s.id,d]))[0];
      if(action==='check_out'&&!a?.check_in_at)return json(res,400,{error:'سجّل الحضور أولاً قبل تسجيل الانصراف'});
      if(!a){const late=lateMinutes(d,s.start_time),status=late>30?'late':'present';a=(await query<any>(`insert into attendance(student_id,circle_id,attendance_date,status,recorded_by,late_minutes,points_penalty,check_in_at) values($1,$2,$3::date,$4,$5,$6,0,now()) returning *`,[s.id,s.circle_id,d,status,u.id,late]))[0];}
      else if(action==='check_in'&&!a.check_in_at){const late=lateMinutes(d,s.start_time),status=late>30?'late':'present';a=(await query<any>('update attendance set check_in_at=now(),status=$1,late_minutes=$2,recorded_by=$3 where id=$4 returning *',[status,late,u.id,a.id]))[0];}
      else if(action==='check_out'&&!a.check_out_at)a=(await query<any>('update attendance set check_out_at=now(),recorded_by=$1 where id=$2 returning *',[u.id,a.id]))[0];
      return json(res,200,a);
    }
    if(kind==='quran'){
      if(!s.circle_id||s.status!=='active')return json(res,400,{error:'يلزم طالب نشط مرتبط بحلقة'});
      const d=today(),dateObj=new Date(d+'T00:00:00Z');
      if(dateObj.getUTCDay()===5)return json(res,403,{error:'يوم الجمعة إجازة ولا يوجد تسجيل يومي.'});
      if(await isWeekLocked(s.circle_id,d))return json(res,403,{error:'الأسبوع مقفل',message:'تم إقفال الأسبوع من الإشراف.'});
      const approved=(await query<any>('select id from day_approvals where circle_id=$1 and approval_date=$2::date',[s.circle_id,d]))[0];
      if(approved)return json(res,403,{error:'تم اعتماد اليوم',message:'تم اعتماد سجل اليوم ولا يمكن للطالب تعديله.'});
      const b=req.body||{},recordType=String(b.record_type||'');
      if(!['new','review'].includes(recordType))return json(res,400,{error:'اختر المراجعة أو الحفظ الجديد.'});
      const fromSurah=Number(b.surah_no),toSurah=Number(b.to_surah_no||b.surah_no),rawFromAyah=Number(b.from_ayah||0),rawToAyah=Number(b.to_ayah||0);
      if(!Number.isInteger(fromSurah)||fromSurah<1||fromSurah>114||!Number.isInteger(toSurah)||toSurah<1||toSurah>114)return json(res,400,{error:'السورة غير صالحة'});
      const maxFrom=Number(getAyahCountInSurah(fromSurah as any)),maxTo=Number(getAyahCountInSurah(toSurah as any));
      if((rawFromAyah&&(!Number.isInteger(rawFromAyah)||rawFromAyah<1||rawFromAyah>maxFrom))||(rawToAyah&&(!Number.isInteger(rawToAyah)||rawToAyah<1||rawToAyah>maxTo)))return json(res,400,{error:'رقم الآية غير صالح'});
      const fromAyah=rawFromAyah||1,toAyah=rawToAyah||maxTo;
      if(toSurah<fromSurah||(toSurah===fromSurah&&toAyah<fromAyah))return json(res,400,{error:'نهاية الورد يجب أن تكون بعد بدايته'});
      const fromPage=Number(findPage(fromSurah as any,fromAyah as any)),toPage=Number(findPage(toSurah as any,toAyah as any));
      const pageCount=Math.max(1,toPage-fromPage+1),ayahCount=toSurah===fromSurah?Math.max(1,toAyah-fromAyah+1):null;
      const existing=(await query<any>("select id from memorization_records where student_id=$1 and record_date=$2::date and record_type=$3 order by created_at desc limit 1",[s.id,d,recordType]))[0];
      if(existing){
        const row=(await query<any>(`update memorization_records set
          surah_no=$1::smallint,from_ayah=$2::smallint,to_surah_no=$3::smallint,to_ayah=$4::smallint,
          from_page=$5::smallint,to_page=$6::smallint,page_count=$7::smallint,ayah_count=$8::smallint,recorded_by=$9
          where id=$10 returning *`,
          [fromSurah,fromAyah,toSurah,toAyah,fromPage,toPage,pageCount,ayahCount,u.id,existing.id]))[0];
        return json(res,200,row);
      }
      const row=(await query<any>(`insert into memorization_records(student_id,record_type,surah_no,from_ayah,to_surah_no,to_ayah,from_page,to_page,page_count,ayah_count,grade,notes,qiraah,approved,record_date,recorded_by)
        values($1,$2,$3::smallint,$4::smallint,$5::smallint,$6::smallint,$7::smallint,$8::smallint,$9::smallint,$10::smallint,null,null,'حفص عن عاصم',false,$11::date,$12) returning *`,
        [s.id,recordType,fromSurah,fromAyah,toSurah,toAyah,fromPage,toPage,pageCount,ayahCount,d,u.id]))[0];
      return json(res,201,row);
    }



  }
  return json(res,405,{error:'Method not allowed'});
}
