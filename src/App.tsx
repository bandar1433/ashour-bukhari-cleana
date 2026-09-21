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
  getSessionRole,
  getStatus,
  setAccessCode,
  setSessionToken,
  StudentRow,
  Summary,
  UserRow,
} from './lib/api';
import { authClient } from './lib/auth';

type Tab = 'overview' | 'centers' | 'students' | 'circles' | 'users' | 'roles' | 'attendance' | 'memorization' | 'plans' | 'news' | 'teacherToday' | 'circleRegister' | 'evaluations' | 'studentProfile';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';
const report1447={stats:[['447','طالبًا'],['18','معلمًا'],['17','مساعدًا'],['16','حلقة'],['61','جنسية']],news:[['رحلة المدينة المنورة','رحلة إيمانية علمية تربوية لنحو 50 طالبًا من طلاب الحلقات خلال إجازة الصيف.'],['إفطار صائم','لقاء إيماني واجتماعي يجمع طلاب الحلقات ويعزز الأخوة والتواصل.'],['البرنامج الترويحي','أنشطة تربوية واجتماعية مصاحبة تعزز الألفة بين طلاب الحلقات.'],['مجالس ختم القرآن والقراءات','مجالس دورية لختم كتاب الله وإتمام القراءات وربط الطلاب بالقرآن تلاوةً وإتقانًا.'],['برنامج المعايدة','برنامج اجتماعي قرآني يجمع الأساتذة والطلاب والخريجين ويعزز الأخوة والتواصل.']],achievements:[['إنجاز عالمي','تحقيق الطالب أنس الحازمي المركز الثاني على مستوى العالم الإسلامي.'],['المركز الثاني عالميًا','فوز الطالب أحمد كريم بالمركز الثاني في المسابقة العالمية للقرآن الكريم في روسيا.'],['إنجاز دولي','فوز أحمد كريم في مسابقة تنزانيا الدولية لحفظ القرآن الكريم وتلاوته.'],['المركز الأول على مستوى المملكة','فوز الطالب عمر بن محمد أشرف بالمركز الأول في فرع كامل القرآن في مسابقة وزارة التعليم.']]};
const legacyStaticImages:Record<string,string>={
  talqeen:'/resources/report-talqeen.jpg',
  hifz:'/resources/report-hifz.jpg',
  itqan:'/resources/report-itqan.jpg',
  qiraat:'/resources/report-qiraat.jpg',
  nationalities:'/resources/report-nationalities.jpg',
  madinah:'/resources/report-madinah.jpg',
  'madinah-group':'/resources/report-madinah-group.jpg',
  iftar:'/resources/report-iftar.jpg',
  recreation:'/resources/report-recreation.jpg',
  khatm:'/resources/report-khatm.jpg',
  eid:'/resources/report-eid.jpg',
  'achievement-anas':'/resources/report-achievement-anas.jpg',
  'achievement-russia':'/resources/report-achievement-russia.jpg',
  'achievement-tanzania':'/resources/report-achievement-tanzania.jpg',
  'achievement-omar':'/resources/report-achievement-omar.jpg',
  'photo-1':'/resources/report-photo-1.jpg',
  'photo-2':'/resources/report-photo-2.jpg'
};
const fallbackAnnouncements=[
  {id:'madinah',kind:'event',title:'رحلة المدينة المنورة',body:'رحلة إيمانية علمية تربوية لطلاب الحلقات، جمعت الزيارة والتعلم والتربية.',published_at:'1447هـ',imageKey:'madinah'},
  {id:'khatm',kind:'event',title:'مجالس ختم القرآن والقراءات',body:'مجالس دورية لختم كتاب الله وإتمام القراءات وربط الطلاب بالقرآن تلاوةً وإتقانًا.',published_at:'1447هـ',imageKey:'khatm'},
  {id:'achievement-russia',kind:'achievement',title:'إنجاز عالمي لطلاب الحلقات',body:'نماذج مشرّفة من مشاركة طلاب الحلقات في المسابقات القرآنية الدولية.',published_at:'1447هـ',imageKey:'achievement-russia'},
  {id:'iftar',kind:'event',title:'البرامج الإيمانية والاجتماعية',body:'برامج مصاحبة تعزز الأخوة والتواصل والقيم التربوية بين طلاب الحلقات.',published_at:'1447هـ',imageKey:'iftar'}
];
const homeMediaCards=[
  ['talqeen','مسار التلقين والتهجي','تأسيس القراءة الصحيحة والتهيئة للحفظ.'],
  ['hifz','مسار حفظ القرآن','حفظ متدرج مع متابعة ومراجعة منتظمة.'],
  ['itqan','مسار الإتقان','ضبط الحفظ وتحسين التلاوة والأداء.'],
  ['qiraat','مسار القراءات','تأهيل متقدم في القراءات والإتقان.'],
  ['madinah-group','برامج ورحلات تربوية','تجارب إيمانية وتعليمية تصنع الأثر.']
] as const;
function SitePhoto({src,alt,className=''}:{src?:string;alt:string;className?:string}){
  const [failed,setFailed]=useState(false);
  if(!src||failed)return <div className={`sitePhotoPlaceholder ${className}`}><img src="/resources/logo-halaqat-ashour-bukhari.png" alt="" /><span>{alt}</span></div>;
  return <img className={className} src={src} alt={alt} loading="lazy" onError={()=>setFailed(true)} />;
}
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

