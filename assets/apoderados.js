(function(){
  // Cursapp v11 · Gestión de apoderados Supabase-first
  // Fuente oficial: Supabase (cursos + miembros_curso). localStorage solo se usa para sesión.

  const SB_URL = "https://ngxistgymgdkoaiulfbq.supabase.co";
  const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5neGlzdGd5bWdka29haXVsZmJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2OTg1NDQsImV4cCI6MjA5NjI3NDU0NH0.1r-aLijYEWvUifKcLjlClnA8-oYw11lgThY0swg_xbg";
  const KEY_SESSION = "cursapp_session_v1";

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

  let STATE = {
    loading: true,
    error: null,
    session: null,
    curso: null,
    miembros: []
  };

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
    try{ return iso ? new Date(iso).toLocaleString("es-CL") : ""; }
    catch(e){ return iso || ""; }
  }

  async function sb(path, opts={}){
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

  function courseLabel(curso){
    if(!curso) return "Curso activo";
    const colegio = curso.colegios || {};
    const name = colegio.nombre || curso.nombre || "Colegio";
    const cursoTxt = `${curso.nivel || ""}${curso.letra || ""} ${curso.anio || ""}`.trim();
    const jornada = curso.jornada || "";
    return [name, cursoTxt, jornada].filter(Boolean).join(" · ") || (curso.course_key || curso.id || "Curso activo");
  }

  function headerUserLine(){
    const who = $("whoLine");
    if(!who) return;
    const s = STATE.session || {};
    const label = s.name || s.nombre || s.email || "Directiva";
    const role = roleOf() || "directiva";
    who.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:2px;line-height:1.1;">
        <div style="font-weight:950;font-size:14px;">${esc(label)} · ${esc(role.toUpperCase())}</div>
        <div class="muted" style="font-weight:700;font-size:11px;opacity:.9;">Gestión de apoderados</div>
      </div>
    `;
  }

  function emptyCard(title, text){
    return `<div class="card" style="margin-top:12px;">
      <div style="font-weight:950;font-size:18px;">${esc(title)}</div>
      <div class="muted" style="margin-top:8px;font-weight:800;line-height:1.45;">${esc(text)}</div>
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
    const colegio = curso?.colegios || {};
    const code = curso?.invite_code || "";
    const school = colegio.nombre || curso?.nombre || "Colegio";
    const courseTxt = `${curso?.nivel || ""}${curso?.letra || ""} ${curso?.anio || ""} · ${curso?.jornada || ""}`.trim();
    const url = location?.origin ? (location.origin + "/onboarding/dashboard.html") : "https://cursapp-onboarding.pages.dev/onboarding/dashboard.html";
    return (
      "👋 Hola apoderados/as\n\n" +
      "Ya está activo *Cursapp* para nuestro curso:\n\n" +
      "🏫 *" + school + "*\n" +
      "📘 *" + courseTxt + "*\n\n" +
      "Ingresa aquí:\n" + url + "\n\n" +
      "Código de invitación:\n👉 *" + code + "*\n\n" +
      "Tu registro será revisado por la directiva antes de activarse."
    );
  }

  async function copyText(text){
    try{
      if(navigator.clipboard?.writeText){
        await navigator.clipboard.writeText(text);
        alert("Copiado ✅");
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

  async function setTesorero(id){
    const btns = Array.from(document.querySelectorAll("button"));
    const clicked = btns.find(b => (b.getAttribute("onclick") || "").includes(String(id)) && (b.textContent || "").toLowerCase().includes("tesorero"));
    const oldText = clicked ? clicked.textContent : "Asignar como tesorero";
    try{
      const member = (STATE.miembros || []).find(x => String(x.enrollmentId || x.id || "") === String(id));
      if(!member) throw new Error("No se encontró el miembro seleccionado.");
      if(member.status !== "approved") throw new Error("Solo puedes asignar tesorero a miembros aprobados del curso.");

      const cursoId = member.cursoId || STATE.curso?.id || "";
      const email = String(member.email || "").toLowerCase().trim();
      if(!cursoId) throw new Error("No hay curso activo en Supabase.");
      if(!email) throw new Error("El miembro no tiene correo registrado.");

      if(clicked){
        clicked.disabled = true;
        clicked.textContent = "Asignando...";
        clicked.style.opacity = ".65";
      }

      const existing = await sb(`miembros_curso?curso_id=${eq(cursoId)}&email=${eq(email)}&rol=${eq("tesorero")}&select=id&limit=1`);
      if(existing && existing.length){
        if(clicked) clicked.textContent = "Tesorero asignado ✅";
        alert("Este apoderado ya tiene rol tesorero ✅");
        await loadData();
        render();
        return;
      }

      await sb("miembros_curso", {
        method:"POST",
        body: JSON.stringify({
          curso_id: cursoId,
          usuario_id: member.usuarioId || null,
          rol: "tesorero",
          nombre_apoderado: member.apoderadoName || null,
          nombre_alumno: member.alumno || null,
          email: email,
          estado: "aprobado",
          activacion_pagada: true
        })
      });

      try{ window.dispatchEvent(new CustomEvent("cursapp:dataChanged", { detail:{ key:"miembros_curso", source:"apoderados-set-tesorero" } })); }catch(_e){}
      alert("Tesorero asignado correctamente ✅

La persona mantiene su rol apoderado y además tendrá acceso como tesorero.");
      await loadData();
      render();
    }catch(e){
      if(clicked){
        clicked.disabled = false;
        clicked.textContent = oldText;
        clicked.style.opacity = "";
      }
      alert("No se pudo asignar tesorero: " + (e && e.message ? e.message : e));
    }
  }

  function render(){
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
    const invite = curso?.invite_code || "";

    // Gestión de apoderados solo muestra roles de apoderado.
    // El presidente que también es apoderado aparece una vez por su rol apoderado.
    const list = (STATE.miembros || []).filter(e => e.role === "apoderado" || e.role === "tesorero");
    const pend = list.filter(e => e.status === "pending");
    const appr = list.filter(e => e.status === "approved");
    const deld = list.filter(e => e.status === "deleted");

    const tes = (STATE.miembros || []).find(e => e.role === "tesorero");
    const tesLine = tes
      ? `<div class="muted" style="margin-top:6px;"><b>Tesorero:</b> ${esc(tes.apoderadoName || tes.email)}</div>`
      : `<div class="muted" style="margin-top:6px;"><b>Tesorero:</b> —</div>`;

    const head = `
      <div class="card">
        <div style="font-weight:950;font-size:18px;">Apoderados</div>
        <div class="muted" style="margin-top:6px;font-weight:800;">${esc(courseLabel(curso))}</div>
        ${tesLine}
        <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
          <span class="tag warn">Pendientes ${pend.length}</span>
          <span class="tag ok">Aprobados ${appr.length}</span>
          <span class="tag">Eliminados ${deld.length}</span>
        </div>
      </div>
    `;

    const codes = invite ? `
      <div class="card codeBox" style="margin-top:12px;">
        <div style="font-weight:950;">Código de invitación (Apoderados)</div>
        <div class="code" style="margin-top:10px;">${esc(invite)}</div>
        <button class="btn ghost" type="button" style="width:100%;margin-top:10px;" onclick="window.__copyInviteCode()">📋 Copiar código</button>
        <button class="btn primary" type="button" style="width:100%;margin-top:10px;" onclick="window.__copyWhatsappInvite()">📲 Copiar invitación WhatsApp</button>
      </div>
    ` : ``;

    function row(e){
      const pay = e.activation?.status === "paid" ? `<span class="tag ok">Pago OK</span>` : `<span class="tag warn">Pago pendiente</span>`;
      const st = e.status === "approved" ? `<span class="tag ok">Aprobado</span>` :
                 e.status === "deleted" ? `<span class="tag">Eliminado</span>` :
                 `<span class="tag warn">Pendiente</span>`;
      const actions = e.status === "pending"
        ? `<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
             <button class="btn primary" type="button" onclick="window.__approve('${esc(e.enrollmentId)}')">Aceptar</button>
             <button class="btn ghost" type="button" onclick="window.__delete('${esc(e.enrollmentId)}')">Eliminar</button>
           </div>`
        : `<div class="muted">—</div>`;
      const assignTesBtn = (role === "presidente" && e.status === "approved" && e.role !== "tesorero")
        ? `<button class="btn ghost" type="button" onclick="window.setTesorero('${esc(e.enrollmentId)}')">Asignar como tesorero</button>`
        : ``;

      return `
        <div style="padding:12px 0;border-top:1px solid rgba(229,231,235,.6);">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
            <div style="min-width:240px;">
              <div style="font-weight:950;">${esc(e.apoderadoName || "Apoderado")} · ${esc(e.alumno || "Alumno")}</div>
              <div class="muted" style="margin-top:6px;font-weight:800;">${esc(e.email || "")}</div>
              <div class="muted" style="margin-top:6px;">Registrado: ${esc(fmtDate(e.createdAt))}</div>
              <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">${st} ${pay}</div>
              ${assignTesBtn ? `<div style="margin-top:10px;">${assignTesBtn}</div>` : ``}
            </div>
            <div style="min-width:220px;text-align:right;">${actions}</div>
          </div>
        </div>
      `;
    }

    const cards = `
      <div class="card" style="margin-top:12px;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;">
          <div style="font-weight:950;">Solicitudes</div>
          <button class="btn ghost" type="button" onclick="window.__reloadApoderados()">Actualizar</button>
        </div>
        ${list.length ? list.map(row).join("") : `<div class="muted" style="margin-top:10px;">Aún no hay apoderados registrados.</div>`}
      </div>
    `;

    app.innerHTML = head + codes + cards;

    window.__approve = approve;
    window.__delete = del;
    window.setTesorero = setTesorero;
    window.__copyInviteCode = () => copyText(invite);
    window.__copyWhatsappInvite = () => copyText(buildWhatsappInvite(curso));
    window.__reloadApoderados = async () => { await loadData(); render(); };
  }

  document.addEventListener("DOMContentLoaded", async ()=>{
    render();
    await loadData();
    render();
  });
})();
