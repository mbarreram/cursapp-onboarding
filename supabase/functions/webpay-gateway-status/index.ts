import {createClient} from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"https://micursox.cl","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS"};
const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return respond({error:"method_not_allowed"},405);
 const url=Deno.env.get("SUPABASE_URL")||"",anon=Deno.env.get("SUPABASE_ANON_KEY")||"",service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 if(!url||!anon||!service)return respond({error:"backend_unavailable"},503);
 const auth=createClient(url,anon,{global:{headers:{Authorization:req.headers.get("Authorization")||""}},auth:{persistSession:false}});
 const user=await auth.auth.getUser();
 if(!user.data.user)return respond({error:"unauthorized"},401);
 const role=await auth.rpc("is_admin");
 if(role.error||role.data!==true)return respond({error:"forbidden"},403);
 const input=await req.json().catch(()=>({}));
 const id=String(input.transaction_id||"");
 if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))return respond({error:"invalid_id"},400);
 const db=createClient(url,service,{auth:{persistSession:false}});
 const found=await db.from("transbank_transactions").select("id,pago_id,status,environment,buy_order,amount,token_ws").eq("id",id).maybeSingle();
 if(found.error||!found.data)return respond({error:"not_found"},404);
 const tx=found.data;
 const prod=tx.environment==="production";
 const code=Deno.env.get(prod?"TBK_COMMERCE_CODE":"TBK_INTEGRATION_COMMERCE_CODE")||"";
 const secret=Deno.env.get(prod?"TBK_API_KEY":"TBK_INTEGRATION_API_KEY")||"";
 if(!code||!secret)return respond({ok:false,error:"gateway_credentials_not_configured",local_status:tx.status},503);
 if(!tx.token_ws)return respond({ok:false,error:"missing_token",local_status:tx.status},409);
 const host=prod?"https://webpay3g.transbank.cl":"https://webpay3gint.transbank.cl";
 try{
  const response=await fetch(host+"/rswebpaytransaction/api/webpay/v1.2/transactions/"+encodeURIComponent(tx.token_ws),{method:"GET",headers:{"Tbk-Api-Key-Id":code,"Tbk-Api-Key-Secret":secret},signal:AbortSignal.timeout(12000)});
  const data=await response.json().catch(()=>null);
  if(!response.ok||!data)return respond({ok:false,error:"gateway_query_failed",http_status:response.status,local_status:tx.status},502);
  if(String(data.buy_order||"")!==String(tx.buy_order)||Number(data.amount)!==Number(tx.amount))return respond({ok:false,error:"gateway_identity_mismatch",local_status:tx.status},409);
  const status=String(data.status||"UNKNOWN").toUpperCase();
  const responseCode=Number.isInteger(Number(data.response_code))?Number(data.response_code):null;
  const classification=status==="AUTHORIZED"?"approved_pending_reconciliation":(["FAILED","REJECTED","NULLIFIED","REVERSED"].includes(status)?"confirmed_failure":status==="INITIALIZED"?"uncompleted_unconfirmed":"other_unconfirmed");
  const observation=await db.from("transbank_status_observations").insert({
    transaction_id:tx.id,local_status:tx.status,gateway_status:status,
    gateway_response_code:responseCode,amount_and_order_verified:true,classification
  });
  if(observation.error)return respond({ok:false,error:"audit_observation_failed",local_status:tx.status},503);
  return respond({ok:true,transaction_id:tx.id,pago_id:tx.pago_id,local_status:tx.status,gateway_status:status,response_code:responseCode,classification,identity_verified:true,read_only:true});
 }catch(_){return respond({ok:false,error:"gateway_unreachable",local_status:tx.status},503)}
});