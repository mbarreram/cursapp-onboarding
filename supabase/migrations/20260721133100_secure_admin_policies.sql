drop policy if exists admin_users_self_read on public.admin_users;
create policy admin_users_self_read on public.admin_users for select to authenticated using (auth.uid() = user_id);

drop policy if exists tickets_select_secure on public.tickets;
create policy tickets_select_secure on public.tickets for select to authenticated using (public.is_admin() or usuario_id = auth.uid());
drop policy if exists tickets_insert_owner on public.tickets;
create policy tickets_insert_owner on public.tickets for insert to authenticated with check (public.is_admin() or usuario_id = auth.uid());
drop policy if exists tickets_update_secure on public.tickets;
create policy tickets_update_secure on public.tickets for update to authenticated using (public.is_admin() or usuario_id = auth.uid()) with check (public.is_admin() or usuario_id = auth.uid());
drop policy if exists tickets_delete_admin on public.tickets;
create policy tickets_delete_admin on public.tickets for delete to authenticated using (public.is_admin());

drop policy if exists ticket_responses_select_secure on public.ticket_responses;
create policy ticket_responses_select_secure on public.ticket_responses for select to authenticated using (public.is_admin() or exists (select 1 from public.tickets t where t.id=ticket_id and t.usuario_id=auth.uid()));
drop policy if exists ticket_responses_insert_secure on public.ticket_responses;
create policy ticket_responses_insert_secure on public.ticket_responses for insert to authenticated with check (author_id=auth.uid() and (public.is_admin() or exists (select 1 from public.tickets t where t.id=ticket_id and t.usuario_id=auth.uid())));
drop policy if exists ticket_responses_delete_admin on public.ticket_responses;
create policy ticket_responses_delete_admin on public.ticket_responses for delete to authenticated using (public.is_admin());

drop policy if exists global_alerts_read_active on public.global_alerts;
create policy global_alerts_read_active on public.global_alerts for select to authenticated using ((active and starts_at<=now() and (ends_at is null or ends_at>now())) or public.is_admin());
drop policy if exists global_alerts_admin_write on public.global_alerts;
create policy global_alerts_admin_write on public.global_alerts for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists admin_banners_read_active on public.admin_banners;
create policy admin_banners_read_active on public.admin_banners for select to authenticated using ((active and starts_at<=now() and (ends_at is null or ends_at>now())) or public.is_admin());
drop policy if exists admin_banners_admin_write on public.admin_banners;
create policy admin_banners_admin_write on public.admin_banners for all to authenticated using (public.is_admin()) with check (public.is_admin());
