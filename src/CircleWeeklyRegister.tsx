import {useState} from 'react';
import {madinahSurahName,MadinahMushafRange} from './MadinahMushafRange';
import {apiPost,apiPut} from './lib/api';

const days=[['السبت',0],['الأحد',1],['الاثنين',2],['الثلاثاء',3],['الأربعاء',4],['الخميس',5]] as const;
const iso=(d:Date)=>d.toISOString().slice(0,10);
const normalize=(v:any)=>String(v||'').slice(0,10);
const targetPages=(v:any)=>{const s=String(v||'').trim();if(/^\d+(?:\.\d+)?$/.test(s))return Number(s);const m=s.match(/(\d+)\D+(\d+)\s*$/);return m?Math.max(0,Number(m[2])-Number(m[1])+1):0};

function weeksForMonth(month:string){
 const [year,monthNo]=month.split('-').map(Number);if(!year||!monthNo)return [];
 const first=new Date(Date.UTC(year,monthNo-1,1)),last=new Date(Date.UTC(year,monthNo,0)),start=new Date(first);start.setUTCDate(start.getUTCDate()-((start.getUTCDay()+1)%7));
 const out:any[]=[];for(let cursor=new Date(start);cursor<=last;cursor.setUTCDate(cursor.getUTCDate()+7)){const weekStart=new Date(cursor);out.push({start:iso(weekStart),days:days.map(([name,offset])=>{const d=new Date(weekStart);d.setUTCDate(d.getUTCDate()+offset);return {name,date:iso(d)}})})}return out;
}
function statusText(day:any){if(!day?.status)return '—';if(day.status==='present')return 'حاضر';if(day.status==='late')return 'متأخر'+(day.late_minutes?' +'+day.late_minutes+'د':'');if(day.status==='absent')return 'غائب';if(day.status==='excused')return 'مستأذن';return String(day.status)}
function quranText(item:any){if(!item)return '—';const toS=Number(item.to_surah_no||item.surah_no||1);return madinahSurahName(Number(item.surah_no||1))+' ص'+(item.from_page||'—')+' ← '+madinahSurahName(toS)+' ص'+(item.to_page||'—')+(item.pages?' • '+item.pages+'ص':'')}
function autoScore(day:any){
 const rt=targetPages(day?.review_target),nt=targetPages(day?.new_target),hasPlan=rt>0||nt>0;
 if(!hasPlan)return null;if(day?.status==='excused')return null;
 const att=day?.status==='absent'?0:day?.status?Number(day.late_minutes||0)<=30?30:Number(day.late_minutes||0)<=60?20:10:0;
 const rd=Number(day?.review?.pages||0),nd=Number(day?.new?.pages||0),rs=rt>0?Math.min(40,Math.round(40*rd/rt)):40,ns=nt>0?Math.min(30,Math.round(30*nd/nt)):30;
 return att+rs+ns;
}
function shortDate(date:string){return new Date(date+'T00:00:00Z').toLocaleDateString('ar-SA',{day:'2-digit',month:'2-digit'})}
function makkahToday(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}

