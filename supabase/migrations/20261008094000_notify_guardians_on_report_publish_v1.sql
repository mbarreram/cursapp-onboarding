create or replace function private.notify_course_report_published()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_should_notify boolean := false;
begin
  if new.publicado is not true then return new; end if;

  if tg_op = 'INSERT' then
    v_should_notify := true;
  elsif old.publicado is distinct from new.publicado
     or old.publicado_at is distinct from new.publicado_at
     or old.contenido is distinct from new.contenido then
    v_should_notify := true;
  end if;

  if not v_should_notify then return new; end if;

  insert into public.notifications(
    user_id,curso_id,rol_destino,category,title,message,url_destino,payload,delivery_state
  )
  select distinct on (m.usuario_id)
    m.usuario_id,new.curso_id,'apoderado','informe',
    'Nuevo informe del curso disponible',
    'La directiva publicó o actualizó el informe del período '||coalesce(new.periodo,'actual')||'.',
    '/apoderado.html#informes',
    jsonb_build_object('report_id',new.id,'periodo',new.periodo,'publicado_at',new.publicado_at),
    'created'
  from public.miembros_curso m
  where m.curso_id=new.curso_id
    and m.usuario_id is not null
    and lower(coalesce(m.rol,''))='apoderado'
    and lower(coalesce(m.estado,'aprobado')) not in ('rechazado','rejected','inactivo','inactive','eliminado','deleted')
  order by m.usuario_id,m.id;

  return new;
end;
$$;

revoke all on function private.notify_course_report_published() from public,anon,authenticated;

drop trigger if exists informes_notify_published on public.informes;
create trigger informes_notify_published
after insert or update on public.informes
for each row execute function private.notify_course_report_published();
