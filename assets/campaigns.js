/* =========================================================
   Cursapp · Campaigns (Shared) — v1.0
   Fuente de verdad para:
   - Crear campaña (FULL): tipo, monto, cuotas/meses, participación, fechas
   - Editar campaña (FULL)
   - Cerrar campaña (tipo + motivo)
   - Cálculo automático de fecha fin para mensual (cuotas)
   - Marca "requiere nuevo informe" (dirty) automáticamente

   Diseñado para ser usado por Presidente y Tesorero (y otros).
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

  // ✅ Use course-scoped tasks key if available; fallback to legacy keys for existing demos
  const SCOPED_TASKS = sk("tasks_v1");
  const KEY_TASKS =
    (localStorage.getItem(SCOPED_TASKS) != null
      ? SCOPED_TASKS
      : (detectKey(["cursapp_tasks_v1", "tasks", "campanas", "cursapp_campaigns_v1"]) || SCOPED_TASKS));
  const KEY_DIRTY =
    detectKey(["cursapp_reports_dirty_v1", "reportsDirty", "cursapp_dirty_reports"]) || "cursapp_reports_dirty_v1";

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
    root.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:10000;display:flex;align-items:flex-end;justify-content:center;padding:14px;">
        <div class="card" style="width:min(820px,100%);margin-bottom:12px;">
          ${html}
        </div>
      </div>
    `;
  }

  function closeModal() {
    const root = document.getElementById("modalRoot");
    if (root) root.innerHTML = "";
  }

  // ---------- Shared forms ----------
  function openCreate() {
    const defaultStart = todayISO();

    openModal(`
      <div class="row">
        <div>
          <div style="font-weight:950;font-size:18px;">Crear campaña</div>
          <div class="muted" style="margin-top:6px;">
            Si es mensual, la fecha fin se calcula automáticamente según cuotas.
          </div>
        </div>
        <button class="btnx" onclick="Campaigns.close()">Cerrar</button>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Nombre campaña</label>
        <input id="cc_title" placeholder="Ej: Cuota paseo" />
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Descripción (opcional)</label>
        <input id="cc_desc" placeholder="Ej: Transporte y entradas" />
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:160px;">
          <label style="font-weight:900;">Tipo</label>
          <select id="cc_type">
            <option value="single">Pago único</option>
            <option value="monthly">Mensual</option>
          </select>
        </div>
        <div style="flex:1;min-width:160px;">
          <label style="font-weight:900;">Participación</label>
          <select id="cc_mandatory">
            <option value="true">Obligatoria</option>
            <option value="false">No obligatoria</option>
          </select>
        </div>
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:160px;">
          <label style="font-weight:900;">Monto (obligatorio)</label>
          <input id="cc_amount" inputmode="numeric" placeholder="Ej: 5000" />
        </div>
        <div style="flex:1;min-width:160px;">
          <label style="font-weight:900;">Meta total (opcional)</label>
          <input id="cc_goal" inputmode="numeric" placeholder="Ej: 150000" />
        </div>
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:160px;">
          <label style="font-weight:900;">Inicio</label>
          <input id="cc_start" type="date" value="${defaultStart}" />
        </div>
        <div style="flex:1;min-width:160px;">
          <label style="font-weight:900;">Fin</label>
          <input id="cc_due" type="date" />
          <div class="muted" style="margin-top:6px;font-size:12px;">(Mensual: se calcula automáticamente)</div>
        </div>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Cuotas / Meses (solo mensual)</label>
        <input id="cc_months" inputmode="numeric" placeholder="Ej: 3" />
      </div>

      <div class="actions" style="margin-top:14px;justify-content:flex-end;">
        <button class="btnx" onclick="Campaigns.close()">Cancelar</button>
        <button class="btnx primary" onclick="Campaigns.saveCreate()">Crear</button>
      </div>
    `);

    const typeEl = document.getElementById("cc_type");
    const startEl = document.getElementById("cc_start");
    const dueEl = document.getElementById("cc_due");
    const monthsEl = document.getElementById("cc_months");

    function syncMonthly() {
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
    typeEl.onchange = syncMonthly;
    startEl.onchange = syncMonthly;
    monthsEl.oninput = syncMonthly;
    syncMonthly();
  }

  function saveCreate() {
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
    if (!amount || amount <= 0) { alert("Debes ingresar un monto válido."); return; }

    if (type === "monthly") {
      if (!months || months <= 0) { alert("Si es mensual, indica cuotas/meses."); return; }
      dueDate = calcMonthlyEndDate(startDate, months);
      if (!dueDate) { alert("No se pudo calcular la fecha fin."); return; }
    } else {
      months = 1;
      if (!dueDate) { alert("Debes seleccionar una fecha fin."); return; }
    }

    const ts = load(KEY_TASKS, []);
    ts.unshift({
      id: uid("t"),
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
    });

    save(KEY_TASKS, ts);
    markDirty();
    closeModal();
    alert("Campaña creada ✅");
  }

  function openEdit(taskId) {
    const ts = load(KEY_TASKS, []);
    const t = ts.find(x => x.id === taskId);
    if (!t) return;

    openModal(`
      <div class="row">
        <div>
          <div style="font-weight:950;font-size:18px;">Editar campaña</div>
          <div class="muted" style="margin-top:6px;">Mensual: fin se recalcula según cuotas.</div>
        </div>
        <button class="btnx" onclick="Campaigns.close()">Cerrar</button>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Nombre</label>
        <input id="ec_title" value="${esc(t.title)}" />
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Descripción</label>
        <input id="ec_desc" value="${esc(t.description || "")}" />
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:160px;">
          <label style="font-weight:900;">Tipo</label>
          <select id="ec_type">
            <option value="single" ${t.type==="single"?"selected":""}>Pago único</option>
            <option value="monthly" ${t.type==="monthly"?"selected":""}>Mensual</option>
          </select>
        </div>
        <div style="flex:1;min-width:160px;">
          <label style="font-weight:900;">Participación</label>
          <select id="ec_mandatory">
            <option value="true" ${t.mandatoryParticipation?"selected":""}>Obligatoria</option>
            <option value="false" ${!t.mandatoryParticipation?"selected":""}>No obligatoria</option>
          </select>
        </div>
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:160px;">
          <label style="font-weight:900;">Monto</label>
          <input id="ec_amount" inputmode="numeric" value="${Number(t.amount||0)}" />
        </div>
        <div style="flex:1;min-width:160px;">
          <label style="font-weight:900;">Meta total</label>
          <input id="ec_goal" inputmode="numeric" value="${Number(t.goalTotal||0)}" />
        </div>
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:160px;">
          <label style="font-weight:900;">Inicio</label>
          <input id="ec_start" type="date" value="${esc(t.startDate||todayISO())}" />
        </div>
        <div style="flex:1;min-width:160px;">
          <label style="font-weight:900;">Fin</label>
          <input id="ec_due" type="date" value="${esc(t.dueDate||"")}" />
          <div class="muted" style="margin-top:6px;font-size:12px;">(Mensual: se calcula automáticamente)</div>
        </div>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Cuotas / Meses (solo mensual)</label>
        <input id="ec_months" inputmode="numeric" value="${Number(t.months||1)}" />
      </div>

      <div class="actions" style="margin-top:14px;justify-content:flex-end;">
        <button class="btnx" onclick="Campaigns.close()">Cancelar</button>
        <button class="btnx primary" onclick="Campaigns.saveEdit('${esc(t.id)}')">Guardar</button>
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
    if (!amount || amount <= 0) { alert("Monto inválido."); return; }

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

    save(KEY_TASKS, ts);
    markDirty();
    closeModal();
    alert("Campaña actualizada ✅");
  }

  function openClose(activeTasksProvider) {
    const ts = activeTasksProvider ? activeTasksProvider() : load(KEY_TASKS, []).filter(t=>!t.closed);
    if (!ts.length) { alert("No hay campañas activas para cerrar."); return; }

    openModal(`
      <div class="row">
        <div>
          <div style="font-weight:950;font-size:18px;">Cerrar campaña</div>
          <div class="muted" style="margin-top:6px;">Indica tipo y motivo (obligatorio).</div>
        </div>
        <button class="btnx" onclick="Campaigns.close()">Cerrar</button>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Campaña</label>
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
        <button class="btnx primary" onclick="Campaigns.saveClose()">Cerrar campaña</button>
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
    closeModal();
    alert("Campaña cerrada ✅");
  }

  // expose API
  window.Campaigns = {
    openCreate,
    saveCreate,
    openEdit,
    saveEdit,
    openClose,
    saveClose,
    close: closeModal,
    calcMonthlyEndDate
  };
})();
