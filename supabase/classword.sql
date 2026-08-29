create extension if not exists pgcrypto;

create table if not exists public.classword_rounds (
  round_date date primary key,
  topic text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classword_rounds_topic_length check (char_length(trim(topic)) <= 40)
);

create table if not exists public.classword_entries (
  id uuid primary key default gen_random_uuid(),
  round_date date not null references public.classword_rounds(round_date) on delete cascade,
  initial text not null,
  word text not null,
  student_number integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classword_entries_initial check (
    initial in ('ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ')
  ),
  constraint classword_entries_word_length check (char_length(trim(word)) between 1 and 8),
  constraint classword_entries_student_number check (student_number between 1 and 23),
  constraint classword_entries_student_day_unique unique (round_date, student_number),
  constraint classword_entries_initial_day_unique unique (round_date, initial)
);

create table if not exists public.classword_quiz_completions (
  id uuid primary key default gen_random_uuid(),
  quiz_date date not null,
  question_id text not null,
  student_number integer not null,
  completed_at timestamptz not null default now(),
  constraint classword_quiz_question_id_length check (char_length(trim(question_id)) between 1 and 64),
  constraint classword_quiz_student_number check (student_number between 1 and 23),
  constraint classword_quiz_student_question_unique unique (quiz_date, question_id, student_number)
);

create index if not exists classword_entries_round_date_idx
  on public.classword_entries(round_date);

create index if not exists classword_entries_student_date_idx
  on public.classword_entries(student_number, round_date);

create index if not exists classword_quiz_completions_date_idx
  on public.classword_quiz_completions(quiz_date, question_id);

create or replace function public.set_classword_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.ensure_classword_round()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into public.classword_rounds (round_date, topic)
  values (new.round_date, '')
  on conflict (round_date) do nothing;
  return new;
end;
$$;

drop trigger if exists classword_rounds_set_updated_at on public.classword_rounds;
create trigger classword_rounds_set_updated_at
before update on public.classword_rounds
for each row execute function public.set_classword_updated_at();

drop trigger if exists classword_entries_set_updated_at on public.classword_entries;
create trigger classword_entries_set_updated_at
before update on public.classword_entries
for each row execute function public.set_classword_updated_at();

drop trigger if exists classword_entries_ensure_round on public.classword_entries;
create trigger classword_entries_ensure_round
before insert on public.classword_entries
for each row execute function public.ensure_classword_round();

alter table public.classword_rounds enable row level security;
alter table public.classword_entries enable row level security;
alter table public.classword_quiz_completions enable row level security;

revoke all on table public.classword_rounds from public, anon, authenticated;
revoke all on table public.classword_entries from public, anon, authenticated;
revoke all on table public.classword_quiz_completions from public, anon, authenticated;

grant select, insert, update, delete on table public.classword_rounds to service_role;
grant select, insert, update, delete on table public.classword_entries to service_role;
grant select, insert, update, delete on table public.classword_quiz_completions to service_role;
