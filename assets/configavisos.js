
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
  const esc = (s)=>String(s??"").replace(/[&<>'"]/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[c]));
  const uid = (p="id") => `${p}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;

  function getSessionSafe(){
    try{
      if(window.CURSAPP && typeof window.CURSAPP.getSession === "function") return window.CURSAPP.getSession();
      return JSON.parse(localStorage.getItem("cursapp_session_v1")||"null");
    }catch(e){ return null; }
  }
  function getActiveProfileSafe(){
    try{
      if(typeof window.getActiveProfile === "function") return window.getActiveProfile();
      return null;
    }catch(e){ return null; }
  }
  function currentIdentity(){
    const s = getSessionSafe() || {};
    const p = getActiveProfileSafe() || {};
    const email = String(p?.apoderado?.email || p?.user?.email || s?.email || s?.userId || "").toLowerCase().trim();
    const userKey = String(s?.userId || p?.userId || p?.user?.userId || email || "").toLowerCase().trim();
    const role = String(p?.role || p?.user?.role || s?.role || "").toLowerCase().trim();
    return { email, userKey, role };
  }

  function loadAvisos(){
    try{
      const arr = JSON.parse(localStorage.getItem(KEY_AVISOS)||"[]");
      return Array.isArray(arr) ? arr : [];
    }catch(e){ return []; }
  }
  function saveAvisos(arr){
    localStorage.setItem(KEY_AVISOS, JSON.stringify(arr||[]));
    try{ window.dispatchEvent(new CustomEvent('cursapp:dataChanged', { detail: { key: KEY_AVISOS } })); }catch(e){}
  }
  function normalizeAviso(a){
    return {
      id: String(a?.id || uid("av")),
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
      dedupeKey: String(a?.dedupeKey || "")
    };
  }
  function createAviso(data){
    const avisos = loadAvisos().map(normalizeAviso);
    const next = normalizeAviso(data);
    if(next.dedupeKey && avisos.some(a => a.dedupeKey === next.dedupeKey)) return null;
    avisos.unshift(next);
    saveAvisos(avisos.slice(0, 300));
    return next;
  }

  window.createAviso = createAviso;
  function markAvisoRead(id){
    const ident = currentIdentity();
    const avisos = loadAvisos().map(normalizeAviso);
    let changed = false;
    avisos.forEach(a=>{
      if(String(a.id)===String(id) && ident.userKey){
        if(!a.readBy.includes(ident.userKey)){
          a.readBy.push(ident.userKey);
          changed = true;
        }
      }
    });
    if(changed) saveAvisos(avisos);
  }
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
    return !!(ident.userKey && Array.isArray(av.readBy) && av.readBy.includes(ident.userKey));
  }
  function visibleAvisos(){
    return loadAvisos().map(normalizeAviso).filter(isAvisoVisibleToMe)
      .sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
  }

  function formatAvisoDate(iso){
    try{
      if(!iso) return "";
      const d = new Date(iso);
      if(isNaN(d.getTime())) return "";
      return "Enviado " + d.toLocaleString("es-CL", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
    }catch(e){ return ""; }
  }
  function monthLabel(ym){
    try{
      const [y,m] = String(ym||"").split("-").map(Number);
      const d = new Date(y, (m||1)-1, 1);
      return d.toLocaleString("es-CL", { month:"long", year:"numeric" });
    }catch(e){ return ym||""; }
  }
  function tagForType(type){
    const t = String(type||"info");
    if(t==="financial") return "💳";
    if(t==="report") return "📊";
    if(t==="campaign") return "📢";
    if(t==="payment") return "✅";
    if(t==="urgent") return "⚠️";
    return "ℹ️";
  }
  function renderAvisoCard(a, clickable=true){
    const unread = !isAvisoReadByMe(a);
    const action = clickable ? `onclick="openAvisoAction('${esc(a.id)}')"` : '';
    return `
      <div ${action} style="border:1px solid rgba(0,0,0,.08);border-radius:14px;padding:10px;background:#fff;${clickable?'cursor:pointer;':''}">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
          <div style="min-width:0;">
            <div style="font-weight:900;">${tagForType(a.category)} ${esc(a.title||"Aviso")} ${unread?'<span class="tag" style="margin-left:6px;">Nuevo</span>':''}</div>
            <div class="muted" style="margin-top:4px;line-height:1.35;">${esc(a.message||"")}</div>
          </div>
        </div>
        <div class="muted" style="margin-top:8px;font-size:12px;text-align:right;">${formatAvisoDate(a.createdAt)}</div>
      </div>
    `;
  }

  window.renderAvisosBell = function(){
    const host = document.getElementById("avisosBellHost");
    if(!host) return;
    const unread = visibleAvisos().filter(a=>!isAvisoReadByMe(a)).length;
    host.innerHTML = `
      <button class="btn ghost" id="avisosBtn" type="button" aria-label="Avisos"
        style="position:absolute;right:68px;top:10px;z-index:10001;width:42px;height:42px;border-radius:999px;">
        ✉️
        ${unread>0 ? `<span style="position:absolute;top:-4px;right:-2px;min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:#dc2626;color:#fff;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center;">${unread>9 ? '9+' : unread}</span>` : ``}
      </button>
    `;
    const btn = document.getElementById("avisosBtn");
    if(btn) btn.onclick = ()=> window.openAvisosInbox();
  };

  function closeAvisosModal(){
    const mr = document.getElementById("modalRoot");
    if(mr) mr.innerHTML = "";
    const ov = document.getElementById("cursappAvisosConfigOverlay");
    if(ov) ov.remove();
    const ov2 = document.getElementById("cursappAvisosInboxOverlay");
    if(ov2) ov2.remove();
  }
  window.closeAvisosModal = closeAvisosModal;

  window.renderAvisosCursoCard = function(limit=3){
    const all = visibleAvisos();
    const now = new Date();
    const curYM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    const current = all.filter(a => String(a.createdAt||"").slice(0,7) === curYM);
    const older = all.filter(a => String(a.createdAt||"").slice(0,7) !== curYM);
    const avisos = current.slice(0, limit);
    const extraCurrent = Math.max(0, current.length - limit);

    return `
      <div class="card" style="margin-top:12px;">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">
          <div class="kTitle">📢 Avisos del curso</div>
          <span class="tag">${all.length ? `${all.length} aviso(s)` : `Sin avisos`}</span>
        </div>
        <div class="muted" style="margin-top:6px;">Información importante del curso y de la directiva.</div>
        <div style="margin-top:10px;display:grid;gap:10px;">
          ${avisos.length ? avisos.map(a=>renderAvisoCard(a)).join("") : `<div class="muted">No hay avisos nuevos de este mes.</div>`}
        </div>
        ${(extraCurrent>0 || older.length>0) ? `
          <div style="margin-top:12px;display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;">
            ${extraCurrent>0 ? `<button class="btnx" onclick="openAvisosMesActual()">Ver más de este mes</button>` : ``}
            ${older.length>0 ? `<button class="btnx" onclick="openAvisosAnteriores()">Ver avisos anteriores</button>` : ``}
          </div>
        ` : ``}
      </div>
    `;
  };

  window.openAvisosMesActual = function(){
    const all = visibleAvisos();
    const now = new Date();
    const curYM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    const current = all.filter(a => String(a.createdAt||"").slice(0,7) === curYM);
    const mr = document.getElementById("modalRoot");
    if(!mr){ alert("No se encontró modalRoot."); return; }
    mr.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;">
        <div class="card" style="width:min(720px,100%);max-height:85vh;overflow:auto;">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
            <div class="kTitle">📢 Avisos de ${monthLabel(curYM)}</div>
            <button class="btnx" onclick="closeAvisosModal()">Cerrar</button>
          </div>
          <div style="margin-top:12px;display:grid;gap:10px;">
            ${current.length ? current.map(a=>renderAvisoCard(a)).join("") : `<div class="muted">No hay avisos de este mes.</div>`}
          </div>
        </div>
      </div>
    `;
  };

  window.openAvisosAnteriores = function(){
    const all = visibleAvisos();
    const now = new Date();
    const curYM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    const older = all.filter(a => String(a.createdAt||"").slice(0,7) !== curYM);
    const grouped = {};
    older.forEach(a=>{
      const ym = String(a.createdAt||"").slice(0,7) || "Sin fecha";
      (grouped[ym] ||= []).push(a);
    });
    const months = Object.keys(grouped).sort((a,b)=>b.localeCompare(a));
    const mr = document.getElementById("modalRoot");
    if(!mr){ alert("No se encontró modalRoot."); return; }
    mr.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;">
        <div class="card" style="width:min(720px,100%);max-height:85vh;overflow:auto;">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
            <div class="kTitle">📚 Avisos anteriores</div>
            <button class="btnx" onclick="closeAvisosModal()">Cerrar</button>
          </div>
          <div style="margin-top:12px;display:grid;gap:14px;">
            ${months.length ? months.map(ym=>`
              <div>
                <div style="font-weight:900;margin-bottom:8px;text-transform:capitalize;">${monthLabel(ym)}</div>
                <div style="display:grid;gap:10px;">
                  ${grouped[ym].map(a=>renderAvisoCard(a)).join("")}
                </div>
              </div>
            `).join("") : `<div class="muted">No hay avisos anteriores.</div>`}
          </div>
        </div>
      </div>
    `;
  };

  window.openAvisosInbox = function(){
    const all = visibleAvisos();
    const unread = all.filter(a=>!isAvisoReadByMe(a));
    const current = all.filter(a => String(a.createdAt||"").slice(0,7) === new Date().toISOString().slice(0,7));
    const older = all.filter(a => String(a.createdAt||"").slice(0,7) !== new Date().toISOString().slice(0,7));
    const mr = document.getElementById("modalRoot");
    if(!mr){ alert("No se encontró modalRoot."); return; }
    mr.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;">
        <div class="card" style="width:min(720px,100%);max-height:85vh;overflow:auto;">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
            <div class="kTitle">✉️ Centro de avisos</div>
            <button class="btnx" onclick="closeAvisosModal()">Cerrar</button>
          </div>
          <div style="margin-top:12px;display:grid;gap:14px;">
            <div>
              <div style="font-weight:900;margin-bottom:8px;">Nuevos</div>
              <div style="display:grid;gap:10px;">${unread.length ? unread.map(a=>renderAvisoCard(a)).join("") : `<div class="muted">No tienes avisos nuevos.</div>`}</div>
            </div>
            <div>
              <div style="font-weight:900;margin-bottom:8px;">Este mes</div>
              <div style="display:grid;gap:10px;">${current.length ? current.slice(0,6).map(a=>renderAvisoCard(a)).join("") : `<div class="muted">Sin avisos este mes.</div>`}</div>
            </div>
            ${older.length ? `<div><div style="font-weight:900;margin-bottom:8px;">Anteriores</div><button class="btnx" onclick="openAvisosAnteriores()">Ver agrupados por mes</button></div>` : ``}
          </div>
        </div>
      </div>
    `;
  };

  window.openAvisoAction = function(id){
    const all = visibleAvisos();
    const a = all.find(x => String(x.id) === String(id));
    if(!a) return;
    markAvisoRead(a.id);
    renderAvisosBell();

    const type = String(a.actionType || "");
    const payload = a.actionPayload || {};
    if(type === "open_receipt" && payload.paymentId && typeof window.openReceipt === "function"){
      closeAvisosModal();
      window.go && window.go("payments");
      setTimeout(()=> window.openReceipt(payload.paymentId), 80);
      return;
    }
    if(type === "open_payments"){
      closeAvisosModal();
      window.go && window.go("payments");
      return;
    }
    if(type === "open_report"){
      closeAvisosModal();
      window.go && window.go("informes");
      return;
    }
    closeAvisosModal();
  };

  window.openAvisosConfig = function(){
    const avisos = loadAvisos().map(normalizeAviso).filter(a=>a.type==="manual").sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));

    const old = document.getElementById("cursappAvisosConfigOverlay");
    if(old) old.remove();

    const overlay = document.createElement("div");
    overlay.id = "cursappAvisosConfigOverlay";
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:999999;background:rgba(15,23,42,.48);
      display:flex;align-items:flex-end;justify-content:center;padding:14px;
    `;

    overlay.innerHTML = `
      <div style="
        width:min(720px,100%);max-height:86vh;overflow:auto;background:#fff;border-radius:28px;
        padding:22px;box-shadow:0 30px 90px rgba(15,23,42,.30);
        font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,sans-serif;
      ">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;">
          <div>
            <div style="font-size:26px;font-weight:950;color:#0f172a;letter-spacing:-.03em;">Enviar aviso al curso</div>
            <div style="color:#667085;margin-top:6px;font-weight:750;line-height:1.35;">Publica avisos visibles solo para este curso.</div>
            <div style="color:#98a2b3;margin-top:4px;font-size:12px;font-weight:800;">Curso: ${esc(AVISOS_SCOPE)}</div>
          </div>
          <button id="cerrarAvisosConfig" style="border:1px solid rgba(15,23,42,.08);background:#fff;border-radius:16px;padding:10px 13px;font-weight:950;color:#2563eb;">Cerrar</button>
        </div>

        <div id="avisoOkMsg" style="display:none;margin-top:14px;background:#dcfce7;color:#166534;border-radius:16px;padding:12px 14px;font-weight:950;">Aviso enviado correctamente ✅</div>

        <div style="margin-top:16px;display:grid;gap:12px;background:#fbfbff;border:1px solid rgba(124,58,237,.10);border-radius:22px;padding:14px;">
          <input id="av_title" placeholder="Título del aviso" style="width:100%;box-sizing:border-box;padding:15px;border-radius:16px;border:1px solid #e5e7eb;font-size:15px;font-weight:750;" />
          <textarea id="av_msg" placeholder="Escribe el mensaje para el curso..." style="width:100%;box-sizing:border-box;padding:15px;border-radius:16px;border:1px solid #e5e7eb;min-height:120px;font-size:15px;font-weight:750;font-family:inherit;"></textarea>
          <select id="av_type" style="width:100%;box-sizing:border-box;padding:15px;border-radius:16px;border:1px solid #e5e7eb;font-size:15px;font-weight:850;background:#fff;">
            <option value="info">ℹ️ Informativo</option>
            <option value="financial">💳 Financiero</option>
            <option value="report">📊 Informe</option>
            <option value="campaign">📌 Campaña</option>
            <option value="urgent">⚠️ Urgente</option>
          </select>
          <button id="saveAvisoCursoBtn" style="border:none;border-radius:18px;padding:16px;font-size:16px;font-weight:950;color:white;background:linear-gradient(135deg,#7c3aed,#9333ea);box-shadow:0 16px 40px rgba(124,58,237,.30);">📢 Enviar aviso</button>
        </div>

        <div style="margin-top:18px;">
          <div style="font-size:17px;font-weight:950;margin-bottom:10px;color:#0f172a;">Avisos enviados en este curso</div>
          <div style="display:grid;gap:10px;">
            ${avisos.length ? avisos.map(a=>`
              <div style="border:1px solid rgba(15,23,42,.08);border-radius:18px;padding:14px;background:#fff;">
                <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
                  <div>
                    <div style="font-weight:950;color:#111827;">${tagForType(a.category)} ${esc(a.title||"Aviso")}</div>
                    <div class="muted" style="margin-top:6px;color:#667085;font-weight:700;line-height:1.35;">${esc(a.message||"")}</div>
                    <div class="muted" style="margin-top:8px;font-size:12px;color:#98a2b3;">${formatAvisoDate(a.createdAt)}</div>
                  </div>
                  <button data-del-aviso="${esc(a.id)}" style="border:0;background:#fee2e2;color:#b91c1c;border-radius:12px;padding:8px 10px;font-weight:900;">Eliminar</button>
                </div>
              </div>
            `).join("") : `<div style="color:#667085;font-weight:800;background:#f8fafc;border-radius:16px;padding:14px;">Aún no hay avisos enviados.</div>`}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    const close = ()=> overlay.remove();
    document.getElementById("cerrarAvisosConfig").onclick = close;
    overlay.addEventListener("click", (e)=>{ if(e.target === overlay) close(); });
    document.getElementById("saveAvisoCursoBtn").onclick = ()=> window.saveAvisoCurso();

    overlay.querySelectorAll("[data-del-aviso]").forEach(btn=>{
      btn.onclick = ()=>{
        const id = btn.getAttribute("data-del-aviso");
        window.deleteAvisoCurso(id);
      };
    });
  };

  window.saveAvisoCurso = function(){
    const title = document.getElementById('av_title')?.value?.trim() || '';
    const message = document.getElementById('av_msg')?.value?.trim() || '';
    const category = document.getElementById('av_type')?.value || 'info';
    if(!title || !message){ alert('Completa título y mensaje.'); return; }
    createAviso({
      type: "manual",
      category,
      priority: category==="urgent" ? "high" : "normal",
      title, message,
      createdAt: new Date().toISOString(),
      courseScope: AVISOS_SCOPE
    });

    try{
      const ok = document.getElementById("avisoOkMsg");
      if(ok) ok.style.display = "block";
    }catch(e){}

    setTimeout(()=>openAvisosConfig(), 500);
  };

  window.deleteAvisoCurso = function(id){
    const avisos = loadAvisos().map(normalizeAviso).filter(a=>String(a.id)!==String(id));
    saveAvisos(avisos);
    openAvisosConfig();
  };

  window.runAutoAvisosContext = function(ctx){
    try{
      const payments = Array.isArray(ctx?.payments) ? ctx.payments : [];
      const reports = Array.isArray(ctx?.reports) ? ctx.reports : [];
      // Pago registrado / comprobante
      payments.forEach(p=>{
        const st = String(p?.status || "").toLowerCase();
        if(st === "paid" && p?.id){
          createAviso({
            type: "auto",
            category: "payment",
            priority: "normal",
            title: "✅ Se registró tu pago",
            message: `${String(p?.concept || "Pago")} · ${new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(Number(p?.amount || p?.amountRemaining || 0))}`,
            targetEmail: String(p?.apoderadoEmail || p?.email || "").toLowerCase(),
            createdAt: String(p?.paidAt || p?.createdAt || new Date().toISOString()),
            actionType: "open_receipt",
            actionPayload: { paymentId: p.id },
            dedupeKey: `payreg:${p.id}`
          });
        }
      });

      payments.forEach(p=>{
        const st = String(p?.status || "").toLowerCase();
        if(st !== "pending" && st !== "partial") return;
        if(String(p?.status||"").toLowerCase()==="opted_out") return;
        const due = String(p?.dueDate || "").slice(0,10);
        if(!due) return;
        const days = Math.floor((new Date(due+"T00:00:00").getTime() - new Date(new Date().toISOString().slice(0,10)+"T00:00:00").getTime())/86400000);
        if(![7,3,1,0,-1].includes(days)) return;
        let title = "⏰ Tu cuota vence pronto";
        let message = `${String(p?.concept || "Pago")} · vence ${days===0 ? "hoy" : (days<0 ? "vencida" : `en ${days} día(s)`)}`;
        let priority = "normal";
        if(days<=0){ title = "🔴 Tienes una cuota por revisar"; priority="high"; }
        createAviso({
          type:"auto",
          category: days<=0 ? "urgent" : "financial",
          priority,
          title,
          message,
          targetEmail: String(p?.apoderadoEmail || p?.email || "").toLowerCase(),
          createdAt: new Date().toISOString(),
          actionType: "open_payments",
          actionPayload: { paymentId: p.id },
          dedupeKey: `due:${p.id}:${days}`
        });
      });

      reports.forEach(r=>{
        const key = String(r?.id || r?.period || "");
        if(!key) return;
        createAviso({
          type:"auto",
          category:"report",
          priority:"normal",
          title:"📊 Nuevo informe disponible",
          message:`Ya puedes revisar el informe ${String(r?.period || "")}.`,
          createdAt: String(r?.generatedAt || new Date().toISOString()),
          actionType:"open_report",
          dedupeKey:`report:${key}`
        });
      });

      renderAvisosBell();
    }catch(e){
      console.error("runAutoAvisosContext", e);
    }
  };
})();
