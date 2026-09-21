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
  email: string | null;
  role: string;
  center_id: string | null;
  is_active: boolean;
  linked: boolean;
};

export type StudentRow = {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  is_active: boolean | null;
  circle_name: string | null;
  center_name: string | null;
};

export type CircleRow = {
  id: string;
  name: string;
  center_name: string | null;
  teacher_name: string | null;
  teacher_email: string | null;
  students_count: number;
};

const ACCESS_KEY = 'ashour_access_code';

export function getAccessCode(): string {
  return localStorage.getItem(ACCESS_KEY) || '';
}

export function setAccessCode(code: string) {
  localStorage.setItem(ACCESS_KEY, code);
}

export function clearAccessCode() {
  localStorage.removeItem(ACCESS_KEY);
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    headers: {
      Accept: 'application/json',
      'x-access-code': getAccessCode(),
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
    throw new Error(payload?.message || payload?.error || `HTTP ${response.status}`);
  }

  return payload as T;
}

export async function getStatus() {
  const response = await fetch('/api/status', { headers: { Accept: 'application/json' } });
  return response.json();
}
