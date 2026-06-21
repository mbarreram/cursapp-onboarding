(function(){
  "use strict";

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=s=>String(s??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const clp=n=>"$"+Number(n||0).toLocaleString("es-CL");
  const now=()=>new Date().toISOString();
  const phoneClean=s=>String(s||"").replace(/[^0-9]/g,"");
  const isUuid=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s||""));
  const BUCKET="mercado-escolar";
  const MAX_FILES=3;
  const MAX_BYTES=1024*1024;
  const ALLOWED=["image/jpeg","image/png","image/webp"];
  const ALLOWED_EXT=/\.(jpe?g|png|webp)$/i;
  const boostInFlight=new Set();
  const recentlyBoosted=new Map();
  const BOOST_RULES={
    colegio:{label:'Destacado colegio',cost:1,priority:1,days:7},
    comuna:{label:'Destacado comuna',cost:3,priority:2,days:7},
    cursapp:{label:'Destacado Todo Cursapp',cost:5,priority:3,days:7}
  };
  function boostRuleInfo(rule){return BOOST_RULES[rule]||BOOST_RULES.colegio;}
  function fmtDateTime(v){try{return new Date(v).toLocaleString('es-CL',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});}catch(e){return ''}}
  function daysLeft(v){const ms=Date.parse(v||'')-Date.now(); return Math.max(0,Math.ceil(ms/86400000));}

  const DEFAULT_CATS=[
    {nombre:"Deportes",icono:"⚽",orden:1},{nombre:"Instrumentos",icono:"🎵",orden:2},{nombre:"Libros",icono:"📚",orden:3},{nombre:"Uniformes",icono:"👕",orden:4},{nombre:"Útiles escolares",icono:"✏️",orden:5},{nombre:"Otros",icono:"📦",orden:6},{nombre:"Tecnología",icono:"💻",orden:7},{nombre:"Vestuario",icono:"🎒",orden:8},{nombre:"Servicios",icono:"🧑‍🏫",orden:9}
  ];
  const DEFAULT_REASONS=[
    {id:null,nombre:"Producto falso o inexistente",codigo:"producto_falso"},
    {id:null,nombre:"Precio engañoso",codigo:"precio_enganoso"},
    {id:null,nombre:"Contenido ofensivo",codigo:"contenido_ofensivo"},
    {id:null,nombre:"Spam o publicación repetida",codigo:"spam"},
    {id:null,nombre:"Producto prohibido",codigo:"producto_prohibido"},
    {id:null,nombre:"Imagen inadecuada",codigo:"imagen_inadecuada"},
    {id:null,nombre:"Otro",codigo:"otro"}
  ];
  const DEFAULT_BLOCKED=["arma","armas","cuchillo","navaja","alcohol","cigarro","vape","droga","medicamento","rifle","pistola","porno","casino","apuesta"];

  const state={sb:null, session:null, categories:[], posts:[], minePosts:[], imagesByPost:{}, favorites:new Set(), reasons:DEFAULT_REASONS, blocked:DEFAULT_BLOCKED, selectedFiles:[], loading:false, pendingBoostId:null, editingPostId:null};

  function readJson(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}}
  function getSession(){
    const s=readJson("cursapp_session_v1",{})||{};
    const p=readJson("cursapp_active_profile_v1",{})||{};
    const role=localStorage.getItem("cursapp_active_role_v1")||s.currentRole||s.role||"apoderado";
    return {
      raw:s, profile:p,
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
  function toast(t){const el=$("#toast"); if(!el){alert(t); return;} el.textContent=t; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),4200)}
  function photoMessage(msg,type="error"){
    let el=$("#photoValidationMsg");
    const preview=$("#photoPreview");
    if(!preview) return;
    if(!el){
      el=document.createElement("div");
      el.id="photoValidationMsg";
      el.className="photoValidationMsg";
      preview.insertAdjacentElement("afterend",el);
    }
    if(!msg){el.classList.remove("show","ok","error");el.textContent="";return;}
    el.className="photoValidationMsg show "+type;
    el.innerHTML=msg;
  }
  function setLoading(on,msg){
    state.loading=!!on;
    let box=$("#marketLoading");
    if(!box){box=document.createElement("div");box.id="marketLoading";box.className="marketLoading";document.body.appendChild(box)}
    box.innerHTML=`<div><span>🛍️</span><b>${esc(msg||"Cargando Mercado Escolar...")}</b><small>Sin pagos dentro de Cursapp · comunidad registrada</small></div>`;
    box.style.display=on?"grid":"none";
  }
  function requireSession(){
    state.session=getSession();
    if(!state.session.email){toast("Debes ingresar a Cursapp para usar Mercado Escolar");return false;}
    return true;
  }

  async function init(){
    setLoading(true,"Preparando Mercado Escolar...");
    state.sb=await waitSupabase();
    state.session=getSession();
    if(!state.sb){setLoading(false);renderError("Supabase no disponible. Revisa conexión.");return;}
    try{
      await Promise.all([loadCategories(),loadReasons(),loadBlockedWords()]);
      fillCategorySelect();
      renderCategoryRow();
      await loadPosts();
      await loadMinePosts();
      await loadFavorites();
      bind();
      const qs=new URLSearchParams(location.search);
      const boostId=qs.get("boost");
      if(boostId){state.pendingBoostId=boostId;showView("creditos");setTimeout(renderCreditVisibilityGuard,120);}
      setLoading(false);
    }catch(e){
      setLoading(false);
      renderError(e && e.message ? e.message : String(e));
    }
  }

  function renderError(msg){
    const f=$("#featuredList"), g=$("#marketGrid");
    const html=emptyState("⚠️","Mercado no disponible",msg||"Intenta nuevamente en unos segundos.","Volver a Cursapp","");
    if(f) f.innerHTML=html; if(g) g.innerHTML=html;
  }

  async function loadCategories(){
    let r=await state.sb.from("mercado_categorias").select("*").eq("activo",true).order("nombre",{ascending:true});
    if(r.error) r=await state.sb.from("mercado_categorias").select("*").order("nombre",{ascending:true});
    state.categories=(r.data&&r.data.length?r.data:DEFAULT_CATS.map((c,i)=>({id:null,...c,activo:true,orden:i+1})));
  }
  async function loadReasons(){
    const r=await state.sb.from("mercado_motivos_reporte").select("*").eq("activo",true).order("orden",{ascending:true});
    if(!r.error && r.data && r.data.length) state.reasons=r.data;
  }
  async function loadBlockedWords(){
    const r=await state.sb.from("mercado_palabras_bloqueadas").select("palabra").eq("activo",true);
    if(!r.error && r.data && r.data.length) state.blocked=r.data.map(x=>String(x.palabra||"").toLowerCase()).filter(Boolean);
  }
  async function loadFavorites(){
    if(!state.session.email) return;
    const r=await state.sb.from("mercado_favoritos").select("publicacion_id").eq("usuario_id",state.session.email);
    if(!r.error) state.favorites=new Set((r.data||[]).map(x=>String(x.publicacion_id)));
    renderProducts(); renderMine();
  }

  function fillCategorySelect(){
    const sel=$("#pubCategory"); if(!sel) return;
    sel.innerHTML=state.categories.map(c=>`<option value="${esc(c.id||c.nombre)}" data-name="${esc(c.nombre)}">${esc(c.icono||"")} ${esc(c.nombre)}</option>`).join("");
  }
  function renderCategoryRow(){
    const row=$(".categoryRow"); if(!row) return;
    const defs=[
      {nombre:"Deportes",icono:"⚽"},
      {nombre:"Instrumentos",icono:"🎵",label:"Música"},
      {nombre:"Libros",icono:"📚"},
      {nombre:"Uniformes",icono:"👔"},
      {nombre:"Otros",icono:"📦"}
    ];
    const cats=defs.map(d=>{
      const found=state.categories.find(x=>String(x.nombre).toLowerCase().includes(String(d.nombre).toLowerCase()));
      return found?{...found,icono:d.icono,label:d.label||found.nombre}:{...d,label:d.label||d.nombre};
    });
    row.innerHTML=cats.map(c=>`<article data-cat="${esc(c.nombre)}"><span>${esc(c.icono||"🛍️")}</span><b>${esc(c.label||c.nombre)}</b></article>`).join("")+`<article data-view="explorar"><span>▦</span><b>Ver todas</b></article>`;
  }
  function categoryById(id){return state.categories.find(c=>String(c.id)===String(id))||null;}
  function categoryName(p){return p.categoria_nombre||categoryById(p.categoria_id)?.nombre||"Otros";}
  function categoryIconByName(name){return (state.categories.find(c=>String(c.nombre).toLowerCase()===String(name).toLowerCase())||{}).icono||"🛍️";}

  async function loadPosts(){
    let query=state.sb.from("mercado_publicaciones").select("*").eq("activo",true).in("estado",["activo","disponible","reservado"]);
    query=query.order("destacado",{ascending:false}).order("created_at",{ascending:false}).limit(120);
    const {data,error}=await query;
    if(error){renderError("No se pudieron cargar publicaciones: "+error.message);return;}
    state.posts=data||[];
    await loadImagesForPosts();
    renderProducts();
    renderMine();
  }
  async function loadImagesForPosts(){
    state.imagesByPost={};
    const ids=state.posts.map(p=>p.id).filter(Boolean);
    if(!ids.length) return;
    const r=await state.sb.from("mercado_imagenes").select("*").in("publicacion_id",ids).order("orden",{ascending:true});
    if(r.error) return;
    (r.data||[]).forEach(i=>{const k=String(i.publicacion_id);state.imagesByPost[k]=state.imagesByPost[k]||[];state.imagesByPost[k].push(i);});
  }

  async function loadImagesForIds(ids){
    const clean=Array.from(new Set((ids||[]).filter(Boolean).map(String))).filter(id=>!state.imagesByPost[id]);
    if(!clean.length) return;
    const r=await state.sb.from("mercado_imagenes").select("*").in("publicacion_id",clean).order("orden",{ascending:true});
    if(r.error) return;
    (r.data||[]).forEach(i=>{const k=String(i.publicacion_id);state.imagesByPost[k]=state.imagesByPost[k]||[];state.imagesByPost[k].push(i);});
  }
  function isMine(p){
    const email=String(state.session?.email||"").toLowerCase();
    const uid=String(state.session?.userId||"");
    const phone=phoneClean(state.session?.phone||"");
    return (!!email && String(p.vendedor_email||"").toLowerCase()===email)
      || (!!email && String(p.usuario_id||"").toLowerCase()===email)
      || (!!uid && String(p.usuario_id||"")===uid)
      || (!!uid && String(p.vendedor_id||"")===uid)
      || (!!phone && phoneClean(p.whatsapp||p.vendedor_whatsapp||"")===phone);
  }
  async function loadMinePosts(){
    state.minePosts=[];
    if(!state.session?.email && !state.session?.userId) return;
    const found=new Map();
    const queries=[];
    if(state.session.email){
      queries.push(state.sb.from("mercado_publicaciones").select("*").eq("usuario_id",state.session.email).neq("estado","eliminado").order("created_at",{ascending:false}).limit(100));
    }
    if(state.session.userId){
      queries.push(state.sb.from("mercado_publicaciones").select("*").eq("usuario_id",state.session.userId).neq("estado","eliminado").order("created_at",{ascending:false}).limit(100));
      if(isUuid(state.session.userId)) queries.push(state.sb.from("mercado_publicaciones").select("*").eq("vendedor_id",state.session.userId).neq("estado","eliminado").order("created_at",{ascending:false}).limit(100));
    }
    const res=await Promise.allSettled(queries);
    res.forEach(x=>{if(x.status==="fulfilled" && !x.value.error) (x.value.data||[]).forEach(p=>found.set(String(p.id),p));});
    // fallback: cualquier publicación visible ya cargada que pertenezca al usuario
    state.posts.filter(isMine).forEach(p=>found.set(String(p.id),p));
    state.minePosts=Array.from(found.values()).sort((a,b)=>Date.parse(b.created_at||0)-Date.parse(a.created_at||0));
    await loadImagesForIds(state.minePosts.map(p=>p.id));
  }
  function postUrl(p){return `${location.origin}/mercado-escolar/publicacion.html?id=${encodeURIComponent(p.id)}`;}
  function shareText(p){
    const price=Number(p.precio||0)===0?"Intercambio":clp(p.precio);
    return `Hola 👋

Vi esta publicación en Mercado Escolar Cursapp.

📦 ${p.titulo||"Publicación"}
💰 ${price}

🔗 ${postUrl(p)}`;
  }

  function imageForPost(p){
    // En QA se subieron placeholders verdes antiguos; para pruebas visuales los reemplazamos por fallback neutro.
    const t=String(p.titulo||"");
    const isQaPlaceholder=/^QA_|Mercado palabra bloqueada/i.test(t);
    if(!isQaPlaceholder && p.imagen_principal) return p.imagen_principal;
    const imgs=state.imagesByPost[String(p.id)]||[];
    if(!isQaPlaceholder && imgs[0]?.url_imagen) return imgs[0].url_imagen;
    const name=categoryName(p);
    const map={Libros:"libros.svg",Uniformes:"poleron.svg",Vestuario:"vestido.svg",Deportes:"balon.svg",Tecnología:"mochila.svg",Instrumentos:"generic.svg",Servicios:"generic.svg",Otros:"generic.svg","Útiles escolares":"generic.svg"};
    return "assets/img/"+(map[name]||"generic.svg");
  }
  function emptyState(icon,title,text,button,view){return `<div class="emptyState"><div class="emptyIcon">${icon}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${button?`<button data-view="${esc(view||"publicar")}">${esc(button)}</button>`:""}</div>`;}
  function postStatus(p){return String(p?.estado||"activo").toLowerCase();}
  function isClosedPost(p){return ["vendido","intercambiado"].includes(postStatus(p));}
  function isActiveMarketPost(p){return !["eliminado","oculto","vendido","intercambiado","bloqueado","en_revision"].includes(postStatus(p));}
  function boostUntil(p){const id=String(p?.id||''); if(id && recentlyBoosted.has(id)) return recentlyBoosted.get(id).until||null; return p?.destacado_hasta||p?.destacada_hasta||p?.vence_at||p?.fecha_fin||p?.fecha_expiracion||null;}
  function activeBoostRule(p){const id=String(p?.id||''); if(id && recentlyBoosted.has(id)) return String(recentlyBoosted.get(id).rule||'').toLowerCase(); return String(p?.tipo_destacado||p?.destacado_tipo||p?.regla_destacado||p?.regla||p?.tipo||'').toLowerCase();}
  function boostPriority(rule){return boostRuleInfo(rule).priority||0;}
  function boostCost(rule){return boostRuleInfo(rule).cost||0;}
  function isBoosted(p){
    const id=String(p?.id||'');
    if(id && recentlyBoosted.has(id)){
      const rb=recentlyBoosted.get(id)||{};
      if(!rb.until || Date.parse(rb.until)>Date.now()) return true;
      recentlyBoosted.delete(id);
    }
    const until=boostUntil(p);
    const t=until ? Date.parse(until) : NaN;
    const truthy=v=>v===true || String(v).toLowerCase()==='true' || v===1 || String(v)==='1';
    const flag=!!(truthy(p?.destacado)||truthy(p?.destacada)||p?.destacado_tipo||p?.tipo_destacado||p?.regla_destacado||Number(p?.creditos_usados||0)>0);
    return flag && (!until || Number.isNaN(t) || t>Date.now());
  }
  function canBoost(p){ return isActiveMarketPost(p) && !isBoosted(p); }
  function isOwnerViewPost(p){ return isMine(p); }
  function boostedRank(p){return isBoosted(p) ? (boostPriority(activeBoostRule(p))||1) : 0;}
  function visible(list=state.posts){return list.filter(isActiveMarketPost)}
  function relDate(p){
    try{
      const d=new Date(p.created_at||Date.now()); const diff=Math.max(0,Date.now()-d.getTime());
      const days=Math.floor(diff/86400000);
      if(days<=0) return "Hoy"; if(days===1) return "Ayer"; if(days<7) return `Hace ${days} días`;
      return d.toLocaleDateString("es-CL",{day:"2-digit",month:"short"});
    }catch(e){return "Hoy"}
  }
  function card(p){
    const price=Number(p.precio||0)===0?"Intercambio":clp(p.precio);
    const title=p.titulo||"Publicación";
    const fav=state.favorites.has(String(p.id));
    return `<article class="productCard v6ProductCard ${isBoosted(p)?'isBoosted':''}" data-post="${esc(p.id)}">
      <div class="productImageWrap">${isBoosted(p)?`<span class="boostStar" title="Destacado">⭐</span>`:""}<img src="${esc(imageForPost(p))}" alt="${esc(title)}" onerror="this.src='assets/img/generic.svg'"><button class="favBtn ${fav?"on":""}" data-fav="${esc(p.id)}" title="Favorito">${fav?"♥":"♡"}</button></div>
      <div class="productBody"><b>${esc(title)}</b><strong>${price}</strong><span>${esc(p.curso_id?"Colegio Central":"Comunidad")}</span><div class="productMeta"><small>${esc(categoryName(p))}</small><small>${esc(relDate(p))}</small></div></div>
    </article>`;
  }
  function renderProducts(list=visible()){
    const f=$("#featuredList"), g=$("#marketGrid"), recent=$("#marketRecentList");
    const ranked=list.slice().sort((a,b)=>(boostedRank(b)-boostedRank(a))||Date.parse(b.created_at||0)-Date.parse(a.created_at||0));
    const empty=emptyState("🛍️","Aún no hay publicaciones","Cuando los apoderados publiquen artículos, aparecerán acá.","Publicar primer aviso","publicar");
    if(f) f.innerHTML=ranked.length?ranked.slice(0,6).map(card).join(""):empty;
    if(g) g.innerHTML=ranked.length?ranked.map(card).join(""):empty;
    if(recent){
      const rows=ranked.slice(0,4);
      recent.innerHTML=rows.length?rows.map(p=>{const price=Number(p.precio||0)===0?"Intercambio":clp(p.precio); const fav=state.favorites.has(String(p.id)); return `<article class="recentItem" data-post="${esc(p.id)}"><img src="${esc(imageForPost(p))}" onerror="this.src='assets/img/generic.svg'"><div><b>${esc(p.titulo||"Publicación")}</b><span>${esc(categoryName(p))}</span><strong>${price}</strong></div><button data-fav="${esc(p.id)}" class="favBtn ${fav?"on":""}">${fav?"♥":"♡"}</button></article>`}).join(""):"";
    }
  }
  function renderMine(filter){
    const box=$("#myPosts"); if(!box) return;
    const all=(state.minePosts.length?state.minePosts:state.posts.filter(isMine)).filter(p=>!["eliminado"].includes(String(p.estado||"").toLowerCase()));
    const current=filter || box.dataset.mineFilter || "activos";
    box.dataset.mineFilter=current;
    const estado=p=>String(p.estado||"disponible").toLowerCase();
    const vendidos=all.filter(p=>estado(p)==="vendido");
    const intercambiados=all.filter(p=>estado(p)==="intercambiado");
    const activos=all.filter(p=>!["vendido","intercambiado","oculto","bloqueado","en_revision"].includes(estado(p)));
    const list=current==="vendidos"?vendidos:(current==="intercambiados"?intercambiados:activos);
    const tabs=`<div class="mineTabs v27MineTabs">
      <button class="${current==='activos'?'active':''}" data-mine-filter="activos">Activos <span>${activos.length}</span></button>
      <button class="${current==='vendidos'?'active':''}" data-mine-filter="vendidos">Vendidos <span>${vendidos.length}</span></button>
      <button class="${current==='intercambiados'?'active':''}" data-mine-filter="intercambiados">Intercambiados <span>${intercambiados.length}</span></button>
    </div>`;
    const empty=emptyState("📦", current==="activos"?"Aún no tienes avisos activos":(current==="vendidos"?"Aún no tienes vendidos":"Aún no tienes intercambiados"), "Tus publicaciones aparecerán organizadas aquí.", current==="activos"?"Publicar aviso":"", "publicar");
    function rowActions(p){
      const id=esc(p.id); const st=estado(p);
      if(current==='activos'){
        return `<div class="mineChipActions v28Actions">
          <button type="button" class="softChip" data-status="vendido" data-id="${id}">✓ Vendido</button>
          <button type="button" class="softChip" data-status="intercambiado" data-id="${id}">⇄ Intercambiar</button>
        </div>`;
      }
      return `<div class="mineChipActions v28Actions"><button type="button" class="softChip" data-status="disponible" data-id="${id}">Reactivar</button></div>`;
    }
    function card(p){
      const id=esc(p.id); const boosted=isBoosted(p); const closed=["vendido","intercambiado"].includes(estado(p));
      const title=esc(p.titulo||"Publicación"); const price=Number(p.precio||0)===0?"Intercambio":clp(p.precio);
      const badge=boosted?`<small class="ownerBoostInfo v28OwnerBoost">⭐ ${esc(boostRuleInfo(activeBoostRule(p)).label)} · ${daysLeft(boostUntil(p))} día(s)</small>`:(current==='activos'?`<button type="button" class="miniBoostLink v28BoostBtn" data-open-boost-modal="${id}">⭐ Destacar</button>`:``);
      return `<article class="minePostCard v27MineCard v28MineCard ${estado(p)} ${boosted?'is-boosted':''}">
        <div class="mineCardHead v28CardHead">
          <img src="${esc(imageForPost(p))}" onerror="this.src='assets/img/generic.svg'">
          <div class="mineInfo v28MineInfo">
            <b>${title}</b>
            <strong>${price}</strong>
            <span>${esc(estado(p))} · ${esc(p.tipo||'Aviso')} · ${Number(p.vistas||0)} vistas · ${Number(p.contactos||0)} contactos</span>
            ${badge}
          </div>
          <div class="mineIconActions v28IconActions">
            <button class="iconAction" data-open-detail="${id}" title="Ver">👁️</button>
            ${(!closed&&current==='activos')?`<button class="iconAction" data-share="${id}" title="Compartir">↗️</button>`:''}
            <button class="iconAction" data-mine-options="${id}" title="Opciones">⋯</button>
          </div>
        </div>
        ${rowActions(p)}
      </article>`;
    }
    box.innerHTML=tabs+`<div class="v27MineList">${list.map(card).join("") || empty}</div>`;
  }
  async function reloadAll(preserveMineFilter=true){
    try{
      await loadPosts();
      await loadMinePosts();
      renderProducts();
      renderMine(preserveMineFilter ? (document.getElementById('myPosts')?.dataset.mineFilter||"activos") : "activos");
      renderCreditVisibilityGuard();
      if(window.CursappMarketCredits?.refresh) await window.CursappMarketCredits.refresh();
      if(window.CursappMarketCredits?.renderHistory) window.CursappMarketCredits.renderHistory();
    }catch(e){ console.warn('reloadAll mercado', e); }
  }

  function showView(v){
    $$(".view").forEach(x=>x.classList.remove("active"));
    $("#view-"+v)?.classList.add("active");
    $$(".bottomBar button").forEach(x=>x.classList.toggle("active",x.dataset.view===v));
    if(v==="mis") renderMine();
    if(v==="creditos") setTimeout(renderCreditVisibilityGuard,120);
  }
  function search(q){q=String(q||"").toLowerCase().trim();const list=!q?visible():visible().filter(p=>String((p.titulo||"")+" "+categoryName(p)+" "+(p.descripcion||"")).toLowerCase().includes(q));renderProducts(list);}
  function filterCat(cat){showView("explorar"); renderProducts(visible().filter(p=>categoryName(p)===cat));}

  function validateFiles(files){
    const arr=Array.from(files||[]);
    if(arr.length>MAX_FILES) return {ok:false,msg:`<b>Máximo ${MAX_FILES} fotos.</b><br>Ya tienes ${state.selectedFiles.length} seleccionada(s). Elimina una o selecciona menos imágenes.`};
    for(const file of arr){
      const name=esc(file.name||"imagen");
      if(!ALLOWED.includes(file.type) || !ALLOWED_EXT.test(file.name)) return {ok:false,msg:`<b>Formato no permitido.</b><br>${name} no es válido. Usa solo imágenes JPG, PNG o WEBP.`};
      if(file.size>MAX_BYTES) return {ok:false,msg:`<b>Imagen demasiado pesada.</b><br>${name} pesa ${(file.size/1024).toFixed(0)} KB. Máximo permitido: ${Math.round(MAX_BYTES/1024)} KB por foto.`};
    }
    return {ok:true,files:arr};
  }
  function fileKey(f){return `${f.name}|${f.size}|${f.lastModified}`;}
  function mergeSelectedFiles(newFiles){
    const map=new Map();
    [...state.selectedFiles,...Array.from(newFiles||[])].forEach(f=>map.set(fileKey(f),f));
    return Array.from(map.values()).slice(0,MAX_FILES+1);
  }
  function renderPreview(files=state.selectedFiles){
    const box=$("#photoPreview"); if(!box) return;
    if(!files.length){
      box.innerHTML=`<p><b>Agrega hasta ${MAX_FILES} fotos reales.</b><br>La primera será la principal. Puedes seleccionar una o varias fotos. Máx. ${Math.round(MAX_BYTES/1024)} KB c/u.</p>`;
      return;
    }
    box.innerHTML=files.map((f,i)=>`<div class="photoPreviewItem"><img src="${URL.createObjectURL(f)}"><small>${i+1}</small><button type="button" data-remove-photo="${i}" aria-label="Quitar foto">×</button></div>`).join("") + `<p class="photoHelp">${files.length}/${MAX_FILES} fotos seleccionadas · toca × para quitar una.</p>`;
  }
  async function uploadImages(postId,files){
    const uploaded=[];
    for(let i=0;i<files.length;i++){
      const file=files[i];
      const ext=(file.name.split(".").pop()||"jpg").toLowerCase();
      const path=`${postId}/${Date.now()}_${i}.${ext}`;
      const up=await state.sb.storage.from(BUCKET).upload(path,file,{cacheControl:"3600",upsert:false,contentType:file.type});
      if(up.error) throw up.error;
      const pub=state.sb.storage.from(BUCKET).getPublicUrl(path);
      const url=pub.data.publicUrl;
      uploaded.push({publicacion_id:postId,url_imagen:url,orden:i+1});
    }
    if(uploaded.length){
      await state.sb.from("mercado_imagenes").insert(uploaded);
      await state.sb.from("mercado_publicaciones").update({imagen_principal:uploaded[0].url_imagen,updated_at:now()}).eq("id",postId);
    }
    return uploaded;
  }
  function detectViolation(title,desc){
    const txt=String(title+" "+desc).toLowerCase();
    const hit=state.blocked.find(w=>w && txt.includes(w));
    return hit ? {blocked:true,word:hit,reason:`Palabra restringida detectada: ${hit}`} : {blocked:false};
  }

  function fillPublishForm(post){
    if(!post) return;
    state.editingPostId=post.id;
    const set=(sel,val)=>{const el=$(sel); if(el) el.value=val??'';};
    set('#pubTitle',post.titulo||'');
    set('#pubDesc',post.descripcion||'');
    set('#pubPrice',Number(post.precio||0));
    set('#pubWhatsapp',post.whatsapp||state.session.phone||'');
    set('#pubType',post.tipo||'Venta');
    set('#pubScope',post.visibilidad||'mi_comuna');
    const cat=categoryName(post);
    const catObj=state.categories.find(c=>String(c.nombre)===String(cat)||String(c.id)===String(post.categoria_id));
    if(catObj) set('#pubCategory',catObj.id||catObj.nombre);
    state.selectedFiles=[];
    renderPreview([]);
    const title=$('#view-publicar h2');
    if(title) title.textContent='Editar aviso';
    const submit=$('#postForm button[type="submit"], #postForm .primaryBtn');
    if(submit) submit.textContent='Guardar cambios';
    showView('publicar');
    setTimeout(()=>window.scrollTo({top:0,behavior:'smooth'}),40);
  }
  function editPost(id){
    const p=state.minePosts.find(x=>String(x.id)===String(id))||state.posts.find(x=>String(x.id)===String(id));
    if(!p){toast('No encontré el aviso para editar.');return;}
    if(["vendido","intercambiado","eliminado"].includes(String(p.estado||'').toLowerCase())){toast('Solo puedes editar avisos activos.');return;}
    fillPublishForm(p);
  }

  async function publish(e){
    e.preventDefault();
    if(!requireSession()) return;
    const title=$("#pubTitle").value.trim(), desc=$("#pubDesc").value.trim();
    if(!title||!desc){toast("Completa título y descripción");return;}
    const fileCheck=validateFiles(state.selectedFiles||[]);
    if(!fileCheck.ok){photoMessage(fileCheck.msg,"error");toast("Revisa las fotos seleccionadas");return;}
    const catId=$("#pubCategory").value;
    const selectedCat=categoryById(catId)||state.categories.find(c=>String(c.nombre)===String(catId))||state.categories[0];
    const whatsapp=phoneClean($("#pubWhatsapp")?.value||state.session.phone||"");
    const violation=detectViolation(title,desc);
    const row={
      curso_id:isUuid(state.session.courseId)?state.session.courseId:null,
      colegio_id:isUuid(state.session.colegioId)?state.session.colegioId:null,
      categoria_id:isUuid(selectedCat?.id)?selectedCat.id:null,
      titulo:title,
      descripcion:desc,
      precio:Number($("#pubPrice").value||0),
      // Regla V4: toda publicación queda disponible por defecto.
      // Si se detecta una palabra restringida, se deja una alerta para Admin,
      // pero no se oculta automáticamente salvo acción del Admin o denuncias acumuladas.
      estado:"activo",
      nombre_vendedor:state.session.name,
      // vendedor_email se omite: la tabla productiva no tiene esa columna.
      usuario_id:state.session.userId||state.session.email||null,
      whatsapp,
      activo:true,
      destacado:false,
      visualizaciones:0,
      contactos:0,
      favoritos:0,
      visibilidad:$("#pubScope").value,
      tipo:$("#pubType").value,
      motivo_moderacion:violation.blocked?violation.reason:null
    };
    if(isUuid(state.session.userId)) row.vendedor_id=state.session.userId;
    const insertPost=async(payload)=>{
      let cleaned={...payload};
      for(let attempt=0; attempt<4; attempt++){
        const res=await state.sb.from("mercado_publicaciones").insert([cleaned]).select("*").single();
        if(!res.error) return res;
        const msg=String(res.error.message||"");
        const m=msg.match(/'([^']+)' column of 'mercado_publicaciones'/i) || msg.match(/column "([^"]+)"/i);
        if(m && cleaned[m[1]]!==undefined){
          delete cleaned[m[1]];
          continue;
        }
        return res;
      }
      return await state.sb.from("mercado_publicaciones").insert([cleaned]).select("*").single();
    };
    if(state.editingPostId){
      const editId=state.editingPostId;
      const updatePayload={...row,updated_at:now()};
      delete updatePayload.usuario_id;
      delete updatePayload.vendedor_id;
      delete updatePayload.visualizaciones;
      delete updatePayload.contactos;
      delete updatePayload.favoritos;
      delete updatePayload.destacado;
      delete updatePayload.activo;
      let upd=await updatePostFlex(editId,updatePayload);
      if(upd.error){toast("No se pudo editar: "+upd.error.message);return;}
      if((state.selectedFiles||[]).length){try{await uploadImages(editId,state.selectedFiles||[]);}catch(uploadErr){toast("Cambios guardados, pero falló imagen: "+uploadErr.message);}}
      state.editingPostId=null;
      e.target.reset(); state.selectedFiles=[]; renderPreview([]);
      const titleEl=$('#view-publicar h2'); if(titleEl) titleEl.textContent='Publicar aviso';
      const submit=$('#postForm button[type="submit"], #postForm .primaryBtn'); if(submit) submit.textContent='Publicar aviso';
      await loadPosts(); await loadMinePosts();
      toast("Aviso actualizado");
      showView("mis");
      return;
    }
    const {data,error}=await insertPost(row);
    if(error){toast("No se pudo publicar: "+error.message);return;}
    try{await uploadImages(data.id,state.selectedFiles||[]);}catch(uploadErr){toast("Publicación creada, pero falló imagen: "+uploadErr.message);}
    e.target.reset(); state.selectedFiles=[]; renderPreview([]);
    await loadPosts();
    await loadMinePosts();
    toast(violation.blocked?"Publicación creada con alerta para revisión del Admin":"Publicación creada");
    showView("mis");
  }

  async function openDetail(id){
    const p=state.posts.find(x=>String(x.id)===String(id)) || state.minePosts.find(x=>String(x.id)===String(id)); if(!p) return;
    await state.sb.from("mercado_publicaciones").update({visualizaciones:Number(p.visualizaciones||0)+1}).eq("id",p.id);
    p.visualizaciones=Number(p.visualizaciones||0)+1;
    const imgs=(state.imagesByPost[String(p.id)]||[]).map(i=>i.url_imagen).filter(Boolean);
    const main=imageForPost(p);
    const gallery=[main].concat(imgs.filter(u=>u!==main)).slice(0,3);
    const price=Number(p.precio||0)===0?"Intercambio":clp(p.precio);
    const fav=state.favorites.has(String(p.id));
    $("#modal").innerHTML=`<div class="v6DetailOverlay"><article class="v6DetailSheet v13DetailSheet">
      <div class="v6DetailTop"><button class="v6IconBack" onclick="document.getElementById('modal').innerHTML=''">←</button><b>Detalle del aviso</b><button class="v6IconBack" data-share="${esc(p.id)}">⇧</button></div>
      <div class="v13Gallery"><div class="v13GalleryTrack">${gallery.map(u=>`<figure><img src="${esc(u)}" onerror="this.src='assets/img/generic.svg'"></figure>`).join("")}</div><div class="v6Dots">${gallery.map((_,i)=>`<span class="${i===0?'active':''}"></span>`).join("")}</div></div>
      <div class="v6DetailBody">${isBoosted(p)?(isMine(p)?`<em class="boostBadge detailBoost ownerOnly">⭐ ${esc(boostRuleInfo(activeBoostRule(p)).label)} · quedan ${daysLeft(boostUntil(p))} día(s)</em>`:`<em class="boostBadge detailBoost publicOnly">⭐ Destacado</em>`):""}<small class="v6Cat">${esc(categoryName(p))}</small><h2>${esc(p.titulo)}</h2><strong class="v6Price">${price}</strong>
      <div class="v6Chips"><span>✓ Disponible</span><span>⌖ ${esc(p.curso_id?"Colegio Central":"Comunidad")}</span><span>${esc(relDate(p))}</span></div>
      <p>${esc(p.descripcion||"")}</p>
      <div class="v6Seller"><span>${esc((p.nombre_vendedor||"Apoderado Cursapp").slice(0,2).toUpperCase())}</span><div><b>${esc(p.nombre_vendedor||"Apoderado Cursapp")}</b><small>Comunidad registrada</small></div></div>
      <button class="v6Whatsapp" data-contact="${esc(p.id)}">Contactar por WhatsApp</button>
      <button class="v6Ghost" data-share="${esc(p.id)}">Compartir aviso</button>
      <button class="v6Ghost" data-fav="${esc(p.id)}">${fav?"♥ Quitar favorito":"♡ Guardar favorito"}</button>
      ${isMine(p) && canBoost(p) ? `<button class="v6BoostBtn" data-open-boost-modal="${esc(p.id)}">⭐ Destacar con créditos</button>` : (isMine(p) && isBoosted(p) ? `<div class="ownerBoostBox">⭐ Ya está destacado · vence en ${daysLeft(boostUntil(p))} día(s)</div>` : "")}
      ${!isMine(p) ? `<button class="v6Danger" data-report="${esc(p.id)}">🚩 Reportar publicación</button>` : ""}</div>
    </article></div>`;
  }
  function activeMinePosts(){
    const all=(state.minePosts.length?state.minePosts:state.posts.filter(isMine)).filter(p=>isActiveMarketPost(p) && !isBoosted(p));
    return all.sort((a,b)=>Date.parse(b.created_at||0)-Date.parse(a.created_at||0));
  }

  function openMineOptions(id){
    const p=state.minePosts.find(x=>String(x.id)===String(id))||state.posts.find(x=>String(x.id)===String(id));
    if(!p){toast('No encontré el aviso.');return;}
    const st=String(p.estado||'activo').toLowerCase();
    const closed=["vendido","intercambiado","eliminado"].includes(st);
    const canAct=!closed && isActiveMarketPost(p);
    document.getElementById('modal').innerHTML=`<div class="v19ConfirmOverlay"><section class="v19Confirm mineOptionsSheet"><h2>Opciones del aviso</h2><div class="boostConfirmCard"><p>Publicación</p><b>${esc(p.titulo||'Publicación')}</b><p class="muted">${esc(st)} · ${Number(p.visualizaciones||p.vistas||0)} vistas · ${Number(p.contactos||0)} contactos</p></div><div class="mineOptionList"><button type="button" data-open-detail="${esc(id)}">👁️ Ver detalle</button>${canAct?`<button type="button" data-edit="${esc(id)}">✏️ Editar aviso</button><button type="button" data-open-boost-modal="${esc(id)}">⭐ ${isBoosted(p)?'Ver destacado':'Destacar con créditos'}</button>`:''}<button type="button" class="danger" data-delete="${esc(id)}">🗑️ Eliminar aviso</button></div><div class="v19ConfirmActions"><button type="button" class="ghost" onclick="document.getElementById('modal').innerHTML=''">Cerrar</button></div></section></div>`;
  }

  function renderCreditVisibilityGuard(){
    const sel=document.getElementById("boostPostSelect");
    const box=document.getElementById("boostOptions");
    if(!sel) return;
    const active=activeMinePosts();
    sel.innerHTML=active.length
      ? active.map(p=>`<option value="${esc(p.id)}">${esc(p.titulo||"Publicación")}</option>`).join("")
      : `<option value="">Publica un aviso activo primero</option>`;
    if(state.pendingBoostId && active.some(p=>String(p.id)===String(state.pendingBoostId))) sel.value=state.pendingBoostId;
    sel.disabled=!active.length;
    if(box){
      box.innerHTML=`
        <article class="boostOption"><b>Destacado colegio</b><strong>1 crédito · 7 días</strong><span>Primero en tu colegio</span><button type="button" data-boost-rule="colegio" data-cost="1">Destacar</button></article>
        <article class="boostOption"><b>Destacado comuna</b><strong>3 créditos · 7 días</strong><span>Prioridad sobre avisos de la comuna</span><button type="button" data-boost-rule="comuna" data-cost="3">Destacar</button></article>
        <article class="boostOption"><b>Todo Cursapp</b><strong>5 créditos · 7 días</strong><span>Máxima prioridad en el marketplace</span><button type="button" data-boost-rule="cursapp" data-cost="5">Destacar</button></article>`;
      box.querySelectorAll("button").forEach(btn=>{
        btn.disabled=!active.length;
        btn.classList.toggle("isDisabled",!active.length);
      });
      if(!active.length && !document.getElementById("creditNoActiveMsg")){
        box.insertAdjacentHTML("beforebegin",`<div id="creditNoActiveMsg" class="creditHelpBox">Solo puedes destacar publicaciones <b>activas</b>. Las publicaciones vendidas o intercambiadas no pueden usar créditos.</div>`);
      }
      if(active.length) document.getElementById("creditNoActiveMsg")?.remove();
    }
  }
  async function insertFlex(table,row){
    let cleaned={...row};
    for(let attempt=0; attempt<8; attempt++){
      const res=await state.sb.from(table).insert([cleaned]).select("*").maybeSingle();
      if(!res.error) return res;
      const msg=String(res.error.message||"");
      const m=msg.match(/'([^']+)' column of '[^']+' in the schema cache/i) || msg.match(/column "([^"]+)"/i);
      if(m && cleaned[m[1]]!==undefined){delete cleaned[m[1]]; continue;}
      return res;
    }
    return await state.sb.from(table).insert([cleaned]).select("*").maybeSingle();
  }
  function marketConfirm({title="Confirmar",body="",ok="Aceptar",cancel="Cancelar",danger=false}={}){
    return new Promise(resolve=>{
      const modal=document.getElementById("modal");
      if(!modal){ resolve(confirm(title)); return; }
      modal.innerHTML=`<div class="v19ConfirmOverlay"><section class="v19Confirm"><h2>${esc(title)}</h2><div class="v19ConfirmBody">${body}</div><div class="v19ConfirmActions"><button type="button" class="ghost" data-confirm-no>${esc(cancel)}</button><button type="button" class="${danger?'dangerBtn':'primaryBtn'}" data-confirm-yes>${esc(ok)}</button></div></section></div>`;
      modal.querySelector('[data-confirm-no]')?.addEventListener('click',()=>{modal.innerHTML=''; resolve(false);},{once:true});
      modal.querySelector('[data-confirm-yes]')?.addEventListener('click',()=>{modal.innerHTML=''; resolve(true);},{once:true});
    });
  }
  async function updatePostFlex(id,row){
    let cleaned={...row};
    for(let attempt=0; attempt<10; attempt++){
      const res=await state.sb.from("mercado_publicaciones").update(cleaned).eq("id",id).select("*").maybeSingle();
      if(!res.error) return res;
      const msg=String(res.error.message||"");
      const m=msg.match(/'([^']+)' column of '[^']+' in the schema cache/i) || msg.match(/column "([^"]+)"/i);
      if(m && cleaned[m[1]]!==undefined){ delete cleaned[m[1]]; continue; }
      return res;
    }
    return state.sb.from("mercado_publicaciones").update(cleaned).eq("id",id).select("*").maybeSingle();
  }
  async function dbActiveBoost(publicacionId){
    const id=String(publicacionId||"");
    if(!id || !state.sb) return null;
    const activeWords=["activa","activo","vigente"];
    try{
      let r=await state.sb.from("publicaciones_destacadas")
        .select("*")
        .eq("publicacion_id",id)
        .in("estado",activeWords)
        .order("fecha_fin",{ascending:false})
        .limit(5);
      if(r.error){
        r=await state.sb.from("publicaciones_destacadas")
          .select("*")
          .eq("publicacion_id",id)
          .eq("activo",true)
          .limit(5);
      }
      const rows=(r.data||[]).filter(x=>{
        const until=x.fecha_fin||x.vence_at||x.destacado_hasta||x.hasta;
        return !until || Number.isNaN(Date.parse(until)) || Date.parse(until)>Date.now();
      });
      if(rows.length){
        const row=rows[0];
        return {
          rule:String(row.regla||row.tipo||row.tipo_destacado||row.destacado_tipo||row.destacado||"colegio").toLowerCase(),
          until:row.fecha_fin||row.vence_at||row.destacado_hasta||row.hasta||null,
          row
        };
      }
    }catch(e){}
    try{
      const r=await state.sb.from("mercado_publicaciones")
        .select("id,estado,destacado,destacada,destacado_hasta,destacada_hasta,tipo_destacado,destacado_tipo,regla_destacado,creditos_usados")
        .eq("id",id).maybeSingle();
      if(!r.error && r.data && isBoosted(r.data)){
        return {rule:activeBoostRule(r.data)||"colegio",until:boostUntil(r.data),row:r.data};
      }
    }catch(e){}
    return null;
  }
  function applyBoostToLocal(id, rule, until, extra={}){
    const payload={destacado:true,destacada:true,tipo_destacado:rule,destacado_tipo:rule,regla_destacado:rule,destacado_hasta:until,destacada_hasta:until, ...extra};
    recentlyBoosted.set(String(id),{rule,until});
    for(const arr of [state.posts,state.minePosts]){
      const x=arr.find(z=>String(z.id)===String(id));
      if(x) Object.assign(x,payload);
    }
  }
  async function recordCreditUse(publicacionId,rule,cost,ctx={}){
    const uid=state.session.userId||state.session.email;
    const email=state.session.email||null;
    const info=boostRuleInfo(rule);
    const until=ctx.until || new Date(Date.now()+info.days*86400000).toISOString();
    const before=Number(ctx.saldoAnterior ?? (window.CursappMarketCredits?.getBalance ? window.CursappMarketCredits.getBalance() : 0));
    const after=Math.max(0,before-Number(cost||0));
    const voucher=`CR-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Date.now()).slice(-6)}`;
    let spent={ok:true,balance:after};
    if(window.CursappMarketCredits && typeof window.CursappMarketCredits.spendCredits==="function"){
      spent=await window.CursappMarketCredits.spendCredits(Number(cost||0),{
        publicacion_id:publicacionId,
        publicacion_titulo:ctx.titulo||'',
        regla:rule,
        regla_label:info.label,
        dias:info.days,
        vence_at:until,
        saldo_anterior:before,
        saldo_posterior:after,
        voucher,
        descripcion:`${info.label} · ${ctx.titulo||'publicación'} · ${info.days} días`
      });
      if(!spent || spent.ok===false) return {ok:false,message:spent?.message||"No se pudieron descontar créditos."};
      // spendCredits ya registra movimiento, historial y voucher. Evita duplicados.

    }else{
      await insertFlex("movimientos_creditos",{usuario_id:uid,email,tipo:"uso",tipo_operacion:"uso",concepto:"destacado_mercado",cantidad:-Math.abs(Number(cost||0)),creditos:-Math.abs(Number(cost||0)),publicacion_id:publicacionId,publicacion_titulo:ctx.titulo||'',regla,regla_label:info.label,destacado_tipo:info.label,dias:info.days,vence_at:until,saldo_anterior:before,saldo_posterior:after,numero_voucher:voucher,voucher,descripcion:`${info.label} · ${ctx.titulo||'publicación'} · ${info.days} días`,created_at:now(),fecha:now()});
      await insertFlex("mercado_creditos_historial",{usuario_id:uid,email,tipo_operacion:"uso",operacion:"uso",creditos:-Math.abs(Number(cost||0)),publicacion_id:publicacionId,publicacion_titulo:ctx.titulo||'',destacado_tipo:info.label,dias:info.days,vence_at:until,saldo_anterior:before,saldo_posterior:after,voucher,descripcion:`${info.label} · ${ctx.titulo||'publicación'} · ${info.days} días`,fecha:now()});
    }
    await insertFlex("publicaciones_destacadas",{publicacion_id:publicacionId,usuario_id:uid,email,regla,tipo:rule,tipo_destacado:rule,creditos_usados:Number(cost||0),creditos:Number(cost||0),fecha_inicio:now(),fecha_fin:until,vence_at:until,estado:"activa",activo:true,created_at:now()});
    return {ok:true,until,voucher,saldoAnterior:before,saldoPosterior:after};
  }
  async function openBoostModal(id){
    const p=state.minePosts.find(x=>String(x.id)===String(id))||state.posts.find(x=>String(x.id)===String(id));
    if(!p || !isActiveMarketPost(p)){toast("Solo puedes destacar publicaciones activas.");return;}
    const existing=await dbActiveBoost(id);
    if(existing){
      applyBoostToLocal(id, existing.rule, existing.until, existing.row||{});
      renderProducts(); renderMine(document.getElementById('myPosts')?.dataset.mineFilter||"activos"); renderCreditVisibilityGuard();
    }
    if(isBoosted(p)){
      document.getElementById("modal").innerHTML=`<div class="v19ConfirmOverlay"><section class="v19Confirm"><h2>Publicación ya destacada</h2><div class="boostConfirmCard"><p>Publicación</p><b>${esc(p.titulo||'Publicación')}</b><p>Destacado actual</p><b>⭐ ${esc(boostRuleInfo(activeBoostRule(p)).label)}</b><p class="muted">Vence ${fmtDateTime(boostUntil(p))} · quedan ${daysLeft(boostUntil(p))} día(s)</p></div><div class="v19ConfirmActions"><button type="button" class="primaryBtn" onclick="document.getElementById('modal').innerHTML=''; window.CursappMarket&&window.CursappMarket.reload&&window.CursappMarket.reload();">Entendido</button></div></section></div>`;
      return;
    }
    if(window.CursappMarketCredits?.loadWallet) await window.CursappMarketCredits.loadWallet();
    const saldo=Number(window.CursappMarketCredits?.getBalance ? window.CursappMarketCredits.getBalance() : 0);
    const noCredits = saldo<=0;
    const options=Object.entries(BOOST_RULES).map(([rule,info])=>{
      const disabled = saldo < info.cost;
      return `<button type="button" class="boostChoice ${disabled?'disabled':''}" ${disabled?'disabled':''} data-direct-boost="${esc(id)}" data-rule="${esc(rule)}" data-cost="${info.cost}"><b>${esc(info.label)}</b><span>${info.cost} crédito(s) · ${info.days} días</span></button>`;
    }).join('');
    document.getElementById("modal").innerHTML=`<div class="v19ConfirmOverlay"><section class="v19Confirm boostPicker"><h2>Destacar publicación</h2><p class="muted">Elige dónde quieres promocionar tu aviso. Se descuenta solo al confirmar.</p><div class="boostConfirmCard"><p>Publicación</p><b>${esc(p.titulo||'Publicación')}</b><div class="creditSummary"><span>Saldo disponible</span><b>${saldo}</b></div></div>${noCredits?`<div class="creditHelpBox warn"><b>No tienes créditos disponibles.</b><br>Compra créditos para destacar esta publicación.</div><div class="v19ConfirmActions"><button type="button" class="primaryBtn" data-view="creditos" onclick="document.getElementById('modal').innerHTML=''">Comprar créditos</button></div>`:`<div class="boostChoices">${options}</div>`}<div class="v19ConfirmActions"><button type="button" class="ghost" onclick="document.getElementById('modal').innerHTML=''">Cancelar</button></div></section></div>`;
  }

  async function boostPost(rule,cost,idOverride){
    const sel=document.getElementById("boostPostSelect");
    const id=idOverride || sel?.value;
    if(!id){toast("Selecciona una publicación activa para destacar.");return;}
    if(boostInFlight.has(String(id))){toast("Ya estamos procesando este destacado.");return;}
    boostInFlight.add(String(id));
    try{
    const p=state.minePosts.find(x=>String(x.id)===String(id))||state.posts.find(x=>String(x.id)===String(id));
    if(!p || !isActiveMarketPost(p)){toast("Solo puedes destacar publicaciones activas.");return;}
    const existingDb=await dbActiveBoost(id);
    if(existingDb){
      applyBoostToLocal(id, existingDb.rule, existingDb.until, existingDb.row||{});
      renderProducts(); renderMine(document.getElementById('myPosts')?.dataset.mineFilter||"activos"); renderCreditVisibilityGuard();
      document.getElementById("modal").innerHTML=`<div class="v19ConfirmOverlay"><section class="v19Confirm"><h2>Publicación ya destacada</h2><div class="boostConfirmCard"><p>Publicación</p><b>${esc(p.titulo||'Publicación')}</b><p>Destacado actual</p><b>⭐ ${esc(boostRuleInfo(existingDb.rule).label)}</b><p class="muted">Vence ${fmtDateTime(existingDb.until)} · quedan ${daysLeft(existingDb.until)} día(s)</p></div><div class="v19ConfirmActions"><button type="button" class="primaryBtn" onclick="document.getElementById('modal').innerHTML=''">Entendido</button></div></section></div>`;
      return;
    }
    if(isBoosted(p)){
      toast(`Esta publicación ya tiene un destacado vigente. Vence el ${fmtDateTime(boostUntil(p))}.`);
      openBoostModal(id);
      return;
    }
    // Validación en Supabase para evitar doble descuento si la vista local quedó desactualizada.
    try{
      const fresh=await state.sb.from("mercado_publicaciones").select("id,estado,destacado,destacada,destacado_hasta,destacada_hasta,tipo_destacado,destacado_tipo,regla_destacado,creditos_usados").eq("id",id).maybeSingle();
      if(!fresh.error && fresh.data && isBoosted(fresh.data)){
        for(const arr of [state.posts,state.minePosts]){const x=arr.find(z=>String(z.id)===String(id)); if(x) Object.assign(x,fresh.data);}
        renderProducts(); renderMine("activos"); renderCreditVisibilityGuard();
        toast("Esta publicación ya tiene un destacado vigente.");
        openBoostModal(id);
        return;
      }
    }catch(e){}
    const newInfo=boostRuleInfo(rule);
    const costNum=Number(cost||newInfo.cost||1);
    if(window.CursappMarketCredits?.loadWallet) await window.CursappMarketCredits.loadWallet();
    const saldoActual=Number(window.CursappMarketCredits?.getBalance ? window.CursappMarketCredits.getBalance() : 0);
    if(saldoActual<costNum){
      document.getElementById("modal").innerHTML=`<div class="v19ConfirmOverlay"><section class="v19Confirm"><h2>No tienes créditos suficientes</h2><div class="boostConfirmCard"><p>Publicación</p><b>${esc(p.titulo||'Publicación')}</b><div class="creditSummary"><span>Saldo disponible</span><b>${saldoActual}</b></div><div class="creditSummary"><span>Costo</span><b>${costNum}</b></div></div><div class="v19ConfirmActions"><button type="button" class="primaryBtn" data-view="creditos" onclick="document.getElementById('modal').innerHTML=''">Comprar créditos</button><button type="button" class="ghost" onclick="document.getElementById('modal').innerHTML=''">Cancelar</button></div></section></div>`;
      return;
    }
    const until=new Date(Date.now()+newInfo.days*86400000).toISOString();
    const body=`<div class="boostConfirmCard"><p>Publicación</p><b>${esc(p.titulo||'Publicación')}</b><hr><p>Tipo de destacado</p><b>⭐ ${esc(newInfo.label)}</b><p class="muted">Duración: ${newInfo.days} días · vence ${fmtDateTime(until)}</p><div class="creditSummary"><span>Saldo actual</span><b>${saldoActual}</b></div><div class="creditSummary"><span>Costo</span><b>-${costNum}</b></div><div class="creditSummary strong"><span>Saldo posterior</span><b>${saldoActual-costNum}</b></div></div>`;
    const ok=await marketConfirm({title:'Confirmar destacado',body,ok:'Confirmar y usar créditos'});
    if(!ok) return;

    // Revalidación final: evita doble descuento si el usuario toca dos veces o viene desde Detalle.
    const existingAfterConfirm=await dbActiveBoost(id);
    if(existingAfterConfirm){
      applyBoostToLocal(id, existingAfterConfirm.rule, existingAfterConfirm.until, existingAfterConfirm.row||{});
      renderProducts(); renderMine(document.getElementById('myPosts')?.dataset.mineFilter||"activos"); renderCreditVisibilityGuard();
      toast("Esta publicación ya tiene un destacado vigente. No se descontaron créditos.");
      document.getElementById("modal").innerHTML=`<div class="v19ConfirmOverlay"><section class="v19Confirm"><h2>Publicación ya destacada</h2><div class="boostConfirmCard"><p>Publicación</p><b>${esc(p.titulo||'Publicación')}</b><p class="muted">Vigente hasta ${fmtDateTime(existingAfterConfirm.until)} · quedan ${daysLeft(existingAfterConfirm.until)} día(s)</p></div><div class="v19ConfirmActions"><button type="button" class="primaryBtn" onclick="document.getElementById('modal').innerHTML=''">Entendido</button></div></section></div>`;
      return;
    }

    // Primero marcamos la publicación. Si falla, no descontamos créditos.
    let r=await updatePostFlex(id,{destacado:true,destacada:true,destacado_desde:now(),destacado_hasta:until,destacada_hasta:until,tipo_destacado:rule,destacado_tipo:rule,regla_destacado:rule,creditos_usados:costNum,updated_at:now()});
    if(r.error){toast("No se pudo activar el destacado: "+r.error.message);return;}

    const spend=await recordCreditUse(id,rule,costNum,{titulo:p.titulo||'',until,saldoAnterior:saldoActual,saldoPosterior:saldoActual-costNum});
    if(!spend.ok){
      await updatePostFlex(id,{destacado:false,destacada:false,destacado_hasta:null,destacada_hasta:null,tipo_destacado:null,destacado_tipo:null,regla_destacado:null,creditos_usados:0,updated_at:now()});
      toast(spend.message||"No se pudo usar créditos.");
      return;
    }

    const updatedPayload={
      destacado:true,destacada:true,destacado_desde:now(),destacado_hasta:until,destacada_hasta:until,
      tipo_destacado:rule,destacado_tipo:rule,regla_destacado:rule,creditos_usados:costNum,updated_at:now()
    };
    applyBoostToLocal(id, rule, until, {...updatedPayload, ...(r.data||{})});

    // Refresco visual inmediato: actualiza Home, Mis avisos y Créditos antes de mostrar el OK.
    renderProducts();
    renderMine(document.getElementById('myPosts')?.dataset.mineFilter||"activos");
    renderCreditVisibilityGuard();
    if(window.CursappMarketCredits?.refresh) await window.CursappMarketCredits.refresh();
    if(window.CursappMarketCredits?.renderHistory) window.CursappMarketCredits.renderHistory();

    const successHtml=`<div class="v19ConfirmOverlay"><section class="v19Confirm successBoostModal"><h2>✅ Transacción exitosa</h2><div class="boostConfirmCard"><p>Publicación destacada</p><b>${esc(p.titulo||'Publicación')}</b><p>Tipo</p><b>⭐ ${esc(newInfo.label)}</b><p class="muted">Vigente hasta ${fmtDateTime(until)} · quedan ${daysLeft(until)} día(s)</p><div class="creditSummary"><span>Créditos usados</span><b>-${costNum}</b></div><div class="creditSummary strong"><span>Saldo disponible</span><b>${saldoActual-costNum}</b></div><p class="muted">Voucher: ${esc(spend.voucher||'registrado')}</p></div><div class="v19ConfirmActions"><button type="button" class="primaryBtn" data-close-success-boost>Entendido</button></div></section></div>`;
    document.getElementById("modal").innerHTML=successHtml;
    document.querySelector('[data-close-success-boost]')?.addEventListener('click',async()=>{
      document.getElementById('modal').innerHTML='';
      await reloadAll(true);
    },{once:true});
    toast(`Destacado activado: ${newInfo.label}`);

    // Segundo refresco corto para recoger lo que devuelva Supabase y evitar que el usuario tenga que moverse.
    setTimeout(()=>reloadAll(true),350);
    } finally {
      boostInFlight.delete(String(id));
    }
  }

  function creditHelp(){
    document.getElementById("modal").innerHTML=`<div class="modal rulesModal creditHelpModal"><h2>¿Qué es canjear visibilidad?</h2><p>Usas créditos para destacar una publicación activa y que aparezca con mayor prioridad.</p><p>• Solo aplica a publicaciones activas.</p><p>• No se puede usar en avisos vendidos o intercambiados.</p><p>• Colegio: 1 crédito por 7 días.</p><p>• Comuna: 3 créditos por 7 días.</p><p>• Todo Cursapp: 5 créditos por 7 días.</p><p>• Solo se permite un destacado vigente por publicación. Puedes mejorar de nivel pagando solo la diferencia.</p><p>• Las publicaciones vendidas o intercambiadas salen de Inicio, Destacados y Créditos.</p><button class="ghost" onclick="document.getElementById('modal').innerHTML=''; window.CursappMarket&&window.CursappMarket.reload&&window.CursappMarket.reload();">Entendido</button></div>`;
  }

  async function toggleFavorite(id){
    if(!requireSession()) return;
    const has=state.favorites.has(String(id));
    if(has){
      await state.sb.from("mercado_favoritos").delete().eq("publicacion_id",id).eq("usuario_id",state.session.email);
      state.favorites.delete(String(id));
    }else{
      await state.sb.from("mercado_favoritos").insert([{publicacion_id:id,usuario_id:state.session.email}]);
      state.favorites.add(String(id));
    }
    const p=state.posts.find(x=>String(x.id)===String(id));
    if(p){
      const next=Math.max(0,Number(p.favoritos||0)+(has?-1:1));
      p.favoritos=next;
      state.sb.from("mercado_publicaciones").update({favoritos:next}).eq("id",id).then(()=>{});
    }
    renderProducts(); renderMine();
    toast(has?"Quitado de favoritos":"Guardado en favoritos");
  }
  async function contact(id){
    if(!requireSession()) return;
    const p=state.posts.find(x=>String(x.id)===String(id)); if(!p) return;
    const price=Number(p.precio||0)===0?"Intercambio":clp(p.precio);
    const msg=`Hola 👋

Vi tu publicación en Mercado Escolar Cursapp.

📦 ${p.titulo||"Publicación"}
💰 ${price}

¿Sigue disponible?

🔗 Ver publicación:
${postUrl(p)}`;
    const phone=phoneClean(p.whatsapp||p.vendedor_whatsapp||"");
    const whatsappUrl=phone?`https://wa.me/${phone.startsWith("56")?phone:"56"+phone}?text=${encodeURIComponent(msg)}`:"";
    const row={publicacion_id:p.id,usuario_id:state.session.userId||state.session.email,interesado_id:isUuid(state.session.userId)?state.session.userId:null,canal:"whatsapp",mensaje:msg};
    const {error}=await state.sb.from("mercado_contactos").insert([row]);
    if(error){toast("No se pudo registrar contacto: "+error.message);return;}
    p.contactos=Number(p.contactos||0)+1;
    state.sb.from("mercado_publicaciones").update({contactos:p.contactos}).eq("id",p.id).then(()=>{});
    toast("Contacto registrado"+(whatsappUrl?". Abriendo WhatsApp...":"."));
    if(whatsappUrl) window.open(whatsappUrl,"_blank");
  }
  function openReportModal(id){
    if(!requireSession()) return;
    const p=state.posts.find(x=>String(x.id)===String(id)); if(!p) return;
    $("#modal").innerHTML=`<div class="modal reportModal">
      <h2>Reportar publicación</h2>
      <p class="muted">Selecciona el motivo. Cursapp revisará el aviso.</p>
      <label>Motivo<select id="reportReason">${state.reasons.map(r=>`<option value="${esc(r.id||r.codigo||r.nombre)}" data-name="${esc(r.nombre)}">${esc(r.nombre)}</option>`).join("")}</select></label>
      <label>Detalle opcional<textarea id="reportDetail" placeholder="Agrega contexto para revisión"></textarea></label>
      <button id="sendReportBtn" data-send-report="${esc(id)}">Enviar reporte</button>
      <button class="ghost" onclick="document.getElementById('modal').innerHTML=''">Cancelar</button>
    </div>`;
  }
  async function sendReport(id){
    const sel=$("#reportReason");
    const opt=sel?.selectedOptions?.[0];
    const motivo=opt?.dataset.name||sel?.value||"Otro";
    const motivoId=isUuid(sel?.value)?sel.value:null;
    const detalle=$("#reportDetail")?.value||"";
    const row={publicacion_id:id,usuario_id:state.session.userId||state.session.email,motivo,detalle,estado:"pendiente"};
    if(motivoId) row.motivo_id=motivoId;
    const r=await state.sb.from("mercado_reportes").insert([row]);
    if(r.error){toast("No se pudo reportar: "+r.error.message);return;}
    toast("Reporte enviado para revisión");
    $("#modal").innerHTML="";
  }
  function applyLocalStatus(id,status){
    for(const arr of [state.posts,state.minePosts]){
      const p=arr.find(x=>String(x.id)===String(id));
      if(p){ p.estado=status; if(["vendido","intercambiado","eliminado"].includes(status)){p.destacado=false;p.destacada=false;p.destacado_hasta=null;p.destacada_hasta=null;p.tipo_destacado=null;p.destacado_tipo=null;p.regla_destacado=null;} }
    }
  }
  async function updateStatus(id,status){
    if(!id) return;
    const label=status==="vendido"?"vendido":(status==="intercambiado"?"intercambiado":"activo");
    if((status==="vendido"||status==="intercambiado") && !confirm(`¿Marcar esta publicación como ${label}?`)) return;
    applyLocalStatus(id,status);
    renderProducts();
    renderMine(status==="vendido"?"vendidos":(status==="intercambiado"?"intercambiados":"activos"));
    renderCreditVisibilityGuard();

    const closeBoost = (status==="vendido"||status==="intercambiado"||status==="eliminado");
    const statusPayload = closeBoost ? {estado:status,destacado:false,destacada:false,destacado_hasta:null,destacada_hasta:null,tipo_destacado:null,destacado_tipo:null,regla_destacado:null,updated_at:now()} : {estado:status,updated_at:now()};
    let r=await updatePostFlex(id,statusPayload);
    if(r.error){
      const msg=String(r.error.message||"");
      if(msg.includes("mercado_publicaciones_estado_check") || msg.includes("check constraint")){
        toast("Falta aplicar SQL V18: habilitar estados vendido/intercambiado en mercado_publicaciones.");
      }else{
        toast("No se pudo guardar el estado: "+r.error.message);
      }
      await loadPosts(); await loadMinePosts();
      renderProducts(); renderMine("activos"); renderCreditVisibilityGuard();
      return;
    }
    await loadPosts();
    await loadMinePosts();
    const nextTab=status==="vendido"?"vendidos":(status==="intercambiado"?"intercambiados":"activos");
    toast(status==="vendido"?"Aviso movido a Vendidos":(status==="intercambiado"?"Aviso movido a Intercambiados":"Aviso reactivado"));
    renderProducts(); renderMine(nextTab); renderCreditVisibilityGuard();
  }
  async function removePost(id){if(!confirm("¿Eliminar esta publicación? Esta acción la ocultará del Mercado Escolar.")) return; applyLocalStatus(id,"eliminado"); renderProducts(); renderMine("activos"); let r=await state.sb.from("mercado_publicaciones").update({estado:"eliminado",activo:false}).eq("id",id).select("id,estado,activo").maybeSingle(); if(r.error){toast("No se pudo eliminar: "+r.error.message); await loadPosts(); await loadMinePosts(); renderProducts(); renderMine("activos"); return;} await loadPosts(); await loadMinePosts(); renderProducts(); renderMine("activos"); renderCreditVisibilityGuard(); toast("Publicación eliminada");}
  async function sharePost(id){
    const p=state.posts.find(x=>String(x.id)===String(id))||state.minePosts.find(x=>String(x.id)===String(id));
    if(!p) return;
    if(isClosedPost(p)){toast("No se puede compartir una publicación vendida o intercambiada.");return;}
    const url=postUrl(p);
    const price=Number(p.precio||0)===0?"Intercambio":clp(p.precio);
    const text=`Hola 👋

Vi esta publicación en Mercado Escolar Cursapp.

📦 ${p.titulo||"Publicación"}
💰 ${price}`;
    if(navigator.share){try{await navigator.share({title:p.titulo||"Mercado Escolar",text,url});return;}catch(e){}}
    try{await navigator.clipboard.writeText(`${text}

🔗 ${url}`);toast("Enlace copiado");}catch(e){toast(`${text}

🔗 ${url}`);}
  }
  function rules(){
    $("#modal").innerHTML=`<div class="modal rulesModal"><h2>Reglas Mercado Escolar</h2><p>• Solo artículos escolares permitidos.</p><p>• No publicar productos prohibidos, ofensivos o ajenos al colegio.</p><p>• Las publicaciones reportadas pueden pasar a revisión u ocultarse.</p><p>• Cursapp no procesa pagos entre apoderados.</p><button class="ghost" onclick="document.getElementById('modal').innerHTML=''">Cerrar</button></div>`;
  }
  function bind(){
    document.addEventListener("click",e=>{
      const fav=e.target.closest("[data-fav]"); if(fav){e.preventDefault();e.stopPropagation();toggleFavorite(fav.dataset.fav);return;}
      const send=e.target.closest("[data-send-report]"); if(send){sendReport(send.dataset.sendReport);return;}
      const st=e.target.closest("[data-status]"); if(st){e.preventDefault();e.stopPropagation();updateStatus(st.dataset.id,st.dataset.status);return;}
      const del=e.target.closest("[data-delete]"); if(del){e.preventDefault();e.stopPropagation();removePost(del.dataset.delete);return;}
      const edit=e.target.closest("[data-edit]"); if(edit){e.preventDefault();e.stopPropagation();editPost(edit.dataset.edit);return;}
      const options=e.target.closest("[data-mine-options]"); if(options){e.preventDefault();e.stopPropagation();openMineOptions(options.dataset.mineOptions);return;}
      const open=e.target.closest("[data-open-detail]"); if(open){e.preventDefault();e.stopPropagation();document.getElementById('modal').innerHTML='';openDetail(open.dataset.openDetail);return;}
      const openBoost=e.target.closest("[data-open-boost-modal]"); if(openBoost){e.preventDefault();e.stopPropagation();openBoostModal(openBoost.dataset.openBoostModal);return;}
      const directBoost=e.target.closest("[data-direct-boost]"); if(directBoost){e.preventDefault();e.stopPropagation(); directBoost.disabled=true; directBoost.classList.add("disabled"); boostPost(directBoost.dataset.rule,directBoost.dataset.cost||"1",directBoost.dataset.directBoost);return;}
      const openCredits=e.target.closest("[data-open-credits]"); if(openCredits){e.preventDefault();e.stopPropagation();state.pendingBoostId=openCredits.dataset.openCredits;document.getElementById("modal").innerHTML="";showView("creditos");setTimeout(renderCreditVisibilityGuard,80);return;}
      const share=e.target.closest("[data-share]"); if(share){e.preventDefault();e.stopPropagation();sharePost(share.dataset.share);return;}
      const mf=e.target.closest("[data-mine-filter]"); if(mf){e.preventDefault();renderMine(mf.dataset.mineFilter);return;}
      const boost=e.target.closest("[data-boost-rule]"); if(boost){e.preventDefault();boostPost(boost.dataset.boostRule,boost.dataset.cost||"1");return;}
      const help=e.target.closest("[data-credit-help]"); if(help){e.preventDefault();creditHelp();return;}
      const v=e.target.closest("[data-view]"); if(v){e.preventDefault(); if(v.dataset.view==='publicar'){state.editingPostId=null; const titleEl=$('#view-publicar h2'); if(titleEl) titleEl.textContent='Publicar aviso'; const submit=$('#postForm button[type="submit"], #postForm .primaryBtn'); if(submit) submit.textContent='Publicar aviso';} showView(v.dataset.view);return;}
      const c=e.target.closest("[data-cat]"); if(c){e.preventDefault();filterCat(c.dataset.cat);return;}
      const pc=e.target.closest("[data-post]"); if(pc){e.preventDefault();openDetail(pc.dataset.post);return;}
      const contactBtn=e.target.closest("[data-contact]"); if(contactBtn){contact(contactBtn.dataset.contact);return;}
      const rep=e.target.closest("[data-report]"); if(rep){openReportModal(rep.dataset.report);return;}
    });
    $("#publishForm")?.addEventListener("submit",publish);
    $("#searchInput")?.addEventListener("input",e=>search(e.target.value));
    $("#searchInputExplore")?.addEventListener("input",e=>search(e.target.value));
    $("#btnMarketSearch")?.addEventListener("click",()=>{
      const q=$("#searchInput")?.value||"";
      search(q);
      showView("explorar");
    });
    $("#searchInput")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault(); search(e.target.value); showView("explorar");}});
    $("#btnClearSearch")?.addEventListener("click",()=>{const s=$("#searchInput");if(s){s.value="";search("")}});
    $("#btnRules")?.addEventListener("click",rules);
    $("#pubPhotos")?.addEventListener("change",e=>{
      const merged=mergeSelectedFiles(e.target.files);
      const chk=validateFiles(merged);
      if(!chk.ok){
        photoMessage(chk.msg,"error");
        toast("No se pudo agregar la foto. Revisa el mensaje en pantalla.");
        e.target.value="";
        renderPreview();
        return;
      }
      state.selectedFiles=chk.files;
      photoMessage(`✅ ${state.selectedFiles.length}/${MAX_FILES} foto(s) lista(s).`,"ok");
      renderPreview();
      e.target.value="";
    });
    $("#photoPreview")?.addEventListener("click",e=>{
      const btn=e.target.closest("[data-remove-photo]");
      if(!btn) return;
      const i=Number(btn.dataset.removePhoto);
      state.selectedFiles.splice(i,1);
      photoMessage(state.selectedFiles.length?`✅ ${state.selectedFiles.length}/${MAX_FILES} foto(s) lista(s).`:"",state.selectedFiles.length?"ok":"error");
      renderPreview();
    });
    $$(".filters button").forEach(btn=>btn.addEventListener("click",()=>{$$(".filters button").forEach(b=>b.classList.remove("active"));btn.classList.add("active");const sc=btn.dataset.scope;renderProducts(sc==="todo"?visible():visible().filter(p=>p.visibilidad===sc||sc==="colegio"))}));
    renderPreview([]);
  }

  document.addEventListener("DOMContentLoaded",init);
  window.CursappMarket={reload:reloadAll,showView,getState:()=>state,activeMinePosts,renderCreditVisibilityGuard,openBoostModal};
})();
