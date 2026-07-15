(function(){
  // Cursapp v12 · Gestión de apoderados Supabase-first
  // Mantiene la lógica existente: Supabase para curso/miembros y acciones de aprobación, eliminación y tesorero.

  const SB_CONFIG = window.CURSAPP_SUPABASE || {};
  const SB_URL = SB_CONFIG.url;
  const SB_KEY = SB_CONFIG.publishableKey;
  const KEY_SESSION = "cursapp_session_v1";

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const money = (n) => new Intl.NumberFormat("es-CL", { style:"currency", currency:"CLP", maximumFractionDigits:0 }).format(Number(n || 0));

  let STATE = {
    loading: true,
    error: null,
    session: null,
    curso: null,
    miembros: [],
    query: "",
    status: "all",
    page: 1
  };

  const ICONS = {
    users:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M16 19c0-2.2-1.8-4-4-4H8c-2.2 0-4 1.8-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" stroke-width="2"/><path d="M20 19c0-1.9-1.3-3.5-3-3.9M17 4.3a3 3 0 0 1 0 5.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    userPlus:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 19c0-2.2-1.8-4-4-4H7c-2.2 0-4 1.8-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" stroke-width="2"/><path d="M19 8v6M16 11h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    check:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 12 3 3 7-7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" stroke-width="2"/></svg>`,
    hourglass:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 3h12M6 21h12M8 3v4.5c0 1 .5 1.9 1.3 2.5L12 12l2.7-2c.8-.6 1.3-1.5 1.3-2.5V3M8 21v-4.5c0-1 .5-1.9 1.3-2.5L12 12l2.7 2c.8.6 1.3 1.5 1.3 2.5V21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    userX:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 19c0-2.2-1.8-4-4-4H7c-2.2 0-4 1.8-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" stroke-width="2"/><path d="m17 8 4 4m0-4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    search:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m21 21-4.3-4.3M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    filter:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    copy:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 8h10v12H8z" stroke="currentColor" stroke-width="2"/><path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    whatsapp:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20l1.2-4A8 8 0 1 1 8 18.8L4 20Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 8.8c.2 3 2.1 5 5 5.2l1.1-1.5-1.7-1-1 1c-.9-.4-1.6-1.1-2-2l1-1-1-1.8L9 8.8Z" fill="currentColor"/></svg>`,
    shield:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s7-3.5 7-10V5l-7-3-7 3v6c0 6.5 7 10 7 10Z" stroke="currentColor" stroke-width="2"/><path d="m9 12 2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    ellipsis:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h.01M12 12h.01M19 12h.01" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
    pencil:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20h4l11-11-4-4L4 16v4Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="m14 6 4 4" stroke="currentColor" stroke-width="2"/></svg>`,
    close:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    file:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" stroke="currentColor" stroke-width="2"/><path d="M14 3v5h5M8 13h8M8 17h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    chevron:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 18 6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    home:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m3 11 9-8 9 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 10v10h14V10M9 20v-6h6v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    flag:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 21V4m0 0c4-2 6 2 10 0 2-.8 3-1 4-.6v10c-4-1.4-6 2-10 0-1.4-.7-2.7-.8-4-.4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    clock:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    logout:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    message:`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21 12a8 8 0 0 1-8 8H7l-4 2 1.6-4A8 8 0 1 1 21 12Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`
  };

  function icon(name){ return ICONS[name] || ""; }

  function loadSession(){
    try{ return JSON.parse(localStorage.getItem(KEY_SESSION) || "null") || null; }
    catch(e){ return null; }
  }

  function roleOf(){
    return String(STATE.session?.currentRole || STATE.session?.role || "").toLowerCase();
  }

  function isDirectiva(role){
    return role === "presidente" || role === "tesorero";
  }

  function activeCourseKey(){
    const s = STATE.session || {};
    return String(s.courseKey || s.course_key || s.course?.courseKey || "").trim();
  }

  function fmtDate(iso){
    try{
      if(!iso) return "";
      return new Date(iso).toLocaleString("es-CL", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
    }catch(e){ return iso || ""; }
  }

  async function sb(path, opts={}){
    if(window.CURSAPP_SUPABASE && typeof window.CURSAPP_SUPABASE.request === "function"){
      const data = await window.CURSAPP_SUPABASE.request(path, opts);
      return Array.isArray(data) ? data : (data ? [data] : []);
    }
    const res = await fetch(SB_URL + "/rest/v1/" + path, {
      method: opts.method || "GET",
      headers: Object.assign({
        "apikey": SB_KEY,
        "Authorization": "Bearer " + SB_KEY,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      }, opts.headers || {}),
      body: opts.body
    });
    const text = await res.text();
    let data = null;
    try{ data = text ? JSON.parse(text) : null; }catch(e){ data = text; }
    if(!res.ok){
      const msg = (data && (data.message || data.error || data.hint)) || text || ("HTTP " + res.status);
      throw new Error(msg);
    }
    return Array.isArray(data) ? data : (data ? [data] : []);
  }

  function eq(v){ return "eq." + encodeURIComponent(String(v || "")); }

  function normalizeEstado(v){
    const s = String(v || "aprobado").toLowerCase();
    if(["aprobado","approved","activo","active"].includes(s)) return "approved";
    if(["pendiente","pending","solicitado","solicitada"].includes(s)) return "pending";
    if(["eliminado","deleted","rechazado","rejected"].includes(s)) return "deleted";
    return s || "approved";
  }

  function memberToEnrollment(m){
    const st = normalizeEstado(m.estado);
    return {
      enrollmentId: m.id,
      id: m.id,
      remoteId: m.id,
      usuarioId: m.usuario_id || "",
      cursoId: m.curso_id || "",
      role: String(m.rol || "apoderado").toLowerCase(),
      status: st,
      apoderadoName: m.nombre_apoderado || m.usuarios?.nombre || m.email || "Apoderado",
      alumno: m.nombre_alumno || "",
      email: m.email || m.usuarios?.email || "",
      createdAt: m.created_at || "",
      reviewedAt: m.reviewed_at || "",
      reviewNote: m.review_note || "",
      activation: { status: m.activacion_pagada ? "paid" : "pending" },
      directivaRole: String(m.rol || "").toLowerCase() === "tesorero" ? "tesorero" : null
    };
  }

  function courseParts(curso){
    const colegio = curso?.colegios || {};
    const school = colegio.nombre || curso?.nombre || "Colegio";
    const level = String(curso?.nivel || "").trim();
    const letter = String(curso?.letra || "").trim();
    const course = `${level}${letter}`.trim() || "Curso";
    const year = curso?.anio || "";
    const jornada = curso?.jornada || "";
    return { school, course, year, jornada };
  }

  function courseLabel(curso){
    const p = courseParts(curso);
    return [p.school, p.course, p.year, p.jornada].filter(Boolean).join(" · ");
  }

  function totalAlumnos(){
    const curso = STATE.curso || {};
    const raw = curso.total_alumnos_onboarding ?? curso.total_alumnos ?? curso.alumnos_onboarding ?? curso.alumnos_estimados ?? curso.cantidad_alumnos ?? curso.target_parents;
    const n = Number(raw || 0);
    const activeMembers = (STATE.miembros || []).filter(e => e.role === "apoderado" && e.status !== "deleted").length;
    return Math.max(n, activeMembers, 0);
  }

  function headerUserLine(){
    const who = $("whoLine");
    if(!who) return;
    const p = courseParts(STATE.curso || {});
    const name = currentUserName();
    const school = String(p.school || "Colegio").replace(/\s*\((Demo|demo)\)\s*/g, "").trim();
    const course = String(p.course || "Curso").replace(/\s+/g, "").trim();
    const logo = document.querySelector("header .brand .logo");
    if(logo) logo.textContent = String(name || "P").trim().charAt(0).toUpperCase() || "P";
    who.innerHTML = `
      <div>
        <div class="presBrandName">${esc(name)}</div>
        <div class="muted presBrandRole">Presidente</div>
        <div class="muted presBrandCourse">${esc(school)} · ${esc(course)}</div>
      </div>
    `;
  }

  function emptyCard(title, text){
    return `<div class="apo-empty">
      <div class="apo-empty-title">${esc(title)}</div>
      <div class="apo-empty-text">${esc(text)}</div>
    </div>`;
  }

  async function loadData(){
    STATE.loading = true;
    STATE.error = null;
    STATE.session = loadSession();

    const role = roleOf();
    if(!STATE.session || !isDirectiva(role)){
      STATE.loading = false;
      return;
    }

    const ck = activeCourseKey();
    if(!ck){
      STATE.loading = false;
      return;
    }

    try{
      const cursos = await sb(`cursos?select=*,colegios(*)&course_key=${eq(ck)}&limit=1`);
      const curso = cursos[0] || null;
      if(!curso) throw new Error("No se encontró el curso activo en Supabase: " + ck);

      const miembros = await sb(
        `miembros_curso?select=*,usuarios(*)&curso_id=${eq(curso.id)}&order=created_at.asc`
      );

      STATE.curso = curso;
      STATE.miembros = miembros.map(memberToEnrollment);
      STATE.loading = false;
    }catch(e){
      STATE.error = e && e.message ? e.message : String(e);
      STATE.loading = false;
    }
  }

  function buildWhatsappInvite(curso){
    const p = courseParts(curso);
    const code = curso?.invite_code || "";
    const cursoTxt = [p.school, p.course].filter(Boolean).join(" · ");
    return (
      "Hola. Te invito a unirte al curso " + cursoTxt + " en Cursapp.\n" +
      "Ingresa a https://cursapp.cl y utiliza este código de invitación:\n\n" +
      "*" + code + "*\n\n" +
      "Una vez registrado podrás revisar campañas, pagos, informes\n" +
      "y avisos del curso."
    );
  }

  async function copyText(text, label){
    try{
      if(navigator.clipboard?.writeText){
        await navigator.clipboard.writeText(text);
        alert((label || "Contenido") + " copiado.");
        return;
      }
    }catch(e){}
    alert("Copia manualmente:\n\n" + text);
  }

  async function approve(id){
    try{
      await sb(`miembros_curso?id=${eq(id)}`, {
        method:"PATCH",
        body: JSON.stringify({ estado:"aprobado" })
      });
      await loadData();
      render();
    }catch(e){
      alert("No se pudo aprobar: " + (e.message || e));
    }
  }

  async function del(id){
    try{
      await sb(`miembros_curso?id=${eq(id)}`, {
        method:"PATCH",
        body: JSON.stringify({ estado:"eliminado" })
      });
      await loadData();
      render();
    }catch(e){
      alert("No se pudo eliminar: " + (e.message || e));
    }
  }

  function tesoreroActuales(){
    return (STATE.miembros || []).filter(e =>
      String(e.role || e.rol || "").toLowerCase() === "tesorero" &&
      String(e.status || e.estado || "").toLowerCase() !== "deleted" &&
      String(e.status || e.estado || "").toLowerCase() !== "eliminado"
    );
  }

  function msgTesoreroExiste(){
    const t = tesoreroActuales()[0];
    const nombre = t ? (t.apoderadoName || t.nombre_apoderado || t.email || "tesorero vigente") : "tesorero vigente";
    alert(
      "Ya existe un tesorero asignado en este curso: " + nombre + ".\n\n" +
      "Para cambiarlo, primero presiona \"Eliminar tesorero\" en el tesorero vigente."
    );
  }

  async function removeTesorero(id){
    const src = (STATE.miembros || []).find(e => String(e.enrollmentId) === String(id) || String(e.id) === String(id));
    if(!src){ alert("No pude identificar al tesorero seleccionado."); return; }

    const email = String(src.email || "").toLowerCase().trim();
    if(!email){ alert("El tesorero seleccionado no tiene correo válido."); return; }

    const nombre = src.apoderadoName || src.nombre_apoderado || src.email || "este apoderado";
    const ok = confirm(
      "¿Eliminar rol tesorero de " + nombre + "?\n\n" +
      "Mantendrá su rol de apoderado."
    );
    if(!ok) return;

    try{
      const targets = (STATE.miembros || []).filter(e =>
        String(e.email || "").toLowerCase().trim() === email &&
        String(e.role || e.rol || "").toLowerCase() === "tesorero" &&
        String(e.status || e.estado || "").toLowerCase() !== "deleted" &&
        String(e.status || e.estado || "").toLowerCase() !== "eliminado"
      );

      if(!targets.length){ alert("Este apoderado no tiene rol tesorero vigente."); return; }

      const errors = [];
      for(const t of targets){
        const rowId = t.id || t.enrollmentId;
        if(!rowId){ errors.push("registro sin id"); continue; }
        try{
          await sb(`miembros_curso?id=${eq(rowId)}`, { method:"DELETE" });
        }catch(e){
          errors.push(e.message || String(e));
        }
      }

      if(errors.length){
        alert("No se pudo eliminar tesorero. Revisa RLS/DELETE en Supabase: " + errors.join(" | "));
        return;
      }

      await loadData();
      render();
      alert("Rol tesorero eliminado.");
    }catch(e){
      alert("No se pudo eliminar tesorero: " + (e.message || e));
    }
  }

  async function setTesorero(id){
    const src = (STATE.miembros || []).find(e => String(e.enrollmentId) === String(id) || String(e.id) === String(id));
    if(!src){ alert("No pude identificar al miembro seleccionado."); return; }
    const email = String(src.email || "").toLowerCase().trim();
    if(!email){ alert("El miembro seleccionado no tiene correo válido."); return; }

    try{
      const currentTreasurers = tesoreroActuales();
      const same = currentTreasurers.find(e => String(e.email || "").toLowerCase().trim() === email);

      if(same){
        alert("Este apoderado ya es el tesorero vigente del curso.");
        return;
      }

      if(currentTreasurers.length){
        msgTesoreroExiste();
        return;
      }

      const nombre = src.apoderadoName || src.email || "este apoderado";
      const ok = confirm(
        "¿Asignar como tesorero a " + nombre + "?\n\n" +
        "Mantendrá su rol de apoderado y además tendrá acceso de tesorero."
      );
      if(!ok) return;

      await sb("miembros_curso", {
        method:"POST",
        body: JSON.stringify({
          curso_id: STATE.curso.id,
          usuario_id: src.usuarioId || null,
          rol: "tesorero",
          nombre_apoderado: src.apoderadoName || null,
          nombre_alumno: src.alumno || null,
          email: src.email || email,
          estado: "aprobado",
          activacion_pagada: true
        })
      });

      await loadData();
      render();
      alert("Tesorero asignado correctamente.");
    }catch(e){
      alert("No se pudo asignar tesorero: " + (e.message || e));
    }
  }

  function injectStyles(){
    if($("apoderadosV12Styles")) return;
    const style = document.createElement("style");
    style.id = "apoderadosV12Styles";
    style.textContent = `
      body{background:#f8fafc!important;}
      #menuDropdown.apo-menu-panel{position:fixed!important;top:calc(84px + env(safe-area-inset-top,0px))!important;right:18px!important;width:min(360px,calc(100vw - 32px))!important;max-height:calc(100dvh - 112px)!important;overflow:auto!important;background:#fff!important;border:1px solid rgba(226,232,240,.95)!important;border-radius:26px!important;box-shadow:0 28px 80px rgba(15,23,42,.22)!important;z-index:4000!important;padding:18px!important;}
      .apo-menu-head{display:grid;grid-template-columns:58px 1fr 38px;gap:12px;align-items:center;padding-bottom:14px;border-bottom:1px solid rgba(226,232,240,.85);}
      .apo-menu-avatar{width:58px;height:58px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#4c1d95);color:#fff;display:grid;place-items:center;font-size:24px;font-weight:900;}
      .apo-menu-name{font-size:18px;font-weight:900;color:#0f172a;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .apo-menu-role{font-size:13px;color:#6d28d9;font-weight:900;margin-top:3px}.apo-menu-course{font-size:13px;color:#64748b;font-weight:750;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .apo-menu-close{width:36px;height:36px;border:0;border-radius:50%;background:#f1f5f9;color:#111827;font-size:20px;font-weight:900;cursor:pointer;}
      .apo-menu-list{padding:12px 0;display:grid;gap:4px}.apo-menu-item{height:48px;border:0;background:#fff;border-radius:14px;display:grid;grid-template-columns:28px 1fr;gap:12px;align-items:center;text-align:left;color:#111827;font-weight:900;font-size:15px;cursor:pointer;padding:0 10px}.apo-menu-item:hover{background:#f8fafc}.apo-menu-item svg{width:23px;height:23px;color:#6d28d9}.apo-menu-item.danger{color:#dc2626}.apo-menu-item.danger svg{color:#dc2626}.apo-menu-sep{height:1px;background:rgba(226,232,240,.95);margin:8px 0}
      .container#app{max-width:980px;margin:0 auto;padding:24px 20px 140px!important;}
      .bottomNav .navItem::before{content:none!important;display:none!important;}
      .presBrandCourse{font-weight:800;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:46vw;}
      .apo-page{display:flex;flex-direction:column;gap:22px}
      .apo-title-row{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:end}
      .apo-eyebrow{font-size:14px;font-weight:850;color:#6d28d9;margin-bottom:6px}
      .apo-title{margin:0;font-size:clamp(30px,5vw,40px);line-height:1.02;letter-spacing:-.035em;font-weight:900;color:#0f172a}
      .apo-subtitle{margin-top:10px;color:#64748b;font-weight:650;line-height:1.45;max-width:460px}
      .apo-primary{height:48px;border:0;border-radius:17px;padding:0 18px;background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;font-size:15px;font-weight:900;display:inline-flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 16px 34px rgba(91,33,182,.22);cursor:pointer}
      .apo-primary svg{width:20px;height:20px}
      .apo-card{background:#fff;border:1px solid rgba(226,232,240,.95);border-radius:24px;box-shadow:0 12px 34px rgba(15,23,42,.06)}
      .apo-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
      .apo-kpi{padding:18px;min-height:150px;display:flex;flex-direction:column;justify-content:space-between}
      .apo-kpi-icon{width:48px;height:48px;border-radius:18px;display:grid;place-items:center;color:#6d28d9;background:#f1eafe}
      .apo-kpi-icon svg{width:25px;height:25px}
      .apo-kpi-icon.ok{color:#16a34a;background:#dcfce7}.apo-kpi-icon.warn{color:#f97316;background:#ffedd5}.apo-kpi-icon.gray{color:#475569;background:#f1f5f9}
      .apo-kpi-label{font-size:13px;color:#0f172a;font-weight:850;line-height:1.25;margin-top:14px}
      .apo-kpi-value{font-size:28px;line-height:1;font-weight:900;letter-spacing:-.03em;margin-top:14px}
      .apo-kpi-note{font-size:12px;color:#64748b;font-weight:750;margin-top:8px}
      .apo-kpi-edit{border:0;background:transparent;color:#6d28d9;font-weight:850;font-size:12px;display:inline-flex;align-items:center;gap:5px;padding:0;margin-top:8px;cursor:pointer}
      .apo-kpi-edit svg{width:13px;height:13px}
      .apo-progress-card{padding:22px;display:grid;grid-template-columns:minmax(0,1fr) 220px;gap:20px;align-items:center}
      .apo-section-title{font-size:20px;font-weight:900;color:#0f172a;line-height:1.1;margin:0}
      .apo-section-help{font-size:14px;color:#64748b;font-weight:650;margin-top:7px;line-height:1.35}
      .apo-donut-row{display:grid;grid-template-columns:180px minmax(0,1fr);gap:20px;align-items:center;margin-top:18px}
      .apo-donut{width:168px;height:168px;border-radius:50%;background:conic-gradient(#6d28d9 var(--pct),#e5e7eb 0);display:grid;place-items:center}
      .apo-donut-inner{width:116px;height:116px;border-radius:50%;background:#fff;display:grid;place-items:center;text-align:center}
      .apo-donut-inner b{font-size:28px;line-height:1;font-weight:900}.apo-donut-inner span{font-size:12px;color:#64748b;font-weight:800}
      .apo-legend{display:flex;flex-direction:column;gap:12px}.apo-legend-row{display:grid;grid-template-columns:10px 1fr auto;gap:10px;align-items:center;font-weight:800;color:#475569}.apo-dot{width:10px;height:10px;border-radius:50%;background:#6d28d9}.apo-dot.gray{background:#cbd5e1}
      .apo-total-card{padding:18px;border-radius:20px;background:linear-gradient(135deg,rgba(124,58,237,.08),rgba(37,99,235,.05));border:1px solid rgba(124,58,237,.12)}
      .apo-total-card b{display:block;font-size:28px;font-weight:900;margin:8px 0 6px}
      .apo-total-card p{color:#64748b;font-size:13px;font-weight:650;line-height:1.45;margin-bottom:14px}
      .apo-small-btn{height:38px;border-radius:13px;border:1px solid rgba(124,58,237,.25);background:#fff;color:#6d28d9;font-size:13px;font-weight:900;padding:0 12px;display:inline-flex;align-items:center;gap:8px;cursor:pointer}
      .apo-tools{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center}
      .apo-search{height:48px;border:1px solid rgba(226,232,240,.95);border-radius:17px;background:#fff;display:grid;grid-template-columns:22px 1fr;gap:10px;align-items:center;padding:0 14px;color:#64748b;box-shadow:0 10px 28px rgba(15,23,42,.04)}
      .apo-search svg{width:20px;height:20px}.apo-search input{border:0!important;box-shadow:none!important;padding:0!important;height:auto!important;font-weight:750;color:#0f172a;background:transparent}
      .apo-filter-btn{height:48px;border-radius:17px;border:1px solid rgba(226,232,240,.95);background:#fff;padding:0 15px;font-weight:900;color:#0f172a;display:flex;align-items:center;gap:9px;cursor:pointer;box-shadow:0 10px 28px rgba(15,23,42,.04)}
      .apo-filter-btn svg{width:18px;height:18px}.apo-filter-badge{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;background:#6d28d9;color:#fff;font-size:11px}
      .apo-table-card{overflow:hidden}
      .apo-table{width:100%;border-collapse:collapse}
      .apo-table th{font-size:12px;color:#64748b;font-weight:850;text-align:left;padding:16px 14px;border-bottom:1px solid rgba(226,232,240,.75)}
      .apo-table td{padding:14px;border-bottom:1px solid rgba(226,232,240,.75);vertical-align:middle;font-size:13px;font-weight:750;color:#334155}
      .apo-avatar{width:44px;height:44px;border-radius:50%;background:#ede9fe;color:#6d28d9;display:grid;place-items:center;font-weight:900;flex:0 0 auto}
      .apo-person{display:flex;gap:12px;align-items:center;min-width:0}.apo-person b{display:block;font-size:14px;color:#0f172a;font-weight:900}.apo-person span{display:block;color:#64748b;font-size:12px;margin-top:2px;font-weight:750}
      .apo-status{display:inline-flex;align-items:center;justify-content:center;height:26px;border-radius:999px;padding:0 10px;font-size:12px;font-weight:900}.apo-status.approved{background:#dcfce7;color:#166534}.apo-status.pending{background:#ffedd5;color:#c2410c}.apo-status.deleted{background:#f1f5f9;color:#475569}
      .apo-row-actions{display:flex;gap:8px;justify-content:flex-end;align-items:center;flex-wrap:wrap}.apo-action{height:34px;border:1px solid rgba(226,232,240,.95);background:#fff;border-radius:12px;padding:0 10px;color:#0f172a;font-size:12px;font-weight:900;cursor:pointer}.apo-action.primary{background:#6d28d9;border-color:#6d28d9;color:#fff}.apo-action.danger{color:#b91c1c}
      .apo-pagination{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px;color:#64748b;font-weight:750;font-size:13px}.apo-pages{display:flex;gap:7px;align-items:center}.apo-page-btn{width:34px;height:34px;border-radius:10px;border:1px solid rgba(226,232,240,.95);background:#fff;color:#0f172a;font-weight:900;cursor:pointer}.apo-page-btn.active{background:#6d28d9;color:#fff;border-color:#6d28d9}
      #modalRoot:not(:empty){position:fixed;inset:0;z-index:5000;display:grid;place-items:center;padding:16px;background:rgba(15,23,42,.45);backdrop-filter:blur(8px)}
      .apo-modal{width:min(520px,calc(100vw - 28px));max-height:calc(100dvh - 40px);overflow:auto;background:#fff;border:1px solid rgba(226,232,240,.9);border-radius:28px;box-shadow:0 28px 80px rgba(15,23,42,.22);padding:20px}
      .apo-modal-head{display:grid;grid-template-columns:54px 1fr 44px;gap:14px;align-items:start}.apo-modal-icon{width:50px;height:50px;border-radius:18px;background:#f1eafe;color:#6d28d9;display:grid;place-items:center}.apo-modal-icon svg{width:26px;height:26px}.apo-modal h2{margin:0;font-size:22px;line-height:1.1;font-weight:900;color:#0f172a}.apo-modal p{color:#64748b;font-size:13px;line-height:1.35;font-weight:650;margin-top:6px}.apo-close{width:42px;height:42px;border:0;border-radius:15px;background:#f8fafc;color:#0f172a;display:grid;place-items:center;cursor:pointer}.apo-close svg{width:22px;height:22px}
      .apo-invite-card{border:1px solid rgba(226,232,240,.95);border-radius:20px;padding:16px;margin-top:14px;background:#fff}.apo-invite-card.soft{background:linear-gradient(135deg,rgba(124,58,237,.08),rgba(37,99,235,.05));border-color:rgba(124,58,237,.14)}.apo-invite-title{display:flex;gap:10px;align-items:center;font-weight:900;color:#0f172a}.apo-invite-title svg{width:22px;height:22px;color:#6d28d9}.apo-code-display{margin:14px auto 12px;max-width:310px;border:1.5px dashed rgba(109,40,217,.35);background:#faf5ff;border-radius:14px;padding:12px;text-align:center;font-size:28px;font-weight:900;color:#6d28d9;letter-spacing:12px}.apo-modal-btn{height:44px;border-radius:15px;border:1px solid rgba(124,58,237,.25);background:#fff;color:#6d28d9;font-weight:900;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 16px;cursor:pointer}.apo-modal-btn svg{width:18px;height:18px}.apo-modal-btn.whatsapp{width:100%;background:#16a34a;border-color:#16a34a;color:#fff}.apo-modal-btn.full{width:100%}
      .apo-history{display:flex;flex-direction:column;gap:9px;margin-top:10px}.apo-history-row{display:grid;grid-template-columns:22px 1fr auto;gap:10px;align-items:center;font-size:12px;font-weight:800;color:#334155}.apo-history-row svg{width:20px;height:20px;color:#16a34a}
      .apo-modal-footer{height:44px;border-radius:14px;border:1px solid rgba(226,232,240,.95);background:#fff;width:100%;font-weight:900;margin-top:14px;cursor:pointer}
      .apo-empty{background:#fff;border:1px solid rgba(226,232,240,.95);border-radius:24px;padding:20px;box-shadow:0 12px 34px rgba(15,23,42,.06)}.apo-empty-title{font-size:20px;font-weight:900}.apo-empty-text{margin-top:8px;color:#64748b;font-weight:750;line-height:1.45}
      @media (max-width:760px){
        .container#app{padding:20px 14px 132px!important}.apo-title-row{grid-template-columns:1fr}.apo-primary{width:100%}.apo-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.apo-kpi{padding:15px;min-height:132px}.apo-progress-card{grid-template-columns:1fr;padding:18px}.apo-donut-row{grid-template-columns:1fr;justify-items:center}.apo-total-card{width:100%}.apo-tools{grid-template-columns:1fr}.apo-table{display:block}.apo-table thead{display:none}.apo-table tbody{display:block}.apo-table tr{display:block;padding:12px;border-bottom:1px solid rgba(226,232,240,.75)}.apo-table td{display:block;border:0;padding:5px 2px}.apo-table td[data-label]::before{content:attr(data-label);display:block;color:#94a3b8;font-size:11px;font-weight:850;margin-bottom:3px}.apo-row-actions{justify-content:flex-start}.apo-pagination{flex-direction:column;align-items:flex-start}.apo-code-display{letter-spacing:8px;font-size:25px}.presBrandCourse{max-width:38vw;}
      }
    `;
    document.head.appendChild(style);
  }

  function calcLists(){
    const tesoreros = (STATE.miembros || []).filter(e => e.role === "tesorero" && e.status !== "deleted");
    const tesEmails = new Set(tesoreros.map(e => String(e.email || "").toLowerCase().trim()).filter(Boolean));
    const list = (STATE.miembros || []).filter(e => e.role === "apoderado");
    return { tesoreros, tesEmails, list };
  }

  function statusLabel(status){
    if(status === "approved") return "Aprobado";
    if(status === "deleted") return "Eliminado";
    return "Pendiente";
  }

  function initials(name){
    return String(name || "A").trim().split(/\s+/).slice(0,2).map(x => x[0] || "").join("").toUpperCase() || "A";
  }

  function filteredRows(list){
    const q = STATE.query.trim().toLowerCase();
    return list.filter(e => {
      const statusOk = STATE.status === "all" || e.status === STATE.status;
      const hay = [e.apoderadoName, e.alumno, e.email].join(" ").toLowerCase();
      return statusOk && (!q || hay.includes(q));
    });
  }

  function stats(list){
    const registered = list.filter(e => e.status === "approved").length;
    const pending = list.filter(e => e.status === "pending").length;
    const deleted = list.filter(e => e.status === "deleted").length;
    const total = totalAlumnos();
    const pct = total ? Math.round((registered / total) * 100) : 0;
    const pendingPct = total ? Math.round((pending / total) * 100) : 0;
    return { registered, pending, deleted, total, pct, pendingPct };
  }

  function kpi(iconName, label, value, note, tone, extra){
    return `<article class="apo-card apo-kpi">
      <div>
        <div class="apo-kpi-icon ${tone || ""}">${icon(iconName)}</div>
        <div class="apo-kpi-label">${esc(label)}</div>
      </div>
      <div>
        <div class="apo-kpi-value">${esc(value)}</div>
        ${note ? `<div class="apo-kpi-note">${esc(note)}</div>` : ""}
        ${extra || ""}
      </div>
    </article>`;
  }

  function editTotalInfo(){
    alert("El total de alumnos viene del onboarding del curso. La edición persistente debe habilitarse con el campo aprobado en Supabase.");
  }

  function statusFilterButton(id, label, count){
    const active = STATE.status === id ? "active" : "";
    return `<button class="apo-page-btn ${active}" type="button" style="width:auto;padding:0 12px;" onclick="window.__filterApoderados('${id}')">${esc(label)} ${count}</button>`;
  }

  function rowTemplate(e, ctx){
    const isTreasurer = ctx.tesEmails.has(String(e.email || "").toLowerCase().trim());
    const hasTreasurer = ctx.tesEmails.size > 0;
    const role = roleOf();
    const assignTesBtn = (role === "presidente" && e.status === "approved")
      ? (isTreasurer
        ? `<button class="apo-action" type="button" onclick="window.removeTesorero('${esc(e.enrollmentId)}')">Eliminar tesorero</button>`
        : (hasTreasurer
          ? `<button class="apo-action" type="button" onclick="window.__tesoreroExisteMsg()">Ya existe tesorero</button>`
          : `<button class="apo-action" type="button" onclick="window.setTesorero('${esc(e.enrollmentId)}')">Asignar tesorero</button>`))
      : "";

    const requestActions = e.status === "pending"
      ? `<button class="apo-action primary" type="button" onclick="window.__approve('${esc(e.enrollmentId)}')">Aceptar</button>
         <button class="apo-action danger" type="button" onclick="window.__delete('${esc(e.enrollmentId)}')">Eliminar</button>`
      : `<button class="apo-action" type="button" aria-label="Más acciones">${icon("ellipsis")}</button>`;

    return `<tr>
      <td data-label="Apoderado / Alumno">
        <div class="apo-person">
          <div class="apo-avatar">${esc(initials(e.apoderadoName))}</div>
          <div>
            <b>${esc(e.apoderadoName || "Apoderado")}</b>
            <span>${esc(e.alumno || "Alumno registrado")}</span>
          </div>
        </div>
      </td>
      <td data-label="Email">${esc(e.email || "Sin correo")}</td>
      <td data-label="Estado"><span class="apo-status ${esc(e.status)}">${esc(statusLabel(e.status))}</span></td>
      <td data-label="Fecha registro">${esc(fmtDate(e.createdAt) || "—")}</td>
      <td data-label="Acciones">
        <div class="apo-row-actions">${requestActions}${assignTesBtn}</div>
      </td>
    </tr>`;
  }

  function openInviteModal(){
    const root = $("modalRoot");
    if(!root) return;
    const curso = STATE.curso || {};
    const invite = curso.invite_code || "";
    const spacedCode = invite ? invite.split("").join(" ") : "SIN CODIGO";
    const message = buildWhatsappInvite(curso);
    const latest = (STATE.miembros || []).filter(e => e.role === "apoderado").slice(0,2);
    const shareCount = Number(curso.invite_count || 0);

    root.innerHTML = `<section class="apo-modal" role="dialog" aria-modal="true" aria-labelledby="inviteTitle">
      <div class="apo-modal-head">
        <div class="apo-modal-icon">${icon("userPlus")}</div>
        <div>
          <h2 id="inviteTitle">Invitar apoderado</h2>
          <p>Comparte el acceso al curso mediante el código de invitación o envía un mensaje listo por WhatsApp.</p>
        </div>
        <button class="apo-close" type="button" onclick="window.__closeInviteModal()" aria-label="Cerrar">${icon("close")}</button>
      </div>

      <div class="apo-invite-card">
        <div class="apo-invite-title">${icon("copy")}<span>Código del curso</span></div>
        <p>Este código permite unirse al curso en Cursapp.cl</p>
        <div class="apo-code-display">${esc(spacedCode)}</div>
        <button class="apo-modal-btn" type="button" onclick="window.__copyInviteCode()">${icon("copy")} Copiar código</button>
      </div>

      <div class="apo-invite-card">
        <div class="apo-invite-title" style="color:#16a34a">${icon("whatsapp")}<span>Enviar invitación por WhatsApp</span></div>
        <p>Se abrirá WhatsApp con un mensaje listo para enviar.</p>
        <button class="apo-modal-btn whatsapp" type="button" onclick="window.__openInviteWhatsapp()">${icon("whatsapp")} Invitar por WhatsApp</button>
      </div>

      <div class="apo-invite-card">
        <div style="display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;">
          <div>
            <div class="apo-invite-title">${icon("file")}<span>Copiar invitación completa</span></div>
            <p>Copia el mensaje completo para pegarlo en correo, SMS, Telegram o donde prefieras.</p>
          </div>
          <button class="apo-modal-btn" type="button" onclick="window.__copyWhatsappInvite()">${icon("copy")} Copiar</button>
        </div>
      </div>

      <div class="apo-invite-card soft">
        <div class="apo-invite-title">${icon("shield")}<span>Importante</span></div>
        <p>El apoderado debe ingresar este código durante su registro en Cursapp.cl para quedar asociado automáticamente a este curso.</p>
      </div>

      <div class="apo-invite-card">
        <div class="apo-invite-title">${icon("check")}<span>Últimas invitaciones</span></div>
        <div class="apo-history">
          ${latest.map(e => `<div class="apo-history-row">${icon("check")}<span>${esc(e.apoderadoName || e.email)}</span><span class="apo-status ${esc(e.status)}">${esc(statusLabel(e.status))}</span></div>`).join("") || `<div class="apo-history-row">${icon("ellipsis")}<span>Código compartido</span><span class="apo-status pending">${shareCount || 0} veces</span></div>`}
        </div>
      </div>

      <button class="apo-modal-footer" type="button" onclick="window.__closeInviteModal()">Cerrar</button>
    </section>`;

    window.__copyInviteCode = () => copyText(invite, "Código");
    window.__copyWhatsappInvite = () => copyText(message, "Invitación");
    window.__openInviteWhatsapp = () => window.open("https://wa.me/?text=" + encodeURIComponent(message), "_blank", "noopener");
    window.__closeInviteModal = () => { root.innerHTML = ""; };
  }

  function bindAfterRender(){
    const inviteBtn = $("apoInviteBtn");
    if(inviteBtn && !inviteBtn.__apoInviteBound){
      inviteBtn.__apoInviteBound = true;
      inviteBtn.addEventListener("click", openInviteModal);
    }

    const search = $("apoSearch");
    if(search){
      search.addEventListener("input", (ev) => {
        STATE.query = ev.target.value;
        STATE.page = 1;
        render();
        setTimeout(() => {
          const next = $("apoSearch");
          if(next){
            next.focus();
            const len = next.value.length;
            try{ next.setSelectionRange(len, len); }catch(e){}
          }
        }, 0);
      });
    }
  }

  function currentUserName(){
    const s = STATE.session || {};
    const meta = s.user_metadata || s.raw_user_meta_data || s.metadata || s.profile || s.user || {};
    const candidates = [
      meta.full_name, meta.name, meta.nombre,
      s.full_name, s.fullName, s.name, s.nombre,
      s.presidente_nombre, s.nombre_presidente,
      s.email
    ];
    for(const value of candidates){
      const text = String(value || "").trim();
      if(!text || text.includes("@")) continue;
      const low = text.toLowerCase();
      if(low === "usuario" || low === "presidente") continue;
      return text;
    }
    return "Presidente del curso";
  }

  function homeUrl(){
    const role = roleOf();
    if(role === "tesorero") return "/tesorero.html";
    return "/presidente.html";
  }

  function navTo(tab){
    const urls = {
      home: homeUrl(),
      campanas: "/presidente.html?tab=campanas",
      apoderados: "/apoderados.html",
      deudores: "/presidente.html?tab=deudores",
      informes: "/presidente.html?tab=informes"
    };
    location.assign(urls[tab] || homeUrl());
  }

  function bottomNavSvg(name){
    const paths = {
      home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
      campaign:'<path d="M4 14V9a2 2 0 0 1 2-2h2l9-3v15l-9-3H6a2 2 0 0 1-2-2Z"/><path d="M8 16v4"/><path d="M18 9h3"/><path d="M18 14h3"/>',
      debt:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/><path d="M7 17h10"/>',
      report:'<path d="M6 3h9l3 3v15H6V3Z"/><path d="M14 3v4h4"/><path d="M9 13h6"/><path d="M9 17h6"/>'
    };
    return `<svg class="caSvgIcon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.report}</svg>`;
  }

  function hydrateBottomNavIcons(){
    const icons = { home:"home", campanas:"campaign", deudores:"debt", informes:"report" };
    document.querySelectorAll(".bottomNav .navItem").forEach(btn => {
      const label = btn.querySelector("span")?.textContent || "";
      btn.setAttribute("data-ca-icon-ready", "1");
      btn.innerHTML = `${bottomNavSvg(icons[btn.dataset.tab] || "report")}<span>${esc(label)}</span>`;
    });
  }

  function setupShell(){
    hydrateBottomNavIcons();
    const menuBtn = $("menuBtn");
    const menu = $("menuDropdown");
    if(menuBtn && menu && !menuBtn.__presMenuBound){
      menuBtn.__presMenuBound = true;
      menuBtn.setAttribute("aria-expanded", "false");
      menuBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const visible = menu.style.display === "block";
        if(visible){
          window.__closeApoMenu();
          return;
        }
        renderMenu();
        menu.style.display = "block";
        menu.classList.add("presMenuPanel", "caMenuOpen");
        menuBtn.setAttribute("aria-expanded", "true");
      });
      document.addEventListener("click", (ev) => {
        if(!menu || menu.style.display !== "block") return;
        const target = ev.target;
        if(target && (menu.contains(target) || menuBtn.contains(target))) return;
        window.__closeApoMenu();
      }, true);
    }

    document.querySelectorAll(".bottomNav .navItem").forEach(btn => {
      if(btn.__apoNavBound) return;
      btn.__apoNavBound = true;
      btn.addEventListener("click", () => navTo(btn.dataset.tab));
    });
  }

  function renderMenu(){
    const menu = $("menuDropdown");
    if(!menu) return;
    menu.className = "presMenuPanel";
    menu.dataset.presidentMenuVersion = "36";
    menu.innerHTML = `
      <button class="menuItem" type="button" onclick="window.__apoNav('home')"><span class="presMenuGlyph">${icon("home")}</span><span>Inicio</span></button>
      <button class="menuItem" type="button" onclick="window.__apoNav('campanas')"><span class="presMenuGlyph">${icon("flag")}</span><span>Campañas</span></button>
      <button class="menuItem" type="button" onclick="window.__apoNav('deudores')"><span class="presMenuGlyph">${icon("clock")}</span><span>Deudores</span></button>
      <button class="menuItem" type="button" onclick="window.__apoNav('informes')"><span class="presMenuGlyph">${icon("file")}</span><span>Informes</span></button>
      <button class="menuItem" type="button" onclick="window.__apoNav('apoderados')"><span class="presMenuGlyph">${icon("users")}</span><span>Apoderados</span></button>
      <button class="menuItem" id="supportMenuItem" type="button" onclick="window.__apoSupport()"><span class="presMenuGlyph">${icon("message")}</span><span>Soporte / Mis tickets</span></button>
      <button class="menuItem presMenuLogoutV36" type="button" onclick="window.__apoLogout()"><span class="presMenuGlyph">${icon("logout")}</span><span>Cerrar sesión</span></button>
    `;
  }

  window.__closeApoMenu = function(){
    const menu = $("menuDropdown");
    if(menu){
      menu.style.display = "none";
      menu.classList.remove("presMenuPanel", "caMenuOpen");
    }
    $("menuBtn")?.setAttribute("aria-expanded", "false");
  };

  window.__apoNav = function(tab){
    window.__closeApoMenu();
    navTo(tab);
  };

  window.__apoLogout = async function(){
    let auth = {};
    try{ auth = JSON.parse(localStorage.getItem("cursapp_supabase_auth_session_v1") || "{}") || {}; }catch(_e){}
    if(auth.access_token){
      try{
        await Promise.race([
          fetch(SB_URL + "/auth/v1/logout", {
            method:"POST",
            keepalive:true,
            headers:{apikey:SB_KEY, Authorization:`Bearer ${auth.access_token}`}
          }),
          new Promise(resolve=>setTimeout(resolve, 900))
        ]);
      }catch(_e){}
    }
    [
      KEY_SESSION,"cursapp_demo_user","cursapp_active_profile_v1",
      "cursapp_active_role_v1","cursapp_active_enrollment_v1","cursapp_active_miembro_id_v1",
      "cursapp_supabase_auth_session_v1","cursapp_supabase_oauth_v1"
    ].forEach(key=>{ try{ localStorage.removeItem(key); }catch(_e){} });
    location.replace("/login.html");
  };

  window.__apoSupport = function(){
    window.__closeApoMenu();
    if(window.CURSAPP_SUPPORT && typeof window.CURSAPP_SUPPORT.openMyTickets === "function"){
      window.CURSAPP_SUPPORT.openMyTickets();
      return;
    }
    const btn = document.querySelector("[data-support-ticket],.supportFab,.cursapp-support-fab");
    if(btn) btn.click();
  };

  function render(){
    injectStyles();
    setupShell();
    const app = $("app");
    if(!app) return;

    headerUserLine();

    const role = roleOf();
    if(STATE.loading){
      app.innerHTML = emptyCard("Cargando apoderados", "Consultando Supabase...");
      return;
    }

    if(!STATE.session || !isDirectiva(role)){
      app.innerHTML = emptyCard("Acceso restringido", "Esta vista es solo para Presidente o Tesorero.");
      return;
    }

    if(STATE.error){
      app.innerHTML = emptyCard("Error Supabase", STATE.error);
      return;
    }

    const ck = activeCourseKey();
    if(!ck){
      app.innerHTML = emptyCard("No hay curso activo", "Vuelve a iniciar sesión seleccionando el curso y rol correspondiente.");
      return;
    }

    const curso = STATE.curso;
    const ctx = calcLists();
    const list = ctx.list;
    const s = stats(list);
    const p = courseParts(curso);
    const tes = ctx.tesoreros[0];
    const rows = filteredRows(list);
    const perPage = 5;
    const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
    STATE.page = Math.min(Math.max(1, STATE.page), totalPages);
    const start = (STATE.page - 1) * perPage;
    const pageRows = rows.slice(start, start + perPage);

    const kpis = `<section class="apo-kpis">
      ${kpi("users", "Total alumnos (onboarding)", s.total, "", "", `<button class="apo-kpi-edit" type="button" onclick="window.__editTotalInfo()">${icon("pencil")} Editar</button>`)}
      ${kpi("check", "Registrados", s.registered, `${s.pct}% del total`, "ok")}
      ${kpi("hourglass", "Pendientes", s.pending, `${s.pendingPct}% del total`, "warn")}
      ${kpi("userX", "Eliminados", s.deleted, "0% del total", "gray")}
    </section>`;

    const progress = `<section class="apo-card apo-progress-card">
      <div>
        <h2 class="apo-section-title">Registro del curso</h2>
        <div class="apo-section-help">Total alumnos vs registrados</div>
        <div class="apo-donut-row">
          <div class="apo-donut" style="--pct:${s.pct}%">
            <div class="apo-donut-inner"><div><b>${s.pct}%</b><br><span>Registrados</span></div></div>
          </div>
          <div class="apo-legend">
            <div class="apo-legend-row"><span class="apo-dot"></span><span>Registrados</span><b>${s.registered} (${s.pct}%)</b></div>
            <div class="apo-legend-row"><span class="apo-dot gray"></span><span>Pendientes</span><b>${s.pending} (${s.pendingPct}%)</b></div>
            <div class="apo-legend-row"><span class="apo-dot gray"></span><span>Total alumnos</span><b>${s.total}</b></div>
          </div>
        </div>
      </div>
      <aside class="apo-total-card">
        <div class="apo-invite-title">${icon("users")}<span>Total alumnos (onboarding)</span></div>
        <b>${s.total}</b>
        <p>Este valor se utiliza para calcular los porcentajes del registro.</p>
        <button class="apo-small-btn" type="button" onclick="window.__editTotalInfo()">Editar total</button>
      </aside>
    </section>`;

    const filterCount = STATE.status === "all" ? 0 : 1;
    const tools = `<section class="apo-tools">
      <label class="apo-search" for="apoSearch">${icon("search")}<input id="apoSearch" type="search" autocomplete="off" value="${esc(STATE.query)}" placeholder="Buscar por nombre, email o apoderado..."></label>
      <div class="apo-filter-btn" role="group" aria-label="Filtros">
        ${icon("filter")}
        <span>Filtros</span>
        <span class="apo-filter-badge">${filterCount}</span>
      </div>
    </section>`;

    const filterChips = `<div class="apo-pages" style="margin:0 0 14px;">
      ${statusFilterButton("all", "Todos", list.length)}
      ${statusFilterButton("approved", "Aprobados", s.registered)}
      ${statusFilterButton("pending", "Pendientes", s.pending)}
      ${statusFilterButton("deleted", "Eliminados", s.deleted)}
    </div>`;

    const table = `<section>
      ${filterChips}
      <div class="apo-card apo-table-card">
        <table class="apo-table">
          <thead><tr><th>Apoderado / Alumno</th><th>Email</th><th>Estado</th><th>Fecha registro</th><th style="text-align:right;">Acciones</th></tr></thead>
          <tbody>${pageRows.length ? pageRows.map(e => rowTemplate(e, ctx)).join("") : `<tr><td colspan="5">No hay apoderados para este filtro.</td></tr>`}</tbody>
        </table>
        <div class="apo-pagination">
          <span>Mostrando ${rows.length ? start + 1 : 0} a ${Math.min(start + perPage, rows.length)} de ${rows.length} apoderados</span>
          <div class="apo-pages">
            <button class="apo-page-btn" type="button" onclick="window.__pageApoderados(${STATE.page - 1})" ${STATE.page <= 1 ? "disabled" : ""}>‹</button>
            ${Array.from({length: totalPages}, (_,i) => `<button class="apo-page-btn ${STATE.page === i + 1 ? "active" : ""}" type="button" onclick="window.__pageApoderados(${i + 1})">${i + 1}</button>`).slice(0,5).join("")}
            <button class="apo-page-btn" type="button" onclick="window.__pageApoderados(${STATE.page + 1})" ${STATE.page >= totalPages ? "disabled" : ""}>›</button>
          </div>
        </div>
      </div>
    </section>`;

    app.innerHTML = `<main class="apo-page">
      <section class="apo-title-row">
        <div>
          <div class="apo-eyebrow">${esc(courseLabel(curso))}</div>
          <h1 class="apo-title">Apoderados</h1>
          <p class="apo-subtitle">Gestiona los apoderados del curso y su acceso a la información de Cursapp.</p>
          <p class="apo-subtitle" style="margin-top:6px;"><b>Tesorero:</b> ${esc(tes ? (tes.apoderadoName || tes.email) : "Sin asignar")}</p>
        </div>
        <button class="apo-primary" id="apoInviteBtn" type="button">${icon("userPlus")} Invitar apoderado</button>
      </section>
      ${kpis}
      ${progress}
      ${tools}
      ${table}
    </main>`;

    window.__approve = approve;
    window.__delete = del;
    window.setTesorero = setTesorero;
    window.removeTesorero = removeTesorero;
    window.__tesoreroExisteMsg = msgTesoreroExiste;
    window.__reloadApoderados = async () => { await loadData(); render(); };
    window.__filterApoderados = (status) => { STATE.status = status; STATE.page = 1; render(); };
    window.__pageApoderados = (page) => { STATE.page = page; render(); };
    window.__openInviteModal = openInviteModal;
    window.__editTotalInfo = editTotalInfo;
    bindAfterRender();
  }

  document.addEventListener("DOMContentLoaded", async ()=>{
    injectStyles();
    setupShell();
    render();
    await loadData();
    render();
  });
})();

/* __CURSAPP_APODERADOS_V12_UI_INVITE__ */
