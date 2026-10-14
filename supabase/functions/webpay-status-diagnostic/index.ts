import {createClient} from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"https://micursox.cl","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS"};
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:cors});
 const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json"}});
 if(req.method!=="POST")return respond({error:"method"},405);
 const base=Deno.env.get("SUPABASE_URL")||"",key=Deno.env.get("SUPABASE_ANON_KEY")||"";
 const client=createClient(base,key,{global:{headers:{Authorization:req.headers.get("Authorization")||""}},auth:{persistSession:false}});
 const user=await client.auth.getUser();
 if(!user.data.user)return respond({error:"unauthorized"},401);
 const admin=await client.rpc("is_admin");
 if(admin.data!==true)return respond({error:"forbidden"},403);
 const body=await req.json().catch(()=>({}));
 const id=String(body.transaction_id||"");
 if(!/^[a-f0-9-]{36}$/i.test(id))return respond({error:"invalid_id"},400);
 const rows=await client.from("transbank_transactions").select("id,pago_id,status,environment,created_at,updated_at").eq("id",id).limit(1);
 if(rows.error)return respond({error:"query_unavailable"},503);
 return respond({ok:true,transaction:rows.data?.[0]||null,source:"local_database_only"});
});