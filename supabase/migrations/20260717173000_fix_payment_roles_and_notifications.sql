-- Pagos: cada rol sólo ve o modifica las obligaciones que le corresponden.
drop policy if exists pagos_apoderado_select_own on public.pagos;
create policy pagos_apoderado_select_own
on public.pagos for select to authenticated
using (
  exists (
    select 1 from public.miembros_curso m
    where m.id = pagos.miembro_id
      and m.usuario_id = (select auth.uid())
      and m.rol = 'apoderado'
      and coalesce(m.estado, 'aprobado') = 'aprobado'
  )
);

drop policy if exists pagos_apoderado_update_own on public.pagos;
create policy pagos_apoderado_update_own
on public.pagos for update to authenticated
using (
  exists (
    select 1 from public.miembros_curso m
    where m.id = pagos.miembro_id
      and m.usuario_id = (select auth.uid())
      and m.rol = 'apoderado'
      and coalesce(m.estado, 'aprobado') = 'aprobado'
  )
)
with check (
  exists (
    select 1 from public.miembros_curso m
    where m.id = pagos.miembro_id
      and m.usuario_id = (select auth.uid())
      and m.rol = 'apoderado'
      and coalesce(m.estado, 'aprobado') = 'aprobado'
  )
);

drop policy if exists pagos_tesorero_update_course on public.pagos;
create policy pagos_tesorero_update_course
on public.pagos for update to authenticated
using ((select private.has_course_role(pagos.curso_id, array['tesorero']::text[])))
with check ((select private.has_course_role(pagos.curso_id, array['tesorero']::text[])));

-- Notificaciones oficiales: una campaña nueva avisa a cada apoderado aprobado.
create or replace function public.cursapp_notify_new_campaign()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notifications
    (user_id, curso_id, rol_destino, category, title, message, url_destino, payload, delivery_state)
  select m.usuario_id, new.curso_id, 'apoderado', 'campaign',
         'Nueva campaña: ' || new.titulo,
         'Se creó una nueva campaña para tu curso. Monto: $' ||
           trim(to_char(coalesce(new.monto, 0), 'FM999G999G999')) ||
           case when new.fecha_vencimiento is not null then '. Vence: ' || new.fecha_vencimiento::text || '.' else '.' end,
         '/apoderado.html#payments',
         jsonb_build_object('campana_id', new.id),
         'created'
  from public.miembros_curso m
  where m.curso_id = new.curso_id
    and m.rol = 'apoderado'
    and coalesce(m.estado, 'aprobado') = 'aprobado'
    and m.usuario_id is not null;
  return new;
end;
$$;
revoke all on function public.cursapp_notify_new_campaign() from public, anon, authenticated;

drop trigger if exists cursapp_notify_new_campaign_trigger on public.campanas;
create trigger cursapp_notify_new_campaign_trigger
after insert on public.campanas
for each row execute function public.cursapp_notify_new_campaign();

-- Al conciliar/pagar, la directiva recibe el cambio una sola vez.
create or replace function public.cursapp_notify_paid_payment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  campaign_title text;
begin
  if lower(coalesce(new.estado, '')) in ('pagado','paid','conciliado')
     and lower(coalesce(old.estado, '')) not in ('pagado','paid','conciliado') then
    select c.titulo into campaign_title from public.campanas c where c.id = new.campana_id;
    insert into public.notifications
      (user_id, curso_id, rol_destino, category, title, message, url_destino, payload, delivery_state)
    select m.usuario_id, new.curso_id, m.rol, 'payment', 'Pago recibido',
           'Se registró un pago de $' || trim(to_char(coalesce(new.monto_pagado,new.monto,0), 'FM999G999G999')) ||
             ' para ' || coalesce(campaign_title, 'una campaña') || '.',
           case when m.rol = 'tesorero' then '/tesorero.html#conciliacion' else '/presidente.html#deudores' end,
           jsonb_build_object('pago_id',new.id,'campana_id',new.campana_id),
           'created'
    from public.miembros_curso m
    where m.curso_id = new.curso_id
      and m.rol in ('presidente','tesorero')
      and coalesce(m.estado, 'aprobado') = 'aprobado'
      and m.usuario_id is not null;
  end if;
  return new;
end;
$$;
revoke all on function public.cursapp_notify_paid_payment() from public, anon, authenticated;

drop trigger if exists cursapp_notify_paid_payment_trigger on public.pagos;
create trigger cursapp_notify_paid_payment_trigger
after update of estado on public.pagos
for each row execute function public.cursapp_notify_paid_payment();

-- Corrige metas históricas obligatorias que quedaron sin proyección oficial.
update public.campanas c
set goal_total = c.monto * greatest(coalesce(cu.total_alumnos, 0), 1)
from public.cursos cu
where cu.id = c.curso_id
  and coalesce(c.obligatoria, false) = true
  and (c.goal_total is null or c.goal_total <= 0);
