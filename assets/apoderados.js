(function(){
  const KEY_USER   = "cursapp_demo_user";
  const KEY_ENROLL = "cursapp_enrollments_v1";
  const KEY_ACTIVE = "cursapp_active_course_v1";
  const KEY_COURSE = "cursapp_course_v1";

  const $ = (id) => document.getElementById(id);

  function loadJSON(k, def){
    try{ const v = localStorage.getItem(k); if(v==null) return def; return JSON.parse(v); }
    catch(e){ return def; }
  }
  function saveJSON(k, v){ localStorage.setItem(k, JSON.stringify(v)); }

  function getUser(){ return loadJSON(KEY_USER, null); }
  function isDirectiva(role){ return role === "presidente" || role === "tesorero"; }
  function fmtDate(iso){ try{ return iso ? new Date(iso).toLocaleString("es-CL") : ""; }catch(e){ return iso||""; } }

  function activeCourseKey(){ return localStorage.getItem(KEY_ACTIVE) || ""; }
  function courseObj(){ return loadJSON(KEY_COURSE, null); }

  function loadEnrollments(){ return loadJSON(KEY_ENROLL, []); }
  function saveEnrollments(list){ saveJSON(KEY_ENROLL, list || []); }

  function upsertEnrollment(id, patch){
    const list = loadEnrollments();
    const idx = list.findIndex(e => e.enrollmentId === id);
    if(idx < 0) return false;
    list[idx] = { ...list[idx], ...patch };
    saveEnrollments(list);
    return true;
  }

  // ---------------- Aprobar / eliminar ----------------
  function approve(id, role){
    const ok = upsertEnrollment(id, {
      status:"approved",
      reviewedAt:new Date().toISOString(),
      reviewedBy: role||"directiva",
      reviewNote:""
    });
    if(!ok) alert("No encontrado");
    render();
  }

  function del(id, role){
    const note = prompt("Motivo (opcional):", "Registro incorrecto / curso equivocado") || "";
    const ok = upsertEnrollment(id, {
      status:"deleted",
      reviewedAt:new Date().toISOString(),
      reviewedBy: role||"directiva",
      reviewNote: note
    });
    if(!ok) alert("No encontrado");
    render();
  }

  // ---------------- Tesorero (asignación por presidente) ----------------
  function setTesorero(enrollmentId){
    const ck = activeCourseKey();
    if(!ck) return alert("No hay curso activo.");

    const course = courseObj();
    if(!course) return alert("No hay curso.");

    const list = loadEnrollments();
    const target = list.find(e => e.enrollmentId === enrollmentId);

    if(!target) return alert("No encontrado.");
    if(String(target.courseKey||"") !== ck) return alert("No pertenece al curso activo.");
    if(target.status !== "approved") return alert("Debe estar aprobado antes de asignar tesorero.");

    // desmarcar tesorero anterior
    list.forEach(e=>{
      if(e.courseKey === ck && e.directivaRole === "tesorero"){
        e.directivaRole = null;
      }
    });

    // marcar nuevo tesorero
    target.directivaRole = "tesorero";

    // guardar en curso
    course.directiva = course.directiva || {};
    course.directiva.tesorero = {
      enrollmentId: target.enrollmentId,
      name: target.apoderadoName || "",
      email: target.email || ""
    };

    saveEnrollments(list);
    saveJSON(KEY_COURSE, course);

    alert("Tesorero asignado ✅");
    render();
  }

  function clearTesorero(){
    const ck = activeCourseKey();
    if(!ck) return;

    const course = courseObj();
    if(!course) return;

    const list = loadEnrollments();
    list.forEach(e=>{
      if(e.courseKey === ck && e.directivaRole === "tesorero") e.directivaRole = null;
    });

    course.directiva = course.directiva || {};
    course.directiva.tesorero = null;

    saveEnrollments(list);
    saveJSON(KEY_COURSE, course);

    alert("Tesorero removido ✅");
    render();
  }

  // ---------------- WhatsApp invite ----------------
  function buildWhatsappInvite(courseObj){
    const c = courseObj?.course || {};
    const code = courseObj?.inviteCode || "";
    const label = `${(c.level||"")}${(c.letter||"")} ${c.year||""} · ${c.jornada||""}`.trim();
    const school = c.schoolName || "Colegio";

    // usa el dominio actual (Netlify u otro)
    const url = (location && location.origin)
      ? (location.origin + "/onboarding/dashboard.html")
      : "https://cursapp.netlify.app/onboarding/dashboard.html";

    return (
      "Hola! 👋\n\n" +
      "Ya está activo Cursapp para el curso:\n" +
      `${school} · ${label}\n\n` +
      "Para registrarte como apoderado:\n" +
      `${url}\n\n` +
      "Pega este código de invitación:\n" +
      `${code}\n\n` +
      "Luego la directiva aprueba tu ingreso ✅"
    );
  }

  async function copyText(text){
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){
        await navigator.clipboard.writeText(text);
        alert("Copiado ✅");
        return;
      }
    }catch(e){}
    // fallback
    alert("Copia manualmente:\n\n" + text);
  }

  // ---------------- UI helpers ----------------
  function headerUserLine(u){
    const who = $("whoLine");
    if(!who) return;
    who.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:2px;line-height:1.1;">
        <div style="font-weight:950;font-size:14px;">${u?.name || "Directiva"} · ${(u?.role||"").toUpperCase()}</div>
        <div class="muted" style="font-weight:700;font-size:11px;opacity:.9;">Gestión de apoderados</div>
      </div>
    `;
  }

  function emptyCard(title, text){
    return `<div class="card" style="margin-top:12px;">
      <div style="font-weight:950;font-size:18px;">${title}</div>
      <div class="muted" style="margin-top:8px;font-weight:800;line-height:1.45;">${text}</div>
    </div>`;
  }

  // ---------------- render ----------------
  function render(){
    const app = $("app");
    if(!app) return;

    const user = getUser();
    const role = String(user?.role||"").toLowerCase();

    if(!user || !isDirectiva(role)){
      app.innerHTML = emptyCard("Acceso restringido", "Esta vista es solo para Presidente o Tesorero.");
      return;
    }

    headerUserLine(user);

    const ck = activeCourseKey();
    if(!ck){
      app.innerHTML = emptyCard("No hay curso activo", "Crea el curso como Presidente para comenzar a recibir solicitudes.");
      return;
    }

    const c = courseObj();
    const invite = c?.inviteCode || "";
    const tes = c?.directiva?.tesorero || null;

    const listAll = loadEnrollments();
    const list = listAll.filter(e => String(e.courseKey||"") === ck);

    const pend = list.filter(e => e.status === "pending");
    const appr = list.filter(e => e.status === "approved");
    const deld = list.filter(e => e.status === "deleted");

    const courseLine = (c && c.course)
      ? `${c.course.schoolName} · ${c.course.level}${c.course.letter} ${c.course.year} · ${c.course.jornada}`
      : `Curso activo: ${ck}`;

    const tesLine = tes
      ? `<div class="muted" style="margin-top:6px;"><b>Tesorero:</b> ${tes.name || tes.email}</div>`
      : `<div class="muted" style="margin-top:6px;"><b>Tesorero:</b> —</div>`;

    const tesActions = (role === "presidente" && tes)
      ? `<button class="btn ghost" type="button" style="margin-top:10px;width:100%;" onclick="clearTesorero()">Remover tesorero</button>`
      : ``;

    const head = `
      <div class="card">
        <div style="font-weight:950;font-size:18px;">Apoderados</div>
        <div class="muted" style="margin-top:6px;font-weight:800;">${courseLine}</div>
        ${tesLine}
        ${tesActions}

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
        <div class="code" style="margin-top:10px;">${invite}</div>
        <div class="muted" style="margin-top:6px;">Para registro de apoderados.</div>

        <button class="btn ghost" type="button" style="width:100%;margin-top:10px;"
          onclick="window.__copyInviteCode()">
          📋 Copiar código
        </button>

        <button class="btn primary" type="button" style="width:100%;margin-top:10px;"
          onclick="window.__copyWhatsappInvite()">
          📲 Copiar invitación WhatsApp
        </button>
      </div>
    ` : ``;

    function row(e){
      const pay = e.activation?.status === "paid" ? `<span class="tag ok">Pago OK</span>` : `<span class="tag warn">Pago pendiente</span>`;
      const st = e.status === "approved" ? `<span class="tag ok">Aprobado</span>` :
                 e.status === "deleted" ? `<span class="tag">Eliminado</span>` :
                 `<span class="tag warn">Pendiente</span>`;

      const tesTag = (e.directivaRole === "tesorero") ? `<span class="tag ok">Tesorero</span>` : ``;

      const actionsPending = (e.status === "pending")
        ? `<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
             <button class="btn primary" type="button" onclick="window.__approve('${e.enrollmentId}')">Aceptar</button>
             <button class="btn ghost" type="button" onclick="window.__delete('${e.enrollmentId}')">Eliminar</button>
           </div>`
        : `<div class="muted">—</div>`;

      const assignTesBtn = (role === "presidente" && e.status === "approved" && e.directivaRole !== "tesorero")
        ? `<button class="btn ghost" type="button" onclick="setTesorero('${e.enrollmentId}')">Asignar como tesorero</button>`
        : ``;

      return `
        <div style="padding:12px 0;border-top:1px solid rgba(229,231,235,.6);">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
            <div style="min-width:240px;">
              <div style="font-weight:950;">${e.apoderadoName || "Apoderado"} · ${e.alumno || "Alumno"}</div>
              <div class="muted" style="margin-top:6px;font-weight:800;">${e.email || ""}</div>
              <div class="muted" style="margin-top:6px;">Registrado: ${fmtDate(e.createdAt)}</div>

              <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                ${st} ${pay} ${tesTag}
              </div>

              ${assignTesBtn ? `<div style="margin-top:10px;">${assignTesBtn}</div>` : ``}

              ${e.reviewNote ? `<div class="muted" style="margin-top:8px;">Nota: ${e.reviewNote}</div>` : ``}
            </div>

            <div style="min-width:220px;text-align:right;">
              ${e.status === "pending" ? actionsPending : `<div class="muted">—</div>`}
            </div>
          </div>
        </div>
      `;
    }

    const cards = `
      <div class="card" style="margin-top:12px;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;">
          <div style="font-weight:950;">Solicitudes</div>
          <button class="btn ghost" type="button" onclick="location.reload()">Actualizar</button>
        </div>
        ${list.length ? list.map(row).join("") : `<div class="muted" style="margin-top:10px;">Aún no hay apoderados registrados.</div>`}
      </div>
    `;

    app.innerHTML = head + codes + cards;

    // handlers existentes
    window.__approve = (id)=> approve(id, role);
    window.__delete  = (id)=> del(id, role);

    // handlers nuevos
    window.setTesorero = setTesorero;
    window.clearTesorero = clearTesorero;

    // handlers de copiado
    window.__copyInviteCode = ()=> copyText(invite);
    window.__copyWhatsappInvite = ()=> copyText(buildWhatsappInvite(c));
  }

  document.addEventListener("DOMContentLoaded", render);
})();
