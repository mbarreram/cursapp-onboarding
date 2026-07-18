-- PostgREST necesita un indice unico no parcial para resolver on_conflict=gasto_id.
-- PostgreSQL permite multiples NULL, por lo que se conserva la compatibilidad
-- con las rendiciones historicas que aun no apuntan a un gasto.
drop index if exists public.rendiciones_gasto_uidx;
create unique index rendiciones_gasto_uidx on public.rendiciones(gasto_id);
