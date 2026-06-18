(function(){
  "use strict";

  const $=(s,r=document)=>r.querySelector(s);
  const esc=s=>String(s??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const clp=n=>"$"+Number(n||0).toLocaleString("es-CL");
  const now=()=>new Date().toISOString();
  const PACKAGES=[
    {id:"starter",nombre:"Starter",creditos:10,precio:990,recomendado:false},
    {id:"medio",nombre:"Medio",creditos:25,precio:1990,recomendado:true},
    {id:"pro",nombre:"Pro",creditos:60,precio:3990,recomendado:false}
  ];
  const BOOSTS=[
    {id:"colegio",nombre:"Destacado colegio",creditos:1,dias:7,alcance:"Mi colegio"},
    {id:"comuna",nombre:"Portada comuna",creditos:3,dias:7,alcance:"Mi comuna"},
    {id:"cursapp",nombre:"Todo Cursapp",creditos:5,dias:7,alcance:"Comunidad Cursapp"}
  ];
  let sb=null, session=null, wallet=null, posts=[], movements=[];

  function readJson(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}}
  function getSession(){
    const s=readJson("cursapp_session_v1",{})||{};
    const p=readJson("cursapp_active_profile_v1",{})||{};
    return {
      userId:String(s.userId||s.usuario_id||p.usuario_id||p.userId||s.email||p.email||"").toLowerCase(),
      email:String(s.email||p.email||"").toLowerCase(),
      name:s.nombre||s.name||p.nombre_apoderado||p.nombre||"Apoderado Cursapp"
    };
  }
  async function waitSupabase(timeoutMs=5000){
    const start=Date.now();
    while(Date.now()-start<timeoutMs){
      if(window.cursappSupabase) return window.cursappSupabase;
      if(window.initCursappSupabase){try{const x=window.initCursappSupabase(); if(x) return x;}catch(e){}}
      await new Promise(r=>setTimeout(r,100));
    }
    return null;
  }
  function toast(t){const el=$("#toast"); if(!el){alert(t);return;} el.textContent=t; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),2200)}
  function uid(){return String(session?.userId||session?.email||"").toLowerCase()}

  async function loadWallet(){
    if(!uid()) return null;
    const r=await sb.from("creditos_usuario").select("*").eq("usuario_id",uid()).maybeSingle();
    if(r.error && r.error.code!=="PGRST116") throw new Error(r.error.message);
    if(r.data){ wallet=r.data; return wallet; }
    const ins=await sb.from("creditos_usuario").insert([{usuario_id:uid(),email:session.email,saldo:0,total_comprado:0,total_consumido:0}]).select("*").single();
    if(ins.error) throw new Error(ins.error.message);
    wallet=ins.data; return wallet;
  }
  async function loadMovements(){
    const r=await sb.from("movimientos_creditos").select("*").eq("usuario_id",uid()).order("created_at",{ascending:false}).limit(50);
    movements=r.error?[]:(r.data||[]);
  }
  async function loadPosts(){
    if(!uid()) {posts=[]; return;}
    const r=await sb.from("mercado_publicaciones").select("id,titulo,precio,estado,usuario_id,vendedor_id,vendedor_email,destacado,destacado_hasta").or(`usuario_id.eq.${uid()},vendedor_id.eq.${uid()},vendedor_email.eq.${session.email}`);
    posts=r.error?[]:(r.data||[]).filter(p=>!["eliminado","bloqueado"].includes(String(p.estado||"").toLowerCase()));
  }
  function renderBalance(){const el=$("#creditBalanceBadge"); if(el) el.textContent=Number(wallet?.saldo||0)+" créditos";}
  function renderPackages(){
    const box=$("#creditPackages"); if(!box) return;
    box.innerHTML=PACKAGES.map(p=>`<article class="creditPackage ${p.recomendado?'recommended':''}"><h3>${esc(p.nombre)}${p.recomendado?' · Recomendado':''}</h3><p>${p.creditos} créditos Mercado</p><strong>${clp(p.precio)}</strong><button type="button" data-buy-credit="${esc(p.id)}">Comprar créditos</button></article>`).join("");
  }
  function renderBoostPostSelect(){
    const sel=$("#boostPostSelect"); if(!sel) return;
    sel.innerHTML=posts.length?posts.map(p=>`<option value="${esc(p.id)}">${esc(p.titulo||'Publicación')} ${p.destacado?'⭐':''}</option>`).join(""):`<option value="">Publica un aviso primero</option>`;
  }
  function renderBoosts(){
    const box=$("#boostOptions"); if(!box) return;
    box.innerHTML=BOOSTS.map(b=>`<article class="boostOption"><b>${esc(b.nombre)}</b><span>${b.creditos} crédito${b.creditos===1?'':'s'} · ${b.dias} días</span><small>${esc(b.alcance)}</small><button type="button" data-boost-credit="${esc(b.id)}">Destacar</button></article>`).join("");
  }
  function renderHistory(){
    const box=$("#creditHistory"); if(!box) return;
    box.innerHTML=movements.slice(0,20).map(m=>`<div class="historyItem"><b>${Number(m.creditos)>0?'+':''}${Number(m.creditos||0)} créditos</b><span>${esc(m.detalle||m.tipo||'Movimiento')} · ${m.created_at?new Date(m.created_at).toLocaleString('es-CL'):''}</span></div>`).join("")||`<p class="muted">Sin movimientos todavía.</p>`;
  }
  function render(){renderBalance();renderPackages();renderBoostPostSelect();renderBoosts();renderHistory();}

  async function buy(packageId){
    const p=PACKAGES.find(x=>x.id===packageId); if(!p) return toast("Paquete no disponible");
    const ok=confirm(`Compra de créditos\n\n${p.creditos} créditos por ${clp(p.precio)}\n\nEn producción se pagará con Transbank.`);
    const order={usuario_id:uid(),email:session.email,paquete_id:p.id,paquete_nombre:p.nombre,creditos:p.creditos,monto_total:p.precio,ingreso_cursapp:p.precio,estado:ok?'pagado':'cancelado',gateway:'transbank_demo',tbk_order:'CRED-'+Date.now(),created_at:now(),pagado_at:ok?now():null};
    const or=await sb.from("ordenes_creditos").insert([order]).select("*").single();
    if(or.error) return toast(or.error.message);
    await sb.from("transacciones_cursapp").insert([{tipo:'compra_creditos',referencia_id:or.data.id,usuario_id:uid(),monto_total:p.precio,monto_curso:0,comision_cursapp:0,ingreso_cursapp:p.precio,estado:order.estado,gateway:'transbank_demo',tbk_order:order.tbk_order,detalle:'Compra paquete '+p.nombre}]);
    if(!ok) return toast("Compra cancelada");
    const newSaldo=Number(wallet?.saldo||0)+p.creditos;
    const up=await sb.from("creditos_usuario").update({saldo:newSaldo,total_comprado:Number(wallet?.total_comprado||0)+p.creditos,updated_at:now()}).eq("usuario_id",uid()).select("*").single();
    if(up.error) return toast(up.error.message);
    wallet=up.data;
    await sb.from("movimientos_creditos").insert([{usuario_id:uid(),tipo:'compra',creditos:p.creditos,saldo_resultante:newSaldo,detalle:'Compra paquete '+p.nombre,orden_id:or.data.id}]);
    await loadMovements(); render(); toast("Pago aprobado. Créditos agregados.");
  }
  async function boost(boostId){
    const b=BOOSTS.find(x=>x.id===boostId); if(!b) return toast("Regla no disponible");
    const postId=$("#boostPostSelect")?.value; if(!postId) return toast("Selecciona una publicación");
    if(Number(wallet?.saldo||0)<b.creditos) return toast("No tienes créditos suficientes");
    const hasta=new Date(Date.now()+b.dias*86400000).toISOString();
    const saldo=Number(wallet.saldo||0)-b.creditos;
    const upPost=await sb.from("mercado_publicaciones").update({destacado:true,destacado_tipo:b.id,destacado_hasta:hasta}).eq("id",postId).select("id").single();
    if(upPost.error) return toast(upPost.error.message);
    await sb.from("publicaciones_destacadas").insert([{publicacion_id:postId,usuario_id:uid(),tipo_destacado:b.id,creditos_usados:b.creditos,fecha_inicio:now(),fecha_fin:hasta,estado:'activo'}]);
    const up=await sb.from("creditos_usuario").update({saldo,total_consumido:Number(wallet.total_consumido||0)+b.creditos,updated_at:now()}).eq("usuario_id",uid()).select("*").single();
    if(up.error) return toast(up.error.message);
    wallet=up.data;
    await sb.from("movimientos_creditos").insert([{usuario_id:uid(),tipo:'consumo',creditos:-b.creditos,saldo_resultante:saldo,detalle:'Destacar publicación · '+b.nombre,publicacion_id:postId}]);
    await loadMovements(); await loadPosts(); render(); toast("Publicación destacada por "+b.dias+" días");
  }
  async function refresh(){
    session=getSession(); sb=await waitSupabase(); if(!sb||!uid()) return;
    try{await loadWallet(); await loadMovements(); await loadPosts(); render();}catch(e){console.warn('Créditos Mercado:',e);}
  }
  function bind(){document.addEventListener("click",e=>{const buyBtn=e.target.closest("[data-buy-credit]"); if(buyBtn){e.preventDefault(); buy(buyBtn.dataset.buyCredit); return;} const boostBtn=e.target.closest("[data-boost-credit]"); if(boostBtn){e.preventDefault(); boost(boostBtn.dataset.boostCredit);}})}
  window.CursappMarketCredits={render,refresh,buy,boost,balance:()=>Number(wallet?.saldo||0),packages:PACKAGES,boosts:BOOSTS};
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",()=>{bind(); setTimeout(refresh,200);}); else {bind(); setTimeout(refresh,200);} 
})();
