import { query } from './db.js';
import { json, verifyAppSession, type AppRole } from './http.js';

export type Actor={id:string;role:AppRole;center_id:string|null;full_name:string;email:string|null};

export async function getActor(req:any,res:any):Promise<Actor|null>{
  const expected=process.env.ADMIN_ACCESS_CODE;
  const access=String(req.headers['x-access-code']||'');
  if(expected && access===expected){
    const root=(await query<Actor>(`select id,role::text role,center_id,full_name,email from users where role='system_admin' and is_active order by created_at limit 1`))[0];
    if(root)return root;
    json(res,403,{error:'Forbidden',message:'لا يوجد حساب مدير نظام نشط في قاعدة البيانات.'});
    return null;
  }
  const auth=String(req.headers.authorization||'');
  const token=auth.startsWith('Bearer ')?auth.slice(7).trim():'';
  const session=token?verifyAppSession(token):null;
  if(!session){
    json(res,401,{error:'Unauthorized',message:'جلسة الدخول غير صالحة أو انتهت. سجّل الدخول من جديد.'});
    return null;
  }
  const user=(await query<Actor>('select id,role::text role,center_id,full_name,email from users where id=$1 and is_active',[session.userId]))[0];
  if(!user){
    json(res,403,{error:'Forbidden',message:'الحساب غير نشط أو غير موجود.'});
    return null;
  }
  return user;
}

export function isStaff(role:string){return ['system_admin','center_manager','supervisor','teacher'].includes(role)}
export function validDate(value:unknown){
  const s=String(value||'');
  return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))?s:'';
}
export function validMonth(value:unknown){
  const s=String(value||'');
  return /^\d{4}-\d{2}$/.test(s)?s:'';
}
export function validUuid(value:unknown){
  const s=String(value||'');
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)?s:'';
}
