
// Cursapp · Avisos del curso · fix v3 sin dependencia de openModal
(function(){
  const KEY = "cursapp_avisos_curso";

  function esc(s){
    return String(s ?? "").replace(/[&<>'"]/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"
    }[c]));
  }

  function load(){
    try{
      const arr = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(arr) ? arr : [];
    }catch(e){
      return [];
    }
  }

  function save(arr){
    localStorage.setItem(KEY, JSON.stringify(arr || []));
    try{
      window.dispatchEvent(new CustomEvent("cursapp:dataChanged", { detail:{ key: KEY }}));
    }catch(e){}
    try{
      if(window.renderAvisosBell) window.renderAvisosBell();
    }catch(e){}
  }

  function closeAvisosModal(){
    const old = document.getElementById("cursappAvisosOverlay");
    if(old) old.remove();
  }

  function renderHistory(){
    const box = document.getElementById("avisosEnviadosBox");
    if(!box) return;

    const avisos = load();
    box.innerHTML = `
      <div style="margin-top:18px;">
        <div style="font-size:17px;font-weight:950;margin-bottom:10px;color:#0f172a;">
          Avisos enviados
        </div>

        ${avisos.length ? avisos.map(a => `
          <div style="
            background:#fff;
            border:1px solid rgba(15,23,42,.08);
            border-radius:18px;
            padding:14px;
            margin-bottom:10px;
          ">
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
              <div>
                <div style="font-weight:950;color:#111827;">
                  ${esc(a.categoria)} · ${esc(a.titulo)}
                </div>
                <div style="margin-top:6px;color:#667085;font-weight:700;line-height:1.35;">
                  ${esc(a.mensaje)}
                </div>
              </div>
              <button data-del-aviso="${esc(a.id)}"
                style="border:0;background:#fee2e2;color:#b91c1c;border-radius:12px;padding:8px 10px;font-weight:900;">
                Eliminar
              </button>
            </div>
          </div>
        `).join("") : `
          <div style="color:#667085;font-weight:800;background:#f8fafc;border-radius:16px;padding:14px;">
            Aún no hay avisos enviados.
          </div>
        `}
      </div>
    `;

    box.querySelectorAll("[data-del-aviso]").forEach(btn=>{
      btn.onclick = ()=>{
        const id = btn.getAttribute("data-del-aviso");
        save(load().filter(a => String(a.id) !== String(id)));
        renderHistory();
      };
    });
  }

  function enviarAvisoCurso(){
    const titulo = document.getElementById("cursoAvisoTitulo")?.value?.trim();
    const mensaje = document.getElementById("cursoAvisoMensaje")?.value?.trim();
    const categoria = document.getElementById("cursoAvisoCategoria")?.value || "Informativo";

    if(!titulo || !mensaje){
      alert("Completa título y mensaje.");
      return;
    }

    const avisos = load();
    avisos.unshift({
      id: String(Date.now()),
      titulo,
      mensaje,
      categoria,
      fecha: new Date().toISOString()
    });
    save(avisos);

    document.getElementById("cursoAvisoTitulo").value = "";
    document.getElementById("cursoAvisoMensaje").value = "";
    renderHistory();

    const ok = document.getElementById("avisoOkMsg");
    if(ok){
      ok.style.display = "block";
      setTimeout(()=>{ ok.style.display = "none"; }, 2200);
    }
  }

  function openAvisosModal(){
    closeAvisosModal();

    const overlay = document.createElement("div");
    overlay.id = "cursappAvisosOverlay";
    overlay.style.cssText = `
      position:fixed;
      inset:0;
      z-index:999999;
      background:rgba(15,23,42,.48);
      display:flex;
      align-items:flex-end;
      justify-content:center;
      padding:14px;
    `;

    overlay.innerHTML = `
      <div style="
        width:min(720px,100%);
        max-height:86vh;
        overflow:auto;
        background:#fff;
        border-radius:28px;
        padding:22px;
        box-shadow:0 30px 90px rgba(15,23,42,.30);
        font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Arial,sans-serif;
      ">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;">
          <div>
            <div style="font-size:26px;font-weight:950;color:#0f172a;letter-spacing:-.03em;">
              Enviar aviso al curso
            </div>
            <div style="color:#667085;margin-top:6px;font-weight:750;line-height:1.35;">
              Publica avisos visibles para apoderados y directiva.
            </div>
          </div>

          <button id="cerrarAvisosCurso"
            style="border:1px solid rgba(15,23,42,.08);background:#fff;border-radius:16px;padding:10px 13px;font-weight:950;color:#2563eb;">
            Cerrar
          </button>
        </div>

        <div id="avisoOkMsg" style="
          display:none;
          margin-top:14px;
          background:#dcfce7;
          color:#166534;
          border-radius:16px;
          padding:12px 14px;
          font-weight:950;
        ">
          Aviso enviado correctamente ✅
        </div>

        <div style="
          margin-top:16px;
          display:grid;
          gap:12px;
          background:#fbfbff;
          border:1px solid rgba(124,58,237,.10);
          border-radius:22px;
          padding:14px;
        ">
          <input id="cursoAvisoTitulo"
            placeholder="Título del aviso"
            style="width:100%;box-sizing:border-box;padding:15px;border-radius:16px;border:1px solid #e5e7eb;font-size:15px;font-weight:750;" />

          <textarea id="cursoAvisoMensaje"
            placeholder="Escribe el mensaje para el curso..."
            style="width:100%;box-sizing:border-box;padding:15px;border-radius:16px;border:1px solid #e5e7eb;min-height:120px;font-size:15px;font-weight:750;font-family:inherit;"></textarea>

          <select id="cursoAvisoCategoria"
            style="width:100%;box-sizing:border-box;padding:15px;border-radius:16px;border:1px solid #e5e7eb;font-size:15px;font-weight:850;background:#fff;">
            <option value="ℹ️ Informativo">ℹ️ Informativo</option>
            <option value="📌 Campaña">📌 Campaña</option>
            <option value="💳 Pago">💳 Pago</option>
            <option value="⚠️ Urgente">⚠️ Urgente</option>
          </select>

          <button id="enviarAvisoCursoBtn"
            style="
              border:none;
              border-radius:18px;
              padding:16px;
              font-size:16px;
              font-weight:950;
              color:white;
              background:linear-gradient(135deg,#7c3aed,#9333ea);
              box-shadow:0 16px 40px rgba(124,58,237,.30);
            ">
            📢 Enviar aviso
          </button>
        </div>

        <div id="avisosEnviadosBox"></div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.getElementById("cerrarAvisosCurso").onclick = closeAvisosModal;
    document.getElementById("enviarAvisoCursoBtn").onclick = enviarAvisoCurso;

    overlay.addEventListener("click", function(e){
      if(e.target === overlay) closeAvisosModal();
    });

    renderHistory();
  }

  window.openAvisosConfig = openAvisosModal;
  window.openAvisosModal = openAvisosModal;
  window.enviarAvisoCurso = enviarAvisoCurso;
  window.closeAvisosModal = closeAvisosModal;
})();
