-- La API requiere el permiso de tabla y la política RLS al mismo tiempo.
grant select, update on table public.pagos to authenticated;

-- Los pagos no se modifican desde sesiones anónimas.
revoke insert, update, delete, truncate, references, trigger
on table public.pagos from anon;

notify pgrst, 'reload schema';
