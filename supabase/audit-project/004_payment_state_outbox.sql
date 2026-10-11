-- cursapp-prod: audit of authoritative payment-state changes.
-- Never modify payment state or block payment processing on audit errors.
create or replace function private.audit_paid_state_outbox()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_event text;v_actor uuid;
begin
 if new.estado is not distinct from old.estado then return new; end if;
 if lower(coalesce(new.estado,'')) in ('pagado','paid','aprobado') then v_event:='payment_confirmed';
 elsif lower(coalesce(old.estado,'')) in ('pagado','paid','aprobado') then v_event:='payment_unpaid';
 else return new; end if;
 begin
 select usuario_id into v_actor from public.miembros_curso where id=new.miembro_id;
 insert into public.audit_delivery_outbox(actor_user_id,events)
 values(coalesce(v_actor,'00000000-0000-4000-8000-000000000001'::uuid),
 jsonb_build_array(jsonb_build_object('event_id',gen_random_uuid(),'occurred_at',now(),'actor_user_id',v_actor,
 'curso_id',new.curso_id,'actor_role','system','event_type',v_event,'target','pagos','source','server',
 'reference_id',new.id,'correlation_id',new.id,
 'metadata',jsonb_build_object('payment_status',new.estado,'payment_method',new.metodo_pago))));
 exception when others then raise warning 'Audit outbox unavailable for payment state';
 end;
 return new;
end $$;
drop trigger if exists trg_audit_paid_state_outbox on public.pagos;
create trigger trg_audit_paid_state_outbox after update of estado on public.pagos for each row execute function private.audit_paid_state_outbox();