-- Fase 0B: permisos completos para los módulos conectados del rol Presidente.
-- Las reglas se limitan al usuario autenticado y a los cursos donde participa.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_course_member(p_curso_id uuid)
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
        and lower(coalesce(actor.estado, 'aprobado')) not in (
          'rechazado', 'rejected',
          'inactivo', 'inactive',
          'eliminado', 'deleted'
        )
    );
$$;

revoke all on function private.is_course_member(uuid) from public, anon;
grant execute on function private.is_course_member(uuid) to authenticated;

-- Campanas: todos los miembros del curso pueden leerlas; solo Presidencia
-- puede crearlas o modificar su configuracion.
alter table public.campanas enable row level security;
grant select, insert, update, delete on table public.campanas to authenticated;

drop policy if exists "dev insert campanas" on public.campanas;
drop policy if exists "dev select campanas" on public.campanas;
drop policy if exists "dev_all_campanas" on public.campanas;

drop policy if exists "campanas_member_select_course" on public.campanas;
create policy "campanas_member_select_course"
on public.campanas
for select
to authenticated
using ((select private.is_course_member(curso_id)));

drop policy if exists "campanas_presidente_insert_course" on public.campanas;
create policy "campanas_presidente_insert_course"
on public.campanas
for insert
to authenticated
with check ((select private.has_course_role(
  curso_id,
  array['presidente']::text[]
)));

drop policy if exists "campanas_presidente_update_course" on public.campanas;
create policy "campanas_presidente_update_course"
on public.campanas
for update
to authenticated
using ((select private.has_course_role(
  curso_id,
  array['presidente']::text[]
)))
with check ((select private.has_course_role(
  curso_id,
  array['presidente']::text[]
)));

drop policy if exists "campanas_presidente_delete_course" on public.campanas;
create policy "campanas_presidente_delete_course"
on public.campanas
for delete
to authenticated
using ((select private.has_course_role(
  curso_id,
  array['presidente']::text[]
)));

-- Pagos: Presidente y Tesorero pueden leer los pagos de su curso. Presidente
-- puede generar las cuotas iniciales cuando publica una campana.
alter table public.pagos enable row level security;
grant select, insert on table public.pagos to authenticated;

drop policy if exists "dev_all_pagos" on public.pagos;

drop policy if exists "pagos_directiva_select_course" on public.pagos;
create policy "pagos_directiva_select_course"
on public.pagos
for select
to authenticated
using ((select private.has_course_role(
  curso_id,
  array['presidente', 'tesorero']::text[]
)));

drop policy if exists "pagos_presidente_insert_course" on public.pagos;
create policy "pagos_presidente_insert_course"
on public.pagos
for insert
to authenticated
with check ((select private.has_course_role(
  curso_id,
  array['presidente']::text[]
)));

-- Avisos: lectura para miembros y administracion por Presidente.
alter table public.avisos enable row level security;
grant select, insert, update, delete on table public.avisos to authenticated;

drop policy if exists "dev_all_avisos" on public.avisos;

drop policy if exists "avisos_member_select_course" on public.avisos;
create policy "avisos_member_select_course"
on public.avisos
for select
to authenticated
using ((select private.is_course_member(curso_id)));

drop policy if exists "avisos_presidente_insert_course" on public.avisos;
create policy "avisos_presidente_insert_course"
on public.avisos
for insert
to authenticated
with check ((select private.has_course_role(
  curso_id,
  array['presidente']::text[]
)));

drop policy if exists "avisos_presidente_update_course" on public.avisos;
create policy "avisos_presidente_update_course"
on public.avisos
for update
to authenticated
using ((select private.has_course_role(
  curso_id,
  array['presidente']::text[]
)))
with check ((select private.has_course_role(
  curso_id,
  array['presidente']::text[]
)));

drop policy if exists "avisos_presidente_delete_course" on public.avisos;
create policy "avisos_presidente_delete_course"
on public.avisos
for delete
to authenticated
using ((select private.has_course_role(
  curso_id,
  array['presidente']::text[]
)));

alter table public.avisos_curso enable row level security;
grant select, insert, update, delete on table public.avisos_curso to authenticated;

drop policy if exists "avisos_curso_member_select_course" on public.avisos_curso;
create policy "avisos_curso_member_select_course"
on public.avisos_curso
for select
to authenticated
using ((select private.is_course_member(curso_id)));

drop policy if exists "avisos_curso_presidente_insert_course" on public.avisos_curso;
create policy "avisos_curso_presidente_insert_course"
on public.avisos_curso
for insert
to authenticated
with check (
  (select private.has_course_role(curso_id, array['presidente']::text[]))
  and (creado_por is null or creado_por = (select auth.uid()))
);

