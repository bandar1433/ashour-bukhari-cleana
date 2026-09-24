export type Summary = {
  centers: number;
  circles: number;
  students: number;
  teachers: number;
  users: number;
  activeUsers: number;
  attendance: number;
  memorization: number;
  plans: number;
  news: number;
};

export type UserRow = {
  id: string;
  full_name: string;
  document_no?: string | null;
  mobile?: string | null;
  birth_date?: string | null;
  grade_level?: string | null;
  registration_date?: string | null;
  email: string | null;
  phone?: string | null;
  role: string;
  center_id: string | null;
  is_active: boolean;
  linked: boolean;
};

export type StudentRow = {
  id: string;
  user_id: string | null;
  center_id: string | null;
  circle_id: string | null;
  full_name: string;
  email: string | null;
  is_active: boolean | null;
  status: string;
  points_balance: number;
  circle_name: string | null;
  center_name: string | null;
};

export type CircleRow = {
  id: string;
  name: string;
  center_id: string;
  teacher_user_id: string | null;
  center_name: string | null;
  teacher_name: string | null;
  teacher_email: string | null;
  students_count: number;
  schedule?: string | null;
  circle_type?: string | null;
  start_time?: string | null;
  grace_minutes?: number;
  student_track?: string | null;
  quran_track?: string | null;
  is_active?: boolean;
};

export type CenterRow = {
  id: string;
  name: string;
  location: string | null;
  manager_user_id: string | null;
  manager_name: string | null;
  is_active: boolean;
  circles_count: number;
};

const ACCESS_KEY = 'ashour_access_code';
const SESSION_KEY = 'ashour_admin_session';

export function getAccessCode(): string {
  return localStorage.getItem(ACCESS_KEY) || '';
}

export function setAccessCode(code: string) {
  localStorage.setItem(ACCESS_KEY, code);
}

export function clearAccessCode() {
  localStorage.removeItem(ACCESS_KEY);
}

export function getSessionToken(): string {
  return localStorage.getItem(SESSION_KEY) || '';
}

export function setSessionToken(token: string) {
  localStorage.setItem(SESSION_KEY, token);
}

export function clearSessionToken() {
  localStorage.removeItem(SESSION_KEY);
}

export function getSessionRole(): string {
  try {
    const token=getSessionToken();
    if(!token) return '';
    const encoded=token.split('.')[1]||'';
    const normalized=encoded.replace(/-/g,'+').replace(/_/g,'/');
    const padded=normalized+'='.repeat((4-normalized.length%4)%4);
    const payload=JSON.parse(atob(padded));
    return String(payload?.role||'');
  } catch { return ''; }
}

export function readableError(value:any,fallback='حدث خطأ غير متوقع'):string{
  if(value===null||value===undefined||value==='') return fallback;
  if(typeof value==='string') return value;
  if(value instanceof Error) return value.message||fallback;
  if(typeof value==='object'){
    const candidates=[
      value.message,
      value.error_description,
      value.detail,
      value.details,
      value.reason,
      value.title,
      value?.error?.message,
      value?.error?.detail,
      value?.cause?.message,
      Array.isArray(value.issues)?value.issues.map((x:any)=>x?.message||x).filter(Boolean).join('، '):null,
      Array.isArray(value.errors)?value.errors.map((x:any)=>x?.message||x).filter(Boolean).join('، '):null,
    ];
    for(const item of candidates){
      if(typeof item==='string'&&item.trim()) return item.trim();
    }
    try{
      const json=JSON.stringify(value);
      if(json&&json!=='{}') return json.length>700?json.slice(0,700)+'…':json;
    }catch{}
  }
  return String(value)==='[object Object]'?fallback:String(value);
}

function responseError(payload:any,status:number){
  const raw=payload?.message ?? payload?.error ?? payload;
  return readableError(raw,`تعذر تنفيذ الطلب (HTTP ${status})`);
}

function handleUnauthorized(status:number,payload:any){
  if(status!==401||!getSessionToken())return;
  clearSessionToken();
  clearAccessCode();
  try{
    localStorage.setItem('ashour_explicit_logout','1');
    window.dispatchEvent(new CustomEvent('ashour:session-expired',{detail:{
      message:readableError(payload?.message??payload?.error,'انتهت جلسة الدخول. سجّل الدخول من جديد.')
    }}));
  }catch{}
}

function authHeaders(): Record<string,string> {
  const headers: Record<string,string> = {};
  const code = getAccessCode();
  const session = getSessionToken();
  if (code) headers['x-access-code'] = code;
  if (session) headers.Authorization = `Bearer ${session}`;
  return headers;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    headers: {
      Accept: 'application/json',
      ...authHeaders(),
    },
  });

  const text = await response.text();
  let payload: any = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { error: text || 'Invalid response' };
  }

  if (!response.ok) {
    handleUnauthorized(response.status,payload);
    throw new Error(responseError(payload,response.status));
  }

  return payload as T;
}

export async function getStatus() {
  const response = await fetch('/api/status', { headers: { Accept: 'application/json' } });
  return response.json();
}

export async function apiPost<T>(path:string,body:unknown):Promise<T>{const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify(body)});const text=await response.text();let payload:any;try{payload=text?JSON.parse(text):null}catch{payload={error:text}}if(!response.ok){handleUnauthorized(response.status,payload);throw new Error(responseError(payload,response.status))}return payload as T;}


export async function apiPut<T>(path:string,body:unknown):Promise<T>{
  const response=await fetch(path,{
    method:'PUT',
    headers:{'Content-Type':'application/json',...authHeaders()},
    body:JSON.stringify(body)
  });
  const text=await response.text();
  let payload:any;
  try{payload=text?JSON.parse(text):null}catch{payload={error:text}}
  if(!response.ok){handleUnauthorized(response.status,payload);throw new Error(responseError(payload,response.status))}
  return payload as T;
}
