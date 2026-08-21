alter table public.transbank_transactions add column if not exists transaction_type text not null default 'cuota';
alter table public.transbank_transactions add column if not exists credit_order_id uuid references public.ordenes_creditos(id) on delete set null;
alter table public.ordenes_creditos add column if not exists transbank_transaction_id uuid references public.transbank_transactions(id) on delete set null;
alter table public.ordenes_creditos add column if not exists updated_at timestamptz not null default now();
create index if not exists idx_transbank_transactions_credit_order on public.transbank_transactions(credit_order_id);
create index if not exists idx_ordenes_creditos_usuario_created on public.ordenes_creditos(usuario_id,created_at desc);

drop policy if exists creditos_usuario_all on public.creditos_usuario;
drop policy if exists movimientos_creditos_all on public.movimientos_creditos;
drop policy if exists ordenes_creditos_all on public.ordenes_creditos;
create policy creditos_usuario_select_own on public.creditos_usuario for select to authenticated using (usuario_id = auth.uid()::text or is_admin());
create policy movimientos_creditos_select_own on public.movimientos_creditos for select to authenticated using (usuario_id = auth.uid()::text or is_admin());
create policy ordenes_creditos_select_own on public.ordenes_creditos for select to authenticated using (usuario_id = auth.uid()::text or is_admin());

create or replace function public.complete_mercado_credit_order(p_order_id uuid, p_transbank_transaction_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.ordenes_creditos%rowtype; t public.transbank_transactions%rowtype; w public.creditos_usuario%rowtype; v_before integer:=0; v_after integer:=0; v_user text;
begin
  select * into o from public.ordenes_creditos where id=p_order_id for update;
  if not found then raise exception 'Orden de créditos no encontrada'; end if;
  select * into t from public.transbank_transactions where id=p_transbank_transaction_id and credit_order_id=p_order_id;
  if not found then raise exception 'Transacción Transbank no corresponde a la orden'; end if;
  if t.status<>'APPROVED' then raise exception 'Transacción no aprobada'; end if;
  if round(coalesce(t.amount,0))<>round(coalesce(o.monto_total,o.monto,0)) then raise exception 'Monto aprobado no coincide'; end if;
  if lower(coalesce(o.estado,'')) in ('pagada','pagado') then return jsonb_build_object('ok',true,'already_completed',true,'order_id',o.id,'credits',o.creditos); end if;
  v_user:=o.usuario_id; perform pg_advisory_xact_lock(hashtext(v_user));
  select * into w from public.creditos_usuario where usuario_id=v_user order by updated_at desc nulls last,created_at desc limit 1 for update;
  if not found then insert into public.creditos_usuario(usuario_id,email,saldo_creditos,saldo,total_comprado,total_consumido,created_at,updated_at) values(v_user,o.email,0,0,0,0,now(),now()) returning * into w; end if;
  v_before:=coalesce(w.saldo,w.saldo_creditos,0); v_after:=v_before+coalesce(o.creditos,0);
  update public.creditos_usuario set saldo=v_after,saldo_creditos=v_after,total_comprado=coalesce(total_comprado,0)+coalesce(o.creditos,0),updated_at=now() where id=w.id;
  update public.ordenes_creditos set estado='pagada',proveedor_pago='transbank',gateway='webpay_plus',ingreso_cursapp=coalesce(monto_total,monto,0),pagado_at=now(),transbank_transaction_id=t.id,tbk_order=t.buy_order,updated_at=now() where id=o.id;
  insert into public.movimientos_creditos(usuario_id,tipo,creditos,descripcion,referencia_id,created_at) values(v_user,'compra',coalesce(o.creditos,0),'Compra de créditos Mercado vía Transbank',o.id::text,now());
  insert into public.transacciones_cursapp(tipo,usuario_id,monto_total,monto_curso,comision_cursapp,ingreso_cursapp,curso_id,estado,proveedor_pago,tbk_token,tbk_buy_order,metadata,created_at) values('compra_creditos_mercado',v_user,coalesce(o.monto_total,o.monto,0),0,0,coalesce(o.monto_total,o.monto,0),null,'pagado','transbank',t.token_ws,t.buy_order,jsonb_build_object('orden_creditos_id',o.id,'transbank_transaction_id',t.id,'creditos',o.creditos,'paquete',coalesce(o.paquete_nombre,o.paquete_codigo,o.paquete_id)),now());
  return jsonb_build_object('ok',true,'already_completed',false,'order_id',o.id,'credits',o.creditos,'saldo_anterior',v_before,'saldo_posterior',v_after);
end;$$;
revoke all on function public.complete_mercado_credit_order(uuid,uuid) from public,anon,authenticated;
grant execute on function public.complete_mercado_credit_order(uuid,uuid) to service_role;

create or replace function public.spend_mercado_credits(p_rule text,p_publicacion_id text default null,p_descripcion text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user text:=auth.uid()::text; v_cost integer; w public.creditos_usuario%rowtype; v_before integer; v_after integer;
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  v_cost:=case lower(coalesce(p_rule,'')) when 'colegio' then 1 when 'comuna' then 3 when 'cursapp' then 5 else null end;
  if v_cost is null then raise exception 'Regla de destacado inválida'; end if;
  perform pg_advisory_xact_lock(hashtext(v_user));
  select * into w from public.creditos_usuario where usuario_id=v_user order by updated_at desc nulls last,created_at desc limit 1 for update;
  if not found then raise exception 'No tienes créditos disponibles'; end if;
  v_before:=coalesce(w.saldo,w.saldo_creditos,0); if v_before<v_cost then raise exception 'Créditos insuficientes'; end if; v_after:=v_before-v_cost;
  update public.creditos_usuario set saldo=v_after,saldo_creditos=v_after,total_consumido=coalesce(total_consumido,0)+v_cost,updated_at=now() where id=w.id;
  insert into public.movimientos_creditos(usuario_id,tipo,creditos,descripcion,referencia_id,created_at) values(v_user,'uso',-v_cost,coalesce(nullif(p_descripcion,''),'Destacado Mercado · '||lower(p_rule)),p_publicacion_id,now());
  return jsonb_build_object('ok',true,'cost',v_cost,'saldo_anterior',v_before,'saldo_posterior',v_after);
end;$$;
revoke all on function public.spend_mercado_credits(text,text,text) from public,anon;
grant execute on function public.spend_mercado_credits(text,text,text) to authenticated;