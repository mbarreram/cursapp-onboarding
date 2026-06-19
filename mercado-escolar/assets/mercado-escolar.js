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

  const state={sb:null, session:null, categories:[], posts:[], minePosts:[], imagesByPost:{}, favorites:new Set(), reasons:DEFAULT_REASONS, blocked:DEFAULT_BLOCKED, selectedFiles:[], loading:false, pendingBoostId:null};

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
    let query=state.sb.from("mercado_publicaciones").select("*").eq("activo",true).in("estado",["disponible","reservado"]);
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
  function postStatus(p){return String(p?.estado||"disponible").toLowerCase();}
  function isClosedPost(p){return ["vendido","intercambiado"].includes(postStatus(p));}
  function isActiveMarketPost(p){return !["eliminado","oculto","vendido","intercambiado","bloqueado","en_revision"].includes(postStatus(p));}
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
    return `<article class="productCard v6ProductCard" data-post="${esc(p.id)}">
      <div class="productImageWrap"><img src="${esc(imageForPost(p))}" alt="${esc(title)}" onerror="this.src='assets/img/generic.svg'"><button class="favBtn ${fav?"on":""}" data-fav="${esc(p.id)}" title="Favorito">${fav?"♥":"♡"}</button></div>
      <div class="productBody">${p.destacado?`<em class="boostBadge">Destacado</em>`:""}<b>${esc(title)}</b><strong>${price}</strong><span>${esc(p.curso_id?"Colegio Central":"Comunidad")}</span><div class="productMeta"><small>${esc(categoryName(p))}</small><small>${esc(relDate(p))}</small></div></div>
    </article>`;
  }
  function renderProducts(list=visible()){
    const f=$("#featuredList"), g=$("#marketGrid"), recent=$("#marketRecentList");
    const ranked=list.slice().sort((a,b)=>(Number(b.destacado)-Number(a.destacado))||Date.parse(b.created_at||0)-Date.parse(a.created_at||0));
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
    const tabs=`<div class="mineTabs v16MineTabs">
      <button class="${current==='activos'?'active':''}" data-mine-filter="activos">Activos <span>${activos.length}</span></button>
      <button class="${current==='vendidos'?'active':''}" data-mine-filter="vendidos">Vendidos <span>${vendidos.length}</span></button>
      <button class="${current==='intercambiados'?'active':''}" data-mine-filter="intercambiados">Intercambiados <span>${intercambiados.length}</span></button>
    </div>`;
    const empty=emptyState("📦", current==="activos"?"Aún no tienes avisos activos":(current==="vendidos"?"Aún no tienes vendidos":"Aún no tienes intercambiados"), "Tus publicaciones aparecerán organizadas aquí.", current==="activos"?"Publicar aviso":"", "publicar");
    function actions(p){
      const id=esc(p.id); const st=estado(p);
      const canShare=current==='activos' && !["vendido","intercambiado"].includes(st);
      const statusBtns=current==='activos'
        ? `<button class="mineAction primaryLight" data-status="vendido" data-id="${id}">Vendido</button><button class="mineAction primaryLight" data-status="intercambiado" data-id="${id}">Intercambiado</button><button class="mineAction dangerText" data-delete="${id}">Eliminar</button>`
        : `<button class="mineAction primaryLight" data-status="disponible" data-id="${id}">Reactivar</button><button class="mineAction dangerText" data-delete="${id}">Eliminar</button>`;
      return `<div class="mineTopActions"><button class="iconAction" data-open-detail="${id}" title="Ver">👁️</button>${canShare?`<button class="iconAction" data-share="${id}" title="Compartir">↗️</button>`:""}</div><div class="mineActionsV16">${statusBtns}</div>`;
    }
    const html=list.map(p=>`<article class="minePostCard v16MineCard ${estado(p)}">
      <img src="${esc(imageForPost(p))}" onerror="this.src='assets/img/generic.svg'">
      <div class="mineInfo"><b>${esc(p.titulo||"Publicación")}</b><span>${esc(estado(p))} · ${esc(p.tipo||"Aviso")} · ${Number(p.vistas||0)} vistas · ${Number(p.contactos||0)} contactos</span></div>
      ${actions(p)}
    </article>`).join("");
    box.innerHTML=tabs+(html||empty);
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
      estado:"disponible",
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
      <div class="v6DetailBody"><small class="v6Cat">${esc(categoryName(p))}</small><h2>${esc(p.titulo)}</h2><strong class="v6Price">${price}</strong>
      <div class="v6Chips"><span>✓ Disponible</span><span>⌖ ${esc(p.curso_id?"Colegio Central":"Comunidad")}</span><span>${esc(relDate(p))}</span></div>
      <p>${esc(p.descripcion||"")}</p>
      <div class="v6Seller"><span>${esc((p.nombre_vendedor||"Apoderado Cursapp").slice(0,2).toUpperCase())}</span><div><b>${esc(p.nombre_vendedor||"Apoderado Cursapp")}</b><small>Comunidad registrada</small></div></div>
      <button class="v6Whatsapp" data-contact="${esc(p.id)}">Contactar por WhatsApp</button>
      <button class="v6Ghost" data-share="${esc(p.id)}">Compartir aviso</button>
      <button class="v6Ghost" data-fav="${esc(p.id)}">${fav?"♥ Quitar favorito":"♡ Guardar favorito"}</button>
      ${isMine(p) && isActiveMarketPost(p) ? `<button class="v6BoostBtn" data-open-credits="${esc(p.id)}">⭐ Destacar con créditos</button>` : ""}
      <button class="v6Danger" data-report="${esc(p.id)}">🚩 Reportar publicación</button></div>
    </article></div>`;
  }
  function activeMinePosts(){
    const all=(state.minePosts.length?state.minePosts:state.posts.filter(isMine)).filter(p=>isActiveMarketPost(p));
    return all.sort((a,b)=>Date.parse(b.created_at||0)-Date.parse(a.created_at||0));
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
        <article class="boostOption"><b>Destacado colegio</b><strong>1 crédito · 7 días</strong><span>Mi colegio</span><button type="button" data-boost-rule="colegio" data-cost="1">Destacar</button></article>
        <article class="boostOption"><b>Portada comuna</b><strong>3 créditos · 7 días</strong><span>Mi comuna</span><button type="button" data-boost-rule="comuna" data-cost="3">Destacar</button></article>
        <article class="boostOption"><b>Todo Cursapp</b><strong>5 créditos · 7 días</strong><span>Comunidad Cursapp</span><button type="button" data-boost-rule="cursapp" data-cost="5">Destacar</button></article>`;
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
  async function recordCreditUse(publicacionId,rule,cost){
    const uid=state.session.userId||state.session.email;
    const email=state.session.email||null;
    const until=new Date(Date.now()+7*86400000).toISOString();
    let spent={ok:true};
    if(window.CursappMarketCredits && typeof window.CursappMarketCredits.spendCredits==="function"){
      spent=await window.CursappMarketCredits.spendCredits(Number(cost||0),{publicacion_id:publicacionId,regla:rule,descripcion:`Destacado Mercado Escolar · ${rule} · 7 días`});
      if(!spent || spent.ok===false) return {ok:false,message:spent?.message||"No se pudieron descontar créditos."};
    }else{
      await insertFlex("movimientos_creditos",{usuario_id:uid,email,tipo:"egreso",concepto:"destacado_mercado",cantidad:-Math.abs(Number(cost||0)),creditos:-Math.abs(Number(cost||0)),publicacion_id:publicacionId,regla,descripcion:`Destacado Mercado Escolar · ${rule} · 7 días`,created_at:now()});
    }
    await insertFlex("publicaciones_destacadas",{publicacion_id:publicacionId,usuario_id:uid,email,regla,tipo:rule,creditos_usados:Number(cost||0),creditos:Number(cost||0),fecha_inicio:now(),fecha_fin:until,vence_at:until,estado:"activa",activo:true,created_at:now()});
    return {ok:true,until};
  }
  async function boostPost(rule,cost){
    const sel=document.getElementById("boostPostSelect");
    const id=sel?.value;
    if(!id){toast("Selecciona una publicación activa para destacar.");return;}
    const p=state.minePosts.find(x=>String(x.id)===String(id))||state.posts.find(x=>String(x.id)===String(id));
    if(!p || !isActiveMarketPost(p)){toast("Solo puedes destacar publicaciones activas.");return;}
    const costNum=Number(cost||1);
    const spend=await recordCreditUse(id,rule,costNum);
    if(!spend.ok){toast(spend.message||"No se pudo usar créditos.");return;}
    let r=await state.sb.from("mercado_publicaciones").update({destacado:true}).eq("id",id).select("id,destacado,estado").maybeSingle();
    if(r.error){toast("Créditos registrados, pero no se pudo marcar destacado: "+r.error.message);return;}
    p.destacado=true;
    p.destacado_hasta=spend.until;
    for(const arr of [state.posts,state.minePosts]){const x=arr.find(z=>String(z.id)===String(id)); if(x){x.destacado=true;x.destacado_hasta=spend.until;}}
    await loadPosts();
    await loadMinePosts();
    renderProducts(); renderMine("activos"); renderCreditVisibilityGuard();
    if(window.CursappMarketCredits?.refresh) window.CursappMarketCredits.refresh();
    toast(`Publicación destacada por 7 días · ${costNum} crédito(s) descontado(s)`);
  }
  function creditHelp(){
    document.getElementById("modal").innerHTML=`<div class="modal rulesModal creditHelpModal"><h2>¿Qué es canjear visibilidad?</h2><p>Usas créditos para destacar una publicación activa y que aparezca con mayor prioridad.</p><p>• Solo aplica a publicaciones activas.</p><p>• No se puede usar en avisos vendidos o intercambiados.</p><p>• El destacado vence automáticamente según la regla elegida.</p><p>• Las publicaciones vendidas o intercambiadas salen de Inicio, Destacados y Créditos.</p><button class="ghost" onclick="document.getElementById('modal').innerHTML=''">Entendido</button></div>`;
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
      if(p) p.estado=status;
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

    let r=await state.sb.from("mercado_publicaciones").update({estado:status}).eq("id",id).select("id,estado").maybeSingle();
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
      const open=e.target.closest("[data-open-detail]"); if(open){e.preventDefault();e.stopPropagation();openDetail(open.dataset.openDetail);return;}
      const openCredits=e.target.closest("[data-open-credits]"); if(openCredits){e.preventDefault();e.stopPropagation();state.pendingBoostId=openCredits.dataset.openCredits;document.getElementById("modal").innerHTML="";showView("creditos");setTimeout(renderCreditVisibilityGuard,80);return;}
      const share=e.target.closest("[data-share]"); if(share){e.preventDefault();e.stopPropagation();sharePost(share.dataset.share);return;}
      const mf=e.target.closest("[data-mine-filter]"); if(mf){e.preventDefault();renderMine(mf.dataset.mineFilter);return;}
      const boost=e.target.closest("[data-boost-rule]"); if(boost){e.preventDefault();boostPost(boost.dataset.boostRule,boost.dataset.cost||"1");return;}
      const help=e.target.closest("[data-credit-help]"); if(help){e.preventDefault();creditHelp();return;}
      const v=e.target.closest("[data-view]"); if(v){e.preventDefault();showView(v.dataset.view);return;}
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
  window.CursappMarket={reload:loadPosts,showView,getState:()=>state,activeMinePosts,renderCreditVisibilityGuard};
})();
