import {useState} from 'react';
import {apiPost} from './lib/api';
import {MadinahMushafRange,madinahSurahName} from './MadinahMushafRange';

const norm=(v:any)=>String(v||'').slice(0,10);
const targetDetail=(v:any)=>{const s=String(v||'').trim();if(!s)return 'لا توجد خطة';return s.includes('|')?s.split('|').slice(1).join('|').trim():s};
function quranText(item:any){if(!item)return 'لم يسجل';const toS=Number(item.to_surah_no||item.surah_no||1);return 'من '+madinahSurahName(Number(item.surah_no||1))+' ص'+(item.from_page||'—')+' إلى '+madinahSurahName(toS)+' ص'+(item.to_page||'—')}
function fmt(v:any){return v?new Date(v).toLocaleTimeString('ar-SA',{timeZone:'Asia/Riyadh',hour:'2-digit',minute:'2-digit'}):'—'}
function progressClass(v:any){const n=Number(v);return n>=100?'done':n>0?'partial':'pending'}

export default function StudentQuranProfile({data,month,onMonthChange,onRefresh}:{data:any;month:string;onMonthChange:(m:string)=>void;onRefresh:()=>Promise<void>}){
 const [edit,setEdit]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 if(!data)return <div className="emptyState">جارٍ تحميل ملفك القرآني...</div>;
 const today=String(data.today||''),weekly=data.weekly||[],monthly=data.monthly||[];
 async function punch(action:'check_in'|'check_out'){setBusy(true);setError('');setSuccess('');try{await apiPost('/api/ops?action=self-service&kind=punch',{action});await onRefresh()}catch(e){setError(e instanceof Error?e.message:'تعذر تسجيل الحضور')}finally{setBusy(false)}}
 async function qsave(e:any){e.preventDefault();if(!edit)return;setBusy(true);setError('');setSuccess('');try{const body:any=Object.fromEntries(new FormData(e.currentTarget).entries());body.record_type=edit.kind;await apiPost('/api/ops?action=self-service&kind=quran',body);const label=edit.kind==='review'?'المراجعة':'الحفظ الجديد';setEdit(null);await onRefresh();setSuccess('تم حفظ '+label+' بنجاح.')}catch(x){setError(x instanceof Error?x.message:'تعذر حفظ السجل')}finally{setBusy(false)}}
 const editable=(d:any)=>norm(d.record_date)===today&&!d.approved&&!d.week_locked;
 return <div className="studentQuranProfile">{error&&<div className="notice">{error}</div>}{success&&<div className="notice">{success}</div>}
  <div className="studentProfileHero"><div><span>ملفي القرآني</span><h2>{data.student?.full_name}</h2><p>{data.student?.center_name||'—'} • {data.student?.circle_name||'—'}</p></div><label className="field"><span>الشهر</span><input type="month" value={month} onChange={e=>onMonthChange(e.target.value)}/></label></div>
  <div className="studentPlanHead"><div><span>الخطة الأسبوعية الحالية</span><h3>{data.week_start} — {data.week_end}</h3></div><small>الألوان تبين المنجز والمتبقي لكل يوم</small></div>
  <div className="studentWeekGrid">{weekly.map((d:any)=><article className={'studentDayPlan '+progressClass(d.progress)} key={norm(d.record_date)}>
    <div className="dayPlanTop"><b>{d.day_name}</b><small>{norm(d.record_date)}</small><strong>{norm(d.record_date)>today?'—':d.daily_score==null?'—':d.daily_score+'%'}</strong></div>
    <div className="planMetric"><span>المراجعة</span><b>{d.review_done||0}/{d.review_target_pages||0} ص</b><small className="planRangeText">{targetDetail(d.review_target)}</small><small>المتبقي {d.review_remaining||0} ص</small></div>
    <div className="planMetric"><span>الحفظ الجديد</span><b>{d.new_done||0}/{d.new_target_pages||0} ص</b><small className="planRangeText">{targetDetail(d.new_target)}</small><small>المتبقي {d.new_remaining||0} ص</small></div>
    <div className="dayProgress"><i style={{width:(d.progress||0)+'%'}}></i><span>{d.progress==null?'لا توجد خطة':d.progress+'%'}</span></div>
   </article>)}</div>
  <div className="studentMonthlyHead"><div><span>السجل الشهري</span><h3>السبت إلى الخميس — الجمعة مستبعدة</h3></div><small>يمكنك إدخال بيانات اليوم الحالي فقط، ويستطيع المعلم مراجعتها وتعديلها.</small></div>
  <div className="table-wrap studentMonthlyRegister"><table><thead><tr><th>اليوم</th><th>التاريخ</th><th>الحضور والانصراف</th><th>المراجعة</th><th>الحفظ الجديد</th><th>الصفحات</th><th>التقييم الآلي</th><th>الحالة</th></tr></thead><tbody>{monthly.map((d:any)=>{const can=editable(d),pages=Number(d.review_done||0)+Number(d.new_done||0);return <tr key={norm(d.record_date)} className={norm(d.record_date)===today?'todayRow':''}><td>{d.day_name}</td><td>{norm(d.record_date)}</td><td>{can?<div className="studentPunchCell"><span>{d.status==='late'?'متأخر':d.status==='present'?'حاضر':d.status==='absent'?'غائب':d.status==='excused'?'مستأذن':'لم يسجل'}</span>{!d.check_in_at?<button className="primary" disabled={busy} onClick={()=>punch('check_in')}>حضور</button>:!d.check_out_at?<button className="secondary" disabled={busy} onClick={()=>punch('check_out')}>انصراف</button>:null}<small>{fmt(d.check_in_at)} — {fmt(d.check_out_at)}</small></div>:<><b>{d.status==='late'?'متأخر':d.status==='present'?'حاضر':d.status==='absent'?'غائب':d.status==='excused'?'مستأذن':'—'}</b><small>{fmt(d.check_in_at)} — {fmt(d.check_out_at)}</small></>}</td>
    <td><button className="studentQuranCell" disabled={!can} onClick={()=>setEdit({kind:'review',old:d.review})}><b>{quranText(d.review)}</b><small>الخطة: {targetDetail(d.review_target)} • المنجز {d.review_done||0}ص{can?' • اضغط للتسجيل/التعديل':''}</small></button></td>
    <td><button className="studentQuranCell" disabled={!can} onClick={()=>setEdit({kind:'new',old:d.new_record})}><b>{quranText(d.new_record)}</b><small>الخطة: {targetDetail(d.new_target)} • المنجز {d.new_done||0}ص{can?' • اضغط للتسجيل/التعديل':''}</small></button></td>
    <td>{pages||'—'}</td><td><strong className="autoScore">{norm(d.record_date)>today?'—':d.daily_score==null?(d.review_target_pages||d.new_target_pages?'مستبعد':'لا خطة'):d.daily_score+'%'}</strong></td><td>{d.approved?'معتمد ✓':d.week_locked?'الأسبوع مقفل':can?'متاح للتسجيل':norm(d.record_date)<today?'للعرض فقط':'قادم'}</td></tr>})}</tbody></table></div>
  {edit&&<div className="panel editPanel"><div className="panelHead"><div><span className="panelEyebrow">{edit.kind==='review'?'المراجعة':'الحفظ الجديد'}</span><h3>تسجيل اليوم — {today}</h3></div><button className="secondary" onClick={()=>setEdit(null)}>إغلاق</button></div><form className="quickForm" onSubmit={qsave}>{error&&<div className="notice">{error}</div>}<MadinahMushafRange key={(edit.old?.id||today)+edit.kind} initial={edit.old||{}}/><button className="primary" disabled={busy}>{edit.old?'حفظ التعديل':'حفظ التسجيل'}</button></form></div>}
 </div>
}
