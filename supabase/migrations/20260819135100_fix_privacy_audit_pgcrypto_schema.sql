create or replace function public.privacy_audit_prepare()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare p text;
begin
  select event_hash into p
  from public.privacy_audit_log
  where case_id = new.case_id
  order by id desc
  limit 1;
  new.prev_hash := p;
  new.actor_user_id := coalesce(new.actor_user_id, auth.uid());
  new.event_hash := encode(extensions.digest(
    coalesce(p,'') || '|' || new.case_id::text || '|' || coalesce(new.privacy_request_id::text,'') || '|' ||
    coalesce(new.subject_user_id::text,'') || '|' || coalesce(new.actor_user_id::text,'') || '|' ||
    new.event_type || '|' || coalesce(new.entity_type,'') || '|' || coalesce(new.entity_id,'') || '|' ||
    new.event_summary || '|' || new.metadata::text || '|' || new.created_at::text,
    'sha256'
  ),'hex');
  return new;
end;
$$;