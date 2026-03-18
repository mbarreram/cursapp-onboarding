(function () {
  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modalRoot");
  const navItems = Array.from(document.querySelectorAll(".navItem"));
  const menuBtn = document.getElementById("menuBtn");
  const menuDropdown = document.getElementById("menuDropdown");
  const resetBtn = document.getElementById("resetBtn");
  const logoutBtn = document.getElementById("logoutBtn");


  // ---- session bootstrap (evita courseKey vacío tras borrar data) ----
  function readSession(){
    try{ return JSON.parse(localStorage.getItem("cursapp_session_v1") || "null"); }catch(e){ return null; }
  }
  (function ensureActiveCourseFromSession(){
    try{
      const s = readSession();
      if(s && s.courseKey){
        const cur = localStorage.getItem("cursapp_active_course_v1") || "";
        if(!cur) localStorage.setItem("cursapp_active_course_v1", String(s.courseKey));
      }
    }catch(e){}
  })();

  // ---- helpers ----
  const esc = (s) =>
    String(s ?? "").replace(/[&<>'"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c])
    );
  const clp = (n) => "$" + Number(n || 0).toLocaleString("es-CL");

  function shareWhatsApp(text){
    const msg = String(text || "").trim();
    if(!msg){ alert("No hay contenido para compartir."); return; }
    const url = "https://wa.me/?text=" + encodeURIComponent(msg);
    const w = window.open(url, "_blank");
    if(!w){
      location.href = url;
    }
  }

  function shareExecutiveWhatsApp(){
    const ym = currentYM();
    const cobradoMes = collectedMonth(ym);
    const gastadoMes = spentMonth(ym);
    const saldoMes = cobradoMes - gastadoMes;
    const saldoDisponible = saldoCourse();

    const msg = [
      `📊 Informe Ejecutivo del Curso`,
      ``,
      `Periodo: ${ym}`,
      ``,
      `💰 Cobrado mes: ${clp(cobradoMes)}`,
      `🧾 Gastado mes: ${clp(gastadoMes)}`,
      `⚖️ Saldo mes: ${clp(saldoMes)}`,
      ``,
      `🏦 Saldo disponible: ${clp(saldoDisponible)}`,
      ``,
      `Informe generado en Cursapp`
    ].join("\n");

    shareWhatsApp(msg);
  }


// ---------- clipboard helper (iOS Safari friendly) ----------
async function copyTextToClipboard(text){
  const s = String(text||"");
  // Prefer modern API (HTTPS + user gesture)
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      await navigator.clipboard.writeText(s);
      return true;
    }
  }catch(e){}
  // Fallback: temporary textarea + execCommand('copy')
  try{
    const ta = document.createElement("textarea");
    ta.value = s;
    ta.setAttribute("readonly","");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.width = "1px";
    ta.style.height = "1px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return !!ok;
  }catch(e){}
  return false;
}
  const uid = (p = "id") => `${p}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;

  function detectKey(candidates) {
    for (const k of candidates) if (localStorage.getItem(k) != null) return k;
    return "";
  }

  // storage keys (scoped por curso; listo para producción)
  const sk = (base)=> (window.CURSAPP && window.CURSAPP.scopedKey) ? window.CURSAPP.scopedKey(base) : `cursapp_${base}`;
  const KEY_TASKS = sk("tasks_v1");
  const KEY_PAYMENTS = sk("payments_v1");
  const KEY_EXPENSES = sk("expenses_v1");
  const KEY_MONTHLY_REPORTS = sk("monthly_reports_v1");
  const KEY_ENROLLMENTS = sk("enrollments_v1");
  const KEY_DIRTY = detectKey(["cursapp_reports_dirty_v1", "reportsDirty", "cursapp_dirty_reports"]) || "cursapp_reports_dirty_v1";

  // ---- notifier: refrescar indicadores cuando se actualiza storage (misma sesión) ----
  // Esto evita que al aprobar un apoderado en Presidente los indicadores queden desfasados hasta re-login.
  (function patchLocalStorageSetItem(){
    try{
      if(window.__cursapp_setItemPatched) return;
      const _orig = localStorage.setItem.bind(localStorage);
      localStorage.setItem = function(k, v){
        _orig(k, v);
        try{ window.dispatchEvent(new CustomEvent('cursapp:dataChanged', { detail: { key: String(k||'') } })); }catch(e){}
      };
      window.__cursapp_setItemPatched = true;
    }catch(e){}
  })();

  const load = (k, def) => {
    try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(def)); }
    catch { return def; }
  };
  const save = (k, v) => {
    localStorage.setItem(k, JSON.stringify(v));
    // localStorage.setItem ya emite cursapp:dataChanged (ver patchLocalStorageSetItem),
    // pero mantenemos este try por compatibilidad si el patch no aplica.
    try{ window.dispatchEvent(new CustomEvent('cursapp:dataChanged', { detail: { key: String(k||'') } })); }catch(e){}
  };


  // ---- Payments materialization (para que indicadores no queden en 0) ----
function hash32(str){
    let h = 5381;
    const s = String(str||"");
    for(let i=0;i<s.length;i++) h = ((h<<5)+h) + s.charCodeAt(i);
    return (h>>>0).toString(16);
  }
  function alumnoIdOf(courseKey, apoderadoEmail, alumnoLabel){
    return "alu_" + hash32([courseKey, apoderadoEmail, alumnoLabel].join("|"));
  }
  function paymentKeyOf(courseKey, taskId, apoderadoEmail, alumnoId, period, installmentIndex){
    return [courseKey, taskId, apoderadoEmail, alumnoId, (period||""), String(installmentIndex||"")].join("|");
  }
    function normalizeTask(t){
    t = t || {};
    const title = t.title || t.name || t.nombre || "Campaña";
    const startDate = t.startDate || t.inicio || t.start || t.from || todayISO();
    const dueDate = t.dueDate || t.endDate || t.fin || t.end || t.to || "";
    const partRaw = (t.participation ?? t.participacion ?? (t.mandatoryParticipation===false ? "no" : "si"));
    const mandatoryParticipation = (t.mandatoryParticipation !== undefined)
      ? !!t.mandatoryParticipation
      : (String(partRaw).toLowerCase().includes("oblig") || String(partRaw).toLowerCase()==="mandatory" || String(partRaw).toLowerCase()==="si");

    const status = String(t.status || t.estado || "").toLowerCase();
    const closed = (t.closed !== undefined) ? !!t.closed : (status==="closed" || status==="cerrada" || status==="canceled" || status==="cancelada");

    const typeRaw = String(t.type || t.tipo || "single").toLowerCase();
    const type = (typeRaw.includes("mens") || typeRaw==="monthly") ? "monthly" : "single";

    const months = Number(t.months || t.cuotas || t.meses || 1) || 1;
    const amount = Number(t.amount || t.monto || 0) || 0;

    return {
      ...t,
      id: t.id || t.taskId || t.campaignId,
      title,
      startDate,
      dueDate,
      endDate: dueDate,
      mandatoryParticipation,
      type,
      months,
      amount,
      closed
    };
  }

  function normalizeTasks(list){
    return (list || []).map(normalizeTask).filter(t=>t && t.id);
  }
  function ensurePaymentsForIdentity(ident, tasksAll, paysAll){
      ident = ident || {};
      const courseKey = String(ident.courseKey || localStorage.getItem(KEY_ACTIVE_COURSE) || "").trim();
      if(!courseKey) return paysAll || [];
      const apoderadoId = String(ident.apoderadoId||"").trim();
      const alumnoLabel = String(ident.alumnoId||"").trim();
      const email = String(ident.email||"").toLowerCase().trim();
      const aidStrong = (apoderadoId || email || "unknown_apoderado");
      const alumnoId = alumnoIdOf(courseKey, aidStrong, alumnoLabel);
  
      const out = (paysAll||[]).slice();
  
      // Normaliza claves legacy (sin period / installmentIndex) para evitar duplicados
      const byKey = new Set(out.map(p=>{
        if(p && p.paymentKey) return String(p.paymentKey);
        const ck = String(p.courseKey||"").trim();
        const aid = String(p.apoderadoKey||p.apoderadoId||"").trim() || String(p.apoderadoEmail||p.email||"").toLowerCase().trim();
        const tid = String(p.fromTaskId||"");
        const per = String(p.period||ymFromISO(p.dueDate)||"");
        // ⚠️ si no existe installmentIndex, asumimos 1 (pago único o legacy)
        const idx = String((p.installmentIndex==null || p.installmentIndex==="") ? 1 : p.installmentIndex);
        const alu = String(p.alumnoId||"");
        return paymentKeyOf(ck, tid, aid, alu, per, idx);
      }));
  
      function pushPay(t, period, installmentIndex, dueDate, concept){
        const pk = paymentKeyOf(courseKey, t.id, aidStrong, alumnoId, period, installmentIndex);
        if(byKey.has(pk)) return;
  
        out.unshift({
          id: uid("pay"),
          paymentKey: pk,
          courseKey,
          apoderadoKey: aidStrong,
          apoderadoId: aidStrong,
          alumnoId: alumnoId,
          apoderadoEmail: aidStrong,
          fromTaskId: t.id,
          concept,
          amount: Number(t.amount||0),
          status: "pending",
          dueDate,
          period,
          installmentIndex,
          createdAt: nowISO()
        });
        byKey.add(pk);
      }
  
      (tasksAll||[]).forEach(t=>{
        if(!t) return;
        if(t.closed) return;
  
        const type = String(t.type||"single").toLowerCase();
        if(type==="monthly"){
          const startYM = ymFromISO(t.startDate||t.dueDate||todayISO());
          const months = Math.max(1, Number(t.months||1));
          for(let i=0;i<months;i++){
            const period = addMonthsYM(startYM, i);
            const dueDate = endOfMonthISO(period);
            const idx = i+1;
            pushPay(t, period, idx, dueDate, `${t.title} · Cuota ${idx}/${months}`);
          }
        }else{
          const period = ymFromISO(t.dueDate||t.startDate||todayISO());
          const dueDate = t.dueDate || endOfMonthISO(period);
          pushPay(t, period, 1, dueDate, t.title);
        }
      });
  
      if(out.length !== (paysAll||[]).length){
        save(KEY_PAYMENTS, out);
      }
      return out;
    }

  const ENROLL_KEY = "cursapp_enrollments_v1";

  function ensurePaymentsForAllApproved(){
    try{
      const courseKey = String(localStorage.getItem("cursapp_active_course_v1") || "");
      if(!courseKey) return;

      const tasksAll = normalizeTasks(load(KEY_TASKS, []));
      if(!tasksAll.length) return;

      const enrolls = load(ENROLL_KEY, []).filter(e => String(e?.courseKey||"")===courseKey && String(e?.status||"").toLowerCase()==="approved");
      if(!enrolls.length) return;

      let paysAll = load(KEY_PAYMENTS, []);
      const beforeLen = paysAll.length;

      for(const e of enrolls){
        const ident = {
          courseKey,
          apoderadoEmail: String(e.email||"").trim().toLowerCase(),
          alumnoLabel: String(e.alumno||"").trim()
        };
        paysAll = ensurePaymentsForIdentity(ident, tasksAll, paysAll);
      }

      if(paysAll.length !== beforeLen){
        save(KEY_PAYMENTS, paysAll);
      }
    }catch(e){}
  }

  const markDirty = () => localStorage.setItem(KEY_DIRTY, "1");
  const clearDirty = () => localStorage.removeItem(KEY_DIRTY);
  const isDirty = () => localStorage.getItem(KEY_DIRTY) === "1";

  const sum = (arr, fn) => (arr || []).reduce((a, x) => a + Number(fn ? fn(x) : x || 0), 0);

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  function currentYM(){
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  }


  function isExpired(t){
    if(!t.dueDate) return false;
    const due = new Date(t.dueDate + "T23:59:59");
    if(isNaN(due.getTime())) return false;
    return due.getTime() < Date.now();
  }

  // payment status tolerance
  const isPaid = (p) => p.status === "paid";
  const isCredit = (p) => p.status === "credit";
  const isPendingLike = (p) => ["pending","unpaid","due","partial"].includes(String(p.status||"").toLowerCase());

// -------- Deduplicación de pagos (estabilidad) --------
function paymentStableKey(p){
  const cid = String(p.fromTaskId || p.taskId || p.campaignId || "");
  const who = String(p.apoderadoId || p.userId || p.payerId || p.email || p.payerEmail || "").toLowerCase();
  // Si no existe cuota/índice (legacy), asumimos 1 (pago único) para evitar duplicados.
  const cuotaRaw = (p.installmentIndex!=null && p.installmentIndex!=="") ? p.installmentIndex : (p.cuotaNumero || p.installment || p.cuota);
  const cuota = String((cuotaRaw==null || cuotaRaw==="") ? 1 : cuotaRaw);
  const due = String(p.dueDate || "");
  const amt = String(Number(p.amountRemaining ?? p.amount ?? p.monto ?? 0));
  const typ = String(p.type || p.kind || "");
  return [cid, who, cuota, due, amt, typ].join("|");
}

function dedupePaymentsAll(list){
  const map = new Map();
  let changed = false;

  (list || []).forEach(p=>{
    if(!p) return;
    const k = paymentStableKey(p);
    const prev = map.get(k);
    if(!prev){ map.set(k,p); return; }

    const prevPaid = String(prev.status||"").toLowerCase()==="paid";
    const curPaid  = String(p.status||"").toLowerCase()==="paid";
    if(curPaid && !prevPaid){ map.set(k,p); changed=true; return; }

    const prevRem = Number(prev.amountRemaining ?? prev.amount ?? 0);
    const curRem  = Number(p.amountRemaining ?? p.amount ?? 0);
    if(curRem < prevRem){ map.set(k,p); changed=true; return; }

    changed = true;
  });

  return { list: Array.from(map.values()), changed };
}


  // data access
  const tasks = () => load(KEY_TASKS, []);
  const payments = () => {
    const raw = load(KEY_PAYMENTS, []);
    const dd = dedupePaymentsAll(raw);
    if(dd.changed) save(KEY_PAYMENTS, dd.list);
    return dd.list;
  };
  const expenses = () => load(KEY_EXPENSES, []);
  
  // -------- Informe Apoderado (idéntico al rol apoderado) --------
  window.openReportApoderado = function(period){
    const reps = reports();
    const r = reps.find(x=>String(x.period||"")===String(period||"")) || reps[0];
    if(!r) return;
  
    const currentYM = ()=>{
      const d=new Date();
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    };
    const pct = (a,b)=>{
      const A=Number(a||0), B=Number(b||0);
      if(B<=0) return 0;
      return Math.max(0, Math.min(100, Math.round((A/B)*100)));
    };
  
    
    const isExcludedStatus = (p)=>{
      const st = String(p?.status||"").toLowerCase();
      return st==="opted_out" || st==="void" || st==="cancelled";
    };
  const ym = currentYM();
    const tasksArr = tasks();
    const pays = payments();
  
    // Totales del mes (proyección y cobrado) + deudores únicos
    let cobradoMes=0, proyeccionMes=0;
    const deudoresSet = new Set();
  
    (pays||[]).forEach(p=>{
      if(!p) return;
      if(isExcludedStatus(p)) return;
  
      const dueYM = String(p.dueDate||"").slice(0,7);
      const perYM = String(p.period||"").slice(0,7);
      const matchYM = (dueYM===ym) || (perYM===ym);
      if(!matchYM) return;
  
      const amt = Number(p.amount || p.amountRemaining || 0);
      proyeccionMes += amt;
  
      if(String(p.status||"")==="paid"){
        cobradoMes += Number(p.amount||0);
      }else{
        const pid = String(p.payerProfileId || p.profileId || p.userId || "");
        if(pid) deudoresSet.add(pid);
      }
    });
  
    const cursoPct = pct(cobradoMes, proyeccionMes);
    const sem = (cursoPct>=80) ? "🟢" : (cursoPct>=45 ? "🟡" : "🔴");
    const semMsg = (cursoPct>=80)
      ? "Vamos muy bien este mes"
      : (cursoPct>=45 ? "Vamos avanzando, aún falta un poco" : "Atención: queda bastante por pagar este mes");
  
    // Agrupar pagos por campaña
    const byTask = {};
    (pays||[]).forEach(p=>{
      const tid = String((p && p.fromTaskId) || "");
      if(!tid) return;
      if(isExcludedStatus(p)) return;
      (byTask[tid] ||= []).push(p);
    });
  
    const cardStyle = "background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:18px;padding:14px;";
  
    const kpi = (icon, label, val)=>`
      <div style="${cardStyle}">
        <div style="font-size:13px;opacity:.75;">${icon} ${esc(label)}</div>
        <div style="font-size:22px;font-weight:950;margin-top:6px;">${val}</div>
      </div>
    `;
  
    const campRows = (tasksArr||[])
      .filter(t=>t && !t.closed)
      .map(t=>{
        const tid = String(t.id);
        const title = String(t.title || "Campaña");
        const type = String(t.type || "single");
        const months = Number(t.months || 1);
        const amount = Number(t.amount || 0);
        const meta = Number(t.goalTotal || 0);
  
        const ps = (byTask[tid] || []);
  
        const recaudado = ps
          .filter(x=>String(x.status||"")==="paid")
          .reduce((a,x)=>a+Number(x.amount||0),0);
  
        const pendienteMes = ps
          .filter(x=>String(x.status||"")!=="paid")
          .filter(x=>{
            const dym = String(x.dueDate||"").slice(0,7);
            const pym = String(x.period||"").slice(0,7);
            return (dym===ym)||(pym===ym);
          })
          .reduce((a,x)=>a+Number(x.amountRemaining||x.amount||0),0);
  
        // Objetivo (total curso):
        // - Si el usuario definió goalTotal/meta => lo respetamos como total de curso.
        // - Si no, lo calculamos como (monto por apoderado) x (participantes) x (cuotas si mensual)
        //   Esto evita el bug de ver 100% con 1 pago cuando hay 2 apoderados.
        let objetivo;
        if(meta>0){
          objetivo = meta;
        }else{
          const base = (type==="monthly" ? (amount*months) : amount);
          const mandatory = (t.mandatoryParticipation !== undefined) ? !!t.mandatoryParticipation : true;
          let n = 0;
  
          if(!mandatory){
            // voluntaria: contamos participantes reales (excluye opted_out)
            const s = new Set();
            for(const x of ps){
              if(!x) continue;
              if(isExcludedStatus(x)) continue;
              const k = String(x.apoderadoKey||x.apoderadoEmail||x.payerProfileId||x.profileId||x.userId||x.email||"").toLowerCase().trim();
              if(k) s.add(k);
            }
            n = s.size;
          }
          if(!n){
            // fallback: apoderados del curso (evita 0 / y cubre obligatorias)
            n = (typeof approvedCount==='function' ? approvedCount() : 0);
          }
          if(!n) n = 1;
          objetivo = base * n;
        }
        const p = pct(recaudado, objetivo);
  
        return `
          <div style="${cardStyle}">
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
              <div style="font-weight:950;">${esc(title)}</div>
              <div style="font-weight:950;">${p}%</div>
            </div>
  
            <div style="margin-top:8px;height:10px;background:#eef2ff;border-radius:999px;overflow:hidden;">
              <div style="height:100%;width:${p}%;background:#4f46e5;border-radius:999px;"></div>
            </div>
  
            <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;font-size:13px;opacity:.9;">
              <div>💰 Recaudado: <b>${clp(recaudado)}</b></div>
              <div>⏳ Pendiente mes: <b>${clp(pendienteMes)}</b></div>
              <div>🎯 Objetivo: <b>${clp(objetivo)}</b></div>
            </div>
          </div>
        `;
      }).join("");
  
    openModal(`
      <div style="max-width:900px;margin:auto;">
        <div style="
          background:#ffffff;
          border-radius:22px;
          border:1px solid rgba(0,0,0,.10);
          box-shadow:0 20px 60px rgba(0,0,0,.25);
          padding:0;
          overflow:hidden;
        ">
  
          <div style="
            position:sticky;
            top:0;
            z-index:20;
            background:#ffffff;
            padding:12px 16px;
            border-bottom:1px solid rgba(0,0,0,.08);
          ">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
              <div>
                <div style="font-weight:950;font-size:18px;line-height:1.1;">Informe del curso</div>
                <div style="opacity:.65;font-size:13px;margin-top:4px;line-height:1.2;">
                  Resumen de cómo va el curso (montos globales, no personales)
                </div>
              </div>
              <button onclick="closeModal()"
                style="
                  border:1px solid rgba(0,0,0,.12);
                  background:#fff;
                  border-radius:999px;
                  padding:8px 14px;
                  font-weight:800;
                  cursor:pointer;
                  flex:0 0 auto;
                ">
                Cerrar
              </button>
            </div>
          </div>
  
          <div style="padding:16px;">
  
            <div style="margin-top:2px;${cardStyle}background:#f8fafc;">
              <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
                <div>
                  <div style="font-weight:950;font-size:16px;">${sem} Cumplimiento del mes</div>
                  <div style="font-size:13px;opacity:.75;margin-top:2px;">${esc(semMsg)} · <b>${esc(ym)}</b></div>
                </div>
                <div style="font-weight:950;font-size:18px;">${cursoPct}%</div>
              </div>
  
              <div style="margin-top:10px;height:12px;background:#e5e7eb;border-radius:999px;overflow:hidden;">
                <div style="height:100%;width:${cursoPct}%;background:#16a34a;border-radius:999px;"></div>
              </div>
  
              <div style="margin-top:8px;font-size:13px;opacity:.9;">
                💵 Cobrado mes: <b>${clp(cobradoMes)}</b> · ⏳ Proyección mes: <b>${clp(proyeccionMes)}</b> · 👥 Deudores mes: <b>${deudoresSet.size}</b>
              </div>
            </div>
  
            <div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              ${kpi("💰","Recaudado total", clp(r.recaudadoCurso||0))}
              ${kpi("🧾","Gastado total", clp(r.gastadoCurso||0))}
              ${kpi("🏦","Saldo disponible", clp(r.disponibleCurso||0))}
              ${kpi("⏳","Por cobrar este mes", clp(proyeccionMes - cobradoMes))}
            </div>
  
            <div style="margin-top:16px;">
              <div style="font-weight:950;font-size:16px;margin-bottom:10px;">📌 Indicadores por campaña</div>
              <div style="display:grid;gap:10px;">
                ${campRows || `<div style="opacity:.7;font-size:13px;">No hay campañas activas.</div>`}
              </div>
            </div>
  
            <div class="muted" style="margin-top:14px;font-size:12px;">
              Emitido: ${esc(r.generatedAt||"")}
            </div>
  
          </div>
        </div>
      </div>
    `);
  };
const reports = () => load(KEY_MONTHLY_REPORTS, []);

  const activeTasks = () => tasks().filter(t => !t.closed && !isExpired(t));
  const expiredTasks = () => tasks().filter(t => !t.closed && isExpired(t));
  const closedTasks = () => tasks().filter(t => !!t.closed);

  const collectedCourse = () => sum(payments().filter(isPaid), p => p.amount);
  const spentCourse = () => sum(expenses(), e => e.amount);
  const saldoCourse = () => collectedCourse() - spentCourse();

  const creditTotal = () => sum(payments().filter(isCredit), p => p.amount);
  const pendingTotal = () => sum(payments().filter(isPendingFinancialStatus), p => (p.amountRemaining ?? p.amount ?? 0));
  const deudoresCount = () => {
    const set = new Set();
    payments().filter(isPendingFinancialStatus).forEach(p=>{
      const k = String(p?.apoderadoKey || p?.apoderadoEmail || p?.email || p?.apoderadoId || "").toLowerCase().trim()
        || String(p?.alumnoId || "").trim();
      if(k) set.add(k);
    });
    return set.size;
  };


  // ---- Single source of truth financiero (campañas / dashboard / deudores) ----
  function isExcludedFinancialStatus(p){
    const st = String(p?.status || "").toLowerCase();
    return st === "opted_out" || st === "void" || st === "cancelled" || st === "credit_used";
  }

  function isPendingFinancialStatus(p){
    if(!p) return false;
    if(isExcludedFinancialStatus(p)) return false;
    return isPendingLike(p);
  }

  function campaignPayments(taskId){
    return payments().filter(p => String(p?.fromTaskId || "") === String(taskId || ""));
  }

  function campaignPendingPayments(taskId){
    return campaignPayments(taskId).filter(isPendingFinancialStatus);
  }

  function campaignPaidPayments(taskId){
    return campaignPayments(taskId).filter(p => !isExcludedFinancialStatus(p) && isPaid(p));
  }

  function campaignUniqueDebtors(taskId){
    const set = new Set();
    campaignPendingPayments(taskId).forEach(p=>{
      const k =
        String(p?.apoderadoKey || p?.apoderadoEmail || p?.email || p?.apoderadoId || "")
          .toLowerCase()
          .trim()
        || String(p?.alumnoId || "").trim();
      if(k) set.add(k);
    });
    return set.size;
  }

  function campaignPendingAmount(taskId){
    return sum(campaignPendingPayments(taskId), p => (p.amountRemaining ?? p.amount ?? 0));
  }

  function campaignPendingInstallments(taskId){
    return campaignPendingPayments(taskId).length;
  }

  // ---- curso / apoderados aprobados ----
  const KEY_ACTIVE_COURSE = "cursapp_active_course_v1";
  const KEY_ENROLL = "cursapp_enrollments_v1";

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
  function approvedCount(){
    const n = approvedApoderados().length;
    return n || 1; // fallback
  }

  // ---- fechas / periodos ----
  function ymFromISO(iso){
    if(!iso) return "";
    const s = String(iso);
    if(s.length >= 7) return s.slice(0,7);
    return "";
  }
  function currentYYYYMM(){
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  }
  function endOfMonthDate(ym){
    const [y,m] = ym.split("-").map(x=>parseInt(x,10));
    if(!y || !m) return null;
    return new Date(y, m, 0); // last day of month
  }
  function withinMonth(iso, ym){
    return ymFromISO(iso) === ym;
  }

  // ---- KPIs mes ----
  function collectedMonth(ym){
    // prefer paidAt / paidDate if exists; fallback dueDate
    return sum(payments().filter(p=>{
      if(!isPaid(p)) return false;
      const dt = p.paidAt || p.paidDate || p.paid_on || "";
      return withinMonth(String(dt).slice(0,10), ym) || withinMonth(p.createdAt||"", ym);
    }), p=>p.amount);
  }

  function spentMonth(ym){
    return sum(expenses().filter(e=> withinMonth(e.date||"", ym)), e=>e.amount);
  }

  function pendingMonthReal(ym){
    return sum(payments().filter(p=>{
      if(!isPendingFinancialStatus(p)) return false;
      const due = p.dueDate || "";
      return withinMonth(due, ym);
    }), p => (p.amountRemaining ?? p.amount ?? 0));
  }


  // Deudores del mes (personas únicas con al menos 1 cuota/pago pendiente del mes)
  function deudoresMonth(ym){
    const set = new Set();
    payments().forEach(p=>{
      if(!isPendingFinancialStatus(p)) return;
      const due = p.dueDate || "";
      if(!withinMonth(due, ym)) return;
      const k = String(p.apoderadoEmail || p.email || "").toLowerCase();
      if(k) set.add(k);
    });
    // Fallback: si no hay cobros instanciados, estimar por apoderados aprobados
    if(set.size===0){
      try{
        const n = approvedApoderados().length;
        return n || 0;
      }catch(e){ return 0; }
    }
    return set.size;
  }


  // Pendiente operacional del mes (dashboard):
  // - Usa proyección máxima del mes (campañas) menos lo recaudado.
  // - Evita depender de que los cobros existan ya en payments_v1.
  function pendingMonth(ym){
    const expected = pendingMonthProjected(ym);
    const collected = collectedMonth(ym);
    return Math.max(0, expected - collected);
  }

  // Proyección máxima (ajustada por opt-out si existe)
  function pendingMonthProjected(ym){
    const people = approvedCount();
    const tks = tasks();
    let expected = 0;

    // monthly campaigns: contribute amount if month is within their schedule
    tks.forEach(t=>{
      if(t.closed) return;
      const type = String(t.type||"single").toLowerCase();
      const amt = Number(t.amount||0);

      if(type==="monthly"){
        // month range: from startDate month to start+months-1
        const startYM = ymFromISO(t.startDate||t.dueDate||"");
        if(!startYM) return;
        const months = Math.max(1, Number(t.months||1));

        // compute index of ym relative to startYM
        const sy = parseInt(startYM.slice(0,4),10), sm = parseInt(startYM.slice(5,7),10);
        const cy = parseInt(ym.slice(0,4),10), cm = parseInt(ym.slice(5,7),10);
        const idx = (cy - sy)*12 + (cm - sm) + 1; // 1-based
        if(idx < 1 || idx > months) return;

        expected += amt * people;

        // opt-out adjustment for non mandatory (if we have opted_out payments for this task+month)
        if(t.mandatoryParticipation === false){
          const opted = payments().filter(p=>{
            return p.fromTaskId===t.id && String(p.status||"").toLowerCase()==="opted_out" && withinMonth(p.dueDate||p.period||"", ym);
          }).length;
          expected -= Math.min(opted, people) * amt;
        }
        return;
      }

      // single payment: only count if dueDate month equals ym
      const dueYM = ymFromISO(t.dueDate||"");
      if(dueYM && dueYM===ym){
        expected += amt * people;

        if(t.mandatoryParticipation === false){
          const opted = payments().filter(p=>{
            return p.fromTaskId===t.id && String(p.status||"").toLowerCase()==="opted_out" && withinMonth(p.dueDate||p.period||"", ym);
          }).length;
          expected -= Math.min(opted, people) * amt;
        }
      }
    });

    return Math.max(0, expected);
  }

  function debtorsMonthCount(ym){
    // count unique apoderados with pending in month (if we have email); else count pending items
    const pend = payments().filter(p=>isPendingFinancialStatus(p) && withinMonth(p.dueDate||"", ym));
    const emails = new Set(pend.map(p=>p.apoderadoEmail||p.email||"").filter(Boolean));
    return emails.size ? emails.size : pend.length;
  }

  function collectedTask(id){
    return sum(payments().filter(p=>p.fromTaskId===id && isPaid(p)), p=>p.amount);
  }
  function pendingTask(id){
    // pendiente operacional (solo cobros instanciados)
    return sum(payments().filter(p=>String(p.fromTaskId||"")===String(id||"") && isPendingLike(p)), p => (p.amountRemaining ?? p.amount ?? 0));
  }

  function expectedTaskTotal(t){
    if(!t) return 0;
    const monto = Number(t.amount||0);
    const nApo = approvedCount(); // apoderados aprobados (fallback=1)
    const type = String(t.type||"single").toLowerCase();
    if(type==="monthly"){
      const months = Math.max(1, Number(t.months||1));
      return monto * months * nApo;
    }
    return monto * nApo;
  }

  function pendingTaskEstimated(t){
    const id = String(t?.id || "");
    const all = campaignPayments(id);
    const ps = campaignPendingPayments(id);

    if(ps.length){
      return sum(ps, p => (p.amountRemaining ?? p.amount ?? 0));
    }

    // Si es campaña voluntaria y los cobros existentes están todos en opted_out/void/cancelled,
    // no hay pendiente real aunque exista objetivo teórico.
    if(t?.mandatoryParticipation === false && all.length){
      const hasOnlyOptedOut = all.every(p => {
        const st = String(p?.status || "").toLowerCase();
        return st === "opted_out" || st === "void" || st === "cancelled";
      });
      if(hasOnlyOptedOut) return 0;
    }

    const expected = expectedTaskTotal(t);
    const rec = collectedTask(id);
    return Math.max(0, expected - rec);
  }


  function deudoresTask(id){
  return campaignUniqueDebtors(id);
}

function cuotasPendientesTask(id){
  return campaignPendingInstallments(id);
}

  function spentTask(id){
    return sum(expenses().filter(e=>e.scope==="campaign" && e.campaignId===id), e=>e.amount);
  }

  function latestReport(){
    const r = reports();
    return r.length ? r[0] : null;
  }

  function openModal(html){
    modalRoot.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:10000;display:flex;align-items:flex-end;justify-content:center;padding:14px;">
        <div class="card" style="width:min(820px,100%);margin-bottom:12px;">
          ${html}
        </div>
      </div>
    `;
  }
  function closeModal(){ modalRoot.innerHTML=""; }
  window.closeModal = closeModal;

  // ----- menu -----
  function initMenu(){
    if(menuBtn && menuDropdown){
      if (!window.CURSAPP_MENU_HANDLED) menuBtn.onclick = (e)=>{e.stopPropagation(); menuDropdown.style.display = (menuDropdown.style.display==="block"?"none":"block");};
      document.addEventListener("click", ()=> menuDropdown.style.display="none");
    }
    if(resetBtn){
      resetBtn.onclick = ()=>{
        if(!confirm("Reset demo presidente. ¿Continuar?")) return;
        localStorage.removeItem(KEY_TASKS);
        localStorage.removeItem(KEY_PAYMENTS);
        localStorage.removeItem(KEY_EXPENSES);
        localStorage.removeItem(KEY_MONTHLY_REPORTS);
        localStorage.removeItem(KEY_DIRTY);
        alert("Datos reseteados.");
        // ✅ CAMBIO 2: NO re-sembrar demo automáticamente
        go("home");
      };
    }
    if(logoutBtn){
      // ✅ CAMBIO 3: logout al login real
      logoutBtn.onclick = ()=> location.href="/index.html";
    }
  }

  // ----- demo seed (if empty) -----
  function ensureDemo(){
    if(tasks().length) return;

    save(KEY_TASKS, [
      {id:"t1", title:"Rifa del curso", description:"", startDate:"2026-01-10", dueDate:"2026-01-31", closed:false, closeType:"", closeReason:"", mandatoryParticipation:true, type:"single", months:1, amount:10000, goalTotal:150000},
      {id:"t2", title:"Paseo de curso", description:"", startDate:"2026-02-01", dueDate:"2026-04-01", closed:false, closeType:"", closeReason:"", mandatoryParticipation:false, type:"monthly", months:3, amount:20000, goalTotal:null},
    ]);

    save(KEY_PAYMENTS, [
      {id:"p1", fromTaskId:"t1", amount:10000, status:"paid"},
      {id:"p2", fromTaskId:"t1", amount:10000, status:"paid"},
      {id:"p3", fromTaskId:"t2", amount:20000, status:"pending"},
      {id:"p4", fromTaskId:"t2", amount:20000, status:"paid"},
      {id:"c1", fromTaskId:"t1", amount:5000, status:"credit", note:"Saldo a favor por campaña eliminada"}
    ]);

    save(KEY_EXPENSES, [
      {id:"e1", scope:"campaign", campaignId:"t1", title:"Flores", date:"2026-01-18", amount:25000, attachments:[{name:"boleta.jpg"}]},
      {id:"e2", scope:"campaign", campaignId:"t2", title:"Reserva", date:"2026-02-18", amount:60000, attachments:[]},
    ]);

    save(KEY_MONTHLY_REPORTS, []);
    clearDirty();
  }

  // ----- state -----
  let state = { tab:"home" };
  let campaignFilter = "active"; // active | expired | closed | all

  
  function normalizeTab(tab){
    const t = String(tab||"").toLowerCase().trim();
    // Compat: algunos builds usan 'informe' (singular) en el dataset del menú
    if(t === "informe" || t === "reportes" || t === "reporte") return "informes";
    if(t === "campaña" || t === "campana") return "campanas";
    return t;
  }

