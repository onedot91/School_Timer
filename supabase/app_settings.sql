create table if not exists app_settings (
  id text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;

drop policy if exists "Allow shared settings read" on app_settings;
create policy "Allow shared settings read"
on app_settings
for select
using (id = 'school-timer-main');

drop policy if exists "Allow shared settings write" on app_settings;
create policy "Allow shared settings write"
on app_settings
for insert
with check (id = 'school-timer-main');

drop policy if exists "Allow shared settings update" on app_settings;
create policy "Allow shared settings update"
on app_settings
for update
using (id = 'school-timer-main')
with check (id = 'school-timer-main');

create table if not exists announcement_notes (
  date_key text primary key,
  date_text text not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table announcement_notes enable row level security;

drop policy if exists "Allow announcement notes read" on announcement_notes;
create policy "Allow announcement notes read"
on announcement_notes
for select
using (true);

drop policy if exists "Allow announcement notes write" on announcement_notes;
create policy "Allow announcement notes write"
on announcement_notes
for insert
with check (true);

drop policy if exists "Allow announcement notes update" on announcement_notes;
create policy "Allow announcement notes update"
on announcement_notes
for update
using (true)
with check (true);
