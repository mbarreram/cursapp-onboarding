
(function(){
  const sk = (base)=> (window.CURSAPP && window.CURSAPP.scopedKey) ? window.CURSAPP.scopedKey(base) : `cursapp_${base}`;
  const KEY_AVISOS = sk("avisos_v1");
  const esc = (s)=>String(s??"").replace(/[&<>'"]/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[c]));
  const uid = (p="id") => `${p}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;

  function loadAvisos(){ try{ const arr = JSON.parse(localStorage.getItem(KEY_AVISOS)||"[]"); return Array.isArray(arr) ? arr : []; }catch(e){ return []; } }
  function saveAvisos(arr){
    localStorage.setItem(KEY_AVISOS, JSON.stringify(arr||[]));
    try{ window.dispatchEvent(new CustomEvent('cursapp:dataChanged', { detail: { key: KEY_AVISOS } })); }catch(e){}
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
    const avisos = loadAvisos().slice().sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||""))).slice(0,limit);
    return `
      <div class="card" style="margin-top:12px;">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">
          <div class="kTitle">📢 Avisos del curso</div>
          <span class="tag">${avisos.length ? `${avisos.length} aviso(s)` : `Sin avisos`}</span>
        </div>
        <div class="muted" style="margin-top:6px;">Información importante del curso y de la directiva.</div>
        <div style="margin-top:10px;display:grid;gap:10px;">
          ${avisos.length ? avisos.map(a=>`
            <div style="border:1px solid rgba(0,0,0,.08);border-radius:14px;padding:10px;background:#fff;">
              <div style="font-weight:900;">${tagForType(a.type)} ${esc(a.title||"Aviso")}</div>
              <div class="muted" style="margin-top:4px;line-height:1.35;">${esc(a.message||"")}</div>
            </div>
          `).join("") : `<div class="muted">No hay avisos nuevos por ahora.</div>`}
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
