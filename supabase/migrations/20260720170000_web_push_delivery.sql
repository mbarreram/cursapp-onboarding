-- Web Push productivo: suscripciones por usuario y cola interna por notificación.

alter table public.push_subscriptions enable row level security;

grant select, insert, update, delete on public.push_subscriptions to authenticated;
revoke all on public.push_subscriptions from anon;

drop policy if exists "Users can view own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can insert own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can update own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can delete own push subscriptions" on public.push_subscriptions;
drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
drop policy if exists "push_subscriptions_update_own" on public.push_subscriptions;
drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
drop policy if exists "Usuarios ven sus propias suscripciones" on public.push_subscriptions;
drop policy if exists "Usuarios crean sus propias suscripciones" on public.push_subscriptions;
drop policy if exists "Usuarios actualizan sus propias suscripciones" on public.push_subscriptions;
drop policy if exists "Usuarios eliminan sus propias suscripciones" on public.push_subscriptions;

create policy "push_subscriptions_select_own"
on public.push_subscriptions for select to authenticated
using ((select auth.uid()) = user_id);

create policy "push_subscriptions_insert_own"
on public.push_subscriptions for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "push_subscriptions_update_own"
on public.push_subscriptions for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "push_subscriptions_delete_own"
on public.push_subscriptions for delete to authenticated
using ((select auth.uid()) = user_id);

drop index if exists public.idx_push_enabled;
drop index if exists public.idx_push_user;

alter table public.notification_queue enable row level security;
revoke all on public.notification_queue from anon, authenticated;

create unique index if not exists notification_queue_notification_channel_uidx
on public.notification_queue (notification_id, channel);

create schema if not exists private;

create or replace function private.enqueue_notification_push()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.user_id is null then
    return new;
  end if;

  if exists (
    select 1
    from public.push_subscriptions ps
    where ps.user_id = new.user_id
      and ps.enabled = true
  ) and coalesce((
    select bool_or(np.push_enabled)
    from public.notification_preferences np
    where np.user_id = new.user_id
      and (np.rol_destino = new.rol_destino or new.rol_destino is null)
  ), true) then
    insert into public.notification_queue
      (notification_id, user_id, channel, push_status, attempts, scheduled_at)
    values
      (new.id, new.user_id, 'push', 'pending', 0, now())
    on conflict (notification_id, channel) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function private.enqueue_notification_push() from public, anon, authenticated;

drop trigger if exists notifications_enqueue_push on public.notifications;
create trigger notifications_enqueue_push
after insert on public.notifications
for each row execute function private.enqueue_notification_push();
