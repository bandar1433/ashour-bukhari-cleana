-- Schema objects that were previously created lazily inside API requests.
-- Apply this migration once before removing the corresponding runtime DDL.

alter table if exists login_requests add column if not exists requested_role text;
alter table if exists login_requests add column if not exists phone text;
alter table if exists login_requests add column if not exists document_no text;
alter table if exists login_requests add column if not exists center_id uuid;
alter table if exists login_requests add column if not exists circle_id uuid;

alter table if exists students add column if not exists document_no text;
alter table if exists students add column if not exists mobile text;

alter table if exists competitions add column if not exists circle_id uuid references circles(id);
alter table if exists competitions add column if not exists max_points integer not null default 100;

alter table if exists users add column if not exists avatar_url text;

create table if not exists library_items(
  id uuid primary key default gen_random_uuid(),
  program_name text not null,
  series_name text not null,
  title text not null,
  teacher_name text,
  description text,
  youtube_url text not null,
  duration text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists guardian_student_links(
  guardian_user_id uuid not null references users(id),
  student_id uuid not null references students(id),
  created_at timestamptz not null default now(),
  primary key(guardian_user_id,student_id)
);

create table if not exists guardian_report_preferences(
  guardian_user_id uuid primary key references users(id),
  frequency text not null default 'weekly',
  updated_at timestamptz not null default now()
);

create table if not exists legacy_site_images(
  image_key text primary key,
  content text not null,
  updated_at timestamptz not null default now()
);

create table if not exists weekly_locks(
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles(id) on delete cascade,
  week_start date not null,
  locked_by uuid references users(id),
  locked_at timestamptz not null default now()
);

create index if not exists idx_weekly_locks_circle_week on weekly_locks(circle_id,week_start);
create index if not exists idx_guardian_student_links_student on guardian_student_links(student_id);
create index if not exists idx_library_items_active_sort on library_items(is_active,program_name,series_name,sort_order);
