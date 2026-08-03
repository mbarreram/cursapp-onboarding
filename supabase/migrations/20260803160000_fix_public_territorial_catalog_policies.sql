drop policy if exists comunas_admin_write on public.comunas;
drop policy if exists regiones_admin_write on public.regiones;
drop policy if exists comunas_lectura_publica on public.comunas;
drop policy if exists regiones_lectura_publica on public.regiones;

create policy comunas_lectura_publica
on public.comunas
for select
to anon, authenticated
using (activa = true);

create policy regiones_lectura_publica
on public.regiones
for select
to anon, authenticated
using (activa = true);

create policy comunas_admin_write
on public.comunas
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy regiones_admin_write
on public.regiones
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on public.regiones, public.comunas to anon, authenticated;
