(function(){
  "use strict";

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=s=>String(s??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const clp=n=>"$"+Number(n||0).toLocaleString("es-CL");
  const now=()=>new Date().toISOString();
  const phoneClean=s=>String(s||"").replace(/[^0-9]/g,"");
  const DEFAULT_CATS=[
    {nombre:"Libros",icono:"📚",orden:1},
    {nombre:"Uniformes",icono:"👕",orden:2},
    {nombre:"Útiles escolares",icono:"✏️",orden:3},
    {nombre:"Instrumentos",icono:"🎸",orden:4},
    {nombre:"Tecnología",icono:"💻",orden:5},
    {nombre:"Deportes",icono:"⚽",orden:6},
    {nombre:"Vestuario",icono:"🎭",orden:7},
    {nombre:"Servicios",icono:"🧑‍🏫",orden:8},
    {nombre:"Otros",icono:"🛍️",orden:9}
  ];

  const state={sb:null, session:null, profile:null, categories:[], posts:[], loading:false};

  function readJson(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}}
  function getSession(){
    const s=readJson("cursapp_session_v1",{})||{};
    const p=readJson("cursapp_active_profile_v1",{})||{};
    const role=localStorage.getItem("cursapp_active_role_v1")||s.currentRole||s.role||"apoderado";
    return {
      raw:s,
      profile:p,
      userId:s.userId||s.usuario_id||p.usuario_id||p.userId||null,
      email:String(s.email||p.email||"").toLowerCase(),
      name:s.nombre||s.name||p.nombre_apoderado||p.nombre||"Apoderado Cursapp",
      role,
      courseId:s.curso_id||s.cursoId||p.curso_id||p.cursoId||null,
      colegioId:s.colegio_id||s.colegioId||p.colegio_id||p.colegioId||null,
      courseKey:s.courseKey||s.course_key||p.courseKey||p.course_key||"",
      phone:s.whatsapp||s.telefono||p.whatsapp||p.telefono||""
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
  function toast(t){const el=$("#toast"); if(!el){alert(t); return;} el.textContent=t; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),1900)}
  function setLoading(on,msg){
    state.loading=!!on;
    let box=$("#marketLoading");
    if(!box){box=document.createElement("div");box.id="marketLoading";box.className="marketLoading";document.body.appendChild(box)}
    box.innerHTML=`<div><span>🛍️</span><b>${esc(msg||"Cargando Mercado Escolar...")}</b><small>Sin pagos dentro de Cursapp · comunidad registrada</small></div>`;
    box.style.display=on?"grid":"none";
  }
  function requireSession(){
    state.session=getSession();
    if(!state.session.email){
      toast("Debes ingresar a Cursapp para usar Mercado Escolar");
      return false;
    }
    return true;
  }

  async function init(){
    setLoading(true,"Preparando Mercado Escolar...");
    state.sb=await waitSupabase();
    state.session=getSession();
    if(!state.sb){
      setLoading(false);
      renderError("Supabase no disponible. Revisa conexión.");
      return;
    }
    await loadCategories();
    fillCategorySelect();
    renderCategoryRow();
    await loadPosts();
    bind();
    setLoading(false);
  }

  function renderError(msg){
    const f=$("#featuredList"), g=$("#marketGrid");
    const html=emptyState("⚠️","Mercado no disponible",msg||"Intenta nuevamente en unos segundos.","Volver a Cursapp","");
    if(f) f.innerHTML=html; if(g) g.innerHTML=html;
  }
  async function loadCategories(){
    const {data,error}=await state.sb.from("mercado_categorias").select("*").eq("estado","activo").order("orden",{ascending:true});
    if(error){state.categories=DEFAULT_CATS.map((c,i)=>({id:null,...c,orden:i+1,estado:"activo"})); return;}
    state.categories=(data&&data.length?data:DEFAULT_CATS.map((c,i)=>({id:null,...c,orden:i+1,estado:"activo"})));
  }
  function fillCategorySelect(){
    const sel=$("#pubCategory"); if(!sel) return;
    sel.innerHTML=state.categories.map(c=>`<option value="${esc(c.id||c.nombre)}" data-name="${esc(c.nombre)}">${esc(c.icono||"")} ${esc(c.nombre)}</option>`).join("");
  }
  function renderCategoryRow(){
    const row=$(".categoryRow"); if(!row) return;
    const cats=state.categories.slice(0,4);
    row.innerHTML=cats.map(c=>`<article data-cat="${esc(c.nombre)}"><span>${esc(c.icono||"🛍️")}</span><b>${esc(c.nombre)}</b></article>`).join("")+`<article data-view="explorar"><span>▦</span><b>Más</b></article>`;
  }
  function categoryById(id){ return state.categories.find(c=>String(c.id)===String(id)) || null; }
  function categoryName(p){ return categoryName(p) || categoryById(p.categoria_id)?.nombre || "Otros"; }
  function categoryIconByName(name){ return (state.categories.find(c=>String(c.nombre).toLowerCase()===String(name).toLowerCase())||{}).icono || "🛍️"; }

  async function loadPosts(){
    let query=state.sb.from("mercado_publicaciones").select("*").in("estado",["disponible","reservado"]).eq("activo",true);
    if(state.session.courseId) query=query.eq("curso_id",state.session.courseId);
    query=query.order("created_at",{ascending:false}).limit(80);
    const {data,error}=await query;
    if(error){renderError("No se pudieron cargar publicaciones: "+error.message); return;}
    state.posts=data||[];
    renderProducts(state.posts);
    renderMine();
  }

  function imageForPost(p){
    if(p.imagen_principal) return p.imagen_principal;
    const name=categoryName(p);
    const map={Libros:"libros.svg",Uniformes:"poleron.svg",Vestuario:"vestido.svg",Deportes:"balon.svg",Tecnología:"mochila.svg",Instrumentos:"generic.svg",Servicios:"generic.svg",Otros:"generic.svg"};
    return "assets/img/"+(map[name]||"generic.svg");
  }
  function emptyState(icon,title,text,button,view){
    return `<div class="emptyState"><div class="emptyIcon">${icon}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${button?`<button data-view="${esc(view||"publicar")}">${esc(button)}</button>`:""}</div>`;
  }
  function card(p){
    const price=Number(p.precio||0)===0?"Intercambio":clp(p.precio);
    const title=p.titulo||"Publicación";
    return `<article class="productCard" data-post="${esc(p.id)}">
      ${p.destacado?`<span class="tag">DESTACADA</span>`:""}
      <img src="${esc(imageForPost(p))}" alt="${esc(title)}" onerror="this.src='assets/img/generic.svg'">
      <div class="productBody"><b>${esc(title)}</b><strong>${price}</strong><span>⌖ ${esc(p.curso_id?"Mi colegio":"Comunidad")}</span><div class="productMeta"><small>${esc(categoryName(p))}</small><small>${esc(p.estado||"disponible")}</small></div></div>
    </article>`;
  }
  function visible(list=state.posts){return list.filter(p=>!["eliminado","oculto","vendido"].includes(String(p.estado||"").toLowerCase()))}
  function renderProducts(list=visible()){
    const f=$("#featuredList"), g=$("#marketGrid");
    const ranked=list.slice().sort((a,b)=>(Number(b.destacado)-Number(a.destacado))||Date.parse(b.created_at||0)-Date.parse(a.created_at||0));
    const empty=emptyState("🛍️","Aún no hay publicaciones","Cuando los apoderados publiquen artículos, aparecerán acá.","Publicar primer aviso","publicar");
    if(f) f.innerHTML=ranked.length?ranked.slice(0,8).map(card).join(""):empty;
    if(g) g.innerHTML=ranked.length?ranked.map(card).join(""):empty;
  }
  function renderMine(){
    const box=$("#myPosts"); if(!box) return;
    const email=state.session.email;
    const mine=state.posts.filter(p=>String(String(p.vendedor_id||"")).toLowerCase()===email && !["eliminado"].includes(String(p.estado||"").toLowerCase()));
    box.innerHTML=mine.map(p=>`<div class="myItem"><img src="${esc(imageForPost(p))}"><div><b>${esc(p.titulo)}</b><span>${esc(p.estado)} · ${Number(p.visualizaciones||0)} vistas · ${Number(p.contactos||0)} contactos</span></div><button data-status="vendido" data-id="${esc(p.id)}">Vendido</button><button data-delete="${esc(p.id)}">Eliminar</button></div>`).join("") || emptyState("📦","Aún no tienes avisos","Publica tu primer artículo para vender o intercambiar dentro de la comunidad.","Publicar aviso","publicar");
  }
  function showView(v){
    $$(".view").forEach(x=>x.classList.remove("active"));
    $("#view-"+v)?.classList.add("active");
    $$(".pillNav button,.bottomBar button").forEach(x=>x.classList.toggle("active",x.dataset.view===v));
    if(v==="mis") renderMine();
  }
  function search(q){
    q=String(q||"").toLowerCase().trim();
    const list=!q?visible():visible().filter(p=>String((p.titulo||"")+" "+categoryName(p)+" "+(p.descripcion||"")).toLowerCase().includes(q));
    renderProducts(list);
  }
  function filterCat(cat){showView("explorar"); renderProducts(visible().filter(p=>categoryName(p)===cat));}

  function svgData(emoji,title){
    return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="620"><rect width="900" height="620" rx="42" fill="#ede9fe"/><rect x="145" y="115" width="610" height="340" rx="42" fill="#fff"/><text x="450" y="300" text-anchor="middle" dominant-baseline="middle" font-size="130">${emoji}</text><text x="450" y="410" text-anchor="middle" font-family="Arial" font-size="42" font-weight="800" fill="#101828">${String(title||"").slice(0,24)}</text></svg>`)}`;
  }
  async function publish(e){
    e.preventDefault();
    if(!requireSession()) return;
    const title=$("#pubTitle").value.trim(), desc=$("#pubDesc").value.trim();
    if(!title||!desc){toast("Completa título y descripción");return;}
    const catValue=$("#pubCategory").value;
    const catObj=state.categories.find(c=>String(c.id)===String(catValue)) || state.categories.find(c=>String(c.nombre)===String(catValue)) || null;
    const emoji=$("#pubEmoji").value.trim()||categoryIconByName(catObj?.nombre)||"🛍️";
    const whatsapp=phoneClean($("#pubWhatsapp")?.value||state.session.phone||"");
    const row={
      curso_id:state.session.courseId,
      vendedor_id:state.session.userId,
      categoria_id:catObj?catObj.id:null,
      titulo:title,
      descripcion:desc,
      precio:Number($("#pubPrice").value||0),
      estado:"disponible",
      nombre_vendedor:state.session.name,
      whatsapp,
      imagen_principal:svgData(emoji,title),
      activo:true
    };
    const {data,error}=await state.sb.from("mercado_publicaciones").insert([row]).select("*").single();
    if(error){toast("No se pudo publicar: "+error.message);return;}
    state.posts.unshift(data); e.target.reset(); toast("Publicación creada"); renderProducts(); renderMine(); showView("mis");
  }

  async function openDetail(id){
    const p=state.posts.find(x=>String(x.id)===String(id)); if(!p) return;
    state.sb.from("mercado_publicaciones").update({vistas:Number(p.visualizaciones||0)+1}).eq("id",p.id).then(()=>{});
    p.visualizaciones=Number(p.visualizaciones||0)+1;
    const price=Number(p.precio||0)===0?"Intercambio":clp(p.precio);
    $("#modal").innerHTML=`<div class="modal">
      <img src="${esc(imageForPost(p))}" alt="${esc(p.titulo)}" onerror="this.src='assets/img/generic.svg'">
      <h2>${esc(p.titulo)}</h2>
      <p><b>${price}</b> · ${esc(categoryName(p))}</p>
      <p>${esc(p.descripcion||"")}</p>
      <p><b>${esc(p.nombre_vendedor||"Apoderado")}</b> · ${esc(p.curso_id?"Mi colegio":"Comunidad")}</p>
      <button data-contact="${esc(p.id)}">Contactar por WhatsApp</button>
      <button class="danger" data-report="${esc(p.id)}">🚩 Reportar publicación</button>
      <button class="ghost" onclick="document.getElementById('modal').innerHTML=''">Cerrar</button>
    </div>`;
  }
  async function contact(id){
    if(!requireSession()) return;
    const p=state.posts.find(x=>String(x.id)===String(id)); if(!p) return;
    const msg=`Hola, vi tu publicación en Mercado Escolar Cursapp: ${p.titulo}. ¿Sigue disponible?`;
    const phone=phoneClean(p.whatsapp||"");
    const whatsappUrl=phone?`https://wa.me/${phone.startsWith("56")?phone:"56"+phone}?text=${encodeURIComponent(msg)}`:"";
    const row={publicacion_id:p.id,interesado_id:state.session.userId,canal:"whatsapp",mensaje:msg};
    const {error}=await state.sb.from("mercado_contactos").insert([row]);
    if(error){toast("No se pudo registrar contacto: "+error.message);return;}
    p.contactos=Number(p.contactos||0)+1;
    state.sb.from("mercado_publicaciones").update({contactos:p.contactos}).eq("id",p.id).then(()=>{});
    toast("Contacto registrado"+(whatsappUrl?". Abriendo WhatsApp...":"."));
    if(whatsappUrl) window.open(whatsappUrl,"_blank");
  }
  async function report(id){
    if(!requireSession()) return;
    const motivo=prompt("Motivo del reporte: producto inexistente, información falsa, spam, contenido ofensivo u otro");
    if(!motivo) return;
    const p=state.posts.find(x=>String(x.id)===String(id)); if(!p) return;
    const {error}=await state.sb.from("mercado_reportes").insert([{publicacion_id:p.id,usuario_id:state.session.userId,motivo,detalle:motivo,estado:"pendiente"}]);
    if(error){toast("No se pudo reportar: "+error.message);return;}
    toast("Reporte enviado para revisión"); $("#modal").innerHTML="";
  }
  async function updateStatus(id,status){
    const {error}=await state.sb.from("mercado_publicaciones").update({estado:status,updated_at:now()}).eq("id",id);
    if(error){toast("No se pudo actualizar: "+error.message);return;}
    const p=state.posts.find(x=>String(x.id)===String(id)); if(p) p.estado=status;
    toast("Publicación actualizada"); renderProducts(); renderMine();
  }
  async function removePost(id){
    if(!confirm("¿Eliminar esta publicación?")) return;
    await updateStatus(id,"eliminado");
  }
  function rules(){alert("Reglas de comunidad\n\n• Solo usuarios registrados.\n• Cursapp no procesa pagos entre apoderados.\n• Contacto por WhatsApp o acuerdo directo.\n• Publicaciones reportadas pueden ocultarse.\n• No publicar productos prohibidos o no escolares.");}
  function bind(){
    document.addEventListener("click",e=>{
      const v=e.target.closest("[data-view]"); if(v){e.preventDefault();showView(v.dataset.view);return;}
      const c=e.target.closest("[data-cat]"); if(c){e.preventDefault();filterCat(c.dataset.cat);return;}
      const pc=e.target.closest("[data-post]"); if(pc){e.preventDefault();openDetail(pc.dataset.post);return;}
      const contactBtn=e.target.closest("[data-contact]"); if(contactBtn){contact(contactBtn.dataset.contact);return;}
      const rep=e.target.closest("[data-report]"); if(rep){report(rep.dataset.report);return;}
      const del=e.target.closest("[data-delete]"); if(del){removePost(del.dataset.delete);return;}
      const st=e.target.closest("[data-status]"); if(st){updateStatus(st.dataset.id,st.dataset.status);return;}
    });
    $("#publishForm")?.addEventListener("submit",publish);
    $("#searchInput")?.addEventListener("input",e=>search(e.target.value));
    $("#btnClearSearch")?.addEventListener("click",()=>{const s=$("#searchInput");if(s){s.value="";search("")}});
    $("#btnRules")?.addEventListener("click",rules);
    $$(".filters button").forEach(btn=>btn.addEventListener("click",()=>{$$(".filters button").forEach(b=>b.classList.remove("active"));btn.classList.add("active");const sc=btn.dataset.scope;renderProducts(visible())}));
  }

  document.addEventListener("DOMContentLoaded",init);
  window.CursappMarket={reload:loadPosts,showView};
})();
