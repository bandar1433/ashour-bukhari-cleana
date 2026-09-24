import {madinahSurahName} from './MadinahMushafRange';

const days=[['السبت',0],['الأحد',1],['الاثنين',2],['الثلاثاء',3],['الأربعاء',4],['الخميس',5]] as const;
const iso=(d:Date)=>d.toISOString().slice(0,10);
const normalize=(v:any)=>String(v||'').slice(0,10);

function weeksForMonth(month:string){
 const [year,monthNo]=month.split('-').map(Number);
 if(!year||!monthNo)return [];
 const first=new Date(Date.UTC(year,monthNo-1,1)),last=new Date(Date.UTC(year,monthNo,0));
 const start=new Date(first);start.setUTCDate(start.getUTCDate()-((start.getUTCDay()+1)%7));
 const out:any[]=[];
 for(let cursor=new Date(start);cursor<=last;cursor.setUTCDate(cursor.getUTCDate()+7)){
  const weekStart=new Date(cursor);
  out.push({start:iso(weekStart),days:days.map(([name,offset])=>{const d=new Date(weekStart);d.setUTCDate(d.getUTCDate()+offset);return {name,date:iso(d)}})});
 }
 return out;
}
function statusText(day:any){if(!day?.status)return '—';if(day.status==='present')return 'حاضر';if(day.status==='late')return 'متأخر'+(day.late_minutes?' +'+day.late_minutes+'د':'');if(day.status==='absent')return 'غائب';if(day.status==='excused')return 'مستأذن';return String(day.status)}
function statusClass(day:any){return day?.status==='absent'?'absent':day?.status==='excused'?'excused':day?.status==='late'?'late':''}
function quranText(item:any){if(!item)return '—';const parts=[madinahSurahName(Number(item.surah_no||1))];if(item.from_page||item.to_page)parts.push('ص '+(item.from_page||'—')+'–'+(item.to_page||'—'));if(item.from_ayah||item.to_ayah)parts.push('آ '+(item.from_ayah||'—')+'–'+(item.to_ayah||'—'));if(item.pages)parts.push(String(item.pages)+'ص');return parts.join(' • ')}
function grade(day:any){const xs=[day?.review?.grade,day?.new?.grade].filter((x:any)=>x!==null&&x!==undefined&&x!=='').map(Number).filter(Number.isFinite);return xs.length?Math.round(xs.reduce((a:number,b:number)=>a+b,0)/xs.length):null}
function shortDate(date:string){return new Date(date+'T00:00:00Z').toLocaleDateString('ar-SA',{day:'2-digit',month:'2-digit'})}

export default function CircleWeeklyRegister({data,month,onProfile}:{data:any;month:string;onProfile:(id:string)=>void}){
 const students:any[]=data?.students||[];
 if(!students.length)return <div className="emptyState">لا توجد بيانات طلاب في سجل الحلقة لهذا الشهر.</div>;
 const groups=new Map<string,{name:string;students:any[]}>();
 for(const student of students){const key=String(student.circle_id||'none');if(!groups.has(key))groups.set(key,{name:student.circle_name||'الحلقة',students:[]});groups.get(key)!.students.push(student)}
 const weeks=weeksForMonth(month);
 return <div className="weeklyRegisterSection">{Array.from(groups.entries()).map(([circleId,group])=>weeks.map((week:any)=>{
  const approved=(date:string)=>group.students.some((s:any)=>(s.days||[]).some((d:any)=>normalize(d.date)===date&&d.approved));
  return <section className="weeklyRegisterBlock" key={circleId+week.start}>
   <div className="weeklyRegisterHeading"><div><b>{group.name}</b><small>السجل الأسبوعي — من {shortDate(week.days[0].date)} إلى {shortDate(week.days[5].date)}</small></div><small>السبت إلى الخميس</small></div>
   <div className="weeklyRegisterScroll"><table className="weeklyRegisterTable"><thead><tr><th className="studentSticky" rowSpan={2}>اسم الطالب</th>{week.days.map((day:any)=><th className={'dayGroup '+(!day.date.startsWith(month)?'outMonth':'')} colSpan={4} key={day.date}>{day.name}<small>{shortDate(day.date)}</small>{approved(day.date)&&<em>معتمد ✓</em>}</th>)}<th className="summaryCell" rowSpan={2}>إجمالي الصفحات</th><th className="summaryCell" rowSpan={2}>متوسط الأسبوع</th></tr><tr>{week.days.flatMap((day:any)=>[
    <th className="daySubHead" key={day.date+'a'}>الحضور</th>,
    <th className="daySubHead" key={day.date+'r'}>المراجعة</th>,
    <th className="daySubHead" key={day.date+'n'}>الحفظ الجديد</th>,
    <th className="daySubHead" key={day.date+'g'}>التقييم</th>
   ])}</tr></thead><tbody>{group.students.map((student:any)=>{
    const byDate=new Map((student.days||[]).map((d:any)=>[normalize(d.date),d]));
    let totalPages=0;const grades:number[]=[];
    for(const day of week.days){const d:any=byDate.get(day.date);if(day.date.startsWith(month)){totalPages+=Number(d?.review?.pages||0)+Number(d?.new?.pages||0);const g=grade(d);if(g!==null)grades.push(g)}}
    const average=grades.length?Math.round(grades.reduce((a,b)=>a+b,0)/grades.length):null;
    return <tr key={student.id+week.start}><td className="studentSticky"><button className="tableAction" onClick={()=>onProfile(student.id)}>{student.full_name}</button></td>{week.days.flatMap((day:any)=>{const d:any=byDate.get(day.date),outside=!day.date.startsWith(month),g=grade(d);return [
      <td className={'attendanceCell '+(outside?'outMonth':'')} key={day.date+'a'}>{outside?'—':<span className={'registerStatus '+statusClass(d)}>{statusText(d)}</span>}</td>,
      <td className={'quranCell '+(outside?'outMonth':'')} key={day.date+'r'}>{outside?'—':d?.review?quranText(d.review):<span className="registerQuranEmpty">—</span>}</td>,
      <td className={'quranCell '+(outside?'outMonth':'')} key={day.date+'n'}>{outside?'—':d?.new?quranText(d.new):<span className="registerQuranEmpty">—</span>}</td>,
      <td className={'evalCell '+(outside?'outMonth':'')} key={day.date+'g'}>{outside?'—':g===null?(d?.status==='absent'?'غائب':d?.status==='excused'?'مستأذن':'—'):g+'%'}</td>
    ]})}<td className="summaryCell">{totalPages||'—'}</td><td className="summaryCell">{average===null?'—':average+'%'}</td></tr>
   })}</tbody></table></div>
  </section>
 }))}</div>
}
