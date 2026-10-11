-- MiCursoX: esquema de auditoría separado (proyecto micursox-auditoria).
-- No ejecutar en cursapp-prod.
create table if not exists public.audit_events (
 id bigint generated always as identity primary key,
 event_id uuid not null unique,
 occurred_at timestamptz not null,
 ingested_at timestamptz not null default now(),
 actor_user_id uuid,
 curso_id uuid,
 actor_role text,
 event_type text not null check(length(event_type)<=80),
 target text check(length(target)<=120),
 source text not null check(source in ('client','server')),
 reference_id uuid,
 correlation_id uuid,
 metadata jsonb not null default '{}'::jsonb,
 constraint metadata_size check(pg_column_size(metadata)<4096)
);
create index if not exists audit_actor_time_idx on public.audit_events(actor_user_id,occurred_at desc,id desc);
create index if not exists audit_time_idx on public.audit_events(occurred_at desc,id desc);
create index if not exists audit_reference_idx on public.audit_events(reference_id) where reference_id is not null;
create index if not exists audit_correlation_idx on public.audit_events(correlation_id) where correlation_id is not null;
create index if not exists audit_event_time_idx on public.audit_events(event_type,occurred_at desc);
alter table public.audit_events enable row level security;
revoke all on public.audit_events from public,anon,authenticated;
grant select,insert on public.audit_events to service_role;
create or replace function public.audit_ingest_server_batch(p_events jsonb) returns int
language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb; n int:=0;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'unauthorized' using errcode='42501';end if;
 if jsonb_typeof(p_events)<>'array' or jsonb_array_length(p_events)>100 then raise exception 'invalid batch';end if;
 for item in select value from jsonb_array_elements(p_events) loop
  if coalesce(item->>'event_type','')='' or coalesce(item->>'event_id','')!~*'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then continue;end if;
  insert into public.audit_events(event_id,occurred_at,actor_user_id,curso_id,actor_role,event_type,target,source,reference_id,correlation_id,metadata)
  values((item->>'event_id')::uuid,coalesce((item->>'occurred_at')::timestamptz,now()),nullif(item->>'actor_user_id','')::uuid,
  nullif(item->>'curso_id','')::uuid,left(item->>'actor_role',30),left(item->>'event_type',80),left(item->>'target',120),
  case when item->>'source'='server' then 'server' else 'client' end,nullif(item->>'reference_id','')::uuid,
  nullif(item->>'correlation_id','')::uuid,coalesce(item->'metadata','{}'::jsonb)) on conflict(event_id)do nothing;
  n:=n+1;
 end loop;
 return n;
end $$;
revoke all on function public.audit_ingest_server_batch(jsonb) from public,anon,authenticated;
grant execute on function public.audit_ingest_server_batch(jsonb) to service_role;
