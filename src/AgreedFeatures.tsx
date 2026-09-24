import {useEffect,useState,type FormEvent} from 'react';
import {apiGet,apiPost,apiPut,StudentRow} from './lib/api';

type Mode='library'|'guardian'|'quranJourney'|'interventions'|'profile'|'reports';

export default function AgreedFeatures({mode,currentRole,students}:{mode:Mode;currentRole:string;students:StudentRow[]}){
  const [data,setData]=useState<any>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [studentId,setStudentId]=useState('');
  const [pageFilter,setPageFilter]=useState<number|null>(null);
  const [period,setPeriod]=useState('weekly');const [reportRange,setReportRange]=useState({from:'',to:''});const [reportTab,setReportTab]=useState('dashboard');
  const canManageLibrary=['system_admin','center_manager','supervisor'].includes(currentRole);

  async function load(id=studentId){
    setBusy(true);setError('');
    try{
      if(mode==='library') setData(await apiGet('/api/ops?action=features&sub=library'));
      if(mode==='guardian') setData(await apiGet('/api/ops?action=features&sub=guardian'));
      if(mode==='quranJourney') setData(await apiGet('/api/ops?action=features&sub=quran-journey'+(id?'&student_id='+encodeURIComponent(id):'')));
      if(mode==='interventions') setData(await apiGet('/api/ops?action=features&sub=interventions'));
      if(mode==='profile') setData(await apiGet('/api/ops?action=profile'));
      if(mode==='reports') setData(await apiGet(`/api/ops?action=features&sub=reports&period=${period}${period==='custom'&&reportRange.from&&reportRange.to?`&from=${reportRange.from}&to=${reportRange.to}`:''}`));
    }catch(e){setError(e instanceof Error?e.message:'تعذر تحميل البيانات')}
    finally{setBusy(false)}
  }

  useEffect(()=>{load()},[mode]);

  const formBody=(e:FormEvent<HTMLFormElement>)=>Object.fromEntries(new FormData(e.currentTarget).entries());

  if(busy&&!data)return <div className="emptyState">جارٍ التحميل...</div>;

  if(mode==='profile')return <div>{error&&<div className="notice">{error}</div>}{data&&<form className="quickForm" onSubmit={async e=>{e.preventDefault();try{await apiPut('/api/ops?action=profile',formBody(e));await load()}catch(x){setError(x instanceof Error?x.message:'تعذر الحفظ')}}}><label className="field"><span>الاسم الكامل</span><input name="full_name" defaultValue={data.full_name||''}/></label><label className="field"><span>رقم الجوال</span><input name="phone" defaultValue={data.phone||''}/></label><label className="field"><span>الصورة الشخصية (اختياري)</span><input name="avatar_url" type="url" defaultValue={data.avatar_url||''} placeholder="رابط الصورة"/></label><label className="field"><span>البريد</span><input value={data.email||''} disabled/></label><label className="field"><span>نوع الحساب</span><input value={data.role||''} disabled/></label><button className="primary">حفظ البيانات</button><button className="secondary" type="button" disabled title="يُفعّل مع خدمة الجوال">التحقق OTP — قريبًا</button><button className="secondary" type="button" disabled title="يتاح عند تفعيل الدخول بالجوال أو كلمة المرور">تغيير / استرجاع كلمة المرور — قريبًا</button></form>}</div>;

  if(mode==='reports'){
    const allowedTabs=currentRole==='student'?['dashboard','students']:currentRole==='guardian'?['dashboard','students']:currentRole==='teacher'?['dashboard','students','circles']:['dashboard','students','circles','centers'];
    const tab=allowedTabs.includes(reportTab)?reportTab:allowedTabs[0];
    const exportExcel=()=>{const rows=tab==='centers'?(data?.centers||[]):tab==='circles'?(data?.circles||[]):data?.students||[];if(!rows.length)return;const keys=Object.keys(rows[0]);const html='<table><tr>'+keys.map(k=>'<th>'+k+'</th>').join('')+'</tr>'+rows.map((r:any)=>'<tr>'+keys.map(k=>'<td>'+String(r[k]??'')+'</td>').join('')+'</tr>').join('')+'</table>';const blob=new Blob(['\ufeff'+html],{type:'application/vnd.ms-excel'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='report.xls';a.click();URL.revokeObjectURL(url)};
    return <div>{error&&<div className="notice">{error}</div>}
      <div className="opsToolbar"><label className="field"><span>الفترة</span><select value={period} onChange={e=>setPeriod(e.target.value)}><option value="weekly">أسبوعي</option><option value="monthly">شهري</option><option value="quarterly">ربع سنوي</option><option value="half_yearly">نصف سنوي</option><option value="yearly">سنوي</option><option value="custom">مخصص</option></select></label>{period==='custom'&&<><label className="field"><span>من</span><input type="date" value={reportRange.from} onChange={e=>setReportRange(x=>({...x,from:e.target.value}))}/></label><label className="field"><span>إلى</span><input type="date" value={reportRange.to} onChange={e=>setReportRange(x=>({...x,to:e.target.value}))}/></label></>}<button className="primary" onClick={()=>load()}>عرض</button><button className="secondary" onClick={()=>window.print()}>طباعة / PDF</button><button className="secondary" onClick={exportExcel}>Excel</button></div>
      <div className="opsToolbar">{allowedTabs.map(x=><button key={x} className={tab===x?'primary':'secondary'} onClick={()=>setReportTab(x)}>{x==='dashboard'?'لوحة المؤشرات':x==='students'?'الطلاب':x==='circles'?'الحلقات':'المراكز'}</button>)}</div>
      {tab==='dashboard'&&<><div className="kpis compactOpsKpis"><article><span>الطلاب</span><b>{data?.metrics?.total_students||0}</b></article><article><span>الحضور</span><b>{data?.metrics?.attendance_rate||0}%</b></article><article><span>متوسط الدرجات</span><b>{data?.metrics?.avg_grade||0}%</b></article><article><span>تحقيق الخطة</span><b>{data?.metrics?.achievement_rate==null?'—':data.metrics.achievement_rate+'%'}</b><small>{data?.metrics?.planned_students||0} طالب لديهم خطة</small></article><article><span>الجديد</span><b>{data?.metrics?.new_pages||0}</b><small>صفحة</small></article><article><span>المراجعة</span><b>{data?.metrics?.review_pages||0}</b><small>صفحة</small></article><article><span>يحتاج متابعة</span><b>{data?.metrics?.struggling||0}</b></article></div><h3>الأكثر تحسنًا</h3><Mini rows={data?.mostImproved||[]} cols={[[ 'full_name','الطالب'],['previous_avg','السابق'],['current_avg','الحالي'],['improvement','التحسن']]}/><h3>الأعلى أداءً</h3><Mini rows={data?.topPerformers||[]} cols={[[ 'full_name','الطالب'],['avg_grade','الدرجة'],['attendance_rate','الحضور %']]}/></>}
      {tab==='students'&&<Mini rows={data?.students||[]} cols={[[ 'full_name','الطالب'],['center_name','المركز'],['circle_name','الحلقة'],['attendance_rate','الحضور %'],['achievement_rate','تحقيق الخطة %'],['avg_grade','الدرجة'],['new_pages','الجديد'],['review_pages','المراجعة']]}/>}
      {tab==='circles'&&<Mini rows={data?.circles||[]} cols={[[ 'name','الحلقة'],['students','الطلاب'],['attendance_rate','الحضور %'],['achievement_rate','تحقيق الخطة %'],['avg_grade','الدرجة'],['new_pages','الجديد'],['review_pages','المراجعة'],['struggling','يحتاج متابعة']]}/>}
      {tab==='centers'&&<Mini rows={data?.centers||[]} cols={[[ 'name','المركز'],['students','الطلاب'],['attendance_rate','الحضور %'],['achievement_rate','تحقيق الخطة %'],['avg_grade','الدرجة'],['new_pages','الجديد'],['review_pages','المراجعة'],['struggling','يحتاج متابعة']]}/>}
    </div>
  }

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
      {canManageLibrary&&<div className="opsToolbar"><button className="secondary" onClick={async()=>{const title=prompt('عنوان الدرس',x.title);if(!title)return;const order=prompt('ترتيب الدرس',String(x.sort_order||0));await apiPut('/api/ops?action=features&sub=library',{id:x.id,title,sort_order:Number(order||0)});await load()}}>تعديل / ترتيب</button><button className="secondary" onClick={async()=>{await apiPut('/api/ops?action=features&sub=library',{id:x.id,is_active:!x.is_active});await load()}}>{x.is_active?'إخفاء':'إظهار'}</button></div>}
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
    <Mini rows={data?.children||[]} cols={[[ 'full_name','الطالب'],['circle_name','الحلقة'],['attendance_rate','الحضور %'],['quran_average','متوسط القرآن'],['new_pages','الجديد صفحات'],['review_pages','المراجعة صفحات'],['points_balance','النقاط'],['rewards_count','الجوائز'],['absence_dates','تواريخ الغياب']]}/>
  </div>;

  return <div>
    {error&&<div className="notice">{error}</div>}
    {currentRole!=='student'&&<div className="opsToolbar"><label className="field"><span>الطالب</span>
      <select value={studentId} onChange={e=>{setStudentId(e.target.value);if(e.target.value)load(e.target.value)}}><option value="">اختر الطالب</option>{students.map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select>
    </label></div>}
    {data?.student&&<>
      <div className="studentProfileHero"><div><span>رحلتي مع القرآن</span><h2>{data.student.full_name}</h2><p>{data.student.circle_name||'—'}</p></div></div>
      <div className="quranLegend"><span>محفوظ</span><span>قيد المراجعة</span><span>يحتاج تثبيت</span><span>لم يبدأ</span></div>
      <div className="quran604Grid">{(data.pages||[]).map((p:any)=><button type="button" key={p.page} onClick={()=>setPageFilter(p.page)} title={p.state} className={'quranPage '+(p.state==='محفوظ'?'done':p.state==='قيد المراجعة'?'review':p.state==='يحتاج تثبيت'?'weak':'')}><b>{p.page}</b><small>{p.state}</small></button>)}</div>
      <h3>سجل الإنجاز {pageFilter?`— صفحة ${pageFilter}`:''}</h3>{pageFilter&&<button className="secondary" onClick={()=>setPageFilter(null)}>عرض الكل</button>}
      <Mini rows={(data.history||[]).filter((r:any)=>!pageFilter||(Number(r.from_page)<=pageFilter&&Number(r.to_page)>=pageFilter))} cols={[[ 'record_date','التاريخ'],['record_type','النوع'],['from_page','من صفحة'],['to_page','إلى صفحة'],['grade','الدرجة']]}/>
    </>}
  </div>
}

function Mini({rows,cols}:{rows:any[];cols:[string,string][]}){
  if(!rows?.length)return <div className="empty">لا توجد بيانات.</div>;
  return <div className="table-wrap"><table><thead><tr>{cols.map(([k,l])=><th key={k}>{l}</th>)}</tr></thead><tbody>{rows.map((r:any,i:number)=><tr key={r.id||i}>{cols.map(([k])=><td key={k}>{r[k]??'—'}</td>)}</tr>)}</tbody></table></div>
}
