
(function(){
  "use strict";

  const KEY = "cursapp_global_alerts_v1";
  const ACK_KEY = "cursapp_global_alerts_ack_v1";

  const $ = (id)=>document.getElementById(id);

  function safeJSON(k, fallback){
    try{
      const v = JSON.parse(localStorage.getItem(k) || "null");
      return v ?? fallback;
    }catch(e){ return fallback; }
  }

  function saveJSON(k, v){
    localStorage.setItem(k, JSON.stringify(v));
  }

  function nowISO(){ return new Date().toISOString(); }

  function esc(s){
    return String(s ?? "").replace(/[&<>"']/g, m => ({
      "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
    }[m]));
  }

  function currentRole(){
    const p = location.pathname.toLowerCase();
    if(p.includes("presidente")) return "presidente";
    if(p.includes("tesorero")) return "tesorero";
    if(p.includes("apoderado")) return "apoderado";
    return "";
  }

  function roleAllowed(alert, role){
    const target = String(alert.visibleTo || "todos").toLowerCase();
    if(target === "todos") return true;
    if(target === "directiva") return role === "presidente" || role === "tesorero";
    return target === role;
  }

  function isActive(alert){
    if(!alert || alert.status === "cerrada") return false;
    const now = Date.now();
    const start = alert.startAt ? Date.parse(alert.startAt) : 0;
    const end = alert.endAt ? Date.parse(alert.endAt) : 0;
    if(start && start > now) return false;
    if(end && end < now) return false;
    return true;
  }

  function getActiveAlerts(){
    const role = currentRole();
    const list = safeJSON(KEY, []);
    return (Array.isArray(list) ? list : [])
      .filter(a => isActive(a) && roleAllowed(a, role))
      .sort((a,b)=>{
        const score = {critica:3, advertencia:2, informativa:1};
        return (score[String(b.severity||"").toLowerCase()]||0) - (score[String(a.severity||"").toLowerCase()]||0);
      });
  }

  function iconFor(a){
    const type = String(a.type || "").toLowerCase();
    const sev = String(a.severity || "").toLowerCase();
    if(sev === "critica") return "🚨";
    if(type.includes("transbank")) return "💳";
    if(type.includes("cloud")) return "☁️";
    if(type.includes("mant")) return "🛠️";
    return "ℹ️";
  }

  function classFor(a){
    const sev = String(a.severity || "informativa").toLowerCase();
    if(sev === "critica") return "cgaCritical";
    if(sev === "advertencia") return "cgaWarning";
    return "cgaInfo";
  }

  function render(){
    const alerts = getActiveAlerts();
    const old = $("cursappGlobalAlertsHost");
    if(old) old.remove();
    if(!alerts.length) return;

    const ack = safeJSON(ACK_KEY, {});
    const visible = alerts.filter(a => !(ack[a.id] && a.dismissible !== false));
    if(!visible.length) return;

    const host = document.createElement("section");
    host.id = "cursappGlobalAlertsHost";
    host.className = "cgaHost";

    host.innerHTML = visible.map(a=>`
      <article class="cgaBanner ${classFor(a)}" data-alert-id="${esc(a.id)}">
        <div class="cgaIcon">${iconFor(a)}</div>
        <div class="cgaText">
          <strong>${esc(a.title || "Alerta operacional")}</strong>
          <p>${esc(a.message || "")}</p>
          ${a.endAt ? `<small>Vigente hasta ${new Date(a.endAt).toLocaleString("es-CL",{dateStyle:"short",timeStyle:"short"})}</small>` : ``}
        </div>
        ${a.dismissible !== false ? `<button type="button" class="cgaClose" data-cga-close="${esc(a.id)}">×</button>` : ``}
      </article>
    `).join("");

    const main = document.querySelector("main.container") || document.querySelector("main") || document.body;
    main.prepend(host);

    host.addEventListener("click", (e)=>{
      const id = e.target && e.target.getAttribute ? e.target.getAttribute("data-cga-close") : "";
      if(!id) return;
      const data = safeJSON(ACK_KEY, {});
      data[id] = nowISO();
      saveJSON(ACK_KEY, data);
      render();
    });
  }

  function injectCSS(){
    if($("cursappGlobalAlertsCSS")) return;
    const st = document.createElement("style");
    st.id = "cursappGlobalAlertsCSS";
    st.textContent = `
      .cgaHost{display:grid;gap:10px;margin:12px 0 14px;position:relative;z-index:5}
      .cgaBanner{display:grid;grid-template-columns:40px minmax(0,1fr) 34px;gap:10px;align-items:start;border-radius:18px;padding:12px;border:1px solid rgba(16,24,40,.08);box-shadow:0 10px 28px rgba(16,24,40,.06);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
      .cgaIcon{width:38px;height:38px;border-radius:14px;display:grid;place-items:center;font-size:20px}
      .cgaText strong{display:block;font-size:14px;line-height:1.25;color:#101828;font-weight:950}
      .cgaText p{margin:4px 0 0;font-size:12px;line-height:1.35;color:#475467;font-weight:700}
      .cgaText small{display:block;margin-top:6px;font-size:11px;color:#667085;font-weight:800}
      .cgaClose{border:0;background:transparent;color:#667085;font-size:24px;line-height:1;cursor:pointer}
      .cgaCritical{background:#fff1f2;border-color:#fecdd3}.cgaCritical .cgaIcon{background:#fee2e2;color:#b91c1c}
      .cgaWarning{background:#fffbeb;border-color:#fde68a}.cgaWarning .cgaIcon{background:#fef3c7;color:#92400e}
      .cgaInfo{background:#eff6ff;border-color:#bfdbfe}.cgaInfo .cgaIcon{background:#dbeafe;color:#1d4ed8}
      @media(max-width:640px){.cgaHost{margin:10px 0 12px}.cgaBanner{border-radius:16px;padding:10px;grid-template-columns:36px minmax(0,1fr) 28px}.cgaIcon{width:34px;height:34px;border-radius:12px}.cgaText strong{font-size:13px}.cgaText p{font-size:11px}}
    `;
    document.head.appendChild(st);
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    injectCSS();
    render();
    window.addEventListener("storage", (e)=>{ if(e.key === KEY) render(); });
  });

  window.CursappGlobalAlerts = { render, getActiveAlerts, KEY };
})();
