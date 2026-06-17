
(function(){
  const SESSION_KEY = "cursapp_session_v1";
  const ADMIN_LOGS = "cursapp_admin_logs_v1";
  const ADMIN_TICKETS = "cursapp_admin_tickets_v1";

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const app = $("#adminApp");
  const modal = $("#adminModal");

  function esc(s){
    return String(s ?? "").replace(/[&<>'"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  }
  function load(k, def){
    try{ const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); }catch(e){ return def; }
  }
  function save(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
  function clp(v){ return "$" + Number(v||0).toLocaleString("es-CL"); }
  function now(){ return new Date().toISOString(); }
  function fmtDate(x){
    try{ return new Date(x).toLocaleString("es-CL", {dateStyle:"short", timeStyle:"short"}); }catch(e){ return x || "—"; }
  }

  function requireAdmin(){
    const s = load(SESSION_KEY, null);
    if(!s || s.role !== "admin" || !s.isAdmin){
      location.href = "/index.html";
      return false;
    }
    return true;
  }

  function allKeys(){
    const keys = [];
    for(let i=0;i<localStorage.length;i++) keys.push(localStorage.key(i));
    return keys;
  }
  function readMany(match){
    return allKeys().filter(match).flatMap(k=>{
      const v = load(k, []);
      return Array.isArray(v) ? v.map(x=>Object.assign({__key:k}, x)) : [];
    });
  }

  // ============================================================
  // Admin Fase 1D.2 · Fuente oficial Supabase
  // El Admin deja de usar localStorage para datos de negocio.
  // localStorage queda solo para sesión admin, logs/tickets internos.
  // ============================================================
  const SB_URL = "https://ngxistgymgdkoaiulfbq.supabase.co";
  const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5neGlzdGd5bWdka29haXVsZmJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2OTg1NDQsImV4cCI6MjA5NjI3NDU0NH0.1r-aLijYEWvUifKcLjlClnA8-oYw11lgThY0swg_xbg";

  const ADMIN_DB = {
    ready:false,
    loading:false,
    error:null,
    colegios:[], cursos:[], usuarios:[], miembros:[], campanas:[], pagos:[],
    avisos:[], gastos:[], rendiciones:[], informes:[],
    mercado_categorias:[], mercado_publicaciones:[], mercado_contactos:[], mercado_reportes:[], mercado_imagenes:[], mercado_favoritos:[]
  };

  async function sbGet(path){
    const res = await fetch(SB_URL + "/rest/v1/" + path, {
      headers:{
        "apikey": SB_KEY,
        "Authorization": "Bearer " + SB_KEY,
        "Content-Type":"application/json"
      }
    });
    const text = await res.text();
    let data = null;
    try{ data = text ? JSON.parse(text) : []; }catch(e){ data = text; }
    if(!res.ok){
      const msg = (data && (data.message || data.error || data.hint)) || text || ("HTTP " + res.status);
      throw new Error(msg);
    }
    return Array.isArray(data) ? data : [];
  }

  async function loadSupabaseAdminData(){
    if(ADMIN_DB.loading) return;
    ADMIN_DB.loading = true;
    ADMIN_DB.error = null;
    try{
      // Consultas sin relaciones embebidas para evitar errores PostgREST por alias duplicados
      // como "miembros_curso_cursos_1 specified more than once".
      // Luego relacionamos los datos en memoria.
      const [
        colegiosRaw, cursosRaw, usuariosRaw, miembrosRaw, campanasRaw, pagosRaw,
        avisosRaw, gastosRaw, rendicionesRaw, informesRaw,
        mercadoCategoriasRaw, mercadoPublicacionesRaw, mercadoContactosRaw, mercadoReportesRaw, mercadoImagenesRaw, mercadoFavoritosRaw
      ] = await Promise.all([
        sbGet("colegios?select=*&order=created_at.desc"),
        sbGet("cursos?select=*&order=created_at.desc"),
        sbGet("usuarios?select=*&order=created_at.desc"),
        sbGet("miembros_curso?select=*&order=created_at.desc"),
        sbGet("campanas?select=*&order=created_at.desc"),
        sbGet("pagos?select=*&order=created_at.desc"),
        sbGet("avisos?select=*&order=created_at.desc"),
        sbGet("gastos?select=*&order=created_at.desc"),
        sbGet("rendiciones?select=*&order=created_at.desc"),
        sbGet("informes?select=*&order=created_at.desc"),
        sbGet("mercado_categorias?select=*&order=nombre.asc"),
        sbGet("mercado_publicaciones?select=*&order=created_at.desc"),
        sbGet("mercado_contactos?select=*&order=created_at.desc"),
        sbGet("mercado_reportes?select=*&order=created_at.desc"),
        sbGet("mercado_imagenes?select=*&order=created_at.desc"),
        sbGet("mercado_favoritos?select=*&order=created_at.desc")
      ]);

      const byId = (rows)=>{
        const m = new Map();
        (rows || []).forEach(r=>{ if(r && r.id) m.set(String(r.id), r); });
        return m;
      };

      const colegiosById = byId(colegiosRaw);
      const usuariosById = byId(usuariosRaw);

      const cursos = (cursosRaw || []).map(c=>Object.assign({}, c, {
        colegios: colegiosById.get(String(c.colegio_id || "")) || null
      }));
      const cursosById = byId(cursos);

      const miembros = (miembrosRaw || []).map(m=>Object.assign({}, m, {
        usuarios: usuariosById.get(String(m.usuario_id || "")) || null,
        cursos: cursosById.get(String(m.curso_id || "")) || null
      }));
      const miembrosById = byId(miembros);

      const campanas = (campanasRaw || []).map(c=>Object.assign({}, c, {
        cursos: cursosById.get(String(c.curso_id || "")) || null
      }));
      const campanasById = byId(campanas);

      const pagos = (pagosRaw || []).map(p=>Object.assign({}, p, {
        campanas: campanasById.get(String(p.campana_id || "")) || null,
        cursos: cursosById.get(String(p.curso_id || "")) || null,
        miembros_curso: miembrosById.get(String(p.miembro_id || "")) || null
      }));

      const avisos = (avisosRaw || []).map(a=>Object.assign({}, a, {
        cursos: cursosById.get(String(a.curso_id || "")) || null
      }));

      const gastos = (gastosRaw || []).map(g=>Object.assign({}, g, {
        cursos: cursosById.get(String(g.curso_id || "")) || null,
        campanas: campanasById.get(String(g.campana_id || "")) || null
      }));

      const rendiciones = (rendicionesRaw || []).map(r=>Object.assign({}, r, {
        cursos: cursosById.get(String(r.curso_id || "")) || null,
        campanas: campanasById.get(String(r.campana_id || "")) || null
      }));

      const informes = (informesRaw || []).map(r=>Object.assign({}, r, {
        cursos: cursosById.get(String(r.curso_id || "")) || null
      }));

      const mercadoCategoriasById = byId(mercadoCategoriasRaw);
      const mercadoPublicacionesById = byId(mercadoPublicacionesRaw);
      const mercadoPublicaciones = (mercadoPublicacionesRaw || []).map(p=>Object.assign({}, p, {
        categorias: mercadoCategoriasById.get(String(p.categoria_id || "")) || null,
        cursos: cursosById.get(String(p.curso_id || "")) || null,
        vendedor: usuariosById.get(String(p.vendedor_id || "")) || null
      }));
      const mercadoContactos = (mercadoContactosRaw || []).map(c=>Object.assign({}, c, {
        publicaciones: mercadoPublicacionesById.get(String(c.publicacion_id || "")) || null,
        interesado: usuariosById.get(String(c.interesado_id || "")) || null
      }));
      const mercadoReportes = (mercadoReportesRaw || []).map(r=>Object.assign({}, r, {
        publicaciones: mercadoPublicacionesById.get(String(r.publicacion_id || "")) || null,
        usuario: usuariosById.get(String(r.usuario_id || "")) || null
      }));
      const mercadoImagenes = (mercadoImagenesRaw || []).map(i=>Object.assign({}, i, {
        publicaciones: mercadoPublicacionesById.get(String(i.publicacion_id || "")) || null
      }));
      const mercadoFavoritos = (mercadoFavoritosRaw || []).map(f=>Object.assign({}, f, {
        publicaciones: mercadoPublicacionesById.get(String(f.publicacion_id || "")) || null
      }));

      ADMIN_DB.colegios = colegiosRaw;
      ADMIN_DB.cursos = cursos;
      ADMIN_DB.usuarios = usuariosRaw;
      ADMIN_DB.miembros = miembros;
      ADMIN_DB.campanas = campanas;
      ADMIN_DB.pagos = pagos;
      ADMIN_DB.avisos = avisos;
      ADMIN_DB.gastos = gastos;
      ADMIN_DB.rendiciones = rendiciones;
      ADMIN_DB.informes = informes;
      ADMIN_DB.mercado_categorias = mercadoCategoriasRaw || [];
      ADMIN_DB.mercado_publicaciones = mercadoPublicaciones;
      ADMIN_DB.mercado_contactos = mercadoContactos;
      ADMIN_DB.mercado_reportes = mercadoReportes;
      ADMIN_DB.mercado_imagenes = mercadoImagenes;
      ADMIN_DB.mercado_favoritos = mercadoFavoritos;
      ADMIN_DB.ready = true;
      try{ localStorage.setItem("cursapp_admin_supabase_status_v1", JSON.stringify({
        status:"ok", at:now(),
        cursos:cursos.length, usuarios:usuarios.length, miembros:miembros.length, campanas:campanas.length, pagos:pagos.length,
        avisos:avisos.length, gastos:gastos.length, rendiciones:rendiciones.length, informes:informes.length,
        mercado_publicaciones:mercadoPublicaciones.length, mercado_contactos:mercadoContactos.length, mercado_reportes:mercadoReportes.length, mercado_favoritos:mercadoFavoritos.length
      })); }catch(e){}
    }catch(e){
      ADMIN_DB.error = e && e.message ? e.message : String(e);
      ADMIN_DB.ready = false;
      try{ localStorage.setItem("cursapp_admin_supabase_status_v1", JSON.stringify({status:"error", at:now(), message:ADMIN_DB.error})); }catch(_e){}
    }finally{
      ADMIN_DB.loading = false;
    }
  }

  function courseObjectFromCurso(curso){
    curso = curso || {};
    const col = curso.colegios || {};
    return {
      courseKey: curso.course_key || curso.id || "",
      id: curso.id || "",
      schoolName: col.nombre || curso.nombre || "Colegio",
      regionName: col.region || "Sin región",
      comunaName: col.comuna || "",
      level: curso.nivel || "",
      letter: curso.letra || "",
      year: curso.anio || "",
      jornada: curso.jornada || ""
    };
  }

  function payments(){
    return (ADMIN_DB.pagos || []).map(p=>{
      const m = p.miembros_curso || {};
      const u = m.usuarios || {};
      const camp = p.campanas || {};
      const curso = p.cursos || camp.cursos || {};
      return Object.assign({}, p, {
        id: p.id,
        amount: Number(p.monto || 0),
        monto: Number(p.monto || 0),
        amountPaid: Number(p.monto_pagado || 0),
        status: normalizePaymentStatusAdmin(p.estado),
        method: p.metodo_pago || "",
        paidAt: p.paid_at || p.fecha_pago || "",
        createdAt: p.created_at || "",
        concept: camp.titulo || "Pago",
        title: camp.titulo || "Pago",
        alumno: m.nombre_alumno || "",
        alumnoId: m.id || "",
        apoderadoEmail: m.email || u.email || "",
        fromTaskId: p.campana_id || camp.id || "",
        campaign_id: p.campana_id || camp.id || "",
        courseKey: curso.course_key || curso.id || p.curso_id || "",
        __course: courseObjectFromCurso(curso)
      });
    });
  }

  function tasks(){
    return (ADMIN_DB.campanas || []).map(t=>{
      const curso = t.cursos || {};
      return Object.assign({}, t, {
        id: t.id,
        title: t.titulo || "Campaña",
        name: t.titulo || "Campaña",
        amount: Number(t.monto || 0),
        monto: Number(t.monto || 0),
        type: t.tipo || "single",
        months: Number(t.meses || 1),
        startDate: t.fecha_inicio || "",
        dueDate: t.fecha_vencimiento || "",
        createdAt: t.created_at || "",
        status: t.estado || "activa",
        closed: String(t.estado || "").toLowerCase()==="cerrada",
        mandatoryParticipation: t.obligatoria !== false,
        courseKey: curso.course_key || curso.id || t.curso_id || "",
        __course: courseObjectFromCurso(curso)
      });
    });
  }

  function expenses(){
    return (ADMIN_DB.gastos || []).map(g=>Object.assign({}, g, {
      id:g.id,
      title:g.titulo || g.concepto || "Gasto",
      amount:Number(g.monto || 0),
      createdAt:g.created_at || g.fecha_gasto || g.fecha || "",
      courseKey:g.cursos?.course_key || g.curso_id || "",
      __course: courseObjectFromCurso(g.cursos || {})
    }));
  }
  function reports(){
    return (ADMIN_DB.informes || []).map(r=>Object.assign({}, r, {
      id:r.id,
      title:r.titulo || r.tipo || "Informe",
      status:r.publicado ? "publicado" : "borrador",
      createdAt:r.created_at || "",
      publishedAt:r.publicado_at || "",
      courseKey:r.cursos?.course_key || r.curso_id || "",
      __course: courseObjectFromCurso(r.cursos || {})
    }));
  }
  function renditions(){
    return (ADMIN_DB.rendiciones || []).map(r=>Object.assign({}, r, {
      id:r.id,
      amount:Number(r.total_gastado || r.monto || 0),
      saldo:Number(r.saldo || 0),
      createdAt:r.created_at || "",
      courseKey:r.cursos?.course_key || r.curso_id || "",
      __course: courseObjectFromCurso(r.cursos || {})
    }));
  }
  function notices(){ return ADMIN_DB.avisos || []; }
  function marketPublications(){ return ADMIN_DB.mercado_publicaciones || []; }
  function marketContacts(){ return ADMIN_DB.mercado_contactos || []; }
  function marketReports(){ return ADMIN_DB.mercado_reportes || []; }
  function marketFavorites(){ return ADMIN_DB.mercado_favoritos || []; }
  function receipts(){ return []; }

  function profiles(){
    return (ADMIN_DB.miembros || []).map(m=>{
      const u = m.usuarios || {};
      const curso = m.cursos || {};
      const c = courseObjectFromCurso(curso);
      const role = String(m.rol || "usuario").toLowerCase();
      return {
        profileId: m.id,
        userId: u.id || m.usuario_id || m.email || "",
        role,
        status: m.estado || "activo",
        courseKey: c.courseKey,
        course: c,
        apoderado: role === "apoderado" ? { name:m.nombre_apoderado || u.nombre || m.email || "", alumno:m.nombre_alumno || "", email:m.email || u.email || "" } : null,
        directiva: role !== "apoderado" ? { name:m.nombre_apoderado || u.nombre || m.email || "" } : null
      };
    });
  }

  function users(){
    return (ADMIN_DB.usuarios || []).map(u=>({ userId:u.id, id:u.id, email:u.email, name:u.nombre || u.email || "", telefono:u.telefono || "", createdAt:u.created_at || "" }));
  }

  function enrollments(){ return profiles(); }

  function courseKeyOf(x){
    return String(x.courseKey || x.__key || "global")
      .replace(/^cursapp_/, "")
      .replace(/_(payments|tasks|expenses|monthly_reports|receipts)_v1$/,"");
  }

  function profileCourse(p){
    return p.course || {};
  }

  function courseLabelFromProfile(p){
    const c = profileCourse(p);
    return [c.schoolName || c.colegio || "Colegio", `${c.level||""}${c.letter||""} ${c.year||""}`.trim(), c.jornada || ""].filter(Boolean).join(" · ");
  }

  function courseFromPayment(p){
    if(p && p.__course) return p.__course;
    const ck = courseKeyOf(p);
    const ps = profiles();
    const byKey = ps.find(x=>String(x.courseKey||"")===String(ck));
    return byKey ? byKey.course : { courseKey: ck, schoolName: ck, regionName:"Sin región", comunaName:"" };
  }

  function getRegionName(x){
    const c = x.course || x;
    return c.regionName || c.region || c.regionNombre || c.regionId || "Sin región";
  }
  function getSchoolName(x){
    const c = x.course || x;
    return c.schoolName || c.colegio || c.school || c.schoolId || "Sin colegio";
  }
  function getCourseName(x){
    const c = x.course || x;
    const label = `${c.level||""}${c.letter||""} ${c.year||""}`.trim();
    return label || c.courseName || c.curso || c.courseKey || "Sin curso";
  }
  function getJornada(x){
    const c = x.course || x;
    return c.jornada || "";
  }


  function getPotentialTesoreros(){
    const out = [];
    const add = (x, source)=>{
      if(!x) return;
      const blob = JSON.stringify(x).toLowerCase();
      if(!blob.includes("tesorero")) return;
      out.push({source, raw:x});
    };

    profiles().forEach(p=>{
      if(String(p.role||"").toLowerCase()==="tesorero") add(p, "profile");
    });

    users().forEach(u=>{
      if(String(u.role||u.currentRole||"").toLowerCase()==="tesorero" || (Array.isArray(u.roles) && u.roles.map(String).map(x=>x.toLowerCase()).includes("tesorero"))) add(u, "user");
    });

    allKeys().forEach(k=>{
      const lk = String(k).toLowerCase();
      if(!lk.includes("tesorero") && !lk.includes("directiva")) return;
      const v = load(k, null);
      if(v) add({key:k, value:v}, "storage");
    });

    return out;
  }

  function inferCourseKeyFromAny(raw){
    if(!raw) return "";
    if(raw.courseKey) return String(raw.courseKey);
    if(raw.course?.courseKey) return String(raw.course.courseKey);
    if(raw.value?.courseKey) return String(raw.value.courseKey);
    if(raw.value?.course?.courseKey) return String(raw.value.course.courseKey);
    const txt = JSON.stringify(raw);
    const m = txt.match(/cursapp_[A-Za-z0-9_\\-|]+_(?:payments|tasks|expenses|monthly_reports|receipts)_v1/);
    if(m) return m[0].replace(/^cursapp_/,"").replace(/_(payments|tasks|expenses|monthly_reports|receipts)_v1$/,"");
    const ck = txt.match(/"courseKey"\\s*:\\s*"([^"]+)"/);
    return ck ? ck[1] : "";
  }

  function getAllCourses(){
    const map = new Map();

    (ADMIN_DB.cursos || []).forEach(curso=>{
      const c = courseObjectFromCurso(curso);
      map.set(c.courseKey, {
        courseKey: c.courseKey,
        id: c.id,
        region: c.regionName || "Sin región",
        comuna: c.comunaName || "",
        school: c.schoolName || "Sin colegio",
        course: `${c.level||""}${c.letter||""} ${c.year||""}`.trim() || curso.nombre || "Sin curso",
        jornada: c.jornada || "",
        label: [c.schoolName, `${c.level||""}${c.letter||""} ${c.year||""}`.trim(), c.jornada].filter(Boolean).join(" · "),
        miembros: 0,
        presidentes: 0,
        tesoreros: 0,
        apoderados: 0
      });
    });

    (ADMIN_DB.miembros || []).forEach(m=>{
      const c = courseObjectFromCurso(m.cursos || {});
      const key = c.courseKey || m.curso_id || "";
      if(!key) return;
      if(!map.has(key)){
        map.set(key, {courseKey:key, id:m.curso_id, region:c.regionName||"Sin región", comuna:c.comunaName||"", school:c.schoolName||"Sin colegio", course:`${c.level||""}${c.letter||""} ${c.year||""}`.trim()||"Sin curso", jornada:c.jornada||"", label:[c.schoolName, `${c.level||""}${c.letter||""} ${c.year||""}`.trim(), c.jornada].filter(Boolean).join(" · "), miembros:0, presidentes:0, tesoreros:0, apoderados:0});
      }
      const row = map.get(key);
      row.miembros++;
      const role = String(m.rol || "").toLowerCase();
      if(role === "presidente") row.presidentes++;
      if(role === "tesorero") row.tesoreros++;
      if(role === "apoderado") row.apoderados++;
    });

    return Array.from(map.values()).sort((a,b)=>String(a.school).localeCompare(String(b.school),"es") || String(a.course).localeCompare(String(b.course),"es"));
  }


  function directivaRoleEntries(){
    const d = load("cursapp_directiva_apoderado_by_role_v1", null);
    if(!d) return [];
    const out = [];
    const stack = [{node:d, path:[]}];
    while(stack.length){
      const cur = stack.pop();
      const node = cur.node;
      const path = cur.path || [];
      if(!node || typeof node !== "object") continue;

      if(Array.isArray(node)){
        node.forEach((v,i)=>stack.push({node:v,path:path.concat(String(i))}));
        continue;
      }

      const pathStr = path.join(".").toLowerCase();
      const role = String(node.role || node.directivaRole || (pathStr.includes("tesorero") ? "tesorero" : pathStr.includes("presidente") ? "presidente" : "")).toLowerCase();
      const email = String(node.email || node.userId || node.userEmail || "").toLowerCase();
      const ck = String(node.courseKey || node.course || node.ck || path.find(x=>String(x).includes("|")) || "");
      if(role && (email || ck || node.name)){
        out.push({role,email,courseKey:ck,name:node.name || node.fullName || "", raw:node});
      }

      Object.keys(node).forEach(k=>stack.push({node:node[k], path:path.concat(k)}));
    }
    return out;
  }

  function priorityClass(p){
    const v = String(p||"").toLowerCase();
    if(v === "critica" || v === "crítica") return "red";
    if(v === "alta") return "orange";
    if(v === "media") return "purple";
    return "gray";
  }

  function slaState(t){
    if(t.status === "resuelto") return {label:"Cumplido", cls:"green"};
    if(!t.slaDueAt) return {label:"Sin SLA", cls:"gray"};
    const ms = new Date(t.slaDueAt).getTime() - Date.now();
    if(ms < 0) return {label:"SLA vencido", cls:"red"};
    const h = Math.ceil(ms/3600000);
    if(h <= 2) return {label:`SLA ${h}h`, cls:"orange"};
    return {label:`SLA ${h}h`, cls:"green"};
  }

  function categoryText(t){
    return t.categoryLabel || ({
      acceso_login:"Acceso / login",
      pago_transaccion:"Pago o transacción",
      menu_visual:"Problema visual / menú",
      campanas:"Campañas / cobros",
      rendiciones:"Rendiciones / boletas",
      informes:"Informes",
      datos:"Corrección de datos",
      otro:"Otro"
    })[t.category] || t.category || "Sin categoría";
  }


  function cleanupDummyTickets(){
    const list = load(ADMIN_TICKETS, []);
    const cleaned = list.filter(t=>{
      const id = String(t.id || "");
      const looksSeed = /^TK-348[567]$/.test(id) && !t.source && !t.messages;
      return !looksSeed;
    });
    if(cleaned.length !== list.length) save(ADMIN_TICKETS, cleaned);
  }

  function seedAdminData(){
    // Cursapp v11-clean: sin métricas, logs, tickets ni campañas demo.
    cleanupDummyTickets();
    if(!Array.isArray(load(ADMIN_LOGS, []))) save(ADMIN_LOGS, []);
    if(!Array.isArray(load(ADMIN_TICKETS, []))) save(ADMIN_TICKETS, []);
  }

  function log(type, action, target, extra={}){
    const logs = load(ADMIN_LOGS, []);
    logs.unshift(Object.assign({at:now(), user:"admin@cursapp.cl", type, action, target, ip:"local"}, extra));
    save(ADMIN_LOGS, logs.slice(0,500));
  }

  function normalizePaymentStatusAdmin(v){
    const s = String(v || "pending").toLowerCase().trim();
    if(s === "paid" || s === "pagado" || s === "conciliado") return "paid";
    if(["failed","rejected","rechazado","fallido","error"].includes(s)) return "failed";
    if(["opted_out","no_participa","no participa","excluido","excluida"].includes(s)) return "opted_out";
    return "pending";
  }

  function paymentMethod(p){
    const raw = String([p.method,p.metodo_pago,p.modalidad,p.channel,p.provider,p.gateway,p.ref,p.note,p.statusDetail,p.type].filter(Boolean).join(" ")).toLowerCase();
    if(/transbank|webpay|tbk|card|tarjeta|pasarela/.test(raw)) return "Transbank";
    if(/transfer|transferencia/.test(raw)) return "Transferencia";
    if(/efectivo|cash/.test(raw)) return "Efectivo";
    if(/manual|concili/.test(raw)) return "Conciliación";
    if(String(p.status||"").toLowerCase()==="paid" && !raw) return "Transbank";
    return "No informado";
  }

  function paymentStatus(p){
    return normalizePaymentStatusAdmin(p.status || p.estado || "pending");
  }

  function paymentStats(){
    const pays = payments();
    const successful = pays.filter(p=>paymentStatus(p)==="paid");
    const failed = pays.filter(p=>paymentStatus(p)==="failed");
    const pending = pays.filter(p=>paymentStatus(p)==="pending");
    const opted = pays.filter(p=>paymentStatus(p)==="opted_out");

    const methods = {};
    successful.forEach(p=>{
      const m = paymentMethod(p);
      methods[m] = methods[m] || {count:0, amount:0};
      methods[m].count++;
      methods[m].amount += Number(p.amount||p.monto||0);
    });

    const totalPaid = successful.reduce((a,b)=>a+Number(b.amount||b.monto||0),0);
    return {pays, successful, failed, pending, opted, methods, totalPaid};
  }

  function stats(){
    const ps = profiles();
    const us = users();
    const ens = enrollments();
    const pays = payments();
    const exps = expenses();
    const reps = reports();
    const rends = renditions();
    const avis = notices();
    const market = marketPublications();
    const mcontacts = marketContacts();
    const mreports = marketReports();
    const mfavorites = marketFavorites();
    const ts = tasks();
    const courses = getAllCourses();

    const schools = new Set(courses.map(c=>c.school).filter(Boolean));
    const regions = groupCount(courses, c=>c.region || "Sin región");

    const alumnos = new Set([
      ...ps.map(p=>p.apoderado?.alumnoId || p.apoderado?.alumno).filter(Boolean),
      ...pays.map(p=>p.alumno || p.alumnoId).filter(Boolean),
      ...ens.map(e=>e.alumno || e.alumnoId).filter(Boolean)
    ]);

    const pstats = paymentStats();

    return {ps,us,ens,pays,exps,reps,rends,avis,market,mcontacts,mreports,mfavorites,ts,courses,schools,regions,alumnos,...pstats};
  }

  function groupCount(list, fn){
    const m = {};
    list.forEach(x=>{
      const k = fn(x) || "Sin dato";
      m[k] = (m[k]||0)+1;
    });
    return m;
  }

  function groupCoursesBySchool(){
    const courses = getAllCourses();
    const m = {};
    courses.forEach(c=>{
      const k = c.school || "Sin colegio";
      if(!m[k]) m[k] = {school:k, region:c.region || "Sin región", cursos:0, miembros:0, rows:[]};
      m[k].cursos++;
      m[k].miembros += c.miembros || 0;
      m[k].rows.push(c);
    });
    return Object.values(m).sort((a,b)=>b.cursos-a.cursos || String(a.school).localeCompare(String(b.school)));
  }

  function setTitle(title, sub){
    $("#viewTitle").textContent = title;
    $("#viewSub").textContent = sub || "";
  }

  function kpi(icon,label,value,delta){
    return `<div class="kpi"><div class="kpiIcon">${icon}</div><label>${label}</label><strong>${value}</strong><small>${delta||"Actualizado ahora"}</small></div>`;
  }

  function renderDashboard(){
    setTitle("Hola, Admin 👋", "Panel global de operación Cursapp");
    const s = stats();
    const tickets = load(ADMIN_TICKETS, []);
    const logs = load(ADMIN_LOGS, []);
    const openTickets = tickets.filter(t=>t.status!=="resuelto").length;
    const transbank = s.methods["Transbank"] || s.methods["Transbank/demo"] || {count:0, amount:0};
    const conciliacion = (s.methods["Conciliación"] || {count:0, amount:0});
    const transferencia = (s.methods["Transferencia"] || {count:0, amount:0});
    const manualTotal = {count: conciliacion.count + transferencia.count, amount: conciliacion.amount + transferencia.amount};

    app.innerHTML = `
      <div class="kpis">
        ${kpi("🏫","Colegios registrados",s.schools.size,"Total actual")}
        ${kpi("🎓","Cursos activos",s.courses.length,"Cursos detectados")}
        ${kpi("👥","Apoderados / Alumnos",s.alumnos.size || s.ps.length,"Comunidad actual")}
        ${kpi("💳","Pagos del mes",clp(s.totalPaid),`${s.successful.length} exitosos`)}
        ${kpi("🤝","Conciliación / Manual",manualTotal.count,clp(manualTotal.amount))}
        ${kpi("🎫","Tickets abiertos",openTickets,`${tickets.length} tickets totales`)}
        ${kpi("📣","Avisos activos",s.avis.length,"Desde Supabase")}
        ${kpi("🛍️","Mercado escolar",s.market.filter(p=>p.activo!==false && p.estado!=="eliminado").length,`${s.mcontacts.length} contactos · ${s.mreports.length} reportes`)}
        ${kpi("📄","Informes publicados",s.reps.filter(r=>r.publicado || r.status==="publicado").length,`${s.rends.length} rendiciones`)}
      </div>

      <div class="gridMain adminGrid4">
        <section class="panel">
          <div class="panelHead"><h2>Cursos por región</h2><button onclick="Admin.go('colegios')">Detalle</button></div>
          <div class="list regionList">
            ${regionRows(s.regions)}
          </div>
        </section>

        <section class="panel">
          <div class="panelHead"><h2>Cursos por colegio</h2><button onclick="Admin.go('colegios')">Ver colegios</button></div>
          <div class="list">
            ${groupCoursesBySchool().slice(0,6).map(schoolRow).join("") || emptyRow("Sin colegios")}
          </div>
        </section>

        <section class="panel">
          <div class="panelHead"><h2>Tickets recientes</h2><button onclick="Admin.go('tickets')">Ver todos</button></div>
          <div class="list">
            ${tickets.slice(0,5).map(ticketRow).join("") || emptyRow("Sin tickets")}
          </div>
        </section>

        <section class="panel">
          <div class="panelHead"><h2>Pagos del mes</h2><button onclick="Admin.go('pagos')">Detalle</button></div>
          ${paymentDashboard(s)}
        </section>
      </div>

      <div class="tablesGrid">
        <section class="panel">
          <div class="panelHead"><h2>Últimos movimientos en la plataforma</h2><button onclick="Admin.go('logs')">Ver todos</button></div>
          ${logsTable(logs.slice(0,7))}
        </section>

        <section class="panel">
          <div class="panelHead"><h2>Acciones rápidas</h2></div>
          <div class="actionsGrid">
            <button class="quick" onclick="Admin.go('colegios')">🔍<strong>Buscar curso</strong><span>Por región, colegio o curso</span></button>
            <button class="quick" onclick="Admin.go('comunidad')">👤<strong>Buscar usuario</strong><span>Ver perfil completo</span></button>
            <button class="quick" onclick="Admin.go('tickets')">💬<strong>Resolver ticket</strong><span>Ir a soporte</span></button>
            <button class="quick" onclick="Admin.go('pagos')">💳<strong>Ver pagos</strong><span>Filtrar por colegio/curso</span></button>
            <button class="quick" onclick="Admin.go('logs')">📄<strong>Logs de actividad</strong><span>Ver registros</span></button>
            <button class="quick" onclick="Admin.go('auditoria')">🛡️<strong>Auditar cambios</strong><span>Ver bitácora</span></button>
            <button class="quick" onclick="Admin.go('avisos')">📣<strong>Avisos</strong><span>Comunicaciones Supabase</span></button>
            <button class="quick" onclick="Admin.go('finanzas')">📊<strong>Informes y rendiciones</strong><span>Gastos, informes y saldos</span></button>
            <button class="quick" onclick="Admin.go('mercado')">🛍️<strong>Mercado Escolar</strong><span>Publicaciones, contactos y reportes</span></button>
          </div>
        </section>
      </div>
    `;
  }

  function regionRows(regions){
    const rows = Object.entries(regions).sort((a,b)=>b[1]-a[1]);
    if(!rows.length) return emptyRow("Sin regiones detectadas");
    const max = Math.max(...rows.map(x=>x[1]),1);
    return rows.map(([name,count])=>`
      <div class="regionRow">
        <div>
          <b>${esc(name)}</b>
          <p>${count} curso${count===1?"":"s"} registrado${count===1?"":"s"}</p>
        </div>
        <div class="miniBar"><span style="width:${Math.max(8,Math.round(count/max*100))}%"></span></div>
      </div>
    `).join("");
  }

  function schoolRow(x){
    return `<div class="row"><div class="rowIcon">🏫</div><div><b>${esc(x.school)}</b><p>${esc(x.region)} · ${x.cursos} curso${x.cursos===1?"":"s"} · ${x.miembros} miembros</p></div><span class="badge purple">${x.cursos}</span></div>`;
  }

  function ticketRow(t){
    const cls = t.status==="resuelto" ? "green" : (t.status==="revision" ? "orange" : "red");
    return `<div class="row"><div class="rowIcon">🎫</div><div><b>${esc(t.school)}</b><p>${esc(t.subject)} · ${esc(t.id)}</p></div><span class="badge ${cls}">${esc(t.status)}</span></div>`;
  }

  function emptyRow(text){ return `<div class="row"><div class="rowIcon">—</div><div><b>${text}</b><p>No hay información para mostrar.</p></div></div>`; }

  function paymentDashboard(s){
    const total = Math.max(1, s.pays.length);
    const pieces = [
      {label:"Exitosos", count:s.successful.length, color:"#22c55e", cls:"green"},
      {label:"Fallidos", count:s.failed.length, color:"#f43f5e", cls:"red"},
      {label:"Pendientes", count:s.pending.length, color:"#f59e0b", cls:"orange"},
      {label:"No participó", count:s.opted.length, color:"#94a3b8", cls:"gray"}
    ];

    let acc = 0;
    const stops = pieces.map(p=>{
      const from = acc;
      acc += (p.count / total) * 100;
      const to = acc;
      return `${p.color} ${from.toFixed(2)}% ${to.toFixed(2)}%`;
    }).join(", ");
    const bg = s.pays.length ? `conic-gradient(${stops})` : "conic-gradient(#e5e7eb 0 100%)";

    const methods = Object.entries(s.methods);
    const methodRows = methods.length ? methods.map(([name,v])=>`
      <div class="legendRow">
        <span class="dot" style="background:${name.includes("Transbank")?"#6d28d9":name.includes("Transfer")?"#2563eb":name.includes("Efectivo")?"#f59e0b":"#22c55e"}"></span>
        <span>${esc(name)}</span><b>${v.count}</b><small>${clp(v.amount)}</small>
      </div>
    `).join("") : `<div class="muted" style="font-weight:800">Sin pagos exitosos por modalidad.</div>`;

    return `
      <div class="paymentBox">
        <div class="donut" style="background:${bg};"><div class="donutText"><strong>${s.pays.length}</strong><span>Pagos totales</span></div></div>
        <div class="legend">
          ${pieces.map(p=>legend(p.color,p.label,p.count,pct(p.count,total))).join("")}
          <hr style="width:100%;border:0;border-top:1px solid rgba(16,24,40,.08)">
          <b>Modalidad de pagos exitosos</b>
          ${methodRows}
          <div><b>Monto total transado</b><h2>${clp(s.totalPaid)}</h2></div>
        </div>
      </div>
    `;
  }

  function pct(v,t){ return `${Math.round((v/t)*100)}%`; }
  function legend(color,label,count,p){ return `<div class="legendRow"><span class="dot" style="background:${color}"></span><span>${label}</span><b>${count}</b><small>${p}</small></div>`; }

  function logsTable(logs){
    return `<div class="tableWrap"><table><thead><tr><th>Fecha / Hora</th><th>Usuario</th><th>Acción</th><th>Objetivo</th><th>Tipo</th></tr></thead><tbody>${logs.map(l=>`<tr><td>${fmtDate(l.at)}</td><td>${esc(l.user)}</td><td>${esc(l.action)}</td><td>${esc(l.target)}</td><td><span class="badge purple">${esc(l.type)}</span></td></tr>`).join("") || `<tr><td colspan="5">Sin logs.</td></tr>`}</tbody></table></div>`;
  }

  function paymentFiltersHtml(){
    const courses = getAllCourses();
    const regions = [...new Set(courses.map(c=>c.region).filter(Boolean))].sort();
    const schools = [...new Set(courses.map(c=>c.school).filter(Boolean))].sort();
    const courseOptions = courses.slice().sort((a,b)=>String(a.label).localeCompare(String(b.label)));
    return `
      <div class="toolbar stickyToolbar">
        <input id="paySearch" placeholder="Buscar alumno, concepto, colegio..." oninput="Admin.filterPayments()">
        <select id="payRegion" onchange="Admin.filterPayments()"><option value="">Todas las regiones</option>${regions.map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join("")}</select>
        <select id="paySchool" onchange="Admin.filterPayments()"><option value="">Todos los colegios</option>${schools.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join("")}</select>
        <select id="payCourse" onchange="Admin.filterPayments()"><option value="">Todos los cursos</option>${courseOptions.map(c=>`<option value="${esc(c.courseKey)}">${esc(c.school)} · ${esc(c.course)} ${esc(c.jornada)}</option>`).join("")}</select>
        <select id="payStatus" onchange="Admin.filterPayments()"><option value="">Todos los estados</option><option value="paid">Pagados</option><option value="pending">Pendientes</option><option value="failed">Fallidos</option><option value="opted_out">No participó</option></select>
        <select id="payMethod" onchange="Admin.filterPayments()"><option value="">Todas las modalidades</option><option value="Transbank">Transbank</option><option value="Conciliación">Conciliación</option><option value="Transferencia">Transferencia</option><option value="Efectivo">Efectivo</option></select>
      </div>
    `;
  }

  function filteredPayments(){
    const q = ($("#paySearch")?.value||"").toLowerCase();
    const region = $("#payRegion")?.value || "";
    const school = $("#paySchool")?.value || "";
    const course = $("#payCourse")?.value || "";
    const status = $("#payStatus")?.value || "";
    const method = $("#payMethod")?.value || "";

    return payments().filter(p=>{
      const c = courseFromPayment(p);
      const ck = courseKeyOf(p);
      const m = paymentMethod(p);
      const st = paymentStatus(p);
      const blob = JSON.stringify(p).toLowerCase() + " " + JSON.stringify(c).toLowerCase() + " " + ck.toLowerCase();
      return (!q || blob.includes(q)) &&
        (!region || getRegionName(c)===region) &&
        (!school || getSchoolName(c)===school) &&
        (!course || ck===course) &&
        (!status || st===status) &&
        (!method || m===method || (method==="Transbank" && m==="Transbank/demo"));
    }).sort((a,b)=>String(b.createdAt||b.paidAt||"").localeCompare(String(a.createdAt||a.paidAt||"")));
  }

  function renderPagos(){
    setTitle("Panel de pagos", "Trazabilidad de pagos por colegio, curso, estado y modalidad");
    const s = stats();
    const rows = filteredPayments();
    app.innerHTML = `
      <div class="kpis">
        ${kpi("✅","Pagos efectuados",s.successful.length,clp(s.totalPaid))}
        ${kpi("⚠️","Pagos fallidos",s.failed.length,"revisar rechazos")}
        ${kpi("⏳","Pendientes",s.pending.length,"en curso")}
        ${kpi("🤝","Conciliación / manual",Object.values(s.methods).filter((_,i)=>true).reduce((a,b)=>a+(b.count||0),0),"modalidades")}
        ${kpi("💳","Total pagos",s.pays.length,"todos los estados")}
        ${kpi("📄","Comprobantes",receipts().length,"emitidos")}
      </div>
      ${paymentFiltersHtml()}
      <section class="panel" style="margin-top:16px">
        <div class="panelHead"><h2>Detalle de pagos</h2><span id="payCount" class="badge purple">${rows.length} resultados</span></div>
        <div id="paymentTable">${paymentsTable(rows)}</div>
      </section>`;
  }

  function paymentsTable(pays){
    const visible = pays.slice(0,200);
    return `<div class="tableWrap"><table><thead><tr><th>Región</th><th>Colegio</th><th>Curso</th><th>Alumno</th><th>Concepto</th><th>Monto</th><th>Estado</th><th>Modalidad</th></tr></thead><tbody>
      ${visible.map(p=>{
        const c = courseFromPayment(p);
        return `<tr><td>${esc(getRegionName(c))}</td><td>${esc(getSchoolName(c))}</td><td>${esc(getCourseName(c))} ${esc(getJornada(c))}</td><td>${esc(p.alumno||"—")}</td><td>${esc(p.concept||p.title||"Pago")}</td><td>${clp(p.amount||p.monto)}</td><td>${statusBadge(paymentStatus(p))}</td><td>${esc(paymentMethod(p))}</td></tr>`;
      }).join("") || `<tr><td colspan="8">Sin pagos para los filtros aplicados.</td></tr>`}
      ${pays.length>200 ? `<tr><td colspan="8"><b>Mostrando 200 de ${pays.length} resultados.</b> Usa filtros por colegio/curso para acotar la búsqueda.</td></tr>` : ``}
    </tbody></table></div>`;
  }

  function statusBadge(st){
    const s = String(st||"pending").toLowerCase();
    const cls = s==="paid" ? "green" : (s==="failed" ? "red" : (s==="opted_out" ? "gray" : "orange"));
    return `<span class="badge ${cls}">${esc(s)}</span>`;
  }

  function renderColegios(){
    setTitle("Colegios y cursos", "Cursos registrados por región, colegio y jornada");
    const courses = getAllCourses();
    const schoolRows = groupCoursesBySchool();
    const regions = [...new Set(courses.map(c=>c.region).filter(Boolean))].sort();

    app.innerHTML = `
      <div class="toolbar stickyToolbar">
        <input id="courseSearch" placeholder="Buscar colegio, curso, comuna..." oninput="Admin.filterCourses()">
        <select id="courseRegion" onchange="Admin.filterCourses()"><option value="">Todas las regiones</option>${regions.map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join("")}</select>
      </div>

      <div class="tablesGrid">
        <section class="panel">
          <div class="panelHead"><h2>Cursos por colegio</h2><span class="badge purple">${schoolRows.length} colegios</span></div>
          <div id="schoolTable">${schoolsTable(schoolRows)}</div>
        </section>
        <section class="panel">
          <div class="panelHead"><h2>Cursos por región</h2><span class="badge purple">${courses.length} cursos</span></div>
          <div class="list">${regionRows(groupCount(courses, c=>c.region || "Sin región"))}</div>
        </section>
      </div>

      <section class="panel" style="margin-top:18px">
        <div class="panelHead"><h2>Detalle de cursos registrados</h2><span id="courseCount" class="badge purple">${courses.length} cursos</span></div>
        <div id="courseTable">${coursesTable(courses)}</div>
      </section>`;
  }

  function schoolsTable(rows){
    return `<div class="tableWrap"><table><thead><tr><th>Colegio</th><th>Región</th><th>Cursos</th><th>Miembros</th><th>Acción</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.school)}</td><td>${esc(r.region)}</td><td><span class="badge purple">${r.cursos}</span></td><td>${r.miembros}</td><td><button class="adminBtn ghost" onclick="Admin.setCourseSearch('${esc(r.school)}')">Ver cursos</button></td></tr>`).join("") || `<tr><td colspan="5">Sin colegios.</td></tr>`}</tbody></table></div>`;
  }

  function coursesTable(rows){
    return `<div class="tableWrap"><table><thead><tr><th>Región</th><th>Comuna</th><th>Colegio</th><th>Curso</th><th>Jornada</th><th>Miembros</th><th>Pres.</th><th>Tes.</th><th>Apod.</th><th>Acción</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.region)}</td><td>${esc(r.comuna)}</td><td>${esc(r.school)}</td><td>${esc(r.course)}</td><td>${esc(r.jornada)}</td><td>${r.miembros}</td><td>${r.presidentes}</td><td><span class="badge green">${r.tesoreros||0}</span></td><td>${r.apoderados}</td><td><button class="adminBtn ghost" onclick="Admin.inspectCourse('${esc(r.courseKey)}')">Ver</button></td></tr>`).join("") || `<tr><td colspan="10">Sin cursos.</td></tr>`}</tbody></table></div>`;
  }



  function campaignStatus(t){
    const closed = !!(t.closed || t.isClosed || t.status === "closed" || t.status === "cerrada");
    if(closed) return {key:"closed", label:"Cerrada", cls:"gray"};
    const due = t.dueDate || t.endDate || t.fechaVencimiento || "";
    if(due){
      const d = new Date(String(due).slice(0,10)+"T00:00:00");
      const today = new Date(new Date().toISOString().slice(0,10)+"T00:00:00");
      if(!isNaN(d.getTime()) && d < today) return {key:"expired", label:"Vencida", cls:"red"};
    }
    return {key:"active", label:"Activa", cls:"green"};
  }

  function campaignTypeLabel(t){
    const type = String(t.type || t.paymentType || "").toLowerCase();
    if(type.includes("monthly") || type.includes("mensual")) return "Mensual";
    if(type.includes("single") || type.includes("unico") || type.includes("único")) return "Pago único";
    return t.months && Number(t.months)>1 ? "Mensual" : "Pago único";
  }

  function campaignExpectedAmount(t){
    const amount = Number(t.amount || t.monto || 0);
    const months = Number(t.months || t.cuotas || 1);
    const goal = Number(t.goalTotal || t.meta || 0);
    return goal || (amount * Math.max(1, months));
  }

  function paymentsForCampaign(taskId){
    if(!taskId) return [];
    return payments().filter(p=>String(p.fromTaskId||p.taskId||p.campaignId||p.campaign_id||"")===String(taskId));
  }

  function collectedForCampaign(taskId){
    return paymentsForCampaign(taskId).filter(p=>paymentStatus(p)==="paid").reduce((a,b)=>a+Number(b.amount||b.monto||0),0);
  }

  function campaignRows(){
    return tasks().map(t=>{
      const c = courseFromPayment(t);
      const status = campaignStatus(t);
      const rec = collectedForCampaign(t.id);
      const expected = campaignExpectedAmount(t);
      const pct = expected ? Math.min(100, Math.round(rec/expected*100)) : 0;
      return Object.assign({}, t, {
        __region:getRegionName(c),
        __school:getSchoolName(c),
        __course:getCourseName(c),
        __jornada:getJornada(c),
        __courseKey:courseKeyOf(t),
        __status:status,
        __typeLabel:campaignTypeLabel(t),
        __expected:expected,
        __collected:rec,
        __pct:pct,
        __payments:paymentsForCampaign(t.id).length
      });
    }).sort((a,b)=>String(b.createdAt||b.startDate||"").localeCompare(String(a.createdAt||a.startDate||"")));
  }

  function campaignFiltersHtml(){
    const rows = campaignRows();
    const regions = [...new Set(rows.map(r=>r.__region).filter(Boolean))].sort();
    const schools = [...new Set(rows.map(r=>r.__school).filter(Boolean))].sort();
    return `
      <div class="toolbar stickyToolbar">
        <input id="campSearch" placeholder="Buscar campaña, colegio, curso..." oninput="Admin.filterCampaigns()">
        <select id="campRegion" onchange="Admin.filterCampaigns()"><option value="">Todas las regiones</option>${regions.map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join("")}</select>
        <select id="campSchool" onchange="Admin.filterCampaigns()"><option value="">Todos los colegios</option>${schools.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join("")}</select>
        <select id="campStatus" onchange="Admin.filterCampaigns()"><option value="">Todos los estados</option><option value="active">Activas</option><option value="expired">Vencidas</option><option value="closed">Cerradas</option></select>
        <select id="campType" onchange="Admin.filterCampaigns()"><option value="">Todos los tipos</option><option value="Mensual">Mensual</option><option value="Pago único">Pago único</option></select>
      </div>
    `;
  }

  function filteredCampaigns(){
    const q = ($("#campSearch")?.value||"").toLowerCase();
    const region = $("#campRegion")?.value || "";
    const school = $("#campSchool")?.value || "";
    const status = $("#campStatus")?.value || "";
    const type = $("#campType")?.value || "";
    return campaignRows().filter(t=>{
      const blob = JSON.stringify(t).toLowerCase();
      return (!q || blob.includes(q)) &&
        (!region || t.__region === region) &&
        (!school || t.__school === school) &&
        (!status || t.__status.key === status) &&
        (!type || t.__typeLabel === type);
    });
  }

  function campaignsTable(rows){
    return `<div class="tableWrap"><table><thead><tr><th>Campaña</th><th>Colegio</th><th>Curso</th><th>Tipo</th><th>Periodo</th><th>Meta</th><th>Recaudado</th><th>Avance</th><th>Estado</th><th>Pagos</th></tr></thead><tbody>
      ${rows.map(t=>`<tr>
        <td><b>${esc(t.title || t.name || "Campaña")}</b><br><small>${esc(t.description || "")}</small></td>
        <td>${esc(t.__school)}</td>
        <td>${esc(t.__course)} ${esc(t.__jornada)}</td>
        <td>${esc(t.__typeLabel)}</td>
        <td>${esc(t.startDate || "—")} → ${esc(t.dueDate || t.endDate || "—")}</td>
        <td>${clp(t.__expected)}</td>
        <td>${clp(t.__collected)}</td>
        <td><div class="campProgress"><span style="width:${t.__pct}%"></span></div><small>${t.__pct}%</small></td>
        <td><span class="badge ${t.__status.cls}">${esc(t.__status.label)}</span></td>
        <td>${t.__payments}</td>
      </tr>`).join("") || `<tr><td colspan="10">Sin campañas para los filtros aplicados.</td></tr>`}
    </tbody></table></div>`;
  }

  function renderCampanas(){
    setTitle("Campañas", "Seguimiento global de campañas creadas por colegios y cursos");
    const rows = campaignRows();
    const active = rows.filter(r=>r.__status.key==="active").length;
    const expired = rows.filter(r=>r.__status.key==="expired").length;
    const closed = rows.filter(r=>r.__status.key==="closed").length;
    const totalExpected = rows.reduce((a,b)=>a+Number(b.__expected||0),0);
    const totalCollected = rows.reduce((a,b)=>a+Number(b.__collected||0),0);

    app.innerHTML = `
      <div class="kpis">
        ${kpi("📌","Campañas creadas",rows.length,"total app")}
        ${kpi("🟢","Activas",active,"en seguimiento")}
        ${kpi("🔴","Vencidas",expired,"requieren revisión")}
        ${kpi("⚪","Cerradas",closed,"histórico")}
        ${kpi("🎯","Meta total",clp(totalExpected),"campañas")}
        ${kpi("💰","Recaudado",clp(totalCollected),"pagos asociados")}
      </div>
      ${campaignFiltersHtml()}
      <section class="panel" style="margin-top:16px">
        <div class="panelHead"><h2>Campañas registradas</h2><span id="campCount" class="badge purple">${rows.length} resultados</span></div>
        <div id="campaignTable">${campaignsTable(rows)}</div>
      </section>
    `;
  }


  function renderLogs(){
    setTitle("Logs de movimientos", "Trazabilidad operacional de la app");
    const logs = load(ADMIN_LOGS, []);
    app.innerHTML = `
      <div class="toolbar">
        <input id="logSearch" placeholder="Buscar por usuario, acción o curso..." oninput="Admin.filterLogs()">
        <select id="logType" onchange="Admin.filterLogs()">
          <option value="">Todos los tipos</option>
          <option value="login_admin">Login admin</option>
          <option value="campaign_created">Campañas</option>
          <option value="payment_success">Pagos</option>
          <option value="admin_action">Acciones admin</option>
        </select>
        <button class="adminBtn ghost" onclick="Admin.exportLogs()">Exportar CSV</button>
      </div>
      <section class="panel"><div class="panelHead"><h2>Bitácora</h2><button onclick="Admin.addDemoLog()">Agregar log demo</button></div><div id="logsTable">${logsTable(logs)}</div></section>
    `;
  }

  function renderTickets(){
    setTitle("Tickets de soporte", "Buscar, responder y medir SLA de solicitudes por curso y colegio");
    const tickets = load(ADMIN_TICKETS, []);
    app.innerHTML = `
      <div class="toolbar stickyToolbar">
        <input id="ticketSearch" placeholder="Buscar colegio, curso, solicitante, folio..." oninput="Admin.filterTickets()">
        <select id="ticketStatus" onchange="Admin.filterTickets()"><option value="">Todos los estados</option><option value="abierto">Abiertos</option><option value="revision">En revisión</option><option value="resuelto">Resueltos</option></select>
        <select id="ticketPriority" onchange="Admin.filterTickets()"><option value="">Toda criticidad</option><option value="critica">Crítica</option><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select>
        <select id="ticketCategory" onchange="Admin.filterTickets()"><option value="">Todas las categorías</option><option value="acceso_login">Acceso / login</option><option value="pago_transaccion">Pago o transacción</option><option value="menu_visual">Problema visual / menú</option><option value="campanas">Campañas</option><option value="rendiciones">Rendiciones</option><option value="informes">Informes</option><option value="datos">Datos</option><option value="otro">Otro</option></select>
        <button class="adminBtn" onclick="Admin.openTicketModal()">Nuevo ticket</button>
      </div>
      <div class="kpis">
        ${kpi("🎫","Abiertos",tickets.filter(t=>t.status==="abierto").length,"pendientes")}
        ${kpi("👀","En revisión",tickets.filter(t=>t.status==="revision").length,"soporte")}
        ${kpi("✅","Resueltos",tickets.filter(t=>t.status==="resuelto").length,"cerrados")}
        ${kpi("⏱️","SLA vencidos",tickets.filter(t=>slaState(t).cls==="red").length,"requieren gestión")}
        ${kpi("🔥","Críticos",tickets.filter(t=>String(t.priority)==="critica").length,"alta prioridad")}
        ${kpi("💳","Transacciones",tickets.filter(t=>String(t.category)==="pago_transaccion").length,"pagos")}
      </div>
      <section class="panel" style="margin-top:18px"><div class="panelHead"><h2>Tickets</h2><span id="ticketCount" class="badge purple">${tickets.length} total</span></div><div id="ticketsList" class="list">${tickets.map(ticketFullRow).join("")}</div></section>
    `;
  }

  function ticketFullRow(t){
    const statusCls = t.status==="resuelto" ? "green" : (t.status==="revision" ? "orange" : "red");
    const sla = slaState(t);
    return `<div class="row ticketRow" onclick="Admin.openTicket('${esc(t.id)}')" style="cursor:pointer">
      <div class="rowIcon">🎫</div>
      <div>
        <b>${esc(t.id)} · ${esc(t.subject || "Sin asunto")}</b>
        <p>${esc(t.school || "Sin colegio")} · ${esc(t.course || "Sin curso")} · ${esc(t.requesterName || t.requester || "Solicitante")} · ${fmtDate(t.createdAt)}</p>
        <p><span class="badge ${priorityClass(t.priority)}">${esc(t.priorityLabel || t.priority || "media")}</span> <span class="badge blue">${esc(categoryText(t))}</span> <span class="badge ${sla.cls}">${esc(sla.label)}</span></p>
      </div>
      <span class="badge ${statusCls}">${esc(t.status || "abierto")}</span>
    </div>`;
  }

  
  function renderComunidad(){
    setTitle("Administración de comunidad", "Dar de baja miembros o corregir datos con trazabilidad");
    const ps = profiles();
    const us = users();
    app.innerHTML = `
      <div class="toolbar">
        <input id="communitySearch" placeholder="Buscar nombre, correo, alumno, colegio..." oninput="Admin.filterCommunity()">
        <button class="adminBtn ghost" onclick="Admin.go('auditoria')">Ver auditoría</button>
      </div>
      <section class="panel"><div class="panelHead"><h2>Miembros</h2><span class="badge purple">${ps.length || us.length} registros</span></div><div id="communityTable">${communityTable(ps,us)}</div></section>`;
  }

  function communityTable(ps,us){
    const rows = ps.length ? ps.map(p=>{
      const email = p.userId || p.apoderado?.email || "";
      const name = p.apoderado?.name || p.directiva?.name || email || "Usuario";
      return {name,email,role:p.role, alumno:p.apoderado?.alumno||"—", course:courseLabelFromProfile(p), region:getRegionName(p.course||{}), profileId:p.profileId};
    }) : us.map(u=>({name:u.email,email:u.email,role:"usuario",alumno:"—",course:"—",region:"—",profileId:u.userId}));
    return `<div class="tableWrap"><table><thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Alumno</th><th>Región</th><th>Curso</th><th>Acciones</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(r.email)}</td><td><span class="badge purple">${esc(r.role)}</span></td><td>${esc(r.alumno)}</td><td>${esc(r.region)}</td><td>${esc(r.course)}</td><td><button class="adminBtn ghost" onclick="Admin.openMember('${esc(r.profileId)}')">Administrar</button></td></tr>`).join("") || `<tr><td colspan="7">Sin miembros.</td></tr>`}</tbody></table></div>`;
  }


  function badge(label, cls){
    return `<span class="badge ${esc(cls||"purple")}">${esc(label)}</span>`;
  }

  function marketStatusBadge(st){
    const s = String(st || "disponible").toLowerCase();
    const cls = s === "vendido" ? "green" : (s === "reservado" ? "orange" : (s === "eliminado" ? "red" : "purple"));
    return badge(s, cls);
  }

  function renderAvisos(){
    setTitle("Avisos", "Comunicaciones cargadas desde Supabase");
    const rows = notices();
    const byTipo = groupCount(rows, a=>a.tipo || "general");
    const byDestino = groupCount(rows, a=>a.destino || a.rol_destino || a.destinatario_rol || "todos");

    app.innerHTML = `
      <div class="kpis">
        ${kpi("📣","Avisos totales",rows.length,"Tabla avisos")}
        ${kpi("👪","Para apoderados",(byDestino.apoderado||0)+(byDestino.todos||0),"Destino")}
        ${kpi("🏫","Cursos con avisos",new Set(rows.map(a=>a.curso_id).filter(Boolean)).size,"Cursos")}
        ${kpi("⚡","Tipos",Object.keys(byTipo).length,"general, pago, directiva")}
      </div>
      <section class="panel">
        <div class="panelHead"><h2>Últimos avisos</h2><button onclick="Admin.refresh()">Actualizar</button></div>
        <div class="tableWrap"><table><thead><tr><th>Fecha</th><th>Título</th><th>Tipo</th><th>Destino</th><th>Curso</th><th>Mensaje</th></tr></thead><tbody>
          ${rows.slice(0,80).map(a=>`<tr>
            <td>${fmtDate(a.created_at || a.fecha_publicacion)}</td>
            <td><b>${esc(a.titulo || "Aviso")}</b></td>
            <td>${badge(a.tipo || "general","purple")}</td>
            <td>${esc(a.destino || a.rol_destino || a.destinatario_rol || "todos")}</td>
            <td>${esc(a.cursos?.nombre || a.curso_id || "—")}</td>
            <td>${esc(a.mensaje || a.contenido || "")}</td>
          </tr>`).join("") || `<tr><td colspan="6">Sin avisos.</td></tr>`}
        </tbody></table></div>
      </section>
    `;
  }

  function renderFinanzas(){
    setTitle("Informes y rendiciones", "Gastos, rendiciones e informes desde Supabase");
    const gs = expenses();
    const rs = renditions();
    const inf = reports();
    const totalGastos = gs.reduce((a,g)=>a+Number(g.amount||0),0);
    const publicados = inf.filter(i=>i.publicado || i.status==="publicado").length;
    app.innerHTML = `
      <div class="kpis">
        ${kpi("🧾","Gastos",gs.length,clp(totalGastos))}
        ${kpi("📊","Rendiciones",rs.length,`${rs.filter(r=>r.publicado).length} publicadas`)}
        ${kpi("📄","Informes",inf.length,`${publicados} publicados`)}
        ${kpi("💰","Total rendido",clp(rs.reduce((a,r)=>a+Number(r.amount||0),0)),"Supabase")}
      </div>
      <div class="tablesGrid">
        <section class="panel">
          <div class="panelHead"><h2>Últimos gastos</h2></div>
          <div class="tableWrap"><table><thead><tr><th>Fecha</th><th>Concepto</th><th>Monto</th><th>Curso</th><th>Campaña</th></tr></thead><tbody>
            ${gs.slice(0,60).map(g=>`<tr><td>${fmtDate(g.createdAt)}</td><td><b>${esc(g.title)}</b><br><small>${esc(g.descripcion || "")}</small></td><td>${clp(g.amount)}</td><td>${esc(g.__course?.schoolName || g.curso_id || "—")}</td><td>${esc(g.campanas?.titulo || g.campana_id || "—")}</td></tr>`).join("") || `<tr><td colspan="5">Sin gastos.</td></tr>`}
          </tbody></table></div>
        </section>
        <section class="panel">
          <div class="panelHead"><h2>Informes publicados</h2></div>
          <div class="tableWrap"><table><thead><tr><th>Fecha</th><th>Título</th><th>Tipo</th><th>Publicado</th><th>Curso</th></tr></thead><tbody>
            ${inf.slice(0,60).map(r=>`<tr><td>${fmtDate(r.createdAt)}</td><td><b>${esc(r.title)}</b></td><td>${esc(r.tipo || "informe")}</td><td>${r.publicado ? "✅" : "—"} ${esc(r.publishedAt ? fmtDate(r.publishedAt) : "")}</td><td>${esc(r.__course?.schoolName || r.curso_id || "—")}</td></tr>`).join("") || `<tr><td colspan="5">Sin informes.</td></tr>`}
          </tbody></table></div>
        </section>
      </div>
    `;
  }

  function renderMercado(){
    setTitle("Mercado Escolar", "Publicaciones, contactos WhatsApp y reportes desde Supabase");
    const pubs = marketPublications();
    const contacts = marketContacts();
    const reports = marketReports();
    const favoritos = marketFavorites();
    const activos = pubs.filter(p=>p.activo!==false && String(p.estado||"")!=="eliminado");
    const vendidos = pubs.filter(p=>String(p.estado||"").toLowerCase()==="vendido");
    const reportesPend = reports.filter(r=>String(r.estado||"pendiente").toLowerCase()==="pendiente");

    app.innerHTML = `
      <div class="kpis">
        ${kpi("🛍️","Publicaciones activas",activos.length,`${pubs.length} totales`)}
        ${kpi("✅","Vendidas",vendidos.length,"Estado vendido")}
        ${kpi("💬","Contactos WhatsApp",contacts.length,"Interacciones")}
        ${kpi("♥️","Favoritos",favoritos.length,"Guardados")}
        ${kpi("🚩","Reportes pendientes",reportesPend.length,`${reports.length} reportes`)}
      </div>

      <div class="gridMain adminGrid4">
        <section class="panel">
          <div class="panelHead"><h2>Últimas publicaciones</h2><button onclick="Admin.refresh()">Actualizar</button></div>
          <div class="list">
            ${pubs.slice(0,8).map(p=>`
              <div class="listItem">
                <div><b>${esc(p.titulo || "Publicación")}</b><span>${esc(p.categorias?.nombre || p.categoria_id || "Sin categoría")} · ${clp(p.precio || 0)}</span></div>
                <div>${marketStatusBadge(p.estado)}<br><small>${fmtDate(p.created_at)}</small></div>
              </div>
            `).join("") || emptyRow("Sin publicaciones")}
          </div>
        </section>
        <section class="panel">
          <div class="panelHead"><h2>Contactos recientes</h2></div>
          <div class="list">
            ${contacts.slice(0,8).map(c=>`
              <div class="listItem">
                <div><b>${esc(c.publicaciones?.titulo || c.publicacion_id || "Contacto")}</b><span>${esc(c.canal || "whatsapp")} · ${fmtDate(c.created_at)}</span></div>
                <span>${esc(c.mensaje || "—")}</span>
              </div>
            `).join("") || emptyRow("Sin contactos")}
          </div>
        </section>
        <section class="panel">
          <div class="panelHead"><h2>Reportes pendientes</h2></div>
          <div class="list">
            ${reports.slice(0,8).map(r=>`
              <div class="listItem">
                <div><b>${esc(r.motivo || "Reporte")}</b><span>${esc(r.publicaciones?.titulo || r.publicacion_id || "")}</span></div>
                <div>${badge(r.estado || "pendiente","orange")}<br><small>${fmtDate(r.created_at)}</small></div>
              </div>
            `).join("") || emptyRow("Sin reportes")}
          </div>
        </section>
        <section class="panel">
          <div class="panelHead"><h2>Categorías</h2></div>
          <div class="list">
            ${(ADMIN_DB.mercado_categorias||[]).map(c=>`
              <div class="listItem"><div><b>${esc(c.icono || "📦")} ${esc(c.nombre)}</b><span>${c.activo===false ? "Inactiva" : "Activa"}</span></div></div>
            `).join("") || emptyRow("Sin categorías")}
          </div>
        </section>
      </div>

      <section class="panel">
        <div class="panelHead"><h2>Detalle publicaciones</h2><span id="marketCount">${pubs.length} publicaciones</span></div>
        <div class="tableWrap"><table><thead><tr><th>Fecha</th><th>Título</th><th>Categoría</th><th>Precio</th><th>Estado</th><th>Vendedor</th><th>WhatsApp</th><th>Métricas</th><th>Favoritos</th></tr></thead><tbody>
          ${pubs.map(p=>`<tr>
            <td>${fmtDate(p.created_at)}</td>
            <td><b>${esc(p.titulo || "—")}</b><br><small>${esc(p.descripcion || "")}</small></td>
            <td>${esc(p.categorias?.nombre || p.categoria_id || "—")}</td>
            <td>${clp(p.precio || 0)}</td>
            <td>${marketStatusBadge(p.estado)}</td>
            <td>${esc(p.nombre_vendedor || p.vendedor?.nombre || "—")}</td>
            <td>${esc(p.whatsapp || "—")}</td>
            <td>👁️ ${Number(p.visualizaciones||0)} · 💬 ${Number(p.contactos||0)}</td><td>♥ ${Number(p.favoritos||0)} · ${favoritos.filter(f=>String(f.publicacion_id)===String(p.id)).length} filas</td>
          </tr>`).join("") || `<tr><td colspan="9">Sin publicaciones Mercado.</td></tr>`}
        </tbody></table></div>
      </section>
    `;
  }

  function renderAuditoria(){
    setTitle("Auditoría", "Control de cambios sensibles y acciones administrativas");
    const logs = load(ADMIN_LOGS, []).filter(l=>String(l.type||"").includes("admin") || String(l.type||"").includes("audit") || String(l.type||"").includes("member"));
    app.innerHTML = `<section class="panel"><div class="panelHead"><h2>Acciones sensibles</h2><button onclick="Admin.addAuditDemo()">Registrar acción demo</button></div>${logsTable(logs)}</section>`;
  }

  function openModal(html){ modal.innerHTML = `<div class="modalBg"><div class="modalCard">${html}</div></div>`; }
  function closeModal(){ modal.innerHTML = ""; }

  window.Admin = {
    go(tab){
      $$(".sideItem").forEach(b=>b.classList.toggle("active", b.dataset.tab===tab));
      document.body.classList.remove("sideOpen");
      if(tab==="dashboard") renderDashboard();
      if(tab==="logs") renderLogs();
      if(tab==="tickets") renderTickets();
      if(tab==="pagos") renderPagos();
      if(tab==="comunidad") renderComunidad();
      if(tab==="colegios") renderColegios();
      if(tab==="campanas") renderCampanas();
      if(tab==="avisos") renderAvisos();
      if(tab==="finanzas") renderFinanzas();
      if(tab==="mercado") renderMercado();
      if(tab==="auditoria") renderAuditoria();
    },
    async refresh(){
      setTitle("Actualizando datos", "Consultando Supabase...");
      app.innerHTML = `<section class="panel"><div class="panelHead"><h2>Actualizando</h2></div><p class="muted" style="font-weight:800">Consultando datos más recientes...</p></section>`;
      ADMIN_DB.loading = false;
      await loadSupabaseAdminData();
      Admin.go(document.querySelector(".sideItem.active")?.dataset.tab || "dashboard");
    },
    logout(){
      log("logout_admin","Salida de panel administrador","Admin Console");
      localStorage.removeItem(SESSION_KEY);
      location.href="/index.html";
    },
    filterPayments(){
      const rows = filteredPayments();
      $("#paymentTable").innerHTML = paymentsTable(rows);
      $("#payCount").textContent = `${rows.length} resultados`;
    },
    setCourseSearch(school){
      Admin.go("colegios");
      setTimeout(()=>{
        const input = $("#courseSearch");
        if(input){ input.value = school; Admin.filterCourses(); }
      },0);
    },
    filterCampaigns(){
      const rows = filteredCampaigns();
      $("#campaignTable").innerHTML = campaignsTable(rows);
      $("#campCount").textContent = `${rows.length} resultados`;
    },
    filterCourses(){
      const q = ($("#courseSearch")?.value||"").toLowerCase();
      const region = $("#courseRegion")?.value || "";
      const rows = getAllCourses().filter(c=>{
        const blob = JSON.stringify(c).toLowerCase();
        return (!q || blob.includes(q)) && (!region || c.region===region);
      });
      $("#courseTable").innerHTML = coursesTable(rows);
      $("#courseCount").textContent = `${rows.length} cursos`;
    },
    filterLogs(){
      const q = ($("#logSearch")?.value||"").toLowerCase();
      const t = $("#logType")?.value || "";
      const rows = load(ADMIN_LOGS, []).filter(l=>(!t || l.type===t) && JSON.stringify(l).toLowerCase().includes(q));
      $("#logsTable").innerHTML = logsTable(rows);
    },
    exportLogs(){
      const logs = load(ADMIN_LOGS, []);
      const csv = ["fecha,usuario,tipo,accion,objetivo"].concat(logs.map(l=>[l.at,l.user,l.type,l.action,l.target].map(x=>`"${String(x||"").replace(/"/g,'""')}"`).join(","))).join("\\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], {type:"text/csv"}));
      a.download = "cursapp_admin_logs.csv";
      a.click();
      log("admin_action","Exportó logs CSV","Logs");
    },
    addDemoLog(){ log("admin_action","Revisó logs operacionales","Logs"); renderLogs(); },
    filterTickets(){
      const q = ($("#ticketSearch")?.value||"").toLowerCase();
      const st = $("#ticketStatus")?.value || "";
      const pr = $("#ticketPriority")?.value || "";
      const cat = $("#ticketCategory")?.value || "";
      const rows = load(ADMIN_TICKETS, []).filter(t=>
        (!st || t.status===st) &&
        (!pr || t.priority===pr) &&
        (!cat || t.category===cat) &&
        JSON.stringify(t).toLowerCase().includes(q)
      );
      $("#ticketsList").innerHTML = rows.map(ticketFullRow).join("") || emptyRow("Sin tickets");
      const c = $("#ticketCount"); if(c) c.textContent = `${rows.length} resultados`;
    },
    openTicket(id){
      const t = load(ADMIN_TICKETS, []).find(x=>x.id===id);
      if(!t) return;
      const sla = slaState(t);
      const messages = (t.messages || []).map(m=>`
        <div class="ticketMsg">
          <div><b>${esc(m.from || "Usuario")}</b> <span>${esc(m.role || "")} · ${fmtDate(m.at)}</span></div>
          <p>${esc(m.body || "")}</p>
        </div>
      `).join("") || `<div class="muted" style="font-weight:800">Sin conversación.</div>`;

      openModal(`<h2>${esc(t.id)} · ${esc(t.subject || "Sin asunto")}</h2>
        <p class="muted">${esc(t.school || "Sin colegio")} · ${esc(t.course || "Sin curso")} · ${esc(t.region || "")}</p>

        <div class="ticketMetaGrid">
          <div><label>Solicitante</label><b>${esc(t.requesterName || t.requester || "—")}</b><span>${esc(t.requesterEmail || "")}</span></div>
          <div><label>Categoría</label><b>${esc(categoryText(t))}</b><span>${esc(t.category || "")}</span></div>
          <div><label>Criticidad</label><b>${esc(t.priorityLabel || t.priority || "media")}</b><span>SLA ${esc(t.slaHours || "")}h</span></div>
          <div><label>Vencimiento SLA</label><b class="${sla.cls}">${esc(sla.label)}</b><span>${fmtDate(t.slaDueAt)}</span></div>
        </div>

        <div class="ticketConversation">
          <h3>Conversación</h3>
          ${messages}
        </div>

        <div class="formGrid">
          <div><label>Estado</label><select id="tkStatus"><option value="abierto">Abierto</option><option value="revision">En revisión</option><option value="resuelto">Resuelto</option></select></div>
          <div><label>Criticidad</label><select id="tkPriority"><option value="critica">Crítica</option><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select></div>
          <div style="grid-column:1/-1"><label>Respuesta al ticket</label><textarea id="tkResponse" placeholder="Escribe la respuesta que quedará registrada en el historial..."></textarea></div>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="adminBtn ghost" onclick="Admin.closeModal()">Cancelar</button><button class="adminBtn" onclick="Admin.resolveTicket('${esc(t.id)}')">Guardar respuesta</button></div>`);
      $("#tkStatus").value = t.status || "abierto";
      $("#tkPriority").value = t.priority || "media";
    },
    resolveTicket(id){
      const list = load(ADMIN_TICKETS, []);
      const i = list.findIndex(t=>t.id===id);
      if(i>=0){
        const response = ($("#tkResponse")?.value || "").trim();
        list[i].status = $("#tkStatus").value;
        list[i].priority = $("#tkPriority").value;
        list[i].updatedAt = now();
        list[i].messages = list[i].messages || [];
        list[i].history = list[i].history || [];
        if(response){
          list[i].messages.push({at:now(), from:"Soporte Cursapp", role:"admin", body:response});
        }
        list[i].history.push({at:now(), event:"admin_response", by:"admin@cursapp.cl", status:list[i].status, priority:list[i].priority});
        save(ADMIN_TICKETS, list);
        log("admin_ticket_response","Respondió ticket",id,{response, status:list[i].status, priority:list[i].priority});
      }
      closeModal();
      renderTickets();
    },
    openTicketModal(){
      openModal(`<h2>Nuevo ticket interno</h2><div class="formGrid"><div><label>Colegio</label><input id="ntSchool" placeholder="Colegio"></div><div><label>Curso</label><input id="ntCourse" placeholder="2°B"></div><div><label>Solicitante</label><input id="ntReq" placeholder="correo"></div><div><label>Prioridad</label><select id="ntPri"><option>media</option><option>alta</option><option>baja</option></select></div><div style="grid-column:1/-1"><label>Asunto</label><input id="ntSub" placeholder="Motivo"></div><div style="grid-column:1/-1"><label>Detalle</label><textarea id="ntDet"></textarea></div></div><div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="adminBtn ghost" onclick="Admin.closeModal()">Cancelar</button><button class="adminBtn" onclick="Admin.createTicket()">Crear</button></div>`);
    },
    createTicket(){
      const list = load(ADMIN_TICKETS, []);
      const id = "TK-" + Math.floor(1000+Math.random()*9000);
      {
        const priority = $("#ntPri").value;
        const category = "otro";
        const hours = priority === "alta" ? 8 : (priority === "baja" ? 48 : 24);
        const createdAt = now();
        list.unshift({id,status:"abierto",priority,priorityLabel:priority,category,categoryLabel:"Otro",slaHours:hours,slaDueAt:new Date(Date.now()+hours*3600*1000).toISOString(),school:$("#ntSchool").value,course:$("#ntCourse").value,requester:$("#ntReq").value,requesterName:$("#ntReq").value,requesterEmail:$("#ntReq").value,subject:$("#ntSub").value,detail:$("#ntDet").value,createdAt,updatedAt:createdAt,messages:[{at:createdAt,from:$("#ntReq").value||"Admin",role:"admin",body:$("#ntDet").value}],history:[{at:createdAt,event:"ticket_created_admin",by:"admin@cursapp.cl"}]});
      }
      save(ADMIN_TICKETS, list);
      log("admin_action","Creó ticket interno",id);
      closeModal(); renderTickets();
    },
    filterCommunity(){
      const q = ($("#communitySearch")?.value||"").toLowerCase();
      const ps = profiles().filter(p=>JSON.stringify(p).toLowerCase().includes(q));
      $("#communityTable").innerHTML = communityTable(ps, users());
    },
    openMember(profileId){
      const ps = profiles();
      const p = ps.find(x=>String(x.profileId||x.userId)===String(profileId));
      if(!p) return;
      openModal(`<h2>Administrar miembro</h2><p class="muted">${esc(p.role)} · ${esc(courseLabelFromProfile(p))}</p><div class="formGrid"><div><label>Nombre</label><input id="mName" value="${esc(p.apoderado?.name || p.directiva?.name || "")}"></div><div><label>Email</label><input id="mEmail" value="${esc(p.apoderado?.email || p.userId || "")}"></div><div><label>Alumno</label><input id="mAlumno" value="${esc(p.apoderado?.alumno || "")}"></div><div><label>Estado</label><select id="mStatus"><option value="active">Activo</option><option value="suspended">Suspendido</option><option value="inactive">Baja</option></select></div><div style="grid-column:1/-1"><label>Motivo obligatorio</label><textarea id="mReason" placeholder="Explica por qué se realiza el cambio"></textarea></div></div><div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="adminBtn ghost" onclick="Admin.closeModal()">Cancelar</button><button class="adminBtn" onclick="Admin.saveMember('${esc(profileId)}')">Guardar cambios</button></div>`);
      $("#mStatus").value = p.status || "active";
    },
    saveMember(profileId){
      const reason = ($("#mReason").value||"").trim();
      if(!reason){ alert("Debes ingresar un motivo para auditar el cambio."); return; }
      const ps = profiles();
      const i = ps.findIndex(x=>String(x.profileId||x.userId)===String(profileId));
      if(i>=0){
        if(ps[i].apoderado){
          ps[i].apoderado.name = $("#mName").value;
          ps[i].apoderado.email = $("#mEmail").value;
          ps[i].apoderado.alumno = $("#mAlumno").value;
        }
        if(ps[i].directiva) ps[i].directiva.name = $("#mName").value;
        ps[i].status = $("#mStatus").value;
        ps[i].updatedByAdminAt = now();
        ps[i].updatedByAdminReason = reason;
        save("cursapp_profiles_v1", ps);
        log("admin_member_update","Actualizó datos de miembro",profileId,{reason});
      }
      closeModal(); renderComunidad();
    },
    inspectCourse(courseKey){
      const ps = profiles().filter(p=>p.courseKey===courseKey);
      openModal(`<h2>Curso ${esc(courseKey)}</h2><p class="muted">${ps.length} miembros detectados.</p>${communityTable(ps, [])}<div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="adminBtn ghost" onclick="Admin.closeModal()">Cerrar</button></div>`);
      log("admin_action","Inspeccionó curso",courseKey);
    },
    addAuditDemo(){ log("admin_audit","Revisión manual de auditoría","Admin Console",{reason:"Control preventivo"}); renderAuditoria(); },
    closeModal
  };

  document.addEventListener("DOMContentLoaded", async ()=>{
    const s = load(SESSION_KEY, null);
    if(!s || s.role !== "admin" || !s.isAdmin){
      location.href = "/index.html";
      return;
    }
    cleanupDummyTickets();
    seedAdminData();
    $("#mobileMenu")?.addEventListener("click", ()=>document.body.classList.toggle("sideOpen"));
    $$(".sideItem").forEach(b=>b.addEventListener("click", ()=>Admin.go(b.dataset.tab)));

    setTitle("Cargando datos", "Consultando Supabase...");
    app.innerHTML = `<section class="panel"><div class="panelHead"><h2>Conectando con Supabase</h2></div><p class="muted" style="font-weight:800">Cargando usuarios, cursos, campañas, pagos, avisos, informes, rendiciones y mercado escolar...</p></section>`;
    await loadSupabaseAdminData();
    if(ADMIN_DB.error){
      setTitle("Error Supabase", "No se pudieron cargar los datos");
      app.innerHTML = `<section class="panel"><div class="panelHead"><h2>Error al cargar Supabase</h2></div><p class="muted" style="font-weight:900;color:#b42318">${esc(ADMIN_DB.error)}</p><button class="adminBtn" onclick="location.reload()">Reintentar</button></section>`;
      return;
    }
    log("login_admin","Ingreso a panel administrador","Admin Console");
    Admin.go("dashboard");
  });
})();
