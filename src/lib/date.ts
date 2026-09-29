export function riyadhDate(d=new Date()){
  const parts=new Intl.DateTimeFormat('en-GB',{
    timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(d);
  const year=parts.find(x=>x.type==='year')?.value;
  const month=parts.find(x=>x.type==='month')?.value;
  const day=parts.find(x=>x.type==='day')?.value;
  if(!year||!month||!day)throw new Error('تعذر تحديد تاريخ مكة.');
  return year+'-'+month+'-'+day;
}
export const riyadhMonth=(d=new Date())=>riyadhDate(d).slice(0,7);
