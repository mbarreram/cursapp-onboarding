(function(){
  'use strict';
  if(window.__MX_DIRECTIVA_FUNDS_V1__) return;
  window.__MX_DIRECTIVA_FUNDS_V1__=true;

  const sb = async (path,opts)=>{
    if(!window.CURSAPP_SUPABASE?.request) throw new Error('Supabase no disponible');
    const data = await window.CURSAPP_SUPABASE.request(path,opts);
    return Array.isArray(data)?data:(data?[data]:[]);
  };
  const q=v=>encodeURIComponent(String(v==null?'':v));
  const clp=v=>'$'+Math.round(Number(v)||0).toLocaleString('es-CL');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let lastState=null;

  function role(){
    if(document.body.classList.contains('cursapp-presidente')) return 'presidente';
    if(document.body.classList.contains('cursapp-tesorero')) return 'tesorero';
    return '';
  }
  function courseKey(){
    try{
      const s=JSON.parse(localStorage.getItem('cursapp_session_v1')||'{}')||{};
      const p=JSON.parse(localStorage.getItem('cursapp_active_profile_v1')||'{}')||{};
      return String(s.courseKey||p.courseKey||p.course_key||localStorage.getItem('cursapp_active_course_v1')||'').trim();
    }catch(_e){ return String(localStorage.getItem('cursapp_active_course_v1')||'').trim(); }
  }
  async function resolveCourse(){
    const ck=courseKey();
    if(!ck) throw new Error('No se encontró el curso activo.');
    const rows=await sb('cursos?course_key=eq.'+q(ck)+'&select=id,course_key,nombre&limit=1',{method:'GET'});
    if(!rows[0]?.id) throw new Error('El curso activo no está disponible en Supabase.');
    return rows[0];
  }
  async function loadState(){
    const course=await resolveCourse();
    const [balances,withdrawals]=await Promise.all([
      sb('v_saldos_curso?curso_id=eq.'+q(course.id)+'&select=*',{method:'GET'}),
      sb('retiros_curso?curso_id=eq.'+q(course.id)+'&select=id,monto_solicitado,monto_pagado,estado,aprobaciones_pct,solicitado_at,pagado_at,observacion&order=solicitado_at.desc&limit=20',{method:'GET'})
    ]);
    return {course,balance:balances[0]||{},withdrawals};
  }
  function n(o,k){ return Number(o?.[k]||0)||0; }
  function statusLabel(st){
    return ({solicitado:'Solicitado',aprobacion:'En aprobación',aprobado:'Aprobado',procesando:'Procesando',pagado:'Pagado',rechazado:'Rechazado',cancelado:'Cancelado'})[String(st||'').toLowerCase()]||String(st||'Pendiente');
  }
  function navIcon(){
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16v12H4z"/><path d="M7 7V5h10v2"/><path d="M8 12h8"/><path d="m13 9 3 3-3 3"/></svg>';
  }
  function installNav(){
    const nav=document.querySelector('.bottomNav');
    if(!nav||nav.querySelector('[data-mx-funds]')) return;
    const b=document.createElement('button');
    b.type='button';
    b.className='navItem mxFundsNavItem';
    b.dataset.mxFunds='1';
    const iconClass=role()==='presidente'?'presNavIcon':'tesNavIcon';
    b.innerHTML='<span class="'+iconClass+'" aria-hidden="true">'+navIcon()+'</span><span>Retiros</span>';
    b.addEventListener('click',function(ev){ev.preventDefault();openModule();});
    nav.appendChild(b);
  }
  function setActive(){
    document.querySelectorAll('.bottomNav .navItem').forEach(x=>x.classList.toggle('active',x.hasAttribute('data-mx-funds')));
    document.body.setAttribute('data-mx-module','retiros-recaudado');
  }
  function resetModuleMarker(){ document.body.removeAttribute('data-mx-module'); }
  function installResetOnNativeNav(){
    document.querySelectorAll('.bottomNav .navItem:not([data-mx-funds])').forEach(b=>{
      if(b.dataset.mxFundsReset==='1') return;
      b.dataset.mxFundsReset='1';
      b.addEventListener('click',resetModuleMarker,true);
    });
  }

  function renderLoading(){
    const app=document.getElementById('app'); if(!app)return;
    app.innerHTML='<div class="mxFundsPage"><section class="mxFundsPanel"><h2>Cargando Retiros / Recaudado…</h2><p>Consultando saldos financieros en Supabase.</p></section></div>';
  }
  function render(state){
    lastState=state;
    const app=document.getElementById('app'); if(!app)return;
    const b=state.balance||{};
    const available=n(b,'disponible_retiro');
    const total=n(b,'recaudado_total');
    const online=n(b,'recaudado_transbank');
    const manual=n(b,'recaudado_manual');
    const manualPending=n(b,'manual_pendiente_conciliacion');
    const pendingSettlement=n(b,'transbank_pendiente_liquidacion');
    const liquidated=n(b,'transbank_liquidado');
    const withdrawn=n(b,'retiros_pagados');
    const reserved=n(b,'retiros_reservados');
    const feeTb=n(b,'comision_transbank');
    const feeMx=n(b,'comision_micursox');
    const history=(state.withdrawals||[]).map(r=>{
      const dt=new Date(r.solicitado_at||'');
      const date=Number.isNaN(dt.getTime())?'Sin fecha':dt.toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'}).replace('.','');
      return '<article class="mxFundsHistoryItem"><div><b>Retiro '+esc(statusLabel(r.estado))+'</b><small>'+esc(date)+(Number(r.aprobaciones_pct||0)>0?' · Aprobación '+Number(r.aprobaciones_pct||0).toFixed(0)+'%':'')+'</small></div><div><strong>'+clp(r.estado==='pagado'?(r.monto_pagado||r.monto_solicitado):r.monto_solicitado)+'</strong><em>'+esc(statusLabel(r.estado))+'</em></div></article>';
    }).join('')||'<div class="mxFundsEmpty">Aún no existen solicitudes de retiro.</div>';

    app.innerHTML='<div class="mxFundsPage">'
      +'<section class="mxFundsHead"><div><h1>Retiros / Recaudado</h1><p>Separa lo recaudado por Transbank de los pagos manuales conciliados.</p></div><span class="mxFundsBadge">● Saldo desde Supabase</span></section>'
      +'<section class="mxFundsHero"><div class="mxFundsHeroTop"><div><small>Disponible para retirar desde MiCursoX</small><strong>'+clp(available)+'</strong></div><button class="mxFundsWithdrawBtn" type="button" '+(available<=0?'disabled':'')+' id="mxRequestWithdrawal">Solicitar retiro</button></div><div class="mxFundsHint">Solo este saldo puede retirarse desde MiCursoX. Los pagos manuales aumentan la recaudación del curso, pero no aumentan el dinero disponible en MiCursoX.</div></section>'
      +'<section class="mxFundsGrid">'
      +'<article class="mxFundsCard total"><span>● Recaudado total</span><b>'+clp(total)+'</b><em>Transbank + manuales conciliados</em></article>'
      +'<article class="mxFundsCard online"><span>● Vía Transbank</span><b>'+clp(online)+'</b><em>Cuotas pagadas online</em></article>'
      +'<article class="mxFundsCard manual"><span>● Pagos manuales</span><b>'+clp(manual)+'</b><em>Efectivo / transferencia conciliada</em></article>'
      +'<article class="mxFundsCard pending"><span>● Retirado</span><b>'+clp(withdrawn)+'</b><em>Transferencias ya pagadas por MiCursoX</em></article>'
      +'</section>'
      +'<div class="mxFundsPanelsDesktop">'
      +'<section class="mxFundsPanel"><h2>Cómo se compone el saldo</h2><p>Los movimientos manuales se informan, pero nunca forman parte del saldo retirable de MiCursoX.</p><div class="mxFundsBreakdown">'
      +'<div class="mxFundsLine"><div><b>Transbank liquidado</b><small>Fondos online disponibles en MiCursoX</small></div><strong>'+clp(liquidated)+'</strong></div>'
      +'<div class="mxFundsLine"><div><b>Transbank pendiente de liquidación</b><small>Pago confirmado, aún no habilitado para retiro</small></div><strong>'+clp(pendingSettlement)+'</strong></div>'
      +'<div class="mxFundsLine"><div><b>Manual conciliado</b><small>Dinero recibido directamente por la directiva</small></div><strong>'+clp(manual)+'</strong></div>'
      +'<div class="mxFundsLine"><div><b>Manual pendiente de conciliación</b><small>No suma al recaudado hasta ser conciliado</small></div><strong>'+clp(manualPending)+'</strong></div>'
      +'<div class="mxFundsLine"><div><b>Retiros reservados / en proceso</b><small>Se descuentan para evitar solicitar dos veces el mismo saldo</small></div><strong>- '+clp(reserved)+'</strong></div>'
      +'<div class="mxFundsLine"><div><b>Retiros pagados</b><small>Fondos ya transferidos fuera de MiCursoX</small></div><strong>- '+clp(withdrawn)+'</strong></div>'
      +'</div><div class="mxFundsFeeBox"><h3>Cargos sobre cuotas pagadas por Transbank</h3><div class="mxFundsFeeRow"><span>Transbank · 1,79%</span><b>'+clp(feeTb)+'</b></div><div class="mxFundsFeeRow"><span>MiCursoX · 2,25%</span><b>'+clp(feeMx)+'</b></div><div class="mxFundsFeeNote">Ambos cargos se calculan sobre el monto destinado como cuota y se agregan al total que paga el apoderado. El monto de la cuota sigue perteneciendo íntegramente al curso.</div></div></section>'
      +'<section class="mxFundsPanel"><h2>Historial de retiros</h2><p>Las solicitudes quedan registradas y requieren el flujo de aprobación antes de ser pagadas.</p><div class="mxFundsHistory">'+history+'</div></section>'
      +'</div></div>';

    const btn=document.getElementById('mxRequestWithdrawal');
    if(btn) btn.onclick=()=>openWithdrawalModal(state,available);
  }
  function openWithdrawalModal(state,available){
    const root=document.getElementById('modalRoot')||document.body;
    const wrap=document.createElement('div');
    wrap.className='mxFundsModal';
    wrap.innerHTML='<div class="mxFundsModalCard"><h2>Solicitar retiro</h2><p>Disponible: <b>'+clp(available)+'</b>. Esta solicitud no transfiere dinero todavía; queda pendiente del flujo de aprobación.</p><label>Monto a retirar</label><input id="mxWithdrawalAmount" type="number" min="1" max="'+Math.floor(available)+'" step="1" inputmode="numeric" placeholder="Ej. 50000"><div class="mxFundsModalActions"><button type="button" data-close>Cancelar</button><button type="button" class="primary" data-submit>Solicitar</button></div></div>';
    root.appendChild(wrap);
    const close=()=>wrap.remove();
    wrap.querySelector('[data-close]').onclick=close;
    wrap.addEventListener('click',e=>{if(e.target===wrap)close();});
    wrap.querySelector('[data-submit]').onclick=async function(){
      const amount=Math.round(Number(wrap.querySelector('#mxWithdrawalAmount').value)||0);
      if(amount<=0||amount>available){ alert('Ingresa un monto válido, no superior al saldo disponible.'); return; }
      const submit=this; submit.disabled=true; submit.textContent='Registrando…';
      try{
        const user=await window.CURSAPP_SUPABASE.getCurrentUser();
        await sb('retiros_curso',{method:'POST',body:JSON.stringify({curso_id:state.course.id,monto_solicitado:amount,solicitado_por:user.id,estado:'solicitado',aprobaciones_requeridas_pct:30})});
        close();
        await openModule();
      }catch(e){ submit.disabled=false; submit.textContent='Solicitar'; alert('No se pudo registrar el retiro: '+(e.message||e)); }
    };
  }
  async function openModule(){
    setActive(); renderLoading();
    try{ render(await loadState()); }
    catch(e){ const app=document.getElementById('app'); if(app) app.innerHTML='<div class="mxFundsPage"><div class="mxFundsError">No se pudo cargar Retiros / Recaudado: '+esc(e.message||e)+'</div></div>'; }
  }
  window.MX_DIRECTIVA_FUNDS={open:openModule,refresh:openModule};

  function boot(){ installNav(); installResetOnNativeNav(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  setTimeout(boot,600); setTimeout(boot,1800);
})();
