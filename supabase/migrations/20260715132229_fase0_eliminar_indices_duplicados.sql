-- Cursapp Fase 0A
-- Corrección no destructiva: estos índices ya existían con sufijo `_id`.

drop index if exists public.idx_pagos_campana;
drop index if exists public.idx_pagos_curso;
drop index if exists public.idx_pagos_miembro;
