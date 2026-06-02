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
