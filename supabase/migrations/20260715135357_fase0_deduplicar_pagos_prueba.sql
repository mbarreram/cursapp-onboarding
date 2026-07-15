-- Cursapp Fase 0A
-- Autorizado expresamente: elimina 7 pagos duplicados de prueba y evita recurrencia.

do $$
declare
  deleted_count integer;
begin
  with ranked as (
    select
      id,
      row_number() over (
        partition by campana_id, miembro_id, periodo
        order by
          case estado
            when 'conciliado' then 1
            when 'pagado' then 2
            when 'parcial' then 3
            when 'vencido' then 4
            when 'pendiente' then 5
            else 6
          end,
          coalesce(monto_pagado, 0) desc,
          paid_at desc nulls last,
          created_at desc nulls last,
          id desc
      ) as duplicate_rank
    from public.pagos
  )
  delete from public.pagos p
  using ranked r
  where p.id = r.id
    and r.duplicate_rank > 1;

  get diagnostics deleted_count = row_count;
  if deleted_count <> 7 then
    raise exception 'Se esperaban eliminar 7 pagos duplicados de prueba, pero se eliminaron %', deleted_count;
  end if;
end $$;

create unique index uq_pagos_campana_miembro_periodo
  on public.pagos (campana_id, miembro_id, periodo);