function setActive(tab){
    navItems.forEach(b=>b.classList.toggle("active", b.dataset.tab===tab));
  }

  function go(tab){
    const norm = normalizeTab(tab);
    state.tab = norm;
    setActive(norm);
    if(norm==="home") renderHome();
    if(norm==="campanas") renderCampanas();
    if(norm==="informes") renderInformes();
    if(norm==="deudores") renderDeudores();
  }

  navItems.forEach(b=> b.onclick=()=> go(b.dataset.tab));

  // ---- Refresh UI when data changes (campaigns/payments) ----
  // campaigns.js emite este evento al crear/editar/cerrar campañas.
  const __refresh = ()=>{
    try{
      // materializa pagos faltantes (sin depender de entrar como apoderado)
      ensurePaymentsForAllApproved();

      const tab = (state && state.tab) ? state.tab : 'home';
      if(tab==='home') renderHome();
      else if(tab==='campanas') renderCampanas();
      else if(tab==='deudores') renderDeudores();
      else if(tab==='informes') renderInformes();
    }catch(e){}
  };
  window.addEventListener('cursapp:dataChanged', __refresh);
  window.addEventListener('cursapp:dataUpdated', __refresh);

  
  // ----- Watcher: refrescar Campañas cuando cambian las tasks -----
  let __TASKS_SIG = "";
  function __tasksSig(){
    try{
      const raw = localStorage.getItem(KEY_TASKS) || "[]";
      let h=0; for(let i=0;i<raw.length;i++) h=(h*31 + raw.charCodeAt(i))>>>0;
      return String(h);
    }catch(e){ return ""; }
  }
