
(function(){
  function getCourseScopeAvisos(){
    try{
      const active = localStorage.getItem("cursapp_active_course_v1");
      if(active && String(active).trim()) return String(active).trim();
    }catch(e){}
    try{
      const course = JSON.parse(localStorage.getItem("cursapp_course_v1") || "null");
      const ck = course && course.courseKey;
      if(ck && String(ck).trim()) return String(ck).trim();
    }catch(e){}
    try{
      const s = JSON.parse(localStorage.getItem("cursapp_session_v1") || "null");
      const ck = s && (s.courseKey || s.activeCourseKey);
      if(ck && String(ck).trim()) return String(ck).trim();
    }catch(e){}
    return "global";
  }
  function sanitizeScopeAvisos(s){
    return String(s||"global").replace(/[^a-zA-Z0-9_\-]/g,"_").slice(0,64) || "global";
  }

  const AVISOS_SCOPE = sanitizeScopeAvisos(getCourseScopeAvisos());
  const KEY_AVISOS = `cursapp_${AVISOS_SCOPE}_avisos_v2`;

  function esc(s){
    return String(s ?? "").replace(/[&<>'"]/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"
    }[c]));
  }
  function uid(p="av"){
    return `${p}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
  }
  function loadAvisos(){
    try{
      const arr = JSON.parse(localStorage.getItem(KEY_AVISOS)||"[]");
      return Array.isArray(arr) ? arr : [];
    }catch(e){ return []; }
  }
  function saveAvisos(arr){
    localStorage.setItem(KEY_AVISOS, JSON.stringify(arr||[]));
    try{ window.dispatchEvent(new CustomEvent("cursapp:dataChanged", { detail:{ key:KEY_AVISOS }})); }catch(e){}
    try{ window.renderAvisosBell && window.renderAvisosBell(); }catch(e){}
  }
  function normalizeAviso(a){
    return {
      id: String(a?.id || uid()),
      type: String(a?.type || "manual"),
      category: String(a?.category || "info"),
      priority: String(a?.priority || "normal"),
      title: String(a?.title || "Aviso"),
      message: String(a?.message || ""),
      createdAt: String(a?.createdAt || new Date().toISOString()),
      readBy: Array.isArray(a?.readBy) ? a.readBy : [],
      targetUserKey: a?.targetUserKey ? String(a.targetUserKey).toLowerCase() : "",
      targetEmail: a?.targetEmail ? String(a.targetEmail).toLowerCase() : "",
      actionType: String(a?.actionType || ""),
      actionPayload: a?.actionPayload || null,
      dedupeKey: String(a?.dedupeKey || ""),
      courseScope: String(a?.courseScope || AVISOS_SCOPE)
    };
  }
  function currentIdentity(){
    try{
      const s = JSON.parse(localStorage.getItem("cursapp_session_v1")||"{}");
      const email = String(s.email || s.userId || "").toLowerCase().trim();
      return { email, userKey: String(s.userId || email || "").toLowerCase().trim() };
    }catch(e){ return { email:"", userKey:"" }; }
  }
  function createAviso(data){
    const avisos = loadAvisos().map(normalizeAviso);
    const next = normalizeAviso(Object.assign({}, data || {}, { courseScope: AVISOS_SCOPE }));
    if(next.dedupeKey && avisos.some(a => a.dedupeKey === next.dedupeKey)) return null;
    avisos.unshift(next);
    saveAvisos(avisos.slice(0,300));
    return next;
  }
  window.createAviso = createAviso;

  function isAvisoVisibleToMe(a){
    const ident = currentIdentity();
    const av = normalizeAviso(a);
    if(av.targetUserKey) return av.targetUserKey === ident.userKey;
    if(av.targetEmail) return av.targetEmail === ident.email;
    return true;
  }
  function isAvisoReadByMe(a){
    const ident = currentIdentity();
    const av = normalizeAviso(a);
    return !!(ident.userKey && av.readBy.includes(ident.userKey));
  }
  function visibleAvisos(){
    return loadAvisos().map(normalizeAviso).filter(isAvisoVisibleToMe)
      .sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
  }
  function markAvisoRead(id){
    const ident = currentIdentity();
    const avisos = loadAvisos().map(normalizeAviso);
    let changed = false;
    avisos.forEach(a=>{
      if(String(a.id)===String(id) && ident.userKey && !a.readBy.includes(ident.userKey)){
        a.readBy.push(ident.userKey); changed = true;
      }
    });
    if(changed) saveAvisos(avisos);
  }
  function formatAvisoDate(iso){
    try{
      return new Date(iso).toLocaleString("es-CL",{dateStyle:"short",timeStyle:"short"});
    }catch(e){ return ""; }
  }
  function tagForType(type){
    return ({
      info:"ℹ️", financial:"💳", report:"📊", campaign:"📌", urgent:"⚠️", payment:"✅"
    })[String(type||"info")] || "ℹ️";
  }

  function closeAvisosModal(){
    const mr = document.getElementById("modalRoot");
    if(mr) mr.innerHTML = "";
    const ov = document.getElementById("cursappAvisosConfigOverlay");
    if(ov) ov.remove();
    const inbox = document.getElementById("cursappAvisosInboxOverlay");
    if(inbox) inbox.remove();
  }
  window.closeAvisosModal = closeAvisosModal;

  window.renderAvisosBell = function(){
    const host = document.getElementById("avisosBellHost");
    if(!host) return;
    const unread = visibleAvisos().filter(a=>!isAvisoReadByMe(a)).length;
    host.innerHTML = `
      <button class="btn ghost" id="avisosBtn" type="button" aria-label="Avisos"
        style="position:absolute;right:68px;top:10px;z-index:10001;width:42px;height:42px;border-radius:999px;">
        ✉️
        ${unread>0 ? `<span style="position:absolute;top:-4px;right:-2px;min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:#7c3aed;color:#fff;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center;">${unread>9 ? "9+" : unread}</span>` : ``}
      </button>
    `;
    const btn = document.getElementById("avisosBtn");
    if(btn) btn.onclick = ()=> window.openAvisosInbox();
  };

  window.renderAvisosCursoCard = function(limit=3){
    const all = visibleAvisos();
    const avisos = all.slice(0, limit);
    return `
      <details class="cpV6Section" ${all.length ? "open" : ""}>
        <summary>
          <span><i>📣</i><b>Avisos del curso</b><em>${all.length ? "Información importante" : "Sin avisos nuevos"}</em></span>
          <strong>${all.length || ""}</strong><u>⌄</u>
        </summary>
        <div class="cpV6SectionBody">
          ${avisos.length ? avisos.map(a=>`
            <div class="cpV6ListItem">
              <div><b>${tagForType(a.category)} ${esc(a.title)}</b><small>${esc(a.message)} · ${formatAvisoDate(a.createdAt)}</small></div>
            </div>
          `).join("") : `<div class="muted">Aún no hay avisos publicados por la directiva.</div>`}
          ${all.length ? `<button class="cpV6SoftBtn" onclick="openAvisosInbox()">Ver avisos</button>` : ``}
        </div>
      </details>
    `;
  };

  window.openAvisosInbox = function(){
    const old = document.getElementById("cursappAvisosInboxOverlay");
    if(old) old.remove();
    const all = visibleAvisos();
    const ov = document.createElement("div");
    ov.id = "cursappAvisosInboxOverlay";
    ov.style.cssText = "position:fixed;inset:0;z-index:999998;background:rgba(15,23,42,.48);display:flex;align-items:flex-end;justify-content:center;padding:14px;";
    ov.innerHTML = `
      <div style="width:min(720px,100%);max-height:82vh;overflow:auto;background:#fff;border-radius:28px;padding:22px;box-shadow:0 30px 90px rgba(15,23,42,.30);font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,sans-serif;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
          <div><div style="font-size:24px;font-weight:950;color:#0f172a;">Avisos del curso</div><div style="color:#667085;margin-top:6px;font-weight:750;">Comunicados enviados por la directiva.</div></div>
          <button id="cerrarAvisosInbox" style="border:1px solid rgba(15,23,42,.08);background:#fff;border-radius:16px;padding:10px 13px;font-weight:950;color:#2563eb;">Cerrar</button>
        </div>
        <div style="margin-top:16px;display:grid;gap:10px;">
          ${all.length ? all.map(a=>`
            <div style="border:1px solid rgba(15,23,42,.08);border-radius:18px;padding:14px;background:#fff;">
              <div style="font-weight:950;color:#111827;">${tagForType(a.category)} ${esc(a.title)}</div>
              <div style="margin-top:6px;color:#667085;font-weight:700;line-height:1.35;">${esc(a.message)}</div>
              <div style="margin-top:8px;font-size:12px;color:#98a2b3;font-weight:800;">${formatAvisoDate(a.createdAt)}</div>
            </div>
          `).join("") : `<div style="color:#667085;font-weight:800;background:#f8fafc;border-radius:16px;padding:14px;">Aún no hay avisos.</div>`}
        </div>
      </div>
    `;
    document.body.appendChild(ov);
    document.getElementById("cerrarAvisosInbox").onclick = ()=>ov.remove();
    ov.addEventListener("click", e=>{ if(e.target===ov) ov.remove(); });
    all.forEach(a=>markAvisoRead(a.id));
    window.renderAvisosBell();
  };

  function openAvisosCursoSendModal(){
    const avisos = loadAvisos().map(normalizeAviso).filter(a=>a.type==="manual").sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
    const old = document.getElementById("cursappAvisosConfigOverlay");
    if(old) old.remove();

    const overlay = document.createElement("div");
    overlay.id = "cursappAvisosConfigOverlay";
    overlay.style.cssText = "position:fixed;inset:0;z-index:999999;background:rgba(15,23,42,.48);display:flex;align-items:flex-end;justify-content:center;padding:14px;";
    overlay.innerHTML = `
      <div style="width:min(720px,100%);max-height:86vh;overflow:auto;background:#fff;border-radius:28px;padding:22px;box-shadow:0 30px 90px rgba(15,23,42,.30);font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,sans-serif;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;">
          <div><div style="font-size:26px;font-weight:950;color:#0f172a;letter-spacing:-.03em;">Enviar aviso al curso</div><div style="color:#667085;margin-top:6px;font-weight:750;line-height:1.35;">Publica avisos visibles solo para este curso.</div><div style="color:#98a2b3;margin-top:4px;font-size:12px;font-weight:800;">Curso: ${esc(AVISOS_SCOPE)}</div></div>
          <button id="cerrarAvisosConfig" style="border:1px solid rgba(15,23,42,.08);background:#fff;border-radius:16px;padding:10px 13px;font-weight:950;color:#2563eb;">Cerrar</button>
        </div>
        <div id="avisoOkMsg" style="display:none;margin-top:14px;background:#dcfce7;color:#166534;border-radius:16px;padding:12px 14px;font-weight:950;">Aviso enviado correctamente ✅</div>
        <div style="margin-top:16px;display:grid;gap:12px;background:#fbfbff;border:1px solid rgba(124,58,237,.10);border-radius:22px;padding:14px;">
          <input id="av_title" placeholder="Título del aviso" style="width:100%;box-sizing:border-box;padding:15px;border-radius:16px;border:1px solid #e5e7eb;font-size:15px;font-weight:750;" />
          <textarea id="av_msg" placeholder="Escribe el mensaje para el curso..." style="width:100%;box-sizing:border-box;padding:15px;border-radius:16px;border:1px solid #e5e7eb;min-height:120px;font-size:15px;font-weight:750;font-family:inherit;"></textarea>
          <select id="av_type" style="width:100%;box-sizing:border-box;padding:15px;border-radius:16px;border:1px solid #e5e7eb;font-size:15px;font-weight:850;background:#fff;"><option value="info">ℹ️ Informativo</option><option value="financial">💳 Financiero</option><option value="report">📊 Informe</option><option value="campaign">📌 Campaña</option><option value="urgent">⚠️ Urgente</option></select>
          <button id="saveAvisoCursoBtn" style="border:none;border-radius:18px;padding:16px;font-size:16px;font-weight:950;color:white;background:linear-gradient(135deg,#7c3aed,#9333ea);box-shadow:0 16px 40px rgba(124,58,237,.30);">📢 Enviar aviso</button>
        </div>
        <div style="margin-top:18px;"><div style="font-size:17px;font-weight:950;margin-bottom:10px;color:#0f172a;">Avisos enviados en este curso</div><div style="display:grid;gap:10px;">${avisos.length ? avisos.map(a=>`<div style="border:1px solid rgba(15,23,42,.08);border-radius:18px;padding:14px;background:#fff;"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;"><div><div style="font-weight:950;color:#111827;">${tagForType(a.category)} ${esc(a.title||"Aviso")}</div><div style="margin-top:6px;color:#667085;font-weight:700;line-height:1.35;">${esc(a.message||"")}</div><div style="margin-top:8px;font-size:12px;color:#98a2b3;">${formatAvisoDate(a.createdAt)}</div></div><button data-del-aviso="${esc(a.id)}" style="border:0;background:#fee2e2;color:#b91c1c;border-radius:12px;padding:8px 10px;font-weight:900;">Eliminar</button></div></div>`).join("") : `<div style="color:#667085;font-weight:800;background:#f8fafc;border-radius:16px;padding:14px;">Aún no hay avisos enviados.</div>`}</div></div>
      </div>
    `;
    document.body.appendChild(overlay);
    const close = ()=> overlay.remove();
    document.getElementById("cerrarAvisosConfig").onclick = close;
    overlay.addEventListener("click", e=>{ if(e.target===overlay) close(); });
    document.getElementById("saveAvisoCursoBtn").onclick = ()=> window.saveAvisoCurso();
    overlay.querySelectorAll("[data-del-aviso]").forEach(btn=>{
      btn.onclick = ()=> window.deleteAvisoCurso(btn.getAttribute("data-del-aviso"));
    });
  }

  window.saveAvisoCurso = function(){
    const title = document.getElementById("av_title")?.value?.trim() || "";
    const message = document.getElementById("av_msg")?.value?.trim() || "";
    const category = document.getElementById("av_type")?.value || "info";
    if(!title || !message){ alert("Completa título y mensaje."); return; }
    createAviso({
      type:"manual", category, priority:category==="urgent" ? "high" : "normal",
      title, message, createdAt:new Date().toISOString(), courseScope:AVISOS_SCOPE
    });
    const ok = document.getElementById("avisoOkMsg");
    if(ok) ok.style.display = "block";
    setTimeout(()=>openAvisosCursoSendModal(), 500);
  };

  window.deleteAvisoCurso = function(id){
    saveAvisos(loadAvisos().map(normalizeAviso).filter(a=>String(a.id)!==String(id)));
    openAvisosCursoSendModal();
  };

  window.openAvisosCursoSendModal = openAvisosCursoSendModal;
  window.openAvisosConfigReal = openAvisosCursoSendModal;
  window.openAvisosConfig = openAvisosCursoSendModal;

  setTimeout(()=>{ window.openAvisosConfig = openAvisosCursoSendModal; }, 0);
  setTimeout(()=>{ window.openAvisosConfig = openAvisosCursoSendModal; }, 500);
  setTimeout(()=>{ window.openAvisosConfig = openAvisosCursoSendModal; }, 1500);

  document.addEventListener("DOMContentLoaded", ()=>{ try{ window.renderAvisosBell(); }catch(e){} });
})();
