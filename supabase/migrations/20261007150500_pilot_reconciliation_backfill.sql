-- MiCursoX pilot data normalization.
-- Historical paid rows imported on 2026-10-05 already represented settled history.
-- Mark them explicitly reconciled so future UI can use strict reconciliation semantics.
update public.pagos p
set conciliacion_estado='conciliado'
where p.curso_id = (
  select c.id
  from public.cursos c
  where c.course_key='0fbfc9f6-a3be-4edb-95c2-42657cab4648|7°|D|Mañana|2026'
  limit 1
)
  and lower(coalesce(p.estado,'')) in ('pagado','paid','conciliado')
  and coalesce(p.conciliacion_estado,'')=''
  and p.created_at::date='2026-10-05'::date;
