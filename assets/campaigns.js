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

  // Payments key (shared) — used to instantiate pending payments for mandatory campaigns
  const SCOPED_PAYMENTS = sk("payments_v1");
  const KEY_PAYMENTS =
    (localStorage.getItem(SCOPED_PAYMENTS) != null
      ? SCOPED_PAYMENTS
      : (detectKey(["cursapp_payments_v1", "payments", "cobros", "cursapp_pagos_v1"]) || SCOPED_PAYMENTS));

  // Enrollments (approved apoderados) — to pre-create pending payments per apoderado
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
    // ✅ Mobile-safe modal: ensure full visibility + internal scroll (iOS)
    root.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:10000;display:flex;align-items:center;justify-content:center;padding:14px;">
        <div class="card" style="width:min(820px,100%);max-height:calc(100vh - 28px);overflow:auto;-webkit-overflow-scrolling:touch;">
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

      <input id="cc_template" type="hidden" value="" />

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

  // ---------- Templates (Plantillas destacadas) ----------
  // Gira / Graduación: cuotas abiertas, saldo años anteriores y múltiples cotizaciones.
  function openCreateTemplate(template){
    const tpl = String(template||"").toLowerCase();
    const defaultStart = todayISO();
    const titleDefault = tpl === "graduacion" ? "Graduación" : "Gira de estudio";
    const descDefault  = tpl === "graduacion" ? "Cotizaciones + plan de cuotas" : "Cotizaciones + plan de cuotas";

    openModal(`
      <div class="row">
        <div>
          <div style="font-weight:950;font-size:18px;">${esc(titleDefault)}</div>
          <div class="muted" style="margin-top:6px;">Plantilla destacada</div>
        </div>
        <button class="btnx" onclick="Campaigns.close()">Cerrar</button>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Nombre</label>
        <input id="tc_title" value="${esc(titleDefault)}" />
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Descripción</label>
        <input id="tc_desc" value="${esc(descDefault)}" />
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:160px;">
          <label style="font-weight:900;">Participación</label>
          <select id="tc_mandatory">
            <option value="false" selected>No obligatoria</option>
            <option value="true">Obligatoria</option>
          </select>
        </div>
        <div style="flex:1;min-width:160px;">
          <label style="font-weight:900;">Monto cuota</label>
          <input id="tc_amount" inputmode="numeric" placeholder="Ej: 25000" />
        </div>
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:160px;">
          <label style="font-weight:900;">Cuotas / meses</label>
          <input id="tc_months" inputmode="numeric" min="1" value="10" />
          <div class="muted" style="margin-top:6px;font-size:12px;">Cuotas abiertas. Mínimo 1 (recomendado 10).</div>
        </div>
        <div style="flex:1;min-width:160px;">
          <label style="font-weight:900;">Saldo años anteriores</label>
          <input id="tc_prev" inputmode="numeric" placeholder="Ej: 120000" />
          <div class="muted" style="margin-top:6px;font-size:12px;">Se considera como reunido (curso).</div>
        </div>
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:160px;">
          <label style="font-weight:900;">Inicio</label>
          <input id="tc_start" type="date" value="${defaultStart}" />
        </div>
        <div style="flex:1;min-width:160px;">
          <label style="font-weight:900;">Fin</label>
          <input id="tc_due" type="date" />
          <div class="muted" style="margin-top:6px;font-size:12px;">Se calcula automáticamente según cuotas.</div>
        </div>
      </div>

      <div class="card" style="margin-top:12px;padding:12px;border:1px solid rgba(0,0,0,.08);">
        <div style="font-weight:950;">Monto meta alumno</div>
        <div class="muted" style="margin-top:6px;">Monto cuota × cuotas. (Referencial)</div>
        <div id="tc_meta_alumno" style="margin-top:8px;font-size:22px;font-weight:950;">$0</div>
      </div>

      <div style="margin-top:12px;">
        <div style="font-weight:950;">Cotizaciones</div>
        <div class="muted" style="margin-top:6px;font-size:12px;">Puedes agregar varias cotizaciones (distintos ítems).</div>
        <div id="tc_quotes" style="margin-top:10px;display:flex;flex-direction:column;gap:10px;"></div>
        <button class="btnx" id="tc_add_quote" type="button" style="margin-top:10px;">+ Agregar cotización</button>
      </div>

      <div class="actions" style="margin-top:14px;justify-content:flex-end;">
        <button class="btnx" onclick="Campaigns.close()">Cancelar</button>
        <button class="btnx primary" onclick="Campaigns.saveCreateTemplate('${esc(tpl)}')">Crear</button>
      </div>
    `);

    // logic: auto-calc due + meta alumno
    const startEl = document.getElementById("tc_start");
    const dueEl   = document.getElementById("tc_due");
    const monthsEl= document.getElementById("tc_months");
    const amountEl= document.getElementById("tc_amount");
    const metaEl  = document.getElementById("tc_meta_alumno");

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
        <div class="card" style="padding:12px;border:1px solid rgba(0,0,0,.10);">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
            <div style="font-weight:950;">Cotización ${idx+1}</div>
            <button class="btnx danger" type="button" data-qrm="${idx}">Quitar</button>
          </div>
          <div style="margin-top:10px;">
            <label style="font-weight:900;">Nombre cotización</label>
            <input data-q="nombre" placeholder="Ej: Alojamiento" />
          </div>
          <div style="margin-top:10px;">
            <label style="font-weight:900;">URL</label>
            <input data-q="url" placeholder="https://..." />
          </div>
          <div style="margin-top:10px;">
            <label style="font-weight:900;">Monto total</label>
            <input data-q="monto_total" inputmode="numeric" placeholder="Ej: 2000000" />
          </div>
          <div style="margin-top:10px;">
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

  function saveCreateTemplate(tpl){
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
    }).filter(c=>c.nombre||c.url||c.monto_total||c.descripcion);

    const newTaskId = uid("t");
    const ts = load(KEY_TASKS, []);
    ts.unshift({
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
      cotizaciones,
    });
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
    const title = String(task.title||"Campaña");
    const items = (Array.isArray(task.cotizaciones)?task.cotizaciones:[])
      .map((c)=>({
        nombre: String(c?.nombre||c?.title||c?.name||"").trim(),
        url: String(c?.url||c?.link||"").trim(),
        monto_total: Number(c?.monto_total ?? c?.monto ?? c?.total ?? 0),
        descripcion: String(c?.descripcion||c?.texto||c?.description||"").trim(),
      }))
      .filter(c=>c.nombre||c.url||c.monto_total||c.descripcion);
    const total = items.reduce((a,x)=>a+Number(x.monto_total||0),0);

    openModal(`
      <div class="row">
        <div>
          <div style="font-weight:950;font-size:18px;">Cotizaciones</div>
          <div class="muted" style="margin-top:6px;">${esc(title)} · ${items.length} ítem(s)</div>
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
                <div style="font-weight:950;">${esc(c.nombre || `Cotización ${i+1}`)}</div>
                ${c.monto_total?`<div style="font-weight:950;">$${Number(c.monto_total).toLocaleString("es-CL")}</div>`:""}
              </div>
              ${c.descripcion?`<div class="muted" style="margin-top:6px;line-height:1.35;">${esc(c.descripcion)}</div>`:""}
              ${c.url?`<div style="margin-top:10px;"><a class="btnx" style="display:inline-block;border:1px solid rgba(0,0,0,.14);text-decoration:none;" href="${esc(c.url)}" target="_blank" rel="noopener">Abrir URL</a></div>`:""}
            </div>
          `).join("")}
        </div>
      ` : `<div class="muted" style="margin-top:12px;">Aún no hay cotizaciones registradas.</div>`}
    `);
  }

  function openCampaignDetail(taskId, mode){
    const ts = load(KEY_TASKS, []);
    const t = ts.find(x=>String(x.id)===String(taskId));
    if(!t) return;
    const type = String(t.type||"single");
    const part = (t.mandatoryParticipation === false) ? "No obligatoria" : "Obligatoria";
    const tpl = String(t.template||"");
    const cotz = Array.isArray(t.cotizaciones) ? t.cotizaciones : [];
    const totalCot = cotz.reduce((a,x)=>a+Number(x?.monto_total??x?.monto??x?.total??0),0);
    const saldoPrev = Number(t.saldo_prev||0);

    openModal(`
      <div class="row">
        <div>
          <div style="font-weight:950;font-size:18px;">Detalle campaña</div>
          <div class="muted" style="margin-top:6px;">${esc(t.title||"")}</div>
        </div>
        <button class="btnx" onclick="Campaigns.close()">Cerrar</button>
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <div class="chipInfoPill">📄 Tipo <b>${type==="monthly"?"Mensual":"Pago único"}</b></div>
        <div class="chipInfoPill">🔒 Participación <b>${part}</b></div>
        ${tpl?`<div class="chipInfoPill ok">✨ Plantilla <b>${esc(tpl)}</b></div>`:""}
      </div>

      <div class="card" style="margin-top:12px;padding:12px;border:1px solid rgba(0,0,0,.08);">
        <div class="muted">Fechas</div>
        <div style="margin-top:6px;font-weight:950;">${esc(t.startDate||"")} → ${esc(t.dueDate||"")}</div>
        ${t.description?`<div class="muted" style="margin-top:10px;line-height:1.35;">${esc(t.description)}</div>`:""}
      </div>

      ${(saldoPrev>0)?`
        <div class="card" style="margin-top:12px;padding:12px;border:1px solid rgba(0,0,0,.08);">
          <div class="muted">Saldo años anteriores (curso)</div>
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
        ${String(mode||"")==="presidente" ? `<button class="btnx" onclick="Campaigns.openEdit('${esc(t.id)}')">✏️ Editar</button>` : ``}
      </div>
    `);
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

    const newTaskId = uid("t");

    const ts = load(KEY_TASKS, []);
    ts.unshift({
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
    });

    save(KEY_TASKS, ts);

    // ✅ Mandatory campaigns: pre-create pending payments per approved apoderado.
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
              concept: type === "monthly" ? `${title} · Cuota 1/${Math.max(1, Number(months||1))}` : "Pago único",
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

      ${(t.template === "gira" || t.template === "graduacion") ? `
        <div style="margin-top:14px;border-top:1px solid rgba(0,0,0,.06);padding-top:12px;">
          <div style="margin-bottom:10px;">
            <label style="font-weight:900;">Saldo años anteriores</label>
            <input id="ec_prev" inputmode="numeric" value="${Number(t.saldo_prev||0)}" placeholder="Ej: 120000" />
            <div class="muted" style="margin-top:6px;font-size:12px;">Se considera como reunido (curso).</div>
          </div>
          <div style="font-weight:950;margin-bottom:8px;">Cotizaciones</div>
          <div class="muted" style="font-size:12px;line-height:1.35;margin-bottom:10px;">Puedes agregar varias cotizaciones (distintos ítems).</div>
          <div id="ec_quotes" style="display:grid;gap:10px;"></div>
          <div style="margin-top:10px;">
            <button class="btnx" id="ec_add_quote" type="button">+ Agregar cotización</button>
          </div>
        </div>
      ` : ``}

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

    // Cotizaciones (solo plantilla Gira)
    if (t.template === "gira") {
      const normalize = (q) => ({
        name: (q?.name || q?.nombre || "").trim(),
        url: (q?.url || q?.link || "").trim(),
        total: Number(q?.total || q?.montoTotal || q?.monto || 0) || 0,
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

    // Saldo años anteriores (Plantillas)
    if (ts[i].template === "gira" || ts[i].template === "graduacion") {
      const prev = Math.max(0, Number(document.getElementById("ec_prev")?.value || ts[i].saldo_prev || 0));
      ts[i].saldo_prev = prev;
    }

    // Cotizaciones (Plantillas: Gira / Graduación)
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
        cleaned.push({ nombre: name, url, monto_total: total, descripcion: desc });
      }
      ts[i].cotizaciones = cleaned;
      // compat opcional
      ts[i].cotizacion = cleaned[0] || null;
    }

    save(KEY_TASKS, ts);
    markDirty();
    emitUpdated("tasks");
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
    emitUpdated("tasks");
    closeModal();
    alert("Campaña cerrada ✅");
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
