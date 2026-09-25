import { query } from './_lib/db.js';
import { getActor,isStaff } from './_lib/actor.js';
import { handleError,json } from './_lib/http.js';
import {isWeekLocked} from './_lib/weeklyLock.js';
import {findPage,getAyahCountInSurah} from 'quran-meta/hafs';

const DAYS=['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'];
const NAMES=["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"];
const clampPage=(v:any)=>Math.min(604,Math.max(1,Math.round(Number(v)||1)));
function surahForPage(page:number,edge:'start'|'end'){const p=clampPage(page),matches:number[]=[];for(let s=1;s<=114;s++){const first=Number(findPage(s as any,1 as any)),last=Number(findPage(s as any,Number(getAyahCountInSurah(s as any)) as any));if(p>=first&&p<=last)matches.push(s)}if(matches.length)return edge==='end'?matches[matches.length-1]:matches[0];let fallback=1;for(let s=1;s<=114;s++){if(Number(findPage(s as any,1 as any))<=p)fallback=s;else break}return fallback}
function label(from:number,to:number){const count=Math.max(1,to-from+1),a=surahForPage(from,'start'),b=surahForPage(to,'end');return count+'|'+NAMES[a-1]+' ص'+from+' ← '+NAMES[b-1]+' ص'+to}
function distributeRange(fromRaw:any,toRaw:any){const from=clampPage(fromRaw),to=clampPage(toRaw);if(to<from)throw new Error('صفحة النهاية يجب أن تكون بعد صفحة البداية.');const total=to-from+1,q=Math.floor(total/6),r=total%6,out:(null|{from:number;to:number})[]=[];let cursor=from;for(let i=0;i<6;i++){const size=q+(i<r?1:0);if(size<=0)out.push(null);else{out.push({from:cursor,to:cursor+size-1});cursor+=size}}return out}
const display=(v:any)=>{const s=String(v||'');return s.includes('|')?s.split('|').slice(1).join('|').trim():s};

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
   const wd=new Date(week+'T00:00:00Z');if(wd.getUTCDay()!==6)return json(res,400,{error:'بداية الأسبوع يجب أن تكون يوم السبت.'});
   if(u.role==='teacher'&&student.circle_id&&await isWeekLocked(student.circle_id,week))return json(res,403,{error:'الأسبوع مقفل',message:'تم إقفال هذا الأسبوع من الإشراف ولا يمكن للمعلم تعديل الخطة.'});
   if(b.new_from_page!==undefined||b.review_from_page!==undefined){
    const nw=distributeRange(b.new_from_page,b.new_to_page),rv=distributeRange(b.review_from_page,b.review_to_page),rows:any[]=[];
    for(let i=0;i<6;i++){const newTarget=nw[i]?label(nw[i]!.from,nw[i]!.to):null,reviewTarget=rv[i]?label(rv[i]!.from,rv[i]!.to):null;rows.push((await query<any>(`insert into weekly_plans(student_id,week_start,day_name,new_target,review_target,goals,created_by) values($1,$2::date,$3,$4,$5,$6,$7) on conflict(student_id,week_start,day_name) do update set new_target=excluded.new_target,review_target=excluded.review_target,goals=excluded.goals,created_by=excluded.created_by returning *`,[student.id,week,DAYS[i],newTarget,reviewTarget,b.goals||null,u.id]))[0])}
    return json(res,200,{items:rows,days:DAYS});
   }
   const distribute=(v:any)=>{const n=Math.max(0,Math.floor(Number(v)||0)),q=Math.floor(n/6),r=n%6;return DAYS.map((_,i)=>q+(i<r?1:0))};
   if(b.weekly_new_total!==undefined||b.weekly_review_total!==undefined){const nw=distribute(b.weekly_new_total),rv=distribute(b.weekly_review_total),rows:any[]=[];for(let i=0;i<6;i++)rows.push((await query<any>(`insert into weekly_plans(student_id,week_start,day_name,new_target,review_target,goals,created_by) values($1,$2::date,$3,$4,$5,$6,$7) on conflict(student_id,week_start,day_name) do update set new_target=excluded.new_target,review_target=excluded.review_target,goals=excluded.goals,created_by=excluded.created_by returning *`,[student.id,week,DAYS[i],String(nw[i]),String(rv[i]),b.goals||null,u.id]))[0]);return json(res,200,{items:rows,days:DAYS})}
   if(!DAYS.includes(String(b.day_name||'')))return json(res,400,{error:'اليوم يجب أن يكون من السبت إلى الخميس'});
   const row=(await query<any>(`insert into weekly_plans(student_id,week_start,day_name,new_target,review_target,goals,created_by) values($1,$2::date,$3,$4,$5,$6,$7) on conflict(student_id,week_start,day_name) do update set new_target=excluded.new_target,review_target=excluded.review_target,goals=excluded.goals,created_by=excluded.created_by returning *`,[student.id,week,b.day_name,b.new_target||null,b.review_target||null,b.goals||null,u.id]))[0];
   return json(res,200,row);
  }
  if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
  const rows=await query<any>(`select w.id,w.student_id,w.week_start,w.day_name,w.new_target,w.review_target,w.goals,coalesce(s.full_name,us.full_name,'بدون اسم') full_name from weekly_plans w join students s on s.id=w.student_id left join users us on us.id=s.user_id left join circles c on c.id=s.circle_id where $1='system_admin' or ($1 in ('center_manager','supervisor') and s.center_id=$2::uuid) or ($1='teacher' and c.teacher_user_id=$3::uuid) or ($1='student' and s.user_id=$3::uuid) order by w.week_start desc,coalesce(s.full_name,us.full_name,'بدون اسم'),case w.day_name when 'السبت' then 0 when 'الأحد' then 1 when 'الاثنين' then 2 when 'الثلاثاء' then 3 when 'الأربعاء' then 4 when 'الخميس' then 5 else 6 end limit 300`,[u.role,u.center_id,u.id]);
  return json(res,200,{items:rows.map((r:any)=>({...r,new_target_display:display(r.new_target),review_target_display:display(r.review_target)}))});
 }catch(e){return handleError(res,e)}
}