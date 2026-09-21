import { useEffect, useMemo, useState } from 'react';
import {
  apiGet,
  CircleRow,
  clearAccessCode,
  getAccessCode,
  getStatus,
  setAccessCode,
  StudentRow,
  Summary,
  UserRow,
} from './lib/api';

type Tab = 'overview' | 'students' | 'circles' | 'users' | 'attendance' | 'memorization' | 'plans' | 'news';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

const roleLabel: Record<string, string> = {
  system_admin: 'مدير النظام',
  center_manager: 'مدير مركز',
  teacher: 'معلم',
  student: 'طالب',
};

export default function App() {
  const [code, setCode] = useState(getAccessCode());
  const [enteredCode, setEnteredCode] = useState(getAccessCode());
  const [status, setStatus] = useState<any>(null);
  const [publicData,setPublicData]=useState<any>({stats:{},news:[],circles:[]});
  const [publicView,setPublicView]=useState('الرئيسية');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [circles, setCircles] = useState<CircleRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [memorization, setMemorization] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState<string>('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    getStatus()
      .then(setStatus)
      .catch((err) => setStatus({ configured: false, database: 'error', error: err.message }));
    fetch('/api/public').then(r=>r.json()).then(setPublicData).catch(()=>{});
  }, []);

  async function loadDashboard() {
    setLoadState('loading');
    setError('');

    try {
      const [summaryData, studentsData, circlesData, usersData, attendanceData, memorizationData, plansData, newsData] = await Promise.all([
        apiGet<Summary>('/api/summary'),
        apiGet<{ items: StudentRow[] }>('/api/students'),
        apiGet<{ items: CircleRow[] }>('/api/circles'),
        apiGet<{ items: UserRow[] }>('/api/users'),
        apiGet<{ items: any[] }>('/api/attendance'), apiGet<{ items:any[] }>('/api/memorization'), apiGet<{ items:any[] }>('/api/plans'), apiGet<{ items:any[] }>('/api/news'),
      ]);

      setSummary(summaryData);
      setStudents(studentsData.items || []);
      setCircles(circlesData.items || []);
      setUsers(usersData.items || []); setAttendance(attendanceData.items||[]); setMemorization(memorizationData.items||[]); setPlans(plansData.items||[]); setNews(newsData.items||[]);
      setLoadState('ready');
    } catch (err) {
      setLoadState('error');
      setError(err instanceof Error ? err.message : 'حدث خطأ غير معروف');
    }
  }

  useEffect(() => {
    if (code) {
      loadDashboard();
    }
  }, [code]);

  function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    const cleaned = enteredCode.trim();
    if (!cleaned) {
      setError('أدخل رمز الدخول.');
      return;
    }
    setAccessCode(cleaned);
    setCode(cleaned);
  }

  function handleLogout() {
    clearAccessCode();
    setCode('');
    setEnteredCode('');
    setSummary(null);
    setStudents([]);
    setCircles([]);
    setUsers([]);
    setLoadState('idle');
  }

  const filteredStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((row) =>
      [row.full_name, row.email, row.circle_name, row.center_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [students, query]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((row) =>
      [row.full_name, row.email, roleLabel[row.role] || row.role]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [users, query]);

  const filteredCircles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return circles;
    return circles.filter((row) =>
      [row.name, row.center_name, row.teacher_name, row.teacher_email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [circles, query]);

  return (
    <main>
      <header className="header">
        <button className="brand" type="button">
          <img className="brandLogo" src="/resources/logo-halaqat-ashour-bukhari.png" alt="شعار حلقات عاشور بخاري" />
          <div><b>حلقات عاشور بخاري</b><small>منصة إدارة الحلقات القرآنية</small></div>
        </button>
        <nav>
          {['الرئيسية','عن الحلقات','الحلقات القرآنية','المعلمون','الطلاب','الإنجازات','الأخبار والفعاليات'].map(v=><button key={v} className={publicView===v?'active':''} onClick={()=>setPublicView(v)}>{v}</button>)}
        </nav>
        <div className="headerActions">{code ? <button className="login" onClick={handleLogout}>خروج</button> : null}</div>
      </header>

      {!code ? <>
        {publicView==='الرئيسية'&&<><section className="hero">
          <div className="heroText reveal reveal-right"><span className="eyebrow">حلقات القرآن الكريم</span><h1>حلقات عاشور بخاري</h1><h2>تعليمٌ متقن، وتربيةٌ قرآنية، ومتابعةٌ مستمرة</h2><p>منصة موحدة لتنظيم الحلقات ومتابعة الطلاب والمعلمين والحفظ والمراجعة والحضور.</p></div>
          <div className="heroArt reveal reveal-left"><div className="heroLogoCard"><img src="/resources/logo-halaqat-ashour-bukhari.png" alt="شعار حلقات عاشور بخاري" /></div></div>
        </section>
        <section className="stats"><article><b>{publicData.stats?.students ?? '—'}</b><span>طالب</span></article><article><b>{publicData.stats?.teachers ?? '—'}</b><span>معلم</span></article><article><b>{publicData.stats?.circles ?? '—'}</b><span>حلقة</span></article><article><b>{publicData.stats?.centers ?? '—'}</b><span>مركز</span></article></section></>}
        {publicView==='عن الحلقات'&&<section className="section sectionPro"><div className="sectionHead"><div><span>عن حلقات عاشور بخاري</span><h2>بيئة قرآنية تربوية متكاملة</h2></div></div><div className="featureGrid"><article><h3>الرؤية</h3><p>بيئة قرآنية رائدة في بناء قارئ متقن متصل بكتاب الله.</p></article><article><h3>الرسالة</h3><p>تعليم قرآني منظم يجمع الإتقان والتربية والمتابعة والتقنية.</p></article><article><h3>المتابعة</h3><p>متابعة الحفظ والمراجعة والحضور والتقدم بصورة مستمرة.</p></article></div></section>}
        {publicView==='الحلقات القرآنية'&&<section className="section"><div className="sectionHead"><div><span>الحلقات</span><h2>الحلقات القرآنية</h2></div></div><div className="roleGrid">{publicData.circles?.map((x:any)=><article className="roleCard" key={x.id}><b>{x.name}</b><small>{x.center_name||'—'}</small><em>{x.teacher_name||'لم يحدد المعلم'}</em></article>)}</div></section>}
        {publicView==='الأخبار والفعاليات'&&<section className="section"><div className="sectionHead"><div><span>المستجدات</span><h2>الأخبار والفعاليات</h2></div></div><div className="newsGrid">{publicData.news?.length?publicData.news.map((n:any)=><article key={n.id}><time>{n.event_date?new Date(n.event_date).toLocaleDateString('ar-SA'):''}</time><h3>{n.title}</h3><p>{n.body}</p></article>):<article><h3>لا توجد أخبار منشورة حاليًا</h3></article>}</div></section>}
        {['المعلمون','الطلاب','الإنجازات'].includes(publicView)&&<section className="simplePage"><h1>{publicView}</h1><p>يعرض هذا القسم محتوى {publicView} ضمن هوية المنصة.</p></section>}
        <section className="section"><div className="sectionHead"><div><span>بوابة الإدارة</span><h2>الدخول إلى المنصة</h2></div></div><div className="panel" style={{maxWidth:520,margin:'0 auto'}}><form onSubmit={handleLogin}><label className="field"><span>رمز الدخول</span><input type="password" value={enteredCode} onChange={e=>setEnteredCode(e.target.value)} placeholder="أدخل رمز الدخول" autoFocus /></label><button className="primary" type="submit">دخول</button></form>{error&&<div className="notice">{error}</div>}</div></section>
      </> :
      <div className="workspace">
        <aside>
          <div className="user"><span><img src="/resources/logo-halaqat-ashour-bukhari.png" alt="" /></span><div><b>مدير النظام</b><small>حلقات عاشور بخاري</small></div></div>
          <button className={activeTab==='overview'?'selected':''} onClick={()=>setActiveTab('overview')}>نظرة عامة</button>
          <button className={activeTab==='students'?'selected':''} onClick={()=>setActiveTab('students')}>الطلاب</button>
          <button className={activeTab==='circles'?'selected':''} onClick={()=>setActiveTab('circles')}>الحلقات</button>
          <button className={activeTab==='users'?'selected':''} onClick={()=>setActiveTab('users')}>المستخدمون</button>
          <button className={activeTab==='attendance'?'selected':''} onClick={()=>setActiveTab('attendance')}>الحضور</button>
          <button className={activeTab==='memorization'?'selected':''} onClick={()=>setActiveTab('memorization')}>التسميع والمراجعة</button>
          <button className={activeTab==='plans'?'selected':''} onClick={()=>setActiveTab('plans')}>الخطط الأسبوعية</button>
          <button className={activeTab==='news'?'selected':''} onClick={()=>setActiveTab('news')}>الأخبار والفعاليات</button>
          <button className="exit" onClick={handleLogout}>تسجيل الخروج</button>
        </aside>
        <section className="dashboardContent">
          <div className="crumb"><div><span>لوحة التحكم</span><h1>{activeTab==='overview'?'نظرة عامة':'إدارة المنصة'}</h1></div><button className="secondary" onClick={loadDashboard}>تحديث البيانات</button></div>
          {error&&<div className="notice">{error}</div>}
          <div className="kpis"><article><span>الطلاب</span><b>{summary?.students??'—'}</b></article><article><span>المعلمون</span><b>{summary?.teachers??'—'}</b></article><article><span>الحلقات</span><b>{summary?.circles??'—'}</b></article><article><span>المراكز</span><b>{summary?.centers??'—'}</b></article></div>
          <div className="panel">
            <div className="panelHead"><h2>{activeTab==='overview'?'مؤشرات التشغيل':'السجلات'}</h2>{activeTab!=='overview'&&<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="بحث..." />}</div>
            {loadState==='loading'&&<div className="emptyState">جارٍ تحميل البيانات...</div>}
            {loadState!=='loading'&&activeTab==='overview'&&<div className="featureGrid"><article><b>الحضور والانصراف</b><p>{summary?.attendance??0} سجل</p></article><article><b>التسميع والمراجعة</b><p>{summary?.memorization??0} سجل</p></article><article><b>الخطط الأسبوعية</b><p>{summary?.plans??0} خطة</p></article></div>}
            {loadState!=='loading'&&activeTab==='students'&&<StudentsTable rows={filteredStudents}/>}
            {loadState!=='loading'&&activeTab==='circles'&&<CirclesTable rows={filteredCircles}/>}
            {loadState!=='loading'&&activeTab==='users'&&<UsersTable rows={filteredUsers}/>}
            {loadState!=='loading'&&activeTab==='attendance'&&<GenericTable rows={attendance} columns={[[ 'full_name','الطالب'],['circle_name','الحلقة'],['attendance_date','التاريخ'],['status','الحالة'],['late_minutes','دقائق التأخر']]}/>}
            {loadState!=='loading'&&activeTab==='memorization'&&<GenericTable rows={memorization} columns={[[ 'full_name','الطالب'],['record_date','التاريخ'],['record_type','النوع'],['surah_no','السورة'],['from_ayah','من آية'],['to_ayah','إلى آية'],['grade','الدرجة']]}/>}
            {loadState!=='loading'&&activeTab==='plans'&&<GenericTable rows={plans} columns={[[ 'full_name','الطالب'],['week_start','الأسبوع'],['day_name','اليوم'],['new_target','الجديد'],['review_target','المراجعة'],['goals','الأهداف']]}/>}
            {loadState!=='loading'&&activeTab==='news'&&<GenericTable rows={news} columns={[[ 'title','العنوان'],['kind','النوع'],['event_date','التاريخ'],['status','الحالة']]}/>}
          </div>
        </section>
      </div>}
      <footer><div><b>حلقات عاشور بخاري</b><p>منصة قرآنية للتعليم والمتابعة والإدارة.</p></div><div>جميع الحقوق محفوظة</div></footer>
    </main>
  );
}

function GenericTable({rows,columns}:{rows:any[];columns:[string,string][]}){if(!rows.length)return <div className="empty">لا توجد بيانات مسجلة حتى الآن.</div>;return <div className="table-wrap"><table><thead><tr>{columns.map(([k,l])=><th key={k}>{l}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.id||i}>{columns.map(([k])=><td key={k}>{typeof r[k]==='boolean'?(r[k]?'نعم':'لا'):(r[k]??'—')}</td>)}</tr>)}</tbody></table></div>}

function ModuleCard({ icon, title, value, note }: { icon:string; title:string; value?:number; note:string }) { return <div className="module-card"><div className="module-icon">{icon}</div><div><strong>{title}</strong><p>{note}</p></div><b>{typeof value==='number'?value.toLocaleString('ar-SA'):'—'}</b></div>; }

function StatCard({ label, value }: { label: string; value?: number }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{typeof value === 'number' ? value.toLocaleString('ar-SA') : '—'}</strong>
    </div>
  );
}

