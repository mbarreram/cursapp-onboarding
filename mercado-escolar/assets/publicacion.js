(function(){
  "use strict";
  const $=(s,r=document)=>r.querySelector(s);
  const esc=s=>String(s??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const clp=n=>"$"+Number(n||0).toLocaleString("es-CL");
  const phoneClean=s=>String(s||"").replace(/[^0-9]/g,"");
  const readJson=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}};
  let sb=null, session=null, post=null, images=[];
  function getSession(){
    const s=readJson("cursapp_session_v1",{})||{};
    const p=readJson("cursapp_active_profile_v1",{})||{};
    return {userId:s.userId||s.usuario_id||p.usuario_id||p.userId||null,email:String(s.email||p.email||"").toLowerCase(),name:s.nombre||s.name||p.nombre||"Apoderado Cursapp",colegioId:s.colegio_id||s.colegioId||p.colegio_id||p.colegioId||null,phone:s.whatsapp||s.telefono||p.whatsapp||p.telefono||""};
  }
  async function waitSupabase(){for(let i=0;i<50;i++){if(window.cursappSupabase)return window.cursappSupabase;if(window.initCursappSupabase){try{const x=window.initCursappSupabase();if(x)return x;}catch(e){}} await new Promise(r=>setTimeout(r,100));} return null;}
  function toast(t){const el=$("#toast"); if(!el){alert(t);return;} el.textContent=t; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),2200)}
  function locked(){
    $("#publicacionRoot").innerHTML=`<div class="emptyState"><div class="emptyIcon">🔒</div><h3>Publicación protegida</h3><p>Esta publicación pertenece a una comunidad escolar registrada. Inicia sesión para verla.</p><a class="primaryLink" href="/login.html">Iniciar sesión</a><a class="ghostLink" href="/index.html">Volver</a></div>`;
  }
  function imgFor(p){return p.imagen_principal || (images[0]&&images[0].url_imagen) || "assets/img/generic.svg";}
  function boostUntil(p){return p?.destacado_hasta||p?.destacada_hasta||p?.vence_at||null;}
  function activeBoostRule(p){return String(p?.tipo_destacado||p?.destacado_tipo||p?.regla_destacado||p?.regla||'').toLowerCase();}
  function isBoosted(p){const until=boostUntil(p); return !!(p?.destacado||p?.destacada) && (!until || Date.parse(until)>Date.now());}
  function daysLeft(v){const ms=Date.parse(v||'')-Date.now();return Math.max(0,Math.ceil(ms/86400000));}
  function boostLabel(rule){return {colegio:'Destacado colegio',comuna:'Destacado comuna',cursapp:'Destacado Todo Cursapp'}[rule]||'Destacado';}
  function categoryName(p){return p.categoria_nombre||p.categoria||"Otros";}
  function shareUrl(){return `${location.origin}/mercado-escolar/publicacion.html?id=${encodeURIComponent(post.id)}`;}
  function message(){const price=Number(post.precio||0)===0?"Intercambio":clp(post.precio);return `Hola 👋\n\nVi tu publicación en Mercado Escolar Cursapp.\n\n📦 ${post.titulo||"Publicación"}\n💰 ${price}\n\n¿Sigue disponible?\n\n🔗 Ver publicación:\n${shareUrl()}`;}
  async function contact(){
    const phone=phoneClean(post.whatsapp||post.vendedor_whatsapp||"");
    const row={publicacion_id:post.id,usuario_id:session.userId||session.email,canal:"whatsapp",mensaje:message()};
    const {error}=await sb.from("mercado_contactos").insert([row]);
    if(error){toast("No se pudo registrar contacto: "+error.message);return;}
    const next=Number(post.contactos||0)+1; post.contactos=next; sb.from("mercado_publicaciones").update({contactos:next}).eq("id",post.id).then(()=>{});
    if(phone) location.href=`https://wa.me/${phone.startsWith("56")?phone:"56"+phone}?text=${encodeURIComponent(message())}`;
  }
  async function share(){
    const text=message();
    if(navigator.share){try{await navigator.share({title:post.titulo||"Mercado Escolar",text,url:shareUrl()});return;}catch(e){}}
    try{await navigator.clipboard.writeText(text);toast("Enlace copiado");}catch(e){toast(text)}
  }
  function render(){
    const price=Number(post.precio||0)===0?"Intercambio":clp(post.precio);
    const gallery=[imgFor(post)].concat(images.map(i=>i.url_imagen).filter(u=>u&&u!==imgFor(post))).slice(0,3);
    $("#publicacionRoot").innerHTML=`
      <div class="publicacionTopV13"><a class="detailBackV13" href="mercado-escolar.html">←</a><b>Detalle del aviso</b><button id="btnShareTop" class="detailShareV13" type="button">⇧</button></div>
      <div class="publicacionHero publicacionCarouselV13"><div class="publicacionTrackV13">${gallery.map(u=>`<figure><img src="${esc(u)}" onerror="this.src='assets/img/generic.svg'"></figure>`).join("")}</div><div class="v6Dots">${gallery.map((_,i)=>`<span class="${i===0?'active':''}"></span>`).join("")}</div></div>
      ${isBoosted(post)?`<em class="boostBadge detailBoost">⭐ ${esc(boostLabel(activeBoostRule(post)))} · quedan ${daysLeft(boostUntil(post))} día(s)</em>`:""}
      <small class="v6Cat">${esc(categoryName(post))}</small>
      <h2>${esc(post.titulo||"Publicación")}</h2>
      <p class="bigPrice">${esc(price)}</p>
      <div class="v6Chips"><span>✓ Disponible</span><span>⌖ ${esc(post.visibilidad||"Comunidad")}</span><span>Hoy</span></div>
      <p>${esc(post.descripcion||"")}</p>
      <div class="v6Seller"><span>${esc((post.nombre_vendedor||"Apoderado Cursapp").slice(0,2).toUpperCase())}</span><div><b>${esc(post.nombre_vendedor||"Apoderado Cursapp")}</b><small>Comunidad registrada</small></div></div>
      <div class="metricRow"><span>👁️ ${Number(post.visualizaciones||0)} vistas</span><span>💬 ${Number(post.contactos||0)} contactos</span><span>♥ ${Number(post.favoritos||0)} favoritos</span></div>
      <button id="btnContact" class="primary">Contactar por WhatsApp</button>
      <button id="btnShare" class="ghost">Compartir aviso</button>
      <a class="ghostLink promoteLink" href="mercado-escolar.html?boost=${encodeURIComponent(post.id)}">⭐ Promocionar aviso</a>
      <a class="ghostLink" href="mercado-escolar.html">Volver al mercado</a>`;
    $("#btnContact").addEventListener("click",contact); $("#btnShare").addEventListener("click",share); $("#btnShareTop").addEventListener("click",share);
  }
  async function init(){
    session=getSession(); if(!session.email){locked();return;}
    sb=await waitSupabase(); if(!sb){$("#publicacionRoot").innerHTML="<p>No se pudo conectar.</p>";return;}
    const id=new URLSearchParams(location.search).get("id"); if(!id){$("#publicacionRoot").innerHTML="<p>Publicación no encontrada.</p>";return;}
    const r=await sb.from("mercado_publicaciones").select("*").eq("id",id).single();
    if(r.error||!r.data){$("#publicacionRoot").innerHTML="<p>Publicación no encontrada o no disponible.</p>";return;}
    post=r.data;
    if(["oculto","bloqueado","eliminado","en_revision"].includes(String(post.estado||"").toLowerCase())){$("#publicacionRoot").innerHTML="<p>Esta publicación no se encuentra disponible.</p>";return;}
    const im=await sb.from("mercado_imagenes").select("*").eq("publicacion_id",id).order("orden",{ascending:true}); images=im.data||[];
    const next=Number(post.visualizaciones||0)+1; post.visualizaciones=next; sb.from("mercado_publicaciones").update({visualizaciones:next}).eq("id",id).then(()=>{});
    render();
  }
  document.addEventListener("DOMContentLoaded",init);
})();
