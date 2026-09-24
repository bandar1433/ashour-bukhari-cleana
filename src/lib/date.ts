export function riyadhDate(date=new Date()):string{
  return new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'
  }).format(date);
}

export function riyadhMonth(date=new Date()):string{
  return riyadhDate(date).slice(0,7);
}

export function riyadhDaysAgo(days:number):string{
  const base=new Date(riyadhDate()+'T00:00:00.000Z');
  base.setUTCDate(base.getUTCDate()-Math.max(0,Math.floor(days)));
  return base.toISOString().slice(0,10);
}

export function riyadhMonthStart(monthsBack=0):string{
  const base=new Date(riyadhDate()+'T00:00:00.000Z');
  base.setUTCMonth(base.getUTCMonth()-Math.max(0,Math.floor(monthsBack)),1);
  return base.toISOString().slice(0,10);
}

export function riyadhYearStart():string{
  return riyadhDate().slice(0,4)+'-01-01';
}
