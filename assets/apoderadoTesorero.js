/* =========================================================
   Cursapp · apoderadoTesorero.js
   - Si el apoderado aprobado tiene directivaRole="tesorero"
     muestra CTA "Entrar como Tesorero"
   ========================================================= */

(function(){
  const KEY_USER   = "cursapp_demo_user";
  const KEY_ACTIVE = "cursapp_active_course_v1";
  const KEY_ENROLL = "cursapp_enrollments_v1";

  function loadJSON(k, def){
    try{
      const v = localStorage.getItem(k);
      if(v==null) return def;
      return JSON.parse(v);
    }catch(e){ return def; }
  }
  function saveJSON(k, v){ localStorage.setItem(k, JSON.stringify(v)); }

  function getUser(){ return loadJSON(KEY_USER, null); }
  function activeCourseKey(){ return localStorage.getItem(KEY_ACTIVE) || ""; }
  function enrollments(){ return loadJSON(KEY_ENROLL, []); }

  function findMyEnrollment(email, courseKey){
    const e = String(email||"").trim().toLowerCase();
    const ck = String(courseKey||"");
    const list = enrollments()
      .filter(x => String(x.courseKey||"") === ck && String(x.email||"").trim().toLowerCase() === e)
      .sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
    return list[0] || null;
  }

  function injectBanner(enr){
    // Evita duplicar
    if(document.getElementById("tesoreroBanner")) return;

    const container = document.querySelector(".container") || document.getElementById("app") || document.body;

    const wrap = document.createElement("div");
    wrap.id = "tesoreroBanner";
    wrap.className = "card";
    wrap.style.marginTop = "12px";
    wrap.style.border = "1px solid rgba(34,197,94,.20)";
    wrap.style.background = "rgba(34,197,94,.06)";
    wrap.innerHTML = `
      <div style="font-weight:950;font-size:16px;">Tienes permisos de Tesorero ✅</div>
      <div class="muted" style="margin-top:6px;font-weight:800;">
        Puedes entrar como tesorero para rendiciones e informes.
      </div>
      <button class="btn primary" id="btnGoTesorero" style="width:100%;margin-top:12px;">
        Entrar como Tesorero
      </button>
    `;

    // Inserta arriba del contenido
    if(container.firstChild) container.insertBefore(wrap, container.firstChild);
    else container.appendChild(wrap);

    document.getElementById("btnGoTesorero").onclick = ()=>{
      // Sesión tesorero (misma persona)
      const u = getUser() || {};
      saveJSON(KEY_USER, {
        ...u,
        role: "tesorero",
        name: (u.name || enr.apoderadoName || "Tesorero") + " (Tesorero)"
      });
      location.assign("/tesorero.html");
    };
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    const u = getUser();
    if(!u || String(u.role||"").toLowerCase() !== "apoderado") return;

    const ck = activeCourseKey();
    if(!ck) return;

    // Email debe venir del login real; si no está, no hacemos nada
    const email = u.email || "";
    if(!email) return;

    const enr = findMyEnrollment(email, ck);
    if(!enr) return;
    if(enr.status !== "approved") return;

    if(enr.directivaRole === "tesorero"){
      injectBanner(enr);
    }
  });
})();
