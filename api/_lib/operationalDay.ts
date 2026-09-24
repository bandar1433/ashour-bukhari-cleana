import { query } from './db.js';

export type OperationalDayStatus={
  open:boolean;
  reason:string|null;
  holiday_title?:string|null;
};

export async function operationalDay(dateStr:string,centerId:string|null|undefined):Promise<OperationalDayStatus>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dateStr))return {open:false,reason:'التاريخ غير صالح.'};
  const d=new Date(dateStr+'T12:00:00.000Z');
  if(!Number.isFinite(d.getTime()))return {open:false,reason:'التاريخ غير صالح.'};
  if(d.getUTCDay()===5)return {open:false,reason:'يوم الجمعة إجازة أسبوعية.'};
  const holiday=(await query<any>(`
    select title,kind,center_id
    from holidays
    where holiday_date=$1::date
      and (center_id is null or center_id=$2::uuid)
    order by center_id nulls first
    limit 1
  `,[dateStr,centerId||null]))[0];
  if(holiday)return {open:false,reason:`اليوم إجازة: ${holiday.title||'إجازة معتمدة'}.`,holiday_title:holiday.title||null};
  return {open:true,reason:null};
}
