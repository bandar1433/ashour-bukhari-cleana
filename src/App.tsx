import { useEffect, useMemo, useState } from 'react';
import {
  apiGet,
  apiPost,
  apiPut,
  CenterRow,
  CircleRow,
  clearAccessCode,
  clearSessionToken,
  getSessionToken,
  getSessionExpiryMs,
  getSessionRole, readableError,
  getStatus,
  setSessionToken,
  StudentRow,
  Summary,
  UserRow,
} from './lib/api';
import { authClient } from './lib/auth';
import ExtendedOperations from './ExtendedOperations';
import { LoginRequestsPanel,RolesPanel } from './AdminAccessPanels';
import { MadinahMushafRange, madinahSurahName } from './MadinahMushafRange';
import TeacherDailyTable from './TeacherDailyTable';
import AgreedFeatures from './AgreedFeatures';
import CircleWeeklyRegister from './CircleWeeklyRegister';
import StudentQuranProfile from './StudentQuranProfile';

type Tab = 'overview' | 'centers' | 'students' | 'circles' | 'users' | 'roles' | 'plans' | 'news' | 'teacherToday' | 'circleRegister' | 'evaluations' | 'studentProfile' | 'selfService' | 'motivation' | 'competitions' | 'notifications' | 'reports' | 'operations' | 'joinRequests' | 'library' | 'guardian' | 'quranJourney'|'profile';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';
const report1447={stats:[['447','طالبًا'],['18','معلمًا'],['17','مساعدًا'],['16','حلقة'],['61','جنسية']],news:[['رحلة المدينة المنورة','رحلة إيمانية علمية تربوية لنحو 50 طالبًا من طلاب الحلقات خلال إجازة الصيف.'],['إفطار صائم','لقاء إيماني واجتماعي يجمع طلاب الحلقات ويعزز الأخوة والتواصل.'],['البرنامج الترويحي','أنشطة تربوية واجتماعية مصاحبة تعزز الألفة بين طلاب الحلقات.'],['مجالس ختم القرآن والقراءات','مجالس دورية لختم كتاب الله وإتمام القراءات وربط الطلاب بالقرآن تلاوةً وإتقانًا.'],['برنامج المعايدة','برنامج اجتماعي قرآني يجمع الأساتذة والطلاب والخريجين ويعزز الأخوة والتواصل.']],achievements:[['إنجاز عالمي','تحقيق الطالب أنس الحازمي المركز الثاني على مستوى العالم الإسلامي.'],['المركز الثاني عالميًا','فوز الطالب أحمد كريم بالمركز الثاني في المسابقة العالمية للقرآن الكريم في روسيا.'],['إنجاز دولي','فوز أحمد كريم في مسابقة تنزانيا الدولية لحفظ القرآن الكريم وتلاوته.'],['المركز الأول على مستوى المملكة','فوز الطالب عمر بن محمد أشرف بالمركز الأول في فرع كامل القرآن في مسابقة وزارة التعليم.']]};
const staticSiteImages:Record<string,string>={
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
function CountUp({value,decimals=0,suffix=''}:{value:number;decimals?:number;suffix?:string}){const [shown,setShown]=useState(0);useEffect(()=>{const target=Number(value)||0;if(target===0){setShown(0);return}const start=performance.now(),duration=1250;let frame=0;const tick=(now:number)=>{const p=Math.min(1,(now-start)/duration),ease=1-Math.pow(1-p,2.15);setShown(target*ease);if(p<1)frame=requestAnimationFrame(tick)};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)},[value]);return <>{shown.toLocaleString('ar-SA',{minimumFractionDigits:decimals,maximumFractionDigits:decimals})}{suffix}</>}
function InteractiveMetric({label,value,note,onClick,suffix='',decimals=0}:{label:string;value?:number;note:string;onClick?:()=>void;suffix?:string;decimals?:number}){const body=<><span>{label}</span><b>{typeof value==='number'?<CountUp value={value} decimals={decimals} suffix={suffix}/>:'—'}</b><small>{note}</small></>;return onClick?<button type="button" className="metricAction" onClick={onClick}>{body}<em>عرض التفاصيل ←</em></button>:<article>{body}</article>}
const objectives = [
['01','إتقان التلاوة والحفظ','بناء قراءة صحيحة وحفظ متدرج يقوم على الإتقان والمراجعة المستمرة.'],['02','تعميق الصلة بالقرآن','تربية الطالب على ملازمة كتاب الله وتعظيمه وتحويل التعلم إلى أثر في السلوك.'],['03','متابعة فردية دقيقة','خطة واضحة لكل طالب مع رصد الحضور والإنجاز والحفظ والمراجعة بصورة منتظمة.'],['04','تمكين المعلم','توفير أدوات عملية تساعد المعلم على إدارة الحلقة وقياس تقدم طلابه بوضوح.'],['05','تعزيز شراكة الأسرة','إتاحة تقارير مختصرة وواضحة تعين الأسرة على متابعة مسيرة الطالب وتشجيعه.'],['06','التحفيز والاستدامة','بناء بيئة مشجعة بالنقاط والجوائز والإنجازات بما يحافظ على الدافعية والاستمرار.']];
const values=[['الإخلاص','نستحضر شرف خدمة كتاب الله وابتغاء الأجر في التعليم والتعلم.'],['الإتقان','نعتمد الجودة والدقة في التلاوة والحفظ والمتابعة والتقويم.'],['الرحمة','نبني علاقة تعليمية راشدة تجمع الرفق والاحتواء والتوجيه.'],['القدوة','نجعل السلوك القرآني جزءاً أصيلاً من شخصية المعلم والمتعلم.'],['الانضباط','نلتزم بالمواعيد والخطط والمتابعة المنتظمة لتحقيق نتائج قابلة للقياس.'],['التعاون','نعزز الشراكة بين الإدارة والمعلم والطالب والأسرة لخدمة المسيرة القرآنية.']];
const journey=[['01','التهيئة','تحديد المستوى وربط الطالب بحلقته وخطته المناسبة.'],['02','التعلّم','تصحيح التلاوة وبناء الحفظ الجديد وفق مسار متدرج.'],['03','التثبيت','مراجعة مستمرة مع تسجيل الإنجاز اليومي.'],['04','القياس','تقارير ومؤشرات ونقاط تساعد على تحسين الأداء واستدامته.']];
function AboutSections(){return <><section className="sectionPro aboutIntro reveal reveal-up"><div className="aboutCopy"><span className="sectionLabel">عن حلقات عاشور بخاري</span><h2>بيئة قرآنية تربوية تصنع صلة مستمرة بكتاب الله</h2><p>حلقات عاشور بخاري منظومة تعليمية قرآنية تُعنى بتعليم التلاوة الصحيحة، والحفظ المتقن، والمراجعة المنتظمة، مع متابعة تربوية وإدارية تجمع الطالب والمعلم والأسرة في مسار واحد واضح وقابل للقياس.</p><p>وتستفيد الحلقات من المنصة الرقمية في تنظيم المراكز والحلقات، وتوثيق الحضور والإنجاز والحفظ والمراجعة، وإصدار التقارير، وتحفيز الطلاب؛ ليبقى التعليم القرآني قريباً، منظماً، ومستمراً.</p></div><div className="identityStack"><article className="identityCard visionCard"><span>الرؤية</span><h3>بيئة قرآنية رائدة في بناء قارئ متقن متصل بكتاب الله.</h3></article><article className="identityCard missionCard"><span>الرسالة</span><h3>تعليم قرآني منظم يجمع الإتقان والتربية والمتابعة والتقنية.</h3></article></div></section><section className="sectionPro objectivesSection"><div className="sectionHeading"><span className="sectionLabel">أهدافنا</span><h2>أهداف واضحة تتحول إلى ممارسة يومية</h2></div><div className="objectivesGrid">{objectives.map(([n,t,x])=><article className="objectiveCard" key={t}><span className="objectiveNumber">{n}</span><h3>{t}</h3><p>{x}</p></article>)}</div></section><section className="valuesSection"><div className="sectionPro"><div className="sectionHeading lightHeading"><span className="sectionLabel">قيمنا</span><h2>قيم تحكم التعليم والعلاقة والأثر</h2></div><div className="valuesGrid">{values.map(([t,x],i)=><article className="valueCard" key={t}><span>{String(i+1).padStart(2,'0')}</span><h3>{t}</h3><p>{x}</p></article>)}</div></div></section><section className="sectionPro journeySection"><div className="sectionHeading"><span className="sectionLabel">مسيرة الطالب</span><h2>رحلة تعليمية مترابطة من البداية إلى التقرير</h2></div><div className="journeyTrack">{journey.map(([n,t,x])=><article className="journeyStep" key={t}><div className="journeyNumber">{n}</div><div><h3>{t}</h3><p>{x}</p></div></article>)}</div></section></>}


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
  plans: { title: 'الخطط الأسبوعية', subtitle: 'متابعة أهداف الطلاب وخطط الحفظ والمراجعة.', short: 'الخطط' },
  news: { title: 'الأخبار والفعاليات', subtitle: 'إدارة محتوى الموقع العام والأخبار والإنجازات.', short: 'المحتوى' },
  teacherToday: { title: 'حلقتي اليوم', subtitle: 'مراجعة اكتمال الحضور والحفظ والمراجعة قبل اعتماد اليوم.', short: 'اليوم' },
  circleRegister: { title: 'سجل الحلقة', subtitle: 'كشف شهري موحد للحضور والمراجعة والحفظ والاعتماد.', short: 'السجل' },
  evaluations: { title: 'التقييم والإنجاز', subtitle: 'قياس الإنجاز اليومي وفق الخطة والحضور والمراجعة.', short: 'التقييم' },
  studentProfile: { title: 'ملف الطالب القرآني', subtitle: 'ملف متكامل للحضور والحفظ والمراجعة والخطط والنقاط.', short: 'ملف الطالب' },
  selfService: { title: 'تسجيل الطالب اليومي', subtitle: 'تسجيل الحضور والانصراف لليوم الحالي، مع عرض تقدم الحفظ والمراجعة.', short: 'تسجيلي' },
  motivation: { title: 'مهامي وجوائزي', subtitle: 'السجل اليومي للمهام والنقاط والجوائز، مع إعداد مستقل لكل حلقة.', short: 'المهام والجوائز' },
  competitions: { title: 'سجل المسابقات', subtitle: 'سجل عام لمسابقات المركز ونتائج الطلاب من جميع الحلقات.', short: 'المسابقات' },
  notifications: { title: 'الإشعارات', subtitle: 'إشعارات داخل المنصة للمستخدمين والمراكز.', short: 'الإشعارات' },
  reports: { title: 'مركز التقارير', subtitle: 'مؤشرات الحلقات والطلاب الذين يحتاجون متابعة.', short: 'التقارير' },
  joinRequests: { title: 'طلبات الانضمام', subtitle: 'اعتماد طلبات الطلاب للانضمام إلى الحلقات.', short: 'طلبات الانضمام' },
  operations: { title: 'التشغيل والإعدادات', subtitle: 'الجاهزية والإجازات والاستثناءات وإعدادات التقييم وسجل العمليات.', short: 'التشغيل' },
  library: { title: 'المكتبة', subtitle: 'البرامج والسلاسل والدروس المرتبطة بروابط YouTube.', short: 'المكتبة' },
  guardian: { title: 'متابعة الأبناء', subtitle: 'متابعة الحضور والإنجاز والتقارير للأبناء المرتبطين بالحساب.', short: 'الأبناء' },
  quranJourney: { title: 'رحلتي مع القرآن', subtitle: 'خريطة تقدم الطالب في صفحات مصحف المدينة وسجل الإنجاز.', short: 'رحلتي' },
  profile: { title: 'الملف الشخصي', subtitle: 'بيانات الحساب والجوال والبريد ونوع الحساب.', short: 'حسابي' },
};

