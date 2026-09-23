import {useEffect,useState,type FormEvent} from 'react';
import {apiGet,apiPost,apiPut,StudentRow} from './lib/api';

type Mode='library'|'guardian'|'quranJourney'|'interventions';

export default function AgreedFeatures({mode,currentRole,students}:{mode:Mode;currentRole:string;students:StudentRow[]}){
  const [data,setData]=useState<any>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [studentId,setStudentId]=useState('');
  const canManageLibrary=['system_admin','center_manager','supervisor'].includes(currentRole);

  async function load(id=studentId){
    setBusy(true);setError('');
    try{
      if(mode==='library') setData(await apiGet('/api/ops?action=features&sub=library'));
      if(mode==='guardian') setData(await apiGet('/api/ops?action=features&sub=guardian'));
      if(mode==='quranJourney') setData(await apiGet('/api/ops?action=features&sub=quran-journey'+(id?'&student_id='+encodeURIComponent(id):'')));
      if(mode==='interventions') setData(await apiGet('/api/ops?action=features&sub=interventions'));
    }catch(e){setError(e instanceof Error?e.message:'تعذر تحميل البيانات')}
    finally{setBusy(false)}
  }

  useEffect(()=>{load()},[mode]);

  const formBody=(e:FormEvent<HTMLFormElement>)=>Object.fromEntries(new FormData(e.currentTarget).entries());

  if(busy&&!data)return <div className="emptyState">جارٍ التحميل...</div>;

  if(mode==='interventions')return <section className="panel featurePanel">
    <div className="panelHead"><div><span className="panelEyebrow">متابعة آلية</span><h2>يحتاجون تدخلك اليوم</h2></div><button className="secondary" onClick={()=>load()}>تحديث</button></div>
    {error&&<div className="notice">{error}</div>}
    <Mini rows={data?.items||[]} cols={[[ 'full_name','الطالب'],['circle_name','الحلقة'],['absences','الغياب'],['avg_grade','متوسط الأداء'],['reasons_text','سبب التنبيه']]}/>
  </section>;

  if(mode==='library')return <div>
    {error&&<div className="notice">{error}</div>}
    {canManageLibrary&&<form className="quickForm" onSubmit={async e=>{
      e.preventDefault();setBusy(true);
      try{await apiPost('/api/ops?action=features&sub=library',formBody(e));e.currentTarget.reset();await load()}
      catch(x){setError(x instanceof Error?x.message:'تعذر الحفظ')}
      finally{setBusy(false)}
    }}>
      <label className="field"><span>البرنامج</span><input name="program_name" required/></label>
      <label className="field"><span>السلسلة</span><input name="series_name" required/></label>
      <label className="field"><span>عنوان الدرس</span><input name="title" required/></label>
      <label className="field"><span>المدرب</span><input name="teacher_name"/></label>
      <label className="field"><span>رقم الدرس</span><input name="sort_order" type="number" min="0" defaultValue="0"/></label>
      <label className="field"><span>المدة</span><input name="duration"/></label>
      <label className="field"><span>رابط YouTube</span><input name="youtube_url" type="url" required/></label>
      <label className="field"><span>وصف مختصر</span><input name="description"/></label>
      <button className="primary">إضافة الدرس</button>
    </form>}
    <div className="libraryGrid">{(data?.items||[]).map((x:any)=><article className="libraryCard" key={x.id}>
      <span>{x.program_name} ← {x.series_name}</span><h3>{x.title}</h3>
      <small>{x.teacher_name||'—'} {x.duration?'• '+x.duration:''}</small>
      <p>{x.description||''}</p>
      <a href={x.youtube_url} target="_blank" rel="noreferrer">فتح الدرس في YouTube</a>
      {canManageLibrary&&<button className="secondary" onClick={async()=>{await apiPut('/api/ops?action=features&sub=library',{id:x.id,is_active:!x.is_active});await load()}}>{x.is_active?'إخفاء':'إظهار'}</button>}
    </article>)}</div>
  </div>;

  if(mode==='guardian')return <div>
    {error&&<div className="notice">{error}</div>}
    <div className="opsToolbar"><label className="field"><span>دورية التقرير</span>
      <select value={data?.preference||'weekly'} onChange={async e=>{await apiPost('/api/ops?action=features&sub=guardian-preference',{frequency:e.target.value});await load()}}>
        <option value="weekly">أسبوعي</option><option value="monthly">شهري</option><option value="quarterly">ربع سنوي</option><option value="half_yearly">نصف سنوي</option><option value="yearly">سنوي</option>
      </select>
    </label></div>
    <div className="kpis compactOpsKpis">{(data?.children||[]).map((x:any)=><article key={x.id}><span>{x.full_name}</span><b>{x.attendance_rate}%</b><small>الحضور • متوسط القرآن {x.quran_average}%</small></article>)}</div>
    {!(data?.children||[]).length&&<div className="emptyState">لا يوجد طالب مرتبط بحساب ولي الأمر حتى الآن.</div>}
    <Mini rows={data?.children||[]} cols={[[ 'full_name','الطالب'],['circle_name','الحلقة'],['attendance_rate','الحضور %'],['quran_average','متوسط القرآن'],['new_pages','الجديد صفحات'],['review_pages','المراجعة صفحات']]}/>
  </div>;

  return <div>
    {error&&<div className="notice">{error}</div>}
    {currentRole!=='student'&&<div className="opsToolbar"><label className="field"><span>الطالب</span>
      <select value={studentId} onChange={e=>{setStudentId(e.target.value);if(e.target.value)load(e.target.value)}}><option value="">اختر الطالب</option>{students.map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select>
    </label></div>}
    {data?.student&&<>
      <div className="studentProfileHero"><div><span>رحلتي مع القرآن</span><h2>{data.student.full_name}</h2><p>{data.student.circle_name||'—'}</p></div></div>
      <div className="quranLegend"><span>محفوظ</span><span>قيد المراجعة</span><span>يحتاج تثبيت</span><span>لم يبدأ</span></div>
      <div className="quran604Grid">{(data.pages||[]).map((p:any)=><div key={p.page} title={p.state} className={'quranPage '+(p.state==='محفوظ'?'done':p.state==='قيد المراجعة'?'review':p.state==='يحتاج تثبيت'?'weak':'')}><b>{p.page}</b><small>{p.state}</small></div>)}</div>
      <h3>سجل الإنجاز</h3>
      <Mini rows={data.history||[]} cols={[[ 'record_date','التاريخ'],['record_type','النوع'],['from_page','من صفحة'],['to_page','إلى صفحة'],['grade','الدرجة']]}/>
    </>}
  </div>
}

function Mini({rows,cols}:{rows:any[];cols:[string,string][]}){
  if(!rows?.length)return <div className="empty">لا توجد بيانات.</div>;
  return <div className="table-wrap"><table><thead><tr>{cols.map(([k,l])=><th key={k}>{l}</th>)}</tr></thead><tbody>{rows.map((r:any,i:number)=><tr key={r.id||i}>{cols.map(([k])=><td key={k}>{r[k]??'—'}</td>)}</tr>)}</tbody></table></div>
}
