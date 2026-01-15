// Cursapp Dashboard (assets/app.js) - roles
(function(){
  if (!window.cursappDemo) {
    console.error("Falta demoData: window.cursappDemo no está definido");
    window.cursappDemo = {notifications:[], payments:[], history:[], withdrawals:[], charts:{payments6m:[], withdrawals6m:[]}};
  }
  window.cursappRole = window.cursappRole || null;
})();

// ---------------- Demo data ----------------
  

  // ---------------- Session / user ----------------
  const user = JSON.parse(localStorage.getItem('cursapp_demo_user') || 'null');
  if (!user) {
    window.location.href = "login.html";
  } else {
    user.role = window.cursappRole || user.role || 'Apoderado';
    user.school = user.school || 'Colegio Demo';
    user.course = user.course || '2° Básico A';
    user.phone = user.phone || '+56 9 1234 5678';
    user.name = user.name || 'Mauricio (Demo)';
    user.email = user.email || 'window.cursappDemo@cursapp.cl';
    localStorage.setItem('cursapp_demo_user', JSON.stringify(user));
    document.getElementById('whoLine').innerText = user.name + " · " + user.course + " · " + user.email;
    document.getElementById('rolePill').innerText = "Rol: " + user.role;
  }

  function logout(){
    localStorage.removeItem('cursapp_demo_user');
    window.location.href = "login.html";
  }

  // ---------------- Navigation (tabs + dropdown) ----------------
  const sections = ['home','payments','withdrawals','profile'];

  function goTo(key){
    sections.forEach(k => {
      document.getElementById('sec-'+k).classList.toggle('active', k===key);
      document.getElementById('tab-'+k).classList.toggle('active', k===key);
    });

    const titleMap = {home:'Inicio', payments:'Pagos', withdrawals:'Retiros', profile:'Perfil'};
    const subMap = {
      home:'Resumen del apoderado: cuotas, pagos y autorizaciones.',
      payments:'Gestiona y paga tus cuotas. Revisa comprobantes.',
      withdrawals:'Autoriza o rechaza retiros del curso (con OTP).',
      profile:'Tus datos y seguridad.'
    };
    document.getElementById('pageTitle').innerText = titleMap[key];
    document.getElementById('pageSubtitle').innerText = subMap[key];

    if (key==='home'){ drawHomeCharts(); }
    if (key==='withdrawals'){ drawWithdrawalsChart(); }
  }

  // ✅ FIX: toggleCompact bien cerrado
  function toggleCompact(){
    window.cursappDemo.compactMode = !window.cursappDemo.compactMode;
    const panels = document.querySelectorAll('#homePanels details');
    panels.forEach((d)=>{
      if (window.cursappDemo.compactMode) d.removeAttribute('open');
      else d.setAttribute('open','');
    });
  }

  // ✅ FIX: showKPI global
  function showKPI(idx){
    for (let i=0;i<4;i++){
      const card = document.getElementById('kpiCard'+i);
      const tab = document.getElementById('kpiTab'+i);
      if (card) card.classList.toggle('active', i===idx);
      if (tab) tab.classList.toggle('active', i===idx);
    }
  }

  // ---------------- Home rendering ----------------
  function moneyCLP(n){ return "$ " + n.toLocaleString('es-CL'); }

  function renderNotifications(){
    const body = document.getElementById('notifTable');
    body.innerHTML = '';
    window.cursappDemo.notifications.slice(0,8).forEach(n => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><span class="tag">${n.type}</span></td><td>${n.msg}</td><td class="muted">${n.date}</td>`;
      body.appendChild(tr);
    });
    document.getElementById('notifPill').innerText = window.cursappDemo.notifications.length + " nuevas";
  }

  function computeKPIs(){
    const pending = window.cursappDemo.payments.filter(p => p.status==='pending');
    const pendingTotal = pending.reduce((a,b)=>a+b.amount,0);
    const pendingCount = pending.length;

    const next = pending[0] || null;
    const ytd = window.cursappDemo.history.reduce((a,b)=>a+b.amount,0);

    const toApprove = window.cursappDemo.withdrawals.filter(w => w.state==='pending_me').length;

    document.getElementById('kpiPendingCount').innerText = pendingCount;
    document.getElementById('kpiPendingTotal').innerText = moneyCLP(pendingTotal);

    if (next){
      document.getElementById('kpiNextDue').innerText = next.due;
      document.getElementById('kpiNextDueSub').innerHTML = `${next.concept} · <b>${moneyCLP(next.amount)}</b>`;
    } else {
      document.getElementById('kpiNextDue').innerText = "—";
      document.getElementById('kpiNextDueSub').innerText = "No tienes cuotas pendientes.";
    }

    document.getElementById('kpiPaidYTD').innerText = moneyCLP(ytd);
    document.getElementById('kpiWithdrawToApprove').innerText = toApprove;
    document.getElementById('withdrawCountPill').innerText = toApprove + " pendientes";
  }

  // ---------------- Payments rendering ----------------
  let paymentFilter = 'all';

  function setPaymentFilter(f){
    paymentFilter = f;
    ['all','pending','paid'].forEach(k => {
      document.getElementById('f-'+k).classList.toggle('active', k===f);
    });
    renderPaymentsTable();
  }

  function statusTag(status){
    if (status==='paid') return `<span class="tag ok">Pagado</span>`;
    if (status==='pending') return `<span class="tag warn">Pendiente</span>`;
    return `<span class="tag">${status}</span>`;
  }

  function renderPaymentsTable(){
    const body = document.getElementById('paymentsTable');
    body.innerHTML='';
    const items = window.cursappDemo.payments.filter(p => paymentFilter==='all' ? true : p.status===paymentFilter);

    items.forEach(p => {
      const tr = document.createElement('tr');
      const btn = (p.status==='pending')
        ? `<button class="btn primary" style="padding:8px 10px;" onclick="openPayModal('${p.id}')">Pagar</button>`
        : `<button class="btn" style="padding:8px 10px;" onclick="openReceipt('${p.receipt || 'RC-0000'}')">Comprobante</button>`;

      tr.innerHTML = `<td>${p.concept}</td><td>${p.due}</td><td>${moneyCLP(p.amount)}</td><td>${statusTag(p.status)}</td><td>${btn}</td>`;
      body.appendChild(tr);
    });
  }

  function renderReceipts(){
    const body = document.getElementById('receiptsTable');
    body.innerHTML='';
    const paid = window.cursappDemo.payments.filter(p=>p.status==='paid').slice(0,5);
    paid.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="muted">${p.paidDate || '—'}</td><td>${p.concept}<div class="muted">${p.receipt || 'RC-—'}</div></td>`;
      body.appendChild(tr);
    });
  }

  function renderHistory(){
    const body = document.getElementById('historyTable');
    body.innerHTML='';
    window.cursappDemo.history.forEach(h => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="muted">${h.date}</td><td>${h.concept}</td><td>${moneyCLP(h.amount)}</td><td><span class="tag ok">${h.status}</span></td>`;
      body.appendChild(tr);
    });
  }

  // ---------------- Withdrawals rendering ----------------
  function withdrawalStateTag(w){
    if (w.state==='pending_me') return `<span class="tag warn">Pendiente de mi autorización</span>`;
    if (w.state==='approved') return `<span class="tag ok">Aprobado</span>`;
    if (w.state==='rejected') return `<span class="tag bad">Rechazado</span>`;
    return `<span class="tag">${w.state}</span>`;
  }

  function renderWithdrawals(){
    const body = document.getElementById('withdrawalsTable');
    body.innerHTML='';
    window.cursappDemo.withdrawals.forEach(w => {
      const progress = `${w.approvals}/${w.required}`;
      const auditLine = w.audit ? `<div class="muted">Audit: ${w.audit.by} · ${w.audit.at}</div>` : '';
      const actions = (w.state==='pending_me')
        ? `<div style="display:flex; gap:8px; flex-wrap:wrap;">
             <button class="btn primary" style="padding:8px 10px;" onclick="openWithdrawOTP('${w.id}')">Autorizar</button>
             <button class="btn danger" style="padding:8px 10px;" onclick="openWithdrawReject('${w.id}')">Rechazar</button>
           </div>`
        : `<span class="muted">—</span>`;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><b>#${w.id}</b>
            <div class="muted">Solicita: ${w.requester}</div>
            <div class="muted">Adjunto: ${w.attachment}</div>
            ${auditLine}
        </td>
        <td>${moneyCLP(w.amount)}</td>
        <td>${w.reason}</td>
        <td><span class="pill">${progress}</span></td>
        <td>${withdrawalStateTag(w)}</td>
        <td>${actions}</td>
      `;
      body.appendChild(tr);
    });
  }

  // ---------------- Modal helpers ----------------
  function openModal(title, bodyHtml, actionsHtml){
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalActions').innerHTML = actionsHtml || '';
    document.getElementById('modalBackdrop').classList.add('show');
  }
  function closeModal(e){
    if (e && e.target && e.target.classList && !e.target.classList.contains('backdrop')) return;
    document.getElementById('modalBackdrop').classList.remove('show');
  }

  // ---------------- Payments modal ----------------
  function openReceipt(code){
    openModal("Comprobante (window.cursappDemo)",
      `<div><b>Código:</b> ${code}</div>
       <div class="hr"></div>
       <div class="note">Comprobante simulado. En producción: PDF/Email + referencia transacción.</div>`,
      `<button class="btn" onclick="closeModal()">Cerrar</button>`
    );
  }

  function openPayModal(paymentId){
    const pending = window.cursappDemo.payments.filter(p=>p.status==='pending');
    const p = paymentId ? window.cursappDemo.payments.find(x=>x.id===paymentId) : (pending[0] || null);
    if (!p){
      openModal("Pagar", `<div class="note">No tienes cuotas pendientes.</div>`, `<button class="btn" onclick="closeModal()">Cerrar</button>`);
      return;
    }

    openModal("Pagar cuota",
      `<div><b>${p.concept}</b></div>
       <div class="muted">Vence: ${p.due}</div>
       <div style="margin-top:10px; font-weight:950; font-size:18px;">${moneyCLP(p.amount)}</div>
       <div class="hr"></div>
       <label class="kpiLabel">Método de pago (window.cursappDemo)</label>
       <select id="payMethod">
         <option>Tarjeta (crédito/débito)</option>
         <option>Transferencia</option>
         <option>WebPay / Onepay (window.cursappDemo)</option>
       </select>
       <div class="note">En producción: pasarela + validación + conciliación.</div>`,
      `<button class="btn" onclick="closeModal()">Cancelar</button>
       <button class="btn primary" onclick="confirmPay('${p.id}')">Confirmar pago</button>`
    );
  }

  function confirmPay(paymentId){
    const p = window.cursappDemo.payments.find(x=>x.id===paymentId);
    if (!p) return;

    p.status='paid';
    p.paidDate='Hoy';
    p.receipt='RC-' + Math.floor(1000 + Math.random()*9000);
    window.cursappDemo.history.unshift({date:'Hoy', concept:p.concept, amount:p.amount, status:'Confirmado'});
    window.cursappDemo.notifications.unshift({type:'Pago', msg:`Pago confirmado: ${p.concept}.`, date:'Hoy'});

    closeModal();
    openReceipt(p.receipt);

    computeKPIs();
    renderPaymentsTable();
    renderReceipts();
    renderHistory();
    renderNotifications();
    drawHomeCharts();
  }

  // ---------------- Withdrawals: Reject ----------------
  function openWithdrawReject(withdrawId){
    const w = window.cursappDemo.withdrawals.find(x=>x.id===withdrawId);
    if (!w) return;

    openModal(`Rechazar retiro #${w.id}`,
      `<div><b>Monto:</b> ${moneyCLP(w.amount)}</div>
       <div><b>Motivo:</b> ${w.reason}</div>
       <div class="muted">Adjunto: ${w.attachment}</div>
       <div class="hr"></div>
       <label class="kpiLabel">Motivo del rechazo (window.cursappDemo)</label>
       <input id="rejReason" placeholder="Ej: Falta cotización / no corresponde" />`,
      `<button class="btn" onclick="closeModal()">Cancelar</button>
       <button class="btn danger" onclick="confirmReject('${w.id}')">Rechazar</button>`
    );
  }

  function confirmReject(withdrawId){
    const w = window.cursappDemo.withdrawals.find(x=>x.id===withdrawId);
    if (!w) return;
    w.state='rejected';
    w.audit = {by:user.name, at: nowLabel()};
    window.cursappDemo.notifications.unshift({type:'Retiro', msg:`Rechazaste retiro #${w.id}.`, date:'Hoy'});
    closeModal();
    alert("❌ Retiro rechazado (window.cursappDemo).");
    computeKPIs(); renderWithdrawals(); renderNotifications(); drawWithdrawalsChart();
  }

  // ---------------- Withdrawals: Approve with OTP ----------------
  let otpState = { code:null, forId:null, attempts:0, verified:false, channel:'email' };

  function openWithdrawOTP(withdrawId){
    const w = window.cursappDemo.withdrawals.find(x=>x.id===withdrawId);
    if (!w) return;

    otpState = { code:null, forId:withdrawId, attempts:0, verified:false, channel:'email' };

    openModal(`Autorizar retiro #${w.id}`,
      `<div><b>Monto:</b> ${moneyCLP(w.amount)}</div>
       <div><b>Motivo:</b> ${w.reason}</div>
       <div><b>Solicita:</b> ${w.requester}</div>
       <div class="muted">Adjunto: ${w.attachment}</div>
       <div class="hr"></div>
       <div class="note"><b>Seguridad:</b> para autorizar debes validar un código (OTP).</div>`,
      `<button class="btn" onclick="closeModal()">Cancelar</button>
       <button class="btn primary" onclick="openOTPStep()">Continuar</button>`
    );
  }

  function openOTPStep(){
    const w = window.cursappDemo.withdrawals.find(x=>x.id===otpState.forId);
    if (!w) return;

    openModal(`OTP para autorizar #${w.id}`,
      `<div class="note">Elige canal y solicita el código. (Demo: se mostrará en pantalla).</div>
       <label class="kpiLabel">Canal</label>
       <select id="otpChannel" onchange="otpState.channel=this.value">
         <option value="email">Correo (${user.email})</option>
         <option value="sms">SMS (${user.phone})</option>
       </select>

       <button class="btn ghost" style="margin-top:10px; width:100%;" onclick="sendOTP()">Enviar código</button>

       <div class="hr"></div>
       <label class="kpiLabel">Código de 6 dígitos</label>
       <input id="otpInput" placeholder="123456" inputmode="numeric" />
       <div id="otpMsg"></div>
       <div id="otpDemo" class="note"></div>`,
      `<button class="btn" onclick="openWithdrawOTP('${w.id}')">Atrás</button>
       <button class="btn primary" id="btnVerify" onclick="verifyOTP()">Verificar</button>`
    );
  }

  function sendOTP(){
    otpState.code = String(Math.floor(100000 + Math.random()*900000));
    otpState.verified = false;
    otpState.attempts = 0;
    document.getElementById('otpDemo').innerHTML = `<span class="note">Demo: tu código es <b>${otpState.code}</b></span>`;
    document.getElementById('otpMsg').innerHTML = `<div class="success">Código enviado por ${otpState.channel==='sms'?'SMS':'correo'} (window.cursappDemo).</div>`;
  }

  function verifyOTP(){
    const input = (document.getElementById('otpInput').value || '').trim();
    const msg = document.getElementById('otpMsg');

    if (!otpState.code){
      msg.innerHTML = `<div class="error">Primero debes enviar el código.</div>`;
      return;
    }

    otpState.attempts += 1;
    if (input === otpState.code){
      otpState.verified = true;
      msg.innerHTML = `<div class="success">Código verificado ✅</div>`;
      setTimeout(() => finalizeWithdrawApproval(otpState.forId), 350);
      return;
    }

    if (otpState.attempts >= 3){
      msg.innerHTML = `<div class="error">Demasiados intentos. Vuelve a enviar el código.</div>`;
      otpState.code = null;
      return;
    }

    msg.innerHTML = `<div class="error">Código incorrecto. Intento ${otpState.attempts}/3</div>`;
  }

  function finalizeWithdrawApproval(withdrawId){
    const w = window.cursappDemo.withdrawals.find(x=>x.id===withdrawId);
    if (!w) return;

    w.approvals = Math.min(w.required, w.approvals + 1);
    w.state = 'approved';
    w.audit = {by:user.name, at: nowLabel()};

    window.cursappDemo.notifications.unshift({type:'Retiro', msg:`Autorizaste retiro #${w.id}.`, date:'Hoy'});

    closeModal();
    alert("✅ Retiro autorizado (window.cursappDemo).");

    computeKPIs();
    renderWithdrawals();
    renderNotifications();
    drawWithdrawalsChart();
  }

  function nowLabel(){
    const d = new Date();
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = months[d.getMonth()];
    const hh = String(d.getHours()).padStart(2,'0');
    const mi = String(d.getMinutes()).padStart(2,'0');
    return `${dd} ${mm} ${hh}:${mi}`;
  }

  // ---------------- Profile ----------------
  function loadProfile(){
    document.getElementById('pName').value = user.name || '';
    document.getElementById('pRole').value = user.role || 'Apoderado';
    document.getElementById('pEmail').value = user.email || '';
    document.getElementById('pPhone').value = user.phone || '';
    document.getElementById('pSchool').value = user.school || '';
    document.getElementById('pCourse').value = user.course || '';
  }

  function saveProfile(){
    user.name = document.getElementById('pName').value || user.name;
    user.email = document.getElementById('pEmail').value || user.email;
    user.phone = document.getElementById('pPhone').value || user.phone;
    localStorage.setItem('cursapp_demo_user', JSON.stringify(user));
    document.getElementById('whoLine').innerText = user.name + " · " + user.course + " · " + user.email;
    alert("Perfil guardado (window.cursappDemo).");
  }

  // ---------------- Charts (no libraries) ----------------
  function setupCanvas(canvas){
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h){
      canvas.width = w; canvas.height = h;
    }
    return {ctx: canvas.getContext('2d'), w, h, dpr};
  }
  function clearChart(ctx, w, h){
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,w,h);
  }
  function drawAxes(ctx, w, h, pad){
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, pad);
    ctx.lineTo(pad, h-pad);
    ctx.lineTo(w-pad, h-pad);
    ctx.stroke();
  }
  function drawBarChart(canvas, labels, values){
    const {ctx,w,h} = setupCanvas(canvas);
    const pad = 28;
    clearChart(ctx,w,h); drawAxes(ctx,w,h,pad);
    const maxV = Math.max(1, ...values);
    const n = values.length;
    const plotW = (w - pad*2);
    const plotH = (h - pad*2);
    const gap = plotW / n;
    const barW = gap * 0.55;

    ctx.fillStyle = '#4f46e5';
    for (let i=0;i<n;i++){
      const v = values[i];
      const barH = Math.round((v/maxV) * plotH);
      const x = pad + i*gap + (gap-barW)/2;
      const y = (h - pad) - barH;
      ctx.fillRect(x, y, barW, barH);
    }
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    labels.forEach((lab,i)=>{
      const x = pad + i*gap + gap/2;
      ctx.fillText(lab, x, h - 10);
    });
  }
  function drawDonut(canvas, parts){
    const {ctx,w,h} = setupCanvas(canvas);
    clearChart(ctx,w,h);
    const cx=w/2, cy=h/2;
    const r=Math.min(w,h)*0.32;
    const r2=r*0.62;
    const total = parts.reduce((a,b)=>a+b.value,0) || 1;
    let start=-Math.PI/2;
    const palette=['#4f46e5','#f59e0b','#10b981','#ef4444'];

    parts.forEach((p,idx)=>{
      const ang=(p.value/total)*Math.PI*2;
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.fillStyle=palette[idx%palette.length];
      ctx.arc(cx,cy,r,start,start+ang);
      ctx.closePath();
      ctx.fill();
      start+=ang;
    });
    ctx.beginPath();
    ctx.fillStyle='#ffffff';
    ctx.arc(cx,cy,r2,0,Math.PI*2);
    ctx.fill();

    ctx.fillStyle='#111827';
    ctx.font='700 14px system-ui';
    ctx.textAlign='center';
    ctx.fillText('Cuotas', cx, cy-2);
    ctx.fillStyle='#6b7280';
    ctx.font='12px system-ui';
    ctx.fillText(parts.map(p=>p.value).reduce((a,b)=>a+b,0)+' total', cx, cy+16);

    ctx.textAlign='left';
    ctx.font='12px system-ui';
    let lx=16, ly=16;
    parts.forEach((p,idx)=>{
      ctx.fillStyle=palette[idx%palette.length];
      ctx.fillRect(lx, ly + idx*18, 10, 10);
      ctx.fillStyle='#6b7280';
      ctx.fillText(p.label + ' ('+p.value+')', lx + 16, ly + 9 + idx*18);
    });
  }
  function drawStackedBars(canvas, labels, seriesA, seriesB, labelA, labelB){
    const {ctx,w,h} = setupCanvas(canvas);
    const pad=28;
    clearChart(ctx,w,h); drawAxes(ctx,w,h,pad);
    const maxV=Math.max(1, ...labels.map((_,i)=>seriesA[i]+seriesB[i]));
    const n=labels.length;
    const plotW=(w-pad*2);
    const plotH=(h-pad*2);
    const gap=plotW/n;
    const barW=gap*0.55;

    for (let i=0;i<n;i++){
      const a=seriesA[i], b=seriesB[i];
      const ha=Math.round((a/maxV)*plotH);
      const hb=Math.round((b/maxV)*plotH);
      const x=pad + i*gap + (gap-barW)/2;
      const y0=(h-pad);
      ctx.fillStyle='#4f46e5';
      ctx.fillRect(x, y0 - ha, barW, ha);
      ctx.fillStyle='#ef4444';
      ctx.fillRect(x, y0 - ha - hb, barW, hb);
    }
    ctx.fillStyle='#6b7280';
    ctx.font='12px system-ui';
    ctx.textAlign='center';
    labels.forEach((lab,i)=>{
      const x=pad+i*gap+gap/2;
      ctx.fillText(lab, x, h-10);
    });
    ctx.textAlign='left';
    ctx.fillStyle='#4f46e5';
    ctx.fillRect(pad, pad-14, 10, 10);
    ctx.fillStyle='#6b7280';
    ctx.fillText(labelA, pad+16, pad-5);
    ctx.fillStyle='#ef4444';
    ctx.fillRect(pad+110, pad-14, 10, 10);
    ctx.fillStyle='#6b7280';
    ctx.fillText(labelB, pad+126, pad-5);
  }

  function drawHomeCharts(){
    const c1=document.getElementById('chartPayments');
    if (c1){
      drawBarChart(c1,
        window.cursappDemo.charts.payments6m.map(x=>x.label),
        window.cursappDemo.charts.payments6m.map(x=>x.value)
      );
    }
    const c2=document.getElementById('chartStatus');
    if (c2){
      const paid=window.cursappDemo.payments.filter(p=>p.status==='paid').length;
      const pending=window.cursappDemo.payments.filter(p=>p.status==='pending').length;
      drawDonut(c2, [{label:'Pagadas', value:paid},{label:'Pendientes', value:pending}]);
    }
  }

  function drawWithdrawalsChart(){
    const c=document.getElementById('chartWithdrawals');
    if (!c) return;
    drawStackedBars(c,
      window.cursappDemo.charts.withdrawals6m.map(x=>x.label),
      window.cursappDemo.charts.withdrawals6m.map(x=>x.approved),
      window.cursappDemo.charts.withdrawals6m.map(x=>x.rejected),
      'Aprobadas','Rechazadas'
    );
  }

  // ---------------- Init render ----------------
  function showPayTab(which){
    document.getElementById('pay-pending').style.display = (which==='pending')?'block':'none';
    document.getElementById('pay-history').style.display = (which==='history')?'block':'none';
    document.getElementById('tab-pay-pending').classList.toggle('active', which==='pending');
    document.getElementById('tab-pay-history').classList.toggle('active', which==='history');
  }

  // Quick menu (header)
  function toggleQuickMenu(){
    const menu = document.getElementById('quickMenu');
    const btn = document.getElementById('quickMenuBtn');
    if (!menu || !btn) return;
    const open = menu.classList.toggle('show');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function closeQuickMenu(){
    const menu = document.getElementById('quickMenu');
    const btn = document.getElementById('quickMenuBtn');
    if (!menu || !btn) return;
    menu.classList.remove('show');
    btn.setAttribute('aria-expanded', 'false');
  }

  window.addEventListener('click', (e) => {
    const menu = document.getElementById('quickMenu');
    const btn = document.getElementById('quickMenuBtn');
    if (!menu || !btn) return;
    const inside = menu.contains(e.target) || btn.contains(e.target);
    if (!inside) closeQuickMenu();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeQuickMenu();
  });

  function init(){
    renderNotifications();
    computeKPIs();
    renderPaymentsTable();
    renderReceipts();
    renderHistory();
    renderWithdrawals();
    loadProfile();
    drawHomeCharts();
    drawWithdrawalsChart();
  }

  window.addEventListener('resize', () => {
    drawHomeCharts();
    drawWithdrawalsChart();
  });

  showKPI(0);
  init();