const tabMeta: Record<Tab, { title: string; subtitle: string; short: string }> = {
  overview: { title: 'نظرة عامة', subtitle: 'ملخص مباشر لأهم مؤشرات المنصة وتشغيل الحلقات.', short: 'الرئيسية' },
  centers: { title: 'المراكز والفروع', subtitle: 'إدارة المراكز وربطها بالمديرين والحلقات.', short: 'المراكز' },
  students: { title: 'الطلاب', subtitle: 'إدارة سجلات الطلاب وإسنادهم إلى الحلقات ومتابعة حالتهم.', short: 'الطلاب' },
  circles: { title: 'الحلقات القرآنية', subtitle: 'تنظيم الحلقات والمعلمين والمسارات التعليمية.', short: 'الحلقات' },
  users: { title: 'الحسابات والدخول', subtitle: 'إدارة المستخدمين واعتماد طلبات ربط الدخول.', short: 'الحسابات' },
  roles: { title: 'الأدوار والصلاحيات', subtitle: 'ضبط الصلاحيات الوظيفية مع بقاء مدير النظام بصلاحية الجذر.', short: 'الصلاحيات' },
  attendance: { title: 'الحضور', subtitle: 'تسجيل الحضور والتأخر والاستئذان والغياب.', short: 'الحضور' },
  memorization: { title: 'التسميع والمراجعة', subtitle: 'توثيق الحفظ الجديد والمراجعة والتقييم.', short: 'القرآن' },
  plans: { title: 'الخطط الأسبوعية', subtitle: 'متابعة أهداف الطلاب وخطط الحفظ والمراجعة.', short: 'الخطط' },
  news: { title: 'الأخبار والفعاليات', subtitle: 'إدارة محتوى الموقع العام والأخبار والإنجازات.', short: 'المحتوى' },
  teacherToday: { title: 'لوحة المعلم اليومية', subtitle: 'مراجعة اكتمال الحضور والحفظ والمراجعة قبل اعتماد اليوم.', short: 'اليوم' },
  circleRegister: { title: 'سجل الحلقة', subtitle: 'كشف شهري موحد للحضور والمراجعة والحفظ والاعتماد.', short: 'السجل' },
  evaluations: { title: 'التقييم والإنجاز', subtitle: 'قياس الإنجاز اليومي وفق الخطة والحضور والمراجعة.', short: 'التقييم' },
  studentProfile: { title: 'ملف الطالب القرآني', subtitle: 'ملف متكامل للحضور والحفظ والمراجعة والخطط والنقاط.', short: 'ملف الطالب' },
};

