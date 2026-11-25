\set ON_ERROR_STOP on
SET request.jwt.claim.role='service_role';
INSERT INTO cursos VALUES('00000000-0000-4000-8000-000000000001');
INSERT INTO miembros_curso VALUES('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','aprobado');
INSERT INTO pagos(id,curso_id,miembro_id,monto,monto_cuota,estado,periodo) VALUES
 ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',1500,1500,'pendiente','2026-11'),
 ('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',1500,1500,'pendiente','2026-12');
SELECT public.mx_webpay_reserve_group('00000000-0000-4000-8000-000000000003',ARRAY['00000000-0000-4000-8000-000000000011'::uuid,'00000000-0000-4000-8000-000000000012'::uuid],'ORDERTEST','TEST','integration') AS reservation \gset
SELECT id AS tx_id, amount AS tx_amount FROM transbank_transactions WHERE buy_order='ORDERTEST' \gset
DO $$ BEGIN IF (SELECT count(*) FROM transbank_transaction_items WHERE transaction_id=(SELECT id FROM transbank_transactions WHERE buy_order='ORDERTEST'))<>2 THEN RAISE EXCEPTION 'Reservation items mismatch'; END IF; END $$;
UPDATE transbank_transactions SET status='COMMITTING' WHERE buy_order='ORDERTEST';
SELECT public.mx_webpay_settle_group(:'tx_id'::uuid,:'tx_amount'::numeric,'ORDERTEST');
DO $$ BEGIN IF (SELECT count(*) FROM pagos WHERE estado='pagado')<>2 THEN RAISE EXCEPTION 'Settlement not atomic'; END IF; IF (SELECT count(*) FROM notifications WHERE payload->>'event'='approved')<>1 THEN RAISE EXCEPTION 'Confirmation event count'; END IF; END $$;
SELECT public.mx_webpay_settle_group(:'tx_id'::uuid,:'tx_amount'::numeric,'ORDERTEST');
DO $$ BEGIN IF (SELECT count(*) FROM notifications WHERE payload->>'event'='approved')<>1 THEN RAISE EXCEPTION 'Duplicate notification'; END IF; END $$;
INSERT INTO transbank_refunds(transaction_id,pago_id,curso_id,amount,status,gateway_type,gateway_response) VALUES(:'tx_id'::uuid,'00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001',:'tx_amount'::numeric,'GATEWAY_CONFIRMED','REVERSED','{"balance":0}') RETURNING id AS refund_id \gset
SELECT public.mx_webpay_finalize_group_refund(:'refund_id'::uuid);
DO $$ BEGIN IF (SELECT count(*) FROM pagos WHERE estado='pendiente')<>2 THEN RAISE EXCEPTION 'Refund incomplete'; END IF; IF (SELECT count(*) FROM notifications WHERE payload->>'event'='refunded')<>1 THEN RAISE EXCEPTION 'Refund notice count'; END IF; END $$;


-- Negative cases: all must fail before producing another transaction.
DO $test$
DECLARE before_count int;
BEGIN
 SELECT count(*) INTO before_count FROM transbank_transactions;
 BEGIN
  PERFORM public.mx_webpay_reserve_group('00000000-0000-4000-8000-000000000003',
   ARRAY['00000000-0000-4000-8000-000000000011'::uuid,'00000000-0000-4000-8000-000000000011'::uuid],
   'DUPLICATE','TEST','integration');
  RAISE EXCEPTION 'Duplicate payment ID was accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='Duplicate payment ID was accepted' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.mx_webpay_reserve_group('00000000-0000-4000-8000-000000000099',
   ARRAY['00000000-0000-4000-8000-000000000011'::uuid,'00000000-0000-4000-8000-000000000012'::uuid],
   'OTHERUSER','TEST','integration');
  RAISE EXCEPTION 'Incorrect owner was accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='Incorrect owner was accepted' THEN RAISE; END IF;
 END;
 IF (SELECT count(*) FROM transbank_transactions)<>before_count THEN RAISE EXCEPTION 'Negative tests created unexpected transaction'; END IF;
END $test$;
DO $test$
BEGIN
 BEGIN
  PERFORM public.mx_webpay_settle_group(
    (SELECT id FROM transbank_transactions WHERE buy_order='ORDERTEST'),
    1,'ORDERTEST');
  RAISE EXCEPTION 'Incorrect settlement amount was accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='Incorrect settlement amount was accepted' THEN RAISE; END IF;
 END;
END $test$;


-- Recovery of a transaction whose gateway authorization succeeded but local commit was uncertain.
INSERT INTO pagos(id,curso_id,miembro_id,monto,monto_cuota,estado) VALUES
 ('00000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',1500,1500,'pendiente'),
 ('00000000-0000-4000-8000-000000000042','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',1500,1500,'pendiente');
SELECT public.mx_webpay_reserve_group('00000000-0000-4000-8000-000000000003',
 ARRAY['00000000-0000-4000-8000-000000000041'::uuid,'00000000-0000-4000-8000-000000000042'::uuid],
 'RECOVERY','TEST','integration');
UPDATE transbank_transactions SET status='COMMIT_ERROR' WHERE buy_order='RECOVERY';
DO $recovery$
DECLARE txid uuid; charge numeric; succeeded boolean:=false;
BEGIN
 SELECT id,amount INTO txid,charge FROM transbank_transactions WHERE buy_order='RECOVERY';
 BEGIN
  PERFORM public.mx_webpay_settle_group(txid,charge+1,'RECOVERY');
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='gateway_order_amount_mismatch' THEN succeeded:=true; ELSE RAISE; END IF;
 END;
 IF NOT succeeded THEN RAISE EXCEPTION 'Tampered gateway amount was accepted'; END IF;
 IF (SELECT count(*) FROM pagos WHERE id IN ('00000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000042') AND estado='pendiente')<>2 THEN RAISE EXCEPTION 'Invalid response changed payment'; END IF;
 PERFORM public.mx_webpay_settle_group(txid,charge,'RECOVERY');
 IF (SELECT count(*) FROM pagos WHERE id IN ('00000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000042') AND estado='pagado')<>2 THEN RAISE EXCEPTION 'Recovery failed'; END IF;
 IF (SELECT count(*) FROM notifications WHERE payload->>'group_transaction_id'=txid::text AND payload->>'event'='approved')<>1 THEN RAISE EXCEPTION 'Recovery notification mismatch'; END IF;
END $recovery$;
