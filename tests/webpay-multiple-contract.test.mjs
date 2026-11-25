// Tests de resguardo estático: no reemplazan la prueba transaccional en Supabase.
// Ejecutar: node --test tests/webpay-multiple-contract.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');
const sql=read('supabase/migrations/20261026_webpay_group_staging.sql');
const create=read('supabase/functions/webpay-create/index.ts');
const commit=read('supabase/functions/webpay-commit/index.ts');
const status=read('supabase/functions/webpay-status/index.ts');
const refund=read('supabase/functions/webpay-refund/index.ts');
test('Las 3 RPC financieras solo autorizan a service_role',()=>{
 assert.equal((sql.match(/auth\.role\(\) IS DISTINCT FROM 'service_role'/g)||[]).length,3);
 for(const name of ['mx_webpay_reserve_group','mx_webpay_settle_group','mx_webpay_finalize_group_refund']){
  assert.match(sql,new RegExp('REVOKE ALL ON FUNCTION public\\.'+name));
  assert.match(sql,new RegExp('GRANT EXECUTE ON FUNCTION public\\.'+name+'.*TO service_role'));
 }
});
test('Las operaciones agrupadas no se habilitan por defecto',()=>{
 assert.match(create,/MX_WEBPAY_GROUP_ENABLED/);
 assert.match(refund,/MX_WEBPAY_GROUP_ENABLED/);
});
test('No se actualiza individualmente la primera cuota de una orden agrupada',()=>{
 assert.match(commit,/approved\s*&&\s*!isGroup/);
 assert.match(status,/grouped\s*\?\s*\{\s*data\s*:\s*null\s*\}/);
 assert.match(commit,/mx_webpay_settle_group/);
 assert.match(status,/mx_webpay_settle_group/);
});
test('La reversa usa orden completa y función transaccional',()=>{
 assert.match(refund,/mx_webpay_finalize_group_refund/);
 assert.match(refund,/Cuotas múltiples inconsistentes/);
 assert.match(sql,/UPDATE public\.pagos p SET estado='pendiente'/);
 assert.match(sql,/WHERE i\.transaction_id=t\.id AND p\.id=i\.pago_id/);
});


test('Una orden agrupada genera un aviso idempotente y recibo consultable solo por servicio',()=>{
 assert.match(sql,/notifications_webpay_group_event_uidx/);
 assert.match(sql,/group_transaction_id/);
 assert.match(sql,/INSERT INTO public\.notifications/);
 assert.match(sql,/ON CONFLICT DO NOTHING/);
 assert.match(sql,/mx_webpay_group_receipt WITH \(security_invoker=true\)/);
 assert.match(sql,/REVOKE ALL ON public\.mx_webpay_group_receipt FROM PUBLIC,anon,authenticated/);
});

test('El comprobante agrupado exige autenticación y usa datos de orden oficial',()=>{
 const receipt=read('supabase/functions/webpay-group-receipt/index.ts');
 const resultPage=read('assets/pay_result.js');
 assert.match(receipt,/caller\.auth\.getUser\(\)/);
 assert.match(receipt,/tx\.user_id!==user\.id/);
 assert.match(receipt,/transbank_transaction_items/);
 assert.match(receipt,/items\.reduce/);
 assert.match(resultPage,/webpay-group-receipt/);
 assert.match(resultPage,/window\.print\(\)/);
 assert.match(resultPage,/navigator\.share/);
});

test('La migración contiene exactamente una definición completa de cada RPC',()=>{
 for(const name of ['mx_webpay_reserve_group','mx_webpay_settle_group','mx_webpay_finalize_group_refund']){
  assert.equal(sql.split('CREATE OR REPLACE FUNCTION public.'+name+'(').length-1,1,name+' duplicada');
 }
 assert.equal((sql.match(/END \$\$;/g)||[]).length,3);
 assert.equal((sql.match(/auth\.role\(\) IS DISTINCT FROM 'service_role'/g)||[]).length,3);
 assert.doesNotMatch(sql,/cuotas por\s*\n\s*RETURN/);
 assert.match(sql,/event','approved'/);
 assert.match(sql,/event','refunded'/);
});

 
// Ejecuta el predicado real de confirmación de la pasarela sin red ni credenciales.
test('Reversa: solo confirma una respuesta total y exitosa de la pasarela',()=>{
 const expression=refund.match(/const full=([\s\S]*?);\s*if\(!full\)/);
 assert.ok(expression,'Predicado de confirmación no encontrado');
 const confirmed=new Function('result','response','tx','return '+expression[1]);
 const tx={amount:15000};
 const cases=[
  [{type:'REVERSED',balance:0},true,true],
  [{type:'NULLIFIED',response_code:0,nullified_amount:15000,balance:0},true,true],
  [{type:'NULLIFIED',response_code:0,nullified_amount:5000,balance:10000},true,false],
  [{type:'NULLIFIED',response_code:-1,nullified_amount:15000,balance:0},true,false],
  [{type:'REVERSED',balance:100},true,false],
  [{type:'REVERSED',balance:0},false,false],
  [{type:'UNKNOWN',balance:0},true,false],
  [null,true,false],
  [{type:'REVERSED'},true,false]
 ];
 for(const [result,ok,expected] of cases) assert.equal(confirmed(result,{ok},tx),expected,JSON.stringify({result,ok}));
});
test('Reversa: incertidumbre de pasarela y fallo de conciliación no informan éxito',()=>{
 assert.match(refund,/catch\(_\)\{await db\.from\("transbank_refunds"\)\.update\(\{status:"NEEDS_REVIEW"/);
 assert.match(refund,/if\(!full\).*?return send\(\{error:/s);
 assert.match(refund,/if\(saved\.error\)return send\(\{error:/);
 assert.match(refund,/if\(done\.error\).*?status:"NEEDS_REVIEW".*?return send\(\{error:/s);
 assert.match(refund,/grouped\?"mx_webpay_finalize_group_refund":"finalizar_anulacion_transbank"/);
});
