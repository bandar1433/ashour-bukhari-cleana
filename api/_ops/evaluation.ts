import {query} from '../_lib/db.js';
import {json} from '../_lib/http.js';
import {validMonth,validUuid} from '../_lib/actor.js';
import {criteriaForCircle,ensureEvaluationSet,monthStart,nextMonth} from '../_lib/evaluation.js';
import {today} from './shared.js';
import {findPage,getAyahCountInSurah} from 'quran-meta/hafs';

async function allowedCircle(u:any,circleId:string){
 return (await query<any>(`select id,name,center_id,teacher_user_id from circles where id=$1 and
  ($2='system_admin' or ($2 in ('center_manager','supervisor') and center_id=$3::uuid) or ($2='teacher' and teacher_user_id=$4::uuid))`,
  [circleId,u.role,u.center_id,u.id]))[0]||null;
}
export async function evaluationCriteria(req:any,res:any,u:any){
 if(!['system_admin','center_manager','supervisor','teacher'].includes(u.role))return json(res,403,{error:'Forbidden'});
 const circleId=validUuid(req.method==='GET'?req.query?.circle_id:req.body?.circle_id);
 if(!circleId)return json(res,400,{error:'اختر الحلقة.'});
 const circle=await allowedCircle(u,circleId);if(!circle)return json(res,403,{error:'الحلقة خارج نطاق صلاحيتك.'});
 const currentMonth=validMonth(req.method==='GET'?req.query?.month:null)||today().slice(0,7);
 if(req.method==='GET'){
  const current=await criteriaForCircle(circleId,currentMonth,u.id);
  const nm=nextMonth(currentMonth+'-01').slice(0,7),next=await criteriaForCircle(circleId,nm,u.id);
  return json(res,200,{circle,current_month:currentMonth,current,next_month:nm,next});
 }
 if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
 const b=req.body||{},effective=nextMonth((validMonth(b.base_month)||today().slice(0,7))+'-01'),items=Array.isArray(b.criteria)?b.criteria:[];
 if(!items.length)return json(res,400,{error:'أضف معيارًا واحدًا على الأقل.'});
 const cleaned=items.map((x:any,i:number)=>({
  name:String(x.name||'').trim().slice(0,80),kind:String(x.kind||''),system_key:x.system_key?String(x.system_key):null,
  weight:Number(x.weight),target_pages:Number(x.target_pages||0),sort_order:(i+1)*10
 }));
 if(cleaned.some((x:any)=>!x.name||!['quran','attendance','task'].includes(x.kind)||!Number.isFinite(x.weight)||x.weight<=0||x.weight>100||!Number.isFinite(x.target_pages)||x.target_pages<0))return json(res,400,{error:'راجع أسماء المعايير وأنواعها وأوزانها.'});
 const total=Math.round(cleaned.reduce((n:number,x:any)=>n+x.weight,0)*100)/100;if(Math.abs(total-100)>0.001)return json(res,400,{error:'مجموع أوزان المعايير يجب أن يساوي 100%.','total':total});
 if(cleaned.filter((x:any)=>x.system_key==='attendance').length!==1)return json(res,400,{error:'يجب الإبقاء على معيار الحضور والانضباط مرة واحدة.'});
 if(cleaned.some((x:any)=>x.system_key&&!['new','review','attendance'].includes(x.system_key)))return json(res,400,{error:'معيار أساسي غير صالح.'});
 if(cleaned.some((x:any)=>x.system_key==='attendance'&&x.kind!=='attendance'))return json(res,400,{error:'نوع معيار الحضور يجب أن يكون حضورًا.'});
 if(cleaned.some((x:any)=>!x.system_key&&x.kind==='quran'&&x.target_pages<=0))return json(res,400,{error:'المعيار القرآني الإضافي يحتاج عدد صفحات يومي أكبر من صفر.'});
 const set=await ensureEvaluationSet(circleId,effective,u.id);
 await query('delete from circle_evaluation_criteria where set_id=$1',[set.id]);
 for(const x of cleaned)await query(`insert into circle_evaluation_criteria(set_id,name,kind,system_key,weight,target_pages,sort_order) values($1,$2,$3,$4,$5,$6,$7)`,[set.id,x.name,x.kind,x.system_key,x.weight,x.target_pages,x.sort_order]);
 const saved=await criteriaForCircle(circleId,effective,u.id);
 return json(res,200,{message:'تم حفظ المعايير، وسيبدأ تطبيقها من الشهر القادم.',effective_month:effective.slice(0,7),items:saved});
}

