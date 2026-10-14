-- cursapp-prod: cierre manual controlado de fallo terminal confirmado.
-- Solo Admin, solo cuota pendiente, con observación reciente y orden/monto verificados.
-- La transacción INITIALIZED sin resultado terminal sigue bloqueada.
create or replace function public.admin_close_confirmed_webpay_failure(p_transaction_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t record; o record; payment_state text;
begin
 if auth.uid() is null or coalesce(public.is_admin(),false) is not true then raise exception 'Admin required' using errcode='42501'; end if;
 select id,pago_id,status into t from public.transbank_transactions where id=p_transaction_id for update;
 if not found then return jsonb_build_object('ok',false,'reason','not_found');end if;
 if t.status not in ('INITIALIZED','CREATE_ERROR') then return jsonb_build_object('ok',false,'reason','not_open','status',t.status);end if;
 select estado into payment_state from public.pagos where id=t.pago_id for update;
 if payment_state is distinct from 'pendiente' then return jsonb_build_object('ok',false,'reason','payment_not_pending');end if;
 select gateway_status,classification,amount_and_order_verified,observed_at into o
 from public.transbank_status_observations where transaction_id=t.id order by observed_at desc,id desc limit 1;
 if not found or o.classification <> 'confirmed_failure' or o.gateway_status not in ('FAILED','REJECTED') or o.amount_and_order_verified is not true or o.observed_at<now()-interval '5 minutes'
 then return jsonb_build_object('ok',false,'reason','verified_terminal_failure_required');end if;
 update public.transbank_transactions set status='REJECTED',error_message='Fallo terminal confirmado por consulta Transbank; sin cobro ni conciliación.' where id=t.id and status=t.status;
 return jsonb_build_object('ok',true,'status','REJECTED','payment_unchanged',true);
end $$;
revoke all on function public.admin_close_confirmed_webpay_failure(uuid) from public,anon;
grant execute on function public.admin_close_confirmed_webpay_failure(uuid) to authenticated;