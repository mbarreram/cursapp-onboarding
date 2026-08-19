create or replace function public.admin_privacy_send_in_app_response(p_case_id uuid, p_message text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare c public.privacy_compliance_cases%rowtype; nid uuid;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  select * into c from public.privacy_compliance_cases where id=p_case_id for update;
  if not found then raise exception 'case_not_found'; end if;
  if c.subject_user_id is null then raise exception 'case_has_no_subject_user'; end if;
  if length(trim(coalesce(p_message,''))) < 5 then raise exception 'response_required'; end if;

  insert into public.notifications(user_id,category,title,message,url_destino,payload)
  values(
    c.subject_user_id,
    'privacy',
    'Respuesta a tu solicitud de privacidad',
    'MiCursoX respondió tu solicitud. Ingresa a Consentimientos y privacidad para revisar la respuesta y su historial.',
    '/apoderado.html',
    jsonb_build_object('privacy_case_id',c.id,'case_number',c.case_number)
  )
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
$function$;
