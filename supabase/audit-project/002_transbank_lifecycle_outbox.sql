-- cursapp-prod: trazas tecnicas de Webpay en la cola auditada
-- No cambia estados, montos, conciliaciones ni payloads Transbank.
create or replace function private.audit_transbank_lifecycle()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_event text;
begin
 if tg_op='INSERT' then v_event:='transbank_created';
 elsif new.status is distinct from old.status then v_event:='transbank_status_'||lower(regexp_replace(coalesce(new.status,'unknown'),'[^a-zA-Z0-9_]','','g'));
 else return new; end if;
 begin
  insert into public.audit_delivery_outbox(actor_user_id,events)
  values(coalesce(new.user_id,'00000000-0000-4000-8000-000000000001'::uuid),
  jsonb_build_array(jsonb_build_object('event_id',gen_random_uuid(),'occurred_at',now(),
   'actor_user_id',new.user_id,'curso_id',new.curso_id,'actor_role','system',
   'event_type',left(v_event,80),'target','transbank_transactions','source','server',
   'reference_id',new.id,'correlation_id',new.pago_id,
   'metadata',jsonb_build_object('status',new.status,'pago_id',new.pago_id))));
 exception when others then raise warning 'Audit outbox unavailable for Transbank event';
 end;
 return new;
end $$;
drop trigger if exists trg_audit_transbank_lifecycle on public.transbank_transactions;
create trigger trg_audit_transbank_lifecycle after insert or update of status on public.transbank_transactions
for each row execute function private.audit_transbank_lifecycle();
