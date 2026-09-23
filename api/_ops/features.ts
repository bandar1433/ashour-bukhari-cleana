import {query} from '../_lib/db.js';
import {isStaff,validUuid} from '../_lib/actor.js';
import {json} from '../_lib/http.js';

async function ensureTables(){
  await query(`create table if not exists library_items(
    id uuid primary key default gen_random_uuid(),
    program_name text not null,series_name text not null,title text not null,teacher_name text,description text,
    youtube_url text not null,duration text,sort_order integer not null default 0,is_active boolean not null default true,
    created_by uuid references users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
  )`);
  await query(`create table if not exists guardian_student_links(
    guardian_user_id uuid not null references users(id),student_id uuid not null references students(id),
    created_at timestamptz not null default now(),primary key(guardian_user_id,student_id)
  )`);
  await query(`create table if not exists guardian_report_preferences(
    guardian_user_id uuid primary key references users(id),frequency text not null default 'weekly',updated_at timestamptz not null default now()
  )`);
}
function validYoutube(value:any){const v=String(value||'').trim();if(!/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(v))throw new Error('أدخل رابط YouTube صالحًا');return v}
function targetPages(value:any){const s=String(value||'').trim();if(/^\d+(?:\.\d+)?$/.test(s))return Number(s);const m=s.match(/(\d+)\D+(\d+)\s*$/);return m?Math.max(0,Number(m[2])-Number(m[1])+1):0}

