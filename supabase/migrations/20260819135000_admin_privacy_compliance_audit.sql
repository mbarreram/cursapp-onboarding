create extension if not exists pgcrypto;
create sequence if not exists public.privacy_case_seq;

create table if not exists public.privacy_compliance_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text unique not null,
  source_type text not null check (source_type in ('user_request','authority_request','internal_review')),
  privacy_request_id uuid unique references public.privacy_rights_requests(id) on delete set null,
  subject_user_id uuid,
  request_type text not null,
  requester_name text,
  requester_email text,
  authority_name text,
  external_reference text,
  legal_basis text,
  status text not null default 'received' check (status in ('received','identity_validation','in_review','in_execution','responded','closed','rejected','cancelled')),
  priority text not null default 'normal' check (priority in ('normal','high','urgent')),
  assigned_admin_id uuid,
  due_at timestamptz,
  response_summary text,
  response_sent_at timestamptz,
  response_channel text,
  evidence_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists privacy_cases_status_created_idx on public.privacy_compliance_cases(status, created_at desc);
create index if not exists privacy_cases_subject_idx on public.privacy_compliance_cases(subject_user_id, created_at desc);

create table if not exists public.privacy_audit_log (
  id bigint generated always as identity primary key,
  case_id uuid not null references public.privacy_compliance_cases(id) on delete restrict,
  privacy_request_id uuid references public.privacy_rights_requests(id) on delete set null,
  subject_user_id uuid,
  actor_user_id uuid,
  event_type text not null,
  entity_type text,
  entity_id text,
  event_summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  prev_hash text,
  event_hash text not null
);
create index if not exists privacy_audit_case_created_idx on public.privacy_audit_log(case_id, created_at, id);

create or replace function public.next_privacy_case_number() returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare n bigint;
begin
  n:=nextval('public.privacy_case_seq');
  return 'PRIV-'||to_char(current_date,'YYYY')||'-'||lpad(n::text,6,'0');
end;$$;

create or replace function public.privacy_audit_prepare() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare p text;
begin
  select event_hash into p from public.privacy_audit_log where case_id=new.case_id order by id desc limit 1;
  new.prev_hash:=p;
  new.actor_user_id:=coalesce(new.actor_user_id,auth.uid());
  new.event_hash:=encode(digest(coalesce(p,'')||'|'||new.case_id::text||'|'||coalesce(new.privacy_request_id::text,'')||'|'||coalesce(new.subject_user_id::text,'')||'|'||coalesce(new.actor_user_id::text,'')||'|'||new.event_type||'|'||coalesce(new.entity_type,'')||'|'||coalesce(new.entity_id,'')||'|'||new.event_summary||'|'||new.metadata::text||'|'||new.created_at::text,'sha256'),'hex');
  return new;
end;$$;
drop trigger if exists privacy_audit_prepare_trg on public.privacy_audit_log;
create trigger privacy_audit_prepare_trg before insert on public.privacy_audit_log for each row execute function public.privacy_audit_prepare();

create or replace function public.privacy_audit_immutable() returns trigger language plpgsql as $$
begin raise exception 'privacy_audit_log is append-only'; end;$$;
drop trigger if exists privacy_audit_no_update_trg on public.privacy_audit_log;
create trigger privacy_audit_no_update_trg before update or delete on public.privacy_audit_log for each row execute function public.privacy_audit_immutable();

create or replace function public.privacy_case_from_request() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare c_id uuid;
begin
  insert into public.privacy_compliance_cases(case_number,source_type,privacy_request_id,subject_user_id,request_type,status,created_at,updated_at)
  values(public.next_privacy_case_number(),'user_request',new.id,new.user_id,new.request_type,'received',new.created_at,now())
  on conflict (privacy_request_id) do nothing returning id into c_id;
  if c_id is not null then
    insert into public.privacy_audit_log(case_id,privacy_request_id,subject_user_id,actor_user_id,event_type,entity_type,entity_id,event_summary,metadata)
    values(c_id,new.id,new.user_id,new.user_id,'request_received','privacy_rights_request',new.id::text,'Solicitud de privacidad recibida desde el perfil',jsonb_build_object('request_type',new.request_type,'source',new.source));
  end if;
  return new;
end;$$;
drop trigger if exists privacy_request_create_case_trg on public.privacy_rights_requests;
create trigger privacy_request_create_case_trg after insert on public.privacy_rights_requests for each row execute function public.privacy_case_from_request();

insert into public.privacy_compliance_cases(case_number,source_type,privacy_request_id,subject_user_id,request_type,status,created_at,updated_at)
select public.next_privacy_case_number(),'user_request',r.id,r.user_id,r.request_type,
 case r.status when 'received' then 'received' when 'in_review' then 'in_review' when 'completed' then 'closed' when 'rejected' then 'rejected' when 'cancelled' then 'cancelled' else 'received' end,
 r.created_at,r.updated_at
