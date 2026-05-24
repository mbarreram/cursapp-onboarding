(function(){
"use strict";

const K_POSTS="cursapp_market_posts_v1";
const K_REPORTS="cursapp_market_reports_v1";
const K_CFG="cursapp_market_config_v1";
const K_WALLETS="cursapp_market_credit_wallets_v1";
const K_ORDERS="cursapp_market_credit_orders_v1";
const K_MOVES="cursapp_market_credit_movements_v1";
const K_EVENTS="cursapp_market_events_v1";
const K_CONTACTS="cursapp_market_contacts_v1";
const K_FAVS="cursapp_market_favorites_v1";

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const load=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const clp=n=>"$"+Number(n||0).toLocaleString("es-CL");
const now=()=>new Date().toISOString();
const uid=()=>String((load("cursapp_demo_user",{})||{}).email||(load("cursapp_session_v1",{})||{}).email||"apoderado.demo@cursapp.cl").toLowerCase();

const DEMO_OWNERS=["otro@cursapp.cl","demo@cursapp.cl","demo2@cursapp.cl","demo3@cursapp.cl"];
const DEMO_TITLES=["Polerón colegio Talla 14","Pack libros 6° básico 2024","Mochila colegial excelente estado","Balón de fútbol N°5","Vestido colegio Talla 10","Traje de huaso niño talla 10","Pack libros 6° básico","Polerón colegio talla 14","Aviso demo nuevo"];
function isDemoPost(p){
  return DEMO_OWNERS.includes(String(p.owner||"").toLowerCase()) || DEMO_TITLES.includes(String(p.title||""));
}
function purgeDemoIfNeeded(){
  if(localStorage.getItem("cursapp_market_demo_seed_v1")==="1") return;
  const ps=load(K_POSTS,[]);
  if(!Array.isArray(ps) || !ps.length) return;
  const cleaned=ps.filter(p=>!isDemoPost(p));
  if(cleaned.length!==ps.length) save(K_POSTS,cleaned);
}

const esc=s=>String(s??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

function cfg(){
  let c=load(K_CFG,null);
  if(!c){
    c={packages:[{id:"starter",name:"Starter",credits:10,price:990,status:"activo",recommended:false},{id:"medio",name:"Medio",credits:25,price:1990,status:"activo",recommended:true},{id:"pro",name:"Pro",credits:60,price:3990,status:"activo",recommended:false}],boosts:[{id:"colegio",name:"Destacado colegio",credits:2,durationDays:7,status:"activo",scope:"Mi colegio"},{id:"cercanos",name:"Colegios cercanos",credits:5,durationDays:7,status:"activo",scope:"Cercanos"},{id:"comuna",name:"Portada comuna",credits:12,durationDays:7,status:"activo",scope:"Comuna"}],rules:{autoHideReports:3,blockReports:5}};
    save(K_CFG,c);
  }
  return c;
}
function seed(){
  purgeDemoIfNeeded();
  // Producción: no cargar datos dummy automáticamente.
  // Para demo manual:
  // localStorage.setItem("cursapp_market_demo_seed_v1","1"); location.reload();
  if(localStorage.getItem("cursapp_market_demo_seed_v1")!=="1") return;
  let p=load(K_POSTS,[]);
  if(!p.length){
    p=[
      {id:"mk_1",owner:"apoderado.demo@cursapp.cl",title:"Polerón colegio Talla 14",category:"Uniformes",type:"Venta",price:7000,scope:"colegio",school:"Colegio Central",course:"2°B",desc:"En buen estado.",image:"poleron.svg",status:"activo",boost:"colegio",boostUntil:new Date(Date.now()+6*864e5).toISOString(),views:0,favorites:0,contacts:0,reports:0,createdAt:now()},
      {id:"mk_2",owner:"otro@cursapp.cl",title:"Pack libros 6° básico 2024",category:"Libros",type:"Venta",price:15000,scope:"cercanos",school:"Colegio Central",course:"6°A",desc:"Pack usado un semestre.",image:"libros.svg",status:"activo",boost:"",views:0,favorites:0,contacts:0,reports:0,createdAt:now()}
    ];
    save(K_POSTS,p);
  }
}
function posts(){seed();return load(K_POSTS,[])}
function setPosts(p){save(K_POSTS,p)}
function reports(){return load(K_REPORTS,[])}
function setReports(r){save(K_REPORTS,r)}
function wallets(){return load(K_WALLETS,{})}
function balance(){return Number(wallets()[uid()]||0)}
function addEvent(type,postId,extra={}){let e=load(K_EVENTS,[]);e.unshift({id:"ev_"+Date.now().toString(16),type,postId,userId:uid(),at:now(),...extra});save(K_EVENTS,e.slice(0,500))}
function imageForPost(p){
  if(p.image && String(p.image).startsWith("data:")) return p.image;
  const known=["poleron.svg","libros.svg","mochila.svg","balon.svg","vestido.svg","generic.svg"];
  if(p.image && known.includes(String(p.image))) return "assets/img/"+p.image;
  const map={Libros:"libros.svg",Uniformes:"poleron.svg",Vestuario:"vestido.svg",Deportes:"balon.svg",Otros:"generic.svg"};
  return "assets/img/"+(map[p.category]||"generic.svg");
}
function emptyState(icon,title,text,button,view){
  return `<div class="emptyState"><div class="emptyIcon">${icon}</div><h3>${title}</h3><p>${text}</p>${button?`<button data-view="${view||"publicar"}">${button}</button>`:""}</div>`;
}
function img(p){return imageForPost(p)}
function activeBoost(p){return p.boost && (!p.boostUntil || Date.parse(p.boostUntil)>Date.now())}
function rank(list){
  return list.slice().sort((a,b)=>{
    const ba=activeBoost(a)?1:0, bb=activeBoost(b)?1:0;
    if(ba!==bb)return bb-ba;
    if((a.reports||0)!==(b.reports||0))return (a.reports||0)-(b.reports||0);
    return Date.parse(b.createdAt||0)-Date.parse(a.createdAt||0);
  });
}
function visible(){purgeDemoIfNeeded();return rank(posts().filter(p=>p.status==="activo" && !isDemoPost(p)))}
function card(p){
  const price=p.type==="Intercambio"?"Intercambio":clp(p.price);
  return `<article class="productCard" data-post="${p.id}">
    ${activeBoost(p)?`<span class="tag">DESTACADA</span>`:""}
    <img src="${img(p)}" alt="${esc(p.title)}" onerror="this.src=\'assets/img/generic.svg\'">
    <div class="productBody"><b>${esc(p.title)}</b><strong>${price}</strong><span>⌖ ${esc(p.scope||"colegio")}</span><div class="productMeta"><small>${esc(p.category)}</small><small>${isFav(p.id)?"♥":"♡"}</small></div></div>
  </article>`;
}
function renderProducts(list=visible()){
  const f=$("#featuredList"), g=$("#marketGrid");
  const ranked=rank(list);
  if(f) f.innerHTML=ranked.length ? ranked.slice(0,8).map(card).join("") : emptyState("🛍️","Aún no hay publicaciones","Cuando los apoderados publiquen artículos, aparecerán destacados acá.","Publicar primer aviso","publicar");
  if(g) g.innerHTML=ranked.length ? ranked.map(card).join("") : emptyState("🔎","Sin resultados","No encontramos artículos para este filtro o búsqueda.","Publicar aviso","publicar");
}
function renderMine(){
  const box=$("#myPosts"); if(!box)return;
  const mine=posts().filter(p=>p.owner===uid() && !isDemoPost(p));
  box.innerHTML=mine.map(p=>`<div class="myItem"><img src="${img(p)}"><div><b>${esc(p.title)}</b><span>${esc(p.status)} · ${p.views||0} vistas · ${p.contacts||0} contactos</span></div><button data-edit="${p.id}">Editar</button></div>`).join("") || emptyState("📦","Aún no tienes avisos","Publica tu primer artículo para vender o intercambiar dentro de la comunidad.","Publicar aviso","publicar");
}
function showView(v){
  $$(".view").forEach(x=>x.classList.remove("active"));
  $("#view-"+v)?.classList.add("active");
  $$(".pillNav button,.bottomBar button").forEach(x=>x.classList.toggle("active",x.dataset.view===v));
  if(v==="mis")renderMine();
  if(v==="creditos")renderCredits();
}
function search(q){
  q=String(q||"").toLowerCase().trim();
  const list=!q?visible():visible().filter(p=>(p.title+" "+p.category+" "+p.desc).toLowerCase().includes(q));
  renderProducts(list);
}
function filterCat(cat){showView("explorar"); renderProducts(visible().filter(p=>p.category===cat));}
function isFav(id){return (load(K_FAVS,{})[uid()]||[]).includes(id)}
function toggleFav(id){let f=load(K_FAVS,{});f[uid()]=f[uid()]||[];f[uid()]=f[uid()].includes(id)?f[uid()].filter(x=>x!==id):f[uid()].concat(id);save(K_FAVS,f);renderProducts()}
function openDetail(id){
  let ps=posts(), i=ps.findIndex(p=>p.id===id); if(i<0)return;
  ps[i].views=Number(ps[i].views||0)+1; setPosts(ps); addEvent("view",id);
  const p=ps[i];
  $("#modal").innerHTML=`<div class="modal">
    <img src="${img(p)}" alt="${esc(p.title)}" onerror="this.src=\'assets/img/generic.svg\'">
    <h2>${esc(p.title)}</h2>
    <p><b>${p.type==="Intercambio"?"Intercambio":clp(p.price)}</b> · ${esc(p.category)}</p>
    <p>${esc(p.desc||"")}</p>
    <p><b>${esc(p.school||"Colegio")}</b> · ${esc(p.course||"Curso")}</p>
    <button data-contact="${p.id}">Contactar / reservar</button>
    <button class="ghost" data-fav="${p.id}">${isFav(p.id)?"Quitar favorito":"Guardar favorito"}</button>
    <button class="danger" data-report="${p.id}">🚩 Denunciar</button>
    <button class="ghost" onclick="document.getElementById('modal').innerHTML=''">Cerrar</button>
  </div>`;
}
function contact(id){
  let ps=posts(), i=ps.findIndex(p=>p.id===id); if(i<0)return;
  ps[i].contacts=Number(ps[i].contacts||0)+1; setPosts(ps);
  let c=load(K_CONTACTS,[]); c.unshift({id:"ct_"+Date.now().toString(16),postId:id,userId:uid(),owner:ps[i].owner,at:now(),status:"solicitado"}); save(K_CONTACTS,c);
  addEvent("contact",id); toast("Solicitud de contacto registrada");
}
function report(id){
  const reason=prompt("Motivo denuncia: fraude, producto prohibido, contenido ofensivo, riesgo menores, otro");
  if(!reason)return;
  let r=reports(); r.unshift({id:"rp_"+Date.now().toString(16),postId:id,reason,reporter:uid(),status:"pendiente",createdAt:now()}); setReports(r);
  let ps=posts(), i=ps.findIndex(p=>p.id===id); if(i>=0){ps[i].reports=Number(ps[i].reports||0)+1; if(ps[i].reports>=Number(cfg().rules.autoHideReports||3))ps[i].status="oculto"; setPosts(ps);}
  addEvent("report",id,{reason}); toast("Denuncia registrada para revisión");
  $("#modal").innerHTML="";
  renderProducts();
}
function publish(e){
  e.preventDefault();
  const title=$("#pubTitle").value.trim(), desc=$("#pubDesc").value.trim();
  if(!title||!desc){toast("Completa título y descripción");return}
  const emoji=$("#pubEmoji").value.trim()||"🛍️";
  const svg=`data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="620"><rect width="900" height="620" rx="42" fill="#ede9fe"/><rect x="145" y="115" width="610" height="340" rx="42" fill="#fff"/><text x="450" y="300" text-anchor="middle" dominant-baseline="middle" font-size="130">${emoji}</text><text x="450" y="410" text-anchor="middle" font-family="Arial" font-size="42" font-weight="800" fill="#101828">${title.slice(0,24)}</text></svg>`)}`;
  let p={id:"mk_"+Date.now().toString(16),owner:uid(),title,desc,category:$("#pubCategory").value,type:$("#pubType").value,price:Number($("#pubPrice").value||0),scope:$("#pubScope").value,school:"Colegio Central",course:"2°B",image:svg,status:"activo",boost:"",views:0,favorites:0,contacts:0,reports:0,createdAt:now()};
  let ps=posts();ps.unshift(p);setPosts(ps);addEvent("publish",p.id);e.target.reset();toast("Publicación creada");showView("mis");
}
function renderCredits(){
  const bal=$("#creditBalanceBadge"); if(bal)bal.textContent=balance()+" créditos";
  const pack=$("#creditPackages");
  if(pack)pack.innerHTML=cfg().packages.filter(p=>p.status!=="inactivo").map(p=>`<article class="creditPackage ${p.recommended?"recommended":""}"><h3>${esc(p.name)}${p.recommended?" · Recomendado":""}</h3><p>${p.credits} créditos Mercado</p><strong>${clp(p.price)}</strong><button data-buy="${p.id}">Comprar con pasarela prueba</button></article>`).join("");
  const sel=$("#boostPostSelect");
  if(sel){const mine=posts().filter(p=>p.owner===uid()&&p.status==="activo" && !isDemoPost(p));sel.innerHTML=mine.map(p=>`<option value="${p.id}">${esc(p.title)}</option>`).join("") || `<option value="">Publica un aviso primero</option>`}
  const boosts=$("#boostOptions");
  if(boosts)boosts.innerHTML=cfg().boosts.filter(b=>b.status!=="inactivo").map(b=>`<article class="boostOption"><b>${esc(b.name)}</b><span>${b.credits} créditos · ${b.durationDays} días</span><small>${esc(b.scope||"Vitrina")}</small><button data-boost="${b.id}">Canjear</button></article>`).join("");
  const hist=$("#creditHistory"), mov=load(K_MOVES,[]).filter(m=>m.userId===uid());
  if(hist)hist.innerHTML=mov.slice(0,20).map(m=>`<div class="historyItem"><b>${m.credits>0?"+":""}${m.credits} créditos</b><span>${esc(m.detail)} · ${new Date(m.at).toLocaleString("es-CL")}</span></div>`).join("") || `<p class="muted">Sin movimientos.</p>`;
}
function addCredits(c,detail,oid){let w=wallets();w[uid()]=Number(w[uid()]||0)+Number(c||0);save(K_WALLETS,w);let m=load(K_MOVES,[]);m.unshift({id:"mv_"+Date.now().toString(16),userId:uid(),type:"credit",credits:Number(c),detail,orderId:oid||"",at:now()});save(K_MOVES,m)}
function wallets(){return load(K_WALLETS,{})}
function debit(c,detail){let w=wallets(), bal=Number(w[uid()]||0); if(bal<c){toast("No tienes créditos suficientes");return false} w[uid()]=bal-c; save(K_WALLETS,w); let m=load(K_MOVES,[]);m.unshift({id:"mv_"+Date.now().toString(16),userId:uid(),type:"debit",credits:-Number(c),detail,at:now()});save(K_MOVES,m);return true}
function buy(id){
  const p=cfg().packages.find(x=>x.id===id); if(!p)return;
  let order={id:"mko_"+Date.now().toString(16),userId:uid(),packageId:p.id,packageName:p.name,credits:p.credits,amount:p.price,status:"iniciado",gateway:"transbank_demo",createdAt:now()};
  let os=load(K_ORDERS,[]);os.unshift(order);save(K_ORDERS,os);
  const ok=confirm("Pasarela de prueba\\n\\nComprar "+p.credits+" créditos por "+clp(p.price)+"?");
  order.status=ok?"pagado":"cancelado";order.paidAt=ok?now():"";
  os=load(K_ORDERS,[]);const i=os.findIndex(o=>o.id===order.id); if(i>=0)os[i]=order; save(K_ORDERS,os);
  if(ok){addCredits(p.credits,"Compra paquete "+p.name,order.id);toast("Pago aprobado: créditos agregados");renderCredits();}
}
function boost(id){
  const b=cfg().boosts.find(x=>x.id===id), postId=$("#boostPostSelect")?.value; if(!b||!postId)return;
  if(!debit(Number(b.credits||0),"Canje "+b.name))return;
  let ps=posts(), i=ps.findIndex(p=>p.id===postId); if(i>=0){ps[i].boost=b.id;ps[i].boostUntil=new Date(Date.now()+Number(b.durationDays||7)*864e5).toISOString();setPosts(ps);addEvent("boost",postId,{boost:b.id});}
  toast("Destacado aplicado");renderCredits();renderProducts();renderMine();
}
function toast(t){let el=$("#toast");el.textContent=t;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),1800)}
function rules(){alert("Reglas de comunidad\\n\\n• Solo usuarios registrados.\\n• Cursapp no procesa pagos entre apoderados.\\n• Productos prohibidos serán ocultados.\\n• Denuncias pueden suspender publicaciones.\\n• Los créditos solo sirven para visibilidad.");}

document.addEventListener("click",e=>{
  const v=e.target.closest("[data-view]"); if(v){e.preventDefault();showView(v.dataset.view);return}
  const c=e.target.closest("[data-cat]"); if(c){e.preventDefault();filterCat(c.dataset.cat);return}
  const pc=e.target.closest("[data-post]"); if(pc){e.preventDefault();openDetail(pc.dataset.post);return}
  const contactBtn=e.target.closest("[data-contact]"); if(contactBtn){contact(contactBtn.dataset.contact);return}
  const favBtn=e.target.closest("[data-fav]"); if(favBtn){toggleFav(favBtn.dataset.fav);$("#modal").innerHTML="";return}
  const rep=e.target.closest("[data-report]"); if(rep){report(rep.dataset.report);return}
  const buyBtn=e.target.closest("[data-buy]"); if(buyBtn){buy(buyBtn.dataset.buy);return}
  const boostBtn=e.target.closest("[data-boost]"); if(boostBtn){boost(boostBtn.dataset.boost);return}
  const edit=e.target.closest("[data-edit]"); if(edit){showView("publicar");toast("Edición completa se conectará al formulario en la siguiente iteración");return}
});
$("#publishForm")?.addEventListener("submit",publish);
$("#searchInput")?.addEventListener("input",e=>search(e.target.value));
$("#btnClearSearch")?.addEventListener("click",()=>{const s=$("#searchInput");if(s){s.value="";search("")}});
$("#btnRules")?.addEventListener("click",rules);
$$(".filters button").forEach(btn=>btn.addEventListener("click",()=>{$$(".filters button").forEach(b=>b.classList.remove("active"));btn.classList.add("active");const sc=btn.dataset.scope;renderProducts(sc==="todo"?visible():visible().filter(p=>p.scope===sc||sc==="colegio"))}));

seed();renderProducts();renderCredits();
window.CursappMarket={renderProducts,renderCredits,showView};
})();