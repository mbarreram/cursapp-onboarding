create or replace function public.admin_privacy_update_case(
  p_case_id uuid,
  p_status text default null,
  p_priority text default null,
  p_assigned_admin_id uuid default null,
  p_due_at timestamptz default null,
  p_response_summary text default null,
  p_response_sent_at timestamptz default null,
  p_response_channel text default null,
  p_evidence_reference text default null,
  p_legal_basis text default null
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare oldc public.privacy_compliance_cases%rowtype; newc public.privacy_compliance_cases%rowtype; mapped text;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  select * into oldc from public.privacy_compliance_cases where id=p_case_id for update;
  if not found then raise exception 'case_not_found'; end if;
  update public.privacy_compliance_cases set
    status=coalesce(p_status,status), priority=coalesce(p_priority,priority), assigned_admin_id=coalesce(p_assigned_admin_id,assigned_admin_id),
    due_at=coalesce(p_due_at,due_at), response_summary=coalesce(p_response_summary,response_summary),
    response_sent_at=coalesce(p_response_sent_at,response_sent_at), response_channel=coalesce(p_response_channel,response_channel),
    evidence_reference=coalesce(p_evidence_reference,evidence_reference), legal_basis=coalesce(p_legal_basis,legal_basis),
    closed_at=case when coalesce(p_status,status)='closed' and closed_at is null then now() else closed_at end,
    updated_at=now()
  where id=p_case_id returning * into newc;

  if newc.privacy_request_id is not null then
    mapped := case newc.status when 'received' then 'received' when 'identity_validation' then 'in_review' when 'in_review' then 'in_review' when 'in_execution' then 'in_review' when 'responded' then 'completed' when 'closed' then 'completed' when 'rejected' then 'rejected' when 'cancelled' then 'cancelled' else 'in_review' end;
    update public.privacy_rights_requests
      set status=mapped, updated_at=now(),
          resolved_at=case when mapped in ('completed','rejected','cancelled') then coalesce(resolved_at,now()) else resolved_at end,
          response_note=coalesce(p_response_summary,response_note)
      where id=newc.privacy_request_id;
  end if;

  insert into public.privacy_audit_log(
    case_id,privacy_request_id,subject_user_id,actor_user_id,event_type,entity_type,entity_id,event_summary,metadata
  ) values(
    newc.id,newc.privacy_request_id,newc.subject_user_id,auth.uid(),'case_updated','privacy_compliance_case',newc.id::text,
    'Expediente actualizado por administrador',
    jsonb_build_object('old_status',oldc.status,'new_status',newc.status,'old_priority',oldc.priority,'new_priority',newc.priority,'response_sent_at',newc.response_sent_at,'response_channel',newc.response_channel)
  );
  return to_jsonb(newc);
end;
$$;

create or replace function public.admin_privacy_log_action(
  p_case_id uuid,
  p_event_type text,
  p_event_summary text,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare c public.privacy_compliance_cases%rowtype; a public.privacy_audit_log%rowtype;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  select * into c from public.privacy_compliance_cases where id=p_case_id;
  if not found then raise exception 'case_not_found'; end if;
  insert into public.privacy_audit_log(case_id,privacy_request_id,subject_user_id,actor_user_id,event_type,entity_type,entity_id,event_summary,metadata)
  values(c.id,c.privacy_request_id,c.subject_user_id,auth.uid(),left(coalesce(p_event_type,'admin_action'),80),'privacy_compliance_case',c.id::text,left(coalesce(p_event_summary,'Acción administrativa registrada'),500),coalesce(p_metadata,'{}'::jsonb))
  returning * into a;
  return to_jsonb(a);
end;
$$;

create or replace function public.admin_privacy_send_in_app_response(
  p_case_id uuid,
  p_message text
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare c public.privacy_compliance_cases%rowtype; nid uuid;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  select * into c from public.privacy_compliance_cases where id=p_case_id for update;
  if not found then raise exception 'case_not_found'; end if;
  if c.subject_user_id is null then raise exception 'case_has_no_subject_user'; end if;
  if length(trim(coalesce(p_message,''))) < 5 then raise exception 'response_required'; end if;

  insert into public.notifications(user_id,category,title,message,url_destino,payload)
  values(c.subject_user_id,'privacy','Respuesta a tu solicitud de privacidad',trim(p_message),'/apoderado.html',jsonb_build_object('privacy_case_id',c.id,'case_number',c.case_number))
  returning id into nid;

  update public.privacy_compliance_cases
     set response_summary=trim(p_message), response_sent_at=now(), response_channel='in_app', status=case when status in ('closed','rejected','cancelled') then status else 'responded' end, updated_at=now()
   where id=c.id;

  if c.privacy_request_id is not null then
    update public.privacy_rights_requests set status='completed', response_note=trim(p_message), resolved_at=coalesce(resolved_at,now()), updated_at=now() where id=c.privacy_request_id;
  end if;

  insert into public.privacy_audit_log(case_id,privacy_request_id,subject_user_id,actor_user_id,event_type,entity_type,entity_id,event_summary,metadata)
  values(c.id,c.privacy_request_id,c.subject_user_id,auth.uid(),'in_app_response_sent','notification',nid::text,'Respuesta enviada al usuario por MiCursoX',jsonb_build_object('notification_id',nid,'channel','in_app'));

  return jsonb_build_object('notification_id',nid,'case_id',c.id,'sent_at',now());
end;
$$;

revoke all on function public.admin_privacy_log_action(uuid,text,text,jsonb) from public,anon;
grant execute on function public.admin_privacy_log_action(uuid,text,text,jsonb) to authenticated;
revoke all on function public.admin_privacy_send_in_app_response(uuid,text) from public,anon;
grant execute on function public.admin_privacy_send_in_app_response(uuid,text) to authenticated;