from public.privacy_rights_requests r where not exists(select 1 from public.privacy_compliance_cases c where c.privacy_request_id=r.id);

insert into public.privacy_audit_log(case_id,privacy_request_id,subject_user_id,event_type,entity_type,entity_id,event_summary,metadata,created_at)
select c.id,c.privacy_request_id,c.subject_user_id,'case_backfilled','privacy_rights_request',c.privacy_request_id::text,'Expediente incorporado al registro de cumplimiento',jsonb_build_object('source','historical_backfill'),c.created_at
from public.privacy_compliance_cases c where c.privacy_request_id is not null and not exists(select 1 from public.privacy_audit_log a where a.case_id=c.id);

alter table public.privacy_compliance_cases enable row level security;
alter table public.privacy_audit_log enable row level security;
revoke all on public.privacy_compliance_cases from anon,authenticated;
revoke all on public.privacy_audit_log from anon,authenticated;
grant select on public.privacy_compliance_cases to authenticated;
grant select on public.privacy_audit_log to authenticated;
drop policy if exists privacy_cases_admin_select on public.privacy_compliance_cases;
create policy privacy_cases_admin_select on public.privacy_compliance_cases for select to authenticated using(is_admin());
drop policy if exists privacy_audit_admin_select on public.privacy_audit_log;
create policy privacy_audit_admin_select on public.privacy_audit_log for select to authenticated using(is_admin());

create or replace function public.admin_privacy_overview() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
 select jsonb_build_object('summary',jsonb_build_object('total',count(*),'open',count(*) filter(where status not in ('closed','rejected','cancelled')),'received',count(*) filter(where status='received'),'blocking',count(*) filter(where request_type='blocking' and status not in ('closed','rejected','cancelled')),'authority',count(*) filter(where source_type='authority_request')),'cases',coalesce(jsonb_agg(jsonb_build_object('id',c.id,'case_number',c.case_number,'source_type',c.source_type,'privacy_request_id',c.privacy_request_id,'subject_user_id',c.subject_user_id,'request_type',c.request_type,'status',c.status,'priority',c.priority,'requester_name',c.requester_name,'requester_email',c.requester_email,'authority_name',c.authority_name,'external_reference',c.external_reference,'legal_basis',c.legal_basis,'assigned_admin_id',c.assigned_admin_id,'due_at',c.due_at,'response_sent_at',c.response_sent_at,'created_at',c.created_at,'updated_at',c.updated_at,'closed_at',c.closed_at,'subject_name',u.nombre,'subject_email',u.email,'audit_count',(select count(*) from public.privacy_audit_log a where a.case_id=c.id)) order by c.created_at desc),'[]'::jsonb)) into result from public.privacy_compliance_cases c left join public.usuarios u on u.id=c.subject_user_id;
 return result;
end;$$;

create or replace function public.admin_privacy_case_detail(p_case_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.privacy_compliance_cases%rowtype; result jsonb;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
 select * into c from public.privacy_compliance_cases where id=p_case_id;
 if not found then raise exception 'case_not_found'; end if;
 select jsonb_build_object('case',to_jsonb(c),'subject',(select to_jsonb(x) from(select id,email,nombre,telefono,estado,created_at from public.usuarios where id=c.subject_user_id)x),'request',(select to_jsonb(r) from public.privacy_rights_requests r where r.id=c.privacy_request_id),'consents',coalesce((select jsonb_agg(to_jsonb(z) order by z.fecha_aceptacion desc) from(select id,version,privacidad_aceptada,terminos_aceptados,mercado_aceptado,fecha_aceptacion,created_at from public.consentimientos_usuario where usuario_id=c.subject_user_id order by fecha_aceptacion desc limit 10)z),'[]'::jsonb),'memberships',coalesce((select jsonb_agg(to_jsonb(m)) from(select mc.id,mc.curso_id,mc.rol,mc.nombre_alumno,mc.estado,mc.created_at,cu.course_key,cu.nivel,cu.letra,cu.jornada,co.nombre as colegio from public.miembros_curso mc left join public.cursos cu on cu.id=mc.curso_id left join public.colegios co on co.id=cu.colegio_id where mc.user_id=c.subject_user_id)m),'[]'::jsonb),'data_inventory',jsonb_build_object('memberships',(select count(*) from public.miembros_curso where user_id=c.subject_user_id),'payments',(select count(*) from public.pagos p join public.miembros_curso mc on mc.id=p.miembro_id where mc.user_id=c.subject_user_id),'consents',(select count(*) from public.consentimientos_usuario where usuario_id=c.subject_user_id),'notifications',(select count(*) from public.notifications where user_id=c.subject_user_id),'privacy_requests',(select count(*) from public.privacy_rights_requests where user_id=c.subject_user_id)),'audit',coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.privacy_audit_log a where a.case_id=c.id),'[]'::jsonb)) into result;
 insert into public.privacy_audit_log(case_id,privacy_request_id,subject_user_id,event_type,entity_type,entity_id,event_summary,metadata) values(c.id,c.privacy_request_id,c.subject_user_id,'case_viewed','privacy_compliance_case',c.id::text,'Expediente consultado por administrador','{}'::jsonb);
 return result;
