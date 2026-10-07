-- Final v2 pilot historical reconciliation normalization.
-- Legacy local payment replay was disabled before this backfill.
update public.pagos
set conciliacion_estado='conciliado'
where curso_id='2c720dbd-1e85-450d-be73-02d3da7640ce'::uuid
  and lower(coalesce(estado,''))='pagado'
  and created_at::date='2026-10-05'::date
  and lower(coalesce(conciliacion_estado,''))<>'conciliado';
