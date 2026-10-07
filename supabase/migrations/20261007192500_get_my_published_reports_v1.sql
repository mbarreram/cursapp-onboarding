create or replace function public.get_my_published_reports(
  p_curso_id uuid
)
returns setof public.informes
language sql
security definer
set search_path = ''
as $$
  select i.*
  from public.informes i
  where i.curso_id = p_curso_id
    and i.publicado = true
    and private.is_course_member(p_curso_id)
  order by i.publicado_at desc nulls last, i.actualizado_at desc nulls last, i.created_at desc;
$$;

revoke all on function public.get_my_published_reports(uuid) from public, anon;
grant execute on function public.get_my_published_reports(uuid) to authenticated;
