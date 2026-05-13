
// FIX ROUTING AVISOS PRESIDENTE
(function(){
  function ensureAvisosUI(){
    if(window.__cursappAvisosFixed) return;
    window.__cursappAvisosFixed = true;

    window.openAvisosModal = function(){
      const html = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <div>
            <div style="font-size:30px;font-weight:900;color:#0f172a;">Enviar aviso al curso</div>
            <div style="color:#667085;margin-top:6px;">
              Publica avisos visibles para apoderados y directiva.
            </div>
          </div>
          <button onclick="closeModal && closeModal()" style="border:none;background:#f3f4f6;border-radius:14px;padding:10px 14px;font-weight:700;">✕</button>
        </div>

        <div style="display:grid;gap:12px;">
          <input id="cursoAvisoTitulo"
            placeholder="Título del aviso"
            style="padding:16px;border-radius:16px;border:1px solid #e5e7eb;font-size:16px;" />

          <textarea id="cursoAvisoMensaje"
            placeholder="Escribe el mensaje para el curso..."
            style="padding:16px;border-radius:16px;border:1px solid #e5e7eb;min-height:140px;font-size:16px;"></textarea>

          <select id="cursoAvisoCategoria"
            style="padding:16px;border-radius:16px;border:1px solid #e5e7eb;font-size:16px;">
            <option value="Informativo">ℹ️ Informativo</option>
            <option value="Campaña">📌 Campaña</option>
            <option value="Pago">💳 Pago</option>
            <option value="Urgente">⚠️ Urgente</option>
          </select>

          <button onclick="window.enviarAvisoCurso()"
            style="
              border:none;
              border-radius:18px;
              padding:18px;
              font-size:18px;
              font-weight:900;
              color:white;
              background:linear-gradient(135deg,#7c3aed,#9333ea);
              box-shadow:0 16px 40px rgba(124,58,237,.30);
            ">
            📢 Enviar aviso
          </button>

          <div id="avisosEnviadosBox"></div>
        </div>
      `;

      if(typeof openModal === 'function'){
        openModal(html);
      }else{
        alert('Modal no disponible');
      }

      renderAvisosEnviados();
    };

    window.enviarAvisoCurso = function(){
      const titulo = document.getElementById('cursoAvisoTitulo')?.value?.trim();
      const mensaje = document.getElementById('cursoAvisoMensaje')?.value?.trim();
      const categoria = document.getElementById('cursoAvisoCategoria')?.value || 'Informativo';

      if(!titulo || !mensaje){
        alert('Completa título y mensaje');
        return;
      }

      const KEY = 'cursapp_avisos_curso';
      let avisos = [];
      try{
        avisos = JSON.parse(localStorage.getItem(KEY) || '[]');
      }catch(e){}

      avisos.unshift({
        id: Date.now(),
        titulo,
        mensaje,
        categoria,
        fecha: new Date().toISOString()
      });

      localStorage.setItem(KEY, JSON.stringify(avisos));

      alert('Aviso enviado correctamente ✅');

      document.getElementById('cursoAvisoTitulo').value = '';
      document.getElementById('cursoAvisoMensaje').value = '';

      renderAvisosEnviados();
    };

    function renderAvisosEnviados(){
      const box = document.getElementById('avisosEnviadosBox');
      if(!box) return;

      const KEY = 'cursapp_avisos_curso';
      let avisos = [];
      try{
        avisos = JSON.parse(localStorage.getItem(KEY) || '[]');
      }catch(e){}

      box.innerHTML = `
        <div style="margin-top:12px;">
          <div style="font-size:20px;font-weight:900;margin-bottom:10px;">
            Avisos enviados
          </div>

          ${avisos.length ? avisos.map(a => `
            <div style="
              background:white;
              border:1px solid #ececf2;
              border-radius:18px;
              padding:14px;
              margin-bottom:10px;
            ">
              <div style="font-weight:900;color:#111827;">
                ${a.categoria} · ${a.titulo}
              </div>

              <div style="margin-top:6px;color:#667085;">
                ${a.mensaje}
              </div>
            </div>
          `).join('') : `
            <div style="color:#667085;">
              Aún no hay avisos enviados.
            </div>
          `}
        </div>
      `;
    }

    window.openAvisosConfig = window.openAvisosModal;
  }

  ensureAvisosUI();
})();
