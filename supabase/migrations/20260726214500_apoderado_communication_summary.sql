create or replace function public.get_my_communication_summary(p_days integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with params as (
    select auth.uid() as uid,
      now() - make_interval(days => greatest(1, least(coalesce(p_days,30),365))) as since_at
  ), counts as (
    select lower(q.channel) as channel, count(*)::integer as total
    from public.notification_queue q, params p
    where p.uid is not null
      and q.user_id = p.uid
      and coalesce(q.sent_at,q.created_at) >= p.since_at
      and lower(coalesce(q.push_status,'')) in ('sent','delivered')
    group by lower(q.channel)
  )
  select jsonb_build_object(
    'days', greatest(1, least(coalesce(p_days,30),365)),
    'push', coalesce((select total from counts where channel='push'),0),
    'email', coalesce((select total from counts where channel='email'),0),
    'sms', coalesce((select total from counts where channel='sms'),0)
  );
$$;
revoke all on function public.get_my_communication_summary(integer) from public, anon;
grant execute on function public.get_my_communication_summary(integer) to authenticated;
