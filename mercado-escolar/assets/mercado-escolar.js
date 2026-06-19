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

  const state={sb:null, session:null, categories:[], posts:[], minePosts:[], imagesByPost:{}, favorites:new Set(), reasons:DEFAULT_REASONS, blocked:DEFAULT_BLOCKED, selectedFiles:[], loading:false};

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
  function toast(t){const el=$("#toast"); if(!el){alert(t); return;} el.textContent=t; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),2200)}
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
      queries.push(state.sb.from("mercado_publicaciones").select("*").eq("vendedor_email",state.session.email).neq("estado","eliminado").order("created_at",{ascending:false}).limit(100));
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
  function visible(list=state.posts){return list.filter(p=>!["eliminado","oculto","vendido","bloqueado","en_revision"].includes(String(p.estado||"").toLowerCase()))}
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
      <div class="productBody"><b>${esc(title)}</b><strong>${price}</strong><span>${esc(p.curso_id?"Colegio Central":"Comunidad")}</span><div class="productMeta"><small>${esc(categoryName(p))}</small><small>${esc(relDate(p))}</small></div></div>
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
  function renderMine(){
    const box=$("#myPosts"); if(!box) return;
    const mine=(state.minePosts.length?state.minePosts:state.posts.filter(isMine)).filter(p=>!["eliminado"].includes(String(p.estado||"").toLowerCase()));
    box.innerHTML=mine.map(p=>`<div class="myItem"><img src="${esc(imageForPost(p))}"><div><b>${esc(p.titulo)}</b><span>${esc(p.estado||"disponible")} · ${Number(p.visualizaciones||0)} vistas · ${Number(p.contactos||0)} contactos · ${Number(p.favoritos||0)} favoritos</span></div><button data-post="${esc(p.id)}">Ver</button><button data-share="${esc(p.id)}">Compartir</button><button data-status="vendido" data-id="${esc(p.id)}">Vendido</button><button data-status="disponible" data-id="${esc(p.id)}">Activar</button><button data-delete="${esc(p.id)}">Eliminar</button></div>`).join("") || emptyState("📦","Aún no tienes avisos","Publica tu primer artículo para vender o intercambiar dentro de la comunidad.","Publicar aviso","publicar");
  }
  function showView(v){
    $$(".view").forEach(x=>x.classList.remove("active"));
    $("#view-"+v)?.classList.add("active");
    $$(".bottomBar button").forEach(x=>x.classList.toggle("active",x.dataset.view===v));
    if(v==="mis") renderMine();
  }
  function search(q){q=String(q||"").toLowerCase().trim();const list=!q?visible():visible().filter(p=>String((p.titulo||"")+" "+categoryName(p)+" "+(p.descripcion||"")).toLowerCase().includes(q));renderProducts(list);}
  function filterCat(cat){showView("explorar"); renderProducts(visible().filter(p=>categoryName(p)===cat));}

  function validateFiles(files){
    const arr=Array.from(files||[]);
    if(arr.length>MAX_FILES) return {ok:false,msg:`Máximo ${MAX_FILES} imágenes.`};
    for(const file of arr){
      if(!ALLOWED.includes(file.type) || !ALLOWED_EXT.test(file.name)) return {ok:false,msg:`Formato no permitido: ${file.name}. Usa JPG, PNG o WEBP.`};
      if(file.size>MAX_BYTES) return {ok:false,msg:`${file.name} pesa ${(file.size/1024).toFixed(0)} KB. Máximo ${Math.round(MAX_BYTES/1024)} KB.`};
    }
    return {ok:true,files:arr};
  }
  function renderPreview(files=state.selectedFiles){
    const box=$("#photoPreview"); if(!box) return;
    box.innerHTML=files.map((f,i)=>`<div class="photoPreviewItem"><img src="${URL.createObjectURL(f)}"><small>${i+1}</small></div>`).join("") || `<p>Agrega hasta ${MAX_FILES} fotos reales: 1 principal y hasta 2 adicionales. Máx. ${Math.round(MAX_BYTES/1024)} KB c/u.</p>`;
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
    const fileCheck=validateFiles($("#pubPhotos")?.files||[]);
    if(!fileCheck.ok){toast(fileCheck.msg);return;}
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
      vendedor_email:state.session.email||null,
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
    const {data,error}=await state.sb.from("mercado_publicaciones").insert([row]).select("*").single();
    if(error){toast("No se pudo publicar: "+error.message);return;}
    try{await uploadImages(data.id,fileCheck.files||[]);}catch(uploadErr){toast("Publicación creada, pero falló imagen: "+uploadErr.message);}
    e.target.reset(); state.selectedFiles=[]; renderPreview([]);
    await loadPosts();
    await loadMinePosts();
    toast(violation.blocked?"Publicación creada con alerta para revisión del Admin":"Publicación creada");
    showView("mis");
  }

  async function openDetail(id){
    const p=state.posts.find(x=>String(x.id)===String(id)); if(!p) return;
    await state.sb.from("mercado_publicaciones").update({visualizaciones:Number(p.visualizaciones||0)+1}).eq("id",p.id);
    p.visualizaciones=Number(p.visualizaciones||0)+1;
    const imgs=(state.imagesByPost[String(p.id)]||[]).map(i=>i.url_imagen).filter(Boolean);
    const main=imageForPost(p);
    const gallery=[main].concat(imgs.filter(u=>u!==main)).slice(0,3);
    const price=Number(p.precio||0)===0?"Intercambio":clp(p.precio);
    const fav=state.favorites.has(String(p.id));
    $("#modal").innerHTML=`<div class="v6DetailOverlay"><article class="v6DetailSheet">
      <div class="v6DetailTop"><button class="v6IconBack" onclick="document.getElementById('modal').innerHTML=''">←</button><b>Detalle del aviso</b><button class="v6IconBack" data-share="${esc(p.id)}">⇧</button></div>
      <div class="v6Gallery">${gallery.map(u=>`<img src="${esc(u)}" onerror="this.src='assets/img/generic.svg'">`).join("")}<div class="v6Dots">${gallery.map((_,i)=>`<span class="${i===0?'active':''}"></span>`).join("")}</div></div>
      <div class="v6DetailBody"><small class="v6Cat">${esc(categoryName(p))}</small><h2>${esc(p.titulo)}</h2><strong class="v6Price">${price}</strong>
      <div class="v6Chips"><span>✓ Disponible</span><span>⌖ ${esc(p.curso_id?"Colegio Central":"Comunidad")}</span><span>${esc(relDate(p))}</span></div>
      <p>${esc(p.descripcion||"")}</p>
      <div class="v6Seller"><span>${esc((p.nombre_vendedor||"Apoderado Cursapp").slice(0,2).toUpperCase())}</span><div><b>${esc(p.nombre_vendedor||"Apoderado Cursapp")}</b><small>Comunidad registrada</small></div></div>
      <button class="v6Whatsapp" data-contact="${esc(p.id)}">Contactar por WhatsApp</button>
      <button class="v6Ghost" data-share="${esc(p.id)}">Compartir aviso</button>
      <button class="v6Ghost" data-fav="${esc(p.id)}">${fav?"♥ Quitar favorito":"♡ Guardar favorito"}</button>
      <button class="v6Danger" data-report="${esc(p.id)}">🚩 Reportar publicación</button>
      <a class="v6BackCursapp" href="/apoderado.html">↩ Cursapp</a></div>
    </article></div>`;
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
  async function updateStatus(id,status){
    const {error}=await state.sb.from("mercado_publicaciones").update({estado:status,updated_at:now()}).eq("id",id);
    if(error){toast("No se pudo actualizar: "+error.message);return;}
    const p=state.posts.find(x=>String(x.id)===String(id)); if(p) p.estado=status;
    await loadPosts(); await loadMinePosts(); toast("Publicación actualizada"); renderProducts(); renderMine();
  }
  async function removePost(id){if(!confirm("¿Eliminar esta publicación?")) return; await updateStatus(id,"eliminado");}
  async function sharePost(id){
    const p=state.posts.find(x=>String(x.id)===String(id))||state.minePosts.find(x=>String(x.id)===String(id));
    if(!p) return;
    const text=shareText(p);
    if(navigator.share){try{await navigator.share({title:p.titulo||"Mercado Escolar",text,url:postUrl(p)});return;}catch(e){}}
    try{await navigator.clipboard.writeText(text);toast("Enlace copiado");}catch(e){toast(text);}
  }
  function rules(){
    $("#modal").innerHTML=`<div class="modal"><h2>Reglas Mercado Escolar</h2><p>• Solo artículos escolares permitidos.</p><p>• No publicar productos prohibidos, ofensivos o ajenos al colegio.</p><p>• Las publicaciones reportadas pueden pasar a revisión u ocultarse.</p><p>• Cursapp no procesa pagos entre apoderados.</p><button class="ghost" onclick="document.getElementById('modal').innerHTML=''">Cerrar</button></div>`;
  }
  function bind(){
    document.addEventListener("click",e=>{
      const fav=e.target.closest("[data-fav]"); if(fav){e.preventDefault();e.stopPropagation();toggleFavorite(fav.dataset.fav);return;}
      const send=e.target.closest("[data-send-report]"); if(send){sendReport(send.dataset.sendReport);return;}
      const v=e.target.closest("[data-view]"); if(v){e.preventDefault();showView(v.dataset.view);return;}
      const c=e.target.closest("[data-cat]"); if(c){e.preventDefault();filterCat(c.dataset.cat);return;}
      const pc=e.target.closest("[data-post]"); if(pc){e.preventDefault();openDetail(pc.dataset.post);return;}
      const contactBtn=e.target.closest("[data-contact]"); if(contactBtn){contact(contactBtn.dataset.contact);return;}
      const rep=e.target.closest("[data-report]"); if(rep){openReportModal(rep.dataset.report);return;}
      const del=e.target.closest("[data-delete]"); if(del){removePost(del.dataset.delete);return;}
      const share=e.target.closest("[data-share]"); if(share){e.preventDefault();e.stopPropagation();sharePost(share.dataset.share);return;}
      const st=e.target.closest("[data-status]"); if(st){updateStatus(st.dataset.id,st.dataset.status);return;}
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
    $("#pubPhotos")?.addEventListener("change",e=>{const chk=validateFiles(e.target.files);if(!chk.ok){toast(chk.msg);e.target.value="";state.selectedFiles=[];renderPreview([]);return;}state.selectedFiles=chk.files;renderPreview();});
    $$(".filters button").forEach(btn=>btn.addEventListener("click",()=>{$$(".filters button").forEach(b=>b.classList.remove("active"));btn.classList.add("active");const sc=btn.dataset.scope;renderProducts(sc==="todo"?visible():visible().filter(p=>p.visibilidad===sc||sc==="colegio"))}));
    renderPreview([]);
  }

  document.addEventListener("DOMContentLoaded",init);
  window.CursappMarket={reload:loadPosts,showView};
})();
