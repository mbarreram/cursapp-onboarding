-- Authorize the president/directiva workflow on the Apoderados screen
-- without exposing members or profiles from unrelated courses.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.has_course_role(
  p_curso_id uuid,
  p_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.miembros_curso as actor
      where actor.curso_id = p_curso_id
        and actor.usuario_id = (select auth.uid())
        and lower(actor.rol) = any(p_roles)
        and lower(coalesce(actor.estado, 'aprobado')) not in (
          'rechazado', 'rejected',
          'inactivo', 'inactive',
          'eliminado', 'deleted'
        )
    );
$$;

create or replace function private.can_view_course_user(
  p_usuario_id uuid,
  p_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.miembros_curso as actor
      join public.miembros_curso as target
        on target.curso_id = actor.curso_id
      where actor.usuario_id = (select auth.uid())
        and target.usuario_id = p_usuario_id
        and lower(actor.rol) = any(p_roles)
        and lower(coalesce(actor.estado, 'aprobado')) not in (
          'rechazado', 'rejected',
          'inactivo', 'inactive',
          'eliminado', 'deleted'
        )
        and lower(coalesce(target.estado, 'aprobado')) not in (
          'rechazado', 'rejected',
          'inactivo', 'inactive',
          'eliminado', 'deleted'
        )
    );
$$;

revoke all on function private.has_course_role(uuid, text[]) from public, anon;
revoke all on function private.can_view_course_user(uuid, text[]) from public, anon;
grant execute on function private.has_course_role(uuid, text[]) to authenticated;
grant execute on function private.can_view_course_user(uuid, text[]) to authenticated;

grant select on table public.colegios to authenticated;
grant select, insert, update, delete on table public.miembros_curso to authenticated;

alter table public.colegios enable row level security;
alter table public.miembros_curso enable row level security;
alter table public.usuarios enable row level security;

drop policy if exists "colegios_authenticated_select_course" on public.colegios;
create policy "colegios_authenticated_select_course"
on public.colegios
for select
to authenticated
using (
  exists (
    select 1
    from public.cursos as c
    where c.colegio_id = colegios.id
  )
);

drop policy if exists "miembros_curso_directiva_select_course" on public.miembros_curso;
create policy "miembros_curso_directiva_select_course"
on public.miembros_curso
for select
to authenticated
using (
  (select private.has_course_role(
    curso_id,
    array['presidente', 'tesorero']::text[]
  ))
);

drop policy if exists "usuarios_directiva_select_course" on public.usuarios;
create policy "usuarios_directiva_select_course"
on public.usuarios
for select
to authenticated
using (
  (select private.can_view_course_user(
    id,
    array['presidente', 'tesorero']::text[]
  ))
);

drop policy if exists "miembros_curso_presidente_insert_course" on public.miembros_curso;
create policy "miembros_curso_presidente_insert_course"
on public.miembros_curso
for insert
to authenticated
with check (
  (select private.has_course_role(
    curso_id,
    array['presidente']::text[]
  ))
);

drop policy if exists "miembros_curso_presidente_update_course" on public.miembros_curso;
create policy "miembros_curso_presidente_update_course"
on public.miembros_curso
for update
to authenticated
using (
  (select private.has_course_role(
    curso_id,
    array['presidente']::text[]
  ))
)
with check (
  (select private.has_course_role(
    curso_id,
    array['presidente']::text[]
  ))
);

drop policy if exists "miembros_curso_presidente_delete_course" on public.miembros_curso;
create policy "miembros_curso_presidente_delete_course"
on public.miembros_curso
for delete
to authenticated
using (
  (select private.has_course_role(
    curso_id,
    array['presidente']::text[]
  ))
);
