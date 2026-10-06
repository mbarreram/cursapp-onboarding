-- MiCursoX · Pizarrón del curso V1
-- Esquema productivo aplicado en Supabase mediante las migraciones remotas
-- curso_pizarron_v1 y curso_pizarron_v1_indexes.

create table if not exists public.curso_pizarron_posts (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references public.colegios(id) on delete cascade,
  curso_id uuid not null references public.cursos(id) on delete cascade,
  autor_usuario_id uuid not null default auth.uid(),
  autor_miembro_id uuid null references public.miembros_curso(id) on delete set null,
  autor_nombre text null,
  autor_rol text not null default 'apoderado',
  categoria text not null check (categoria in ('prueba','materiales','tarea','horario','actividad','reunion','otro')),
  titulo text not null check (char_length(trim(titulo)) between 1 and 120),
  descripcion text null,
  fecha_evento date not null,
  hora_evento time null,
  recordatorio_dia_anterior boolean not null default false,
  recordatorio_mismo_dia boolean not null default false,
  importante boolean not null default false,
  fijado boolean not null default false,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.curso_pizarron_colaboraciones (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.curso_pizarron_posts(id) on delete cascade,
  colegio_id uuid not null references public.colegios(id) on delete cascade,
  curso_id uuid not null references public.cursos(id) on delete cascade,
  item_nombre text not null check (char_length(trim(item_nombre)) between 1 and 100),
  asignado_usuario_id uuid null,
  asignado_miembro_id uuid null references public.miembros_curso(id) on delete set null,
  asignado_nombre text null,
  estado text not null default 'disponible' check (estado in ('disponible','asignado','completado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_curso_pizarron_posts_curso_fecha on public.curso_pizarron_posts(curso_id,fecha_evento,created_at desc);
create index if not exists idx_curso_pizarron_posts_colegio_curso on public.curso_pizarron_posts(colegio_id,curso_id);
create index if not exists idx_curso_pizarron_posts_autor on public.curso_pizarron_posts(autor_usuario_id);
create index if not exists idx_curso_pizarron_posts_autor_miembro on public.curso_pizarron_posts(autor_miembro_id);
create index if not exists idx_curso_pizarron_colab_post on public.curso_pizarron_colaboraciones(post_id);
create index if not exists idx_curso_pizarron_colab_curso on public.curso_pizarron_colaboraciones(curso_id,estado);
create index if not exists idx_curso_pizarron_colab_colegio on public.curso_pizarron_colaboraciones(colegio_id);
create index if not exists idx_curso_pizarron_colab_asignado_miembro on public.curso_pizarron_colaboraciones(asignado_miembro_id);

create or replace function private.pizarron_sync_scope()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_colegio uuid;
begin
  select c.colegio_id into v_colegio from public.cursos c where c.id=new.curso_id;
  if v_colegio is null then raise exception 'Curso inválido para Pizarrón'; end if;
  new.colegio_id:=v_colegio; new.updated_at:=now(); return new;
end $$;
revoke all on function private.pizarron_sync_scope() from public,anon,authenticated;
drop trigger if exists curso_pizarron_posts_sync_scope on public.curso_pizarron_posts;
create trigger curso_pizarron_posts_sync_scope before insert or update on public.curso_pizarron_posts
for each row execute function private.pizarron_sync_scope();

create or replace function private.pizarron_colab_sync_scope()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_curso uuid; v_colegio uuid;
begin
  select p.curso_id,p.colegio_id into v_curso,v_colegio from public.curso_pizarron_posts p where p.id=new.post_id;
  if v_curso is null then raise exception 'Publicación inválida para colaboración'; end if;
  new.curso_id:=v_curso; new.colegio_id:=v_colegio; new.updated_at:=now(); return new;
end $$;
revoke all on function private.pizarron_colab_sync_scope() from public,anon,authenticated;
drop trigger if exists curso_pizarron_colab_sync_scope on public.curso_pizarron_colaboraciones;
create trigger curso_pizarron_colab_sync_scope before insert or update on public.curso_pizarron_colaboraciones
for each row execute function private.pizarron_colab_sync_scope();

alter table public.curso_pizarron_posts enable row level security;
alter table public.curso_pizarron_colaboraciones enable row level security;
revoke all on public.curso_pizarron_posts from anon;
revoke all on public.curso_pizarron_colaboraciones from anon;
grant select,insert,update,delete on public.curso_pizarron_posts to authenticated;
grant select,insert,delete on public.curso_pizarron_colaboraciones to authenticated;

drop policy if exists pizarron_posts_member_select on public.curso_pizarron_posts;
create policy pizarron_posts_member_select on public.curso_pizarron_posts
for select to authenticated using ((select private.is_course_member(curso_id)));

drop policy if exists pizarron_posts_member_insert on public.curso_pizarron_posts;
create policy pizarron_posts_member_insert on public.curso_pizarron_posts
for insert to authenticated with check (
  autor_usuario_id=(select auth.uid()) and (select private.is_course_member(curso_id))
);

drop policy if exists pizarron_posts_owner_directiva_update on public.curso_pizarron_posts;
create policy pizarron_posts_owner_directiva_update on public.curso_pizarron_posts
for update to authenticated
using (autor_usuario_id=(select auth.uid()) or (select private.has_course_role(curso_id,array['presidente','tesorero']::text[])))
with check (autor_usuario_id=(select auth.uid()) or (select private.has_course_role(curso_id,array['presidente','tesorero']::text[])));

drop policy if exists pizarron_posts_owner_directiva_delete on public.curso_pizarron_posts;
create policy pizarron_posts_owner_directiva_delete on public.curso_pizarron_posts
for delete to authenticated
using (autor_usuario_id=(select auth.uid()) or (select private.has_course_role(curso_id,array['presidente','tesorero']::text[])));

drop policy if exists pizarron_colab_member_select on public.curso_pizarron_colaboraciones;
create policy pizarron_colab_member_select on public.curso_pizarron_colaboraciones
for select to authenticated using ((select private.is_course_member(curso_id)));

drop policy if exists pizarron_colab_author_directiva_insert on public.curso_pizarron_colaboraciones;
create policy pizarron_colab_author_directiva_insert on public.curso_pizarron_colaboraciones
for insert to authenticated with check (
  exists(select 1 from public.curso_pizarron_posts p where p.id=post_id
    and (p.autor_usuario_id=(select auth.uid()) or (select private.has_course_role(p.curso_id,array['presidente','tesorero']::text[]))))
);

drop policy if exists pizarron_colab_author_directiva_delete on public.curso_pizarron_colaboraciones;
create policy pizarron_colab_author_directiva_delete on public.curso_pizarron_colaboraciones
for delete to authenticated using (
  exists(select 1 from public.curso_pizarron_posts p where p.id=post_id
    and (p.autor_usuario_id=(select auth.uid()) or (select private.has_course_role(p.curso_id,array['presidente','tesorero']::text[]))))
);

create or replace function public.claim_pizarron_colaboracion(p_item_id uuid)
returns public.curso_pizarron_colaboraciones language plpgsql security definer set search_path=''
as $$
declare v_item public.curso_pizarron_colaboraciones; v_member public.miembros_curso;
begin
  select * into v_item from public.curso_pizarron_colaboraciones where id=p_item_id for update;
  if v_item.id is null then raise exception 'Colaboración no encontrada'; end if;
  if not private.is_course_member(v_item.curso_id) then raise exception 'No perteneces a este curso'; end if;
  if v_item.estado<>'disponible' or v_item.asignado_usuario_id is not null then raise exception 'Esta colaboración ya fue tomada'; end if;
  select * into v_member from public.miembros_curso
   where curso_id=v_item.curso_id and usuario_id=auth.uid()
     and lower(coalesce(estado,'aprobado')) not in ('rechazado','rejected','inactivo','inactive','eliminado','deleted')
   order by case when rol='apoderado' then 0 else 1 end,created_at limit 1;
  update public.curso_pizarron_colaboraciones
    set asignado_usuario_id=auth.uid(),asignado_miembro_id=v_member.id,
        asignado_nombre=coalesce(nullif(trim(v_member.nombre_apoderado),''),nullif(trim(v_member.email),''),'Apoderado'),
        estado='asignado',updated_at=now()
  where id=p_item_id returning * into v_item;
  return v_item;
end $$;
revoke all on function public.claim_pizarron_colaboracion(uuid) from public,anon;
grant execute on function public.claim_pizarron_colaboracion(uuid) to authenticated;

create or replace function public.release_pizarron_colaboracion(p_item_id uuid)
returns public.curso_pizarron_colaboraciones language plpgsql security definer set search_path=''
as $$
declare v_item public.curso_pizarron_colaboraciones;
begin
  select * into v_item from public.curso_pizarron_colaboraciones where id=p_item_id for update;
  if v_item.id is null then raise exception 'Colaboración no encontrada'; end if;
  if v_item.asignado_usuario_id<>auth.uid()
     and not private.has_course_role(v_item.curso_id,array['presidente','tesorero']::text[]) then
    raise exception 'No puedes liberar esta colaboración';
  end if;
  update public.curso_pizarron_colaboraciones
     set asignado_usuario_id=null,asignado_miembro_id=null,asignado_nombre=null,estado='disponible',updated_at=now()
   where id=p_item_id returning * into v_item;
  return v_item;
end $$;
revoke all on function public.release_pizarron_colaboracion(uuid) from public,anon;
grant execute on function public.release_pizarron_colaboracion(uuid) to authenticated;

create or replace function private.notify_pizarron_new_post()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  insert into public.notifications(user_id,curso_id,rol_destino,category,title,message,url_destino,payload,delivery_state)
  select m.usuario_id,new.curso_id,m.rol,'pizarron','Nueva publicación en el Pizarrón',
         new.titulo||case when new.fecha_evento is not null then ' · '||to_char(new.fecha_evento,'DD/MM/YYYY') else '' end,
         '/pizarron.html?post='||new.id::text,
         jsonb_build_object('post_id',new.id,'categoria',new.categoria),'created'
  from public.miembros_curso m
  where m.curso_id=new.curso_id and m.usuario_id is not null and m.usuario_id<>new.autor_usuario_id
    and lower(coalesce(m.estado,'aprobado')) not in ('rechazado','rejected','inactivo','inactive','eliminado','deleted');
  return new;
end $$;
revoke all on function private.notify_pizarron_new_post() from public,anon,authenticated;
drop trigger if exists curso_pizarron_notify_insert on public.curso_pizarron_posts;
create trigger curso_pizarron_notify_insert after insert on public.curso_pizarron_posts
for each row execute function private.notify_pizarron_new_post();
