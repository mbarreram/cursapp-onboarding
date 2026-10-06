-- MiCursoX · Pizarrón: solo directiva puede editar/eliminar publicaciones.
drop policy if exists pizarron_posts_owner_directiva_update on public.curso_pizarron_posts;
drop policy if exists pizarron_posts_directiva_update on public.curso_pizarron_posts;
create policy pizarron_posts_directiva_update
on public.curso_pizarron_posts
for update to authenticated
using ((select private.has_course_role(curso_id,array['presidente','tesorero']::text[])))
with check ((select private.has_course_role(curso_id,array['presidente','tesorero']::text[])));

drop policy if exists pizarron_posts_owner_directiva_delete on public.curso_pizarron_posts;
drop policy if exists pizarron_posts_directiva_delete on public.curso_pizarron_posts;
create policy pizarron_posts_directiva_delete
on public.curso_pizarron_posts
for delete to authenticated
using ((select private.has_course_role(curso_id,array['presidente','tesorero']::text[])));
