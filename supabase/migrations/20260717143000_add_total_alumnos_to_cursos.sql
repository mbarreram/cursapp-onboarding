alter table public.cursos
  add column if not exists total_alumnos integer;

alter table public.cursos
  drop constraint if exists cursos_total_alumnos_check;

alter table public.cursos
  add constraint cursos_total_alumnos_check
  check (total_alumnos is null or total_alumnos between 1 and 200);

comment on column public.cursos.total_alumnos is
  'Total oficial de alumnos del curso. Se inicializa en onboarding y no depende de usuarios registrados.';

grant select on public.cursos to authenticated;
grant update (total_alumnos) on public.cursos to authenticated;

drop policy if exists cursos_authenticated_update_presidente on public.cursos;
create policy cursos_authenticated_update_presidente
on public.cursos
for update
to authenticated
using (
  (select auth.uid()) is not null
  and exists (
    select 1 from public.miembros_curso mc
    where mc.curso_id = cursos.id
      and mc.usuario_id = (select auth.uid())
      and lower(mc.rol) = 'presidente'
      and lower(coalesce(mc.estado, '')) in ('aprobado','activo','approved','active')
  )
)
with check (
  (select auth.uid()) is not null
  and exists (
    select 1 from public.miembros_curso mc
    where mc.curso_id = cursos.id
      and mc.usuario_id = (select auth.uid())
      and lower(mc.rol) = 'presidente'
      and lower(coalesce(mc.estado, '')) in ('aprobado','activo','approved','active')
  )
);
