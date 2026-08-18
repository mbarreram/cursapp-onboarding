create table if not exists public.transbank_transactions (
  id uuid primary key default gen_random_uuid(),
  pago_id uuid not null references public.pagos(id) on delete cascade,
  curso_id uuid references public.cursos(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  environment text not null default 'integration',
  buy_order text not null,
  session_id text not null,
  token_ws text,
  amount numeric not null check (amount > 0),
  status text not null default 'CREATED',
  response_code integer,
  authorization_code text,
  payment_type_code text,
  installments_number integer,
  card_number text,
  accounting_date text,
  transaction_date timestamptz,
  vci text,
  transbank_status text,
  raw_response jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  committed_at timestamptz
);

create unique index if not exists transbank_transactions_buy_order_uidx on public.transbank_transactions(buy_order);
create unique index if not exists transbank_transactions_token_ws_uidx on public.transbank_transactions(token_ws) where token_ws is not null;
create index if not exists transbank_transactions_pago_idx on public.transbank_transactions(pago_id, created_at desc);
create index if not exists transbank_transactions_user_idx on public.transbank_transactions(user_id, created_at desc);

alter table public.transbank_transactions enable row level security;
revoke all on table public.transbank_transactions from anon, authenticated;
grant select, insert, update, delete on table public.transbank_transactions to service_role;

create or replace function public.touch_transbank_transaction_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_transbank_transaction_updated_at on public.transbank_transactions;
create trigger trg_touch_transbank_transaction_updated_at
before update on public.transbank_transactions
for each row execute function public.touch_transbank_transaction_updated_at();

comment on table public.transbank_transactions is 'Server-side Webpay Plus transaction ledger. No direct client access; use Edge Functions.';
