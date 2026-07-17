alter table public.avisos_curso_lecturas enable row level security;

revoke all on public.avisos_curso_lecturas from anon;
revoke truncate on public.avisos_curso from anon, authenticated;
grant select, insert, update on public.avisos_curso_lecturas to authenticated;

drop policy if exists avisos_lecturas_select_own_or_president on public.avisos_curso_lecturas;
create policy avisos_lecturas_select_own_or_president
on public.avisos_curso_lecturas for select to authenticated
using (
  usuario_id = (select auth.uid())
  or exists (
    select 1 from public.avisos_curso a
    where a.id = aviso_id
      and (select private.has_course_role(a.curso_id, array['presidente'::text]))
  )
);

drop policy if exists avisos_lecturas_insert_own on public.avisos_curso_lecturas;
create policy avisos_lecturas_insert_own
on public.avisos_curso_lecturas for insert to authenticated
with check (
  usuario_id = (select auth.uid())
  and exists (
    select 1 from public.avisos_curso a
    where a.id = aviso_id
      and (select private.is_course_member(a.curso_id))
  )
);

drop policy if exists avisos_lecturas_update_own on public.avisos_curso_lecturas;
create policy avisos_lecturas_update_own
on public.avisos_curso_lecturas for update to authenticated
using (usuario_id = (select auth.uid()))
with check (usuario_id = (select auth.uid()));
