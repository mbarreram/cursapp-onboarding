-- MiCursoX: staging migration for grouped Webpay orders. DO NOT deploy before edge integration tests.
CREATE TABLE IF NOT EXISTS public.transbank_transaction_items (
  transaction_id uuid NOT NULL REFERENCES public.transbank_transactions(id) ON DELETE RESTRICT,
  pago_id uuid NOT NULL REFERENCES public.pagos(id) ON DELETE RESTRICT,
  curso_id uuid NOT NULL REFERENCES public.cursos(id),
  miembro_id uuid NOT NULL REFERENCES public.miembros_curso(id),
  monto_cuota numeric NOT NULL CHECK (monto_cuota > 0),
  comision_transbank numeric NOT NULL DEFAULT 0 CHECK (comision_transbank >= 0),
  comision_micursox numeric NOT NULL DEFAULT 0 CHECK (comision_micursox >= 0),
  monto_total_cobrado numeric NOT NULL CHECK (monto_total_cobrado > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (transaction_id,pago_id)
);
CREATE INDEX IF NOT EXISTS transbank_items_pago_idx ON public.transbank_transaction_items(pago_id);
ALTER TABLE public.transbank_transaction_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.transbank_transaction_items FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.transbank_transaction_items TO service_role;

-- Every reservation and settlement procedure must be invoked server-side with the
-- Supabase service-role client. No authenticated-user or anon EXECUTE grant.
CREATE OR REPLACE FUNCTION public.mx_webpay_reserve_group(
 p_user_id uuid, p_pago_ids uuid[], p_buy_order text, p_session_id text, p_environment text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path=pg_catalog,public AS $$
DECLARE rowp record; first_course uuid; first_member uuid; total numeric:=0;
 count_requested int; tx uuid; component numeric; fee_tb numeric; fee_mx numeric; total_line numeric;
BEGIN
 IF p_user_id IS NULL OR p_pago_ids IS NULL OR array_length(p_pago_ids,1) IS NULL THEN RAISE EXCEPTION 'invalid_request'; END IF;
 count_requested := array_length(p_pago_ids,1);
 IF count_requested<2 OR count_requested>20 OR (SELECT count(DISTINCT i) FROM unnest(p_pago_ids) i)<>count_requested THEN RAISE EXCEPTION 'invalid_selection'; END IF;
 -- Acquire stable locks for the entire selection; all validation and writes occur in one transaction.
 FOR rowp IN SELECT p.*,m.usuario_id,m.estado AS miembro_estado FROM public.pagos p
 JOIN public.miembros_curso m ON m.id=p.miembro_id
 WHERE p.id=ANY(p_pago_ids) ORDER BY p.id FOR UPDATE OF p LOOP
  IF rowp.usuario_id IS DISTINCT FROM p_user_id OR rowp.miembro_estado IS DISTINCT FROM 'aprobado' THEN RAISE EXCEPTION 'unauthorized_payment'; END IF;
  IF rowp.estado NOT IN ('pendiente','pending') OR coalesce(rowp.monto_pagado,0)<>0 THEN RAISE EXCEPTION 'payment_not_available'; END IF;
  IF first_course IS NULL THEN first_course:=rowp.curso_id; first_member:=rowp.miembro_id; END IF;
  IF rowp.curso_id<>first_course OR rowp.miembro_id<>first_member THEN RAISE EXCEPTION 'mixed_students_or_courses'; END IF;
  IF EXISTS(SELECT 1 FROM public.transbank_transactions t WHERE t.pago_id=rowp.id AND t.status IN ('CREATING','INITIALIZED','COMMITTING','COMMIT_ERROR'))
   OR EXISTS(SELECT 1 FROM public.transbank_transaction_items i JOIN public.transbank_transactions t ON t.id=i.transaction_id
      WHERE i.pago_id=rowp.id AND t.status IN ('CREATING','INITIALIZED','COMMITTING','COMMIT_ERROR')) THEN RAISE EXCEPTION 'active_payment_attempt'; END IF;
 END LOOP;
 IF (SELECT count(*) FROM public.pagos WHERE id=ANY(p_pago_ids))<>count_requested THEN RAISE EXCEPTION 'missing_payment'; END IF;
 INSERT INTO public.transbank_transactions(pago_id,curso_id,user_id,environment,buy_order,session_id,amount,status)
 VALUES (p_pago_ids[1],first_course,p_user_id,p_environment,p_buy_order,p_session_id,1,'CREATING') RETURNING id INTO tx;
 FOR rowp IN SELECT * FROM public.pagos WHERE id=ANY(p_pago_ids) ORDER BY id LOOP
  component:=coalesce(rowp.monto_cuota,rowp.monto);
  fee_tb:=round(coalesce(rowp.comision_transbank,component*coalesce(rowp.tasa_transbank,1.79)/100));
  fee_mx:=round(coalesce(rowp.comision_micursox,component*coalesce(rowp.tasa_micursox,2.25)/100));
  total_line:=round(coalesce(rowp.monto_total_cobrado,component+fee_tb+fee_mx));
  IF component<=0 OR total_line<=0 OR fee_tb<0 OR fee_mx<0 THEN RAISE EXCEPTION 'invalid_server_amount'; END IF;
  INSERT INTO public.transbank_transaction_items(transaction_id,pago_id,curso_id,miembro_id,monto_cuota,comision_transbank,comision_micursox,monto_total_cobrado)
  VALUES(tx,rowp.id,rowp.curso_id,rowp.miembro_id,component,fee_tb,fee_mx,total_line);
  total:=total+total_line;
 END LOOP;
 UPDATE public.transbank_transactions SET amount=total WHERE id=tx;
 RETURN jsonb_build_object('transaction_id',tx,'amount',total,'count',count_requested,'curso_id',first_course,'miembro_id',first_member);
END $$;
REVOKE ALL ON FUNCTION public.mx_webpay_reserve_group(uuid,uuid[],text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mx_webpay_reserve_group(uuid,uuid[],text,text,text) TO service_role;
