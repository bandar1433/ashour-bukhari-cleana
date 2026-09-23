import {query} from './db.js';
export async function ensureWeeklyLocks(){
  await query(`create table if not exists weekly_locks(
    id uuid primary key default gen_random_uuid(),
    circle_id uuid not null references circles(id) on delete cascade,
    week_start date not null,
    locked_by uuid references users(id),
    locked_at timestamptz not null default now()
  )`);
}
export function weekStart(dateStr:string){
  const d=new Date(dateStr+'T00:00:00Z');const back=(d.getUTCDay()+1)%7;d.setUTCDate(d.getUTCDate()-back);return d.toISOString().slice(0,10);
}
export async function isWeekLocked(circleId:string,dateStr:string){
  await ensureWeeklyLocks();const w=weekStart(dateStr);
  return Boolean((await query<any>('select id from weekly_locks where circle_id=$1 and week_start=$2::date order by locked_at desc limit 1',[circleId,w]))[0]);
}
