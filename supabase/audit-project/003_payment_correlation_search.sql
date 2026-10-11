-- Ejecutar únicamente en micursox-auditoria.
-- La consulta por UUID de pago devuelve tanto las trazas de UI/cuota
-- como las transacciones Transbank vinculadas mediante correlation_id.
-- Migración incremental sobre audit_search_server existente.
create or replace function public.audit_search_server(
 p_actor_user_id uuid default null,p_reference_id uuid default null,
 p_from timestamptz default null,p_to timestamptz default null,
 p_event_type text default null,p_before_at timestamptz default null,
 p_before_id bigint default null,p_limit int default 25
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'unauthorized' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.occurred_at desc,x.id desc),'[]'::jsonb) into result
 from(select id,event_id,occurred_at,ingested_at,actor_user_id,curso_id,actor_role,event_type,target,source,reference_id,correlation_id,metadata
 from public.audit_events e
 where (p_actor_user_id is null or e.actor_user_id=p_actor_user_id)
 and (p_reference_id is null or e.reference_id=p_reference_id or e.correlation_id=p_reference_id)
 and (p_from is null or e.occurred_at>=p_from)
 and (p_to is null or e.occurred_at<p_to)
 and (coalesce(p_event_type,'')='' or e.event_type=p_event_type)
 and (p_before_at is null or (e.occurred_at,e.id)<(p_before_at,coalesce(p_before_id,9223372036854775807)))
 order by e.occurred_at desc,e.id desc limit least(greatest(coalesce(p_limit,25),1),100))x;
 return result;
end $$;
revoke all on function public.audit_search_server(uuid,uuid,timestamptz,timestamptz,text,timestamptz,bigint,int) from public,anon,authenticated;
grant execute on function public.audit_search_server(uuid,uuid,timestamptz,timestamptz,text,timestamptz,bigint,int) to service_role;
