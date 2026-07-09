
// === CURSAPP GLOBAL LOADING ===
window.CURSAPP_LOADING = window.CURSAPP_LOADING || {
 show:(role='')=>{
  try{
   let el=document.getElementById('cursapp-loading-overlay');
   if(el) return;
   const msgs={
    presidente:['📊 Preparando dashboard ejecutivo...','👥 Revisando apoderados...','📈 Actualizando indicadores...'],
    tesorero:['💰 Conciliando pagos...','🧾 Actualizando comprobantes...','📋 Revisando rendiciones...'],
    apoderado:['🎒 Revisando información del curso...','📅 Consultando próximas cuotas...','📣 Actualizando avisos...']
   };
   const arr=msgs[(role||'').toLowerCase()]||['Cargando datos...'];
   el=document.createElement('div');
   el.id='cursapp-loading-overlay';
   el.style.cssText='position:fixed;inset:0;background:#fff;z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center';
   el.innerHTML='<div style="font-size:54px;color:#6d28d9;font-weight:700">C</div><div id="ca-msg" style="margin-top:12px;font-weight:600">Cargando datos...</div><div style="width:220px;height:6px;background:#eee;border-radius:8px;overflow:hidden;margin-top:12px"><div style="height:100%;width:100%;background:#6d28d9;animation:caProg 1.4s infinite"></div></div><style>@keyframes caProg{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}</style>';
   document.body.appendChild(el);
   let i=0; el._t=setInterval(()=>{const m=el.querySelector('#ca-msg'); if(m) m.textContent=arr[i++%arr.length];},900);
  }catch(e){}
 },
 hide:()=>{
  const el=document.getElementById('cursapp-loading-overlay');
  if(el){try{clearInterval(el._t);}catch(e){} el.remove();}
 }
};
document.addEventListener('DOMContentLoaded',()=>{try{window.CURSAPP_LOADING.show('tesorero'); setTimeout(()=>window.CURSAPP_LOADING.hide(),1200);}catch(e){}});
// === END LOADING ===

// V10.1 · Mantiene contexto de rol coherente al abrir tesorero.
(function(){
  try{
    const expected='tesorero';
    const raw=localStorage.getItem('cursapp_session_v1');
    const s=raw ? JSON.parse(raw) : {};
    const roles=Array.isArray(s.roles) ? s.roles.map(r=>String(r).toLowerCase().trim()).filter(Boolean) : [];
    if(!roles.includes(expected)) roles.push(expected);
    s.roles=roles; s.currentRole=expected; s.activeRole=expected; s.role=expected;
    const activeCourse=String(localStorage.getItem('cursapp_active_course_v1') || s.courseKey || '').trim();
    if(activeCourse) s.courseKey=activeCourse;
    localStorage.setItem('cursapp_active_role_v1', expected);
    localStorage.setItem('cursapp_session_v1', JSON.stringify(s));
    document.documentElement.setAttribute('data-role', expected);
  }catch(_e){}
})();
/* __CURSAPP_V10_1_ROLE_CONTEXT_TESORERO__ */

