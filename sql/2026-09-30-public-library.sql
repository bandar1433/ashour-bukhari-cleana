-- General-purpose public library — 2026-09-30
alter table library_items add column if not exists item_type text not null default 'link';
alter table library_items add column if not exists resource_url text;
alter table library_items add column if not exists image_url text;
alter table library_items add column if not exists public_visible boolean not null default true;
