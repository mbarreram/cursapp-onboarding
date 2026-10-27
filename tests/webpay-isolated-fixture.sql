-- Synthetic isolated schema; no Supabase credentials or pilot records.
CREATE SCHEMA auth;
CREATE ROLE service_role NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role',true) $$;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE public.cursos(id uuid PRIMARY KEY);
CREATE TABLE public.miembros_curso(id uuid PRIMARY KEY, curso_id uuid, usuario_id uuid, estado text);
CREATE TABLE public.campanas(id uuid PRIMARY KEY);
CREATE TABLE public.pagos(id uuid PRIMARY KEY, curso_id uuid, campana_id uuid, miembro_id uuid, monto numeric, monto_pagado numeric DEFAULT 0, estado text, monto_cuota numeric, tasa_transbank numeric, tasa_micursox numeric, comision_transbank numeric, comision_micursox numeric, monto_total_cobrado numeric, metodo_pago text, canal_recaudacion text, paid_at timestamptz, conciliacion_estado text, liquidacion_estado text, periodo text);
CREATE TABLE public.transbank_transactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pago_id uuid, curso_id uuid, user_id uuid, environment text, buy_order text, session_id text, amount numeric, status text, committed_at timestamptz, updated_at timestamptz, error_message text, raw_response jsonb);
CREATE TABLE public.transbank_refunds(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),transaction_id uuid,pago_id uuid,curso_id uuid,amount numeric,status text,gateway_type text,gateway_response jsonb,completed_at timestamptz);
CREATE TABLE public.notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,curso_id uuid,rol_destino text,category text,title text,message text,url_destino text,payload jsonb,is_read boolean,delivery_state text);
