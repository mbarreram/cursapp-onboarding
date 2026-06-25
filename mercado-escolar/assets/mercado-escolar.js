(function(){
  "use strict";

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=s=>String(s??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const clp=n=>"$"+Number(n||0).toLocaleString("es-CL");
  const now=()=>new Date().toISOString();
  const DEBUG_BOOST=false;
  function debugBoostAlert(step, data){
    if(!DEBUG_BOOST) return;
    try{
      const msg='[DEBUG DESTACADO] '+step+(data?'\n'+(typeof data==='string'?data:JSON.stringify(data,null,2)):'');
      alert(msg);
      console.log(msg, data||'');
    }catch(e){console.warn('debugBoostAlert',e,data);}
  }
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
  function daysLeft(v){const t=Date.parse(v||''); if(!v || Number.isNaN(t)) return null; const ms=t-Date.now(); return Math.max(0,Math.ceil(ms/86400000));}
  function boostDaysText(p){const d=daysLeft(boostUntil(p)); return d===null?'sin fecha de vencimiento':`quedan ${d} día(s)`;}

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

  const state={sb:null, session:null, categories:[], posts:[], minePosts:[], imagesByPost:{}, favorites:new Set(), reasons:DEFAULT_REASONS, blocked:DEFAULT_BLOCKED, selectedFiles:[], loading:false, pendingBoostId:null, editingPostId:null, conversations:[], unreadConversations:0, chatSending:new Set(), conversationPosts:{}, userProfiles:{}, colegioCache:{}, sellerStats:{}, myRatings:{}};
  let mineRefreshSeq=0;

  function readJson(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}}
  function writeJson(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
  function parseMaybeJson(v,d){try{if(v==null||v==='')return d; if(typeof v==='string')return JSON.parse(v); return v;}catch(e){return d;}}
  function profileIdOf(p){return String(p?.profileId||p?.profile_id||p?.id||p?.supabase?.profile_id||p?.supabase?.miembro_id||'').trim();}
  function courseKeyOf(p){return String(p?.courseKey||p?.course_key||p?.cursoKey||p?.curso_key||p?.supabase?.course_key||'').trim();}
  function cursoIdOf(p){return String(p?.curso_id||p?.cursoId||p?.courseId||p?.supabase?.curso_id||p?.supabase?.cursoId||'').trim();}
  function colegioIdOf(p){return String(p?.colegio_id||p?.colegioId||p?.supabase?.colegio_id||p?.supabase?.colegioId||'').trim();}
  function miembroIdOf(p){return String(p?.miembroId||p?.miembro_id||p?.supabase?.miembro_id||p?.supabase?.miembroId||'').trim();}
  function profiles(){const a=readJson('cursapp_profiles_v1',[])||readJson('cursapp_demo_profiles_v1',[])||[]; return Array.isArray(a)?a:[];}
  function resolveProtectedProfile(){
    const rawS=readJson('cursapp_session_v1',{})||{};
    const activeCourse=String(localStorage.getItem('cursapp_active_course_v1')||rawS.activeCourse||rawS.courseKey||rawS.course_key||'').trim();
    const activeRole=String(localStorage.getItem('cursapp_active_role_v1')||rawS.currentRole||rawS.role||'apoderado').toLowerCase().trim();
    const rawActive=localStorage.getItem('cursapp_active_profile_v1');
    const obj=parseMaybeJson(rawActive,null);
    const activeId=String(localStorage.getItem('cursapp_active_profile_id_v1')||localStorage.getItem('cursapp_active_member_profile_v1')||(obj&&typeof obj==='object'?profileIdOf(obj):'')||(!String(rawActive||'').trim().startsWith('{')?rawActive:'')||rawS.activeProfile||rawS.activeProfileId||'').trim();
    if(obj&&typeof obj==='object'&&(courseKeyOf(obj)||cursoIdOf(obj))) return obj;
    const all=profiles();
    if(activeId){const byId=all.find(p=>profileIdOf(p)===activeId||miembroIdOf(p)===activeId); if(byId) return byId;}
    let cand=all.filter(p=>!activeCourse||courseKeyOf(p)===activeCourse);
    if(activeRole){ cand=cand.filter(p=>{const r=String(p?.role||p?.user?.role||'').toLowerCase(); const rs=Array.isArray(p?.roles)?p.roles.map(x=>String(x).toLowerCase()):[]; return !r&&!rs.length?true:r===activeRole||rs.includes(activeRole);}); }
    return cand[0]||null;
  }
  function getProtectedContext(){
    const s=readJson('cursapp_session_v1',{})||{};
    const p=resolveProtectedProfile()||parseMaybeJson(localStorage.getItem('cursapp_active_profile_v1'),{})||{};
    const role=String(localStorage.getItem('cursapp_active_role_v1')||s.currentRole||s.role||p.role||'apoderado').toLowerCase().trim();
    const courseKey=String(localStorage.getItem('cursapp_active_course_v1')||s.activeCourse||s.courseKey||s.course_key||courseKeyOf(p)||'').trim();
    const courseId=String(cursoIdOf(p)||s.curso_id||s.cursoId||s.courseId||'').trim();
    const colegioId=String(colegioIdOf(p)||s.colegio_id||s.colegioId||'').trim();
    const miembroId=String(miembroIdOf(p)||s.activeMiembro||s.miembroId||'').trim();
    const profileId=String(profileIdOf(p)||s.activeProfile||s.activeProfileId||'').trim();
    try{
      if(courseKey) localStorage.setItem('cursapp_active_course_v1',courseKey);
      if(role) localStorage.setItem('cursapp_active_role_v1',role);
      if(profileId) localStorage.setItem('cursapp_active_profile_id_v1',profileId);
      const raw=Object.assign({},s);
      if(courseKey){raw.courseKey=courseKey; raw.activeCourse=courseKey;}
      if(courseId){raw.curso_id=courseId; raw.courseId=courseId;}
      if(colegioId){raw.colegio_id=colegioId; raw.colegioId=colegioId;}
      if(miembroId){raw.activeMiembro=miembroId; raw.miembroId=miembroId;}
      if(profileId){raw.activeProfile=profileId; raw.activeProfileId=profileId;}
      if(role){raw.currentRole=role; raw.role=role;}
      writeJson('cursapp_session_v1',raw);
      writeJson('cursapp_active_context_v1',{role,courseKey,cursoId:courseId,courseId,colegioId,miembroId,profileId,source:'mercado_guard'});
    }catch(e){}
    return {role,courseKey,courseId,colegioId,miembroId,profileId,profile:p};
  }
  function getSession(){
    const s=readJson("cursapp_session_v1",{})||{};
    const protectedCtx=getProtectedContext();
    const p=protectedCtx.profile||{};
    const role=protectedCtx.role||localStorage.getItem("cursapp_active_role_v1")||s.currentRole||s.role||"apoderado";
    return {
      raw:s, profile:p,
      userId:s.userId||s.usuario_id||p.usuario_id||p.userId||p.supabase?.usuario_id||p.supabase?.userId||null,
      email:String(s.email||p.email||p.supabase?.email||"").toLowerCase(),
      name:s.nombre||s.name||p.nombre_apoderado||p.nombre||p.supabase?.nombre||"Apoderado Cursapp",
      role,
      courseId:protectedCtx.courseId||p.supabase?.curso_id||p.supabase?.cursoId||p.curso_id||p.cursoId||s.curso_id||s.cursoId||null,
      colegioId:protectedCtx.colegioId||p.supabase?.colegio_id||p.supabase?.colegioId||p.colegio_id||p.colegioId||s.colegio_id||s.colegioId||null,
      courseKey:protectedCtx.courseKey||s.courseKey||s.course_key||p.courseKey||p.course_key||"",
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

  async function resolveMarketContext(){
    if(!state.sb) return;
    state.session=getSession();
    const email=String(state.session.email||'').toLowerCase().trim();
    const uid=String(state.session.userId||'').trim();
    try{
      // 1) Si la sesión ya trae curso, buscar su colegio.
      if(isUuid(state.session.courseId) && !isUuid(state.session.colegioId)){
        const cr=await state.sb.from('cursos').select('id,colegio_id').eq('id',state.session.courseId).maybeSingle();
        if(!cr.error && cr.data?.colegio_id) state.session.colegioId=cr.data.colegio_id;
      }
      // 2) Si falta curso/colegio, resolver desde miembros_curso.
      // IMPORTANTE V58.3: si existe curso activo/perfil activo, NO elegir el último por email,
      // porque el mismo correo puede estar inscrito en más de un curso.
      if(!isUuid(state.session.courseId) || !isUuid(state.session.colegioId)){
        let mr=null;
        const protectedCtx=getProtectedContext();
        if(isUuid(protectedCtx.courseId)){
          mr={curso_id:protectedCtx.courseId};
        }else if(isUuid(uid)){
          let r=null;
          if(state.session.courseKey){
            try{ r=await state.sb.from('miembros_curso').select('curso_id,usuario_id,email,estado,created_at,course_key').eq('usuario_id',uid).eq('course_key',state.session.courseKey).limit(1).maybeSingle(); }catch(_){ r=null; }
          }
          if(!r || r.error || !r.data){
            r=await state.sb.from('miembros_curso').select('curso_id,usuario_id,email,estado,created_at').eq('usuario_id',uid).order('created_at',{ascending:false}).limit(1).maybeSingle();
          }
          if(!r.error && r.data) mr=r.data;
        }
        if(!mr && email){
          // Fallback sólo si no hay curso activo. Mantener compatibilidad para usuarios antiguos.
          const r=await state.sb.from('miembros_curso').select('curso_id,usuario_id,email,estado,created_at').ilike('email',email).order('created_at',{ascending:false}).limit(1).maybeSingle();
          if(!r.error && r.data) mr=r.data;
        }
        if(mr?.curso_id){
          state.session.courseId=state.session.courseId||mr.curso_id;
          const cr=await state.sb.from('cursos').select('id,colegio_id').eq('id',mr.curso_id).maybeSingle();
          if(!cr.error && cr.data?.colegio_id) state.session.colegioId=state.session.colegioId||cr.data.colegio_id;
        }
      }
      // 3) Traer datos del colegio para filtro comuna/cercanos.
      if(isUuid(state.session.colegioId)){
        const gr=await state.sb.from('colegios').select('id,nombre,comuna,region').eq('id',state.session.colegioId).maybeSingle();
        if(!gr.error && gr.data){
          state.session.colegioNombre=gr.data.nombre||state.session.colegioNombre||'';
          state.session.comuna=gr.data.comuna||state.session.comuna||'';
          state.session.region=gr.data.region||state.session.region||'';
        }
      }
      try{
        const raw=readJson('cursapp_session_v1',{})||{};
        if(state.session.courseId) raw.curso_id=state.session.courseId;
        if(state.session.colegioId) raw.colegio_id=state.session.colegioId;
        if(state.session.comuna) raw.comuna=state.session.comuna;
        if(state.session.region) raw.region=state.session.region;
        localStorage.setItem('cursapp_session_v1',JSON.stringify(raw));
      }catch(e){}
    }catch(e){
      console.warn('No se pudo resolver contexto colegio/curso Mercado Escolar',e);
    }
  }

  async function init(){
    setLoading(true,"Preparando Mercado Escolar...");
    state.sb=await waitSupabase();
    state.session=getSession();
    if(!state.sb){setLoading(false);renderError("Supabase no disponible. Revisa conexión.");return;}
    try{
      await Promise.all([loadCategories(),loadReasons(),loadBlockedWords()]);
      await resolveMarketContext();
      fillCategorySelect();
      renderCategoryRow();
      await loadPosts();
      await loadMinePosts();
      await loadFavorites();
      await loadConversations();
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
  function colegioNameForPost(p){
    const id=String(p?.colegio_id||'');
    return p?.colegio_nombre || p?.nombre_colegio || p?.colegio?.nombre || (id && state.colegioCache?.[id]?.nombre) || (sameColegio(p)?(state.session?.colegioNombre||'Mi colegio'):'Comunidad');
  }
  async function hydratePostSchools(list){
    if(!state.sb) return;
    state.colegioCache=state.colegioCache||{};
    const ids=[...new Set((list||[]).map(p=>String(p?.colegio_id||'')).filter(isUuid))].filter(id=>!state.colegioCache[id]);
    if(!ids.length) return;
    try{
      const r=await state.sb.from('colegios').select('id,nombre,comuna,region').in('id',ids);
      if(!r.error){
        (r.data||[]).forEach(c=>{state.colegioCache[String(c.id)]={nombre:c.nombre||'Colegio',comuna:c.comuna||'',region:c.region||''};});
      }
    }catch(e){console.warn('[MERCADO] no se pudieron cargar nombres de colegios',e);}
  }

  async function loadPosts(){
    let query=state.sb.from("mercado_publicaciones").select("*").eq("activo",true).in("estado",["activo","disponible","reservado"]);
    query=query.order("destacado",{ascending:false}).order("created_at",{ascending:false}).limit(120);
    const {data,error}=await query;
    if(error){renderError("No se pudieron cargar publicaciones: "+error.message);return;}
    state.posts=data||[];
    await hydratePostSchools(state.posts);
    await loadImagesForPosts();
    await loadSellerReputationForPosts(state.posts);
    renderProducts(filterByScope(activeExploreScope()));
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
    // Fallback robusto: si un aviso fue vendido/intercambiado y no viene en las consultas normales,
    // recuperar publicaciones asociadas a conversaciones donde el usuario actual es vendedor.
    try{
      if(state.session.userId && isUuid(state.session.userId)){
        const cr=await state.sb.from("mercado_conversaciones").select("publicacion_id").eq("vendedor_id",state.session.userId).limit(200);
        const ids=[...new Set((cr.data||[]).map(x=>String(x.publicacion_id||"")).filter(isUuid))].filter(id=>!found.has(id));
        if(ids.length){
          const pr=await state.sb.from("mercado_publicaciones").select("*").in("id",ids);
          if(!pr.error) (pr.data||[]).forEach(p=>{ if(String(p.estado||"").toLowerCase()!=="eliminado") found.set(String(p.id),p); });
        }
      }
    }catch(e){console.warn("[MIS AVISOS] fallback conversaciones vendedor",e);}
    // fallback: cualquier publicación visible ya cargada que pertenezca al usuario
    state.posts.filter(isMine).forEach(p=>found.set(String(p.id),p));
    state.minePosts=Array.from(found.values()).sort((a,b)=>Date.parse(b.created_at||0)-Date.parse(a.created_at||0));
    await hydratePostSchools(state.minePosts);
    await loadImagesForIds(state.minePosts.map(p=>p.id));
    await loadSellerReputationForPosts(state.minePosts);
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
  function postStatus(p){
    const ep=String(p?.estado_publicacion||'').toLowerCase();
    const e=String(p?.estado||'').toLowerCase();
    const closed=['vendido','intercambiado','cerrado'];
    if(closed.includes(ep)) return ep;
    if(closed.includes(e)) return e;
    if(ep && !['activo','activa','disponible','publicado','publicada'].includes(ep)) return ep;
    if(e && !['activo','activa','disponible','publicado','publicada'].includes(e)) return e;
    return 'disponible';
  }
  function isClosedPost(p){return ["vendido","intercambiado","cerrado","eliminado","oculto","bloqueado"].includes(postStatus(p));}
  function postStatusLabel(p){
    const st=postStatus(p);
    if(st==="vendido") return "Vendido";
    if(st==="intercambiado") return "Intercambiado";
    if(st==="cerrado") return "Cerrado";
    if(st==="eliminado") return "Eliminada";
    if(st==="oculto") return "Oculta";
    if(st==="bloqueado") return "Bloqueada";
    if(st==="en_revision") return "En revisión";
    return "Disponible";
  }
  function postStatusIcon(p){
    const st=postStatus(p);
    if(st==="vendido") return "⚫";
    if(st==="intercambiado") return "🔵";
    if(st==="cerrado") return "🔒";
    if(st==="eliminado") return "🗑️";
    if(st==="oculto" || st==="bloqueado") return "🚫";
    if(st==="en_revision") return "🟡";
    return "🟢";
  }
  function statusBadge(p){return isClosedPost(p)?`<span class="marketStatusBadge ${esc(postStatus(p))}">${postStatusIcon(p)} ${postStatusLabel(p)}</span>`:'';}
  function detailStatusChip(p){return (isClosedPost(p)||isDeletedPost(p))?`<span class="statusChip ${esc(postStatus(p))}">${postStatusIcon(p)} ${postStatusLabel(p)}</span>`:'';}

  function sellerStats(id){return state.sellerStats?.[String(id||'')]||{count:0,avg:0,recomienda:0,ventas:0};}
  function sellerLevel(stats){
    const n=Number(stats?.ventas||stats?.count||0), avg=Number(stats?.avg||0);
    if(n>=21 && avg>=4.6) return 'Excelente vendedor';
    if(n>=6 && avg>=4.2) return 'Buen vendedor';
    if(n>=1) return 'Vendedor activo';
    return 'Nuevo vendedor';
  }
  function stars(avg){
    const n=Math.round(Number(avg||0));
    return '★★★★★'.split('').map((x,i)=>`<span class="${i<n?'on':''}">★</span>`).join('');
  }
  function sellerReputationHtml(p,mode='card'){
    const id=sellerUuid(p);
    const st=sellerStats(id);
    const avg=Number(st.avg||0);
    if(!id || !st.count){
      return mode==='detail'
        ? `<div class="sellerRep sellerRepDetail new"><b>⭐ Nuevo vendedor</b><small>Aún sin calificaciones verificadas</small></div>`
        : `<div class="sellerRep sellerRepCard new"><small>Nuevo vendedor</small><em>Sin calificaciones aún</em></div>`;
    }
    const rec=Number(st.recomienda||0);
    const countLabel=`(${st.count})`;
    if(mode==='chat') return `<div class="sellerRep sellerRepChat"><div><span class="sellerStars">${stars(avg)}</span><b>${avg.toFixed(1)}</b><small>${st.count} calificación${st.count===1?'':'es'} · ${rec}% recomienda</small></div></div>`;
    return mode==='detail'
      ? `<div class="sellerRep sellerRepDetail"><div class="sellerStars">${stars(avg)}</div><b>${avg.toFixed(1)} · ${sellerLevel(st)}</b><small>${st.count} calificación${st.count===1?'':'es'} · ${rec}% recomienda</small></div>`
      : `<div class="sellerRep sellerRepCard"><div class="sellerRatingLine"><span class="sellerStars">${stars(avg)}</span><b>${avg.toFixed(1)}</b><span class="sellerRatingCount">${countLabel}</span></div><small>${sellerLevel(st)}</small></div>`;
  }
  async function loadSellerReputationForPosts(list){
    if(!state.sb) return;
    const ids=[...new Set((list||[]).map(sellerUuid).filter(isUuid).map(String))];
    if(!ids.length) return;
    try{
      const r=await state.sb.from('mercado_calificaciones').select('vendedor_id,estrellas,recomienda').in('vendedor_id',ids).limit(1000);
      if(r.error){ console.warn('[REPUTACION] tabla no disponible aún', r.error.message); return; }
      const agg={};
      ids.forEach(id=>agg[id]={count:0,sum:0,recomiendaCount:0});
      (r.data||[]).forEach(x=>{
        const id=String(x.vendedor_id||''); if(!agg[id]) agg[id]={count:0,sum:0,recomiendaCount:0};
        agg[id].count++; agg[id].sum+=Number(x.estrellas||0); if(x.recomienda) agg[id].recomiendaCount++;
      });
      Object.entries(agg).forEach(([id,a])=>{
        state.sellerStats[id]={count:a.count,ventas:a.count,avg:a.count?(a.sum/a.count):0,recomienda:a.count?Math.round((a.recomiendaCount/a.count)*100):0};
      });
    }catch(e){console.warn('[REPUTACION] no se pudo cargar',e);}
  }

  async function loadLatestSellerRatings(vendedorId,limit=3){
    if(!state.sb || !isUuid(vendedorId)) return [];
    try{
      const r=await state.sb.from('mercado_calificaciones').select('estrellas,comentario,etiquetas,etiquetas_json,created_at').eq('vendedor_id',vendedorId).order('created_at',{ascending:false}).limit(limit);
      if(r.error) return [];
      return r.data||[];
    }catch(e){console.warn('[REPUTACION] últimas opiniones',e);return [];}  
  }
  function latestRatingsHtml(items){
    if(!items||!items.length) return '';
    return `<section class="sellerLatestRatings"><h3>Últimas opiniones</h3>${items.map(r=>{
      const tags=Array.isArray(r.etiquetas)?r.etiquetas:(Array.isArray(r.etiquetas_json)?r.etiquetas_json:[]);
      const comment=String(r.comentario||'').trim();
      return `<article><div><span class="sellerStars">${stars(Number(r.estrellas||0))}</span><b>${Number(r.estrellas||0).toFixed(1)}</b></div>${comment?`<p>“${esc(comment)}”</p>`:''}${tags.length?`<small>${tags.slice(0,2).map(esc).join(' · ')}</small>`:''}</article>`;
    }).join('')}</section>`;
  }
  function recommendPosts(list){
    const base=(list||[]).filter(p=>!isMine(p)&&isActiveMarketPost(p));
    return base.slice().sort((a,b)=>{
      const sa=sellerStats(sellerUuid(a)); const sb=sellerStats(sellerUuid(b));
      const ra=(isBoosted(a)?100:0)+(Number(sa.avg||0)*10)+Number(sa.count||0)+(sameColegio(a)?8:0)+(sameComuna(a)?4:0);
      const rb=(isBoosted(b)?100:0)+(Number(sb.avg||0)*10)+Number(sb.count||0)+(sameColegio(b)?8:0)+(sameComuna(b)?4:0);
      return rb-ra || Date.parse(b.created_at||0)-Date.parse(a.created_at||0);
    }).slice(0,6);
  }
  function renderRecommendations(list){
    const box=document.getElementById('marketRecommendationsList');
    if(!box) return;
    const recs=recommendPosts(list);
    box.innerHTML=recs.length?recs.map(card).join(''):`<div class="emptyState compact"><div class="emptyIcon">✨</div><h3>Pronto tendremos recomendaciones</h3><p>Se activan con publicaciones y calificaciones.</p></div>`;
  }
  function closeMessageForStatus(status){
    const st=String(status||"cerrado").toLowerCase();
    if(st==="vendido") return "[SISTEMA] Esta publicación fue marcada como VENDIDA por el vendedor. La conversación quedó cerrada.";
    if(st==="intercambiado") return "[SISTEMA] Esta publicación fue marcada como INTERCAMBIADA por el vendedor. La conversación quedó cerrada.";
    if(st==="eliminado") return "[SISTEMA] Esta publicación fue eliminada por el vendedor. Ya no está disponible para ver ni contactar.";
    return "[SISTEMA] Esta conversación fue cerrada por el vendedor.";
  }
  function isDeletedPost(p){return ["eliminado","oculto","bloqueado"].includes(postStatus(p));}
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
  function postVisibility(p){return String(p?.visibilidad||'colegio').toLowerCase();}
  function sameColegio(p){return !!(isUuid(state.session?.colegioId) && isUuid(p?.colegio_id) && String(p.colegio_id)===String(state.session.colegioId));}
  function sameComuna(p){
    const userComuna=String(state.session?.comuna||'').toLowerCase().trim();
    const cid=String(p?.colegio_id||'');
    const cached=cid && state.colegioCache?.[cid];
    const postComuna=String(p?.comuna||p?.colegio_comuna||p?.colegio?.comuna||cached?.comuna||'').toLowerCase().trim();
    if(userComuna && postComuna) return userComuna===postComuna;
    // Si no tenemos comuna en la publicación, al menos exige mismo colegio cuando la visibilidad es local.
    return sameColegio(p);
  }
  function canViewPost(p){
    if(!p || isDeletedPost(p) || postStatus(p)==='en_revision') return false;
    // Vendidas/intercambiadas/cerradas pueden verse en detalle por su comunidad o participantes,
    // pero no permiten nuevas consultas. Eliminadas nunca se muestran a compradores.
    if(isMine(p)) return true;
    const v=postVisibility(p);
    if(['todo','cursapp','publico','publica','todos'].includes(v)) return true;
    if(['colegio','mi_colegio','solo_mi_colegio'].includes(v)) return sameColegio(p);
    if(['comuna','mi_comuna','cercanos','cercano'].includes(v)) return sameComuna(p);
    return sameColegio(p);
  }
  function visible(list=state.posts){return list.filter(canViewPost)}
  function activeExploreScope(){
    const btn=document.querySelector('.filters button.active');
    return btn?.dataset?.scope || 'colegio';
  }
  function applyExploreFilter(scope){
    const sc=String(scope||activeExploreScope()||'colegio').toLowerCase();
    $$('.filters button').forEach(b=>b.classList.toggle('active',String(b.dataset.scope||'').toLowerCase()===sc));
    renderProducts(filterByScope(sc));
  }
  function filterByScope(scope){
    const sc=String(scope||'colegio').toLowerCase();
    const base=state.posts.filter(isActiveMarketPost);
    if(sc==='todo') return base.filter(p=>isMine(p)||['todo','cursapp','publico','publica','todos'].includes(postVisibility(p))||sameColegio(p)||sameComuna(p));
    if(sc==='colegio') return base.filter(p=>isMine(p)||sameColegio(p));
    if(sc==='comuna' || sc==='cercanos') return base.filter(p=>isMine(p)||sameComuna(p));
    return visible(base);
  }
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
      <div class="productImageWrap">${isBoosted(p)?`<span class="boostStar" title="Destacado">⭐</span>`:""}${statusBadge(p)}<img src="${esc(imageForPost(p))}" alt="${esc(title)}" onerror="this.src='assets/img/generic.svg'"><button class="favBtn ${fav?"on":""}" data-fav="${esc(p.id)}" title="Favorito">${fav?"♥":"♡"}</button></div>
      <div class="productBody"><b>${esc(title)}</b><strong>${price}</strong><span>${esc(colegioNameForPost(p))}</span><div class="productMeta"><small>${esc(categoryName(p))}</small><small>${esc(relDate(p))}</small></div>${sellerReputationHtml(p,'card')}</div>
    </article>`;
  }
  function renderProducts(list=visible()){
    const f=$("#featuredList"), g=$("#marketGrid"), recent=$("#marketRecentList");
    const ranked=list.slice().sort((a,b)=>(boostedRank(b)-boostedRank(a))||Date.parse(b.created_at||0)-Date.parse(a.created_at||0));
    const empty=emptyState("🛍️","Aún no hay publicaciones","Cuando los apoderados publiquen artículos, aparecerán acá.","Publicar primer aviso","publicar");
    if(f) f.innerHTML=ranked.length?ranked.slice(0,6).map(card).join(""):empty;
    if(g) g.innerHTML=ranked.length?ranked.map(card).join(""):empty;
    renderRecommendations(ranked);
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
    const estado=p=>postStatus(p);
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
      const badge=boosted?`<small class="ownerBoostInfo v28OwnerBoost">⭐ ${esc(boostRuleInfo(activeBoostRule(p)).label)} · ${boostDaysText(p)}</small>`:(current==='activos'?`<button type="button" class="miniBoostLink v28BoostBtn" data-open-boost-modal="${id}">⭐ Destacar</button>`:``);
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
      renderProducts(filterByScope(activeExploreScope()));
      renderMine(preserveMineFilter ? (document.getElementById('myPosts')?.dataset.mineFilter||"activos") : "activos");
      renderCreditVisibilityGuard();
      if(window.CursappMarketCredits?.refresh) await window.CursappMarketCredits.refresh();
      if(window.CursappMarketCredits?.renderHistory) window.CursappMarketCredits.renderHistory();
    }catch(e){ console.warn('reloadAll mercado', e); }
  }

  async function refreshMineView(filter){
    const box=$("#myPosts");
    const current=filter || box?.dataset.mineFilter || "activos";
    renderMine(current);
    const seq=++mineRefreshSeq;
    try{
      await loadMinePosts();
      if(seq===mineRefreshSeq && $("#view-mis")?.classList.contains("active")){
        renderMine(current);
      }
    }catch(e){
      console.warn('[MIS AVISOS] refreshMineView', e);
    }
  }


  function reputationLevelName(stats){
    const n=Number(stats?.count||0), avg=Number(stats?.avg||0);
    if(n>=21 && avg>=4.6) return 'Vendedor excelente';
    if(n>=6 && avg>=4.2) return 'Buen vendedor';
    if(n>=1) return 'Vendedor activo';
    return 'Nuevo vendedor';
  }
  function monthName(v){try{return new Date(v).toLocaleDateString('es-CL',{month:'long',year:'numeric'});}catch(e){return 'junio 2026';}}
  function relativeDate(v){
    const t=Date.parse(v||''); if(!t) return '';
    const d=Math.max(0,Math.floor((Date.now()-t)/86400000));
    if(d===0) return 'Hoy'; if(d===1) return 'Ayer'; if(d<7) return `Hace ${d} días`; if(d<31) return `Hace ${Math.round(d/7)} semana(s)`; return `Hace ${Math.round(d/30)} mes(es)`;
  }
  function ratingBarsHtml(ratings){
    const total=ratings.length||0;
    return [5,4,3,2,1].map(n=>{
      const c=ratings.filter(r=>Number(r.estrellas||0)===n).length;
      const pct=total?Math.round((c/total)*100):0;
      return `<div class="repBar"><span>${'★'.repeat(n)}${'☆'.repeat(5-n)}</span><div><i style="width:${pct}%"></i></div><b>${c}</b></div>`;
    }).join('');
  }
  function topTagsHtml(ratings){
    const map={};
    ratings.forEach(r=>{
      const tags=Array.isArray(r.etiquetas)?r.etiquetas:(Array.isArray(r.etiquetas_json)?r.etiquetas_json:[]);
      tags.forEach(t=>{t=String(t||'').trim(); if(t) map[t]=(map[t]||0)+1;});
    });
    const arr=Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5);
    if(!arr.length) return '<p class="muted">Aún no hay etiquetas destacadas.</p>';
    return `<div class="repTagList">${arr.map(([t,n])=>`<span>✓ ${esc(t)} <small>${n}</small></span>`).join('')}</div>`;
  }
  function latestOpinionsHtml(ratings){
    const items=ratings.filter(r=>String(r.comentario||'').trim() || Number(r.estrellas||0)>0).slice(0,5);
    if(!items.length) return '<p class="muted">Aún no tienes opiniones recibidas.</p>';
    return `<div class="repOpinionList">${items.map(r=>`<article><div><span class="sellerStars">${stars(Number(r.estrellas||0))}</span><b>${Number(r.estrellas||0).toFixed(1)}</b></div>${String(r.comentario||'').trim()?`<p>“${esc(r.comentario)}”</p>`:''}<small>${relativeDate(r.created_at)}</small></article>`).join('')}</div>`;
  }
  async function loadMyReputation(){
    const box=document.getElementById('mySellerProfile'); if(!box) return;
    box.innerHTML=`<div class="emptyState compact"><div class="emptyIcon">⭐</div><h3>Cargando reputación</h3><p>Estamos consultando tus ventas y calificaciones.</p></div>`;
    if(!state.sb || !requireSession()){box.innerHTML=emptyState('🔒','Debes ingresar','Inicia sesión para ver tu perfil de vendedor.');return;}
    try{
      const meUuid=await resolveCurrentUserUuid();
      await loadMinePosts();
      let ratings=[];
      if(isUuid(meUuid)){
        const r=await state.sb.from('mercado_calificaciones').select('*').eq('vendedor_id',meUuid).order('created_at',{ascending:false}).limit(200);
        if(!r.error) ratings=r.data||[];
      }
      const count=ratings.length;
      const avg=count?ratings.reduce((a,r)=>a+Number(r.estrellas||0),0)/count:0;
      const rec=count?Math.round((ratings.filter(r=>r.recomienda).length/count)*100):0;
      const mine=(state.minePosts||[]).filter(p=>!['eliminado'].includes(String(p.estado||'').toLowerCase()));
      const sold=mine.filter(p=>postStatus(p)==='vendido').length;
      const swaps=mine.filter(p=>postStatus(p)==='intercambiado').length;
      const views=mine.reduce((a,p)=>a+Number(p.vistas||p.views||0),0);
      const contacts=mine.reduce((a,p)=>a+Number(p.contactos||p.consultas||0),0);
      const favs=mine.reduce((a,p)=>a+Number(p.favoritos||0),0);
      const firstDate=[...mine.map(p=>p.created_at),...ratings.map(r=>r.created_at)].filter(Boolean).sort()[0]||new Date().toISOString();
      const level=reputationLevelName({count,avg});
      const nextNeed=count===0?1:count<6?6-count:count<21?21-count:count<51?51-count:0;
      box.innerHTML=`
        <section class="sellerProfileHero">
          <div class="sellerProfileIcon">⭐</div>
          <div class="sellerProfileMain">
            <h2>Mi reputación</h2>
            ${count?`<div class="sellerProfileStars"><span class="sellerStars">${stars(avg)}</span><b>${avg.toFixed(1)}</b></div><p>${level}</p><small>${count} calificación${count===1?'':'es'} · ${rec}% recomienda</small>`:`<p>Nuevo vendedor</p><small>Sin calificaciones aún</small>`}
            <em>Miembro desde ${monthName(firstDate)}</em>
          </div>
        </section>
        <section class="repMetricsGrid">
          <article><b>${sold+swaps}</b><span>Ventas concretadas</span></article>
          <article><b>${mine.length}</b><span>Avisos publicados</span></article>
          <article><b>${sold}</b><span>Avisos vendidos</span></article>
          <article><b>${swaps}</b><span>Intercambios</span></article>
        </section>
        <section class="repSection"><h3>Distribución de calificaciones</h3>${ratingBarsHtml(ratings)}</section>
        <section class="repSection"><h3>Lo que más destacan</h3>${topTagsHtml(ratings)}</section>
        <section class="repSection"><h3>Últimas opiniones</h3>${latestOpinionsHtml(ratings)}</section>
        <section class="repSection repProgress"><h3>Progreso del vendedor</h3><div><b>Nivel actual</b><span>${level}</span></div>${nextNeed>0?`<p>Te faltan <b>${nextNeed}</b> calificación${nextNeed===1?'':'es'} para el próximo nivel.</p>`:`<p>Ya estás en un nivel destacado dentro de la comunidad.</p>`}</section>
        <section class="repBadges"><h3>Insignias</h3><div><span class="${sold+swaps>=1?'on':''}">🏅 Primera venta</span><span class="${count>=5?'on':''}">🥇 5 calificaciones</span><span class="${count>=1&&rec===100?'on':''}">⭐ 100% recomendado</span><span class="${swaps>=1?'on':''}">🤝 Intercambios exitosos</span><span class="${sold+swaps>=10?'on':''}">🎯 10 ventas</span></div></section>
        <section class="repSection"><h3>Último mes</h3><div class="repMetricsGrid slim"><article><b>${views}</b><span>Visitas</span></article><article><b>${contacts}</b><span>Conversaciones</span></article><article><b>${sold+swaps}</b><span>Tratos cerrados</span></article><article><b>${favs}</b><span>Favoritos</span></article></div></section>`;
    }catch(e){console.error('[MI REPUTACION]',e);box.innerHTML=emptyState('⚠️','No se pudo cargar','Intenta nuevamente en unos segundos.');}
  }

  function showView(v){
    $$(".view").forEach(x=>x.classList.remove("active"));
    $("#view-"+v)?.classList.add("active");
    $$(".bottomBar button").forEach(x=>x.classList.toggle("active",x.dataset.view===v));
    if(v==="mis") refreshMineView();
    if(v==="explorar") setTimeout(()=>applyExploreFilter(activeExploreScope()),0);
    if(v==="creditos") setTimeout(renderCreditVisibilityGuard,120);
    if(v==="reputacion") setTimeout(loadMyReputation,80);
  }
  function search(q){q=String(q||"").toLowerCase().trim();const scoped=filterByScope(activeExploreScope());const list=!q?scoped:scoped.filter(p=>String((p.titulo||"")+" "+categoryName(p)+" "+(p.descripcion||"")).toLowerCase().includes(q));renderProducts(list);}
  function filterCat(cat){showView("explorar"); renderProducts(filterByScope(activeExploreScope()).filter(p=>categoryName(p)===cat));}

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
    const chatEl=$('#pubChatEnabled'); if(chatEl) chatEl.checked = post.contacto_chat !== false;
    const waEl=$('#pubWhatsappConsent'); if(waEl) waEl.checked = !!(post.contacto_whatsapp || post.whatsapp_consent || post.whatsapp_autorizado || post.permite_whatsapp);
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
    const chatEnabled=$("#pubChatEnabled") ? $("#pubChatEnabled").checked : true;
    const whatsappConsent=$("#pubWhatsappConsent") ? $("#pubWhatsappConsent").checked : false;
    const violation=detectViolation(title,desc);
    await resolveMarketContext();
    const scope=String($('#pubScope')?.value||'colegio').toLowerCase();
    const requiresContext=['colegio','mi_colegio','solo_mi_colegio','comuna','mi_comuna','cercanos'].includes(scope);
    if(requiresContext && !isUuid(state.session.colegioId)){
      toast('No se pudo identificar tu colegio. Vuelve a ingresar a Cursapp antes de publicar.');
      return;
    }
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
      whatsapp: whatsappConsent ? whatsapp : "",
      contacto_chat: chatEnabled,
      contacto_whatsapp: whatsappConsent,
      whatsapp_consent: whatsappConsent,
      permite_whatsapp: whatsappConsent,
      activo:true,
      destacado:false,
      visualizaciones:0,
      contactos:0,
      favoritos:0,
      visibilidad:scope,
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
    const p=state.posts.find(x=>String(x.id)===String(id)) || state.minePosts.find(x=>String(x.id)===String(id)) || state.conversationPosts?.[String(id)]; if(!p) return;
    if(isDeletedPost(p)){
      toast('Esta publicación fue eliminada por el vendedor.');
      return;
    }
    if(!canViewPost(p)){
      toast('Esta publicación pertenece a otro colegio o no está disponible para tu comunidad.');
      return;
    }
    await state.sb.from("mercado_publicaciones").update({visualizaciones:Number(p.visualizaciones||0)+1}).eq("id",p.id);
    p.visualizaciones=Number(p.visualizaciones||0)+1;
    const imgs=(state.imagesByPost[String(p.id)]||[]).map(i=>i.url_imagen).filter(Boolean);
    const main=imageForPost(p);
    const gallery=[main].concat(imgs.filter(u=>u!==main)).slice(0,3);
    const price=Number(p.precio||0)===0?"Intercambio":clp(p.precio);
    const fav=state.favorites.has(String(p.id));
    const latestRatings=await loadLatestSellerRatings(sellerUuid(p),3);
    $("#modal").innerHTML=`<div class="v6DetailOverlay"><article class="v6DetailSheet v13DetailSheet">
      <div class="v6DetailTop"><button class="v6IconBack" onclick="document.getElementById('modal').innerHTML=''">←</button><b>Detalle del aviso</b><button class="v6IconBack" data-share="${esc(p.id)}">⇧</button></div>
      <div class="v13Gallery"><div class="v13GalleryTrack">${gallery.map(u=>`<figure><img src="${esc(u)}" onerror="this.src='assets/img/generic.svg'"></figure>`).join("")}</div><div class="v6Dots">${gallery.map((_,i)=>`<span class="${i===0?'active':''}"></span>`).join("")}</div></div>
      <div class="v6DetailBody">${isBoosted(p)?(isMine(p)?`<em class="boostBadge detailBoost ownerOnly">⭐ ${esc(boostRuleInfo(activeBoostRule(p)).label)} · ${boostDaysText(p)}</em>`:`<em class="boostBadge detailBoost publicOnly">⭐ Destacado</em>`):""}<small class="v6Cat">${esc(categoryName(p))}</small><h2>${esc(p.titulo)}</h2><strong class="v6Price">${price}</strong>
      <div class="v6Chips">${detailStatusChip(p)}<span>⌖ ${esc(colegioNameForPost(p))}</span><span>${esc(relDate(p))}</span></div>
      <p>${esc(p.descripcion||"")}</p>
      <div class="v6Seller"><span>${esc((p.nombre_vendedor||"Apoderado Cursapp").slice(0,2).toUpperCase())}</span><div><b>${esc(p.nombre_vendedor||"Apoderado Cursapp")}</b><small>Comunidad registrada</small>${sellerReputationHtml(p,'detail')}</div></div>
      ${latestRatingsHtml(latestRatings)}
      ${(!isMine(p) && !isClosedPost(p)) ? `<button class="v6Whatsapp" data-contact="${esc(p.id)}">Contactar vendedor</button>` : (isClosedPost(p)?`<div class="chatClosedNotice detailClosed">${postStatusIcon(p)} ${postStatusLabel(p)}. No se aceptan nuevas consultas.</div>`:'')}
      <button class="v6Ghost" data-share="${esc(p.id)}">Compartir aviso</button>
      <button class="v6Ghost" data-fav="${esc(p.id)}">${fav?"♥ Quitar favorito":"♡ Guardar favorito"}</button>
      ${isMine(p) && canBoost(p) ? `<button class="v6BoostBtn" data-open-boost-modal="${esc(p.id)}">⭐ Destacar con créditos</button>` : (isMine(p) && isBoosted(p) ? `<div class="ownerBoostBox">⭐ Ya está destacado · ${boostDaysText(p)}</div>` : "")}
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
      await insertFlex("movimientos_creditos",{usuario_id:uid,email,tipo:"uso",tipo_operacion:"USO_CREDITOS",operacion:"USO_CREDITOS",concepto:"destacado_mercado",cantidad:-Math.abs(Number(cost||0)),creditos:-Math.abs(Number(cost||0)),publicacion_id:publicacionId,publicacion_titulo:ctx.titulo||'',regla:rule,regla_label:info.label,destacado_tipo:info.label,dias:info.days,vence_at:until,saldo_anterior:before,saldo_posterior:after,numero_voucher:voucher,voucher,codigo_operacion:voucher,numero_operacion:voucher,descripcion:`${info.label} · ${ctx.titulo||'publicación'} · ${info.days} días`,created_at:now(),fecha:now()});
      await insertFlex("mercado_creditos_historial",{usuario_id:uid,email,tipo_operacion:"USO_CREDITOS",operacion:"USO_CREDITOS",codigo_operacion:voucher,numero_operacion:voucher,creditos:-Math.abs(Number(cost||0)),publicacion_id:publicacionId,publicacion_titulo:ctx.titulo||'',destacado_tipo:info.label,dias:info.days,vence_at:until,saldo_anterior:before,saldo_posterior:after,voucher,descripcion:`${info.label} · ${ctx.titulo||'publicación'} · ${info.days} días`,fecha:now()});
    }
    await insertFlex("publicaciones_destacadas",{publicacion_id:publicacionId,usuario_id:uid,email,regla:rule,tipo:rule,tipo_destacado:rule,creditos_usados:Number(cost||0),creditos:Number(cost||0),fecha_inicio:now(),fecha_fin:until,vence_at:until,estado:"activa",activo:true,created_at:now()});
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
      document.getElementById("modal").innerHTML=`<div class="v19ConfirmOverlay"><section class="v19Confirm"><h2>Publicación ya destacada</h2><div class="boostConfirmCard"><p>Publicación</p><b>${esc(p.titulo||'Publicación')}</b><p>Destacado actual</p><b>⭐ ${esc(boostRuleInfo(activeBoostRule(p)).label)}</b><p class="muted">Vence ${fmtDateTime(boostUntil(p))} · ${boostDaysText(p)}</p></div><div class="v19ConfirmActions"><button type="button" class="primaryBtn" onclick="document.getElementById('modal').innerHTML=''; window.CursappMarket&&window.CursappMarket.reload&&window.CursappMarket.reload();">Entendido</button></div></section></div>`;
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
    debugBoostAlert("1. boostPost() iniciado", {id, rule, cost});
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
    debugBoostAlert("2. Se abrió modal de confirmación", {id, titulo:p.titulo, rule, cost:costNum, saldoActual, saldoPosterior:saldoActual-costNum, until});
    const ok=await marketConfirm({title:'Confirmar destacado',body,ok:'Confirmar y usar créditos'});
    debugBoostAlert("3. Resultado botón confirmar", {ok, id, rule});
    if(!ok) return;

    // Revalidación final: evita doble descuento si el usuario toca dos veces o viene desde Detalle.
    debugBoostAlert("4. Revalidando si ya existe destacado antes de descontar", {id});
    const existingAfterConfirm=await dbActiveBoost(id);
    if(existingAfterConfirm){
      applyBoostToLocal(id, existingAfterConfirm.rule, existingAfterConfirm.until, existingAfterConfirm.row||{});
      renderProducts(); renderMine(document.getElementById('myPosts')?.dataset.mineFilter||"activos"); renderCreditVisibilityGuard();
      toast("Esta publicación ya tiene un destacado vigente. No se descontaron créditos.");
      document.getElementById("modal").innerHTML=`<div class="v19ConfirmOverlay"><section class="v19Confirm"><h2>Publicación ya destacada</h2><div class="boostConfirmCard"><p>Publicación</p><b>${esc(p.titulo||'Publicación')}</b><p class="muted">Vigente hasta ${fmtDateTime(existingAfterConfirm.until)} · quedan ${daysLeft(existingAfterConfirm.until)} día(s)</p></div><div class="v19ConfirmActions"><button type="button" class="primaryBtn" onclick="document.getElementById('modal').innerHTML=''">Entendido</button></div></section></div>`;
      return;
    }

    // Primero marcamos la publicación. Si falla, no descontamos créditos.
    debugBoostAlert("5. Llamando updatePostFlex() para marcar publicación destacada", {id, rule, until, costNum});
    let r=await updatePostFlex(id,{destacado:true,destacada:true,destacado_desde:now(),destacado_hasta:until,destacada_hasta:until,tipo_destacado:rule,destacado_tipo:rule,regla_destacado:rule,creditos_usados:costNum,updated_at:now()});
    debugBoostAlert("6. Respuesta updatePostFlex()", {error:r.error?String(r.error.message||r.error):null, data:r.data||null});
    if(r.error){toast("No se pudo activar el destacado: "+r.error.message);return;}

    const updatedPayload={
      destacado:true,destacada:true,destacado_desde:now(),destacado_hasta:until,destacada_hasta:until,
      tipo_destacado:rule,destacado_tipo:rule,regla_destacado:rule,creditos_usados:costNum,updated_at:now()
    };

    // V35: actualización visual inmediata apenas Supabase confirma la publicación.
    // Antes quedaba esperando el registro de crédito/historial y el usuario debía salir/volver.
    applyBoostToLocal(id, rule, until, {...updatedPayload, ...(r.data||{})});
    const activeTab=document.getElementById('myPosts')?.dataset.mineFilter||"activos";
    renderProducts();
    renderMine(activeTab);
    renderCreditVisibilityGuard();

    const modalEl=document.getElementById("modal");
    if(modalEl){
      modalEl.innerHTML=`<div class="v19ConfirmOverlay"><section class="v19Confirm successBoostModal"><h2>Procesando destacado</h2><div class="boostConfirmCard"><p>Publicación</p><b>${esc(p.titulo||'Publicación')}</b><p class="muted">Estamos registrando la transacción y el voucher.</p></div></section></div>`;
    }

    let spend;
    try{
      spend=await recordCreditUse(id,rule,costNum,{titulo:p.titulo||'',until,saldoAnterior:saldoActual,saldoPosterior:saldoActual-costNum});
    }catch(e){
      spend={ok:false,message:e?.message||String(e)};
    }
    if(!spend || !spend.ok){
      await updatePostFlex(id,{destacado:false,destacada:false,destacado_hasta:null,destacada_hasta:null,tipo_destacado:null,destacado_tipo:null,regla_destacado:null,creditos_usados:0,updated_at:now()});
      for(const arr of [state.posts,state.minePosts]){
        const x=arr.find(z=>String(z.id)===String(id));
        if(x){Object.assign(x,{destacado:false,destacada:false,destacado_hasta:null,destacada_hasta:null,tipo_destacado:null,destacado_tipo:null,regla_destacado:null,creditos_usados:0});}
      }
      renderProducts(); renderMine(activeTab); renderCreditVisibilityGuard();
      if(modalEl) modalEl.innerHTML='';
      toast(spend?.message||"No se pudo usar créditos.");
      return;
    }

    const successHtml=`<div class="v19ConfirmOverlay"><section class="v19Confirm successBoostModal"><h2>✅ Transacción exitosa</h2><div class="boostConfirmCard"><p>Publicación destacada</p><b>${esc(p.titulo||'Publicación')}</b><p>Tipo</p><b>⭐ ${esc(newInfo.label)}</b><p class="muted">Vigente hasta ${fmtDateTime(until)} · quedan ${daysLeft(until)} día(s)</p><div class="creditSummary"><span>Créditos usados</span><b>-${costNum}</b></div><div class="creditSummary strong"><span>Saldo disponible</span><b>${saldoActual-costNum}</b></div><p class="muted">Voucher: ${esc(spend.voucher||'registrado')}</p></div><div class="v19ConfirmActions"><button type="button" class="primaryBtn" data-close-success-boost>Entendido</button></div></section></div>`;
    if(modalEl) modalEl.innerHTML=successHtml;
    document.querySelector('[data-close-success-boost]')?.addEventListener('click',async()=>{
      document.getElementById('modal').innerHTML='';
      renderProducts();
      renderMine(document.getElementById('myPosts')?.dataset.mineFilter||activeTab);
      renderCreditVisibilityGuard();
      setTimeout(()=>reloadAll(true).catch(console.warn),50);
    },{once:true});
    toast(`Destacado activado: ${newInfo.label}`);

    // Refrescos no bloqueantes: actualizan historial/saldo sin borrar el estado local recién aplicado.
    setTimeout(async()=>{
      try{
        if(window.CursappMarketCredits?.refresh) await window.CursappMarketCredits.refresh();
        if(window.CursappMarketCredits?.renderHistory) window.CursappMarketCredits.renderHistory();
        await reloadAll(true);
        applyBoostToLocal(id, rule, until, {...updatedPayload, ...(r.data||{})});
        renderProducts();
        renderMine(document.getElementById('myPosts')?.dataset.mineFilter||activeTab);
        renderCreditVisibilityGuard();
      }catch(e){ console.warn('post-boost refresh', e); }
    },250);
    } finally {
      boostInFlight.delete(String(id));
    }
  }

  function creditHelp(){
    document.getElementById("modal").innerHTML=`<div class="modal rulesModal creditHelpModal"><h2>¿Qué es canjear visibilidad?</h2><p>Usas créditos para destacar una publicación activa y que aparezca con mayor prioridad.</p><p>• Solo aplica a publicaciones activas.</p><p>• No se puede usar en avisos vendidos o intercambiados.</p><p>• Colegio: 1 crédito por 7 días.</p><p>• Comuna: 3 créditos por 7 días.</p><p>• Todo Cursapp: 5 créditos por 7 días.</p><p>• Solo se permite un destacado vigente por publicación. Puedes mejorar de nivel pagando solo la diferencia.</p><p>• Las publicaciones vendidas o intercambiadas salen de Inicio, Destacados y Créditos.</p><button class="ghost" onclick="document.getElementById('modal').innerHTML=''; window.CursappMarket&&window.CursappMarket.reload&&window.CursappMarket.reload();">Entendido</button></div>`;
  }


  function canUseWhatsapp(p){
    const phone=phoneClean(p.whatsapp||p.vendedor_whatsapp||"");
    const consent = p.contacto_whatsapp===true || p.whatsapp_consent===true || p.permite_whatsapp===true || String(p.contacto_whatsapp).toLowerCase()==='true' || String(p.whatsapp_consent).toLowerCase()==='true' || String(p.permite_whatsapp).toLowerCase()==='true';
    return !!phone && consent;
  }
  function canUseChat(p){return p.contacto_chat !== false && String(p.contacto_chat).toLowerCase() !== 'false';}
  function currentUserKey(){return state.session?.userId || state.session?.email || 'anon';}
  function currentUserUuid(){return isUuid(state.session?.userId)?state.session.userId:null;}
  async function resolveCurrentUserUuid(){
    let uid=currentUserUuid();
    if(uid) return uid;

    const email=String(state.session?.email||'').toLowerCase().trim();

    // Cursapp usa sesión propia con email; las tablas del chat usan usuarios.id (uuid).
    // Por eso se mapea email -> usuarios.id antes de insertar en columnas UUID.
    if(state.sb && email){
      try{
        const res=await state.sb.from('usuarios').select('id').eq('email',email).maybeSingle();
        const found=res?.data?.id;
        if(isUuid(found)){
          state.session.userId=found;
          try{
            const raw=readJson('cursapp_session_v1',{})||{};
            raw.userId=found; raw.usuario_id=found;
            localStorage.setItem('cursapp_session_v1',JSON.stringify(raw));
          }catch(e){}
          return found;
        }
      }catch(e){console.warn('[CHAT] no se pudo mapear email a usuarios.id',e);}
    }

    // Fallback si el proyecto está autenticado también con Supabase Auth.
    if(state.sb?.auth?.getUser){
      try{
        const authRes=await state.sb.auth.getUser();
        const authId=authRes?.data?.user?.id;
        if(isUuid(authId)){
          state.session.userId=authId;
          return authId;
        }
      }catch(e){console.warn('[CHAT] no se pudo obtener auth user',e);}
    }

    return null;
  }
  function sellerUuid(p){return isUuid(p?.vendedor_id)?p.vendedor_id:(isUuid(p?.usuario_id)?p.usuario_id:null);}
  function sellerKey(p){return sellerUuid(p) || p.vendedor_email || p.email || p.usuario_id || p.vendedor_id || p.nombre_vendedor || 'vendedor';}
  function contactMsgDefault(p){return `Hola, ¿sigue disponible ${p?.titulo||'este aviso'}?`;}
  async function loadConversations(){
    state.conversations=[]; state.unreadConversations=0;
    if(!state.sb || (!state.session?.email && !state.session?.userId)){renderConversationBadge();return;}
    const meUuid=await resolveCurrentUserUuid();
    const meEmail=String(state.session?.email||'').toLowerCase();
    const legacyKey=String(currentUserKey());
    const requests=[];
    const addReq=q=>{ if(q) requests.push(q.limit ? q.limit(80) : q); };
    const safeOrder=q=>{ try{return q.order('created_at',{ascending:false});}catch(e){return q;} };

    // Compatibilidad V38/V38.1: algunas instalaciones guardan ids UUID y otras guardan email/texto.
    try{ if(meUuid) addReq(safeOrder(state.sb.from('mercado_conversaciones').select('*').eq('comprador_id',meUuid))); }catch(e){}
    try{ if(meUuid) addReq(safeOrder(state.sb.from('mercado_conversaciones').select('*').eq('vendedor_id',meUuid))); }catch(e){}
    try{ if(meEmail) addReq(safeOrder(state.sb.from('mercado_conversaciones').select('*').eq('comprador_email',meEmail))); }catch(e){}
    try{ if(meEmail) addReq(safeOrder(state.sb.from('mercado_conversaciones').select('*').eq('vendedor_email',meEmail))); }catch(e){}
    try{ if(legacyKey && legacyKey!==meUuid && legacyKey!==meEmail) addReq(safeOrder(state.sb.from('mercado_conversaciones').select('*').eq('comprador_id',legacyKey))); }catch(e){}
    try{ if(legacyKey && legacyKey!==meUuid && legacyKey!==meEmail) addReq(safeOrder(state.sb.from('mercado_conversaciones').select('*').eq('vendedor_id',legacyKey))); }catch(e){}

    if(!requests.length){renderConversationBadge();renderConversations();return;}
    const res=await Promise.allSettled(requests);
    const found=new Map();
    res.forEach(x=>{
      if(x.status==='fulfilled' && !x.value.error){
        (x.value.data||[]).forEach(c=>found.set(String(c.id||c.conversacion_id||`${c.publicacion_id}-${c.comprador_id||c.comprador_email}-${c.vendedor_id||c.vendedor_email}`),c));
      }
    });
    state.conversations=Array.from(found.values()).sort((a,b)=>Date.parse(b.ultimo_mensaje||b.fecha||b.updated_at||b.created_at||0)-Date.parse(a.ultimo_mensaje||a.fecha||a.updated_at||a.created_at||0));
    state.unreadConversations=state.conversations.filter(c=>['nueva','nuevo','abierta'].includes(String(c.estado||'').toLowerCase())).length;
    await hydrateConversationPosts();
    await hydrateConversationUsers(meUuid);
    await hydrateUnreadForConversations();
    renderConversationBadge(); renderConversations();
  }
  async function hydrateConversationPosts(){
    state.conversationPosts=state.conversationPosts||{};
    const ids=[...new Set((state.conversations||[]).map(c=>c.publicacion_id).filter(Boolean).map(String))];
    if(!state.sb || !ids.length) return;
    try{
      // Refrescar siempre: el estado de la publicación puede cambiar (vendido/reactivado/eliminado)
      // y no debe quedar pegado en caché entre pantallas.
      const r=await state.sb.from('mercado_publicaciones').select('*').in('id',ids);
      if(!r.error){
        (r.data||[]).forEach(p=>{
          state.conversationPosts[String(p.id)]=p;
          const replaceIn=(arr)=>{ const i=(arr||[]).findIndex(x=>String(x.id)===String(p.id)); if(i>=0) arr[i]=Object.assign({},arr[i],p); };
          replaceIn(state.posts); replaceIn(state.minePosts);
        });
        await hydratePostSchools(r.data||[]);
      }
    }catch(e){console.warn('[CHAT] hydrate publicaciones conversación',e);}
  }
  function conversationPost(c){return state.posts.find(x=>String(x.id)===String(c.publicacion_id))||state.minePosts.find(x=>String(x.id)===String(c.publicacion_id))||state.conversationPosts?.[String(c.publicacion_id)]||{};}
  function productCode(p){
    const raw=String(p?.codigo||p?.codigo_operacion||p?.id||'').replace(/[^a-z0-9]/gi,'').toUpperCase();
    return raw ? `MKT-${raw.slice(-6)}` : 'MKT-S/C';
  }
  function productPublicUrl(p){return p?.id ? postUrl(p) : '#';}
  async function findExistingConversationForPost(p){
    if(!p || !state.sb) return null;
    const buyerUuid=await resolveCurrentUserUuid();
    const sellerId=sellerUuid(p);
    if(!buyerUuid || !sellerId || !p.id) return null;
    try{
      const r=await state.sb.from('mercado_conversaciones')
        .select('*')
        .eq('publicacion_id',p.id)
        .eq('comprador_id',buyerUuid)
        .eq('vendedor_id',sellerId)
        .order('created_at',{ascending:false})
        .limit(1)
        .maybeSingle();
      if(!r.error && r.data) return r.data;
    }catch(e){ console.warn('[CHAT] buscar conversación existente',e); }
    return null;
  }
  async function openExistingConversationForPost(p){
    const existing=await findExistingConversationForPost(p);
    if(!existing) return false;
    state.conversations=state.conversations||[];
    if(!state.conversations.some(c=>String(c.id)===String(existing.id))){
      state.conversations.unshift(existing);
    }
    state.conversationPosts=state.conversationPosts||{};
    state.conversationPosts[String(p.id)]=p;
    try{await hydrateConversationUsers(await resolveCurrentUserUuid());}catch(e){}
    await openConversation(existing.id);
    return true;
  }
  function maskEmail(email){
    const e=String(email||'').trim().toLowerCase();
    if(!e || !e.includes('@')) return '';
    const [u,d]=e.split('@');
    const prefix=(u||'').slice(0,2) || '*';
    return `${prefix}${'*'.repeat(Math.max(3, Math.min(6, (u||'').length-2)))}@${d}`;
  }
  function conversationOtherId(c,me){return String(c.vendedor_id)===String(me)?c.comprador_id:c.vendedor_id;}
  function conversationOtherProfile(c,me){
    const id=conversationOtherId(c,me);
    return (id && state.userProfiles?.[String(id)]) || null;
  }
  async function hydrateConversationUsers(me){
    state.userProfiles=state.userProfiles||{};
    const ids=[...new Set((state.conversations||[]).map(c=>conversationOtherId(c,me)).filter(isUuid).map(String))]
      .filter(id=>!state.userProfiles[id]);
    if(!state.sb || !ids.length) return;
    try{
      const r=await state.sb.from('usuarios').select('id,email,nombre').in('id',ids);
      if(!r.error){(r.data||[]).forEach(u=>{state.userProfiles[String(u.id)]={id:u.id,email:u.email||'',nombre:u.nombre||''};});}
    }catch(e){console.warn('[CHAT] hydrate usuarios conversación',e);}
  }
  function conversationOtherName(c,p,me){
    const isSeller=String(c.vendedor_id)===String(me);
    const prof=conversationOtherProfile(c,me);
    if(prof?.nombre) return prof.nombre;
    if(isSeller) return c.comprador_nombre||c.nombre_comprador||'Apoderado interesado';
    return c.vendedor_nombre||p.nombre_vendedor||p.vendedor_nombre||'Vendedor';
  }
  function conversationOtherMaskedEmail(c,me){
    const isSeller=String(c.vendedor_id)===String(me);
    const prof=conversationOtherProfile(c,me);
    return maskEmail(prof?.email || (isSeller?c.comprador_email:c.vendedor_email));
  }
  function isConversationClosed(c,p){
    const stPost=postStatus(p);
    if(['vendido','intercambiado','cerrado','eliminado','oculto','bloqueado'].includes(stPost)) return true;
    // estado_conversacion es la fuente de verdad para el hilo. El campo estado puede guardar
    // 'nueva/respondida/cerrada' histórico y no debe cerrar un chat reactivado si ya quedó 'abierta'.
    const stConv=String(c?.estado_conversacion || '').toLowerCase();
    if(stConv) return ['cerrada','cerrado'].includes(stConv);
    return ['cerrada','cerrado'].includes(String(c?.estado||'').toLowerCase());
  }
  function renderConversationBadge(){const b=document.getElementById('conversationBadge'); if(!b)return; const n=Number(state.unreadConversations||0); b.textContent=n; b.style.display=n>0?'grid':'none';}
  function conversationStatusLabel(st){st=String(st||'nueva').toLowerCase(); if(st==='respondida')return 'Respondida'; if(st==='cerrada')return 'Cerrada'; if(st==='venta_concretada')return 'Venta concretada'; return 'Nueva';}
  function renderConversations(){
    const box=document.getElementById('conversationsList'); if(!box)return;
    if(!state.conversations.length){box.innerHTML=`<div class="emptyState"><div class="emptyIcon">💬</div><h3>Aún no tienes conversaciones</h3><p>Cuando contactes o te contacten por una publicación, aparecerá aquí.</p></div>`;return;}
    const me=state.session?.userId||'';
    const groups=new Map();
    (state.conversations||[]).forEach(c=>{
      const key=String(c.publicacion_id||c.id);
      if(!groups.has(key)) groups.set(key,{post:conversationPost(c),items:[]});
      groups.get(key).items.push(c);
    });
    box.innerHTML=Array.from(groups.values()).map(g=>{
      const p=g.post||{};
      const items=g.items.sort((a,b)=>Date.parse(b.ultimo_mensaje||b.created_at||0)-Date.parse(a.ultimo_mensaje||a.created_at||0));
      const head=`<div class="conversationProductGroupHead"><div><b>📦 ${esc(p.titulo||items[0]?.publicacion_titulo||'Publicación')}</b><small>${esc(productCode(p))} · ${items.length} consulta${items.length===1?'':'s'} · ${postStatusIcon(p)} ${postStatusLabel(p)}</small></div>${p.id?`<button type="button" data-open-detail="${esc(p.id)}">Ver aviso</button>`:''}</div>`;
      const rows=items.map(c=>{
        const unread=Number(c.__unread||0);
        const status=unread>0?'nueva':(isConversationClosed(c,p)?postStatus(p):c.estado||'abierta');
        const other=conversationOtherName(c,p,me);
        const masked=conversationOtherMaskedEmail(c,me);
        return `<article class="conversationCard grouped" data-open-conversation="${esc(c.id)}"><div class="conversationAvatar">💬</div><div><b>${esc(other)}${masked?` <small class="maskedEmail">${esc(masked)}</small>`:''}</b><span>${esc(c.__lastText||c.mensaje||'Consulta por Mercado Escolar')}</span><small>${fmtDateTime(c.ultimo_mensaje||c.fecha||c.created_at||new Date())}</small></div><em class="convStatus ${esc(String(status).toLowerCase())}">${unread>0?'Nueva':esc(isConversationClosed(c,p)?postStatusLabel(p):conversationStatusLabel(c.estado))}</em></article>`;
      }).join('');
      return `<section class="conversationProductGroup">${head}<div class="conversationProductGroupRows">${rows}</div></section>`;
    }).join('');
  }
  async function hydrateUnreadForConversations(){
    const me=await resolveCurrentUserUuid();
    const ids=(state.conversations||[]).map(c=>c.id).filter(Boolean);
    if(!state.sb || !me || !ids.length) return;
    try{
      const r=await state.sb.from('mercado_mensajes').select('*').in('conversacion_id',ids).order('created_at',{ascending:true});
      if(r.error) return;
      const byConv=new Map();
      (r.data||[]).forEach(m=>{
        const k=String(m.conversacion_id); if(!byConv.has(k)) byConv.set(k,[]); byConv.get(k).push(m);
      });
      state.conversations.forEach(c=>{
        const msgs=byConv.get(String(c.id))||[];
        c.__unread=msgs.filter(m=>String(m.remitente_id)!==String(me) && m.leido===false).length;
        const last=msgs[msgs.length-1];
        if(last?.mensaje) c.__lastText=last.mensaje;
      });
      state.unreadConversations=state.conversations.filter(c=>Number(c.__unread||0)>0).length;
    }catch(e){console.warn('[CHAT] unread hydrate',e);}
  }
  async function refreshConversationAndPost(conversationId){
    let conv=(state.conversations||[]).find(x=>String(x.id)===String(conversationId))||null;
    if(!state.sb || !conversationId) return {conversation:conv, post:conv?conversationPost(conv):{}};
    try{
      const cr=await state.sb.from('mercado_conversaciones').select('*').eq('id',conversationId).maybeSingle();
      if(!cr.error && cr.data){
        conv=cr.data;
        state.conversations=state.conversations||[];
        const i=state.conversations.findIndex(x=>String(x.id)===String(conversationId));
        if(i>=0) state.conversations[i]=Object.assign({},state.conversations[i],conv); else state.conversations.unshift(conv);
      }
      if(conv?.publicacion_id){
        const pr=await state.sb.from('mercado_publicaciones').select('*').eq('id',conv.publicacion_id).maybeSingle();
        if(!pr.error && pr.data){
          state.conversationPosts=state.conversationPosts||{};
          state.conversationPosts[String(pr.data.id)]=pr.data;
          const replaceIn=(arr)=>{ const j=(arr||[]).findIndex(x=>String(x.id)===String(pr.data.id)); if(j>=0) arr[j]=Object.assign({},arr[j],pr.data); };
          replaceIn(state.posts); replaceIn(state.minePosts);
          return {conversation:conv, post:pr.data};
        }
      }
    }catch(e){console.warn('[CHAT] refresh conversación/publicación',e);}
    return {conversation:conv, post:conv?conversationPost(conv):{}};
  }

  async function openConversation(conversationId){
    if(!requireSession()) return;
    const me=await resolveCurrentUserUuid();
    const refreshed=await refreshConversationAndPost(conversationId);
    const c=refreshed.conversation;
    if(!c){toast('No se encontró la conversación.');return;}
    if(String(c.comprador_id)!==String(me) && String(c.vendedor_id)!==String(me)){toast('No puedes abrir esta conversación.');return;}
    const p=refreshed.post || conversationPost(c);
    let msgs=[];
    try{
      const r=await state.sb.from('mercado_mensajes').select('*').eq('conversacion_id',c.id).order('created_at',{ascending:true});
      if(r.error) throw r.error;
      msgs=r.data||[];
    }catch(e){toast('No se pudieron cargar los mensajes: '+(e.message||e));return;}
    try{
      await state.sb.from('mercado_mensajes').update({leido:true}).eq('conversacion_id',c.id).neq('remitente_id',me);
    }catch(e){console.warn('[CHAT] marcar leido',e);}
    const rows=msgs.map(m=>`<div class="chatBubble ${String(m.mensaje||'').startsWith('[SISTEMA]')?'system':(String(m.remitente_id)===String(me)?'mine':'theirs')}"><p>${esc(m.mensaje||'')}</p><small>${fmtDateTime(m.created_at||m.fecha||new Date())}</small></div>`).join('') || '<p class="muted">Sin mensajes todavía.</p>';
    const other=conversationOtherName(c,p,me);
    const otherEmail=conversationOtherMaskedEmail(c,me);
    const sellerMode=String(c.vendedor_id)===String(me);
    const closed=isConversationClosed(c,p);
    const msgCount=msgs.length;
    const statusPill=`<span class="chatStatusPill ${esc(String(postStatusLabel(p)).toLowerCase())}">${postStatusIcon(p)} ${esc(postStatusLabel(p))}</span>`;
    const headerStatus=isClosedPost(p)?statusPill:'';
    const sellerActions=(sellerMode && !closed)?`<div class="chatDealClose"><div class="chatDealTop"><span class="chatDealTitle">Cerrar trato</span></div><div class="chatSellerActions compact"><button type="button" class="softChip success" data-close-post-from-chat="vendido" data-conversation-id="${esc(c.id)}">✓ Vendido</button><button type="button" class="softChip info" data-close-post-from-chat="intercambiado" data-conversation-id="${esc(c.id)}">⇄ Intercambiado</button></div><p class="sellerActionHelp">Cierra desde el chat del comprador que recibió el producto. Así se asocia la venta y se habilita su calificación.</p></div>`:'';
    const footerStateText = closed
      ? `${postStatusIcon(p)} ${postStatusLabel(p)}. Historial visible, chat cerrado.`
      : `🟢 Disponible. Puedes continuar la conversación.`;
    const canRate=closed && !sellerMode && canConversationRate(c,p,me);
    const replyFooter=closed
      ? `<div class="chatClosedNotice compact">${footerStateText}</div>${canRate?`<button type="button" class="primaryBtn rateSellerBtn" data-rate-conversation="${esc(c.id)}">⭐ Calificar vendedor</button>`:''}`
      : `<div class="chatReplyFooter compact"><textarea id="chatReplyText" rows="1" placeholder="Escribe un mensaje..." autocomplete="off"></textarea><button type="button" class="primaryBtn" data-send-conversation-reply="${esc(c.id)}" disabled>Enviar</button></div><div class="chatClosedNotice compact openState">${footerStateText}</div>`;
    const viewLink=p?.id?`<button type="button" class="chatProductLink" data-open-detail="${esc(p.id)}">🔗 Ver aviso</button>`:'';
    document.getElementById('modal').innerHTML=`<div class="v19ConfirmOverlay"><section class="v19Confirm chatThreadModal chatThreadModalV39 chatThreadModalV51 chatThreadModalV52 chatThreadModalV54"><button type="button" class="chatStickyClose" data-close-chat-thread aria-label="Cerrar conversación">✕</button><div class="chatThreadHead compact chatThreadHeadV51"><button type="button" class="ghost chatBackBtn" data-close-chat-thread>←</button><div class="chatHeadMain"><div class="chatTitleRow"><h2>${esc(p.titulo||'Conversación')}</h2>${viewLink}</div><p class="chatWith"><b>${esc(other)}</b>${otherEmail?` <span class="maskedEmail">${esc(otherEmail)}</span>`:''}</p>${sellerReputationHtml(p,'chat')}<div class="chatHeadLinks">${headerStatus}<span class="chatMsgCount">${msgCount} mensaje${msgCount===1?'':'s'}</span></div></div></div>${sellerActions}<div class="chatSectionDivider"><span>Conversación</span></div><div id="chatThreadMessages" class="chatThreadMessages">${rows}</div>${replyFooter}</section></div>`;
    const replyEl=document.getElementById('chatReplyText');
    const replyBtn=document.querySelector(`[data-send-conversation-reply="${String(c.id).replace(/"/g,'\\"')}"]`);
    if(replyEl && replyBtn){
      const syncReplyBtn=()=>{ replyBtn.disabled=!replyEl.value.trim(); };
      replyEl.addEventListener('input',syncReplyBtn);
      syncReplyBtn();
    }
    setTimeout(()=>{const box=document.getElementById('chatThreadMessages'); if(box) box.scrollTop=box.scrollHeight;},50);
    try{await loadConversations();}catch(e){}
  }
  async function sendConversationReply(conversationId){
    if(!requireSession()) return;
    const btn=document.querySelector(`[data-send-conversation-reply="${String(conversationId).replace(/"/g,'\\"')}"]`);
    if(btn?.disabled) return;
    const text=(document.getElementById('chatReplyText')?.value||'').trim();
    if(!text){toast('Escribe una respuesta.');return;}
    const me=await resolveCurrentUserUuid();
    let c=(state.conversations||[]).find(x=>String(x.id)===String(conversationId));
    if(!c && state.sb){
      try{
        const cr=await state.sb.from('mercado_conversaciones').select('*').eq('id',conversationId).maybeSingle();
        if(!cr.error && cr.data){
          c=cr.data;
          state.conversations=state.conversations||[];
          state.conversations.unshift(c);
          await hydrateConversationPosts();
          await hydrateConversationUsers(me);
        }
      }catch(e){console.warn('[CHAT] recargar conversación para responder',e);}
    }
    if(!me || !c){toast('No se pudo validar la conversación.');return;}
    const refreshed=await refreshConversationAndPost(conversationId);
    if(refreshed.conversation) c=refreshed.conversation;
    const p=refreshed.post || conversationPost(c);
    if(String(c.comprador_id)!==String(me) && String(c.vendedor_id)!==String(me)){toast('No puedes responder esta conversación.');return;}
    if(isConversationClosed(c,p)){toast('Esta conversación está cerrada.');return;}
    if(btn){btn.disabled=true; btn.textContent='Enviando...';}
    const timestamp=now();
    try{
      const msg=await state.sb.from('mercado_mensajes').insert([{conversacion_id:c.id,remitente_id:me,mensaje:text,leido:false,created_at:timestamp}]).select('*').maybeSingle();
      if(msg.error) throw msg.error;
      const estado=String(c.vendedor_id)===String(me)?'respondida':'nueva';
      try{await state.sb.from('mercado_conversaciones').update({ultimo_mensaje:timestamp,estado}).eq('id',c.id);}catch(e){console.warn('[CHAT] update conversacion',e);}
      toast('Respuesta enviada');
      await loadConversations();
      await openConversation(c.id);
    }catch(e){toast('No se pudo enviar la respuesta: '+(e.message||e));}
    finally{ if(btn){btn.disabled=false; btn.textContent='Enviar respuesta';} }
  }
  async function createInternalConversation(p,message){
    const buyerUuid=await resolveCurrentUserUuid();
    const buyerEmail=String(state.session?.email||'').toLowerCase();
    const sellerId=sellerUuid(p);
    const sellerEmail=String(p.vendedor_email||p.email||'').toLowerCase();
    const timestamp=now();

    if(!isUuid(p.id)){
      return {error:{message:'La publicación no tiene ID UUID válido para crear conversación.'}};
    }
    if(!buyerUuid){
      return {error:{message:'No se pudo obtener el UUID del comprador. Cierra sesión y vuelve a ingresar.'}};
    }
    if(!sellerId){
      return {error:{message:'La publicación no tiene vendedor_id/usuario_id UUID. Revisa la publicación en mercado_publicaciones.'}};
    }
    if(String(buyerUuid)===String(sellerId)){
      return {error:{message:'No puedes contactar tus propias publicaciones.'}};
    }
    if(isClosedPost(p)){
      return {error:{message:'Esta publicación ya no está disponible.'}};
    }

    // Esquema real V38.1 de mercado_conversaciones:
    // id, publicacion_id, vendedor_id, comprador_id, estado, ultimo_mensaje, created_at.
    // No enviar nombres, emails, titulo_publicacion, fecha ni updated_at porque no existen en Supabase.
    const convRow={
      publicacion_id:p.id,
      comprador_id:buyerUuid,
      vendedor_id:sellerId,
      estado:'nueva',
      ultimo_mensaje:timestamp,
      created_at:timestamp
    };

    // Evitar conversaciones duplicadas para la misma publicación/comprador/vendedor.
    let conv=null;
    try{
      const existing=await state.sb.from('mercado_conversaciones')
        .select('*')
        .eq('publicacion_id',p.id)
        .eq('comprador_id',buyerUuid)
        .eq('vendedor_id',sellerId)
        .order('created_at',{ascending:false})
        .limit(1)
        .maybeSingle();
      if(!existing.error && existing.data) conv=existing;
    }catch(e){ console.warn('[CHAT] búsqueda conversación existente falló', e); }

    if(!conv){
      conv=await state.sb.from('mercado_conversaciones').insert([convRow]).select('*').maybeSingle();
    }
    if(!conv || conv.error) return conv||{error:{message:'No se pudo crear la conversación'}};

    const convId=conv.data?.id||conv.data?.conversacion_id||null;
    if(!convId) return {error:{message:'Conversación creada sin ID. No se pudo registrar el mensaje.'}};

    // Insert exacto: el texto del mensaje solo va en mercado_mensajes.mensaje.
    const msgRes=await state.sb.from('mercado_mensajes').insert([{
      conversacion_id:convId,
      remitente_id:buyerUuid,
      mensaje:message,
      leido:false,
      created_at:timestamp
    }]).select('*').maybeSingle();
    if(msgRes?.error) return msgRes;

    try{await state.sb.from('mercado_conversaciones').update({ultimo_mensaje:timestamp,estado:'nueva'}).eq('id',convId);}catch(e){console.warn('[CHAT] actualizar último mensaje',e);}

    return conv;
  }
  async function hasRating(conversationId,publicacionId,compradorId){
    try{
      const r=await state.sb.from('mercado_calificaciones').select('id').eq('conversacion_id',conversationId).eq('comprador_id',compradorId).limit(1).maybeSingle();
      if(!r.error && r.data) return true;
      const r2=await state.sb.from('mercado_calificaciones').select('id').eq('publicacion_id',publicacionId).eq('comprador_id',compradorId).limit(1).maybeSingle();
      return !r2.error && !!r2.data;
    }catch(e){return false;}
  }
  async function openRatingModal(conversationId){
    if(!requireSession()) return;
    const me=await resolveCurrentUserUuid();
    const refreshed=await refreshConversationAndPost(conversationId);
    const c=refreshed.conversation; const p=refreshed.post || conversationPost(c);
    if(!c||!p){toast('No se pudo abrir la calificación.');return;}
    if(String(c.comprador_id)!==String(me)){toast('Solo el comprador puede calificar esta venta.');return;}
    if(!['vendido','intercambiado'].includes(postStatus(p))){toast('Solo se puede calificar una venta cerrada.');return;}
    if(await hasRating(c.id,p.id,me)){toast('Ya calificaste esta venta.');return;}
    const tags=['Producto igual a la publicación','Buena comunicación','Entrega rápida','Puntual','Recomendado'];
    document.getElementById('modal').innerHTML=`<div class="v19ConfirmOverlay"><section class="v19Confirm ratingModal"><h2>⭐ Calificar vendedor</h2><div class="boostConfirmCard"><p>Publicación</p><b>${esc(p.titulo||'Publicación')}</b><p class="muted">Tu calificación ayuda a otros apoderados.</p><label>Estrellas<select id="ratingStars"><option value="5">★★★★★ Excelente</option><option value="4">★★★★ Bueno</option><option value="3">★★★ Regular</option><option value="2">★★ Malo</option><option value="1">★ Muy malo</option></select></label><label class="contactCheck"><input id="ratingRecommend" type="checkbox" checked> Recomiendo este vendedor</label><div class="ratingTags">${tags.map(t=>`<label><input type="checkbox" value="${esc(t)}"> ${esc(t)}</label>`).join('')}</div><label>Comentario opcional<textarea id="ratingComment" maxlength="200" rows="3" placeholder="Máximo 200 caracteres"></textarea></label></div><div class="v19ConfirmActions"><button type="button" class="primaryBtn" data-submit-rating="${esc(c.id)}">Enviar calificación</button><button type="button" class="ghost" onclick="document.getElementById('modal').innerHTML=''">Cancelar</button></div></section></div>`;
  }
  async function submitRating(conversationId){
    const me=await resolveCurrentUserUuid();
    const c=(state.conversations||[]).find(x=>String(x.id)===String(conversationId)) || (await refreshConversationAndPost(conversationId)).conversation;
    const p=conversationPost(c||{});
    if(!me||!c||!p){toast('No se pudo guardar la calificación.');return;}
    const estrellas=Math.max(1,Math.min(5,Number(document.getElementById('ratingStars')?.value||5)));
    const etiquetas=Array.from(document.querySelectorAll('.ratingTags input:checked')).map(x=>x.value);
    const row={publicacion_id:p.id,conversacion_id:c.id,vendedor_id:c.vendedor_id,comprador_id:me,estrellas,recomienda:!!document.getElementById('ratingRecommend')?.checked,comentario:(document.getElementById('ratingComment')?.value||'').slice(0,200),etiquetas,etiquetas_json:etiquetas,created_at:now()};
    const r=await insertFlex('mercado_calificaciones',row);
    if(r.error){toast('No se pudo calificar: '+(r.error.message||JSON.stringify(r.error)));return;}
    toast('Calificación enviada. ¡Gracias!');
    await loadSellerReputationForPosts([p]);
    await loadConversations();
    document.getElementById('modal').innerHTML='';
  }

  function contactModal(p){
    if(isClosedPost(p)){toast('Esta publicación ya no está disponible.');return;}
    const chat=canUseChat(p), wa=canUseWhatsapp(p), msg=contactMsgDefault(p);
    const waBtn=wa?`<button type="button" class="waContactBtn" data-contact-whatsapp="${esc(p.id)}">WhatsApp autorizado</button>`:'';
    const chatBtn=chat?`<button type="button" class="primaryBtn" data-send-internal-chat="${esc(p.id)}">Enviar consulta</button>`:'';
    const privacy=!wa?`<p class="privacyContactNote">Este vendedor usa chat interno para proteger su privacidad.</p>`:`<p class="privacyContactNote">El vendedor autorizó contacto por WhatsApp. También puedes usar chat interno.</p>`;
    document.getElementById('modal').innerHTML=`<div class="v19ConfirmOverlay"><section class="v19Confirm contactModalV38"><h2>Contactar vendedor</h2><div class="boostConfirmCard"><p>Publicación</p><b>${esc(p.titulo||'Publicación')}</b>${privacy}<label>Mensaje<textarea id="internalContactMsg" rows="3">${esc(msg)}</textarea></label></div><div class="v19ConfirmActions">${chatBtn}${waBtn}<button type="button" class="ghost" onclick="document.getElementById('modal').innerHTML=''">Cancelar</button></div></section></div>`;
  }
  async function sendInternalChat(id){
    if(!requireSession()) return;

    const sendKey=String(id||'');
    if(state.chatSending?.has(sendKey)) return;
    state.chatSending.add(sendKey);

    const btn=document.querySelector(`[data-send-internal-chat="${String(id).replace(/"/g,'\\"')}"]`);
    if(btn){btn.disabled=true; btn.dataset.originalText=btn.textContent; btn.textContent='Enviando...';}

    try{
      const p=state.posts.find(x=>String(x.id)===String(id))||state.minePosts.find(x=>String(x.id)===String(id));
      if(!p){toast('No se encontró la publicación para enviar la consulta.'); return;}
      if(isMine(p)){toast('Esta publicación es tuya.'); return;}

      const msg=(document.getElementById('internalContactMsg')?.value||contactMsgDefault(p)).trim();
      if(!msg){toast('Escribe un mensaje.'); return;}

      const conv=await createInternalConversation(p,msg);
      if(conv.error){
        console.error('[CHAT] createInternalConversation error',conv.error);
        toast('No se pudo crear conversación: '+(conv.error.message||JSON.stringify(conv.error)));
        return;
      }

      // Registro de contacto: no bloquea el envío si esta tabla tiene columnas distintas.
      try{
        const compradorUuid=await resolveCurrentUserUuid();
        const vendedorUuid=sellerUuid(p);
        const contactRows=[
          {publicacion_id:p.id,vendedor_id:vendedorUuid,comprador_id:compradorUuid,usuario_id:compradorUuid,interesado_id:compradorUuid,canal:'chat_interno',medio_contacto:'chat_interno',mensaje:msg,fecha:now(),created_at:now()},
          {publicacion_id:p.id,usuario_email:state.session.email,vendedor_email:String(p.vendedor_email||p.email||'').toLowerCase(),medio_contacto:'chat_interno',mensaje:msg,created_at:now()}
        ];
        for(const row of contactRows){
          const r=await insertFlex('mercado_contactos',row);
          if(!r.error) break;
        }
      }catch(contactError){
        console.warn('[CHAT] contacto no bloqueante',contactError);
      }

      p.contactos=Number(p.contactos||0)+1;
      try{state.sb.from('mercado_publicaciones').update({contactos:p.contactos}).eq('id',p.id).then(()=>{});}catch(e){}

      document.getElementById('modal').innerHTML=`<div class="v19ConfirmOverlay"><section class="v19Confirm successBoostModal"><h2>✅ Consulta enviada</h2><div class="boostConfirmCard"><p>Publicación</p><b>${esc(p.titulo||'Publicación')}</b><p class="muted">El vendedor verá tu consulta en Conversaciones.</p></div><div class="v19ConfirmActions"><button type="button" class="primaryBtn" onclick="document.getElementById('modal').innerHTML=''">Entendido</button><button type="button" class="ghost" onclick="document.getElementById('modal').innerHTML=''; window.CursappMarket&&window.CursappMarket.showView&&window.CursappMarket.showView('conversaciones'); window.CursappMarket&&window.CursappMarket.loadConversations&&window.CursappMarket.loadConversations();">Ver conversaciones</button></div></section></div>`;

      toast('Consulta enviada correctamente');
      try{await loadConversations();}catch(e){console.warn('[CHAT] loadConversations',e);}
      renderProducts();

    }catch(error){
      console.error('[CHAT ERROR]',error);
      toast('No se pudo enviar la consulta: '+(error?.message||String(error)));
    }finally{
      state.chatSending?.delete(sendKey);
      if(btn){btn.disabled=false; btn.textContent=btn.dataset.originalText||'Enviar consulta';}
    }
  }
  async function contactWhatsapp(id){
    const p=state.posts.find(x=>String(x.id)===String(id))||state.minePosts.find(x=>String(x.id)===String(id)); if(!p)return;
    if(isClosedPost(p)){toast('Esta publicación ya no está disponible.');return;}
    if(!canUseWhatsapp(p)){toast('El vendedor no autorizó contacto por WhatsApp. Usa chat interno.');return;}
    const phone=phoneClean(p.whatsapp||p.vendedor_whatsapp||''), msg=shareText(p).replace('Vi esta publicación','Estoy interesado en esta publicación');
    await insertFlex('mercado_contactos',{publicacion_id:p.id,usuario_id:state.session.userId||state.session.email,interesado_id:isUuid(state.session.userId)?state.session.userId:null,canal:'whatsapp',medio_contacto:'whatsapp',mensaje:msg,fecha:now(),created_at:now()});
    p.contactos=Number(p.contactos||0)+1; state.sb.from('mercado_publicaciones').update({contactos:p.contactos}).eq('id',p.id).then(()=>{});
    toast('Contacto registrado. Abriendo WhatsApp...'); window.open(`https://wa.me/${phone.startsWith('56')?phone:'56'+phone}?text=${encodeURIComponent(msg)}`,'_blank');
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
    const p=state.posts.find(x=>String(x.id)===String(id))||state.minePosts.find(x=>String(x.id)===String(id))||state.conversationPosts?.[String(id)];
    if(!p) return;
    if(isMine(p)){toast('Esta publicación es tuya.'); return;}
    if(isClosedPost(p)){toast('Esta publicación ya no está disponible.'); return;}
    const opened=await openExistingConversationForPost(p);
    if(opened) return;
    contactModal(p);
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
      if(p){ p.estado=status; p.estado_publicacion=status; if(["vendido","intercambiado","eliminado"].includes(status)){p.destacado=false;p.destacada=false;p.destacado_hasta=null;p.destacada_hasta=null;p.tipo_destacado=null;p.destacado_tipo=null;p.regla_destacado=null;} }
    }
  }
  async function updateConversationFlex(id,row){
    let cleaned={...row};
    for(let attempt=0; attempt<8; attempt++){
      const res=await state.sb.from('mercado_conversaciones').update(cleaned).eq('id',id).select('*').maybeSingle();
      if(!res.error) return res;
      const msg=String(res.error.message||'');
      const m=msg.match(/'([^']+)' column of '[^']+' in the schema cache/i) || msg.match(/column "([^"]+)"/i);
      if(m && cleaned[m[1]]!==undefined){ delete cleaned[m[1]]; continue; }
      return res;
    }
    return state.sb.from('mercado_conversaciones').update(cleaned).eq('id',id).select('*').maybeSingle();
  }
  async function closeConversationsForPost(publicacionId,status){
    if(!state.sb || !publicacionId) return;
    const timestamp=now();
    let convs=[];
    try{
      const r=await state.sb.from('mercado_conversaciones').select('*').eq('publicacion_id',publicacionId);
      if(r.error) return;
      convs=r.data||[];
    }catch(e){console.warn('[CHAT] cierre conversaciones',e);return;}
    for(const c of convs){
      try{
        await updateConversationFlex(c.id,{estado:'cerrada',estado_conversacion:'cerrada',ultimo_mensaje:timestamp,fecha_cierre:timestamp,motivo_cierre:status,updated_at:timestamp});
        const remitente=isUuid(c.vendedor_id)?c.vendedor_id:(await resolveCurrentUserUuid());
        await insertFlex('mercado_mensajes',{conversacion_id:c.id,remitente_id:remitente,mensaje:closeMessageForStatus(status),leido:false,created_at:timestamp,fecha:timestamp,estado:'sistema'});
      }catch(e){console.warn('[CHAT] mensaje sistema cierre',e);}
    }
  }
  async function reopenConversationsForPost(publicacionId){
    if(!state.sb || !publicacionId) return;
    const timestamp=now();
    try{
      const r=await state.sb.from('mercado_conversaciones').select('*').eq('publicacion_id', publicacionId);
      const convs=r.error?[]:(r.data||[]);
      await state.sb
        .from('mercado_conversaciones')
        .update({
          estado:'abierta',
          estado_conversacion:'abierta',
          fecha_cierre:null,
          motivo_cierre:null,
          ultimo_mensaje:timestamp,
          updated_at:timestamp
        })
        .eq('publicacion_id', publicacionId);
      const me=await resolveCurrentUserUuid();
      for(const c of convs){
        try{
          await insertFlex('mercado_mensajes',{
            conversacion_id:c.id,
            remitente_id:isUuid(me)?me:(isUuid(c.vendedor_id)?c.vendedor_id:c.comprador_id),
            mensaje:'[SISTEMA] La publicación fue reactivada por el vendedor. La conversación vuelve a estar disponible.',
            leido:false,
            created_at:timestamp,
            fecha:timestamp,
            estado:'sistema'
          });
        }catch(e){console.warn('[CHAT] mensaje sistema reapertura',e);}
      }
    }catch(e){
      console.warn('[CHAT] reapertura conversaciones', e);
    }
  }

  function isSaleStatus(status){return ['vendido','intercambiado'].includes(String(status||'').toLowerCase());}
  function soldConversationId(p){return String(p?.conversacion_venta_id||p?.venta_conversacion_id||p?.conversacion_final_id||p?.conversacion_compra_id||'');}
  function soldBuyerId(p){return String(p?.comprador_final_id||p?.comprador_id_final||p?.comprador_venta_id||p?.comprador_id||'');}
  function canConversationRate(c,p,me){
    if(!c||!p||!me) return false;
    if(String(c.comprador_id)!==String(me)) return false;
    if(!['vendido','intercambiado'].includes(postStatus(p))) return false;
    const sid=soldConversationId(p);
    const bid=soldBuyerId(p);
    if(sid) return String(c.id)===sid;
    if(bid) return String(c.comprador_id)===bid;
    return ['venta_concretada','venta_confirmada'].includes(String(c.estado||c.estado_conversacion||'').toLowerCase());
  }
  function buyerNameForConversation(c,p){return conversationOtherName(c,p,String(c.vendedor_id||''));}
  async function conversationsForMyPost(publicacionId){
    if(!state.sb||!publicacionId) return [];
    try{
      const r=await state.sb.from('mercado_conversaciones').select('*').eq('publicacion_id',publicacionId).order('ultimo_mensaje',{ascending:false});
      if(r.error) return [];
      return r.data||[];
    }catch(e){console.warn('[VENTA] conversaciones publicación',e);return [];}  
  }
  function saleSelectionModal(publicacionId,status,convs=[]){
    return new Promise(resolve=>{
      const modal=document.getElementById('modal');
      const label=status==='vendido'?'vendiste':'intercambiaste';
      const rows=(convs||[]).map(c=>{
        const p=conversationPost(c)||{};
        const name=conversationOtherName(c,p,String(c.vendedor_id||''));
        const email=conversationOtherMaskedEmail(c,String(c.vendedor_id||''));
        const last=esc(c.__lastText||c.mensaje||'Consulta por el aviso');
        return `<button type="button" class="saleBuyerOption" data-sale-conversation="${esc(c.id)}"><b>${esc(name)}</b>${email?`<span>${esc(email)}</span>`:''}<small>${last}</small></button>`;
      }).join('');
      modal.innerHTML=`<div class="v19ConfirmOverlay"><section class="v19Confirm saleBuyerSheet"><h2>¿A quién se lo ${esc(label)}?</h2><p class="muted">Para habilitar calificación, selecciona la conversación real de la venta. Solo ese comprador podrá evaluar.</p><div class="saleBuyerList">${rows||'<p class="muted">No hay conversaciones para este aviso.</p>'}</div><div class="v19ConfirmActions"><button type="button" class="ghost" data-sale-cancel>Cancelar</button><button type="button" class="ghost" data-sale-without-buyer>Marcar sin comprador</button></div></section></div>`;
      modal.querySelector('[data-sale-cancel]')?.addEventListener('click',()=>{modal.innerHTML='';resolve(null);},{once:true});
      modal.querySelector('[data-sale-without-buyer]')?.addEventListener('click',()=>{modal.innerHTML='';resolve({withoutBuyer:true});},{once:true});
      modal.querySelectorAll('[data-sale-conversation]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.getAttribute('data-sale-conversation');modal.innerHTML='';resolve(convs.find(c=>String(c.id)===String(id))||null);},{once:true}));
    });
  }
  async function markSaleFromConversation(c,status,{silent=false}={}){
    if(!c) return {error:{message:'No se encontró la conversación de venta'}};
    const timestamp=now();
    const payload={
      estado:status,
      estado_publicacion:status,
      comprador_final_id:c.comprador_id,
      comprador_final_email:c.comprador_email,
      conversacion_venta_id:c.id,
      venta_conversacion_id:c.id,
      fecha_venta:timestamp,
      destacado:false,destacada:false,destacado_hasta:null,destacada_hasta:null,tipo_destacado:null,destacado_tipo:null,regla_destacado:null,updated_at:timestamp
    };
    const r=await updatePostFlex(c.publicacion_id,payload);
    if(r.error) return r;
    applyLocalStatus(c.publicacion_id,status);
    const updatedPost=Object.assign({},conversationPost(c)||{},r.data||payload,{id:c.publicacion_id});
    state.conversationPosts=state.conversationPosts||{}; state.conversationPosts[String(c.publicacion_id)]=updatedPost;
    const all=await conversationsForMyPost(c.publicacion_id);
    for(const x of all){
      try{
        const chosen=String(x.id)===String(c.id);
        await updateConversationFlex(x.id,{estado:chosen?'venta_concretada':'cerrada',estado_conversacion:chosen?'venta_concretada':'cerrada',ultimo_mensaje:timestamp,fecha_cierre:timestamp,motivo_cierre:status,comprador_final_id:chosen?c.comprador_id:null,updated_at:timestamp});
        const msg=chosen?`[SISTEMA] Esta publicación fue marcada como ${status==='vendido'?'VENDIDA':'INTERCAMBIADA'} para esta conversación. Ya puedes calificar al vendedor.`:closeMessageForStatus(status);
        await insertFlex('mercado_mensajes',{conversacion_id:x.id,remitente_id:isUuid(x.vendedor_id)?x.vendedor_id:(await resolveCurrentUserUuid()),mensaje:msg,leido:false,created_at:timestamp,fecha:timestamp,estado:'sistema'});
      }catch(e){console.warn('[VENTA] cerrar conversación',e);}
    }
    if(!silent) toast(status==='vendido'?'Venta asociada al comprador.':'Intercambio asociado al comprador.');
    await loadPosts(); await loadMinePosts(); await loadConversations();
    return {data:r.data||updatedPost};
  }
  async function closePostFromConversation(conversationId,status){
    if(!requireSession()) return;
    const me=await resolveCurrentUserUuid();
    let c=(state.conversations||[]).find(x=>String(x.id)===String(conversationId));
    if(!c){
      const rr=await refreshConversationAndPost(conversationId);
      c=rr.conversation;
    }
    if(!c){toast('No se encontró la conversación.');return;}
    if(String(c.vendedor_id)!==String(me)){toast('Solo el vendedor puede cerrar o marcar la publicación.');return;}
    const label=status==='vendido'?'vendida':(status==='intercambiado'?'intercambiada':'cerrada');
    const actionLabel=status==='cerrado'?'cerrar la venta':`marcar como ${label}`;
    const extra=isSaleStatus(status)?'<ul class="confirmBullets"><li>Cierra el aviso y bloquea nuevas consultas.</li><li>Asocia esta conversación al comprador final.</li><li>Solo este comprador podrá calificar al vendedor.</li></ul>':'';
    const ok=await marketConfirm({title:status==='intercambiado'?'Confirmar intercambio':'Confirmar venta',body:`<p>Vas a <b>${esc(actionLabel)}</b> esta publicación.</p>${extra}<p>El historial quedará visible para ambas partes.</p>`,ok:status==='intercambiado'?'Confirmar intercambio':'Confirmar venta',cancel:'Cancelar',danger:status==='cerrado'});
    if(!ok) return;
    if(isSaleStatus(status)){
      const r=await markSaleFromConversation(c,status);
      if(r.error){toast('No se pudo actualizar la publicación: '+(r.error.message||JSON.stringify(r.error)));return;}
      await openConversation(conversationId);
      renderProducts(); renderMine(status==='vendido'?'vendidos':'intercambiados');
      return;
    }
    const payload={estado:status,estado_publicacion:status,destacado:false,destacada:false,destacado_hasta:null,destacada_hasta:null,tipo_destacado:null,destacado_tipo:null,regla_destacado:null,updated_at:now()};
    const r=await updatePostFlex(c.publicacion_id,payload);
    if(r.error){toast('No se pudo actualizar la publicación: '+r.error.message);return;}
    applyLocalStatus(c.publicacion_id,status);
    if(r.data) state.conversationPosts[String(c.publicacion_id)]=r.data;
    await closeConversationsForPost(c.publicacion_id,status);
    toast('Publicación marcada como '+label+'. Chat cerrado.');
    await loadPosts(); await loadMinePosts(); await loadConversations();
    await openConversation(conversationId);
    renderProducts(); renderMine();
  }
  async function updateStatus(id,status){
    if(!id) return;
    const label=status==="vendido"?"vendido":(status==="intercambiado"?"intercambiado":"activo");
    if((status==="vendido"||status==="intercambiado")){
      const convs=await conversationsForMyPost(id);
      if(convs.length){
        const chosen=await saleSelectionModal(id,status,convs);
        if(!chosen) return;
        if(!chosen.withoutBuyer){
          const rr=await markSaleFromConversation(chosen,status);
          if(rr.error){toast('No se pudo guardar la venta: '+(rr.error.message||JSON.stringify(rr.error)));return;}
          renderProducts(); renderMine(status==="vendido"?"vendidos":"intercambiados"); renderCreditVisibilityGuard();
          return;
        }
      }else if(!confirm(`No hay conversaciones para asociar comprador. ¿Marcar igual como ${label} sin habilitar calificación?`)){
        return;
      }
    }
    applyLocalStatus(id,status);
    renderProducts();
    renderMine(status==="vendido"?"vendidos":(status==="intercambiado"?"intercambiados":"activos"));
    renderCreditVisibilityGuard();

    const closeBoost = (status==="vendido"||status==="intercambiado"||status==="eliminado");
    const reopened = (status==="disponible"||status==="activo");
    const statusPayload = closeBoost
      ? {estado:status,estado_publicacion:(status==='eliminado'?'cerrado':status),destacado:false,destacada:false,destacado_hasta:null,destacada_hasta:null,tipo_destacado:null,destacado_tipo:null,regla_destacado:null,updated_at:now()}
      : (reopened
          ? {estado:'activo',estado_publicacion:'disponible',activo:true,updated_at:now()}
          : {estado:status,estado_publicacion:status,updated_at:now()});
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
    if(closeBoost) await closeConversationsForPost(id,status);
    else if(reopened) await reopenConversationsForPost(id);
    await loadPosts();
    await loadMinePosts();
    const nextTab=status==="vendido"?"vendidos":(status==="intercambiado"?"intercambiados":"activos");
    toast(status==="vendido"?"Aviso movido a Vendidos":(status==="intercambiado"?"Aviso movido a Intercambiados":"Aviso reactivado"));
    renderProducts(); renderMine(nextTab); renderCreditVisibilityGuard();
  }
  async function removePost(id){
    if(!confirm("¿Eliminar esta publicación? Esta acción la ocultará del Mercado Escolar y cerrará sus conversaciones.")) return;
    applyLocalStatus(id,"eliminado");
    renderProducts(); renderMine("activos");
    let r=await state.sb.from("mercado_publicaciones")
      .update({estado:"eliminado",estado_publicacion:"cerrado",activo:false,updated_at:now()})
      .eq("id",id)
      .select("*")
      .maybeSingle();
    if(r.error){
      // Compatibilidad si la constraint antigua no acepta estado_publicacion='eliminado'
      r=await state.sb.from("mercado_publicaciones")
        .update({estado:"eliminado",activo:false,updated_at:now()})
        .eq("id",id)
        .select("*")
        .maybeSingle();
    }
    if(r.error){
      toast("No se pudo eliminar: "+r.error.message);
      await loadPosts(); await loadMinePosts(); renderProducts(); renderMine("activos");
      return;
    }
    await closeConversationsForPost(id,"eliminado");
    await loadPosts(); await loadMinePosts(); await loadConversations();
    renderProducts(); renderMine("activos"); renderConversations(); renderCreditVisibilityGuard();
    toast("Publicación eliminada");
  }
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
      const mf=e.target.closest("[data-mine-filter]"); if(mf){e.preventDefault();refreshMineView(mf.dataset.mineFilter);return;}
      const boost=e.target.closest("[data-boost-rule]"); if(boost){e.preventDefault();boostPost(boost.dataset.boostRule,boost.dataset.cost||"1");return;}
      const help=e.target.closest("[data-credit-help]"); if(help){e.preventDefault();creditHelp();return;}
      const openConv=e.target.closest("[data-open-conversation]"); if(openConv){e.preventDefault();openConversation(openConv.dataset.openConversation);return;}
      const sendReply=e.target.closest("[data-send-conversation-reply]"); if(sendReply){e.preventDefault();sendConversationReply(sendReply.dataset.sendConversationReply);return;}
      const closeThread=e.target.closest("[data-close-chat-thread]"); if(closeThread){e.preventDefault();document.getElementById('modal').innerHTML='';return;}
      const closeFromChat=e.target.closest("[data-close-post-from-chat]"); if(closeFromChat){e.preventDefault();closePostFromConversation(closeFromChat.dataset.conversationId,closeFromChat.dataset.closePostFromChat);return;}
      const rate=e.target.closest("[data-rate-conversation]"); if(rate){e.preventDefault();openRatingModal(rate.dataset.rateConversation);return;}
      const submitRatingBtn=e.target.closest("[data-submit-rating]"); if(submitRatingBtn){e.preventDefault();submitRating(submitRatingBtn.dataset.submitRating);return;}
      const sendChat=e.target.closest("[data-send-internal-chat]"); if(sendChat){e.preventDefault();sendInternalChat(sendChat.dataset.sendInternalChat);return;}
      const sendWa=e.target.closest("[data-contact-whatsapp]"); if(sendWa){e.preventDefault();contactWhatsapp(sendWa.dataset.contactWhatsapp);return;}
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
    $("#btnConversations")?.addEventListener("click",async()=>{showView('conversaciones'); await loadConversations();});
    $("#btnMarketAlerts")?.addEventListener("click",()=>toast('Notificaciones de Mercado Escolar próximamente.'));
    $("#btnMarketMenu")?.addEventListener("click",()=>{document.getElementById('modal').innerHTML=`<div class="v19ConfirmOverlay"><section class="v19Confirm marketMenuSheet"><h2>Menú Mercado</h2><div class="mineOptionList"><button type="button" data-open-rules>📖 Reglas Mercado Escolar</button><button type="button" data-view="creditos" onclick="document.getElementById('modal').innerHTML=''">💎 Créditos</button><button type="button" data-view="reputacion" onclick="document.getElementById('modal').innerHTML=''">⭐ Mi perfil de vendedor</button><button type="button" onclick="alert('Ayuda Mercado Escolar disponible próximamente')">❓ Ayuda</button></div><div class="v19ConfirmActions"><button class="ghost" onclick="document.getElementById('modal').innerHTML=''">Cerrar</button></div></section></div>`;});
    document.addEventListener('click',ev=>{ if(ev.target.closest('[data-open-rules]')){ev.preventDefault(); rules();} });
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
    $$(".filters button").forEach(btn=>btn.addEventListener("click",()=>applyExploreFilter(btn.dataset.scope)));
    renderPreview([]);
  }

  document.addEventListener("DOMContentLoaded",init);
  window.CursappMarket={reload:reloadAll,showView,getState:()=>state,activeMinePosts,renderCreditVisibilityGuard,openBoostModal,sendInternalChat,contactModal,loadConversations,openConversation,sendConversationReply,closePostFromConversation,openExistingConversationForPost};
})();
