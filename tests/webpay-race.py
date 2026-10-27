import subprocess, threading, time
from concurrent.futures import ThreadPoolExecutor
from psycopg import connect
dsn='host=localhost dbname=webpay_test user=postgres password=postgres'
owner='00000000-0000-4000-8000-000000000003'
ids=['00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000022']
with connect(dsn) as conn:
 with conn.cursor() as cur:
  cur.execute("INSERT INTO pagos(id,curso_id,miembro_id,monto,monto_cuota,estado) VALUES (%s,'00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',1500,1500,'pendiente'),(%s,'00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',1500,1500,'pendiente')",ids)
barrier=threading.Barrier(2)
def reserve(n):
 barrier.wait()
 try:
  with connect(dsn) as conn:
   with conn.cursor() as cur:
    cur.execute("SET request.jwt.claim.role='service_role'")
    cur.execute("SELECT public.mx_webpay_reserve_group(%s,%s::uuid[],%s,'TEST','integration')",(owner,ids,'RACE'+str(n)))
    return ('ok',cur.fetchone()[0])
 except Exception as e:return ('rejected',str(e).splitlines()[0])
with ThreadPoolExecutor(max_workers=2) as pool: outcomes=list(pool.map(reserve,[1,2]))
assert sum(x[0]=='ok' for x in outcomes)==1,outcomes
with connect(dsn) as conn:
 with conn.cursor() as cur:
  cur.execute("SELECT count(*) FROM transbank_transactions WHERE buy_order LIKE 'RACE%%'")
  assert cur.fetchone()[0]==1
  cur.execute("SELECT count(*) FROM transbank_transaction_items WHERE pago_id=ANY(%s::uuid[])",(ids,))
  assert cur.fetchone()[0]==2
print('Concurrent reservation: exactly one succeeds; shared items reserved once',outcomes)

# Concurrent settlement of an already reserved second synthetic order.
settle_ids=['00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000032']
with connect(dsn) as conn:
 with conn.cursor() as cur:
  cur.execute("INSERT INTO pagos(id,curso_id,miembro_id,monto,monto_cuota,estado) VALUES (%s,'00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',1500,1500,'pendiente'),(%s,'00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',1500,1500,'pendiente')",settle_ids)
  cur.execute("SET request.jwt.claim.role='service_role'")
  cur.execute("SELECT public.mx_webpay_reserve_group(%s,%s::uuid[],'SETTLERACE','TEST','integration')",(owner,settle_ids))
  receipt=cur.fetchone()[0]
  tx_id=receipt['transaction_id']
  amount=receipt['amount']
  cur.execute("UPDATE transbank_transactions SET status='COMMITTING' WHERE id=%s",(tx_id,))
barrier2=threading.Barrier(2)
def settle(_):
 barrier2.wait()
 try:
  with connect(dsn) as conn:
   with conn.cursor() as cur:
    cur.execute("SET request.jwt.claim.role='service_role'")
    cur.execute("SELECT public.mx_webpay_settle_group(%s,%s,'SETTLERACE')",(tx_id,amount))
    return ('ok',cur.fetchone()[0])
 except Exception as e:return ('rejected',str(e).splitlines()[0])
with ThreadPoolExecutor(max_workers=2) as pool: settled=list(pool.map(settle,[1,2]))
assert sum(x[0]=='ok' for x in settled)==2,settled
with connect(dsn) as conn:
 with conn.cursor() as cur:
  cur.execute("SELECT count(*) FROM pagos WHERE id=ANY(%s::uuid[]) AND estado='pagado'",(settle_ids,))
  assert cur.fetchone()[0]==2
  cur.execute("SELECT count(*) FROM notifications WHERE payload->>'group_transaction_id'=%s AND payload->>'event'='approved'",(str(tx_id),))
  assert cur.fetchone()[0]==1
print('Concurrent settlement: both calls idempotent, exactly one notification',settled)
