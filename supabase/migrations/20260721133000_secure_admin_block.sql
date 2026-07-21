-- Bloque 1: seguridad Admin, tickets, alertas y banners.
-- Esta migración refleja los cambios aplicados en cursapp-prod.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid() and active = true
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

alter table public.tickets
  add column if not exists folio text,
  add column if not exists categoria text not null default 'otro',
  add column if not exists solicitante_nombre text,
  add column if not exists solicitante_email text,
  add column if not exists colegio_nombre text,
  add column if not exists curso_nombre text,
  add column if not exists sla_due_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists closed_at timestamptz,
  add column if not exists assigned_admin_id uuid references auth.users(id);

create table if not exists public.ticket_responses (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  author_role text not null,
  body text not null,
  internal_note boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.ticket_responses enable row level security;

create table if not exists public.global_alerts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  severity text not null default 'info',
  audience text not null default 'all',
  active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.global_alerts enable row level security;

create table if not exists public.admin_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text,
  image_url text,
  target_url text,
  audience text not null default 'all',
  placement text not null default 'dashboard',
  active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  priority integer not null default 0,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.admin_banners enable row level security;
