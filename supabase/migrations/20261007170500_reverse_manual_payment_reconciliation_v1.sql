-- Allow Treasurer/President to reverse a manual reconciliation without altering payment facts.
create table if not exists public.pagos_conciliacion_historial (
  id uuid primary key default gen_random_uuid(),
  pago_id uuid not null references public.pagos(id) on delete cascade,
  curso_id uuid not null references public.cursos(id) on delete cascade,
  accion text not null check (accion in ('conciliado','conciliacion_anulada')),
  estado_anterior text,
  estado_nuevo text,
  metodo_pago text,
  actor_usuario_id uuid,
  motivo text,
  created_at timestamptz not null default now()
);

create index if not exists idx_pagos_conc_hist_pago on public.pagos_conciliacion_historial(pago_id, created_at desc);
create index if not exists idx_pagos_conc_hist_curso on public.pagos_conciliacion_historial(curso_id, created_at desc);

alter table public.pagos_conciliacion_historial enable row level security;

drop policy if exists pagos_conc_hist_select_member on public.pagos_conciliacion_historial;
create policy pagos_conc_hist_select_member
on public.pagos_conciliacion_historial
for select
to authenticated
using (private.is_course_member(curso_id));

revoke insert, update, delete on public.pagos_conciliacion_historial from anon, authenticated;
grant select on public.pagos_conciliacion_historial to authenticated;

create or replace function public.reverse_payment_reconciliation(
  p_payment_id uuid,
  p_reason text default null
)
returns public.pagos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pago public.pagos%rowtype;
  v_reason text := nullif(trim(coalesce(p_reason,'')),'');
begin
  select * into v_pago
  from public.pagos
  where id = p_payment_id
  for update;

  if v_pago.id is null then
    raise exception 'Pago no encontrado';
  end if;

  if not private.has_course_role(v_pago.curso_id, array['tesorero','presidente']::text[]) then
    raise exception 'No autorizado para anular esta conciliación';
  end if;

  if lower(coalesce(v_pago.conciliacion_estado,'')) <> 'conciliado' then
    raise exception 'El pago no está conciliado';
  end if;

  if lower(coalesce(v_pago.metodo_pago,'')) in ('webpay','transbank')
     or lower(coalesce(v_pago.canal_recaudacion,'')) in ('webpay','transbank') then
    raise exception 'Los pagos automáticos Transbank/Webpay no se pueden deshacer manualmente';
  end if;

  update public.pagos
  set conciliacion_estado = 'pendiente',
      conciliado_por = null
  where id = p_payment_id
  returning * into v_pago;

  insert into public.pagos_conciliacion_historial(
    pago_id, curso_id, accion, estado_anterior, estado_nuevo,
    metodo_pago, actor_usuario_id, motivo
  )
  values (
    v_pago.id, v_pago.curso_id, 'conciliacion_anulada',
    'conciliado', 'pendiente', v_pago.metodo_pago, auth.uid(), v_reason
  );

  return v_pago;
end;
$$;

revoke all on function public.reverse_payment_reconciliation(uuid,text) from public, anon;
grant execute on function public.reverse_payment_reconciliation(uuid,text) to authenticated;
