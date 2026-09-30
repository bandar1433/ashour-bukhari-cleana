-- Per-circle settings and fixed QR attendance — 2026-09-30
alter table circles add column if not exists attendance_token uuid default gen_random_uuid();
update circles set attendance_token=gen_random_uuid() where attendance_token is null;
alter table circles alter column attendance_token set not null;
create unique index if not exists circles_attendance_token_key on circles(attendance_token);
alter table circles add column if not exists late_after_minutes integer not null default 70;
alter table circles add column if not exists deduction_after_minutes integer not null default 90;
alter table circles add column if not exists major_deduction_after_minutes integer not null default 120;
alter table attendance add column if not exists attendance_percent smallint;
create index if not exists attendance_circle_checkin_idx on attendance(circle_id,attendance_date,check_in_at);
