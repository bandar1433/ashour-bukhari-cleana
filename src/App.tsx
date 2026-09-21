import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { api, auth } from './lib/compat';
import { formatQuranTarget, getMadinahPage, planModes, surahs } from './quranReference';
import './index.css';

type Row = { id: string; [key: string]: any };
type Account = { id: string; full_name: string; role: string; email: string };
const roles: Record<string, string> = {
  system_admin: 'مدير النظام',
  center_manager: 'مدير المركز',
  supervisor: 'المشرف',
  teacher: 'المعلم',
  student: 'الطالب',
  guardian: 'ولي الأمر',
};
const statuses: Record<string, string> = {
  active: 'نشط',
  excused: 'مستأذن',
  suspended: 'موقوف',
  present: 'حاضر',
  late: 'متأخر',
  absent: 'غائب',
};
const recordTypes: Record<string, string> = {
  new: 'حفظ جديد',
  review: 'مراجعة',
  recitation: 'تسميع',
};
const studentTracks = ['الطلاب من أهل مكة', 'الطلاب الوافدون'];
const quranTracks = ['مسار التهجي والتلقين','مسار حفظ القرآن للأشبال','مسار حفظ القرآن للشباب','مسار حفظ القرآن والمتون','مسار القراءات'];
// صور التقرير السنوي 1447هـ تُرفع عبر موارد AppDeploy وتظهر في الأقسام العامة.
const report1447 = { stats: [['447','طالبًا'],['18','معلمًا'],['17','مساعدًا'],['16','حلقة'],['61','جنسية']], news: [['رحلة المدينة المنورة','رحلة إيمانية علمية تربوية لنحو 50 طالبًا من طلاب الحلقات خلال إجازة الصيف.','./resources/report-madinah.png'],['إفطار صائم','لقاء إيماني واجتماعي يجمع طلاب الحلقات ويعزز الأخوة والتواصل.','./resources/report-iftar.png'],['البرنامج الترويحي','أنشطة تربوية واجتماعية مصاحبة تعزز الألفة بين طلاب الحلقات.','./resources/report-recreation.png'],['مجالس ختم القرآن والقراءات','مجالس دورية لختم كتاب الله وإتمام القراءات وربط الطلاب بالقرآن تلاوةً وإتقانًا.','./resources/report-khatm.png'],['برنامج المعايدة','برنامج اجتماعي قرآني يجمع الأساتذة والطلاب والخريجين ويعزز الأخوة والتواصل.','./resources/report-eid.png']], achievements: [['إنجاز عالمي','تحقيق الطالب أنس الحازمي المركز الثاني على مستوى العالم الإسلامي.','./resources/report-achievement-anas.png'],['المركز الثاني عالميًا','فوز الطالب أحمد كريم بالمركز الثاني في المسابقة العالمية للقرآن الكريم في روسيا.','./resources/report-achievement-russia.png'],['إنجاز دولي','فوز أحمد كريم في مسابقة تنزانيا الدولية لحفظ القرآن الكريم وتلاوته.','./resources/report-achievement-tanzania.png'],['المركز الأول على مستوى المملكة','فوز الطالب عمر بن محمد أشرف بالمركز الأول في فرع كامل القرآن في مسابقة وزارة التعليم.','./resources/report-achievement-omar.png']] };
const publicNav = [
  'الرئيسية',
  'عن الحلقات',
  'الحلقات القرآنية',
  'المعلمون',
  'الطلاب',
  'الإنجازات',
  'الأخبار والفعاليات',
  'الوسائط',
  'تواصل معنا',
];
const fallbackNews: Row[] = [
  {
    id: 'welcome',
    title: 'مرحباً بكم في منصة حلقات عاشور بخاري',
    body: 'منصة موحدة لإدارة العمل التعليمي ومتابعة مسيرة الطلاب.',
    published_at: '2026-09-16',
  },
  {
    id: 'memorization',
    title: 'برنامج متابعة الحفظ والمراجعة',
    body: 'خطط يومية واضحة وإحصاءات تساعد على تحقيق أهداف كل طالب.',
    published_at: 'قريباً',
  },
  {
    id: 'family-reports',
    title: 'تقارير الأسرة',
    body: 'ملخصات دقيقة لولي الأمر عن الحضور والإنجاز.',
    published_at: 'قريباً',
  },
];
const objectives = [
  ['01', 'إتقان التلاوة والحفظ', 'بناء قراءة صحيحة وحفظ متدرج يقوم على الإتقان والمراجعة المستمرة.'],
  ['02', 'تعميق الصلة بالقرآن', 'تربية الطالب على ملازمة كتاب الله وتعظيمه وتحويل التعلم إلى أثر في السلوك.'],
  ['03', 'متابعة فردية دقيقة', 'خطة واضحة لكل طالب مع رصد الحضور والإنجاز والتسميع بصورة منتظمة.'],
  ['04', 'تمكين المعلم', 'توفير أدوات عملية تساعد المعلم على إدارة الحلقة وقياس تقدم طلابه بوضوح.'],
  ['05', 'تعزيز شراكة الأسرة', 'إتاحة تقارير مختصرة وواضحة تعين الأسرة على متابعة مسيرة الطالب وتشجيعه.'],
  ['06', 'التحفيز والاستدامة', 'بناء بيئة مشجعة بالنقاط والجوائز والإنجازات بما يحافظ على الدافعية والاستمرار.'],
];
const values = [
  ['الإخلاص', 'نستحضر شرف خدمة كتاب الله وابتغاء الأجر في التعليم والتعلم.'],
  ['الإتقان', 'نعتمد الجودة والدقة في التلاوة والحفظ والمتابعة والتقويم.'],
  ['الرحمة', 'نبني علاقة تعليمية راشدة تجمع الرفق والاحتواء والتوجيه.'],
  ['القدوة', 'نجعل السلوك القرآني جزءاً أصيلاً من شخصية المعلم والمتعلم.'],
  ['الانضباط', 'نلتزم بالمواعيد والخطط والمتابعة المنتظمة لتحقيق نتائج قابلة للقياس.'],
  ['التعاون', 'نعزز الشراكة بين الإدارة والمعلم والطالب والأسرة لخدمة المسيرة القرآنية.'],
];
const journey = [
  ['01', 'التهيئة', 'تحديد المستوى وربط الطالب بحلقته وخطته المناسبة.'],
  ['02', 'التعلّم', 'تصحيح التلاوة وبناء الحفظ الجديد وفق مسار متدرج.'],
  ['03', 'التثبيت', 'مراجعة وتسميع مستمران مع تسجيل الإنجاز اليومي.'],
  ['04', 'القياس', 'تقارير ومؤشرات ونقاط تساعد على تحسين الأداء واستدامته.'],
];
function AboutSections({ detailed = false }: { detailed?: boolean }) {
  return (
    <>
      <section id="about" className="sectionPro aboutIntro reveal reveal-up">
        <div className="aboutCopy">
          <span className="sectionLabel">عن حلقات عاشور بخاري</span>
          <h2>بيئة قرآنية تربوية تصنع صلة مستمرة بكتاب الله</h2>
          <p>
            حلقات عاشور بخاري منظومة تعليمية قرآنية تُعنى بتعليم التلاوة الصحيحة،
            والحفظ المتقن، والمراجعة المنتظمة، مع متابعة تربوية وإدارية تجمع
            الطالب والمعلم والأسرة في مسار واحد واضح وقابل للقياس.
          </p>
          <p>
            وتستفيد الحلقات من المنصة الرقمية في تنظيم المراكز والحلقات، وتوثيق
            الحضور والإنجاز والتسميع، وإصدار التقارير، وتحفيز الطلاب؛ ليبقى
            التعليم القرآني قريباً، منظماً، ومستمراً.
          </p>
          {detailed && (
            <div className="aboutNote">
              <b>جوهر العمل</b>
              <span>تعليم القرآن بإتقان، وتربيةٌ على هدايته، ومتابعةٌ تحفظ أثره.</span>
            </div>
          )}
        </div>
        <div className="identityStack">
          <article className="identityCard visionCard">
            <span>الرؤية</span>
            <h3>بيئة قرآنية رائدة في بناء قارئ متقن متصل بكتاب الله.</h3>
          </article>
          <article className="identityCard missionCard">
            <span>الرسالة</span>
            <h3>تعليم قرآني منظم يجمع الإتقان والتربية والمتابعة والتقنية.</h3>
          </article>
        </div>
      </section>
      <section className="sectionPro objectivesSection">
        <div className="sectionHeading reveal reveal-up">
          <span className="sectionLabel">أهدافنا</span>
          <h2>أهداف واضحة تتحول إلى ممارسة يومية</h2>
          <p>نركز على جودة التعلم واستمراره، لا على الحفظ المجرد وحده.</p>
        </div>
        <div className="objectivesGrid">
          {objectives.map(([number, title, text], index) => (
            <article
              className="objectiveCard reveal reveal-up"
              style={{ animationDelay: `${0.08 + index * 0.06}s` }}
              key={title}
            >
              <span className="objectiveNumber">{number}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="valuesSection">
        <div className="sectionPro">
          <div className="sectionHeading lightHeading reveal reveal-up">
            <span className="sectionLabel">قيمنا</span>
            <h2>قيم تحكم التعليم والعلاقة والأثر</h2>
          </div>
          <div className="valuesGrid">
            {values.map(([title, text], index) => (
              <article
                className="valueCard reveal reveal-up"
                style={{ animationDelay: `${0.08 + index * 0.06}s` }}
                key={title}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="sectionPro journeySection">
        <div className="sectionHeading reveal reveal-up">
          <span className="sectionLabel">مسيرة الطالب</span>
          <h2>رحلة تعليمية مترابطة من البداية إلى التقرير</h2>
        </div>
        <div className="journeyTrack">
          {journey.map(([number, title, text], index) => (
            <article className="journeyStep reveal reveal-up" key={title}>
              <div className="journeyNumber">{number}</div>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
              {index < journey.length - 1 && <span className="journeyArrow">←</span>}
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
const get = async (path: string) => (await api.get(path)).data;
const post = async (path: string, data: unknown) =>
  (await api.post(path, data)).data;
function message(e: unknown) {
  const err = e as {
    response?: { data?: { message?: string; error?: string } };
    message?: string;
    code?: string;
  };
  if (err.code === 'popup_blocked')
    return 'اسمح بالنوافذ المنبثقة لإكمال تسجيل الدخول.';
  if (err.code === 'popup_closed')
    return 'أُغلقت نافذة الدخول؛ يمكنك المحاولة مجدداً.';
  return (
    err.response?.data?.message ||
    err.response?.data?.error ||
    err.message ||
    'تعذر إتمام العملية'
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Pick({
  rows,
  value,
  onChange,
  label = 'اختر',
  required = true,
}: {
  rows: Row[];
  value: string;
  onChange: (v: string) => void;
  label?: string;
  required?: boolean;
}) {
  return (
    <select
      required={required}
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      <option value="">{label}</option>
      {rows.map(r => (
        <option key={r.id} value={r.id}>
          {r.full_name || r.name}
        </option>
      ))}
    </select>
  );
}
function Table({ heads, rows }: { heads: string[]; rows: ReactNode[][] }) {
  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            {heads.map(h => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r, i) => (
              <tr key={i}>
                {r.map((v, j) => (
                  <td key={j}>{v}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={heads.length}>لا توجد سجلات بعد.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
export default function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [dashboard, setDashboard] = useState(false);
  const [view, setView] = useState('الرئيسية');
  const [panel, setPanel] = useState('نظرة عامة');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState<boolean | null>(null);
  const [students, setStudents] = useState<Row[]>([]);
  const [studentFilter, setStudentFilter] = useState<'all' | 'unassigned' | 'assigned'>('all');
  const [centers, setCenters] = useState<Row[]>([]);
  const [circles, setCircles] = useState<Row[]>([]);
  const [users, setUsers] = useState<Row[]>([]);
  const [loginRequests, setLoginRequests] = useState<Row[]>([]);
  const [news, setNews] = useState<Row[]>([]);
  const [newsIndex, setNewsIndex] = useState(0);
  const [rewards, setRewards] = useState<Row[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [attendance, setAttendance] = useState<Row[]>([]);
  const [day, setDay] = useState(today());
  const [report, setReport] = useState<any>(null);
  const [weeklyPlans, setWeeklyPlans] = useState<Row[]>([]);
  const [holidays, setHolidays] = useState<Row[]>([]);
  const [evaluations, setEvaluations] = useState<any>(null);
  const [notifications, setNotifications] = useState<Row[]>([]);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [managementReport, setManagementReport] = useState<any>(null);
  const [planProgress, setPlanProgress] = useState<Row[]>([]);
  const [teacherToday, setTeacherToday] = useState<any>(null);
  const [circleRegister, setCircleRegister] = useState<any>(null);
  const [motivation, setMotivation] = useState<any>(null);
  const [motivationStudent, setMotivationStudent] = useState('');
  const [recordMonth, setRecordMonth] = useState(today().slice(0,7));
  const [studentProfile, setStudentProfile] = useState<any>(null);
  const [rankings, setRankings] = useState<Row[]>([]);
  const [competitions, setCompetitions] = useState<Row[]>([]);
  const [readiness, setReadiness] = useState<any>(null);
  const [operationalSettings, setOperationalSettings] = useState<any>(null);
  const [adminRoles, setAdminRoles] = useState<any>({roles:[],permissions:[]});
  const [auditRows, setAuditRows] = useState<Row[]>([]);
  const [siteImages, setSiteImages] = useState<Record<string,string>>({});
  const [quranRoster, setQuranRoster] = useState<Record<string, Record<string, string>>>({});
  const [quranAyahs, setQuranAyahs] = useState<{ayah:number;page:number}[]>([]);
  const admin = account?.role === 'system_admin';
  const manager = admin || account?.role === 'center_manager';
  const staff =
    !!account &&
    ['system_admin', 'center_manager', 'supervisor', 'teacher'].includes(
      account.role
    );
  const set = (key: string, value: string) =>
    setForm(f => ({ ...f, [key]: value }));
  const imageUrl = (key: string, fallback: string) => siteImages[key] || fallback;
  const siteImageSlots = [['talqeen','مسار التلقين والتهجي'],['hifz','مسار حفظ القرآن'],['itqan','مسار الإتقان'],['qiraat','مسار القراءات العشر'],['nationalities','خريطة الجنسيات'],['madinah','رحلة المدينة المنورة'],['madinah-group','صورة طلاب المدينة'],['iftar','إفطار صائم'],['recreation','البرنامج الترويحي'],['khatm','مجالس الختم'],['eid','برنامج المعايدة'],['achievement-anas','إنجاز أنس الحازمي'],['achievement-russia','إنجاز روسيا'],['achievement-tanzania','إنجاز تنزانيا'],['achievement-omar','إنجاز عمر محمد أشرف'],['photo-1','صورة عامة 1'],['photo-2','صورة عامة 2']];
  const uploadSiteImage = (key: string, file?: File) => { if(!file) return; if(!['image/png','image/jpeg','image/webp'].includes(file.type)){setNotice('اختر صورة PNG أو JPG أو WEBP');return;} if(file.size>7_000_000){setNotice('حجم الصورة يجب ألا يتجاوز 7 ميجابايت');return;} const reader=new FileReader(); reader.onload=()=>run(async()=>{const data=String(reader.result||''); const content=data.split(',')[1]||''; const saved=await post(`/api/site-images/${key}`,{content,contentType:file.type}); setSiteImages(x=>({...x,[key]:saved.url}));},'تم تحديث الصورة'); reader.readAsDataURL(file); };
  const quranPlanFields = (prefix: 'new' | 'review', title: string) => {
    const mode = form[`${prefix}_mode`] || 'page';
    const surahNo = Number(form[`${prefix}_surah`] || 1);
    const max = mode === 'page' ? 604 : mode === 'juz' ? 30 : mode === 'hizb' ? 60 : mode === 'quarter' ? 240 : Number(surahs[surahNo - 1]?.[1] || 7);
    const options = Array.from({ length: max }, (_, i) => i + 1);
    return <fieldset className='quranPlan'><legend>{title}</legend><Field label='طريقة التحديد'><select value={mode} onChange={e=>setForm(f=>({...f,[`${prefix}_mode`]:e.target.value,[`${prefix}_from`]:'1',[`${prefix}_to`]:'1'}))}>{planModes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>{mode === 'surah' && <Field label='السورة'><select value={surahNo} onChange={e=>setForm(f=>({...f,[`${prefix}_surah`]:e.target.value,[`${prefix}_from`]:'1',[`${prefix}_to`]:'1'}))}>{surahs.map(([name],i)=><option key={name} value={i+1}>{i+1}. {name}</option>)}</select></Field>}<div className='planRange'><Field label={mode==='page'?'من الصفحة':mode==='surah'?'من الآية':'من'}><select value={form[`${prefix}_from`] || '1'} onChange={e=>set(`${prefix}_from`,e.target.value)}>{options.map(n=><option key={n} value={n}>{n}</option>)}</select></Field><Field label={mode==='page'?'إلى الصفحة':mode==='surah'?'إلى الآية':'إلى'}><select value={form[`${prefix}_to`] || '1'} onChange={e=>set(`${prefix}_to`,e.target.value)}>{options.filter(n=>n>=Number(form[`${prefix}_from`]||1)).map(n=><option key={n} value={n}>{n}</option>)}</select></Field></div></fieldset>;
  }; 
  const run = async (action: () => Promise<void>, success = '') => {
    if (busy) return;
    setBusy(true);
    setNotice('');
    try {
      await action();
      if (success) setNotice(success);
    } catch (e) {
      setNotice(message(e));
    } finally {
      setBusy(false);
    }
  };
  const refresh = async (a: Account) => {
    const isStaff = [
      'system_admin',
      'center_manager',
      'supervisor',
      'teacher',
    ].includes(a.role);
    const isManager = ['system_admin', 'center_manager'].includes(a.role);
    const [s, c, h, u, r, lr] = await Promise.all([
      get('/api/students'),
      isStaff ? get('/api/centers') : [],
      isStaff ? get('/api/circles') : [],
      isManager ? get('/api/users') : [],
      get('/api/rewards'),
      a.role === 'system_admin' ? get('/api/login-requests') : [],
    ]);
    setStudents(s);
    setCenters(c);
    setCircles(h);
    setUsers(u);
    setRewards(r);
    setLoginRequests(lr);
  };
  const loadSession = async (openDashboard = true) => {
    const identity = await auth.getUser();
    if (!identity) return;
    if (identity.email?.toLowerCase() === 'bandar143376@gmail.com')
      await post('/api/bootstrap', {});
    const a = await post('/api/session', {});
    if (a.role === 'system_admin') { await post('/api/features/setup', {}); try { await post('/api/motivation/seed-thabit', {}); } catch {} }
    await refresh(a);
    setAccount(a);
    if (openDashboard) setDashboard(true);
  };
  const login = () =>
    run(async () => {
      await auth.signIn({ scope: 'openid email profile offline_access' });
      await loadSession();
    });
  const leaveDashboard = () => {
    setDashboard(false);
    setView('الرئيسية');
  };
  const logout = () =>
    run(async () => {
      await auth.signOut();
      setAccount(null);
      setDashboard(false);
      setView('الرئيسية');
      setStudents([]);
      setCenters([]);
      setCircles([]);
      setUsers([]);
      setReport(null);
      setAttendance([]);
      setRewards([]);
    });
  const checkConnection = async () => {
    const s = await get('/api/status');
    setConnection(s.configured);
    if (s.configured) setNews(await get('/api/news'));
  };
  useEffect(() => {
    checkConnection()
      .then(() => {
        if (auth.isSignedIn()) return loadSession();
      })
      .catch(e => setNotice(message(e)));
  }, []);
  const newsSlides = news.length ? news : fallbackNews;
  const activeNews = newsSlides[newsIndex % newsSlides.length];
  useEffect(() => {
    if (dashboard || view !== 'الرئيسية' || newsSlides.length < 2) return;
    const timer = window.setInterval(() => {
      setNewsIndex(i => (i + 1) % newsSlides.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [dashboard, view, newsSlides.length]);
  useEffect(() => {
    if (newsIndex >= newsSlides.length) setNewsIndex(0);
  }, [newsIndex, newsSlides.length]);
  useEffect(() => {
    let current = true;
    if (account && panel === 'الحضور اليومي')
      get(`/api/attendance?date=${day}`)
        .then(a => {
          if (current) setAttendance(a);
        })
        .catch(e => {
          if (current) setNotice(message(e));
        });
    return () => {
      current = false;
    };
  }, [account, panel, day]);
  useEffect(() => { get('/api/site-images').then(setSiteImages).catch(()=>{}); }, []);
  useEffect(() => {
    if (!account) return;
    if (panel === 'الخطة الأسبوعية') get(`/api/weekly-plans?week=${form.week_start || today()}`).then(setWeeklyPlans).catch(e => setNotice(message(e)));
    if (panel === 'الإجازات والعطل') get('/api/holidays').then(setHolidays).catch(e => setNotice(message(e)));
    if (panel === 'التقييم والإنجاز') get(`/api/evaluations?from=${form.from || today()}&to=${form.to || today()}`).then(setEvaluations).catch(e => setNotice(message(e)));
    if (panel === 'الإشعارات') get('/api/notifications').then(setNotifications).catch(e => setNotice(message(e)));
    if (panel === 'نظرة عامة') get('/api/dashboard').then(setDashboardStats).catch(e => setNotice(message(e)));
    if (panel === 'الخطة الأسبوعية') get(`/api/plan-progress?week=${form.week_start || today()}`).then(setPlanProgress).catch(e => setNotice(message(e)));
    if (panel === 'لوحة المعلم اليومية') get(`/api/teacher/today?date=${day}`).then(setTeacherToday).catch(e => setNotice(message(e)));
    if (panel === 'سجل الحلقة') get(`/api/circle-register?month=${recordMonth}`).then(setCircleRegister).catch(e => setNotice(message(e)));
    if (panel === 'التحفيز والجوائز' || panel === 'نقاطي وجوائزي') get(`/api/motivation?month=${recordMonth}${motivationStudent?`&student_id=${motivationStudent}`:''}`).then(setMotivation).catch(e=>setNotice(message(e)));
    if (panel === 'الترتيب والتحفيز') get('/api/rankings').then(setRankings).catch(e => setNotice(message(e)));
    if (panel === 'المسابقات') get('/api/competitions').then(setCompetitions).catch(e => setNotice(message(e)));
    if (panel === 'جاهزية التشغيل') get('/api/readiness').then(setReadiness).catch(e => setNotice(message(e)));
    if (panel === 'الإعدادات' && manager) get('/api/operational-settings').then(x=>{setOperationalSettings(x);setForm(f=>({...f,...Object.fromEntries(Object.entries(x).filter(([,v])=>typeof v==='number').map(([k,v])=>[k,String(v)]))}));}).catch(e => setNotice(message(e)));
    if (panel === 'الأدوار والصلاحيات' && admin) get('/api/admin/roles').then(setAdminRoles).catch(e=>setNotice(message(e)));
    if (panel === 'سجل العمليات' && admin) get('/api/admin/audit').then(setAuditRows).catch(e=>setNotice(message(e)));
    if (panel === 'سجلي اليومي' && account.role === 'student' && students[0]) get(`/api/student-profile/${students[0].id}`).then(setStudentProfile).catch(e=>setNotice(message(e)));
  }, [account, panel]);
  const submit = (path: string, payload: unknown) => async (e: FormEvent) => {
    e.preventDefault();
    await run(async () => {
      await post(path, payload);
      await refresh(account!);
      setForm({});
    }, 'تم الحفظ بنجاح');
  };
  const input = (
    key: string,
    label: string,
    type = 'text',
    required = true
  ) => (
    <Field label={label}>
      <input
        required={required}
        type={type}
        value={form[key] || ''}
        onChange={e => set(key, e.target.value)}
      />
    </Field>
  );
  const centerPick = (
    <Field label="المركز">
      <Pick
        rows={centers}
        value={form.center_id || ''}
        onChange={v => {
          setForm(f => ({
            ...f,
            center_id: v,
            circle_id: '',
            teacher_user_id: '',
          }));
        }}
      />
    </Field>
  );
  const studentPick = (
    <Field label='الطالب'>
      <Pick rows={students} value={form.student_id || ''} onChange={v => { set('student_id', v); setReport(null); }} label={students.length ? `اختر الطالب — ${students.length} طالب` : 'لا يوجد طلاب في نطاقك'} />
    </Field>
  );
  const loadSurahAyahs = async (surahNo: number) => { setQuranAyahs([]); const data=await get(`/api/quran/surah-pages?surah=${surahNo}`); setQuranAyahs(data.ayahs || []); };
  const quranRecordFields = <><Field label='السورة'><select required value={form.surah_no || ''} onChange={e=>{const value=e.target.value;setForm(f=>({...f,surah_no:value,from_ayah:'',to_ayah:''}));loadSurahAyahs(Number(value)).catch(x=>setNotice(message(x)));}}><option value=''>اختر السورة</option>{surahs.map(([name,count],i)=><option key={name} value={i+1}>{name} — {count} آية</option>)}</select></Field><Field label='من الآية'><select required disabled={!form.surah_no || !quranAyahs.length} value={form.from_ayah || ''} onChange={e=>setForm(f=>({...f,from_ayah:e.target.value,to_ayah:e.target.value}))}><option value=''>اختر بداية المقطع</option>{quranAyahs.map(x=><option key={x.ayah} value={x.ayah}>صفحة {x.page} — الآية {x.ayah}</option>)}</select></Field><Field label='إلى الآية'><select required disabled={!form.from_ayah} value={form.to_ayah || ''} onChange={e=>set('to_ayah',e.target.value)}><option value=''>اختر نهاية المقطع</option>{quranAyahs.filter(x=>x.ayah>=Number(form.from_ayah||0)).map(x=><option key={x.ayah} value={x.ayah}>صفحة {x.page} — الآية {x.ayah}</option>)}</select></Field>{form.from_ayah && form.to_ayah && <div className='mushafRange'><b>المقطع المختار</b><span>صفحات مصحف المدينة: {quranAyahs.find(x=>x.ayah===Number(form.from_ayah))?.page}–{quranAyahs.find(x=>x.ayah===Number(form.to_ayah))?.page}</span><small>سورة {surahs[Number(form.surah_no)-1]?.[0]} — الآيات {form.from_ayah}–{form.to_ayah}</small></div>}</>;
  const surahPages = (surahNo: number) =>
    surahNo
      ? Array.from(
          new Set(
            Array.from(
              { length: Number(surahs[surahNo - 1]?.[1] || 0) },
              (_, i) => getMadinahPage(surahNo, i + 1)
            )
          )
        )
      : [];
  const ayahsOnPage = (surahNo: number, page: number) =>
    surahNo && page
      ? Array.from(
          { length: Number(surahs[surahNo - 1]?.[1] || 0) },
          (_, i) => i + 1
        ).filter(ayah => getMadinahPage(surahNo, ayah) === page)
      : [];
  const studentReviewEntry = () => {
    const fromSurah = Number(form.review_from_surah || 0);
    const toSurah = Number(form.review_to_surah || fromSurah || 0);
    const fromPage = Number(form.review_from_page || 0);
    const toPage = Number(form.review_to_page || 0);
    const fromPages = surahPages(fromSurah);
    const toPages = surahPages(toSurah).filter(
      page => toSurah !== fromSurah || !fromPage || page >= fromPage
    );
    const fromAyahs = ayahsOnPage(fromSurah, fromPage);
    const toAyahs = ayahsOnPage(toSurah, toPage).filter(
      ayah =>
        toSurah !== fromSurah ||
        toPage !== fromPage ||
        !form.review_from_ayah ||
        ayah >= Number(form.review_from_ayah)
    );
    const pageCount = fromPage && toPage ? Math.max(1, toPage - fromPage + 1) : 0;
    const fromLabel = fromSurah
      ? `سورة ${surahs[fromSurah - 1]?.[0]}${fromPage ? `، صفحة ${fromPage}` : ''}${form.review_from_ayah ? `، آية ${form.review_from_ayah}` : ''}`
      : 'لم تُحدد البداية';
    const toLabel = toSurah
      ? `سورة ${surahs[toSurah - 1]?.[0]}${toPage ? `، صفحة ${toPage}` : ''}${form.review_to_ayah ? `، آية ${form.review_to_ayah}` : ''}`
      : 'لم تُحدد النهاية';
    return (
      <div className='selfBlock reviewSelfBlock'>
        <h4>3. المراجعة</h4>
        <p className='muted'>حدد بداية المراجعة ونهايتها. رقم الآية اختياري في الطرفين.</p>
        <form
          onSubmit={e => {
            e.preventDefault();
            if (!fromSurah || !fromPage || !toSurah || !toPage) {
              setNotice('اختر سورة وصفحة البداية وسورة وصفحة النهاية');
              return;
            }
            if (toSurah < fromSurah || (toSurah === fromSurah && toPage < fromPage)) {
              setNotice('نهاية المراجعة يجب أن تكون بعد بدايتها');
              return;
            }
            const startAyahs = ayahsOnPage(fromSurah, fromPage);
            const endAyahs = ayahsOnPage(toSurah, toPage);
            const firstAyah = Number(form.review_from_ayah) || startAyahs[0];
            const lastAyah = Number(form.review_to_ayah) || endAyahs[endAyahs.length - 1];
            if (!firstAyah || !lastAyah) {
              setNotice('تعذر تحديد آيات الصفحة المختارة');
              return;
            }
            if (
              fromSurah === toSurah &&
              fromPage === toPage &&
              lastAyah < firstAyah
            ) {
              setNotice('آية النهاية يجب أن تكون بعد آية البداية');
              return;
            }
            run(async () => {
              const rangeNote = `تسجيل الطالب الذاتي — المراجعة: من ${fromLabel} إلى ${toLabel}`;
              for (let surahNo = fromSurah; surahNo <= toSurah; surahNo += 1) {
                const start = surahNo === fromSurah ? firstAyah : 1;
                const end =
                  surahNo === toSurah
                    ? lastAyah
                    : Number(surahs[surahNo - 1]?.[1] || 1);
                await post('/api/memorization', {
                  student_id: students[0].id,
                  record_type: 'review',
                  record_date: day,
                  surah_no: surahNo,
                  from_ayah: start,
                  to_ayah: end,
                  grade: null,
                  notes: rangeNote,
                });
              }
              setStudentProfile(await get(`/api/student-profile/${students[0].id}`));
            }, 'تم حفظ المراجعة');
          }}
        >
          <div className='studentReviewRange'>
            <div className='studentRangeSide'>
              <h5>مِن</h5>
              <Field label='اسم السورة'>
                <select
                  className='studentInput'
                  required
                  value={form.review_from_surah || ''}
                  onChange={e => {
                    const value = e.target.value;
                    setForm(f => ({
                      ...f,
                      review_from_surah: value,
                      review_from_page: '',
                      review_from_ayah: '',
                      review_to_surah:
                        !f.review_to_surah || Number(f.review_to_surah) < Number(value)
                          ? value
                          : f.review_to_surah,
                      review_to_page: '',
                      review_to_ayah: '',
                    }));
                  }}
                >
                  <option value=''>اختر السورة</option>
                  {surahs.map(([name], i) => (
                    <option key={name} value={i + 1}>{name}</option>
                  ))}
                </select>
              </Field>
              <Field label='رقم الصفحة'>
                <select
                  className='studentInput'
                  required
                  disabled={!fromSurah}
                  value={form.review_from_page || ''}
                  onChange={e =>
                    setForm(f => ({
                      ...f,
                      review_from_page: e.target.value,
                      review_from_ayah: '',
                      review_to_page:
                        Number(f.review_to_surah || fromSurah) === fromSurah &&
                        Number(f.review_to_page || 0) < Number(e.target.value)
                          ? ''
                          : f.review_to_page,
                      review_to_ayah: '',
                    }))
                  }
                >
                  <option value=''>اختر الصفحة</option>
                  {fromPages.map(page => (
                    <option key={page} value={page}>صفحة {page}</option>
                  ))}
                </select>
              </Field>
              <Field label='رقم الآية — اختياري'>
                <select
                  className='studentInput'
                  disabled={!fromPage}
                  value={form.review_from_ayah || ''}
                  onChange={e => set('review_from_ayah', e.target.value)}
                >
                  <option value=''>من أول الصفحة</option>
                  {fromAyahs.map(ayah => (
                    <option key={ayah} value={ayah}>الآية {ayah}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className='studentRangeSide'>
              <h5>إلى</h5>
              <Field label='اسم السورة'>
                <select
                  className='studentInput'
                  required
                  disabled={!fromSurah}
                  value={form.review_to_surah || ''}
                  onChange={e =>
                    setForm(f => ({
                      ...f,
                      review_to_surah: e.target.value,
                      review_to_page: '',
                      review_to_ayah: '',
                    }))
                  }
                >
                  <option value=''>اختر السورة</option>
                  {surahs.map(([name], i) => (
                    <option key={name} value={i + 1} disabled={i + 1 < fromSurah}>
                      {name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label='رقم الصفحة'>
                <select
                  className='studentInput'
                  required
                  disabled={!toSurah}
                  value={form.review_to_page || ''}
                  onChange={e =>
                    setForm(f => ({
                      ...f,
                      review_to_page: e.target.value,
                      review_to_ayah: '',
                    }))
                  }
                >
                  <option value=''>اختر الصفحة</option>
                  {toPages.map(page => (
                    <option key={page} value={page}>صفحة {page}</option>
                  ))}
                </select>
              </Field>
              <Field label='رقم الآية — اختياري'>
                <select
                  className='studentInput'
                  disabled={!toPage}
                  value={form.review_to_ayah || ''}
                  onChange={e => set('review_to_ayah', e.target.value)}
                >
                  <option value=''>إلى آخر الصفحة</option>
                  {toAyahs.map(ayah => (
                    <option key={ayah} value={ayah}>الآية {ayah}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
          {fromSurah && fromPage && toSurah && toPage && (
            <div className='studentReviewSummary'>
              <b>المراجعة المختارة</b>
              <span>{fromLabel} ← {toLabel}</span>
              <small>{pageCount} {pageCount === 1 ? 'صفحة' : 'صفحات'} تقريبًا</small>
            </div>
          )}
          <button className='primary' disabled={busy}>حفظ المراجعة</button>
        </form>
      </div>
    );
  };
  const studentNewEntry = () => {
    const surahNo = Number(form.new_surah || 0);
    const page = Number(form.new_page || 0);
    const ayahs = ayahsOnPage(surahNo, page);
    const pages = surahPages(surahNo);
    return (
      <div className='selfBlock'>
        <h4>4. الحفظ الجديد</h4>
        <form
          onSubmit={e => {
            e.preventDefault();
            if (!surahNo || !page) {
              setNotice('اختر السورة والصفحة');
              return;
            }
            const from = Number(form.new_from) || ayahs[0];
            const to = Number(form.new_to) || ayahs[ayahs.length - 1];
            run(async () => {
              await post('/api/memorization', {
                student_id: students[0].id,
                record_type: 'new',
                record_date: day,
                surah_no: surahNo,
                from_ayah: from,
                to_ayah: to,
                grade: null,
                notes: 'تسجيل الطالب الذاتي',
              });
              setStudentProfile(await get(`/api/student-profile/${students[0].id}`));
            }, 'تم حفظ الحفظ الجديد');
          }}
        >
          <Field label='السورة'>
            <select
              className='studentInput'
              required
              value={form.new_surah || ''}
              onChange={e =>
                setForm(f => ({
                  ...f,
                  new_surah: e.target.value,
                  new_page: '',
                  new_from: '',
                  new_to: '',
                }))
              }
            >
              <option value=''>اختر السورة</option>
              {surahs.map(([name], i) => (
                <option key={name} value={i + 1}>{name}</option>
              ))}
            </select>
          </Field>
          <Field label='الصفحة'>
            <select
              className='studentInput'
              required
              disabled={!surahNo}
              value={form.new_page || ''}
              onChange={e =>
                setForm(f => ({
                  ...f,
                  new_page: e.target.value,
                  new_from: '',
                  new_to: '',
                }))
              }
            >
              <option value=''>اختر الصفحة</option>
              {pages.map(pageNo => (
                <option key={pageNo} value={pageNo}>صفحة {pageNo}</option>
              ))}
            </select>
          </Field>
          <Field label='من الآية — اختياري'>
            <select
              className='studentInput'
              disabled={!page}
              value={form.new_from || ''}
              onChange={e => set('new_from', e.target.value)}
            >
              <option value=''>كامل الصفحة</option>
              {ayahs.map(ayah => (
                <option key={ayah} value={ayah}>الآية {ayah}</option>
              ))}
            </select>
          </Field>
          <Field label='إلى الآية — اختياري'>
            <select
              className='studentInput'
              disabled={!page}
              value={form.new_to || ''}
              onChange={e => set('new_to', e.target.value)}
            >
              <option value=''>كامل الصفحة</option>
              {ayahs
                .filter(ayah => ayah >= Number(form.new_from || 0))
                .map(ayah => (
                  <option key={ayah} value={ayah}>الآية {ayah}</option>
                ))}
            </select>
          </Field>
          <button className='primary' disabled={busy}>حفظ الحفظ الجديد</button>
        </form>
      </div>
    );
  };
  const saveButton = (
    <button className="primary" disabled={busy}>
      {busy ? 'جارٍ الحفظ…' : 'حفظ'}
    </button>
  );
  const menu = account?.role === 'teacher'
    ? ['نظرة عامة','سجل الحلقة','الطلاب','الخطة الأسبوعية','التحفيز والجوائز','تقارير الإدارة','الإشعارات']
    : account?.role === 'student'
      ? ['نظرة عامة','سجلي اليومي','الخطة الأسبوعية','التقييم والإنجاز','نقاطي وجوائزي','الإشعارات','التقارير']
      : [
          'نظرة عامة',
          ...(staff ? ['المراكز والفروع','الحلقات','الطلاب','سجل الحلقة','الخطة الأسبوعية','اعتماد اليوم','التقييم والإنجاز','التحفيز والجوائز','تقارير الإدارة','المسابقات'] : ['الخطة الأسبوعية','التقييم والإنجاز']),
          ...(manager ? ['الإجازات والعطل','فتح التعديل الاستثنائي','جاهزية التشغيل'] : []),
          'الإشعارات',
          'ملف الطالب القرآني',
          'الترتيب والتحفيز',
          'النقاط والجوائز',
          'التقارير',
          ...(admin ? ['الأخبار والفعاليات','الحسابات والدخول','الأدوار والصلاحيات','سجل العمليات','صور الموقع'] : []),
          ...(manager ? ['الإعدادات'] : []),
        ];
  const navigate = (p: string) => {
    setPanel(p);
    setForm({});
    setReport(null);
    setNotice('');
  };
  return (
    <main dir="rtl">
      <header className="header noPrint">
        <button
          className="brand"
          onClick={() => {
            setDashboard(false);
            setView('الرئيسية');
          }}
        >
          <img
            className="brandLogo"
            src="./resources/logo-halaqat-ashour-bukhari.png"
            alt="شعار حلقات عاشور بخاري"
          />
          <span>
            <b>حلقات عاشور بخاري</b>
            <small>منصة تعليم القرآن الكريم</small>
          </span>
        </button>
        <nav>
          {publicNav.map(item => (
            <button
              key={item}
              className={!dashboard && view === item ? 'active' : ''}
              onClick={() => {
                setDashboard(false);
                setView(item);
              }}
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="headerActions">
          {account && (
            <button
              onClick={() => {
                setPanel('نظرة عامة');
                setDashboard(true);
              }}
            >
              لوحة الإدارة
            </button>
          )}
          {account ? (
            <><button onClick={() => dashboard ? leaveDashboard() : setDashboard(true)} disabled={busy}>{dashboard ? 'العودة للموقع' : 'فتح حسابي'}</button><button onClick={logout} disabled={busy}>تسجيل الخروج من الحساب</button></>
          ) : (
            <button className="login" onClick={login} disabled={busy}>
              دخول المنصة
            </button>
          )}
        </div>
      </header>
      {notice && (
        <div className="notice noPrint" role="alert">
          {notice}
          <button aria-label="إغلاق التنبيه" onClick={() => setNotice('')}>
            ×
          </button>
        </div>
      )}
      {connection === false && (
        <section className="setup noPrint">
          <strong>المنصة قيد الإعداد</strong>
          <p>
            لم يتم التحقق من اتصال قاعدة البيانات بعد. ستتاح العمليات بعد
            استكمال الربط.
          </p>
          <button onClick={() => run(checkConnection)} disabled={busy}>
            إعادة التحقق من الاتصال
          </button>
        </section>
      )}
      {!dashboard || !account ? (
        <>
          {view === 'الرئيسية' ? (
            <>
              <section className="topNews reveal reveal-up">
                <div className="topNewsMeta">
                  <div>
                    <span className="eyebrow">الأخبار والفعاليات</span>
                    <strong>آخر أخبار الحلقات</strong>
                  </div>
                  <small>
                    {newsIndex + 1} / {newsSlides.length}
                  </small>
                </div>
                <article className="topNewsSlide" key={activeNews.id}>
                  <time>
                    {activeNews.published_at
                      ? String(activeNews.published_at).slice(0, 10)
                      : 'حديثاً'}
                  </time>
                  <h2>{activeNews.title}</h2>
                  <p>{activeNews.body}</p>
                </article>
                <div className="topNewsControls">
                  <button
                    type="button"
                    aria-label="الخبر السابق"
                    onClick={() =>
                      setNewsIndex(i =>
                        (i - 1 + newsSlides.length) % newsSlides.length
                      )
                    }
                  >
                    السابق
                  </button>
                  <div className="newsDots" aria-label="صفحات الأخبار">
                    {newsSlides.map((item, index) => (
                      <button
                        type="button"
                        key={item.id}
                        className={index === newsIndex ? 'active' : ''}
                        aria-label={`الخبر ${index + 1}`}
                        onClick={() => setNewsIndex(index)}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    aria-label="الخبر التالي"
                    onClick={() =>
                      setNewsIndex(i => (i + 1) % newsSlides.length)
                    }
                  >
                    التالي
                  </button>
                  <button
                    type="button"
                    className="allNewsButton"
                    onClick={() => setView('الأخبار والفعاليات')}
                  >
                    عرض كل الأخبار
                  </button>
                </div>
              </section>
              <section className="hero">
                <div className="heroText">
                  <span className="eyebrow reveal reveal-right delay-1">
                    بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيمِ
                  </span>
                  <div className="heroKicker reveal reveal-right delay-1">
                    قرآن • تربية • متابعة • أثر
                  </div>
                  <h1 className="reveal reveal-right delay-2">حلقات عاشور بخاري</h1>
                  <h2 className="reveal reveal-right delay-3">
                    منصة تجمع التعليم والإدارة والمتابعة في مكان واحد
                  </h2>
                  <p className="reveal reveal-right delay-4">
                    بيئة رقمية متكاملة لخدمة حلقات القرآن الكريم، وبناء جيل
                    متصل بكتاب الله علماً وعملاً.
                  </p>
                  <div className="heroHighlights reveal reveal-up delay-4">
                    <span>✓ متابعة يومية</span>
                    <span>✓ تقارير دقيقة</span>
                    <span>✓ صلاحيات آمنة</span>
                  </div>
                  <div className="actions reveal reveal-up delay-5">
                    <button
                      className="primary"
                      onClick={account ? () => setDashboard(true) : login}
                      disabled={busy}
                    >
                      دخول المنصة
                    </button>
                    <button
                      className="secondary"
                      onClick={() => setView('عن الحلقات')}
                    >
                      تعرف على الحلقات
                    </button>
                  </div>
                </div>
                <div className="heroArt reveal reveal-left delay-2">
                  <div className="heroLogoCard">
                    <img
                      className="heroLogo"
                      src="./resources/logo-halaqat-ashour-bukhari.png"
                      alt="شعار حلقات عاشور بخاري"
                    />
                  </div>
                </div>
              </section>
              <section className="stats platformStats">
                {[
                  ['01', 'منصة موحدة', 'لإدارة التعليم والمتابعة'],
                  ['03', 'مسارات قرآنية', 'حفظ • مراجعة • تسميع'],
                  ['06', 'بوابات صلاحيات', 'لكل مستخدم ما يخصه'],
                  ['04', 'محاور تشغيلية', 'تعليم • حضور • تقارير • تحفيز'],
                ].map(([number, label, detail], index) => (
                  <article
                    key={label}
                    className="statCard reveal reveal-up"
                    style={{ animationDelay: `${0.18 + index * 0.11}s` }}
                  >
                    <b>{number}</b>
                    <span>{label}</span>
                    <small>{detail}</small>
                  </article>
                ))}
              </section>
              <AboutSections />
              <section className='report1447'><div className='sectionHead'><div><span>حصاد 1447هـ</span><h2>حلقات تمتد من مكة إلى العالم</h2></div></div><div className='reportStats'>{report1447.stats.map(([n,l])=><article key={l}><b>{n}</b><span>{l}</span></article>)}</div><img className='reportMap' src={imageUrl('nationalities','./resources/report-nationalities.png')} alt='خريطة جنسيات طلاب حلقات عاشور بخاري'/><div className='sectionHead reportSubhead'><div><span>المسارات</span><h2>تعليم قرآني متدرج</h2></div></div><div className='reportGallery'>{[['talqeen','./resources/report-talqeen.png','مسار التلقين والتهجي'],['hifz','./resources/report-hifz.png','مسار حفظ القرآن'],['itqan','./resources/report-itqan.png','مسار الإتقان'],['qiraat','./resources/report-qiraat.png','مسار القراءات العشر']].map(([key,src,alt])=><img key={key} src={imageUrl(key,src)} alt={alt}/>)}</div><div className='sectionHead reportSubhead'><div><span>أخبار الحلقات</span><h2>برامج مصاحبة تصنع الأثر</h2></div></div><div className='reportCards'>{report1447.news.map(([t,b,img])=>{const key=img.replace('./resources/report-','').replace('.png','');return <article key={t}><img src={imageUrl(key,img)} alt={t}/><div><h3>{t}</h3><p>{b}</p></div></article>})}</div><div className='sectionHead reportSubhead'><div><span>إنجازات عالمية ومتميزة</span><h2>نماذج من حصاد طلاب الحلقات</h2></div></div><div className='reportCards achievements'>{report1447.achievements.map(([t,b,img])=>{const key=img.replace('./resources/report-','').replace('.png','');return <article key={t}><img src={imageUrl(key,img)} alt={t}/><div><h3>{t}</h3><p>{b}</p></div></article>})}</div></section>
              <section className="section portalsSection">
                <div className="sectionHead">
                  <div>
                    <span>بوابات المنصة</span>
                    <h2>كل مستخدم يرى ما يخصه فقط</h2>
                  </div>
                </div>
                <div className="roleGrid">
                  {[
                    ['ولي الأمر', 'متابعة الحضور والإنجاز والتقارير'],
                    ['الطالب', 'تعلم ومراجعة وإنجاز'],
                    ['المعلم', 'إدارة الحلقة والطلاب'],
                    ['المشرف', 'متابعة الأداء التعليمي'],
                    ['مدير المركز', 'إدارة المركز والحلقات'],
                    ['المدير', 'إدارة ومتابعة النظام'],
                  ].map(([title, description], index) => (
                    <button
                      className="roleCard reveal reveal-up"
                      style={{ animationDelay: `${0.12 + index * 0.08}s` }}
                      key={title}
                      onClick={login}
                    >
                      <i>◈</i>
                      <b>{title}</b>
                      <small>{description}</small>
                      <em>دخول البوابة ←</em>
                    </button>
                  ))}
                </div>
              </section>
              <section className="featureBand reveal reveal-up">
                <div className="featureBandCopy">
                  <span>منظومة واحدة لكل المسيرة</span>
                  <h2>من أول تسميع إلى تقرير الأسرة</h2>
                  <p>
                    تجمع المنصة الحضور والحفظ والمراجعة والتسميع والنقاط والتقارير
                    في تجربة واحدة؛ لتصبح المعلومة أقرب والقرار أسرع والمتابعة أدق.
                  </p>
                  <button
                    className="featureCta"
                    onClick={account ? () => setDashboard(true) : login}
                    disabled={busy}
                  >
                    ابدأ من لوحة المنصة
                  </button>
                </div>
                <div className="featureList">
                  {[
                    'تسجيل سريع للحفظ والمراجعة والتسميع',
                    'متابعة الحضور والحالة اليومية',
                    'نقاط وجوائز تحفّز الاستمرار',
                    'تقارير قابلة للطباعة والحفظ PDF',
                    'صلاحيات مستقلة للإدارة والمعلم والأسرة',
                  ].map(item => (
                    <p key={item}>✓ {item}</p>
                  ))}
                </div>
              </section>

            </>
          ) : view === 'عن الحلقات' ? (
            <div className="aboutPage">
              <section className="innerHero reveal reveal-up">
                <span className="sectionLabel">عن الحلقات</span>
                <h1>تعليم القرآن بإتقان، وتربية على هدايته، ومتابعة تحفظ الأثر</h1>
                <p>
                  تعرف على هوية حلقات عاشور بخاري ورؤيتها ورسالتها وأهدافها والقيم
                  التي تقوم عليها مسيرتها التعليمية والتربوية.
                </p>
              </section>
              <AboutSections detailed />
              <section className="aboutCta reveal reveal-up">
                <div>
                  <span>جاهز للدخول؟</span>
                  <h2>انتقل إلى بوابتك وابدأ المتابعة من مكان واحد.</h2>
                </div>
                <button className="primary" onClick={account ? () => setDashboard(true) : login}>
                  دخول المنصة
                </button>
              </section>
            </div>
          ) : (
            view === 'الأخبار والفعاليات' ? <section className='report1447 publicReportPage'><div className='innerHero reportPageHero'><span className='sectionLabel'>أخبار الحلقات</span><h1>برامج وفعاليات تصنع الأثر</h1><p>نماذج من البرامج المصاحبة والفعاليات الموثقة في تقرير حلقات عاشور بخاري لعام 1447هـ.</p></div><div className='reportCards publicCards'>{report1447.news.map(([t,b,img])=>{const key=img.replace('./resources/report-','').replace('.png','');return <article key={t}><img src={imageUrl(key,img)} alt={t}/><div><span className='sectionLabel'>خبر وفعالية</span><h3>{t}</h3><p>{b}</p></div></article>})}</div>{news.length > 0 && <><div className='sectionHead reportSubhead'><div><span>آخر المستجدات</span><h2>أخبار منشورة من إدارة المنصة</h2></div></div><div className='reportCards publicCards'>{news.map(n=><article key={n.id}><div><span className='sectionLabel'>{n.kind === 'achievement' ? 'إنجاز' : n.kind === 'event' ? 'فعالية' : 'خبر'}</span><h3>{n.title}</h3><p>{n.body}</p><small>{String(n.published_at || '').slice(0,10)}</small></div></article>)}</div></>}</section> : view === 'الإنجازات' ? <section className='report1447 publicReportPage'><div className='innerHero reportPageHero'><span className='sectionLabel'>إنجازات 1447هـ</span><h1>طلاب الحلقات في ميادين التميز</h1><p>نماذج من الإنجازات العالمية والدولية والمحلية الواردة في التقرير السنوي.</p></div><div className='reportCards achievements publicCards'>{report1447.achievements.map(([t,b,img])=>{const key=img.replace('./resources/report-','').replace('.png','');return <article key={t}><img src={imageUrl(key,img)} alt={t}/><div><span className='sectionLabel'>إنجاز</span><h3>{t}</h3><p>{b}</p></div></article>})}</div><div className='reportStats'>{report1447.stats.map(([n,l])=><article key={l}><b>{n}</b><span>{l}</span></article>)}</div></section> : view === 'الوسائط' ? <section className='report1447 publicReportPage'><div className='innerHero reportPageHero'><span className='sectionLabel'>الوسائط</span><h1>من ذاكرة الحلقات</h1><p>مختارات بصرية من المسارات والبرامج وانتشار طلاب الحلقات كما وثقها التقرير السنوي 1447هـ.</p></div><div className='reportGallery mediaGallery'>{[['talqeen','./resources/report-talqeen.png','مسار التلقين والتهجي'],['hifz','./resources/report-hifz.png','مسار حفظ القرآن'],['itqan','./resources/report-itqan.png','مسار الإتقان'],['qiraat','./resources/report-qiraat.png','مسار القراءات العشر'],['madinah','./resources/report-madinah.png','رحلة المدينة المنورة'],['madinah-group','./resources/report-madinah-group.png','طلاب الحلقات في المدينة المنورة'],['iftar','./resources/report-iftar.png','إفطار صائم'],['recreation','./resources/report-recreation.png','البرنامج الترويحي'],['khatm','./resources/report-khatm.png','مجالس ختم القرآن والقراءات'],['eid','./resources/report-eid.png','برنامج المعايدة'],['nationalities','./resources/report-nationalities.png','خريطة جنسيات طلاب الحلقات'],['achievement-anas','./resources/report-achievement-anas.png','إنجاز عالمي'],['achievement-russia','./resources/report-achievement-russia.png','إنجاز عالمي في روسيا'],['achievement-tanzania','./resources/report-achievement-tanzania.png','إنجاز دولي في تنزانيا'],['achievement-omar','./resources/report-achievement-omar.png','إنجاز على مستوى المملكة'],['photo-1','./resources/report-photo-1.png','من التقرير المصور'],['photo-2','./resources/report-photo-2.png','من مجالس الحلقات']].map(([key,src,alt])=><figure key={key}><img src={imageUrl(key,src)} alt={alt}/><figcaption>{alt}</figcaption></figure>)}</div></section> : <section className="simplePage richSimplePage">
              <span className="sectionLabel">{view}</span>
              <h1>{view}</h1>
              <p>
                هذا القسم جزء من منصة حلقات عاشور بخاري ويُدار محتواه من خلال
                مدير النظام.
              </p>
              <div className="simplePageActions">
                <button className="primary" onClick={account ? () => setDashboard(true) : login} disabled={busy}>
                  دخول لوحة الإدارة
                </button>
                <button className="secondary" onClick={() => setView('الرئيسية')}>
                  العودة للرئيسية
                </button>
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="workspace">
          <aside className="noPrint">
            <div className="user">
              <span>{account.full_name.slice(0, 1)}</span>
              <div>
                <b>{account.full_name}</b>
                <small>{roles[account.role]}</small>
              </div>
            </div>
            {menu.map(p => (
              <button
                key={p}
                className={panel === p ? 'selected' : ''}
                onClick={() => navigate(p)}
              >
                {p}
              </button>
            ))}
          </aside>
          <section className="dashboardContent">
            <div className="crumb noPrint">
              <div>
                <span>لوحة التحكم / {roles[account.role]}</span>
                <h1>
                  {panel === 'نظرة عامة'
                    ? `مرحباً بك، ${account.full_name}`
                    : panel}
                </h1>
              </div>
            </div>
            <div className="kpis">
              <article>
                <span>الطلاب النشطون</span>
                <b>{students.filter(s => s.status === 'active').length}</b>
                <small>ضمن نطاق حسابك</small>
              </article>
              <article>
                <span>الحلقات</span>
                <b>{circles.length}</b>
                <small>الحلقات المتاحة</small>
              </article>
              <article>
                <span>المراكز</span>
                <b>{centers.length}</b>
                <small>المراكز المتاحة</small>
              </article>
              <article>
                <span>مجموع النقاط</span>
                <b>{students.reduce((a, s) => a + Number(s.points_balance), 0)}</b>
                <small>أرصدة الطلاب</small>
              </article>
            </div>
            {panel === 'سجلي اليومي' && account.role === 'student' && <section className='panel studentDailyRecord'><div className='panelHead'><div><h2>سجلي اليومي</h2><p>الكشف اليومي: الحضور والانصراف، ثم المراجعة، ثم الحفظ الجديد.</p></div></div>{students[0] ? <><div className='studentSelfEntry'><h3>كشف اليوم</h3><Field label='التاريخ'><input type='date' value={day} max={today()} onChange={e=>setDay(e.target.value)}/><small>{day===today()?'إدخال اليوم متاح.':'سجل سابق للعرض فقط — الإدخال والتعديل متاحان في يوم الحضور نفسه فقط.'}</small></Field>{day===today()?<><div className='selfBlock'><h4>1. حالة الحضور</h4><form onSubmit={e=>{e.preventDefault();run(async()=>{await post('/api/attendance',{student_id:students[0].id,attendance_date:day,status:form.self_attendance||'present',late_minutes:0});setStudentProfile(await get(`/api/student-profile/${students[0].id}`));},'تم حفظ حالة الحضور')}}><Field label='الحالة'><select value={form.self_attendance||'present'} onChange={e=>set('self_attendance',e.target.value)}><option value='present'>حاضر</option><option value='absent'>غائب</option><option value='excused'>مستأذن</option></select></Field><button className='primary' disabled={busy}>حفظ الحالة</button></form></div><div className='selfBlock'><h4>2. الحضور والانصراف</h4><p className='muted'>الوقت يسجل تلقائيًا عند الضغط ولا يكتب يدويًا.</p><div className='punchActions'><button className='primary' disabled={busy} onClick={()=>run(async()=>{await post('/api/attendance/punch',{student_id:students[0].id,attendance_date:day,action:'check_in'});setStudentProfile(await get(`/api/student-profile/${students[0].id}`));},'تم تسجيل وقت الحضور')}>تسجيل الحضور الآن</button><button disabled={busy} onClick={()=>run(async()=>{await post('/api/attendance/punch',{student_id:students[0].id,attendance_date:day,action:'check_out'});setStudentProfile(await get(`/api/student-profile/${students[0].id}`));},'تم تسجيل وقت الانصراف')}>تسجيل الانصراف الآن</button></div>{(()=>{const a=(studentProfile?.attendance_records||[]).find((x:Row)=>String(x.attendance_date).slice(0,10)===day);return <div className='punchTimes'><span>وقت الحضور: <b>{a?.check_in_at?new Date(a.check_in_at).toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'}):'—'}</b></span><span>وقت الانصراف: <b>{a?.check_out_at?new Date(a.check_out_at).toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'}):'—'}</b></span></div>})()}</div>{studentReviewEntry()}{studentNewEntry()}</>:<div className='emptyState'>هذا التاريخ للعرض فقط. اختر تاريخ اليوم لتسجيل الحضور والمراجعة والحفظ الجديد.</div>}</div><div className='studentRecordHero'><div><span>الطالب</span><h2>{students[0].full_name}</h2><p>{students[0].center_name || '—'} • {students[0].circle_name || 'بدون حلقة'}</p></div><button className='primary' onClick={()=>run(async()=>setStudentProfile(await get(`/api/student-profile/${students[0].id}`)))}>تحديث الكشف</button></div>{studentProfile && <><div className='kpis compactKpis'><article><span>الحضور</span><b>{studentProfile.attendance.total ? Math.round(100*studentProfile.attendance.attended/studentProfile.attendance.total) : 0}%</b><small>غياب {studentProfile.attendance.absent} • تأخر {studentProfile.attendance.late}</small></article><article><span>الحفظ الجديد</span><b>{studentProfile.quran.new_sessions}</b><small>{studentProfile.quran.new_ayahs} آية</small></article><article><span>المراجعة</span><b>{studentProfile.quran.review_sessions}</b><small>{studentProfile.quran.review_ayahs} آية</small></article><article><span>التسميع</span><b>{studentProfile.quran.recitation_sessions}</b><small>متوسط الأداء {studentProfile.quran.average_grade}%</small></article><article><span>النقاط</span><b>{studentProfile.student.points_balance}</b><small>الرصيد الحالي</small></article></div><h3>الحضور والانضباط</h3><Table heads={['التاريخ','الحالة','وقت الحضور','وقت الانصراف','التأخير']} rows={(studentProfile.attendance_records||[]).map((a:Row)=>[String(a.attendance_date).slice(0,10),a.status==='excused'?'مستأذن':statuses[a.status]||a.status,a.check_in_at?new Date(a.check_in_at).toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'}):'—',a.check_out_at?new Date(a.check_out_at).toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'}):'—',a.late_minutes?`${a.late_minutes} دقيقة`:'0'])}/><h3>الكشف اليومي المفصل</h3><Table heads={['التاريخ','وقت الحضور','المراجعة من (سورة/صفحة/آية)','المراجعة إلى (سورة/صفحة/آية)','الانصراف','عدد الصفحات','التأخير','التقييم']} rows={(studentProfile.recent||[]).map((r:Row)=>[String(r.record_date).slice(0,10),'—',`${surahs[Number(r.surah_no)-1]?.[0]||r.surah_no} ص ${getMadinahPage(Number(r.surah_no),Number(r.from_ayah))} آ ${r.from_ayah}` ,`${surahs[Number(r.surah_no)-1]?.[0]||r.surah_no} ص ${getMadinahPage(Number(r.surah_no),Number(r.to_ayah))} آ ${r.to_ayah}`,'—',`${Math.max(1,getMadinahPage(Number(r.surah_no),Number(r.to_ayah))-getMadinahPage(Number(r.surah_no),Number(r.from_ayah))+1)} صفحة`,'—',r.grade?`${r.grade}%`:'—'])}/><h3>الحفظ الجديد والمراجعة والتسميع</h3><Table heads={['التاريخ','النوع','السورة','الصفحات','الآيات','الدرجة','الملاحظة']} rows={studentProfile.recent.map((r:Row)=>[String(r.record_date).slice(0,10),recordTypes[r.record_type],surahs[Number(r.surah_no)-1]?.[0]||r.surah_no,`${getMadinahPage(Number(r.surah_no),Number(r.from_ayah))}–${getMadinahPage(Number(r.surah_no),Number(r.to_ayah))}`,`${r.from_ayah}–${r.to_ayah}`,r.grade??'—',r.notes||'—'])}/><h3>الخطة الأسبوعية</h3><Table heads={['الأسبوع','اليوم','الجديد','المراجعة','الهدف']} rows={(studentProfile.plans||[]).map((p:Row)=>[String(p.week_start).slice(0,10),p.day_name,p.new_target||'—',p.review_target||'—',p.goals||'—'])}/><h3>حركة النقاط والانضباط</h3><Table heads={['التاريخ','النقاط','السبب']} rows={(studentProfile.points||[]).map((p:Row)=>[String(p.created_at).slice(0,10),p.points,p.reason])}/></>}</> : <p className='emptyState'>لم يتم ربط حسابك بسجل الطالب بعد. راجع إدارة الحلقات لربط الحساب.</p>}</section>}
            {panel === 'سجل الحلقة' && staff && <section className='panel'><div className='panelHead'><div><h2>سجل الحلقة</h2><p>الكشف الإجمالي الشهري يُعبأ تلقائيًا من تسجيل الطلاب. اضغط اسم الطالب لفتح سجله التفصيلي.</p></div><Field label='الشهر'><input type='month' value={recordMonth} onChange={e=>{setRecordMonth(e.target.value);get(`/api/circle-register?month=${e.target.value}`).then(setCircleRegister).catch(x=>setNotice(message(x)));}}/></Field></div>{circleRegister?.students?.map((s:Row)=><article className='circleRegisterStudent' key={s.id}><button className='studentLink' onClick={()=>run(async()=>{setStudentProfile(await get(`/api/student-profile/${s.id}?month=${recordMonth}`));setForm(f=>({...f,student_id:s.id}));setPanel('ملف الطالب القرآني');})}>{s.full_name} — {s.circle_name}</button><div className='tableWrap'><table><thead><tr><th>اليوم</th><th>المراجعة</th><th>الجديد</th><th>التقييم</th></tr></thead><tbody>{(s.days||[]).map((d:Row)=>{const state=d.status==='absent'?'غائب':d.status==='excused'?'مستأذن':'';const score=d.status==='absent'?0:d.status==='excused'?'—':Math.round(((Number(d.review?.grade)||0)+(Number(d.new?.grade)||0))/((d.review?1:0)+(d.new?1:0)||1));return <tr key={d.date}><td>{String(d.date).slice(0,10)}</td><td>{state|| (d.review?`${surahs[Number(d.review.surah_no)-1]?.[0]||''} ${d.review.from_ayah}–${d.review.to_ayah}`:'—')}</td><td>{state|| (d.new?`${surahs[Number(d.new.surah_no)-1]?.[0]||''} ${d.new.from_ayah}–${d.new.to_ayah}`:'—')}</td><td>{score}</td></tr>})}</tbody></table></div></article>)}</section>}
            {panel === 'نظرة عامة' && (
              <section className="panel">
                <div className="panelHead"><div><h2>{account.role === 'guardian' ? 'متابعة الأبناء' : account.role === 'student' ? 'مسيرتي القرآنية' : account.role === 'teacher' ? 'لوحة الحلقة اليوم' : 'المؤشرات التشغيلية'}</h2><p>{account.role === 'teacher' ? 'ابدأ بالحضور ثم الحفظ والمراجعة واعتمد سجل الحلقة في نهاية اليوم.' : 'ملخص مباشر لأهم مؤشرات الحساب ضمن نطاق الصلاحية.'}</p></div></div>
                {dashboardStats && <div className="kpis roleKpis"><article><span>الطلاب</span><b>{dashboardStats.students.active}</b><small>نشط</small></article><article><span>حضور اليوم</span><b>{dashboardStats.attendance.attended}</b><small>غياب {dashboardStats.attendance.absent}</small></article><article><span>متوسط آخر 7 أيام</span><b>{dashboardStats.quran.average}%</b><small>{dashboardStats.quran.records} سجلاً قرآنياً</small></article><article><span>تنبيهات جديدة</span><b>{dashboardStats.unread}</b><small>غير مقروءة</small></article></div>}
              </section>
            )}
            {panel === 'المراكز والفروع' && (
              <>
                <section className="panel">
                  {admin && (
                    <form onSubmit={submit('/api/centers', form)}>
                      {input('name', 'اسم المركز')}
                      {input('location', 'الموقع', 'text', false)}
                      {saveButton}
                    </form>
                  )}
                  <Table
                    heads={['المركز', 'الموقع', 'الحلقات']}
                    rows={centers.map(c => [
                      c.name,
                      c.location || '—',
                      c.circles_count,
                    ])}
                  />
                </section>
              </>
            )}
            {panel === 'الحلقات' && (
              <section className="panel">
                {manager && (
                  <form onSubmit={submit('/api/circles', form)}>
                    {input('name', 'اسم الحلقة')}
                    <Field label='المسار الرئيس'><select required value={form.student_track || ''} onChange={e=>set('student_track',e.target.value)}><option value=''>اختر المسار الرئيس</option>{studentTracks.map(x=><option key={x} value={x}>{x}</option>)}</select></Field>
                    <Field label='المسار القرآني'><select required value={form.quran_track || ''} onChange={e=>set('quran_track',e.target.value)}><option value=''>اختر المسار القرآني</option>{quranTracks.map(x=><option key={x} value={x}>{x}</option>)}</select></Field>
                    {centerPick}
                    <Field label='المعلم'><Pick required={false} rows={users.filter(u => u.role === 'teacher' && u.is_active && (!admin || !form.center_id || u.center_id === form.center_id) && (admin || u.center_id === account?.center_id))} value={form.teacher_user_id || ''} onChange={v => set('teacher_user_id', v)} label={admin && !form.center_id ? 'اختر المركز أولاً أو اختر معلمًا من القائمة' : users.some(u => u.role === 'teacher' && u.is_active && (admin ? u.center_id === form.center_id : u.center_id === account?.center_id)) ? 'اختر المعلم' : 'لا يوجد معلم نشط في هذا المركز'} />{admin && !form.center_id && <small>اختر المركز أولاً لتصفية أسماء المعلمين التابعين له.</small>}{!users.some(u => u.role === 'teacher' && u.is_active && (admin ? (!form.center_id || u.center_id === form.center_id) : u.center_id === account?.center_id)) && <small>أضف حساب المعلم وفعّله واربطه بالمركز من «الحسابات والدخول».</small>}</Field>
                    {input('schedule', 'الموعد', 'text', false)}
                    <Field label="نوع الحلقة"><select value={form.circle_type || 'memorization'} onChange={e => set('circle_type', e.target.value)}><option value="memorization">حفظ</option><option value="review">مراجعة</option><option value="recitation">تصحيح تلاوة</option><option value="special">برنامج خاص</option></select></Field>
                    {input('start_time', 'وقت البداية', 'time', false)}
                    <Field label='دقائق السماح'><input type='number' min='0' max='60' step='1' placeholder='10' value={form.grace_minutes ?? ''} onChange={e => set('grace_minutes', e.target.value)} /><small>اختياري — إذا تركته فارغًا تعتمد المنصة 10 دقائق.</small></Field>
                    {saveButton}
                  </form>
                )}
                <Table
                  heads={['المسار الرئيس','المسار القرآني','الحلقة','المركز','المعلم','الموعد']}
                  rows={circles.map(c => [
                    c.student_track || 'غير مصنف',
                    c.quran_track || 'غير مصنف',
                    c.name,
                    c.center_name,
                    c.teacher_name || 'غير معين',
                    c.schedule || '—',
                  ])}
                />
              </section>
            )}
            {panel === 'الطلاب' && (
              <section className="panel">
                {manager && (
                  <form onSubmit={submit('/api/students', form)}>
                    {input('full_name', 'اسم الطالب')}
                    {centerPick}
                    <Field label="الحلقة">
                      <Pick
                        required={false}
                        rows={circles.filter(
                          c => c.center_id === form.center_id
                        )}
                        value={form.circle_id || ''}
                        onChange={v => set('circle_id', v)}
                        label="بدون حلقة"
                      />
                    </Field>
                    {saveButton}
                  </form>
                )}
                <div className='actions'><button className={studentFilter==='all'?'primary':''} onClick={()=>setStudentFilter('all')}>جميع الطلاب ({students.length})</button><button className={studentFilter==='unassigned'?'primary':''} onClick={()=>setStudentFilter('unassigned')}>غير المسندين ({students.filter(s=>!s.center_id||!s.circle_id).length})</button><button className={studentFilter==='assigned'?'primary':''} onClick={()=>setStudentFilter('assigned')}>المسندون للحلقات ({students.filter(s=>s.center_id&&s.circle_id).length})</button></div>
                <Table
                  heads={['الطالب', 'المركز', 'الحلقة', 'الحالة', 'النقاط']}
                  rows={students.filter(s=>studentFilter==='all'||(studentFilter==='unassigned'?(!s.center_id||!s.circle_id):(s.center_id&&s.circle_id))).map(s => [
                    s.full_name,
                    manager ? <select aria-label={`مركز ${s.full_name}`} value={s.center_id||''} disabled={busy} onChange={e=>run(async()=>{await api.put(`/api/students/${s.id}`,{center_id:e.target.value||null,circle_id:null});await refresh(account);},'تم تحديث مركز الطالب')}><option value=''>غير مسند لمركز</option>{centers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select> : (s.center_name || 'غير مسند'),
                    manager ? (
                      <select
                        aria-label={`حلقة ${s.full_name}`}
                        value={s.circle_id || ''}
                        disabled={busy}
                        onChange={e =>
                          run(async () => {
                            await api.put(`/api/students/${s.id}`, {
                              circle_id: e.target.value || null,
                            });
                            await refresh(account);
                          }, 'تم نقل الطالب')
                        }
                      >
                        <option value="">{s.center_id ? 'بدون حلقة' : 'اختر المركز أولاً'}</option>
                        {circles
                          .filter(c => c.center_id === s.center_id)
                          .map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    ) : (
                      s.circle_name || '—'
                    ),
                    manager ? (
                      <select
                        aria-label={`حالة ${s.full_name}`}
                        value={s.status}
                        disabled={busy}
                        onChange={e =>
                          run(async () => {
                            await api.put(`/api/students/${s.id}`, {
                              status: e.target.value,
                            });
                            await refresh(account);
                          }, 'تم تحديث الحالة')
                        }
                      >
                        {['active', 'excused', 'suspended'].map(v => (
                          <option key={v} value={v}>
                            {statuses[v]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      statuses[s.status]
                    ),
                    s.points_balance,
                  ])}
                />
              </section>
            )}
            {panel === 'لوحة المعلم اليومية' && staff && <section className='panel'><div className='panelHead'><div><h2>لوحة المعلم اليومية</h2><p>شاشة واحدة لمراجعة اكتمال حضور الطلاب والحفظ والمراجعة قبل اعتماد اليوم.</p></div></div><Field label='التاريخ'><input type='date' value={day} onChange={e=>{setDay(e.target.value);get(`/api/teacher/today?date=${e.target.value}`).then(setTeacherToday).catch(x=>setNotice(message(x)));}}/></Field>{teacherToday && <Table heads={['الطالب','الحلقة','الحضور','حفظ جديد','مراجعة','متوسط الأداء']} rows={teacherToday.students.map((r:Row)=>[r.full_name,r.circle_name,statuses[r.attendance_status] || 'لم يسجل',r.new_records,r.review_records,`${r.grade}%`])}/>}<div className='actions'><button onClick={()=>navigate('الحضور اليومي')}>تسجيل الحضور</button><button onClick={()=>navigate('الحفظ والمراجعة')}>تسجيل الإنجاز</button><button className='primary' onClick={()=>navigate('اعتماد اليوم')}>اعتماد اليوم</button></div></section>}
            {panel === 'الحضور اليومي' && (
              <section className="panel">
                <Field label="تاريخ الحضور">
                  <input
                    type="date"
                    required
                    value={day}
                    onChange={e => {
                      setDay(e.target.value);
                      setAttendance([]);
                    }}
                  />
                </Field>
                <Field label="دقائق التأخير عند اختيار متأخر"><input type="number" min="0" max="300" value={form.late_minutes || '11'} onChange={e => set('late_minutes', e.target.value)} /></Field>
                <p>حتى 10 دقائق ضمن السماح، ومن 11–30 دقيقة يخصم 10 نقاط، وأكثر من 30 دقيقة يخصم 30 نقطة.</p>
                <Table
                  heads={['الطالب', 'الحالة المسجلة', 'تسجيل الحضور']}
                  rows={students
                    .filter(s => s.status === 'active')
                    .map(s => [
                      s.full_name,
                      statuses[
                        attendance.find(a => a.student_id === s.id)?.status
                      ] || 'لم يسجل',
                      <div className="actions">
                        {['present', 'late', 'absent', 'excused'].map(v => (
                          <button
                            key={v}
                            disabled={busy || !s.circle_id || !day}
                            onClick={() =>
                              run(async () => {
                                await post('/api/attendance', {
                                  student_id: s.id,
                                  status: v,
                                  attendance_date: day,
                                  late_minutes: v === 'late' ? Number(form.late_minutes || 11) : 0,
                                });
                                setAttendance(
                                  await get(`/api/attendance?date=${day}`)
                                );
                              }, 'تم تسجيل الحضور')
                            }
                          >
                            {statuses[v]}
                          </button>
                        ))}
                      </div>,
                    ])}
                />
              </section>
            )}
            {panel === 'الحفظ والمراجعة' && staff && (
              <section className='panel quranRosterPanel'>
                <div className='panelHead'><div><h2>كشف الحفظ والمراجعة</h2><p>كل طالب في صف واحد، وله خانة مستقلة للحفظ الجديد وخانة مستقلة للمراجعة. في كل خانة تحدد البداية والنهاية: السورة والآية والصفحة، ويمكن أن يمتد التسميع عبر أكثر من سورة.</p></div><Field label='التاريخ'><input type='date' value={day} onChange={e=>setDay(e.target.value)} /></Field></div>
                <div className='quranRosterWrap'>
                  <table className='quranRosterTable quranDualTable'><thead><tr><th>الطالب</th><th>التاريخ</th><th>وقت الحضور</th><th>المراجعة (من سورة/صفحة/آية)</th><th>المراجعة (إلى سورة/صفحة/آية)</th><th>الانصراف</th><th>عدد الصفحات المسمعة</th><th>مقدار التأخير</th><th>التقييم النهائي</th></tr></thead><tbody>{students.map(student=>{const row=quranRoster[student.id]||{};const update=(key:string,value:string)=>setQuranRoster(old=>({...old,[student.id]:{...(old[student.id]||{}),[key]:value,[`${key.split('_')[0]}_saved`]:''}}));const range=(kind:'new'|'review',title:string)=>{const fs=Number(row[`${kind}_from_surah`]||1);const ts=Math.max(fs,Number(row[`${kind}_to_surah`]||fs));const fa=Number(row[`${kind}_from_ayah`]||1);const ta=Number(row[`${kind}_to_ayah`]||1);const fp=getMadinahPage(fs,fa);const tp=getMadinahPage(ts,ta);const pages=Math.max(1,tp-fp+1);const save=async()=>{for(let s=fs;s<=ts;s++){const start=s===fs?fa:1;const end=s===ts?ta:Number(surahs[s-1][1]);await post('/api/memorization',{student_id:student.id,record_type:kind,record_date:day,surah_no:s,from_ayah:start,to_ayah:end,grade:row[`${kind}_grade`]?Number(row[`${kind}_grade`]):null,notes:`${title}: من سورة ${surahs[fs-1][0]} آية ${fa} ص ${fp} إلى سورة ${surahs[ts-1][0]} آية ${ta} ص ${tp} — ${pages} صفحة`});}setQuranRoster(old=>({...old,[student.id]:{...(old[student.id]||{}),[`${kind}_saved`]:'1'}}));};return <div className={`quranRangeBox ${kind}`}><div className='rangeTitle'><b>{title}</b><span>{pages} {pages===1?'صفحة':'صفحات'}</span></div><div className='rangeSide'><strong>مِن</strong><select value={fs} onChange={e=>{update(`${kind}_from_surah`,e.target.value);update(`${kind}_from_ayah`,'1');if(Number(e.target.value)>ts)update(`${kind}_to_surah`,e.target.value)}}>{surahs.map(([name],i)=><option key={name} value={i+1}>{name}</option>)}</select><select value={fa} onChange={e=>update(`${kind}_from_ayah`,e.target.value)}>{Array.from({length:Number(surahs[fs-1][1])},(_,i)=>i+1).map(n=><option key={n} value={n}>ص {getMadinahPage(fs,n)} — آية {n}</option>)}</select><em>ص {fp}</em></div><div className='rangeSide'><strong>إلى</strong><select value={ts} onChange={e=>{update(`${kind}_to_surah`,e.target.value);update(`${kind}_to_ayah`,'1')}}>{surahs.map(([name],i)=><option key={name} value={i+1} disabled={i+1<fs}>{name}</option>)}</select><select value={ta} onChange={e=>update(`${kind}_to_ayah`,e.target.value)}>{Array.from({length:Number(surahs[ts-1][1])},(_,i)=>i+1).filter(n=>ts!==fs||n>=fa).map(n=><option key={n} value={n}>ص {getMadinahPage(ts,n)} — آية {n}</option>)}</select><em>ص {tp}</em></div><div className='rangeFooter'><label>الدرجة <input type='number' min='0' max='100' value={row[`${kind}_grade`]||''} onChange={e=>update(`${kind}_grade`,e.target.value)} placeholder='—' /></label><button type='button' disabled={busy} onClick={()=>run(save,`تم حفظ ${title} للطالب ${student.full_name}`)}>{row[`${kind}_saved`]==='1'?'✓ محفوظ':'حفظ'}</button></div></div>};return <tr key={student.id}><td className='studentRosterName'><b>{student.full_name}</b><small>{student.circle_name||''}</small></td><td>{range('new','الحفظ الجديد')}</td><td>{range('review','المراجعة')}</td><td>{row.review_score ? `${row.review_score}%` : '—'}</td><td>{row.attendance_score ? `${row.attendance_score}%` : '—'}</td></tr>})}</tbody></table>
                </div>
                <p className='quranRosterNote'>تُحسب الصفحات تلقائياً من صفحة بداية التسميع إلى صفحة نهايته، ولو امتد التسميع عبر عدة سور.</p>
              </section>
            )}
            {panel === 'التسميع' && (
              <section className='panel'>
                <div className='panelHead'><div><h2>{panel === 'التسميع' ? 'تسجيل التسميع' : 'الحفظ الجديد والمراجعة'}</h2><p>{panel === 'التسميع' ? 'اختر الطالب والسورة والآيات مباشرة من مصحف المدينة.' : 'الحفظ الجديد والمراجعة في شاشة واحدة؛ اختر الطالب ثم نوع الإنجاز والسورة والآيات دون إدخال أرقام يدويًا.'}</p></div></div>
                <form
                  onSubmit={submit('/api/memorization', {
                    ...form,
                    record_type: 'recitation',
                    record_date: form.record_date || today(),
                    surah_no: Number(form.surah_no),
                    from_ayah: Number(form.from_ayah),
                    to_ayah: Number(form.to_ayah),
                    grade: form.grade ? Number(form.grade) : null,
                  })}
                >
                  {studentPick}
                  {quranRecordFields}
                  {input('grade', 'الدرجة من 100', 'number', false)}
                  {input('notes', 'ملاحظات', 'text', false)}
                  <Field label="التاريخ">
                    <input
                      type="date"
                      required
                      value={form.record_date || today()}
                      onChange={e => set('record_date', e.target.value)}
                    />
                  </Field>
                  {saveButton}
                </form>
                <p>جميع السور والآيات تُختار من القوائم، ويظهر رقم صفحة مصحف المدينة تلقائيًا بجانب كل آية. يمكن مراجعة السجلات المحفوظة من قسم التقارير.</p>
              </section>
            )}
            {panel === 'الخطة الأسبوعية' && (
              <section className="panel">
                <div className='panelHead'><div><h2>الخطة الأسبوعية — مصحف المدينة</h2><p>اختيار الحفظ والمراجعة من قوائم مصحف المدينة المعتمد: 604 صفحات، 30 جزءًا، 60 حزبًا، 240 ربع حزب، أو السورة والآيات. لا يلزم إدخال مقدار القرآن يدويًا.</p></div></div>
                {staff && <form onSubmit={e => { e.preventDefault(); run(async () => { await post('/api/weekly-plans',{student_id:form.student_id,week_start:form.week_start || today(),day_name:form.day_name,new_target:formatQuranTarget(form,'new'),review_target:formatQuranTarget(form,'review'),goals:form.goals}); setWeeklyPlans(await get(`/api/weekly-plans?week=${form.week_start || today()}`)); setForm({}); },'تم حفظ الخطة الأسبوعية'); }}>{studentPick}{input('week_start','بداية الأسبوع','date')}<Field label='اليوم'><select required value={form.day_name || ''} onChange={e=>set('day_name',e.target.value)}><option value=''>اختر اليوم</option>{['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'].map(d=><option key={d}>{d}</option>)}</select></Field>{quranPlanFields('new','الحفظ الجديد')}{quranPlanFields('review','المراجعة')}{input('goals','ملاحظة تربوية / هدف إضافي', 'text', false)}{saveButton}</form>}
                <Table heads={['الطالب','الأسبوع','اليوم','الحفظ','المراجعة','الهدف']} rows={weeklyPlans.map(w => [w.full_name,String(w.week_start).slice(0,10),w.day_name,w.new_target || '—',w.review_target || '—',w.goals || '—'])} />
                {planProgress.length > 0 && <><h3>التنفيذ الفعلي للأسبوع</h3><Table heads={['الطالب','اليوم المخطط','سجلات الحفظ المنجزة','سجلات المراجعة المنجزة']} rows={planProgress.map(p=>[p.full_name,p.day_name,p.new_records,p.review_records])}/></>}
              </section>
            )}
            {panel === 'اعتماد اليوم' && staff && (
              <section className="panel"><h2>اعتماد سجل الحلقة</h2><p>بعد الاعتماد يصبح سجل اليوم مقفلاً للمعلم، ويظل المدير قادراً على التصحيح عند الحاجة.</p><form onSubmit={e => {e.preventDefault();run(async()=>{await post('/api/day-approvals',{circle_id:form.circle_id,approval_date:form.approval_date || today()});setForm({});},'تم اعتماد سجل اليوم');}}><Field label="الحلقة"><Pick rows={circles} value={form.circle_id || ''} onChange={v=>set('circle_id',v)} /></Field>{input('approval_date','تاريخ الاعتماد','date')}{saveButton}</form></section>
            )}
            {panel === 'الإجازات والعطل' && manager && (
              <section className="panel"><form onSubmit={e=>{e.preventDefault();run(async()=>{await post('/api/holidays',{center_id:form.center_id || null,holiday_date:form.holiday_date,title:form.title,kind:form.kind || 'official'});setHolidays(await get('/api/holidays'));setForm({});},'تم اعتماد الإجازة');}}>{admin && centerPick}{input('holiday_date','التاريخ','date')}{input('title','اسم الإجازة')}<Field label="النوع"><select value={form.kind || 'official'} onChange={e=>set('kind',e.target.value)}><option value="official">عطلة رسمية</option><option value="special">إجازة خاصة</option></select></Field>{saveButton}</form><Table heads={['التاريخ','الإجازة','النوع']} rows={holidays.map(h=>[String(h.holiday_date).slice(0,10),h.title,h.kind==='official'?'رسمية':'خاصة'])}/></section>
            )}
            {panel === 'التقييم والإنجاز' && (
              <section className="panel"><form onSubmit={e=>{e.preventDefault();run(async()=>setEvaluations(await get(`/api/evaluations?from=${form.from || today()}&to=${form.to || today()}`)));}}>{input('from','من','date',false)}{input('to','إلى','date',false)}<button className="primary" disabled={busy}>حساب التقييم</button></form><p><b>معادلة التقييم:</b> الحفظ الجديد 30% • المراجعة 40% • الحضور والانضباط 30%</p>{evaluations && <><h3>المتوسط: {evaluations.average}%</h3><Table heads={['الطالب','التاريخ','الحفظ 30%','المراجعة 40%','الانضباط 30%','النتيجة']} rows={evaluations.rows.map((r:Row)=>[r.full_name,String(r.day).slice(0,10),r.new_grade,r.review_grade,r.attendance_grade ?? '—',`${r.daily_score}%`])}/></>}</section>
            )}
            {panel === 'فتح التعديل الاستثنائي' && manager && <section className="panel"><h2>السماح بتعديل سجل قديم</h2><p>يفتح المدير للمعلم تعديل سجل الطالب في التاريخ المحدد لمدة 24 ساعة مع توثيق السبب.</p><form onSubmit={e=>{e.preventDefault();run(async()=>{await post('/api/edit-exceptions',{student_id:form.student_id,record_date:form.record_date,reason:form.reason});setForm({});},'تم فتح التعديل لمدة 24 ساعة');}}>{studentPick}{input('record_date','تاريخ السجل','date')}{input('reason','سبب فتح التعديل')}{saveButton}</form></section>}
            {panel === 'تقارير الإدارة' && staff && <section className="panel report"><form className="noPrint" onSubmit={e=>{e.preventDefault();run(async()=>setManagementReport(await get(`/api/reports/management?from=${form.from || new Date(Date.now()-29*86400000).toISOString().slice(0,10)}&to=${form.to || today()}`)));}}>{input('from','من','date',false)}{input('to','إلى','date',false)}<button className="primary" disabled={busy}>إنشاء التقرير</button></form>{managementReport && <><div className="reportHeader"><img src="./resources/logo-halaqat-ashour-bukhari.png" alt="شعار الحلقات"/><div><h2>التقرير الإداري لحلقات عاشور بخاري</h2><p>{managementReport.from} — {managementReport.to}</p></div></div><button className="primary noPrint" onClick={()=>window.print()}>طباعة / حفظ PDF</button><h3>أداء الحلقات</h3><Table heads={['الحلقة','المركز','المعلم','الطلاب','الحضور','متوسط الأداء']} rows={managementReport.circles.map((r:Row)=>[r.name,r.center_name,r.teacher_name || '—',r.students,`${r.attendance_rate}%`,`${r.quran_average}%`])}/><h3>طلاب يحتاجون متابعة</h3><Table heads={['الطالب','المركز','الحلقة','الحضور','متوسط الأداء']} rows={managementReport.needs_followup.map((r:Row)=>[r.full_name,r.center_name,r.circle_name || '—',`${r.attendance_rate}%`,`${r.quran_average}%`])}/></>}</section>}
            {panel === 'الإشعارات' && (
              <section className="panel">{manager && <form onSubmit={e=>{e.preventDefault();run(async()=>{await post('/api/notifications',{title:form.title,body:form.body,center_id:form.center_id || null});setNotifications(await get('/api/notifications'));setForm({});},'تم إرسال الإشعار');}}>{admin && centerPick}{input('title','عنوان الرسالة')}<Field label="الرسالة"><textarea required value={form.body || ''} onChange={e=>set('body',e.target.value)} /></Field>{saveButton}</form>}<Table heads={['الحالة','التاريخ','العنوان','الرسالة']} rows={notifications.map(n=>[n.is_read?'مقروء':<button disabled={busy} onClick={()=>run(async()=>{await api.put(`/api/notifications/${n.id}`,{});setNotifications(await get('/api/notifications'));},'تم تعليم الإشعار كمقروء')}>تعليم كمقروء</button>,String(n.created_at).slice(0,16).replace('T',' '),n.title,n.body])}/></section>
            )}
            {panel === 'ملف الطالب القرآني' && <section className='panel'><form onSubmit={e=>{e.preventDefault();run(async()=>setStudentProfile(await get(`/api/student-profile/${form.student_id}`)));}}>{studentPick}<button className='primary' disabled={busy}>عرض الملف</button></form>{studentProfile && <><div className='profileHero'><div><span>الملف القرآني</span><h2>{studentProfile.student.full_name}</h2><p>{studentProfile.student.center_name} • {studentProfile.student.circle_name || 'بدون حلقة'}</p></div><b>{studentProfile.student.points_balance} نقطة</b></div><div className='kpis compactKpis'><article><span>الحضور</span><b>{studentProfile.attendance.total ? Math.round(100*studentProfile.attendance.attended/studentProfile.attendance.total) : 0}%</b><small>{studentProfile.attendance.absent} غياب</small></article><article><span>آيات الحفظ</span><b>{studentProfile.quran.new_ayahs}</b><small>{studentProfile.quran.new_sessions} جلسة</small></article><article><span>آيات المراجعة</span><b>{studentProfile.quran.review_ayahs}</b><small>{studentProfile.quran.review_sessions} جلسة</small></article><article><span>متوسط الأداء</span><b>{studentProfile.quran.average_grade}%</b><small>آخر نشاط {studentProfile.quran.last_quran_date ? String(studentProfile.quran.last_quran_date).slice(0,10) : '—'}</small></article></div><h3>آخر الإنجازات</h3><Table heads={['التاريخ','النوع','السورة','الصفحات','الآيات','الدرجة','الملاحظة']} rows={studentProfile.recent.map((r:Row)=>[String(r.record_date).slice(0,10),recordTypes[r.record_type],surahs[Number(r.surah_no)-1]?.[0]||r.surah_no,`${getMadinahPage(Number(r.surah_no),Number(r.from_ayah))}–${getMadinahPage(Number(r.surah_no),Number(r.to_ayah))}`,`${r.from_ayah}–${r.to_ayah}`,r.grade ?? '—',r.notes || '—'])}/></>}</section>}
            {panel === 'التحفيز والجوائز' && staff && <section className='panel'><div className='panelHead'><div><h2>التحفيز والجوائز</h2><p>نقاط التقييم، كشف المهام الشهري، ومتجر جوائز الحلقة.</p></div><Field label='الشهر'><input type='month' value={recordMonth} onChange={e=>{setRecordMonth(e.target.value);get(`/api/motivation?month=${e.target.value}`).then(setMotivation).catch(x=>setNotice(message(x)));}}/></Field></div>{motivation?.circle && <><h3>كشف المهام — {motivation.circle.name}</h3><Field label='اختر الطالب'><select value={motivationStudent} onChange={e=>{const v=e.target.value;setMotivationStudent(v);get(`/api/motivation?month=${recordMonth}${v?`&student_id=${v}`:''}`).then(setMotivation).catch(x=>setNotice(message(x)));}}><option value=''>اختر اسم الطالب</option>{(motivation.students||[]).map((s:Row)=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></Field>{motivationStudent && <Table heads={['التاريخ',...(motivation.tasks||[]).map((t:Row)=>t.name),'نقاط اليوم']} rows={Array.from({length:new Date(Number(recordMonth.slice(0,4)),Number(recordMonth.slice(5,7)),0).getDate()},(_,i)=>`${recordMonth}-${String(i+1).padStart(2,'0')}`).map(d=>{const cells=(motivation.tasks||[]).map((t:Row)=>{const e=(motivation.entries||[]).find((x:Row)=>x.task_id===t.id&&String(x.entry_date).slice(0,10)===d);return t.answer_type==='done'?(e?.units?'تم':'—'):(e?.units??'—');});const total=(motivation.entries||[]).filter((x:Row)=>String(x.entry_date).slice(0,10)===d).reduce((a:number,x:Row)=>a+Number(x.points||0),0);return [d,...cells,total];})}/>}<h3>إعداد مهام الحلقة</h3><form onSubmit={e=>{e.preventDefault();run(async()=>{await post('/api/motivation/tasks',{circle_id:motivation.circle.id,name:form.task_name,answer_type:form.task_type||'done',points_per_unit:Number(form.task_points||1),max_units:Number(form.task_max||1)});setMotivation(await get(`/api/motivation?month=${recordMonth}`));},'تمت إضافة المهمة')}}>{input('task_name','اسم المهمة')}<Field label='طريقة الإجابة'><select value={form.task_type||'done'} onChange={e=>set('task_type',e.target.value)}><option value='done'>تم / لم يتم</option><option value='count'>عدد</option></select></Field>{input('task_points','النقاط لكل وحدة','number')}{form.task_type==='count'&&input('task_max','الحد الأعلى','number')}<button className='primary'>إضافة المهمة</button></form><h3>متجر الجوائز</h3><form onSubmit={e=>{e.preventDefault();run(async()=>{const r=await post('/api/motivation/rewards',{circle_id:motivation.circle.id,name:form.reward_name,points_cost:Number(form.reward_cost),stock:Number(form.reward_stock)});const file=(document.getElementById('reward-image') as HTMLInputElement)?.files?.[0];if(file){const reader=new FileReader();reader.onload=async()=>{const content=String(reader.result||'').split(',')[1]||'';await post(`/api/motivation/rewards/${r.id}/image`,{content,contentType:file.type});};reader.readAsDataURL(file);}setMotivation(await get(`/api/motivation?month=${recordMonth}`));},'تمت إضافة الجائزة')}}>{input('reward_name','اسم الجائزة')}{input('reward_cost','عدد النقاط المطلوبة','number')}{input('reward_stock','الكمية','number')}<Field label='صورة الجائزة — اختيارية'><input id='reward-image' type='file' accept='image/png,image/jpeg,image/webp'/></Field><button className='primary'>إضافة جائزة</button></form><Table heads={['الجائزة','النقاط','الكمية']} rows={(motivation.rewards||[]).map((r:Row)=>[r.name,r.points_cost,r.stock])}/><h3>طلبات الجوائز</h3><Table heads={['الطالب','الجائزة','الحالة','الإجراء']} rows={(motivation.requests||[]).map((r:Row)=>[r.full_name,r.reward_name,r.status==='pending'?'بانتظار الاعتماد':'تم التسليم',r.status==='pending'?<button onClick={()=>run(async()=>{await post(`/api/motivation/requests/${r.id}/approve`,{});setMotivation(await get(`/api/motivation?month=${recordMonth}`));},'تم اعتماد وتسليم الجائزة')}>اعتماد التسليم</button>:'—'])}/></>}</section>}
            {panel === 'نقاطي وجوائزي' && account.role === 'student' && <section className='panel'><div className='panelHead'><div><h2>نقاطي وجوائزي</h2><p>مهام اليوم ومتجر الجوائز الخاص بحلقتك.</p></div></div>{motivation?.student && <><div className='kpis compactKpis'><article><span>رصيدي المتاح</span><b>{motivation.student.points_balance}</b><small>نقطة</small></article></div><h3>مهام اليوم</h3><div className='taskCards'>{(motivation.tasks||[]).map((t:Row)=>{const existing=(motivation.entries||[]).find((x:Row)=>x.task_id===t.id&&String(x.entry_date).slice(0,10)===today());return <article key={t.id}><b>{t.name}</b><small>{t.answer_type==='done'?t.points_per_unit+` نقطة`:`نقطة لكل مرة — حتى ${t.max_units}`}</small>{t.answer_type==='done'?<button className={existing?.units?'primary':''} onClick={()=>run(async()=>{await post('/api/motivation/entries',{student_id:motivation.student.id,task_id:t.id,entry_date:today(),units:existing?.units?0:1});setMotivation(await get(`/api/motivation?month=${recordMonth}`));},'تم تحديث المهمة')}>{existing?.units?'تم ✓':'تم'}</button>:<select value={existing?.units||0} onChange={e=>run(async()=>{await post('/api/motivation/entries',{student_id:motivation.student.id,task_id:t.id,entry_date:today(),units:Number(e.target.value)});setMotivation(await get(`/api/motivation?month=${recordMonth}`));},'تم تحديث المهمة')}>{Array.from({length:Number(t.max_units)+1},(_,i)=><option key={i} value={i}>{i}</option>)}</select>}</article>})}</div><h3>متجر الجوائز</h3><div className='rewardGrid'>{(motivation.rewards||[]).map((r:Row)=><article className='rewardCard' key={r.id}><h3>{r.name}</h3><b>{r.points_cost} نقطة</b><small>{Number(r.stock)>0?`متبقي ${r.stock}`:'نفدت الكمية'}</small><button disabled={Number(r.stock)<1||Number(motivation.student.points_balance)<Number(r.points_cost)} onClick={()=>run(async()=>{await post(`/api/motivation/rewards/${r.id}/request`,{});setMotivation(await get(`/api/motivation?month=${recordMonth}`));},'تم إرسال طلب الجائزة للمعلم')}>طلب الجائزة</button></article>)}</div></>}</section>}
            {panel === 'الترتيب والتحفيز' && <section className='panel'><div className='panelHead'><div><h2>لوحة الترتيب والتحفيز</h2><p>ترتيب تحفيزي يجمع رصيد النقاط مع مؤشرات الأداء القرآني والحضور خلال آخر 30 يوماً.</p></div></div><div className='rankingList'>{rankings.map((r,index)=><article className='rankCard' key={r.id}><strong>{index+1}</strong><div><b>{r.full_name}</b><small>{r.circle_name || r.center_name}</small></div><span>{r.points_balance} نقطة</span><em>أداء {r.quran_average}% • حضور {r.attendance_rate}%</em></article>)}</div></section>}
            {panel === 'المسابقات' && staff && <section className='panel'>{manager && <form onSubmit={e=>{e.preventDefault();run(async()=>{await post('/api/competitions',{title:form.title,start_date:form.start_date,end_date:form.end_date,center_id:form.center_id || null});setCompetitions(await get('/api/competitions'));setForm({});},'تم إنشاء المسابقة');}}>{admin && centerPick}{input('title','اسم المسابقة')}{input('start_date','البداية','date')}{input('end_date','النهاية','date')}{saveButton}</form>}{competitions.map(c=><article className='competitionCard' key={c.id}><div><h3>{c.title}</h3><p>{String(c.start_date).slice(0,10)} — {String(c.end_date).slice(0,10)}</p></div><Table heads={['الترتيب','الطالب','الدرجة']} rows={(c.entries || []).map((x:Row,i:number)=>[i+1,x.full_name,x.score])}/>{staff && <form onSubmit={e=>{e.preventDefault();run(async()=>{await post(`/api/competitions/${c.id}/score`,{student_id:form.student_id,score:Number(form.score),notes:form.notes});setCompetitions(await get('/api/competitions'));},'تم تحديث نتيجة المسابقة');}}>{studentPick}{input('score','الدرجة','number')}{input('notes','ملاحظة','text',false)}<button disabled={busy}>تحديث النتيجة</button></form>}</article>)}</section>}
            {panel === 'النقاط والجوائز' && (
              <>
                <section className="panel">
                  <h2>النقاط</h2>
                  {staff && (
                    <form
                      onSubmit={submit('/api/points', {
                        student_id: form.student_id,
                        points: Number(form.points),
                        reason: form.reason,
                      })}
                    >
                      {studentPick}
                      {input('points', 'النقاط المضافة أو المخصومة', 'number')}
                      {input('reason', 'سبب الحركة')}
                      {saveButton}
                    </form>
                  )}
                  <Table
                    heads={['الطالب', 'الرصيد']}
                    rows={students.map(s => [s.full_name, s.points_balance])}
                  />
                </section>
                <section className="panel">
                  <h2>الجوائز</h2>
                  {admin && (
                    <form
                      onSubmit={submit('/api/rewards', {
                        name: form.name,
                        points_cost: Number(form.points_cost),
                        stock: Number(form.stock),
                      })}
                    >
                      {input('name', 'اسم الجائزة')}
                      {input('points_cost', 'تكلفة النقاط', 'number')}
                      {input('stock', 'المخزون', 'number')}
                      {saveButton}
                    </form>
                  )}
                  {manager && studentPick}
                  <Table
                    heads={['الجائزة', 'النقاط', 'المخزون', 'التسليم']}
                    rows={rewards.map(r => [
                      r.name,
                      r.points_cost,
                      r.stock ?? 'غير محدد',
                      manager ? (
                        <button
                          disabled={busy || !form.student_id}
                          onClick={() => {
                            if (
                              window.confirm(
                                `تأكيد تسليم ${r.name} وخصم ${r.points_cost} نقطة؟`
                              )
                            )
                              run(async () => {
                                await post(`/api/rewards/${r.id}/redeem`, {
                                  student_id: form.student_id,
                                });
                                await refresh(account);
                              }, 'تم تسليم الجائزة وخصم النقاط');
                          }}
                        >
                          تسليم الجائزة
                        </button>
                      ) : (
                        'عن طريق الإدارة'
                      ),
                    ])}
                  />
                </section>
              </>
            )}
            {panel === 'التقارير' && (
              <section className="panel report">
                <form
                  className="noPrint"
                  onSubmit={e => {
                    e.preventDefault();
                    run(async () => {
                      setReport(null);
                      setReport(
                        await get(
                          `/api/reports/student/${form.student_id}?from=${form.from || '2000-01-01'}&to=${form.to || today()}`
                        )
                      );
                    });
                  }}
                >
                  {studentPick}
                  {input('from', 'من تاريخ', 'date', false)}
                  {input('to', 'إلى تاريخ', 'date', false)}
                  <button className="primary" disabled={busy}>
                    عرض التقرير
                  </button>
                </form>
                {report && (
                  <>
                    <div className="reportHeader"><img src="./resources/logo-halaqat-ashour-bukhari.png" alt="شعار الحلقات"/><div><h2>حلقات عاشور بخاري — التقرير القرآني للطالب</h2><h3>{report.student.full_name}</h3><p>الفترة: {report.from} — {report.to}</p></div></div>
                    <div className="reportSummary"><span>المركز: {report.student.center_name || '—'}</span><span>الحلقة: {report.student.circle_name || '—'}</span><span>الرصيد: {report.student.points_balance} نقطة</span></div>
                    <button
                      className="primary noPrint"
                      onClick={() => window.print()}
                    >
                      طباعة / حفظ PDF
                    </button>
                    <h3>الحضور</h3>
                    <Table
                      heads={['التاريخ', 'الحالة']}
                      rows={report.attendance.map((a: Row) => [
                        String(a.attendance_date).slice(0, 10),
                        statuses[a.status],
                      ])}
                    />
                    <h3>الحفظ والمراجعة والتسميع</h3>
                    <Table
                      heads={[
                        'التاريخ',
                        'النوع',
                        'السورة',
                        'الصفحات',
                        'الآيات',
                        'الدرجة',
                        'ملاحظات',
                      ]}
                      rows={report.memorization.map((m: Row) => [
                        String(m.record_date).slice(0, 10),
                        recordTypes[m.record_type],
                        surahs[Number(m.surah_no)-1]?.[0] || m.surah_no,
                        `${getMadinahPage(Number(m.surah_no),Number(m.from_ayah))}–${getMadinahPage(Number(m.surah_no),Number(m.to_ayah))}`,
                        `${m.from_ayah}–${m.to_ayah}`,
                        m.grade ?? '—',
                        m.notes || '—',
                      ])}
                    />
                    <h3>حركات النقاط</h3>
                    <Table
                      heads={['التاريخ', 'النقاط', 'السبب']}
                      rows={report.points.map((p: Row) => [
                        String(p.created_at).slice(0, 10),
                        p.points,
                        p.reason,
                      ])}
                    />
                  </>
                )}
              </section>
            )}
            {panel === 'الحسابات والدخول' && admin && <><section className='panel accountHub'><div className='panelHead'><div><h2>الحسابات والدخول</h2><p>هنا تدير كل من يريد الدخول للمنصة: الطلبات الجديدة، الحسابات المعتمدة، الأدوار، المراكز وحالة الدخول.</p></div><span className={loginRequests.length?'pendingBadge':'readyBadge'}>{loginRequests.length?`${loginRequests.length} طلب جديد`:'لا توجد طلبات معلقة'}</span></div><div className='adminSteps'><b>الطريقة الأسهل:</b><span>1. المستخدم يضغط «دخول المنصة»</span><span>2. يظهر طلبه هنا</span><span>3. اضغط «إعداد الحساب» وحدد دوره ومركزه</span><span>4. يدخل المستخدم بنفس بريده</span></div></section><section className='panel'><h2>طلبات الدخول الجديدة</h2>{loginRequests.length?<div className='accountCards'>{loginRequests.map(r=><article key={r.id} className='accountCard'><div><b>{r.full_name||'مستخدم جديد'}</b><small>{r.email}</small><small>طلب الدخول: {String(r.requested_at).slice(0,10)}</small></div><button className='primary' onClick={()=>{setForm({full_name:r.full_name||'',email:r.email,role:'teacher'});document.getElementById('new-account-form')?.scrollIntoView({behavior:'smooth'});}}>إعداد الحساب</button></article>)}</div>:<p className='emptyState'>لا توجد طلبات دخول جديدة حاليًا.</p>}</section><section className='panel' id='new-account-form'><h2>إضافة أو اعتماد حساب</h2><p>أدخل البيانات أو اختر «إعداد الحساب» من الطلبات أعلاه. ربط الحساب بالمركز أو الحلقة ليس شرطًا للدخول، ويمكن إسناده لاحقًا.</p><form onSubmit={submit('/api/users',{...form,role:form.role||'teacher'})}>{input('full_name','الاسم')}{input('email','البريد الإلكتروني','email')}<Field label='نوع الحساب'><select value={form.role||'teacher'} onChange={e=>set('role',e.target.value)}>{Object.entries(roles).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field><Field label='المركز — اختياري'><Pick required={false} rows={centers} value={form.center_id||''} onChange={v=>set('center_id',v)} label='بدون مركز حاليًا'/><small>يمكن ربط الحساب بالمركز والحلقة لاحقًا من الإدارة.</small></Field>{saveButton}</form></section><section className='panel'><div className='panelHead'><div><h2>الحسابات المعتمدة</h2><p>الحالة «دخل سابقًا» تعني أن صاحب البريد نجح في ربط حساب الدخول بالمنصة.</p></div><b>{users.length} حساب</b></div><div className='accountCards'>{users.map(u=><article key={u.id} className='accountCard'><div><b>{u.full_name}</b><small>{u.email}</small><div className='accountTags'><span>{roles[u.role]}</span><span className={u.is_active?'tagOk':'tagOff'}>{u.is_active?'نشط':'موقوف'}</span><span className={u.has_logged_in?'tagOk':'tagWait'}>{u.has_logged_in?'دخل سابقًا':'لم يدخل بعد'}</span></div></div><div className='cardActions'><button onClick={()=>setForm({edit_user_id:u.id,full_name:u.full_name,role:u.role,center_id:u.center_id||''})}>تعديل</button><button disabled={u.id===account?.id} onClick={()=>run(async()=>{await api.put(`/api/users/${u.id}`,{is_active:!u.is_active});await refresh(account!);},'تم تحديث الحساب')}>{u.is_active?'إيقاف':'تفعيل'}</button><button className='dangerButton' disabled={u.id===account?.id} onClick={()=>{if(confirm(`حذف حساب ${u.full_name}؟`))run(async()=>{await api.delete(`/api/users/${u.id}`);await refresh(account!);},'تم حذف الحساب')}}>حذف</button></div></article>)}</div>{form.edit_user_id&&<form className='quickEdit' onSubmit={e=>{e.preventDefault();run(async()=>{await api.put(`/api/users/${form.edit_user_id}`,{full_name:form.full_name,role:form.role,center_id:form.center_id||null});setForm({});await refresh(account!);},'تم حفظ تعديل الحساب');}}><h3>تعديل الحساب المحدد</h3>{input('full_name','الاسم')}<Field label='الدور'><select value={form.role||'teacher'} onChange={e=>set('role',e.target.value)}>{Object.entries(roles).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>{centerPick}<div className='cardActions'>{saveButton}<button type='button' onClick={()=>setForm({})}>إلغاء</button></div></form>}</section><section className='panel'><h2>ربط الطالب بحسابه أو بولي أمره</h2><p>استخدم هذه الخطوة فقط لحسابات الطلاب وأولياء الأمور.</p><form onSubmit={submit('/api/account-links',{student_id:form.student_id,user_id:form.user_id})}>{studentPick}<Field label='حساب الطالب / ولي الأمر'><Pick rows={users.filter(u=>['student','guardian'].includes(u.role)&&u.is_active)} value={form.user_id||''} onChange={v=>set('user_id',v)}/></Field>{saveButton}</form></section></>}
            {panel === 'الأدوار والصلاحيات' && admin && <><section className='panel'><div className='panelHead'><div><h2>الأدوار والصلاحيات</h2><p>مدير النظام يمتلك صلاحية الجذر، ويمكنه إنشاء أدوار مخصصة وتحديد صلاحياتها.</p></div><span className='readyBadge'>Root Access</span></div><form onSubmit={e=>{e.preventDefault();run(async()=>{await post('/api/admin/roles',{code:form.role_code,name:form.role_name});setAdminRoles(await get('/api/admin/roles'));setForm({});},'تم إنشاء الدور')}}>{input('role_name','اسم الدور')}{input('role_code','رمز الدور بالإنجليزية')}<button className='primary' disabled={busy}>إنشاء الدور</button></form></section><section className='panel'><div className='permissionCards'>{(adminRoles.roles||[]).map((r:Row)=><article className='accountCard' key={r.id}><div><b>{r.name}</b><small>{r.code}{r.is_system?' • دور أساسي':''}</small><div className='accountTags'>{(r.permissions||[]).map((p:Row)=><span key={p.id}>{p.name}</span>)}</div></div>{!r.is_system&&<button className='dangerButton' onClick={()=>{if(confirm(`حذف الدور ${r.name}؟`))run(async()=>{await api.delete(`/api/admin/roles/${r.id}`);setAdminRoles(await get('/api/admin/roles'));},'تم حذف الدور')}}>حذف الدور</button>}</article>)}</div></section></>}
            {panel === 'سجل العمليات' && admin && <section className='panel'><div className='panelHead'><div><h2>سجل العمليات</h2><p>تتبع العمليات الإدارية الحساسة: إنشاء الحسابات وتعديلها وحذفها، إدارة الأدوار، المراكز والحلقات، وإعادة فتح السجلات.</p></div><button onClick={()=>run(async()=>setAuditRows(await get('/api/admin/audit')))}>تحديث</button></div><Table heads={['الوقت','المستخدم','العملية','النوع','المعرف','السبب']} rows={auditRows.map((a:Row)=>[new Date(a.created_at).toLocaleString('ar-SA'),a.actor_name,a.action,a.entity_type,a.entity_id||'—',a.reason||'—'])}/></section>}
            {panel === 'صور الموقع' && admin && <section className='panel'><div className='panelHead'><div><h2>صور الموقع</h2><p>ارفع الصور مباشرة من جهازك. الصورة الجديدة تظهر تلقائيًا في واجهة الموقع والأخبار والإنجازات والوسائط.</p></div><b>{Object.keys(siteImages).length}/17 مرفوعة</b></div><div className='siteImageAdmin'>{siteImageSlots.map(([key,label])=><article key={key}><div className='siteImagePreview'>{siteImages[key]?<img src={siteImages[key]} alt={label}/>:<span>لا توجد صورة مرفوعة</span>}</div><div><b>{label}</b><small>PNG / JPG / WEBP — حتى 7 MB</small><label className='uploadButton'>اختيار صورة<input type='file' accept='image/png,image/jpeg,image/webp' onChange={e=>uploadSiteImage(key,e.target.files?.[0])}/></label></div></article>)}</div></section>}
            {panel === 'جاهزية التشغيل' && manager && <section className='panel'><div className='panelHead'><div><h2>جاهزية التشغيل الفعلي</h2><p>فحص مباشر للمتطلبات الأساسية قبل بدء الحلقة التجريبية ثم التوسع لبقية الحلقات.</p></div>{readiness && <span className={readiness.ready?'readyBadge':'pendingBadge'}>{readiness.ready?'جاهز للتجربة':'توجد متطلبات ناقصة'}</span>}</div>{readiness && <><div className='readinessGrid'>{readiness.checks.map((x:Row)=><article key={x.key} className={x.ok?'checkOk':'checkPending'}><b>{x.ok?'✓':'!'}</b><span>{x.label}</span></article>)}</div><div className='kpis compactKpis'><article><span>المراكز</span><b>{readiness.centers}</b></article><article><span>الحلقات</span><b>{readiness.circles_with_teacher}/{readiness.circles}</b><small>مرتبطة بمعلم</small></article><article><span>الطلاب</span><b>{readiness.students_in_circle}/{readiness.active_students}</b><small>مرتبطون بحلقة</small></article><article><span>المعلمون</span><b>{readiness.active_teachers}</b><small>حساب نشط</small></article></div><div className='pilotBox'><h3>اختبار الحلقة التجريبية</h3><ol><li>اختر حلقة واحدة ومعلمًا و5 طلاب.</li><li>سجّل الحضور والتأخر والغياب.</li><li>سجّل الحفظ والمراجعة والتقييم.</li><li>اعتمد اليوم وتحقق من منع التعديل بعد الاعتماد.</li><li>افتح ملف الطالب وتقرير الإدارة وتحقق من البيانات.</li><li>جرّب ولي الأمر أو الطالب المرتبط ثم اطبع التقرير PDF.</li></ol></div><button onClick={()=>run(async()=>setReadiness(await get('/api/readiness')))}>إعادة فحص الجاهزية</button></>}</section>}
            {panel === 'الإعدادات' && manager && (
              <>
                <section className='panel'><h2>إعدادات التشغيل</h2><p>يمكن تعديل هذه القيم قبل الإطلاق. يجب أن يكون مجموع أوزان التقييم 100%.</p><form onSubmit={e=>{e.preventDefault();run(async()=>{const payload={grace_minutes:Number(form.grace_minutes),minor_late_penalty:Number(form.minor_late_penalty),major_late_penalty:Number(form.major_late_penalty),memorization_weight:Number(form.memorization_weight),review_weight:Number(form.review_weight),discipline_weight:Number(form.discipline_weight),edit_window_days:Number(form.edit_window_days)};setOperationalSettings(await api.put('/api/operational-settings',payload).then(r=>r.data));},'تم تحديث إعدادات التشغيل');}}>{input('grace_minutes','مهلة التأخر بالدقائق','number')}{input('minor_late_penalty','خصم التأخر البسيط','number')}{input('major_late_penalty','خصم التأخر الكبير','number')}{input('memorization_weight','وزن الحفظ %','number')}{input('review_weight','وزن المراجعة %','number')}{input('discipline_weight','وزن الحضور والانضباط %','number')}{input('edit_window_days','مهلة تعديل السجل بالأيام','number')}{saveButton}</form>{operationalSettings && <small>آخر إعداد محفوظ: مهلة {operationalSettings.grace_minutes} دقائق، وأوزان {operationalSettings.memorization_weight}/{operationalSettings.review_weight}/{operationalSettings.discipline_weight}.</small>}</section>
                <section className='panel'><h2>نسخة تشغيلية من البيانات</h2><p>يستطيع المدير تصدير بيانات الطلاب والحضور والحفظ والنقاط بصيغة JSON للاحتفاظ بنسخة إدارية أو تحليلها لاحقاً.</p><button onClick={()=>run(async()=>{const data=await get('/api/export/operations');const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`ashour-operations-${today()}.json`;a.click();URL.revokeObjectURL(url);},'تم تجهيز نسخة البيانات')}>تصدير بيانات التشغيل</button></section>
                {admin && <section className="panel">
                  <h2>إضافة حساب</h2>
                  <form
                    onSubmit={submit('/api/users', {
                      ...form,
                      role: form.role || 'teacher',
                    })}
                  >
                    {input('full_name', 'الاسم')}
                    {input('email', 'البريد الإلكتروني', 'email')}
                    <Field label="الدور">
                      <select
                        value={form.role || 'teacher'}
                        onChange={e => set('role', e.target.value)}
                      >
                        {Object.entries(roles)
                          .filter(([k]) => k !== 'system_admin')
                          .map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                      </select>
                    </Field>
                    {centerPick}
                    {saveButton}
                  </form>
                  <Table
                    heads={['الاسم', 'البريد', 'الدور', 'الحالة']}
                    rows={users.map(u => [
                      u.full_name,
                      u.email,
                      roles[u.role],
                      u.role === 'system_admin' ? (
                        'مدير النظام'
                      ) : (
                        <button
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              await api.put(`/api/users/${u.id}`, {
                                is_active: !u.is_active,
                              });
                              await refresh(account);
                            }, 'تم تحديث الحساب')
                          }
                        >
                          {u.is_active ? 'إيقاف الحساب' : 'تفعيل الحساب'}
                        </button>
                      ),
                    ])}
                  />
                </section>}
                {admin && <section className="panel">
                  <h2>ربط الطالب بحساب الطالب أو ولي أمره</h2>
                  <form
                    onSubmit={submit('/api/account-links', {
                      student_id: form.student_id,
                      user_id: form.user_id,
                    })}
                  >
                    {studentPick}
                    <Field label="الحساب">
                      <Pick
                        rows={users.filter(u =>
                          ['student', 'guardian'].includes(u.role)
                        )}
                        value={form.user_id || ''}
                        onChange={v => set('user_id', v)}
                      />
                    </Field>
                    {saveButton}
                  </form>
                </section>}
              </>
            )}
            {panel === 'الأخبار والفعاليات' && admin && (
              <section className="panel">
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    run(async () => {
                      await post('/api/news', {
                        title: form.title,
                        body: form.body,
                        kind: form.kind || 'news',
                      });
                      setNews(await get('/api/news'));
                      setForm({});
                    }, 'تم نشر المحتوى');
                  }}
                >
                  {input('title', 'العنوان')}
                  <Field label="التصنيف">
                    <select
                      value={form.kind || 'news'}
                      onChange={e => set('kind', e.target.value)}
                    >
                      <option value="news">خبر</option>
                      <option value="event">فعالية</option>
                      <option value="achievement">إنجاز</option>
                    </select>
                  </Field>
                  <Field label="النص">
                    <textarea
                      required
                      value={form.body || ''}
                      onChange={e => set('body', e.target.value)}
                    />
                  </Field>
                  <button className="primary" disabled={busy}>
                    نشر
                  </button>
                </form>
                {news.map(n => (
                  <article key={n.id}>
                    <h3>{n.title}</h3>
                    <p>{n.body}</p>
                  </article>
                ))}
              </section>
            )}
          </section>
        </div>
      )}
      <footer className="siteFooter noPrint">
        <div className="footerGrid">
          <div className="footerBrand">
            <img src="./resources/logo-halaqat-ashour-bukhari.png" alt="شعار حلقات عاشور بخاري" />
            <div>
              <b>حلقات عاشور بخاري</b>
              <p>منصة تعليم القرآن الكريم وإدارة الحلقات ومتابعة الأثر.</p>
            </div>
          </div>
          <div className="footerLinks">
            <b>روابط سريعة</b>
            <button onClick={() => { setDashboard(false); setView('الرئيسية'); }}>الرئيسية</button>
            <button onClick={() => { setDashboard(false); setView('عن الحلقات'); }}>عن الحلقات</button>
            <button onClick={() => { setDashboard(false); setView('الأخبار والفعاليات'); }}>الأخبار والفعاليات</button>
          </div>
          <div className="footerPromise">
            <b>تعليم • متابعة • إنجاز</b>
            <p>تجربة رقمية منظمة تخدم الإدارة والمعلم والطالب والأسرة.</p>
          </div>
        </div>
        <div className="footerBottom">
          <small>جميع الحقوق محفوظة © 2026 — حلقات عاشور بخاري</small>
          <span>خدمة كتاب الله مسؤولية وأثر</span>
        </div>
      </footer>
    </main>
  );
}
