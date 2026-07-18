-- La tabla ya posee idx_gastos_campana; evita mantener dos indices equivalentes.
drop index if exists public.gastos_campana_idx;
