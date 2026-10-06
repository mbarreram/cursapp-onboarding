-- Reinicia el estado de envío cuando cambia fecha/hora o configuración del recordatorio.
create or replace function private.pizarron_reset_reminder_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.fecha_evento is distinct from old.fecha_evento
     or new.hora_evento is distinct from old.hora_evento
     or new.recordatorio_dia_anterior is distinct from old.recordatorio_dia_anterior then
    new.reminder_day_before_sent_at := null;
  end if;
  if new.fecha_evento is distinct from old.fecha_evento
     or new.hora_evento is distinct from old.hora_evento
     or new.recordatorio_mismo_dia is distinct from old.recordatorio_mismo_dia then
    new.reminder_same_day_sent_at := null;
  end if;
  return new;
end;
$$;

revoke all on function private.pizarron_reset_reminder_state() from public,anon,authenticated;
drop trigger if exists curso_pizarron_reset_reminder_state on public.curso_pizarron_posts;
create trigger curso_pizarron_reset_reminder_state
before update on public.curso_pizarron_posts
for each row execute function private.pizarron_reset_reminder_state();
