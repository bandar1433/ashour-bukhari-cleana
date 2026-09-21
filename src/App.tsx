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

type Tab = 'students' | 'circles' | 'users';

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
  const [activeTab, setActiveTab] = useState<Tab>('students');
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
      const [summaryData, studentsData, circlesData, usersData] = await Promise.all([
        apiGet<Summary>('/api/summary'),
        apiGet<{ items: StudentRow[] }>('/api/students'),
        apiGet<{ items: CircleRow[] }>('/api/circles'),
        apiGet<{ items: UserRow[] }>('/api/users'),
      ]);

      setSummary(summaryData);
      setStudents(studentsData.items || []);
      setCircles(circlesData.items || []);
      setUsers(usersData.items || []);
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

          <section className="cards-grid">
            <StatCard label="الطلاب" value={summary?.students} />
            <StatCard label="المعلمون" value={summary?.teachers} />
            <StatCard label="الحلقات" value={summary?.circles} />
            <StatCard label="المراكز" value={summary?.centers} />
            <StatCard label="المستخدمون" value={summary?.users} />
            <StatCard label="الحسابات النشطة" value={summary?.activeUsers} />
          </section>

          <section className="panel">
            <div className="panel-header">
              <div className="tabs">
                <button className={activeTab === 'students' ? 'active' : ''} onClick={() => setActiveTab('students')}>الطلاب</button>
                <button className={activeTab === 'circles' ? 'active' : ''} onClick={() => setActiveTab('circles')}>الحلقات</button>
                <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>المستخدمون</button>
              </div>
              <input
                className="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="بحث..."
              />
            </div>

            {loadState === 'loading' && <div className="empty">جارٍ تحميل البيانات...</div>}
            {loadState !== 'loading' && activeTab === 'students' && <StudentsTable rows={filteredStudents} />}
            {loadState !== 'loading' && activeTab === 'circles' && <CirclesTable rows={filteredCircles} />}
            {loadState !== 'loading' && activeTab === 'users' && <UsersTable rows={filteredUsers} />}
          </section>
        </main>
      )}
    </div>
  );
}

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