function recordDate(body:any){
 const d=String(body?.offline_record_date||body?.record_date||today()).slice(0,10);
 return /^\d{4}-\d{2}-\d{2}$/.test(d)?d:'';
}
async function resolveStudent(u:any,studentIdRaw:any){
 if(u.role==='student')return (await query<any>('select * from students where user_id=$1 limit 1',[u.id]))[0]||null;
 const id=validUuid(studentIdRaw);if(!id)return null;
 return (await query<any>(`select s.* from students s left join circles c on c.id=s.circle_id where s.id=$1 and
 ($2='system_admin' or ($2 in ('center_manager','supervisor') and s.center_id=$3::uuid) or ($2='teacher' and c.teacher_user_id=$4::uuid))`,[id,u.role,u.center_id,u.id]))[0]||null;
}
export async function criterionRecord(req:any,res:any,u:any){
 if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
 const b=req.body||{},s=await resolveStudent(u,b.student_id);if(!s?.circle_id)return json(res,404,{error:'الطالب غير موجود أو غير مرتبط بحلقة.'});
 const d=recordDate(b);if(!d)return json(res,400,{error:'التاريخ غير صالح.'});
 if(u.role==='student'&&!b.offline_record_date&&d!==today())return json(res,403,{error:'يمكن للطالب التسجيل لليوم الحالي فقط.'});
 const criterionId=validUuid(b.criterion_id);if(!criterionId)return json(res,400,{error:'المعيار غير صالح.'});
 const criterion=(await query<any>(`select c.*,es.circle_id,es.effective_month from circle_evaluation_criteria c join circle_evaluation_sets es on es.id=c.set_id where c.id=$1 and es.circle_id=$2 and es.effective_month=date_trunc('month',$3::date)::date`,[criterionId,s.circle_id,d]))[0];
 if(!criterion||criterion.system_key)return json(res,400,{error:'المعيار الإضافي غير متاح لهذا اليوم.'});
 if(criterion.kind==='quran'){
  const fromSurah=Number(b.surah_no),toSurah=Number(b.to_surah_no||b.surah_no),fromPage=Number(b.from_page),toPage=Number(b.to_page);
  if(!Number.isInteger(fromSurah)||fromSurah<1||fromSurah>114||!Number.isInteger(toSurah)||toSurah<1||toSurah>114||!Number.isInteger(fromPage)||fromPage<1||fromPage>604||!Number.isInteger(toPage)||toPage<fromPage||toPage>604)return json(res,400,{error:'نطاق الصفحات غير صالح.'});
  const rawFrom=Number(b.from_ayah||0),rawTo=Number(b.to_ayah||0),maxFrom=Number(getAyahCountInSurah(fromSurah as any)),maxTo=Number(getAyahCountInSurah(toSurah as any));
  const fromAyah=rawFrom||1,toAyah=rawTo||(toSurah===fromSurah?maxFrom:maxTo),pageCount=toPage-fromPage+1;
  const row=(await query<any>(`insert into student_criterion_records(criterion_id,student_id,record_date,surah_no,to_surah_no,from_ayah,to_ayah,from_page,to_page,page_count,recorded_by)
   values($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11)
   on conflict(criterion_id,student_id,record_date) do update set surah_no=excluded.surah_no,to_surah_no=excluded.to_surah_no,from_ayah=excluded.from_ayah,to_ayah=excluded.to_ayah,from_page=excluded.from_page,to_page=excluded.to_page,page_count=excluded.page_count,recorded_by=excluded.recorded_by,updated_at=now() returning *`,
   [criterionId,s.id,d,fromSurah,toSurah,fromAyah,toAyah,fromPage,toPage,pageCount,u.id]))[0];
  return json(res,200,row);
 }
 if(criterion.kind==='task'){
  const completed=!!b.completed;
  const row=(await query<any>(`insert into student_criterion_records(criterion_id,student_id,record_date,completed,recorded_by) values($1,$2,$3::date,$4,$5)
   on conflict(criterion_id,student_id,record_date) do update set completed=excluded.completed,recorded_by=excluded.recorded_by,updated_at=now() returning *`,[criterionId,s.id,d,completed,u.id]))[0];
  return json(res,200,row);
 }
 return json(res,400,{error:'هذا المعيار يحسب تلقائيًا.'});
}
export async function studentNote(req:any,res:any,u:any){
 if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
 const b=req.body||{},s=await resolveStudent(u,b.student_id);if(!s)return json(res,404,{error:'الطالب غير موجود.'});
 const d=recordDate(b),note=String(b.note||'').trim().slice(0,1000);if(!d||!note)return json(res,400,{error:'اكتب الملاحظة أولًا.'});
 if(u.role==='student'&&!b.offline_record_date&&d!==today())return json(res,403,{error:'يمكن إضافة ملاحظة لليوم الحالي فقط.'});
 const row=(await query<any>(`insert into student_daily_notes(student_id,record_date,note,recorded_by) values($1,$2::date,$3,$4)
  on conflict(student_id,record_date) do update set note=excluded.note,recorded_by=excluded.recorded_by,updated_at=now() returning *`,[s.id,d,note,u.id]))[0];
 return json(res,200,row);
}
