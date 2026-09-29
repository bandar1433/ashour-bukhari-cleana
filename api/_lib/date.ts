export function riyadhDate(d=new Date()){
  const parts=new Intl.DateTimeFormat('en-GB',{
    timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(d);
  const year=parts.find(x=>x.type==='year')?.value;
  const month=parts.find(x=>x.type==='month')?.value;
  const day=parts.find(x=>x.type==='day')?.value;
  if(!year||!month||!day)throw new Error('Unable to resolve Riyadh date');
  return year+'-'+month+'-'+day;
}
