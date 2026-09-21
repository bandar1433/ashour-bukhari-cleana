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
const report1447={stats:[['447','طالبًا'],['18','معلمًا'],['17','مساعدًا'],['16','حلقة'],['61','جنسية']],news:[['رحلة المدينة المنورة','رحلة إيمانية علمية تربوية لنحو 50 طالبًا من طلاب الحلقات خلال إجازة الصيف.'],['إفطار صائم','لقاء إيماني واجتماعي يجمع طلاب الحلقات ويعزز الأخوة والتواصل.'],['البرنامج الترويحي','أنشطة تربوية واجتماعية مصاحبة تعزز الألفة بين طلاب الحلقات.'],['مجالس ختم القرآن والقراءات','مجالس دورية لختم كتاب الله وإتمام القراءات وربط الطلاب بالقرآن تلاوةً وإتقانًا.'],['برنامج المعايدة','برنامج اجتماعي قرآني يجمع الأساتذة والطلاب والخريجين ويعزز الأخوة والتواصل.']],achievements:[['إنجاز عالمي','تحقيق الطالب أنس الحازمي المركز الثاني على مستوى العالم الإسلامي.'],['المركز الثاني عالميًا','فوز الطالب أحمد كريم بالمركز الثاني في المسابقة العالمية للقرآن الكريم في روسيا.'],['إنجاز دولي','فوز أحمد كريم في مسابقة تنزانيا الدولية لحفظ القرآن الكريم وتلاوته.'],['المركز الأول على مستوى المملكة','فوز الطالب عمر بن محمد أشرف بالمركز الأول في فرع كامل القرآن في مسابقة وزارة التعليم.']]};
const objectives = [
['01','إتقان التلاوة والحفظ','بناء قراءة صحيحة وحفظ متدرج يقوم على الإتقان والمراجعة المستمرة.'],['02','تعميق الصلة بالقرآن','تربية الطالب على ملازمة كتاب الله وتعظيمه وتحويل التعلم إلى أثر في السلوك.'],['03','متابعة فردية دقيقة','خطة واضحة لكل طالب مع رصد الحضور والإنجاز والتسميع بصورة منتظمة.'],['04','تمكين المعلم','توفير أدوات عملية تساعد المعلم على إدارة الحلقة وقياس تقدم طلابه بوضوح.'],['05','تعزيز شراكة الأسرة','إتاحة تقارير مختصرة وواضحة تعين الأسرة على متابعة مسيرة الطالب وتشجيعه.'],['06','التحفيز والاستدامة','بناء بيئة مشجعة بالنقاط والجوائز والإنجازات بما يحافظ على الدافعية والاستمرار.']];
const values=[['الإخلاص','نستحضر شرف خدمة كتاب الله وابتغاء الأجر في التعليم والتعلم.'],['الإتقان','نعتمد الجودة والدقة في التلاوة والحفظ والمتابعة والتقويم.'],['الرحمة','نبني علاقة تعليمية راشدة تجمع الرفق والاحتواء والتوجيه.'],['القدوة','نجعل السلوك القرآني جزءاً أصيلاً من شخصية المعلم والمتعلم.'],['الانضباط','نلتزم بالمواعيد والخطط والمتابعة المنتظمة لتحقيق نتائج قابلة للقياس.'],['التعاون','نعزز الشراكة بين الإدارة والمعلم والطالب والأسرة لخدمة المسيرة القرآنية.']];
const journey=[['01','التهيئة','تحديد المستوى وربط الطالب بحلقته وخطته المناسبة.'],['02','التعلّم','تصحيح التلاوة وبناء الحفظ الجديد وفق مسار متدرج.'],['03','التثبيت','مراجعة وتسميع مستمران مع تسجيل الإنجاز اليومي.'],['04','القياس','تقارير ومؤشرات ونقاط تساعد على تحسين الأداء واستدامته.']];
function AboutSections(){return <><section className="sectionPro aboutIntro reveal reveal-up"><div className="aboutCopy"><span className="sectionLabel">عن حلقات عاشور بخاري</span><h2>بيئة قرآنية تربوية تصنع صلة مستمرة بكتاب الله</h2><p>حلقات عاشور بخاري منظومة تعليمية قرآنية تُعنى بتعليم التلاوة الصحيحة، والحفظ المتقن، والمراجعة المنتظمة، مع متابعة تربوية وإدارية تجمع الطالب والمعلم والأسرة في مسار واحد واضح وقابل للقياس.</p><p>وتستفيد الحلقات من المنصة الرقمية في تنظيم المراكز والحلقات، وتوثيق الحضور والإنجاز والتسميع، وإصدار التقارير، وتحفيز الطلاب؛ ليبقى التعليم القرآني قريباً، منظماً، ومستمراً.</p></div><div className="identityStack"><article className="identityCard visionCard"><span>الرؤية</span><h3>بيئة قرآنية رائدة في بناء قارئ متقن متصل بكتاب الله.</h3></article><article className="identityCard missionCard"><span>الرسالة</span><h3>تعليم قرآني منظم يجمع الإتقان والتربية والمتابعة والتقنية.</h3></article></div></section><section className="sectionPro objectivesSection"><div className="sectionHeading"><span className="sectionLabel">أهدافنا</span><h2>أهداف واضحة تتحول إلى ممارسة يومية</h2></div><div className="objectivesGrid">{objectives.map(([n,t,x])=><article className="objectiveCard" key={t}><span className="objectiveNumber">{n}</span><h3>{t}</h3><p>{x}</p></article>)}</div></section><section className="valuesSection"><div className="sectionPro"><div className="sectionHeading lightHeading"><span className="sectionLabel">قيمنا</span><h2>قيم تحكم التعليم والعلاقة والأثر</h2></div><div className="valuesGrid">{values.map(([t,x],i)=><article className="valueCard" key={t}><span>{String(i+1).padStart(2,'0')}</span><h3>{t}</h3><p>{x}</p></article>)}</div></div></section><section className="sectionPro journeySection"><div className="sectionHeading"><span className="sectionLabel">مسيرة الطالب</span><h2>رحلة تعليمية مترابطة من البداية إلى التقرير</h2></div><div className="journeyTrack">{journey.map(([n,t,x])=><article className="journeyStep" key={t}><div className="journeyNumber">{n}</div><div><h3>{t}</h3><p>{x}</p></div></article>)}</div></section></>}


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
        {publicView==='عن الحلقات'&&<AboutSections/>}{publicView==='الرئيسية'&&<><AboutSections/><section className="report1447"><div className="sectionHead"><div><span>حصاد 1447هـ</span><h2>حلقات تمتد من مكة إلى العالم</h2></div></div><div className="reportStats">{report1447.stats.map(([n,l])=><article key={l}><b>{n}</b><span>{l}</span></article>)}</div><div className="sectionHead reportSubhead"><div><span>أخبار الحلقات</span><h2>برامج مصاحبة تصنع الأثر</h2></div></div><div className="reportCards">{report1447.news.map(([t,b])=><article key={t}><div><h3>{t}</h3><p>{b}</p></div></article>)}</div></section></>}
        {publicView==='الحلقات القرآنية'&&<section className="section"><div className="sectionHead"><div><span>الحلقات</span><h2>الحلقات القرآنية</h2></div></div><div className="roleGrid">{publicData.circles?.map((x:any)=><article className="roleCard" key={x.id}><b>{x.name}</b><small>{x.center_name||'—'}</small><em>{x.teacher_name||'لم يحدد المعلم'}</em></article>)}</div></section>}
        {publicView==='الأخبار والفعاليات'&&<section className="report1447 publicReportPage"><div className="innerHero reportPageHero"><span className="sectionLabel">أخبار الحلقات</span><h1>برامج وفعاليات تصنع الأثر</h1><p>نماذج من البرامج المصاحبة والفعاليات الموثقة في تقرير حلقات عاشور بخاري لعام 1447هـ.</p></div><div className="reportCards publicCards">{report1447.news.map(([t,b])=><article key={t}><div><span className="sectionLabel">خبر وفعالية</span><h3>{t}</h3><p>{b}</p></div></article>)}</div>{publicData.news?.length>0&&<><div className="sectionHead reportSubhead"><div><span>آخر المستجدات</span><h2>أخبار منشورة من إدارة المنصة</h2></div></div><div className="reportCards publicCards">{publicData.news.map((n:any)=><article key={n.id}><div><span className="sectionLabel">{n.kind==='achievement'?'إنجاز':n.kind==='event'?'فعالية':'خبر'}</span><h3>{n.title}</h3><p>{n.body}</p></div></article>)}</div></>}</section>}
        {publicView==='الإنجازات'&&<section className="report1447 publicReportPage"><div className="innerHero reportPageHero"><span className="sectionLabel">إنجازات 1447هـ</span><h1>طلاب الحلقات في ميادين التميز</h1><p>نماذج من الإنجازات العالمية والدولية والمحلية الواردة في التقرير السنوي.</p></div><div className="reportCards achievements publicCards">{report1447.achievements.map(([t,b])=><article key={t}><div><span className="sectionLabel">إنجاز</span><h3>{t}</h3><p>{b}</p></div></article>)}</div><div className="reportStats">{report1447.stats.map(([n,l])=><article key={l}><b>{n}</b><span>{l}</span></article>)}</div></section>}{['المعلمون','الطلاب'].includes(publicView)&&<section className="simplePage richSimplePage"><span className="sectionLabel">{publicView}</span><h1>{publicView}</h1><p>هذا القسم جزء من منصة حلقات عاشور بخاري ويُدار محتواه من خلال مدير النظام.</p></section>}
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
