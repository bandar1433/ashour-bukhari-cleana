import { useEffect, useMemo, useState } from 'react';
import {
  apiGet,
  apiPost,
  apiPut,
  CenterRow,
  CircleRow,
  clearAccessCode,
  clearSessionToken,
  getAccessCode,
  getSessionToken,
  getStatus,
  setAccessCode,
  setSessionToken,
  StudentRow,
  Summary,
  UserRow,
} from './lib/api';
import { authClient, getAuthToken } from './lib/auth';

type Tab = 'overview' | 'centers' | 'students' | 'circles' | 'users' | 'roles' | 'attendance' | 'memorization' | 'plans' | 'news';

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
  supervisor: 'مشرف',
  teacher: 'معلم',
  student: 'طالب',
  guardian: 'ولي أمر',
};

export default function App() {
  const [code, setCode] = useState(getAccessCode() || (getSessionToken() ? 'session' : ''));
  const [enteredCode, setEnteredCode] = useState(getAccessCode());
  const [authMode,setAuthMode]=useState<'account'|'legacy'>('account');
  const [authIntent,setAuthIntent]=useState<'signin'|'signup'>('signin');
  const [accountForm,setAccountForm]=useState({name:'',email:'',password:''});
  const [status, setStatus] = useState<any>(null);
  const [publicData,setPublicData]=useState<any>({stats:{},news:[],circles:[]});
  const [publicView,setPublicView]=useState('الرئيسية');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [centers, setCenters] = useState<CenterRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [circles, setCircles] = useState<CircleRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roleData, setRoleData] = useState<any>({roles:[],permissions:[]});
  const [loginRequests,setLoginRequests]=useState<any[]>([]);
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
      const [summaryData, centersData, studentsData, circlesData, usersData, rolesData, attendanceData, memorizationData, plansData, newsData] = await Promise.all([
        apiGet<Summary>('/api/summary'),
        apiGet<{ items: CenterRow[] }>('/api/centers'),
        apiGet<{ items: StudentRow[] }>('/api/students'),
        apiGet<{ items: CircleRow[] }>('/api/circles'),
        apiGet<{ items: UserRow[]; requests?: any[] }>('/api/users'),
        apiGet<any>('/api/roles'),
        apiGet<{ items: any[] }>('/api/attendance'), apiGet<{ items:any[] }>('/api/memorization'), apiGet<{ items:any[] }>('/api/plans'), apiGet<{ items:any[] }>('/api/news'),
      ]);

      setSummary(summaryData);
      setCenters(centersData.items || []);
      setStudents(studentsData.items || []);
      setCircles(circlesData.items || []);
      setUsers(usersData.items || []); setLoginRequests(usersData.requests||[]); setRoleData(rolesData||{roles:[],permissions:[]}); setAttendance(attendanceData.items||[]); setMemorization(memorizationData.items||[]); setPlans(plansData.items||[]); setNews(newsData.items||[]);
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
    clearSessionToken();
    setAccessCode(cleaned);
    setCode(cleaned);
  }

  async function handleAccountLogin(event:React.FormEvent){
    event.preventDefault();
    setError('');
    try{
      const email=accountForm.email.trim();
      const password=accountForm.password;
      if(!email||!password) throw new Error('أدخل البريد الإلكتروني وكلمة المرور.');
      if(authIntent==='signup'){
        const name=accountForm.name.trim();
        if(!name) throw new Error('أدخل الاسم.');
        const result:any=await authClient.signUp.email({email,password,name});
        if(result?.error) throw new Error(result.error.message||'تعذر إنشاء الحساب');
      }else{
        const result:any=await authClient.signIn.email({email,password});
        if(result?.error) throw new Error(result.error.message||'بيانات الدخول غير صحيحة');
      }
      const neonToken=await getAuthToken();
      if(!neonToken) throw new Error('تعذر إنشاء جلسة الدخول.');
      const response=await fetch('/api/auth-session',{
        method:'POST',
        headers:{Accept:'application/json',Authorization:`Bearer ${neonToken}`}
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(payload?.message||payload?.error||'تعذر اعتماد جلسة الدخول.');
      clearAccessCode();
      setSessionToken(payload.token);
      setCode('session');
      setAccountForm({name:'',email:'',password:''});
    }catch(err){
      setError(err instanceof Error?err.message:'تعذر تسجيل الدخول');
    }
  }

  function handleLogout() {
    clearAccessCode();
    clearSessionToken();
    authClient.signOut().catch(()=>{});
    setCode('');
    setEnteredCode('');
    setSummary(null);
    setCenters([]);
    setStudents([]);
    setCircles([]);
    setUsers([]);
    setLoginRequests([]);
    setRoleData({roles:[],permissions:[]});
    setLoadState('idle');
  }

  async function submitForm(path:string,event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    setError('');
    const form=event.currentTarget;
    try{
      const body=Object.fromEntries(new FormData(form).entries());
      await apiPost(path,body);
      form.reset();
      await loadDashboard();
    }catch(err){
      setError(err instanceof Error?err.message:'تعذر حفظ البيانات');
    }
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
          {['الرئيسية','عن الحلقات','الحلقات القرآنية','المعلمون','الطلاب','الإنجازات','الأخبار والفعاليات','الوسائط','تواصل معنا'].map(v=><button key={v} className={publicView===v?'active':''} onClick={()=>setPublicView(v)}>{v}</button>)}
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
        {publicView==='الحلقات القرآنية'&&<section className="section"><div className="innerHero"><span className="sectionLabel">الحلقات القرآنية</span><h1>مسارات تعليمية تناسب مراحل الطلاب</h1><p>من التهجي والتلقين إلى الحفظ والإتقان والقراءات.</p></div><div className="roleGrid">{['مسار التهجي والتلقين','مسار حفظ القرآن للأشبال','مسار حفظ القرآن للشباب','مسار حفظ القرآن والمتون','مسار القراءات'].map((x,i)=><article className="roleCard" key={x}><i>◈</i><b>{x}</b><small>{i===0?'تأسيس القراءة والتلقين الصحيح':'حفظ ومراجعة وتسميع وفق خطة متدرجة'}</small></article>)}</div><div className="sectionHead reportSubhead"><div><span>الحلقات المسجلة</span><h2>الحلقات النشطة في المنصة</h2></div></div><div className="roleGrid">{publicData.circles?.map((x:any)=><article className="roleCard" key={x.id}><b>{x.name}</b><small>{x.center_name||'—'}</small><em>{x.teacher_name||'لم يحدد المعلم'}</em></article>)}</div></section>}
        {publicView==='الأخبار والفعاليات'&&<section className="report1447 publicReportPage"><div className="innerHero reportPageHero"><span className="sectionLabel">أخبار الحلقات</span><h1>برامج وفعاليات تصنع الأثر</h1><p>نماذج من البرامج المصاحبة والفعاليات الموثقة في تقرير حلقات عاشور بخاري لعام 1447هـ.</p></div><div className="reportCards publicCards">{report1447.news.map(([t,b])=><article key={t}><div><span className="sectionLabel">خبر وفعالية</span><h3>{t}</h3><p>{b}</p></div></article>)}</div>{publicData.news?.length>0&&<><div className="sectionHead reportSubhead"><div><span>آخر المستجدات</span><h2>أخبار منشورة من إدارة المنصة</h2></div></div><div className="reportCards publicCards">{publicData.news.map((n:any)=><article key={n.id}><div><span className="sectionLabel">{n.kind==='achievement'?'إنجاز':n.kind==='event'?'فعالية':'خبر'}</span><h3>{n.title}</h3><p>{n.body}</p></div></article>)}</div></>}</section>}
        {publicView==='الإنجازات'&&<section className="report1447 publicReportPage"><div className="innerHero reportPageHero"><span className="sectionLabel">إنجازات 1447هـ</span><h1>طلاب الحلقات في ميادين التميز</h1><p>نماذج من الإنجازات العالمية والدولية والمحلية الواردة في التقرير السنوي.</p></div><div className="reportCards achievements publicCards">{report1447.achievements.map(([t,b])=><article key={t}><div><span className="sectionLabel">إنجاز</span><h3>{t}</h3><p>{b}</p></div></article>)}</div><div className="reportStats">{report1447.stats.map(([n,l])=><article key={l}><b>{n}</b><span>{l}</span></article>)}</div></section>}{publicView==='المعلمون'&&<section className="simplePage richSimplePage"><span className="sectionLabel">المعلمون</span><h1>معلمون يصنعون أثرًا قرآنيًا</h1><p>يقوم المعلم بإدارة الحلقة ومتابعة الحفظ والمراجعة والتسميع والحضور ضمن مسار تعليمي واضح.</p></section>}{publicView==='الطلاب'&&<section className="simplePage richSimplePage"><span className="sectionLabel">الطلاب</span><h1>رحلة الطالب مع كتاب الله</h1><p>تبدأ بالتهيئة وتحديد المستوى، ثم التعلم والتثبيت والقياس والمتابعة المستمرة.</p></section>}{publicView==='الوسائط'&&<section className="report1447 publicReportPage"><div className="innerHero reportPageHero"><span className="sectionLabel">الوسائط</span><h1>من ذاكرة الحلقات</h1><p>سيعرض هذا القسم الصور الموثقة للمسارات والبرامج والإنجازات بعد استكمال نقل ملفات الوسائط الأصلية.</p></div><div className="reportStats">{report1447.stats.map(([n,l])=><article key={l}><b>{n}</b><span>{l}</span></article>)}</div></section>}{publicView==='تواصل معنا'&&<section className="simplePage richSimplePage"><span className="sectionLabel">تواصل معنا</span><h1>حلقات عاشور بخاري</h1><p>للتواصل والاستفسارات المتعلقة بالحلقات والبرامج، يتم تحديث بيانات التواصل من إدارة المنصة.</p></section>}
        <section className="section">
          <div className="sectionHead"><div><span>بوابة الإدارة</span><h2>الدخول إلى المنصة</h2></div></div>
          <div className="panel" style={{maxWidth:560,margin:'0 auto'}}>
            <div className="headerActions" style={{justifyContent:'center',marginBottom:18}}>
              <button type="button" className={authMode==='account'?'primary':'secondary'} onClick={()=>{setAuthMode('account');setError('')}}>البريد وكلمة المرور</button>
              <button type="button" className={authMode==='legacy'?'primary':'secondary'} onClick={()=>{setAuthMode('legacy');setError('')}}>رمز المدير</button>
            </div>
            {authMode==='account'?<form onSubmit={handleAccountLogin}>
              {authIntent==='signup'&&<label className="field"><span>الاسم</span><input value={accountForm.name} onChange={e=>setAccountForm(x=>({...x,name:e.target.value}))} autoComplete="name" /></label>}
              <label className="field"><span>البريد الإلكتروني</span><input type="email" required value={accountForm.email} onChange={e=>setAccountForm(x=>({...x,email:e.target.value}))} autoComplete="email" /></label>
              <label className="field"><span>كلمة المرور</span><input type="password" required minLength={8} value={accountForm.password} onChange={e=>setAccountForm(x=>({...x,password:e.target.value}))} autoComplete={authIntent==='signup'?'new-password':'current-password'} /></label>
              <button className="primary" type="submit">{authIntent==='signup'?'إنشاء حساب':'تسجيل الدخول'}</button>
              <button className="secondary" type="button" style={{marginTop:10}} onClick={()=>{setAuthIntent(x=>x==='signin'?'signup':'signin');setError('')}}>{authIntent==='signin'?'إنشاء حساب جديد':'لدي حساب بالفعل'}</button>
              <small style={{display:'block',marginTop:12}}>الحسابات الجديدة تحتاج إلى اعتماد وربط من إدارة المنصة قبل إتاحة الصلاحيات.</small>
            </form>:<form onSubmit={handleLogin}>
              <label className="field"><span>رمز دخول مدير النظام</span><input type="password" value={enteredCode} onChange={e=>setEnteredCode(e.target.value)} placeholder="أدخل رمز الدخول" autoFocus /></label>
              <button className="primary" type="submit">دخول</button>
              <small style={{display:'block',marginTop:12}}>يبقى هذا المسار متاحًا مؤقتًا أثناء نقل الحسابات إلى Neon Auth.</small>
            </form>}
            {error&&<div className="notice">{error}</div>}
          </div>
        </section>
      </> :
      <div className="workspace">
        <aside>
          <div className="user"><span><img src="/resources/logo-halaqat-ashour-bukhari.png" alt="" /></span><div><b>مدير النظام</b><small>حلقات عاشور بخاري</small></div></div>
          <button className={activeTab==='overview'?'selected':''} onClick={()=>setActiveTab('overview')}>نظرة عامة</button>
          <button className={activeTab==='centers'?'selected':''} onClick={()=>setActiveTab('centers')}>المراكز والفروع</button>
          <button className={activeTab==='students'?'selected':''} onClick={()=>setActiveTab('students')}>الطلاب</button>
          <button className={activeTab==='circles'?'selected':''} onClick={()=>setActiveTab('circles')}>الحلقات</button>
          <button className={activeTab==='users'?'selected':''} onClick={()=>setActiveTab('users')}>المستخدمون</button>
          <button className={activeTab==='roles'?'selected':''} onClick={()=>setActiveTab('roles')}>الأدوار والصلاحيات</button>
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
            <div className="panelHead"><h2>{activeTab==='overview'?'مؤشرات التشغيل':'السجلات'}</h2>{activeTab!=='overview'&&activeTab!=='roles'&&<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="بحث..." />}</div>
            {loadState==='loading'&&<div className="emptyState">جارٍ تحميل البيانات...</div>}
            {loadState!=='loading'&&activeTab==='overview'&&<div className="featureGrid"><article><b>الحضور والانصراف</b><p>{summary?.attendance??0} سجل</p></article><article><b>التسميع والمراجعة</b><p>{summary?.memorization??0} سجل</p></article><article><b>الخطط الأسبوعية</b><p>{summary?.plans??0} خطة</p></article></div>}
            {loadState!=='loading'&&activeTab==='centers'&&<><form className="quickForm" onSubmit={e=>submitForm('/api/centers',e)}><label className="field"><span>اسم المركز</span><input name="name" required /></label><label className="field"><span>الموقع</span><input name="location" /></label><label className="field"><span>مدير المركز</span><select name="manager_user_id" defaultValue=""><option value="">بدون مدير محدد</option>{users.filter(u=>u.role==='center_manager'||u.role==='system_admin').map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}</select></label><button className="primary" type="submit">إضافة المركز</button></form><GenericTable rows={centers} columns={[[ 'name','المركز'],['location','الموقع'],['manager_name','المدير'],['circles_count','عدد الحلقات']]}/></>}
            {loadState!=='loading'&&activeTab==='students'&&<><form className="quickForm" onSubmit={e=>submitForm('/api/students',e)}><label className="field"><span>اسم الطالب</span><input name="full_name" required /></label><label className="field"><span>الحلقة</span><select name="circle_id" defaultValue=""><option value="">بدون حلقة</option>{circles.map((x:any)=><option key={x.id} value={x.id}>{x.name} — {x.center_name||''}</option>)}</select></label><label className="field"><span>الصف/المرحلة</span><input name="grade_level" /></label><button className="primary" type="submit">إضافة الطالب</button></form><StudentsTable rows={filteredStudents} circles={circles} onChanged={loadDashboard}/></>}
            {loadState!=='loading'&&activeTab==='circles'&&<><form className="quickForm" onSubmit={e=>submitForm('/api/circles',e)}><label className="field"><span>اسم الحلقة</span><input name="name" required /></label><label className="field"><span>المركز</span><select name="center_id" required defaultValue=""><option value="" disabled>اختر المركز</option>{centers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label className="field"><span>المعلم</span><select name="teacher_user_id" defaultValue=""><option value="">غير معين</option>{users.filter(u=>u.role==='teacher'&&u.is_active).map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}</select></label><label className="field"><span>المسار الرئيس</span><select name="student_track" defaultValue="الطلاب من أهل مكة"><option>الطلاب من أهل مكة</option><option>الطلاب الوافدون</option></select></label><label className="field"><span>المسار القرآني</span><select name="quran_track" defaultValue="مسار حفظ القرآن للشباب"><option>مسار التهجي والتلقين</option><option>مسار حفظ القرآن للأشبال</option><option>مسار حفظ القرآن للشباب</option><option>مسار حفظ القرآن والمتون</option><option>مسار القراءات</option></select></label><label className="field"><span>الموعد</span><input name="schedule" /></label><button className="primary" type="submit">إضافة الحلقة</button></form><CirclesTable rows={filteredCircles} users={users} onChanged={loadDashboard}/></>}
            {loadState!=='loading'&&activeTab==='users'&&<><form className="quickForm" onSubmit={e=>submitForm('/api/users',e)}><label className="field"><span>الاسم</span><input name="full_name" required /></label><label className="field"><span>البريد</span><input name="email" type="email" /></label><label className="field"><span>الجوال</span><input name="phone" /></label><label className="field"><span>الدور</span><select name="role" required defaultValue="teacher"><option value="center_manager">مدير مركز</option><option value="supervisor">مشرف</option><option value="teacher">معلم</option><option value="student">طالب</option><option value="guardian">ولي أمر</option></select></label><label className="field"><span>المركز</span><select name="center_id" defaultValue=""><option value="">بدون مركز</option>{centers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><button className="primary" type="submit">إضافة المستخدم</button></form><UsersTable rows={filteredUsers} centers={centers} onChanged={loadDashboard}/><LoginRequestsPanel rows={loginRequests} users={users} onChanged={loadDashboard}/></>}
            {loadState!=='loading'&&activeTab==='roles'&&<RolesPanel data={roleData} onChanged={loadDashboard}/>}
            {loadState!=='loading'&&activeTab==='attendance'&&<><form className="quickForm" onSubmit={e=>submitForm('/api/attendance',e)}><label className="field"><span>الطالب</span><select name="student_id" required defaultValue=""><option value="" disabled>اختر الطالب</option>{students.map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></label><label className="field"><span>التاريخ</span><input name="attendance_date" type="date" required defaultValue={new Date().toISOString().slice(0,10)} /></label><label className="field"><span>الحالة</span><select name="status" defaultValue="present"><option value="present">حاضر</option><option value="late">متأخر</option><option value="absent">غائب</option><option value="excused">مستأذن</option></select></label><label className="field"><span>دقائق التأخر</span><input name="late_minutes" type="number" min="0" defaultValue="0" /></label><button className="primary" type="submit">حفظ الحضور</button></form><GenericTable rows={attendance} columns={[[ 'full_name','الطالب'],['circle_name','الحلقة'],['attendance_date','التاريخ'],['status','الحالة'],['late_minutes','دقائق التأخر']]}/></>}
            {loadState!=='loading'&&activeTab==='memorization'&&<><form className="quickForm" onSubmit={e=>submitForm('/api/memorization',e)}><label className="field"><span>الطالب</span><select name="student_id" required defaultValue=""><option value="" disabled>اختر الطالب</option>{students.map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></label><label className="field"><span>النوع</span><select name="record_type" defaultValue="new"><option value="new">جديد</option><option value="review">مراجعة</option><option value="recitation">تسميع</option></select></label><label className="field"><span>رقم السورة</span><input name="surah_no" type="number" min="1" max="114" required /></label><label className="field"><span>من آية</span><input name="from_ayah" type="number" min="1" required /></label><label className="field"><span>إلى آية</span><input name="to_ayah" type="number" min="1" required /></label><label className="field"><span>الدرجة</span><input name="grade" type="number" min="0" max="100" step="0.5" /></label><button className="primary" type="submit">حفظ التسميع</button></form><GenericTable rows={memorization} columns={[[ 'full_name','الطالب'],['record_date','التاريخ'],['record_type','النوع'],['surah_no','السورة'],['from_ayah','من آية'],['to_ayah','إلى آية'],['grade','الدرجة']]}/></>}
            {loadState!=='loading'&&activeTab==='plans'&&<GenericTable rows={plans} columns={[[ 'full_name','الطالب'],['week_start','الأسبوع'],['day_name','اليوم'],['new_target','الجديد'],['review_target','المراجعة'],['goals','الأهداف']]}/>}
            {loadState!=='loading'&&activeTab==='news'&&<><form className="quickForm" onSubmit={e=>submitForm('/api/news',e)}><label className="field"><span>العنوان</span><input name="title" required /></label><label className="field"><span>النوع</span><select name="kind" defaultValue="news"><option value="news">خبر</option><option value="event">فعالية</option><option value="achievement">إنجاز</option><option value="media">وسائط</option></select></label><label className="field"><span>المحتوى</span><textarea name="body" rows={3}></textarea></label><label className="field"><span>الحالة</span><select name="status" defaultValue="published"><option value="published">منشور</option><option value="draft">مسودة</option></select></label><button className="primary" type="submit">حفظ الخبر</button></form><GenericTable rows={news} columns={[[ 'title','العنوان'],['kind','النوع'],['event_date','التاريخ'],['status','الحالة']]}/></>}
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

function StudentsTable({ rows, circles, onChanged }: { rows: StudentRow[]; circles: CircleRow[]; onChanged:()=>Promise<void> }) {
  if (!rows.length) return <div className="empty">لا توجد بيانات طلاب مطابقة.</div>;
  async function updateStudent(id:string,body:any){await apiPut('/api/students',{id,...body});await onChanged();}
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>الاسم</th><th>البريد</th><th>الحلقة</th><th>المركز</th><th>الحالة</th><th>النقاط</th></tr></thead>
        <tbody>{rows.map(row=><tr key={row.id}>
          <td>{row.full_name}</td><td>{row.email||'—'}</td>
          <td><select aria-label={`حلقة ${row.full_name}`} value={row.circle_id||''} onChange={e=>updateStudent(row.id,{circle_id:e.target.value||null,center_id:e.target.value?undefined:null})}><option value="">غير مسند</option>{circles.map(c=><option key={c.id} value={c.id}>{c.name} — {c.center_name||''}</option>)}</select></td>
          <td>{row.center_name||'غير مسند'}</td>
          <td><select aria-label={`حالة ${row.full_name}`} value={row.status||'active'} onChange={e=>updateStudent(row.id,{status:e.target.value})}><option value="active">نشط</option><option value="excused">مستأذن</option><option value="suspended">موقوف</option></select></td>
          <td>{row.points_balance??0}</td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}

function CirclesTable({ rows, users, onChanged }: { rows: CircleRow[]; users: UserRow[]; onChanged:()=>Promise<void> }) {
  if (!rows.length) return <div className="empty">لا توجد حلقات مطابقة.</div>;
  async function updateCircle(id:string,body:any){await apiPut('/api/circles',{id,...body});await onChanged();}
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>الحلقة</th><th>المركز</th><th>المعلم</th><th>المسار الرئيس</th><th>المسار القرآني</th><th>عدد الطلاب</th></tr></thead>
        <tbody>{rows.map(row=><tr key={row.id}>
          <td>{row.name}</td><td>{row.center_name||'—'}</td>
          <td><select aria-label={`معلم ${row.name}`} value={row.teacher_user_id||''} onChange={e=>updateCircle(row.id,{teacher_user_id:e.target.value||null})}><option value="">غير معين</option>{users.filter(u=>u.role==='teacher'&&u.is_active).map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}</select></td>
          <td><select aria-label={`مسار رئيس ${row.name}`} value={row.student_track||''} onChange={e=>updateCircle(row.id,{student_track:e.target.value||null})}><option value="">غير مصنف</option><option>الطلاب من أهل مكة</option><option>الطلاب الوافدون</option></select></td>
          <td><select aria-label={`مسار قرآني ${row.name}`} value={row.quran_track||''} onChange={e=>updateCircle(row.id,{quran_track:e.target.value||null})}><option value="">غير مصنف</option><option>مسار التهجي والتلقين</option><option>مسار حفظ القرآن للأشبال</option><option>مسار حفظ القرآن للشباب</option><option>مسار حفظ القرآن والمتون</option><option>مسار القراءات</option></select></td>
          <td>{row.students_count}</td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}

function UsersTable({ rows, centers, onChanged }: { rows: UserRow[]; centers: CenterRow[]; onChanged:()=>Promise<void> }) {
  if (!rows.length) return <div className="empty">لا توجد حسابات مطابقة.</div>;
  async function updateUser(id:string,body:any){await apiPut('/api/users',{id,...body});await onChanged();}
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>المركز</th><th>الحالة</th><th>ربط الهوية</th></tr></thead>
        <tbody>{rows.map(row=><tr key={row.id}>
          <td>{row.full_name}</td><td>{row.email||'—'}</td>
          <td><select aria-label={`دور ${row.full_name}`} value={row.role} disabled={row.role==='system_admin'} onChange={e=>updateUser(row.id,{role:e.target.value})}><option value="system_admin">مدير النظام</option><option value="center_manager">مدير مركز</option><option value="supervisor">مشرف</option><option value="teacher">معلم</option><option value="student">طالب</option><option value="guardian">ولي أمر</option></select></td>
          <td><select aria-label={`مركز ${row.full_name}`} value={row.center_id||''} onChange={e=>updateUser(row.id,{center_id:e.target.value||null})}><option value="">بدون مركز</option>{centers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></td>
          <td><select aria-label={`حالة ${row.full_name}`} value={row.is_active?'active':'inactive'} disabled={row.role==='system_admin'} onChange={e=>updateUser(row.id,{is_active:e.target.value==='active'})}><option value="active">نشط</option><option value="inactive">غير نشط</option></select></td>
          <td>{row.linked?'مرتبط':'بانتظار ربط الدخول'}</td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}

function LoginRequestsPanel({rows,users,onChanged}:{rows:any[];users:UserRow[];onChanged:()=>Promise<void>}){
  const [targets,setTargets]=useState<Record<string,string>>({});
  if(!rows.length) return <section className="panel" style={{marginTop:18}}><h3>طلبات ربط الدخول</h3><div className="empty">لا توجد طلبات اعتماد معلقة.</div></section>;
  async function approve(row:any){
    const matched=users.find(u=>(u.email||'').toLowerCase()===String(row.email||'').toLowerCase());
    const target=targets[row.id]||matched?.id||'';
    if(!target){alert('اختر حساب المنصة الذي تريد ربطه بهذا الدخول.');return;}
    try{
      await apiPut('/api/users',{id:target,auth_subject:row.auth_subject,request_id:row.id});
      await onChanged();
    }catch(err){alert(err instanceof Error?err.message:'تعذر اعتماد الربط');}
  }
  return <section className="panel" style={{marginTop:18}}>
    <div className="panelHead"><div><h3>طلبات ربط الدخول</h3><small>لا يتم منح أي صلاحية قبل اعتماد الربط يدويًا.</small></div><b>{rows.length}</b></div>
    <div className="table-wrap"><table><thead><tr><th>الاسم</th><th>البريد</th><th>تاريخ الطلب</th><th>ربط بحساب المنصة</th><th>الإجراء</th></tr></thead><tbody>
      {rows.map(row=>{const matched=users.find(u=>(u.email||'').toLowerCase()===String(row.email||'').toLowerCase());const selected=targets[row.id]||matched?.id||'';return <tr key={row.id}>
        <td>{row.full_name||'—'}</td><td>{row.email}</td><td>{row.requested_at?new Date(row.requested_at).toLocaleString('ar-SA'):'—'}</td>
        <td><select value={selected} onChange={e=>setTargets(x=>({...x,[row.id]:e.target.value}))}><option value="">اختر الحساب</option>{users.map(u=><option key={u.id} value={u.id}>{u.full_name} — {roleLabel[u.role]||u.role}{u.email?` — ${u.email}`:''}</option>)}</select></td>
        <td><button className="primary" type="button" onClick={()=>approve(row)}>اعتماد الربط</button></td>
      </tr>})}
    </tbody></table></div>
  </section>;
}

function RolesPanel({data,onChanged}:{data:any;onChanged:()=>Promise<void>}){
  const [draft,setDraft]=useState<Record<string,string[]>>({});
  useEffect(()=>{const next:Record<string,string[]>={};for(const r of data.roles||[])next[r.code]=[...(r.permissions||[])];setDraft(next)},[data]);
  const permissions=data.permissions||[];
  async function save(role:string){await apiPut('/api/roles',{role_code:role,permissions:draft[role]||[]});await onChanged();}
  function toggle(role:string,code:string,checked:boolean){setDraft(prev=>({...prev,[role]:checked?[...(prev[role]||[]),code]:(prev[role]||[]).filter(x=>x!==code)}))}
  return <div className="rolesMatrix">{(data.roles||[]).map((r:any)=><section className="panel" key={r.code}><div className="panelHead"><div><h2>{r.name}</h2><small>{r.code==='system_admin'?'صلاحيات كاملة ثابتة':'حدد الصلاحيات المتاحة لهذا الدور'}</small></div>{r.code!=='system_admin'&&<button className="primary" onClick={()=>save(r.code)}>حفظ الصلاحيات</button>}</div><div className="featureGrid">{permissions.map((p:any)=><label className="field" key={p.code}><span><input type="checkbox" disabled={r.code==='system_admin'} checked={r.code==='system_admin'||(draft[r.code]||[]).includes(p.code)} onChange={e=>toggle(r.code,p.code,e.target.checked)} /> {p.name}</span><small>{p.category}</small></label>)}</div></section>)}</div>
}
