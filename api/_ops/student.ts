import { query } from '../_lib/db.js';
import { json } from '../_lib/http.js';
import {today} from './shared.js';
import {lateMinutes,makkahAsrPlus70,riyadhDate} from '../_lib/prayer.js';
import {isWeekLocked} from '../_lib/weeklyLock.js';
import {findPage,getAyahCountInSurah} from 'quran-meta/hafs';

const targetPages=(v:any)=>{const s=String(v||'').trim();if(/^\d+(?:\.\d+)?$/.test(s))return Number(s);const pref=s.match(/^(\d+(?:\.\d+)?)\s*\|/);return pref?Number(pref[1]):0};

function operationTime(body:any){
 const od=String(body?.offline_record_date||'').trim(),oe=String(body?.offline_event_at||'').trim();
 if(!od&&!oe)return {offline:false,date:today(),instant:new Date(),error:''};
 if(!/^\d{4}-\d{2}-\d{2}$/.test(od)||!oe)return {offline:true,date:od,instant:new Date(),error:'بيانات التسجيل دون اتصال غير مكتملة.'};
 const instant=new Date(oe),ms=instant.getTime(),now=Date.now();
 if(!Number.isFinite(ms)||riyadhDate(instant)!==od)return {offline:true,date:od,instant,error:'تاريخ أو وقت التسجيل دون اتصال غير صالح.'};
 if(ms>now+10*60*1000||now-ms>72*60*60*1000)return {offline:true,date:od,instant,error:'يجب مزامنة التسجيلات المحفوظة خلال 72 ساعة.'};
 return {offline:true,date:od,instant,error:''};
}
async function editBlock(circleId:string,date:string,instant:Date,offline:boolean){
 const approval=(await query<any>('select approved_at from day_approvals where circle_id=$1 and approval_date=$2::date',[circleId,date]))[0];
 if(approval&&(!offline||new Date(approval.approved_at).getTime()<=instant.getTime()))return {error:'تم اعتماد اليوم',message:'تم اعتماد سجل اليوم قبل هذا التسجيل ولا يمكن تعديله.'};
 const lock=(await query<any>(`select locked_at from weekly_locks where circle_id=$1 and week_start=($2::date-extract(dow from $2::date)::int) order by locked_at desc limit 1`,[circleId,date]))[0];
 if(lock&&(!offline||new Date(lock.locked_at).getTime()<=instant.getTime()))return {error:'الأسبوع مقفل',message:'تم إقفال الأسبوع قبل هذا التسجيل.'};
 return null;
}
export async function selfService(req:any,res:any,u:any){
 if(u.role!=='student')return json(res,403,{error:'Forbidden',message:'هذه الخدمة مخصصة لحساب الطالب.'});
 const s=(await query<any>(`select s.*,h.name circle_name,h.start_time,h.grace_minutes,c.name center_name from students s left join circles h on h.id=s.circle_id left join centers c on c.id=s.center_id where s.user_id=$1 limit 1`,[u.id]))[0];
 if(!s)return json(res,404,{error:'لم يتم ربط حسابك بسجل الطالب'});
 if(req.method==='GET'){
  const d=today(),att=(await query<any>('select attendance_date,status,late_minutes,check_in_at,check_out_at from attendance where student_id=$1 and attendance_date=$2::date',[s.id,d]))[0]||null;
  const recent=await query<any>("select record_date,record_type,surah_no,from_ayah,to_ayah,from_page,to_page,page_count,grade from memorization_records where student_id=$1 and record_type in ('new','review') order by record_date desc,created_at desc limit 12",[s.id]);
  const dateObj=new Date(d+'T00:00:00Z'),offset=(dateObj.getUTCDay()+1)%7,wd=new Date(dateObj);wd.setUTCDate(wd.getUTCDate()-offset);const weekStart=wd.toISOString().slice(0,10),dayNames=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'],dayName=dayNames[dateObj.getUTCDay()];
  const plan=(await query<any>('select new_target,review_target,goals from weekly_plans where student_id=$1 and week_start=$2::date and day_name=$3 order by created_at desc limit 1',[s.id,weekStart,dayName]))[0]||{},done=await query<any>("select record_type,coalesce(sum(page_count),0)::numeric pages from memorization_records where student_id=$1 and record_date=$2::date and record_type in ('new','review') group by record_type",[s.id,d]),dm:any={};for(const x of done)dm[x.record_type]=Number(x.pages||0);
  const nt=targetPages(plan.new_target),rt=targetPages(plan.review_target),attendanceScore=att?.status==='excused'?null:att?.status==='absent'?0:att?.status?Number(att.late_minutes||0)<=30?30:Number(att.late_minutes||0)<=60?20:10:0,newScore=nt>0?Math.min(30,Math.round(30*(dm.new||0)/nt)):30,reviewScore=rt>0?Math.min(40,Math.round(40*(dm.review||0)/rt)):40;
  return json(res,200,{student:{...s,effective_start_time:String(s.start_time||makkahAsrPlus70(d)).slice(0,5),automatic_start:!s.start_time},attendance:att,recent,today:{date:d,week_start:weekStart,is_friday:dateObj.getUTCDay()===5,new_target:nt,review_target:rt,new_done:dm.new||0,review_done:dm.review||0,attendance_score:attendanceScore,new_score:newScore,review_score:reviewScore,daily_score:dateObj.getUTCDay()===5||attendanceScore===null?null:attendanceScore+newScore+reviewScore,goals:plan.goals||''}});
 }
 if(req.method==='POST'){
  const kind=String(req.query?.kind||'');
  if(kind==='punch'){
   if(!s.circle_id||s.status!=='active')return json(res,400,{error:'يلزم طالب نشط مرتبط بحلقة'});
   const action=String(req.body?.action||'');if(!['check_in','check_out'].includes(action))return json(res,400,{error:'إجراء الحضور غير صالح'});
   const op=operationTime(req.body||{});if(op.error)return json(res,400,{error:op.error});
   const d=op.date,dateObj=new Date(d+'T00:00:00Z');if(dateObj.getUTCDay()===5)return json(res,403,{error:'يوم الجمعة إجازة ولا يوجد تسجيل حضور.'});
   if(!op.offline&&await isWeekLocked(s.circle_id,d))return json(res,403,{error:'الأسبوع مقفل',message:'تم إقفال الأسبوع من الإشراف.'});
   const blocked=await editBlock(s.circle_id,d,op.instant,op.offline);if(blocked)return json(res,403,blocked);
   let a=(await query<any>('select * from attendance where student_id=$1 and attendance_date=$2::date',[s.id,d]))[0];if(action==='check_out'&&!a?.check_in_at)return json(res,400,{error:'سجّل الحضور أولاً قبل تسجيل الانصراف'});
   if(!a){const late=lateMinutes(d,s.start_time,op.instant),status=late>30?'late':'present';a=(await query<any>(`insert into attendance(student_id,circle_id,attendance_date,status,recorded_by,late_minutes,points_penalty,check_in_at) values($1,$2,$3::date,$4,$5,$6,0,$7::timestamptz) returning *`,[s.id,s.circle_id,d,status,u.id,late,op.instant.toISOString()]))[0]}
   else if(action==='check_in'&&!a.check_in_at){const late=lateMinutes(d,s.start_time,op.instant),status=late>30?'late':'present';a=(await query<any>('update attendance set check_in_at=$1::timestamptz,status=$2,late_minutes=$3,recorded_by=$4 where id=$5 returning *',[op.instant.toISOString(),status,late,u.id,a.id]))[0]}
   else if(action==='check_out'&&!a.check_out_at)a=(await query<any>('update attendance set check_out_at=$1::timestamptz,recorded_by=$2 where id=$3 returning *',[op.instant.toISOString(),u.id,a.id]));
   return json(res,200,a);
  }
  if(kind==='quran'){
   if(!s.circle_id||s.status!=='active')return json(res,400,{error:'يلزم طالب نشط مرتبط بحلقة'});
   const b=req.body||{},op=operationTime(b);if(op.error)return json(res,400,{error:op.error});
   const d=op.date,dateObj=new Date(d+'T00:00:00Z');if(dateObj.getUTCDay()===5)return json(res,403,{error:'يوم الجمعة إجازة ولا يوجد تسجيل يومي.'});
   if(!op.offline&&await isWeekLocked(s.circle_id,d))return json(res,403,{error:'الأسبوع مقفل',message:'تم إقفال الأسبوع من الإشراف.'});
   const blocked=await editBlock(s.circle_id,d,op.instant,op.offline);if(blocked)return json(res,403,blocked);
   const recordType=String(b.record_type||'');if(!['new','review'].includes(recordType))return json(res,400,{error:'اختر المراجعة أو الحفظ الجديد.'});
   const fromSurah=Number(b.surah_no),toSurah=Number(b.to_surah_no||b.surah_no),rawFromAyah=Number(b.from_ayah||0),rawToAyah=Number(b.to_ayah||0);if(!Number.isInteger(fromSurah)||fromSurah<1||fromSurah>114||!Number.isInteger(toSurah)||toSurah<1||toSurah>114)return json(res,400,{error:'السورة غير صالحة'});
   const maxFrom=Number(getAyahCountInSurah(fromSurah as any)),maxTo=Number(getAyahCountInSurah(toSurah as any));if((rawFromAyah&&(!Number.isInteger(rawFromAyah)||rawFromAyah<1||rawFromAyah>maxFrom))||(rawToAyah&&(!Number.isInteger(rawToAyah)||rawToAyah<1||rawToAyah>maxTo)))return json(res,400,{error:'رقم الآية غير صالح'});
   const requestedFromPage=Number(b.from_page||0),requestedToPage=Number(b.to_page||0),fromPage=Number.isInteger(requestedFromPage)&&requestedFromPage>=1&&requestedFromPage<=604?requestedFromPage:Number(findPage(fromSurah as any,(rawFromAyah||1) as any)),toPage=Number.isInteger(requestedToPage)&&requestedToPage>=1&&requestedToPage<=604?requestedToPage:Number(findPage(toSurah as any,(rawToAyah||maxTo) as any));if(toPage<fromPage)return json(res,400,{error:'صفحة النهاية يجب أن تكون بعد صفحة البداية'});
   // The ayah selectors are optional in the UI. Persist a valid boundary ayah when the
   // student records by page only, so this endpoint remains compatible with legacy
   // database constraints as well as newer nullable schemas.
   const fromAyah=rawFromAyah||1,toAyah=rawToAyah||(toSurah===fromSurah?maxFrom:maxTo),pageCount=Math.max(1,toPage-fromPage+1),ayahCount=rawFromAyah&&rawToAyah&&toSurah===fromSurah?Math.max(1,rawToAyah-rawFromAyah+1):null;
   const existing=(await query<any>("select id from memorization_records where student_id=$1 and record_date=$2::date and record_type=$3 order by created_at desc limit 1",[s.id,d,recordType]))[0];
   if(existing){const row=(await query<any>(`update memorization_records set surah_no=$1::smallint,from_ayah=$2::integer,to_surah_no=$3::smallint,to_ayah=$4::integer,from_page=$5::smallint,to_page=$6::smallint,page_count=$7::smallint,ayah_count=$8::integer,recorded_by=$9 where id=$10 returning *`,[fromSurah,fromAyah,toSurah,toAyah,fromPage,toPage,pageCount,ayahCount,u.id,existing.id]))[0];return json(res,200,row)}
   const row=(await query<any>(`insert into memorization_records(student_id,record_type,surah_no,from_ayah,to_surah_no,to_ayah,from_page,to_page,page_count,ayah_count,grade,notes,qiraah,approved,record_date,recorded_by) values($1,$2,$3::smallint,$4::integer,$5::smallint,$6::integer,$7::smallint,$8::smallint,$9::smallint,$10::integer,null,null,'حفص عن عاصم',false,$11::date,$12) returning *`,[s.id,recordType,fromSurah,fromAyah,toSurah,toAyah,fromPage,toPage,pageCount,ayahCount,d,u.id]))[0];return json(res,201,row);
  }
 }
 return json(res,405,{error:'Method not allowed'});
}