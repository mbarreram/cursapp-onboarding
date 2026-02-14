/* =========================================================
   Cursapp · Apoderado Dashboard Enhancements (A + B)
   - A1: Banner de estado (pending/approved) + rol activo
   - B1: Cards de campañas + bloqueo explicativo si pending
   - Safe: no rompe si faltan keys/DOM; solo agrega UI
   ========================================================= */

(function(){
  // ---- Config: intenta múltiples keys (para integrarse sin saber tu nombre exacto) ----
  const KEYS = {
    session: ["cursapp_session_v1"],
    enrollments: ["cursapp_enrollments_v1","cursapp_enrollments"],
    campaigns: ["cursapp_campaigns_v1","cursapp_campaigns","cursapp_cobros_v1","cursapp_cobros"],
    payments: ["cursapp_payments_v1","cursapp_payments","cursapp_pagos_v1","cursapp_pagos"]
  };

  const $ = (sel, root=document)=> root.querySelector(sel);
  const $$ = (sel, root=document)=> Array.from(root.querySelectorAll(sel));

  function loadFirstJSON(keys, fallback){
    for(const k of keys){
      try{
        const raw = localStorage.getItem(k);
        if(raw==null) continue;
        const val = JSON.parse(raw);
        if(val!=null) return val;
      }catch(e){}
    }
    return fallback;
  }

  function esc(s){
    return String(s ?? "").replace(/[&<>'"]/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[c]));
  }

  function clp(n){
    const num = Number(n||0);
    return "$" + num.toLocaleString("es-CL");
  }

  // ---- Data ----
  function getSession(){
    return loadFirstJSON(KEYS.session, {}) || {};
  }

  function getEnrollments(){
    const list = loadFirstJSON(KEYS.enrollments, []);
    return Array.isArray(list) ? list : [];
  }

  function getActiveEnrollment(){
    const s = getSession();
    const email = String(s.userId||"").toLowerCase();
    const ck = String(s.courseKey||"");
    if(!email || !ck) return null;
    const list = getEnrollments()
      .filter(e => String(e.email||"").toLowerCase()===email && String(e.courseKey||"")===ck)
      .sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
    return list[0] || null;
  }

  function getCampaigns(){
    const list = loadFirstJSON(KEYS.campaigns, []);
    return Array.isArray(list) ? list : [];
  }

  function getPayments(){
    const list = loadFirstJSON(KEYS.payments, []);
    return Array.isArray(list) ? list : [];
  }

  function campaignsForCourse(courseKey){
    const list = getCampaigns();
    // intenta diferentes modelos: campaign.courseKey | campaign.course.courseKey | campaign.courseId
    return list.filter(c=>{
      const ck = String(c.courseKey || c.course?.courseKey || c.courseId || "");
      return ck === String(courseKey||"");
    });
  }

  // ---- Status helpers ----
  function getApoderadoStatus(){
    const enr = getActiveEnrollment();
    if(!enr) return { status: "unknown", enr: null };
    const st = String(enr.status||"pending").toLowerCase();
    return { status: (st==="approved" ? "approved" : "pending"), enr };
  }

  // ---- UI: insert containers (non-destructive) ----
  function ensureMounts(){
    // Preferir un contenedor dentro del dashboard
    const app = document.getElementById("app") || $(".container") || document.body;

    // Banner mount
    let banner = document.getElementById("apoderadoStatusBanner");
    if(!banner){
      banner = document.createElement("div");
      banner.id = "apoderadoStatusBanner";
      app.prepend(banner);
    }

    // Role mount
    let role = document.getElementById("activeRolePill");
    if(!role){
      role = document.createElement("div");
      role.id = "activeRolePill";
      banner.after(role);
    }

    // Campaigns mount
    let camp = document.getElementById("apoderadoCampaignsMount");
    if(!camp){
      camp = document.createElement("div");
      camp.id = "apoderadoCampaignsMount";
      app.appendChild(camp);
    }

    return { banner, role, camp };
  }

  // ---- UI: role pill ----
  function renderRolePill(root){
    const s = getSession();
    const role = String(s.role||"apoderado").toLowerCase();
    const label = role==="apoderado" ? "👨‍👩‍👧 Apoderado" : role==="presidente" ? "🎓 Presidente" : role==="tesorero" ? "💳 Tesorero" : role;
    root.innerHTML = `
      <div class="csaRolePill">
        <div><b>Rol activo:</b> ${esc(label)}</div>
        <button class="btn ghost" type="button" id="btnChangeRole">Cambiar rol</button>
      </div>
    `;
    const btn = document.getElementById("btnChangeRole");
    if(btn){
      btn.onclick = ()=> {
        // Soft: volver a login para elegir rol (o donde tengas selector)
        window.location.href = "/index.html";
      };
    }
  }

  // ---- UI: status banner ----
  function renderStatusBanner(root){
    const { status, enr } = getApoderadoStatus();

    if(status === "unknown"){
      root.innerHTML = "";
      return;
    }

    if(status === "approved"){
      root.innerHTML = `
        <div class="csaStatusBanner approved">
          <div class="title">✅ Estás aprobado en el curso</div>
          <div class="sub">Ya puedes participar y realizar pagos.</div>
          <div class="actions">
            <button class="btn primary" type="button" id="btnGoCampaigns">Ver campañas</button>
            <button class="btn ghost" type="button" id="btnGoPayments">Ir a pagos</button>
          </div>
        </div>
      `;
      $("#btnGoCampaigns")?.addEventListener("click", ()=> {
        document.getElementById("apoderadoCampaignsMount")?.scrollIntoView({behavior:"smooth", block:"start"});
      });
      $("#btnGoPayments")?.addEventListener("click", ()=> {
        // Si existe una sección pagos, intenta
        const pay = document.getElementById("payments") || document.getElementById("pagos") || $("[data-section='payments']");
        if(pay) pay.scrollIntoView({behavior:"smooth", block:"start"});
        else alert("Ir a pagos: sección no encontrada (puedo enlazarla cuando me digas el id real).");
      });
      return;
    }

    // pending
    root.innerHTML = `
      <div class="csaStatusBanner pending">
        <div class="title">⏳ Tu ingreso está pendiente de aprobación</div>
        <div class="sub">La directiva debe aprobar tu solicitud para habilitar pagos y campañas.</div>
        <div class="actions">
          <button class="btn ghost" type="button" id="btnViewStatus">Ver estado</button>
          <button class="btn ghost" type="button" id="btnNudge">Avisar a la directiva</button>
        </div>
        <div class="hint">Mientras esté pendiente, podrás ver la información pero <b>no podrás pagar</b>.</div>
      </div>
    `;
    $("#btnViewStatus")?.addEventListener("click", ()=> {
      const alumno = enr?.alumno ? `Alumno/a: ${enr.alumno}\n` : "";
      alert(`Estado: PENDIENTE\n${alumno}\nLa directiva debe aprobar tu ingreso.`);
    });
    $("#btnNudge")?.addEventListener("click", ()=> {
      alert("Sugerencia: pídele a la directiva que apruebe tu solicitud en Presidente → Apoderados.");
    });
  }

  // ---- UI: campaigns cards ----
  function inferType(c){
    // intenta inferir tipo y periodicidad
    const t = String(c.type||c.kind||"").toLowerCase();
    const isMonthly = t.includes("mensual") || c.installments || c.cuotas;
    const mandatory = String(c.mandatory ?? c.obligatoria ?? "").toLowerCase() === "true" || c.mandatory === true || c.obligatoria === true;
    return { isMonthly, mandatory };
  }

  function campaignAmount(c){
    return Number(c.amount || c.monto || c.total || 0);
  }

  function renderCampaigns(root){
    const s = getSession();
    const courseKey = String(s.courseKey||"");
    if(!courseKey){
      root.innerHTML = "";
      return;
    }

    const { status } = getApoderadoStatus();
    const list = campaignsForCourse(courseKey);

    if(!list.length){
      root.innerHTML = `
        <div class="csaSection">
          <div class="csaSectionTitle">Campañas</div>
          <div class="csaEmpty">
            <div style="font-weight:900;">Aún no hay campañas activas</div>
            <div class="muted">Cuando la directiva publique una campaña, aparecerá aquí.</div>
          </div>
        </div>
      `;
      return;
    }

    root.innerHTML = `
      <div class="csaSection">
        <div class="csaSectionTitle">Campañas</div>
        <div class="csaGrid">
          ${list.map(c=>{
            const name = c.title || c.name || "Campaña";
            const { isMonthly, mandatory } = inferType(c);
            const amt = campaignAmount(c);
            const freq = isMonthly ? "Mensual" : "Pago único";
            const mand = mandatory ? "Obligatoria" : "Voluntaria";
            const closed = String(c.status||c.state||"").toLowerCase()==="closed";
            const canPay = (status==="approved") && !closed;

            const reason = status!=="approved"
              ? "Disponible cuando la directiva apruebe tu ingreso."
              : closed ? "Esta campaña está cerrada." : "";

            return `
              <div class="csaCard">
                <div class="csaCardTop">
                  <div class="csaCardTitle">${esc(name)}</div>
                  <div class="csaPills">
                    <span class="csaPill">${esc(freq)}</span>
                    <span class="csaPill ${mandatory?'mand':''}">${esc(mand)}</span>
                  </div>
                </div>
                <div class="csaCardBody">
                  <div class="csaAmount">${clp(amt)}</div>
                  <div class="csaMeta">${closed ? "Estado: Cerrada" : "Estado: Activa"}</div>
                </div>
                <div class="csaCardActions">
                  <button class="btn primary" type="button" ${canPay ? "" : "disabled"} data-pay="${esc(String(c.id||c.campaignId||c.key||name))}">
                    Pagar ahora
                  </button>
                  ${!canPay ? `<div class="csaBlocked">${esc(reason)}</div>` : ``}
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;

    // wire pay buttons
    $$("button[data-pay]", root).forEach(btn=>{
      btn.addEventListener("click", ()=>{
        if(btn.disabled) return;
        const id = btn.getAttribute("data-pay");
        alert("Pagar ahora (demo)\n\nCampaña: " + id + "\n\nSiguiente: conecto acá tu pantalla real de pago cuando me digas el flujo/archivo.");
      });
    });
  }

  // ---- Main ----
  function run(){
    const { banner, role, camp } = ensureMounts();
    renderStatusBanner(banner);
    renderRolePill(role);
    renderCampaigns(camp);
  }

  // Run when DOM ready
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", run);
  }else{
    run();
  }
})();
