/* =========================================================
   Cursapp Â· Campaigns (Shared) â€” v1.0
   Fuente de verdad para:
   - Crear campaÃ±a (FULL): tipo, monto, cuotas/meses, participaciÃ³n, fechas
   - Editar campaÃ±a (FULL)
   - Cerrar campaÃ±a (tipo + motivo)
   - CÃ¡lculo automÃ¡tico de fecha fin para mensual (cuotas)
   - Marca "requiere nuevo informe" (dirty) automÃ¡ticamente

   DiseÃ±ado para ser usado por Presidente y Tesorero (y otros).
   Requiere:
   - <div id="modalRoot"></div> en el HTML
========================================================= */

(function () {
  // Prefer curso-scoped keys when config.js is present (prod-ready demo)
  const sk = (window.CURSAPP && typeof window.CURSAPP.scopedKey === "function")
    ? window.CURSAPP.scopedKey
    : (k) => k;

  function detectKey(candidates) {
    for (const k of candidates) if (localStorage.getItem(k) != null) return k;
    return "";
  }

  // ---- Cotizaciones helpers (compat + dedupe) ----
  function normalizeCot(c){
    return {
      nombre: String(c?.nombre || c?.title || c?.name || "").trim(),
      url: String(c?.url || c?.link || "").trim(),
      monto_total: Number(c?.monto_total ?? c?.monto ?? c?.total ?? 0),
      descripcion: String(c?.descripcion || c?.comentario || c?.texto || c?.desc || c?.description || "").trim(),
    };
  }
  function dedupeCotizaciones(list){
    const arr = (Array.isArray(list) ? list : []).map(normalizeCot).filter(c=>c.nombre || c.url || c.monto_total || c.descripcion);
    const seen = new Set();
    const out = [];
    arr.forEach(c=>{
      const key = [c.nombre, c.monto_total, c.url, c.descripcion].join("|").toLowerCase();
      if(seen.has(key)) return;
      seen.add(key);
      out.push(c);
    });
    return out;
  }


  // âœ… Use course-scoped tasks key if available; fallback to legacy keys for existing demos
  const SCOPED_TASKS = sk("tasks_v1");
  const KEY_TASKS =
    (localStorage.getItem(SCOPED_TASKS) != null
      ? SCOPED_TASKS
      : (detectKey(["cursapp_tasks_v1", "tasks", "campanas", "cursapp_campaigns_v1"]) || SCOPED_TASKS));
  const KEY_DIRTY =
    detectKey(["cursapp_reports_dirty_v1", "reportsDirty", "cursapp_dirty_reports"]) || "cursapp_reports_dirty_v1";

  // Payments key (shared) â€” used to instantiate pending payments for mandatory campaigns
  const SCOPED_PAYMENTS = sk("payments_v1");
  const KEY_PAYMENTS =
    (localStorage.getItem(SCOPED_PAYMENTS) != null
      ? SCOPED_PAYMENTS
      : (detectKey(["cursapp_payments_v1", "payments", "cobros", "cursapp_pagos_v1"]) || SCOPED_PAYMENTS));

  // Enrollments (approved apoderados) â€” to pre-create pending payments per apoderado
  const KEY_ACTIVE_COURSE = "cursapp_active_course_v1";
  const KEY_ENROLL = "cursapp_enrollments_v1";

  const esc = (s) =>
    String(s ?? "").replace(/[&<>'"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c])
    );

  const uid = (p = "id") => `${p}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;

  const load = (k, def) => {
    try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(def)); }
    catch { return def; }
  };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  const markDirty = () => localStorage.setItem(KEY_DIRTY, "1");

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  function nowISO(){
    const d = new Date();
    return d.toISOString();
  }

  function activeCourseKey(){
    return localStorage.getItem(KEY_ACTIVE_COURSE) || "";
  }

  function approvedApoderados(){
    const ck = activeCourseKey();
    try{
      const list = JSON.parse(localStorage.getItem(KEY_ENROLL) || "[]");
      return list.filter(e => (!ck || e.courseKey===ck) && e.status==="approved");
    }catch(e){
      return [];
    }
  }

  function apoderadoEmailFromEnrollment(e){
    return String(
      e?.apoderadoEmail || e?.email || e?.apoderado || e?.apoderado_email || e?.mail || e?.correo || ""
    ).toLowerCase().trim();
  }


  // ---- Supabase write helpers (v11 MVP) ----
  const SB_URL = "https://ngxistgymgdkoaiulfbq.supabase.co";
  const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6Im5neGlzdGd5bWdka29haXVsZmJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2OTg1NDQsImV4cCI6MjA5NjI3NDU0NH0.1r-aLijYEWvUifKcLjlClnA8-oYw11lgThY0swg_xbg".replace("eyJpc3MiOiJIUzI1NiIs", "eyJpc3MiOiJIUzI1NiIs");
  // Mantener key explÃ­cita real si el replace anterior no aplica en runtime.
  const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5neGlzdGd5bWdka29haXVsZmJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2OTg1NDQsImV4cCI6MjA5NjI3NDU0NH0.1r-aLijYEWvUifKcLjlClnA8-oYw11lgThY0swg_xbg";

  function sbQ(v){ return encodeURIComponent(String(v == null ? "" : v)); }
  async function sb(path, opts){
    const res = await fetch(SB_URL + "/rest/v1/" + path, Object.assign({
      headers:{
        apikey: SB_ANON,
        Authorization: "Bearer " + SB_ANON,
        "Content-Type":"application/json",
        Prefer:"return=representation"
      }
    }, opts || {}));
    const txt = await res.text();
    let data = null;
    try{ data = txt ? JSON.parse(txt) : null; }catch(e){ data = txt; }
    if(!res.ok){
      const msg = (data && (data.message || data.error || data.hint)) || txt || ("HTTP " + res.status);
      throw new Error(msg);
    }
    return data;
  }

  function currentCourseKey(){
    try{
      const sess = JSON.parse(localStorage.getItem("cursapp_session_v1") || "null") || {};
      return String(sess.courseKey || localStorage.getItem(KEY_ACTIVE_COURSE) || "").trim();
    }catch(e){ return String(localStorage.getItem(KEY_ACTIVE_COURSE) || "").trim(); }
  }

  async function getActiveCursoRow(){
    const ck = currentCourseKey();
    if(!ck) throw new Error("No se encontrÃ³ curso activo para guardar la campaÃ±a.");
    const rows = await sb("cursos?course_key=eq." + sbQ(ck) + "&select=*&limit=1", { method:"GET" });
    const curso = Array.isArray(rows) ? rows[0] : null;
    if(!curso || !curso.id) throw new Error("El curso activo no existe en Supabase: " + ck);
    return curso;
  }

  function cleanDate(v){
    const s = String(v || "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  }

  function isApprovedMember(m){
    const st = String(m?.estado || "").toLowerCase();
    return ["aprobado","aprobada","approved","activo","activa"].includes(st);
  }

  async function ensurePagosForCampana(campana, curso, task){
    if(!campana || !campana.id || !curso || !curso.id) return 0;
    if(task && task.mandatoryParticipation === false) return 0;
    const miembros = await sb("miembros_curso?curso_id=eq." + sbQ(curso.id) + "&rol=eq.apoderado&select=*", { method:"GET" });
    const aprobados = (Array.isArray(miembros) ? miembros : []).filter(isApprovedMember);
    let count = 0;
    for(const m of aprobados){
      if(!m || !m.id) continue;
      const existing = await sb("pagos?campana_id=eq." + sbQ(campana.id) + "&miembro_id=eq." + sbQ(m.id) + "&select=id&limit=1", { method:"GET" });
      if(Array.isArray(existing) && existing.length) continue;
      const row = {
        curso_id: curso.id,
        campana_id: campana.id,
        miembro_id: m.id,
        monto: Number(task?.amount || task?.monto || 0) || 0,
        monto_pagado: 0,
        estado: "pendiente",
        fecha_vencimiento: cleanDate(task?.dueDate || task?.fecha_vencimiento || task?.endDate),
        periodo: String(task?.dueDate || task?.fecha_vencimiento || task?.endDate || new Date().toISOString()).slice(0,7)
      };
      await sb("pagos", { method:"POST", body:JSON.stringify(row) });
      count++;
    }
    return count;
  }

  async function saveCampaignToSupabase(task){
    const curso = await getActiveCursoRow();
    const body = {
      curso_id: curso.id,
      titulo: String(task?.title || task?.titulo || "CampaÃ±a").trim() || "CampaÃ±a",
      tipo: String(task?.type || task?.tipo || "single"),
      monto: Number(task?.amount || task?.monto || 0) || 0,
      fecha_inicio: cleanDate(task?.startDate || task?.fecha_inicio),
      fecha_vencimiento: cleanDate(task?.dueDate || task?.fecha_vencimiento || task?.endDate),
      meses: Number(task?.months || task?.meses || 1) || 1,
      obligatoria: task?.mandatoryParticipation !== false,
      estado: task?.closed ? "cerrada" : "activa"
    };
    const inserted = await sb("campanas", { method:"POST", body:JSON.stringify(body) });
    const campana = Array.isArray(inserted) ? inserted[0] : inserted;
    if(campana && campana.id){
      task.supabaseId = campana.id;
      task.campana_id = campana.id;
      await ensurePagosForCampana(campana, curso, task);
    }
    return campana;
  }

  function addMonthsKeepDay(isoDateStr, monthsToAdd) {
    const d = new Date(isoDateStr + "T12:00:00");
    const target = new Date(d.getFullYear(), d.getMonth() + monthsToAdd, d.getDate(), 12, 0, 0);
    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, "0");
    const dd = String(target.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function calcMonthlyEndDate(startISO, months) {
    const m = Number(months || 0);
    if (m <= 0) return "";
    return addMonthsKeepDay(startISO, m - 1);
  }

  function openModal(html) {
    const root = document.getElementById("modalRoot");
    if (!root) {
      alert("Falta #modalRoot en el HTML.");
      return;
    }

    // âœ… Modal premium mobile-safe:
    // - Sheet style (bottom) en mobile para que el pulgar llegue al footer
    // - Header/Body/Footer soportados (si el html trae .cursappModalShell)
    // - Inputs con tamaÃ±o iOS-safe (evita zoom y cortes en fecha)
    root.innerHTML = `
      <div class="campaign-modal-overlay" style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);">
        <div class="card cursappModalCard campaign-modal" style="width:calc(100vw - 32px);max-width:720px;max-height:calc(100dvh - 48px);overflow:hidden;border-radius:28px;background:#fff;display:flex;flex-direction:column;">
          <style>
            .cursappModalCard{ border-radius:28px; box-shadow:0 24px 70px rgba(15,23,42,.22); }
            .cursappModalShell{ display:flex; flex-direction:column; width:100%; max-height:calc(100dvh - 48px); overflow:hidden; }
            .cursappModalHeader{ position:sticky; top:0; z-index:2; padding:18px 20px 14px; border-bottom:1px solid rgba(226,232,240,.7); background:rgba(255,255,255,.96); }
            .cursappModalBody{ flex:1; padding:18px 20px 110px; overflow-y:auto; -webkit-overflow-scrolling:touch; }
            .cursappModalFooter{ position:sticky; bottom:0; z-index:3; padding:14px 20px; border-top:1px solid rgba(226,232,240,.8); background:rgba(255,255,255,.96); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); }
            .cursappModalFooter .actions{ margin-top:0 !important; }
            .cursappModalFooter .btnx{ height:48px; padding:0 14px; border-radius:16px; font-size:15px; font-weight:800; }
            .cursappModalFooter .btnx.primary{ min-width:170px; }

            /* Premium fields (iOS-safe) */
            .cursappModalShell label{ display:block; font-size:14px; font-weight:700; margin-bottom:8px; color:#111827; }
            .cursappModalShell input,
            .cursappModalShell select,
            .cursappModalShell textarea{
              width:100%;
              height:48px;
              padding:0 14px;
              border-radius:16px;
              border:1px solid #e2e8f0;
              background:#fff;
              font-weight:650;
              font-size:16px; /* iOS: evita zoom */
              line-height:1.2;
              box-sizing:border-box;
              outline:none;
            }
            .cursappModalShell textarea{
              height:auto;
              min-height:72px;
              padding:14px;
            }
            .cursappModalShell input:focus,
            .cursappModalShell select:focus,
            .cursappModalShell textarea:focus{
              border-color:rgba(124,58,237,.5);
              box-shadow:0 0 0 4px rgba(124,58,237,.10);
            }
            .cursappModalShell input[type="date"]{
              min-height:48px;
              text-align:left;
              white-space:nowrap;
            }
            .cursappModalGrid2{ display:flex; gap:16px; flex-wrap:wrap; }
            .cursappModalCol{ flex:1; min-width:160px; }
            .cursappModalSection{ margin:0 0 18px; padding:18px; border-radius:22px; border:1px solid rgba(226,232,240,.95); background:#fff; }
            .cursappModalSectionTitle{ font-weight:800; font-size:20px; line-height:1.1; margin:0 0 16px; color:#111827; }
            .campaign-modal-title{ font-size:22px; line-height:1.1; font-weight:800; color:#111827; text-align:center; }
            .campaign-modal-subtitle{ margin-top:6px; font-size:14px; line-height:1.35; color:#64748b; font-weight:500; text-align:center; }
            .campaign-modal-head-row{ display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:12px; align-items:start; }
            .campaign-modal-close-btn,
            .campaign-modal-x{ height:44px; min-width:44px; border-radius:16px; border:1px solid rgba(124,58,237,.22); background:#fff; color:#6d28d9; font-size:15px; font-weight:800; display:inline-flex; align-items:center; justify-content:center; }
            .campaign-modal-x{ color:#64748b; border-color:transparent; font-size:24px; line-height:1; }
            .campaign-field-help{ margin-top:8px; color:#64748b; font-size:12px; line-height:1.25; font-weight:600; }
            .campaign-form-field{ margin-top:12px; min-width:0; }
            .campaign-summary-box{ background:linear-gradient(135deg, rgba(124,58,237,.08), rgba(37,99,235,.05)); border-radius:18px; padding:16px; display:grid; grid-template-columns:1fr 1fr; gap:14px; }
            .campaign-summary-item{ display:flex; gap:10px; align-items:flex-start; min-width:0; }
            .campaign-summary-icon{ color:#7c3aed; width:18px; height:18px; flex:0 0 18px; margin-top:2px; }
            .campaign-summary-label{ font-size:12px; color:#64748b; line-height:1.1; font-weight:650; }
            .campaign-summary-value{ margin-top:3px; font-size:14px; font-weight:800; color:#0f172a; line-height:1.15; }
            .campaign-modal-footer-grid{ display:grid; grid-template-columns:1fr 1.8fr; gap:12px; width:100%; }
            @media(min-width:600px){ .campaign-form-grid{ display:grid; grid-template-columns:1fr 1fr; gap:16px; } }
            @media(max-width:430px){
              .campaign-modal-overlay{ padding:16px 12px !important; align-items:center !important; }
              .campaign-modal{ width:calc(100vw - 24px) !important; max-height:calc(100dvh - 32px) !important; border-radius:26px !important; }
              .cursappModalShell{ max-height:calc(100dvh - 32px); }
              .cursappModalHeader{ padding:16px 14px 12px; }
              .cursappModalBody{ padding:16px 14px 100px; }
              .cursappModalFooter{ padding:12px 14px; }
              .cursappModalSection{ padding:16px; border-radius:20px; margin-bottom:16px; }
              .campaign-summary-box{ grid-template-columns:1fr; }
              .campaign-modal-title{ font-size:20px; }
              .campaign-modal-subtitle{ font-size:13px; }
              .campaign-modal-close-btn{ min-width:68px; }
            }
          </style>
          ${html}
        </div>
      </div>
    `;
  }


  function closeModal() {
    const root = document.getElementById("modalRoot");
    if (root) root.innerHTML = "";
  }

  // ---------- lightweight events (so UIs refresh without relog) ----------
  function emitUpdated(kind){
    try{
      window.dispatchEvent(new CustomEvent("cursapp:dataUpdated", { detail:{ kind:String(kind||"") }}));
    }catch(e){
      // ignore
    }
  }

  // ---------- Shared forms ----------
  function openCreate() {
    const defaultStart = todayISO();
    const summaryIcon = (name)=> {
      const icons = {
        card:`<svg class="campaign-summary-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/></svg>`,
        users:`<svg class="campaign-summary-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
        calendar:`<svg class="campaign-summary-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`,
        coin:`<svg class="campaign-summary-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.6-.9-1.6-1.5-3-1.5-1.7 0-3 1-3 2.3 0 3 6 1.7 6 5 0 1.3-1.3 2.2-3 2.2-1.5 0-2.7-.6-3.3-1.7"/><path d="M12 6v12"/></svg>`,
        chart:`<svg class="campaign-summary-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16v-5"/><path d="M12 16V8"/><path d="M16 16v-9"/></svg>`
      };
      return icons[name] || icons.card;
    };

    openModal(`
      <div class="cursappModalShell">
        <div class="cursappModalHeader">
          <div class="campaign-modal-head-row">
            <button class="campaign-modal-close-btn" onclick="Campaigns.close()">Cerrar</button>
            <div>
              <div class="campaign-modal-title">Crear campaña</div>
              <div class="campaign-modal-subtitle">Completa la información para crear una nueva campaña.</div>
            </div>
            <button class="campaign-modal-x" onclick="Campaigns.close()" aria-label="Cerrar">×</button>
          </div>
        </div>

        <div class="cursappModalBody">
          <div class="cursappModalSection">
            <div class="cursappModalSectionTitle">Información básica</div>

            <div class="campaign-form-field">
              <label>Nombre de la campaña</label>
              <input id="cc_title" placeholder="Ej: Cuota paseo" />
            </div>

            <div class="campaign-form-field">
              <label>Descripción (opcional)</label>
              <textarea id="cc_desc" placeholder="Ej: Transporte y entradas"></textarea>
            </div>
          </div>

          <div class="cursappModalSection">
            <div class="cursappModalSectionTitle">Configuración de cobro</div>

            <div class="cursappModalGrid2 campaign-form-grid">
              <div class="cursappModalCol">
                <label>Tipo de pago</label>
                <select id="cc_type">
                  <option value="single">Pago único</option>
                  <option value="monthly">Mensual</option>
                </select>
              </div>
              <div class="cursappModalCol">
                <label>Participación</label>
                <select id="cc_mandatory">
                  <option value="true">Obligatoria</option>
                  <option value="false">No obligatoria</option>
                </select>
              </div>
            </div>

            <div class="cursappModalGrid2 campaign-form-grid" style="margin-top:12px;">
              <div class="cursappModalCol">
                <label>Monto total</label>
                <input id="cc_amount" inputmode="numeric" placeholder="Ej: 5000" />
                <div class="campaign-field-help">Monto total de la campaña.</div>
              </div>
              <div class="cursappModalCol">
                <label>Cuotas (si mensual)</label>
                <input id="cc_months" inputmode="numeric" placeholder="Ej: 10" />
                <div class="campaign-field-help">Cantidad de cuotas mensuales.</div>
              </div>
            </div>

            <div class="campaign-form-field">
              <label>Meta total (opcional)</label>
              <input id="cc_goal" inputmode="numeric" placeholder="Ej: 150000" />
            </div>
          </div>

          <div class="cursappModalSection">
            <div class="cursappModalSectionTitle">Fechas</div>

            <div class="cursappModalGrid2 campaign-form-grid">
              <div class="cursappModalCol">
                <label>Fecha de inicio</label>
                <input id="cc_start" type="date" value="${defaultStart}" />
              </div>
              <div class="cursappModalCol">
                <label>Fecha de fin</label>
                <input id="cc_due" type="date" />
              </div>
            </div>
            <div class="campaign-field-help">Se calculará automáticamente si es mensual.</div>
          </div>

          <div class="cursappModalSection">
            <div class="cursappModalSectionTitle">Resumen</div>
            <div class="campaign-summary-box">
              <div class="campaign-summary-item">
                ${summaryIcon("card")}
                <div><div class="campaign-summary-label">Tipo de pago</div><div class="campaign-summary-value" id="cc_sum_type">Pago único</div></div>
              </div>
              <div class="campaign-summary-item">
                ${summaryIcon("users")}
                <div><div class="campaign-summary-label">Participación</div><div class="campaign-summary-value" id="cc_sum_mandatory">Obligatoria</div></div>
              </div>
              <div class="campaign-summary-item">
                ${summaryIcon("calendar")}
                <div><div class="campaign-summary-label">Cuotas</div><div class="campaign-summary-value" id="cc_sum_months">1</div></div>
              </div>
              <div class="campaign-summary-item">
                ${summaryIcon("coin")}
                <div><div class="campaign-summary-label">Monto total</div><div class="campaign-summary-value" id="cc_sum_goal">$0</div></div>
              </div>
              <div class="campaign-summary-item">
                ${summaryIcon("card")}
                <div><div class="campaign-summary-label">Monto por cuota</div><div class="campaign-summary-value" id="cc_sum_amount">$0</div></div>
              </div>
              <div class="campaign-summary-item">
                ${summaryIcon("chart")}
                <div><div class="campaign-summary-label">Total proyectado</div><div class="campaign-summary-value" id="cc_sum_total">$0</div></div>
              </div>
            </div>
          </div>

          <input id="cc_template" type="hidden" value="" />
        </div>

        <div class="cursappModalFooter">
          <div class="actions campaign-modal-footer-grid">
            <button class="btnx campaign-modal-cancel" onclick="Campaigns.close()">Cancelar</button>
            <button class="btnx primary campaign-modal-submit" onclick="Campaigns.saveCreate()">Crear campaña</button>
          </div>
        </div>
      </div>
    `);


    const typeEl = document.getElementById("cc_type");
    const startEl = document.getElementById("cc_start");
    const dueEl = document.getElementById("cc_due");
    const monthsEl = document.getElementById("cc_months");
    const amountEl = document.getElementById("cc_amount");
    const mandatoryEl = document.getElementById("cc_mandatory");
    const goalEl = document.getElementById("cc_goal");

    function syncMonthly() {
      const type = typeEl.value;
      const start = startEl.value || todayISO();
      const months = Math.max(0, Number(monthsEl.value || 0));
      const amount = Math.max(0, Number((amountEl?.value || "").replace(/[^0-9]/g,"") || 0));
      const goal = Math.max(0, Number((goalEl?.value || "").replace(/[^0-9]/g,"") || 0));

      const isMonthly = type === "monthly";

      // UI toggles
      monthsEl.disabled = !isMonthly;
      if (!isMonthly) {
        monthsEl.value = "";
        dueEl.disabled = false;
      } else {
        dueEl.disabled = true;
        const end = calcMonthlyEndDate(start, months > 0 ? months : 0);
        dueEl.value = end || "";
      }

      // Resumen (liviano, solo visual)
      try{
        const sumType = document.getElementById("cc_sum_type");
        const sumMandatory = document.getElementById("cc_sum_mandatory");
        const sumMonths = document.getElementById("cc_sum_months");
        const sumAmount = document.getElementById("cc_sum_amount");
        const sumGoal = document.getElementById("cc_sum_goal");
        const sumTotal = document.getElementById("cc_sum_total");

        if (sumType) sumType.textContent = isMonthly ? "Mensual" : "Pago único";
        if (sumMandatory) sumMandatory.textContent = mandatoryEl.value === "true" ? "Obligatoria" : "No obligatoria";
        if (sumMonths) sumMonths.textContent = isMonthly ? String(months || 0) : "1";
        if (sumAmount) sumAmount.textContent = "$" + amount.toLocaleString("es-CL");
        if (sumGoal) sumGoal.textContent = "$" + (goal || amount).toLocaleString("es-CL");
        const total = isMonthly ? amount * (months || 0) : amount;
        if (sumTotal) sumTotal.textContent = "$" + total.toLocaleString("es-CL");
      }catch(e){/* ignore */}
    }
    typeEl.onchange = syncMonthly;
    startEl.onchange = syncMonthly;
    monthsEl.oninput = syncMonthly;
    amountEl.oninput = syncMonthly;
    mandatoryEl.onchange = syncMonthly;
    goalEl.oninput = syncMonthly;
    syncMonthly();
  }
  // ---------- Templates (Plantillas destacadas) ----------
  // Gira / Graduacion: cuotas abiertas, saldo anos anteriores y multiples cotizaciones.
  function openCreateTemplate(template){
    const tpl = String(template||"").toLowerCase();
    const defaultStart = todayISO();
    const titleDefault = tpl === "graduacion" ? "Graduación" : "Gira de estudio";
    const descDefault  = tpl === "graduacion" ? "Cotizaciones + plan de cuotas" : "Cotizaciones + plan de cuotas";

    openModal(`
      <div class="cursappModalShell">
        <div class="cursappModalHeader">
          <div class="campaign-modal-head-row">
            <button class="campaign-modal-close-btn" onclick="Campaigns.close()">Cerrar</button>
            <div>
              <div class="campaign-modal-title">${esc(titleDefault)}</div>
              <div class="campaign-modal-subtitle">Plantilla destacada para crear campañas con cuotas y cotizaciones.</div>
            </div>
            <button class="campaign-modal-x" onclick="Campaigns.close()" aria-label="Cerrar">×</button>
          </div>
        </div>

        <div class="cursappModalBody">
          <div class="cursappModalSection">
            <div class="cursappModalSectionTitle">Información de plantilla</div>

            <div class="campaign-form-field">
              <label>Nombre de la campaña</label>
              <input id="tc_title" value="${esc(titleDefault)}" />
            </div>

            <div class="campaign-form-field">
              <label>Descripción</label>
              <textarea id="tc_desc" rows="2" placeholder="Ej: Cotizaciones, traslados y plan de cuotas">${esc(descDefault)}</textarea>
            </div>
          </div>

          <div class="cursappModalSection">
            <div class="cursappModalSectionTitle">Configuración de cobro</div>

            <div class="cursappModalGrid2 campaign-form-grid">
              <div class="campaign-form-field">
                <label>Participación</label>
                <select id="tc_mandatory">
                  <option value="false" selected>No obligatoria</option>
                  <option value="true">Obligatoria</option>
                </select>
              </div>
              <div class="campaign-form-field">
                <label>Monto por cuota</label>
                <input id="tc_amount" inputmode="numeric" placeholder="Ej: 25000" />
              </div>
            </div>

            <div class="cursappModalGrid2 campaign-form-grid" style="margin-top:12px;">
              <div class="campaign-form-field">
                <label>Cuotas / meses</label>
                <input id="tc_months" inputmode="numeric" min="1" value="10" />
                <div class="campaign-field-help">Cuotas abiertas. Mínimo 1 (recomendado 10).</div>
              </div>
              <div class="campaign-form-field">
                <label>Saldo años anteriores</label>
                <input id="tc_prev" inputmode="numeric" placeholder="Ej: 120000" />
                <div class="campaign-field-help">Se considera como reunido por el curso.</div>
              </div>
            </div>
          </div>

          <div class="cursappModalSection">
            <div class="cursappModalSectionTitle">Fechas</div>

            <div class="cursappModalGrid2 campaign-form-grid">
              <div class="campaign-form-field">
                <label>Fecha de inicio</label>
                <input id="tc_start" type="date" value="${defaultStart}" />
              </div>
              <div class="campaign-form-field">
                <label>Fecha de fin</label>
                <input id="tc_due" type="date" />
              </div>
            </div>
            <div class="campaign-field-help">Se calcula automáticamente según las cuotas configuradas.</div>
          </div>

          <div class="cursappModalSection">
            <div class="cursappModalSectionTitle">Resumen</div>
            <div class="campaign-summary-box">
              <div class="campaign-summary-item">
                <svg class="campaign-summary-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/></svg>
                <div><div class="campaign-summary-label">Tipo de pago</div><div class="campaign-summary-value">Mensual</div></div>
              </div>
              <div class="campaign-summary-item">
                <svg class="campaign-summary-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <div><div class="campaign-summary-label">Participación</div><div class="campaign-summary-value">Según selección</div></div>
              </div>
              <div class="campaign-summary-item">
                <svg class="campaign-summary-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                <div><div class="campaign-summary-label">Cuotas</div><div class="campaign-summary-value">10</div></div>
              </div>
              <div class="campaign-summary-item">
                <svg class="campaign-summary-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><path d="M12 6v12"/></svg>
                <div><div class="campaign-summary-label">Meta por alumno</div><div class="campaign-summary-value" id="tc_meta_alumno">$0</div></div>
              </div>
            </div>
          </div>

          <div class="cursappModalSection">
            <div class="cursappModalSectionTitle">Cotizaciones</div>
            <div class="campaign-field-help">Puedes agregar varias cotizaciones para distintos ítems.</div>
            <div id="tc_quotes" style="margin-top:12px;display:flex;flex-direction:column;gap:10px;"></div>
            <button class="btnx" id="tc_add_quote" type="button" style="margin-top:12px;">+ Agregar cotización</button>
          </div>
        </div>

        <div class="cursappModalFooter">
          <div class="actions campaign-modal-footer-grid">
            <button class="btnx campaign-modal-cancel" onclick="Campaigns.close()">Cancelar</button>
            <button class="btnx primary campaign-modal-submit" onclick="Campaigns.saveCreateTemplate('${esc(tpl)}')">Crear campaña</button>
          </div>
        </div>
      </div>
    `);


    // logic: auto-calc due + meta alumno
    const startEl = document.getElementById("tc_start");
    const dueEl   = document.getElementById("tc_due");
    const monthsEl= document.getElementById("tc_months");
    const amountEl= document.getElementById("tc_amount");
    const metaEl  = document.getElementById("tc_meta_alumno");

    // Prefill defaults so the template can be created with fewer steps
    try{
      if(!amountEl.value){ amountEl.value = (tpl==="graduacion" ? "10000" : "20000"); }
      if(!monthsEl.value){ monthsEl.value = "10"; }
    }catch(e){}


    function sync(){
      const start = startEl.value || defaultStart;
      const months = Math.max(1, Number(monthsEl.value||10));
      dueEl.value = calcMonthlyEndDate(start, months) || "";
      const amt = Number(amountEl.value||0);
      const meta = amt * months;
      metaEl.textContent = "$" + Number(meta||0).toLocaleString("es-CL");
    }
    startEl.onchange = sync;
    monthsEl.oninput = sync;
    amountEl.oninput = sync;
    sync();

    // quotes list
    const qWrap = document.getElementById("tc_quotes");
    const addBtn = document.getElementById("tc_add_quote");
    function quoteRow(idx){
      return `
        <div class="card" style="padding:14px;border:1px solid rgba(226,232,240,.95);border-radius:18px;background:#fff;">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
            <div style="font-weight:950;">Cotización ${idx+1}</div>
            <button class="btnx danger" type="button" data-qrm="${idx}">Quitar</button>
          </div>
          <div class="campaign-form-field">
            <label style="font-weight:900;">Nombre cotización</label>
            <input data-q="nombre" placeholder="Ej: Alojamiento" />
          </div>
          <div class="campaign-form-field">
            <label style="font-weight:900;">URL</label>
            <input data-q="url" placeholder="https://..." />
          </div>
          <div class="campaign-form-field">
            <label style="font-weight:900;">Monto total</label>
            <input data-q="monto_total" inputmode="numeric" placeholder="Ej: 2000000" />
          </div>
          <div class="campaign-form-field">
            <label style="font-weight:900;">Descripción</label>
            <textarea data-q="descripcion" rows="2" placeholder="Detalle del ítem"></textarea>
          </div>
        </div>
      `;
    }
    function rebindRemove(){
      qWrap.querySelectorAll("[data-qrm]").forEach(btn=>{
        btn.onclick = ()=>{
          const i = Number(btn.getAttribute("data-qrm"));
          const cards = Array.from(qWrap.children);
          if(cards[i]) cards[i].remove();
          // renumber
          Array.from(qWrap.children).forEach((c,ix)=>{
            const h = c.querySelector("div[style*='font-weight:950']");
            if(h) h.textContent = `Cotización ${ix+1}`;
            const rm = c.querySelector("[data-qrm]");
            if(rm) rm.setAttribute("data-qrm", String(ix));
          });
          rebindRemove();
        };
      });
    }
    function addQuote(){
      const idx = qWrap.children.length;
      const temp = document.createElement("div");
      temp.innerHTML = quoteRow(idx);
      qWrap.appendChild(temp.firstElementChild);
      rebindRemove();
    }
    addBtn.onclick = addQuote;
    addQuote();
  }

  async function saveCreateTemplate(tpl){
    const template = String(tpl||"").toLowerCase();
    const title = (document.getElementById("tc_title").value||"").trim();
    const desc  = (document.getElementById("tc_desc").value||"").trim();
    const mandatoryParticipation = document.getElementById("tc_mandatory").value === "true";
    const amount = Number(document.getElementById("tc_amount").value||0);
    const months = Math.max(1, Number(document.getElementById("tc_months").value||10));
    const saldoPrev = Math.max(0, Number(document.getElementById("tc_prev").value||0));
    const startDate = document.getElementById("tc_start").value || todayISO();
    const dueDate = calcMonthlyEndDate(startDate, months);

    if(!title){ alert("Debes ingresar un nombre."); return; }
    if(!amount || amount<=0){ alert("Debes ingresar un monto cuota válido."); return; }

    // read quotes
    const qWrap = document.getElementById("tc_quotes");
    const cards = Array.from(qWrap?.children||[]);
    const cotizaciones = cards.map(card=>{
      const get = (k)=> card.querySelector(`[data-q='${k}']`)?.value;
      return {
        nombre: String(get("nombre")||"").trim(),
        url: String(get("url")||"").trim(),
        monto_total: Number(get("monto_total")||0),
        descripcion: String(get("descripcion")||"").trim(),
      };
    }).filter(c=>c.nombre||(c.url||c.link)||c.monto_total||(c.descripcion||c.comentario||c.texto||c.desc||c.description));

    const cotizaciones2 = dedupeCotizaciones(cotizaciones);


    const newTaskId = uid("t");
    const ts = load(KEY_TASKS, []);
    const task = {
      id: newTaskId,
      title,
      description: desc,
      startDate,
      dueDate,
      type: "monthly",
      months,
      amount,
      goalTotal: 0,
      mandatoryParticipation,
      createdAt: nowISO(),
      template,
      saldo_prev: saldoPrev,
      cotizaciones: cotizaciones2,
    };
    try{ await saveCampaignToSupabase(task); }
    catch(e){ alert("No se pudo guardar la campaña en Supabase: " + (e && e.message ? e.message : e)); return; }
    ts.unshift(task);
    save(KEY_TASKS, ts);

    // Instantiate pending payments for mandatory templates (first month only)
    if(mandatoryParticipation){
      try{
        const aps = approvedApoderados();
        const ps = load(KEY_PAYMENTS, []);
        const firstDue = calcMonthlyEndDate(startDate, 1);
        aps.forEach(a=>{
          const em = apoderadoEmailFromEnrollment(a);
          if(!em) return;
          ps.unshift({
            id: uid("p"),
            fromTaskId: newTaskId,
            apoderadoEmail: em,
            amount: amount,
            amountRemaining: amount,
            status: "pending",
            dueDate: firstDue,
            period: String(firstDue||"").slice(0,7),
            createdAt: nowISO(),
          });
        });
        save(KEY_PAYMENTS, ps);
      }catch(e){}
    }

    markDirty();
    emitUpdated("tasks");
    closeModal();
  }

  // ---------- Read-only: cotizaciones y detalle ----------
  function openQuotesDetailById(taskId){
    const ts = load(KEY_TASKS, []);
    const t = ts.find(x=>String(x.id)===String(taskId));
    if(!t) return;
    openQuotesDetail(t);
  }

  function openQuotesDetail(task){
    if(!task) return;
    const title = String(task.title||"CampaÃ±a");
    const items = dedupeCotizaciones([...(Array.isArray(task.cotizaciones)?task.cotizaciones:[]), ...((task.cotizacion && typeof task.cotizacion==='object')?[task.cotizacion]:[])]);
    const total = items.reduce((a,x)=>a+Number(x.monto_total||0),0);

    openModal(`
      <div class="row">
        <div>
          <div style="font-weight:950;font-size:18px;">Cotizaciones</div>
          <div class="muted" style="margin-top:6px;">${esc(title)} Â· ${items.length} Ã­tem(s)</div>
        </div>
        <button class="btnx" onclick="Campaigns.close()">Cerrar</button>
      </div>

      ${items.length ? `
        <div class="card" style="margin-top:12px;padding:12px;border:1px solid rgba(0,0,0,.08);">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
            <div style="font-weight:950;">Total cotizado</div>
            <div style="font-weight:950;">$${Number(total||0).toLocaleString("es-CL")}</div>
          </div>
        </div>
        <div style="margin-top:12px;display:grid;gap:10px;">
          ${items.map((c,i)=>`
            <div style="border:1px solid rgba(0,0,0,.10);border-radius:14px;padding:12px;">
              <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
                <div style="font-weight:950;">${esc(c.nombre || `CotizaciÃ³n ${i+1}`)}</div>
                ${c.monto_total?`<div style="font-weight:950;">$${Number(c.monto_total).toLocaleString("es-CL")}</div>`:""}
              </div>
              ${(c.descripcion||c.comentario||c.texto||c.desc||c.description)?`<div class="muted" style="margin-top:6px;line-height:1.35;"><b>DescripciÃ³n:</b> ${esc((c.descripcion||c.comentario||c.texto||c.desc||c.description))}</div>`:`<div class="muted" style="margin-top:6px;line-height:1.35;"><b>DescripciÃ³n:</b> â€”</div>`}
              ${(c.url||c.link)?`<div class="muted" style="margin-top:6px;line-height:1.35;word-break:break-word;"><b>URL:</b> ${esc((c.url||c.link))}</div>`:""}
              ${(c.url||c.link)?`<div style="margin-top:10px;"><a class="btnx" style="display:inline-block;border:1px solid rgba(0,0,0,.14);text-decoration:none;padding:6px 10px;font-size:14px;" href="${esc((c.url||c.link))}" target="_blank" rel="noopener">ðŸ”—</a></div>`:""}
            </div>
          `).join("")}
        </div>
      ` : `<div class="muted" style="margin-top:12px;">AÃºn no hay cotizaciones registradas.</div>`}
    `);
  }

  function openCampaignDetail(taskId, mode){
    const ts = load(KEY_TASKS, []);
    const t = ts.find(x=>String(x.id)===String(taskId));
    if(!t) return;
    const type = String(t.type||"single");
    const part = (t.mandatoryParticipation === false) ? "No obligatoria" : "Obligatoria";
    const tpl = String(t.template||"");
    const cotz = dedupeCotizaciones([...(Array.isArray(t.cotizaciones)?t.cotizaciones:[]), ...((t.cotizacion && typeof t.cotizacion==='object')?[t.cotizacion]:[])]);
    const totalCot = cotz.reduce((a,x)=>a+Number(x?.monto_total??x?.monto??x?.total??0),0);
    const saldoPrev = Number(t.saldo_prev||0);

    openModal(`
      <div class="row">
        <div>
          <div style="font-weight:950;font-size:18px;">Detalle campaÃ±a</div>
          <div class="muted" style="margin-top:6px;">${esc(t.title||"")}</div>
        </div>
        <button class="btnx" onclick="Campaigns.close()">Cerrar</button>
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <div class="chipInfoPill">ðŸ“„ Tipo <b>${type==="monthly"?"Mensual":"Pago Ãºnico"}</b></div>
        <div class="chipInfoPill">ðŸ”’ ParticipaciÃ³n <b>${part}</b></div>
        ${tpl?`<div class="chipInfoPill ok">âœ¨ Plantilla <b>${esc(tpl)}</b></div>`:""}
      </div>

      <div class="card" style="margin-top:12px;padding:12px;border:1px solid rgba(0,0,0,.08);">
        <div class="muted">Fechas</div>
        <div style="margin-top:6px;font-weight:950;">${esc(t.startDate||"")} â†’ ${esc(t.dueDate||"")}</div>
        ${t.description?`<div class="muted" style="margin-top:10px;line-height:1.35;">${esc(t.description)}</div>`:""}
      </div>

      ${(saldoPrev>0)?`
        <div class="card" style="margin-top:12px;padding:12px;border:1px solid rgba(0,0,0,.08);">
          <div class="muted">Saldo aÃ±os anteriores (curso)</div>
          <div style="margin-top:6px;font-weight:950;font-size:20px;">$${Number(saldoPrev).toLocaleString("es-CL")}</div>
        </div>
      `:""}

      ${cotz.length?`
        <div class="card" style="margin-top:12px;padding:12px;border:1px solid rgba(0,0,0,.08);">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
            <div>
              <div style="font-weight:950;">Cotizaciones</div>
              <div class="muted" style="margin-top:4px;">Total cotizado: <b>$${Number(totalCot||0).toLocaleString("es-CL")}</b></div>
            </div>
            <button class="btnx" onclick="Campaigns.openQuotesDetailById('${esc(t.id)}')">Ver detalle</button>
          </div>
        </div>
      `:""}

      <div style="margin-top:14px;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
        ${String(mode||"")==="presidente" ? `<button class="btnx" onclick="Campaigns.openEdit('${esc(t.id)}')">âœï¸ Editar</button>` : ``}
      </div>
    `);
  }

  async function saveCreate() {
    const title = (document.getElementById("cc_title").value || "").trim();
    const desc  = (document.getElementById("cc_desc").value || "").trim();
    const type  = document.getElementById("cc_type").value || "single";
    const mandatoryParticipation = document.getElementById("cc_mandatory").value === "true";

    const amount = Number(document.getElementById("cc_amount").value || 0);
    const goalTotal = Number(document.getElementById("cc_goal").value || 0);

    let startDate = document.getElementById("cc_start").value || todayISO();
    let dueDate   = document.getElementById("cc_due").value || "";
    let months    = Number(document.getElementById("cc_months").value || 0);

    if (!title) { alert("Debes ingresar un nombre."); return; }
    if (!amount || amount <= 0) { alert("Debes ingresar un monto vÃ¡lido."); return; }

    if (type === "monthly") {
      if (!months || months <= 0) { alert("Si es mensual, indica cuotas/meses."); return; }
      dueDate = calcMonthlyEndDate(startDate, months);
      if (!dueDate) { alert("No se pudo calcular la fecha fin."); return; }
    } else {
      months = 1;
      if (!dueDate) { alert("Debes seleccionar una fecha fin."); return; }
    }

    const newTaskId = uid("t");

    const ts = load(KEY_TASKS, []);
    const task = {
      id: newTaskId,
      title,
      description: desc,
      startDate,
      dueDate,
      type,
      months,
      amount,
      goalTotal: goalTotal > 0 ? goalTotal : null,
      mandatoryParticipation,
      closed: false,
      closeType: "",
      closeReason: "",
      closedAt: ""
    };

    try{ await saveCampaignToSupabase(task); }
    catch(e){ alert("No se pudo guardar la campaÃ±a en Supabase: " + (e && e.message ? e.message : e)); return; }

    ts.unshift(task);
    save(KEY_TASKS, ts);
    try{
      if(window.CURSAPP_PAYMENTS_V11 && typeof window.CURSAPP_PAYMENTS_V11.refresh === "function"){
        window.CURSAPP_PAYMENTS_V11.refresh("campaign-created").catch(function(e){ console.warn("No se pudo refrescar pagos Supabase", e); });
      }
    }catch(e){}

    // âœ… Mandatory campaigns: pre-create pending payments per approved apoderado.
    // This improves UX/consistency (deudores + cuotas) without waiting for each apoderado to enter.
    try{
      if (mandatoryParticipation) {
        const pays = load(KEY_PAYMENTS, []);
        const already = pays.some(p => String(p.fromTaskId||"") === String(newTaskId));
        if (!already) {
          const aps = approvedApoderados();
          const emails = aps.map(apoderadoEmailFromEnrollment).filter(Boolean);

          // Fallback: if enrollments are missing, create a generic pending payment (keeps demo consistent)
          const targets = emails.length ? emails : ["demo@cursapp.local"];

          targets.forEach((mail, i)=>{
            const safeEmail = mail || `unknown_${i+1}@cursapp.local`;
            pays.unshift({
              id: uid("p"),
              fromTaskId: newTaskId,
              concept: type === "monthly" ? `${title} Â· Cuota 1/${Math.max(1, Number(months||1))}` : "Pago Ãºnico",
              amount: Number(amount||0),
              status: "pending",
              dueDate,
              createdAt: nowISO(),
              apoderadoEmail: safeEmail
            });
          });
          save(KEY_PAYMENTS, pays);
        }
      }
    }catch(e){ /* ignore */ }

    markDirty();
    emitUpdated("tasks");
    closeModal();
    alert("CampaÃ±a creada âœ…");
}

  function openEdit(taskId) {
    const ts = load(KEY_TASKS, []);
    const t = ts.find(x => x.id === taskId);
    if (!t) return;

    openModal(`
      <div class="cursappModalShell">
        <div class="cursappModalHeader">
          <div class="campaign-modal-head-row">
            <button class="campaign-modal-close-btn" onclick="Campaigns.close()">Cerrar</button>
            <div>
              <div class="campaign-modal-title">Editar campaña</div>
              <div class="campaign-modal-subtitle">Actualiza la información de la campaña sin cambiar su lógica.</div>
            </div>
            <button class="campaign-modal-x" onclick="Campaigns.close()" aria-label="Cerrar">×</button>
          </div>
        </div>

        <div class="cursappModalBody">
          <div class="cursappModalSection">
            <div class="cursappModalSectionTitle">Información básica</div>

            <div class="campaign-form-field">
              <label>Nombre de la campaña</label>
              <input id="ec_title" value="${esc(t.title)}" />
            </div>

            <div class="campaign-form-field">
              <label>Descripción</label>
              <textarea id="ec_desc" placeholder="Descripción de la campaña">${esc(t.description || "")}</textarea>
            </div>
          </div>

          <div class="cursappModalSection">
            <div class="cursappModalSectionTitle">Configuración de cobro</div>

            <div class="cursappModalGrid2 campaign-form-grid">
              <div class="cursappModalCol">
                <label>Tipo de pago</label>
                <select id="ec_type">
                  <option value="single" ${t.type==="single"?"selected":""}>Pago único</option>
                  <option value="monthly" ${t.type==="monthly"?"selected":""}>Mensual</option>
                </select>
              </div>
              <div class="cursappModalCol">
                <label>Participación</label>
                <select id="ec_mandatory">
                  <option value="true" ${t.mandatoryParticipation?"selected":""}>Obligatoria</option>
                  <option value="false" ${!t.mandatoryParticipation?"selected":""}>No obligatoria</option>
                </select>
              </div>
            </div>

            <div class="cursappModalGrid2 campaign-form-grid" style="margin-top:12px;">
              <div class="cursappModalCol">
                <label>Monto total</label>
                <input id="ec_amount" inputmode="numeric" value="${Number(t.amount||0)}" />
                <div class="campaign-field-help">Monto por pago o cuota según el tipo seleccionado.</div>
              </div>
              <div class="cursappModalCol">
                <label>Meta total</label>
                <input id="ec_goal" inputmode="numeric" value="${Number(t.goalTotal||0)}" />
                <div class="campaign-field-help">Meta referencial de la campaña.</div>
              </div>
            </div>

            <div class="campaign-form-field">
              <label>Cuotas / meses (solo mensual)</label>
              <input id="ec_months" inputmode="numeric" value="${Number(t.months||1)}" />
            </div>
          </div>

          <div class="cursappModalSection">
            <div class="cursappModalSectionTitle">Fechas</div>

            <div class="cursappModalGrid2 campaign-form-grid">
              <div class="cursappModalCol">
                <label>Fecha de inicio</label>
                <input id="ec_start" type="date" value="${esc(t.startDate||todayISO())}" />
              </div>
              <div class="cursappModalCol">
                <label>Fecha de fin</label>
                <input id="ec_due" type="date" value="${esc(t.dueDate||"")}" />
              </div>
            </div>
            <div class="campaign-field-help">Si la campaña es mensual, la fecha fin se recalcula automáticamente según cuotas.</div>
          </div>

          ${(t.template === "gira" || t.template === "graduacion") ? `
            <div class="cursappModalSection">
              <div class="cursappModalSectionTitle">Plantilla y cotizaciones</div>
              <div class="campaign-form-field">
                <label>Saldo años anteriores</label>
                <input id="ec_prev" inputmode="numeric" value="${Number(t.saldo_prev||0)}" placeholder="Ej: 120000" />
                <div class="campaign-field-help">Se considera como reunido por el curso.</div>
              </div>
              <div class="campaign-form-field">
                <div class="campaign-summary-label">Cotizaciones</div>
                <div class="campaign-field-help">Puedes agregar varias cotizaciones para distintos ítems.</div>
                <div id="ec_quotes" style="display:grid;gap:10px;margin-top:12px;"></div>
                <button class="btnx" id="ec_add_quote" type="button" style="margin-top:12px;">+ Agregar cotización</button>
              </div>
            </div>
          ` : ``}

          <div class="cursappModalSection">
            <div class="cursappModalSectionTitle">Resumen actual</div>
            <div class="campaign-summary-box">
              <div class="campaign-summary-item">
                <svg class="campaign-summary-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/></svg>
                <div><div class="campaign-summary-label">Tipo de pago</div><div class="campaign-summary-value">${t.type==="monthly" ? "Mensual" : "Pago único"}</div></div>
              </div>
              <div class="campaign-summary-item">
                <svg class="campaign-summary-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <div><div class="campaign-summary-label">Participación</div><div class="campaign-summary-value">${t.mandatoryParticipation ? "Obligatoria" : "No obligatoria"}</div></div>
              </div>
              <div class="campaign-summary-item">
                <svg class="campaign-summary-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                <div><div class="campaign-summary-label">Cuotas</div><div class="campaign-summary-value">${Number(t.months||1)}</div></div>
              </div>
              <div class="campaign-summary-item">
                <svg class="campaign-summary-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><path d="M12 6v12"/></svg>
                <div><div class="campaign-summary-label">Monto</div><div class="campaign-summary-value">$${Number(t.amount||0).toLocaleString("es-CL")}</div></div>
              </div>
            </div>
          </div>
        </div>

        <div class="cursappModalFooter">
          <div class="actions campaign-modal-footer-grid">
            <button class="btnx campaign-modal-cancel" onclick="Campaigns.close()">Cancelar</button>
            <button class="btnx primary campaign-modal-submit" onclick="Campaigns.saveEdit('${esc(t.id)}')">Guardar cambios</button>
          </div>
        </div>
      </div>
    `);

    const typeEl = document.getElementById("ec_type");
    const startEl = document.getElementById("ec_start");
    const dueEl = document.getElementById("ec_due");
    const monthsEl = document.getElementById("ec_months");

    function sync() {
      const type = typeEl.value;
      const start = startEl.value || todayISO();
      const months = Number(monthsEl.value || 0);

      if (type === "monthly") {
        dueEl.disabled = true;
        const end = calcMonthlyEndDate(start, months > 0 ? months : 0);
        dueEl.value = end || "";
      } else {
        dueEl.disabled = false;
      }
    }
    typeEl.onchange = sync;
    startEl.onchange = sync;
    monthsEl.oninput = sync;
    sync();

    // Cotizaciones para plantillas con cotizacion editable.
    if (t.template === "gira" || t.template === "graduacion") {
      const normalize = (q) => ({
        name: (q?.name || q?.nombre || "").trim(),
        url: (q?.url || q?.link || "").trim(),
        total: Number(q?.total || q?.monto_total || q?.montoTotal || q?.monto || 0) || 0,
        desc: (q?.desc || q?.descripcion || q?.texto || "").trim()
      });

      let quotes = [];
      if (Array.isArray(t.cotizaciones)) quotes = t.cotizaciones.map(normalize);
      else if (t.cotizacion) quotes = [normalize(t.cotizacion)];

      const wrap = document.getElementById("ec_quotes");
      const btnAdd = document.getElementById("ec_add_quote");

      const renderQuotes = () => {
        if (!wrap) return;
        wrap.innerHTML = quotes.length ? quotes.map((q, idx) => `
          <div data-quote-row="1" data-idx="${idx}" style="border:1px solid rgba(0,0,0,.08);border-radius:12px;padding:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
              <div style="font-weight:950;">Cotización ${idx+1}</div>
              <button class="btnx danger" type="button" data-del="${idx}">Quitar</button>
            </div>

            <div style="margin-top:10px;">
              <label style="font-weight:900;">Nombre cotización</label>
              <input id="ec_q_name_${idx}" value="${esc(q.name)}" placeholder="Ej: Transporte / Hotel / Entradas" />
            </div>

            <div style="margin-top:10px;">
              <label style="font-weight:900;">URL</label>
              <input id="ec_q_url_${idx}" value="${esc(q.url)}" placeholder="https://..." />
            </div>

            <div style="margin-top:10px;">
              <label style="font-weight:900;">Monto total</label>
              <input id="ec_q_total_${idx}" inputmode="numeric" value="${Number(q.total||0)}" placeholder="Ej: 1200000" />
            </div>

            <div style="margin-top:10px;">
              <label style="font-weight:900;">Descripción</label>
              <input id="ec_q_desc_${idx}" value="${esc(q.desc)}" placeholder="Ej: Incluye bus + seguro + entradas" />
            </div>
          </div>
        `).join("") : `<div class="muted" style="font-size:13px;">Aún no hay cotizaciones.</div>`;

        // bind delete
        wrap.querySelectorAll("button[data-del]").forEach(b=>{
          b.onclick = ()=>{
            const di = Number(b.getAttribute("data-del"));
            quotes.splice(di,1);
            renderQuotes();
          };
        });
      };

      if (btnAdd) btnAdd.onclick = () => { quotes.push(normalize({})); renderQuotes(); };
      renderQuotes();

      // exponer para saveEdit
      window.__ec_quotes = quotes;
      window.__ec_renderQuotes = renderQuotes;
    }
  }

  function saveEdit(taskId) {
    const ts = load(KEY_TASKS, []);
    const i = ts.findIndex(x => x.id === taskId);
    if (i < 0) return;

    const type = document.getElementById("ec_type").value || ts[i].type;
    const startDate = document.getElementById("ec_start").value || ts[i].startDate;
    let dueDate = document.getElementById("ec_due").value || ts[i].dueDate;
    let months = Number(document.getElementById("ec_months").value || ts[i].months || 1);

    const amount = Number(document.getElementById("ec_amount").value || 0);
    const goal = Number(document.getElementById("ec_goal").value || 0);
    if (!amount || amount <= 0) { alert("Monto invÃ¡lido."); return; }

    if (type === "monthly") {
      if (!months || months <= 0) { alert("Si es mensual, indica cuotas/meses."); return; }
      dueDate = calcMonthlyEndDate(startDate, months);
      if (!dueDate) { alert("No se pudo calcular la fecha fin."); return; }
    } else {
      months = 1;
      if (!dueDate) { alert("Debes seleccionar una fecha fin."); return; }
    }

    ts[i].title = (document.getElementById("ec_title").value || "").trim() || ts[i].title;
    ts[i].description = (document.getElementById("ec_desc").value || "").trim();
    ts[i].type = type;
    ts[i].mandatoryParticipation = document.getElementById("ec_mandatory").value === "true";
    ts[i].amount = amount;
    ts[i].goalTotal = goal > 0 ? goal : null;
    ts[i].startDate = startDate;
    ts[i].dueDate = dueDate;
    ts[i].months = months;

    // Saldo anos anteriores (plantillas)
    if (ts[i].template === "gira" || ts[i].template === "graduacion") {
      const prev = Math.max(0, Number(document.getElementById("ec_prev")?.value || ts[i].saldo_prev || 0));
      ts[i].saldo_prev = prev;
    }

    // Cotizaciones (plantillas: Gira / Graduacion)
    if (ts[i].template === "gira" || ts[i].template === "graduacion") {
      const quotes = Array.isArray(window.__ec_quotes) ? window.__ec_quotes : [];
      const cleaned = [];
      for (let idx=0; idx<quotes.length; idx++){
        const name = (document.getElementById(`ec_q_name_${idx}`)?.value || "").trim();
        const url  = (document.getElementById(`ec_q_url_${idx}`)?.value || "").trim();
        const total = Number(document.getElementById(`ec_q_total_${idx}`)?.value || 0) || 0;
        const desc = (document.getElementById(`ec_q_desc_${idx}`)?.value || "").trim();

        const any = name || url || total || desc;
        if (!any) continue;

        if (url && !/^https?:\/\//i.test(url)) { alert("La URL de cotización debe comenzar con http:// o https://"); return; }
        cleaned.push({ nombre: name, name, url, link: url, monto_total: total, total, descripcion: desc, desc, texto: desc });
      }
      ts[i].cotizaciones = cleaned;
      // compat opcional
      ts[i].cotizacion = cleaned[0] || null;
    }

    save(KEY_TASKS, ts);
    markDirty();
    emitUpdated("tasks");
    closeModal();
    alert("Campaña actualizada.");
}

  function openClose(activeTasksProvider) {
    const ts = activeTasksProvider ? activeTasksProvider() : load(KEY_TASKS, []).filter(t=>!t.closed);
    if (!ts.length) { alert("No hay campaÃ±as activas para cerrar."); return; }

    openModal(`
      <div class="row">
        <div>
          <div style="font-weight:950;font-size:18px;">Cerrar campaÃ±a</div>
          <div class="muted" style="margin-top:6px;">Indica tipo y motivo (obligatorio).</div>
        </div>
        <button class="btnx" onclick="Campaigns.close()">Cerrar</button>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">CampaÃ±a</label>
        <select id="cl_task">
          ${ts.map(t=>`<option value="${t.id}">${esc(t.title)}</option>`).join("")}
        </select>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Tipo de cierre</label>
        <select id="cl_type">
          <option value="Meta cumplida">Meta cumplida</option>
          <option value="Cancelada">Cancelada</option>
          <option value="Manual">Manual</option>
          <option value="Otro">Otro</option>
        </select>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Motivo (obligatorio)</label>
        <input id="cl_reason" placeholder="Ej: Actividad cancelada / Cambio de plan" />
      </div>

      <div class="actions" style="margin-top:14px;justify-content:flex-end;">
        <button class="btnx" onclick="Campaigns.close()">Cancelar</button>
        <button class="btnx primary" onclick="Campaigns.saveClose()">Cerrar campaÃ±a</button>
      </div>
    `);
  }

  function saveClose() {
    const taskId = document.getElementById("cl_task").value;
    const closeType = document.getElementById("cl_type").value;
    const closeReason = (document.getElementById("cl_reason").value || "").trim();
    if (!closeReason) { alert("Debes ingresar el motivo."); return; }

    const ts = load(KEY_TASKS, []);
    const i = ts.findIndex(x => x.id === taskId);
    if (i < 0) return;

    ts[i].closed = true;
    ts[i].closeType = closeType;
    ts[i].closeReason = closeReason;
    ts[i].closedAt = new Date().toISOString();

    save(KEY_TASKS, ts);
    markDirty();
    emitUpdated("tasks");
    closeModal();
    alert("CampaÃ±a cerrada âœ…");
}

  // expose API
  window.Campaigns = {
    openCreate,
    openCreateTemplate,
    saveCreate,
    saveCreateTemplate,
    openEdit,
    saveEdit,
    openClose,
    saveClose,
    openQuotesDetailById,
    openCampaignDetail,
    close: closeModal,
    calcMonthlyEndDate
  };
})();
