create table if not exists public.privacy_rights_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  request_type text not null check (request_type in ('access','rectification','suppression','opposition','portability','blocking')),
  detail text,
  status text not null default 'received' check (status in ('received','in_review','completed','rejected','cancelled')),
  source text not null default 'profile',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  response_note text
);

create index if not exists privacy_rights_requests_user_created_idx
  on public.privacy_rights_requests(user_id, created_at desc);

alter table public.privacy_rights_requests enable row level security;

revoke all on public.privacy_rights_requests from anon;
grant select, insert on public.privacy_rights_requests to authenticated;
grant update on public.privacy_rights_requests to authenticated;

drop policy if exists privacy_rights_select_own on public.privacy_rights_requests;
create policy privacy_rights_select_own
on public.privacy_rights_requests for select to authenticated
using (user_id = auth.uid() or is_admin());

drop policy if exists privacy_rights_insert_own on public.privacy_rights_requests;
create policy privacy_rights_insert_own
on public.privacy_rights_requests for insert to authenticated
with check (
  user_id = auth.uid()
  and status = 'received'
  and source = 'profile'
);

drop policy if exists privacy_rights_admin_update on public.privacy_rights_requests;
create policy privacy_rights_admin_update
on public.privacy_rights_requests for update to authenticated
using (is_admin())
with check (is_admin());
