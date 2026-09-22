import { query } from '../_lib/db.js';
import { validUuid } from '../_lib/actor.js';

export const managers=['system_admin','center_manager','supervisor'];
export const today=()=>new Date().toISOString().slice(0,10);
export const int=(v:any,min=0,max=100000)=>{const n=Number(v);if(!Number.isInteger(n)||n<min||n>max)throw new Error('قيمة رقمية غير صالحة');return n};
export const txt=(v:any,max=1000)=>String(v??'').trim().slice(0,max);

export async function scopedStudent(u:any,idValue:any){
  const sid=validUuid(idValue); if(!sid)return null;
  return (await query<any>(`select s.*,h.teacher_user_id from students s left join circles h on h.id=s.circle_id where s.id=$4 and
    ($1='system_admin' or ($1 in ('center_manager','supervisor') and s.center_id=$2::uuid) or
     ($1='teacher' and h.teacher_user_id=$3::uuid) or ($1='student' and s.user_id=$3::uuid))`,
    [u.role,u.center_id,u.id,sid]))[0]||null;
}
