
(function(){
  const sk = (base)=> (window.CURSAPP && window.CURSAPP.scopedKey) ? window.CURSAPP.scopedKey(base) : `cursapp_${base}`;
  const KEY_AVISOS = sk("avisos_v1");
  const esc = (s)=>String(s??"").replace(/[&<>'"]/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[c]));
  const uid = (p="id") => `${p}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;

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
  function formatAvisoDate(iso){
    try{
      if(!iso) return "";
      const d = new Date(iso);
      if(isNaN(d.getTime())) return "";
      return "Enviado " + d.toLocaleString("es-CL", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
    }catch(e){ return ""; }
  }
  function tagForType(type){
    const t = String(type||"info");
    if(t==="financial") return "💳";
    if(t==="report") return "📊";
    if(t==="campaign") return "📢";
    if(t==="urgent") return "⚠️";
    return "ℹ️";
  }

  window.renderAvisosCursoCard = function(limit=3){
    const all = loadAvisos().slice().sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
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
          ${avisos.length ? avisos.map(a=>`
            <div style="border:1px solid rgba(0,0,0,.08);border-radius:14px;padding:10px;background:#fff;">
              <div style="font-weight:900;">${tagForType(a.type)} ${esc(a.title||"Aviso")}</div>
              <div class="muted" style="margin-top:4px;line-height:1.35;">${esc(a.message||"")}</div>
              <div class="muted" style="margin-top:8px;font-size:12px;text-align:right;">${formatAvisoDate(a.createdAt)}</div>
            </div>
          `).join("") : `<div class="muted">No hay avisos nuevos de este mes.</div>`}
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


  function monthLabel(ym){
    try{
      const [y,m] = String(ym||"").split("-").map(Number);
      const d = new Date(y, (m||1)-1, 1);
      return d.toLocaleString("es-CL", { month:"long", year:"numeric" });
    }catch(e){ return ym||""; }
  }

  function renderAvisoCard(a){
    return `
      <div style="border:1px solid rgba(0,0,0,.08);border-radius:14px;padding:10px;background:#fff;">
        <div style="font-weight:900;">${tagForType(a.type)} ${esc(a.title||"Aviso")}</div>
        <div class="muted" style="margin-top:4px;line-height:1.35;">${esc(a.message||"")}</div>
        <div class="muted" style="margin-top:8px;font-size:12px;text-align:right;">${formatAvisoDate(a.createdAt)}</div>
      </div>
    `;
  }

  window.openAvisosMesActual = function(){
    const all = loadAvisos().slice().sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
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
            ${current.length ? current.map(renderAvisoCard).join("") : `<div class="muted">No hay avisos de este mes.</div>`}
          </div>
        </div>
      </div>
    `;
  };

  window.openAvisosAnteriores = function(){
    const all = loadAvisos().slice().sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
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
                  ${grouped[ym].map(renderAvisoCard).join("")}
                </div>
              </div>
            `).join("") : `<div class="muted">No hay avisos anteriores.</div>`}
          </div>
        </div>
      </div>
    `;
  };

  function closeAvisosModal(){
    const mr = document.getElementById("modalRoot");
    if(mr) mr.innerHTML = "";
  }
  window.closeAvisosModal = closeAvisosModal;

  window.openAvisosConfig = function(){
    const avisos = loadAvisos().slice().sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
    const mr = document.getElementById("modalRoot");
    if(!mr){ alert("No se encontró modalRoot."); return; }
    mr.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;">
        <div class="card" style="width:min(720px,100%);max-height:85vh;overflow:auto;">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
            <div class="kTitle">📢 Configurar avisos</div>
            <button class="btnx" onclick="closeAvisosModal()">Cerrar</button>
          </div>

          <div style="margin-top:12px;display:grid;gap:10px;">
            <input id="av_title" placeholder="Título aviso" />
            <textarea id="av_msg" placeholder="Mensaje" style="min-height:100px;padding:12px;border-radius:12px;border:1px solid rgba(15,23,42,.10);"></textarea>
            <select id="av_type">
              <option value="info">ℹ️ Informativo</option>
              <option value="financial">💳 Financiero</option>
              <option value="report">📊 Informe</option>
              <option value="campaign">📢 Campaña</option>
              <option value="urgent">⚠️ Urgente</option>
            </select>
            <div style="display:flex;justify-content:flex-end;">
              <button class="btnx primary" onclick="saveAvisoCurso()">Guardar aviso</button>
            </div>
          </div>

          <div style="margin-top:14px;border-top:1px solid rgba(0,0,0,.08);padding-top:12px;">
            <div style="font-weight:900;">Avisos existentes</div>
            <div style="margin-top:10px;display:grid;gap:10px;">
              ${avisos.length ? avisos.map(a=>`
                <div style="border:1px solid rgba(0,0,0,.08);border-radius:14px;padding:10px;background:#fff;">
                  <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
                    <div>
                      <div style="font-weight:900;">${tagForType(a.type)} ${esc(a.title||"Aviso")}</div>
                      <div class="muted" style="margin-top:4px;">${esc(a.message||"")}</div>
                      <div class="muted" style="margin-top:8px;font-size:12px;">${formatAvisoDate(a.createdAt)}</div>
                    </div>
                    <button class="btnx danger" onclick="deleteAvisoCurso('${esc(a.id)}')">Eliminar</button>
                  </div>
                </div>
              `).join("") : `<div class="muted">Aún no hay avisos.</div>`}
            </div>
          </div>
        </div>
      </div>
    `;
  };

  window.saveAvisoCurso = function(){
    const title = document.getElementById('av_title')?.value?.trim() || '';
    const message = document.getElementById('av_msg')?.value?.trim() || '';
    const type = document.getElementById('av_type')?.value || 'info';
    if(!title || !message){ alert('Completa título y mensaje.'); return; }
    const avisos = loadAvisos();
    avisos.unshift({ id: uid('av'), title, message, type, createdAt: new Date().toISOString() });
    saveAvisos(avisos.slice(0,20));
    openAvisosConfig();
  };

  window.deleteAvisoCurso = function(id){
    const avisos = loadAvisos().filter(a=>String(a.id)!==String(id));
    saveAvisos(avisos);
    openAvisosConfig();
  };
})();
