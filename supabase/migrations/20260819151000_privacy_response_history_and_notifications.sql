create table if not exists public.privacy_case_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.privacy_compliance_cases(id) on delete cascade,
  privacy_request_id uuid references public.privacy_rights_requests(id) on delete set null,
  user_id uuid not null,
  sender_type text not null default 'admin' check (sender_type in ('admin','system','user')),
  sender_user_id uuid,
  message text not null check (length(trim(message)) >= 5),
  created_at timestamptz not null default now()
);

create index if not exists privacy_case_messages_user_created_idx on public.privacy_case_messages(user_id, created_at desc);
create index if not exists privacy_case_messages_request_created_idx on public.privacy_case_messages(privacy_request_id, created_at asc);

alter table public.privacy_case_messages enable row level security;
revoke all on public.privacy_case_messages from anon;
grant select on public.privacy_case_messages to authenticated;

drop policy if exists privacy_case_messages_select_own on public.privacy_case_messages;
create policy privacy_case_messages_select_own on public.privacy_case_messages for select to authenticated
using (user_id = auth.uid() or public.is_admin());

insert into public.privacy_case_messages(case_id, privacy_request_id, user_id, sender_type, sender_user_id, message, created_at)
select c.id, r.id, r.user_id, 'admin', c.assigned_admin_id, r.response_note, coalesce(r.resolved_at, r.updated_at, now())
from public.privacy_rights_requests r
join public.privacy_compliance_cases c on c.privacy_request_id = r.id
where nullif(trim(r.response_note),'') is not null
  and not exists (select 1 from public.privacy_case_messages m where m.privacy_request_id=r.id and m.message=r.response_note);

create or replace function public.admin_privacy_send_in_app_response(p_case_id uuid, p_message text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare c public.privacy_compliance_cases%rowtype; nid uuid; mid uuid;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  select * into c from public.privacy_compliance_cases where id=p_case_id for update;
  if not found then raise exception 'case_not_found'; end if;
  if c.subject_user_id is null then raise exception 'case_has_no_subject_user'; end if;
  if length(trim(coalesce(p_message,''))) < 5 then raise exception 'response_required'; end if;

  insert into public.privacy_case_messages(case_id,privacy_request_id,user_id,sender_type,sender_user_id,message)
  values(c.id,c.privacy_request_id,c.subject_user_id,'admin',auth.uid(),trim(p_message)) returning id into mid;

  insert into public.notifications(user_id,category,title,message,url_destino,payload,is_read,delivery_state)
  values(c.subject_user_id,'privacy','Respuesta disponible · Privacidad','MiCursoX respondió tu solicitud '||coalesce(c.case_number,'')||'. Revisa el detalle en Consentimientos y privacidad.','/apoderado.html',jsonb_build_object('privacy_case_id',c.id,'privacy_request_id',c.privacy_request_id,'case_number',c.case_number,'message_id',mid,'action','open_privacy_history'),false,'internal_only')
  returning id into nid;

  update public.privacy_compliance_cases
     set response_summary=trim(p_message), response_sent_at=now(), response_channel='in_app', status=case when status in ('closed','rejected','cancelled') then status else 'responded' end, updated_at=now()
   where id=c.id;

  if c.privacy_request_id is not null then
    update public.privacy_rights_requests set status='completed', response_note=trim(p_message), resolved_at=coalesce(resolved_at,now()), updated_at=now() where id=c.privacy_request_id;
  end if;

  insert into public.privacy_audit_log(case_id,privacy_request_id,subject_user_id,actor_user_id,event_type,entity_type,entity_id,event_summary,metadata)
  values(c.id,c.privacy_request_id,c.subject_user_id,auth.uid(),'in_app_response_sent','privacy_case_message',mid::text,'Respuesta enviada al usuario por MiCursoX',jsonb_build_object('notification_id',nid,'message_id',mid,'channel','in_app'));

  return jsonb_build_object('notification_id',nid,'message_id',mid,'case_id',c.id,'sent_at',now());
end;
$function$;

revoke all on function public.admin_privacy_send_in_app_response(uuid,text) from public, anon;
grant execute on function public.admin_privacy_send_in_app_response(uuid,text) to authenticated;