function StudentsTable({ rows }: { rows: StudentRow[] }) {
  if (!rows.length) return <div className="empty">لا توجد بيانات طلاب مطابقة.</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>الاسم</th>
            <th>البريد</th>
            <th>الحلقة</th>
            <th>المركز</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.full_name}</td>
              <td>{row.email || '—'}</td>
              <td>{row.circle_name || '—'}</td>
              <td>{row.center_name || '—'}</td>
              <td>{row.is_active ? 'نشط' : 'غير نشط'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CirclesTable({ rows }: { rows: CircleRow[] }) {
  if (!rows.length) return <div className="empty">لا توجد حلقات مطابقة.</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>الحلقة</th>
            <th>المركز</th>
            <th>المعلم</th>
            <th>عدد الطلاب</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td>{row.center_name || '—'}</td>
              <td>{row.teacher_name || row.teacher_email || '—'}</td>
              <td>{row.students_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UsersTable({ rows }: { rows: UserRow[] }) {
  if (!rows.length) return <div className="empty">لا توجد حسابات مطابقة.</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>الاسم</th>
            <th>البريد</th>
            <th>الدور</th>
            <th>الحالة</th>
            <th>مرتبط</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.full_name}</td>
              <td>{row.email || '—'}</td>
              <td>{roleLabel[row.role] || row.role}</td>
              <td>{row.is_active ? 'نشط' : 'غير نشط'}</td>
              <td>{row.linked ? 'نعم' : 'لا'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