end;$$;

create or replace function public.admin_privacy_update_case(p_case_id uuid,p_status text default null,p_priority text default null,p_assigned_admin_id uuid default null,p_due_at timestamptz default null,p_response_summary text default null,p_response_sent_at timestamptz default null,p_response_channel text default null,p_evidence_reference text default null,p_legal_basis text default null) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare oldc public.privacy_compliance_cases%rowtype; newc public.privacy_compliance_cases%rowtype; mapped text;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
 select * into oldc from public.privacy_compliance_cases where id=p_case_id for update; if not found then raise exception 'case_not_found'; end if;
 update public.privacy_compliance_cases set status=coalesce(p_status,status),priority=coalesce(p_priority,priority),assigned_admin_id=coalesce(p_assigned_admin_id,assigned_admin_id),due_at=coalesce(p_due_at,due_at),response_summary=coalesce(p_response_summary,response_summary),response_sent_at=coalesce(p_response_sent_at,response_sent_at),response_channel=coalesce(p_response_channel,response_channel),evidence_reference=coalesce(p_evidence_reference,evidence_reference),legal_basis=coalesce(p_legal_basis,legal_basis),closed_at=case when coalesce(p_status,status)='closed' and closed_at is null then now() else closed_at end,updated_at=now() where id=p_case_id returning * into newc;
 if newc.privacy_request_id is not null then mapped:=case newc.status when 'received' then 'received' when 'identity_validation' then 'in_review' when 'in_review' then 'in_review' when 'in_execution' then 'in_review' when 'responded' then 'completed' when 'closed' then 'completed' when 'rejected' then 'rejected' when 'cancelled' then 'cancelled' else 'in_review' end; update public.privacy_rights_requests set status=mapped,updated_at=now(),resolved_at=case when mapped in('completed','rejected','cancelled') then coalesce(resolved_at,now()) else resolved_at end,response_note=coalesce(p_response_summary,response_note) where id=newc.privacy_request_id; end if;
 insert into public.privacy_audit_log(case_id,privacy_request_id,subject_user_id,actor_user_id,event_type,entity_type,entity_id,event_summary,metadata) values(newc.id,newc.privacy_request_id,newc.subject_user_id,auth.uid(),'case_updated','privacy_compliance_case',newc.id::text,'Expediente actualizado por administrador',jsonb_build_object('old_status',oldc.status,'new_status',newc.status,'old_priority',oldc.priority,'new_priority',newc.priority,'response_sent_at',newc.response_sent_at,'response_channel',newc.response_channel));
 return to_jsonb(newc);
end;$$;

create or replace function public.admin_privacy_create_authority_case(p_request_type text,p_authority_name text,p_external_reference text default null,p_legal_basis text default null,p_subject_user_id uuid default null,p_requester_name text default null,p_requester_email text default null,p_priority text default 'high',p_due_at timestamptz default null) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.privacy_compliance_cases%rowtype;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
 insert into public.privacy_compliance_cases(case_number,source_type,subject_user_id,request_type,requester_name,requester_email,authority_name,external_reference,legal_basis,status,priority,assigned_admin_id,due_at) values(public.next_privacy_case_number(),'authority_request',p_subject_user_id,coalesce(nullif(trim(p_request_type),''),'information_request'),p_requester_name,p_requester_email,p_authority_name,p_external_reference,p_legal_basis,'received',coalesce(p_priority,'high'),auth.uid(),p_due_at) returning * into c;
 insert into public.privacy_audit_log(case_id,subject_user_id,actor_user_id,event_type,entity_type,entity_id,event_summary,metadata) values(c.id,c.subject_user_id,auth.uid(),'authority_request_received','privacy_compliance_case',c.id::text,'Requerimiento externo registrado',jsonb_build_object('authority_name',c.authority_name,'external_reference',c.external_reference));
 return to_jsonb(c);
end;$$;

revoke all on function public.admin_privacy_overview() from public,anon;
revoke all on function public.admin_privacy_case_detail(uuid) from public,anon;
revoke all on function public.admin_privacy_update_case(uuid,text,text,uuid,timestamptz,text,timestamptz,text,text,text) from public,anon;
revoke all on function public.admin_privacy_create_authority_case(text,text,text,text,uuid,text,text,text,timestamptz) from public,anon;
grant execute on function public.admin_privacy_overview() to authenticated;
grant execute on function public.admin_privacy_case_detail(uuid) to authenticated;
grant execute on function public.admin_privacy_update_case(uuid,text,text,uuid,timestamptz,text,timestamptz,text,text,text) to authenticated;
grant execute on function public.admin_privacy_create_authority_case(text,text,text,text,uuid,text,text,text,timestamptz) to authenticated;