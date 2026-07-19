-- Resumen financiero seguro para apoderados.
-- Expone solo agregados y rendiciones aprobadas/publicadas; nunca comprobantes.
create or replace function public.apoderado_financial_summary(p_curso_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_uid uuid := auth.uid();
  v_month_start date := date_trunc('month', current_date)::date;
  v_month_end date := (date_trunc('month', current_date) + interval '1 month')::date;
  v_result jsonb;
begin
  if v_uid is null or not private.is_course_member(p_curso_id) then
    raise exception 'No autorizado para consultar este curso' using errcode = '42501';
  end if;

  with approved_expenses as (
    select g.id, g.titulo, g.categoria, g.monto, g.fecha_gasto, g.created_at
    from public.gastos g
    where g.curso_id = p_curso_id
      and lower(coalesce(g.estado, '')) = 'aprobada'
      and exists (
        select 1 from public.rendiciones r
        where r.gasto_id = g.id
          and lower(coalesce(r.estado, '')) = 'aprobada'
          and r.publicado is true
      )
  ), months as (
    select generate_series(
      date_trunc('month', current_date) - interval '5 months',
      date_trunc('month', current_date), interval '1 month'
    )::date as month_start
  ), evolution as (
    select m.month_start,
      coalesce((select sum(p.monto_pagado) from public.pagos p
        where p.curso_id=p_curso_id and lower(p.estado)='pagado'
          and coalesce(p.paid_at,p.created_at) < m.month_start + interval '1 month'),0)
      - coalesce((select sum(a.monto) from approved_expenses a
        where a.fecha_gasto < m.month_start + interval '1 month'),0) as balance
    from months m order by m.month_start
  )
  select jsonb_build_object(
    'course_id', p_curso_id,
    'generated_at', now(),
    'income_month', coalesce((select sum(p.monto_pagado) from public.pagos p
      where p.curso_id=p_curso_id and lower(p.estado)='pagado'
        and coalesce(p.paid_at,p.created_at) >= v_month_start
        and coalesce(p.paid_at,p.created_at) < v_month_end),0),
    'income_total', coalesce((select sum(p.monto_pagado) from public.pagos p
      where p.curso_id=p_curso_id and lower(p.estado)='pagado'),0),
    'expenses_month', coalesce((select sum(a.monto) from approved_expenses a
      where a.fecha_gasto >= v_month_start and a.fecha_gasto < v_month_end),0),
    'expenses_total', coalesce((select sum(a.monto) from approved_expenses a),0),
    'balance', coalesce((select sum(p.monto_pagado) from public.pagos p
      where p.curso_id=p_curso_id and lower(p.estado)='pagado'),0)
      - coalesce((select sum(a.monto) from approved_expenses a),0),
    'pending_renditions', coalesce((select count(*) from public.rendiciones r
      where r.curso_id=p_curso_id and lower(coalesce(r.estado,'')) in ('pendiente_aprobacion','observada')),0),
    'expenses_by_category', coalesce((select jsonb_agg(jsonb_build_object(
      'name', x.category, 'amount', x.amount) order by x.amount desc)
      from (select coalesce(nullif(trim(a.categoria),''),'Otros') category, sum(a.monto) amount
        from approved_expenses a group by 1) x),'[]'::jsonb),
    'recent_renditions', coalesce((select jsonb_agg(jsonb_build_object(
      'id',x.id,'title',x.titulo,'category',x.categoria,'amount',x.monto,'date',x.fecha_gasto)
      order by x.fecha_gasto desc, x.created_at desc)
      from (select * from approved_expenses order by fecha_gasto desc, created_at desc limit 5) x),'[]'::jsonb),
    'evolution', coalesce((select jsonb_agg(jsonb_build_object(
      'month',to_char(e.month_start,'YYYY-MM'),'balance',e.balance) order by e.month_start)
      from evolution e),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.apoderado_financial_summary(uuid) from public, anon;
grant execute on function public.apoderado_financial_summary(uuid) to authenticated;