// ----- UI pieces -----
  function statusPillForCampaign(t){
    if(t.closed){
      const pend = pendingTaskEstimated(t);
      if(pend > 0) return `<span class="pill warn">Cerrada · con pagos pendientes</span>`;
      return `<span class="pill">Cerrada</span>`;
    }
    if(isExpired(t)) return `<span class="pill danger">Caducada</span>`;
    return `<span class="pill ok">Activa</span>`;
  }

  function lineClassForCampaign(t){
    const pend = pendingTaskEstimated(t);
    const saldo = collectedTask(t.id) - spentTask(t.id);
    if(saldo < 0) return "isDanger";
    if(pend > 0 && t.closed) return "isWarn";
    if(isExpired(t)) return "isWarn";
    return "isOk";
  }

  // ---- Plantillas destacadas (estilo suave) ----
  let __tplStylesInjected = false;
  function templateKind(t){
    const k = String(t?.template || t?.templateKey || t?.templateId || "").toLowerCase();
    if(k.includes("gira")) return "gira";
    if(k.includes("gradu")) return "graduacion";
    const title = String(t?.title || t?.name || "").toLowerCase();
    if(title.includes("gira")) return "gira";
    if(title.includes("gradu")) return "graduacion";
    return "";
  }
  function templateClassForCampaign(t){
    const k = templateKind(t);
    return k ? `tplCamp tplCamp-${k}` : "";
  }
  function ensureTemplateStyles(){
    if(__tplStylesInjected) return;
    __tplStylesInjected = true;
    const css = `
      .campLine{ position:relative; overflow:hidden; padding-left:10px; border-radius:18px; }
      .campLine:before{ content:""; position:absolute; left:0; top:0; bottom:0; width:6px; border-radius:18px 0 0 18px; background: rgba(148,163,184,.55); }
      .tplCamp:before{ background: rgba(59,130,246,.65); }
      .tplCamp.tplCamp-graduacion:before{ background: rgba(139,92,246,.65); }
      .tplCamp{ background: rgba(59,130,246,.05); }
      .tplCamp.tplCamp-graduacion{ background: rgba(139,92,246,.05); }
    `;
    const style = document.createElement("style");
    style.setAttribute("data-cursapp-tpl","1");
    style.textContent = css;
    document.head.appendChild(style);
  }

  function campaignTypeLabel(t){
    const type = String(t.type||"single");
    if(type==="monthly"){
      const m = Number(t.months||1);
      return `Mensual · ${m} cuota(s)`;
    }
    return "Pago único";
  }

  // ----- Home -----
  function renderHome(){
    const ym = currentYYYYMM();
    const recMes = collectedMonth(ym);
    const recTot = collectedCourse();
    const gasMes = spentMonth(ym);
    const gasTot = spentCourse();
    const sal = saldoCourse();

    const pendMes = pendingMonth(ym);
    const pendProjMes = pendingMonthProjected(ym);
    // Para el dashboard: si existe pendiente (proyección - recaudado),
    // asumimos deudores potenciales = apoderados aprobados.
    // (En producción esto vendrá del Billing Service con detalle por apoderado.)
    const debtorsMes = pendMes > 0 ? approvedCount() : 0;
    const credit = creditTotal();
    const apods = approvedCount();

    const last = latestReport();

    const alerts = [];
    // En el dashboard principal mostramos el pendiente REAL (lo que falta por pagar).
    // La proyección se puede usar para análisis, pero no debe confundirse con lo adeudado.
    if(pendMes > 0) alerts.push(`⏳ Pendiente mes: ${clp(pendMes)}`);
    if(debtorsMes > 0) alerts.push(`👥 Deudores (mes): ${debtorsMes}`);
    if(isDirty()) alerts.push(`📄 Informe desactualizado`);

    app.innerHTML = `      ${alerts.length ? `
        <div class="warnBox">
          <div style="font-weight:950;">Resumen rápido</div>
          <div class="muted" style="margin-top:6px;">${alerts.join(" · ")}</div>
        </div>
      `:""}

      ${last ? `
        <div class="card">
          <div class="row">
            <div>
              <div class="kTitle">Último informe publicado</div>
              <div class="muted" style="margin-top:6px;">Periodo ${esc(last.period)} · Emitido ${esc(last.generatedAtHuman||last.generatedAt||"")}</div>
            </div>
            <div class="actions">
              <button class="btnx" onclick="go('informes')">Ver informes</button>
            </div>
          </div>
        </div>
      `:""}

      <div class="card">
        <div class="row">
          <div>
            <div class="kTitle">Resumen ejecutivo del curso</div>
            <div class="muted" style="margin-top:6px;">Montos globales (no personales)</div>
          </div>
          <div class="actions">
            <button class="btnx primary" onclick="confirmGenerateReport()">${isDirty() ? "Actualizar y publicar" : "📄 Publicar informe"}</button>
          </div>
        </div>

        <div class="sectionLabel">Cobros</div>
        <div class="kpiGrid">
          <div class="kpi isOk"><div class="lbl">💰 Cobrado este mes</div><div class="val">${clp(recMes)}</div></div>
          <div class="kpi isOk"><div class="lbl">💰 Cobrado total</div><div class="val">${clp(recTot)}</div></div>
        </div>

        <div class="sectionLabel" style="margin-top:10px;">Gastos</div>
        <div class="kpiGrid">
          <div class="kpi"><div class="lbl">🧾 Gastado este mes</div><div class="val">${clp(gasMes)}</div></div>
          <div class="kpi"><div class="lbl">🧾 Gastado total</div><div class="val">${clp(gasTot)}</div></div>
        </div>

        <div class="sectionLabel" style="margin-top:10px;">Resultado</div>
        <div class="kpiGrid">
          <div class="kpi"><div class="lbl">⚖️ Saldo disponible</div><div class="val">${clp(sal)}</div></div>
          <div class="kpi isWarn"><div class="lbl">⏳ Por cobrar este mes</div><div class="val">${clp(pendMes)}</div></div>
        </div>

        ${pendProjMes>pendMes ? `
          <div class="muted" style="margin-top:10px;font-weight:900;">
            Proyección máxima del mes: <b>${clp(pendProjMes)}</b>
          </div>
        ` : ``}

        <div class="chipsInfo" style="margin-top:10px;">
          <span class="chipInfoPill">👥 Deudores (mes) <b>${debtorsMes}</b></span>
          <span class="chipInfoPill">🧑‍🤝‍🧑 Apoderados <b>${apods}</b></span>
          <span class="chipInfoPill ok">➕ Saldo a favor <b>${clp(credit)}</b></span>
          ${isDirty()?`<span class="chipInfoPill warn">📄 Informe desactualizado</span>`:""}
        </div>
      </div>

      <div class="card">
        <div class="kTitle">Acciones</div>
        <div class="actionsRow" style="margin-top:10px;">
          <button class="btnx primary" onclick="openCreateCampaign()">➕ Crear campaña</button>
          <button class="btnx" onclick="go('campanas')">📌 Ver campañas</button>
          <button class="btnx" onclick="openCloseCampaign()">🔒 Cerrar campaña</button>
        </div>
      </div>
    `;
  }

  // ----- Campaigns -----
  function setFilter(f){
    campaignFilter = f;
    renderCampanas();
  }
  window.setFilter = setFilter;

  function getFilteredCampaigns(){
    if(campaignFilter==="active") return activeTasks();
    if(campaignFilter==="expired") return expiredTasks();
    if(campaignFilter==="closed") return closedTasks();
    return tasks();
  }

  // ---- Cotizaciones visibles (Plantilla Gira) ----
  function normCotizaciones(t){
    const arr = Array.isArray(t?.cotizaciones) ? t.cotizaciones : [];
    const one = t?.cotizacion && (t.cotizacion.texto || t.cotizacion.link || t.cotizacion.nombre || t.cotizacion.monto_total || t.cotizacion.descripcion)
      ? [t.cotizacion]
      : [];
    const merged = [...arr, ...one]
      .map(c=>({
        nombre: String(c?.nombre || c?.title || c?.name || "").trim(),
        url: String(c?.url || c?.link || "").trim(),
        monto_total: Number(c?.monto_total ?? c?.monto ?? c?.total ?? 0),
        descripcion: String(c?.descripcion || c?.texto || c?.description || "").trim()
      }))
      .filter(c=>c.nombre || c.url || c.monto_total || c.descripcion);

    // Dedupe (cuando viene tanto cotizacion como cotizaciones[])
    const seen = new Set();
    const out = [];
    for(const c of merged){
      const key = [c.nombre.toLowerCase(), c.url.toLowerCase(), String(c.monto_total||0), c.descripcion.toLowerCase()].join("|");
      if(seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
    return out;
  }

  function renderCotizacionesInfo(t){
    const kind = String(t?.template||"");
    if(!["gira","graduacion"].includes(kind)) return "";
    const cotz = normCotizaciones(t);
    if(!cotz.length) return "";
    const total = cotz.reduce((s,c)=>s + (Number(c.monto_total)||0), 0);
    const first = cotz.slice(0,2);

    return `
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(17,24,39,.08);">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
          <div>
            <div style="font-weight:950;">Información</div>
            <div class="muted" style="margin-top:4px;">Cotizaciones · ${cotz.length} ítem(s)${total?` · Total ${clp(total)}`:""}</div>
          </div>
          <button class="btnx" onclick="Campaigns.openQuotesDetailById('${esc(t.id)}')">Ver detalle</button>
        </div>
        <div class="muted" style="margin-top:10px;display:grid;gap:6px;">
          ${first.map(c=>`<div>• ${esc(c.nombre || "Cotización")} ${c.monto_total?`· <b>${clp(c.monto_total)}</b>`:""}${c.descripcion?` · ${esc(c.descripcion)}`:""}</div>`).join("")}
          ${cotz.length>2 ? `<div>… y ${cotz.length-2} más</div>` : ``}
        </div>
      </div>
    `;
  }

  function renderCampanas(){
    ensureTemplateStyles();
    const filtered = getFilteredCampaigns();

    const chips = `
      <div class="chips">
        <button class="chip ${campaignFilter==="active"?"active":""}" onclick="setFilter('active')">Activas</button>
        <button class="chip ${campaignFilter==="expired"?"active":""}" onclick="setFilter('expired')">Caducadas</button>
        <button class="chip ${campaignFilter==="closed"?"active":""}" onclick="setFilter('closed')">Cerradas</button>
        <button class="chip ${campaignFilter==="all"?"active":""}" onclick="setFilter('all')">Todas</button>
      </div>
    `;

    const list = filtered.map(t=>{
      const rec = collectedTask(t.id);
      const gas = spentTask(t.id);
      const saldo = rec - gas;
      const pend = pendingTaskEstimated(t);
      const debtors = deudoresTask(t.id);
      const cuotasPendientes = cuotasPendientesTask(t.id);
      const monto = Number(t.amount||0);
      const tipo = campaignTypeLabel(t);
      const part = (t.mandatoryParticipation === false) ? "No obligatoria" : "Obligatoria";
      const meta = (t.goalTotal != null && Number(t.goalTotal)>0) ? Number(t.goalTotal) : 0;

      return `        <div class="campCard campLine ${lineClassForCampaign(t)} ${templateClassForCampaign(t)}">
          <div class="campHead">
            <div class="campTitleRow">
              <div class="campTitle">${esc(t.title)}</div>
              ${statusPillForCampaign(t)}
            </div>
            <div class="campDates">${esc(t.startDate||"")} → ${esc(t.dueDate||"")}</div>
          </div>

          <div class="chipInfoRow">
            <span class="chipInfo">💵 <strong>Monto</strong> ${clp(monto)}</span>
            <span class="chipInfo">🧾 <strong>Tipo</strong> ${esc(tipo)}</span>
            <span class="chipInfo">🔒 <strong>Participación</strong> ${esc(part)}</span>
            ${meta?`<span class="chipInfo">🎯 <strong>Meta</strong> ${clp(meta)}</span>`:""}
          </div>

          <div class="campMetrics">
            <div class="metricBox">
              <div class="metricLbl">Recaudado</div>
              <div class="metricVal">${clp(rec)}</div>
            </div>
            <div class="metricBox">
              <div class="metricLbl">Gastado</div>
              <div class="metricVal">${clp(gas)}</div>
            </div>
            <div class="metricBox">
              <div class="metricLbl">Saldo</div>
              <div class="metricVal">${clp(saldo)}</div>
            </div>
            <div class="metricBox">
              <div class="metricLbl">Deudores</div>
              <div class="metricVal">${Number(debtors||0)}</div>
            </div>
            <div class="metricBox">
              <div class="metricLbl">Cuotas pendientes</div>
              <div class="metricVal">${Number(cuotasPendientes||0)}</div>
            </div>
            <div class="metricBox metricWide">
              <div class="metricLbl">Pendiente</div>
              <div class="metricVal">${clp(pend)}</div>
            </div>
          </div>

          <div class="campActions">
            <button class="btnx" onclick="Campaigns.openCampaignDetail('${t.id}','presidente')">🔎 Ver detalle</button>
            <button class="btnx" onclick="openEditCampaign('${t.id}')">✏️ Editar</button>
            ${(!t.closed && !isExpired(t)) ? `<button class="btnx danger" onclick="deleteCampaign('${t.id}')">🗑️ Eliminar</button>` : ""}
          </div>

          ${(t.mandatoryParticipation===false && pend===0 && cuotasPendientes===0 && debtors===0 && campaignPayments(t.id).some(p=>String(p?.status||"").toLowerCase()==="opted_out")) ? `<div class="muted" style="margin:0 14px 14px 14px;font-size:12px;font-weight:900;">No participan apoderados en esta campaña por ahora.</div>` : ``}
          ${t.closed && pend>0 ? `<div class="muted" style="margin:0 14px 14px 14px;font-size:12px;">
            Esta campaña está cerrada, pero aún hay aportes pendientes (arrastran al siguiente mes).
          </div>` : ``}
        </div>
    `;
    }).join("");

    app.innerHTML = `
      <div class="card">
        <div class="row">
          <div>
            <div class="kTitle">Campañas</div>
            <div class="muted" style="margin-top:6px;">Muestra deudores sin nombres y pendiente estimado.</div>
          </div>
          <div class="actions">
            <button class="btnx primary" onclick="openCreateCampaign()">➕ Crear campaña</button>
          </div>
        </div>

        <div style="margin-top:12px;">
          <div class="sectionLabel" style="margin:0 0 8px 0;">Plantillas destacadas</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">
            <div class="card" style="padding:12px;border:1px solid rgba(0,0,0,.08);">
              <div style="font-weight:950;">🎒 Gira de estudio</div>
              <div class="muted" style="margin-top:6px;font-size:12px;">Cuotas abiertas + saldo años anteriores + cotizaciones.</div>
              <div style="margin-top:10px;">
                <button class="btnx primary" onclick="Campaigns.openCreateTemplate('gira')">Usar plantilla</button>
              </div>
            </div>
            <div class="card" style="padding:12px;border:1px solid rgba(0,0,0,.08);">
              <div style="font-weight:950;">🎓 Graduación</div>
              <div class="muted" style="margin-top:6px;font-size:12px;">Cotizaciones por ítem + plan de cuotas.</div>
              <div style="margin-top:10px;">
                <button class="btnx primary" onclick="Campaigns.openCreateTemplate('graduacion')">Usar plantilla</button>
              </div>
            </div>
          </div>
        </div>

        ${chips}

        <div class="listLines">
          ${list || `<div class="muted">Sin campañas en este filtro.</div>`}
        </div>
      </div>
    `;
  }

  // ----- Informes -----
  // =========================
// Módulo Cobranza / Deudores
// =========================
function todayISO(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const da = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${da}`;
}
function isPast(iso){
  if(!iso) return false;
  return String(iso).slice(0,10) < todayISO();
}
function taskById(id){
  return tasks().find(t => String(t.id) === String(id));
}
function apoderadoKey(p){
  return String((p.apoderadoEmail||p.email||"")).toLowerCase();
}
function money(n){ return clp(Number(n||0)); }

function debtorRowsFor(email){
  const em = String(email||"").toLowerCase();
  const pays = payments().filter(p => apoderadoKey(p) === em);
  const pending = pays.filter(isPendingFinancialStatus);

  return pending.map(p=>{
    const t = taskById(p.fromTaskId);
    const mandatory = t ? (t.mandatoryParticipation !== false) : true;
    return {
      pay: p,
      task: t,
      mandatory,
      dueDate: String(p.dueDate||"").slice(0,10),
      amount: Number(p.amount||0),
      overdue: isPast(p.dueDate||"")
    };
  });
}

function summarizeDebts(email){
  const rows = debtorRowsFor(email);
  const byCampaign = new Map();
  let totalAll = 0, totalOverdue = 0, totalUpcoming = 0;

  rows.forEach(r=>{
    totalAll += r.amount;
    if(r.overdue) totalOverdue += r.amount; else totalUpcoming += r.amount;

    const id = String(r.task?.id || r.pay.fromTaskId || "unknown");
    if(!byCampaign.has(id)){
      byCampaign.set(id, {
        taskId: id,
        title: r.task?.title || r.pay.title || "Campaña",
        mandatory: r.mandatory,
        pendingCount: 0,
        overdueAmount: 0,
        upcomingAmount: 0,
        pendingAmount: 0
      });
    }
    const s = byCampaign.get(id);
    s.pendingCount += 1;
    s.pendingAmount += r.amount;
    if(r.overdue) s.overdueAmount += r.amount; else s.upcomingAmount += r.amount;
  });

  const campaigns = Array.from(byCampaign.values()).sort((a,b)=>{
    if(a.mandatory !== b.mandatory) return a.mandatory ? -1 : 1;
    return b.pendingAmount - a.pendingAmount;
  });

  return { campaigns, totalAll, totalOverdue, totalUpcoming };
}

function monthMandatoryOutstanding(ym){
  const pays = payments().filter(isPendingLike).filter(p => withinMonth(p.dueDate||"", ym));
  let total = 0;
  pays.forEach(p=>{
    const t = taskById(p.fromTaskId);
    if(t && t.mandatoryParticipation === false) return;
    total += Number(p.amount||0);
  });
  return total;
}

function renderBar(label, value, max){
  const pct = max>0 ? Math.max(2, Math.round((value/max)*100)) : 0;
  return `
    <div class="barRow">
      <div class="barLabel">${esc(label)}</div>
      <div class="barTrack"><div class="barFill" style="width:${pct}%;"></div></div>
      <div class="barVal">${money(value)}</div>
    </div>
  `;
}

function activeCourse(){
  try{
    const ck = activeCourseKey();
    const courses = JSON.parse(localStorage.getItem("cursapp_courses_v1")||"[]");
    return courses.find(c=>c.courseKey===ck) || null;
  }catch(e){ return null; }
}

function buildWhatsappText(profile, summary){
  const name = (profile.apoderadoName||profile.name||"").trim() || "Apoderado/a";
  const alumno = (profile.alumno||"").trim();
  const c = activeCourse() || {};
  const courseLine = `${c.schoolName||"Colegio"} · ${c.level||""}${c.letter||""} ${c.year||""} · ${c.jornada||""}`.replace(/\s+/g," ").trim();
  const today = todayISO();

  let lines = [];
  lines.push(`Hola ${name}${alumno?` (Alumno/a: ${alumno})`:``}.`);
  lines.push(`Te comparto el resumen de cobros del curso ${courseLine} al ${today}:`);
  lines.push("");

  if(summary.campaigns.length===0){
    lines.push("✅ No registras deudas pendientes.");
  }else{
    summary.campaigns.forEach(ca=>{
      const tag = ca.mandatory ? "Obligatoria" : "Voluntaria";
      lines.push(`• ${ca.title} (${tag}): ${ca.pendingCount} pendiente(s) por ${money(ca.pendingAmount)}.`);
      const det = [];
      if(ca.overdueAmount>0) det.push(`vencido ${money(ca.overdueAmount)}`);
      if(ca.upcomingAmount>0) det.push(`por vencer ${money(ca.upcomingAmount)}`);
      if(det.length) lines.push(`  (${det.join(" · ")})`);
    });
    lines.push("");
    lines.push(`Total pendiente: ${money(summary.totalAll)}.`);
  }

  lines.push("");
  lines.push("Gracias.");
  return lines.join("\n");
}

function renderDeudores(){
  const ym = ymFromISO(todayISO());

  const aprobados = approvedApoderados().map(e=>({
    email: String(e.email||"").toLowerCase(),
    apoderadoName: e.apoderadoName||e.name||"",
    alumno: e.alumno||""
  }));

  // Pendiente del mes (solo obligatorias) por email
  const pendingMonth = payments().filter(isPendingLike).filter(p=> withinMonth(p.dueDate||"", ym));
  const mandatoryPendingByEmail = new Map();
  pendingMonth.forEach(p=>{
    const t = taskById(p.fromTaskId);
    if(t && t.mandatoryParticipation === false) return;
    const em = apoderadoKey(p);
    if(!em) return;
    mandatoryPendingByEmail.set(em, (mandatoryPendingByEmail.get(em)||0) + Number(p.amount||0));
  });

  const debtors = aprobados
    .map(a=>({ ...a, monthPendingMandatory: mandatoryPendingByEmail.get(a.email)||0 }))
    .filter(a=> a.monthPendingMandatory > 0)
    .sort((a,b)=> b.monthPendingMandatory - a.monthPendingMandatory);

  const totalMandatoryMonth = monthMandatoryOutstanding(ym);

  app.innerHTML = `
    <div class="kTitle">Cobranza</div>
    <div class="muted" style="margin-top:6px;">Busca por apoderado o alumno y obtén el resumen de deudas (con texto listo para WhatsApp).</div>

    <div class="kpiGrid" style="margin-top:12px;">
      <div class="kpi">
        <div class="kpiLabel">Deudores (mes · obligatorias)</div>
        <div class="kpiVal">${debtors.length}</div>
      </div>
      <div class="kpi">
        <div class="kpiLabel">Deuda obligatoria del mes</div>
        <div class="kpiVal">${clp(totalMandatoryMonth)}</div>
      </div>
      <div class="kpi">
        <div class="kpiLabel">Apoderados aprobados</div>
        <div class="kpiVal">${approvedApoderados().length}</div>
      </div>
    </div>

    <div class="card" style="margin-top:12px;">
      <div style="font-weight:950;">Indicador por campañas (pendiente total)</div>
      <div class="muted" style="margin-top:6px;">Top campañas con mayor deuda pendiente (todas, incluyendo voluntarias).</div>
      <div id="barsMount" style="margin-top:10px;"></div>
    </div>

    <div class="card" style="margin-top:12px;">
      <div style="font-weight:950;">Buscar apoderado / alumno</div>
      <div class="muted" style="margin-top:6px;">Escribe un nombre o correo.</div>

      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;">
        <input id="debtorQuery" placeholder="Ej: Matías, Mauricio, apoderado@mail.com" style="flex:1;min-width:240px;" />
        <button class="btn primary" id="debtorSearchBtn" type="button">Buscar</button>
      </div>

      <div id="debtorResults" style="margin-top:10px;"></div>
    </div>

    <style>
      .kpiGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
      @media (max-width:760px){.kpiGrid{grid-template-columns:1fr;}}
      .kpi{border:1px solid rgba(15,23,42,.10);border-radius:16px;background:#fff;padding:12px;}
      .kpiLabel{color:rgba(15,23,42,.62);font-weight:900;font-size:12px;}
      .kpiVal{font-weight:950;font-size:22px;margin-top:4px;}
      .barRow{display:grid;grid-template-columns:140px 1fr 90px;gap:10px;align-items:center;margin:8px 0;}
      .barLabel{font-weight:900;font-size:12px;color:rgba(15,23,42,.75);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .barTrack{height:10px;border-radius:999px;background:rgba(15,23,42,.08);overflow:hidden;}
      .barFill{height:100%;border-radius:999px;background:rgba(91,92,226,.65);}
      .barVal{font-weight:950;font-size:12px;text-align:right;}
      .resultRow{padding:10px;border:1px solid rgba(15,23,42,.10);border-radius:14px;background:#fff;margin-top:10px;}
      .resultTop{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;}
      .resultName{font-weight:950;}
      .pill{display:inline-flex;padding:6px 10px;border-radius:999px;font-weight:900;font-size:12px;border:1px solid rgba(15,23,42,.12);background:rgba(15,23,42,.04);}
      .pill.bad{border-color:rgba(239,68,68,.22);background:rgba(239,68,68,.08);}
      .pill.good{border-color:rgba(34,197,94,.22);background:rgba(34,197,94,.08);}
      textarea{width:100%;min-height:120px;padding:10px;border-radius:12px;border:1px solid rgba(15,23,42,.10);font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;}
    </style>
  `;

  // bars
  const pendingAll = payments().filter(isPendingLike);
  const byTask = new Map();
  pendingAll.forEach(p=>{
    const id = String(p.fromTaskId||"unknown");
    byTask.set(id, (byTask.get(id)||0) + Number(p.amount||0));
  });
  const bars = Array.from(byTask.entries())
    .map(([id,amt])=>({ id, amt, title: taskById(id)?.title || "Campaña" }))
    .sort((a,b)=> b.amt - a.amt)
    .slice(0,5);
  const max = bars[0]?.amt || 0;
  const barsMount = document.getElementById("barsMount");
  barsMount && (barsMount.innerHTML = bars.length
    ? bars.map(r=> renderBar(r.title, r.amt, max)).join("")
    : `<div class="muted">No hay deuda pendiente registrada.</div>`);

  const qInp = document.getElementById("debtorQuery");
  const btn = document.getElementById("debtorSearchBtn");
  const out = document.getElementById("debtorResults");

  function fallbackCopy(txt){
    try{
      const tmp = document.createElement("textarea");
      tmp.value = txt;
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand("copy");
      tmp.remove();
      toast("Copiado ✅");
    }catch(e){
      // En iOS a veces copia igual pero lanza excepción. Evitamos alertas invasivas.
      toast("Si no se copió, selecciona y copia manualmente.");
    }
  }

  function doSearch(){
    const q = String(qInp?.value||"").trim().toLowerCase();
    if(!q){
      out.innerHTML = `<div class="muted">Escribe un nombre o correo para buscar.</div>`;
      return;
    }
    const matches = aprobados.filter(a=>{
      return a.email.includes(q) ||
        String(a.apoderadoName||"").toLowerCase().includes(q) ||
        String(a.alumno||"").toLowerCase().includes(q);
    }).slice(0,10);

    if(!matches.length){
      out.innerHTML = `<div class="muted">Sin resultados.</div>`;
      return;
    }

    out.innerHTML = matches.map(profile=>{
      const sum = summarizeDebts(profile.email);
      const monthMand = mandatoryPendingByEmail.get(profile.email) || 0;
      const wa = buildWhatsappText(profile, sum);
      return `
        <div class="resultRow">
          <div class="resultTop">
            <div>
              <div class="resultName">${esc(profile.apoderadoName||profile.email||"Apoderado")}</div>
              <div class="muted" style="margin-top:2px;">Alumno/a: <b>${esc(profile.alumno||"—")}</b></div>
              <div class="muted" style="margin-top:2px;">Correo: <b>${esc(profile.email||"—")}</b></div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <span class="pill ${monthMand>0?"bad":"good"}">Deuda obligatoria mes: ${money(monthMand)}</span>
              <span class="pill ${sum.totalAll>0?"bad":"good"}">Deuda total: ${money(sum.totalAll)}</span>
            </div>
          </div>

          <div style="margin-top:10px;">
            <div style="font-weight:950;">Cuotas / pagos pendientes por campaña</div>
            ${sum.campaigns.length ? `
              <div style="margin-top:8px;display:grid;gap:8px;">
                ${sum.campaigns.map(ca=>`
                  <div style="border:1px solid rgba(15,23,42,.10);border-radius:14px;padding:10px;background:rgba(255,255,255,.9);">
                    <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;">
                      <div style="font-weight:950;">${esc(ca.title)}</div>
                      <div class="muted" style="font-weight:900;">${ca.mandatory ? "Obligatoria" : "Voluntaria"}</div>
                    </div>
                    <div class="muted" style="margin-top:6px;">
                      Pendientes: <b>${ca.pendingCount}</b> · Monto: <b>${money(ca.pendingAmount)}</b>
                      ${ca.overdueAmount>0 ? `· Vencido: <b>${money(ca.overdueAmount)}</b>` : ``}
                      ${ca.upcomingAmount>0 ? `· Por vencer: <b>${money(ca.upcomingAmount)}</b>` : ``}
                    </div>
                  </div>
                `).join("")}
              </div>
            ` : `<div class="muted" style="margin-top:8px;">✅ No registra deudas pendientes.</div>`}
          </div>

          <div style="margin-top:12px;">
            <div style="font-weight:950;">Resumen para WhatsApp</div>
            <div class="muted" style="margin-top:6px;">Copia y pega este texto.</div>
            <textarea readonly>${esc(wa)}</textarea>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;">
              <button class="btn primary" type="button" data-copy="1">Copiar texto</button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    out.querySelectorAll('button[data-copy="1"]').forEach((b, idx)=>{
      b.onclick = ()=>{
        const ta = out.querySelectorAll("textarea")[idx];
        const txt = ta?.value || "";
        if(navigator.clipboard?.writeText){
          copyTextToClipboard(txt).then(()=> toast("Copiado ✅")).catch(()=> fallbackCopy(txt));
        }else{
          fallbackCopy(txt);
        }
      };
    });
  }

  btn && (btn.onclick = doSearch);
  qInp && (qInp.onkeydown = (e)=>{ if(e.key==="Enter") doSearch(); });

  out.innerHTML = debtors.length
    ? `<div class="muted">Sugerencia: deudores del mes (obligatorias) → ${debtors.slice(0,5).map(d=>esc(d.alumno||d.apoderadoName||d.email)).join(" · ")} ...</div>`
    : `<div class="muted">✅ No hay deudores obligatorios este mes.</div>`;
}

function renderInformes(){
    try{
    const reps = reports().slice().sort((a,b)=>String(b.period||"").localeCompare(String(a.period||"")));
    const allTasks = tasks();
    const ps = payments();
    // alias for backward-compat (some helpers expect pays())
    const pays = () => ps;
    const ex = expenses();

    // Live executive numbers (current state, not snapshot)
    const recTotal = collectedCourse();
    const gasTotal = spentCourse();
    const saldo = recTotal - gasTotal;

    const ym = currentYM();
    const recMes = collectedMonth(ym);
    const gasMes = spentMonth(ym);
    const porCobrarMes = pendingMonth(ym);
    const deudMes = deudoresMonth(ym);

    // Recent expenses (approved + submitted, newest first)
    const recentEx = ex.slice().sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).slice(0,8)
    // Report view toggle (apoderados vs directiva)
    const reportView = localStorage.getItem("cursapp_report_view") || "apoderados";
    window.setReportView = window.setReportView || function(v){
      try{ localStorage.setItem("cursapp_report_view", v); }catch(e){}
      try{ if(state && state.tab){ go(state.tab); } else { renderInformes(); } }catch(e){ try{ renderInformes(); }catch(_e){} }
    };

    const projMaxMes = (typeof projectionMaxMonth==="function") ? projectionMaxMonth(ym) : (recMes + porCobrarMes);
    const cumplimientoMes = projMaxMes>0 ? Math.round((recMes/projMaxMes)*100) : 0;

    function pct(n){ n=Number(n||0); if(!isFinite(n)) n=0; return Math.max(0, Math.min(100, n)); }
    function bar(p, label){
      const pp = pct(p);
      return `
        <div style="margin-top:8px;">
          ${label?`<div class="muted" style="font-size:12px;margin-bottom:6px;">${label}</div>`:""}
          <div style="height:10px;border-radius:999px;background:#eef2ff;overflow:hidden;">
            <div style="height:10px;border-radius:999px;background:linear-gradient(90deg,#60a5fa,#34d399);width:${pp}%"></div>
          </div>
          <div class="muted" style="font-size:12px;margin-top:6px;">${pp}%</div>
        </div>
      `;
    }

    function statusChip(){
      // Semáforo simple por cumplimiento mes y deudores
      if(cumplimientoMes>=85 && deudMes<=2) return `<span class="chipInfoPill ok">🟢 En buen camino</span>`;
      if(cumplimientoMes>=55) return `<span class="chipInfoPill warn">🟡 Atención</span>`;
      return `<span class="chipInfoPill danger">🔴 Urgente</span>`;
    }

    function gastosPorCategoria(){
      const map = {};
      ex.forEach(e=>{
        const st = String(e.status||"submitted");
        if(st==="rejected") return;
        const cat = String(e.category||e.tipo||e.type||"Otro").trim() || "Otro";
        map[cat] = (map[cat]||0) + Number(e.amount||0);
      });
      const arr = Object.entries(map).map(([k,v])=>({cat:k, total:v})).sort((a,b)=>b.total-a.total);
      return arr;
    }

    function informeApoderadosHTML(){
        // payments data (defensive)
  const paysArr = (typeof payments === 'function') ? (payments() || []) : [];

// --- visual helpers (local scope to avoid reference errors) ---
  const cardStyle = 'border:1px solid rgba(0,0,0,.06);border-radius:18px;padding:14px 14px;box-shadow:0 10px 30px rgba(2,6,23,.06);';
  const kpi = (ico, label, val) => `
    <div style="${cardStyle}background:#fff;">
      <div style="display:flex;gap:10px;align-items:flex-start;">
        <div style="font-size:18px;line-height:1;">${ico}</div>
        <div style="flex:1;">
          <div style="font-size:13px;opacity:.75;">${label}</div>
          <div style="font-weight:950;font-size:22px;margin-top:4px;">${val}</div>
        </div>
      </div>
    </div>`;

const ym = currentYM();
    const people = approvedCount();
    const allPays = paysArr;

    // --- metrics (defensive, month-scoped; excludes opted_out) ---
    const isExcludedPay = (p) => {
      const st = String(p?.status || "").toLowerCase();
      return st === "opted_out" || st === "void" || st === "cancelled";
    };
    const payYM = (p) => (String(p?.dueDate || "").slice(0,7) || String(p?.period || "").slice(0,7));
    const expYM = (e) => String(e?.date || e?.createdAt || e?.ts || e?.at || "").slice(0,7);

    const recMes = (allPays||[])
      .filter(p => p && !isExcludedPay(p) && String(p.status||"").toLowerCase()==="paid" && payYM(p)===ym)
      .reduce((a,p)=>a+Number(p.amount||0),0);

    const proyMes = (allPays||[])
      .filter(p => p && !isExcludedPay(p) && payYM(p)===ym)
      .reduce((a,p)=>a+Number(p.amount || p.amountRemaining || 0),0);

    const porCobrarMes = Math.max(0, proyMes - recMes);

    const gastoMes = (typeof expenses === "function" ? expenses() : [])
      .filter(e => e && expYM(e)===ym)
      .reduce((a,e)=>a+Number(e.amount||e.monto||0),0);

    const recTotal = (allPays||[])
      .filter(p => p && !isExcludedPay(p) && String(p.status||"").toLowerCase()==="paid")
      .reduce((a,p)=>a+Number(p.amount||0),0);

    const gastoTotal = (typeof expenses === "function" ? expenses() : [])
      .reduce((a,e)=>a+Number(e?.amount||e?.monto||0),0);

    const saldo = recTotal - gastoTotal;

    const camps = tasks().filter(t => t && t.kind==="campaign" && t.id && (t.status||"open")!=="closed");

    const pct = Math.max(0, Math.min(100, Number(cumplimientoMes||0)));
    const chip = statusChip(); // ya viene calculado arriba
    const semMsg = pct>=90 ? "¡Vamos excelente!" : (pct>=50 ? "Vamos avanzando, aún falta un poco" : "Atención: queda bastante por pagar este mes");

    const campRows = camps.map(t=>{
      const title = esc(t.title || t.name || "Campaña");
      const icon = esc(t.icon || "");
      const isMonthly = !!t.isMonthly;
      const isVol = t.isMandatory===false || t.mandatory===false || t.obligatoria===false;
      const mode = isMonthly ? "Mensual" : "Único";
      const mand = isVol ? "Voluntaria" : "Obligatoria";

      // Solo pagos del mes (si existen dueYm). Si no existen, cae a estimación.
      const rel = allPays.filter(p => p && (p.fromTaskId===t.id || p.taskId===t.id));
      const relYm = rel.filter(p => (p.dueYm||p.ym||"")===ym);

      const monthProjected = relYm.length
        ? relYm.filter(p=>p.status!=="opted_out").reduce((a,p)=>a+Number(p.amount||0),0)
        : (isMonthly ? Number(t.amountPerStudent||t.amount||0)*people : 0);

      const monthPaid = relYm.length
        ? relYm.filter(p=>p.status==="paid").reduce((a,p)=>a+Number(p.amount||0),0)
        : 0;

      // pendiente estimado total (considera opt-out si es voluntaria)
      const totalExpected = expectedTaskTotal(t);
      const totalCollected = collectedTask(t.id);
      const totalPendingEst = pendingTaskEstimated(t);

      const campPct = totalExpected>0 ? Math.round((totalCollected/totalExpected)*100) : 0;
      const campPctClamped = Math.max(0, Math.min(100, campPct));

      return `
        <div style="${cardStyle}">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div>
              <div style="font-weight:950;font-size:18px;">${title} ${icon}</div>
              <div class="muted" style="margin-top:2px;font-size:13px;">${mode} · ${mand}</div>
            </div>
            <div style="font-weight:950;font-size:18px;">${campPctClamped}%</div>
          </div>
          <div style="margin-top:10px;height:10px;background:#e5e7eb;border-radius:999px;overflow:hidden;">
            <div style="height:100%;width:${campPctClamped}%;background:#4f46e5;border-radius:999px;"></div>
          </div>
          <div style="margin-top:10px;font-size:13px;opacity:.92;display:grid;gap:4px;">
            <div>💰 Recaudado: <b>${clp(totalCollected)}</b></div>
            <div>⏳ Pendiente mes: <b>${clp(Math.max(0, monthProjected - monthPaid))}</b></div>
            <div>🎯 Objetivo: <b>${clp(totalExpected)}</b></div>
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="card" style="padding:16px;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
          <div>
            <div class="kTitle" style="margin:0;">Informe para Apoderados</div>
            <div class="muted" style="margin-top:6px;">Sencillo, visual y transparente.</div>
          </div>
          ${chip}
        </div>

        <div style="margin-top:14px;${cardStyle}background:#f8fafc;">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div>
              <div style="font-weight:950;font-size:16px;">🟡 Cumplimiento del mes</div>
              <div style="font-size:13px;opacity:.75;margin-top:2px;">${esc(semMsg)} · <b>${esc(ym)}</b></div>
            </div>
            <div style="font-weight:950;font-size:18px;">${pct}%</div>
          </div>
          <div style="margin-top:10px;height:12px;background:#e5e7eb;border-radius:999px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:#16a34a;border-radius:999px;"></div>
          </div>
          <div style="margin-top:8px;font-size:13px;opacity:.9;">
            💵 Cobrado mes: <b>${clp(recMes)}</b> · ⏳ Proyección mes: <b>${clp(projMaxMes)}</b> · 👥 Deudores mes: <b>${deudMes}</b>
          </div>
        </div>

        <div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          ${kpi("💰","Recaudado este mes", clp(recMes))}
          ${kpi("🧾","Gastado este mes", clp(gastoMes))}
          ${kpi("🏦","Saldo disponible", clp(saldo))}
          ${kpi("⏳","Por cobrar este mes", clp(Math.max(0, porCobrarMes)))}
        </div>

        <div style="margin-top:16px;">
          <div style="font-weight:950;font-size:16px;margin-bottom:10px;">📌 Indicadores por campaña</div>
          <div style="display:grid;gap:10px;">
            ${campRows || `<div style="opacity:.7;font-size:13px;">No hay campañas activas.</div>`}
          </div>
        </div>

        <div style="margin-top:14px;display:flex;justify-content:flex-end;">
          <button class="btn" onclick="go('pagos')">Ir a pagos</button>
        </div>
      </div>
    `;
  }

    function informeDirectivaHTML(){
      const saldoPrev = sum(allTasks.filter(t=>Number(t.saldo_prev||0)>0), t=>Number(t.saldo_prev||0));
      const saldoInicial = saldoPrev; // en este MVP usamos saldo_prev como base; si no existe, 0
      const ingresosPeriodo = recMes;
      const gastosPeriodo = gasMes;
      const saldoFinal = saldoInicial + ingresosPeriodo - gastosPeriodo;

      const campRows = allTasks
        .slice()
        .filter(t=>!t.closed)
        .map(t=>{
          const rec = collectedTask(t.id);
          const gas = spentTask(t.id);
          const sal = rec - gas;
          const pend = pendingTask(t.id);
          const meta = Number(t.goalTotal||0);
          const av = meta>0 ? Math.round((rec/meta)*100) : null;
          return {t, rec, gas, sal, pend, meta, av};
        })
        .sort((a,b)=> (b.rec - a.rec));

      const cumplimientoBar = bar(cumplimientoMes, "Cumplimiento del mes (recaudado vs proyección)");
      const cats = gastosPorCategoria().slice(0,6);
      const catsBars = cats.length ? `
        <div class="card" style="margin-top:14px;padding:14px;">
          <div style="font-weight:950;">Gastos por categoría</div>
          <div class="muted" style="margin-top:6px;">Distribución total (no solo mes)</div>
          <div style="margin-top:10px;display:grid;gap:10px;">
            ${cats.map(c=>{
              const total = sum(cats, x=>x.total);
              const p = total>0 ? Math.round((c.total/total)*100) : 0;
              return `
                <div>
                  <div style="display:flex;justify-content:space-between;gap:10px;">
                    <div style="font-weight:900;">${esc(c.cat)}</div>
                    <div style="font-weight:950;">${clp(c.total)}</div>
                  </div>
                  <div style="height:8px;border-radius:999px;background:#eef2ff;overflow:hidden;margin-top:6px;">
                    <div style="height:8px;border-radius:999px;background:#60a5fa;width:${pct(p)}%"></div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `:"";

      const table = campRows.length ? `
        <div class="card" style="margin-top:14px;padding:14px;">
          <div style="font-weight:950;">Campañas activas (cuadratura)</div>
          <div style="margin-top:10px;overflow:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              <thead>
                <tr class="muted">
                  <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Campaña</th>
                  <th style="text-align:right;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Recaudado</th>
                  <th style="text-align:right;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Gastado</th>
                  <th style="text-align:right;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Saldo</th>
                  <th style="text-align:right;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Pendiente</th>
                  <th style="text-align:center;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Meta</th>
                </tr>
              </thead>
              <tbody>
                ${campRows.map(r=>`
                  <tr>
                    <td style="padding:8px;border-bottom:1px solid rgba(0,0,0,.05);">
                      <div style="font-weight:900;">${esc(r.t.title||"")}</div>
                      <div class="muted" style="font-size:12px;">${esc(r.t.type==="monthly"?"Mensual":"Único")} · ${r.t.mandatoryParticipation===false?"Voluntaria":"Obligatoria"}</div>
                    </td>
                    <td style="padding:8px;border-bottom:1px solid rgba(0,0,0,.05);text-align:right;">${clp(r.rec)}</td>
                    <td style="padding:8px;border-bottom:1px solid rgba(0,0,0,.05);text-align:right;">${clp(r.gas)}</td>
                    <td style="padding:8px;border-bottom:1px solid rgba(0,0,0,.05);text-align:right;font-weight:950;">${clp(r.sal)}</td>
                    <td style="padding:8px;border-bottom:1px solid rgba(0,0,0,.05);text-align:right;">${clp(r.pend)}</td>
                    <td style="padding:8px;border-bottom:1px solid rgba(0,0,0,.05);text-align:center;">${r.av==null?"—":(pct(r.av)+"%")}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      ` : "";

      const cuadOK = (Math.abs((recTotal - gasTotal) - saldo) < 0.5); // always true but keeps concept
      return `
        <div class="card" style="padding:14px;">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
            <div>
              <div style="font-weight:950;font-size:18px;">Informe para Directiva</div>
              <div class="muted" style="margin-top:4px;">Cuadratura, control y seguimiento.</div>
            </div>
            <span class="chipInfoPill ${cuadOK?"ok":"warn"}">🧮 Cuadratura ${cuadOK?"OK":"Revisar"}</span>
          </div>

          <div style="margin-top:12px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
            <div style="border:1px solid rgba(0,0,0,.08);border-radius:16px;padding:12px;background:#fff;"><div class="muted">Cobrado mes</div><div class="big">${clp(recMes)}</div></div>
            <div style="border:1px solid rgba(0,0,0,.08);border-radius:16px;padding:12px;background:#fff;"><div class="muted">Por cobrar mes</div><div class="big">${clp(porCobrarMes)}</div></div>
            <div style="border:1px solid rgba(0,0,0,.08);border-radius:16px;padding:12px;background:#fff;"><div class="muted">Gastado mes</div><div class="big">${clp(gasMes)}</div></div>
            <div style="border:1px solid rgba(0,0,0,.08);border-radius:16px;padding:12px;background:#fff;"><div class="muted">Deudores mes</div><div class="big">${Number(deudMes||0)}</div></div>
          </div>

          <div class="card" style="margin-top:14px;padding:14px;">
            <div style="font-weight:950;">Cuadratura del periodo (mes actual)</div>
            <div style="margin-top:10px;display:grid;gap:8px;">
              <div style="display:flex;justify-content:space-between;"><span>Saldo inicial</span><b>${clp(saldoInicial)}</b></div>
              <div style="display:flex;justify-content:space-between;"><span>+ Ingresos del mes</span><b>${clp(ingresosPeriodo)}</b></div>
              <div style="display:flex;justify-content:space-between;"><span>- Gastos del mes</span><b>${clp(gastosPeriodo)}</b></div>
              <div style="display:flex;justify-content:space-between;border-top:1px dashed rgba(0,0,0,.15);padding-top:8px;"><span><b>Saldo final</b></span><b>${clp(saldoFinal)}</b></div>
            </div>
            ${cumplimientoBar}
          </div>

          ${table}
          ${catsBars}
        </div>
      `;
    }

    const toggleHTML = `
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin:12px 0;">
        <button class="btnx ${reportView==='apoderados'?'primary':''}" onclick="window.setReportView('apoderados')">👨‍👩‍👧‍👦 Apoderados</button>
        <button class="btnx ${reportView==='directiva'?'primary':''}" onclick="window.setReportView('directiva')">🏛️ Directiva</button>
      </div>
    `;
;

    function hasAttachment(e){
      return !!(e && Array.isArray(e.attachments) && e.attachments[0] && e.attachments[0].dataUrl);
    }


function viewExpenseAttachment(expenseId){
  try{
    const e = expenses().find(x=>String(x.id)===String(expenseId));
    if(!e || !Array.isArray(e.attachments) || !e.attachments.length){
      alert("No hay comprobante adjunto.");
      return;
    }
    const file = e.attachments[0];
    const dataUrl = file.dataUrl || file.dataURL || file.url || "";
    const type = String(file.type||"");
    if(!dataUrl){
      alert("Comprobante no disponible.");
      return;
    }
    const win = window.open();
    if(!win){ alert("Bloqueado por el navegador. Permite pop-ups para ver el comprobante."); return; }
    win.document.write(`
      <html>
        <head><title>Comprobante</title></head>
        <body style="margin:0;">
          ${
            type.includes("image")
              ? `<img src="${dataUrl}" style="width:100%;height:auto;display:block;" />`
              : `<iframe src="${dataUrl}" style="width:100%;height:100vh;border:0;"></iframe>`
          }
        </body>
      </html>
    `);
  }catch(err){
    alert("No se pudo abrir el comprobante.");
  }
}

    app.innerHTML = `
      ${isDirty()?`
        <div class="warnBox">
          <div style="font-weight:950;">Informe desactualizado</div>
          <div class="muted" style="margin-top:6px;">Hubo cambios posteriores al último informe. Publica uno nuevo para dejar un corte oficial.</div>
          <div class="actions" style="margin-top:10px;">
            <button class="btnx primary" onclick="confirmGenerateReport()">Actualizar y publicar</button>
          </div>
        </div>
      `:""}

      <div class="card">
        <div class="row" style="align-items:flex-start;gap:14px;flex-wrap:wrap;">
          <div style="min-width:220px;flex:1;">
            <div class="kTitle">Informe ejecutivo del curso</div>
            <div class="muted" style="margin-top:6px;">Estado actual (se actualiza en vivo). Periodo: <b>${esc(ym)}</b></div>
          </div>
          <div class="actions" style="flex-wrap:wrap;">
            <button class="btnx" onclick="printCurrentInforme()">Descargar PDF</button>
            <button class="btnx" onclick="shareExecutiveWhatsApp()">📤 Enviar informe al grupo</button>
            
          </div>
        </div>

        <div id="informeRoot">${informeDirectivaHTML()}</div>
      </div>

      <div class="card" style="margin-top:14px;">
        <div class="row" style="align-items:flex-start;gap:14px;flex-wrap:wrap;">
          <div style="min-width:220px;flex:1;">
            <div class="kTitle">Informes mensuales publicados</div>
            <div class="muted" style="margin-top:6px;">Últimos informes publicados (cortes oficiales).</div>
          </div>
          <div class="actions" style="flex-wrap:wrap;">
            
          </div>
        </div>

        <div class="listLines" style="margin-top:10px;">
          ${reps.length
            ? reps.map(r=>`
              <div class="lineItem">
                <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
                  <div>
                    <b>${esc(r.period)}</b>
                    <div class="muted" style="margin-top:6px;">Emitido ${esc(r.generatedAtHuman || r.generatedAt || '')}</div>
                  </div>
                  <button class="btnx" onclick="openReportApoderado('${esc(r.period||"")}')">Ver</button>
                </div>
</div>
            `).join("")
            : `<div class="muted">Sin informes publicados.</div>`
          }
        </div>
      </div>
    `;

    }catch(e){
      try{ console.error('Informe error:', e); }catch(_){}
      const msg = (e && (e.message||e.toString())) ? (e.message||e.toString()) : "Error desconocido";
      const stack = (e && e.stack) ? String(e.stack) : "";
      try{ localStorage.setItem("cursapp_last_informe_error", JSON.stringify({msg, stack, at: new Date().toISOString()})); }catch(_){}
      app.innerHTML = `
        <div class="warnBox">
          <div style="font-weight:950;">Error en Informe</div>
          <div class="muted" style="margin-top:6px;">En celular no existe F12. Copia el detalle de abajo y pégamelo aquí.</div>
          <div class="card" style="margin-top:12px;border:1px dashed rgba(0,0,0,.18);">
            <div style="font-weight:900;margin-bottom:8px;">Detalle</div>
            <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;white-space:pre-wrap;word-break:break-word;">${esc(msg)}${stack?`\n\n${esc(stack)}`:""}</div>
          </div>
          <div class="actions" style="margin-top:12px;gap:10px;flex-wrap:wrap;">
            <button class="btnx" onclick="(function(){try{const x=localStorage.getItem('cursapp_last_informe_error')||''; if(navigator.clipboard){navigator.clipboard.writeText(x);} else {prompt('Copia esto:', x);} }catch(_){}})()">Copiar detalle</button>
            <button class="btnx primary" onclick="go('home')">Volver</button>
          </div>
        </div>
      `;
    }

  }

  // ---- Informe: utilidades (PDF/print) ----
  window.viewExpenseAttachment = function(expenseId){
    const ex = expenses();
    const e = ex.find(x=>String(x.id)===String(expenseId));
    if(!e || !e.attachments || !e.attachments.length || !e.attachments[0].dataUrl){
      alert("No hay comprobante adjunto.");
      return;
    }
    const f = e.attachments[0];
    const w = window.open();
    const isImg = String(f.type||"").includes("image");
    w.document.write(`
      <html><head><title>Comprobante</title></head>
      <body style="margin:0;">
        ${isImg ? `<img src="${f.dataUrl}" style="width:100%;height:auto;display:block;" />`
               : `<iframe src="${f.dataUrl}" style="width:100%;height:100vh;border:0;"></iframe>`}
      </body></html>
    `);
  };

  
  // Imprime el informe actualmente visible (Apoderados/Directiva) tal como se ve en pantalla
  window.printCurrentInforme = function(){
    try{
      const root = document.getElementById("informeRoot");
      if(!root){ alert("No se encontró el informe en pantalla."); return; }
      const html = buildPrintShell(root.innerHTML);
      openPrintWindow(html);
    }catch(e){
      console.error(e);
      alert("No se pudo generar el PDF.");
    }
  };

  function buildPrintShell(inner){
    return `
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Informe Cursapp</title>
        <style>
          body{ font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial; margin: 24px; color:#111827; }
          .card{ border:1px solid rgba(0,0,0,.08); border-radius:18px; padding:14px; background:#fff; }
          .muted{ color:rgba(17,24,39,.6); }
          .big{ font-size:22px; font-weight:900; margin-top:6px; }
          .chipInfoPill{ display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:999px; font-weight:800; font-size:12px; border:1px solid rgba(0,0,0,.08); }
          .chipInfoPill.ok{ background:#ecfdf5; }
          .chipInfoPill.warn{ background:#fffbeb; }
          .chipInfoPill.danger{ background:#fef2f2; }
          .btnx{ display:none !important; } /* en PDF no mostramos botones */
          table{ width:100%; border-collapse:collapse; }
          th,td{ border-bottom:1px solid rgba(0,0,0,.08); padding:8px 6px; font-size:12px; text-align:left; }
          h1,h2,h3{ margin:0; }
          @media print{ body{ margin:0; } }
        </style>
      </head>
      <body>
        ${inner}
      </body>
      </html>
    `;
  }
window.shareExecutiveWhatsApp = shareExecutiveWhatsApp;
window.printExecutive = function(){
    const ym = currentYM();
    const html = buildExecutivePrintHTML(ym);
    openPrintWindow(html);
  };

  // PDF de informes publicados: reutiliza el mismo layout del "Informe Ejecutivo del Curso"
  // para que no existan diferencias entre el PDF y lo que se ve arriba.
  function openPrintWindow(html){
    // Reutiliza la misma ventana para evitar PDFs duplicados
    const w = window.open("", "cursapp_print");
    if(!w){ alert("No se pudo abrir la ventana de impresión. Revisa el bloqueador de popups."); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    // imprimir al cargar (una sola vez)
    setTimeout(()=>{ try{ w.print(); }catch(e){} }, 350);
  }
  function buildExecutivePrintHTML(ym){
    const recMes = collectedMonth(ym);
    const gasMes = spentMonth(ym);
    const porCobrarMes = pendingMonth(ym);
    const deudMes = deudoresMonth(ym);

    const recTotal = collectedCourse();
    const gasTotal = spentCourse();
    const saldo = recTotal - gasTotal;

    const cumplimientoBase = recMes + porCobrarMes;
    const cumplimientoPct = cumplimientoBase > 0 ? Math.round((recMes / cumplimientoBase) * 100) : 0;

    const health = (() => {
      if (saldo > 0 && cumplimientoPct >= 70) return { label: "🟢 Salud financiera: Buena", cls: "good" };
      if (saldo >= 0 && cumplimientoPct >= 40) return { label: "🟡 Salud financiera: Atención", cls: "warn" };
      return { label: "🔴 Salud financiera: Riesgo", cls: "risk" };
    })();

    const campRows = tasks()
      .filter(t=>t)
      .map(t=>{
        const rec = collectedTask(t.id);
        const gas = spentTask(t.id);
        const sal = rec - gas;
        const pend = pendingTaskEstimated(t);
        const meta = Number(t.goalTotal || 0);
        const tipo = String(t.type || "") === "monthly" ? "Mensual" : "Único";
        const part = t.mandatoryParticipation === false ? "Voluntaria" : "Obligatoria";
        return `
          <tr>
            <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;">
              <div style="font-weight:900;">${esc(t.title || "")}</div>
              <div class="small">${tipo} · ${part}</div>
            </td>
            <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${clp(rec)}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${clp(gas)}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:900;">${clp(sal)}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${clp(pend)}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${meta ? clp(meta) : "—"}</td>
          </tr>
        `;
      }).join("");

    const gastos = expenses()
      .slice()
      .sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")))
      .slice(0, 10)
      .map(g=>{
        const ambito = g.scope === "campaign"
          ? (tasks().find(t => t.id === g.campaignId)?.title || "Campaña")
          : "Curso";
        return `
          <tr>
            <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;">${esc(g.date || "")}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;">${esc(ambito)}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;">${esc(g.title || "")}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${clp(g.amount || 0)}</td>
          </tr>
        `;
      }).join("");

    const saldoInicial = 0;
    const saldoFinal = saldoInicial + recMes - gasMes;

    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Informe Directiva ${esc(ym)}</title>
          <style>
            body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;margin:24px;color:#0f172a;background:#fff;}
            .page{max-width:980px;margin:0 auto;}
            h1{margin:0;font-size:24px;} h2{margin:0 0 10px 0;font-size:18px;}
            .sub{color:#64748b;margin-top:6px;}
            .badge{display:inline-flex;align-items:center;padding:7px 12px;border-radius:999px;font-size:12px;font-weight:800;border:1px solid #d1d5db;background:#f8fafc;}
            .badge.good{background:#ecfdf5;border-color:#bbf7d0;} .badge.warn{background:#fffbeb;border-color:#fde68a;} .badge.risk{background:#fef2f2;border-color:#fecaca;}
            .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:16px;}
            .card{border:1px solid #e5e7eb;border-radius:16px;padding:14px;background:#fff;}
            .label{font-size:12px;color:#6b7280;} .value{font-size:28px;font-weight:900;margin-top:6px;}
            .section{margin-top:18px;} .small{font-size:12px;color:#64748b;margin-top:2px;}
            .rowline{display:flex;justify-content:space-between;gap:12px;padding:6px 0;}
            table{width:100%;border-collapse:collapse;margin-top:10px;} th{text-align:left;color:#64748b;padding:10px 8px;border-bottom:1px solid #cbd5e1;font-size:13px;} td{font-size:13px;}
            @media print{body{margin:0;}.page{max-width:none;}}
          </style>
        </head>
        <body>
          <div class="page">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;">
              <div>
                <h1>Informe Ejecutivo del Curso</h1>
                <div class="sub">Periodo: <b>${esc(ym)}</b> · Emitido: ${esc(new Date().toLocaleString("es-CL"))}</div>
              </div>
              <div class="badge ${health.cls}">${health.label}</div>
            </div>

            <div class="grid">
              <div class="card"><div class="label">Cobrado este mes</div><div class="value">${clp(recMes)}</div></div>
              <div class="card"><div class="label">Por cobrar este mes</div><div class="value">${clp(porCobrarMes)}</div><div class="small">Deudores del mes: <b>${Number(deudMes || 0)}</b></div></div>
              <div class="card"><div class="label">Cobrado total</div><div class="value">${clp(recTotal)}</div></div>
              <div class="card"><div class="label">Gastado total</div><div class="value">${clp(gasTotal)}</div></div>
              <div class="card"><div class="label">Saldo disponible</div><div class="value">${clp(saldo)}</div></div>
              <div class="card"><div class="label">Cumplimiento del mes</div><div class="value">${Math.max(0, Math.min(100, cumplimientoPct))}%</div></div>
            </div>

            <div class="section card">
              <h2>Cuadratura del periodo</h2>
              <div class="rowline"><span>Saldo inicial</span><b>${clp(saldoInicial)}</b></div>
              <div class="rowline"><span>+ Ingresos del mes</span><b>${clp(recMes)}</b></div>
              <div class="rowline"><span>- Gastos del mes</span><b>${clp(gasMes)}</b></div>
              <div class="rowline" style="margin-top:6px;padding-top:10px;border-top:1px dashed #cbd5e1;"><span><b>Saldo final</b></span><b>${clp(saldoFinal)}</b></div>
            </div>

            <div class="section card">
              <h2>Campañas</h2>
              <table>
                <thead>
                  <tr><th>Campaña</th><th style="text-align:right;">Recaudado</th><th style="text-align:right;">Gastado</th><th style="text-align:right;">Saldo</th><th style="text-align:right;">Pendiente</th><th style="text-align:right;">Meta</th></tr>
                </thead>
                <tbody>${campRows || `<tr><td colspan="6" style="padding:12px 8px;" class="small">Sin campañas registradas.</td></tr>`}</tbody>
              </table>
            </div>

            <div class="section card">
              <h2>Gastos recientes</h2>
              <table>
                <thead><tr><th>Fecha</th><th>Ámbito</th><th>Concepto</th><th style="text-align:right;">Monto</th></tr></thead>
                <tbody>${gastos || `<tr><td colspan="4" style="padding:12px 8px;" class="small">Sin gastos registrados.</td></tr>`}</tbody>
              </table>
            </div>

            <div class="sub" style="margin-top:18px;">Generado por Cursapp</div>
          </div>
        </body>
      </html>
    `;
  }

  
function buildSnapshotExecutivePrintHTML(rep){
    const ym = rep.period || "";
    const recTotal = Number((rep.recaudadoCurso ?? rep.recaudado) || 0);
    const gasTotal = Number(rep.gastadoCurso || 0);
    const saldo = Number((rep.disponibleCurso ?? (recTotal - gasTotal)) || 0);
    const pendTotal = Number((rep.pendienteCurso ?? rep.pendiente) || 0);

    const recMes = Number(rep.cobradoMes || 0);
    const gasMes = Number(rep.gastadoMes || 0);
    const porCobrarMes = Number(rep.porCobrarMes || 0);
    const deudMes = Number((rep.deudoresMes ?? rep.deudores) || 0);

    const ex = Array.isArray(rep.expenses) ? rep.expenses : [];
    const camps = Array.isArray(rep.campaigns) ? rep.campaigns : [];

    const rowsEx = ex.length ? ex.map(e=>{
      const scope = (e.scope==="campaign") ? (camps.find(c=>c.id===e.campaignId)?.title || "Campaña") : "Curso";
      return `<tr>
        <td>${esc(e.date||"")}</td>
        <td>${esc(scope)}</td>
        <td>${esc(e.title||"")}</td>
        <td style="text-align:right;">${clp(e.amount||0)}</td>
      </tr>`;
    }).join("") : `<tr><td colspan="4" style="opacity:.7;">Sin rendiciones</td></tr>`;

    const rowsCamp = camps.length ? camps.map(c=>{
      const sal = (Number(c.recaudado||0) - Number(c.gastado||0));
      return `<tr>
        <td>
          <div style="font-weight:800;">${esc(c.title||"")}</div>
          <div style="opacity:.75;font-size:12px;">${(c.kind==="monthly"?"Mensual":"Único")} · ${(c.participation==="mandatory"?"Obligatoria":"Voluntaria")}</div>
        </td>
        <td style="text-align:right;">${clp(c.recaudado||0)}</td>
        <td style="text-align:right;">${clp(c.gastado||0)}</td>
        <td style="text-align:right;font-weight:900;">${clp(sal)}</td>
      </tr>`;
    }).join("") : `<tr><td colspan="4" style="opacity:.7;">Sin campañas activas</td></tr>`;

    const css = `
      body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial; padding:18px; color:#0f172a;}
      h1{margin:0 0 6px 0; font-size:22px;}
      .muted{color:#64748b;}
      .grid{display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:14px;}
      .card{border:1px solid rgba(0,0,0,.08); border-radius:14px; padding:12px;}
      .label{font-size:12px; color:#6b7280;}
      .val{font-size:22px; font-weight:900; margin-top:6px;}
      table{width:100%; border-collapse:collapse; margin-top:10px;}
      th,td{padding:10px; border-bottom:1px solid rgba(0,0,0,.08); font-size:13px; text-align:left;}
      th{color:#6b7280; font-weight:800;}
    `;

    return `
      <html>
      <head><meta charset="utf-8"><style>${css}</style></head>
      <body>
        <h1>Informe Ejecutivo del Curso • ${esc(ym)}</h1>
        <div class="muted">Emitido: ${esc(rep.generatedAtHuman||rep.generatedAt||"")}</div>

        <div class="grid">
          <div class="card"><div class="label">Cobrado este mes</div><div class="val">${clp(recMes)}</div></div>
          <div class="card"><div class="label">Por cobrar este mes</div><div class="val">${clp(porCobrarMes)}</div><div class="muted" style="margin-top:6px;">Deudores (mes): ${esc(deudMes)}</div></div>
          <div class="card"><div class="label">Gastado este mes</div><div class="val">${clp(gasMes)}</div></div>
          <div class="card"><div class="label">Saldo disponible</div><div class="val">${clp(saldo)}</div></div>
          <div class="card"><div class="label">Cobrado total</div><div class="val">${clp(recTotal)}</div></div>
          <div class="card"><div class="label">Gastado total</div><div class="val">${clp(gasTotal)}</div></div>
          <div class="card"><div class="label">Pendiente total</div><div class="val">${clp(pendTotal)}</div></div>
          <div class="card"><div class="label">Generado por</div><div class="val" style="font-size:18px;">Cursapp</div></div>
        </div>

        <h2 style="margin-top:22px;font-size:16px;">Campañas activas (cuadratura)</h2>
        <table>
          <thead><tr><th>Campaña</th><th style="text-align:right;">Recaudado</th><th style="text-align:right;">Gastado</th><th style="text-align:right;">Saldo</th></tr></thead>
          <tbody>${rowsCamp}</tbody>
        </table>

        <h2 style="margin-top:22px;font-size:16px;">Gastos recientes</h2>
        <table>
          <thead><tr><th>Fecha</th><th>Ámbito</th><th>Concepto</th><th style="text-align:right;">Monto</th></tr></thead>
          <tbody>${rowsEx}</tbody>
        </table>
      </body>
      </html>
    `;
  }

function buildSnapshotPrintHTML(r){
    // Snapshot PDF (publicado): más completo y consistente con Directiva.
    const esc = (s)=>String(s??"").replace(/[&<>'"]/g,(c)=>({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[c]));
    const clp = (n)=>"$"+Number(n||0).toLocaleString("es-CL");

    const period = r.period || "";
    const genAt = r.generatedAt || "";

    // Totales
    const recTotal = Number(r.recaudadoCurso||0);
    const gasTotal = Number(r.gastadoCurso||0);
    const salTotal = Number(r.disponibleCurso||0);
    const penTotal = Number(r.pendienteCurso||0);
    const deuTotal = Number(r.deudores||0);

    // Si el snapshot trae métricas del mes, las mostramos (si no, se ocultan)
    const cobMes = Number(r.cobradoMes ?? r.recaudadoMes ?? 0);
    const proyMes = Number(r.proyeccionMes ?? r.porCobrarMesTarget ?? 0);
    const porCobMes = Number(r.porCobrarMes ?? (proyMes ? (proyMes - cobMes) : 0));
    const deuMes = Number(r.deudoresMes ?? r.deudoresMonth ?? 0);

    // Campañas (si el snapshot las guarda)
    const camps = Array.isArray(r.campaigns) ? r.campaigns : (Array.isArray(r.byCampaign) ? r.byCampaign : []);
    const campRows = camps.length ? camps.map(c=>{
      const title = esc(c.title||c.name||"Campaña");
      const pct = Math.max(0, Math.min(100, Number(c.pct ?? c.progress ?? 0)));
      const rec = Number(c.recaudado ?? c.collected ?? 0);
      const pen = Number(c.pendienteMes ?? c.pendingMonth ?? c.pendiente ?? 0);
      const goal = Number(c.objetivo ?? c.goal ?? c.target ?? 0);
      return `
        <div class="camp">
          <div class="row">
            <div class="ct">${title}</div>
            <div class="pct">${pct}%</div>
          </div>
          <div class="bar"><div class="fill" style="width:${pct}%;"></div></div>
          <div class="meta">Recaudado: <b>${clp(rec)}</b> · Pendiente mes: <b>${clp(pen)}</b> · Objetivo: <b>${clp(goal)}</b></div>
        </div>
      `;
    }).join("") : `<div class="muted" style="margin-top:8px;">Sin detalle por campaña en este snapshot.</div>`;

    const showMonth = !!(r.cobradoMes || r.recaudadoMes || r.proyeccionMes || r.porCobrarMes || r.deudoresMes);

    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Informe del Curso ${esc(period)}</title>
          <style>
            body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial; margin:24px; color:#0f172a;}
            h1{font-size:20px; margin:0;}
            .sub{color:#475569; margin-top:6px;}
            .grid{display:grid; grid-template-columns:repeat(2,1fr); gap:10px; margin-top:14px;}
            .k{border:1px solid #e2e8f0; border-radius:14px; padding:12px;}
            .k .t{color:#64748b; font-size:12px;}
            .k .v{font-weight:900; font-size:18px; margin-top:6px;}
            .section{margin-top:18px;}
            .st{font-weight:950; font-size:15px; margin-bottom:10px;}
            .muted{color:#64748b;}
            .camp{border:1px solid #e2e8f0; border-radius:14px; padding:12px; margin-top:10px;}
            .row{display:flex; justify-content:space-between; gap:10px; align-items:flex-start;}
            .ct{font-weight:900;}
            .pct{font-weight:950;}
            .bar{margin-top:10px; height:10px; background:#e2e8f0; border-radius:999px; overflow:hidden;}
            .fill{height:100%; background:#1d4ed8; border-radius:999px;}
            .meta{margin-top:8px; font-size:12px; color:#334155;}
            @media (max-width:520px){ .grid{grid-template-columns:1fr;} }
          </style>
        </head>
        <body>
          <h1>Informe del Curso · ${esc(period)}</h1>
          <div class="sub">Emitido: ${esc(genAt || new Date().toLocaleString("es-CL"))}</div>

          ${showMonth ? `
          <div class="section">
            <div class="st">Mes publicado</div>
            <div class="grid">
              <div class="k"><div class="t">Cobrado mes</div><div class="v">${clp(cobMes)}</div></div>
              <div class="k"><div class="t">Proyección mes</div><div class="v">${clp(proyMes)}</div></div>
              <div class="k"><div class="t">Por cobrar mes</div><div class="v">${clp(porCobMes)}</div></div>
              <div class="k"><div class="t">Deudores mes</div><div class="v">${Number(deuMes||0)}</div></div>
            </div>
          </div>` : ``}

          <div class="section">
            <div class="st">Totales del curso</div>
            <div class="grid">
              <div class="k"><div class="t">Recaudado total</div><div class="v">${clp(recTotal)}</div></div>
              <div class="k"><div class="t">Gastado total</div><div class="v">${clp(gasTotal)}</div></div>
              <div class="k"><div class="t">Saldo disponible</div><div class="v">${clp(salTotal)}</div></div>
              <div class="k"><div class="t">Pendiente total</div><div class="v">${clp(penTotal)}</div></div>
              <div class="k"><div class="t">Deudores</div><div class="v">${Number(deuTotal)}</div></div>
            </div>
            <div class="muted" style="margin-top:8px;font-size:12px;">*Este PDF es un snapshot (corte) del periodo publicado.</div>
          </div>

          <div class="section">
            <div class="st">Indicadores por campaña</div>
            ${campRows}
          </div>

          <div class="muted" style="margin-top:18px;">Generado por Cursapp</div>
        </body>
      </html>
    `;
  }


  // ----- Campaign actions (delegated to campaigns.js) -----
  window.openCreateCampaign = function () { Campaigns.openCreate(); };
  window.openEditCampaign = function (taskId) { Campaigns.openEdit(taskId); };
  window.openCloseCampaign = function () { Campaigns.openClose(() => activeTasks()); };

  // Mantener ELIMINAR campaña (activa) en Presidente
  
  // ✅ Publicar cobros (canónico): evita generar pagos "globales" que luego duplican montos.
  // Algunos handlers antiguos llamaban a window.publishCobros, por eso lo mantenemos como puente.
  window.publishCobros = function(taskId){
    if(typeof window.publishCobrosForTask === "function"){
      return window.publishCobrosForTask(taskId);
    }
    alert("No se pudo publicar (función no disponible).");
  };
window.deleteCampaign = function(taskId){
    const t = tasks().find(x=>x.id===taskId);
    if(!t) return;

    if(t.closed){ alert("No se puede eliminar una campaña cerrada."); return; }
    if(isExpired(t)){ alert("No se puede eliminar una campaña caducada."); return; }

    const msg = `¿Eliminar campaña "${t.title}"?\n\n` +
      `Regla: pagos pagados pasan a saldo a favor.\n` +
      `Los pendientes se eliminan del ciclo de cobro.\n\n` +
      `Esto marcará “requiere nuevo informe”.`;

    if(!confirm(msg)) return;

    // eliminar campaña
    save(KEY_TASKS, tasks().filter(x=>x.id!==taskId));

    // eliminar rendiciones asociadas
    save(KEY_EXPENSES, expenses().filter(e=>!(e.scope==="campaign" && e.campaignId===taskId)));

    // pagos: paid -> credit, pending-like -> remove
    const ps = payments()
      .filter(p=>!(p.fromTaskId===taskId && isPendingLike(p))) // elimina pendientes de esa campaña
      .map(p=>{
        if(p.fromTaskId===taskId && isPaid(p)){
          return {...p, status:"credit", creditFromTaskId:taskId, note:"Saldo a favor por campaña eliminada"};

  // ----- Publicar cobros (genera pagos por apoderado aprobado) -----
  function endOfMonthISO(ym){
    const d = endOfMonthDate(ym);
    if(!d) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function addMonthsYM(ym, add){
    const y = parseInt(ym.slice(0,4),10);
    const m = parseInt(ym.slice(5,7),10);
    const base = (y*12 + (m-1)) + add;
    const ny = Math.floor(base/12);
    const nm = (base%12)+1;
    return `${ny}-${String(nm).padStart(2,'0')}`;
  }

  function paymentsForTask(taskId){
    return payments().filter(p=>p.fromTaskId===taskId);
  }

  function publishCobrosForTask(taskId){
    const t = tasks().find(x=>x.id===taskId);
    if(!t) return;
    const people = approvedApoderados();
    if(!people.length){
      alert('No hay apoderados aprobados para generar cobros.');
      return;
    }
    const existing = paymentsForTask(taskId);
    const byKey = new Set(existing.map(p=>`${p.apoderadoEmail||p.email||''}||${p.period||ymFromISO(p.dueDate)||''}||${p.installmentIndex||''}`));
    const out = payments().slice();
    const type = String(t.type||'single').toLowerCase();
    if(type==='monthly'){
      const startYM = ymFromISO(t.startDate||t.dueDate||currentYYYYMM());
      const months = Math.max(1, Number(t.months||1));
      for(let i=0;i<months;i++){
        const period = addMonthsYM(startYM, i);
        const dueDate = endOfMonthISO(period);
        const idx = i+1;
        people.forEach(e=>{
          const email = e.email || '';
          const key = `${email}||${period}||${idx}`;
          if(byKey.has(key)) return;
          out.unshift({
            id: uid('pay'),
            fromTaskId: t.id,
            concept: `${t.title} · Cuota ${idx}/${months}`,
            amount: Number(t.amount||0),
            status: 'pending',
            dueDate,
            period,
            installmentIndex: idx,
            apoderadoEmail: email,
            apoderadoName: e.apoderadoName||'',
            alumno: e.alumno||'',
            createdAt: new Date().toISOString()
          });
          byKey.add(key);
        });
      }
    } else {
      const period = ymFromISO(t.dueDate||t.startDate||currentYYYYMM());
      const dueDate = t.dueDate||endOfMonthISO(period);
      people.forEach(e=>{
        const email = e.email || '';
        const key = `${email}||${period}||1`;
        if(byKey.has(key)) return;
        out.unshift({
          id: uid('pay'),
          fromTaskId: t.id,
          concept: t.title,
          amount: Number(t.amount||0),
          status: 'pending',
          dueDate,
          period,
          installmentIndex: 1,
          apoderadoEmail: email,
          apoderadoName: e.apoderadoName||'',
          alumno: e.alumno||'',
          createdAt: new Date().toISOString()
        });
        byKey.add(key);
      });
    }
    save(KEY_PAYMENTS, out);
    markDirty();
    alert('Cobros publicados ✅');
    go('campanas');
  }

  window.publishCobrosForTask = publishCobrosForTask;
  window.publishCobros = publishCobrosForTask;

        }
        return p;
      });
    save(KEY_PAYMENTS, ps);

    markDirty();
    alert("Campaña eliminada ✅ (saldo a favor generado si aplica)");
    go("campanas");
  };

  // ----- Publish report (monthly) -----
  window.confirmGenerateReport = function(){
    if(!confirm("¿Publicar informe mensual del curso?")) return;
    publishMonthly();
  };

  function publishMonthly(period){
    period = period || currentYM();
    if(!/^\d{4}-\d{2}$/.test(period)){
      alert("Formato inválido. Usa YYYY-MM");
      return;
    }

    // ✅ Snapshot: corte oficial (no cambia después)
    const s0 = readSession && readSession();
    const courseKey = activeCourseKey() || String(s0?.courseKey||"").trim() || "course";
    const id = `${courseKey}::${period}`;

    const list = normalizeTasks(tasks());
    const exAll = expenses();
    const paysAll = payments();

    // Métricas del mes (periodo publicado)
    const cobradoMes = collectedMonth(period);
    const gastadoMes = spentMonth(period);
    const porCobrarMes = pendingMonth(period);
    const deudoresMes = deudoresMonth(period);

    // Totales del curso (al momento de publicar)
    const recaudadoCurso = collectedCourse();
    const gastadoCurso = spentCourse();
    const disponibleCurso = recaudadoCurso - gastadoCurso;
    const pendienteCurso = pendingTotal();
    const deudores = deudoresCount();

    // Detalle por campañas (para PDF ejecutivo del snapshot)
    const campaigns = list.map(t=>{
      const kind = String(t.type||"single").toLowerCase()==="monthly" ? "monthly" : "single";
      const participation = (t.mandatoryParticipation === false) ? "voluntary" : "mandatory";

      const rec = collectedTask(t.id);
      const gas = spentTask(t.id);
      const sal = rec - gas;

      // Pendiente del mes (si aplica)
      let pendienteMes = 0;
      if(kind==="monthly"){
        // cuota del mes si el periodo cae dentro del rango
        const startYM = ymFromISO(t.startDate||t.dueDate||"");
        if(startYM){
          const months = Math.max(1, Number(t.months||1));
          // calcula índice relativo
          const sy = parseInt(startYM.slice(0,4),10), sm = parseInt(startYM.slice(5,7),10);
          const cy = parseInt(period.slice(0,4),10), cm = parseInt(period.slice(5,7),10);
          const idx = (cy - sy)*12 + (cm - sm) + 1;
          if(idx>=1 && idx<=months){
            // usa proyección del mes (ajustada por opted_out si existe)
            const people = approvedCount();
            let expected = Number(t.amount||0) * people;
            if(t.mandatoryParticipation === false){
              const opted = paysAll.filter(p=>p.fromTaskId===t.id && String(p.status||'').toLowerCase()==='opted_out' && withinMonth(p.dueDate||p.period||'', period)).length;
              expected -= Math.min(opted, people) * Number(t.amount||0);
            }
            const paid = paysAll.filter(p=>p.fromTaskId===t.id && isPaid(p) && withinMonth((p.paidAt||p.paidDate||p.createdAt||p.dueDate||''), period)).reduce((s,p)=>s+Number(p.amount||0),0);
            pendienteMes = Math.max(0, expected - paid);
          }
        }
      }else{
        const dueYM = ymFromISO(t.dueDate||"");
        if(dueYM===period){
          const people = approvedCount();
          let expected = Number(t.amount||0) * people;
          if(t.mandatoryParticipation === false){
            const opted = paysAll.filter(p=>p.fromTaskId===t.id && String(p.status||'').toLowerCase()==='opted_out' && withinMonth(p.dueDate||p.period||'', period)).length;
            expected -= Math.min(opted, people) * Number(t.amount||0);
          }
          const paid = paysAll.filter(p=>p.fromTaskId===t.id && isPaid(p) && withinMonth((p.paidAt||p.paidDate||p.createdAt||p.dueDate||''), period)).reduce((s,p)=>s+Number(p.amount||0),0);
          pendienteMes = Math.max(0, expected - paid);
        }
      }

      const objetivo = expectedTaskTotal(t);
      const pct = objetivo>0 ? Math.max(0, Math.min(100, Math.round((rec/objetivo)*100))) : 0;

      return {
        id: t.id,
        title: t.title || "Campaña",
        kind,
        participation,
        amount: Number(t.amount||0),
        months: Math.max(1, Number(t.months||1)),
        objetivo,
        recaudado: rec,
        gastado: gas,
        saldo: sal,
        pendienteMes,
        pct,
        deudores: deudoresTask(t.id)
      };
    });

    // Gastos del mes (para PDF snapshot)
    const expensesMonth = exAll.filter(e=>String(e.date||"").startsWith(period)).slice(0, 40);

    const rep = {
      version: 4,
      id,
      courseKey,
      period,

      generatedAt: new Date().toISOString(),
      generatedAtHuman: new Date().toLocaleString("es-CL"),

      // Totales del curso (corte)
      recaudadoCurso,
      gastadoCurso,
      disponibleCurso,
      pendienteCurso,
      deudores,

      // Métricas del mes publicado
      cobradoMes,
      gastadoMes,
      porCobrarMes,
      deudoresMes,

      campaigns,
      expenses: expensesMonth
    };

    // Guardar sin duplicados (mismo id/period)
    const arr0 = load(KEY_MONTHLY_REPORTS, []);
    const arr = (arr0||[]).filter(x=>!(x && (String(x.id)===id || String(x.period)===period)));
    arr.unshift(rep);
    save(KEY_MONTHLY_REPORTS, arr.slice(0, 3));

    clearDirty();
    try{ toast(`Informe publicado (${period}) ✅`); }catch(e){ alert(`Informe publicado (${period}) ✅`); }

    // refrescar vista
    renderInformes();
  }
  // ----- boot -----
  // ✅ DEMO seed solo si está activado globalmente
  const DEMO_SEED = !!(window.CURSAPP && window.CURSAPP.DEMO_MODE);
  if (DEMO_SEED) ensureDemo();

  initMenu();
  setInterval(()=>{
    if(state.tab!=="campanas") return;
    const sig = __tasksSig();
    if(sig && sig!==__TASKS_SIG){ __TASKS_SIG=sig; renderCampanas(); }
  }, 800);
  // Si venimos desde Perfil, abrir el tab solicitado
  var __nextTab = (window.CURSAPP && typeof window.CURSAPP.consumeNextNavTab === "function")
    ? window.CURSAPP.consumeNextNavTab()
    : null;
  go(__nextTab || "home");
})();

window.openHelp = function(topic){
  const html =
    '<div class="card" style="max-height:70vh;overflow:auto;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">' +
        '<div style="font-weight:900;font-size:18px;">❓ Ayuda Presidente</div>' +
        '<button class="btn ghost" type="button" onclick="closeModal()">Cerrar</button>' +
      '</div>' +

      '<div style="margin-top:12px;line-height:1.45;">' +

        '<b>Campaña obligatoria</b>' +
        '<div class="muted">Todos los apoderados deben pagar. No existe “No participo”.</div>' +
        '<div style="height:10px;"></div>' +

        '<b>Campaña no obligatoria</b>' +
        '<div class="muted">Cada apoderado elige Participar o No participo. Solo los que participan cuentan en pendiente.</div>' +
        '<div style="height:10px;"></div>' +

        '<b>Deudores vs Cuotas pendientes</b>' +
        '<div class="muted"><b>Deudores</b> = cantidad de apoderados con deuda vigente. <b>Cuotas pendientes</b> = detalle de cuotas sin pagar.</div>' +
        '<div style="height:10px;"></div>' +

        '<b>Crear y publicar campaña</b>' +
        '<div class="muted">Crea la campaña, revisa monto/fechas y luego publícala. Al publicar, queda visible para apoderados.</div>' +
        '<div style="height:10px;"></div>' +

        '<b>Aprobación de apoderados</b>' +
        '<div class="muted">Los apoderados quedan “pendientes” hasta que el presidente los apruebe para ingresar al curso.</div>' +
        '<div style="height:10px;"></div>' +

        '<b>Cobranza (WhatsApp)</b>' +
        '<div class="muted">Usa la sección Deudores para copiar mensajes listos por apoderado y enviarlos.</div>' +
        '<div style="height:10px;"></div>' +

        '<b>Cierre de campaña</b>' +
        '<div class="muted">Cierra manualmente indicando motivo (meta cumplida, fin de plazo, error, etc.).</div>' +

      '</div>' +
    '</div>';

  if (typeof openModal === "function") openModal(html);
  else alert("Ayuda Presidente: revisa campañas, deudores y cobranza.");
};
// --- Ayuda Presidente (misma UX que Apoderado) ---
(function () {
  function esc(s){
    return String(s ?? "").replace(/[&<>'"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[c]));
  }

  // Si no existe openModal/closeModal, fallback suave
  function _open(html){
    if (typeof window.openModal === "function") return window.openModal(html);
    alert("Ayuda Presidente: revisa Campañas, Deudores e Informes.");
  }
  function _close(){
    if (typeof window.closeModal === "function") return window.closeModal();
    const mr = document.getElementById("modalRoot");
    if (mr) mr.innerHTML = "";
  }

  // Contenido FAQ Presidente (puedes ajustar texto)
  function buildFaqHTML(){
    const items = [
      ["¿Qué es una campaña obligatoria?", "Es un cobro del curso donde todos participan. No puedes excluirte."],
      ["¿Qué es una campaña no obligatoria?", "El apoderado elige Participar o No participo. Si elige No participo, ese cobro se excluye de su pendiente."],
      ["Deudores vs Cuotas pendientes", "Deudores = apoderados con deuda vigente. Cuotas pendientes = cantidad de cuotas impagas (detalle)."],
      ["Crear y publicar campaña", "Crea la campaña, revisa monto/fechas y publícala para que quede visible a apoderados."],
      ["Cobranza (WhatsApp)", "En Deudores puedes copiar un texto listo por apoderado y enviarlo."],
      ["Cierre de campaña", "Cierra manualmente e indica el motivo (meta cumplida, fin de plazo, error, etc.)."],
      ["Aprobación de apoderados", "Los apoderados quedan pendientes hasta que el presidente los apruebe para ingresar al curso."]
    ];

    let body = "";
    for (const [q,a] of items){
      body += `
        <div class="helpQ">${esc(q)}</div>
        <div class="helpA">${esc(a)}</div>
        <div class="helpSep"></div>
      `;
    }

    return `
      <div class="helpModal">
        <div class="helpHead">
          <div class="helpTitle">❓ Ayuda Presidente</div>
        </div>

        <div class="helpBody">
          ${body}
        </div>

        <div class="helpFoot">
          <button class="btn primary" type="button" onclick="window.__closeHelpPresident()">Cerrar</button>
        </div>
      </div>
    `;
  }

  // API pública igual a Apoderado
  window.__closeHelpPresident = _close;
  window.openHelp = function(topic){
    _open(buildFaqHTML());
  };

  // Si no existen estilos help*, los inyecta (para que se vea igual)
  (function ensureHelpStyles(){
    if (document.getElementById("helpStyles_v1")) return;
    const css = `
      .helpModal{ width:min(560px, 92vw); max-height:78vh; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 18px 40px rgba(0,0,0,.18); }
      .helpHead{ padding:14px 16px; border-bottom:1px solid rgba(0,0,0,.08); }
      .helpTitle{ font-weight:900; font-size:18px; }
      .helpBody{ padding:14px 16px; overflow:auto; max-height:56vh; -webkit-overflow-scrolling:touch; }
      .helpQ{ font-weight:800; font-size:16px; margin-top:10px; }
      .helpA{ color:rgba(0,0,0,.65); margin-top:6px; line-height:1.45; }
      .helpSep{ height:1px; background:rgba(0,0,0,.06); margin:12px 0; }
      .helpFoot{ padding:12px 16px; border-top:1px solid rgba(0,0,0,.08); display:flex; justify-content:flex-end; position:sticky; bottom:0; background:#fff; }
    `;
    const style = document.createElement("style");
    style.id = "helpStyles_v1";
    style.textContent = css;
    document.head.appendChild(style);
  })();
})();

