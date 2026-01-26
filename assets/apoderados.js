(function(){
  const KEY_USER   = "cursapp_demo_user";
  const KEY_ENROLL = "cursapp_enrollments_v1";
  const KEY_ACTIVE = "cursapp_active_course_v1";
  const KEY_COURSE = "cursapp_course_v1";

  const $ = (id) => document.getElementById(id);

  function loadJSON(k, def){
    try{
      const v = localStorage.getItem(k);
      if(v==null) return def;
      return JSON.parse(v);
    }catch(e){ return def; }
  }
  function saveJSON(k, v){ localStorage.setItem(k, JSON.stringify(v)); }

  function getUser(){ return loadJSON(KEY_USER, null); }
  function isDirectiva(role){ return role === "presidente" || role === "tesorero"; }

  function fmtDate(iso){
    if(!iso) return "";
    try { return new Date(iso).toLocaleString("es-CL"); } catch { return iso; }
  }

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

  function approve(id, role){
    const ok = upsertEnrollment(id, {
      status: "approved",
      reviewedAt: new Date().toISOString(),
      reviewedBy: role || "directiva",
      reviewNote: ""
    });
    if(!ok) alert("No encontrado");
    render();
  }

  function del(id, role){
    const note = prompt("Motivo (opcional):", "Registro incorrecto / curso equivocado") || "";
    const ok = upsertEnrollment(id, {
      status: "deleted",
      reviewedAt: new Date().toISOString(),
      reviewedBy: role || "directiva",
      reviewNote: note
    });
    if(!ok) alert("No encontrado");
    render();
  }

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
    return `
      <div class="card" style="margin-top:12px;">
        <div style="font-weight:950;font-size:18px;">${title}</div>
        <div class="muted" style="margin-top:8px;font-weight:800;line-height:1.45;">${text}</div>
      </div>
    `;
  }

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
      app.innerHTML = emptyCard("No hay curso activo", "Crea un curso como directiva para comenzar a recibir solicitudes.");
      return;
    }

    const c = courseObj();
    const invite = c?.inviteCode || "";

    const listAll = loadEnrollments();
    const list = listAll.filter(e => String(e.courseKey||"") === ck);

    const pend = list.filter(e => e.status === "pending");
    const appr = list.filter(e => e.status === "approved");
    const deld = list.filter(e => e.status === "deleted");

    const courseLine = (c && c.course)
      ? `${c.course.schoolName} · ${c.course.level}${c.course.letter} ${c.course.year} · ${c.course.jornada}`
      : `Curso activo: ${ck}`;

    const head = `
      <div class="card">
        <div style="font-weight:950;font-size:18px;">Apoderados</div>
        <div class="muted" style="margin-top:6px;font-weight:800;">${courseLine}</div>

        <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
          <span class="tag warn">Pendientes ${pend.length}</span>
          <span class="tag ok">Aprobados ${appr.length}</span>
          <span class="tag">Eliminados ${deld.length}</span>
        </div>
      </div>
    `;

    const inviteBlock = invite ? `
      <div class="card codeBox">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">
          <div>
            <div style="font-weight:950;">Código de invitación</div>
            <div class="muted" style="margin-top:6px;">Compártelo solo con apoderados del curso.</div>
          </div>
          <button class="btn ghost" type="button"
            onclick="(navigator.clipboard && navigator.clipboard.writeText('${invite}').then(()=>alert('Copiado ✅')).catch(()=>alert('${invite}')))">
            Copiar
          </button>
        </div>
        <div class="code" style="margin-top:10px;">${invite}</div>
      </div>
    ` : `
      <div class="card codeBox">
        <div style="font-weight:950;">Código de invitación</div>
        <div class="muted" style="margin-top:6px;">Aún no hay código. Crea el curso como directiva.</div>
      </div>
    `;

    function row(e){
      const pay = e.activation?.status === "paid" ? `<span class="tag ok">Pago OK</span>` : `<span class="tag warn">Pago pendiente</span>`;
      const st = e.status === "approved"
        ? `<span class="tag ok">Aprobado</span>`
        : (e.status === "deleted" ? `<span class="tag">Eliminado</span>` : `<span class="tag warn">Pendiente</span>`);

      const actions = (e.status === "pending")
        ? `
          <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
            <button class="btn primary" type="button" onclick="window.__approve('${e.enrollmentId}')">Aceptar</button>
            <button class="btn ghost" type="button" onclick="window.__delete('${e.enrollmentId}')">Eliminar</button>
          </div>
        `
        : `<div class="muted">—</div>`;

      return `
        <div style="padding:12px 0;border-top:1px solid rgba(229,231,235,.6);">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
            <div style="min-width:240px;">
              <div style="font-weight:950;">${e.apoderadoName || "Apoderado"} · ${e.alumno || "Alumno"}</div>
              <div class="muted" style="margin-top:6px;font-weight:800;">${e.email || ""}</div>
              <div class="muted" style="margin-top:6px;">Registrado: ${fmtDate(e.createdAt)}</div>
              <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                ${st} ${pay}
              </div>
              ${e.reviewNote ? `<div class="muted" style="margin-top:8px;">Nota: ${e.reviewNote}</div>` : ``}
            </div>
            <div style="min-width:220px;text-align:right;">
              ${actions}
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

    app.innerHTML = head + inviteBlock + cards;

    window.__approve = (id) => approve(id, role);
    window.__delete  = (id) => del(id, role);
  }

  document.addEventListener("DOMContentLoaded", render);
})();
