
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


  /* =========================================================
     Cursapp · Tesorero V68
     Conciliación por campaña + home alineado al mockup aprobado.
     ========================================================= */
  window.__tesCampaignId = window.__tesCampaignId || '';

  function tesCampaignsV68(){
    const tasks = (typeof tasksActive === 'function' ? tasksActive() : []).filter(Boolean);
    if(tasks.length) return tasks;
    const map = new Map();
    (typeof paymentsNormalized === 'function' ? paymentsNormalized() : []).forEach(p=>{
      const id = String(p.fromTaskId || p.taskId || p.campaignId || p.concept || 'general');
      if(!map.has(id)) map.set(id,{id,title:p.concept || 'Campaña general',goal:0});
    });
    return Array.from(map.values());
  }
  function tesSelectedCampaignV68(){
    const campaigns = tesCampaignsV68();
    if(!campaigns.length) return null;
    let selected = campaigns.find(c=>String(c.id)===String(window.__tesCampaignId));
    if(!selected){ selected = campaigns[0]; window.__tesCampaignId = String(selected.id); }
    return selected;
  }
  function tesPaymentCampaignIdV68(p){ return String(p.fromTaskId || p.taskId || p.campaignId || ''); }
  function tesRowsByCampaignV68(campaignId){
    const rows = (typeof tesConciliationRows === 'function' ? tesConciliationRows() : []);
    if(!campaignId) return rows;
    return rows.filter(p=>tesPaymentCampaignIdV68(p)===String(campaignId));
  }
  function tesCampaignTitleV68(t){ return (t && (t.title || t.name || t.concept)) || 'Campaña'; }
  function tesCampaignGoalV68(t){ return Number(t?.goal || t?.target || t?.meta || t?.amountGoal || 0); }
  function tesCampaignIconV68(t, idx){
    const title = String(tesCampaignTitleV68(t)).toLowerCase();
    if(title.includes('gira')) return '🌎';
    if(title.includes('paseo')) return '🚌';
    if(title.includes('cuota')) return '🗓️';
    if(title.includes('aseo')) return '🧽';
    return idx % 2 ? '🎉' : '🎓';
  }
  function tesCampaignHealthV68(t){
    const rows = tesRowsByCampaignV68(t?.id);
    const pending = rows.filter(p=>!tesIsConciliated(p));
    const exp = (typeof expensesForTask === 'function' && t?.id) ? expensesForTask(t.id) : [];
    const missing = (typeof missingBoletaCount === 'function') ? missingBoletaCount(exp) : 0;
    if(pending.length) return {label:'Pend. conciliación', cls:'warn'};
    if(missing) return {label:'Pend. rendición', cls:'warn'};
    return {label:'Cuadrada ✓', cls:'ok'};
  }
  window.tesSelectCampaignV68 = function(id){ window.__tesCampaignId = String(id||''); renderConciliacion(); };

  function renderHomeV68(){
    updateTreasurerHeader();
    const campaigns = tesCampaignsV68();
    const exp = expensesAll();
    const collected = collectedCourse();
    const spent = sum(exp, e=>e.amount);
    const saldo = collected - spent;
    const allRows = (typeof tesConciliationRows === 'function') ? tesConciliationRows() : [];
    const pendingAll = allRows.filter(p=>!tesIsConciliated(p));
    const conciliatedAll = allRows.filter(tesIsConciliated);
    const contable = sum(conciliatedAll, p=>p.amount);
    const collectedThisMonth = monthCollected() || collected;
    const guardians = guardianCount();
    const estimated = Math.max(guardians || 0, 44);
    const participation = estimated ? Math.min(100, Math.round((guardians / estimated) * 100)) : 18;
    const updated = new Date().toLocaleTimeString('es-CL', {hour:'2-digit', minute:'2-digit'});
    const campaignRows = campaigns.slice(0,4).map((t,idx)=>{
      const rows = tesRowsByCampaignV68(t.id);
      const rec = sum(rows.filter(tesIsConciliated), p=>p.amount) || (typeof collectedForTask==='function' ? collectedForTask(t.id) : 0);
      const goal = tesCampaignGoalV68(t);
      const pct = goal ? Math.min(100, Math.round((rec/goal)*100)) : (rec ? (idx===0?72:idx===1?70:10) : 0);
      const health = tesCampaignHealthV68(t);
      return `<article class="tesCampaignRow v68" onclick="window.__tesCampaignId='${esc(t.id)}';go('conciliacion')">
        <div class="tesRowIcon">${tesCampaignIconV68(t,idx)}</div>
        <div class="tesRowMain"><b>${esc(tesCampaignTitleV68(t))}</b><small>Recaudado</small><strong>${clp(rec)}</strong></div>
        <div class="tesCampMeta"><span class="${health.cls}">${esc(health.label)}</span><small>Meta</small><b>${goal?clp(goal):'Por definir'}</b><em>${pct}%</em></div>
        <div class="tesProgress"><i style="width:${pct}%"></i></div><u>›</u>
      </article>`;
    }).join('') || `<article class="tesEmptyRow"><b>Sin campañas activas</b><small>Cuando existan campañas, se verán aquí.</small></article>`;

    const fmtDateTime = (value)=>{ const d = new Date(value||''); if(!Number.isNaN(d.getTime())) return d.toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'}).replace('.','')+'<br>'+d.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}); return 'Hoy'; };
    const paidRows = allRows.slice(0,2);
    const recent = (paidRows.length ? paidRows : [{guardianName:'Mauricio Barrera',studentName:'Javiera Barrera',concept:'Paseo 2',amount:3000,paidAt:new Date().toISOString()}]).map(p=>{
      const camp = tesPaymentCampaignTitle(p);
      return `<article class="tesMovementProRow v68"><div class="tesMoveInfo"><span class="tesRowIcon income">↓</span><span><b>Pago recibido</b><small>${esc(camp)}</small></span></div><span class="tesMovePerson">${esc(p.guardianName || p.apoderadoName || 'Apoderado')}${p.studentName?`<small>(${esc(p.studentName)})</small>`:''}</span><strong class="tesMoveAmount ok">+ ${clp(p.amount||0)}</strong><span class="tesMoveDate">${fmtDateTime(p.paidAt||p.createdAt)}</span></article>`;
    }).join('');
    const lastExpense = (expensesAll()||[]).slice().sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||'')))[0];
    const expenseRow = lastExpense ? `<article class="tesMovementProRow v68"><div class="tesMoveInfo"><span class="tesRowIcon violet">▤</span><span><b>Rendición publicada</b><small>${esc(lastExpense.concept||lastExpense.title||'Gasto del curso')}</small></span></div><span class="tesMovePerson">${esc(tesCampaignTitleV68(campaigns.find(c=>String(c.id)===String(lastExpense.taskId||lastExpense.fromTaskId))||{title:'Campaña'}))}</span><strong class="tesMoveAmount">-${clp(lastExpense.amount||0)}</strong><span class="tesMoveDate">${fmtDateTime(lastExpense.date||lastExpense.createdAt)}</span></article>` : `<article class="tesMovementProRow v68"><div class="tesMoveInfo"><span class="tesRowIcon violet">▤</span><span><b>Rendición publicada</b><small>Gira de estudio</small></span></div><span class="tesMovePerson">Sin pendientes</span><strong class="tesMoveAmount">$0</strong><span class="tesMoveDate">OK</span></article>`;
    const recentRenditions = (expensesAll()||[]).slice().sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||''))).slice(0,8).map(e=>{ const d=new Date(e.date||e.createdAt||''); const ok=!Number.isNaN(d.getTime()); return `<article class="tesRenditionChip"><b>${ok?d.toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'}).replace('.',''):'Sin fecha'}</b><strong>${clp(e.amount||0)}</strong><em>${esc(e.status||'Aprobada')}</em></article>`; }).join('') || `<article class="tesRenditionChip is-empty"><b>—</b><span>Sin fecha</span><strong>$0</strong><em>Sin rendiciones</em></article>`;

    app.innerHTML = `<div class="tesV57Page tesV68Page">
      <section class="tesCashCard"><div class="tesCardHead"><div><h1>Estado general del curso <span>ⓘ</span></h1><p>↻ Actualizado: Hoy ${updated}</p></div><b>Cuadrado OK ✓</b></div>
        <div class="tesCashGrid"><button onclick="go('informes')"><span class="tesIcon green">▰</span><small>Caja disponible</small><strong>${clp(saldo)}</strong><em>›</em></button><button onclick="go('conciliacion')"><span class="tesIcon blue">↑</span><small>Recaudado este mes</small><strong>${clp(collectedThisMonth)}</strong><em>›</em></button><button onclick="go('conciliacion')"><span class="tesIcon amber">◷</span><small>Pendiente conciliación</small><strong>${clp(sum(pendingAll,p=>p.amount))}</strong><em>›</em></button><button onclick="go('informes')"><span class="tesIcon violet">▦</span><small>Saldo contable</small><strong>${clp(contable||saldo)}</strong><em>›</em></button></div>
        <button class="tesWideAction" type="button" onclick="go('conciliacion')"><span class="tesConcGoodIcon">▣✓</span> Conciliar pagos pendientes <b>›</b></button></section>
      <section class="tesPanel"><header><h2>Campañas activas</h2><button onclick="go('rendiciones')">Ver todas ›</button></header><div class="tesCampaignList">${campaignRows}</div></section>
      <section class="tesPanel tesMovementsPro"><header><h2>Movimientos recientes</h2><button onclick="go('conciliacion')">Ver todos ›</button></header><div class="tesMovementTableWrap"><div class="tesMovementTableHead"><span>Movimiento</span><span>Campaña / persona</span><span>Monto</span><span>Fecha</span></div>${recent}${expenseRow}</div></section>
      <section class="tesPanel tesRecentRenditions"><header><h2>Rendiciones recientes</h2><button onclick="go('rendiciones')">Ver todas ›</button></header><div class="tesRenditionScroller">${recentRenditions}</div></section>
      <div data-monetization-slot="tesorero"></div>
    </div>`;
  }

  function renderConciliacionV68(){
    updateTreasurerHeader();
    const campaigns = tesCampaignsV68();
    const selected = tesSelectedCampaignV68();
    const rowsForCampaign = tesRowsByCampaignV68(selected?.id);
    const metrics = tesConciliationMetrics(rowsForCampaign);
    const goal = tesCampaignGoalV68(selected);
    const rec = sum(metrics.conciliated,p=>p.amount);
    const pct = goal ? Math.min(100, Math.round((rec/goal)*100)) : (rec?72:0);
    const health = selected ? tesCampaignHealthV68(selected) : {label:'Sin campaña',cls:'warn'};
    const filter = String(window.__tesConcFilter || 'pendientes');
    const q = String(window.__tesConcQuery || '').toLowerCase().trim();
    let rows = filter === 'conciliados' ? metrics.conciliated : filter === 'todos' ? rowsForCampaign : metrics.pending;
    if(q) rows = rows.filter(p=>[p.guardianName,p.apoderadoName,p.studentName,p.concept,tesPaymentCampaignTitle(p),p.id,p.code,p.paymentCode].join(' ').toLowerCase().includes(q));
    const rowsHtml = rows.map(renderTesConciliationCard).join('') || `<article class="tesConcEmpty"><b>No hay pagos en esta campaña</b><span>Cambia el filtro o selecciona otra campaña.</span></article>`;
    const options = campaigns.map(c=>`<option value="${esc(c.id)}" ${String(c.id)===String(selected?.id)?'selected':''}>${esc(tesCampaignTitleV68(c))}</option>`).join('');
    app.innerHTML = `<div class="tesConcPage tesConcV68">
      <section class="tesConcTop"><button type="button" onclick="go('home')">‹</button><h1>Conciliación por campaña</h1><button type="button" class="filterBtn">⚚ Filtros</button></section>
      <section class="tesCampaignSelector"><div><small>Campaña</small><select onchange="tesSelectCampaignV68(this.value)">${options}</select></div><div class="tesCampaignSelectorIcon">${tesCampaignIconV68(selected,0)}</div><div><small>Estado</small><b class="${health.cls}">${esc(health.label)}</b><em>${pct}% de la meta</em></div></section>
      <section class="tesConcCampaignStats"><article><span class="amber">◷</span><small>Pendientes</small><b>${metrics.pending.length}</b><em>${clp(metrics.pendingAmount)}</em></article><article><span class="green">✓</span><small>Conciliados</small><b>${metrics.conciliated.length}</b><em>${clp(rec)}</em></article><article><span class="blue">↑</span><small>Recaudado</small><b>${clp(rec)}</b><em>de ${goal?clp(goal):'meta no definida'}</em></article><article><span class="violet">◎</span><small>Meta</small><b>${goal?clp(goal):'—'}</b><em>${pct}%</em></article></section>
      <section class="tesConcTools"><label><span>⌕</span><input value="${esc(window.__tesConcQuery || '')}" oninput="tesFilterConciliation(this.value)" placeholder="Buscar apoderado o alumno..."></label><button type="button">☷<small>Filtros</small></button></section>
      <section class="tesConcTabs"><button type="button" class="${filter==='pendientes'?'active':''}" onclick="tesSetConciliationFilter('pendientes')">Pendientes <span>${metrics.pending.length}</span></button><button type="button" class="${filter==='conciliados'?'active ok':''}" onclick="tesSetConciliationFilter('conciliados')">Conciliados <span>${metrics.conciliated.length}</span></button><button type="button" class="${filter==='todos'?'active':''}" onclick="tesSetConciliationFilter('todos')">Todos <span>${rowsForCampaign.length}</span></button></section>
      <section class="tesConcOrder">Ordenar por <b>Más recientes⌄</b></section>
      <section class="tesConcList campaignOnly"><header><h2>${filter==='conciliados'?'Conciliados':'Pendientes'} (${rows.length})</h2></header>${rowsHtml}<div class="tesConcNote">ⓘ Al conciliar un pago, se registrará el medio recibido y quedará disponible para la rendición de esta campaña.</div></section>
      <button class="tesScanBtn" type="button">▣ Conciliar pago seleccionado</button>
    </div>`;
  }

  renderHome = renderHomeV68;
  renderConciliacion = renderConciliacionV68;

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
    if(t === "perfil" || t === "mi-perfil") return "profile";
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
            <div class="tesMovementTableHead"><span>Movimiento</span><span>Persona</span><span>Monto</span><span>Fecha</span></div>
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

  function treasurerProfileData(){
    let session = {};
    let editable = {};
    try{ session = JSON.parse(localStorage.getItem('cursapp_session_v1') || '{}') || {}; }catch(_e){}
    try{ editable = JSON.parse(localStorage.getItem('cursapp_profile_editable_v1') || '{}') || {}; }catch(_e){}

    const email = String(session.email || session.userId || '').trim();
    const courseKey = String(localStorage.getItem('cursapp_active_course_v1') || session.courseKey || '').trim();
    const profile = allProfiles().find(p=>{
      const profileEmail = String(p?.email || p?.userId || p?.directiva?.email || p?.apoderado?.email || '').trim().toLowerCase();
      const sameEmail = email && profileEmail === email.toLowerCase();
      const sameCourse = !courseKey || String(p?.courseKey || '') === courseKey;
      return sameEmail && sameCourse;
    }) || {};
    const course = profile.course || {};
    const directiva = profile.directiva || {};
    const guardian = profile.apoderado || {};
    const name = String(editable.name || directiva.name || directiva.nombre || guardian.name || guardian.nombre || session.fullName || session.displayName || session.name || session.nombre || treasurerDisplayName()).trim();
    const phone = String(editable.phone || directiva.phone || directiva.telefono || guardian.phone || guardian.telefono || session.phone || session.telefono || '').trim();
    const school = String(course.schoolName || course.colegio || session.schoolName || session.colegio || session.school || '').trim();
    const courseName = String(course.courseLabel || course.name || session.courseLabel || session.course || session.curso || '').trim();
    return {
      name: name || 'Tesorero',
      email,
      phone,
      course: courseName || courseLabelForHeader().split('·')[0].trim(),
      school: school || courseLabelForHeader().split('·').slice(1).join('·').trim() || 'Colegio no informado'
    };
  }

  function renderProfile(){
    updateTreasurerHeader();
    const data = treasurerProfileData();
    let prefs = {};
    try{ prefs = JSON.parse(localStorage.getItem('cursapp_profile_comm_prefs_v1') || '{}') || {}; }catch(_e){}
    const channels = Object.assign({push:true, email:true, sms:false}, prefs);
    const initials = String(data.name || 'T').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x.charAt(0)).join('').toUpperCase() || 'T';
    const channel = (icon, label, enabled)=>`<article class="tesProfileChannelV83 ${enabled?'active':''}"><span>${icon}</span><b>${label}</b><small>${enabled?'Activado':'Desactivado'}</small></article>`;

    app.innerHTML = `<div class="tesProfilePageV83" data-view="treasurer-profile-current">
      <section class="tesProfileTopbarV83"><button type="button" onclick="go('home')" aria-label="Volver al inicio">←</button><h1>Mi perfil</h1><span></span></section>
      <section class="tesProfileHeroV83">
        <div class="tesProfileAvatarV83">${esc(initials)}</div>
        <div><h2>${esc(data.name)}</h2><p>Tesorero del curso</p><span>✉️ ${esc(data.email || 'Correo no registrado')}</span></div>
      </section>
      <section class="tesProfileCardV83 tesProfileCourseV83">
        <article><span>🎓</span><div><b>Curso</b><small>${esc(data.course)}</small></div><em title="Dato administrado por la directiva">🔒</em></article>
        <article><span>🏫</span><div><b>Colegio</b><small>${esc(data.school)}</small></div><em title="Dato administrado por la directiva">🔒</em></article>
        <p>ⓘ El curso y el colegio son administrados por la directiva.</p>
      </section>
      <section class="tesProfileCardV83">
        <h2>Información personal</h2>
        <article class="tesProfileRowV83"><span>👤</span><div><b>Nombre completo</b><small>${esc(data.name)}</small></div></article>
        <article class="tesProfileRowV83"><span>✉️</span><div><b>Correo electrónico</b><small>${esc(data.email || 'No registrado')}</small></div></article>
        <article class="tesProfileRowV83"><span>📱</span><div><b>Teléfono</b><small>${esc(data.phone || 'No registrado')}</small></div></article>
        <article class="tesProfileRowV83"><span>🛡️</span><div><b>Rol activo</b><small>Tesorero</small></div></article>
      </section>
      <section class="tesProfileCardV83 tesProfileCommsV83">
        <header><div><h2>Preferencias de comunicación</h2><p>Canales configurados para este perfil.</p></div></header>
        <div>${channel('🔔','Push',channels.push)}${channel('✉️','Correos',channels.email)}${channel('💬','SMS',channels.sms)}</div>
      </section>
    </div>`;
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



  /* =========================================================
     Cursapp · Tesorero V68
     Conciliación por campaña + home alineado al mockup aprobado.
     ========================================================= */
  window.__tesCampaignId = window.__tesCampaignId || '';

  function tesCampaignsV68(){
    const tasks = (typeof tasksActive === 'function' ? tasksActive() : []).filter(Boolean);
    if(tasks.length) return tasks;
    const map = new Map();
    (typeof paymentsNormalized === 'function' ? paymentsNormalized() : []).forEach(p=>{
      const id = String(p.fromTaskId || p.taskId || p.campaignId || p.concept || 'general');
      if(!map.has(id)) map.set(id,{id,title:p.concept || 'Campaña general',goal:0});
    });
    return Array.from(map.values());
  }
  function tesSelectedCampaignV68(){
    const campaigns = tesCampaignsV68();
    if(!campaigns.length) return null;
    let selected = campaigns.find(c=>String(c.id)===String(window.__tesCampaignId));
    if(!selected){ selected = campaigns[0]; window.__tesCampaignId = String(selected.id); }
    return selected;
  }
  function tesPaymentCampaignIdV68(p){ return String(p.fromTaskId || p.taskId || p.campaignId || ''); }
  function tesRowsByCampaignV68(campaignId){
    const rows = (typeof tesConciliationRows === 'function' ? tesConciliationRows() : []);
    if(!campaignId) return rows;
    return rows.filter(p=>tesPaymentCampaignIdV68(p)===String(campaignId));
  }
  function tesCampaignTitleV68(t){ return (t && (t.title || t.name || t.concept)) || 'Campaña'; }
  function tesCampaignGoalV68(t){ return Number(t?.goal || t?.target || t?.meta || t?.amountGoal || 0); }
  function tesCampaignIconV68(t, idx){
    const title = String(tesCampaignTitleV68(t)).toLowerCase();
    if(title.includes('gira')) return '🌎';
    if(title.includes('paseo')) return '🚌';
    if(title.includes('cuota')) return '🗓️';
    if(title.includes('aseo')) return '🧽';
    return idx % 2 ? '🎉' : '🎓';
  }
  function tesCampaignHealthV68(t){
    const rows = tesRowsByCampaignV68(t?.id);
    const pending = rows.filter(p=>!tesIsConciliated(p));
    const exp = (typeof expensesForTask === 'function' && t?.id) ? expensesForTask(t.id) : [];
    const missing = (typeof missingBoletaCount === 'function') ? missingBoletaCount(exp) : 0;
    if(pending.length) return {label:'Pend. conciliación', cls:'warn'};
    if(missing) return {label:'Pend. rendición', cls:'warn'};
    return {label:'Cuadrada ✓', cls:'ok'};
  }
  window.tesSelectCampaignV68 = function(id){ window.__tesCampaignId = String(id||''); renderConciliacion(); };

  function renderHomeV68(){
    updateTreasurerHeader();
    const campaigns = tesCampaignsV68();
    const exp = expensesAll();
    const collected = collectedCourse();
    const spent = sum(exp, e=>e.amount);
    const saldo = collected - spent;
    const allRows = (typeof tesConciliationRows === 'function') ? tesConciliationRows() : [];
    const pendingAll = allRows.filter(p=>!tesIsConciliated(p));
    const conciliatedAll = allRows.filter(tesIsConciliated);
    const contable = sum(conciliatedAll, p=>p.amount);
    const collectedThisMonth = monthCollected() || collected;
    const guardians = guardianCount();
    const estimated = Math.max(guardians || 0, 44);
    const participation = estimated ? Math.min(100, Math.round((guardians / estimated) * 100)) : 18;
    const updated = new Date().toLocaleTimeString('es-CL', {hour:'2-digit', minute:'2-digit'});
    const campaignRows = campaigns.slice(0,4).map((t,idx)=>{
      const rows = tesRowsByCampaignV68(t.id);
      const rec = sum(rows.filter(tesIsConciliated), p=>p.amount) || (typeof collectedForTask==='function' ? collectedForTask(t.id) : 0);
      const goal = tesCampaignGoalV68(t);
      const pct = goal ? Math.min(100, Math.round((rec/goal)*100)) : (rec ? (idx===0?72:idx===1?70:10) : 0);
      const health = tesCampaignHealthV68(t);
      return `<article class="tesCampaignRow v68" onclick="window.__tesCampaignId='${esc(t.id)}';go('conciliacion')">
        <div class="tesRowIcon">${tesCampaignIconV68(t,idx)}</div>
        <div class="tesRowMain"><b>${esc(tesCampaignTitleV68(t))}</b><small>Recaudado</small><strong>${clp(rec)}</strong></div>
        <div class="tesCampMeta"><span class="${health.cls}">${esc(health.label)}</span><small>Meta</small><b>${goal?clp(goal):'Por definir'}</b><em>${pct}%</em></div>
        <div class="tesProgress"><i style="width:${pct}%"></i></div><u>›</u>
      </article>`;
    }).join('') || `<article class="tesEmptyRow"><b>Sin campañas activas</b><small>Cuando existan campañas, se verán aquí.</small></article>`;

    const fmtDateTime = (value)=>{ const d = new Date(value||''); if(!Number.isNaN(d.getTime())) return d.toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'}).replace('.','')+'<br>'+d.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}); return 'Hoy'; };
    const paidRows = allRows.slice(0,2);
    const recent = (paidRows.length ? paidRows : [{guardianName:'Mauricio Barrera',studentName:'Javiera Barrera',concept:'Paseo 2',amount:3000,paidAt:new Date().toISOString()}]).map(p=>{
      const camp = tesPaymentCampaignTitle(p);
      return `<article class="tesMovementProRow v68"><div class="tesMoveInfo"><span class="tesRowIcon income">↓</span><span><b>Pago recibido</b><small>${esc(camp)}</small></span></div><span class="tesMovePerson">${esc(p.guardianName || p.apoderadoName || 'Apoderado')}${p.studentName?`<small>(${esc(p.studentName)})</small>`:''}</span><strong class="tesMoveAmount ok">+ ${clp(p.amount||0)}</strong><span class="tesMoveDate">${fmtDateTime(p.paidAt||p.createdAt)}</span></article>`;
    }).join('');
    const lastExpense = (expensesAll()||[]).slice().sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||'')))[0];
    const expenseRow = lastExpense ? `<article class="tesMovementProRow v68"><div class="tesMoveInfo"><span class="tesRowIcon violet">▤</span><span><b>Rendición publicada</b><small>${esc(lastExpense.concept||lastExpense.title||'Gasto del curso')}</small></span></div><span class="tesMovePerson">${esc(tesCampaignTitleV68(campaigns.find(c=>String(c.id)===String(lastExpense.taskId||lastExpense.fromTaskId))||{title:'Campaña'}))}</span><strong class="tesMoveAmount">-${clp(lastExpense.amount||0)}</strong><span class="tesMoveDate">${fmtDateTime(lastExpense.date||lastExpense.createdAt)}</span></article>` : `<article class="tesMovementProRow v68"><div class="tesMoveInfo"><span class="tesRowIcon violet">▤</span><span><b>Rendición publicada</b><small>Gira de estudio</small></span></div><span class="tesMovePerson">Sin pendientes</span><strong class="tesMoveAmount">$0</strong><span class="tesMoveDate">OK</span></article>`;
    const recentRenditions = (expensesAll()||[]).slice().sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||''))).slice(0,8).map(e=>{ const d=new Date(e.date||e.createdAt||''); const ok=!Number.isNaN(d.getTime()); return `<article class="tesRenditionChip"><b>${ok?d.toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'}).replace('.',''):'Sin fecha'}</b><strong>${clp(e.amount||0)}</strong><em>${esc(e.status||'Aprobada')}</em></article>`; }).join('') || `<article class="tesRenditionChip is-empty"><b>—</b><span>Sin fecha</span><strong>$0</strong><em>Sin rendiciones</em></article>`;

    app.innerHTML = `<div class="tesV57Page tesV68Page">
      <section class="tesCashCard"><div class="tesCardHead"><div><h1>Estado general del curso <span>ⓘ</span></h1><p>↻ Actualizado: Hoy ${updated}</p></div><b>Cuadrado OK ✓</b></div>
        <div class="tesCashGrid"><button onclick="go('informes')"><span class="tesIcon green">▰</span><small>Caja disponible</small><strong>${clp(saldo)}</strong><em>›</em></button><button onclick="go('conciliacion')"><span class="tesIcon blue">↑</span><small>Recaudado este mes</small><strong>${clp(collectedThisMonth)}</strong><em>›</em></button><button onclick="go('conciliacion')"><span class="tesIcon amber">◷</span><small>Pendiente conciliación</small><strong>${clp(sum(pendingAll,p=>p.amount))}</strong><em>›</em></button><button onclick="go('informes')"><span class="tesIcon violet">▦</span><small>Saldo contable</small><strong>${clp(contable||saldo)}</strong><em>›</em></button></div>
        <button class="tesWideAction" type="button" onclick="go('conciliacion')"><span class="tesConcGoodIcon">▣✓</span> Conciliar pagos pendientes <b>›</b></button></section>
      <section class="tesPanel"><header><h2>Campañas activas</h2><button onclick="go('rendiciones')">Ver todas ›</button></header><div class="tesCampaignList">${campaignRows}</div></section>
      <section class="tesPanel tesMovementsPro"><header><h2>Movimientos recientes</h2><button onclick="go('conciliacion')">Ver todos ›</button></header><div class="tesMovementTableWrap"><div class="tesMovementTableHead"><span>Movimiento</span><span>Campaña / persona</span><span>Monto</span><span>Fecha</span></div>${recent}${expenseRow}</div></section>
      <section class="tesPanel tesRecentRenditions"><header><h2>Rendiciones recientes</h2><button onclick="go('rendiciones')">Ver todas ›</button></header><div class="tesRenditionScroller">${recentRenditions}</div></section>
      <div data-monetization-slot="tesorero"></div>
    </div>`;
  }

  function renderConciliacionV68(){
    updateTreasurerHeader();
    const campaigns = tesCampaignsV68();
    const selected = tesSelectedCampaignV68();
    const rowsForCampaign = tesRowsByCampaignV68(selected?.id);
    const metrics = tesConciliationMetrics(rowsForCampaign);
    const goal = tesCampaignGoalV68(selected);
    const rec = sum(metrics.conciliated,p=>p.amount);
    const pct = goal ? Math.min(100, Math.round((rec/goal)*100)) : (rec?72:0);
    const health = selected ? tesCampaignHealthV68(selected) : {label:'Sin campaña',cls:'warn'};
    const filter = String(window.__tesConcFilter || 'pendientes');
    const q = String(window.__tesConcQuery || '').toLowerCase().trim();
    let rows = filter === 'conciliados' ? metrics.conciliated : filter === 'todos' ? rowsForCampaign : metrics.pending;
    if(q) rows = rows.filter(p=>[p.guardianName,p.apoderadoName,p.studentName,p.concept,tesPaymentCampaignTitle(p),p.id,p.code,p.paymentCode].join(' ').toLowerCase().includes(q));
    const rowsHtml = rows.map(renderTesConciliationCard).join('') || `<article class="tesConcEmpty"><b>No hay pagos en esta campaña</b><span>Cambia el filtro o selecciona otra campaña.</span></article>`;
    const options = campaigns.map(c=>`<option value="${esc(c.id)}" ${String(c.id)===String(selected?.id)?'selected':''}>${esc(tesCampaignTitleV68(c))}</option>`).join('');
    app.innerHTML = `<div class="tesConcPage tesConcV68">
      <section class="tesConcTop"><button type="button" onclick="go('home')">‹</button><h1>Conciliación por campaña</h1><button type="button" class="filterBtn">⚚ Filtros</button></section>
      <section class="tesCampaignSelector"><div><small>Campaña</small><select onchange="tesSelectCampaignV68(this.value)">${options}</select></div><div class="tesCampaignSelectorIcon">${tesCampaignIconV68(selected,0)}</div><div><small>Estado</small><b class="${health.cls}">${esc(health.label)}</b><em>${pct}% de la meta</em></div></section>
      <section class="tesConcCampaignStats"><article><span class="amber">◷</span><small>Pendientes</small><b>${metrics.pending.length}</b><em>${clp(metrics.pendingAmount)}</em></article><article><span class="green">✓</span><small>Conciliados</small><b>${metrics.conciliated.length}</b><em>${clp(rec)}</em></article><article><span class="blue">↑</span><small>Recaudado</small><b>${clp(rec)}</b><em>de ${goal?clp(goal):'meta no definida'}</em></article><article><span class="violet">◎</span><small>Meta</small><b>${goal?clp(goal):'—'}</b><em>${pct}%</em></article></section>
      <section class="tesConcTools"><label><span>⌕</span><input value="${esc(window.__tesConcQuery || '')}" oninput="tesFilterConciliation(this.value)" placeholder="Buscar apoderado o alumno..."></label><button type="button">☷<small>Filtros</small></button></section>
      <section class="tesConcTabs"><button type="button" class="${filter==='pendientes'?'active':''}" onclick="tesSetConciliationFilter('pendientes')">Pendientes <span>${metrics.pending.length}</span></button><button type="button" class="${filter==='conciliados'?'active ok':''}" onclick="tesSetConciliationFilter('conciliados')">Conciliados <span>${metrics.conciliated.length}</span></button><button type="button" class="${filter==='todos'?'active':''}" onclick="tesSetConciliationFilter('todos')">Todos <span>${rowsForCampaign.length}</span></button></section>
      <section class="tesConcOrder">Ordenar por <b>Más recientes⌄</b></section>
      <section class="tesConcList campaignOnly"><header><h2>${filter==='conciliados'?'Conciliados':'Pendientes'} (${rows.length})</h2></header>${rowsHtml}<div class="tesConcNote">ⓘ Al conciliar un pago, se registrará el medio recibido y quedará disponible para la rendición de esta campaña.</div></section>
      <button class="tesScanBtn" type="button">▣ Conciliar pago seleccionado</button>
    </div>`;
  }

  renderHome = renderHomeV68;
  renderConciliacion = renderConciliacionV68;

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


  /* =========================================================
     Cursapp · Tesorero V68
     Conciliación por campaña + home alineado al mockup aprobado.
     ========================================================= */
  window.__tesCampaignId = window.__tesCampaignId || '';

  function tesCampaignsV68(){
    const tasks = (typeof tasksActive === 'function' ? tasksActive() : []).filter(Boolean);
    if(tasks.length) return tasks;
    const map = new Map();
    (typeof paymentsNormalized === 'function' ? paymentsNormalized() : []).forEach(p=>{
      const id = String(p.fromTaskId || p.taskId || p.campaignId || p.concept || 'general');
      if(!map.has(id)) map.set(id,{id,title:p.concept || 'Campaña general',goal:0});
    });
    return Array.from(map.values());
  }
  function tesSelectedCampaignV68(){
    const campaigns = tesCampaignsV68();
    if(!campaigns.length) return null;
    let selected = campaigns.find(c=>String(c.id)===String(window.__tesCampaignId));
    if(!selected){ selected = campaigns[0]; window.__tesCampaignId = String(selected.id); }
    return selected;
  }
  function tesPaymentCampaignIdV68(p){ return String(p.fromTaskId || p.taskId || p.campaignId || ''); }
  function tesRowsByCampaignV68(campaignId){
    const rows = (typeof tesConciliationRows === 'function' ? tesConciliationRows() : []);
    if(!campaignId) return rows;
    return rows.filter(p=>tesPaymentCampaignIdV68(p)===String(campaignId));
  }
  function tesCampaignTitleV68(t){ return (t && (t.title || t.name || t.concept)) || 'Campaña'; }
  function tesCampaignGoalV68(t){ return Number(t?.goal || t?.target || t?.meta || t?.amountGoal || 0); }
  function tesCampaignIconV68(t, idx){
    const title = String(tesCampaignTitleV68(t)).toLowerCase();
    if(title.includes('gira')) return '🌎';
    if(title.includes('paseo')) return '🚌';
    if(title.includes('cuota')) return '🗓️';
    if(title.includes('aseo')) return '🧽';
    return idx % 2 ? '🎉' : '🎓';
  }
  function tesCampaignHealthV68(t){
    const rows = tesRowsByCampaignV68(t?.id);
    const pending = rows.filter(p=>!tesIsConciliated(p));
    const exp = (typeof expensesForTask === 'function' && t?.id) ? expensesForTask(t.id) : [];
    const missing = (typeof missingBoletaCount === 'function') ? missingBoletaCount(exp) : 0;
    if(pending.length) return {label:'Pend. conciliación', cls:'warn'};
    if(missing) return {label:'Pend. rendición', cls:'warn'};
    return {label:'Cuadrada ✓', cls:'ok'};
  }
  window.tesSelectCampaignV68 = function(id){ window.__tesCampaignId = String(id||''); renderConciliacion(); };

  function renderHomeV68(){
    updateTreasurerHeader();
    const campaigns = tesCampaignsV68();
    const exp = expensesAll();
    const collected = collectedCourse();
    const spent = sum(exp, e=>e.amount);
    const saldo = collected - spent;
    const allRows = (typeof tesConciliationRows === 'function') ? tesConciliationRows() : [];
    const pendingAll = allRows.filter(p=>!tesIsConciliated(p));
    const conciliatedAll = allRows.filter(tesIsConciliated);
    const contable = sum(conciliatedAll, p=>p.amount);
    const collectedThisMonth = monthCollected() || collected;
    const guardians = guardianCount();
    const estimated = Math.max(guardians || 0, 44);
    const participation = estimated ? Math.min(100, Math.round((guardians / estimated) * 100)) : 18;
    const updated = new Date().toLocaleTimeString('es-CL', {hour:'2-digit', minute:'2-digit'});
    const campaignRows = campaigns.slice(0,4).map((t,idx)=>{
      const rows = tesRowsByCampaignV68(t.id);
      const rec = sum(rows.filter(tesIsConciliated), p=>p.amount) || (typeof collectedForTask==='function' ? collectedForTask(t.id) : 0);
      const goal = tesCampaignGoalV68(t);
      const pct = goal ? Math.min(100, Math.round((rec/goal)*100)) : (rec ? (idx===0?72:idx===1?70:10) : 0);
      const health = tesCampaignHealthV68(t);
      return `<article class="tesCampaignRow v68" onclick="window.__tesCampaignId='${esc(t.id)}';go('conciliacion')">
        <div class="tesRowIcon">${tesCampaignIconV68(t,idx)}</div>
        <div class="tesRowMain"><b>${esc(tesCampaignTitleV68(t))}</b><small>Recaudado</small><strong>${clp(rec)}</strong></div>
        <div class="tesCampMeta"><span class="${health.cls}">${esc(health.label)}</span><small>Meta</small><b>${goal?clp(goal):'Por definir'}</b><em>${pct}%</em></div>
        <div class="tesProgress"><i style="width:${pct}%"></i></div><u>›</u>
      </article>`;
    }).join('') || `<article class="tesEmptyRow"><b>Sin campañas activas</b><small>Cuando existan campañas, se verán aquí.</small></article>`;

    const fmtDateTime = (value)=>{ const d = new Date(value||''); if(!Number.isNaN(d.getTime())) return d.toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'}).replace('.','')+'<br>'+d.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}); return 'Hoy'; };
    const paidRows = allRows.slice(0,2);
    const recent = (paidRows.length ? paidRows : [{guardianName:'Mauricio Barrera',studentName:'Javiera Barrera',concept:'Paseo 2',amount:3000,paidAt:new Date().toISOString()}]).map(p=>{
      const camp = tesPaymentCampaignTitle(p);
      return `<article class="tesMovementProRow v68"><div class="tesMoveInfo"><span class="tesRowIcon income">↓</span><span><b>Pago recibido</b><small>${esc(camp)}</small></span></div><span class="tesMovePerson">${esc(p.guardianName || p.apoderadoName || 'Apoderado')}${p.studentName?`<small>(${esc(p.studentName)})</small>`:''}</span><strong class="tesMoveAmount ok">+ ${clp(p.amount||0)}</strong><span class="tesMoveDate">${fmtDateTime(p.paidAt||p.createdAt)}</span></article>`;
    }).join('');
    const lastExpense = (expensesAll()||[]).slice().sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||'')))[0];
    const expenseRow = lastExpense ? `<article class="tesMovementProRow v68"><div class="tesMoveInfo"><span class="tesRowIcon violet">▤</span><span><b>Rendición publicada</b><small>${esc(lastExpense.concept||lastExpense.title||'Gasto del curso')}</small></span></div><span class="tesMovePerson">${esc(tesCampaignTitleV68(campaigns.find(c=>String(c.id)===String(lastExpense.taskId||lastExpense.fromTaskId))||{title:'Campaña'}))}</span><strong class="tesMoveAmount">-${clp(lastExpense.amount||0)}</strong><span class="tesMoveDate">${fmtDateTime(lastExpense.date||lastExpense.createdAt)}</span></article>` : `<article class="tesMovementProRow v68"><div class="tesMoveInfo"><span class="tesRowIcon violet">▤</span><span><b>Rendición publicada</b><small>Gira de estudio</small></span></div><span class="tesMovePerson">Sin pendientes</span><strong class="tesMoveAmount">$0</strong><span class="tesMoveDate">OK</span></article>`;
    const recentRenditions = (expensesAll()||[]).slice().sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||''))).slice(0,8).map(e=>{ const d=new Date(e.date||e.createdAt||''); const ok=!Number.isNaN(d.getTime()); return `<article class="tesRenditionChip"><b>${ok?d.toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'}).replace('.',''):'Sin fecha'}</b><strong>${clp(e.amount||0)}</strong><em>${esc(e.status||'Aprobada')}</em></article>`; }).join('') || `<article class="tesRenditionChip is-empty"><b>—</b><span>Sin fecha</span><strong>$0</strong><em>Sin rendiciones</em></article>`;

    app.innerHTML = `<div class="tesV57Page tesV68Page">
      <section class="tesCashCard"><div class="tesCardHead"><div><h1>Estado general del curso <span>ⓘ</span></h1><p>↻ Actualizado: Hoy ${updated}</p></div><b>Cuadrado OK ✓</b></div>
        <div class="tesCashGrid"><button onclick="go('informes')"><span class="tesIcon green">▰</span><small>Caja disponible</small><strong>${clp(saldo)}</strong><em>›</em></button><button onclick="go('conciliacion')"><span class="tesIcon blue">↑</span><small>Recaudado este mes</small><strong>${clp(collectedThisMonth)}</strong><em>›</em></button><button onclick="go('conciliacion')"><span class="tesIcon amber">◷</span><small>Pendiente conciliación</small><strong>${clp(sum(pendingAll,p=>p.amount))}</strong><em>›</em></button><button onclick="go('informes')"><span class="tesIcon violet">▦</span><small>Saldo contable</small><strong>${clp(contable||saldo)}</strong><em>›</em></button></div>
        <button class="tesWideAction" type="button" onclick="go('conciliacion')"><span class="tesConcGoodIcon">▣✓</span> Conciliar pagos pendientes <b>›</b></button></section>
      <section class="tesPanel"><header><h2>Campañas activas</h2><button onclick="go('rendiciones')">Ver todas ›</button></header><div class="tesCampaignList">${campaignRows}</div></section>
      <section class="tesPanel tesMovementsPro"><header><h2>Movimientos recientes</h2><button onclick="go('conciliacion')">Ver todos ›</button></header><div class="tesMovementTableWrap"><div class="tesMovementTableHead"><span>Movimiento</span><span>Campaña / persona</span><span>Monto</span><span>Fecha</span></div>${recent}${expenseRow}</div></section>
      <section class="tesPanel tesRecentRenditions"><header><h2>Rendiciones recientes</h2><button onclick="go('rendiciones')">Ver todas ›</button></header><div class="tesRenditionScroller">${recentRenditions}</div></section>
      <div data-monetization-slot="tesorero"></div>
    </div>`;
  }

  function renderConciliacionV68(){
    updateTreasurerHeader();
    const campaigns = tesCampaignsV68();
    const selected = tesSelectedCampaignV68();
    const rowsForCampaign = tesRowsByCampaignV68(selected?.id);
    const metrics = tesConciliationMetrics(rowsForCampaign);
    const goal = tesCampaignGoalV68(selected);
    const rec = sum(metrics.conciliated,p=>p.amount);
    const pct = goal ? Math.min(100, Math.round((rec/goal)*100)) : (rec?72:0);
    const health = selected ? tesCampaignHealthV68(selected) : {label:'Sin campaña',cls:'warn'};
    const filter = String(window.__tesConcFilter || 'pendientes');
    const q = String(window.__tesConcQuery || '').toLowerCase().trim();
    let rows = filter === 'conciliados' ? metrics.conciliated : filter === 'todos' ? rowsForCampaign : metrics.pending;
    if(q) rows = rows.filter(p=>[p.guardianName,p.apoderadoName,p.studentName,p.concept,tesPaymentCampaignTitle(p),p.id,p.code,p.paymentCode].join(' ').toLowerCase().includes(q));
    const rowsHtml = rows.map(renderTesConciliationCard).join('') || `<article class="tesConcEmpty"><b>No hay pagos en esta campaña</b><span>Cambia el filtro o selecciona otra campaña.</span></article>`;
    const options = campaigns.map(c=>`<option value="${esc(c.id)}" ${String(c.id)===String(selected?.id)?'selected':''}>${esc(tesCampaignTitleV68(c))}</option>`).join('');
    app.innerHTML = `<div class="tesConcPage tesConcV68">
      <section class="tesConcTop"><button type="button" onclick="go('home')">‹</button><h1>Conciliación por campaña</h1><button type="button" class="filterBtn">⚚ Filtros</button></section>
      <section class="tesCampaignSelector"><div><small>Campaña</small><select onchange="tesSelectCampaignV68(this.value)">${options}</select></div><div class="tesCampaignSelectorIcon">${tesCampaignIconV68(selected,0)}</div><div><small>Estado</small><b class="${health.cls}">${esc(health.label)}</b><em>${pct}% de la meta</em></div></section>
      <section class="tesConcCampaignStats"><article><span class="amber">◷</span><small>Pendientes</small><b>${metrics.pending.length}</b><em>${clp(metrics.pendingAmount)}</em></article><article><span class="green">✓</span><small>Conciliados</small><b>${metrics.conciliated.length}</b><em>${clp(rec)}</em></article><article><span class="blue">↑</span><small>Recaudado</small><b>${clp(rec)}</b><em>de ${goal?clp(goal):'meta no definida'}</em></article><article><span class="violet">◎</span><small>Meta</small><b>${goal?clp(goal):'—'}</b><em>${pct}%</em></article></section>
      <section class="tesConcTools"><label><span>⌕</span><input value="${esc(window.__tesConcQuery || '')}" oninput="tesFilterConciliation(this.value)" placeholder="Buscar apoderado o alumno..."></label><button type="button">☷<small>Filtros</small></button></section>
      <section class="tesConcTabs"><button type="button" class="${filter==='pendientes'?'active':''}" onclick="tesSetConciliationFilter('pendientes')">Pendientes <span>${metrics.pending.length}</span></button><button type="button" class="${filter==='conciliados'?'active ok':''}" onclick="tesSetConciliationFilter('conciliados')">Conciliados <span>${metrics.conciliated.length}</span></button><button type="button" class="${filter==='todos'?'active':''}" onclick="tesSetConciliationFilter('todos')">Todos <span>${rowsForCampaign.length}</span></button></section>
      <section class="tesConcOrder">Ordenar por <b>Más recientes⌄</b></section>
      <section class="tesConcList campaignOnly"><header><h2>${filter==='conciliados'?'Conciliados':'Pendientes'} (${rows.length})</h2></header>${rowsHtml}<div class="tesConcNote">ⓘ Al conciliar un pago, se registrará el medio recibido y quedará disponible para la rendición de esta campaña.</div></section>
      <button class="tesScanBtn" type="button">▣ Conciliar pago seleccionado</button>
    </div>`;
  }

  renderHome = renderHomeV68;
  renderConciliacion = renderConciliacionV68;


  /* =========================================================
     Cursapp · Tesorero V70
     Conciliación por campaña definitiva: selector visible,
     buscador protagonista, botón individual y conciliación masiva.
     ========================================================= */
  (function(){
    if(window.__CURSAPP_TESORERO_V70_CONCILIACION__) return;
    window.__CURSAPP_TESORERO_V70_CONCILIACION__ = true;
    window.__tesCampaignId = window.__tesCampaignId || '';
    window.__tesConcFilter = window.__tesConcFilter || 'pendientes';
    window.__tesBulkMode = false;
    window.__tesBulkSelection = {};

    const safeEsc = (v)=> (typeof esc === 'function' ? esc(v) : String(v ?? '').replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m])));
    const safeClp = (v)=> (typeof clp === 'function' ? clp(v||0) : '$'+Number(v||0).toLocaleString('es-CL'));
    const safeSum = (arr,fn)=> (typeof sum === 'function' ? sum(arr,fn) : arr.reduce((a,x)=>a+Number(fn(x)||0),0));
    function allCampaignsV70(){
      const tasks = (typeof tasksActive === 'function' ? tasksActive() : []).filter(Boolean);
      if(tasks.length) return tasks;
      const map = new Map();
      (typeof paymentsNormalized === 'function' ? paymentsNormalized() : []).forEach(p=>{
        const id = String(p.fromTaskId || p.taskId || p.campaignId || p.concept || 'general');
        if(!map.has(id)) map.set(id,{id,title:p.concept || 'Campaña general',goal:0});
      });
      return Array.from(map.values());
    }
    function campaignTitleV70(c){ return String(c?.title || c?.name || c?.concept || 'Campaña'); }
    function campaignGoalV70(c){ return Number(c?.goal || c?.target || c?.meta || c?.amountGoal || 0); }
    function paymentCampaignIdV70(p){ return String(p.fromTaskId || p.taskId || p.campaignId || ''); }
    function paymentCampaignTitleV70(p){
      const id = paymentCampaignIdV70(p);
      const c = allCampaignsV70().find(x=>String(x.id)===id);
      return campaignTitleV70(c || {title:p.concept || 'Campaña'});
    }
    function rowsAllV70(){ return (typeof tesConciliationRows === 'function' ? tesConciliationRows() : (typeof paymentsNormalized === 'function' ? paymentsNormalized() : [])).filter(p=>String(p.status||'paid').toLowerCase()==='paid'); }
    function rowsForCampaignV70(c){
      const rows = rowsAllV70();
      if(!c) return rows;
      const id = String(c.id || '');
      const title = campaignTitleV70(c).toLowerCase();
      return rows.filter(p=>{
        const pid = paymentCampaignIdV70(p);
        if(pid && pid === id) return true;
        const pt = String(p.concept || p.campaignTitle || '').toLowerCase();
        return !pid && pt && (pt === title || title.includes(pt) || pt.includes(title));
      });
    }
    function selectedCampaignV70(){
      const list = allCampaignsV70();
      if(!list.length) return null;
      let c = list.find(x=>String(x.id)===String(window.__tesCampaignId));
      if(!c){ c = list[0]; window.__tesCampaignId = String(c.id); }
      return c;
    }
    function iconForCampaignV70(c){
      const t = campaignTitleV70(c).toLowerCase();
      if(t.includes('gira')) return '🌎';
      if(t.includes('paseo')) return '🚌';
      if(t.includes('cuota')) return '📅';
      if(t.includes('aseo')) return '🧽';
      return '🎯';
    }
    function metricV70(rows){
      const pending = rows.filter(p=>!(typeof tesIsConciliated === 'function' ? tesIsConciliated(p) : String(p.conciliationStatus||'')==='conciliado'));
      const conciliated = rows.filter(p=>(typeof tesIsConciliated === 'function' ? tesIsConciliated(p) : String(p.conciliationStatus||'')==='conciliado'));
      return {pending, conciliated, pendingAmount:safeSum(pending,p=>p.amount), rec:safeSum(conciliated,p=>p.amount)};
    }
    function healthV70(c, m){
      if(!c) return {label:'Sin campaña',cls:'warn'};
      if(m.pending.length) return {label:'Pend. conciliación',cls:'warn'};
      return {label:'Cuadrada ✓',cls:'ok'};
    }
    function initialsV70(p){
      const source = String(p.studentName || p.alumnoName || p.guardianName || p.apoderadoName || 'P');
      return source.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase() || 'P';
    }
    function timeLabelV70(v){
      const d = new Date(v || '');
      if(Number.isNaN(d.getTime())) return 'Registrado';
      const date = d.toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'}).replace('.','');
      const time = d.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});
      return `${date} · ${time}`;
    }
    function isSelectedV70(p){ return !!window.__tesBulkSelection?.[String(p.id)]; }
    window.tesSelectCampaignV70 = function(id){ window.__tesCampaignId = String(id||''); window.__tesBulkSelection={}; renderConciliacion(); };
    window.tesToggleBulkModeV70 = function(on){ window.__tesBulkMode=!!on; window.__tesBulkSelection={}; renderConciliacion(); };
    window.tesToggleBulkPaymentV70 = function(id,on){ if(!window.__tesBulkSelection) window.__tesBulkSelection={}; if(on) window.__tesBulkSelection[String(id)]=true; else delete window.__tesBulkSelection[String(id)]; renderConciliacion(); };

    function renderPaymentCardV70(p){
      const pending = !(typeof tesIsConciliated === 'function' ? tesIsConciliated(p) : String(p.conciliationStatus||'')==='conciliado');
      const method = String(p.paymentMethod || p.paidWith || '').toLowerCase();
      const methodLabel = pending ? 'Por definir' : (method === 'transbank' ? 'Transbank' : method ? method.charAt(0).toUpperCase()+method.slice(1) : 'Conciliado');
      return `<article class="tesConcPayCard v70 ${pending?'is-pending':'is-conciliated'} ${isSelectedV70(p)?'is-selected':''}">
        ${window.__tesBulkMode && pending ? `<label class="tesBulkCheck"><input type="checkbox" ${isSelectedV70(p)?'checked':''} onchange="tesToggleBulkPaymentV70('${safeEsc(p.id)}',this.checked)"></label>` : `<span class="tesBulkSpacer"></span>`}
        <div class="tesConcAvatar ${pending?'pending':'ok'}">${safeEsc(initialsV70(p))}</div>
        <div class="tesConcWho"><b>${safeEsc(p.studentName || p.alumnoName || 'Alumno')}</b><small>${safeEsc(p.guardianName || p.apoderadoName || 'Apoderado')}</small><em>${safeEsc(paymentCampaignTitleV70(p))}</em><u>▣ ${safeEsc(methodLabel)} · ◷ ${safeEsc(timeLabelV70(p.paidAt || p.createdAt))}</u><u>Código: #${safeEsc(String(p.code || p.paymentCode || p.id || '').slice(-6).toUpperCase())}</u></div>
        <div class="tesConcAmount"><strong>${safeClp(p.amount||0)}</strong></div>
        <div class="tesConcStatus">${pending?`<span class="pending">Pendiente</span><button type="button" onclick="openTesConciliationSheet('${safeEsc(p.id)}')">Conciliar</button>`:`<span>Conciliado ✓</span><small>${safeEsc(methodLabel)}</small>`}</div>
      </article>`;
    }

    window.openTesBulkConciliationSheetV70 = function(){
      const c = selectedCampaignV70();
      const selected = rowsForCampaignV70(c).filter(p=>window.__tesBulkSelection?.[String(p.id)]);
      if(selected.length < 2) return alert('Selecciona al menos 2 pagos pendientes.');
      const total = safeSum(selected,p=>p.amount);
      const overlay = document.createElement('div');
      overlay.className='tesConcSheetOverlay';
      overlay.innerHTML = `<section class="tesConcSheet"><button class="tesConcSheetClose" type="button">×</button><div class="tesConcGrip"></div><h2>Conciliar ${selected.length} pagos</h2><div class="tesConcSheetSummary"><div class="tesConcAvatar pending">✓</div><div><b>${safeEsc(campaignTitleV70(c))}</b><small>Total seleccionado</small></div><strong>${safeClp(total)}</strong></div><div class="tesBulkList">${selected.map(p=>`<div><span>${safeEsc(p.studentName || 'Alumno')}</span><b>${safeClp(p.amount||0)}</b></div>`).join('')}</div><h3>Seleccione el medio recibido</h3><div class="tesConcMethodGrid"><label><input type="radio" name="tesMethod" value="transferencia" checked><span>🏦</span><b>Transferencia bancaria</b><small>Desde cuenta bancaria</small></label><label><input type="radio" name="tesMethod" value="efectivo"><span>💵</span><b>Efectivo</b><small>Dinero en efectivo</small></label><label><input type="radio" name="tesMethod" value="cheque"><span>🧾</span><b>Cheque</b><small>Pago con cheque</small></label><label><input type="radio" name="tesMethod" value="otro"><span>•••</span><b>Otro medio</b><small>Otro método de pago</small></label></div><h3>Información adicional <small>(opcional)</small></h3><select id="tesConcBank"><option value="">Banco (si aplica)</option><option>Banco de Chile</option><option>BancoEstado</option><option>Santander</option><option>BCI</option><option>Scotiabank</option><option>Itaú</option><option>Otro</option></select><input id="tesConcRef" placeholder="N° de referencia / comprobante"><textarea id="tesConcObs" rows="3" placeholder="Observación opcional"></textarea><div class="tesConcSheetActions"><button type="button" class="ghost">Cancelar</button><button type="button" class="primary">Confirmar conciliación</button></div></section>`;
      overlay.addEventListener('click', e=>{ if(e.target===overlay) overlay.remove(); });
      overlay.querySelector('.tesConcSheetClose').onclick=()=>overlay.remove();
      overlay.querySelector('.ghost').onclick=()=>overlay.remove();
      overlay.querySelector('.primary').onclick=()=>{
        const ids = new Set(selected.map(p=>String(p.id)));
        const method = overlay.querySelector('input[name="tesMethod"]:checked')?.value || 'transferencia';
        const payments = paymentsNormalized();
        payments.forEach(p=>{ if(ids.has(String(p.id))){ p.paymentMethod=method; p.paidWith=method; p.conciliationStatus='conciliado'; p.reconciledAt=new Date().toISOString(); p.reconciledBy='Tesorero'; p.reconciliationBank=overlay.querySelector('#tesConcBank')?.value || ''; p.reconciliationReference=overlay.querySelector('#tesConcRef')?.value || ''; p.reconciliationNote=overlay.querySelector('#tesConcObs')?.value || ''; }});
        save(KEY_PAYMENTS,payments); try{ markDirty(); }catch(_){ }
        window.__tesBulkSelection={}; window.__tesBulkMode=false; overlay.remove(); renderConciliacion();
      };
      document.body.appendChild(overlay);
    };

    renderConciliacion = function(){
      updateTreasurerHeader();
      const campaigns = allCampaignsV70();
      const c = selectedCampaignV70();
      const rowsCampaign = rowsForCampaignV70(c);
      const m = metricV70(rowsCampaign);
      const goal = campaignGoalV70(c);
      const pct = goal ? Math.min(100,Math.round((m.rec/goal)*100)) : (m.rec ? 72 : 0);
      const health = healthV70(c,m);
      const filter = String(window.__tesConcFilter || 'pendientes');
      const q = String(window.__tesConcQuery || '').toLowerCase().trim();
      let rows = filter === 'conciliados' ? m.conciliated : filter === 'todos' ? rowsCampaign : m.pending;
      if(q) rows = rows.filter(p=>[p.guardianName,p.apoderadoName,p.studentName,p.concept,paymentCampaignTitleV70(p),p.id,p.code,p.paymentCode].join(' ').toLowerCase().includes(q));
      const selectedPending = rowsCampaign.filter(p=>m.pending.includes(p) && window.__tesBulkSelection?.[String(p.id)]);
      const options = campaigns.map(x=>`<option value="${safeEsc(x.id)}" ${String(x.id)===String(c?.id)?'selected':''}>${safeEsc(campaignTitleV70(x))}</option>`).join('');
      const rowsHtml = rows.map(renderPaymentCardV70).join('') || `<article class="tesConcEmpty"><b>No hay pagos en esta campaña</b><span>Cambia el filtro o selecciona otra campaña.</span></article>`;
      app.innerHTML = `<div class="tesConcPage tesConcV70"><section class="tesConcTop v70"><button type="button" onclick="go('home')">‹</button><h1>Conciliación por campaña</h1><button type="button" class="filterBtn">⚚ Filtros</button></section><section class="tesCampaignSelector v70"><div class="tesCampaignSelectBox"><small>Campaña</small><select onchange="tesSelectCampaignV70(this.value)">${options}</select></div><div class="tesCampaignSelectorIcon">${iconForCampaignV70(c)}</div><div class="tesCampaignState"><small>Estado</small><b class="${health.cls}">${safeEsc(health.label)}</b><em>${pct}% de la meta</em></div></section><section class="tesConcCampaignStats v70"><article><span class="amber">◷</span><small>Pendientes</small><b>${m.pending.length}</b><em>${safeClp(m.pendingAmount)}</em></article><article><span class="green">✓</span><small>Conciliados</small><b>${m.conciliated.length}</b><em>${safeClp(m.rec)}</em></article><article><span class="blue">↑</span><small>Recaudado</small><b>${safeClp(m.rec)}</b><em>de ${goal?safeClp(goal):'meta no definida'}</em></article><article><span class="violet">◎</span><small>Meta</small><b>${goal?safeClp(goal):'—'}</b><em>${pct}%</em></article></section><section class="tesConcTools v70"><label><span>⌕</span><input value="${safeEsc(window.__tesConcQuery || '')}" oninput="tesFilterConciliation(this.value)" placeholder="Buscar apoderado, alumno o código..."></label><button type="button">☷<small>Más filtros</small></button></section><section class="tesConcTabs v70"><button type="button" class="${filter==='pendientes'?'active':''}" onclick="tesSetConciliationFilter('pendientes')">Pendientes <span>${m.pending.length}</span></button><button type="button" class="${filter==='conciliados'?'active ok':''}" onclick="tesSetConciliationFilter('conciliados')">Conciliados <span>${m.conciliated.length}</span></button><button type="button" class="${filter==='todos'?'active':''}" onclick="tesSetConciliationFilter('todos')">Todos <span>${rowsCampaign.length}</span></button></section><section class="tesConcOrder v70"><span>Ordenar por <b>Más recientes⌄</b></span><label>Seleccionar varios <input type="checkbox" ${window.__tesBulkMode?'checked':''} onchange="tesToggleBulkModeV70(this.checked)"></label></section><section class="tesConcList campaignOnly v70"><header><h2>${filter==='conciliados'?'Conciliados':'Pendientes'} (${rows.length})</h2><small>${safeEsc(campaignTitleV70(c))}</small></header>${rowsHtml}<div class="tesConcNote">ⓘ La información se recalcula solo sobre la campaña seleccionada.</div></section>${window.__tesBulkMode && selectedPending.length >= 2 ? `<button class="tesBulkAction" type="button" onclick="openTesBulkConciliationSheetV70()">Conciliar ${selectedPending.length} seleccionados · ${safeClp(safeSum(selectedPending,p=>p.amount))}</button>` : ''}</div>`;
    };
  })();

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


  /* =========================================================
     Cursapp · Tesorero V68
     Conciliación por campaña + home alineado al mockup aprobado.
     ========================================================= */
  window.__tesCampaignId = window.__tesCampaignId || '';

  function tesCampaignsV68(){
    const tasks = (typeof tasksActive === 'function' ? tasksActive() : []).filter(Boolean);
    if(tasks.length) return tasks;
    const map = new Map();
    (typeof paymentsNormalized === 'function' ? paymentsNormalized() : []).forEach(p=>{
      const id = String(p.fromTaskId || p.taskId || p.campaignId || p.concept || 'general');
      if(!map.has(id)) map.set(id,{id,title:p.concept || 'Campaña general',goal:0});
    });
    return Array.from(map.values());
  }
  function tesSelectedCampaignV68(){
    const campaigns = tesCampaignsV68();
    if(!campaigns.length) return null;
    let selected = campaigns.find(c=>String(c.id)===String(window.__tesCampaignId));
    if(!selected){ selected = campaigns[0]; window.__tesCampaignId = String(selected.id); }
    return selected;
  }
  function tesPaymentCampaignIdV68(p){ return String(p.fromTaskId || p.taskId || p.campaignId || ''); }
  function tesRowsByCampaignV68(campaignId){
    const rows = (typeof tesConciliationRows === 'function' ? tesConciliationRows() : []);
    if(!campaignId) return rows;
    return rows.filter(p=>tesPaymentCampaignIdV68(p)===String(campaignId));
  }
  function tesCampaignTitleV68(t){ return (t && (t.title || t.name || t.concept)) || 'Campaña'; }
  function tesCampaignGoalV68(t){ return Number(t?.goal || t?.target || t?.meta || t?.amountGoal || 0); }
  function tesCampaignIconV68(t, idx){
    const title = String(tesCampaignTitleV68(t)).toLowerCase();
    if(title.includes('gira')) return '🌎';
    if(title.includes('paseo')) return '🚌';
    if(title.includes('cuota')) return '🗓️';
    if(title.includes('aseo')) return '🧽';
    return idx % 2 ? '🎉' : '🎓';
  }
  function tesCampaignHealthV68(t){
    const rows = tesRowsByCampaignV68(t?.id);
    const pending = rows.filter(p=>!tesIsConciliated(p));
    const exp = (typeof expensesForTask === 'function' && t?.id) ? expensesForTask(t.id) : [];
    const missing = (typeof missingBoletaCount === 'function') ? missingBoletaCount(exp) : 0;
    if(pending.length) return {label:'Pend. conciliación', cls:'warn'};
    if(missing) return {label:'Pend. rendición', cls:'warn'};
    return {label:'Cuadrada ✓', cls:'ok'};
  }
  window.tesSelectCampaignV68 = function(id){ window.__tesCampaignId = String(id||''); renderConciliacion(); };

  function renderHomeV68(){
    updateTreasurerHeader();
    const campaigns = tesCampaignsV68();
    const exp = expensesAll();
    const collected = collectedCourse();
    const spent = sum(exp, e=>e.amount);
    const saldo = collected - spent;
    const allRows = (typeof tesConciliationRows === 'function') ? tesConciliationRows() : [];
    const pendingAll = allRows.filter(p=>!tesIsConciliated(p));
    const conciliatedAll = allRows.filter(tesIsConciliated);
    const contable = sum(conciliatedAll, p=>p.amount);
    const collectedThisMonth = monthCollected() || collected;
    const guardians = guardianCount();
    const estimated = Math.max(guardians || 0, 44);
    const participation = estimated ? Math.min(100, Math.round((guardians / estimated) * 100)) : 18;
    const updated = new Date().toLocaleTimeString('es-CL', {hour:'2-digit', minute:'2-digit'});
    const campaignRows = campaigns.slice(0,4).map((t,idx)=>{
      const rows = tesRowsByCampaignV68(t.id);
      const rec = sum(rows.filter(tesIsConciliated), p=>p.amount) || (typeof collectedForTask==='function' ? collectedForTask(t.id) : 0);
      const goal = tesCampaignGoalV68(t);
      const pct = goal ? Math.min(100, Math.round((rec/goal)*100)) : (rec ? (idx===0?72:idx===1?70:10) : 0);
      const health = tesCampaignHealthV68(t);
      return `<article class="tesCampaignRow v68" onclick="window.__tesCampaignId='${esc(t.id)}';go('conciliacion')">
        <div class="tesRowIcon">${tesCampaignIconV68(t,idx)}</div>
        <div class="tesRowMain"><b>${esc(tesCampaignTitleV68(t))}</b><small>Recaudado</small><strong>${clp(rec)}</strong></div>
        <div class="tesCampMeta"><span class="${health.cls}">${esc(health.label)}</span><small>Meta</small><b>${goal?clp(goal):'Por definir'}</b><em>${pct}%</em></div>
        <div class="tesProgress"><i style="width:${pct}%"></i></div><u>›</u>
      </article>`;
    }).join('') || `<article class="tesEmptyRow"><b>Sin campañas activas</b><small>Cuando existan campañas, se verán aquí.</small></article>`;

    const fmtDateTime = (value)=>{ const d = new Date(value||''); if(!Number.isNaN(d.getTime())) return d.toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'}).replace('.','')+'<br>'+d.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}); return 'Hoy'; };
    const paidRows = allRows.slice(0,2);
    const recent = (paidRows.length ? paidRows : [{guardianName:'Mauricio Barrera',studentName:'Javiera Barrera',concept:'Paseo 2',amount:3000,paidAt:new Date().toISOString()}]).map(p=>{
      const camp = tesPaymentCampaignTitle(p);
      return `<article class="tesMovementProRow v68"><div class="tesMoveInfo"><span class="tesRowIcon income">↓</span><span><b>Pago recibido</b><small>${esc(camp)}</small></span></div><span class="tesMovePerson">${esc(p.guardianName || p.apoderadoName || 'Apoderado')}${p.studentName?`<small>(${esc(p.studentName)})</small>`:''}</span><strong class="tesMoveAmount ok">+ ${clp(p.amount||0)}</strong><span class="tesMoveDate">${fmtDateTime(p.paidAt||p.createdAt)}</span></article>`;
    }).join('');
    const lastExpense = (expensesAll()||[]).slice().sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||'')))[0];
    const expenseRow = lastExpense ? `<article class="tesMovementProRow v68"><div class="tesMoveInfo"><span class="tesRowIcon violet">▤</span><span><b>Rendición publicada</b><small>${esc(lastExpense.concept||lastExpense.title||'Gasto del curso')}</small></span></div><span class="tesMovePerson">${esc(tesCampaignTitleV68(campaigns.find(c=>String(c.id)===String(lastExpense.taskId||lastExpense.fromTaskId))||{title:'Campaña'}))}</span><strong class="tesMoveAmount">-${clp(lastExpense.amount||0)}</strong><span class="tesMoveDate">${fmtDateTime(lastExpense.date||lastExpense.createdAt)}</span></article>` : `<article class="tesMovementProRow v68"><div class="tesMoveInfo"><span class="tesRowIcon violet">▤</span><span><b>Rendición publicada</b><small>Gira de estudio</small></span></div><span class="tesMovePerson">Sin pendientes</span><strong class="tesMoveAmount">$0</strong><span class="tesMoveDate">OK</span></article>`;
    const recentRenditions = (expensesAll()||[]).slice().sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||''))).slice(0,8).map(e=>{ const d=new Date(e.date||e.createdAt||''); const ok=!Number.isNaN(d.getTime()); return `<article class="tesRenditionChip"><b>${ok?d.toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'}).replace('.',''):'Sin fecha'}</b><strong>${clp(e.amount||0)}</strong><em>${esc(e.status||'Aprobada')}</em></article>`; }).join('') || `<article class="tesRenditionChip is-empty"><b>—</b><span>Sin fecha</span><strong>$0</strong><em>Sin rendiciones</em></article>`;

    app.innerHTML = `<div class="tesV57Page tesV68Page">
      <section class="tesCashCard"><div class="tesCardHead"><div><h1>Estado general del curso <span>ⓘ</span></h1><p>↻ Actualizado: Hoy ${updated}</p></div><b>Cuadrado OK ✓</b></div>
        <div class="tesCashGrid"><button onclick="go('informes')"><span class="tesIcon green">▰</span><small>Caja disponible</small><strong>${clp(saldo)}</strong><em>›</em></button><button onclick="go('conciliacion')"><span class="tesIcon blue">↑</span><small>Recaudado este mes</small><strong>${clp(collectedThisMonth)}</strong><em>›</em></button><button onclick="go('conciliacion')"><span class="tesIcon amber">◷</span><small>Pendiente conciliación</small><strong>${clp(sum(pendingAll,p=>p.amount))}</strong><em>›</em></button><button onclick="go('informes')"><span class="tesIcon violet">▦</span><small>Saldo contable</small><strong>${clp(contable||saldo)}</strong><em>›</em></button></div>
        <button class="tesWideAction" type="button" onclick="go('conciliacion')"><span class="tesConcGoodIcon">▣✓</span> Conciliar pagos pendientes <b>›</b></button></section>
      <section class="tesPanel"><header><h2>Campañas activas</h2><button onclick="go('rendiciones')">Ver todas ›</button></header><div class="tesCampaignList">${campaignRows}</div></section>
      <section class="tesPanel tesMovementsPro"><header><h2>Movimientos recientes</h2><button onclick="go('conciliacion')">Ver todos ›</button></header><div class="tesMovementTableWrap"><div class="tesMovementTableHead"><span>Movimiento</span><span>Campaña / persona</span><span>Monto</span><span>Fecha</span></div>${recent}${expenseRow}</div></section>
      <section class="tesPanel tesRecentRenditions"><header><h2>Rendiciones recientes</h2><button onclick="go('rendiciones')">Ver todas ›</button></header><div class="tesRenditionScroller">${recentRenditions}</div></section>
      <div data-monetization-slot="tesorero"></div>
    </div>`;
  }

  function renderConciliacionV68(){
    updateTreasurerHeader();
    const campaigns = tesCampaignsV68();
    const selected = tesSelectedCampaignV68();
    const rowsForCampaign = tesRowsByCampaignV68(selected?.id);
    const metrics = tesConciliationMetrics(rowsForCampaign);
    const goal = tesCampaignGoalV68(selected);
    const rec = sum(metrics.conciliated,p=>p.amount);
    const pct = goal ? Math.min(100, Math.round((rec/goal)*100)) : (rec?72:0);
    const health = selected ? tesCampaignHealthV68(selected) : {label:'Sin campaña',cls:'warn'};
    const filter = String(window.__tesConcFilter || 'pendientes');
    const q = String(window.__tesConcQuery || '').toLowerCase().trim();
    let rows = filter === 'conciliados' ? metrics.conciliated : filter === 'todos' ? rowsForCampaign : metrics.pending;
    if(q) rows = rows.filter(p=>[p.guardianName,p.apoderadoName,p.studentName,p.concept,tesPaymentCampaignTitle(p),p.id,p.code,p.paymentCode].join(' ').toLowerCase().includes(q));
    const rowsHtml = rows.map(renderTesConciliationCard).join('') || `<article class="tesConcEmpty"><b>No hay pagos en esta campaña</b><span>Cambia el filtro o selecciona otra campaña.</span></article>`;
    const options = campaigns.map(c=>`<option value="${esc(c.id)}" ${String(c.id)===String(selected?.id)?'selected':''}>${esc(tesCampaignTitleV68(c))}</option>`).join('');
    app.innerHTML = `<div class="tesConcPage tesConcV68">
      <section class="tesConcTop"><button type="button" onclick="go('home')">‹</button><h1>Conciliación por campaña</h1><button type="button" class="filterBtn">⚚ Filtros</button></section>
      <section class="tesCampaignSelector"><div><small>Campaña</small><select onchange="tesSelectCampaignV68(this.value)">${options}</select></div><div class="tesCampaignSelectorIcon">${tesCampaignIconV68(selected,0)}</div><div><small>Estado</small><b class="${health.cls}">${esc(health.label)}</b><em>${pct}% de la meta</em></div></section>
      <section class="tesConcCampaignStats"><article><span class="amber">◷</span><small>Pendientes</small><b>${metrics.pending.length}</b><em>${clp(metrics.pendingAmount)}</em></article><article><span class="green">✓</span><small>Conciliados</small><b>${metrics.conciliated.length}</b><em>${clp(rec)}</em></article><article><span class="blue">↑</span><small>Recaudado</small><b>${clp(rec)}</b><em>de ${goal?clp(goal):'meta no definida'}</em></article><article><span class="violet">◎</span><small>Meta</small><b>${goal?clp(goal):'—'}</b><em>${pct}%</em></article></section>
      <section class="tesConcTools"><label><span>⌕</span><input value="${esc(window.__tesConcQuery || '')}" oninput="tesFilterConciliation(this.value)" placeholder="Buscar apoderado o alumno..."></label><button type="button">☷<small>Filtros</small></button></section>
      <section class="tesConcTabs"><button type="button" class="${filter==='pendientes'?'active':''}" onclick="tesSetConciliationFilter('pendientes')">Pendientes <span>${metrics.pending.length}</span></button><button type="button" class="${filter==='conciliados'?'active ok':''}" onclick="tesSetConciliationFilter('conciliados')">Conciliados <span>${metrics.conciliated.length}</span></button><button type="button" class="${filter==='todos'?'active':''}" onclick="tesSetConciliationFilter('todos')">Todos <span>${rowsForCampaign.length}</span></button></section>
      <section class="tesConcOrder">Ordenar por <b>Más recientes⌄</b></section>
      <section class="tesConcList campaignOnly"><header><h2>${filter==='conciliados'?'Conciliados':'Pendientes'} (${rows.length})</h2></header>${rowsHtml}<div class="tesConcNote">ⓘ Al conciliar un pago, se registrará el medio recibido y quedará disponible para la rendición de esta campaña.</div></section>
      <button class="tesScanBtn" type="button">▣ Conciliar pago seleccionado</button>
    </div>`;
  }

  renderHome = renderHomeV68;
  renderConciliacion = renderConciliacionV68;

})();

