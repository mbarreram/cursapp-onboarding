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

  // ---------------- Clipboard helpers ----------------
  async function copyText(text){
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){
        await navigator.clipboard.writeText(text);
        alert("Copiado ✅");
        return;
      }
    }catch(e){}
    alert("Copia manualmente:\n\n" + text);
  }

  // ---------------- WhatsApp text builders ----------------
  function buildWhatsappInvite(courseObj){
    const c = courseObj?.course || {};
    const code = courseObj?.inviteCode || "";

    const courseLabel = `${(c.level||"")}${(c.letter||"")} ${c.year||""} · ${c.jornada||""}`.trim();
    const school = c.schoolName || "Colegio";

    const url = (location && location.origin)
      ? (location.origin + "/onboarding/dashboard.html")
      : "https://cursapp.netlify.app/onboarding/dashboard.html";

    return (
      "👋 Hola apoderados/as\n\n" +
      "Ya está activo *Cursapp* para nuestro curso:\n\n" +
      "🏫 *" + school + "*\n" +
      "📘 *" + courseLabel + "*\n\n" +
      "Para registrarte como apoderado/a sigue estos pasos:\n\n" +
      "1️⃣ Ingresa aquí:\n" +
      url + "\n\n" +
      "2️⃣ Cuando te lo pida, pega este *CÓDIGO DE INVITACIÓN* 👇\n" +
      "👉 *" + code + "*\n\n" +
      "💳 *Activación única:* *$7.990 por apoderado*\n" +
      "(Permite usar Cursapp durante todo el año)\n\n" +
      "✨ ¿Para qué sirve Cursapp?\n" +
      "• Facilita la tesorería del curso\n" +
      "• Ordena pagos y campañas\n" +
      "• Mejora la comunicación con la directiva\n" +
      "• Da transparencia a los fondos del curso\n\n" +
      "👉 Tu registro será revisado por la directiva antes de activarse.\n\n" +
      "¡Gracias por apoyar la organización del curso! 🙌"
    );
  }

  function buildWhatsappApproval(courseObj, enr){
    const c = courseObj?.course || {};
    const school = c.schoolName || "Colegio";
    const courseLabel = `${(c.level||"")}${(c.letter||"")} ${c.year||""} · ${c.jornada||""}`.trim();
    const name = (enr?.apoderadoName || "Apoderado/a").trim();

    return (
      "✅ Hola " + name + "\n\n" +
      "Tu registro en *Cursapp* ya fue aprobado para:\n" +
      "🏫 *" + school + "*\n" +
      "📘 *" + courseLabel + "*\n\n" +
      "Ya puedes ingresar y ver tus cobros/pagos.\n\n" +
      "Gracias por apoyar la organización del curso 🙌"
    );
  }

  // ---------------- Modal helpers ----------------
  function openModal(html){
    const root = $("modalRoot");
    if(!root) return;
    root.innerHTML = html;
  }
  function closeModal(){
    const root = $("modalRoot");
    if(root) root.innerHTML = "";
  }

  function openApprovalModal(enr){
    const msg = buildWhatsappApproval(courseObj(), enr);
    openModal(`
      <div style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:20000;display:flex;align-items:flex-end;justify-content:center;padding:14px;">
        <div class="card" style="width:min(640px,100%);margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
            <div style="font-weight:950;font-size:18px;">Aprobado ✅</div>
            <button class="btn ghost" type="button" onclick="window.__closeModal()">Cerrar</button>
          </div>

          <div class="muted" style="margin-top:10px;font-weight:800;">
            Se aprobó a <b>${(enr.apoderadoName||"Apoderado/a")}</b>.
          </div>

          <div style="margin-top:12px;">
            <div class="muted" style="font-weight:900;margin-bottom:6px;">Mensaje listo para WhatsApp</div>
            <textarea id="waApprovalText" style="width:100%;min-height:160px;border:1px solid rgba(229,231,235,.9);border-radius:14px;padding:10px;font-weight:700;">${msg}</textarea>
          </div>

          <div style="margin-top:12px;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
            <button class="btn ghost" type="button" onclick="window.__closeModal()">Cerrar</button>
            <button class="btn primary" type="button" onclick="window.__copyApproval()">
              📲 Copiar mensaje WhatsApp
            </button>
          </div>
        </div>
      </div>
    `);

    window.__copyApproval = ()=> copyText(document.getElementById("waApprovalText").value);
  }

  window.__closeModal = closeModal;

  // ---------------- Tesorero assignment ----------------
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

    target.directivaRole = "tesorero";

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
      if(e.courseKey === ck && e.directivaRole === "tesorero"){
        e.directivaRole = null;
      }
    });

    course.directiva = course.directiva || {};
    course.directiva.tesorero = null;

    saveEnrollments(list);
    saveJSON(KEY_COURSE, course);

    alert("Tesorero removido ✅");
    render();
  }

  // ---------------- Approve / Delete ----------------
  function approve(id, role){
    const ck = activeCourseKey();
    const listBefore = loadEnrollments();
    const targetBefore = listBefore.find(e => e.enrollmentId === id);

    const ok = upsertEnrollment(id, {
      status:"approved",
      reviewedAt:new Date().toISOString(),
      reviewedBy: role||"directiva",
      reviewNote:""
    });

    if(!ok){
      alert("No encontrado");
      return;
    }

    // Re-leer enrollments para obtener data actual
    const listAfter = loadEnrollments();
    const enr = listAfter.find(e => e.enrollmentId === id) || targetBefore || {};

    render();
    openApprovalModal(enr);
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

        <button class="btn ghost" type="button" style="width:100%;margin-top:10px;" onclick="window.__copyInviteCode()">
          📋 Copiar código
        </button>

        <button class="btn primary" type="button" style="width:100%;margin-top:10px;" onclick="window.__copyWhatsappInvite()">
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

    // handlers tesorero
    window.setTesorero = setTesorero;
    window.clearTesorero = clearTesorero;

    // copiado
    window.__copyInviteCode = ()=> copyText(invite);
    window.__copyWhatsappInvite = ()=> copyText(buildWhatsappInvite(c));
  }

  document.addEventListener("DOMContentLoaded", render);
})();