const EXPLICIT_LOGOUT_KEY='ashour_explicit_logout';

export default function App() {
  const [code, setCode] = useState(getSessionToken() ? 'session' : '');
  const [authOpen,setAuthOpen]=useState(false);
  const [publicMode,setPublicMode]=useState(false);
  const [authBusy,setAuthBusy]=useState(false);
  const [authIntent,setAuthIntent]=useState<'signin'|'signup'>('signin');
  const [accountForm,setAccountForm]=useState({name:'',documentNo:'',phone:'',email:'',password:'',role:'student',centerId:'',circleId:''});
  const [signupStep,setSignupStep]=useState<1|2>(1);
  const [signupCircles,setSignupCircles]=useState<any[]>([]);
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
  const [tabHistory,setTabHistory]=useState<Tab[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState<string>('');
  const [query, setQuery] = useState('');
  const currentRole=getSessionRole();
  const isRoot=currentRole==='system_admin';
  const isStaff=['system_admin','center_manager','supervisor','teacher'].includes(currentRole);
  const goTab=(tab:Tab)=>{if(tab!==activeTab)setTabHistory(h=>[...h,activeTab].slice(-20));setActiveTab(tab)};
  const goBack=()=>{const previous=tabHistory[tabHistory.length-1]||'overview';setTabHistory(h=>h.slice(0,-1));setActiveTab(previous)};

  useEffect(() => {
    clearAccessCode();
    getStatus()
      .then(setStatus)
      .catch((err) => setStatus({ configured: false, database: 'error', error: err.message }));
    fetch('/api/public').then(r=>r.json()).then(x=>{setPublicData(x);setSiteImages({...staticSiteImages,...((x?.images||{}) as Record<string,string>)});}).catch(()=>setSiteImages(staticSiteImages));
  }, []);

  async function loadDashboard() {
    setLoadState('loading');
    setError('');

    try {
      const role=getSessionRole();
      const root=role==='system_admin';
      const staff=['system_admin','center_manager','supervisor','teacher'].includes(role);
      const [summaryData, centersData, studentsData, circlesData, usersData, rolesData, newsData] = await Promise.all([
        staff?apiGet<Summary>('/api/ops?action=summary'):Promise.resolve(null),
        staff?apiGet<{ items: CenterRow[] }>('/api/centers'):Promise.resolve({items:[]}),
        staff?apiGet<{ items: StudentRow[] }>('/api/students'):Promise.resolve({items:[]}),
        staff?apiGet<{ items: CircleRow[] }>('/api/circles'):Promise.resolve({items:[]}),
        (['system_admin','center_manager','supervisor'].includes(role))?apiGet<{ items: UserRow[]; requests?: any[] }>('/api/users'):Promise.resolve({items:[],requests:[]}),
        root?apiGet<any>('/api/roles'):Promise.resolve({roles:[],permissions:[]}),
        root?apiGet<{ items:any[] }>('/api/news'):Promise.resolve({items:[]}),
      ]);

      setSummary(summaryData as Summary | null);
      setCenters(centersData.items || []);
      setStudents(studentsData.items || []);
      setCircles(circlesData.items || []);
      setUsers(usersData.items || []); setLoginRequests(usersData.requests||[]); setRoleData(rolesData||{roles:[],permissions:[]}); setNews(newsData.items||[]);
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
    if(localStorage.getItem(EXPLICIT_LOGOUT_KEY)==='1') return;
    finishSocialSession().catch(err=>{
      const message=err instanceof Error?err.message:'تعذر استكمال تسجيل الدخول.';
      setError(message);
      setAuthOpen(true);
    });
  }, [code]);
  useEffect(()=>{
    if(!code)return;
    const expiry=getSessionExpiryMs(),remaining=expiry-Date.now();
    if(!expiry||remaining<=0){void handleLogout();return}
    const timer=window.setTimeout(()=>void handleLogout(),remaining);
    const expired=()=>void handleLogout();
    window.addEventListener('ashour:session-expired',expired);
    return()=>{window.clearTimeout(timer);window.removeEventListener('ashour:session-expired',expired)};
  },[code]);


  async function finishSocialSession():Promise<'ready'|'pending'|'none'>{
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
    if(current?.error) throw new Error(readableError(current.error,'تعذر قراءة جلسة المصادقة.'));
    const user=current?.data?.user||current?.data?.session?.user;
    if(!current?.data?.session||!user)return 'none';

    const candidates=[headerJwt,current?.data?.session?.access_token,current?.data?.session?.token,current?.data?.token]
      .map((x:any)=>String(x||'').trim()).filter(Boolean);
    const jwt=candidates.find((x:string)=>x.split('.').length===3)||'';
    if(!jwt) throw new Error('تعذر إصدار رمز التحقق الآمن للحساب. أعد تسجيل الدخول.');

    const response=await fetch('/api/status',{
      method:'POST',
      headers:{Accept:'application/json',Authorization:`Bearer ${jwt}`,'x-signup-draft':localStorage.getItem('ashour_signup_draft')||''}
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(readableError(payload?.message??payload?.error,'تعذر اعتماد جلسة الدخول.'));
    if(payload?.pending){
      localStorage.removeItem('ashour_signup_draft');
      setError(payload.message||'الحساب بانتظار الاعتماد.');
      setAuthOpen(true);
      return 'pending';
    }
    clearAccessCode();
    localStorage.removeItem(EXPLICIT_LOGOUT_KEY);
    setSessionToken(payload.token);
    setCode('session');
    setAuthOpen(false);
    setError('');
    localStorage.removeItem('ashour_signup_draft');
    return 'ready';
  }
  async function handleGoogleLogin(){
    setAuthBusy(true); setError('');
    localStorage.removeItem(EXPLICIT_LOGOUT_KEY);
    try{
      if(authIntent==='signup'){
        const draft={name:accountForm.name.trim(),documentNo:accountForm.documentNo.trim(),phone:accountForm.phone.trim(),role:accountForm.role,centerId:accountForm.centerId,circleId:accountForm.circleId};
        if(!draft.name||!draft.documentNo||!draft.phone)throw new Error('أكمل الاسم ورقم الهوية ورقم الجوال قبل المتابعة.');
        if(['student','teacher','supervisor'].includes(draft.role)&&!draft.centerId)throw new Error('اختر المركز قبل المتابعة.');if(draft.role==='student'&&!draft.circleId)throw new Error('اختر الحلقة قبل المتابعة.');
        localStorage.setItem('ashour_signup_draft',JSON.stringify(draft));
      }
      const result:any=await authClient.signIn.social({
        provider:'google',
        callbackURL:'/',
        errorCallbackURL:'/?auth_error=google',
        disableRedirect:true
      });
      if(result?.error){
        throw new Error(readableError(result.error,'تعذر تسجيل الدخول عبر Google'));
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
    localStorage.removeItem(EXPLICIT_LOGOUT_KEY);
    try{
      const email=accountForm.email.trim();
      const password=accountForm.password;
      if(!email||!password) throw new Error('أدخل البريد الإلكتروني وكلمة المرور.');
      const draft=authIntent==='signup'?{
        name:accountForm.name.trim(),documentNo:accountForm.documentNo.trim(),phone:accountForm.phone.trim(),
        role:accountForm.role,centerId:accountForm.centerId,circleId:accountForm.circleId
      }:null;
      if(draft){
        if(!draft.name||!draft.documentNo||!draft.phone)throw new Error('أكمل الاسم ورقم الهوية ورقم الجوال.');
        if(['student','teacher','supervisor'].includes(draft.role)&&!draft.centerId)throw new Error('اختر المركز.');
        if(draft.role==='student'&&!draft.circleId)throw new Error('اختر الحلقة.');
        localStorage.setItem('ashour_signup_draft',JSON.stringify(draft));
      }
      let authResult:any;
      if(authIntent==='signup'){
        authResult=await authClient.signUp.email({email,password,name:draft!.name});
        if(authResult?.error) throw new Error(readableError(authResult.error,'تعذر إنشاء الحساب'));
      }else{
        authResult=await authClient.signIn.email({email,password});
        if(authResult?.error) throw new Error(readableError(authResult.error,'بيانات الدخول غير صحيحة'));
      }
      const state=await finishSocialSession();
      if(state==='none')throw new Error(authIntent==='signup'?'تم إنشاء الحساب، لكن لم تبدأ جلسة بعد. تحقق من البريد الإلكتروني ثم سجّل الدخول.':'تم قبول بيانات الدخول، لكن تعذر إنشاء جلسة آمنة. أعد المحاولة.');
      if(state==='ready'){
        setAccountForm({name:'',documentNo:'',phone:'',email:'',password:'',role:'student',centerId:'',circleId:''});
        setSignupStep(1);
      }
    }catch(err){
      setError(err instanceof Error?err.message:'تعذر تسجيل الدخول');
    }finally{
      setAuthBusy(false);
    }
  }
  async function handleLogout() {
    localStorage.setItem(EXPLICIT_LOGOUT_KEY,'1');
    clearAccessCode();
    clearSessionToken();
    setCode('');
    setPublicMode(false);
    setAuthOpen(false);
    setPublicView('الرئيسية');
    setActiveTab('overview');
    setTabHistory([]);
    setSummary(null);
    setCenters([]);
    setStudents([]);
    setCircles([]);
    setUsers([]);
    setLoginRequests([]);
    setRoleData({roles:[],permissions:[]});
    setPlans([]);
    setNews([]);
    setTeacherToday({students:[],approvals:[]});
    setCircleRegister({students:[]});
    setStudentProfile(null);
    setLoadState('idle');
    setError('');
    window.history.replaceState({},'',window.location.pathname);
    window.scrollTo({top:0,behavior:'smooth'});
    try{await authClient.signOut()}catch{}
  }
  async function loadTeacherToday(date=dailyDate){
    try{setError('');const data=await apiGet<any>(`/api/ops?action=teacher-today&date=${date}`);setTeacherToday(data)}
    catch(err){setError(err instanceof Error?err.message:'تعذر تحميل لوحة اليوم')}
  }
  async function loadCircleRegister(month=recordMonth){
    try{setError('');const data=await apiGet<any>(`/api/ops?action=circle-register&month=${month}`);setCircleRegister(data)}
    catch(err){setError(err instanceof Error?err.message:'تعذر تحميل سجل الحلقة')}
  }
  async function loadEvaluations(range=evaluationRange){
    try{setError('');const data=await apiGet<any>(`/api/ops?action=evaluations&from=${range.from}&to=${range.to}`);setEvaluations(data)}
    catch(err){setError(err instanceof Error?err.message:'تعذر تحميل التقييم')}
  }
  async function openStudentProfile(id:string,month=recordMonth){
    try{setError('');const data=await apiGet<any>(`/api/ops?action=student-profile&id=${id}&month=${month}`);setStudentProfile(data);goTab('studentProfile')}
    catch(err){setError(err instanceof Error?err.message:'تعذر تحميل ملف الطالب')}
  }
  async function approveDay(circleId:string){
    try{setError('');await apiPost('/api/ops?action=day-approve',{circle_id:circleId,approval_date:dailyDate});await loadTeacherToday(dailyDate)}
    catch(err){setError(err instanceof Error?err.message:'تعذر اعتماد اليوم')}
  }

  useEffect(()=>{if(code&&currentRole==='student'&&activeTab==='overview')goTab('studentProfile');if(code&&currentRole==='guardian'&&activeTab==='overview')goTab('guardian')},[code,currentRole]);

  useEffect(()=>{
    if(!code)return;
    if(activeTab==='teacherToday')loadTeacherToday();
    if(activeTab==='circleRegister')loadCircleRegister();
    if(activeTab==='evaluations')loadEvaluations();
    if(activeTab==='plans')apiGet<{items:any[]}>('/api/plans').then(x=>setPlans(x.items||[])).catch(e=>setError(readableError(e,'تعذر تحميل الخطط')));
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
    <main className={code&&!publicMode?'adminApp':'publicApp'}>
      {(!code||publicMode)&&<header className="header">
        <button className="brand" type="button" onClick={()=>setPublicView('الرئيسية')}>
          <img className="brandLogo" src="/resources/logo-halaqat-ashour-bukhari.png" alt="شعار حلقات عاشور بخاري" />
          <div><b>حلقات عاشور بخاري</b><small>تعليم القرآن الكريم ومتابعة الحلقات</small></div>
        </button>
        <nav aria-label="التنقل الرئيسي">
          {['الرئيسية','عن الحلقات','الحلقات القرآنية','المعلمون','الطلاب','الإنجازات','الأخبار والفعاليات','الوسائط','تواصل معنا'].map(v=><button key={v} className={publicView===v?'active':''} onClick={()=>setPublicView(v)}>{v}</button>)}
        </nav>
        <div className="headerActions">{code&&publicMode?<><button className="secondary" type="button" onClick={()=>setPublicMode(false)}>العودة للحساب</button><button className="login" type="button" onClick={handleLogout}>خروج</button></>:<><button className="secondary" type="button" onClick={()=>{setAuthIntent('signup');setSignupStep(1);setAuthOpen(true);setError('')}}>تسجيل جديد</button><button className="login" type="button" onClick={()=>{setAuthIntent('signin');setAuthOpen(true);setError('')}}>دخول المنصة</button></>}</div>
      </header>}

      {(!code||publicMode) ? <>
        {publicView==='الرئيسية'&&<>
        <section className="homeCommandHero">
          <div className="homeCommandCopy">
            <span className="homeOverline">من مكة المكرمة · تعليم قرآني برؤية رقمية</span>
            <h1>نبني رحلة قرآنية<br/><em>واضحة، متقنة، ومستمرة.</em></h1>
            <p>حلقات عاشور بخاري تجمع الطالب والمعلم والأسرة والإدارة في منظومة واحدة؛ من الخطة اليومية إلى قياس الإنجاز وصناعة الأثر.</p>
            <div className="homeCommandActions">
              <button className="homePrimary" type="button" onClick={()=>{setAuthIntent('signup');setSignupStep(1);setAuthOpen(true);setError('')}}>ابدأ التسجيل <span>←</span></button>
              <button className="homeSecondary" type="button" onClick={()=>{setAuthIntent('signin');setAuthOpen(true);setError('')}}>دخول المنصة</button>
            </div>
            <div className="homeTrust"><span>◉ متابعة يومية</span><span>◉ مصحف المدينة</span><span>◉ تقارير وتحفيز</span></div>
          </div>
          <div className="homeCommandVisual">
            <div className="homeVisualBrand"><img src="/resources/logo-halaqat-ashour-bukhari.png" alt="حلقات عاشور بخاري"/><div><small>حلقات عاشور بخاري</small><b>القرآن في قلب الرحلة</b></div></div>
            <div className="homeLiveGrid">
              <article><span>الطلاب</span><b><CountUp value={Number(publicData?.stats?.students||447)}/></b><small>رحلة تعلم ومتابعة</small></article>
              <article><span>الحلقات</span><b><CountUp value={Number(publicData?.stats?.circles||16)}/></b><small>بيئات تعليم نشطة</small></article>
              <article><span>المعلمون</span><b><CountUp value={Number(publicData?.stats?.teachers||18)}/></b><small>تعليم وإشراف</small></article>
              <article><span>الجنسيات</span><b><CountUp value={61}/></b><small>أثر يمتد إلى العالم</small></article>
            </div>
            <div className="homeVisualProgress"><div><span>رحلة الطالب</span><b>حفظ · مراجعة · إتقان</b></div><div className="homeProgressTrack"><i></i></div><small>متابعة متصلة من الخطة إلى التقرير</small></div>
          </div>
        </section>

        <section className="homeImpactStrip">
          <article><b>01</b><div><strong>منصة واحدة</strong><small>للطالب والمعلم والأسرة والإدارة</small></div></article>
          <article><b>04</b><div><strong>مسارات قرآنية</strong><small>تلقين · حفظ · إتقان · قراءات</small></div></article>
          <article><b>604</b><div><strong>صفحات المصحف</strong><small>متابعة دقيقة وفق مصحف المدينة</small></div></article>
          <article><b>24/7</b><div><strong>سجل رقمي</strong><small>يحفظ مسيرة الطالب ويقيس تقدمه</small></div></article>
        </section>

        <section className="homePathways">
          <div className="homeSectionIntro"><span>المسارات التعليمية</span><h2>كل طالب يبدأ من مستواه<br/>ويتقدم بخطة واضحة.</h2><p>مسارات مترابطة تراعي التأسيس والحفظ والتثبيت والإتقان، وتمنح المعلم أدوات متابعة عملية.</p></div>
          <div className="homePathGrid">
            {homeMediaCards.slice(0,4).map(([key,title,desc],i)=><button type="button" className="homePathCard" key={key} onClick={()=>setPublicView('الحلقات القرآنية')}><SitePhoto src={siteImages[key]} alt={title}/><span>0{i+1}</span><div><h3>{title}</h3><p>{desc}</p><b>استكشف المسار ←</b></div></button>)}
          </div>
        </section>

        <section className="homeJourneyDark">
          <div className="homeJourneyIntro"><span>رحلة الطالب</span><h2>من أول لقاء<br/>إلى أثر يمكن قياسه.</h2><p>لا تتوقف الرحلة عند تسجيل الحفظ؛ بل تربط الخطة والحضور والمراجعة والتقييم والتحفيز في سجل واحد.</p></div>
          <div className="homeJourneySteps">{journey.map(([n,t,x])=><article key={t}><b>{n}</b><div><h3>{t}</h3><p>{x}</p></div></article>)}</div>
        </section>

        <section className="homeNewsStage">
          <div className="homeSectionIntro compact"><span>من قلب الحلقات</span><h2>خبر وأثر وإنجاز.</h2></div>
          <div className="homeNewsFeature">
            <div className="homeNewsImage"><SitePhoto src={announcementImage(activeAnnouncement)} alt={activeAnnouncement?.title||'أخبار الحلقات'}/><span>{activeAnnouncement?.kind==='achievement'?'إنجاز':'حدث'}</span></div>
            <article><small>{activeAnnouncement?.published_at?String(activeAnnouncement.published_at).slice(0,10):'حديثًا'}</small><h3>{activeAnnouncement?.title}</h3><p>{activeAnnouncement?.body}</p><div className="homeNewsNav"><button onClick={()=>setAnnouncementIndex(i=>(i-1+announcements.length)%announcements.length)}>→</button><b>{String(announcementIndex%announcements.length+1).padStart(2,'0')} / {String(announcements.length).padStart(2,'0')}</b><button onClick={()=>setAnnouncementIndex(i=>(i+1)%announcements.length)}>←</button></div><button className="homeTextLink" onClick={()=>setPublicView('الأخبار والفعاليات')}>جميع الأخبار والفعاليات ←</button></article>
          </div>
        </section>
        </>}
        {publicView==='عن الحلقات'&&<AboutSections/>}{publicView==='الرئيسية'&&<>
          <section className="homeAboutBrief">
            <div><span>عن الحلقات</span><h2>تعليم القرآن بإتقان،<br/>ومتابعة تحفظ أثر التعلم.</h2></div>
            <div><p>حلقات عاشور بخاري منظومة تعليمية تربوية تعتني بالتلاوة والحفظ والمراجعة، وتربط العمل اليومي بمسار واضح للطالب والمعلم والأسرة.</p><button type="button" onClick={()=>setPublicView('عن الحلقات')}>تعرف على الحلقات ←</button></div>
          </section>
          <section className="homeAchievementRow">
            {report1447.achievements.slice(0,3).map(([t,b],i)=><article key={t}><SitePhoto src={siteImages[['achievement-anas','achievement-russia','achievement-omar'][i]]} alt={t}/><div><span>إنجاز</span><h3>{t}</h3><p>{b}</p></div></article>)}
          </section>
          <section className="homeFinalCta">
            <div><span>ابدأ رحلتك</span><h2>بيئة قرآنية واحدة.<br/>مسيرة أوضح.</h2><p>سجّل في الحلقات أو ادخل إلى حسابك لمتابعة مسيرتك.</p></div>
            <div><button className="homePrimary" type="button" onClick={()=>{setAuthIntent('signup');setSignupStep(1);setAuthOpen(true);setError('')}}>تسجيل جديد ←</button><button className="homeSecondary" type="button" onClick={()=>{setAuthIntent('signin');setAuthOpen(true);setError('')}}>دخول المنصة</button></div>
          </section>
        </>}
        {publicView==='الحلقات القرآنية'&&<section className="section"><div className="innerHero"><span className="sectionLabel">الحلقات القرآنية</span><h1>مسارات تعليمية تناسب مراحل الطلاب</h1><p>من التهجي والتلقين إلى الحفظ والإتقان والقراءات.</p></div><div className="roleGrid">{['مسار التهجي والتلقين','مسار حفظ القرآن للأشبال','مسار حفظ القرآن للشباب','مسار حفظ القرآن والمتون','مسار القراءات'].map((x,i)=><article className="roleCard" key={x}><i>◈</i><b>{x}</b><small>{i===0?'تأسيس القراءة والتلقين الصحيح':'حفظ جديد ومراجعة وفق خطة متدرجة'}</small></article>)}</div><div className="sectionHead reportSubhead"><div><span>الحلقات المسجلة</span><h2>الحلقات النشطة في المنصة</h2></div></div><div className="roleGrid">{publicData.circles?.map((x:any)=><article className="roleCard" key={x.id}><b>{x.name}</b><small>{x.center_name||'—'}</small><em>{x.teacher_name||'لم يحدد المعلم'}</em></article>)}</div></section>}
        {publicView==='الأخبار والفعاليات'&&<section className="report1447 publicReportPage"><div className="innerHero reportPageHero"><span className="sectionLabel">أخبار الحلقات</span><h1>برامج وفعاليات تصنع الأثر</h1><p>نماذج من البرامج المصاحبة والفعاليات الموثقة في تقرير حلقات عاشور بخاري لعام 1447هـ.</p></div><div className="reportCards publicCards">{report1447.news.map(([t,b],i)=><article key={t}><SitePhoto src={siteImages[['madinah','iftar','recreation','khatm','eid'][i]]} alt={t} /><div><span className="sectionLabel">خبر وفعالية</span><h3>{t}</h3><p>{b}</p></div></article>)}</div>{publicData.news?.length>0&&<><div className="sectionHead reportSubhead"><div><span>آخر المستجدات</span><h2>أخبار منشورة من إدارة المنصة</h2></div></div><div className="reportCards publicCards">{publicData.news.map((n:any)=><article key={n.id}><SitePhoto src={announcementImage(n)} alt={n.title||'خبر الحلقات'} /><div><span className="sectionLabel">{n.kind==='achievement'?'إنجاز':n.kind==='event'?'فعالية':n.kind==='media'?'وسائط':'خبر'}</span><h3>{n.title}</h3><p>{n.body}</p>{n.event_date&&<small>{String(n.event_date).slice(0,10)}</small>}{n.video_url&&<p><a href={n.video_url} target="_blank" rel="noreferrer">مشاهدة الفيديو</a></p>}</div></article>)}</div></>}</section>}
        {publicView==='الإنجازات'&&<section className="report1447 publicReportPage"><div className="innerHero reportPageHero"><span className="sectionLabel">إنجازات 1447هـ</span><h1>طلاب الحلقات في ميادين التميز</h1><p>نماذج من الإنجازات العالمية والدولية والمحلية الواردة في التقرير السنوي.</p></div><div className="reportCards achievements publicCards">{report1447.achievements.map(([t,b],i)=><article key={t}><SitePhoto src={siteImages[['achievement-anas','achievement-russia','achievement-tanzania','achievement-omar'][i]]} alt={t} /><div><span className="sectionLabel">إنجاز</span><h3>{t}</h3><p>{b}</p></div></article>)}</div><div className="reportStats">{report1447.stats.map(([n,l])=><article key={l}><b>{n}</b><span>{l}</span></article>)}</div></section>}{publicView==='المعلمون'&&<section className="simplePage richSimplePage"><span className="sectionLabel">المعلمون</span><h1>معلمون يصنعون أثرًا قرآنيًا</h1><p>يقوم المعلم بإدارة الحلقة ومتابعة الحفظ الجديد والمراجعة والحضور ضمن مسار تعليمي واضح.</p></section>}{publicView==='الطلاب'&&<section className="simplePage richSimplePage"><span className="sectionLabel">الطلاب</span><h1>رحلة الطالب مع كتاب الله</h1><p>تبدأ بالتهيئة وتحديد المستوى، ثم التعلم والتثبيت والقياس والمتابعة المستمرة.</p></section>}{publicView==='الوسائط'&&<section className="report1447 publicReportPage"><div className="innerHero reportPageHero"><span className="sectionLabel">الوسائط</span><h1>من ذاكرة الحلقات</h1><p>صور من المسارات القرآنية والبرامج والرحلات والإنجازات.</p></div><div className="mediaGallery">{[['talqeen','مسار التلقين والتهجي'],['hifz','مسار حفظ القرآن'],['itqan','مسار الإتقان'],['qiraat','مسار القراءات'],['madinah','رحلة المدينة'],['madinah-group','طلاب الحلقات في المدينة'],['iftar','إفطار صائم'],['recreation','البرنامج الترويحي'],['khatm','مجالس الختم'],['eid','برنامج المعايدة'],['nationalities','جنسيات طلاب الحلقات'],['photo-1','من أنشطة الحلقات'],['photo-2','من أنشطة الحلقات']].map(([key,title])=><figure key={key}><SitePhoto src={siteImages[key]} alt={title} /><figcaption>{title}</figcaption></figure>)}</div></section>}{publicView==='تواصل معنا'&&<section className="simplePage richSimplePage"><span className="sectionLabel">تواصل معنا</span><h1>حلقات عاشور بخاري</h1><p>للتواصل والاستفسارات المتعلقة بالحلقات والبرامج، يتم تحديث بيانات التواصل من إدارة المنصة.</p></section>}
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
                <span className="authEyebrow">{authIntent==='signin'?'دخول موحد':'إنشاء حساب جديد'}</span>
                <h2 id="auth-title">{authIntent==='signin'?'دخول المنصة':'التسجيل في المنصة'}</h2>
                <p className="authLead">{authIntent==='signin'?'سجّل الدخول بحسابك، وسيتم توجيهك تلقائيًا إلى لوحتك حسب دورك.':'أدخل بياناتك ثم اختر نوع الحساب. التسجيل بالجوال مجهز وسيُفعّل لاحقًا مع OTP.'}</p>
              </div>
              {error&&<div className="authNotice" role="alert">{error}</div>}
              {authIntent==='signin'?<div className="authForm authFormPro">
                <button className="primary authSubmit googleLogin" type="button" onClick={handleGoogleLogin} disabled={authBusy}>{authBusy?'جارٍ التحويل…':'الدخول باستخدام Google'}</button>
                <div className="authDivider"><span>أو</span></div>
                <form className="authForm" onSubmit={handleAccountLogin}>
                  <label className="field"><span>البريد الإلكتروني</span><input type="email" value={accountForm.email} onChange={e=>setAccountForm(x=>({...x,email:e.target.value}))} autoComplete="email" required/></label>
                  <label className="field"><span>كلمة المرور</span><input type="password" value={accountForm.password} onChange={e=>setAccountForm(x=>({...x,password:e.target.value}))} autoComplete="current-password" required/></label>
                  <button className="secondary authSubmit" type="submit" disabled={authBusy}>{authBusy?'جارٍ الدخول…':'الدخول بالبريد وكلمة المرور'}</button>
                </form>
                                <div className="authAlternate"><button type="button" className="tableAction" onClick={()=>{setAuthIntent('signup');setSignupStep(1);setError('')}}>ليس لديك حساب؟ تسجيل جديد</button></div>
              </div>:<div className="authForm authFormPro">
                {signupStep===1?<><label className="field"><span>الاسم الكامل</span><input value={accountForm.name} onChange={e=>setAccountForm(x=>({...x,name:e.target.value}))} required/></label>
                <label className="field"><span>رقم الهوية / الوثيقة</span><input value={accountForm.documentNo} onChange={e=>setAccountForm(x=>({...x,documentNo:e.target.value}))} required/></label>
                <label className="field"><span>رقم الجوال</span><input type="tel" placeholder="+966..." value={accountForm.phone} onChange={e=>setAccountForm(x=>({...x,phone:e.target.value}))} required/><small>محفوظ للتنبيهات والرسائل؛ التحقق OTP سيُفعّل لاحقًا.</small></label>
                <label className="field"><span>نوع الحساب</span><select value={accountForm.role} onChange={e=>setAccountForm(x=>({...x,role:e.target.value,centerId:'',circleId:''}))}><option value="supervisor">مشرف مركز</option><option value="teacher">معلم حلقة</option><option value="student">طالب</option><option value="guardian">ولي أمر</option></select></label>
                {['student','teacher','supervisor'].includes(accountForm.role)&&<><label className="field"><span>المركز</span><select value={accountForm.centerId} onChange={async e=>{const centerId=e.target.value;setAccountForm(x=>({...x,centerId,circleId:''}));try{const r:any=await fetch('/api/public').then(x=>x.json());setSignupCircles((r.circles||[]).filter((q:any)=>q.center_id===centerId))}catch{setSignupCircles([])}}}><option value="">اختر المركز</option>{(publicData.centers||[]).map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
                {accountForm.role==='student'&&<label className="field"><span>الحلقة</span><select value={accountForm.circleId} onChange={e=>setAccountForm(x=>({...x,circleId:e.target.value}))}><option value="">اختر الحلقة</option>{signupCircles.map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}{accountForm.role==='student'&&null}</>}
                <button className="primary authSubmit" type="button" onClick={()=>{if(!accountForm.name.trim()||!accountForm.documentNo.trim()||!accountForm.phone.trim()){setError('أكمل الاسم ورقم الهوية ورقم الجوال.');return}if(['student','teacher','supervisor'].includes(accountForm.role)&&!accountForm.centerId){setError('اختر المركز.');return}if(accountForm.role==='student'&&!accountForm.circleId){setError('اختر الحلقة.');return}setError('');setSignupStep(2)}}>متابعة</button></>:<>
                <div className="authSecurityNote">بعد التسجيل: الطالب ينتظر قبول الحلقة، والمعلم والمشرف ينتظران الاعتماد، أما حساب ولي الأمر فيتفعّل ثم تظهر بيانات الأبناء بعد ربطهم من الجهة المخولة.</div>
                <button className="primary authSubmit googleLogin" type="button" onClick={handleGoogleLogin} disabled={authBusy}>{authBusy?'جارٍ التحويل…':'التسجيل عبر Google'}</button>
                <div className="authDivider"><span>أو</span></div>
                <form className="authForm" onSubmit={handleAccountLogin}>
                  <label className="field"><span>البريد الإلكتروني</span><input type="email" value={accountForm.email} onChange={e=>setAccountForm(x=>({...x,email:e.target.value}))} autoComplete="email" required/></label>
                  <label className="field"><span>كلمة المرور</span><input type="password" minLength={8} value={accountForm.password} onChange={e=>setAccountForm(x=>({...x,password:e.target.value}))} autoComplete="new-password" required/></label>
                  <button className="secondary authSubmit" type="submit" disabled={authBusy}>{authBusy?'جارٍ إنشاء الحساب…':'التسجيل بالبريد وكلمة المرور'}</button>
                </form>
                <button className="secondary authSubmit" type="button" disabled title="تم تجهيز المسار وسيُفعّل لاحقًا مع OTP">التسجيل برقم الجوال — قريبًا</button>
                <button className="tableAction" type="button" onClick={()=>setSignupStep(1)}>← تعديل البيانات</button></>}
                <div className="authAlternate"><button type="button" className="tableAction" onClick={()=>{setAuthIntent('signin');setError('')}}>لديك حساب؟ دخول المنصة</button></div>
              </div>}

            </div>
          </section>
        </div>}
      </> :
      <div className="workspace workspacePro">
        <aside className="adminSidebar">
          <div className="sidebarBrand"><div className="sidebarLogo"><img src="/resources/logo-halaqat-ashour-bukhari.png" alt="" /></div><div><b>حلقات عاشور بخاري</b><small>المنصة القرآنية التعليمية</small></div></div>
          <div className="sidebarContext"><span>مساحة العمل</span><b>{roleLabel[currentRole]||'مستخدم'}</b><small>{currentRole==='student'?'متابعة الحفظ والمراجعة والإنجاز':currentRole==='teacher'?'إدارة الحلقة ومتابعة الطلاب':currentRole==='guardian'?'متابعة الأبناء والتقارير':'الإشراف والتشغيل والمؤشرات'}</small></div>
          {isStaff&&<><div className="sidebarSectionLabel">الرئيسية</div><button className={activeTab==='overview'?'selected':''} onClick={()=>goTab('overview')}><span className="navDot">⌂</span><span>لوحة المؤشرات</span></button>
          <div className="sidebarSectionLabel">العمل اليومي</div><button className={activeTab==='teacherToday'?'selected':''} onClick={()=>goTab('teacherToday')}><span className="navDot">◈</span><span>سجل اليوم</span></button><button className={activeTab==='circleRegister'?'selected':''} onClick={()=>goTab('circleRegister')}><span className="navDot">▦</span><span>سجل الحلقة</span></button><button className={activeTab==='plans'?'selected':''} onClick={()=>goTab('plans')}><span className="navDot">▤</span><span>الخطط الأسبوعية</span></button><button className={activeTab==='students'?'selected':''} onClick={()=>goTab('students')}><span className="navDot">◉</span><span>الطلاب</span></button><button className={activeTab==='joinRequests'?'selected':''} onClick={()=>goTab('joinRequests')}><span className="navDot">＋</span><span>طلبات الانضمام</span></button>
          <div className="sidebarSectionLabel">الأداء والتحفيز</div><button className={activeTab==='evaluations'?'selected':''} onClick={()=>goTab('evaluations')}><span className="navDot">◎</span><span>التقييم والإنجاز</span></button><button className={activeTab==='motivation'?'selected':''} onClick={()=>goTab('motivation')}><span className="navDot">★</span><span>المهام والجوائز</span></button><button className={activeTab==='competitions'?'selected':''} onClick={()=>goTab('competitions')}><span className="navDot">◇</span><span>المسابقات</span></button><button className={activeTab==='reports'?'selected':''} onClick={()=>goTab('reports')}><span className="navDot">▥</span><span>التقارير والمؤشرات</span></button>
          {['system_admin','center_manager','supervisor'].includes(currentRole)&&<><div className="sidebarSectionLabel">الإدارة</div><button className={activeTab==='centers'?'selected':''} onClick={()=>goTab('centers')}><span className="navDot">◇</span><span>المراكز</span></button><button className={activeTab==='circles'?'selected':''} onClick={()=>goTab('circles')}><span className="navDot">◫</span><span>الحلقات</span></button><button className={activeTab==='users'?'selected':''} onClick={()=>goTab('users')}><span className="navDot">◎</span><span>الحسابات والدخول</span></button><button className={activeTab==='operations'?'selected':''} onClick={()=>goTab('operations')}><span className="navDot">⚙</span><span>التشغيل والإعدادات</span></button></>}
          <div className="sidebarSectionLabel">التواصل والمصادر</div><button className={activeTab==='notifications'?'selected':''} onClick={()=>goTab('notifications')}><span className="navDot">◌</span><span>الإشعارات</span></button><button className={activeTab==='library'?'selected':''} onClick={()=>goTab('library')}><span className="navDot">▧</span><span>المكتبة</span></button></>}
          {currentRole==='student'&&<><div className="sidebarSectionLabel">الرئيسية</div><button className={activeTab==='studentProfile'?'selected':''} onClick={()=>goTab('studentProfile')}><span className="navDot">◇</span><span>ملفي القرآني</span></button><div className="sidebarSectionLabel">متابعتي</div><button className={activeTab==='evaluations'?'selected':''} onClick={()=>goTab('evaluations')}><span className="navDot">◎</span><span>تقييمي وإنجازي</span></button><button className={activeTab==='motivation'?'selected':''} onClick={()=>goTab('motivation')}><span className="navDot">★</span><span>مهامي وجوائزي</span></button><button className={activeTab==='reports'?'selected':''} onClick={()=>goTab('reports')}><span className="navDot">▥</span><span>تقاريري</span></button><div className="sidebarSectionLabel">التواصل</div><button className={activeTab==='notifications'?'selected':''} onClick={()=>goTab('notifications')}><span className="navDot">◌</span><span>الإشعارات</span></button><button className={activeTab==='library'?'selected':''} onClick={()=>goTab('library')}><span className="navDot">▧</span><span>المكتبة</span></button></>}
          {currentRole==='guardian'&&<><div className="sidebarSectionLabel">ولي الأمر</div><button className={activeTab==='guardian'?'selected':''} onClick={()=>goTab('guardian')}><span className="navDot">◉</span><span>متابعة الأبناء</span></button><button className={activeTab==='reports'?'selected':''} onClick={()=>goTab('reports')}><span className="navDot">▥</span><span>تقارير الأبناء</span></button><button className={activeTab==='notifications'?'selected':''} onClick={()=>goTab('notifications')}><span className="navDot">◌</span><span>الإشعارات</span></button><button className={activeTab==='library'?'selected':''} onClick={()=>goTab('library')}><span className="navDot">▧</span><span>المكتبة</span></button></>}
          {isRoot&&<><div className="sidebarSectionLabel">إدارة النظام</div><button className={activeTab==='roles'?'selected':''} onClick={()=>goTab('roles')}><span className="navDot">⚙</span><span>الأدوار والصلاحيات</span></button><button className={activeTab==='news'?'selected':''} onClick={()=>goTab('news')}><span className="navDot">▧</span><span>الموقع والأخبار</span></button></>}
          <div className="sidebarSectionLabel">الحساب</div><button className={activeTab==='profile'?'selected':''} onClick={()=>goTab('profile')}><span className="navDot">◉</span><span>الملف الشخصي</span></button><div className="sidebarAccount"><span className="onlineDot"></span><div><b>{roleLabel[currentRole]||'مستخدم'}</b><small>جلسة آمنة · 30 دقيقة</small></div><button className="accountHome" title="الواجهة الرئيسية" onClick={()=>{setPublicMode(true);setPublicView('الرئيسية')}}>⌂</button><button className="exit" onClick={handleLogout}>خروج</button></div>
        </aside>
        <section className="dashboardContent">
          <div className="adminTopbar">
            <div className="crumb"><span className="crumbPath">لوحة التحكم / {tabMeta[activeTab].short}</span><h1>{tabMeta[activeTab].title}</h1><p>{tabMeta[activeTab].subtitle}</p></div>
            <div className="adminTopActions"><button className="secondary" type="button" onClick={()=>{setPublicMode(true);setPublicView('الرئيسية')}}>⌂ الواجهة الرئيسية</button><button className="secondary" type="button" onClick={goBack} disabled={activeTab==='overview'&&tabHistory.length===0}>← رجوع</button><button className="refreshButton" onClick={loadDashboard} disabled={loadState==='loading'}>{loadState==='loading'?'جارٍ التحديث…':'تحديث البيانات'}</button></div>
          </div>
          {error&&<div className="notice">{error}</div>}
          {activeTab==='overview'&&<><div className="kpis interactiveKpis"><InteractiveMetric label="الطلاب" value={summary?.students} note="طالب مسجل" onClick={()=>goTab('students')}/><InteractiveMetric label="المعلمون" value={summary?.teachers} note="معلم في النظام" onClick={()=>goTab('users')}/><InteractiveMetric label="الحلقات" value={summary?.circles} note="حلقة قرآنية" onClick={()=>goTab('circles')}/><InteractiveMetric label="المراكز" value={summary?.centers} note="مركز وفرع" onClick={()=>goTab('centers')}/></div>{isStaff&&<AgreedFeatures mode="interventions" currentRole={currentRole} students={students}/>} </>}
          <div className="panel mainPanel">
            <div className="panelHead institutionalPanelHead"><div><span className="panelEyebrow">{activeTab==='overview'?'ملخص تنفيذي':currentRole==='student'?'مساحة الطالب':currentRole==='teacher'?'مساحة المعلم':'إدارة البيانات'}</span><h2>{tabMeta[activeTab].title}</h2><small>{tabMeta[activeTab].subtitle}</small></div>{!['overview','roles','teacherToday','circleRegister','evaluations','studentProfile','selfService','motivation','competitions','notifications','reports','operations','joinRequests','library','guardian','quranJourney'].includes(activeTab)&&<div className="searchBox"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="بحث في السجلات..." /></div>}</div>
            {loadState==='loading'&&<div className="emptyState">جارٍ تحميل البيانات...</div>}

            {loadState!=='loading'&&activeTab==='centers'&&<><form className="quickForm" onSubmit={e=>submitForm('/api/centers',e)}><label className="field"><span>اسم المركز</span><input name="name" required /></label><label className="field"><span>الموقع</span><input name="location" /></label><label className="field"><span>مدير المركز</span><select name="manager_user_id" defaultValue=""><option value="">بدون مدير محدد</option>{users.filter(u=>u.role==='center_manager'||u.role==='system_admin').map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}</select></label><button className="primary" type="submit">إضافة المركز</button></form><GenericTable rows={centers} columns={[[ 'name','المركز'],['location','الموقع'],['manager_name','المدير'],['circles_count','عدد الحلقات']]}/></>}
            {loadState!=='loading'&&activeTab==='students'&&<><form className="quickForm" onSubmit={e=>submitForm('/api/students',e)}><label className="field"><span>اسم الطالب</span><input name="full_name" required /></label><label className="field"><span>رقم الهوية / الوثيقة</span><input name="document_no" required /></label><label className="field"><span>الجوال الدولي</span><input name="mobile" type="tel" placeholder="+966..." required /></label><label className="field"><span>تاريخ الميلاد</span><input name="birth_date" type="date" /></label><label className="field"><span>الحلقة</span><select name="circle_id" required defaultValue=""><option value="">اختر الحلقة</option>{circles.map((x:any)=><option key={x.id} value={x.id}>{x.name} — {x.center_name||''}</option>)}</select></label><label className="field"><span>الصف/المرحلة</span><input name="grade_level" /></label><button className="primary" type="submit">إضافة الطالب</button></form><StudentsTable rows={filteredStudents} circles={circles} currentRole={currentRole} onChanged={loadDashboard}/></>}
            {loadState!=='loading'&&activeTab==='circles'&&<><form className="quickForm" onSubmit={e=>submitForm('/api/circles',e)}><label className="field"><span>اسم الحلقة</span><input name="name" required /></label><label className="field"><span>المركز</span><select name="center_id" required defaultValue=""><option value="" disabled>اختر المركز</option>{centers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label className="field"><span>المعلم</span><select name="teacher_user_id" defaultValue=""><option value="">غير معين</option>{users.filter(u=>u.role==='teacher'&&u.is_active).map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}</select></label><label className="field"><span>المسار الرئيس</span><select name="student_track" defaultValue="الطلاب من أهل مكة"><option>الطلاب من أهل مكة</option><option>الطلاب الوافدون</option></select></label><label className="field"><span>المسار القرآني</span><select name="quran_track" defaultValue="مسار حفظ القرآن للشباب"><option>مسار التهجي والتلقين</option><option>مسار حفظ القرآن للأشبال</option><option>مسار حفظ القرآن للشباب</option><option>مسار حفظ القرآن والمتون</option><option>مسار القراءات</option></select></label><label className="field"><span>الموعد</span><input name="schedule" /></label><label className="field"><span>وقت بدء الحلقة</span><input name="start_time" type="time" /></label><button className="primary" type="submit">إضافة الحلقة</button></form><CirclesTable rows={filteredCircles} users={users} onChanged={loadDashboard}/></>}
            {loadState!=='loading'&&activeTab==='users'&&<><form className="quickForm" onSubmit={e=>submitForm('/api/users',e)}><label className="field"><span>الاسم</span><input name="full_name" required /></label><label className="field"><span>البريد</span><input name="email" type="email" /></label><label className="field"><span>الجوال</span><input name="phone" /></label><label className="field"><span>الدور</span><select name="role" required defaultValue="teacher"><option value="center_manager">مدير مركز</option><option value="supervisor">مشرف</option><option value="teacher">معلم</option><option value="student">طالب</option><option value="guardian">ولي أمر</option></select></label><label className="field"><span>المركز</span><select name="center_id" defaultValue=""><option value="">بدون مركز</option>{centers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><button className="primary" type="submit">إضافة المستخدم</button></form><UsersTable rows={filteredUsers} centers={centers} onChanged={loadDashboard}/><LoginRequestsPanel rows={loginRequests} users={users} onChanged={loadDashboard}/><form className="quickForm" onSubmit={async e=>{e.preventDefault();try{await apiPost('/api/ops?action=features&sub=guardian-link',Object.fromEntries(new FormData(e.currentTarget).entries()));e.currentTarget.reset();setError('تم ربط الطالب بولي الأمر.')}catch(x){setError(x instanceof Error?x.message:'تعذر الربط')}}}><label className="field"><span>ولي الأمر</span><select name="guardian_user_id" required defaultValue=""><option value="">اختر ولي الأمر</option>{users.filter(u=>u.role==='guardian').map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}</select></label><label className="field"><span>الطالب</span><select name="student_id" required defaultValue=""><option value="">اختر الطالب</option>{students.map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></label><button className="primary">ربط الطالب بولي الأمر</button></form></>}
            {loadState!=='loading'&&activeTab==='roles'&&<RolesPanel data={roleData} onChanged={loadDashboard}/>}
            
            
            {loadState!=='loading'&&activeTab==='plans'&&<><form className="quickForm planRangeForm" onSubmit={async e=>{e.preventDefault();try{await apiPost('/api/plans',Object.fromEntries(new FormData(e.currentTarget).entries()));const x=await apiGet<{items:any[]}>('/api/plans');setPlans(x.items||[]);setError('تم توزيع الخطة من السبت إلى الخميس وحفظها.')}catch(x){setError(x instanceof Error?x.message:'تعذر حفظ الخطة')}}}><label className="field"><span>الطالب</span><select name="student_id" required defaultValue=""><option value="" disabled>اختر الطالب</option>{students.map(x=><option key={x.id} value={x.id}>{x.full_name}</option>)}</select></label><label className="field"><span>بداية الأسبوع (السبت)</span><input name="week_start" type="date" required/></label><section className="planRangeBlock"><h3>خطة الحفظ الجديد — من السورة/الصفحة إلى السورة/الصفحة</h3><MadinahMushafRange prefix="new"/></section><section className="planRangeBlock"><h3>خطة المراجعة — من السورة/الصفحة إلى السورة/الصفحة</h3><MadinahMushafRange prefix="review"/></section><label className="field"><span>أهداف وملاحظات</span><input name="goals"/></label><button className="primary">توزيع الخطة السبت–الخميس وحفظها</button></form><GenericTable rows={plans} columns={[[ 'full_name','الطالب'],['week_start','الأسبوع'],['day_name','اليوم'],['new_target_display','الحفظ الجديد'],['review_target_display','المراجعة'],['goals','الأهداف']]}/></>}
            {activeTab==='teacherToday'&&<>
              <div className="opsToolbar"><button className="secondary" type="button" onClick={()=>goTab('plans')}>الخطة الأسبوعية</button><label className="field"><span>التاريخ</span><input type="date" value={dailyDate} onChange={e=>{setDailyDate(e.target.value);loadTeacherToday(e.target.value)}} /></label><button className="secondary" type="button" onClick={()=>loadTeacherToday()}>تحديث اليوم</button></div>
              {currentRole==='teacher'&&<div className="dailyApprovalGrid">{circles.map(c=><form key={c.id} onSubmit={async e=>{e.preventDefault();const start=String(new FormData(e.currentTarget).get('start_time')||'');try{await apiPut('/api/circles',{id:c.id,start_time:start||null});await loadDashboard();setError('تم تحديث وقت بدء الحلقة.')}catch(x){setError(x instanceof Error?x.message:'تعذر تحديث الوقت')}}}><div><b>{c.name}</b><small>{c.start_time?'وقت مخصص':'افتراضي: أذان عصر مكة + ساعة و10 دقائق'}</small></div><input name="start_time" type="time" defaultValue={c.start_time?String(c.start_time).slice(0,5):''}/><button className="secondary">حفظ الوقت</button></form>)}</div>}
              <div className="kpis compactOpsKpis interactiveKpis"><InteractiveMetric label="طلاب اليوم" value={teacherToday.students?.length||0} note="ضمن نطاق الحساب" onClick={()=>goTab('students')}/><InteractiveMetric label="الحضور المسجل" value={(teacherToday.students||[]).filter((x:any)=>x.attendance_status).length} note="فتح سجل الحلقة" onClick={()=>goTab('circleRegister')}/><InteractiveMetric label="حفظ جديد" value={(teacherToday.students||[]).reduce((n:number,x:any)=>n+Number(x.new_records||0),0)} note="فتح سجل اليوم" onClick={()=>goTab('circleRegister')}/><InteractiveMetric label="المراجعة" value={(teacherToday.students||[]).reduce((n:number,x:any)=>n+Number(x.review_records||0),0)} note="فتح سجل اليوم" onClick={()=>goTab('circleRegister')}/></div>
              <div className="dailyApprovalGrid">{Array.from(new Map((teacherToday.students||[]).map((x:any)=>[x.circle_id,{id:x.circle_id,name:x.circle_name}])).values()).map((c:any)=>{const done=(teacherToday.approvals||[]).some((a:any)=>a.circle_id===c.id);return <article key={c.id}><div><b>{c.name}</b><small>{done?'تم اعتماد سجل اليوم':'بانتظار اعتماد اليوم'}</small></div><button className={done?'approvedDay':'primary'} disabled={done} onClick={()=>approveDay(c.id)}>{done?'معتمد ✓':'اعتماد اليوم'}</button></article>})}</div>
              <TeacherDailyTable data={teacherToday} date={dailyDate} onRefresh={()=>loadTeacherToday(dailyDate)} onProfile={openStudentProfile}/>{currentRole==='teacher'&&<form className="quickForm" onSubmit={async e=>{e.preventDefault();try{await apiPost('/api/ops?action=features&sub=guardian-link',Object.fromEntries(new FormData(e.currentTarget).entries()));e.currentTarget.reset();setError('تم ربط الطالب بولي الأمر.')}catch(x){setError(x instanceof Error?x.message:'تعذر الربط')}}}><h3>ربط ولي الأمر</h3><label className="field"><span>الطالب</span><select name="student_id" required><option value="">اختر الطالب</option>{students.map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></label><label className="field"><span>بريد أو جوال ولي الأمر</span><input name="guardian_lookup" required placeholder="البريد الإلكتروني أو رقم الجوال"/></label><button className="secondary">ربط ولي الأمر</button></form>}
            </>}
            {activeTab==='circleRegister'&&<>
              <div className="opsToolbar"><label className="field"><span>الشهر</span><input type="month" value={recordMonth} onChange={e=>{setRecordMonth(e.target.value);loadCircleRegister(e.target.value)}} /></label><button className="secondary" type="button" onClick={()=>loadCircleRegister()}>تحديث السجل</button></div>
              <CircleWeeklyRegister data={circleRegister} month={recordMonth} onProfile={openStudentProfile} onRefresh={()=>loadCircleRegister(recordMonth)}/>
            </>}
            {activeTab==='evaluations'&&<>
              <div className="opsToolbar"><label className="field"><span>من</span><input type="date" value={evaluationRange.from} onChange={e=>setEvaluationRange(x=>({...x,from:e.target.value}))} /></label><label className="field"><span>إلى</span><input type="date" value={evaluationRange.to} onChange={e=>setEvaluationRange(x=>({...x,to:e.target.value}))} /></label><button className="primary" type="button" onClick={()=>loadEvaluations()}>حساب التقييم</button></div>
              <div className="evaluationSummary"><div><span>المتوسط العام</span><b>{evaluations.average||0}%</b></div><p><strong>المعادلة:</strong> الحفظ الجديد 30% • المراجعة 40% • الحضور والانضباط 30%</p></div>
              <GenericTable rows={evaluations.rows||[]} columns={[[ 'full_name','الطالب'],['record_date','التاريخ'],['new_grade','الحفظ %'],['review_grade','المراجعة %'],['attendance_score','الانضباط'],['daily_score','النتيجة']]}/>
            </>}
            {activeTab==='studentProfile'&&<>
              {currentRole==='student'?<StudentQuranProfile data={studentProfile} month={recordMonth} onMonthChange={m=>{setRecordMonth(m);openStudentProfile('me',m)}} onRefresh={()=>openStudentProfile('me',recordMonth)}/>:<>
                {isStaff&&<div className="opsToolbar"><label className="field profileSelect"><span>اختر الطالب</span><select defaultValue="" onChange={e=>e.target.value&&openStudentProfile(e.target.value)}><option value="">اختر طالبًا...</option>{students.map(s=><option key={s.id} value={s.id}>{s.full_name} — {s.circle_name||'بدون حلقة'}</option>)}</select></label></div>}
                {!studentProfile?<div className="emptyState">اختر طالبًا لعرض ملفه القرآني.</div>:<>
                  <div className="studentProfileHero"><div><span>الطالب</span><h2>{studentProfile.student?.full_name}</h2><p>{studentProfile.student?.center_name||'—'} • {studentProfile.student?.circle_name||'بدون حلقة'}</p></div><label className="field"><span>الشهر</span><input type="month" value={recordMonth} onChange={e=>{const m=e.target.value;setRecordMonth(m);openStudentProfile(studentProfile.student.id,m)}} /></label></div>
                  <div className="kpis compactOpsKpis interactiveKpis"><InteractiveMetric label="الحضور" value={studentProfile.attendance?.total?Math.round(100*Number(studentProfile.attendance.attended||0)/Number(studentProfile.attendance.total)):0} suffix="%" note={`غياب ${studentProfile.attendance?.absent||0}`} onClick={()=>goTab('reports')}/><InteractiveMetric label="الحفظ الجديد" value={Number(studentProfile.quran?.new_sessions||0)} note={`${studentProfile.quran?.new_ayahs||0} آية`} onClick={()=>goTab('circleRegister')}/><InteractiveMetric label="المراجعة" value={Number(studentProfile.quran?.review_sessions||0)} note={`${studentProfile.quran?.review_ayahs||0} آية`} onClick={()=>goTab('circleRegister')}/><InteractiveMetric label="متوسط الأداء" value={Number(studentProfile.quran?.average_grade||0)} suffix="%" note="خلال الشهر" onClick={()=>goTab('evaluations')}/></div>
                  <h3>السجل القرآني الأخير</h3><GenericTable rows={studentProfile.recent||[]} columns={[[ 'record_date','التاريخ'],['record_type','النوع'],['surah_no','السورة'],['from_ayah','من آية'],['to_ayah','إلى آية'],['grade','الدرجة']]}/>
                  <h3 className="profileSubhead">الخطة الأسبوعية</h3><GenericTable rows={studentProfile.plans||[]} columns={[[ 'week_start','الأسبوع'],['day_name','اليوم'],['new_target','الجديد'],['review_target','المراجعة'],['goals','الأهداف']]}/>
                </>}
              </>}
            </>}
            {['selfService','motivation','competitions','notifications','operations','joinRequests'].includes(activeTab)&&<ExtendedOperations mode={activeTab as any} currentRole={currentRole} students={students} circles={circles} centers={centers}/>} 
            {['library','guardian','quranJourney','profile','reports'].includes(activeTab)&&<AgreedFeatures mode={activeTab as any} currentRole={currentRole} students={students}/>}
            {loadState!=='loading'&&activeTab==='news'&&<><form className="quickForm" onSubmit={e=>submitForm('/api/news',e)}><label className="field"><span>العنوان</span><input name="title" required /></label><label className="field"><span>النوع</span><select name="kind" defaultValue="news"><option value="news">خبر</option><option value="event">فعالية</option><option value="achievement">إنجاز</option><option value="media">وسائط</option></select></label><label className="field"><span>المحتوى</span><textarea name="body" rows={3}></textarea></label><label className="field"><span>صورة الخبر</span><input name="image_url" type="url" placeholder="https://..." /></label><label className="field"><span>رابط الفيديو</span><input name="video_url" type="url" placeholder="https://..." /></label><label className="field"><span>تاريخ الفعالية</span><input name="event_date" type="date" /></label><label className="field"><span>الحالة</span><select name="status" defaultValue="published"><option value="published">منشور</option><option value="draft">مسودة</option></select></label><button className="primary" type="submit">حفظ الخبر</button></form><GenericTable rows={news} columns={[[ 'title','العنوان'],['kind','النوع'],['event_date','التاريخ'],['status','الحالة']]}/></>}
          </div>
        </section>
      </div>}
      {(!code||publicMode)&&<footer><div><b>حلقات عاشور بخاري</b><p>منصة قرآنية للتعليم والمتابعة والإدارة.</p></div><div>جميع الحقوق محفوظة</div></footer>}
    </main>
  );
}

function GenericTable({rows,columns}:{rows:any[];columns:[string,string][]}){if(!rows.length)return <div className="empty">لا توجد بيانات مسجلة حتى الآن.</div>;const show=(r:any,k:string)=>k==='surah_no'&&r[k]!=null?madinahSurahName(Number(r[k])):typeof r[k]==='boolean'?(r[k]?'نعم':'لا'):(r[k]??'—');return <div className="table-wrap"><table><thead><tr>{columns.map(([k,l])=><th key={k}>{l}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.id||i}>{columns.map(([k])=><td key={k}>{show(r,k)}</td>)}</tr>)}</tbody></table></div>}

function ModuleCard({ icon, title, value, note }: { icon:string; title:string; value?:number; note:string }) { return <div className="module-card"><div className="module-icon">{icon}</div><div><strong>{title}</strong><p>{note}</p></div><b>{typeof value==='number'?<CountUp value={value}/>:'—'}</b></div>; }

function StatCard({ label, value }: { label: string; value?: number }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{typeof value === 'number' ? <CountUp value={value}/> : '—'}</strong>
    </div>
  );
}

function StudentsTable({ rows, circles, currentRole, onChanged }: { rows: StudentRow[]; circles: CircleRow[]; currentRole:string; onChanged:()=>Promise<void> }) {
  const [editing,setEditing]=useState<any>(null);
  if (!rows.length) return <div className="empty">لا توجد بيانات طلاب مطابقة.</div>;
  async function updateStudent(id:string,body:any){await apiPut('/api/students',{id,...body});await onChanged();}
  async function save(e:any){e.preventDefault();const fd=new FormData(e.currentTarget);await updateStudent(editing.id,Object.fromEntries(fd.entries()));setEditing(null)}
  return <><div className="table-wrap"><table><thead><tr><th>الاسم</th><th>البريد</th><th>الحلقة</th><th>المركز</th><th>الحالة</th><th>النقاط</th><th>التعديل</th></tr></thead>
    <tbody>{rows.map(row=><tr key={row.id}><td>{row.full_name}</td><td>{row.email||'—'}</td><td>{row.circle_name||'غير مسند'}</td><td>{row.center_name||'غير مسند'}</td><td>{row.status}</td><td>{row.points_balance??0}</td><td><button className="secondary" onClick={()=>setEditing(row)}>تعديل الملف</button></td></tr>)}</tbody></table></div>
    {editing&&<div className="panel editPanel"><div className="panelHead"><h3>تعديل ملف الطالب</h3><button className="secondary" onClick={()=>setEditing(null)}>إغلاق</button></div><form className="quickForm" onSubmit={save}>
      <label className="field"><span>اسم الطالب</span><input name="full_name" defaultValue={editing.full_name} required/></label>
      <label className="field"><span>المرحلة/المستوى</span><input name="grade_level" defaultValue={editing.grade_level||''}/></label>
      <label className="field"><span>تاريخ الميلاد</span><input name="birth_date" type="date" defaultValue={editing.birth_date?String(editing.birth_date).slice(0,10):''}/></label>
      <label className="field"><span>الحالة</span><select name="status" defaultValue={editing.status||'active'}><option value="active">نشط</option><option value="excused">مستأذن</option><option value="suspended">موقوف</option></select></label>
      {currentRole!=='teacher'&&<label className="field"><span>الحلقة</span><select name="circle_id" defaultValue={editing.circle_id||''}><option value="">غير مسند</option>{circles.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
      <button className="primary">حفظ التعديلات</button>
    </form></div>}
  </>;
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




