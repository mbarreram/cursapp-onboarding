/* Cursapp assets/app.js – Stable Core (roles separados)
   - Apoderado: paga por sus alumnos (pasarela demo + comprobante)
   - Tesorero/Presidente: administran (conciliación manual + comprobante) y NO pagan
   - Demo: 1 curso activo (2°B 2026 · Colegio X)
*/

(() => {
  // ---------- Utils ----------
  const jload = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const jsave = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const today = () => new Date().toISOString().slice(0, 10);
  const id = (p) => `${p}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
  const esc = (s) => String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  const clp = (n) => Number(n || 0).toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

  // ---------- Keys ----------
  const COURSES_KEY = "cursapp_courses_v1";
  const COURSE_KEY  = "cursapp_active_course_v1";
  const STUDENTS_KEY = "cursapp_students_v1";
  const PAY_KEY = "cursapp_course_payments_v1";
  const RECEIPTS_KEY = "cursapp_receipts_v1";

  // ---------- Auth ----------
  window.logout = () => {
    localStorage.removeItem("cursapp_demo_user");
    location.href = "login.html";
  };
  const user = () => jload("cursapp_demo_user", null);
  const role = () => (user()?.role || "apoderado").toLowerCase();
  const isDirectiva = (r) => r === "tesorero" || r === "presidente";

   function formatCLP(value) {
  const n = Number(value) || 0;
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  });
}
  // ---------- Course ----------
  function ensureCourse(){
    let courses = jload(COURSES_KEY, []);
    if (!courses.length){
      courses = [{ id:"curso_2b_2026_x", name:"2°B 2026", colegio:"Colegio X" }];
      jsave(COURSES_KEY, courses);
    }
    let active = jload(COURSE_KEY, null);
    if(!active){ active = courses[0].id; jsave(COURSE_KEY, active); }
    return { courses, active };
  }
  const courseId = () => ensureCourse().active;
  const course = () => {
    const {courses, active} = ensureCourse();
    return courses.find(c => c.id === active) || courses[0];
  };

  // ---------- Students ----------
  function ensureStudents(){
    const cid = courseId();
    const me = (user()?.name || "Apoderado").trim();

    let students = jload(STUDENTS_KEY, []);
    const has = students.some(s => s.cursoId === cid);
    if(!has){
      students = students.filter(s => s.cursoId !== cid);
      const mine = [
        { id:id("alu"), cursoId:cid, alumno:"Hermano 1", apoderado:me },
        { id:id("alu"), cursoId:cid, alumno:"Hermano 2", apoderado:me },
      ];
      const others = [
        { id:id("alu"), cursoId:cid, alumno:"Ana Soto (Hija)", apoderado:"Ana Soto" },
        { id:id("alu"), cursoId:cid, alumno:"Carlos Díaz (Hijo)", apoderado:"Carlos Díaz" },
        { id:id("alu"), cursoId:cid, alumno:"María Pérez (Hija)", apoderado:"María Pérez" },
      ];
      students = [...mine, ...others];
      jsave(STUDENTS_KEY, students);
    }
    return students;
  }
  const studentsInCourse = () => ensureStudents().filter(s => s.cursoId === courseId());
  const myStudents = () => {
    const me = (user()?.name || "Apoderado").trim();
    return ensureStudents().filter(s => s.cursoId === courseId() && s.apoderado === me);
  };

  // ---------- Receipts ----------
  function addReceipt(payment, payload){
    const list = jload(RECEIPTS_KEY, []);
    const rec = {
      id: id("rc"),
      paymentId: payment.id,
      cursoId: payment.cursoId,
      alumnoId: payment.alumnoId,
      alumno: payment.alumno,
      apoderado: payment.apoderado,
      concept: payment.concept,
      amount: payment.amount,
      method: payload.method,
      ref: payload.ref || "",
      note: payload.note || "",
      paidAt: payload.at || new Date().toISOString()
    };
    const next = list.filter(r => r.paymentId !== payment.id);
    next.unshift(rec);
    jsave(RECEIPTS_KEY, next);
    return rec;
  }
  const receiptByPaymentId = (pid) => jload(RECEIPTS_KEY, []).find(r => r.paymentId === pid) || null;

  // ---------- Payments ----------
  function seedPayments(){
    const cid = courseId();
    let pays = jload(PAY_KEY, []);
    if(pays.some(p => p.cursoId === cid)) return;

    const studs = studentsInCourse();
    const seeded = studs.map((s, i) => ({
      id: id("pay"),
      cursoId: cid,
      alumnoId: s.id,
      alumno: s.alumno,
      apoderado: s.apoderado,
      concept: "Cuota Marzo",
      amount: 10000,
      status: (i % 3 === 0) ? "paid" : "pending",
      date: (i % 3 === 0) ? today() : "-",
      createdAt: today()
    }));

    jsave(PAY_KEY, [...seeded, ...pays]);

    // receipts for paid seeds
    seeded.filter(p => p.status === "paid").forEach(p => {
      if(!receiptByPaymentId(p.id)){
        addReceipt(p, { method:"Conciliación inicial (Demo)", ref:"SEED", note:"Seed", at:new Date().toISOString() });
      }
    });
  }

  // ---------- UI helpers ----------
  function setWhoLine(){
    const el = document.getElementById("whoLine");
    const u = user();
    if(el && u){
      el.textContent = `${u.name} · ${u.role}`;
      el.className = "who";
    }
  }

  function modal(html){
    const root = document.getElementById("modalRoot");
    if(!root) return;
    root.innerHTML = html;
  }
  window.closeModal = () => modal("");

  // ---------- Render ----------
  function render(){
    const r = role();
    const directiva = isDirectiva(r);
    const c = course();
    const root = document.querySelector(".container");
    if(!root) return;

    root.innerHTML = `
      <div class="row" style="align-items:flex-start;">
        <div>
          <h1 style="margin:0;">${directiva ? (r==="tesorero"?"Tesorero":"Presidente") : "Apoderado"}</h1>
          <div class="muted">${esc(c.name)} · ${esc(c.colegio)}</div>
        </div>
      </div>

      <div class="segmented" style="margin-top:12px;">
        <button id="tabHome" class="active">Inicio</button>
        <button id="tabPay">Pagos</button>
      </div>

      <section id="secHome" style="display:block;"></section>
      <section id="secPay" style="display:none;"></section>

      <div id="modalRoot"></div>
    `;

    const tabHome = document.getElementById("tabHome");
    const tabPay = document.getElementById("tabPay");
    tabHome.onclick = () => show("home");
    tabPay.onclick = () => show("pay");

    function show(which){
      document.getElementById("secHome").style.display = which==="home" ? "block":"none";
      document.getElementById("secPay").style.display  = which==="pay" ? "block":"none";
      tabHome.classList.toggle("active", which==="home");
      tabPay.classList.toggle("active", which==="pay");
      if(which==="home") renderHome();
      else renderPay();
    }

    function renderHome(){
      const cid = courseId();
      const pays = jload(PAY_KEY, []).filter(p => p.cursoId === cid);
      const collected = pays.filter(p=>p.status==="paid").reduce((a,b)=>a+Number(b.amount||0),0);
      const pending = pays.filter(p=>p.status!=="paid").reduce((a,b)=>a+Number(b.amount||0),0);

      document.getElementById("secHome").innerHTML = `
  <p class="muted">Resumen financiero del curso</p>

  <div class="grid">
    <div class="card span4">
      <div class="kpiLabel">Total recaudado</div>
      <div class="kpiValue">${formatCLP(collected)}</div>
    </div>

    <div class="card span4">
      <div class="kpiLabel">Total pendiente</div>
      <div class="kpiValue">${formatCLP(pending)}</div>
    </div>

    <div class="card span4">
      <div class="kpiLabel">Tus alumnos</div>
      <div class="kpiValue">${myStudents().length}</div>
    </div>
  </div>
`;
    }

    function renderPay(){
      const cid = courseId();
      let pays = jload(PAY_KEY, []).filter(p => p.cursoId === cid);

      const studs = directiva ? studentsInCourse() : myStudents();
      const defaultSel = directiva ? "ALL" : (studs[0]?.id || "");
      const selected = window.__selStudent ?? defaultSel;
      window.__selStudent = selected;

      const options = directiva
        ? `<option value="ALL">Todos los alumnos</option>` + studs.map(s=>`<option value="${s.id}">${esc(s.alumno)} · ${esc(s.apoderado)}</option>`).join("")
        : studs.map(s=>`<option value="${s.id}">${esc(s.alumno)}</option>`).join("");

      document.getElementById("secPay").innerHTML = `
        <div class="card" style="margin-top:12px;">
          <div class="row">
            <div>
              <div class="kpiLabel">${directiva?"Alumno":"Tus alumnos"}</div>
              <select id="studentSelect" style="margin-top:6px;">${options || `<option value="">Sin alumnos</option>`}</select>
            </div>
            <div class="muted">${directiva?"Conciliación manual (no paga).":"Paga por pasarela (demo)."}</div>
          </div>
        </div>

        <div class="card" style="margin-top:12px;">
          <table>
            <thead><tr><th>Alumno</th><th>Concepto</th><th>Monto</th><th>Estado</th><th style="text-align:right;">Acción</th></tr></thead>
            <tbody id="payTbody"></tbody>
          </table>
        </div>
      `;

      const sel = document.getElementById("studentSelect");
      if(sel) sel.value = selected;
      sel.onchange = () => { window.__selStudent = sel.value; renderPay(); };

      let view = pays;
      if(directiva){
        if(selected !== "ALL") view = pays.filter(p => p.alumnoId === selected);
      } else {
        const myIds = new Set(myStudents().map(s=>s.id));
        view = pays.filter(p => myIds.has(p.alumnoId));
        if(selected) view = view.filter(p => p.alumnoId === selected);
      }

      document.getElementById("payTbody").innerHTML = view.map(p=>{
        const status = p.status==="paid"
          ? `<span class="tag ok">Pagado</span>`
          : `<span class="tag warn">Pendiente</span>`;
        const rec = receiptByPaymentId(p.id);

        let action = `<span class="muted">—</span>`;
        if(!directiva){
          action = (p.status!=="paid")
            ? `<button class="btn primary" onclick="openPayModal('${p.id}')">Pagar</button>`
            : (rec ? `<button class="btn ghost" onclick="openReceipt('${p.id}')">Comprobante</button>` : `<span class="muted">Pagado</span>`);
        } else {
          action = (p.status!=="paid")
            ? `<button class="btn" onclick="openReconModal('${p.id}')">Conciliar</button>`
            : (rec ? `<button class="btn ghost" onclick="openReceipt('${p.id}')">Comprobante</button>` : `<span class="muted">Pagado</span>`);
        }

        return `<tr>
          <td>${esc(p.alumno)}</td>
          <td>${esc(p.concept)}</td>
          <td>${clp(p.amount)}</td>
          <td>${status}</td>
          <td style="text-align:right; white-space:nowrap;">${action}</td>
        </tr>`;
      }).join("") || `<tr><td colspan="5" class="muted">Sin datos</td></tr>`;

      // Modals
      window.openPayModal = (paymentId) => {
        const p = jload(PAY_KEY, []).find(x => x.id === paymentId);
        if(!p) return;
        modal(`
          <div style="position:fixed; inset:0; background:rgba(17,24,39,.45); z-index:10000; display:flex; align-items:flex-end; justify-content:center; padding:14px;">
            <div class="card" style="width:min(560px, 100%); margin-bottom:12px;">
              <div class="row">
                <div>
                  <div style="font-weight:950; font-size:18px;">Pasarela (Demo)</div>
                  <div class="muted">${esc(p.alumno)} · ${esc(p.concept)} · ${clp(p.amount)}</div>
                </div>
                <button class="btn" onclick="closeModal()">Cerrar</button>
              </div>
              <div style="margin-top:12px;">
                <div class="kpiLabel">Método</div>
                <select id="payMethod" style="width:100%; margin-top:6px;">
                  <option value="Webpay (Demo)">Webpay (Demo)</option>
                  <option value="Transferencia (Demo)">Transferencia (Demo)</option>
                </select>
              </div>
              <div class="actions" style="justify-content:flex-end;">
                <button class="btn ghost" onclick="closeModal()">Cancelar</button>
                <button class="btn primary" onclick="confirmPay('${p.id}')">Pagar</button>
              </div>
            </div>
          </div>
        `);
      };

      window.confirmPay = (paymentId) => {
        const method = document.getElementById("payMethod")?.value || "Webpay (Demo)";
        let all = jload(PAY_KEY, []);
        const idx = all.findIndex(x=>x.id===paymentId);
        if(idx<0) return;
        all[idx].status = "paid";
        all[idx].date = today();
        jsave(PAY_KEY, all);
        addReceipt(all[idx], { method, ref:id("trx"), note:"Pago automático (demo)", at:new Date().toISOString() });
        closeModal();
        renderPay();
        alert("Pago aprobado (demo).");
      };

      window.openReconModal = (paymentId) => {
        const p = jload(PAY_KEY, []).find(x => x.id === paymentId);
        if(!p) return;
        modal(`
          <div style="position:fixed; inset:0; background:rgba(17,24,39,.45); z-index:10000; display:flex; align-items:flex-end; justify-content:center; padding:14px;">
            <div class="card" style="width:min(560px, 100%); margin-bottom:12px;">
              <div class="row">
                <div>
                  <div style="font-weight:950; font-size:18px;">Conciliación manual</div>
                  <div class="muted">${esc(p.alumno)} · ${esc(p.concept)} · ${clp(p.amount)}</div>
                </div>
                <button class="btn" onclick="closeModal()">Cerrar</button>
              </div>

              <div style="margin-top:12px;">
                <div class="kpiLabel">Método</div>
                <select id="reconMethod" style="width:100%; margin-top:6px;">
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia">Transferencia</option>
                </select>
              </div>

              <div style="margin-top:12px;">
                <div class="kpiLabel">Referencia (obligatoria)</div>
                <input id="reconRef" placeholder="Ej: BOLETA-123" style="width:100%; margin-top:6px;">
              </div>

              <div class="actions" style="justify-content:flex-end;">
                <button class="btn ghost" onclick="closeModal()">Cancelar</button>
                <button class="btn primary" onclick="confirmRecon('${p.id}')">Marcar pagado</button>
              </div>
            </div>
          </div>
        `);
      };

      window.confirmRecon = (paymentId) => {
        const method = document.getElementById("reconMethod")?.value || "Efectivo";
        const ref = (document.getElementById("reconRef")?.value || "").trim();
        if(!ref){ alert("Ingresa referencia"); return; }
        let all = jload(PAY_KEY, []);
        const idx = all.findIndex(x=>x.id===paymentId);
        if(idx<0) return;
        all[idx].status = "paid";
        all[idx].date = today();
        jsave(PAY_KEY, all);
        addReceipt(all[idx], { method, ref, note:"Conciliación manual (demo)", at:new Date().toISOString() });
        closeModal();
        renderPay();
        alert("Conciliado (demo).");
      };

      window.openReceipt = (paymentId) => {
        const rec = receiptByPaymentId(paymentId);
        if(!rec){ alert("No hay comprobante"); return; }
        const c = course();
        const html = `
          <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
          <title>Comprobante ${rec.id}</title>
          <style>
            body{font-family:system-ui,-apple-system;background:#f5f7fb;margin:0;padding:16px;}
            .card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:16px;max-width:560px;margin:0 auto;}
            .muted{color:#64748b;font-size:13px;}
            .row{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:10px;}
            .k{color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.04em;font-weight:800;}
            .v{font-weight:900;}
            button{border:none;padding:10px 12px;border-radius:12px;background:#5b5ce2;color:#fff;font-weight:800;width:100%;margin-top:14px;}
          </style></head><body>
            <div class="card">
              <h1 style="margin:0 0 6px;">Comprobante</h1>
              <div class="muted">ID: ${rec.id}</div>
              <div class="row"><div><div class="k">Curso</div><div class="v">${esc(c.name)}</div></div><div><div class="k">Monto</div><div class="v">${clp(rec.amount)}</div></div></div>
              <div class="row"><div><div class="k">Alumno</div><div class="v">${esc(rec.alumno)}</div></div><div><div class="k">Apoderado</div><div class="v">${esc(rec.apoderado)}</div></div></div>
              <div class="row"><div><div class="k">Concepto</div><div class="v">${esc(rec.concept)}</div></div><div><div class="k">Método</div><div class="v">${esc(rec.method)}</div></div></div>
              <div class="row"><div><div class="k">Ref</div><div class="v">${esc(rec.ref||'-')}</div></div><div><div class="k">Fecha</div><div class="v">${esc(new Date(rec.paidAt).toLocaleString('es-CL'))}</div></div></div>
              <button onclick="window.print()">Imprimir / Guardar PDF</button>
            </div>
          </body></html>`;
        const w = window.open("", "_blank");
        if(!w){ alert("Popup bloqueado"); return; }
        w.document.open(); w.document.write(html); w.document.close();
      };
    }

    renderHome();
  }

  // ---------- Init ----------
  document.addEventListener("DOMContentLoaded", () => {
    // show JS errors on screen (Safari-friendly)
    window.addEventListener("error", (e) => {
      try{
        const msg = (e && (e.message || (e.error && e.error.message))) || "Error JS";
        document.body.insertAdjacentHTML("beforeend",
          `<div style="position:fixed;left:12px;right:12px;bottom:90px;z-index:20000;background:#fee2e2;border:1px solid #fecaca;color:#991b1b;padding:10px 12px;border-radius:12px;font-weight:800;">JS error: ${esc(msg)}</div>`);
      }catch(_){}
    });

    if(!user()) return;

    ensureCourse();
    seedPayments();
    setWhoLine();

    const container = document.querySelector(".container");
    if(container) render(container);
  });
})();
