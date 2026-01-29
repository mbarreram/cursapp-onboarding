/* =========================================================
   Cursapp · apoderadoWelcome.js
   - Tutorial 1 vez (por curso) para apoderado
   ========================================================= */

(function(){
  const KEY_USER   = "cursapp_demo_user";
  const KEY_ACTIVE = "cursapp_active_course_v1";

  function loadJSON(k, def){
    try{ const v = localStorage.getItem(k); if(v==null) return def; return JSON.parse(v); }
    catch(e){ return def; }
  }

  function getUser(){ return loadJSON(KEY_USER, null); }
  function activeCourseKey(){ return localStorage.getItem(KEY_ACTIVE) || ""; }

  function seenKey(courseKey){
    return "cursapp_ap_tutorial_seen_" + (courseKey || "default");
  }

  function markSeen(courseKey){
    localStorage.setItem(seenKey(courseKey), "1");
  }

  function hasSeen(courseKey){
    return localStorage.getItem(seenKey(courseKey)) === "1";
  }

  function openModal(html){
    const root = document.getElementById("modalRoot");
    if(root){
      root.innerHTML = html;
      return;
    }
    // fallback: create root
    const div = document.createElement("div");
    div.id = "modalRoot";
    document.body.appendChild(div);
    div.innerHTML = html;
  }

  function closeModal(){
    const root = document.getElementById("modalRoot");
    if(root) root.innerHTML = "";
  }

  function renderTutorial(courseKey){
    let step = 0;

    const steps = [
      {
        title: "Bienvenido/a a Cursapp 👋",
        body: `
          <div class="muted" style="margin-top:8px;font-weight:800;line-height:1.45;">
            Cursapp ordena los cobros, campañas y rendiciones del curso.
            Aquí verás tus pagos y el estado de las campañas.
          </div>
        `,
      },
      {
        title: "¿Qué puedes hacer como apoderado? ✅",
        body: `
          <div style="margin-top:10px;display:grid;gap:10px;">
            <div class="card" style="padding:12px;">
              <div style="font-weight:950;">💳 Ver y pagar cobros</div>
              <div class="muted" style="margin-top:6px;font-weight:800;">Revisa pendientes, próximas y pagadas.</div>
            </div>
            <div class="card" style="padding:12px;">
              <div style="font-weight:950;">🧾 Ver comprobantes</div>
              <div class="muted" style="margin-top:6px;font-weight:800;">Cada pago puede tener comprobante.</div>
            </div>
            <div class="card" style="padding:12px;">
              <div style="font-weight:950;">📢 Ver campañas activas</div>
              <div class="muted" style="margin-top:6px;font-weight:800;">Metas, fechas y avances.</div>
            </div>
          </div>
        `,
      },
      {
        title: "Aprobación por directiva 🔒",
        body: `
          <div class="muted" style="margin-top:8px;font-weight:800;line-height:1.45;">
            Tu registro es revisado por la directiva para mantener el curso protegido.
            Si algo no aparece aún, puede ser que estén terminando la configuración.
          </div>

          <div class="card" style="margin-top:12px;padding:12px;border:1px solid rgba(91,92,226,.22);background:rgba(91,92,226,.06);">
            <div style="font-weight:950;">Tip</div>
            <div class="muted" style="margin-top:6px;font-weight:800;">
              Revisa la pestaña <b>Pagos</b> para ver tus cobros pendientes.
            </div>
          </div>
        `,
      },
    ];

    function draw(){
      const s = steps[step];
      const pct = Math.round(((step+1)/steps.length)*100);

      openModal(`
        <div style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:25000;display:flex;align-items:flex-end;justify-content:center;padding:14px;">
          <div class="card" style="width:min(720px,100%);margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;">
              <div>
                <div style="font-weight:950;font-size:18px;">${s.title}</div>
                <div class="muted" style="margin-top:4px;font-weight:800;">Paso ${step+1} de ${steps.length}</div>
              </div>
              <button class="btn ghost" type="button" id="btnSkip">Saltar</button>
            </div>

            <div style="margin-top:10px;height:10px;background:rgba(229,231,235,.9);border-radius:999px;overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:rgba(91,92,226,.85)"></div>
            </div>

            <div style="margin-top:12px;">
              ${s.body}
            </div>

            <div style="margin-top:14px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;">
              <button class="btn ghost" type="button" id="btnBack" ${step===0?"disabled":""}>Atrás</button>

              <div style="display:flex;gap:10px;">
                ${step < steps.length-1
                  ? `<button class="btn primary" type="button" id="btnNext">Continuar</button>`
                  : `<button class="btn primary" type="button" id="btnDone">Entendido</button>`
                }
              </div>
            </div>
          </div>
        </div>
      `);

      const root = document.getElementById("modalRoot");
      root.querySelector("#btnSkip").onclick = ()=>{
        markSeen(courseKey);
        closeModal();
      };

      const back = root.querySelector("#btnBack");
      if(back) back.onclick = ()=>{
        if(step>0){ step--; draw(); }
      };

      const next = root.querySelector("#btnNext");
      if(next) next.onclick = ()=>{
        if(step < steps.length-1){ step++; draw(); }
      };

      const done = root.querySelector("#btnDone");
      if(done) done.onclick = ()=>{
        markSeen(courseKey);
        closeModal();
      };
    }

    draw();
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    const u = getUser();
    if(!u || String(u.role||"").toLowerCase() !== "apoderado") return;

    const ck = activeCourseKey();
    if(!ck) return;

    if(hasSeen(ck)) return;

    // Muestra tutorial
    renderTutorial(ck);
  });
})();
