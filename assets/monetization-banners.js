(function(){
  "use strict";

  const KEY = "cursapp_monetizacion_v1";
  const ALERTS_KEY = "cursapp_global_alerts_v1";
  const DISMISS_KEY = "cursapp_monetization_dismissed_session_v1";

  function load(k, def){
    try{
      const v = localStorage.getItem(k);
      return v == null ? def : JSON.parse(v);
    }catch(e){
      return def;
    }
  }

  function save(k, v){
    localStorage.setItem(k, JSON.stringify(v));
  }

  function esc(s){
    return String(s ?? "").replace(/[&<>'"]/g, c => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      "'":"&#39;",
      '"':"&quot;"
    }[c]));
  }

  function currentRole(){
    const bodyRole = document.body?.dataset?.role;
    if(bodyRole) return String(bodyRole).toLowerCase();

    const path = location.pathname.toLowerCase();
    if(path.includes("presidente")) return "presidente";
    if(path.includes("tesorero")) return "tesorero";
    if(path.includes("apoderado")) return "apoderado";

    const sessionKeys = ["cursapp_session_v1","cursapp_demo_user","cursapp_active_enrollment_v1"];
    for(const k of sessionKeys){
      const s = load(k, null);
      const r = String(s?.role || s?.activeRole || "").toLowerCase();
      if(r) return r;
    }
    return "apoderado";
  }

  function placementForRole(role){
    if(role === "presidente") return ["inicio_presidente","directiva","todos_perfiles","todos","home"];
    if(role === "tesorero") return ["inicio_tesorero","directiva","todos_perfiles","todos","home"];
    return ["home_apoderado","apoderado","todos_perfiles","todos","home"];
  }

  function hasCriticalOperationalAlert(){
    const alerts = load(ALERTS_KEY, []);
    const now = Date.now();
    return alerts.some(a => {
      const status = String(a.status || "activa").toLowerCase();
      if(status === "cerrada") return false;
      if(a.endAt && Date.parse(a.endAt) < now) return false;
      return String(a.severity || "").toLowerCase() === "critica";
    });
  }

  function monetData(){
    const d = load(KEY, null);
    if(d && typeof d === "object"){
      d.banners = Array.isArray(d.banners) ? d.banners : [];
      d.config = d.config || {};
      return d;
    }
    return {banners:[], config:{maxBannersPerScreen:1, hideWhenOperationalAlert:true, allowPresidentHide:true}};
  }

  function activeBanners(){
    const d = monetData();
    if(d.config.hideWhenOperationalAlert !== false && hasCriticalOperationalAlert()) return [];

    const role = currentRole();
    const allowed = placementForRole(role);
    const now = Date.now();
    let dismissed = {};\n    try{ dismissed = JSON.parse(sessionStorage.getItem(DISMISS_KEY) || "{}") || {}; }catch(e){ dismissed = {}; }

    const list = d.banners
      .filter(b => String(b.status || "").toLowerCase() === "activo")
      .filter(b => !b.startAt || Date.parse(b.startAt) <= now)
      .filter(b => !b.endAt || Date.parse(b.endAt) >= now)
      .filter(b => allowed.includes(String(b.placement || "").toLowerCase()))
      .filter(b => !dismissed[b.id])
      .sort((a,b) => Number(a.priority || 99) - Number(b.priority || 99));

    const max = Number(d.config.maxBannersPerScreen || 1);
    const roleKey = "cursapp_monetization_rotation_" + role;
    let cursor = Number(sessionStorage.getItem(roleKey) || 0);
    if(cursor >= list.length) cursor = 0;
    const rotated = list.slice(cursor).concat(list.slice(0, cursor));
    sessionStorage.setItem(roleKey, String((cursor + max) % Math.max(1, list.length)));
    return rotated.slice(0, max);
  }

  function track(type, banner){
    const key = "cursapp_monetization_events_v1";
    const arr = load(key, []);
    arr.unshift({
      at: new Date().toISOString(),
      type,
      bannerId: banner.id,
      title: banner.title,
      partner: banner.partner,
      placement: banner.placement,
      role: currentRole()
    });
    save(key, arr.slice(0,500));
  }

  function dismiss(id){
    let d = {};\n    try{ d = JSON.parse(sessionStorage.getItem(DISMISS_KEY) || "{}") || {}; }catch(e){ d = {}; }\n    d[id] = new Date().toISOString();\n    sessionStorage.setItem(DISMISS_KEY, JSON.stringify(d));
    render();
  }

  function openBanner(id){
    const b = activeBanners().find(x => String(x.id) === String(id));
    if(!b) return;
    track("click", b);
    if(b.url && b.url !== "#"){
      location.href = b.url;
      return;
    }
    alert(`${b.partner || "Beneficio Cursapp"}\n\n${b.title || ""}\n\nPronto conectaremos el detalle del beneficio.`);
  }

  function card(b){
    track("impression", b);
    const canDismiss = monetData().config.allowPresidentHide !== false || currentRole() !== "presidente";
    return `<article class="cursappAdBanner">
      <div class="cursappAdIcon">${esc(b.imageEmoji || "🏷️")}</div>
      <div class="cursappAdBody">
        <span>${esc(b.partner || "Beneficio Cursapp")}</span>
        <b>${esc(b.title || "Promoción escolar")}</b>
        <small>${esc(b.category || "Beneficio")} · ${esc(b.region || "Todas")}</small>
      </div>
      <button class="cursappAdCta" onclick="CursappMonetization.open('${esc(b.id)}')">${esc(b.cta || "Ver")}</button>
      ${canDismiss ? `<button class="cursappAdClose" onclick="CursappMonetization.dismiss('${esc(b.id)}')" aria-label="Ocultar">×</button>` : ``}
    </article>`;
  }

  function injectStyles(){
    if(document.getElementById("cursappMonetizationStyle")) return;
    const style = document.createElement("style");
    style.id = "cursappMonetizationStyle";
    style.textContent = `
      .cursappMonetizationSlot{
        margin:14px 0 18px;
        display:grid;
        gap:10px;
      }
      .cursappAdBanner{
        position:relative;
        display:grid;
        grid-template-columns:50px minmax(0,1fr) auto;
        gap:12px;
        align-items:center;
        padding:14px 42px 14px 14px;
        border-radius:22px;
        background:linear-gradient(135deg,#fff,#fbf8ff);
        border:1px solid rgba(124,58,237,.16);
        box-shadow:0 14px 36px rgba(15,23,42,.08);
        overflow:hidden;
      }
      .cursappAdBanner:before{
        content:"";
        position:absolute;
        inset:0 auto 0 0;
        width:5px;
        background:linear-gradient(180deg,#7c3aed,#22c55e);
      }
      .cursappAdIcon{
        width:50px;
        height:50px;
        border-radius:18px;
        display:grid;
        place-items:center;
        background:#f3e8ff;
        font-size:26px;
      }
      .cursappAdBody span,
      .cursappAdBody small{
        display:block;
        color:#667085;
        font-size:12px;
        font-weight:850;
        line-height:1.2;
      }
      .cursappAdBody b{
        display:block;
        color:#101828;
        font-size:15px;
        font-weight:950;
        line-height:1.2;
        margin:3px 0;
      }
      .cursappAdCta{
        border:0;
        border-radius:14px;
        padding:11px 13px;
        background:linear-gradient(135deg,#6d28d9,#8b5cf6);
        color:#fff;
        font-weight:950;
        white-space:nowrap;
      }
      .cursappAdClose{
        position:absolute;
        top:10px;
        right:10px;
        width:26px;
        height:26px;
        border:0;
        border-radius:999px;
        background:#f1f5f9;
        color:#667085;
        font-size:18px;
        line-height:1;
        font-weight:900;
      }
      @media(max-width:560px){
        .cursappAdBanner{
          grid-template-columns:44px minmax(0,1fr);
          padding:13px 40px 13px 13px;
        }
        .cursappAdIcon{
          width:44px;
          height:44px;
          border-radius:16px;
          font-size:23px;
        }
        .cursappAdCta{
          grid-column:1/-1;
          width:100%;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function findTarget(){
    const selectors = [
      "#monetizationSlot",
      "[data-monetization-slot]",
      "#globalAlertsRoot",
      "#app",
      "main",
      ".app",
      ".content"
    ];
    for(const sel of selectors){
      const el = document.querySelector(sel);
      if(el) return {el, mode: sel === "#app" || sel === "main" || sel === ".app" || sel === ".content" ? "prepend" : "inside"};
    }
    return null;
  }

  function render(){
    injectStyles();
    const existing = document.querySelector(".cursappMonetizationSlot");
    if(existing) existing.remove();

    const banners = activeBanners();
    if(!banners.length) return;

    const target = findTarget();
    if(!target) return;

    const slot = document.createElement("section");
    slot.className = "cursappMonetizationSlot";
    slot.innerHTML = banners.map(card).join("");

    if(target.mode === "inside"){
      target.el.appendChild(slot);
    }else{
      target.el.prepend(slot);
    }
  }

  window.CursappMonetization = {
    render,
    dismiss,
    open: openBanner
  };

  document.addEventListener("DOMContentLoaded", () => setTimeout(render, 120));
  window.addEventListener("storage", e => {
    if(e.key === KEY || e.key === ALERTS_KEY || e.key === DISMISS_KEY) render();
  });
})();