export default function App() {
  const [code, setCode] = useState(getAccessCode() || (getSessionToken() ? 'session' : ''));
  const [enteredCode, setEnteredCode] = useState(getAccessCode());
  const [authOpen,setAuthOpen]=useState(false);
  const [authBusy,setAuthBusy]=useState(false);
  const [authIntent,setAuthIntent]=useState<'signin'|'signup'>('signin');
  const [accountForm,setAccountForm]=useState({name:'',email:'',password:''});
  const [status, setStatus] = useState<any>(null);
  const [publicData,setPublicData]=useState<any>({stats:{},news:[],circles:[]});
  const [siteImages,setSiteImages]=useState<Record<string,string>>({});
  const [announcementIndex,setAnnouncementIndex]=useState(0);
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
  const [dailyDate,setDailyDate]=useState(new Date().toISOString().slice(0,10));
  const [recordMonth,setRecordMonth]=useState(new Date().toISOString().slice(0,7));
  const [teacherToday,setTeacherToday]=useState<any>({students:[],approvals:[]});
  const [circleRegister,setCircleRegister]=useState<any>({students:[]});
  const [evaluationRange,setEvaluationRange]=useState({from:new Date().toISOString().slice(0,10),to:new Date().toISOString().slice(0,10)});
  const [evaluations,setEvaluations]=useState<any>({rows:[],average:0,weights:{new:30,review:40,attendance:30}});
  const [studentProfile,setStudentProfile]=useState<any>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState<string>('');
  const [query, setQuery] = useState('');
  const currentRole=getAccessCode()?'system_admin':getSessionRole();
  const isRoot=currentRole==='system_admin';
  const isStaff=['system_admin','center_manager','supervisor','teacher'].includes(currentRole);

  useEffect(() => {
    getStatus()
      .then(setStatus)
      .catch((err) => setStatus({ configured: false, database: 'error', error: err.message }));
    fetch('/api/public').then(r=>r.json()).then(x=>{setPublicData(x);setSiteImages({...((x?.images||{}) as Record<string,string>),...legacyStaticImages});}).catch(()=>setSiteImages(legacyStaticImages));
  }, []);

  async function loadDashboard() {
    setLoadState('loading');
    setError('');

    try {
      const role=getAccessCode()?'system_admin':getSessionRole();
      const root=role==='system_admin';
      const staff=['system_admin','center_manager','supervisor','teacher'].includes(role);
      const [summaryData, centersData, studentsData, circlesData, usersData, rolesData, attendanceData, memorizationData, plansData, newsData] = await Promise.all([
        staff?apiGet<Summary>('/api/summary'):Promise.resolve(null),
        staff?apiGet<{ items: CenterRow[] }>('/api/centers'):Promise.resolve({items:[]}),
        staff?apiGet<{ items: StudentRow[] }>('/api/students'):Promise.resolve({items:[]}),
        staff?apiGet<{ items: CircleRow[] }>('/api/circles'):Promise.resolve({items:[]}),
        (root||role==='center_manager')?apiGet<{ items: UserRow[]; requests?: any[] }>('/api/users'):Promise.resolve({items:[],requests:[]}),
        root?apiGet<any>('/api/roles'):Promise.resolve({roles:[],permissions:[]}),
        staff?apiGet<{ items: any[] }>('/api/attendance'):Promise.resolve({items:[]}),
        staff?apiGet<{ items:any[] }>('/api/memorization'):Promise.resolve({items:[]}),
        staff?apiGet<{ items:any[] }>('/api/plans'):Promise.resolve({items:[]}),
        root?apiGet<{ items:any[] }>('/api/news'):Promise.resolve({items:[]}),
      ]);

      setSummary(summaryData as Summary | null);
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
      return;
    }
    finishSocialSession().catch(err=>{
      const message=err instanceof Error?err.message:'تعذر استكمال تسجيل الدخول.';
      setError(message);
      setAuthOpen(true);
    });
  }, [code]);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    const cleaned = enteredCode.trim();
    if (!cleaned) {
      setError('أدخل رمز الدخول الإداري.');
      return;
    }
    setAuthBusy(true);
    setError('');
    clearSessionToken();
    setAccessCode(cleaned);
    try {
      await apiGet<Summary>('/api/summary');
      setCode(cleaned);
      setAuthOpen(false);
    } catch (err) {
      clearAccessCode();
      setCode('');
      setError(err instanceof Error ? err.message : 'رمز الدخول غير صحيح.');
    } finally {
      setAuthBusy(false);
    }
  }

  async function finishSocialSession(){
    let headerJwt='';
    const current:any=await authClient.getSession({
      fetchOptions:{
        credentials:'include',
        headers:{'X-Force-Fetch':'1'},
        onSuccess:(ctx:any)=>{
          headerJwt=ctx?.response?.headers?.get('set-auth-jwt')||'';
        }
      }
    });
    if(current?.error) throw new Error(current.error.message||'تعذر قراءة جلسة Google.');
    const user=current?.data?.user||current?.data?.session?.user;
    if(!current?.data?.session||!user)return false;

    const jwt=headerJwt||current?.data?.session?.token||current?.data?.session?.access_token||'';
    if(!jwt) throw new Error('اكتمل تسجيل Google ولكن تعذر قراءة رمز الجلسة الآمن. أعد المحاولة مرة واحدة.');

    const response=await fetch('/api/status',{
      method:'POST',
      headers:{Accept:'application/json',Authorization:`Bearer ${jwt}`}
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(payload?.message||payload?.error||'تعذر اعتماد جلسة الدخول.');
    if(payload?.pending){setError(payload.message||'الحساب بانتظار اعتماد الإدارة.');setAuthOpen(true);return false;}
    clearAccessCode();
    setSessionToken(payload.token);
    setCode('session');
    setAuthOpen(false);
    setError('');
    return true;
  }

  async function handleGoogleLogin(){
    setAuthBusy(true); setError('');
    try{
      const result:any=await authClient.signIn.social({
        provider:'google',
        callbackURL:'/',
        errorCallbackURL:'/?auth_error=google',
        disableRedirect:true
      });
      if(result?.error){
        const detail=result.error.message||result.error.code||result.error.statusText||'تعذر تسجيل الدخول عبر Google';
        throw new Error(detail);
      }
      const url=result?.data?.url||result?.url;
      if(!url) throw new Error('تعذر بدء تسجيل الدخول عبر Google.');
      window.location.assign(url);
    }catch(err){
      setError(err instanceof Error?err.message:'تعذر تسجيل الدخول عبر Google');
      setAuthBusy(false);
    }
  }

  async function handleAccountLogin(event:React.FormEvent){
    event.preventDefault();
    setAuthBusy(true);
    setError('');
    try{
      const email=accountForm.email.trim();
      const password=accountForm.password;
      if(!email||!password) throw new Error('أدخل البريد الإلكتروني وكلمة المرور.');
      let authResult:any;
      if(authIntent==='signup'){
        const name=accountForm.name.trim();
        if(!name) throw new Error('أدخل الاسم.');
        authResult=await authClient.signUp.email({email,password,name});
        if(authResult?.error) throw new Error(authResult.error.message||'تعذر إنشاء الحساب');
      }else{
        authResult=await authClient.signIn.email({email,password});
        if(authResult?.error) throw new Error(authResult.error.message||'بيانات الدخول غير صحيحة');
      }
      let neonSessionToken=authResult?.data?.token||authResult?.data?.session?.token||'';
      if(!neonSessionToken){
        const current:any=await authClient.getSession();
        neonSessionToken=current?.data?.session?.token||current?.data?.token||'';
      }
      if(!neonSessionToken) throw new Error('تعذر إنشاء جلسة الدخول الآمنة. أعد المحاولة.');
      const response=await fetch('/api/status',{
        method:'POST',
        headers:{Accept:'application/json','x-neon-session-token':String(neonSessionToken)}
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(payload?.message||payload?.error||'تعذر اعتماد جلسة الدخول.');
      clearAccessCode();
      setSessionToken(payload.token);
      setCode('session');
      setAuthOpen(false);
      setAccountForm({name:'',email:'',password:''});
    }catch(err){
      setError(err instanceof Error?err.message:'تعذر تسجيل الدخول');
    }finally{
      setAuthBusy(false);
    }
  }

  function handleLogout() {
    clearAccessCode();
    clearSessionToken();
    authClient.signOut().catch(()=>{});
    setCode('');
    setAuthOpen(false);
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

  async function loadTeacherToday(date=dailyDate){
    try{setError('');const data=await apiGet<any>(`/api/teacher-today?date=${date}`);setTeacherToday(data)}
    catch(err){setError(err instanceof Error?err.message:'تعذر تحميل لوحة اليوم')}
  }
  async function loadCircleRegister(month=recordMonth){
    try{setError('');const data=await apiGet<any>(`/api/circle-register?month=${month}`);setCircleRegister(data)}
    catch(err){setError(err instanceof Error?err.message:'تعذر تحميل سجل الحلقة')}
  }
  async function loadEvaluations(range=evaluationRange){
    try{setError('');const data=await apiGet<any>(`/api/evaluations?from=${range.from}&to=${range.to}`);setEvaluations(data)}
    catch(err){setError(err instanceof Error?err.message:'تعذر تحميل التقييم')}
  }
  async function openStudentProfile(id:string){
    try{setError('');const data=await apiGet<any>(`/api/student-profile?id=${id}?month=${recordMonth}`);setStudentProfile(data);setActiveTab('studentProfile')}
    catch(err){setError(err instanceof Error?err.message:'تعذر تحميل ملف الطالب')}
  }
  async function approveDay(circleId:string){
    try{setError('');await apiPost('/api/day-approvals',{circle_id:circleId,approval_date:dailyDate});await loadTeacherToday(dailyDate)}
    catch(err){setError(err instanceof Error?err.message:'تعذر اعتماد اليوم')}
  }

  useEffect(()=>{
    if(!code)return;
    if(activeTab==='teacherToday')loadTeacherToday();
    if(activeTab==='circleRegister')loadCircleRegister();
    if(activeTab==='evaluations')loadEvaluations();
    if(activeTab==='studentProfile'&&currentRole==='student'&&!studentProfile)openStudentProfile('me');
  },[activeTab]);

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

  const announcements=useMemo(()=>publicData.news?.length?publicData.news:fallbackAnnouncements,[publicData.news]);
  const activeAnnouncement=announcements.length?announcements[announcementIndex%announcements.length]:fallbackAnnouncements[0];
  useEffect(()=>{
    if(publicView!=='الرئيسية'||announcements.length<2)return;
    const timer=window.setInterval(()=>setAnnouncementIndex(i=>(i+1)%announcements.length),6000);
    return()=>window.clearInterval(timer);
  },[publicView,announcements.length]);
  const announcementImage=(item:any)=>item?.image_url||siteImages[item?.imageKey||item?.id]||'';

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
    <main className={code?'adminApp':'publicApp'}>
      {!code&&<header className="header">
        <button className="brand" type="button" onClick={()=>setPublicView('الرئيسية')}>
          <img className="brandLogo" src="/resources/logo-halaqat-ashour-bukhari.png" alt="شعار حلقات عاشور بخاري" />
          <div><b>حلقات عاشور بخاري</b><small>تعليم القرآن الكريم ومتابعة الحلقات</small></div>
        </button>
        <nav aria-label="التنقل الرئيسي">
          {['الرئيسية','عن الحلقات','الحلقات القرآنية','المعلمون','الطلاب','الإنجازات','الأخبار والفعاليات','الوسائط','تواصل معنا'].map(v=><button key={v} className={publicView===v?'active':''} onClick={()=>setPublicView(v)}>{v}</button>)}
        </nav>
        <div className="headerActions"><button className="login" type="button" onClick={()=>{setAuthIntent('signin');setAuthOpen(true);setError('')}}>دخول المنصة</button></div>
      </header>}

      {!code ? <>
        {publicView==='الرئيسية'&&<>
        <section className="topNews reveal reveal-up">
          <div className="topNewsRail">
            <div className="topNewsRailTitle"><span className="newsPulse"></span><b>آخر الأخبار</b></div>
            <span>مستجدات حلقات عاشور بخاري</span>
            <small>{String(announcementIndex%announcements.length+1).padStart(2,'0')} / {String(announcements.length).padStart(2,'0')}</small>
          </div>
          <div className="topNewsMedia">
            <SitePhoto src={announcementImage(activeAnnouncement)} alt={activeAnnouncement?.title||'آخر أخبار الحلقات'} />
          </div>
          <article className="topNewsSlide" key={activeAnnouncement?.id||announcementIndex}>
            <div className="topNewsInfo">
              <span className="newsBadge">{activeAnnouncement?.kind==='achievement'?'إنجاز':activeAnnouncement?.kind==='event'?'فعالية':'خبر'}</span>
              <time>{activeAnnouncement?.published_at?String(activeAnnouncement.published_at).slice(0,10):'حديثًا'}</time>
            </div>
            <h2>{activeAnnouncement?.title}</h2>
            <p>{activeAnnouncement?.body}</p>
          </article>
          <div className="topNewsControls">
            <button className="newsArrow" type="button" aria-label="الخبر السابق" onClick={()=>setAnnouncementIndex(i=>(i-1+announcements.length)%announcements.length)}>→</button>
            <div className="newsDots">{announcements.map((_:any,i:number)=><button type="button" aria-label={`الخبر ${i+1}`} key={i} className={i===announcementIndex%announcements.length?'active':''} onClick={()=>setAnnouncementIndex(i)} />)}</div>
            <button className="newsArrow" type="button" aria-label="الخبر التالي" onClick={()=>setAnnouncementIndex(i=>(i+1)%announcements.length)}>←</button>
            <button type="button" className="allNewsButton" onClick={()=>setPublicView('الأخبار والفعاليات')}>جميع الأخبار <span>←</span></button>
          </div>
        </section>

        <section className="hero legacyHero">
          <div className="heroText">
            <span className="eyebrow reveal reveal-right delay-1">بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيمِ</span>
            <div className="heroKicker reveal reveal-right delay-1">قرآن • تربية • متابعة • أثر</div>
            <h1 className="reveal reveal-right delay-2">حلقات عاشور بخاري</h1>
            <h2 className="reveal reveal-right delay-3">منصة تجمع التعليم والإدارة والمتابعة في مكان واحد</h2>
            <p className="reveal reveal-right delay-4">بيئة رقمية متكاملة لخدمة حلقات القرآن الكريم، وبناء جيل متصل بكتاب الله علمًا وعملًا.</p>
            <div className="heroHighlights reveal reveal-up delay-4"><span>✓ متابعة يومية</span><span>✓ تقارير دقيقة</span><span>✓ صلاحيات آمنة</span></div>
            <div className="actions reveal reveal-up delay-5">
              <button className="primary" type="button" onClick={()=>{setAuthIntent('signin');setAuthOpen(true);setError('')}}>دخول المنصة</button>
              <button className="secondary" type="button" onClick={()=>setPublicView('عن الحلقات')}>تعرف على الحلقات</button>
            </div>
          </div>
          <div className="heroArt reveal reveal-left delay-2">
            <div className="heroLogoCard">
              <img className="heroLogo" src="/resources/logo-halaqat-ashour-bukhari.png" alt="شعار حلقات عاشور بخاري" />
            </div>
          </div>
        </section>

        <section className="stats platformStats">
          {[
            ['01','منصة موحدة','لإدارة التعليم والمتابعة'],
            ['04','مسارات قرآنية','تلقين • حفظ • إتقان • قراءات'],
            ['06','بوابات صلاحيات','لكل مستخدم ما يخصه'],
            ['04','محاور تشغيلية','تعليم • حضور • تقارير • تحفيز']
          ].map(([number,label,detail],index)=><article key={label} className="statCard reveal reveal-up" style={{animationDelay:`${0.18+index*0.11}s`}}><b>{number}</b><span>{label}</span><small>{detail}</small></article>)}
        </section>
        </>}
        {publicView==='عن الحلقات'&&<AboutSections/>}{publicView==='الرئيسية'&&<>
          <AboutSections/>
          <section className="report1447">
            <div className="sectionHead"><div><span>حصاد 1447هـ</span><h2>حلقات تمتد من مكة إلى العالم</h2></div></div>
            <div className="reportStats">{report1447.stats.map(([n,l])=><article key={l}><b>{n}</b><span>{l}</span></article>)}</div>
            <SitePhoto src={siteImages['nationalities']} alt="خريطة جنسيات طلاب حلقات عاشور بخاري" className="reportMap" />
            <div className="sectionHead reportSubhead"><div><span>المسارات</span><h2>تعليم قرآني متدرج</h2></div></div>
            <div className="reportGallery">{[['talqeen','مسار التلقين والتهجي'],['hifz','مسار حفظ القرآن'],['itqan','مسار الإتقان'],['qiraat','مسار القراءات العشر']].map(([key,title])=><SitePhoto key={key} src={siteImages[key]} alt={title} />)}</div>
            <div className="sectionHead reportSubhead"><div><span>أخبار الحلقات</span><h2>برامج مصاحبة تصنع الأثر</h2></div></div>
            <div className="reportCards">{report1447.news.map(([t,b],i)=><article key={t}><SitePhoto src={siteImages[['madinah','iftar','recreation','khatm','eid'][i]]} alt={t} /><div><h3>{t}</h3><p>{b}</p></div></article>)}</div>
            <div className="sectionHead reportSubhead"><div><span>إنجازات عالمية ومتميزة</span><h2>نماذج من حصاد طلاب الحلقات</h2></div></div>
            <div className="reportCards achievements">{report1447.achievements.map(([t,b],i)=><article key={t}><SitePhoto src={siteImages[['achievement-anas','achievement-russia','achievement-tanzania','achievement-omar'][i]]} alt={t} /><div><h3>{t}</h3><p>{b}</p></div></article>)}</div>
          </section>
          <section className="section portalsSection">
            <div className="sectionHead"><div><span>بوابات المنصة</span><h2>كل مستخدم يرى ما يخصه فقط</h2></div></div>
            <div className="roleGrid">{[
              ['ولي الأمر','متابعة الحضور والإنجاز والتقارير'],
              ['الطالب','تعلم ومراجعة وإنجاز'],
              ['المعلم','إدارة الحلقة والطلاب'],
              ['المشرف','متابعة الأداء التعليمي'],
              ['مدير المركز','إدارة المركز والحلقات'],
              ['المدير','إدارة ومتابعة النظام']
            ].map(([title,description],index)=><button className="roleCard reveal reveal-up" style={{animationDelay:`${0.12+index*0.08}s`}} key={title} onClick={()=>{setAuthIntent('signin');setAuthOpen(true);setError('')}}><i>◈</i><b>{title}</b><small>{description}</small><em>دخول البوابة ←</em></button>)}</div>
          </section>
          <section className="featureBand reveal reveal-up">
            <div><span>منظومة واحدة لكل المسيرة</span><h2>من أول تسميع إلى تقرير الأسرة</h2><p>تجمع المنصة الحضور والحفظ والمراجعة والتسميع والنقاط والتقارير في تجربة واحدة؛ لتصبح المعلومة أقرب والقرار أسرع والمتابعة أدق.</p><button className="featureCta" type="button" onClick={()=>{setAuthIntent('signin');setAuthOpen(true);setError('')}}>ابدأ من لوحة المنصة</button></div>
            <div className="featureList">{['تسجيل سريع للحفظ والمراجعة والتسميع','متابعة الحضور والحالة اليومية','نقاط وجوائز تحفّز الاستمرار','تقارير قابلة للطباعة والحفظ','صلاحيات مستقلة للإدارة والمعلم والأسرة'].map(item=><p key={item}>✓ {item}</p>)}</div>
          </section>
        </>}
        {publicView==='الحلقات القرآنية'&&<section className="section"><div className="innerHero"><span className="sectionLabel">الحلقات القرآنية</span><h1>مسارات تعليمية تناسب مراحل الطلاب</h1><p>من التهجي والتلقين إلى الحفظ والإتقان والقراءات.</p></div><div className="roleGrid">{['مسار التهجي والتلقين','مسار حفظ القرآن للأشبال','مسار حفظ القرآن للشباب','مسار حفظ القرآن والمتون','مسار القراءات'].map((x,i)=><article className="roleCard" key={x}><i>◈</i><b>{x}</b><small>{i===0?'تأسيس القراءة والتلقين الصحيح':'حفظ ومراجعة وتسميع وفق خطة متدرجة'}</small></article>)}</div><div className="sectionHead reportSubhead"><div><span>الحلقات المسجلة</span><h2>الحلقات النشطة في المنصة</h2></div></div><div className="roleGrid">{publicData.circles?.map((x:any)=><article className="roleCard" key={x.id}><b>{x.name}</b><small>{x.center_name||'—'}</small><em>{x.teacher_name||'لم يحدد المعلم'}</em></article>)}</div></section>}
        {publicView==='الأخبار والفعاليات'&&<section className="report1447 publicReportPage"><div className="innerHero reportPageHero"><span className="sectionLabel">أخبار الحلقات</span><h1>برامج وفعاليات تصنع الأثر</h1><p>نماذج من البرامج المصاحبة والفعاليات الموثقة في تقرير حلقات عاشور بخاري لعام 1447هـ.</p></div><div className="reportCards publicCards">{report1447.news.map(([t,b],i)=><article key={t}><SitePhoto src={siteImages[['madinah','iftar','recreation','khatm','eid'][i]]} alt={t} /><div><span className="sectionLabel">خبر وفعالية</span><h3>{t}</h3><p>{b}</p></div></article>)}</div>{publicData.news?.length>0&&<><div className="sectionHead reportSubhead"><div><span>آخر المستجدات</span><h2>أخبار منشورة من إدارة المنصة</h2></div></div><div className="reportCards publicCards">{publicData.news.map((n:any)=><article key={n.id}><div><span className="sectionLabel">{n.kind==='achievement'?'إنجاز':n.kind==='event'?'فعالية':'خبر'}</span><h3>{n.title}</h3><p>{n.body}</p></div></article>)}</div></>}</section>}
        {publicView==='الإنجازات'&&<section className="report1447 publicReportPage"><div className="innerHero reportPageHero"><span className="sectionLabel">إنجازات 1447هـ</span><h1>طلاب الحلقات في ميادين التميز</h1><p>نماذج من الإنجازات العالمية والدولية والمحلية الواردة في التقرير السنوي.</p></div><div className="reportCards achievements publicCards">{report1447.achievements.map(([t,b],i)=><article key={t}><SitePhoto src={siteImages[['achievement-anas','achievement-russia','achievement-tanzania','achievement-omar'][i]]} alt={t} /><div><span className="sectionLabel">إنجاز</span><h3>{t}</h3><p>{b}</p></div></article>)}</div><div className="reportStats">{report1447.stats.map(([n,l])=><article key={l}><b>{n}</b><span>{l}</span></article>)}</div></section>}{publicView==='المعلمون'&&<section className="simplePage richSimplePage"><span className="sectionLabel">المعلمون</span><h1>معلمون يصنعون أثرًا قرآنيًا</h1><p>يقوم المعلم بإدارة الحلقة ومتابعة الحفظ والمراجعة والتسميع والحضور ضمن مسار تعليمي واضح.</p></section>}{publicView==='الطلاب'&&<section className="simplePage richSimplePage"><span className="sectionLabel">الطلاب</span><h1>رحلة الطالب مع كتاب الله</h1><p>تبدأ بالتهيئة وتحديد المستوى، ثم التعلم والتثبيت والقياس والمتابعة المستمرة.</p></section>}{publicView==='الوسائط'&&<section className="report1447 publicReportPage"><div className="innerHero reportPageHero"><span className="sectionLabel">الوسائط</span><h1>من ذاكرة الحلقات</h1><p>صور من المسارات القرآنية والبرامج والرحلات والإنجازات.</p></div><div className="mediaGallery">{[['talqeen','مسار التلقين والتهجي'],['hifz','مسار حفظ القرآن'],['itqan','مسار الإتقان'],['qiraat','مسار القراءات'],['madinah','رحلة المدينة'],['madinah-group','طلاب الحلقات في المدينة'],['iftar','إفطار صائم'],['recreation','البرنامج الترويحي'],['khatm','مجالس الختم'],['eid','برنامج المعايدة'],['nationalities','جنسيات طلاب الحلقات'],['photo-1','من أنشطة الحلقات'],['photo-2','من أنشطة الحلقات']].map(([key,title])=><figure key={key}><SitePhoto src={siteImages[key]} alt={title} /><figcaption>{title}</figcaption></figure>)}</div></section>}{publicView==='تواصل معنا'&&<section className="simplePage richSimplePage"><span className="sectionLabel">تواصل معنا</span><h1>حلقات عاشور بخاري</h1><p>للتواصل والاستفسارات المتعلقة بالحلقات والبرامج، يتم تحديث بيانات التواصل من إدارة المنصة.</p></section>}
        {authOpen&&<div className="authOverlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!authBusy)setAuthOpen(false)}}>
          <section className="authDialog authDialogPro" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <button className="authClose" type="button" aria-label="إغلاق نافذة الدخول" onClick={()=>{if(!authBusy){setAuthOpen(false);setError('')}}}>×</button>
            <div className="authBrandPanel">
              <div className="authBrandMark"><img src="/resources/logo-halaqat-ashour-bukhari.png" alt="شعار حلقات عاشور بخاري" /></div>
              <div>
                <span className="authKicker">منصة الإدارة التعليمية</span>
                <h2>حلقات عاشور بخاري</h2>
                <p>منصة موحدة لإدارة الحلقات ومتابعة الحضور والحفظ والمراجعة والتقارير.</p>
              </div>
              <div className="authTrust">
                <span><b>01</b> حساب واحد</span>
                <span><b>02</b> صلاحيات حسب الدور</span>
                <span><b>03</b> بيانات محفوظة وآمنة</span>
              </div>
            </div>
            <div className="authDialogBody">
              <div className="authHeading">
                <span className="authEyebrow">{authIntent==='signin'?'تسجيل الدخول':'تفعيل حساب الدخول'}</span>
                <h2 id="auth-title">{authIntent==='signin'?'مرحبًا بعودتك':'تفعيل الدخول لأول مرة'}</h2>
                <p className="authLead">استخدم حساب Google الخاص بك، كما في المنصة السابقة. إذا كان الحساب جديدًا فسيظهر للإدارة لاعتماده وربطه بالدور المناسب.</p>
              </div>
              <div className="authForm authFormPro">
                {error&&<div className="authNotice" role="alert">{error}</div>}
                <button className="primary authSubmit googleLogin" type="button" onClick={handleGoogleLogin} disabled={authBusy}>{authBusy?'جارٍ التحويل…':'الدخول باستخدام Google'}</button>
              </div>
              <div className="authAlternate"><span>استخدم حساب Google المعتمد لديك للدخول إلى المنصة.</span></div>
              <div className="authSecurityNote">لا تُمنح أي صلاحية لحساب جديد قبل اعتماد الإدارة وربطه بالسجل الصحيح.</div>
              {new URLSearchParams(window.location.search).get('admin')==='1'&&<div className="legacyAccessPro">
                <div><b>دخول مدير النظام</b><span>مسار احتياطي مؤقت خلال مرحلة نقل الحسابات.</span></div>
                <form className="authForm legacyForm" onSubmit={handleLogin}>
                  <label className="field"><span>رمز الإدارة</span><input type="password" value={enteredCode} onChange={e=>setEnteredCode(e.target.value)} placeholder="رمز مدير النظام" /></label>
                  <button className="secondary" type="submit" disabled={authBusy}>{authBusy?'جارٍ التحقق…':'دخول الإدارة'}</button>
                </form>
              </div>}
            </div>
          </section>
        </div>}
      </> :
      <div className="workspace workspacePro">
        <aside className="adminSidebar">
          <div className="sidebarBrand">
            <div className="sidebarLogo"><img src="/resources/logo-halaqat-ashour-bukhari.png" alt="" /></div>
            <div><b>حلقات عاشور بخاري</b><small>منصة الإدارة التعليمية</small></div>
          </div>
          <div className="sidebarSectionLabel">الإدارة</div>
          <button className={activeTab==='overview'?'selected':''} onClick={()=>setActiveTab('overview')}><span className="navDot">⌂</span>نظرة عامة</button>
          <button className={activeTab==='centers'?'selected':''} onClick={()=>setActiveTab('centers')}><span className="navDot">◇</span>المراكز والفروع</button>
          <button className={activeTab==='circles'?'selected':''} onClick={()=>setActiveTab('circles')}><span className="navDot">◫</span>الحلقات القرآنية</button>
          <div className="sidebarSectionLabel">التعليم والمتابعة</div>
          <button className={activeTab==='students'?'selected':''} onClick={()=>setActiveTab('students')}><span className="navDot">◉</span>الطلاب</button>
          <button className={activeTab==='attendance'?'selected':''} onClick={()=>setActiveTab('attendance')}><span className="navDot">✓</span>الحضور</button>
          <button className={activeTab==='memorization'?'selected':''} onClick={()=>setActiveTab('memorization')}><span className="navDot">◌</span>التسميع والمراجعة</button>
          <button className={activeTab==='plans'?'selected':''} onClick={()=>setActiveTab('plans')}><span className="navDot">▤</span>الخطط الأسبوعية</button>
          {isStaff&&<button className={activeTab==='teacherToday'?'selected':''} onClick={()=>setActiveTab('teacherToday')}><span className="navDot">◈</span>لوحة المعلم اليومية</button>}
          {isStaff&&<button className={activeTab==='circleRegister'?'selected':''} onClick={()=>setActiveTab('circleRegister')}><span className="navDot">▦</span>سجل الحلقة</button>}
          <button className={activeTab==='evaluations'?'selected':''} onClick={()=>setActiveTab('evaluations')}><span className="navDot">◎</span>التقييم والإنجاز</button>
          <button className={activeTab==='studentProfile'?'selected':''} onClick={()=>setActiveTab('studentProfile')}><span className="navDot">◇</span>ملف الطالب القرآني</button>
          <div className="sidebarSectionLabel">النظام والمحتوى</div>
          {isRoot&&<button className={activeTab==='users'?'selected':''} onClick={()=>setActiveTab('users')}><span className="navDot">◎</span>الحسابات والدخول</button>}
          {isRoot&&<button className={activeTab==='roles'?'selected':''} onClick={()=>setActiveTab('roles')}><span className="navDot">⚙</span>الأدوار والصلاحيات</button>}
          {isRoot&&<button className={activeTab==='news'?'selected':''} onClick={()=>setActiveTab('news')}><span className="navDot">▧</span>الأخبار والفعاليات</button>}
          <div className="sidebarAccount"><span className="onlineDot"></span><div><b>{roleLabel[currentRole]||'مستخدم'}</b><small>جلسة دخول نشطة</small></div><button className="exit" onClick={handleLogout}>خروج</button></div>
        </aside>
        <section className="dashboardContent">
          <div className="adminTopbar">
            <div className="crumb"><span className="crumbPath">لوحة التحكم / {tabMeta[activeTab].short}</span><h1>{tabMeta[activeTab].title}</h1><p>{tabMeta[activeTab].subtitle}</p></div>
            <div className="adminTopActions"><button className="refreshButton" onClick={loadDashboard} disabled={loadState==='loading'}>{loadState==='loading'?'جارٍ التحديث…':'تحديث البيانات'}</button></div>
          </div>
          {error&&<div className="notice">{error}</div>}
          {activeTab==='overview'&&<div className="kpis"><article><span>الطلاب</span><b>{summary?.students??'—'}</b><small>طالب مسجل</small></article><article><span>المعلمون</span><b>{summary?.teachers??'—'}</b><small>معلم في النظام</small></article><article><span>الحلقات</span><b>{summary?.circles??'—'}</b><small>حلقة قرآنية</small></article><article><span>المراكز</span><b>{summary?.centers??'—'}</b><small>مركز وفرع</small></article></div>}
          <div className="panel mainPanel">
            <div className="panelHead"><div><span className="panelEyebrow">إدارة البيانات</span><h2>{tabMeta[activeTab].title}</h2></div>{!['overview','roles','teacherToday','circleRegister','evaluations','studentProfile'].includes(activeTab)&&<div className="searchBox"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="بحث في السجلات..." /></div>}</div>
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
            {activeTab==='teacherToday'&&<>
              <div className="opsToolbar"><label className="field"><span>التاريخ</span><input type="date" value={dailyDate} onChange={e=>{setDailyDate(e.target.value);loadTeacherToday(e.target.value)}} /></label><button className="secondary" type="button" onClick={()=>loadTeacherToday()}>تحديث اليوم</button></div>
              <div className="kpis compactOpsKpis"><article><span>طلاب اليوم</span><b>{teacherToday.students?.length||0}</b><small>ضمن نطاق الحساب</small></article><article><span>الحضور المسجل</span><b>{(teacherToday.students||[]).filter((x:any)=>x.attendance_status).length}</b><small>سجل حضور</small></article><article><span>حفظ جديد</span><b>{(teacherToday.students||[]).reduce((n:number,x:any)=>n+Number(x.new_records||0),0)}</b><small>سجل</small></article><article><span>المراجعة</span><b>{(teacherToday.students||[]).reduce((n:number,x:any)=>n+Number(x.review_records||0),0)}</b><small>سجل</small></article></div>
              <div className="dailyApprovalGrid">{Array.from(new Map((teacherToday.students||[]).map((x:any)=>[x.circle_id,{id:x.circle_id,name:x.circle_name}])).values()).map((c:any)=>{const done=(teacherToday.approvals||[]).some((a:any)=>a.circle_id===c.id);return <article key={c.id}><div><b>{c.name}</b><small>{done?'تم اعتماد سجل اليوم':'بانتظار اعتماد اليوم'}</small></div><button className={done?'approvedDay':'primary'} disabled={done} onClick={()=>approveDay(c.id)}>{done?'معتمد ✓':'اعتماد اليوم'}</button></article>})}</div>
              <div className="table-wrap"><table><thead><tr><th>الطالب</th><th>الحلقة</th><th>الحضور</th><th>حفظ جديد</th><th>مراجعة</th><th>متوسط الأداء</th><th>الملف</th></tr></thead><tbody>{(teacherToday.students||[]).map((r:any)=><tr key={r.id}><td>{r.full_name}</td><td>{r.circle_name}</td><td>{r.attendance_status||'لم يسجل'}</td><td>{r.new_records}</td><td>{r.review_records}</td><td>{r.grade||0}%</td><td><button className="tableAction" onClick={()=>openStudentProfile(r.id)}>فتح</button></td></tr>)}</tbody></table></div>
            </>}
            {activeTab==='circleRegister'&&<>
              <div className="opsToolbar"><label className="field"><span>الشهر</span><input type="month" value={recordMonth} onChange={e=>{setRecordMonth(e.target.value);loadCircleRegister(e.target.value)}} /></label><button className="secondary" type="button" onClick={()=>loadCircleRegister()}>تحديث السجل</button></div>
              <div className="registerCards">{(circleRegister.students||[]).map((s:any)=>{const days=s.days||[];const attended=days.filter((d:any)=>d.status==='present'||d.status==='late').length;const approved=days.filter((d:any)=>d.approved).length;return <article key={s.id}><div><span>{s.circle_name}</span><h3>{s.full_name}</h3></div><div className="registerMetrics"><span><b>{days.length}</b> أيام مسجلة</span><span><b>{attended}</b> حضور</span><span><b>{approved}</b> أيام معتمدة</span></div><button className="secondary" onClick={()=>openStudentProfile(s.id)}>فتح ملف الطالب</button></article>})}</div>
            </>}
            {activeTab==='evaluations'&&<>
              <div className="opsToolbar"><label className="field"><span>من</span><input type="date" value={evaluationRange.from} onChange={e=>setEvaluationRange(x=>({...x,from:e.target.value}))} /></label><label className="field"><span>إلى</span><input type="date" value={evaluationRange.to} onChange={e=>setEvaluationRange(x=>({...x,to:e.target.value}))} /></label><button className="primary" type="button" onClick={()=>loadEvaluations()}>حساب التقييم</button></div>
              <div className="evaluationSummary"><div><span>المتوسط العام</span><b>{evaluations.average||0}%</b></div><p><strong>المعادلة:</strong> الحفظ الجديد 30% • المراجعة 40% • الحضور والانضباط 30%</p></div>
              <GenericTable rows={evaluations.rows||[]} columns={[[ 'full_name','الطالب'],['day','التاريخ'],['new_grade','الحفظ %'],['review_grade','المراجعة %'],['attendance_score','الانضباط'],['daily_score','النتيجة']]}/>
            </>}
            {activeTab==='studentProfile'&&<>
              {isStaff&&<div className="opsToolbar"><label className="field profileSelect"><span>اختر الطالب</span><select defaultValue="" onChange={e=>e.target.value&&openStudentProfile(e.target.value)}><option value="">اختر طالبًا...</option>{students.map(s=><option key={s.id} value={s.id}>{s.full_name} — {s.circle_name||'بدون حلقة'}</option>)}</select></label></div>}
              {!studentProfile?<div className="emptyState">اختر طالبًا لعرض ملفه القرآني.</div>:<>
                <div className="studentProfileHero"><div><span>الطالب</span><h2>{studentProfile.student?.full_name}</h2><p>{studentProfile.student?.center_name||'—'} • {studentProfile.student?.circle_name||'بدون حلقة'}</p></div><label className="field"><span>الشهر</span><input type="month" value={recordMonth} onChange={e=>{setRecordMonth(e.target.value);openStudentProfile(studentProfile.student.id)}} /></label></div>
                <div className="kpis compactOpsKpis"><article><span>الحضور</span><b>{studentProfile.attendance?.total?Math.round(100*Number(studentProfile.attendance.attended||0)/Number(studentProfile.attendance.total)):0}%</b><small>غياب {studentProfile.attendance?.absent||0}</small></article><article><span>الحفظ الجديد</span><b>{studentProfile.quran?.new_sessions||0}</b><small>{studentProfile.quran?.new_ayahs||0} آية</small></article><article><span>المراجعة</span><b>{studentProfile.quran?.review_sessions||0}</b><small>{studentProfile.quran?.review_ayahs||0} آية</small></article><article><span>متوسط الأداء</span><b>{studentProfile.quran?.average_grade||0}%</b><small>خلال الشهر</small></article></div>
                <h3>السجل القرآني الأخير</h3><GenericTable rows={studentProfile.recent||[]} columns={[[ 'record_date','التاريخ'],['record_type','النوع'],['surah_no','السورة'],['from_ayah','من آية'],['to_ayah','إلى آية'],['grade','الدرجة']]}/>
                <h3 className="profileSubhead">الخطة الأسبوعية</h3><GenericTable rows={studentProfile.plans||[]} columns={[[ 'week_start','الأسبوع'],['day_name','اليوم'],['new_target','الجديد'],['review_target','المراجعة'],['goals','الأهداف']]}/>
              </>}
            </>}
            {loadState!=='loading'&&activeTab==='news'&&<><form className="quickForm" onSubmit={e=>submitForm('/api/news',e)}><label className="field"><span>العنوان</span><input name="title" required /></label><label className="field"><span>النوع</span><select name="kind" defaultValue="news"><option value="news">خبر</option><option value="event">فعالية</option><option value="achievement">إنجاز</option><option value="media">وسائط</option></select></label><label className="field"><span>المحتوى</span><textarea name="body" rows={3}></textarea></label><label className="field"><span>الحالة</span><select name="status" defaultValue="published"><option value="published">منشور</option><option value="draft">مسودة</option></select></label><button className="primary" type="submit">حفظ الخبر</button></form><GenericTable rows={news} columns={[[ 'title','العنوان'],['kind','النوع'],['event_date','التاريخ'],['status','الحالة']]}/></>}
          </div>
        </section>
      </div>}
      {!code&&<footer><div><b>حلقات عاشور بخاري</b><p>منصة قرآنية للتعليم والمتابعة والإدارة.</p></div><div>جميع الحقوق محفوظة</div></footer>}
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
