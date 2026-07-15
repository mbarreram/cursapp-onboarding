-- Allow authenticated sessions to bootstrap the current user's Cursapp context
-- through the Supabase Data API without exposing other users' rows.

grant usage on schema public to authenticated;
grant select on table public.usuarios to authenticated;
grant select on table public.miembros_curso to authenticated;
grant select on table public.cursos to authenticated;

alter table public.usuarios enable row level security;
alter table public.miembros_curso enable row level security;
alter table public.cursos enable row level security;

-- These legacy PUBLIC policies also applied to authenticated users and would
-- make every usuarios row visible/editable after granting table access.
-- Equivalent anon-only development policies remain in place for now.
drop policy if exists "dev_insert_usuarios" on public.usuarios;
drop policy if exists "dev_select_usuarios" on public.usuarios;
drop policy if exists "dev_update_usuarios" on public.usuarios;

drop policy if exists "usuarios_authenticated_select_own" on public.usuarios;
create policy "usuarios_authenticated_select_own"
on public.usuarios
for select
to authenticated
using (
  (select auth.uid()) is not null
  and id = (select auth.uid())
);

drop policy if exists "miembros_curso_authenticated_select_own" on public.miembros_curso;
create policy "miembros_curso_authenticated_select_own"
on public.miembros_curso
for select
to authenticated
using (
  (select auth.uid()) is not null
  and usuario_id = (select auth.uid())
);

drop policy if exists "cursos_authenticated_select_member" on public.cursos;
create policy "cursos_authenticated_select_member"
on public.cursos
for select
to authenticated
using (
  (select auth.uid()) is not null
  and id in (
    select mc.curso_id
    from public.miembros_curso as mc
    where mc.usuario_id = (select auth.uid())
  )
);
