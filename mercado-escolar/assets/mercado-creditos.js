(function(){
  const KC="cursapp_market_config_v1",KW="cursapp_market_credit_wallets_v1",KO="cursapp_market_credit_orders_v1",KM="cursapp_market_credit_movements_v1";
  const load=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}};
  const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const clp=n=>"$"+Number(n||0).toLocaleString("es-CL");
  function user(){let u=load("cursapp_demo_user",null)||load("cursapp_session_v1",null)||{};return String(u.email||u.userId||"apoderado.demo@cursapp.cl").toLowerCase()}
  function cfg(){let c=load(KC,null);if(!c){c={packages:[{id:"starter",name:"Starter",credits:10,price:990,status:"activo",recommended:false},{id:"medio",name:"Medio",credits:25,price:1990,status:"activo",recommended:true},{id:"pro",name:"Pro",credits:60,price:3990,status:"activo",recommended:false}],boosts:[{id:"colegio",name:"Destacado colegio",credits:2,durationDays:7,status:"activo",scope:"Mi colegio"},{id:"cercanos",name:"Colegios cercanos",credits:5,durationDays:7,status:"activo",scope:"Cercanos"},{id:"comuna",name:"Portada comuna",credits:12,durationDays:7,status:"activo",scope:"Comuna"}]};save(KC,c)}return c}
  function wallets(){return load(KW,{})}
  function balance(){return Number(wallets()[user()]||0)}
  function render(){
    let bal=document.getElementById("creditBalanceBadge"); if(bal) bal.textContent=balance()+" créditos";
    let pack=document.getElementById("creditPackages");
    if(pack) pack.innerHTML=cfg().packages.filter(p=>p.status!=="inactivo").map(p=>`<article class="creditPackage ${p.recommended?"recommended":""}"><h3>${p.name}${p.recommended?" · Recomendado":""}</h3><p>${p.credits} créditos Mercado</p><strong>${clp(p.price)}</strong><button onclick="CursappMarketCredits.buy('${p.id}')">Comprar con pasarela prueba</button></article>`).join("");
    let boosts=document.getElementById("boostOptions");
    if(boosts) boosts.innerHTML=cfg().boosts.filter(b=>b.status!=="inactivo").map(b=>`<article class="boostOption"><b>${b.name}</b><span>${b.credits} créditos · ${b.durationDays} días</span><small>${b.scope||"Vitrina"}</small><button onclick="CursappMarketCredits.boost('${b.id}')">Canjear</button></article>`).join("");
  }
  function addCredits(c,detail,oid){let w=wallets();w[user()]=Number(w[user()]||0)+Number(c||0);save(KW,w);let m=load(KM,[]);m.unshift({id:"mv_"+Date.now().toString(16),userId:user(),type:"credit",credits:Number(c||0),detail:detail||"Compra créditos",orderId:oid||"",at:new Date().toISOString()});save(KM,m)}
  function debit(c,detail){let w=wallets(),bal=Number(w[user()]||0);if(bal<c){alert("No tienes créditos suficientes.");return false}w[user()]=bal-c;save(KW,w);let m=load(KM,[]);m.unshift({id:"mv_"+Date.now().toString(16),userId:user(),type:"debit",credits:-Number(c||0),detail:detail||"Canje destacado",at:new Date().toISOString()});save(KM,m);return true}
  function buy(id){let p=cfg().packages.find(x=>x.id===id);if(!p)return;let order={id:"mko_"+Date.now().toString(16),userId:user(),packageId:p.id,packageName:p.name,credits:p.credits,amount:p.price,status:"iniciado",gateway:"transbank_demo",createdAt:new Date().toISOString()};let os=load(KO,[]);os.unshift(order);save(KO,os);let ok=confirm("Pasarela de prueba\n\nComprar "+p.credits+" créditos por "+clp(p.price)+"?");order.status=ok?"pagado":"cancelado";order.paidAt=ok?new Date().toISOString():"";os=load(KO,[]);let i=os.findIndex(o=>o.id===order.id);if(i>=0)os[i]=order;save(KO,os);if(ok){addCredits(p.credits,"Compra paquete "+p.name,order.id);alert("Pago aprobado. Se agregaron "+p.credits+" créditos.");render()}}
  function boost(id){let b=cfg().boosts.find(x=>x.id===id);if(!b)return;if(debit(Number(b.credits||0),"Canje "+b.name)){alert("Destacado aplicado en modo demo: "+b.name+" por "+b.durationDays+" días.");render()}}
  window.CursappMarketCredits={render,buy,boost,balance};
  document.addEventListener("DOMContentLoaded",()=>setTimeout(render,150));
  setTimeout(render,700);
})();