-- Flexible circle evaluation model. Additive migration; legacy memorization data remains intact.
create table if not exists public.circle_evaluation_sets (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  effective_month date not null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(circle_id,effective_month),
  check (effective_month=date_trunc('month',effective_month)::date)
);

create table if not exists public.circle_evaluation_criteria (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.circle_evaluation_sets(id) on delete cascade,
  name text not null,
  kind text not null check(kind in ('quran','attendance','task')),
  system_key text check(system_key in ('new','review','attendance') or system_key is null),
  weight numeric(5,2) not null check(weight>0 and weight<=100),
  target_pages numeric(7,2) not null default 0 check(target_pages>=0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists circle_eval_criteria_system_key
  on public.circle_evaluation_criteria(set_id,system_key) where system_key is not null;

create table if not exists public.student_criterion_records (
  id uuid primary key default gen_random_uuid(),
  criterion_id uuid not null references public.circle_evaluation_criteria(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  record_date date not null,
  surah_no smallint,
  to_surah_no smallint,
  from_ayah integer,
  to_ayah integer,
  from_page smallint,
  to_page smallint,
  page_count integer,
  completed boolean,
  student_note text,
  recorded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(criterion_id,student_id,record_date),
  check (surah_no is null or surah_no between 1 and 114),
  check (to_surah_no is null or to_surah_no between 1 and 114),
  check (from_page is null or from_page between 1 and 604),
  check (to_page is null or to_page between 1 and 604),
  check (page_count is null or page_count>=0)
);
create index if not exists student_criterion_records_student_date
  on public.student_criterion_records(student_id,record_date desc);

create table if not exists public.student_daily_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  record_date date not null,
  note text not null,
  recorded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id,record_date)
);

create table if not exists public.student_monthly_evaluations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  circle_id uuid not null references public.circles(id) on delete cascade,
  month date not null,
  score numeric(5,2) not null,
  band text not null check(band in ('green','yellow','red')),
  warning_count integer not null default 0,
  supervisor_status text check(supervisor_status in ('pending','in_review','resolved') or supervisor_status is null),
  finalized_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id,month),
  check (month=date_trunc('month',month)::date),
  check (score between 0 and 100)
);
create index if not exists student_monthly_eval_supervisor
  on public.student_monthly_evaluations(circle_id,month,band,supervisor_status);

-- Seed the current month with the existing platform formula.
insert into public.circle_evaluation_sets(circle_id,effective_month)
select c.id,date_trunc('month',current_date)::date from public.circles c
on conflict(circle_id,effective_month) do nothing;

insert into public.circle_evaluation_criteria(set_id,name,kind,system_key,weight,target_pages,sort_order)
select s.id,v.name,v.kind,v.system_key,v.weight,0,v.sort_order
from public.circle_evaluation_sets s
cross join (values
  ('الحفظ الجديد','quran','new',30::numeric,10),
  ('المراجعة','quran','review',40::numeric,20),
  ('الحضور والانضباط','attendance','attendance',30::numeric,30)
) v(name,kind,system_key,weight,sort_order)
where s.effective_month=date_trunc('month',current_date)::date
  and not exists(select 1 from public.circle_evaluation_criteria c where c.set_id=s.id);

-- Fix the legacy Quran range constraint so a valid range may cross surahs.
alter table public.memorization_records drop constraint if exists memorization_records_check;
alter table public.memorization_records add constraint memorization_records_check
check (
  (coalesce(to_surah_no,surah_no)=surah_no and to_ayah>=from_ayah)
  or (coalesce(to_surah_no,surah_no)>surah_no)
);