export default function CircleWeeklyRegister({data,month,onProfile,onRefresh}:{data:any;month:string;onProfile:(id:string)=>void;onRefresh:()=>Promise<void>}){
 const students:any[]=data?.students||[],today=makkahToday(),[edit,setEdit]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 if(!students.length)return <div className="emptyState">لا توجد بيانات طلاب في سجل الحلقة لهذا الشهر.</div>;
 const groups=new Map<string,{name:string;students:any[]}>();for(const student of students){const key=String(student.circle_id||'none');if(!groups.has(key))groups.set(key,{name:student.circle_name||'الحلقة',students:[]});groups.get(key)!.students.push(student)}
 const weeks=weeksForMonth(month);
 async function setAttendance(student:any,day:any,status:string){if(day?.approved||day?.week_locked)return;setBusy(true);setError('');try{await apiPost('/api/attendance',{student_id:student.id,attendance_date:normalize(day.date),status,check_in_at:day?.check_in_at||'',check_out_at:day?.check_out_at||''});await onRefresh()}catch(e){setError(e instanceof Error?e.message:'تعذر تعديل الحضور')}finally{setBusy(false)}}
 async function qsave(e:any){e.preventDefault();if(!edit)return;setBusy(true);setError('');try{const body:any=Object.fromEntries(new FormData(e.currentTarget).entries());body.student_id=edit.student.id;body.record_date=edit.date;body.record_type=edit.kind;if(edit.old?.id){body.id=edit.old.id;await apiPut('/api/memorization',body)}else await apiPost('/api/memorization',body);setEdit(null);await onRefresh()}catch(x){setError(x instanceof Error?x.message:'تعذر حفظ السجل')}finally{setBusy(false)}}
 return <div className="weeklyRegisterSection">{error&&<div className="notice">{error}</div>}{Array.from(groups.entries()).map(([circleId,group])=>weeks.map((week:any)=>{
  const approved=(date:string)=>group.students.some((s:any)=>(s.days||[]).some((d:any)=>normalize(d.date)===date&&d.approved));
  return <section className="weeklyRegisterBlock" key={circleId+week.start}><div className="weeklyRegisterHeading"><div><b>{group.name}</b><small>السجل الأسبوعي — من {shortDate(week.days[0].date)} إلى {shortDate(week.days[5].date)}</small></div><small>التقييم آلي من الخطة الأسبوعية</small></div>
   <div className="weeklyRegisterScroll"><table className="weeklyRegisterTable"><thead><tr><th className="studentSticky" rowSpan={2}>اسم الطالب</th>{week.days.map((day:any)=><th className={'dayGroup '+(!day.date.startsWith(month)?'outMonth':'')} colSpan={4} key={day.date}>{day.name}<small>{shortDate(day.date)}</small>{approved(day.date)&&<em>معتمد ✓</em>}</th>)}<th className="summaryCell" rowSpan={2}>إجمالي الصفحات</th><th className="summaryCell" rowSpan={2}>متوسط الأسبوع</th></tr><tr>{week.days.flatMap((day:any)=>[<th className="daySubHead" key={day.date+'a'}>الحضور</th>,<th className="daySubHead" key={day.date+'r'}>المراجعة</th>,<th className="daySubHead" key={day.date+'n'}>الحفظ الجديد</th>,<th className="daySubHead" key={day.date+'g'}>التقييم</th>])}</tr></thead><tbody>{group.students.map((student:any)=>{
    const byDate=new Map((student.days||[]).map((d:any)=>[normalize(d.date),d]));let totalPages=0;const grades:number[]=[];
    for(const wd of week.days){const x:any=byDate.get(wd.date);if(wd.date.startsWith(month)){totalPages+=Number(x?.review?.pages||0)+Number(x?.new?.pages||0);const g=autoScore(x);if(g!==null)grades.push(g)}}
    const average=grades.length?Math.round(grades.reduce((a,b)=>a+b,0)/grades.length):null;
    return <tr key={student.id+week.start}><td className="studentSticky"><button className="tableAction" onClick={()=>onProfile(student.id)}>{student.full_name}</button></td>{week.days.flatMap((wd:any)=>{const d:any=byDate.get(wd.date)||{date:wd.date},outside=!wd.date.startsWith(month),locked=!!(d.approved||d.week_locked),g=autoScore(d);return [
      <td className={'attendanceCell '+(outside?'outMonth':'')} key={wd.date+'a'}>{outside?'—':<select disabled={locked||busy} value={d.status||''} onChange={e=>setAttendance(student,d,e.target.value)}><option value="" disabled>—</option><option value="present">حاضر</option><option value="late">متأخر</option><option value="absent">غائب</option><option value="excused">مستأذن</option></select>}</td>,
      <td className={'quranCell '+(outside?'outMonth':'')} key={wd.date+'r'}>{outside?'—':<button className="registerEditCell" disabled={locked} onClick={()=>setEdit({student,date:wd.date,kind:'review',old:d.review})}>{quranText(d.review)}<small>الخطة {targetPages(d.review_target)||0}ص</small></button>}</td>,
      <td className={'quranCell '+(outside?'outMonth':'')} key={wd.date+'n'}>{outside?'—':<button className="registerEditCell" disabled={locked} onClick={()=>setEdit({student,date:wd.date,kind:'new',old:d.new})}>{quranText(d.new)}<small>الخطة {targetPages(d.new_target)||0}ص</small></button>}</td>,
      <td className={'evalCell '+(outside?'outMonth':'')} key={wd.date+'g'}>{outside?'—':wd.date>today?'—':g===null?(d.status==='excused'?'مستبعد':'لا خطة'):g+'%'}</td>
    ]})}<td className="summaryCell">{totalPages||'—'}</td><td className="summaryCell">{average===null?'—':average+'%'}</td></tr>
   })}</tbody></table></div>
  </section>
 }))}{edit&&<div className="panel editPanel"><div className="panelHead"><div><span className="panelEyebrow">{edit.kind==='review'?'المراجعة':'الحفظ الجديد'}</span><h3>{edit.student.full_name} — {edit.date}</h3></div><button className="secondary" onClick={()=>setEdit(null)}>إغلاق</button></div><form className="quickForm" onSubmit={qsave}><MadinahMushafRange key={(edit.old?.id||edit.student.id)+edit.kind+edit.date} initial={edit.old||{}}/><button className="primary" disabled={busy}>{edit.old?'حفظ التعديل':'تسجيل'}</button></form></div>}</div>
}
