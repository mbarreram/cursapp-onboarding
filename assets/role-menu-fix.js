(function(){
  "use strict";

  const iconPaths = {
    home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
    card:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/><path d="M7 15h4"/>',
    receipt:'<path d="M7 3h10v18l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2V3Z"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h4"/>',
    chart:'<path d="M4 19V5"/><path d="M4 19h17"/><rect x="7" y="11" width="3" height="5" rx="1"/><rect x="12" y="7" width="3" height="9" rx="1"/><rect x="17" y="4" width="3" height="12" rx="1"/>',
    campaign:'<path d="M4 14V9a2 2 0 0 1 2-2h2l9-3v15l-9-3H6a2 2 0 0 1-2-2Z"/><path d="M8 16v4"/><path d="M18 9h3"/><path d="M18 14h3"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.8"/><path d="M16.5 3.2a4 4 0 0 1 0 7.6"/>',
    debt:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/><path d="M7 17h10"/>',
    report:'<path d="M6 3h9l3 3v15H6V3Z"/><path d="M14 3v4h4"/><path d="M9 13h6"/><path d="M9 17h6"/>',
    plus:'<path d="M12 5v14"/><path d="M5 12h14"/>',
    mail:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/>',
    reconcile:'<path d="M7 7h11l-3-3"/><path d="M18 17H7l3 3"/><path d="M7 7l3-3"/><path d="M18 17l-3 3"/>',
    store:'<path d="M4 10h16l-1-5H5l-1 5Z"/><path d="M6 10v10h12V10"/><path d="M9 20v-6h6v6"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    menu:'<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
    profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 4.6 1.4c0 1.8-2.1 2.2-2.1 3.6"/><path d="M12 18h.01"/>',
    logout:'<path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 3v18h-7"/>'
  };

  function svg(name){
    const paths = iconPaths[name] || iconPaths.report;
    return '<svg class="caSvgIcon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+paths+'</svg>';
  }

  function keyFromText(text){
    const t = String(text||"").toLowerCase();
    if(t.includes("inicio")) return "home";
    if(t.includes("pago") || t.includes("registrar pago")) return "card";
    if(t.includes("comprobante")) return "receipt";
    if(t.includes("informe")) return "report";
    if(t.includes("camp")) return "campaign";
    if(t.includes("apoderado") || t.includes("familia")) return "users";
    if(t.includes("deud")) return "debt";
    if(t.includes("mercado")) return "store";
    if(t.includes("aviso") || t.includes("enviar")) return "mail";
    if(t.includes("conciliar") || t.includes("concili")) return "reconcile";
    if(t.includes("rend")) return "receipt";
    if(t.includes("perfil")) return "profile";
    if(t.includes("ayuda")) return "help";
    if(t.includes("cerrar")) return "logout";
    if(t.includes("crear")) return "plus";
    return "report";
  }

  function decorateIconTargets(root){
    const scope = root || document;
    const targets = scope.querySelectorAll([
      ".presMockQuick span",
      ".apoMockQuick span",
      ".tesMockQuickGrid button span",
      ".presMockKpi span",
      ".apoMockStatusList span",
      ".apoMockReport span",
      ".tesMockKpis article span",
      ".tesMockTaskList span",
      ".tesMockCampaignList span",
      ".tesMockReportList span",
      ".tesMockPay span",
      ".bottomNav .navItem",
      ".marketBottomTab"
    ].join(","));

    targets.forEach((el)=>{
      if(el.dataset.caIconReady === "1") return;
      let label = "";
      if(el.classList.contains("navItem")){
        label = el.querySelector("span")?.textContent || el.dataset.tab || "";
        el.childNodes.forEach((node)=>{ if(node.nodeType === 3) node.textContent = ""; });
        el.insertAdjacentHTML("afterbegin", svg(keyFromText(label)));
      }else if(el.classList.contains("marketBottomTab")){
        label = el.textContent || "Mercado";
        const first = el.querySelector("span");
        if(first) first.remove();
        el.insertAdjacentHTML("afterbegin", svg("store"));
      }else{
        const btn = el.closest("button,article");
        label = btn ? btn.textContent : el.textContent;
        el.innerHTML = svg(keyFromText(label));
      }
      el.dataset.caIconReady = "1";
    });
  }

  function menuItemsForRole(){
    const body = document.body;
    if(body.classList.contains("cursapp-tesorero")){
      return [
        ["Inicio", "home", "home"],
        ["Conciliar pagos", "conciliacion", "reconcile"],
        ["Rendiciones", "rendiciones", "receipt"],
        ["Informes", "informes", "report"]
      ];
    }
    if(body.classList.contains("cursapp-presidente")){
      return [
        ["Inicio", "home", "home"],
        ["Campanas", "campanas", "campaign"],
        ["Deudores", "deudores", "debt"],
        ["Informes", "informes", "report"],
        ["Apoderados", "apoderados.html", "users"]
      ];
    }
    return [
      ["Inicio", "home", "home"],
      ["Pagos", "payments", "card"],
      ["Informes", "informes", "report"],
      ["Mercado Escolar", "/mercado-escolar/mercado-escolar.html", "store"]
    ];
  }

  function buildFallbackMenu(menu){
    if(!menu) return;
    if(menu.dataset.caRoleMenu === "1") return;
    menu.innerHTML = "";
    menu.dataset.caRoleMenu = "1";
    const header = document.createElement("div");
    header.className = "caRoleMenuHeader";
    const role = document.body.classList.contains("cursapp-tesorero") ? "Tesorero" :
      document.body.classList.contains("cursapp-presidente") ? "Presidente" : "Apoderado";
    header.innerHTML = '<div class="caRoleAvatar">C</div><div><b>'+role+'</b><small>Menu de Cursapp</small></div>';
    menu.appendChild(header);

    menuItemsForRole().forEach(([label,target,icon])=>{
      const b = document.createElement("button");
      b.type = "button";
      b.className = "caRoleMenuItem";
      b.innerHTML = svg(icon) + '<span>'+label+'</span>';
      b.addEventListener("click", ()=>{
        if(/\.html|\//.test(target)){
          window.location.href = target;
        }else if(typeof window.go === "function"){
          window.go(target);
        }
        closeMenu(menu);
      });
      menu.appendChild(b);
    });

    const logout = document.createElement("button");
    logout.type = "button";
    logout.className = "caRoleMenuItem caRoleMenuLogout";
    logout.innerHTML = svg("logout") + "<span>Cerrar sesion</span>";
    logout.addEventListener("click", ()=>{
      const existing = document.getElementById("logoutBtn") || document.getElementById("logoutMenuItem");
      if(existing) existing.click();
      else window.location.href = "login.html";
    });
    menu.appendChild(logout);
  }

  function openMenu(menu){
    if(!menu) return;
    buildFallbackMenu(menu);
    menu.classList.add("caMenuOpen");
    menu.style.display = "block";
  }

  function closeMenu(menu){
    if(!menu) return;
    menu.classList.remove("caMenuOpen");
    menu.style.display = "none";
  }

  function initMenu(){
    const btn = document.getElementById("menuBtn");
    const menu = document.getElementById("menuDropdown");
    if(!btn || !menu) return;
    buildFallbackMenu(menu);
    btn.innerHTML = svg("menu");
    btn.setAttribute("aria-label", "Abrir menu");
    btn.addEventListener("click", (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      if(menu.style.display === "block" || menu.classList.contains("caMenuOpen")) closeMenu(menu);
      else openMenu(menu);
    }, true);
    document.addEventListener("click", (ev)=>{
      if(menu.contains(ev.target) || btn.contains(ev.target)) return;
      closeMenu(menu);
    }, true);
  }

  function boot(){
    initMenu();
    decorateIconTargets(document);
    const app = document.getElementById("app");
    if(app && window.MutationObserver){
      const obs = new MutationObserver(()=>decorateIconTargets(app));
      obs.observe(app, {childList:true, subtree:true});
    }
    if(window.MutationObserver){
      const bodyObs = new MutationObserver(()=>decorateIconTargets(document));
      bodyObs.observe(document.body, {childList:true, subtree:true});
    }
    setTimeout(()=>decorateIconTargets(document), 350);
    setTimeout(()=>decorateIconTargets(document), 1000);
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
