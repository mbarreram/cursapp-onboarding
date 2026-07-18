-- Tesorería productiva: gastos, rendiciones, informes y comprobantes privados.

alter table public.gastos
  add column if not exists categoria text,
  add column if not exists proveedor text,
  add column if not exists estado text not null default 'pendiente_aprobacion',
  add column if not exists actualizado_at timestamptz not null default now(),
  add column if not exists aprobado_por uuid references auth.users(id),
  add column if not exists aprobado_at timestamptz,
  add column if not exists observacion_aprobacion text,
  add column if not exists comprobante_nombre text,
  add column if not exists comprobante_tipo text,
  add column if not exists comprobante_tamano bigint,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.rendiciones
  add column if not exists gasto_id uuid references public.gastos(id) on delete cascade,
  add column if not exists estado text not null default 'pendiente_aprobacion',
  add column if not exists solicitado_por uuid references auth.users(id),
  add column if not exists revisado_por uuid references auth.users(id),
  add column if not exists observacion text,
  add column if not exists historial jsonb not null default '[]'::jsonb,
  add column if not exists actualizado_at timestamptz not null default now();

alter table public.informes
  add column if not exists campana_id uuid references public.campanas(id) on delete set null,
  add column if not exists periodo text,
  add column if not exists estado text not null default 'borrador',
  add column if not exists actualizado_at timestamptz not null default now(),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists rendiciones_gasto_uidx
  on public.rendiciones(gasto_id) where gasto_id is not null;
create index if not exists gastos_curso_fecha_idx on public.gastos(curso_id, fecha_gasto desc);
create index if not exists rendiciones_curso_estado_idx on public.rendiciones(curso_id, estado);
create index if not exists informes_curso_periodo_idx on public.informes(curso_id, periodo, actualizado_at desc);

alter table public.gastos drop constraint if exists gastos_estado_check;
alter table public.gastos add constraint gastos_estado_check
  check (estado in ('pendiente_aprobacion','aprobada','observada','rechazada'));
alter table public.rendiciones drop constraint if exists rendiciones_estado_check;
alter table public.rendiciones add constraint rendiciones_estado_check
  check (estado in ('pendiente_aprobacion','aprobada','observada','rechazada'));
alter table public.informes drop constraint if exists informes_estado_check;
alter table public.informes add constraint informes_estado_check
  check (estado in ('borrador','publicado','despublicado'));

drop policy if exists dev_all_gastos on public.gastos;
drop policy if exists gastos_directiva_select on public.gastos;
drop policy if exists gastos_directiva_insert on public.gastos;
drop policy if exists gastos_directiva_update on public.gastos;
drop policy if exists gastos_directiva_delete on public.gastos;
create policy gastos_directiva_select on public.gastos for select to authenticated
  using ((select private.has_course_role(curso_id, array['presidente','tesorero'])));
create policy gastos_directiva_insert on public.gastos for insert to authenticated
  with check ((select private.has_course_role(curso_id, array['presidente','tesorero'])) and creado_por = (select auth.uid()));
create policy gastos_directiva_update on public.gastos for update to authenticated
  using ((select private.has_course_role(curso_id, array['presidente','tesorero'])))
  with check ((select private.has_course_role(curso_id, array['presidente','tesorero'])));
create policy gastos_directiva_delete on public.gastos for delete to authenticated
  using ((select private.has_course_role(curso_id, array['presidente','tesorero'])));

drop policy if exists dev_all_rendiciones on public.rendiciones;
drop policy if exists rendiciones_directiva_select on public.rendiciones;
drop policy if exists rendiciones_directiva_insert on public.rendiciones;
drop policy if exists rendiciones_directiva_update on public.rendiciones;
drop policy if exists rendiciones_directiva_delete on public.rendiciones;
create policy rendiciones_directiva_select on public.rendiciones for select to authenticated
  using ((select private.has_course_role(curso_id, array['presidente','tesorero'])));
create policy rendiciones_directiva_insert on public.rendiciones for insert to authenticated
  with check ((select private.has_course_role(curso_id, array['presidente','tesorero'])) and solicitado_por = (select auth.uid()));
create policy rendiciones_directiva_update on public.rendiciones for update to authenticated
  using ((select private.has_course_role(curso_id, array['presidente','tesorero'])))
  with check ((select private.has_course_role(curso_id, array['presidente','tesorero'])));
create policy rendiciones_directiva_delete on public.rendiciones for delete to authenticated
  using ((select private.has_course_role(curso_id, array['presidente','tesorero'])));

drop policy if exists dev_all_informes on public.informes;
drop policy if exists informes_miembro_select on public.informes;
drop policy if exists informes_directiva_insert on public.informes;
drop policy if exists informes_directiva_update on public.informes;
drop policy if exists informes_directiva_delete on public.informes;
create policy informes_miembro_select on public.informes for select to authenticated
  using (
    (publicado and (select private.is_course_member(curso_id)))
    or (select private.has_course_role(curso_id, array['presidente','tesorero']))
  );
create policy informes_directiva_insert on public.informes for insert to authenticated
  with check ((select private.has_course_role(curso_id, array['presidente','tesorero'])) and creado_por = (select auth.uid()));
create policy informes_directiva_update on public.informes for update to authenticated
  using ((select private.has_course_role(curso_id, array['presidente','tesorero'])))
  with check ((select private.has_course_role(curso_id, array['presidente','tesorero'])));
create policy informes_directiva_delete on public.informes for delete to authenticated
  using ((select private.has_course_role(curso_id, array['presidente','tesorero'])));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprobantes-rendiciones',
  'comprobantes-rendiciones',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists comprobantes_rendiciones_select on storage.objects;
drop policy if exists comprobantes_rendiciones_insert on storage.objects;
drop policy if exists comprobantes_rendiciones_update on storage.objects;
drop policy if exists comprobantes_rendiciones_delete on storage.objects;
create policy comprobantes_rendiciones_select on storage.objects for select to authenticated
  using (
    bucket_id = 'comprobantes-rendiciones'
    and exists (
      select 1 from public.cursos c
      where c.id::text = (storage.foldername(name))[1]
        and private.has_course_role(c.id, array['presidente','tesorero'])
    )
  );
create policy comprobantes_rendiciones_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'comprobantes-rendiciones'
    and exists (
      select 1 from public.cursos c
      where c.id::text = (storage.foldername(name))[1]
        and private.has_course_role(c.id, array['presidente','tesorero'])
    )
  );
create policy comprobantes_rendiciones_update on storage.objects for update to authenticated
  using (
    bucket_id = 'comprobantes-rendiciones'
    and exists (
      select 1 from public.cursos c
      where c.id::text = (storage.foldername(name))[1]
        and private.has_course_role(c.id, array['presidente','tesorero'])
    )
  );
create policy comprobantes_rendiciones_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'comprobantes-rendiciones'
    and exists (
      select 1 from public.cursos c
      where c.id::text = (storage.foldername(name))[1]
        and private.has_course_role(c.id, array['presidente','tesorero'])
    )
  );

grant select, insert, update, delete on public.gastos to authenticated;
grant select, insert, update, delete on public.rendiciones to authenticated;
grant select, insert, update, delete on public.informes to authenticated;
