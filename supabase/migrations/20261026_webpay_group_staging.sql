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
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'access_denied'; END IF;
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

-- Atomic settlement after the Webpay response has been verified server-side.
CREATE OR REPLACE FUNCTION public.mx_webpay_settle_group(p_transaction_id uuid, p_authorized_amount numeric, p_authorized_order text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE tx record; item record; n int:=0; expected_amount numeric;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'access_denied'; END IF;
 SELECT * INTO tx FROM public.transbank_transactions WHERE id=p_transaction_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'transaction_not_found'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.transbank_transaction_items WHERE transaction_id=tx.id) THEN RAISE EXCEPTION 'not_grouped'; END IF;
 IF tx.status='APPROVED' THEN RETURN jsonb_build_object('ok',true,'already_settled',true,'transaction_id',tx.id); END IF;
 IF tx.status NOT IN ('COMMITTING','COMMIT_ERROR') THEN RAISE EXCEPTION 'invalid_transaction_state'; END IF;
 IF tx.buy_order IS DISTINCT FROM p_authorized_order OR tx.amount IS DISTINCT FROM p_authorized_amount THEN RAISE EXCEPTION 'gateway_order_amount_mismatch'; END IF;
 SELECT count(*),sum(monto_total_cobrado) INTO n,expected_amount FROM public.transbank_transaction_items WHERE transaction_id=tx.id;
 IF n<2 OR n>20 OR expected_amount IS DISTINCT FROM tx.amount THEN RAISE EXCEPTION 'invalid_group_total'; END IF;
 FOR item IN SELECT i.*,p.estado,p.monto_pagado FROM public.transbank_transaction_items i JOIN public.pagos p ON p.id=i.pago_id
  WHERE i.transaction_id=tx.id ORDER BY i.pago_id FOR UPDATE OF p LOOP
  IF item.estado NOT IN ('pendiente','pending') OR coalesce(item.monto_pagado,0)<>0 THEN RAISE EXCEPTION 'payment_state_changed'; END IF;
 END LOOP;
 UPDATE public.pagos p SET estado='pagado',monto_pagado=i.monto_cuota,metodo_pago='transbank',canal_recaudacion='webpay_plus',
 paid_at=now() FROM public.transbank_transaction_items i WHERE i.transaction_id=tx.id AND p.id=i.pago_id;
 UPDATE public.transbank_transactions SET status='APPROVED',committed_at=now(),error_message=NULL WHERE id=tx.id;
 -- Un aviso consolidado por orden, creado en la misma transacción que los pagos.
 INSERT INTO public.notifications(user_id,curso_id,rol_destino,category,title,message,url_destino,payload,is_read,delivery_state)
 VALUES(tx.user_id,tx.curso_id,'apoderado','payment','Pago múltiple confirmado',
        'Se confirmó tu pago de '||n||' cuotas por 
 RETURN jsonb_build_object('ok',true,'transaction_id',tx.id,'items',n,'amount',expected_amount);
END $$;
REVOKE ALL ON FUNCTION public.mx_webpay_settle_group(uuid,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mx_webpay_settle_group(uuid,numeric,text) TO service_role;

-- NOTE: deploy group-aware webpay-commit and webpay-status before enabling group creation.
-- Until then this migration remains un-applied; single-payment production code stays unchanged.


-- Full-order refund finalization. Gateway refund is performed once by the Edge Function.
-- This procedure is service-role only and rolls back all associated payments atomically.
CREATE OR REPLACE FUNCTION public.mx_webpay_finalize_group_refund(p_refund_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.transbank_refunds%rowtype; t public.transbank_transactions%rowtype;
        it record; item_count integer:=0; total_items numeric:=0;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'access_denied'; END IF;
 SELECT * INTO r FROM public.transbank_refunds WHERE id=p_refund_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'refund_not_found'; END IF;
 IF r.status='COMPLETED' THEN RETURN jsonb_build_object('status','COMPLETED','idempotent',true,'refund_id',r.id); END IF;
 IF r.status<>'GATEWAY_CONFIRMED' OR r.gateway_type NOT IN ('REVERSED','NULLIFIED') THEN RAISE EXCEPTION 'gateway_not_confirmed'; END IF;
 SELECT * INTO t FROM public.transbank_transactions WHERE id=r.transaction_id FOR UPDATE;
 IF NOT FOUND OR t.status<>'APPROVED' OR r.curso_id IS DISTINCT FROM t.curso_id OR r.amount IS DISTINCT FROM t.amount THEN RAISE EXCEPTION 'transaction_mismatch'; END IF;
 IF r.gateway_type='NULLIFIED' AND (coalesce((r.gateway_response->>'nullified_amount')::numeric,-1)<>r.amount OR coalesce((r.gateway_response->>'balance')::numeric,-1)<>0) THEN RAISE EXCEPTION 'partial_refund_not_permitted'; END IF;
 IF r.gateway_type='REVERSED' AND coalesce((r.gateway_response->>'balance')::numeric,-1)<>0 THEN RAISE EXCEPTION 'remaining_refund_balance'; END IF;
 SELECT count(*),sum(monto_total_cobrado) INTO item_count,total_items FROM public.transbank_transaction_items WHERE transaction_id=t.id;
 IF item_count<2 OR item_count>20 OR total_items IS DISTINCT FROM t.amount THEN RAISE EXCEPTION 'item_total_mismatch'; END IF;
 FOR it IN SELECT i.*,p.estado,p.metodo_pago,p.monto_pagado
 FROM public.transbank_transaction_items i JOIN public.pagos p ON p.id=i.pago_id
 WHERE i.transaction_id=t.id ORDER BY i.pago_id FOR UPDATE OF p LOOP
  IF it.curso_id IS DISTINCT FROM t.curso_id OR it.estado<>'pagado' OR it.metodo_pago<>'transbank' OR it.monto_pagado IS DISTINCT FROM it.monto_cuota THEN RAISE EXCEPTION 'payment_mismatch'; END IF;
 END LOOP;
 UPDATE public.pagos p SET estado='pendiente',monto_pagado=0,metodo_pago=NULL,canal_recaudacion=NULL,paid_at=NULL,conciliacion_estado=NULL,liquidacion_estado='anulado'
 FROM public.transbank_transaction_items i WHERE i.transaction_id=t.id AND p.id=i.pago_id;
 UPDATE public.transbank_transactions SET status='REFUNDED',updated_at=now(),raw_response=coalesce(raw_response,'{}'::jsonb)||jsonb_build_object('refund',r.gateway_response) WHERE id=t.id;
 UPDATE public.transbank_refunds SET status='COMPLETED',completed_at=now() WHERE id=r.id;
 RETURN jsonb_build_object('status','COMPLETED','refund_id',r.id,'transaction_id',t.id,'payments_reverted',item_count);
END $$;
REVOKE ALL ON FUNCTION public.mx_webpay_finalize_group_refund(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mx_webpay_finalize_group_refund(uuid) TO service_role;
||trim(to_char(expected_amount,'FM999G999G999G990'))||'.',
        '/apoderado.html#payments_paid',
        jsonb_build_object('group_transaction_id',tx.id,'count',n,'amount',expected_amount,'event','approved'),false,'created')
 ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('ok',true,'transaction_id',tx.id,'items',n,'amount',expected_amount);
END $$;
REVOKE ALL ON FUNCTION public.mx_webpay_settle_group(uuid,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mx_webpay_settle_group(uuid,numeric,text) TO service_role;

-- NOTE: deploy group-aware webpay-commit and webpay-status before enabling group creation.
-- Until then this migration remains un-applied; single-payment production code stays unchanged.


-- Full-order refund finalization. Gateway refund is performed once by the Edge Function.
-- This procedure is service-role only and rolls back all associated payments atomically.
CREATE OR REPLACE FUNCTION public.mx_webpay_finalize_group_refund(p_refund_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.transbank_refunds%rowtype; t public.transbank_transactions%rowtype;
        it record; item_count integer:=0; total_items numeric:=0;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'access_denied'; END IF;
 SELECT * INTO r FROM public.transbank_refunds WHERE id=p_refund_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'refund_not_found'; END IF;
 IF r.status='COMPLETED' THEN RETURN jsonb_build_object('status','COMPLETED','idempotent',true,'refund_id',r.id); END IF;
 IF r.status<>'GATEWAY_CONFIRMED' OR r.gateway_type NOT IN ('REVERSED','NULLIFIED') THEN RAISE EXCEPTION 'gateway_not_confirmed'; END IF;
 SELECT * INTO t FROM public.transbank_transactions WHERE id=r.transaction_id FOR UPDATE;
 IF NOT FOUND OR t.status<>'APPROVED' OR r.curso_id IS DISTINCT FROM t.curso_id OR r.amount IS DISTINCT FROM t.amount THEN RAISE EXCEPTION 'transaction_mismatch'; END IF;
 IF r.gateway_type='NULLIFIED' AND (coalesce((r.gateway_response->>'nullified_amount')::numeric,-1)<>r.amount OR coalesce((r.gateway_response->>'balance')::numeric,-1)<>0) THEN RAISE EXCEPTION 'partial_refund_not_permitted'; END IF;
 IF r.gateway_type='REVERSED' AND coalesce((r.gateway_response->>'balance')::numeric,-1)<>0 THEN RAISE EXCEPTION 'remaining_refund_balance'; END IF;
 SELECT count(*),sum(monto_total_cobrado) INTO item_count,total_items FROM public.transbank_transaction_items WHERE transaction_id=t.id;
 IF item_count<2 OR item_count>20 OR total_items IS DISTINCT FROM t.amount THEN RAISE EXCEPTION 'item_total_mismatch'; END IF;
 FOR it IN SELECT i.*,p.estado,p.metodo_pago,p.monto_pagado
 FROM public.transbank_transaction_items i JOIN public.pagos p ON p.id=i.pago_id
 WHERE i.transaction_id=t.id ORDER BY i.pago_id FOR UPDATE OF p LOOP
  IF it.curso_id IS DISTINCT FROM t.curso_id OR it.estado<>'pagado' OR it.metodo_pago<>'transbank' OR it.monto_pagado IS DISTINCT FROM it.monto_cuota THEN RAISE EXCEPTION 'payment_mismatch'; END IF;
 END LOOP;
 UPDATE public.pagos p SET estado='pendiente',monto_pagado=0,metodo_pago=NULL,canal_recaudacion=NULL,paid_at=NULL,conciliacion_estado=NULL,liquidacion_estado='anulado'
 FROM public.transbank_transaction_items i WHERE i.transaction_id=t.id AND p.id=i.pago_id;
 UPDATE public.transbank_transactions SET status='REFUNDED',updated_at=now(),raw_response=coalesce(raw_response,'{}'::jsonb)||jsonb_build_object('refund',r.gateway_response) WHERE id=t.id;
 UPDATE public.transbank_refunds SET status='COMPLETED',completed_at=now() WHERE id=r.id;
 RETURN jsonb_build_object('status','COMPLETED','refund_id',r.id,'transaction_id',t.id,'payments_reverted',item_count);
END $$;
REVOKE ALL ON FUNCTION public.mx_webpay_finalize_group_refund(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mx_webpay_finalize_group_refund(uuid) TO service_role;


-- Idempotencia de aviso por orden; no duplicar por callbacks o consultas de estado.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_webpay_group_event_uidx
 ON public.notifications (((payload->>'group_transaction_id')),((payload->>'event')))
 WHERE payload ? 'group_transaction_id' AND payload ? 'event';

-- Comprobantes agrupados se reconstruyen desde esta vista de solo lectura:
-- Folio: transbank_transactions.buy_order; cada cuota mantiene su UUID y monto.
CREATE OR REPLACE VIEW public.mx_webpay_group_receipt WITH (security_invoker=true) AS
 SELECT t.id AS transaction_id,t.buy_order,t.user_id,t.curso_id,t.amount AS total_cobrado,
        t.status,t.committed_at,i.pago_id,i.miembro_id,i.monto_cuota,
        i.comision_transbank,i.comision_micursox,i.monto_total_cobrado,p.campana_id,
        p.periodo,p.paid_at
 FROM public.transbank_transactions t
 JOIN public.transbank_transaction_items i ON i.transaction_id=t.id
 JOIN public.pagos p ON p.id=i.pago_id;
REVOKE ALL ON public.mx_webpay_group_receipt FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.mx_webpay_group_receipt TO service_role;
