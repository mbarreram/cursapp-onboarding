-- Pilot historical import normalization v2.
-- Paid rows imported on 2026-10-05 are historical facts from the source file,
-- not new payments awaiting Treasurer validation.
update public.pagos
set conciliacion_estado='conciliado'
where curso_id='2c720dbd-1e85-450d-be73-02d3da7640ce'::uuid
  and lower(coalesce(estado,''))='pagado'
  and created_at::date='2026-10-05'::date
  and lower(coalesce(conciliacion_estado,''))='pendiente';