export async function features(req:any,res:any,u:any){
  const sub=String(req.query?.sub||'');await ensureTables();

  if(sub==='reports'){
    if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
    const period=String(req.query?.period||'weekly');
    const nowFmt=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const today=new Date(nowFmt+'T00:00:00Z');
    const iso=(d:Date)=>d.toISOString().slice(0,10);
    let from=String(req.query?.from||''),to=String(req.query?.to||'');
    if(period!=='custom'){
      to=iso(today);const d=new Date(today);
      if(period==='weekly'){const dow=d.getUTCDay(),back=(dow+1)%7;d.setUTCDate(d.getUTCDate()-back)}
      else if(period==='monthly')d.setUTCDate(1);
      else if(period==='quarterly'){d.setUTCMonth(Math.floor(d.getUTCMonth()/3)*3,1)}
      else if(period==='half_yearly'){d.setUTCMonth(d.getUTCMonth()<6?0:6,1)}
      else if(period==='yearly'){d.setUTCMonth(0,1)}
      else {const dow=d.getUTCDay(),back=(dow+1)%7;d.setUTCDate(d.getUTCDate()-back)}
      from=iso(d);
    }
    if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)return json(res,400,{error:'الفترة غير صالحة'});
    let scope='true',args:any[]=[from,to];
    if(u.role==='student'){scope='s.user_id=$3::uuid';args.push(u.id)}
    else if(u.role==='guardian'){scope='exists(select 1 from guardian_student_links g where g.student_id=s.id and g.guardian_user_id=$3::uuid)';args.push(u.id)}
    else if(u.role==='teacher'){scope='h.teacher_user_id=$3::uuid';args.push(u.id)}
    else if(['center_manager','supervisor'].includes(u.role)){scope='s.center_id=$3::uuid';args.push(u.center_id)}
    else if(u.role!=='system_admin')return json(res,403,{error:'Forbidden'});
    const students=await query<any>(`select s.id,s.full_name,s.center_id,s.circle_id,c.name center_name,h.name circle_name,
      coalesce((select round(100.0*count(*) filter(where a.status in ('present','late'))/nullif(count(*) filter(where a.status<>'excused'),0))::int from attendance a where a.student_id=s.id and a.attendance_date between $1 and $2),0) attendance_rate,
      coalesce((select round(avg(m.grade))::int from memorization_records m where m.student_id=s.id and m.record_date between $1 and $2),0) avg_grade,
      coalesce((select sum(m.page_count)::int from memorization_records m where m.student_id=s.id and m.record_type='new' and m.record_date between $1 and $2),0) new_pages,
      coalesce((select sum(m.page_count)::int from memorization_records m where m.student_id=s.id and m.record_type='review' and m.record_date between $1 and $2),0) review_pages,
      coalesce((select count(*)::int from attendance a where a.student_id=s.id and a.status='absent' and a.attendance_date between $1 and $2),0) absences,
      coalesce((select round(avg(m.grade))::int from memorization_records m where m.student_id=s.id and m.record_date between current_date-6 and current_date),0) current_avg,
      coalesce((select round(avg(m.grade))::int from memorization_records m where m.student_id=s.id and m.record_date between current_date-13 and current_date-7),0) previous_avg
      from students s left join circles h on h.id=s.circle_id left join centers c on c.id=s.center_id where s.status='active' and ${scope} order by c.name,h.name,s.full_name`,args);
    const grouped=(key:'circle_id'|'center_id',nameKey:'circle_name'|'center_name')=>{
      const map=new Map<string,any>();for(const s of students){const id=String(s[key]||'none');let g=map.get(id);if(!g){g={id,name:s[nameKey]||'—',students:0,attendance_sum:0,grade_sum:0,new_pages:0,review_pages:0,struggling:0};map.set(id,g)}g.students++;g.attendance_sum+=Number(s.attendance_rate||0);g.grade_sum+=Number(s.avg_grade||0);g.new_pages+=Number(s.new_pages||0);g.review_pages+=Number(s.review_pages||0);if(Number(s.attendance_rate)<75||Number(s.avg_grade)<70)g.struggling++}
      return [...map.values()].map(g=>({...g,attendance_rate:g.students?Math.round(g.attendance_sum/g.students):0,avg_grade:g.students?Math.round(g.grade_sum/g.students):0}));
    };
    const circles=grouped('circle_id','circle_name'),centers=grouped('center_id','center_name');
    const struggling=students.filter((s:any)=>Number(s.attendance_rate)<75||Number(s.avg_grade)<70);
    const topPerformers=[...students].sort((a:any,b:any)=>Number(b.avg_grade)-Number(a.avg_grade)||Number(b.attendance_rate)-Number(a.attendance_rate)).slice(0,10);
    const mostImproved=[...students].map((s:any)=>({...s,improvement:Number(s.current_avg||0)-Number(s.previous_avg||0)})).sort((a:any,b:any)=>b.improvement-a.improvement).slice(0,10);
    const n=students.length,metrics={total_students:n,attendance_rate:n?Math.round(students.reduce((x:number,s:any)=>x+Number(s.attendance_rate||0),0)/n):0,avg_grade:n?Math.round(students.reduce((x:number,s:any)=>x+Number(s.avg_grade||0),0)/n):0,new_pages:students.reduce((x:number,s:any)=>x+Number(s.new_pages||0),0),review_pages:students.reduce((x:number,s:any)=>x+Number(s.review_pages||0),0),struggling:struggling.length,most_improved:mostImproved.length,top_performers:topPerformers.length};
    return json(res,200,{period,from,to,metrics,students,circles,centers,struggling,topPerformers,mostImproved});
  }

  if(sub==='library'){
    if(req.method==='GET'){
      const where=['system_admin','center_manager','supervisor'].includes(u.role)?'true':'is_active=true';
      return json(res,200,{items:await query<any>(`select * from library_items where ${where} order by is_active desc,program_name,series_name,sort_order,title`)});
    }
    if(!['system_admin','center_manager','supervisor'].includes(u.role))return json(res,403,{error:'Forbidden'});
    if(req.method==='POST'){
      const b=req.body||{},program=String(b.program_name||'').trim(),series=String(b.series_name||'').trim(),title=String(b.title||'').trim();
      if(!program||!series||!title)return json(res,400,{error:'البرنامج والسلسلة وعنوان الدرس مطلوبة'});
      const row=(await query<any>(`insert into library_items(program_name,series_name,title,teacher_name,description,youtube_url,duration,sort_order,created_by)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
        [program,series,title,String(b.teacher_name||'').trim()||null,String(b.description||'').trim()||null,validYoutube(b.youtube_url),String(b.duration||'').trim()||null,Math.max(0,Number(b.sort_order)||0),u.id]))[0];
      return json(res,201,row);
    }
    if(req.method==='PUT'){
      const b=req.body||{},id=validUuid(b.id);if(!id)return json(res,400,{error:'معرف الدرس غير صالح'});
      return json(res,200,(await query<any>('update library_items set is_active=coalesce($2,is_active),title=coalesce($3,title),sort_order=coalesce($4,sort_order),updated_at=now() where id=$1 returning *',[id,typeof b.is_active==='boolean'?b.is_active:null,b.title?String(b.title).trim():null,b.sort_order===undefined?null:Math.max(0,Number(b.sort_order)||0)]))[0]);
    }
    return json(res,405,{error:'Method not allowed'});
  }

  if(sub==='guardian-link'){
    if(!['system_admin','center_manager','supervisor','teacher'].includes(u.role))return json(res,403,{error:'Forbidden'});
    if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
    const guardianId=validUuid(req.body?.guardian_user_id),studentId=validUuid(req.body?.student_id);if(!guardianId||!studentId)return json(res,400,{error:'ولي الأمر والطالب مطلوبان'});
    const s=(await query<any>(`select s.id,s.center_id,c.teacher_user_id from students s left join circles c on c.id=s.circle_id where s.id=$1`,[studentId]))[0];
    const g=(await query<any>(`select id from users where id=$1 and role='guardian'`,[guardianId]))[0];
    if(!s||!g)return json(res,404,{error:'الطالب أو ولي الأمر غير موجود'});
    const allowed=u.role==='system_admin'||(['center_manager','supervisor'].includes(u.role)&&u.center_id===s.center_id)||(u.role==='teacher'&&u.id===s.teacher_user_id);if(!allowed)return json(res,403,{error:'خارج نطاق صلاحيتك'});
    await query(`insert into guardian_student_links(guardian_user_id,student_id) values($1,$2) on conflict do nothing`,[guardianId,studentId]);return json(res,200,{success:true});
  }

  if(sub==='guardian-preference'){
    if(u.role!=='guardian')return json(res,403,{error:'Forbidden'});
    if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
    const f=String(req.body?.frequency||'weekly');if(!['weekly','monthly','quarterly','half_yearly','yearly'].includes(f))return json(res,400,{error:'دورية غير صالحة'});
    return json(res,200,(await query<any>(`insert into guardian_report_preferences(guardian_user_id,frequency,updated_at)
      values($1,$2,now()) on conflict(guardian_user_id) do update set frequency=excluded.frequency,updated_at=now() returning *`,[u.id,f]))[0]);
  }

  if(sub==='guardian'){
    if(u.role!=='guardian')return json(res,403,{error:'Forbidden'});
    if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
    const preference=(await query<any>('select frequency from guardian_report_preferences where guardian_user_id=$1',[u.id]))[0]?.frequency||'weekly';
    const children=await query<any>(`select s.id,s.full_name,c.name circle_name,
      coalesce((select round(100.0*count(*) filter(where a.status in ('present','late'))/nullif(count(*),0))::int from attendance a where a.student_id=s.id and a.attendance_date>=current_date-interval '30 days'),0) attendance_rate,
      coalesce((select round(avg(m.grade))::int from memorization_records m where m.student_id=s.id and m.record_date>=current_date-interval '30 days'),0) quran_average,
      coalesce((select sum(page_count) from memorization_records m where m.student_id=s.id and m.record_type='new' and m.record_date>=current_date-interval '30 days'),0)::int new_pages,
      coalesce((select sum(page_count) from memorization_records m where m.student_id=s.id and m.record_type='review' and m.record_date>=current_date-interval '30 days'),0)::int review_pages,
      s.points_balance,
      coalesce((select count(*)::int from reward_requests rr where rr.student_id=s.id and rr.status in ('approved','delivered')),0) rewards_count
      from guardian_student_links g join students s on s.id=g.student_id left join circles c on c.id=s.circle_id where g.guardian_user_id=$1 order by s.full_name`,[u.id]);
    return json(res,200,{preference,children});
  }

  if(sub==='quran-journey'){
    if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
    let student:any=null;const sid=validUuid(req.query?.student_id);
    if(u.role==='student')student=(await query<any>('select s.id,s.full_name,c.name circle_name from students s left join circles c on c.id=s.circle_id where s.user_id=$1 limit 1',[u.id]))[0];
    else if(isStaff(u.role)&&sid)student=(await query<any>(`select s.id,s.full_name,c.name circle_name from students s left join circles c on c.id=s.circle_id
      where s.id=$4 and ($1='system_admin' or ($1 in ('center_manager','supervisor') and s.center_id=$2::uuid) or ($1='teacher' and c.teacher_user_id=$3::uuid))`,[u.role,u.center_id,u.id,sid]))[0];
    if(!student)return json(res,200,{student:null,pages:[],history:[]});
    const history=await query<any>('select id,record_date,record_type,from_page,to_page,grade from memorization_records where student_id=$1 order by record_date desc,created_at desc limit 100',[student.id]);
    const pages=Array.from({length:604},(_,i)=>({page:i+1,state:'لم يبدأ'})),rank:any={'لم يبدأ':0,'محفوظ':1,'قيد المراجعة':2,'يحتاج تثبيت':3};
    for(const r of history){const a=Math.max(1,Number(r.from_page)||0),b=Math.min(604,Number(r.to_page)||a);if(!a)continue;const state=Number(r.grade)<70?'يحتاج تثبيت':r.record_type==='review'?'قيد المراجعة':'محفوظ';for(let p=a;p<=b;p++)if(rank[state]>=rank[(pages[p-1] as any).state])(pages[p-1] as any).state=state}
    return json(res,200,{student,pages,history});
  }

  if(sub==='interventions'){
    if(!isStaff(u.role))return json(res,403,{error:'Forbidden'});
    if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
    const rows=await query<any>(`select s.id,s.full_name,c.name circle_name,
      coalesce((select count(*) from attendance a where a.student_id=s.id and a.attendance_date>=current_date-interval '14 days' and a.status='absent'),0)::int absences,
      coalesce((select round(avg(m.grade))::int from memorization_records m where m.student_id=s.id and m.record_date>=current_date-interval '14 days'),100) avg_grade,
      coalesce((select count(*) from generate_series(current_date-interval '13 days',current_date,'1 day') d where extract(dow from d)<>5 and not exists(select 1 from memorization_records m where m.student_id=s.id and m.record_type='review' and m.record_date=d::date)),0)::int review_gaps
      from students s left join circles c on c.id=s.circle_id
      where s.status='active' and ($1='system_admin' or ($1 in ('center_manager','supervisor') and s.center_id=$2::uuid) or ($1='teacher' and c.teacher_user_id=$3::uuid)) order by s.full_name`,[u.role,u.center_id,u.id]);
    const items:any[]=[];
    for(const r of rows){
      const plans=await query<any>(`select week_start,day_name,new_target,review_target from weekly_plans where student_id=$1 and week_start>=current_date-interval '14 days'`,[r.id]);
      let missed=0;const dayOffset:any={'السبت':0,'الأحد':1,'الاثنين':2,'الثلاثاء':3,'الأربعاء':4,'الخميس':5};
      for(const p of plans){
        const raw=p.week_start instanceof Date?p.week_start.toISOString().slice(0,10):String(p.week_start||'').slice(0,10);
        const base=/^\d{4}-\d{2}-\d{2}$/.test(raw)?raw:null;if(!base)continue;
        const d=new Date(base+'T00:00:00.000Z');d.setUTCDate(d.getUTCDate()+(dayOffset[p.day_name]??0));
        const recordDate=d.toISOString().slice(0,10);
        const done=await query<any>(`select record_type,coalesce(sum(page_count),0)::numeric pages from memorization_records where student_id=$1 and record_date=$2::date and record_type in ('new','review') group by record_type`,[r.id,recordDate]);
        const map:any={};for(const x of done)map[x.record_type]=Number(x.pages||0);
        if(targetPages(p.new_target)>0&&(map.new||0)<targetPages(p.new_target))missed++;
        if(targetPages(p.review_target)>0&&(map.review||0)<targetPages(p.review_target))missed++;
      }
      const reasons=[r.absences>=2?`غياب متكرر (${r.absences})`:null,r.avg_grade<70?`متوسط منخفض (${r.avg_grade})`:null,missed>=2?`عدم تحقيق الورد (${missed})`:null,r.review_gaps>=3?`انقطاع عن المراجعة (${r.review_gaps} أيام)`:null].filter(Boolean);
      if(reasons.length)items.push({...r,missed_targets:missed,reasons_text:reasons.join('، ')});
    }
    return json(res,200,{items});
  }

  return json(res,404,{error:'Unknown feature'});
}

export async function profile(req:any,res:any,u:any){
  await query('alter table users add column if not exists avatar_url text');
  if(req.method==='GET')return json(res,200,(await query<any>('select id,full_name,email,phone,avatar_url,role::text role,center_id,is_active from users where id=$1',[u.id]))[0]);
  if(req.method==='PUT'){
    const b=req.body||{};const row=(await query<any>('update users set full_name=coalesce($2,full_name),phone=coalesce($3,phone),avatar_url=coalesce($4,avatar_url) where id=$1 returning id,full_name,email,phone,avatar_url,role::text role,center_id,is_active',[u.id,String(b.full_name||'').trim()||null,String(b.phone||'').trim()||null,String(b.avatar_url||'').trim()||null]))[0];
    return json(res,200,row);
  }
  return json(res,405,{error:'Method not allowed'});
}
