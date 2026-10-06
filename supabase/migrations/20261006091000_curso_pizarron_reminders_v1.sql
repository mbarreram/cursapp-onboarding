-- MiCursoX · recordatorios automáticos Pizarrón V1
alter table public.curso_pizarron_posts
  add column if not exists reminder_day_before_sent_at timestamptz null,
  add column if not exists reminder_same_day_sent_at timestamptz null;

create or replace function public.process_pizarron_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Santiago')::date;
  v_hour integer := extract(hour from (now() at time zone 'America/Santiago'));
  v_post record;
  v_count integer := 0;
begin
  for v_post in
    select p.*
    from public.curso_pizarron_posts p
    where p.activo = true
      and (
        (p.recordatorio_dia_anterior = true and p.reminder_day_before_sent_at is null and p.fecha_evento = v_today + 1 and v_hour >= 19)
        or
        (p.recordatorio_mismo_dia = true and p.reminder_same_day_sent_at is null and p.fecha_evento = v_today and v_hour >= 7)
      )
    for update skip locked
  loop
    if v_post.recordatorio_dia_anterior and v_post.reminder_day_before_sent_at is null
       and v_post.fecha_evento = v_today + 1 and v_hour >= 19 then
      insert into public.notifications(user_id,curso_id,rol_destino,category,title,message,url_destino,payload,delivery_state)
      select m.usuario_id,v_post.curso_id,m.rol,'pizarron','Recordatorio del Pizarrón',
             'Mañana: '||v_post.titulo||case when v_post.hora_evento is not null then ' · '||to_char(v_post.hora_evento,'HH24:MI') else '' end,
             '/pizarron.html?post='||v_post.id::text,
             jsonb_build_object('post_id',v_post.id,'tipo_recordatorio','dia_anterior'),'created'
      from public.miembros_curso m
      where m.curso_id=v_post.curso_id and m.usuario_id is not null
        and lower(coalesce(m.estado,'aprobado')) not in ('rechazado','rejected','inactivo','inactive','eliminado','deleted');
      update public.curso_pizarron_posts set reminder_day_before_sent_at=now() where id=v_post.id;
      v_count:=v_count+1;
    end if;

    if v_post.recordatorio_mismo_dia and v_post.reminder_same_day_sent_at is null
       and v_post.fecha_evento = v_today and v_hour >= 7 then
      insert into public.notifications(user_id,curso_id,rol_destino,category,title,message,url_destino,payload,delivery_state)
      select m.usuario_id,v_post.curso_id,m.rol,'pizarron','Recordatorio del Pizarrón',
             'Hoy: '||v_post.titulo||case when v_post.hora_evento is not null then ' · '||to_char(v_post.hora_evento,'HH24:MI') else '' end,
             '/pizarron.html?post='||v_post.id::text,
             jsonb_build_object('post_id',v_post.id,'tipo_recordatorio','mismo_dia'),'created'
      from public.miembros_curso m
      where m.curso_id=v_post.curso_id and m.usuario_id is not null
        and lower(coalesce(m.estado,'aprobado')) not in ('rechazado','rejected','inactivo','inactive','eliminado','deleted');
      update public.curso_pizarron_posts set reminder_same_day_sent_at=now() where id=v_post.id;
      v_count:=v_count+1;
    end if;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.process_pizarron_reminders() from public,anon,authenticated;
create extension if not exists pg_cron;

do $$
declare v_job bigint;
begin
  select jobid into v_job from cron.job where jobname='micursox-pizarron-reminders' limit 1;
  if v_job is not null then perform cron.unschedule(v_job); end if;
  perform cron.schedule('micursox-pizarron-reminders','0 * * * *','select public.process_pizarron_reminders();');
end $$;
