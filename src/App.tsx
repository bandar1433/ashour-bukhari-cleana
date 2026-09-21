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
    <div className="app-shell">
      <header className="hero">
        <div>
          <div className="brand-row"><div className="brand-mark">ع</div><div><p className="eyebrow">حلقات القرآن الكريم</p><h1>حلقات عاشور بخاري</h1><p className="hero-subtitle">منصة متكاملة لإدارة الحلقات والطلاب والمتابعة التعليمية.</p></div></div>
        </div>
        <div className="status-card">
          <span className={status?.database === 'connected' ? 'dot good' : 'dot bad'} />
          <div>
            <strong>{status?.database === 'connected' ? 'قاعدة البيانات متصلة' : 'بانتظار الاتصال'}</strong>
            <small>{status?.database === 'connected' ? 'النظام متصل وجاهز للعمل' : 'جارٍ فحص الاتصال...'}</small>
          </div>
        </div>
      </header>

      {!code ? (
        <main className="login-card">
          <div className="login-icon">⌁</div><h2>دخول لوحة الإدارة</h2><p>أدخل رمز الدخول للوصول إلى لوحة إدارة الحلقات.</p>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={enteredCode}
              onChange={(event) => setEnteredCode(event.target.value)}
              placeholder="رمز الدخول"
              autoFocus
            />
            <button type="submit">دخول</button>
          </form>
          {error && <div className="alert">{error}</div>}
        </main>
      ) : (
        <main>
          <div className="toolbar">
            <button onClick={loadDashboard} disabled={loadState === 'loading'}>
              {loadState === 'loading' ? 'جارٍ التحديث...' : 'تحديث البيانات'}
            </button>
            <button className="secondary" onClick={handleLogout}>خروج</button>
          </div>

          {error && <div className="alert">{error}</div>}

          <section className="welcome-strip"><div><span>لوحة مدير النظام</span><h2>نظرة عامة على المنصة</h2><p>متابعة الحلقات والطلاب والمعلمين والسجلات التعليمية من مكان واحد.</p></div><div className="quick-badge">● النظام يعمل</div></section>
          <section className="cards-grid">
            <StatCard label="الطلاب" value={summary?.students} />
            <StatCard label="المعلمون" value={summary?.teachers} />
            <StatCard label="الحلقات" value={summary?.circles} />
            <StatCard label="المراكز" value={summary?.centers} />
            <StatCard label="الحضور المسجل" value={summary?.attendance} />
            <StatCard label="سجلات التسميع" value={summary?.memorization} />
          </section>
          <section className="module-grid">
            <ModuleCard icon="◉" title="الحضور والانصراف" value={summary?.attendance} note="سجلات الحضور المسجلة" />
            <ModuleCard icon="۞" title="التسميع والمراجعة" value={summary?.memorization} note="سجلات القرآن الكريم" />
            <ModuleCard icon="▤" title="الخطط الأسبوعية" value={summary?.plans} note="خطط الطلاب التعليمية" />
            <ModuleCard icon="◆" title="الأخبار والمحتوى" value={summary?.news} note="المحتوى المنشور بالموقع" />
          </section>

          <section className="panel">
            <div className="panel-header">
              <div className="tabs">
                <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>الرئيسية</button>
                <button className={activeTab === 'students' ? 'active' : ''} onClick={() => setActiveTab('students')}>الطلاب</button>
                <button className={activeTab === 'circles' ? 'active' : ''} onClick={() => setActiveTab('circles')}>الحلقات</button>
                <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>المستخدمون</button>
                <button className={activeTab === 'attendance' ? 'active' : ''} onClick={() => setActiveTab('attendance')}>الحضور</button>
                <button className={activeTab === 'memorization' ? 'active' : ''} onClick={() => setActiveTab('memorization')}>التسميع</button>
                <button className={activeTab === 'plans' ? 'active' : ''} onClick={() => setActiveTab('plans')}>الخطط</button>
                <button className={activeTab === 'news' ? 'active' : ''} onClick={() => setActiveTab('news')}>الأخبار</button>
              </div>
              <input
                className="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="بحث..."
              />
            </div>

            {loadState === 'loading' && <div className="empty">جارٍ تحميل البيانات...</div>}
            {loadState !== 'loading' && activeTab === 'overview' && <div className="overview-copy"><h3>إدارة المنصة</h3><p>اختر من التبويبات الطلاب أو الحلقات أو المستخدمين. وستضاف هنا تباعًا شاشات الحضور والتسميع والخطط والمحتوى مع المحافظة على البيانات الحالية.</p></div>}
            {loadState !== 'loading' && activeTab === 'students' && <StudentsTable rows={filteredStudents} />}
            {loadState !== 'loading' && activeTab === 'circles' && <CirclesTable rows={filteredCircles} />}
            {loadState !== 'loading' && activeTab === 'users' && <UsersTable rows={filteredUsers} />}
            {loadState !== 'loading' && activeTab === 'attendance' && <GenericTable rows={attendance} columns={[['full_name','الطالب'],['circle_name','الحلقة'],['attendance_date','التاريخ'],['status','الحالة'],['late_minutes','دقائق التأخر']]} />}
            {loadState !== 'loading' && activeTab === 'memorization' && <GenericTable rows={memorization} columns={[['full_name','الطالب'],['record_date','التاريخ'],['record_type','النوع'],['surah_no','السورة'],['from_ayah','من آية'],['to_ayah','إلى آية'],['grade','الدرجة'],['approved','معتمد']]} />}
            {loadState !== 'loading' && activeTab === 'plans' && <GenericTable rows={plans} columns={[['full_name','الطالب'],['week_start','الأسبوع'],['day_name','اليوم'],['new_target','الجديد'],['review_target','المراجعة'],['goals','الأهداف']]} />}
            {loadState !== 'loading' && activeTab === 'news' && <GenericTable rows={news} columns={[['title','العنوان'],['kind','النوع'],['event_date','التاريخ'],['status','الحالة']]} />}
          </section>
        </main>
      )}
    </div>
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