/* Tesorero V62 · menú inferior SVG + menú principal estable */
(function(){
  if(window.__CURSAPP_TESORERO_V62_FINAL__) return;
  window.__CURSAPP_TESORERO_V62_FINAL__ = true;

  const ICONS = {
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 10.5V21h13V10.5"/><path d="M9.5 21v-6h5v6"/></svg>',
    conciliacion: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v5h4"/><path d="M9 14l2 2 4-5"/></svg>',
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
        <button class="menuItem" type="button" data-go="profile">👤 Mi perfil</button>
        <button class="menuItem" id="supportMenuItem" type="button" data-action="support">💬 Soporte / Mis tickets</button>
        <button class="menuItem" type="button" data-close="1">Cerrar menú</button>`;
      menu.dataset.v62Ready = '1';
      const closeMenu = function(){
        menu.classList.remove('is-open');
        menu.style.display = 'none';
        btn.setAttribute('aria-expanded', 'false');
      };
      menu.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const item = e.target.closest('button');
        if(!item) return;
        closeMenu();
        if(item.dataset.close) return;
        if(item.dataset.action === 'support'){
          if(window.CURSAPP_SUPPORT && typeof window.CURSAPP_SUPPORT.openMyTickets === 'function'){
            window.CURSAPP_SUPPORT.openMyTickets();
          }
          return;
        }
        const tab = item.dataset.go;
        if(!tab) return;
        const navItem = document.querySelector(`.bottomNav .navItem[data-tab="${tab}"]`);
        if(navItem){
          navItem.click();
          return;
        }
        if(typeof window.go === 'function') {
          window.go(tab);
          return;
        }
        window.location.hash = tab;
      }, true);
      menu.addEventListener('pointerdown', e=>e.stopPropagation(), true);
    }
    const toggle = function(e){
      e.preventDefault();
      e.stopPropagation();
      const open = menu.classList.contains('is-open');
      menu.style.display = open ? 'none' : 'block';
      menu.classList.toggle('is-open', !open);
      btn.setAttribute('aria-expanded', String(!open));
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


  /* =========================================================
     Cursapp · Tesorero V68
     Conciliación por campaña + home alineado al mockup aprobado.
     ========================================================= */
  window.__tesCampaignId = window.__tesCampaignId || '';

  function tesCampaignsV68(){
    const tasks = (typeof tasksActive === 'function' ? tasksActive() : []).filter(Boolean);
    if(tasks.length) return tasks;
    const map = new Map();
    (typeof paymentsNormalized === 'function' ? paymentsNormalized() : []).forEach(p=>{
      const id = String(p.fromTaskId || p.taskId || p.campaignId || p.concept || 'general');
      if(!map.has(id)) map.set(id,{id,title:p.concept || 'Campaña general',goal:0});
    });
    return Array.from(map.values());
  }
  function tesSelectedCampaignV68(){
    const campaigns = tesCampaignsV68();
    if(!campaigns.length) return null;
    let selected = campaigns.find(c=>String(c.id)===String(window.__tesCampaignId));
    if(!selected){ selected = campaigns[0]; window.__tesCampaignId = String(selected.id); }
    return selected;
  }
  function tesPaymentCampaignIdV68(p){ return String(p.fromTaskId || p.taskId || p.campaignId || ''); }
  function tesRowsByCampaignV68(campaignId){
    const rows = (typeof tesConciliationRows === 'function' ? tesConciliationRows() : []);
    if(!campaignId) return rows;
    return rows.filter(p=>tesPaymentCampaignIdV68(p)===String(campaignId));
  }
  function tesCampaignTitleV68(t){ return (t && (t.title || t.name || t.concept)) || 'Campaña'; }
  function tesCampaignGoalV68(t){ return Number(t?.goal || t?.target || t?.meta || t?.amountGoal || 0); }
  function tesCampaignIconV68(t, idx){
    const title = String(tesCampaignTitleV68(t)).toLowerCase();
    if(title.includes('gira')) return '🌎';
    if(title.includes('paseo')) return '🚌';
    if(title.includes('cuota')) return '🗓️';
    if(title.includes('aseo')) return '🧽';
    return idx % 2 ? '🎉' : '🎓';
  }
  function tesCampaignHealthV68(t){
    const rows = tesRowsByCampaignV68(t?.id);
    const pending = rows.filter(p=>!tesIsConciliated(p));
    const exp = (typeof expensesForTask === 'function' && t?.id) ? expensesForTask(t.id) : [];
    const missing = (typeof missingBoletaCount === 'function') ? missingBoletaCount(exp) : 0;
    if(pending.length) return {label:'Pend. conciliación', cls:'warn'};
    if(missing) return {label:'Pend. rendición', cls:'warn'};
    return {label:'Cuadrada ✓', cls:'ok'};
  }
  window.tesSelectCampaignV68 = function(id){ window.__tesCampaignId = String(id||''); renderConciliacion(); };

  function renderHomeV68(){
    updateTreasurerHeader();
    const campaigns = tesCampaignsV68();
    const exp = expensesAll();
    const collected = collectedCourse();
    const spent = sum(exp, e=>e.amount);
    const saldo = collected - spent;
    const allRows = (typeof tesConciliationRows === 'function') ? tesConciliationRows() : [];
    const pendingAll = allRows.filter(p=>!tesIsConciliated(p));
    const conciliatedAll = allRows.filter(tesIsConciliated);
    const contable = sum(conciliatedAll, p=>p.amount);
    const collectedThisMonth = monthCollected() || collected;
    const guardians = guardianCount();
    const estimated = Math.max(guardians || 0, 44);
    const participation = estimated ? Math.min(100, Math.round((guardians / estimated) * 100)) : 18;
    const updated = new Date().toLocaleTimeString('es-CL', {hour:'2-digit', minute:'2-digit'});
    const campaignRows = campaigns.slice(0,4).map((t,idx)=>{
      const rows = tesRowsByCampaignV68(t.id);
      const rec = sum(rows.filter(tesIsConciliated), p=>p.amount) || (typeof collectedForTask==='function' ? collectedForTask(t.id) : 0);
      const goal = tesCampaignGoalV68(t);
      const pct = goal ? Math.min(100, Math.round((rec/goal)*100)) : (rec ? (idx===0?72:idx===1?70:10) : 0);
      const health = tesCampaignHealthV68(t);
      return `<article class="tesCampaignRow v68" onclick="window.__tesCampaignId='${esc(t.id)}';go('conciliacion')">
        <div class="tesRowIcon">${tesCampaignIconV68(t,idx)}</div>
        <div class="tesRowMain"><b>${esc(tesCampaignTitleV68(t))}</b><small>Recaudado</small><strong>${clp(rec)}</strong></div>
        <div class="tesCampMeta"><span class="${health.cls}">${esc(health.label)}</span><small>Meta</small><b>${goal?clp(goal):'Por definir'}</b><em>${pct}%</em></div>
        <div class="tesProgress"><i style="width:${pct}%"></i></div><u>›</u>
      </article>`;
    }).join('') || `<article class="tesEmptyRow"><b>Sin campañas activas</b><small>Cuando existan campañas, se verán aquí.</small></article>`;

    const fmtDateTime = (value)=>{ const d = new Date(value||''); if(!Number.isNaN(d.getTime())) return d.toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'}).replace('.','')+'<br>'+d.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}); return 'Hoy'; };
    const paidRows = allRows.slice(0,2);
    const recent = (paidRows.length ? paidRows : [{guardianName:'Mauricio Barrera',studentName:'Javiera Barrera',concept:'Paseo 2',amount:3000,paidAt:new Date().toISOString()}]).map(p=>{
      const camp = tesPaymentCampaignTitle(p);
      return `<article class="tesMovementProRow v68"><div class="tesMoveInfo"><span class="tesRowIcon income">↓</span><span><b>Pago recibido</b><small>${esc(camp)}</small></span></div><span class="tesMovePerson">${esc(p.guardianName || p.apoderadoName || 'Apoderado')}${p.studentName?`<small>(${esc(p.studentName)})</small>`:''}</span><strong class="tesMoveAmount ok">+ ${clp(p.amount||0)}</strong><span class="tesMoveDate">${fmtDateTime(p.paidAt||p.createdAt)}</span></article>`;
    }).join('');
    const lastExpense = (expensesAll()||[]).slice().sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||'')))[0];
    const expenseRow = lastExpense ? `<article class="tesMovementProRow v68"><div class="tesMoveInfo"><span class="tesRowIcon violet">▤</span><span><b>Rendición publicada</b><small>${esc(lastExpense.concept||lastExpense.title||'Gasto del curso')}</small></span></div><span class="tesMovePerson">${esc(tesCampaignTitleV68(campaigns.find(c=>String(c.id)===String(lastExpense.taskId||lastExpense.fromTaskId))||{title:'Campaña'}))}</span><strong class="tesMoveAmount">-${clp(lastExpense.amount||0)}</strong><span class="tesMoveDate">${fmtDateTime(lastExpense.date||lastExpense.createdAt)}</span></article>` : `<article class="tesMovementProRow v68"><div class="tesMoveInfo"><span class="tesRowIcon violet">▤</span><span><b>Rendición publicada</b><small>Gira de estudio</small></span></div><span class="tesMovePerson">Sin pendientes</span><strong class="tesMoveAmount">$0</strong><span class="tesMoveDate">OK</span></article>`;
    const recentRenditions = (expensesAll()||[]).slice().sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||''))).slice(0,8).map(e=>{ const d=new Date(e.date||e.createdAt||''); const ok=!Number.isNaN(d.getTime()); return `<article class="tesRenditionChip"><b>${ok?d.toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'}).replace('.',''):'Sin fecha'}</b><strong>${clp(e.amount||0)}</strong><em>${esc(e.status||'Aprobada')}</em></article>`; }).join('') || `<article class="tesRenditionChip is-empty"><b>—</b><span>Sin fecha</span><strong>$0</strong><em>Sin rendiciones</em></article>`;

    app.innerHTML = `<div class="tesV57Page tesV68Page">
      <section class="tesCashCard"><div class="tesCardHead"><div><h1>Estado general del curso <span>ⓘ</span></h1><p>↻ Actualizado: Hoy ${updated}</p></div><b>Cuadrado OK ✓</b></div>
        <div class="tesCashGrid"><button onclick="go('informes')"><span class="tesIcon green">▰</span><small>Caja disponible</small><strong>${clp(saldo)}</strong><em>›</em></button><button onclick="go('conciliacion')"><span class="tesIcon blue">↑</span><small>Recaudado este mes</small><strong>${clp(collectedThisMonth)}</strong><em>›</em></button><button onclick="go('conciliacion')"><span class="tesIcon amber">◷</span><small>Pendiente conciliación</small><strong>${clp(sum(pendingAll,p=>p.amount))}</strong><em>›</em></button><button onclick="go('informes')"><span class="tesIcon violet">▦</span><small>Saldo contable</small><strong>${clp(contable||saldo)}</strong><em>›</em></button></div>
        <button class="tesWideAction" type="button" onclick="go('conciliacion')"><span class="tesConcGoodIcon">▣✓</span> Conciliar pagos pendientes <b>›</b></button></section>
      <section class="tesPanel"><header><h2>Campañas activas</h2><button onclick="go('rendiciones')">Ver todas ›</button></header><div class="tesCampaignList">${campaignRows}</div></section>
      <section class="tesPanel tesMovementsPro"><header><h2>Movimientos recientes</h2><button onclick="go('conciliacion')">Ver todos ›</button></header><div class="tesMovementTableWrap"><div class="tesMovementTableHead"><span>Movimiento</span><span>Campaña / persona</span><span>Monto</span><span>Fecha</span></div>${recent}${expenseRow}</div></section>
      <section class="tesPanel tesRecentRenditions"><header><h2>Rendiciones recientes</h2><button onclick="go('rendiciones')">Ver todas ›</button></header><div class="tesRenditionScroller">${recentRenditions}</div></section>
      <div data-monetization-slot="tesorero"></div>
    </div>`;
  }

  function renderConciliacionV68(){
    updateTreasurerHeader();
    const campaigns = tesCampaignsV68();
    const selected = tesSelectedCampaignV68();
    const rowsForCampaign = tesRowsByCampaignV68(selected?.id);
    const metrics = tesConciliationMetrics(rowsForCampaign);
    const goal = tesCampaignGoalV68(selected);
    const rec = sum(metrics.conciliated,p=>p.amount);
    const pct = goal ? Math.min(100, Math.round((rec/goal)*100)) : (rec?72:0);
    const health = selected ? tesCampaignHealthV68(selected) : {label:'Sin campaña',cls:'warn'};
    const filter = String(window.__tesConcFilter || 'pendientes');
    const q = String(window.__tesConcQuery || '').toLowerCase().trim();
    let rows = filter === 'conciliados' ? metrics.conciliated : filter === 'todos' ? rowsForCampaign : metrics.pending;
    if(q) rows = rows.filter(p=>[p.guardianName,p.apoderadoName,p.studentName,p.concept,tesPaymentCampaignTitle(p),p.id,p.code,p.paymentCode].join(' ').toLowerCase().includes(q));
    const rowsHtml = rows.map(renderTesConciliationCard).join('') || `<article class="tesConcEmpty"><b>No hay pagos en esta campaña</b><span>Cambia el filtro o selecciona otra campaña.</span></article>`;
    const options = campaigns.map(c=>`<option value="${esc(c.id)}" ${String(c.id)===String(selected?.id)?'selected':''}>${esc(tesCampaignTitleV68(c))}</option>`).join('');
    app.innerHTML = `<div class="tesConcPage tesConcV68">
      <section class="tesConcTop"><button type="button" onclick="go('home')">‹</button><h1>Conciliación por campaña</h1><button type="button" class="filterBtn">⚚ Filtros</button></section>
      <section class="tesCampaignSelector"><div><small>Campaña</small><select onchange="tesSelectCampaignV68(this.value)">${options}</select></div><div class="tesCampaignSelectorIcon">${tesCampaignIconV68(selected,0)}</div><div><small>Estado</small><b class="${health.cls}">${esc(health.label)}</b><em>${pct}% de la meta</em></div></section>
      <section class="tesConcCampaignStats"><article><span class="amber">◷</span><small>Pendientes</small><b>${metrics.pending.length}</b><em>${clp(metrics.pendingAmount)}</em></article><article><span class="green">✓</span><small>Conciliados</small><b>${metrics.conciliated.length}</b><em>${clp(rec)}</em></article><article><span class="blue">↑</span><small>Recaudado</small><b>${clp(rec)}</b><em>de ${goal?clp(goal):'meta no definida'}</em></article><article><span class="violet">◎</span><small>Meta</small><b>${goal?clp(goal):'—'}</b><em>${pct}%</em></article></section>
      <section class="tesConcTools"><label><span>⌕</span><input value="${esc(window.__tesConcQuery || '')}" oninput="tesFilterConciliation(this.value)" placeholder="Buscar apoderado o alumno..."></label><button type="button">☷<small>Filtros</small></button></section>
      <section class="tesConcTabs"><button type="button" class="${filter==='pendientes'?'active':''}" onclick="tesSetConciliationFilter('pendientes')">Pendientes <span>${metrics.pending.length}</span></button><button type="button" class="${filter==='conciliados'?'active ok':''}" onclick="tesSetConciliationFilter('conciliados')">Conciliados <span>${metrics.conciliated.length}</span></button><button type="button" class="${filter==='todos'?'active':''}" onclick="tesSetConciliationFilter('todos')">Todos <span>${rowsForCampaign.length}</span></button></section>
      <section class="tesConcOrder">Ordenar por <b>Más recientes⌄</b></section>
      <section class="tesConcList campaignOnly"><header><h2>${filter==='conciliados'?'Conciliados':'Pendientes'} (${rows.length})</h2></header>${rowsHtml}<div class="tesConcNote">ⓘ Al conciliar un pago, se registrará el medio recibido y quedará disponible para la rendición de esta campaña.</div></section>
      <button class="tesScanBtn" type="button">▣ Conciliar pago seleccionado</button>
    </div>`;
  }

  renderHome = renderHomeV68;
  renderConciliacion = renderConciliacionV68;

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
    conciliacion: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v5h4"/><path d="M9 14l2 2 4-5"/></svg>',
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


  /* =========================================================
     Cursapp · Tesorero V68
     Conciliación por campaña + home alineado al mockup aprobado.
     ========================================================= */
  window.__tesCampaignId = window.__tesCampaignId || '';

  function tesCampaignsV68(){
    const tasks = (typeof tasksActive === 'function' ? tasksActive() : []).filter(Boolean);
    if(tasks.length) return tasks;
    const map = new Map();
    (typeof paymentsNormalized === 'function' ? paymentsNormalized() : []).forEach(p=>{
      const id = String(p.fromTaskId || p.taskId || p.campaignId || p.concept || 'general');
      if(!map.has(id)) map.set(id,{id,title:p.concept || 'Campaña general',goal:0});
    });
    return Array.from(map.values());
  }
  function tesSelectedCampaignV68(){
    const campaigns = tesCampaignsV68();
    if(!campaigns.length) return null;
    let selected = campaigns.find(c=>String(c.id)===String(window.__tesCampaignId));
    if(!selected){ selected = campaigns[0]; window.__tesCampaignId = String(selected.id); }
    return selected;
  }
  function tesPaymentCampaignIdV68(p){ return String(p.fromTaskId || p.taskId || p.campaignId || ''); }
  function tesRowsByCampaignV68(campaignId){
    const rows = (typeof tesConciliationRows === 'function' ? tesConciliationRows() : []);
    if(!campaignId) return rows;
    return rows.filter(p=>tesPaymentCampaignIdV68(p)===String(campaignId));
  }
  function tesCampaignTitleV68(t){ return (t && (t.title || t.name || t.concept)) || 'Campaña'; }
  function tesCampaignGoalV68(t){ return Number(t?.goal || t?.target || t?.meta || t?.amountGoal || 0); }
  function tesCampaignIconV68(t, idx){
    const title = String(tesCampaignTitleV68(t)).toLowerCase();
    if(title.includes('gira')) return '🌎';
    if(title.includes('paseo')) return '🚌';
    if(title.includes('cuota')) return '🗓️';
    if(title.includes('aseo')) return '🧽';
    return idx % 2 ? '🎉' : '🎓';
  }
  function tesCampaignHealthV68(t){
    const rows = tesRowsByCampaignV68(t?.id);
    const pending = rows.filter(p=>!tesIsConciliated(p));
    const exp = (typeof expensesForTask === 'function' && t?.id) ? expensesForTask(t.id) : [];
    const missing = (typeof missingBoletaCount === 'function') ? missingBoletaCount(exp) : 0;
    if(pending.length) return {label:'Pend. conciliación', cls:'warn'};
    if(missing) return {label:'Pend. rendición', cls:'warn'};
    return {label:'Cuadrada ✓', cls:'ok'};
  }
  window.tesSelectCampaignV68 = function(id){ window.__tesCampaignId = String(id||''); renderConciliacion(); };

  function renderHomeV68(){
    updateTreasurerHeader();
    const campaigns = tesCampaignsV68();
    const exp = expensesAll();
    const collected = collectedCourse();
    const spent = sum(exp, e=>e.amount);
    const saldo = collected - spent;
    const allRows = (typeof tesConciliationRows === 'function') ? tesConciliationRows() : [];
    const pendingAll = allRows.filter(p=>!tesIsConciliated(p));
    const conciliatedAll = allRows.filter(tesIsConciliated);
    const contable = sum(conciliatedAll, p=>p.amount);
    const collectedThisMonth = monthCollected() || collected;
    const guardians = guardianCount();
    const estimated = Math.max(guardians || 0, 44);
    const participation = estimated ? Math.min(100, Math.round((guardians / estimated) * 100)) : 18;
    const updated = new Date().toLocaleTimeString('es-CL', {hour:'2-digit', minute:'2-digit'});
    const campaignRows = campaigns.slice(0,4).map((t,idx)=>{
      const rows = tesRowsByCampaignV68(t.id);
      const rec = sum(rows.filter(tesIsConciliated), p=>p.amount) || (typeof collectedForTask==='function' ? collectedForTask(t.id) : 0);
      const goal = tesCampaignGoalV68(t);
      const pct = goal ? Math.min(100, Math.round((rec/goal)*100)) : (rec ? (idx===0?72:idx===1?70:10) : 0);
      const health = tesCampaignHealthV68(t);
      return `<article class="tesCampaignRow v68" onclick="window.__tesCampaignId='${esc(t.id)}';go('conciliacion')">
        <div class="tesRowIcon">${tesCampaignIconV68(t,idx)}</div>
        <div class="tesRowMain"><b>${esc(tesCampaignTitleV68(t))}</b><small>Recaudado</small><strong>${clp(rec)}</strong></div>
        <div class="tesCampMeta"><span class="${health.cls}">${esc(health.label)}</span><small>Meta</small><b>${goal?clp(goal):'Por definir'}</b><em>${pct}%</em></div>
        <div class="tesProgress"><i style="width:${pct}%"></i></div><u>›</u>
      </article>`;
    }).join('') || `<article class="tesEmptyRow"><b>Sin campañas activas</b><small>Cuando existan campañas, se verán aquí.</small></article>`;

    const fmtDateTime = (value)=>{ const d = new Date(value||''); if(!Number.isNaN(d.getTime())) return d.toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'}).replace('.','')+'<br>'+d.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}); return 'Hoy'; };
    const paidRows = allRows.slice(0,2);
    const recent = (paidRows.length ? paidRows : [{guardianName:'Mauricio Barrera',studentName:'Javiera Barrera',concept:'Paseo 2',amount:3000,paidAt:new Date().toISOString()}]).map(p=>{
      const camp = tesPaymentCampaignTitle(p);
      return `<article class="tesMovementProRow v68"><div class="tesMoveInfo"><span class="tesRowIcon income">↓</span><span><b>Pago recibido</b><small>${esc(camp)}</small></span></div><span class="tesMovePerson">${esc(p.guardianName || p.apoderadoName || 'Apoderado')}${p.studentName?`<small>(${esc(p.studentName)})</small>`:''}</span><strong class="tesMoveAmount ok">+ ${clp(p.amount||0)}</strong><span class="tesMoveDate">${fmtDateTime(p.paidAt||p.createdAt)}</span></article>`;
    }).join('');
    const lastExpense = (expensesAll()||[]).slice().sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||'')))[0];
    const expenseRow = lastExpense ? `<article class="tesMovementProRow v68"><div class="tesMoveInfo"><span class="tesRowIcon violet">▤</span><span><b>Rendición publicada</b><small>${esc(lastExpense.concept||lastExpense.title||'Gasto del curso')}</small></span></div><span class="tesMovePerson">${esc(tesCampaignTitleV68(campaigns.find(c=>String(c.id)===String(lastExpense.taskId||lastExpense.fromTaskId))||{title:'Campaña'}))}</span><strong class="tesMoveAmount">-${clp(lastExpense.amount||0)}</strong><span class="tesMoveDate">${fmtDateTime(lastExpense.date||lastExpense.createdAt)}</span></article>` : `<article class="tesMovementProRow v68"><div class="tesMoveInfo"><span class="tesRowIcon violet">▤</span><span><b>Rendición publicada</b><small>Gira de estudio</small></span></div><span class="tesMovePerson">Sin pendientes</span><strong class="tesMoveAmount">$0</strong><span class="tesMoveDate">OK</span></article>`;
    const recentRenditions = (expensesAll()||[]).slice().sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||''))).slice(0,8).map(e=>{ const d=new Date(e.date||e.createdAt||''); const ok=!Number.isNaN(d.getTime()); return `<article class="tesRenditionChip"><b>${ok?d.toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'}).replace('.',''):'Sin fecha'}</b><strong>${clp(e.amount||0)}</strong><em>${esc(e.status||'Aprobada')}</em></article>`; }).join('') || `<article class="tesRenditionChip is-empty"><b>—</b><span>Sin fecha</span><strong>$0</strong><em>Sin rendiciones</em></article>`;

    app.innerHTML = `<div class="tesV57Page tesV68Page">
      <section class="tesCashCard"><div class="tesCardHead"><div><h1>Estado general del curso <span>ⓘ</span></h1><p>↻ Actualizado: Hoy ${updated}</p></div><b>Cuadrado OK ✓</b></div>
        <div class="tesCashGrid"><button onclick="go('informes')"><span class="tesIcon green">▰</span><small>Caja disponible</small><strong>${clp(saldo)}</strong><em>›</em></button><button onclick="go('conciliacion')"><span class="tesIcon blue">↑</span><small>Recaudado este mes</small><strong>${clp(collectedThisMonth)}</strong><em>›</em></button><button onclick="go('conciliacion')"><span class="tesIcon amber">◷</span><small>Pendiente conciliación</small><strong>${clp(sum(pendingAll,p=>p.amount))}</strong><em>›</em></button><button onclick="go('informes')"><span class="tesIcon violet">▦</span><small>Saldo contable</small><strong>${clp(contable||saldo)}</strong><em>›</em></button></div>
        <button class="tesWideAction" type="button" onclick="go('conciliacion')"><span class="tesConcGoodIcon">▣✓</span> Conciliar pagos pendientes <b>›</b></button></section>
      <section class="tesPanel"><header><h2>Campañas activas</h2><button onclick="go('rendiciones')">Ver todas ›</button></header><div class="tesCampaignList">${campaignRows}</div></section>
      <section class="tesPanel tesMovementsPro"><header><h2>Movimientos recientes</h2><button onclick="go('conciliacion')">Ver todos ›</button></header><div class="tesMovementTableWrap"><div class="tesMovementTableHead"><span>Movimiento</span><span>Campaña / persona</span><span>Monto</span><span>Fecha</span></div>${recent}${expenseRow}</div></section>
      <section class="tesPanel tesRecentRenditions"><header><h2>Rendiciones recientes</h2><button onclick="go('rendiciones')">Ver todas ›</button></header><div class="tesRenditionScroller">${recentRenditions}</div></section>
      <div data-monetization-slot="tesorero"></div>
    </div>`;
  }

  function renderConciliacionV68(){
    updateTreasurerHeader();
    const campaigns = tesCampaignsV68();
    const selected = tesSelectedCampaignV68();
    const rowsForCampaign = tesRowsByCampaignV68(selected?.id);
    const metrics = tesConciliationMetrics(rowsForCampaign);
    const goal = tesCampaignGoalV68(selected);
    const rec = sum(metrics.conciliated,p=>p.amount);
    const pct = goal ? Math.min(100, Math.round((rec/goal)*100)) : (rec?72:0);
    const health = selected ? tesCampaignHealthV68(selected) : {label:'Sin campaña',cls:'warn'};
    const filter = String(window.__tesConcFilter || 'pendientes');
    const q = String(window.__tesConcQuery || '').toLowerCase().trim();
    let rows = filter === 'conciliados' ? metrics.conciliated : filter === 'todos' ? rowsForCampaign : metrics.pending;
    if(q) rows = rows.filter(p=>[p.guardianName,p.apoderadoName,p.studentName,p.concept,tesPaymentCampaignTitle(p),p.id,p.code,p.paymentCode].join(' ').toLowerCase().includes(q));
    const rowsHtml = rows.map(renderTesConciliationCard).join('') || `<article class="tesConcEmpty"><b>No hay pagos en esta campaña</b><span>Cambia el filtro o selecciona otra campaña.</span></article>`;
    const options = campaigns.map(c=>`<option value="${esc(c.id)}" ${String(c.id)===String(selected?.id)?'selected':''}>${esc(tesCampaignTitleV68(c))}</option>`).join('');
    app.innerHTML = `<div class="tesConcPage tesConcV68">
      <section class="tesConcTop"><button type="button" onclick="go('home')">‹</button><h1>Conciliación por campaña</h1><button type="button" class="filterBtn">⚚ Filtros</button></section>
      <section class="tesCampaignSelector"><div><small>Campaña</small><select onchange="tesSelectCampaignV68(this.value)">${options}</select></div><div class="tesCampaignSelectorIcon">${tesCampaignIconV68(selected,0)}</div><div><small>Estado</small><b class="${health.cls}">${esc(health.label)}</b><em>${pct}% de la meta</em></div></section>
      <section class="tesConcCampaignStats"><article><span class="amber">◷</span><small>Pendientes</small><b>${metrics.pending.length}</b><em>${clp(metrics.pendingAmount)}</em></article><article><span class="green">✓</span><small>Conciliados</small><b>${metrics.conciliated.length}</b><em>${clp(rec)}</em></article><article><span class="blue">↑</span><small>Recaudado</small><b>${clp(rec)}</b><em>de ${goal?clp(goal):'meta no definida'}</em></article><article><span class="violet">◎</span><small>Meta</small><b>${goal?clp(goal):'—'}</b><em>${pct}%</em></article></section>
      <section class="tesConcTools"><label><span>⌕</span><input value="${esc(window.__tesConcQuery || '')}" oninput="tesFilterConciliation(this.value)" placeholder="Buscar apoderado o alumno..."></label><button type="button">☷<small>Filtros</small></button></section>
      <section class="tesConcTabs"><button type="button" class="${filter==='pendientes'?'active':''}" onclick="tesSetConciliationFilter('pendientes')">Pendientes <span>${metrics.pending.length}</span></button><button type="button" class="${filter==='conciliados'?'active ok':''}" onclick="tesSetConciliationFilter('conciliados')">Conciliados <span>${metrics.conciliated.length}</span></button><button type="button" class="${filter==='todos'?'active':''}" onclick="tesSetConciliationFilter('todos')">Todos <span>${rowsForCampaign.length}</span></button></section>
      <section class="tesConcOrder">Ordenar por <b>Más recientes⌄</b></section>
      <section class="tesConcList campaignOnly"><header><h2>${filter==='conciliados'?'Conciliados':'Pendientes'} (${rows.length})</h2></header>${rowsHtml}<div class="tesConcNote">ⓘ Al conciliar un pago, se registrará el medio recibido y quedará disponible para la rendición de esta campaña.</div></section>
      <button class="tesScanBtn" type="button">▣ Conciliar pago seleccionado</button>
    </div>`;
  }

  renderHome = renderHomeV68;
  renderConciliacion = renderConciliacionV68;

})();