drop policy if exists "avisos_curso_presidente_update_course" on public.avisos_curso;
create policy "avisos_curso_presidente_update_course"
on public.avisos_curso
for update
to authenticated
using ((select private.has_course_role(
  curso_id,
  array['presidente']::text[]
)))
with check ((select private.has_course_role(
  curso_id,
  array['presidente']::text[]
)));

drop policy if exists "avisos_curso_presidente_delete_course" on public.avisos_curso;
create policy "avisos_curso_presidente_delete_course"
on public.avisos_curso
for delete
to authenticated
using ((select private.has_course_role(
  curso_id,
  array['presidente']::text[]
)));

-- Notificaciones: cada usuario lee y marca las propias. La directiva puede
-- crear notificaciones solo para miembros de su mismo curso.
alter table public.notificaciones enable row level security;
grant select, insert, update on table public.notificaciones to authenticated;

drop policy if exists "Usuarios actualizan sus notificaciones" on public.notificaciones;
drop policy if exists "Usuarios ven sus notificaciones" on public.notificaciones;

drop policy if exists "notificaciones_authenticated_select_own" on public.notificaciones;
create policy "notificaciones_authenticated_select_own"
on public.notificaciones
for select
to authenticated
using (usuario_id = (select auth.uid()));

drop policy if exists "notificaciones_authenticated_update_own" on public.notificaciones;
create policy "notificaciones_authenticated_update_own"
on public.notificaciones
for update
to authenticated
using (usuario_id = (select auth.uid()))
with check (usuario_id = (select auth.uid()));

drop policy if exists "notificaciones_directiva_insert_course" on public.notificaciones;
create policy "notificaciones_directiva_insert_course"
on public.notificaciones
for insert
to authenticated
with check (
  (select private.has_course_role(
    curso_id,
    array['presidente', 'tesorero']::text[]
  ))
  and (select private.can_view_course_user(
    usuario_id,
    array['presidente', 'tesorero']::text[]
  ))
);

-- Tickets: el usuario solo puede crear, leer y actualizar sus propios casos.
alter table public.tickets enable row level security;
grant select, insert, update on table public.tickets to authenticated;

drop policy if exists "dev_all_tickets" on public.tickets;

drop policy if exists "tickets_authenticated_select_own" on public.tickets;
create policy "tickets_authenticated_select_own"
on public.tickets
for select
to authenticated
using (usuario_id = (select auth.uid()));

drop policy if exists "tickets_authenticated_insert_own" on public.tickets;
create policy "tickets_authenticated_insert_own"
on public.tickets
for insert
to authenticated
with check (
  usuario_id = (select auth.uid())
  and (
    curso_id is null
    or (select private.is_course_member(curso_id))
  )
);

drop policy if exists "tickets_authenticated_update_own" on public.tickets;
create policy "tickets_authenticated_update_own"
on public.tickets
for update
to authenticated
using (usuario_id = (select auth.uid()))
with check (
  usuario_id = (select auth.uid())
  and (
    curso_id is null
    or (select private.is_course_member(curso_id))
  )
);

-- Preferencias y perfil: acceso exclusivo del propietario.
alter table public.preferencias_notificaciones enable row level security;
grant select, insert, update on table public.preferencias_notificaciones to authenticated;

drop policy if exists "preferencias_notificaciones_authenticated_select_own"
  on public.preferencias_notificaciones;
create policy "preferencias_notificaciones_authenticated_select_own"
on public.preferencias_notificaciones
for select
to authenticated
using (usuario_id = (select auth.uid()));

drop policy if exists "preferencias_notificaciones_authenticated_insert_own"
  on public.preferencias_notificaciones;
create policy "preferencias_notificaciones_authenticated_insert_own"
on public.preferencias_notificaciones
for insert
to authenticated
with check (usuario_id = (select auth.uid()));

drop policy if exists "preferencias_notificaciones_authenticated_update_own"
  on public.preferencias_notificaciones;
create policy "preferencias_notificaciones_authenticated_update_own"
on public.preferencias_notificaciones
for update
to authenticated
using (usuario_id = (select auth.uid()))
with check (usuario_id = (select auth.uid()));

grant update (nombre, telefono) on table public.usuarios to authenticated;

drop policy if exists "usuarios_authenticated_update_own" on public.usuarios;
create policy "usuarios_authenticated_update_own"
on public.usuarios
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Indices para filtros usados por RLS y por las pantallas del Presidente.
create index if not exists idx_avisos_curso_curso_id
  on public.avisos_curso (curso_id);
create index if not exists idx_tickets_usuario_id
  on public.tickets (usuario_id);
create index if not exists idx_tickets_curso_id
  on public.tickets (curso_id);