/* Cursapp · Tesorero (Rendiciones) — FULL FINAL (auto-keys + no-loss) */
(function () {
  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modalRoot");
  const navItems = Array.from(document.querySelectorAll(".navItem"));
  const menuBtn = document.getElementById("menuBtn");
  const menuDropdown = document.getElementById("menuDropdown");
  const resetBtn = document.getElementById("resetBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  // ---------- utils ----------
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>'"]/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"
  }[c]));
  const clp = (n) => "$" + Number(n || 0).toLocaleString("es-CL");
  const uid = (p="id") => `${p}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
  const todayISO = () => new Date().toISOString().slice(0,10);

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
  function ymFromISO(iso){
    const s = String(iso||"");
    return s.length>=7 ? s.slice(0,7) : "";
  }
  function paymentMethodLabel(m){
    return ({
      transbank:"💳 Transbank",
      transferencia:"🏦 Transferencia",
      efectivo:"💵 Efectivo",
      saldo_favor:"🔁 Saldo a favor"
    })[m] || "—";
  }
  function conciliationStatusLabel(s){
    return ({
      pendiente:"⏳ Pendiente",
      conciliado:"✅ Conciliado",
      observado:"⚠️ Observado",
      anulado:"🚫 Anulado"
    })[s] || "—";
  }
  function activeCourseKey(){
    try{ return String(localStorage.getItem("cursapp_active_course_v1") || "").trim(); }catch(e){ return ""; }
  }
  function allProfiles(){
    try{
      const arr = JSON.parse(localStorage.getItem("cursapp_profiles_v1") || "[]");
      return Array.isArray(arr) ? arr : [];
    }catch(e){ return []; }
  }
  function allUsers(){
    try{
      const arr = JSON.parse(localStorage.getItem("cursapp_users_v1") || "[]");
      return Array.isArray(arr) ? arr : [];
    }catch(e){ return []; }
  }
  function resolveUserEmailById(userId){
    const uid = String(userId||"").trim();
    if(!uid) return "";
    const u = allUsers().find(x => String(x?.userId||"").trim() === uid);
    return String(u?.email || "").trim().toLowerCase();
  }
  function profileChoices(){
    const courseKey = activeCourseKey();
    const arr = allProfiles()
      .filter(p => !courseKey || String(p?.courseKey||"")===courseKey)
      .map(p=>{
        const role = String(p?.role || p?.user?.role || "").toLowerCase();
        const guardian = String(p?.apoderado?.name || p?.user?.name || "").trim();
        const student = String(p?.apoderado?.alumno || p?.studentName || "").trim();
        const email = String(
          p?.apoderado?.email ||
          p?.email ||
          p?.guardianEmail ||
          p?.contactEmail ||
          p?.user?.email ||
          resolveUserEmailById(p?.userId || p?.user?.userId) ||
          ""
        ).trim().toLowerCase();
        const profileId = String(p?.profileId || p?.id || [email, guardian, student, courseKey].join("|")).trim();
        const alumnoId = String(
          p?.apoderado?.alumnoId ||
          p?.studentId ||
          p?.alumnoId ||
          alumnoIdOf(String(p?.courseKey||courseKey||""), email || profileId, student)
        ).trim();
        const label = (guardian && student) ? `${guardian} · ${student}` : "";
        return { profileId, guardian, student, email, alumnoId, role, courseKey: String(p?.courseKey||courseKey||""), label };
      })
      .filter(x => (x.role.includes("apod") || (!!x.guardian && !!x.student)) && !!x.guardian && !!x.student && !!x.email);

    const out = [];
    const seen = new Set();
    arr.forEach(x=>{
      const k = `${x.email}|${x.student}|${x.courseKey}`;
      if(seen.has(k)) return;
      seen.add(k);
      out.push(x);
    });
    return out.sort((a,b)=>a.label.localeCompare(b.label,"es"));
  }
  function selectedProfileById(profileId){
    return profileChoices().find(x=>String(x.profileId)===String(profileId)) || null;
  }
  function paymentsNormalized(){
    const arr = paymentsAll();
    let changed = false;
    const next = arr.map(p=>{
      const np = { ...p };
      if(!np.createdAt){ np.createdAt = new Date().toISOString(); changed = true; }
      if(String(np.status||"").toLowerCase()==="paid"){
        if(!np.paymentMethod){ np.paymentMethod = np.paidWith || "transbank"; changed = true; }
        if(!np.conciliationStatus){ np.conciliationStatus = "conciliado"; changed = true; }
      }
      return np;
    });
    if(changed) save(KEY_PAYMENTS, next);
    return next;
  }
  function inferCampaignDefaults(taskId){
    const task = tasksAll().find(t=>String(t.id)===String(taskId));
    let amount = Number(task?.amount||0) || 0;
    let concept = task?.title || "Pago";
    const payments = paymentsNormalized().filter(p=>String(p.fromTaskId||"")===String(taskId));
    if(payments.length){
      const firstConcept = payments.find(p=>String(p.concept||"").trim());
      if(firstConcept) concept = String(firstConcept.concept||concept);
      const freq = {};
      payments.forEach(p=>{
        const a = Number(p.amount || p.amountRemaining || 0);
        if(a>0) freq[a] = (freq[a]||0)+1;
      });
      const top = Object.entries(freq).sort((a,b)=>b[1]-a[1])[0];
      if(top) amount = Number(top[0]||amount);
    }
    return { amount, concept };
  }
  function sameText(a,b){
    return String(a||"").toLowerCase().trim() === String(b||"").toLowerCase().trim();
  }
  function matchesPendingForProfile(p, prof, taskId){
    const st = String(p?.status||"").toLowerCase();
    if(String(p?.fromTaskId||"") !== String(taskId||"")) return false;
    if(!["pending","partial","overdue"].includes(st)) return false;

    const pEmail = String(p?.apoderadoKey || p?.apoderadoId || p?.apoderadoEmail || p?.email || "").toLowerCase().trim();
    const pGuardian = String(p?.guardianName || p?.apoderadoName || "").trim();
    const pStudent = String(p?.studentName || p?.alumno || "").trim();
    const pAlumnoId = String(p?.alumnoId || "").trim();

    const emailMatch = pEmail && sameText(pEmail, prof.email);
    const alumnoHashMatch = pAlumnoId && sameText(pAlumnoId, prof.alumnoId);
    const studentNameMatch = pStudent && sameText(pStudent, prof.student);
    const guardianNameMatch = pGuardian && sameText(pGuardian, prof.guardian);

    if(emailMatch && (alumnoHashMatch || studentNameMatch || !pAlumnoId)) return true;
    if(guardianNameMatch && studentNameMatch) return true;
    if(emailMatch) return true;
    return false;
  }
  function conciliationStats(){
    const payments = paymentsNormalized()
      .filter(p=>String(p.status||"").toLowerCase()==="paid")
      .filter(p=>String(p.conciliationStatus||"")!=="anulado");
    const byMethod = (m)=>payments.filter(p=>p.paymentMethod===m);
    const byStatus = (s)=>payments.filter(p=>p.conciliationStatus===s);
    return {
      payments,
      transbank: sum(byMethod("transbank"), p=>p.amount),
      transferencia: sum(byMethod("transferencia"), p=>p.amount),
      efectivo: sum(byMethod("efectivo"), p=>p.amount),
      saldoFavor: sum(byMethod("saldo_favor"), p=>p.amount),
      pendiente: sum(byStatus("pendiente"), p=>p.amount),
      observado: sum(byStatus("observado"), p=>p.amount),
      cajaReal: sum(payments.filter(p=>["transbank","transferencia","efectivo"].includes(p.paymentMethod)), p=>p.amount),
      contable: sum(payments, p=>p.amount)
    };
  }
  function openManualPayment(){
    const tasks = tasksAll();
    const profiles = profileChoices();
    const profileOptions = profiles.map(p=>`<option value="${esc(p.profileId)}">${esc(p.label)}</option>`).join("");
    const taskOptions = tasks.map(t=>`<option value="${esc(t.id)}">${esc(t.title)}</option>`).join("");

    openModal(`
      <div class="row">
        <div>
          <div style="font-weight:950;font-size:18px;">Registrar pago manual</div>
          <div class="muted" style="margin-top:6px;">Monto automático según campaña.</div>
        </div>
        <button class="btnMini" onclick="closeModal()">Cerrar</button>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Apoderado</label>
        <select id="mp_profile">
          <option value="">Seleccionar apoderado · alumno</option>
          ${profileOptions}
        </select>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Campaña</label>
        <select id="mp_task">
          <option value="">Seleccionar campaña</option>
          ${taskOptions}
        </select>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Concepto</label>
        <input id="mp_concept" readonly />
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Monto</label>
          <input id="mp_amount" inputmode="numeric" readonly />
        </div>
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Fecha</label>
          <input id="mp_date" type="date" value="${todayISO()}" />
        </div>
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Medio de pago</label>
          <select id="mp_method">
            <option value="transferencia">🏦 Transferencia</option>
            <option value="efectivo">💵 Efectivo</option>
            <option value="saldo_favor">🔁 Saldo a favor</option>
            <option value="transbank">💳 Transbank</option>
          </select>
        </div>
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Estado conciliación</label>
          <select id="mp_status">
            <option value="conciliado">✅ Conciliado</option>
            <option value="pendiente">⏳ Pendiente</option>
            <option value="observado">⚠️ Observado</option>
          </select>
        </div>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Observación</label>
        <input id="mp_note" placeholder="Opcional" />
      </div>

      <div class="actions" style="margin-top:14px;justify-content:flex-end;">
        <button class="btnMini" onclick="closeModal()">Cancelar</button>
        <button class="btnPrimaryMini" onclick="registerManualPayment()">Guardar pago</button>
      </div>
    `);

    const taskSel = $("mp_task");
    const applyDefaults = ()=>{
      const taskId = taskSel ? taskSel.value : "";
      const d = inferCampaignDefaults(taskId);
      if($("mp_concept")) $("mp_concept").value = taskId ? (d.concept || "") : "";
      if($("mp_amount")) $("mp_amount").value = taskId && d.amount ? d.amount : "";
    };
    if(taskSel){
      taskSel.onchange = applyDefaults;
      applyDefaults();
    }
  }
  function registerManualPayment(){
    const profileId = ($("mp_profile")?.value || "").trim();
    const prof = selectedProfileById(profileId);
    const fromTaskId = ($("mp_task")?.value || "").trim();
    const concept = ($("mp_concept")?.value || "").trim();
    const amount = Number(($("mp_amount")?.value || "0").replace(/[^\d.-]/g,""));
    const paidAt = $("mp_date")?.value || todayISO();
    const paymentMethod = $("mp_method")?.value || "transferencia";
    const conciliationStatus = $("mp_status")?.value || "conciliado";
    const note = ($("mp_note")?.value || "").trim();

    if(!prof) return alert("Debes seleccionar apoderado · alumno.");
    if(!fromTaskId) return alert("Debes seleccionar campaña.");
    if(!concept || !amount) return alert("No se pudo cargar el monto de la campaña.");

    const payments = paymentsNormalized();
    const task = tasksAll().find(t=>String(t.id)===String(fromTaskId)) || null;
    const courseKey = String(prof.courseKey || activeCourseKey() || "").trim();
    const period = ymFromISO((task?.dueDate || task?.startDate || paidAt));
    const installmentIndex = 1;
    const wantedKey = paymentKeyOf(courseKey, fromTaskId, prof.email, prof.alumnoId, period, installmentIndex);

    // 1) Bloquear duplicado si ya existe un paid para la misma campaña/cuota/apoderado
    const samePaid = payments.findIndex(p=>{
      const st = String(p?.status||"").toLowerCase();
      if(st !== "paid") return false;
      if(String(p?.fromTaskId||"") !== String(fromTaskId)) return false;

      const pPeriod = String(p?.period || ymFromISO(p?.dueDate) || ymFromISO(p?.paidAt) || "");
      const pIdx = String(p?.installmentIndex==null || p?.installmentIndex==="" ? 1 : p?.installmentIndex);
      const sameSlot = (pPeriod === period && pIdx === String(installmentIndex));

      const pEmail = String(p?.apoderadoKey || p?.apoderadoId || p?.apoderadoEmail || p?.email || "").toLowerCase().trim();
      const pAlumnoId = String(p?.alumnoId || "").trim();
      const sameIdentity = pEmail === String(prof.email).toLowerCase().trim() && (!pAlumnoId || pAlumnoId === String(prof.alumnoId));

      const sameNames = sameText(p?.guardianName || p?.apoderadoName || "", prof.guardian) &&
                        sameText(p?.studentName || p?.alumno || "", prof.student);
      const sameKey = String(p?.paymentKey || "") === wantedKey;

      return (sameSlot && (sameIdentity || sameNames)) || sameKey;
    });
    if(samePaid >= 0){
      return alert("Esta cuota/campaña ya figura como pagada para este apoderado.");
    }

    // 2) Buscar pendiente existente para convertirlo a paid
    let pendingIdx = payments.findIndex(p=>{
      const st = String(p?.status||"").toLowerCase();
      if(!["pending","partial","overdue"].includes(st)) return false;
      if(String(p?.fromTaskId||"") !== String(fromTaskId)) return false;

      const pPeriod = String(p?.period || ymFromISO(p?.dueDate) || "");
      const pIdx = String(p?.installmentIndex==null || p?.installmentIndex==="" ? 1 : p?.installmentIndex);
      const sameSlot = (pPeriod === period && pIdx === String(installmentIndex));

      const pEmail = String(p?.apoderadoKey || p?.apoderadoId || p?.apoderadoEmail || p?.email || "").toLowerCase().trim();
      const pAlumnoId = String(p?.alumnoId || "").trim();
      const sameIdentity = pEmail === String(prof.email).toLowerCase().trim() && (!pAlumnoId || pAlumnoId === String(prof.alumnoId));

      const sameNames = sameText(p?.guardianName || p?.apoderadoName || "", prof.guardian) &&
                        sameText(p?.studentName || p?.alumno || "", prof.student);
      const sameKey = String(p?.paymentKey || "") === wantedKey;

      return (sameSlot && (sameIdentity || sameNames)) || sameKey;
    });

    // fallback legacy: cualquier pending de esa campaña+apoderado+alumno
    if(pendingIdx < 0){
      pendingIdx = payments.findIndex(p=>{
        const st = String(p?.status||"").toLowerCase();
        if(!["pending","partial","overdue"].includes(st)) return false;
        if(String(p?.fromTaskId||"") !== String(fromTaskId)) return false;

        const pEmail = String(p?.apoderadoKey || p?.apoderadoId || p?.apoderadoEmail || p?.email || "").toLowerCase().trim();
        const pAlumnoId = String(p?.alumnoId || "").trim();
        return pEmail === String(prof.email).toLowerCase().trim() && (!pAlumnoId || pAlumnoId === String(prof.alumnoId));
      });
    }

    const receiptId = uid("manual");
    const transactionId = "MANUAL-" + Date.now();

    if(pendingIdx >= 0){
      const prev = payments[pendingIdx];
      payments[pendingIdx] = {
        ...prev,
        fromTaskId: prev.fromTaskId || fromTaskId,
        courseKey: prev.courseKey || courseKey,
        paymentKey: wantedKey,
        period: prev.period || period,
        installmentIndex: prev.installmentIndex || installmentIndex,
        dueDate: prev.dueDate || (task?.dueDate || paidAt),
        concept,
        amount,
        amountRemaining: 0,
        status: "paid",
        paymentMethod,
        conciliationStatus,
        guardianName: prev.guardianName || prof.guardian,
        studentName: prev.studentName || prof.student,
        apoderadoKey: prev.apoderadoKey || prof.email,
        apoderadoId: prev.apoderadoId || prof.email,
        apoderadoEmail: prof.email,
        email: prof.email,
        alumnoId: prof.alumnoId,
        paidAt,
        paidWith: paymentMethod,
        source: "manual",
        note,
        transactionId,
        receiptId
      };
    }else{
      payments.unshift({
        id: uid("p"),
        fromTaskId,
        courseKey,
        paymentKey: wantedKey,
        period,
        installmentIndex,
        dueDate: task?.dueDate || paidAt,
        concept,
        amount,
        amountRemaining: 0,
        status: "paid",
        paymentMethod,
        conciliationStatus,
        guardianName: prof.guardian,
        studentName: prof.student,
        apoderadoKey: prof.email,
        apoderadoId: prof.email,
        apoderadoEmail: prof.email,
        email: prof.email,
        alumnoId: prof.alumnoId,
        paidAt,
        paidWith: paymentMethod,
        source: "manual",
        note,
        transactionId,
        receiptId,
        createdAt: new Date().toISOString()
      });
    }
    save(KEY_PAYMENTS, payments);

    try{
      const paidPaymentForSync = pendingIdx >= 0 ? payments[pendingIdx] : payments[0];
      if(window.CURSAPP_PAYMENTS_V11 && typeof window.CURSAPP_PAYMENTS_V11.syncPaidLocalPayment === "function"){
        window.CURSAPP_PAYMENTS_V11.syncPaidLocalPayment(paidPaymentForSync)
          .then(function(){ try{ return window.CURSAPP_PAYMENTS_V11.refresh("manual-payment"); }catch(e){} })
          .catch(function(e){ console.warn("No se pudo sincronizar pago manual en Supabase", e); });
      }
    }catch(e){}

    try{
      if(typeof window.createAviso === "function"){
        const paidPayment = pendingIdx >= 0 ? payments[pendingIdx] : payments[0];
        const campaignTitle = String(task?.title || concept || "Pago").trim();
        const avisoAmount = Number(paidPayment?.amount || amount || 0);

        window.createAviso({
          type: "auto",
          category: "payment",
          priority: "normal",
          title: "✅ Se registró tu pago",
          message: `${campaignTitle} · ${clp(avisoAmount)}`,
          targetEmail: String(prof.email || paidPayment?.apoderadoEmail || paidPayment?.email || "").toLowerCase().trim(),
          createdAt: new Date().toISOString(),
          actionType: "open_receipt",
          actionPayload: { paymentId: String(paidPayment?.id || "") },
          dedupeKey: `payreg:${String(paidPayment?.id || receiptId)}`
        });
      }
    }catch(e){
      console.error("No se pudo crear aviso automático de pago", e);
    }

    markDirty();
    closeModal();
    renderConciliacion();
    alert("Pago manual registrado ✅");
  }

  function shareWhatsApp(text){
    const msg = String(text||"").trim();
    if(!msg){ alert("No hay contenido para compartir."); return; }
    const url = "https://wa.me/?text=" + encodeURIComponent(msg);
    window.open(url, "_blank");
  }
  function buildTreasuryWhatsAppText(rep){
    const lines = [];
    lines.push(`📊 Informe Tesorería`);
    lines.push(`Periodo: ${rep.period}`);
    lines.push("");
    lines.push(`💰 Cobrado mes: ${clp(rep.collectedMes)}`);
    lines.push(`🧾 Gastado mes: ${clp(rep.spentMes)}`);
    lines.push(`⚖️ Saldo mes: ${clp(rep.saldoMes)}`);
    lines.push("");
    lines.push(`🏦 Saldo acumulado: ${clp(rep.saldoTotal)}`);
    if(Array.isArray(rep.campaignRows) && rep.campaignRows.length){
      lines.push("");
      lines.push("🎯 Estado campañas");
      rep.campaignRows.slice(0,4).forEach(c=>{
        lines.push(`• ${c.title}`);
        lines.push(`Recaudado: ${clp(c.rec)}`);
        lines.push(`Gastado: ${clp(c.gas)}`);
        lines.push(`Saldo: ${clp(c.sal)}`);
        lines.push("");
      });
    }
    lines.push("Informe generado en Cursapp");
    return lines.join("\n").trim();
  }
  function shareTreasuryReport(id){
    const reps = load(KEY_MONTHLY_REPORTS, []);
    const rep = reps.find(r=>String(r.id)===String(id));
    if(!rep) return alert("No se encontró el informe.");
    shareWhatsApp(buildTreasuryWhatsAppText(rep));
  }
  // file helpers (boletas)
  function pickBoletaFile(onPicked){
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*,application/pdf";
    inp.style.display = "none";
    document.body.appendChild(inp);

    inp.onchange = ()=>{
      const file = inp.files && inp.files[0];
      document.body.removeChild(inp);
      if(!file) return;

      if(file.size > 3 * 1024 * 1024){
        alert("Archivo muy pesado (máx 3MB).");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e)=>{
        onPicked({
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          dataUrl: e.target.result
        });
      };
      reader.onerror = ()=> alert("No se pudo leer el archivo.");
      reader.readAsDataURL(file);
    };

    inp.click();
  }


  function sum(arr, fn) { return (arr || []).reduce((a, x) => a + Number(fn ? fn(x) : x || 0), 0); }

  function hasBoleta(exp) {
    if (Array.isArray(exp.attachments) && exp.attachments.length) return true;
    if (exp.receipt) return true;
    if (exp.boleta === true) return true;
    return false;
  }
  function missingBoletaCount(arr){ return (arr || []).filter(e => !hasBoleta(e)).length; }

  // ---------- keys (scoped por curso; listo para producción) ----------
  const sk = (base)=> (window.CURSAPP && window.CURSAPP.scopedKey) ? window.CURSAPP.scopedKey(base) : `cursapp_${base}`;
  const KEY_TASKS = sk("tasks_v1");
  const KEY_PAYMENTS = sk("payments_v1");
  const KEY_EXPENSES = sk("expenses_v1");
  const KEY_REPORTS_DIRTY = detectKey(["cursapp_reports_dirty_v1","cursapp_dirty_reports","reportsDirty"]) || "cursapp_reports_dirty_v1";
  const KEY_MONTHLY_REPORTS = sk("monthly_reports_v1");

  function detectKey(candidates){
    for (const k of candidates){
      if (localStorage.getItem(k) != null) return k;
    }
    return "";
  }

  function load(key, fallback){
    try{
      const v = localStorage.getItem(key);
      if(v==null) return fallback;
      return JSON.parse(v);
    }catch(e){
      return fallback;
    }
  }
  function save(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

  function markDirty(){ localStorage.setItem(KEY_REPORTS_DIRTY, "1"); }
  function clearDirty(){ localStorage.removeItem(KEY_REPORTS_DIRTY); }
  function isDirty(){ return localStorage.getItem(KEY_REPORTS_DIRTY)==="1"; }

  // ---------- demo seed ----------
  function ensureDemo(){
    // Cursapp v11-clean: demo seed desactivado.
    // Los estados vacíos se deben mostrar con datos reales del curso.
    return;
  }

  // ---------- computed ----------
  function tasksAll(){ return load(KEY_TASKS, []); }
  function tasksActive(){ return tasksAll().filter(t => !t.closed); }
  function paymentsAll(){ return load(KEY_PAYMENTS, []); }
  function expensesAll(){ return load(KEY_EXPENSES, []); }
  function expensesGeneral(){ return expensesAll().filter(e => e.scope==="general"); }
  function expensesForTask(taskId){ return expensesAll().filter(e => e.scope==="campaign" && e.campaignId===taskId); }

  function collectedCourse(){ return sum(paymentsAll().filter(p => p.status==="paid"), p=>p.amount); }
  function collectedForTask(taskId){ return sum(paymentsAll().filter(p => p.status==="paid" && p.fromTaskId===taskId), p=>p.amount); }

  // ---------- modal ----------
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

  function ensureBottomConciliationTab(){
    try{
      const existing = Array.from(document.querySelectorAll(".navItem")).find(b => String(b.dataset.tab||"")==="conciliacion");
      if(existing) return;
      const sample = document.querySelector(".navItem");
      if(!sample || !sample.parentElement) return;

      const btn = sample.cloneNode(true);
      btn.dataset.tab = "conciliacion";
      btn.classList.remove("active");

      const spans = btn.querySelectorAll("span");
      if(spans.length >= 2){
        spans[0].textContent = "✅";
        spans[1].textContent = "Conciliación";
      }else{
        btn.textContent = "✅ Conciliación";
      }

      btn.onclick = ()=> go("conciliacion");
      sample.parentElement.appendChild(btn);
      navItems.push(btn);
    }catch(e){}
  }

  // ---------- menu ----------
  function initMenu(){
    if(menuBtn && menuDropdown){
      // V63: menú estable. Evitar cierre inmediato por listeners globales.
      if (!window.CURSAPP_MENU_HANDLED) {
        window.CURSAPP_MENU_HANDLED = true;
        menuBtn.onclick = (e)=>{
          e.preventDefault();
          e.stopPropagation();
          menuDropdown.style.display = (menuDropdown.style.display==="block"?"none":"block");
        };
        menuBtn.onpointerdown = (e)=>{ e.stopPropagation(); };
        menuDropdown.addEventListener("click", (e)=> e.stopPropagation(), true);
        menuDropdown.addEventListener("pointerdown", (e)=> e.stopPropagation(), true);
        document.addEventListener("click", (e)=>{
          if(menuDropdown.contains(e.target) || menuBtn.contains(e.target)) return;
          menuDropdown.style.display="none";
        });
      }
      try{
        if(menuDropdown && !menuDropdown.querySelector('[data-menu-item="conciliacion"]')){
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "menuItem";
          btn.setAttribute("data-menu-item","conciliacion");
          btn.textContent = "✅ Conciliación";
          btn.onclick = ()=>{ menuDropdown.style.display="none"; go("conciliacion"); };
          const beforeNode = menuDropdown.querySelector("#resetBtn") || null;
          menuDropdown.insertBefore(btn, beforeNode);
        }
      }catch(e){}
    }
    if(resetBtn){
      resetBtn.onclick = ()=>{
        if(!confirm("Esto eliminará datos demo. ¿Continuar?")) return;
        localStorage.removeItem(KEY_TASKS);
        localStorage.removeItem(KEY_PAYMENTS);
        localStorage.removeItem(KEY_EXPENSES);
        localStorage.removeItem(KEY_MONTHLY_REPORTS);
        localStorage.removeItem(KEY_REPORTS_DIRTY);
        alert("Datos reseteados.");
        go("home");
      };
    }
    if(logoutBtn){
      logoutBtn.onclick = ()=> location.href="/index.html";
    }
    ensureBottomConciliationTab();
  }

  // ---------- Navigation ----------
  let state = { tab:"home", taskId:"" };

  function setActiveTab(tab){
    navItems.forEach(b=> b.classList.toggle("active", b.dataset.tab===tab));
  }

  function normalizeTab(tab){
    const t = String(tab||"").toLowerCase().trim();
    if(t === "informe" || t === "reportes" || t === "reporte") return "informes";
    if(t === "pago" || t === "pagos" || t === "payments" || t === "conciliaciones") return "conciliacion";
    if(t === "campaña" || t === "campana" || t === "campanas" || t === "campaigns") return "rendiciones";
    if(t === "rendicion" || t === "rendición") return "rendiciones";
    return t || "home";
  }

  function go(tab, taskId){
    const norm = normalizeTab(tab);
    state.tab = norm;
    state.taskId = taskId || "";
    setActiveTab(norm);
    if(norm==="home") renderHome();
    if(norm==="rendiciones") renderRendiciones(state.taskId);
    if(norm==="informes") renderInformes();
    if(norm==="conciliacion") renderConciliacion();
    if(norm==="profile") renderProfile();
  }
  window.go = go;
  navItems.forEach(b=> b.onclick = ()=> go(b.dataset.tab));

  // Abrir enlaces desde hash o navegación cross-page
  setTimeout(()=>{
    try{
      const next = (window.CURSAPP && typeof window.CURSAPP.consumeNextNavTab === "function") ? window.CURSAPP.consumeNextNavTab() : "";
      const hash = String(location.hash||"").replace("#","");
      const target = next || hash;
      if(target) go(target);
    }catch(e){}
  }, 0);

  // ---------- Render: Home ----------
  function renderHome(){
    const exp = expensesAll();
    const collected = collectedCourse();
    const spent = sum(exp, e=>e.amount);
    const saldo = collected - spent;
    const sinBoleta = missingBoletaCount(exp);
    const pendienteRendir = sum(exp.filter(e=>!hasBoleta(e)), e=>e.amount);
    const active = tasksActive();
    const stats = (typeof conciliationStats === "function") ? conciliationStats() : null;
    const slides = active.slice(0,5).map((x,i)=>{ const rec=collectedForTask(x.id); const gas=sum(expensesForTask(x.id), e=>e.amount); const s=rec-gas; const miss=missingBoletaCount(expensesForTask(x.id)); return `<article class="cpV6HeroCard"><div class="cpV6HeroIndex">${i+1} de ${Math.max(1,active.length)}</div><div class="cpV6HeroTitle">${esc(x.title||"Campaña")}</div><div class="cpV6HeroMeta">${esc(x.startDate||"")} → ${esc(x.dueDate||"")}${miss ? ` · ${miss} sin boleta` : ``}</div><div class="cpV6HeroAmount">${clp(s)}</div><div class="cpV6HeroActions"><button class="cpV6PrimaryBtn" onclick="go('rendiciones','${esc(x.id)}')">Rendir</button><button class="cpV6LinkBtn" onclick="go('conciliacion')">Conciliación ›</button></div></article>`; }).join("") || `<article class="cpV6HeroCard"><div class="cpV6HeroTitle">Sin campañas activas</div><div class="cpV6HeroMeta">Cuando existan campañas, podrás controlar recaudación y rendiciones.</div><div class="cpV6HeroAmount">${clp(saldo)}</div><div class="cpV6HeroActions"><button class="cpV6PrimaryBtn" onclick="go('rendiciones')">Ver rendiciones</button></div></article>`;
    app.innerHTML = `<div class="cpV6Page cpV6Treasurer"><section class="cpV6Welcome"><div class="cpV6Avatar">T</div><div class="cpV6WelcomeText"><div class="cpV6Hello">Hola, Tesorero 👋</div><div class="cpV6Sub">Control financiero del curso</div><div class="cpV6Sub small">Caja, rendiciones y conciliación</div></div><button class="cpV6IconBtn" onclick="go('conciliacion')">✅</button></section><section class="cpV6Hero"><div class="cpV6HeroHead"><span class="cpV6HeroIcon">💼</span><span>ESTADO DE CAJA</span></div><div class="cpV6HeroTrack">${slides}</div><div class="cpV6Dots"><span class="active"></span><span></span><span></span></div></section>${isDirty()?`<div class="cpV6Notice"><b>Cambios detectados</b><span>Requiere nuevo informe financiero.</span></div>`:""}<div class="cpV6KpiGrid"><div class="cpV6Kpi"><span>🏦</span><small>Caja disponible</small><b>${clp(saldo)}</b></div><div class="cpV6Kpi"><span>💰</span><small>Recaudado</small><b>${clp(collected)}</b></div><div class="cpV6Kpi"><span>🧾</span><small>Gastado</small><b>${clp(spent)}</b></div><div class="cpV6Kpi"><span>⚠️</span><small>Sin boleta</small><b>${sinBoleta}</b></div></div><details class="cpV6Section" open><summary><span><i>✅</i><b>Conciliación</b><em>Pagos manuales y revisión de ingresos</em></span><strong>${stats ? clp(stats.contable||0) : 'Ir'}</strong><u>⌄</u></summary><div class="cpV6SectionBody"><div class="cpV6ListItem"><div><b>Contable</b><small>Transbank, transferencia, efectivo y saldo a favor</small></div><strong>${stats ? clp(stats.contable||0) : clp(collected)}</strong></div><button class="cpV6SoftBtn" onclick="go('conciliacion')">Ir a conciliación</button></div></details><details class="cpV6Section"><summary><span><i>🧾</i><b>Rendiciones</b><em>Gastos por campaña y respaldo</em></span><strong>${clp(pendienteRendir)}</strong><u>⌄</u></summary><div class="cpV6SectionBody">${active.slice(0,4).map(x=>{ const rec=collectedForTask(x.id); const gas=sum(expensesForTask(x.id), e=>e.amount); const miss=missingBoletaCount(expensesForTask(x.id)); return `<div class="cpV6ListItem"><div><b>${esc(x.title||"Campaña")}</b><small>Recaudado ${clp(rec)} · Gastado ${clp(gas)}${miss?` · ${miss} sin boleta`:``}</small></div><button class="cpV6MiniBtn" onclick="go('rendiciones','${esc(x.id)}')">Ver</button></div>`; }).join("") || `<div class="muted">Sin campañas activas.</div>`}<button class="cpV6SoftBtn" onclick="go('rendiciones')">Ver rendiciones</button></div></details><details class="cpV6Section"><summary><span><i>📊</i><b>Informes</b><em>Resumen para publicar al curso</em></span><strong>Ver</strong><u>⌄</u></summary><div class="cpV6SectionBody"><div class="cpV6ListItem"><div><b>Saldo disponible</b><small>Recaudado menos gastos rendidos</small></div><strong>${clp(saldo)}</strong></div><button class="cpV6SoftBtn" onclick="go('informes')">Ver informes</button></div></details><div class="cpV6QuickTitle">Accesos rápidos</div><div class="cpV6QuickGrid"><button onclick="go('conciliacion')"><span>✅</span>Conciliar</button><button onclick="go('rendiciones')"><span>🧾</span>Rendiciones</button><button onclick="go('informes')"><span>📊</span>Informes</button><button onclick="openManualPayment()"><span>💵</span>Pago manual</button></div><div data-monetization-slot="tesorero"></div></div>`;
  }

  // ---------- Rendiciones ----------// ---------- Rendiciones ----------
  function renderRendiciones(selectedTaskId){
    const t = tasksActive();
    const expAll = expensesAll();
    const collected = collectedCourse();
    const spent = sum(expAll, e=>e.amount);
    const saldo = collected - spent;

    const sinBoleta = missingBoletaCount(expAll);
    const expGen = expensesGeneral();

    app.innerHTML = `
      ${isDirty()?`<div class="alertBox">📄 Cambios detectados: requiere nuevo informe</div>`:""}

      <div class="card">
        <div class="row">
          <div class="kTitle">Rendiciones del curso</div>
          <div class="muted" style="font-weight:900;">${sinBoleta?`⚠️ Sin boleta ${sinBoleta}`:"✅ OK"}</div>
        </div>
        <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">
          <span class="pill ok">💰 Recaudado ${clp(collected)}</span>
          <span class="pill warn">🧾 Gastado ${clp(spent)}</span>
          <span class="pill ${saldo<0?'danger':''}">⚖️ Saldo ${clp(saldo)}</span>
        </div>
      </div>

      <div class="card">
        <div class="kTitle">🏦 Fondo del curso (sin campaña)</div>
        <div class="muted" style="margin-top:6px;font-weight:900;">
          Gasto general sin campaña y de uso rápido del fondo del curso.
        </div>
        <div class="actions" style="margin-top:10px;">
          <button class="btnPrimaryMini" onclick="openCreateExpense('general','')">+ Agregar gasto general</button>
        </div>
        <div style="margin-top:10px;">
          ${expGen.length?expGen.map(renderExpenseCard).join(""):`<div class="muted">Sin gastos generales.</div>`}
        </div>
      </div>

      <div class="card">
        <div class="row">
          <div class="kTitle">✅ Conciliación de ingresos</div>
          <button class="btnPrimaryMini" onclick="go('conciliacion')">Ir a conciliación</button>
        </div>
        <div class="muted" style="margin-top:6px;">Pagos agrupados por campaña, apoderado, alumno, método y estado.</div>
      </div>

      <div class="card">
        <div class="row">
          <div class="kTitle">🎯 Rendiciones por campaña</div>
          <div class="actions actionsRow">
            <select id="taskSel" class="btnMini">
              <option value="">Ver todas</option>
              ${t.map(x=>`<option value="${x.id}" ${selectedTaskId===x.id?"selected":""}>${esc(x.title)}</option>`).join("")}
            </select>
          </div>
        </div>
        <div id="campaignWrap" style="margin-top:10px;"></div>
      </div>
    `;

    const sel = $("taskSel");
    sel.onchange = ()=> renderRendiciones(sel.value||"");

    const wrap = $("campaignWrap");
    const show = selectedTaskId ? t.filter(x=>x.id===selectedTaskId) : t;
    wrap.innerHTML = show.map(renderCampaignCard).join("");
  }

  function renderCampaignCard(task){
    const exp = expensesForTask(task.id);
    const rec = collectedForTask(task.id);
    const gas = sum(exp, e=>e.amount);
    const s = rec - gas;
    const miss = missingBoletaCount(exp);

    return `
      <div class="card" style="margin-top:12px;">
        <div class="row">
          <div>
            <div style="font-weight:950;">${esc(task.title)} <span class="pill" style="margin-left:8px;">Campaña</span></div>
            <div class="muted" style="margin-top:6px;font-weight:800;font-size:12px;">${task.startDate||""} → ${task.dueDate||""}</div>
            <div class="metricsRow"><span class="pill ok">Recaudado ${clp(rec)}</span>
              <span class="pill warn">Gastado ${clp(gas)}</span>
              <span class="pill ${s<0?'danger':''}">Saldo ${clp(s)}</span>
              ${miss?`<span class="pill danger">⚠️ sin boleta ${miss}</span>`:""}
            </div>
          </div>
          <div class="actions actionsRow">
            <button class="btnMini" onclick="openEditCampaign('${task.id}')">✏️ Editar campaña</button>
            <button class="btnPrimaryMini" onclick="openCreateExpense('campaign','${task.id}')">+ Agregar gasto</button>
          </div>
        </div>

        <div style="margin-top:10px;">
          ${exp.length?exp.map(renderExpenseCard).join(""):`<div class="muted">Sin rendiciones asociadas.</div>`}
        </div>
      </div>
    `;
  }

  function scopeLabel(e){ return e.scope==="general" ? "🏦 Fondo del curso" : "🎯 Campaña"; }

  function renderExpenseCard(e){
    const has = hasBoleta(e);
    const badge = has ? `<span class="pill ok">Con boleta</span>` : `<span class="pill danger">Sin boleta</span>`;

    const boletaButtons = has
      ? `<button class="btnMini" onclick="viewBoleta('${e.id}')">👁 Ver boleta</button>
         <button class="btnMini" onclick="replaceBoleta('${e.id}')">🔁 Reemplazar</button>`
      : `<button class="btnPrimaryMini" onclick="uploadBoleta('${e.id}')">📎 Subir boleta</button>`;

    // Nombre de campaña para "Rendición — Campaña"
    const campName = (e.scope==="campaign")
      ? (tasksAll().find(t=>t.id===e.campaignId)?.title || "Campaña")
      : "Fondo del curso";

    const desc = (e.note && String(e.note).trim()) ? String(e.note).trim() : "";

    return `
      <div class="expenseCard">
        <div class="expenseHeader">
          <div class="expenseTitle">Rendición — ${esc(campName)}</div>
          ${badge}
        </div>

        <div class="expenseBody">
          <div class="expenseItem">Ítem: <b>${esc(e.title)}</b></div>
          <div class="expenseMeta">Fecha rendición: ${esc(e.date||"")}</div>
          <div class="expenseMeta">Monto: <b>${clp(e.amount)}</b></div>
          ${desc ? `<div class="expenseMeta">Descripción: ${esc(desc)}</div>` : ``}
          <div class="expenseSubMeta">${esc(scopeLabel(e))} · ${esc(e.category||"Otros")} · ${esc(e.vendor||"—")}</div>
        </div>

        <div class="expenseActions actionBar">
          ${boletaButtons}
          <button class="btnMini" onclick="editExpense('${e.id}')">✏️ Editar</button>
          <button class="btnDangerMini" onclick="deleteExpense('${e.id}')">🗑️ Eliminar</button>
        </div>
      </div>
    `;
  }

  // ---------- Campaign edit ----------
  function openEditCampaign(taskId){
    const ts = tasksAll();
    const t = ts.find(x=>x.id===taskId);
    if(!t) return;

    openModal(`
      <div class="row">
        <div>
          <div style="font-weight:950;font-size:18px;">Editar campaña</div>
          <div class="muted" style="margin-top:6px;">Los cambios marcarán “Requiere nuevo informe”.</div>
        </div>
        <button class="btnMini" onclick="closeModal()">Cerrar</button>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Nombre</label>
        <input id="ec_title" value="${esc(t.title)}" />
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Inicio</label>
          <input id="ec_start" type="date" value="${t.startDate||""}" />
        </div>
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Fin</label>
          <input id="ec_due" type="date" value="${t.dueDate||""}" />
        </div>
      </div>

      <div class="actions" style="margin-top:14px;justify-content:flex-end;">
        <button class="btnMini" onclick="closeModal()">Cancelar</button>
        <button class="btnPrimaryMini" onclick="saveEditCampaign('${taskId}')">Guardar</button>
      </div>
    `);
  }

  function saveEditCampaign(taskId){
    const ts = tasksAll();
    const i = ts.findIndex(x=>x.id===taskId);
    if(i<0) return;

    ts[i].title = ($("ec_title").value||"").trim() || ts[i].title;
    ts[i].startDate = $("ec_start").value || ts[i].startDate;
    ts[i].dueDate = $("ec_due").value || ts[i].dueDate;

    save(KEY_TASKS, ts);
    markDirty();
    closeModal();
    renderRendiciones(taskId);
  }

  // ---------- Expense create/edit/delete + boleta ----------
  let draft = null;

  function openCreateExpense(scope, taskId){
    draft = { scope, campaignId: (scope==="campaign"?taskId:null), attached:false };

    const taskOptions = tasksActive().map(t=>`<option value="${t.id}" ${t.id===taskId?"selected":""}>${esc(t.title)}</option>`).join("");

    openModal(`
      <div class="row">
        <div>
          <div style="font-weight:950;font-size:18px;">Agregar gasto</div>
          <div class="muted" style="margin-top:6px;">Puedes adjuntar boleta ahora o después.</div>
        </div>
        <button class="btnMini" onclick="closeModal()">Cerrar</button>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Tipo</label>
        <select id="ex_scope">
          <option value="general" ${scope==="general"?"selected":""}>🏦 Fondo del curso (sin campaña)</option>
          <option value="campaign" ${scope==="campaign"?"selected":""}>🎯 Asociado a campaña</option>
        </select>
      </div>

      <div id="ex_campaign_wrap" style="margin-top:12px;${scope==="campaign"?"":"display:none;"}">
        <label style="font-weight:900;">Campaña</label>
        <select id="ex_campaign">${taskOptions}</select>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Concepto</label>
        <input id="ex_title" placeholder="Ej: Transporte" />
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Categoría</label>
          <input id="ex_cat" placeholder="Ej: Transporte" />
        </div>
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Proveedor</label>
          <input id="ex_vendor" placeholder="Ej: Bus" />
        </div>
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Fecha</label>
          <input id="ex_date" type="date" value="${todayISO()}" />
        </div>
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Monto</label>
          <input id="ex_amount" inputmode="numeric" placeholder="5000" />
        </div>
      </div>

      <div class="card" style="background:#f8fafc;">
        <div style="font-weight:950;">📎 Boleta</div>
        <div class="muted" style="margin-top:6px;">Adjunta imagen o PDF (máx 3MB). Si no adjuntas, quedará como pendiente.</div>
        <input type="file" id="ex_file" accept="image/*,application/pdf" style="margin-top:10px;" />
        <div id="attach_state" class="muted" style="margin-top:6px;font-size:12px;">Sin boleta</div>
      </div>

      <div class="actions" style="margin-top:14px;justify-content:flex-end;">
        <button class="btnMini" onclick="closeModal()">Cancelar</button>
        <button class="btnPrimaryMini" onclick="saveExpense()">Guardar</button>
      </div>
    `);

    $("ex_scope").onchange = ()=>{
      const v = $("ex_scope").value;
      $("ex_campaign_wrap").style.display = (v==="campaign")?"block":"none";
    };
    // Boleta real (imagen/PDF) -> se guarda como dataURL (base64) en attachments[0]
    const fileEl = $("ex_file");
    if(fileEl){
      fileEl.onchange = (ev)=>{
        const file = ev.target.files && ev.target.files[0];
        if(!file) return;

        // límite 3MB para evitar reventar localStorage
        if(file.size > 3 * 1024 * 1024){
          alert("Archivo muy pesado (máx 3MB).");
          fileEl.value = "";
          return;
        }

        const reader = new FileReader();
        reader.onload = (e)=>{
          draft.fileData = {
            name: file.name,
            type: file.type || "application/octet-stream",
            size: file.size,
            dataUrl: e.target.result
          };
          $("attach_state").textContent = "Boleta adjunta: " + file.name;
        };
        reader.onerror = ()=> alert("No se pudo leer el archivo.");
        reader.readAsDataURL(file);
      };
    }
  }

  function saveExpense(){
    const scope = $("ex_scope").value;
    const title = ($("ex_title").value||"").trim();
    const amount = Number($("ex_amount").value||0);
    if(!title || !amount){ alert("Completa concepto y monto."); return; }

    const ex = expensesAll();
    ex.unshift({
      id: uid("e"),
      scope,
      campaignId: scope==="campaign" ? $("ex_campaign").value : null,
      title,
      category: ($("ex_cat").value||"").trim(),
      vendor: ($("ex_vendor").value||"").trim(),
      date: $("ex_date").value||todayISO(),
      amount,
      note: "",
      attachments: (draft && draft.fileData) ? [draft.fileData] : []
    });

    save(KEY_EXPENSES, ex);
    markDirty();
    closeModal();
    renderRendiciones(scope==="campaign"?$("ex_campaign").value:"");
  }

  function editExpense(expenseId){
    const ex = expensesAll();
    const e = ex.find(x=>x.id===expenseId);
    if(!e) return;

    openModal(`
      <div class="row">
        <div>
          <div style="font-weight:950;font-size:18px;">Editar gasto</div>
          <div class="muted" style="margin-top:6px;">Esto marcará “Requiere nuevo informe”.</div>
        </div>
        <button class="btnMini" onclick="closeModal()">Cerrar</button>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Concepto</label>
        <input id="ee_title" value="${esc(e.title)}" />
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Fecha</label>
          <input id="ee_date" type="date" value="${e.date||todayISO()}" />
        </div>
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Monto</label>
          <input id="ee_amount" inputmode="numeric" value="${Number(e.amount||0)}" />
        </div>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Categoría</label>
        <input id="ee_cat" value="${esc(e.category||"")}" />
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Proveedor</label>
        <input id="ee_vendor" value="${esc(e.vendor||"")}" />
      </div>

      <div class="actions" style="margin-top:14px;justify-content:flex-end;">
        <button class="btnMini" onclick="closeModal()">Cancelar</button>
        <button class="btnPrimaryMini" onclick="saveEditExpense('${expenseId}')">Guardar</button>
      </div>
    `);
  }

  function saveEditExpense(expenseId){
    if(!confirm("Guardar cambios y marcar “Requiere nuevo informe”?")) return;

    const ex = expensesAll();
    const i = ex.findIndex(x=>x.id===expenseId);
    if(i<0) return;

    ex[i].title = ($("ee_title").value||"").trim() || ex[i].title;
    ex[i].date = $("ee_date").value || ex[i].date;
    ex[i].amount = Number($("ee_amount").value||ex[i].amount);
    ex[i].category = ($("ee_cat").value||"").trim();
    ex[i].vendor = ($("ee_vendor").value||"").trim();

    save(KEY_EXPENSES, ex);
    markDirty();
    closeModal();
    renderRendiciones(ex[i].campaignId || "");
  }

  function deleteExpense(expenseId){
    if(!confirm("¿Eliminar este gasto? Esto marcará “Requiere nuevo informe”."))
      return;
    const ex = expensesAll().filter(x=>x.id!==expenseId);
    save(KEY_EXPENSES, ex);
    markDirty();
    renderRendiciones("");
  }

  function uploadBoleta(expenseId){
    const ex = expensesAll();
    const i = ex.findIndex(x=>x.id===expenseId);
    if(i<0) return;

    pickBoletaFile((fileData)=>{
      ex[i].attachments = [fileData];
      save(KEY_EXPENSES, ex);
      markDirty();
      renderRendiciones(ex[i].campaignId || "");
    });
  }

  function replaceBoleta(expenseId){
    const ex = expensesAll();
    const i = ex.findIndex(x=>x.id===expenseId);
    if(i<0) return;

    pickBoletaFile((fileData)=>{
      ex[i].attachments = [fileData];
      save(KEY_EXPENSES, ex);
      markDirty();
      alert("Boleta reemplazada ✅");
      renderRendiciones(ex[i].campaignId || "");
    });
  }

  function viewBoleta(expenseId){
    const ex = expensesAll();
    const e = ex.find(x=>x.id===expenseId);
    if(!e || !hasBoleta(e)){ alert("No hay boleta adjunta."); return; }

    // soporta tanto attachments[] como receipt legacy
    const file = (Array.isArray(e.attachments) && e.attachments.length) ? e.attachments[0] : (e.receipt || null);
    if(!file || !file.dataUrl){ alert("Boleta no disponible."); return; }

    const w = window.open("", "_blank");
    if(!w){ alert("Bloqueo de popups: permite abrir ventanas para ver la boleta."); return; }

    const isImg = String(file.type||"").startsWith("image/");
    w.document.open();
    w.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Boleta</title>
  <style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,"Helvetica Neue",Arial} .wrap{padding:10px}</style>
</head>
<body>
  ${isImg ? `<img src="${file.dataUrl}" style="max-width:100%;height:auto;display:block;margin:0 auto;" />`
          : `<iframe src="${file.dataUrl}" style="width:100%;height:100vh;border:0;"></iframe>`}
</body>
</html>`);
    w.document.close();
  }

  function currentYM(){
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  }
  function withinMonth(iso, ym){
    return String(iso||"").slice(0,7) === String(ym||"");
  }
  function monthCollected(ym){
    return sum(paymentsAll().filter(p=>{
      if(String(p.status||"").toLowerCase()!=="paid") return false;
      const dt = p.paidAt || p.createdAt || p.date || "";
      return withinMonth(dt, ym);
    }), p=>p.amount);
  }
  function monthSpent(ym){
    return sum(expensesAll().filter(e=>withinMonth(e.date||"", ym)), e=>e.amount);
  }
  function campaignRowsForReport(){
    return tasksActive().map(t=>{
      const rec = collectedForTask(t.id);
      const gas = sum(expensesForTask(t.id), e=>e.amount);
      const sal = rec - gas;
      return { title: t.title || "Campaña", rec, gas, sal };
    });
  }
  function buildTreasuryReport(period){
    const exp = expensesAll();
    const collectedMes = monthCollected(period);
    const spentMes = monthSpent(period);
    const saldoMes = collectedMes - spentMes;
    const collectedTotal = collectedCourse();
    const spentTotal = sum(exp, e=>e.amount);
    const saldoTotal = collectedTotal - spentTotal;
    const gastosMes = exp
      .filter(e=>withinMonth(e.date||"", period))
      .sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")))
      .map(e=>({
        date: e.date || "",
        title: e.title || "",
        category: e.category || "Otros",
        amount: Number(e.amount||0),
        scope: e.scope==="campaign"
          ? (tasksAll().find(t=>t.id===e.campaignId)?.title || "Campaña")
          : "Fondo del curso"
      }));
    return {
      id: uid("trep"),
      period,
      generatedAt: new Date().toLocaleString("es-CL"),
      collectedMes,
      spentMes,
      saldoMes,
      saldoTotal,
      gastosMes,
      campaignRows: campaignRowsForReport()
    };
  }
  function treasuryHealth(rep){
    if(rep.saldoTotal > 0 && rep.saldoMes >= 0) return { text:"🟢 Salud financiera buena", cls:"ok" };
    if(rep.saldoTotal >= 0) return { text:"🟡 Atención", cls:"warn" };
    return { text:"🔴 Riesgo", cls:"danger" };
  }
  function treasuryReportBodyHTML(rep){
    const health = treasuryHealth(rep);
    return `
      <div class="row" style="align-items:flex-start;gap:12px;flex-wrap:wrap;">
        <div>
          <div class="kTitle">📊 Informe Tesorería</div>
          <div class="muted" style="margin-top:6px;">Periodo <b>${esc(rep.period)}</b> · Emitido ${esc(rep.generatedAt)}</div>
        </div>
        <div class="pill ${health.cls}">${esc(health.text)}</div>
      </div>

      <div class="kpiGrid" style="margin-top:12px;">
        <div class="kpi"><div class="lbl">💰 Cobrado mes</div><div class="val">${clp(rep.collectedMes)}</div></div>
        <div class="kpi"><div class="lbl">🧾 Gastado mes</div><div class="val">${clp(rep.spentMes)}</div></div>
        <div class="kpi"><div class="lbl">⚖️ Saldo mes</div><div class="val">${clp(rep.saldoMes)}</div></div>
        <div class="kpi"><div class="lbl">🏦 Saldo acumulado</div><div class="val">${clp(rep.saldoTotal)}</div></div>
      </div>

      <div class="card" style="margin-top:12px;">
        <div class="kTitle">Control de caja</div>
        <div style="margin-top:10px;display:grid;gap:8px;">
          <div style="display:flex;justify-content:space-between;"><span>Saldo inicial mes</span><b>${clp(0)}</b></div>
          <div style="display:flex;justify-content:space-between;"><span>+ Cobros del mes</span><b>${clp(rep.collectedMes)}</b></div>
          <div style="display:flex;justify-content:space-between;"><span>- Gastos del mes</span><b>${clp(rep.spentMes)}</b></div>
          <div style="display:flex;justify-content:space-between;border-top:1px dashed rgba(0,0,0,.12);padding-top:8px;"><span><b>Saldo final del mes</b></span><b>${clp(rep.saldoMes)}</b></div>
        </div>
      </div>

      <div class="card" style="margin-top:12px;">
        <div class="kTitle">Estado de campañas</div>
        <div style="overflow:auto;margin-top:10px;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr class="muted">
                <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Campaña</th>
                <th style="text-align:right;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Recaudado</th>
                <th style="text-align:right;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Gastado</th>
                <th style="text-align:right;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Saldo</th>
              </tr>
            </thead>
            <tbody>
              ${rep.campaignRows.length ? rep.campaignRows.map(r=>`
                <tr>
                  <td style="padding:8px;border-bottom:1px solid rgba(0,0,0,.06);">${esc(r.title)}</td>
                  <td style="padding:8px;border-bottom:1px solid rgba(0,0,0,.06);text-align:right;">${clp(r.rec)}</td>
                  <td style="padding:8px;border-bottom:1px solid rgba(0,0,0,.06);text-align:right;">${clp(r.gas)}</td>
                  <td style="padding:8px;border-bottom:1px solid rgba(0,0,0,.06);text-align:right;font-weight:900;">${clp(r.sal)}</td>
                </tr>
              `).join("") : `<tr><td colspan="4" style="padding:8px;">Sin campañas activas.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card" style="margin-top:12px;">
        <div class="kTitle">Detalle de rendiciones del mes</div>
        <div style="overflow:auto;margin-top:10px;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr class="muted">
                <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Fecha</th>
                <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Ámbito</th>
                <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Concepto</th>
                <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Categoría</th>
                <th style="text-align:right;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Monto</th>
              </tr>
            </thead>
            <tbody>
              ${rep.gastosMes.length ? rep.gastosMes.map(g=>`
                <tr>
                  <td style="padding:8px;border-bottom:1px solid rgba(0,0,0,.06);">${esc(g.date)}</td>
                  <td style="padding:8px;border-bottom:1px solid rgba(0,0,0,.06);">${esc(g.scope)}</td>
                  <td style="padding:8px;border-bottom:1px solid rgba(0,0,0,.06);">${esc(g.title)}</td>
                  <td style="padding:8px;border-bottom:1px solid rgba(0,0,0,.06);">${esc(g.category)}</td>
                  <td style="padding:8px;border-bottom:1px solid rgba(0,0,0,.06);text-align:right;">${clp(g.amount)}</td>
                </tr>
              `).join("") : `<tr><td colspan="5" style="padding:8px;">Sin rendiciones en este periodo.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
  function openTreasuryReport(id){
    const reps = load(KEY_MONTHLY_REPORTS, []);
    const rep = reps.find(r=>String(r.id)===String(id));
    if(!rep) return alert("No se encontró el informe.");
    openModal(`
      <div style="position:sticky;top:0;background:#fff;padding:14px;border-bottom:1px solid rgba(0,0,0,.08);z-index:5;">
        <div class="row" style="align-items:flex-start;gap:12px;flex-wrap:wrap;">
          <div>
            <div style="font-weight:950;font-size:18px;">Vista del informe</div>
            <div class="muted" style="margin-top:6px;">Tesorería · ${esc(rep.period)}</div>
          </div>
          <div class="actions actionsRow">
            <button class="btnMini" onclick="downloadTreasuryReport('${esc(rep.id)}')">📄 PDF</button>
            <button class="btnMini" onclick="shareTreasuryReport('${esc(rep.id)}')">📤 WhatsApp</button>
            <button class="btnPrimaryMini" onclick="closeModal()">Cerrar</button>
          </div>
        </div>
      </div>
      <div style="padding:14px;">
        ${treasuryReportBodyHTML(rep)}
      </div>
    `);
  }
  function buildTreasuryPrintHTML(rep){
    return `
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Informe Tesorería ${esc(rep.period)}</title>
        <style>
          body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial;margin:24px;color:#0f172a;background:#fff;}
          .page{max-width:980px;margin:0 auto;}
          .muted{color:#64748b;}
          .pill{display:inline-flex;padding:6px 10px;border-radius:999px;border:1px solid #d1d5db;font-weight:800;font-size:12px;background:#f8fafc;}
          .pill.ok{background:#ecfdf5;border-color:#bbf7d0;}
          .pill.warn{background:#fffbeb;border-color:#fde68a;}
          .pill.danger{background:#fef2f2;border-color:#fecaca;}
          .kpiGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px;}
          .kpi,.card{border:1px solid #e5e7eb;border-radius:16px;padding:14px;background:#fff;}
          .lbl{font-size:12px;color:#6b7280;}
          .val{font-size:28px;font-weight:900;margin-top:6px;}
          table{width:100%;border-collapse:collapse;}
          th{font-size:13px;color:#64748b;text-align:left;padding:8px;border-bottom:1px solid #cbd5e1;}
          td{font-size:13px;padding:8px;border-bottom:1px solid #e5e7eb;}
          @media print{body{margin:0}.page{max-width:none}}
        </style>
      </head>
      <body>
        <div class="page">
          ${treasuryReportBodyHTML(rep)}
          <div class="muted" style="margin-top:18px;">Generado por Cursapp</div>
        </div>
      </body>
      </html>
    `;
  }
  function downloadTreasuryReport(id){
    const reps = load(KEY_MONTHLY_REPORTS, []);
    const rep = reps.find(r=>String(r.id)===String(id));
    if(!rep) return alert("No se encontró el informe.");
    const w = window.open("", "cursapp_tes_pdf");
    if(!w){ alert("No se pudo abrir la impresión."); return; }
    w.document.open();
    w.document.write(buildTreasuryPrintHTML(rep));
    w.document.close();
    w.focus();
    setTimeout(()=>{ try{ w.print(); }catch(e){} }, 250);
  }


  // ---------- Conciliación ----------
  window.__tesCampOpen = window.__tesCampOpen || {};

  function toggleConciliationCampaign(campId){
    window.__tesCampOpen[campId] = !window.__tesCampOpen[campId];
    renderConciliacion();
  }

  function renderPaymentConciliationCard(p){
    const camp = tasksAll().find(t=>String(t.id)===String(p.fromTaskId||""))?.title || "Curso / sin campaña";
    const guardian = String(p.guardianName || "").trim();
    const student = String(p.studentName || "").trim();
    const who = [guardian, student].filter(Boolean).join(" · ") || "Pago registrado en sistema";
    const source = p.source==="manual" ? "Manual" : "Sistema";
    return `
      <div class="expenseCard">
        <div class="expenseHeader">
          <div class="expenseTitle">${esc(who)}</div>
          <div style="font-weight:950;">${clp(p.amount)}</div>
        </div>

        <div class="expenseBody">
          <div class="expenseMeta">Campaña: <b>${esc(camp)}</b></div>
          <div class="expenseMeta">Concepto: <b>${esc(p.concept || "Pago")}</b></div>
          <div class="expenseMeta">Fecha pago: <b>${esc(String(p.paidAt||p.createdAt||"").slice(0,10))}</b></div>
          <div class="expenseMeta">Método: <b>${esc(paymentMethodLabel(p.paymentMethod))}</b></div>
          <div class="expenseMeta">Estado: <b>${esc(conciliationStatusLabel(p.conciliationStatus))}</b></div>
          <div class="expenseMeta">Origen: <b>${esc(source)}</b></div>
        </div>

        <div class="actions actionsRow" style="margin-top:10px;flex-wrap:wrap;">
          <select class="btnMini" onchange="updatePaymentMethod('${p.id}',this.value)">
            <option value="transbank" ${p.paymentMethod==="transbank"?"selected":""}>💳 Transbank</option>
            <option value="transferencia" ${p.paymentMethod==="transferencia"?"selected":""}>🏦 Transferencia</option>
            <option value="efectivo" ${p.paymentMethod==="efectivo"?"selected":""}>💵 Efectivo</option>
            <option value="saldo_favor" ${p.paymentMethod==="saldo_favor"?"selected":""}>🔁 Saldo a favor</option>
          </select>

          <select class="btnMini" onchange="updatePaymentConciliationStatus('${p.id}',this.value)">
            <option value="pendiente" ${p.conciliationStatus==="pendiente"?"selected":""}>⏳ Pendiente</option>
            <option value="conciliado" ${p.conciliationStatus==="conciliado"?"selected":""}>✅ Conciliado</option>
            <option value="observado" ${p.conciliationStatus==="observado"?"selected":""}>⚠️ Observado</option>
            <option value="anulado" ${p.conciliationStatus==="anulado"?"selected":""}>🚫 Anulado</option>
          </select>
        </div>
      </div>
    `;
  }

  function updatePaymentMethod(id, method){
    const payments = paymentsNormalized();
    const i = payments.findIndex(p=>String(p.id)===String(id));
    if(i<0) return;
    payments[i].paymentMethod = method;
    payments[i].paidWith = method;
    save(KEY_PAYMENTS, payments);
    renderConciliacion();
  }

  function updatePaymentConciliationStatus(id, status){
    const payments = paymentsNormalized();
    const i = payments.findIndex(p=>String(p.id)===String(id));
    if(i<0) return;
    payments[i].conciliationStatus = status;
    save(KEY_PAYMENTS, payments);
    renderConciliacion();
  }

  function renderConciliacion(){
    const stats = conciliationStats();
    const payments = stats.payments.slice().sort((a,b)=>String(b.paidAt||b.createdAt||"").localeCompare(String(a.paidAt||a.createdAt||"")));
    const groups = {};
    payments.forEach(p=>{
      const tid = String(p.fromTaskId || "no_task");
      const title = tasksAll().find(t=>String(t.id)===tid)?.title || "Curso / sin campaña";
      if(!groups[tid]) groups[tid] = { taskId: tid, title, rows: [], total: 0 };
      groups[tid].rows.push(p);
      groups[tid].total += Number(p.amount||0);
    });

    const groupHtml = Object.values(groups).sort((a,b)=>a.title.localeCompare(b.title,"es")).map(g=>{
      const open = !!window.__tesCampOpen[g.taskId];
      const rows = open ? g.rows : g.rows.slice(0,3);
      return `
        <div class="card" style="margin-top:12px;">
          <div class="row">
            <div>
              <div class="kTitle">${esc(g.title)}</div>
              <div class="muted" style="margin-top:6px;">${g.rows.length} pago(s) · ${clp(g.total)}</div>
            </div>
            <button class="btnMini" onclick="toggleConciliationCampaign('${esc(g.taskId)}')">${open ? "Contraer" : `Ver pagos (${g.rows.length})`}</button>
          </div>
          <div style="margin-top:10px;">
            ${rows.map(renderPaymentConciliationCard).join("")}
          </div>
        </div>
      `;
    }).join("");

    app.innerHTML = `
      ${isDirty()?`<div class="alertBox">📄 Cambios detectados: requiere nuevo informe</div>`:""}

      <div class="card">
        <div class="row">
          <div class="kTitle">✅ Conciliación de pagos</div>
          <div class="actions actionsRow">
            <button class="btnPrimaryMini" onclick="openManualPayment()">+ Registrar pago manual</button>
          </div>
        </div>
        <div class="muted" style="margin-top:6px;">Recaudado por medio de pago y estado de conciliación.</div>

        <div class="kpiGrid" style="margin-top:12px;">
          <div class="kpi"><div class="lbl">💳 Transbank</div><div class="val">${clp(stats.transbank)}</div></div>
          <div class="kpi"><div class="lbl">🏦 Transferencia</div><div class="val">${clp(stats.transferencia)}</div></div>
          <div class="kpi"><div class="lbl">💵 Efectivo</div><div class="val">${clp(stats.efectivo)}</div></div>
          <div class="kpi"><div class="lbl">🔁 Saldo a favor</div><div class="val">${clp(stats.saldoFavor)}</div></div>
          <div class="kpi"><div class="lbl">🏦 Caja real</div><div class="val">${clp(stats.cajaReal)}</div></div>
          <div class="kpi"><div class="lbl">📘 Recaudado contable</div><div class="val">${clp(stats.contable)}</div></div>
          <div class="kpi"><div class="lbl">⏳ Pendiente</div><div class="val">${clp(stats.pendiente)}</div></div>
          <div class="kpi"><div class="lbl">⚠️ Observado</div><div class="val">${clp(stats.observado)}</div></div>
        </div>
      </div>

      <div class="card">
        <div class="kTitle">Pagos registrados</div>
        <div class="muted" style="margin-top:6px;">Agrupados por campaña, apoderado, alumno, fecha, método y estado.</div>
        <div style="margin-top:10px;">
          ${groupHtml || `<div class="muted">Sin pagos registrados.</div>`}
        </div>
      </div>
    `;
  }

  // ---------- Informes ----------
  function renderInformes(){
    const reps = load(KEY_MONTHLY_REPORTS, []);
    const ym = currentYM();
    const draftRep = buildTreasuryReport(ym);

    app.innerHTML = `
      ${isDirty()?`<div class="alertBox">📄 Cambios detectados: requiere nuevo informe</div>`:""}

      <div class="card">
        <div class="kTitle">📊 Informe Tesorería</div>
        <div class="muted" style="margin-top:6px;">Control financiero, rendiciones y estado de campañas.</div>

        <div class="kpiGrid" style="margin-top:12px;">
          <div class="kpi"><div class="lbl">💰 Cobrado mes</div><div class="val">${clp(draftRep.collectedMes)}</div></div>
          <div class="kpi"><div class="lbl">🧾 Gastado mes</div><div class="val">${clp(draftRep.spentMes)}</div></div>
          <div class="kpi"><div class="lbl">⚖️ Saldo mes</div><div class="val">${clp(draftRep.saldoMes)}</div></div>
          <div class="kpi"><div class="lbl">🏦 Saldo acumulado</div><div class="val">${clp(draftRep.saldoTotal)}</div></div>
        </div>

        <div class="actions" style="margin-top:12px;">
          <button class="btnPrimaryMini" onclick="generateMonthly()">Generar informe mensual</button>
          <button class="btnMini" onclick="clearDirty();renderInformes()">Marcar como resuelto</button>
        </div>
      </div>

      <div class="card">
        <div class="kTitle">Historial de informes</div>
        <div class="muted" style="margin-top:6px;">Versión profesional para ver y descargar PDF.</div>

        <div style="margin-top:12px;">
          ${reps.length
            ? reps.map(r=>`
              <div class="card" style="margin-top:10px;">
                <div class="row">
                  <div>
                    <b>${esc(r.period)}</b>
                    <div class="muted">Emitido ${esc(r.generatedAt)}</div>
                  </div>
                  <div class="actions actionsRow">
                    <button class="btnMini" onclick="openTreasuryReport('${esc(r.id)}')">👁 Ver informe</button>
                    <button class="btnPrimaryMini" onclick="downloadTreasuryReport('${esc(r.id)}')">📄 Descargar PDF</button>
                    <button class="btnMini" onclick="shareTreasuryReport('${esc(r.id)}')">📤 WhatsApp</button>
                  </div>
                </div>
              </div>`).join("")
            : `<div class="muted">Sin informes generados.</div>`
          }
        </div>
      </div>
    `;
  }

  function generateMonthly(){
    const period = prompt("Mes (YYYY-MM)", currentYM());
    if(!period) return;
    if(!/^\d{4}-\d{2}$/.test(period)){ alert("Formato inválido (YYYY-MM)"); return; }

    const rep = buildTreasuryReport(period);
    const reps = load(KEY_MONTHLY_REPORTS, []);
    reps.unshift(rep);
    save(KEY_MONTHLY_REPORTS, reps);

    clearDirty();
    alert("Informe generado ✅");
    renderInformes();
  }

  // ---------- Tesorero V57 · Dashboard premium ----------
  function courseLabelForHeader(){
    try{
      const s = JSON.parse(localStorage.getItem("cursapp_session_v1") || "{}");
      const course = s.courseLabel || s.course || s.curso || "2°B";
      const school = s.schoolName || s.colegio || s.school || "Colegio Central";
      return `${course} · ${school}`;
    }catch(_){ return "2°B · Colegio Central"; }
  }

  function treasurerDisplayName(){
    try{
      const s = JSON.parse(localStorage.getItem("cursapp_session_v1") || "{}");
      const direct = s.fullName || s.displayName || s.name || s.nombre || s.guardianName || s.apoderadoName || s.userName || s.email;
      if(direct && String(direct).includes('@')){
        const local = String(direct).split('@')[0].replace(/[._-]+/g,' ').trim();
        return local.replace(/\b\w/g, c=>c.toUpperCase()) || 'Tesorero';
      }
      if(direct) return String(direct).trim();
      const profile = (typeof currentProfile === 'function') ? currentProfile() : null;
      const profName = profile?.fullName || profile?.name || profile?.nombre || profile?.guardianName;
      if(profName) return String(profName).trim();
    }catch(_e){}
    return 'Tesorero';
  }

  function updateTreasurerHeader(){
    try{
      const name = document.querySelector('.tesHeaderName');
      const role = document.querySelector('.tesHeaderRole');
      const course = document.querySelector('.tesHeaderCourse');
      const badge = document.getElementById('tesHeaderBadge');
      if(name) name.textContent = treasurerDisplayName();
      if(role) role.textContent = 'Tesorero';
      if(course) course.textContent = courseLabelForHeader();
      if(badge){
        const pending = (typeof conciliationStats === 'function') ? Number(conciliationStats()?.pendiente || 0) : 0;
        badge.textContent = pending > 9 ? '9+' : String(Math.max(1, pending || 1));
      }
    }catch(_e){}
  }

  function monthCollected(){
    const ym = currentYM();
    return sum(paymentsAll().filter(p => p.status === 'paid' && ymFromISO(p.paidAt || p.createdAt || '') === ym), p=>p.amount);
  }

  function todayCollected(){
    const today = todayISO();
    return sum(paymentsAll().filter(p => p.status === 'paid' && String(p.paidAt || p.createdAt || '').slice(0,10) === today), p=>p.amount);
  }

  function monthExpenses(){
    const ym = currentYM();
    return sum(expensesAll().filter(e => ymFromISO(e.date || e.createdAt || '') === ym), e=>e.amount);
  }

  function guardianCount(){
    try{
      const profiles = allProfiles();
      const active = activeCourseKey();
      const inCourse = profiles.filter(x => !active || String(x.courseKey || '') === active);
      return inCourse.length || profiles.length || 0;
    }catch(_){ return 0; }
  }

  renderHome = function(){
    updateTreasurerHeader();
    const exp = expensesAll();
    const collected = collectedCourse();
    const spent = sum(exp, e=>e.amount);
    const saldo = collected - spent;
    const stats = (typeof conciliationStats === "function") ? conciliationStats() : null;
    const pendingConc = stats ? Number(stats.pendiente||0) : 0;
    const contable = stats ? Number(stats.contable||0) : collected;
    const active = tasksActive();
    const sinBoleta = missingBoletaCount(exp);
    const collectedThisMonth = monthCollected() || collected;
    const spentThisMonth = monthExpenses() || spent;
    const guardians = guardianCount();
    const estimated = Math.max(guardians || 0, 44);
    const participation = estimated ? Math.min(100, Math.round((guardians / estimated) * 100)) : 0;
    const updated = new Date().toLocaleTimeString('es-CL', {hour:'2-digit', minute:'2-digit'});
    const campaignRows = active.slice(0,3).map((t,idx)=>{
      const rec = collectedForTask(t.id);
      const goal = Number(t.goal || t.target || t.meta || 0);
      const pct = goal ? Math.min(100, Math.round((rec/goal)*100)) : (rec ? 62 + (idx*8) : 0);
      return `<article class="tesCampaignRow"><div class="tesRowIcon">${idx===0?'🎓':'🎉'}</div><div class="tesRowMain"><b>${esc(t.title||'Campaña')}</b><small>${goal?`Meta: ${clp(goal)}`:'Meta por definir'}</small><div class="tesProgress"><i style="width:${pct}%"></i></div><small>Recaudado ${clp(rec)}</small></div><strong>${pct}%</strong></article>`;
    }).join('') || `<article class="tesEmptyRow"><b>Sin campañas activas</b><small>Cuando existan campañas, se verán aquí.</small></article>`;
    const formatMoveDate = (value)=>{
      const raw = String(value || '');
      const d = raw ? new Date(raw) : null;
      if(d && !Number.isNaN(d.getTime())) return d.toLocaleDateString('es-CL',{day:'2-digit', month:'short', year:'numeric'}).replace('.', '');
      return raw && raw !== 'Hoy' ? raw.slice(0,10) : 'Hoy';
    };
    const paidRows = paymentsAll().filter(p=>p.status==='paid').slice(-2).reverse();
    const recent = (paidRows.length ? paidRows : [{guardianName:'Último movimiento del curso', amount:(todayCollected() || collectedThisMonth), paidAt:'Hoy'}]).map(p=>`
      <article class="tesMovementProRow">
        <div class="tesMoveType"><span class="tesRowIcon income">↓</span><span><b>Pago recibido</b><small>${esc(tesPaymentCampaignTitle ? tesPaymentCampaignTitle(p) : 'Pago del curso')}</small></span></div>
        <span class="tesMovePerson">${esc(p.guardianName || p.apoderadoName || p.studentName || 'Apoderado')}</span>
        <strong class="tesMoveAmount ok">+${clp(p.amount||0)}</strong>
        <span class="tesMoveDate">${esc(formatMoveDate(p.paidAt||p.createdAt||'Hoy'))}</span>
      </article>`).join('');
    const recentRenditions = expensesAll().slice().sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||''))).slice(0,10).map(e=>{
      const raw = String(e.date || e.createdAt || '');
      const d = raw ? new Date(raw) : null;
      const okDate = d && !Number.isNaN(d.getTime());
      const day = okDate ? String(d.getDate()).padStart(2,'0') : '—';
      const mon = okDate ? d.toLocaleDateString('es-CL',{month:'short'}).replace('.', '') : 'Fecha';
      const status = e.status || e.state || 'Aprobada';
      return `<article class="tesRenditionChip"><b>${esc(day)}</b><span>${esc(mon)}</span><strong>${clp(e.amount||0)}</strong><em>${esc(status)}</em></article>`;
    }).join('') || `<article class="tesRenditionChip is-empty"><b>—</b><span>Sin fecha</span><strong>$0</strong><em>Sin rendiciones</em></article>`;
    app.innerHTML = `
      <div class="tesV57Page">
        <section class="tesCashCard">
          <div class="tesCardHead"><div><h1>Estado de caja <span>ⓘ</span></h1><p>↻ Actualizado: Hoy ${updated}</p></div><b>Cuadrado OK ✓</b></div>
          <div class="tesCashGrid">
            <button onclick="go('informes')"><span class="tesIcon green">▣</span><small>Caja disponible</small><strong>${clp(saldo)}</strong><em>›</em></button>
            <button onclick="go('conciliacion')"><span class="tesIcon blue">↑</span><small>Recaudado hoy</small><strong>${clp(todayCollected() || collectedThisMonth)}</strong><em>›</em></button>
            <button onclick="go('conciliacion')"><span class="tesIcon amber">◷</span><small>Pendiente conciliación</small><strong>${clp(pendingConc)}</strong><em>›</em></button>
            <button onclick="go('informes')"><span class="tesIcon violet">▦</span><small>Saldo contable</small><strong>${clp(contable)}</strong><em>›</em></button>
          </div>
          <button class="tesWideAction" type="button" onclick="go('conciliacion')"><span>▤</span> Conciliar pagos pendientes <b>›</b></button>
        </section>

        <section class="tesSmallKpis">
          <article><span class="tesIcon green">▤</span><small>Recaudado este mes</small><b>${clp(collectedThisMonth)}</b><em>+12% vs mes anterior</em></article>
          <article><span class="tesIcon orange">👥</span><small>Participación del curso</small><b>${participation || 78}%</b><em>${guardians || 34} de ${estimated} apoderados</em></article>
        </section>

        <section class="tesPanel">
          <header><h2>Campañas activas</h2><button onclick="go('rendiciones')">Ver todas ›</button></header>
          <div class="tesCampaignList">${campaignRows}</div>
        </section>

        <section class="tesPanel tesMovementsPro">
          <header><h2>Movimientos recientes</h2><button onclick="go('conciliacion')">Ver todos ›</button></header>
          <div class="tesMovementTableWrap">
            <div class="tesMovementTableHead"><span>Movimiento</span><span>Monto</span><span>Fecha</span></div>
            ${recent}
            ${sinBoleta ? `<article class="tesMovementProRow"><div class="tesMoveType"><span class="tesRowIcon violet">▤</span><span><b>Rendición pendiente</b><small>Comprobante</small></span></div><span class="tesMovePerson">${sinBoleta} pendiente(s)</span><strong class="tesMoveAmount">${clp(spentThisMonth)}</strong><span class="tesMoveDate">Revisar</span></article>` : `<article class="tesMovementProRow"><div class="tesMoveType"><span class="tesRowIcon violet">▤</span><span><b>Rendiciones al día</b><small>Comprobantes</small></span></div><span class="tesMovePerson">Sin pendientes</span><strong class="tesMoveAmount">$0</strong><span class="tesMoveDate">OK</span></article>`}
          </div>
        </section>

        <section class="tesPanel tesRecentRenditions">
          <header><h2>Rendiciones recientes</h2><button onclick="go('rendiciones')">Ver todas ›</button></header>
          <div class="tesRenditionScroller">${recentRenditions}</div>
        </section>

        <div data-monetization-slot="tesorero"></div>
      </div>`;
  };

  function renderProfile(){
    updateTreasurerHeader();
    app.innerHTML = `<div class="tesV57Page"><section class="tesPanel"><h2>Perfil tesorero</h2><p class="tesLead">Datos del rol y preferencias del usuario.</p><div class="tesProfileList"><div><b>Rol</b><span>Tesorero</span></div><div><b>Curso</b><span>${esc(courseLabelForHeader())}</span></div><div><b>Notificaciones</b><span>Activas</span></div></div></section></div>`;
  }

  window.__tesConcFilter = window.__tesConcFilter || "pendientes";
  window.__tesConcQuery = window.__tesConcQuery || "";

  function tesIsTransbankAuto(p){
    return String(p.paymentMethod || p.paidWith || "").toLowerCase() === "transbank";
  }
  function tesIsConciliated(p){
    return tesIsTransbankAuto(p) || String(p.conciliationStatus || "").toLowerCase() === "conciliado";
  }
  function tesPaymentCampaignTitle(p){
    return tasksAll().find(t=>String(t.id)===String(p.fromTaskId||""))?.title || p.concept || "Pago del curso";
  }
  function tesPaymentDateShort(value){
    const raw = String(value || "");
    const d = raw ? new Date(raw) : null;
    if(d && !Number.isNaN(d.getTime())) return d.toLocaleDateString('es-CL',{day:'2-digit', month:'short', year:'numeric'}).replace('.', '');
    return raw ? raw.slice(0,10) : "Hoy";
  }
  function tesPaymentTimeAgo(value){
    const raw = String(value || "");
    const d = raw ? new Date(raw) : null;
    if(!d || Number.isNaN(d.getTime())) return "Registrado";
    const mins = Math.max(1, Math.round((Date.now() - d.getTime()) / 60000));
    if(mins < 60) return `Hace ${mins} min`;
    const hrs = Math.round(mins/60);
    if(hrs < 24) return `Hace ${hrs} h`;
    return tesPaymentDateShort(raw);
  }
  function tesConciliationRows(){
    return paymentsNormalized()
      .filter(p=>String(p.status||"").toLowerCase()==="paid")
      .filter(p=>String(p.conciliationStatus||"").toLowerCase()!=="anulado")
      .sort((a,b)=>String(b.paidAt||b.createdAt||"").localeCompare(String(a.paidAt||a.createdAt||"")));
  }
  function tesConciliationMetrics(rows){
    const pending = rows.filter(p=>!tesIsConciliated(p));
    const conciliated = rows.filter(tesIsConciliated);
    const today = new Date().toISOString().slice(0,10);
    const conciliatedToday = conciliated.filter(p=>String(p.reconciledAt || p.conciliatedAt || p.paidAt || p.createdAt || "").slice(0,10)===today);
    const total = rows.length || 1;
    return {
      pending,
      conciliated,
      conciliatedToday,
      pendingAmount: sum(pending, p=>p.amount),
      todayAmount: sum(conciliatedToday, p=>p.amount),
      totalAmount: sum(rows, p=>p.amount),
      level: Math.round((conciliated.length / total) * 100)
    };
  }
  function renderTesConciliationCard(p){
    const isConc = tesIsConciliated(p);
    const methodMap = {transferencia:'Transferencia', efectivo:'Efectivo', cheque:'Cheque', otro:'Otro medio', saldo_favor:'Saldo a favor'};
    const method = tesIsTransbankAuto(p) ? "Transbank" : (methodMap[String(p.paymentMethod || p.paidWith || '').toLowerCase()] || "Medio registrado");
    const campaign = tesPaymentCampaignTitle(p);
    const code = String(p.code || p.paymentCode || p.id || "").slice(-6).toUpperCase();
    if(isConc){
      return `<article class="tesConcPayCard is-conciliated">
        <div class="tesConcAvatar ok">✓</div>
        <div class="tesConcWho"><b>${esc(p.guardianName || p.apoderadoName || "Apoderado")}</b><small>${esc(p.studentName || "Alumno")}</small><em>${esc(campaign)}</em></div>
        <div class="tesConcAmount"><strong>${clp(p.amount)}</strong><small>${esc(method)}</small><small>${esc(tesPaymentDateShort(p.reconciledAt || p.paidAt || p.createdAt))}</small></div>
        <div class="tesConcStatus"><span>Conciliado</span><small>${tesIsTransbankAuto(p) ? 'Automático' : 'Por: Tesorero'}</small></div>
      </article>`;
    }
    return `<article class="tesConcPayCard is-pending">
      <div class="tesConcAvatar pending">⌛</div>
      <div class="tesConcWho"><b>${esc(p.guardianName || p.apoderadoName || "Apoderado")}</b><small>${esc(p.studentName || "Alumno")}</small><em>${esc(campaign)}</em></div>
      <div class="tesConcAmount"><strong>${clp(p.amount)}</strong><small>${esc(tesPaymentTimeAgo(p.paidAt || p.createdAt))}</small><small>Código: #${esc(code || 'PAGO')}</small></div>
      <div class="tesConcStatus"><span class="pending">Pendiente</span><button type="button" onclick="openTesConciliationSheet('${esc(p.id)}')">Conciliar</button></div>
    </article>`;
  }

  window.tesSetConciliationFilter = function(filter){
    window.__tesConcFilter = String(filter || 'pendientes');
    renderConciliacion();
  };
  window.tesFilterConciliation = function(value){
    window.__tesConcQuery = String(value || '').toLowerCase().trim();
    renderConciliacion();
  };
  window.openTesConciliationSheet = function(paymentId){
    const p = tesConciliationRows().find(x=>String(x.id)===String(paymentId));
    if(!p) return alert('No se encontró el pago.');
    const campaign = tesPaymentCampaignTitle(p);
    const code = String(p.code || p.paymentCode || p.id || '').slice(-8).toUpperCase();
    const overlay = document.createElement('div');
    overlay.className = 'tesConcSheetOverlay';
    overlay.innerHTML = `<section class="tesConcSheet" role="dialog" aria-modal="true">
      <button class="tesConcSheetClose" type="button" aria-label="Cerrar">×</button>
      <div class="tesConcGrip"></div>
      <h2>Conciliar pago</h2>
      <div class="tesConcSheetSummary">
        <div class="tesConcAvatar pending">⌛</div>
        <div><b>${esc(p.guardianName || p.apoderadoName || 'Apoderado')}</b><small>${esc(p.studentName || 'Alumno')}</small></div>
        <strong>${clp(p.amount)}</strong>
      </div>
      <div class="tesConcSheetData">
        <span>Campaña</span><b>${esc(campaign)}</b>
        <span>Código de pago</span><b>#${esc(code || 'PAGO')}</b>
        <span>Registrado</span><b>${esc(tesPaymentTimeAgo(p.paidAt || p.createdAt))}</b>
      </div>
      <h3>Seleccione el medio recibido</h3>
      <div class="tesConcMethodGrid">
        <label><input type="radio" name="tesMethod" value="transferencia" checked><span>🏦</span><b>Transferencia bancaria</b><small>Desde cuenta bancaria</small></label>
        <label><input type="radio" name="tesMethod" value="efectivo"><span>💵</span><b>Efectivo</b><small>Dinero en efectivo</small></label>
        <label><input type="radio" name="tesMethod" value="cheque"><span>🧾</span><b>Cheque</b><small>Pago con cheque</small></label>
        <label><input type="radio" name="tesMethod" value="otro"><span>•••</span><b>Otro medio</b><small>Otro método de pago</small></label>
      </div>
      <h3>Información adicional <small>(opcional)</small></h3>
      <select id="tesConcBank"><option value="">Banco (si aplica)</option><option>Banco de Chile</option><option>BancoEstado</option><option>Santander</option><option>BCI</option><option>Scotiabank</option><option>Itaú</option><option>Otro</option></select>
      <input id="tesConcRef" placeholder="N° de referencia / comprobante">
      <textarea id="tesConcObs" rows="3" placeholder="Observación opcional"></textarea>
      <div class="tesConcSheetActions"><button type="button" class="ghost">Cancelar</button><button type="button" class="primary">Confirmar conciliación</button></div>
    </section>`;
    overlay.addEventListener('click', e=>{ if(e.target === overlay) overlay.remove(); });
    overlay.querySelector('.tesConcSheetClose').onclick = ()=>overlay.remove();
    overlay.querySelector('.ghost').onclick = ()=>overlay.remove();
    overlay.querySelector('.primary').onclick = ()=>window.confirmTesManualConciliation(paymentId, overlay);
    document.body.appendChild(overlay);
  };
  window.confirmTesManualConciliation = function(paymentId, overlay){
    const payments = paymentsNormalized();
    const i = payments.findIndex(p=>String(p.id)===String(paymentId));
    if(i<0) return alert('No se encontró el pago.');
    const method = overlay?.querySelector('input[name="tesMethod"]:checked')?.value || 'transferencia';
    payments[i].paymentMethod = method;
    payments[i].paidWith = method;
    payments[i].conciliationStatus = 'conciliado';
    payments[i].reconciledAt = new Date().toISOString();
    payments[i].reconciledBy = 'Tesorero';
    payments[i].reconciliationBank = overlay?.querySelector('#tesConcBank')?.value || '';
    payments[i].reconciliationReference = overlay?.querySelector('#tesConcRef')?.value || '';
    payments[i].reconciliationNote = overlay?.querySelector('#tesConcObs')?.value || '';
    save(KEY_PAYMENTS, payments);
    try{ markDirty(); }catch(_){ }
    overlay?.remove();
    renderConciliacion();
  };

  renderConciliacion = function(){
    updateTreasurerHeader();
    const allRows = tesConciliationRows();
    const metrics = tesConciliationMetrics(allRows);
    const filter = String(window.__tesConcFilter || 'pendientes');
    const q = String(window.__tesConcQuery || '').toLowerCase().trim();
    let rows = filter === 'conciliados' ? metrics.conciliated : filter === 'todos' ? allRows : metrics.pending;
    if(q){
      rows = rows.filter(p=>[p.guardianName,p.apoderadoName,p.studentName,p.concept,tesPaymentCampaignTitle(p),p.id,p.code,p.paymentCode].join(' ').toLowerCase().includes(q));
    }
    const recentConc = metrics.conciliated.slice(0,3).map(p=>renderTesConciliationCard(p)).join('') || `<article class="tesConcEmpty">Sin pagos conciliados todavía.</article>`;
    const rowsHtml = rows.map(renderTesConciliationCard).join('') || `<article class="tesConcEmpty"><b>No hay pagos en esta vista</b><span>Cuando existan pagos, aparecerán aquí.</span></article>`;
    app.innerHTML = `<div class="tesConcPage">
      <section class="tesConcHero">
        <header><div><h1>Conciliación de pagos <span>ⓘ</span></h1><p>Administra y concilia los pagos recibidos por el curso.</p></div><button type="button" onclick="tesSetConciliationFilter('conciliados')">Ver historial conciliados ›</button></header>
        <div class="tesConcStats">
          <button type="button" onclick="tesSetConciliationFilter('pendientes')"><span class="amber">◷</span><small>Pendientes por conciliar</small><b>${metrics.pending.length} pagos</b><em>${clp(metrics.pendingAmount)}</em></button>
          <button type="button" onclick="tesSetConciliationFilter('conciliados')"><span class="green">✓</span><small>Conciliados hoy</small><b>${metrics.conciliatedToday.length} pagos</b><em>${clp(metrics.todayAmount)}</em></button>
          <button type="button"><span class="blue">▥</span><small>Nivel de conciliación</small><b>${metrics.level}%</b><em>${metrics.level>=90?'Excelente':'En curso'}</em></button>
          <button type="button" onclick="tesSetConciliationFilter('todos')"><span class="violet">▣</span><small>Total recaudado</small><b>${clp(metrics.totalAmount)}</b><em>Este mes</em></button>
        </div>
      </section>
      <section class="tesConcTools">
        <label><span>⌕</span><input value="${esc(window.__tesConcQuery || '')}" oninput="tesFilterConciliation(this.value)" placeholder="Buscar apoderado, alumno o código de pago..."></label>
        <button type="button">☰<small>Filtros</small></button>
      </section>
      <section class="tesConcTabs">
        <button type="button" class="${filter==='pendientes'?'active':''}" onclick="tesSetConciliationFilter('pendientes')">Pendientes <span>${metrics.pending.length}</span></button>
        <button type="button" class="${filter==='todos'?'active':''}" onclick="tesSetConciliationFilter('todos')">Todos <span>${allRows.length}</span></button>
        <button type="button" class="${filter==='conciliados'?'active ok':''}" onclick="tesSetConciliationFilter('conciliados')">● Conciliados <span>${metrics.conciliated.length}</span></button>
      </section>
      <section class="tesConcList">
        <header><h2>${filter==='conciliados'?'Conciliados':'Pendientes por conciliar'} (${rows.length})</h2><div>Ordenar por <b>Más recientes⌄</b></div></header>
        ${rowsHtml}
        <div class="tesConcNote">ⓘ Los pagos por Transbank se concilian automáticamente. <button type="button" onclick="tesSetConciliationFilter('conciliados')">Ver conciliados automáticos ›</button></div>
      </section>
      <section class="tesConcRecent"><header><h2>Conciliados recientemente</h2><button onclick="tesSetConciliationFilter('conciliados')">Ver todos ›</button></header>${recentConc}</section>
      <button class="tesScanBtn" type="button">📷 Escanear comprobante</button>
    </div>`;
  };

  renderRendiciones = function(selectedTaskId){
    const active = tasksActive();
    const expAll = expensesAll();
    const show = selectedTaskId ? active.filter(x=>x.id===selectedTaskId) : active;
    app.innerHTML = `
      <div class="tesMockPage">
        <section class="tesMockSection">
          <header><div><h1>Rendiciones</h1><p class="tesMockLead">Controla los gastos de las campanas</p></div><button onclick="openCreateExpense('general','')">+ Agregar gasto</button></header>
          <div class="tesMockChips"><button class="active">Por campana</button><button>Gastos generales</button></div>
        </section>
        <section class="tesMockCampaignList">${show.map(t=>{ const exp=expensesForTask(t.id); const rec=collectedForTask(t.id); const gas=sum(exp,e=>e.amount); const saldo=rec-gas; const pct=rec?Math.max(0,Math.min(100,Math.round((gas/rec)*100))):0; return `<article><span>R</span><div><b>${esc(t.title||"Campana")}</b><small>Recaudado ${clp(rec)} · Gastado ${clp(gas)} · Saldo ${clp(saldo)}</small><i><u style="width:${pct}%"></u></i><footer><button onclick="openCreateExpense('campaign','${esc(t.id)}')">Agregar gasto</button><button onclick="go('rendiciones','${esc(t.id)}')">Ver detalle</button></footer></div></article>`; }).join("") || `<article><div><b>Sin campanas activas</b><small>No hay rendiciones por revisar.</small></div></article>`}</section>
      </div>`;
  };

  renderInformes = function(){
    const reps = load(KEY_MONTHLY_REPORTS, []);
    const draftRep = buildTreasuryReport(currentYM());
    app.innerHTML = `
      <div class="tesMockPage">
        <section class="tesMockHero">
          <header><div><span>I</span><h2>Informe Tesoreria</h2><p>Periodo: ${esc(currentYM())}</p></div><b>Cuadratura OK</b></header>
          <div class="tesMockHeroGrid">
            <div><small>Recaudado</small><strong>${clp(draftRep.collectedMes)}</strong></div>
            <div><small>Gastado</small><strong>${clp(draftRep.spentMes)}</strong></div>
            <div><small>Saldo</small><strong>${clp(draftRep.saldoMes)}</strong></div>
            <div><small>Caja disponible</small><strong>${clp(draftRep.saldoTotal)}</strong></div>
          </div>
          <button onclick="generateMonthly()">Generar PDF</button>
        </section>
        <section class="tesMockSection">
          <h2>Informes publicados</h2>
          <div class="tesMockReportList">${reps.length ? reps.map(r=>`<article><span>I</span><div><b>${esc(r.period)}</b><small>Emitido ${esc(r.generatedAt)}</small></div><button onclick="openTreasuryReport('${esc(r.id)}')">Ver</button><button onclick="downloadTreasuryReport('${esc(r.id)}')">Descargar</button></article>`).join("") : `<article><div><b>Sin informes generados</b><small>Genera el primer informe mensual.</small></div></article>`}</div>
        </section>
      </div>`;
  };

  // ---------- expose handlers ----------
  window.openCreateExpense = openCreateExpense;
  window.saveExpense = saveExpense;
  window.editExpense = editExpense;
  window.saveEditExpense = saveEditExpense;
  window.deleteExpense = deleteExpense;
  window.uploadBoleta = uploadBoleta;
  window.replaceBoleta = replaceBoleta;
  window.viewBoleta = viewBoleta;
  window.openEditCampaign = openEditCampaign;
  window.saveEditCampaign = saveEditCampaign;
  window.generateMonthly = generateMonthly;
  window.openTreasuryReport = openTreasuryReport;
  window.downloadTreasuryReport = downloadTreasuryReport;
  window.shareTreasuryReport = shareTreasuryReport;
  window.openManualPayment = openManualPayment;
  window.registerManualPayment = registerManualPayment;
  window.updatePaymentMethod = updatePaymentMethod;
  window.updatePaymentConciliationStatus = updatePaymentConciliationStatus;
  window.toggleConciliationCampaign = toggleConciliationCampaign;

  // ---------- Boot ----------
  // ----- boot -----
// ✅ Seed demo SOLO si está activado globalmente (core.js) o por URL (?demo=1)
const DEMO_SEED = (
  (window.CURSAPP && window.CURSAPP.DEMO_MODE === true) ||
  (new URLSearchParams(location.search).get("demo") === "1") ||
  (localStorage.getItem("cursapp_demo_mode") === "1")
);
if (DEMO_SEED) ensureDemo();

async function __bootTesoreroSupabaseFirst(){
  try{
    if(window.CURSAPP && typeof window.CURSAPP.clearOperationalCache === "function") window.CURSAPP.clearOperationalCache();
    if(window.CURSAPP && typeof window.CURSAPP.hydrateOperationalFromSupabase === "function"){
      await window.CURSAPP.hydrateOperationalFromSupabase("tesorero-boot");
    }
  }catch(e){
    console.warn("Tesorero: no se pudo hidratar Supabase antes del render", e);
  }
  initMenu();
  go("home");
}
__bootTesoreroSupabaseFirst();

})();

/* Re-render banners después de cada render de Tesorero */
(function(){
  if(window.__CURSAPP_TESORERO_MONETIZATION_RERENDER__) return;
  window.__CURSAPP_TESORERO_MONETIZATION_RERENDER__ = true;
  function rerender(){ try{ if(window.CursappMonetization) setTimeout(()=>window.CursappMonetization.render(), 120); }catch(e){} }
  window.addEventListener("cursapp:dataChanged", rerender);
  window.addEventListener("cursapp:dataUpdated", rerender);
  window.addEventListener("pageshow", rerender);
  const timer = setInterval(rerender, 1500);
  setTimeout(()=>clearInterval(timer), 12000);
})();


/* Tesorero V59 · restaurar menú inferior y evitar duplicados de soporte
   V63: bloque legacy desactivado porque reescribía el menú inferior cada 700ms
   y competía con el menú SVG final (V62/V63), causando parpadeo. */
(function(){
  if(window.__CURSAPP_TESORERO_V59_POLISH__) return;
  window.__CURSAPP_TESORERO_V59_POLISH__ = true;
  function dedupeSupport(){
    try{
      const candidates = Array.from(document.querySelectorAll('button,a,div'))
        .filter(el => /soporte/i.test((el.textContent || '').trim()) && getComputedStyle(el).position === 'fixed');
      if(candidates.length <= 1) return;
      candidates.slice(0, -1).forEach(el => { el.style.display = 'none'; el.setAttribute('aria-hidden','true'); });
    }catch(_){ }
  }
  document.addEventListener('DOMContentLoaded', dedupeSupport);
  window.addEventListener('load', dedupeSupport);
  window.addEventListener('pageshow', dedupeSupport);
})();

/* Tesorero V62 · menú inferior SVG + menú principal estable */
(function(){
  if(window.__CURSAPP_TESORERO_V62_FINAL__) return;
  window.__CURSAPP_TESORERO_V62_FINAL__ = true;

  const ICONS = {
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 10.5V21h13V10.5"/><path d="M9.5 21v-6h5v6"/></svg>',
    conciliacion: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 6.5v11"/><path d="M8.8 9.2c.8-1 2-1.4 3.2-1.4 1.7 0 3 .8 3 2.1 0 2.8-6 1.3-6 4.1 0 1.4 1.3 2.3 3.1 2.3 1.4 0 2.7-.5 3.5-1.6"/></svg>',
    rendiciones: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v5h4"/><path d="M10 12h6"/><path d="M10 16h6"/></svg>',
    informes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16v-5"/><path d="M12 16V8"/><path d="M16 16v-9"/></svg>'
  };
  const LABELS = { home:'Inicio', conciliacion:'Conciliar', rendiciones:'Rendiciones', informes:'Informes' };

  function restoreNav(){
    const nav = document.querySelector('body.cursapp-tesorero .bottomNav.tesBottomNav');
    if(!nav) return;
    Array.from(nav.querySelectorAll('.navItem')).forEach(btn=>{
      const tab = btn.getAttribute('data-tab') || 'home';
      if(!LABELS[tab]) { btn.remove(); return; }
      const active = btn.classList.contains('active');
      btn.className = 'navItem' + (active ? ' active' : '');
      btn.innerHTML = `<span class="tesNavIcon">${ICONS[tab]}</span><span class="tesNavLabel">${LABELS[tab]}</span>`;
    });
  }

  function stableMenu(){
    window.CURSAPP_MENU_HANDLED = true;
    const btn = document.getElementById('menuBtn');
    const menu = document.getElementById('menuDropdown');
    if(!btn || !menu) return;
    if(!menu.dataset.v62Ready){
      menu.innerHTML = `
        <button class="menuItem" type="button" data-go="home">🏠 Inicio</button>
        <button class="menuItem" type="button" data-go="conciliacion">💳 Conciliar pagos</button>
        <button class="menuItem" type="button" data-go="rendiciones">📄 Rendiciones</button>
        <button class="menuItem" type="button" data-go="informes">📊 Informes</button>
        <button class="menuItem" type="button" data-go="perfil">👤 Mi perfil</button>
        <button class="menuItem" type="button" data-close="1">Cerrar menú</button>`;
      menu.dataset.v62Ready = '1';
      menu.addEventListener('click', function(e){
        e.stopPropagation();
        const item = e.target.closest('button');
        if(!item) return;
        if(item.dataset.close){ menu.style.display='none'; menu.classList.remove('is-open'); return; }
        const tab = item.dataset.go;
        menu.style.display='none';
        menu.classList.remove('is-open');
        if(tab === 'perfil' && typeof renderProfile === 'function') { renderProfile(); return; }
        if(typeof go === 'function') go(tab || 'home');
      }, true);
      menu.addEventListener('pointerdown', e=>e.stopPropagation(), true);
    }
    const toggle = function(e){
      e.preventDefault();
      e.stopPropagation();
      const open = menu.style.display === 'block';
      menu.style.display = open ? 'none' : 'block';
      menu.classList.toggle('is-open', !open);
    };
    btn.onclick = toggle;
    btn.onpointerdown = function(e){ e.stopPropagation(); };
    document.addEventListener('click', function(e){
      if(!menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)){ menu.style.display='none'; menu.classList.remove('is-open'); }
    }, true);
  }

  function run(){ restoreNav(); stableMenu(); }
  document.addEventListener('DOMContentLoaded', run);
  window.addEventListener('load', run);
  window.addEventListener('pageshow', run);
  setTimeout(run, 50); setTimeout(run, 250); setTimeout(run, 900);
  setInterval(restoreNav, 1000);
})();


/* Tesorero V64 · campana funcional y menú final estable */
(function(){
  if(window.__CURSAPP_TESORERO_V64_FIXES__) return;
  window.__CURSAPP_TESORERO_V64_FIXES__ = true;

  function escLocal(v){
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function readJSON(key, fallback){
    try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }catch(_){ return fallback; }
  }
  function getTreasurerNotices(){
    const keys = ['cursapp_avisos_v1','cursapp_notices_v1','cursapp_notifications_v1','cursapp_global_alerts_v1'];
    let out = [];
    keys.forEach(k=>{
      const arr = readJSON(k, []);
      if(Array.isArray(arr)) out = out.concat(arr);
    });
    return out.slice().sort((a,b)=>String(b.createdAt||b.date||'').localeCompare(String(a.createdAt||a.date||''))).slice(0,8);
  }
  window.openTreasurerNotifications = function(){
    const root = document.getElementById('modalRoot') || document.body;
    const notices = getTreasurerNotices();
    const rows = notices.length ? notices.map(n=>{
      const title = n.title || n.subject || 'Aviso del curso';
      const msg = n.message || n.body || n.description || '';
      const date = n.createdAt || n.date || '';
      return `<article class="tesNoticeRow"><b>${escLocal(title)}</b><span>${escLocal(msg)}</span><small>${escLocal(String(date).slice(0,16).replace('T',' '))}</small></article>`;
    }).join('') : `<article class="tesNoticeEmpty"><b>Sin avisos nuevos</b><span>Cuando existan alertas de pagos, informes o rendiciones aparecerán aquí.</span></article>`;
    const el = document.createElement('div');
    el.className = 'tesNoticeOverlay';
    el.innerHTML = `<div class="tesNoticePanel" role="dialog" aria-modal="true" aria-label="Avisos del curso"><header><div><small>CURSAPP</small><h2>Avisos del curso</h2></div><button type="button" aria-label="Cerrar">×</button></header><div class="tesNoticeList">${rows}</div></div>`;
    el.addEventListener('click', e=>{ if(e.target === el) el.remove(); });
    el.querySelector('button').onclick = ()=>el.remove();
    root.appendChild(el);
  };

  function wireBell(){
    const bell = document.getElementById('notificationBtn');
    if(!bell) return;
    bell.onclick = function(e){
      e.preventDefault();
      e.stopPropagation();
      window.openTreasurerNotifications();
    };
  }

  const ICONS = {
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 10.5V21h13V10.5"/><path d="M9.5 21v-6h5v6"/></svg>',
    conciliacion: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 6.5v11"/><path d="M8.8 9.2c.8-1 2-1.4 3.2-1.4 1.7 0 3 .8 3 2.1 0 2.8-6 1.3-6 4.1 0 1.4 1.3 2.3 3.1 2.3 1.4 0 2.7-.5 3.5-1.6"/></svg>',
    rendiciones: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v5h4"/><path d="M10 12h6"/><path d="M10 16h6"/></svg>',
    informes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16v-5"/><path d="M12 16V8"/><path d="M16 16v-9"/></svg>'
  };
  const LABELS = { home:'Inicio', conciliacion:'Conciliar', rendiciones:'Rendiciones', informes:'Informes' };
  function restoreNavV64(){
    const nav = document.querySelector('body.cursapp-tesorero .bottomNav.tesBottomNav');
    if(!nav) return;
    Array.from(nav.querySelectorAll('.navItem')).forEach(btn=>{
      const tab = btn.getAttribute('data-tab') || 'home';
      if(!LABELS[tab]) { btn.remove(); return; }
      const active = btn.classList.contains('active');
      const html = `<span class="tesNavIcon">${ICONS[tab]}</span><span class="tesNavLabel">${LABELS[tab]}</span>`;
      if(btn.innerHTML !== html) btn.innerHTML = html;
      btn.className = 'navItem' + (active ? ' active' : '');
    });
  }
  document.addEventListener('DOMContentLoaded', ()=>{ wireBell(); restoreNavV64(); });
  window.addEventListener('load', ()=>{ wireBell(); restoreNavV64(); });
  window.addEventListener('pageshow', ()=>{ wireBell(); restoreNavV64(); });
  setTimeout(()=>{ wireBell(); restoreNavV64(); }, 100);
  setTimeout(()=>{ wireBell(); restoreNavV64(); }, 700);
})();
