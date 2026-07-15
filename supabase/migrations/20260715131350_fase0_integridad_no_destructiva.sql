-- Cursapp Fase 0A
-- Cambios aditivos y no destructivos. La deduplicación de pagos y su índice
-- único se ejecutarán en una migración separada después de aprobación expresa.

create index if not exists idx_pagos_campana_miembro_periodo
  on public.pagos (campana_id, miembro_id, periodo);

create unique index if not exists uq_miembros_curso_identidad_rol_alumno
  on public.miembros_curso (
    curso_id,
    lower(coalesce(email, '')),
    rol,
    lower(coalesce(nombre_alumno, ''))
  );

-- Índices para las rutas más consultadas por los dashboards.
create index if not exists idx_campanas_curso on public.campanas (curso_id);
create index if not exists idx_pagos_curso on public.pagos (curso_id);
create index if not exists idx_pagos_campana on public.pagos (campana_id);
create index if not exists idx_pagos_miembro on public.pagos (miembro_id);
create index if not exists idx_miembros_curso on public.miembros_curso (curso_id);
create index if not exists idx_miembros_usuario on public.miembros_curso (usuario_id);
create index if not exists idx_avisos_curso_legacy on public.avisos (curso_id);
create index if not exists idx_gastos_curso on public.gastos (curso_id);
create index if not exists idx_gastos_campana on public.gastos (campana_id);
create index if not exists idx_rendiciones_curso on public.rendiciones (curso_id);
create index if not exists idx_informes_curso on public.informes (curso_id);

-- Relaciones financieras que faltaban en el modelo.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'gastos_curso_id_fkey') then
    alter table public.gastos add constraint gastos_curso_id_fkey
      foreign key (curso_id) references public.cursos(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'gastos_campana_id_fkey') then
    alter table public.gastos add constraint gastos_campana_id_fkey
      foreign key (campana_id) references public.campanas(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rendiciones_curso_id_fkey') then
    alter table public.rendiciones add constraint rendiciones_curso_id_fkey
      foreign key (curso_id) references public.cursos(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rendiciones_campana_id_fkey') then
    alter table public.rendiciones add constraint rendiciones_campana_id_fkey
      foreign key (campana_id) references public.campanas(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'informes_curso_id_fkey') then
    alter table public.informes add constraint informes_curso_id_fkey
      foreign key (curso_id) references public.cursos(id) on delete cascade;
  end if;
end $$;

-- Reglas básicas compatibles con los estados usados actualmente por la app.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'campanas_tipo_check') then
    alter table public.campanas add constraint campanas_tipo_check
      check (tipo in ('single', 'monthly')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'campanas_estado_check') then
    alter table public.campanas add constraint campanas_estado_check
      check (estado in ('activa', 'cerrada', 'cancelada', 'eliminada')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'miembros_curso_rol_check') then
    alter table public.miembros_curso add constraint miembros_curso_rol_check
      check (rol in ('presidente', 'tesorero', 'apoderado', 'agente', 'admin')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'miembros_curso_estado_check') then
    alter table public.miembros_curso add constraint miembros_curso_estado_check
      check (estado in ('pendiente', 'aprobado', 'rechazado', 'inactivo')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pagos_estado_check') then
    alter table public.pagos add constraint pagos_estado_check
      check (estado in ('pendiente', 'vencido', 'parcial', 'pagado', 'conciliado', 'no_participa', 'anulado')) not valid;
  end if;
end $$;

alter table public.campanas validate constraint campanas_tipo_check;
alter table public.campanas validate constraint campanas_estado_check;
alter table public.miembros_curso validate constraint miembros_curso_rol_check;
alter table public.miembros_curso validate constraint miembros_curso_estado_check;
alter table public.pagos validate constraint pagos_estado_check;
