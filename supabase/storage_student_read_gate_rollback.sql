begin;
set local lock_timeout='2s';
set local statement_timeout='8s';

-- Turn STORAGE_STUDENT_READ_GATE off and redeploy before running this; gated callers would otherwise fail.
drop function if exists public.storage_poll_scope_student(jsonb,text);
drop function if exists public.storage_load_scope_metadata_student(jsonb);
drop function if exists public.storage_load_scope_student(jsonb);
drop function if exists public.storage_student_read_slot();

notify pgrst, 'reload schema';
commit;
