begin;

create table if not exists public.library_competition_archives (
  settings_id text not null references public.app_settings(id),
  season_id text not null check (season_id ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  archived_at timestamptz not null,
  standings jsonb not null check (jsonb_typeof(standings) = 'array' and jsonb_array_length(standings) = 17),
  books jsonb not null check (jsonb_typeof(books) = 'array' and jsonb_array_length(books) <= 100),
  primary key (settings_id, season_id)
);
alter table public.library_competition_archives enable row level security;
revoke all on public.library_competition_archives from public, anon, authenticated;
grant select, insert on public.library_competition_archives to service_role;

create or replace function public.protect_library_competition()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if current_setting('school_timer.library_competition_commit', true) = 'on' then return new; end if;
  if tg_op = 'INSERT' then
    if new.value ? 'libraryCompetition' and new.value->'libraryCompetition' <> 'null'::jsonb then
      raise exception 'LIBRARY_COMPETITION_PROTECTED';
    end if;
  elsif old.value->'libraryCompetition' is distinct from new.value->'libraryCompetition'
    or ((old.value->'libraryCompetition') is not null and old.value->'libraryCompetition' <> 'null'::jsonb
      and old.value#>'{studentLife,books}' is distinct from new.value#>'{studentLife,books}') then
    raise exception 'LIBRARY_COMPETITION_PROTECTED';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_library_competition on public.app_settings;
create trigger protect_library_competition before insert or update on public.app_settings
for each row execute function public.protect_library_competition();

create or replace function public.library_competition_commit(
  p_expected_updated_at timestamptz,
  p_value jsonb,
  p_updated_at timestamptz,
  p_archive jsonb default null
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  current_row public.app_settings%rowtype;
  old_season text;
  new_season text;
begin
  perform pg_advisory_xact_lock(hashtextextended('school-timer-main:library-competition', 0));
  select * into current_row from public.app_settings where id = 'school-timer-main' for update;
  if current_row.updated_at is distinct from p_expected_updated_at then return jsonb_build_object('saved', false); end if;
  if jsonb_typeof(p_value) <> 'object' or octet_length(p_value::text) > 1048576
    or p_updated_at is null or (current_row.updated_at is not null and p_updated_at <= current_row.updated_at)
    or jsonb_typeof(p_value->'libraryCompetition') <> 'object' then raise exception 'INVALID_LIBRARY_COMPETITION'; end if;
  old_season := current_row.value#>>'{libraryCompetition,seasonId}';
  new_season := p_value#>>'{libraryCompetition,seasonId}';
  if new_season is null or new_season !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_LIBRARY_SEASON'; end if;
  if old_season is not null and old_season <> new_season then
    if p_archive is null or p_archive->>'seasonId' is distinct from old_season
      or new_season <= old_season then raise exception 'LIBRARY_ARCHIVE_REQUIRED'; end if;
    if p_archive->'books' is distinct from coalesce((
      select jsonb_agg(book) from jsonb_array_elements(coalesce(current_row.value#>'{studentLife,books}', '[]'::jsonb)) book
      where book ? 'librarySlot'
    ), '[]'::jsonb) then raise exception 'LIBRARY_ARCHIVE_BOOKS_MISMATCH'; end if;
    if p_value#>'{studentLife,books}' is distinct from coalesce((
      select jsonb_agg(book) from jsonb_array_elements(coalesce(current_row.value#>'{studentLife,books}', '[]'::jsonb)) book
      where not (book ? 'librarySlot')
    ), '[]'::jsonb) then raise exception 'LIBRARY_UNPLACED_BOOKS_MISMATCH'; end if;
    if (current_row.value - 'libraryCompetition' - 'studentLife') is distinct from (p_value - 'libraryCompetition' - 'studentLife')
      or ((current_row.value->'studentLife') - 'books') is distinct from ((p_value->'studentLife') - 'books') then raise exception 'LIBRARY_HISTORY_MUST_BE_PRESERVED'; end if;
    insert into public.library_competition_archives(settings_id, season_id, archived_at, standings, books)
    values ('school-timer-main', old_season, (p_archive->>'archivedAt')::timestamptz, p_archive->'standings', p_archive->'books');
  elsif p_archive is not null then raise exception 'UNEXPECTED_LIBRARY_ARCHIVE';
  end if;
  perform set_config('school_timer.library_competition_commit', 'on', true);
  insert into public.app_settings(id, value, updated_at) values ('school-timer-main', p_value, p_updated_at)
  on conflict(id) do update set value = excluded.value, updated_at = excluded.updated_at;
  perform set_config('school_timer.library_competition_commit', 'off', true);
  return jsonb_build_object('saved', true);
end;
$$;
revoke all on function public.library_competition_commit(timestamptz, jsonb, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.library_competition_commit(timestamptz, jsonb, timestamptz, jsonb) to service_role;
revoke all on function public.protect_library_competition() from public, anon, authenticated;
commit;