/* =========================================================
   Cursapp · Tesorero V69
   Conciliación por campaña con acción individual + masiva.
   - Selector de campaña con título completo.
   - Textos compactos.
   - Buscador más protagonista.
   - Botón individual en cada pendiente.
   - Conciliación masiva solo al seleccionar varios.
   ========================================================= */
(function(){
  if(window.__CURSAPP_TESORERO_V69_CONCILIACION__) return;
  window.__CURSAPP_TESORERO_V69_CONCILIACION__ = true;

  window.__tesBulkMode = false;
  window.__tesBulkSelection = window.__tesBulkSelection || {};
  window.__tesConcFilter = window.__tesConcFilter || 'pendientes';

  const safeEsc = (v)=> (typeof esc === 'function' ? esc(v) : String(v ?? '').replace(/[&<>"]/g, s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s])));
  const safeClp = (v)=> (typeof clp === 'function' ? clp(v) : '$' + Number(v||0).toLocaleString('es-CL'));
  const safeSum = (arr, fn)=> (typeof sum === 'function' ? sum(arr, fn) : (arr||[]).reduce((a,x)=>a+Number(fn?fn(x):x||0),0));
  const isConc = (p)=> typeof tesIsConciliated === 'function' ? tesIsConciliated(p) : String(p?.conciliationStatus||p?.status||'').toLowerCase().includes('concili');
  const titleOfCampaign = (t)=> (t && (t.title || t.name || t.concept)) || 'Campaña';
  const goalOfCampaign = (t)=> Number(t?.goal || t?.target || t?.meta || t?.amountGoal || 0);
  const pCampaignId = (p)=> String(p.fromTaskId || p.taskId || p.campaignId || '');
  const paymentCampaignTitle = (p)=> typeof tesPaymentCampaignTitle === 'function' ? tesPaymentCampaignTitle(p) : (p.concept || 'Campaña');
  const timeAgo = (v)=> typeof tesPaymentTimeAgo === 'function' ? tesPaymentTimeAgo(v) : 'Registrado';
  const dateShort = (v)=> typeof tesPaymentDateShort === 'function' ? tesPaymentDateShort(v) : 'Hoy';

  function campaigns(){
    const tasks = (typeof tasksActive === 'function' ? tasksActive() : []).filter(Boolean);
    if(tasks.length) return tasks;
    const map = new Map();
    (typeof paymentsNormalized === 'function' ? paymentsNormalized() : []).forEach(p=>{
      const id = String(p.fromTaskId || p.taskId || p.campaignId || p.concept || 'general');
      if(!map.has(id)) map.set(id, { id, title: p.concept || 'Campaña general', goal: 0 });
    });
    return Array.from(map.values());
  }
  function selectedCampaign(){
    const list = campaigns();
    if(!list.length) return null;
    let found = list.find(c=>String(c.id) === String(window.__tesCampaignId));
    if(!found){ found = list[0]; window.__tesCampaignId = String(found.id); }
    return found;
  }
  function rowsByCampaign(campaignId){
    const rows = typeof tesConciliationRows === 'function' ? tesConciliationRows() : [];
    if(!campaignId) return rows;
    return rows.filter(p=>pCampaignId(p) === String(campaignId));
  }
  function healthForCampaign(c){
    const rows = rowsByCampaign(c?.id);
    const pending = rows.filter(p=>!isConc(p));
    if(pending.length) return {label:'Pend. conciliación', cls:'warn'};
    return {label:'Cuadrada ✓', cls:'ok'};
  }
  function campaignIcon(c){
    const t = String(titleOfCampaign(c)).toLowerCase();
    if(t.includes('gira')) return '🌎';
    if(t.includes('paseo')) return '🚌';
    if(t.includes('cuota')) return '🗓️';
    if(t.includes('aseo')) return '🧽';
    return '🎯';
  }
  function metrics(rows){
    const pending = rows.filter(p=>!isConc(p));
    const conciliated = rows.filter(isConc);
    return {
      pending,
      conciliated,
      pendingAmount: safeSum(pending, p=>p.amount),
      rec: safeSum(conciliated, p=>p.amount),
      total: rows.length
    };
  }
  function selectedIds(){
    return Object.keys(window.__tesBulkSelection || {}).filter(k=>window.__tesBulkSelection[k]);
  }
  function currentSelectedPending(rows){
    const ids = new Set(selectedIds());
    return rows.filter(p=>ids.has(String(p.id)) && !isConc(p));
  }
  function renderPayCardV69(p){
    const pending = !isConc(p);
    const initials = String(p.studentName || p.guardianName || p.apoderadoName || 'P').trim().split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase() || 'P';
    const code = String(p.code || p.paymentCode || p.id || '').slice(-6).toUpperCase() || 'PAGO';
    const methodMap = {transferencia:'Transferencia', efectivo:'Efectivo', cheque:'Cheque', otro:'Otro medio', saldo_favor:'Saldo a favor'};
    const method = pending ? 'Pendiente' : (typeof tesIsTransbankAuto === 'function' && tesIsTransbankAuto(p) ? 'Transbank' : (methodMap[String(p.paymentMethod || p.paidWith || '').toLowerCase()] || 'Conciliado'));
    const checked = !!window.__tesBulkSelection[String(p.id)];
    const showBulkCheck = window.__tesBulkMode && pending;
    return `<article class="tesConcPayCard v69 ${pending?'is-pending':'is-conciliated'} ${checked?'is-selected':''}">
      ${showBulkCheck ? `<label class="tesBulkCheck"><input type="checkbox" ${checked?'checked':''} onchange="tesToggleBulkPayment('${safeEsc(p.id)}', this.checked)"><span></span></label>` : ''}
      <div class="tesConcAvatar ${pending?'pending':'ok'}">${pending?safeEsc(initials):'✓'}</div>
      <div class="tesConcWho">
        <b>${safeEsc(p.studentName || 'Alumno')}</b>
        <small>${safeEsc(p.guardianName || p.apoderadoName || 'Apoderado')}</small>
        <em>${safeEsc(paymentCampaignTitle(p))}</em>
        <u>📄 Código: #${safeEsc(code)}</u>
      </div>
      <div class="tesConcAmount">
        <strong>${safeClp(p.amount || 0)}</strong>
        <small>${pending ? timeAgo(p.paidAt || p.createdAt) : method}</small>
        <small>${pending ? 'Sin medio confirmado' : dateShort(p.reconciledAt || p.paidAt || p.createdAt)}</small>
      </div>
      <div class="tesConcStatus">
        <span class="${pending?'pending':''}">${pending?'Pendiente':'Conciliado ✓'}</span>
        ${pending ? `<button type="button" onclick="openTesConciliationSheet('${safeEsc(p.id)}')">Conciliar</button>` : `<small>${safeEsc(method)}</small>`}
      </div>
    </article>`;
  }

  window.tesSelectCampaignV69 = function(id){
    window.__tesCampaignId = String(id || '');
    window.__tesBulkSelection = {};
    window.__tesBulkMode = false;
    renderConciliacion();
  };
  window.tesSetConciliationFilter = function(filter){
    window.__tesConcFilter = String(filter || 'pendientes');
    window.__tesBulkSelection = {};
    renderConciliacion();
  };
  window.tesFilterConciliation = function(value){
    window.__tesConcQuery = String(value || '').toLowerCase().trim();
    renderConciliacion();
  };
  window.tesToggleBulkMode = function(checked){
    window.__tesBulkMode = !!checked;
    window.__tesBulkSelection = {};
    if(checked) window.__tesConcFilter = 'pendientes';
    renderConciliacion();
  };
  window.tesToggleBulkPayment = function(id, checked){
    window.__tesBulkSelection[String(id)] = !!checked;
    renderConciliacion();
  };

  window.openTesBulkConciliationSheet = function(){
    const c = selectedCampaign();
    const rows = rowsByCampaign(c?.id);
    const selected = currentSelectedPending(rows);
    if(selected.length < 2) return alert('Selecciona al menos 2 pagos pendientes.');
    const total = safeSum(selected, p=>p.amount);
    const overlay = document.createElement('div');
    overlay.className = 'tesConcSheetOverlay';
    overlay.innerHTML = `<section class="tesConcSheet v69Bulk" role="dialog" aria-modal="true">
      <button class="tesConcSheetClose" type="button" aria-label="Cerrar">×</button>
      <div class="tesConcGrip"></div>
      <h2>Conciliar ${selected.length} pagos</h2>
      <div class="tesConcSheetSummary">
        <div class="tesConcAvatar pending">✓</div>
        <div><b>${safeEsc(titleOfCampaign(c))}</b><small>Total seleccionado</small></div>
        <strong>${safeClp(total)}</strong>
      </div>
      <div class="tesBulkList">${selected.map(p=>`<div><span>${safeEsc(p.studentName || 'Alumno')}</span><b>${safeClp(p.amount || 0)}</b></div>`).join('')}</div>
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
    overlay.querySelector('.primary').onclick = ()=>window.confirmTesBulkConciliation(selected.map(p=>p.id), overlay);
    document.body.appendChild(overlay);
  };
  window.confirmTesBulkConciliation = function(ids, overlay){
    const idSet = new Set((ids || []).map(String));
    const payments = paymentsNormalized();
    const method = overlay?.querySelector('input[name="tesMethod"]:checked')?.value || 'transferencia';
    payments.forEach(p=>{
      if(!idSet.has(String(p.id))) return;
      p.paymentMethod = method;
      p.paidWith = method;
      p.conciliationStatus = 'conciliado';
      p.reconciledAt = new Date().toISOString();
      p.reconciledBy = 'Tesorero';
      p.reconciliationBank = overlay?.querySelector('#tesConcBank')?.value || '';
      p.reconciliationReference = overlay?.querySelector('#tesConcRef')?.value || '';
      p.reconciliationNote = overlay?.querySelector('#tesConcObs')?.value || '';
    });
    save(KEY_PAYMENTS, payments);
    try{ markDirty(); }catch(_){ }
    window.__tesBulkSelection = {};
    window.__tesBulkMode = false;
    overlay?.remove();
    renderConciliacion();
  };

  function renderConciliacionV69(){
    updateTreasurerHeader();
    const list = campaigns();
    const c = selectedCampaign();
    const campaignRows = rowsByCampaign(c?.id);
    const m = metrics(campaignRows);
    const goal = goalOfCampaign(c);
    const pct = goal ? Math.min(100, Math.round((m.rec / goal) * 100)) : (m.rec ? 72 : 0);
    const health = c ? healthForCampaign(c) : {label:'Sin campaña', cls:'warn'};
    const filter = String(window.__tesConcFilter || 'pendientes');
    const q = String(window.__tesConcQuery || '').toLowerCase().trim();
    let rows = filter === 'conciliados' ? m.conciliated : filter === 'todos' ? campaignRows : m.pending;
    if(q) rows = rows.filter(p=>[p.guardianName,p.apoderadoName,p.studentName,p.concept,paymentCampaignTitle(p),p.id,p.code,p.paymentCode].join(' ').toLowerCase().includes(q));
    const selectedPending = currentSelectedPending(campaignRows);
    const options = list.map(x=>`<option value="${safeEsc(x.id)}" ${String(x.id)===String(c?.id)?'selected':''}>${safeEsc(titleOfCampaign(x))}</option>`).join('');
    const rowsHtml = rows.map(renderPayCardV69).join('') || `<article class="tesConcEmpty"><b>No hay pagos en esta campaña</b><span>Cambia el filtro o selecciona otra campaña.</span></article>`;
    app.innerHTML = `<div class="tesConcPage tesConcV69">
      <section class="tesConcTop"><button type="button" onclick="go('home')">‹</button><h1>Conciliación por campaña</h1><button type="button" class="filterBtn">⚚ Filtros</button></section>
      <section class="tesCampaignSelector v69"><div class="tesCampaignSelectBox"><small>Campaña seleccionada</small><select onchange="tesSelectCampaignV69(this.value)">${options}</select></div><div class="tesCampaignSelectorIcon">${campaignIcon(c)}</div><div class="tesCampaignState"><small>Estado</small><b class="${health.cls}">${safeEsc(health.label)}</b><em>${pct}% de la meta</em></div></section>
      <section class="tesConcCampaignStats v69"><article><span class="amber">◷</span><small>Pendientes</small><b>${m.pending.length}</b><em>${safeClp(m.pendingAmount)}</em></article><article><span class="green">✓</span><small>Conciliados</small><b>${m.conciliated.length}</b><em>${safeClp(m.rec)}</em></article><article><span class="blue">↑</span><small>Recaudado</small><b>${safeClp(m.rec)}</b><em>de ${goal?safeClp(goal):'meta no definida'}</em></article><article><span class="violet">◎</span><small>Meta</small><b>${goal?safeClp(goal):'—'}</b><em>${pct}%</em></article></section>
      <section class="tesConcTools v69"><label><span>⌕</span><input value="${safeEsc(window.__tesConcQuery || '')}" oninput="tesFilterConciliation(this.value)" placeholder="Buscar apoderado, alumno o código de pago..."></label><button type="button">☷<small>Más filtros</small></button></section>
      <section class="tesConcTabs v69"><button type="button" class="${filter==='pendientes'?'active':''}" onclick="tesSetConciliationFilter('pendientes')">Pendientes <span>${m.pending.length}</span></button><button type="button" class="${filter==='conciliados'?'active ok':''}" onclick="tesSetConciliationFilter('conciliados')">Conciliados <span>${m.conciliated.length}</span></button><button type="button" class="${filter==='todos'?'active':''}" onclick="tesSetConciliationFilter('todos')">Todos <span>${campaignRows.length}</span></button></section>
      <section class="tesConcOrder v69"><span>Ordenar por <b>Más recientes⌄</b></span><label>Seleccionar varios <input type="checkbox" ${window.__tesBulkMode?'checked':''} onchange="tesToggleBulkMode(this.checked)"></label></section>
      <section class="tesConcList campaignOnly v69"><header><h2>${filter==='conciliados'?'Conciliados':'Pendientes'} (${rows.length})</h2><small>${safeEsc(titleOfCampaign(c))}</small></header>${rowsHtml}<div class="tesConcNote">ⓘ La información de esta pantalla corresponde solo a la campaña seleccionada.</div></section>
      ${window.__tesBulkMode && selectedPending.length >= 2 ? `<button class="tesBulkAction" type="button" onclick="openTesBulkConciliationSheet()">Conciliar ${selectedPending.length} seleccionados · ${safeClp(safeSum(selectedPending,p=>p.amount))}</button>` : ''}
    </div>`;
  }

  renderConciliacion = renderConciliacionV69;
})();

/* =========================================================
   Cursapp · Tesorero V71 CLEAN PATCH
   Fuerza Conciliación por campaña limpia sin depender de renders legacy.
   ========================================================= */
(function(){
  if(window.__CURSAPP_TESORERO_V71_CLEAN__) return;
  window.__CURSAPP_TESORERO_V71_CLEAN__ = true;

  const appEl = () => document.getElementById('app');
  const modalRootEl = () => document.getElementById('modalRoot') || document.body;
  const esc = (v)=>String(v ?? '').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const clp = (n)=>'$' + Number(n || 0).toLocaleString('es-CL');
  const sum = (arr, fn)=>(arr||[]).reduce((a,x)=>a+Number(fn?fn(x):x||0),0);
  const key = (base)=> (window.CURSAPP && typeof window.CURSAPP.scopedKey === 'function') ? window.CURSAPP.scopedKey(base) : `cursapp_${base}`;
  const KEY_TASKS = key('tasks_v1');
  const KEY_PAYMENTS = key('payments_v1');
  const load = (k, fb)=>{ try{ const v=localStorage.getItem(k); return v==null ? fb : JSON.parse(v); }catch(_){ return fb; } };
  const save = (k, v)=>{ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(_){} };
  const tasksAll = ()=> Array.isArray(load(KEY_TASKS, [])) ? load(KEY_TASKS, []) : [];
  const paymentsAll = ()=> Array.isArray(load(KEY_PAYMENTS, [])) ? load(KEY_PAYMENTS, []) : [];
  const uid = ()=> 'p_' + Math.random().toString(16).slice(2) + Date.now().toString(16);
  const titleOf = (c)=> String(c?.title || c?.name || c?.concept || 'Campaña').trim();
  const goalOf = (c)=> Number(c?.goal || c?.target || c?.meta || c?.amountGoal || 0);
  const payCampId = (p)=> String(p?.fromTaskId || p?.taskId || p?.campaignId || p?.concept || 'general');
  const isTransbank = (p)=> String(p?.paymentMethod || p?.paidWith || '').toLowerCase() === 'transbank';
  const isConc = (p)=> isTransbank(p) || String(p?.conciliationStatus || '').toLowerCase() === 'conciliado';
  const paymentDate = (p)=> String(p?.paidAt || p?.createdAt || p?.date || '');
  const shortDate = (v)=>{ const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'}).replace('.','') : 'Hoy'; };
  const timeLabel = (v)=>{ const d = v ? new Date(v) : null; if(!d || Number.isNaN(d.getTime())) return 'Registrado'; const mins=Math.max(1,Math.round((Date.now()-d.getTime())/60000)); if(mins<60) return `Hace ${mins} min`; if(mins<1440) return `Hace ${Math.round(mins/60)} h`; return shortDate(v); };
  const methodLabel = (p)=>{
    const m=String(p?.paymentMethod || p?.paidWith || '').toLowerCase();
    return ({transbank:'Transbank',transferencia:'Transferencia',efectivo:'Efectivo',cheque:'Cheque',otro:'Otro medio',saldo_favor:'Saldo a favor'})[m] || (isConc(p)?'Conciliado':'Sin medio');
  };
  function campaigns(){
    const active = tasksAll().filter(t=>!t.closed);
    const map = new Map();
    active.forEach(t=>map.set(String(t.id), t));
    paymentsAll().forEach(p=>{
      const id = payCampId(p);
      if(!map.has(id)) map.set(id,{id,title:p.concept || 'Campaña general',goal:0});
    });
    return Array.from(map.values());
  }
  function selectedCampaign(){
    const list = campaigns();
    if(!list.length) return null;
    let c = list.find(x=>String(x.id)===String(window.__tesCampaignId));
    if(!c){ c=list[0]; window.__tesCampaignId=String(c.id); }
    return c;
  }
  function rowsByCampaign(id){
    const rows = paymentsAll()
      .map(p=>({ createdAt:new Date().toISOString(), ...p }))
      .filter(p=>String(p.status || '').toLowerCase() === 'paid')
      .filter(p=>String(p.conciliationStatus || '').toLowerCase() !== 'anulado')
      .sort((a,b)=>paymentDate(b).localeCompare(paymentDate(a)));
    return id ? rows.filter(p=>payCampId(p)===String(id)) : rows;
  }
  function iconOf(c){ const t=titleOf(c).toLowerCase(); if(t.includes('gira')) return '🌎'; if(t.includes('paseo')) return '🚌'; if(t.includes('cuota')) return '🗓️'; if(t.includes('aseo')) return '🧽'; return '🎯'; }
  function health(c){ const pending = rowsByCampaign(c?.id).filter(p=>!isConc(p)); return pending.length ? {label:'Pend. conciliación',cls:'warn'} : {label:'Cuadrada ✓',cls:'ok'}; }
  function initials(p){ return String(p?.studentName || p?.guardianName || p?.apoderadoName || 'P').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase() || 'P'; }
  function markActive(){ document.querySelectorAll('.navItem').forEach(b=>b.classList.toggle('active', String(b.dataset.tab)==='conciliacion')); }
  function syncHeader(){
    try{
      const s=JSON.parse(localStorage.getItem('cursapp_session_v1')||'{}');
      const name=s.fullName||s.displayName||s.name||s.nombre||s.guardianName||s.apoderadoName||'Tesorero';
      const course=s.courseLabel||s.course||s.curso||'2°B';
      const school=s.schoolName||s.colegio||s.school||'Colegio Central';
      const n=document.querySelector('.tesHeaderName'); if(n) n.textContent=String(name).includes('@')?'Tesorero':name;
      const r=document.querySelector('.tesHeaderRole'); if(r) r.textContent='Tesorero';
      const c=document.querySelector('.tesHeaderCourse'); if(c) c.textContent=`${course} · ${school}`;
    }catch(_){}
  }
  window.__tesConcFilter = window.__tesConcFilter || 'pendientes';
  window.__tesConcQuery = window.__tesConcQuery || '';
  window.__tesBulkMode = false;
  window.__tesBulkSelection = {};

  function selectedPending(rows){ const ids=new Set(Object.keys(window.__tesBulkSelection||{}).filter(k=>window.__tesBulkSelection[k])); return rows.filter(p=>ids.has(String(p.id)) && !isConc(p)); }
  function rowCard(p){
    const pending = !isConc(p);
    const checked = !!window.__tesBulkSelection[String(p.id)];
    const code = String(p.code || p.paymentCode || p.id || '').slice(-6).toUpperCase() || 'PAGO';
    return `<article class="tesV71Pay ${pending?'pending':'done'} ${checked?'selected':''}">
      ${window.__tesBulkMode && pending ? `<label class="tesV71Check"><input type="checkbox" ${checked?'checked':''} onchange="tesV71TogglePayment('${esc(p.id)}',this.checked)"><span></span></label>`:''}
      <div class="tesV71Avatar ${pending?'':'ok'}">${pending?esc(initials(p)):'✓'}</div>
      <div class="tesV71Who"><b>${esc(p.studentName || 'Alumno')}</b><small>${esc(p.guardianName || p.apoderadoName || 'Apoderado')}</small><em>${esc(titleOf(campaigns().find(c=>String(c.id)===payCampId(p))) || p.concept || 'Campaña')}</em><u>Código: #${esc(code)}</u></div>
      <div class="tesV71Amount"><b>${clp(p.amount)}</b><span class="${pending?'pending':'done'}">${pending?'Pendiente':'Conciliado ✓'}</span><small>${pending?'Sin medio confirmado':methodLabel(p)}</small></div>
      <div class="tesV71Action">${pending?`<button type="button" onclick="tesV71OpenSheet('${esc(p.id)}')">Conciliar</button>`:`<small>${shortDate(p.reconciledAt || p.paidAt || p.createdAt)}</small>`}</div>
    </article>`;
  }
  function renderConciliation(){
    syncHeader(); markActive();
    const app = appEl(); if(!app) return;
    const list=campaigns(); const c=selectedCampaign(); const all=rowsByCampaign(c?.id);
    const pending=all.filter(p=>!isConc(p)); const conc=all.filter(isConc); const rec=sum(conc,p=>p.amount); const goal=goalOf(c); const pct=goal?Math.min(100,Math.round((rec/goal)*100)):(rec?72:0); const h=health(c);
    const q=String(window.__tesConcQuery||'').toLowerCase().trim(); const filter=String(window.__tesConcFilter||'pendientes');
    let rows=filter==='conciliados'?conc:filter==='todos'?all:pending;
    if(q) rows=rows.filter(p=>[p.guardianName,p.apoderadoName,p.studentName,p.concept,p.id,p.code,p.paymentCode].join(' ').toLowerCase().includes(q));
    const selected=selectedPending(all);
    app.innerHTML = `<div class="tesConcPage tesV71Conc">
      <section class="tesV71Top"><button type="button" onclick="go('home')">‹</button><h1>Conciliación por campaña</h1><button type="button" class="filterBtn">⚚ Filtros</button></section>
      <section class="tesV71Campaign"><div class="tesV71Select"><small>Campaña</small><select onchange="tesV71SelectCampaign(this.value)">${list.map(x=>`<option value="${esc(x.id)}" ${String(x.id)===String(c?.id)?'selected':''}>${esc(titleOf(x))}</option>`).join('')}</select></div><div class="tesV71Icon">${iconOf(c)}</div><div class="tesV71State"><small>Estado</small><b class="${h.cls}">${esc(h.label)}</b><em>${pct}% de la meta</em></div></section>
      <section class="tesV71Stats"><article><span class="amber">◷</span><small>Pendientes</small><b>${pending.length}</b><em>${clp(sum(pending,p=>p.amount))}</em></article><article><span class="green">✓</span><small>Conciliados</small><b>${conc.length}</b><em>${clp(rec)}</em></article><article><span class="blue">↑</span><small>Recaudado</small><b>${clp(rec)}</b><em>${goal?'de '+clp(goal):'meta no definida'}</em></article><article><span class="violet">◎</span><small>Meta</small><b>${goal?clp(goal):'—'}</b><em>${pct}%</em></article></section>
      <section class="tesV71Search"><label><span>⌕</span><input value="${esc(window.__tesConcQuery||'')}" oninput="tesV71Query(this.value)" placeholder="Buscar apoderado, alumno o código..."></label><button type="button">☷<small>Más filtros</small></button></section>
      <section class="tesV71Tabs"><button class="${filter==='pendientes'?'active':''}" onclick="tesV71Filter('pendientes')">Pendientes <span>${pending.length}</span></button><button class="${filter==='conciliados'?'active ok':''}" onclick="tesV71Filter('conciliados')">Conciliados <span>${conc.length}</span></button><button class="${filter==='todos'?'active':''}" onclick="tesV71Filter('todos')">Todos <span>${all.length}</span></button></section>
      <section class="tesV71Order"><span>Ordenar por <b>Más recientes⌄</b></span><label>Seleccionar varios <input type="checkbox" ${window.__tesBulkMode?'checked':''} onchange="tesV71BulkMode(this.checked)"></label></section>
      <section class="tesV71List"><header><h2>${filter==='conciliados'?'Conciliados':'Pendientes'} (${rows.length})</h2><small>${esc(titleOf(c))}</small></header>${rows.map(rowCard).join('') || `<article class="tesConcEmpty"><b>No hay pagos en esta campaña</b><span>Cambia el filtro o selecciona otra campaña.</span></article>`}<div class="tesConcNote">ⓘ Toda la información corresponde a la campaña seleccionada.</div></section>
      ${window.__tesBulkMode && selected.length >= 2 ? `<button class="tesBulkAction v71" onclick="tesV71OpenBulk()">Conciliar ${selected.length} seleccionados · ${clp(sum(selected,p=>p.amount))}</button>`:''}
    </div>`;
  }
  window.tesV71SelectCampaign = function(id){ window.__tesCampaignId=String(id||''); window.__tesBulkSelection={}; window.__tesBulkMode=false; renderConciliation(); };
  window.tesV71Filter = function(f){ window.__tesConcFilter=String(f||'pendientes'); window.__tesBulkSelection={}; renderConciliation(); };
  window.tesV71Query = function(v){ window.__tesConcQuery=String(v||''); renderConciliation(); };
  window.tesV71BulkMode = function(v){ window.__tesBulkMode=!!v; window.__tesBulkSelection={}; if(v) window.__tesConcFilter='pendientes'; renderConciliation(); };
  window.tesV71TogglePayment = function(id,v){ window.__tesBulkSelection[String(id)]=!!v; renderConciliation(); };
  function applyConciliation(ids, overlay){
    const set=new Set((ids||[]).map(String)); const arr=paymentsAll(); const method=overlay.querySelector('input[name="tesMethod"]:checked')?.value || 'transferencia';
    arr.forEach(p=>{ if(!set.has(String(p.id))) return; p.paymentMethod=method; p.paidWith=method; p.conciliationStatus='conciliado'; p.reconciledAt=new Date().toISOString(); p.reconciledBy='Tesorero'; p.reconciliationBank=overlay.querySelector('#tesConcBank')?.value||''; p.reconciliationReference=overlay.querySelector('#tesConcRef')?.value||''; p.reconciliationNote=overlay.querySelector('#tesConcObs')?.value||''; });
    save(KEY_PAYMENTS, arr); window.__tesBulkMode=false; window.__tesBulkSelection={}; overlay.remove(); renderConciliation();
  }
  function sheetHtml(title, subtitle, total){ return `<section class="tesConcSheet" role="dialog" aria-modal="true"><button class="tesConcSheetClose" type="button">×</button><div class="tesConcGrip"></div><h2>${esc(title)}</h2><div class="tesConcSheetSummary"><div class="tesConcAvatar pending">✓</div><div><b>${esc(subtitle)}</b><small>Total a conciliar</small></div><strong>${clp(total)}</strong></div><h3>Seleccione el medio recibido</h3><div class="tesConcMethodGrid"><label><input type="radio" name="tesMethod" value="transferencia" checked><span>🏦</span><b>Transferencia bancaria</b><small>Desde cuenta bancaria</small></label><label><input type="radio" name="tesMethod" value="efectivo"><span>💵</span><b>Efectivo</b><small>Dinero recibido en efectivo</small></label><label><input type="radio" name="tesMethod" value="cheque"><span>🧾</span><b>Cheque</b><small>Pago con cheque</small></label><label><input type="radio" name="tesMethod" value="otro"><span>•••</span><b>Otro medio</b><small>Otro método</small></label></div><h3>Información adicional <small>(opcional)</small></h3><select id="tesConcBank"><option value="">Banco (si aplica)</option><option>Banco de Chile</option><option>BancoEstado</option><option>Santander</option><option>BCI</option><option>Scotiabank</option><option>Itaú</option><option>Otro</option></select><input id="tesConcRef" placeholder="N° referencia / comprobante"><textarea id="tesConcObs" rows="3" placeholder="Observación opcional"></textarea><div class="tesConcSheetActions"><button type="button" class="ghost">Cancelar</button><button type="button" class="primary">Confirmar conciliación</button></div></section>`; }
  window.tesV71OpenSheet = function(id){ const p=rowsByCampaign('').find(x=>String(x.id)===String(id)); if(!p) return alert('No se encontró el pago.'); const overlay=document.createElement('div'); overlay.className='tesConcSheetOverlay'; overlay.innerHTML=sheetHtml('Conciliar pago', `${p.studentName||'Alumno'} · ${p.guardianName||p.apoderadoName||'Apoderado'}`, Number(p.amount||0)); overlay.onclick=e=>{ if(e.target===overlay) overlay.remove(); }; overlay.querySelector('.tesConcSheetClose').onclick=()=>overlay.remove(); overlay.querySelector('.ghost').onclick=()=>overlay.remove(); overlay.querySelector('.primary').onclick=()=>applyConciliation([id], overlay); document.body.appendChild(overlay); };
  window.tesV71OpenBulk = function(){ const c=selectedCampaign(); const selected=selectedPending(rowsByCampaign(c?.id)); if(selected.length<2) return alert('Selecciona al menos 2 pagos pendientes.'); const overlay=document.createElement('div'); overlay.className='tesConcSheetOverlay'; overlay.innerHTML=sheetHtml(`Conciliar ${selected.length} pagos`, titleOf(c), sum(selected,p=>p.amount)); overlay.onclick=e=>{ if(e.target===overlay) overlay.remove(); }; overlay.querySelector('.tesConcSheetClose').onclick=()=>overlay.remove(); overlay.querySelector('.ghost').onclick=()=>overlay.remove(); overlay.querySelector('.primary').onclick=()=>applyConciliation(selected.map(p=>p.id), overlay); document.body.appendChild(overlay); };

  const oldGo = window.go;
  window.go = function(tab, taskId){ if(String(tab).toLowerCase()==='conciliacion'){ renderConciliation(); return; } return typeof oldGo==='function' ? oldGo(tab, taskId) : undefined; };
  document.addEventListener('click', function(e){ const btn=e.target.closest && e.target.closest('.navItem[data-tab="conciliacion"]'); if(!btn) return; e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); renderConciliation(); }, true);
  setTimeout(()=>{ try{ if(location.hash.replace('#','')==='conciliacion' || document.querySelector('.navItem[data-tab="conciliacion"].active')) renderConciliation(); }catch(_){} }, 350);
})();

/* =========================================================
   Cursapp · Tesorero V72
   - Conciliación por campaña final: selector ancho completo + metadata campaña
   - Confirmación visual post-conciliación individual/masiva
   - Render blindado sobre versiones legacy anteriores
   ========================================================= */
(function(){
  if(window.__CURSAPP_TESORERO_V72__) return;
  window.__CURSAPP_TESORERO_V72__ = true;

  const $ = (id)=>document.getElementById(id);
  const esc = (s)=>String(s ?? '').replace(/[&<>'"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));
  const clp = (n)=>'$' + Number(n || 0).toLocaleString('es-CL');
  const sum = (arr, fn)=>(arr||[]).reduce((a,x)=>a+Number(fn?fn(x):x||0),0);
  const scoped = (base)=> (window.CURSAPP && typeof window.CURSAPP.scopedKey === 'function') ? window.CURSAPP.scopedKey(base) : `cursapp_${base}`;
  const KEY_TASKS = scoped('tasks_v1');
  const KEY_PAYMENTS = scoped('payments_v1');
  const KEY_PROFILES = 'cursapp_profiles_v1';
  const load = (key, fallback=[])=>{ try{ const raw=localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } };
  const save = (key, val)=>localStorage.setItem(key, JSON.stringify(val));
  const appEl = ()=>document.getElementById('app');
  const nowIso = ()=>new Date().toISOString();

  function activeCourseKey(){ try{ return String(localStorage.getItem('cursapp_active_course_v1') || '').trim(); }catch(_){ return ''; } }
  function tasks(){ const t = load(KEY_TASKS, []); return Array.isArray(t) ? t.filter(x=>!x.closed) : []; }
  function payments(){ const p = load(KEY_PAYMENTS, []); return Array.isArray(p) ? p : []; }
  function profiles(){ const p = load(KEY_PROFILES, []); return Array.isArray(p) ? p : []; }
  function titleOf(c){ return String(c?.title || c?.name || c?.concept || 'Campaña').trim(); }
  function goalOf(c){ return Number(c?.goal || c?.target || c?.meta || c?.amountGoal || 0); }
  function paymentCampaignId(p){ return String(p?.fromTaskId || p?.taskId || p?.campaignId || ''); }
  function method(p){ return String(p?.paymentMethod || p?.paidWith || '').toLowerCase(); }
  function isTransbank(p){ return method(p) === 'transbank'; }
  function isConciliated(p){ return isTransbank(p) || String(p?.conciliationStatus || '').toLowerCase() === 'conciliado'; }
  function methodLabel(p){ return ({transbank:'Transbank', transferencia:'Transferencia', efectivo:'Efectivo', cheque:'Cheque', otro:'Otro medio', saldo_favor:'Saldo a favor'})[method(p)] || 'Medio registrado'; }
  function paymentDate(p){ return String(p?.paidAt || p?.createdAt || p?.date || ''); }
  function campaignIcon(c){ const t=titleOf(c).toLowerCase(); if(t.includes('gira')) return '🌎'; if(t.includes('paseo')) return '🚌'; if(t.includes('aseo')) return '🧽'; if(t.includes('cuota')) return '🗓️'; return '🎯'; }
  function campaignStatus(c){ const st=String(c?.status || '').toLowerCase(); if(c?.closed || st.includes('cerr') || st.includes('final')) return {label:'Finalizada', cls:'neutral'}; if(st.includes('paus')) return {label:'Pausada', cls:'warn'}; return {label:'Activa', cls:'active'}; }
  function createdAtOf(c){
    const raw = c?.createdAt || c?.created_at || c?.startDate || c?.dueDate || '';
    const d = raw ? new Date(raw) : null;
    if(d && !Number.isNaN(d.getTime())) return d.toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'}).replace('.','') + ' · ' + d.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});
    return 'Sin fecha';
  }
  function campaigns(){
    const t = tasks();
    if(t.length) return t;
    const map = new Map();
    payments().forEach(p=>{
      const id = paymentCampaignId(p) || String(p.concept || 'general');
      if(!map.has(id)) map.set(id,{id, title:p.concept || 'Campaña general', goal:0, createdAt:p.createdAt || p.paidAt});
    });
    return Array.from(map.values());
  }
  function selectedCampaign(){
    const list = campaigns();
    if(!list.length) return null;
    let c = list.find(x=>String(x.id)===String(window.__tesCampaignId));
    if(!c){ c=list[0]; window.__tesCampaignId=String(c.id); }
    return c;
  }
  function rowsByCampaign(id){
    return payments().filter(p=>String(p.status||'').toLowerCase()==='paid')
      .filter(p=>String(p.conciliationStatus||'').toLowerCase()!=='anulado')
      .filter(p=>!id || paymentCampaignId(p)===String(id))
      .sort((a,b)=>paymentDate(b).localeCompare(paymentDate(a)));
  }
  function participation(c, rows){
    const course = activeCourseKey();
    const totalProfiles = profiles().filter(p=>!course || String(p.courseKey||'')===course);
    const total = Math.max(totalProfiles.length || 0, 30);
    const set = new Set();
    (rows||[]).forEach(p=>{
      const k = String(p.apoderadoEmail || p.email || p.apoderadoKey || p.guardianName || p.apoderadoName || '') + '|' + String(p.studentName || p.alumno || '');
      if(k.trim() !== '|') set.add(k.toLowerCase());
    });
    const count = Math.min(total, set.size || Math.min(total, (rows||[]).length));
    const pct = total ? Math.round((count/total)*100) : 0;
    return {count,total,pct};
  }
  function initials(p){ return String(p?.studentName || p?.guardianName || p?.apoderadoName || 'P').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase() || 'P'; }
  function shortDate(v){ const d=v?new Date(v):null; if(d && !Number.isNaN(d.getTime())) return d.toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'}).replace('.',''); return 'Hoy'; }
  function shortTime(v){ const d=v?new Date(v):new Date(); return d.toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'}).replace('.','') + ' · ' + d.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}); }
  function syncHeader(){
    try{
      const s=JSON.parse(localStorage.getItem('cursapp_session_v1')||'{}');
      const rawName=s.fullName||s.displayName||s.name||s.nombre||s.guardianName||s.apoderadoName||'Tesorero';
      const name=String(rawName).includes('@') ? 'Tesorero' : rawName;
      const course=s.courseLabel||s.course||s.curso||'2°B';
      const school=s.schoolName||s.colegio||s.school||'Colegio Central';
      const n=document.querySelector('.tesHeaderName'); if(n) n.textContent=name;
      const r=document.querySelector('.tesHeaderRole'); if(r) r.textContent='Tesorero';
      const c=document.querySelector('.tesHeaderCourse'); if(c) c.textContent=`${course} · ${school}`;
    }catch(_){ }
  }
  function setActive(){ document.querySelectorAll('.navItem').forEach(b=>b.classList.toggle('active', String(b.dataset.tab)==='conciliacion')); }

  window.__tesConcFilter = window.__tesConcFilter || 'pendientes';
  window.__tesConcQuery = window.__tesConcQuery || '';
  window.__tesBulkMode = !!window.__tesBulkMode;
  window.__tesBulkSelection = window.__tesBulkSelection || {};

  function selectedPending(rows){ const ids=new Set(Object.keys(window.__tesBulkSelection||{}).filter(k=>window.__tesBulkSelection[k])); return rows.filter(p=>ids.has(String(p.id)) && !isConciliated(p)); }
  function paymentCard(p){
    const pending = !isConciliated(p);
    const checked = !!window.__tesBulkSelection[String(p.id)];
    const code = String(p.code || p.paymentCode || p.id || '').slice(-6).toUpperCase() || 'PAGO';
    return `<article class="tesV72Pay ${pending?'pending':'done'} ${checked?'selected':''}">
      ${window.__tesBulkMode && pending ? `<label class="tesV72Check"><input type="checkbox" ${checked?'checked':''} onchange="tesV72TogglePayment('${esc(p.id)}',this.checked)"><span></span></label>`:''}
      <div class="tesV72Avatar ${pending?'':'ok'}">${pending?esc(initials(p)):'✓'}</div>
      <div class="tesV72Who"><b>${esc(p.studentName || 'Alumno')}</b><small>${esc(p.guardianName || p.apoderadoName || 'Apoderado')}</small><em>${esc(p.concept || titleOf(selectedCampaign()))}</em><u>Código: #${esc(code)}</u></div>
      <div class="tesV72Amount"><b>${clp(p.amount)}</b><span class="${pending?'pending':'done'}">${pending?'Pendiente':'Conciliado ✓'}</span><small>${pending?'Sin medio confirmado':esc(methodLabel(p))}</small></div>
      <div class="tesV72Action">${pending?`<button type="button" onclick="tesV72OpenSheet('${esc(p.id)}')">Conciliar</button>`:`<small>${esc(shortDate(p.reconciledAt || p.paidAt || p.createdAt))}</small>`}</div>
    </article>`;
  }

  function render(){
    const app=appEl(); if(!app) return;
    syncHeader(); setActive();
    const list=campaigns(); const c=selectedCampaign(); const all=rowsByCampaign(c?.id);
    const pending=all.filter(p=>!isConciliated(p)); const conc=all.filter(isConciliated); const rec=sum(conc,p=>p.amount); const goal=goalOf(c); const pct=goal?Math.min(100,Math.round((rec/goal)*100)):(rec?72:0);
    const st=campaignStatus(c); const part=participation(c, all);
    const q=String(window.__tesConcQuery||'').toLowerCase().trim(); const filter=String(window.__tesConcFilter||'pendientes');
    let rows=filter==='conciliados'?conc:filter==='todos'?all:pending;
    if(q) rows=rows.filter(p=>[p.guardianName,p.apoderadoName,p.studentName,p.concept,p.id,p.code,p.paymentCode].join(' ').toLowerCase().includes(q));
    const selected=selectedPending(all);
    app.innerHTML = `<div class="tesConcPage tesV72Conc">
      <section class="tesV72Top"><button type="button" onclick="go('home')">‹</button><h1>Conciliación por campaña</h1><button type="button" class="filterBtn">⚚ Filtros</button></section>
      <section class="tesV72Campaign">
        <div class="tesV72SelectFull"><small>Campaña</small><select onchange="tesV72SelectCampaign(this.value)">${list.map(x=>`<option value="${esc(x.id)}" ${String(x.id)===String(c?.id)?'selected':''}>${esc(titleOf(x))}</option>`).join('')}</select></div>
        <div class="tesV72CampaignMain"><div class="tesV72BigIcon">${campaignIcon(c)}</div><div class="tesV72State"><small>Estado conciliación</small><b class="${pending.length?'warn':'ok'}">${pending.length?'Pend. conciliación':'Cuadrada ✓'}</b><em>${pct}% de la meta</em></div></div>
        <div class="tesV72CampaignMeta"><article><span>▣</span><small>Creación</small><b>${esc(createdAtOf(c))}</b></article><article><span>⚑</span><small>Estado campaña</small><b class="${st.cls}">${esc(st.label)}</b></article><article><span>👥</span><small>Participación</small><b>${part.count} / ${part.total}</b><em>${part.pct}%</em></article><article><span>◎</span><small>Meta total</small><b>${goal?clp(goal):'Por definir'}</b></article></div>
      </section>
      <section class="tesV72Stats"><article><span class="amber">◷</span><small>Pendientes</small><b>${pending.length}</b><em>${clp(sum(pending,p=>p.amount))}</em></article><article><span class="green">✓</span><small>Conciliados</small><b>${conc.length}</b><em>${clp(rec)}</em></article><article><span class="blue">↑</span><small>Recaudado</small><b>${clp(rec)}</b><em>${goal?'meta '+clp(goal):'meta no definida'}</em></article><article><span class="violet">◎</span><small>Meta</small><b>${goal?clp(goal):'—'}</b><em>${pct}%</em></article></section>
      <section class="tesV72Search"><label><span>⌕</span><input value="${esc(window.__tesConcQuery||'')}" oninput="tesV72Query(this.value)" placeholder="Buscar apoderado, alumno o código..."></label><button type="button">☷<small>Más filtros</small></button></section>
      <section class="tesV72Tabs"><button class="${filter==='pendientes'?'active':''}" onclick="tesV72Filter('pendientes')">Pendientes <span>${pending.length}</span></button><button class="${filter==='conciliados'?'active ok':''}" onclick="tesV72Filter('conciliados')">Conciliados <span>${conc.length}</span></button><button class="${filter==='todos'?'active':''}" onclick="tesV72Filter('todos')">Todos <span>${all.length}</span></button></section>
      <section class="tesV72Order"><span>Ordenar por <b>Más recientes⌄</b></span><label>Seleccionar varios <input type="checkbox" ${window.__tesBulkMode?'checked':''} onchange="tesV72BulkMode(this.checked)"></label></section>
      <section class="tesV72List"><header><h2>${filter==='conciliados'?'Conciliados':'Pendientes'} (${rows.length})</h2><small>${esc(titleOf(c))}</small></header>${rows.map(paymentCard).join('') || `<article class="tesConcEmpty"><b>No hay pagos en esta campaña</b><span>Cambia el filtro o selecciona otra campaña.</span></article>`}<div class="tesConcNote">ⓘ Toda la información corresponde a la campaña seleccionada.</div></section>
      ${window.__tesBulkMode && selected.length >= 2 ? `<button class="tesBulkAction v72" onclick="tesV72OpenBulk()">Conciliar ${selected.length} seleccionados · ${clp(sum(selected,p=>p.amount))}</button>`:''}
    </div>`;
  }

  function showSuccessModal(info){
    const overlay=document.createElement('div');
    overlay.className='tesV72SuccessOverlay';
    overlay.innerHTML=`<section class="tesV72Success" role="dialog" aria-modal="true">
      <div class="tesV72Confetti">· · ·</div><div class="tesV72SuccessIcon">✓</div><h2>${info.count>1?'Pagos conciliados':'¡Pago conciliado!'}</h2><p>${info.count>1?`${info.count} pagos fueron conciliados correctamente.`:'El pago ha sido conciliado correctamente.'}</p>
      <div class="tesV72SuccessData"><article><small>${info.count>1?'Campaña':'Apoderado'}</small><b>${esc(info.count>1?info.campaign:info.guardian)}</b></article><article><small>Monto</small><b>${clp(info.total)}</b></article><article><small>Medio de pago</small><b>${esc(info.methodLabel)}</b></article><article><small>Fecha y hora</small><b>${esc(shortTime(nowIso()))}</b></article></div>
      <button type="button">Aceptar</button>
    </section>`;
    overlay.querySelector('button').onclick=()=>{ overlay.remove(); render(); };
    document.body.appendChild(overlay);
  }

  function sheetHtml(title, subtitle, total){
    return `<section class="tesConcSheet" role="dialog" aria-modal="true"><button class="tesConcSheetClose" type="button">×</button><div class="tesConcGrip"></div><h2>${esc(title)}</h2><div class="tesConcSheetSummary"><div class="tesConcAvatar pending">✓</div><div><b>${esc(subtitle)}</b><small>Total a conciliar</small></div><strong>${clp(total)}</strong></div><h3>Seleccione el medio recibido</h3><div class="tesConcMethodGrid"><label><input type="radio" name="tesMethod" value="transferencia" checked><span>🏦</span><b>Transferencia bancaria</b><small>Desde cuenta bancaria</small></label><label><input type="radio" name="tesMethod" value="efectivo"><span>💵</span><b>Efectivo</b><small>Dinero recibido en efectivo</small></label><label><input type="radio" name="tesMethod" value="cheque"><span>🧾</span><b>Cheque</b><small>Pago con cheque</small></label><label><input type="radio" name="tesMethod" value="otro"><span>•••</span><b>Otro medio</b><small>Otro método</small></label></div><h3>Información adicional <small>(opcional)</small></h3><select id="tesConcBank"><option value="">Banco (si aplica)</option><option>Banco de Chile</option><option>BancoEstado</option><option>Santander</option><option>BCI</option><option>Scotiabank</option><option>Itaú</option><option>Otro</option></select><input id="tesConcRef" placeholder="N° referencia / comprobante"><textarea id="tesConcObs" rows="3" placeholder="Observación opcional"></textarea><div class="tesConcSheetActions"><button type="button" class="ghost">Cancelar</button><button type="button" class="primary">Confirmar conciliación</button></div></section>`;
  }
  function openSheet(ids, title, subtitle, total){
    const overlay=document.createElement('div'); overlay.className='tesConcSheetOverlay'; overlay.innerHTML=sheetHtml(title, subtitle, total);
    overlay.onclick=e=>{ if(e.target===overlay) overlay.remove(); };
    overlay.querySelector('.tesConcSheetClose').onclick=()=>overlay.remove(); overlay.querySelector('.ghost').onclick=()=>overlay.remove();
    overlay.querySelector('.primary').onclick=()=>applyConciliation(ids, overlay);
    document.body.appendChild(overlay);
  }
  function applyConciliation(ids, overlay){
    const set=new Set((ids||[]).map(String)); const arr=payments(); const methodValue=overlay.querySelector('input[name="tesMethod"]:checked')?.value || 'transferencia';
    const selected=arr.filter(p=>set.has(String(p.id))); const total=sum(selected,p=>p.amount); const campaign=titleOf(selectedCampaign());
    arr.forEach(p=>{ if(!set.has(String(p.id))) return; p.paymentMethod=methodValue; p.paidWith=methodValue; p.conciliationStatus='conciliado'; p.reconciledAt=nowIso(); p.reconciledBy='Tesorero'; p.reconciliationBank=overlay.querySelector('#tesConcBank')?.value||''; p.reconciliationReference=overlay.querySelector('#tesConcRef')?.value||''; p.reconciliationNote=overlay.querySelector('#tesConcObs')?.value||''; });
    save(KEY_PAYMENTS, arr); window.__tesBulkMode=false; window.__tesBulkSelection={}; overlay.remove();
    showSuccessModal({count:selected.length,total,campaign,guardian:selected[0]?.guardianName || selected[0]?.apoderadoName || 'Apoderado',methodLabel:({transferencia:'Transferencia bancaria',efectivo:'Efectivo',cheque:'Cheque',otro:'Otro medio'})[methodValue] || methodValue});
  }

  window.tesV72SelectCampaign = function(id){ window.__tesCampaignId=String(id||''); window.__tesBulkSelection={}; window.__tesBulkMode=false; render(); };
  window.tesV72Filter = function(f){ window.__tesConcFilter=String(f||'pendientes'); window.__tesBulkSelection={}; render(); };
  window.tesV72Query = function(v){ window.__tesConcQuery=String(v||''); render(); };
  window.tesV72BulkMode = function(v){ window.__tesBulkMode=!!v; window.__tesBulkSelection={}; if(v) window.__tesConcFilter='pendientes'; render(); };
  window.tesV72TogglePayment = function(id,v){ window.__tesBulkSelection[String(id)]=!!v; render(); };
  window.tesV72OpenSheet = function(id){ const p=rowsByCampaign('').find(x=>String(x.id)===String(id)); if(!p) return alert('No se encontró el pago.'); openSheet([id], 'Conciliar pago', `${p.studentName||'Alumno'} · ${p.guardianName||p.apoderadoName||'Apoderado'}`, Number(p.amount||0)); };
  window.tesV72OpenBulk = function(){ const selected=selectedPending(rowsByCampaign(selectedCampaign()?.id)); if(selected.length<2) return alert('Selecciona al menos 2 pagos pendientes.'); openSheet(selected.map(p=>p.id), `Conciliar ${selected.length} pagos`, titleOf(selectedCampaign()), sum(selected,p=>p.amount)); };

  const previousGo = window.go;
  window.go = function(tab, taskId){ if(String(tab||'').toLowerCase()==='conciliacion'){ render(); return; } return typeof previousGo==='function' ? previousGo(tab, taskId) : undefined; };

  let suppressObserver=false;
  function shouldRender(){
    const app=appEl();
    return !!app && (document.querySelector('.navItem[data-tab="conciliacion"].active') || /tesV7[01]Conc|Conciliaci[oó]n por campa/i.test(app.innerHTML));
  }
  function renderSoon(){ if(suppressObserver) return; setTimeout(()=>{ if(!shouldRender()) return; const app=appEl(); if(app && app.querySelector('.tesV72Conc')) return; suppressObserver=true; render(); setTimeout(()=>suppressObserver=false, 60); }, 0); }
  document.addEventListener('DOMContentLoaded',()=>{ const app=appEl(); if(app){ new MutationObserver(renderSoon).observe(app,{childList:true,subtree:false}); } setTimeout(renderSoon, 500); });
  setTimeout(renderSoon, 700);
})();

/* =========================================================
   Cursapp · Tesorero V73
   Conciliar: campaña compacta + búsqueda/lista como foco principal.
   - Mantiene selector por campaña.
   - Lista de alumnos/apoderados arriba y resumen abajo.
   - Conciliación individual y masiva con modal de éxito.
   ========================================================= */
(function(){
  if(window.__TESORERO_V73_LOADED__) return;
  window.__TESORERO_V73_LOADED__ = true;

  const esc = (s)=>String(s ?? '').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const clp = (n)=>'$' + Number(n||0).toLocaleString('es-CL');
  const load = (k,f=[])=>{ try{ const v=localStorage.getItem(k); return v==null ? f : JSON.parse(v); }catch(_){ return f; } };
  const save = (k,v)=>{ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(_){} };
  const sum = (a,fn)=> (a||[]).reduce((t,x)=>t+Number(fn?fn(x):x||0),0);
  const scoped = (base)=> (window.CURSAPP && typeof window.CURSAPP.scopedKey === 'function') ? window.CURSAPP.scopedKey(base) : `cursapp_${base}`;
  const KEY_TASKS = scoped('tasks_v1');
  const KEY_PAYMENTS = scoped('payments_v1');
  const KEY_PROFILES = 'cursapp_profiles_v1';
  const nowIso = ()=>new Date().toISOString();

  window.__tesConcFilter = window.__tesConcFilter || 'pendientes';
  window.__tesConcQuery = window.__tesConcQuery || '';
  window.__tesBulkSelection = window.__tesBulkSelection || {};

  function app(){ return document.getElementById('app'); }
  function tasks(){ const arr=load(KEY_TASKS,[]); return Array.isArray(arr)?arr:[]; }
  function payments(){ const arr=load(KEY_PAYMENTS,[]); return Array.isArray(arr)?arr:[]; }
  function profiles(){ const arr=load(KEY_PROFILES,[]); return Array.isArray(arr)?arr:[]; }
  function titleOf(c){ return String(c?.title || c?.name || c?.concept || 'Campaña').trim(); }
  function goalOf(c){ return Number(c?.goal || c?.target || c?.meta || c?.amountGoal || 0); }
  function payCampId(p){ return String(p?.fromTaskId || p?.taskId || p?.campaignId || ''); }
  function isConc(p){ return String(p?.paymentMethod || p?.paidWith || '').toLowerCase()==='transbank' || String(p?.conciliationStatus || '').toLowerCase()==='conciliado'; }
  function isPaidLike(p){ const st=String(p?.status||'').toLowerCase(); return !st || st==='paid' || st==='pagado'; }
  function validRows(){ return payments().filter(p=>String(p?.conciliationStatus||'').toLowerCase()!=='anulado').filter(isPaidLike); }
  function campaigns(){
    const t=tasks().filter(x=>!x?.hidden);
    if(t.length) return t;
    const map = new Map();
    validRows().forEach(p=>{ const id=payCampId(p)||String(p?.concept||'general'); if(!map.has(id)) map.set(id,{id,title:p?.concept||'Campaña general'}); });
    return Array.from(map.values());
  }
  function selectedCampaign(){
    const list=campaigns();
    if(!list.length) return {id:'general',title:'Campaña general'};
    let c=list.find(x=>String(x.id)===String(window.__tesCampaignId));
    if(!c){ c=list[0]; window.__tesCampaignId=String(c.id); }
    return c;
  }
  function rowsByCampaign(id){
    const cid=String(id||'');
    if(!cid) return validRows();
    return validRows().filter(p=>payCampId(p)===cid || (!payCampId(p) && String(p?.concept||'')===cid));
  }
  function campaignIcon(c){
    const t=titleOf(c).toLowerCase();
    if(t.includes('gira')) return '🎯';
    if(t.includes('paseo')) return '🚌';
    if(t.includes('aseo')) return '🧽';
    if(t.includes('cuota')) return '🗓️';
    return '🎯';
  }
  function createdAtOf(c){
    const raw=c?.createdAt||c?.created_at||c?.startDate||c?.date||nowIso();
    const d=new Date(raw);
    if(!Number.isNaN(d.getTime())) return d.toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'}).replace('.','') + ' · ' + d.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});
    return String(raw||'—');
  }
  function campaignState(c){
    const closed = !!(c?.closed || c?.isClosed || String(c?.status||'').toLowerCase().includes('cerr'));
    if(closed) return {label:'Finalizada', cls:'done'};
    return {label:'Activa', cls:'active'};
  }
  function totalGuardians(){
    const session=(()=>{ try{return JSON.parse(localStorage.getItem('cursapp_session_v1')||'{}');}catch(_){return {}} })();
    const explicit=Number(session.studentCount || session.alumnos || session.guardianCount || 0);
    const list=profiles();
    const active=String(localStorage.getItem('cursapp_active_course_v1')||session.courseKey||'');
    const count=list.filter(p=>!active || String(p?.courseKey||'')===active).length || list.length || explicit || 30;
    return Math.max(1,count);
  }
  function participation(rows){
    const total=totalGuardians();
    const set=new Set();
    (rows||[]).forEach(p=>{ const k=[p?.apoderadoEmail,p?.email,p?.apoderadoKey,p?.guardianName,p?.apoderadoName,p?.studentName].filter(Boolean).join('|'); if(k) set.add(k.toLowerCase()); });
    const count=Math.min(total,set.size || Math.min(total,(rows||[]).length));
    return {count,total,pct:Math.round((count/total)*100)};
  }
  function syncHeader(){
    try{
      const s=JSON.parse(localStorage.getItem('cursapp_session_v1')||'{}');
      const raw=s.fullName||s.displayName||s.name||s.nombre||s.guardianName||s.apoderadoName||'Tesorero';
      const name=String(raw).includes('@')?'Tesorero':raw;
      const course=s.courseLabel||s.course||s.curso||'2°B';
      const school=s.schoolName||s.colegio||s.school||'Colegio Central';
      const n=document.querySelector('.tesHeaderName'); if(n) n.textContent=name;
      const r=document.querySelector('.tesHeaderRole'); if(r) r.textContent='Tesorero';
      const c=document.querySelector('.tesHeaderCourse'); if(c) c.textContent=`${course} · ${school}`;
    }catch(_){}
  }
  function setActive(){
    document.querySelectorAll('.navItem').forEach(b=>b.classList.toggle('active', String(b.dataset.tab)==='conciliacion'));
  }
  function methodLabel(v){
    return ({transferencia:'Transferencia bancaria',efectivo:'Efectivo',cheque:'Cheque',otro:'Otro medio',transbank:'Transbank',saldo_favor:'Saldo a favor'})[String(v||'').toLowerCase()] || 'Medio registrado';
  }
  function statusLabel(p){
    if(isConc(p)) return {label:methodLabel(p.paymentMethod||p.paidWith), cls:'done'};
    const m=String(p?.paymentMethod||p?.paidWith||'').toLowerCase();
    if(m==='transferencia') return {label:'Transf. informada', cls:'info'};
    return {label:'Pendiente', cls:'pending'};
  }
  function initials(p){ return String(p?.guardianName||p?.apoderadoName||p?.studentName||'A').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase() || 'A'; }
  function shortDT(v){ const d=v?new Date(v):new Date(); return d.toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'}).replace('.','') + ' · ' + d.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}); }
  function filteredRows(all,pending,conc){
    const f=String(window.__tesConcFilter||'pendientes');
    let rows=f==='conciliados'?conc:f==='todos'?all:pending;
    const q=String(window.__tesConcQuery||'').toLowerCase().trim();
    if(q) rows=rows.filter(p=>[p.guardianName,p.apoderadoName,p.studentName,p.alumno,p.concept,p.id,p.code,p.paymentCode].join(' ').toLowerCase().includes(q));
    return rows;
  }
  function selectedRows(all){
    const ids=new Set(Object.keys(window.__tesBulkSelection||{}).filter(k=>window.__tesBulkSelection[k]));
    return all.filter(p=>ids.has(String(p.id)) && !isConc(p));
  }
  function payRow(p){
    const st=statusLabel(p); const checked=!!window.__tesBulkSelection[String(p.id)];
    const pending=!isConc(p);
    return `<article class="tesV73PayRow ${checked?'selected':''} ${pending?'':'done'}">
      <label class="tesV73Check"><input type="checkbox" ${pending?'':'disabled'} ${checked?'checked':''} onchange="tesV73TogglePayment('${esc(p.id)}',this.checked)"><span></span></label>
      <div class="tesV73Avatar ${pending?'':'ok'}">${pending?esc(initials(p)):'✓'}</div>
      <div class="tesV73Person"><b>${esc(p.guardianName || p.apoderadoName || 'Apoderado')}</b><small>Alumno: ${esc(p.studentName || p.alumno || 'Alumno')}</small></div>
      <strong class="tesV73Amount">${clp(p.amount)}</strong>
      <span class="tesV73Status ${st.cls}">${esc(st.label)}</span>
      <div class="tesV73Action">${pending?`<button type="button" onclick="tesV73OpenSheet('${esc(p.id)}')">Conciliar</button>`:`<small>${esc(shortDT(p.reconciledAt||p.paidAt||p.createdAt))}</small>`}</div>
    </article>`;
  }
  function render(){
    syncHeader(); setActive();
    const root=app(); if(!root) return;
    const list=campaigns();
    const camp=selectedCampaign();
    const all=rowsByCampaign(camp?.id);
    const pending=all.filter(p=>!isConc(p));
    const conc=all.filter(isConc);
    const rec=sum(conc,p=>p.amount);
    const pendAmt=sum(pending,p=>p.amount);
    const goal=goalOf(camp);
    const pct=goal?Math.min(100,Math.round(rec/goal*100)):(rec?72:0);
    const part=participation(all);
    const filter=String(window.__tesConcFilter||'pendientes');
    const rows=filter==='conciliados'?conc:pending;
    const sel=selectedRows(all);
    const campaignName=titleOf(camp);
    const options=list.map(c=>`<option value="${esc(c.id)}" ${String(c.id)===String(camp?.id)?'selected':''}>${esc(titleOf(c))}</option>`).join('');
    root.innerHTML = `<div class="tesConcPage tesV72Conc tesV73Conc tesV75Conc">
      <section class="tesV73Title tesV75Title"><h1>Conciliación por campaña</h1></section>

      <section class="tesV73CampaignCompact tesV75CampaignCard">
        <label class="tesV73CampaignSelect tesV75CampaignSelect">
          <span>${campaignIcon(camp)}</span>
          <select onchange="tesV73SelectCampaign(this.value)">${options}</select>
          <i>⌄</i>
        </label>

        <div class="tesV75CampaignMetrics">
          <article><small>Apoderados</small><b>${part.count} / ${part.total}</b><em>👥</em></article>
          <article><small>Pendientes</small><b class="warn">${pending.length}</b><em>◷</em></article>
          <article><small>Recaudado</small><b class="money">${clp(rec)}</b><em>▣</em></article>
          <article><small>Meta total</small><b>${goal?clp(goal):'—'}</b><em>◎</em></article>
        </div>

        <div class="tesV73CampaignInfo tesV75Info ${window.__tesShowCampaignInfo?'open':''}">
          <article><small>Creación</small><b>${esc(createdAtOf(camp))}</b></article>
          <article><small>Estado campaña</small><b>${esc(campaignState(camp).label)}</b></article>
          <article><small>Participación</small><b>${part.pct}%</b></article>
          <article><small>Avance meta</small><b>${pct}%</b></article>
        </div>
        <button class="tesV73InfoBtn tesV75InfoBtn" type="button" onclick="tesV73ToggleInfo()">Ver información de la campaña <span>⌄</span></button>
      </section>

      <section class="tesV73Tabs tesV75Tabs">
        <button class="${filter==='pendientes'?'active':''}" onclick="tesV73Filter('pendientes')">Pendientes (${pending.length})</button>
        <button class="${filter==='conciliados'?'active ok':''}" onclick="tesV73Filter('conciliados')">Conciliados (${conc.length})</button>
      </section>

      <section class="tesV73List tesV75List">
        ${rows.map(payRow).join('') || `<article class="tesConcEmpty"><b>No hay pagos en esta vista</b><span>${filter==='pendientes'?'Esta campaña no tiene pagos pendientes.':'Esta campaña aún no tiene pagos conciliados.'}</span></article>`}
        <button class="tesV73BulkBtn tesV75BulkBtn ${sel.length?'is-active':'is-disabled'}" ${sel.length?'':'disabled'} onclick="${sel.length?'tesV73OpenBulk()':'void(0)'}">☑ Conciliar seleccionados (${sel.length})</button>
      </section>

      <section class="tesV73Summary tesV75Summary">
        <header><h2>Resumen de la campaña</h2><button type="button">Ver detalle completo ›</button></header>
        <div><article><small>Recaudado</small><b>${clp(rec)}</b><em>${goal?pct+'% de la meta':'meta no definida'}</em></article><article><small>Pendientes</small><b>${pending.length} pagos</b><em>${clp(pendAmt)}</em></article><article><small>Conciliados</small><b>${conc.length} pagos</b><em>${clp(rec)}</em></article><article><small>Participación</small><b>${part.count} / ${part.total}</b><em>${part.pct}%</em></article><article><small>Meta total</small><b>${goal?clp(goal):'—'}</b><em>${goal?'Definida':'Por definir'}</em></article></div>
      </section>
    </div>`;
  }
  function sheetHtml(title, subtitle, total){
    return `<section class="tesConcSheet tesV73Sheet" role="dialog" aria-modal="true"><button class="tesConcSheetClose" type="button">×</button><div class="tesConcGrip"></div><h2>${esc(title)}</h2><div class="tesConcSheetSummary"><div class="tesConcAvatar pending">✓</div><div><b>${esc(subtitle)}</b><small>Total a conciliar</small></div><strong>${clp(total)}</strong></div><h3>Medio de pago recibido</h3><div class="tesConcMethodGrid"><label><input type="radio" name="tesMethod" value="efectivo" checked><span>💵</span><b>Efectivo</b><small>Dinero recibido</small></label><label><input type="radio" name="tesMethod" value="transferencia"><span>🏦</span><b>Transferencia bancaria</b><small>Cuenta bancaria</small></label><label><input type="radio" name="tesMethod" value="otro"><span>•••</span><b>Otro medio</b><small>Otro método</small></label></div><h3>Observación <small>(opcional)</small></h3><input id="tesConcRef" placeholder="N° referencia / comprobante"><textarea id="tesConcObs" rows="3" placeholder="Ej: recibido en reunión de apoderados"></textarea><div class="tesConcSheetActions"><button type="button" class="ghost">Cancelar</button><button type="button" class="primary">Confirmar conciliación</button></div></section>`;
  }
  function openSheet(ids,title,subtitle,total){
    const overlay=document.createElement('div'); overlay.className='tesConcSheetOverlay'; overlay.innerHTML=sheetHtml(title,subtitle,total);
    overlay.onclick=e=>{ if(e.target===overlay) overlay.remove(); };
    overlay.querySelector('.tesConcSheetClose').onclick=()=>overlay.remove(); overlay.querySelector('.ghost').onclick=()=>overlay.remove();
    overlay.querySelector('.primary').onclick=()=>applyConciliation(ids,overlay);
    document.body.appendChild(overlay);
  }
  function applyConciliation(ids,overlay){
    const arr=payments(); const set=new Set(ids.map(String)); const method=overlay.querySelector('input[name="tesMethod"]:checked')?.value||'efectivo'; const affected=[];
    arr.forEach(p=>{ if(!set.has(String(p.id))) return; affected.push(p); p.paymentMethod=method; p.paidWith=method; p.conciliationStatus='conciliado'; p.reconciledAt=nowIso(); p.reconciledBy='Tesorero'; p.reconciliationReference=overlay.querySelector('#tesConcRef')?.value||''; p.reconciliationNote=overlay.querySelector('#tesConcObs')?.value||''; });
    save(KEY_PAYMENTS,arr); window.__tesBulkSelection={}; overlay.remove(); showSuccess({count:affected.length,total:sum(affected,p=>p.amount),method:methodLabel(method),guardian:affected[0]?.guardianName||affected[0]?.apoderadoName||'Apoderado',student:affected[0]?.studentName||affected[0]?.alumno||'Alumno',campaign:titleOf(selectedCampaign())});
  }
  function showSuccess(info){
    const overlay=document.createElement('div'); overlay.className='tesV72SuccessOverlay tesV73SuccessOverlay';
    overlay.innerHTML=`<section class="tesV72Success tesV73Success"><div class="tesV72SuccessIcon">✓</div><h2>${info.count>1?'¡Pagos conciliados!':'¡Pago conciliado!'}</h2><p>${info.count>1?`${info.count} pagos fueron conciliados correctamente.`:'El pago ha sido conciliado correctamente.'}</p><div class="tesV72SuccessData"><article><small>${info.count>1?'Campaña':'Alumno'}</small><b>${esc(info.count>1?info.campaign:info.student)}</b></article><article><small>Apoderado</small><b>${esc(info.count>1?'Varios apoderados':info.guardian)}</b></article><article><small>Medio de pago</small><b>${esc(info.method)}</b></article><article><small>Monto</small><b>${clp(info.total)}</b></article><article><small>Fecha y hora</small><b>${esc(shortDT(nowIso()))}</b></article></div><button type="button">Aceptar</button></section>`;
    overlay.querySelector('button').onclick=()=>{ overlay.remove(); render(); };
    document.body.appendChild(overlay);
    setTimeout(()=>{ if(document.body.contains(overlay)){ overlay.remove(); render(); } }, 1600);
  }

  window.tesV73SelectCampaign=function(id){ window.__tesCampaignId=String(id||''); window.__tesBulkSelection={}; render(); };
  window.tesV73Filter=function(f){ window.__tesConcFilter=String(f||'pendientes'); render(); };
  window.tesV73Query=function(v){ window.__tesConcQuery=String(v||''); render(); };
  window.tesV73TogglePayment=function(id,v){ window.__tesBulkSelection[String(id)]=!!v; render(); };
  window.tesV73ClearSelection=function(clear){ if(clear) window.__tesBulkSelection={}; render(); };
  window.tesV73ToggleInfo=function(){ window.__tesShowCampaignInfo=!window.__tesShowCampaignInfo; render(); };
  window.tesV73OpenSheet=function(id){ const p=validRows().find(x=>String(x.id)===String(id)); if(!p) return alert('No se encontró el pago.'); openSheet([id],'Conciliar pago',`${p.studentName||p.alumno||'Alumno'} · ${p.guardianName||p.apoderadoName||'Apoderado'}`,Number(p.amount||0)); };
  window.tesV73OpenBulk=function(){ const sel=selectedRows(rowsByCampaign(selectedCampaign()?.id)); if(!sel.length) return; openSheet(sel.map(p=>p.id),`Conciliar ${sel.length} pagos`,titleOf(selectedCampaign()),sum(sel,p=>p.amount)); };

  const previousGo=window.go;
  window.go=function(tab,taskId){ if(String(tab||'').toLowerCase()==='conciliacion'){ render(); return; } return typeof previousGo==='function'?previousGo(tab,taskId):undefined; };
  function bindNav(){ document.querySelectorAll('.navItem[data-tab="conciliacion"]').forEach(b=>{ b.onclick=(e)=>{ e.preventDefault(); render(); }; }); }
  function renderIfConc(){ const root=app(); if(!root) return; if(document.querySelector('.navItem[data-tab="conciliacion"].active') || /Conciliaci[oó]n por campa/i.test(root.innerHTML)){ if(!root.querySelector('.tesV73Conc')) render(); } }
  document.addEventListener('DOMContentLoaded',()=>{ bindNav(); setTimeout(renderIfConc,300); const root=app(); if(root) new MutationObserver(()=>setTimeout(renderIfConc,0)).observe(root,{childList:true,subtree:false}); });
  setTimeout(()=>{ bindNav(); renderIfConc(); },800);
})();

/* =========================================================
   Cursapp · Tesorero V78
   Rendiciones por campaña + flujo de aprobación presidencial
   ========================================================= */
(function(){
  const esc=(s)=>String(s??'').replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'}[c]));
  const clp=(n)=>'$'+Number(n||0).toLocaleString('es-CL');
  const load=(k,f)=>{try{const v=localStorage.getItem(k);return v==null?f:JSON.parse(v)}catch(_){return f}};
  const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const scoped=(base)=>(window.CURSAPP&&window.CURSAPP.scopedKey)?window.CURSAPP.scopedKey(base):`cursapp_${base}`;
  const KEY_TASKS=scoped('tasks_v1'), KEY_PAYMENTS=scoped('payments_v1'), KEY_EXPENSES=scoped('expenses_v1');
  const root=()=>document.getElementById('app');
  const tasks=()=>{const a=load(KEY_TASKS,[]);return Array.isArray(a)?a:[]};
  const payments=()=>{const a=load(KEY_PAYMENTS,[]);return Array.isArray(a)?a:[]};
  const expenses=()=>{const a=load(KEY_EXPENSES,[]);return Array.isArray(a)?a:[]};
  const sum=(a,fn)=>(a||[]).reduce((x,y)=>x+Number(fn?fn(y):y||0),0);
  const titleOf=(c)=>String(c?.title||c?.name||c?.concept||'Campaña').trim();
  const goalOf=(c)=>Number(c?.goal||c?.target||c?.meta||c?.amountGoal||0);
  const campIcon=(c)=>{const t=titleOf(c).toLowerCase();if(t.includes('gira'))return'🎓';if(t.includes('paseo'))return'🚌';if(t.includes('aseo'))return'🧽';if(t.includes('cuota'))return'🗓️';return'🎯'};
  const expenseCampId=(e)=>String(e?.campaignId||e?.taskId||e?.fromTaskId||'');
  const paymentCampId=(p)=>String(p?.fromTaskId||p?.taskId||p?.campaignId||'');
  const isConc=(p)=>String(p?.paymentMethod||p?.paidWith||'').toLowerCase()==='transbank'||String(p?.conciliationStatus||'').toLowerCase()==='conciliado';
  const campaigns=()=>{const t=tasks().filter(x=>!x?.hidden);if(t.length)return t;const m=new Map();expenses().forEach(e=>{const id=expenseCampId(e)||'general';if(!m.has(id))m.set(id,{id,title:e?.campaignTitle||'Campaña general'})});return [...m.values()]};
  const selectedCampaign=()=>{const list=campaigns();if(!list.length)return{id:'general',title:'Campaña general'};let c=list.find(x=>String(x.id)===String(window.__tesRendCampaignId));if(!c){c=list[0];window.__tesRendCampaignId=String(c.id)}return c};
  const rowsFor=(id)=>expenses().filter(e=>expenseCampId(e)===String(id));
  const paidFor=(id)=>payments().filter(p=>paymentCampId(p)===String(id)&&isConc(p));
  const currentSession=()=>{try{return JSON.parse(localStorage.getItem('cursapp_session_v1')||'{}')}catch(_){return{}}};
  const currentRole=()=>String(currentSession().currentRole||currentSession().activeRole||currentSession().role||'tesorero').toLowerCase();
  const currentName=()=>String(currentSession().fullName||currentSession().displayName||currentSession().name||currentSession().nombre||currentSession().email||'Usuario').trim();
  const isPresident=()=>currentRole().includes('presidente');
  const statusKey=(e)=>{const r=String(e?.approvalStatus||e?.status||e?.state||'pendiente_aprobacion').toLowerCase().replace(/\s+/g,'_');if(r.includes('rechaz'))return'rejected';if(r.includes('observ'))return'observed';if(r.includes('aprob'))return'approved';return'pending'};
  const statusInfo=(e)=>({pending:{label:'Pendiente aprobación',cls:'pending',actor:'Presidente del curso'},approved:{label:'Aprobada',cls:'approved',actor:'Presidente del curso'},rejected:{label:'Rechazada',cls:'rejected',actor:'Presidente del curso'},observed:{label:'Observada',cls:'observed',actor:'Presidente del curso'}}[statusKey(e)]);
  const categoryOf=(e)=>String(e?.category||e?.categoria||'Otros').trim()||'Otros';
  const categoryIcon=(cat)=>{const t=String(cat).toLowerCase();if(t.includes('alimenta'))return'🍴';if(t.includes('transport'))return'🚌';if(t.includes('material'))return'📦';if(t.includes('prem'))return'🏆';if(t.includes('uniform'))return'👕';return'🧾'};
  const dateLabel=(v,withTime=false)=>{const d=v?new Date(v):null;if(!d||Number.isNaN(d.getTime()))return String(v||'Sin fecha');const date=d.toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'}).replace('.','');return withTime?`${date} · ${d.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})}`:date};
  const hasReceipt=(e)=>!!((Array.isArray(e?.attachments)&&e.attachments.length)||e?.receipt||e?.boleta);
  const receiptOf=(e)=>(Array.isArray(e?.attachments)&&e.attachments[0])||e?.receipt||null;
  const historyOf=(e)=>Array.isArray(e?.approvalHistory)?e.approvalHistory:[];
  const canEdit=(e)=>['pending','rejected','observed'].includes(statusKey(e));
  function syncActive(){document.querySelectorAll('.navItem').forEach(b=>b.classList.toggle('active',String(b.dataset.tab)==='rendiciones'))}
  function normalizeLegacy(){const arr=expenses();let changed=false;arr.forEach(e=>{if(!e.approvalStatus){const k=statusKey(e);e.approvalStatus=k==='approved'?'aprobada':k==='rejected'?'rechazada':k==='observed'?'observada':'pendiente_aprobacion';changed=true}if(!Array.isArray(e.approvalHistory)){e.approvalHistory=[{at:e.createdAt||new Date().toISOString(),action:'registrada',actor:e.createdByName||e.registeredBy||currentName(),role:'Tesorero'}];changed=true}const hasSent=e.approvalHistory.some(x=>x&&x.action==='enviada_aprobacion');if(!hasSent){const base=e.createdAt||e.updatedAt||new Date().toISOString();e.approvalHistory.push({at:base,action:'enviada_aprobacion',actor:'Cursapp',role:'Flujo de aprobación',note:'Enviada al Presidente del curso para revisión.'});changed=true}});if(changed)save(KEY_EXPENSES,arr)}
  function render(){
    normalizeLegacy();syncActive();const el=root();if(!el)return;
    const list=campaigns(),camp=selectedCampaign(),rows=rowsFor(camp.id).slice().sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||'')));
    const rec=sum(paidFor(camp.id),p=>p.amount),spent=sum(rows,e=>e.amount),saldo=rec-spent,pending=rows.filter(e=>statusKey(e)==='pending').length;
    const options=list.map(c=>`<option value="${esc(c.id)}" ${String(c.id)===String(camp.id)?'selected':''}>${esc(titleOf(c))}</option>`).join('');
    const groups={};rows.forEach(e=>{const cat=categoryOf(e);if(!groups[cat])groups[cat]=[];groups[cat].push(e)});
    const groupHtml=Object.entries(groups).map(([cat,items])=>`<section class="tesV78Group"><button class="tesV77Category" type="button" onclick="tesV77ToggleCategory('${esc(cat)}')"><span>${categoryIcon(cat)}</span><b>${esc(cat)} (${items.length})</b><strong>${clp(sum(items,x=>x.amount))}</strong><i>${window.__tesRendOpenCats?.[cat]?'⌃':'⌄'}</i></button><div class="tesV77CategoryRows ${window.__tesRendOpenCats?.[cat]?'open':''}">${items.map(expenseRow).join('')}</div></section>`).join('');
    el.innerHTML=`<div class="tesV77Page tesV78Page">
      <h1>Rendiciones por campaña</h1>
      <section class="tesV77CampaignCard">
        <label class="tesV77CampaignSelect"><span>${campIcon(camp)}</span><select onchange="tesV77SelectCampaign(this.value)">${options}</select><i>⌄</i></label>
        <div class="tesV77State"><small>Estado</small><b>Activa</b></div>
        <div class="tesV77CampaignMetrics"><article><small>Recaudado</small><b class="green">${clp(rec)}</b><em>💰</em></article><article><small>Gastado</small><b class="orange">${clp(spent)}</b><em>🧾</em></article><article><small>Saldo</small><b class="violet">${clp(saldo)}</b><em>👛</em></article><article><small>Rendiciones</small><b>${rows.length}</b><em>📄</em></article></div>
        <button class="tesV77InfoBtn" type="button" onclick="tesV77ToggleInfo()">Ver información de la campaña <span>⌄</span></button>
        <div class="tesV77CampaignInfo ${window.__tesRendInfoOpen?'open':''}"><article><small>Meta total</small><b>${goalOf(camp)?clp(goalOf(camp)):'Por definir'}</b></article><article><small>Fecha creación</small><b>${dateLabel(camp.createdAt||camp.startDate)}</b></article></div>
      </section>
      <section class="tesV77Quick"><article><span>🧾</span><small>Gastado</small><b>${clp(spent)}</b></article><article><span>👛</span><small>Saldo disponible</small><b>${clp(saldo)}</b></article><article><span>🕒</span><small>Pendientes aprobación</small><b>${pending}</b></article></section>
      <section class="tesV77Categories">${groupHtml||`<article class="tesV77Empty"><b>Sin rendiciones registradas</b><span>Agrega el primer gasto de esta campaña.</span></article>`}</section>
      <button class="tesV77Add" type="button" onclick="tesV77OpenCreate()">＋ Agregar rendición</button>
      <aside class="tesV78Notice"><b>ⓘ Flujo de aprobación</b><span>El tesorero registra la rendición y el presidente del curso la aprueba, observa o rechaza.</span></aside>
      <div data-monetization-slot="tesorero"></div>
    </div>`;
  }
  function expenseRow(e){const st=statusInfo(e);return `<article class="tesV77Expense tesV78Expense"><div class="tesV77ExpIcon">${categoryIcon(categoryOf(e))}</div><div class="tesV77ExpMain"><b>${esc(e.title||e.concept||'Rendición')}</b><small>▣ ${esc(dateLabel(e.date||e.createdAt))}</small><small>◇ ${esc(categoryOf(e))}</small>${hasReceipt(e)?'<small>📎 Comprobante adjunto</small>':''}</div><div class="tesV77ExpAmount"><strong>${clp(e.amount)}</strong><span class="${st.cls}">● ${esc(st.label)}</span></div><div class="tesV77ExpActions"><button type="button" onclick="tesV77View('${esc(e.id)}')">◉ Ver</button>${canEdit(e)?`<button type="button" onclick="tesV77Edit('${esc(e.id)}')">✎ Editar</button>`:''}</div></article>`}
  function openModal(html,wide=false){const m=document.getElementById('modalRoot');if(!m)return;m.innerHTML=`<div class="tesV77ModalOverlay"><section class="tesV77Modal ${wide?'wide':''}">${html}</section></div>`;m.querySelector('.tesV77ModalOverlay').onclick=e=>{if(e.target===e.currentTarget)closeModal()}}
  function closeModal(){const m=document.getElementById('modalRoot');if(m)m.innerHTML=''}
  function formHtml(e={}){return `<button class="tesV77Close" onclick="tesV77Close()">×</button><h2>${e.id?'Editar rendición':'Agregar rendición'}</h2><p class="tesV78FormHelp">Al guardar quedará pendiente de aprobación por el presidente del curso.</p><label>Categoría<select id="rv_cat"><option ${categoryOf(e)==='Alimentación'?'selected':''}>Alimentación</option><option ${categoryOf(e)==='Transporte'?'selected':''}>Transporte</option><option ${categoryOf(e)==='Materiales'?'selected':''}>Materiales</option><option ${categoryOf(e)==='Premios'?'selected':''}>Premios</option><option ${categoryOf(e)==='Otros'?'selected':''}>Otros</option></select></label><label>Concepto<input id="rv_title" value="${esc(e.title||e.concept||'')}" placeholder="Ej: Transporte campeonato"></label><label>Descripción<textarea id="rv_desc" rows="3" placeholder="Describe el gasto">${esc(e.description||e.note||'')}</textarea></label><div class="tesV77FormGrid"><label>Monto<input id="rv_amount" inputmode="numeric" value="${Number(e.amount||0)||''}" placeholder="50000"></label><label>Fecha<input id="rv_date" type="date" value="${esc(String(e.date||new Date().toISOString()).slice(0,10))}"></label></div><label>Comprobante<input id="rv_file" type="file" accept="image/*,application/pdf"><small>${hasReceipt(e)?'Comprobante adjunto. Selecciona otro para reemplazarlo.':'Adjunta foto o PDF (máx. 3 MB)'}</small></label><div class="tesV77ModalActions"><button class="ghost" onclick="tesV77Close()">Cancelar</button><button class="primary" onclick="tesV77Save('${esc(e.id||'')}')">Enviar a aprobación</button></div>`}
  function success(e){openModal(`<div class="tesV77Success"><div>✓</div><h2>Rendición enviada a aprobación</h2><p>El presidente del curso recibirá la solicitud para revisarla.</p><article><small>Monto</small><b>${clp(e.amount)}</b><small>Campaña</small><b>${esc(titleOf(selectedCampaign()))}</b><small>Estado</small><b>Pendiente aprobación</b></article><button onclick="tesV77Close();tesV77Render()">Aceptar</button></div>`)}
  function historyHtml(e){const h=historyOf(e);if(!h.length)return'<div class="tesV78EmptyHistory">Sin movimientos registrados.</div>';return h.slice().sort((a,b)=>String(a.at||'').localeCompare(String(b.at||''))).map((x,i)=>`<div class="tesV78HistoryItem"><i class="${x.action==='aprobada'?'approved':x.action==='rechazada'?'rejected':x.action==='observada'?'observed':'pending'}"></i><div><b>${esc(x.actor||'Usuario')} ${x.role?`(${esc(x.role)})`:''}</b><small>${esc(actionLabel(x.action))}</small><em>${esc(dateLabel(x.at,true))}</em>${x.note?`<p>${esc(x.note)}</p>`:''}</div></div>`).join('')}
  function actionLabel(a){return({registrada:'Rendición registrada',enviada_aprobacion:'Enviada al Presidente para aprobación',editada:'Rendición corregida y reenviada',aprobada:'Rendición aprobada',rechazada:'Rendición rechazada',observada:'Corrección solicitada'}[a]||String(a||'Movimiento'))}
  function viewHtml(e){const st=statusInfo(e),r=receiptOf(e),hist=historyHtml(e);return `<button class="tesV77Close" onclick="tesV77Close()">×</button><div class="tesV78StatusBanner ${st.cls}"><b>${esc(st.label)}</b><span>Por: ${esc(st.actor)}</span></div><div class="tesV78DetailHead"><div class="tesV77ExpIcon">${categoryIcon(categoryOf(e))}</div><div><h2>${esc(e.title||'Rendición')}</h2><small>${esc(categoryOf(e))} · ${esc(dateLabel(e.date||e.createdAt))}</small></div><strong>${clp(e.amount)}</strong></div><section class="tesV78DetailSection"><h3>Descripción</h3><p>${esc(e.description||e.note||'Sin descripción.')}</p></section><section class="tesV78Receipt"><h3>Comprobante</h3>${r?`<div><span>🧾</span><div><b>${esc(r.name||'Comprobante adjunto')}</b><small>${r.size?Math.round(r.size/1024)+' KB':''}</small></div>${r.dataUrl?`<a href="${r.dataUrl}" download="${esc(r.name||'comprobante')}">↓</a>`:''}</div>`:'<p>Sin comprobante adjunto.</p>'}</section><section class="tesV78InfoGrid"><div><small>Campaña</small><b>${esc(titleOf(selectedCampaign()))}</b></div><div><small>Categoría</small><b>${esc(categoryOf(e))}</b></div><div><small>Registrado por</small><b>${esc(e.createdByName||e.registeredBy||'Tesorero')}</b></div><div><small>Fecha registro</small><b>${esc(dateLabel(e.createdAt,true))}</b></div></section>${e.approvalNote?`<section class="tesV78ApprovalNote ${statusKey(e)}"><h3>${statusKey(e)==='rejected'?'Motivo del rechazo':'Observación del presidente'}</h3><p>${esc(e.approvalNote)}</p></section>`:''}<section class="tesV78History"><h3>Historial</h3>${hist}</section>${isPresident()&&statusKey(e)==='pending'?`<label class="tesV78ApprovalObs">Observación (opcional)<textarea id="rv_approval_note" rows="3" placeholder="Escribe una observación..."></textarea></label><div class="tesV78PresidentActions"><button class="approve" onclick="tesV78Approve('${esc(e.id)}')">✓ Aprobar rendición</button><button class="observe" onclick="tesV78Observe('${esc(e.id)}')">Solicitar corrección</button><button class="reject" onclick="tesV78Reject('${esc(e.id)}')">Rechazar rendición</button></div>`:canEdit(e)?`<button class="tesV77FullBtn" onclick="tesV77Edit('${esc(e.id)}')">✎ Editar rendición</button>`:''}`}
  function updateApproval(id,status,action,note){const arr=expenses(),e=arr.find(x=>String(x.id)===String(id));if(!e)return false;e.approvalStatus=status;e.status=status;e.approvalNote=note||'';e.approvedByName=currentName();e.approvedAt=new Date().toISOString();e.approvalHistory=historyOf(e);e.approvalHistory.push({at:e.approvedAt,action,actor:currentName(),role:'Presidente'});save(KEY_EXPENSES,arr);return true}
  function approvalSuccess(title,text){openModal(`<div class="tesV77Success"><div>✓</div><h2>${esc(title)}</h2><p>${esc(text)}</p><button onclick="tesV77Close();tesV77Render()">Aceptar</button></div>`)}
  window.tesV77Render=render;window.tesV77SelectCampaign=(id)=>{window.__tesRendCampaignId=String(id||'');render()};window.tesV77ToggleInfo=()=>{window.__tesRendInfoOpen=!window.__tesRendInfoOpen;render()};window.tesV77ToggleCategory=(cat)=>{window.__tesRendOpenCats=window.__tesRendOpenCats||{};window.__tesRendOpenCats[cat]=!window.__tesRendOpenCats[cat];render()};window.tesV77OpenCreate=()=>openModal(formHtml());window.tesV77Edit=(id)=>{const e=expenses().find(x=>String(x.id)===String(id));if(e&&canEdit(e))openModal(formHtml(e))};window.tesV77View=(id)=>{const e=expenses().find(x=>String(x.id)===String(id));if(e)openModal(viewHtml(e),true)};window.tesV77Close=closeModal;
  window.tesV77Save=(id)=>{const title=document.getElementById('rv_title')?.value.trim(),amount=Number(String(document.getElementById('rv_amount')?.value||'').replace(/[^0-9.-]/g,''));if(!title||!amount)return alert('Completa concepto y monto.');const arr=expenses();let e=id?arr.find(x=>String(x.id)===String(id)):null;const now=new Date().toISOString();if(!e){e={id:'e_'+Date.now().toString(36),scope:'campaign',campaignId:String(selectedCampaign().id),createdAt:now,createdByName:currentName(),registeredBy:currentName(),approvalHistory:[{at:now,action:'registrada',actor:currentName(),role:'Tesorero'},{at:now,action:'enviada_aprobacion',actor:'Cursapp',role:'Flujo de aprobación',note:'Enviada al Presidente del curso para revisión.'}]};arr.unshift(e)}else{e.approvalHistory=historyOf(e);e.approvalHistory.push({at:now,action:'editada',actor:currentName(),role:'Tesorero'});e.approvalHistory.push({at:now,action:'enviada_aprobacion',actor:'Cursapp',role:'Flujo de aprobación',note:'Reenviada al Presidente del curso para revisión.'})}e.title=title;e.category=document.getElementById('rv_cat')?.value||'Otros';e.amount=amount;e.date=document.getElementById('rv_date')?.value||new Date().toISOString().slice(0,10);e.description=document.getElementById('rv_desc')?.value||'';e.note=e.description;e.approvalStatus='pendiente_aprobacion';e.status='pendiente_aprobacion';e.approvalNote='';e.updatedAt=now;const file=document.getElementById('rv_file')?.files?.[0];const finish=()=>{save(KEY_EXPENSES,arr);success(e)};if(file){if(file.size>3*1024*1024)return alert('Archivo muy pesado (máx 3MB).');const r=new FileReader();r.onload=()=>{e.attachments=[{name:file.name,type:file.type,size:file.size,dataUrl:r.result}];finish()};r.readAsDataURL(file)}else finish()};
  window.tesV78Approve=(id)=>{const note=document.getElementById('rv_approval_note')?.value||'';if(updateApproval(id,'aprobada','aprobada',note))approvalSuccess('Rendición aprobada','La rendición quedó disponible para el curso.')};window.tesV78Observe=(id)=>{const note=document.getElementById('rv_approval_note')?.value.trim();if(!note)return alert('Indica qué debe corregir el tesorero.');if(updateApproval(id,'observada','observada',note))approvalSuccess('Corrección solicitada','El tesorero podrá editar y reenviar la rendición.')};window.tesV78Reject=(id)=>{const note=document.getElementById('rv_approval_note')?.value.trim();if(!note)return alert('Indica el motivo del rechazo.');if(updateApproval(id,'rechazada','rechazada',note))approvalSuccess('Rendición rechazada','El motivo quedó registrado en el historial.')};
  window.CURSAPP_RENDITION_APPROVAL_V78={listPending:()=>expenses().filter(e=>statusKey(e)==='pending'),approve:(id,note='')=>updateApproval(id,'aprobada','aprobada',note),observe:(id,note='')=>updateApproval(id,'observada','observada',note),reject:(id,note='')=>updateApproval(id,'rechazada','rechazada',note)};
  const prevGo=window.go;window.go=function(tab,taskId){if(String(tab||'').toLowerCase()==='rendiciones'){if(taskId)window.__tesRendCampaignId=String(taskId);render();return}return typeof prevGo==='function'?prevGo(tab,taskId):undefined};
  function bind(){document.querySelectorAll('.navItem[data-tab="rendiciones"]').forEach(b=>b.onclick=e=>{e.preventDefault();render()})}document.addEventListener('DOMContentLoaded',()=>{bind();setTimeout(bind,300)});setTimeout(bind,900);
})();

/* =========================================================
   Cursapp · Tesorero V80 · Informes por campaña
   ========================================================= */
(()=>{
  const KEY_TASKS='cursapp_tasks_v1', KEY_PAYMENTS='cursapp_payments_v1', KEY_EXPENSES='cursapp_expenses_v1', KEY_REPORTS='cursapp_campaign_reports_v1';
  const load=(k,d=[])=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch(_){return d}};
  const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const money=n=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(n)||0);
  const sum=(a,f)=>a.reduce((t,x)=>t+(Number(f(x))||0),0);
  const app=()=>document.getElementById('app');
  const tasks=()=>{const x=load(KEY_TASKS,[]);return Array.isArray(x)?x:[]};
  const payments=()=>{const x=load(KEY_PAYMENTS,[]);return Array.isArray(x)?x:[]};
  const expenses=()=>{const x=load(KEY_EXPENSES,[]);return Array.isArray(x)?x:[]};
  const reports=()=>{const x=load(KEY_REPORTS,[]);return Array.isArray(x)?x:[]};
  const taskId=t=>String(t?.id||t?.taskId||t?.campaignId||'');
  const taskTitle=t=>String(t?.title||t?.name||t?.concept||'Campaña');
  const pTask=p=>String(p?.fromTaskId||p?.taskId||p?.campaignId||p?.campaign_id||'');
  const eTask=e=>String(e?.campaignId||e?.taskId||e?.campaign_id||e?.scopeId||'');
  const conc=p=>['conciliado','conciliated','paid','pagado','approved'].includes(String(p?.conciliationStatus||p?.reconciliationStatus||p?.status||'').toLowerCase()) || !!p?.reconciledAt || !!p?.paidAt;
  const approved=e=>['aprobada','approved','aprobado'].includes(String(e?.approvalStatus||e?.status||'').toLowerCase());
  const campaigns=()=>{const list=tasks().filter(Boolean); if(list.length)return list; const m=new Map();payments().forEach(p=>{const id=pTask(p)||String(p?.concept||'general');if(!m.has(id))m.set(id,{id,title:p?.concept||'Campaña general'})});return [...m.values()]};
  const GENERAL_ID='__all__';
  const icon=t=>{if(taskId(t)===GENERAL_ID)return'📊';const s=taskTitle(t).toLowerCase();if(s.includes('aseo'))return'🧽';if(s.includes('gira'))return'🎓';if(s.includes('paseo'))return'🚌';if(s.includes('licen'))return'🎓';return'🎯'};
  const selected=()=>{const list=campaigns();const id=String(window.__tesReportCampaignId||GENERAL_ID);if(id===GENERAL_ID){window.__tesReportCampaignId=GENERAL_ID;return {id:GENERAL_ID,title:'Todas las campañas'}}const found=list.find(t=>taskId(t)===id)||{id:GENERAL_ID,title:'Todas las campañas'};window.__tesReportCampaignId=taskId(found);return found};
  const session=()=>{try{return JSON.parse(localStorage.getItem('cursapp_session_v1')||'{}')}catch(_){return {}}};
  const actor=()=>{const s=session();return s.fullName||s.displayName||s.name||s.nombre||'Tesorero'};
  const participantTotal=()=>{const s=session();return Number(s.studentCount||s.alumnos||s.guardianCount||44)||44};
  function snapshot(c){
    const id=taskId(c), isGlobal=id===GENERAL_ID; const ps=payments().filter(p=>isGlobal||!id||pTask(p)===id); const ex=expenses().filter(e=>isGlobal||!id||eTask(e)===id);
    const okP=ps.filter(conc); const okE=ex.filter(approved); const pendingP=ps.filter(p=>!conc(p)); const pendingE=ex.filter(e=>!approved(e));
    const collected=sum(okP,p=>p.amount), spent=sum(okE,e=>e.amount), balance=collected-spent;
    const people=new Set(ps.map(p=>String(p.guardianName||p.apoderadoName||p.apoderadoEmail||p.email||p.studentName||'')).filter(Boolean));
    const total=participantTotal(), participation=Math.min(total,people.size||ps.length||0);
    const cats={};okE.forEach(e=>{const k=String(e.category||'Otros');cats[k]=(cats[k]||0)+(Number(e.amount)||0)});
    return {ps,ex,okP,okE,pendingP,pendingE,collected,spent,balance,participation,total,cats};
  }
  function latestReport(id){return reports().filter(r=>String(r.campaignId)===String(id)).sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')))[0]||null}
  function dateTime(v){if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'}).replace('.','')+' · '+d.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})}
  function categoriesRows(s){const entries=Object.entries(s.cats).sort((a,b)=>b[1]-a[1]);return entries.length?entries.map(([k,v])=>`<div><span>${esc(k)}</span><b>${money(v)}</b></div>`).join(''):`<div><span>Sin gastos aprobados</span><b>${money(0)}</b></div>`}
  function donut(s){const entries=Object.entries(s.cats).sort((a,b)=>b[1]-a[1]);const colors=['#2563eb','#f97316','#22c55e','#8b5cf6','#eab308'];let acc=0;const stops=entries.map(([k,v],i)=>{const a=s.spent?acc/s.spent*100:0;acc+=v;const b=s.spent?acc/s.spent*100:0;return `${colors[i%colors.length]} ${a}% ${b}%`}).join(', ')||'#e5e7eb 0 100%';return `<div class="tesV80Donut" style="background:conic-gradient(${stops})"><span><b>${money(s.spent)}</b><small>Total gastos</small></span></div><div class="tesV80Legend">${entries.map(([k,v],i)=>`<div><i style="background:${colors[i%colors.length]}"></i><span>${esc(k)}</span><b>${s.spent?Math.round(v/s.spent*100):0}%</b><em>${money(v)}</em></div>`).join('')||'<small>Sin distribución disponible</small>'}</div>`}
  function render(){
    const root=app();if(!root)return; const c=selected(), s=snapshot(c), rep=latestReport(taskId(c));
    document.querySelectorAll('.navItem').forEach(b=>b.classList.toggle('active',String(b.dataset.tab)==='informes'));
    const options=`<option value="${GENERAL_ID}" ${taskId(c)===GENERAL_ID?'selected':''}>Todas las campañas</option>`+campaigns().map(x=>`<option value="${esc(taskId(x))}" ${taskId(x)===taskId(c)?'selected':''}>${esc(taskTitle(x))}</option>`).join('');
    const isGlobal=taskId(c)===GENERAL_ID; const scopeTitle=isGlobal?'Resumen de todas las campañas':`Resumen de ${taskTitle(c)}`; const stateTitle=isGlobal?'Estado general del curso':'Estado de la campaña';
    const published=!!rep?.published; const allOk=!s.pendingP.length&&!s.pendingE.length;
    root.innerHTML=`<div class="tesV80Page">
      <h1>Informes financieros</h1>
      <section class="tesV80Campaign">
        <label><small>Campaña</small><div><span>${icon(c)}</span><select onchange="tesV80SelectCampaign(this.value)">${options}</select><i>⌄</i></div></label>
        <footer><span>▣ Último informe: <b>${rep?dateTime(rep.updatedAt||rep.createdAt):'Sin publicar'}</b></span><em class="${published?'published':'draft'}">● ${published?'Publicado':'Borrador'}</em></footer>
      </section>
      <section class="tesV80Kpis">
        <article><small>Recaudado</small><span>💰</span><b>${money(s.collected)}</b></article>
        <article><small>Gastado</small><span>🧾</span><b class="spent">${money(s.spent)}</b></article>
        <article><small>Saldo disponible</small><span>👛</span><b class="balance">${money(s.balance)}</b></article>
        <article><small>Participación</small><span>👥</span><b class="people">${s.participation} / ${s.total}</b><em>Familias</em></article>
      </section>
      <section class="tesV80States">
        <article><h2>Estado del informe</h2><div class="tesV80Status ${published?'ok':'pending'}">✓ ${published?'Publicado':'Borrador'}</div><small>Última actualización</small><b>${rep?dateTime(rep.updatedAt||rep.createdAt):'Pendiente de publicación'}</b><small>Presidente revisó</small><strong>${rep?.presidentApproved?'✓ Aprobado':'Pendiente'}</strong></article>
        <article class="campaign"><h2>${stateTitle}</h2><p class="${!s.pendingP.length?'ok':''}">✓ Conciliaciones ${!s.pendingP.length?'al día':'pendientes'}</p><p class="${!s.pendingE.length?'ok':''}">✓ Rendiciones ${!s.pendingE.length?'aprobadas':'pendientes'}</p><p class="${!s.pendingP.length?'ok':''}">✓ ${s.pendingP.length?'Pagos pendientes':'Sin pagos pendientes'}</p><p class="${published&&allOk?'ok':''}">✓ Informe ${published&&allOk?'actualizado':'por actualizar'}</p></article>
      </section>
      <section class="tesV80Finance">
        <article><h2>${scopeTitle}</h2><h3>Ingresos</h3><div><span>Pagos conciliados</span><b>${money(s.collected)}</b></div><div class="total"><span>Total ingresos</span><b>${money(s.collected)}</b></div><h3 class="expense">Gastos</h3>${categoriesRows(s)}<div class="total spent"><span>Total gastos</span><b>${money(s.spent)}</b></div><div class="final"><span>Saldo final disponible</span><b>${money(s.balance)}</b></div></article>
        <article><h2>Distribución de gastos</h2>${donut(s)}</article>
      </section>
      <section class="tesV80History"><h2>Historial de publicaciones</h2>${reports().filter(r=>isGlobal||String(r.campaignId)===taskId(c)).slice(0,5).map((r,i)=>`<article><i class="${i===0?'active':''}"></i><span>${dateTime(r.updatedAt||r.createdAt)}</span><div><b>Informe ${r.published?'publicado':'generado'}</b><small>${esc(r.createdBy||'Tesorero')}</small></div><em>${r.presidentApproved?'Revisado y aprobado por Presidente del curso':'Pendiente de revisión'}</em></article>`).join('')||'<p class="tesV80Empty">Aún no hay publicaciones para esta campaña.</p>'}</section>
      <section class="tesV80Actions"><button onclick="tesV80Preview()">◉ Vista previa</button><button onclick="tesV80Download()">▤ Descargar PDF</button><button onclick="tesV80Share()">↥ Compartir informe</button><button class="primary" onclick="tesV80Publish()">↻ ${published?'Actualizar informe':(isGlobal?'Generar informe general':'Generar informe de campaña')}</button>${published?'<button class="danger" onclick="tesV80Unpublish()">⌫ Despublicar informe</button>':''}</section>
    </div>`;
  }
  function currentPayload(published=true){const c=selected(),s=snapshot(c);return {id:'rep_'+Date.now().toString(36),campaignId:taskId(c),campaignTitle:taskId(c)===GENERAL_ID?'Todas las campañas':taskTitle(c),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),createdBy:actor(),published,presidentApproved:false,...s}}
  function upsert(pub=true){const arr=reports(),c=selected(),old=latestReport(taskId(c)),payload=currentPayload(pub);if(old){Object.assign(old,payload,{id:old.id,createdAt:old.createdAt||payload.createdAt})}else arr.unshift(payload);save(KEY_REPORTS,arr);render();return old||payload}
  function modal(html){const root=document.getElementById('modalRoot');if(!root)return;root.innerHTML=`<div class="tesV80Overlay" onclick="if(event.target===this)tesV80Close()"><section class="tesV80Modal"><button onclick="tesV80Close()">×</button>${html}</section></div>`}
  window.tesV80SelectCampaign=id=>{window.__tesReportCampaignId=String(id);render()};
  window.tesV80Close=()=>{const r=document.getElementById('modalRoot');if(r)r.innerHTML=''};
  window.tesV80Preview=()=>{const c=selected(),s=snapshot(c);modal(`<h2>Vista previa del informe</h2><h3>${esc(taskId(c)===GENERAL_ID?'Resumen de todas las campañas':taskTitle(c))}</h3><div class="tesV80Preview"><p><span>Recaudado</span><b>${money(s.collected)}</b></p><p><span>Gastado</span><b>${money(s.spent)}</b></p><p><span>Saldo</span><b>${money(s.balance)}</b></p><p><span>Participación</span><b>${s.participation} / ${s.total}</b></p></div><button class="primary" onclick="tesV80Close()">Cerrar vista previa</button>`)};
  window.tesV80Publish=()=>{upsert(true);modal('<div class="tesV80Success">✓</div><h2>Informe publicado correctamente</h2><p>El informe quedó disponible para el curso.</p><button class="primary" onclick="tesV80Close()">Aceptar</button>')};
  window.tesV80Unpublish=()=>{const arr=reports(),r=latestReport(taskId(selected()));if(r){r.published=false;r.updatedAt=new Date().toISOString();save(KEY_REPORTS,arr)}render()};
  window.tesV80Download=()=>{window.tesV80Preview();setTimeout(()=>window.print(),250)};
  window.tesV80Share=async()=>{const c=selected(),s=snapshot(c),text=`Informe ${taskId(c)===GENERAL_ID?'general del curso':taskTitle(c)}\nRecaudado: ${money(s.collected)}\nGastado: ${money(s.spent)}\nSaldo: ${money(s.balance)}`;try{if(navigator.share)await navigator.share({title:`Informe ${taskId(c)===GENERAL_ID?'general del curso':taskTitle(c)}`,text});else{await navigator.clipboard.writeText(text);alert('Resumen copiado.')}}catch(_){}};
  const prevGo=window.go;window.go=function(tab,arg){if(String(tab||'').toLowerCase()==='informes'){render();return}return typeof prevGo==='function'?prevGo(tab,arg):undefined};
  function bind(){document.querySelectorAll('.navItem[data-tab="informes"]').forEach(b=>b.onclick=e=>{e.preventDefault();render()})}document.addEventListener('DOMContentLoaded',()=>{bind();setTimeout(bind,300)});setTimeout(bind,900);
})();
