(function(){
  'use strict';
  const desktop=window.matchMedia('(min-width:1024px)');
  let renderTimer=0;

  const svg={
    wallet:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h15a2 2 0 0 1 2 2v9H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12v3"/><path d="M16 12h5"/></svg>',
    check:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></svg>',
    calendar:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
    chart:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    card:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/></svg>',
    receipt:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
    report:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6V3Z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
    store:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16l-1-5H5l-1 5Z"/><path d="M6 10v10h12V10M9 20v-6h6v6"/></svg>',
    bell:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>',
    help:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.7 2.7 0 0 1 5.2.9c0 2.1-2.7 2.2-2.7 4.1M12 18h.01"/></svg>',
    message:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/></svg>',
    shield:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>',
    arrow:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
    family:'<svg class="mxHeroFamily" viewBox="0 0 520 260" role="img" aria-label="Familia revisando su curso"><defs><linearGradient id="mxHeroBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef4ff"/><stop offset="1" stop-color="#f7f2ff"/></linearGradient><linearGradient id="mxShirtA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2bb6a8"/><stop offset="1" stop-color="#16877f"/></linearGradient><linearGradient id="mxShirtB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9b5cff"/><stop offset="1" stop-color="#6f3bd7"/></linearGradient></defs><path d="M8 228C60 180 112 187 158 210c49 24 95 15 140-6 62-29 131-19 214 24v32H8Z" fill="url(#mxHeroBg)"/><circle cx="92" cy="70" r="46" fill="#e4eeff"/><circle cx="456" cy="68" r="38" fill="#e8f8ef"/><path d="M82 208c8-38 34-59 62-59 29 0 53 20 62 59Z" fill="url(#mxShirtA)"/><circle cx="145" cy="117" r="37" fill="#f0b78e"/><path d="M111 112c3-35 24-48 49-42 17 4 28 19 28 36-13-9-31-13-49-6-11 4-19 9-28 12Z" fill="#1e2433"/><path d="M305 211c7-40 33-62 64-62 31 0 56 21 65 62Z" fill="url(#mxShirtB)"/><circle cx="369" cy="116" r="37" fill="#efb083"/><path d="M333 111c4-34 26-48 50-42 20 5 29 20 28 38-20-13-43-16-78 4Z" fill="#35251f"/><path d="M203 222c4-43 30-69 62-69s57 25 63 69Z" fill="#ffbd2e"/><circle cx="265" cy="135" r="34" fill="#f3ba8f"/><path d="M234 130c2-31 20-43 42-38 19 4 28 19 27 35-16-10-39-13-69 3Z" fill="#2c2727"/><rect x="205" y="180" width="128" height="70" rx="10" fill="#f9fbff" stroke="#c9d4ec" stroke-width="5"/><circle cx="269" cy="217" r="8" fill="#b6c2d9"/><path d="M55 224h72l-10-48H65Z" fill="#397af4"/><path d="M69 181h45M79 168v13M104 168v13" stroke="#fff" stroke-width="6" stroke-linecap="round"/><path d="M457 203v-49M441 175c11-18 20-18 31 0M443 192c9-15 18-15 27 0" stroke="#36a16b" stroke-width="7" stroke-linecap="round"/><rect x="438" y="202" width="39" height="23" rx="5" fill="#d7a46b"/></svg>'
  };

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(v)||0);
  const json=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'')||fallback;}catch(_){return fallback;}};
  const scoped=base=>window.CURSAPP?.scopedKey?window.CURSAPP.scopedKey(base):`cursapp_${base}`;

  function profile(){return json('cursapp_active_profile_v1',{})||{};}
  function session(){return json('cursapp_session_v1',{})||{};}
  function identity(){
    const p=profile(),s=session();
    return {
      email:String(p?.email||p?.user?.email||p?.apoderado?.email||s?.email||s?.userId||'').toLowerCase().trim(),
      member:String(p?.supabase?.miembro_id||p?.miembro_id||p?.profileId||p?.id||localStorage.getItem('cursapp_active_miembro_id_v1')||'').trim()
    };
  }
  function belongs(p,id){
    const pm=String(p?.miembroId||p?.miembro_id||p?.alumnoId||p?.studentId||p?.supabase?.miembro_id||p?.raw?.miembro_id||'').trim();
    if(id.member&&pm)return id.member===pm;
    const email=String(p?.apoderadoEmail||p?.email||p?.apoderadoKey||p?.apoderadoId||'').toLowerCase().trim();
    return id.email?email===id.email:true;
  }
  function payments(){
    const id=identity();
    const rows=json(scoped('payments_v1'),[]);
    return (Array.isArray(rows)?rows:[]).filter(p=>belongs(p,id));
  }
  function amount(p,paid){return Number(p?.[paid?'amountPaid':'amountRemaining']??p?.amount??p?.monto??0)||0;}
  function status(p){return String(p?.status||p?.estado||'pending').toLowerCase().trim();}
  function isPaid(p){return status(p)==='paid';}
  function isPending(p){return ['pending','partial','overdue','pendiente','vencido'].includes(status(p));}
  function dueTime(p){const d=p?.dueDate||p?.fecha_vencimiento;return d?new Date(String(d).slice(0,10)+'T00:00:00').getTime():Number.MAX_SAFE_INTEGER;}
  function title(p){return p?.title||p?.concept||p?.taskTitle||p?.campaignTitle||p?.fromTaskTitle||p?.nombre||'Pago del curso';}
  function dueDate(p){return String(p?.dueDate||p?.fecha_vencimiento||'').slice(0,10);}
  function dateParts(iso){
    if(!iso)return {month:'—',day:'—',weekday:'Sin fecha'};
    const d=new Date(iso+'T00:00:00');
    return {month:d.toLocaleDateString('es-CL',{month:'short'}).replace('.','').toUpperCase(),day:String(d.getDate()).padStart(2,'0'),weekday:d.toLocaleDateString('es-CL',{weekday:'long'})};
  }
  function dueText(iso){
    if(!iso)return 'Fecha por confirmar';
    const today=new Date();today.setHours(0,0,0,0);
    const d=new Date(iso+'T00:00:00');
    const days=Math.round((d-today)/86400000);
    if(days<0)return `Venció hace ${Math.abs(days)} día(s)`;
    if(days===0)return 'Vence hoy';
    return `Vence en ${days} día(s)`;
  }
  function noticeDate(value){
    if(!value)return '';
    const d=new Date(value);
    return Number.isNaN(d.getTime())?'':d.toLocaleString('es-CL',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
  }
  function notices(){
    const all=[];
    try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&/_avisos_v2$/.test(k)){const v=json(k,[]);if(Array.isArray(v))all.push(...v);}}}catch(_){ }
    const seen=new Set();
    return all.filter(x=>x&&(x.title||x.message)).filter(x=>{const k=String(x.id||x.createdAt||'')+'|'+String(x.title||'');if(seen.has(k))return false;seen.add(k);return true;}).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,2);
  }
  function activeTab(){return document.querySelector('.apoderado-bottom-nav-item.active,[data-tab].active')?.getAttribute('data-tab')||'home';}
  function go(tab){
    const button=document.querySelector(`.apoderado-bottom-nav-item[data-tab="${tab}"],.navItem[data-tab="${tab}"]`);
    if(button)button.click();
  }
  function ensureRoot(){
    let root=document.getElementById('mxApoNativeDesktop');
    if(!root){root=document.createElement('main');root.id='mxApoNativeDesktop';root.className='mxApoNativeDesktop';document.body.appendChild(root);}
    return root;
  }
  function dueCard(p,index,total){
    const iso=dueDate(p),dp=dateParts(iso),id=esc(p?.id||'');
    const isFirst=index===0;
    return `<article class="mxNativeDueCard ${isFirst?'featured':''}">
      <div class="mxNativeDate"><b>${esc(dp.month)}</b><strong>${esc(dp.day)}</strong><span>${esc(dp.weekday)}</span></div>
      <div class="mxNativeDueCopy"><div class="mxNativeDueTop"><span>Cuota ${index+1} de ${total}</span>${svg.arrow}</div><h3>${esc(title(p))}</h3><p>${esc(dueText(iso))}</p><p>${iso?esc(new Date(iso+'T00:00:00').toLocaleDateString('es-CL')):'Fecha por confirmar'}</p><strong>${money(amount(p,false))}</strong>
      <div class="mxNativeActions">${isFirst?`<button class="primary" type="button" data-pay="${id}">Pagar ahora</button>`:''}<button type="button" data-open-payments>Ver detalle</button></div></div>
    </article>`;
  }
  function metric(label,value,sub,icon,tone){return `<article class="mxNativeMetric ${tone}"><span>${icon}</span><div><small>${esc(label)}</small><strong>${esc(value)}</strong><em>${esc(sub)}</em></div><i>${svg.chart}</i></article>`;}
  function noticeIcon(n){return /informe|reporte/i.test(String(n?.title||''))?svg.report:svg.bell;}
  function quickButton(tab,icon,label,copy,extra=''){return `<button ${tab==='market'?'data-market':`data-tab-go="${tab}"`}><span>${icon}</span><div><b>${label}</b><small>${copy}</small></div>${extra}<i>${svg.arrow}</i></button>`;}

  function renderHome(){
    if(!desktop.matches||activeTab()!=='home'){unmount();return;}
    const root=ensureRoot();
    const rows=payments(),pending=rows.filter(isPending).sort((a,b)=>dueTime(a)-dueTime(b)),paid=rows.filter(isPaid);
    const year=new Date().getFullYear(),month=new Date().getMonth();
    const paidYear=paid.filter(p=>new Date(String(p?.paidAt||p?.createdAt||p?.dueDate||'').slice(0,10)).getFullYear()===year);
    const pendingTotal=pending.reduce((s,p)=>s+amount(p,false),0);
    const paidTotal=paidYear.reduce((s,p)=>s+amount(p,true),0);
    const upcoming=pending.filter(p=>{const iso=dueDate(p);if(!iso)return false;const d=new Date(iso+'T00:00:00');return d.getFullYear()===year&&d.getMonth()===month;}).length;
    const dues=pending.slice(0,3),news=notices();

    root.innerHTML=`<div class="mxNativeWrap">
      <header class="mxNativeHero">
        <div class="mxNativeHeroCopy"><span>Panel del apoderado</span><h1>Resumen de tu curso</h1><p>Revisa tus próximas cuotas, pagos y novedades del curso.</p></div>
        <div class="mxNativeHeroArt">${svg.family}</div>
        <button type="button" data-open-payments>${svg.receipt}<span>Ver todos los pagos</span></button>
      </header>

      <section class="mxNativePanel mxNativeDuesPanel">
        <div class="mxNativeSectionHead"><div><h2>${svg.calendar}Próximas cuotas</h2><p>${dues.length?'Hasta 3 cuotas próximas':'No tienes cuotas pendientes'}</p></div></div>
        <div class="mxNativeDuesGrid ${dues.length===1?'one':''}">${dues.length?dues.map((p,i)=>dueCard(p,i,dues.length)).join(''):'<div class="mxNativeEmpty"><strong>Todo al día</strong><span>No tienes pagos urgentes por ahora.</span></div>'}</div>
      </section>

      <section class="mxNativeMetrics">
        ${metric('Pendiente',money(pendingTotal),`${pending.length} ${pending.length===1?'pago':'pagos'}`,svg.wallet,'purple')}
        ${metric('Pagadas',String(paidYear.length),'Este año',svg.check,'green')}
        ${metric('Próximas',String(upcoming),'Este mes',svg.calendar,'orange')}
        ${metric('Total pagado',money(paidTotal),'Este año',svg.chart,'blue')}
      </section>

      <div class="mxNativeLower">
        <section class="mxNativePanel">
          <div class="mxNativeSectionHead"><div><h2>Accesos rápidos</h2><p>Todo lo que necesitas en un solo lugar.</p></div></div>
          <div class="mxNativeQuickGrid">
            ${quickButton('payments',svg.card,'Pagos','Revisa y paga tus cuotas pendientes')}
            ${quickButton('payments',svg.receipt,'Comprobantes','Descarga tus comprobantes de pago')}
            ${quickButton('informes',svg.report,'Informes','Consulta los informes publicados')}
            ${quickButton('market',svg.store,'Mercado Escolar','Compra, vende o intercambia','<em>Nuevo</em>')}
          </div>
        </section>
        <section class="mxNativePanel">
          <div class="mxNativeSectionHead"><div><h2>Avisos del curso</h2><p>Comunicaciones recientes de la directiva.</p></div><button type="button" data-open-notices>Ver todos</button></div>
          <div class="mxNativeNotices">${news.length?news.map(n=>`<article><span>${noticeIcon(n)}</span><div><h3>${esc(n.title||'Aviso del curso')}</h3><p>${esc(n.message||'')}</p><time>${esc(noticeDate(n.createdAt||n.date||n.fecha))}</time></div>${svg.arrow}</article>`).join(''):'<div class="mxNativeEmpty compact"><strong>Sin avisos nuevos</strong><span>Cuando la directiva publique algo, aparecerá aquí.</span></div>'}</div>
        </section>
      </div>

      <section class="mxNativeSupport">
        <div class="mxNativeSupportLead"><span>${svg.help}</span><div><strong>¿Necesitas ayuda?</strong><small>Estamos aquí para apoyarte.</small></div></div>
        <a href="/recursos.html#ayuda"><span>${svg.message}</span><div><b>Centro de ayuda</b><small>Resuelve tus dudas</small></div></a>
        <button type="button" data-open-notices><span>${svg.bell}</span><div><b>Mensajes</b><small>Revisa tus comunicaciones</small></div></button>
        <a href="/recursos.html#seguridad"><span>${svg.shield}</span><div><b>Pago seguro</b><small>Conoce cómo protegemos tus datos</small></div></a>
      </section>
    </div>`;

    document.body.classList.add('mx-apo-native-home');
    document.getElementById('app')?.setAttribute('aria-hidden','true');
    root.hidden=false;
    root.querySelectorAll('[data-open-payments]').forEach(b=>b.onclick=()=>go('payments'));
    root.querySelectorAll('[data-tab-go]').forEach(b=>b.onclick=()=>go(b.dataset.tabGo));
    root.querySelector('[data-market]')?.addEventListener('click',()=>location.href='/mercado-escolar/mercado-escolar.html');
    root.querySelectorAll('[data-pay]').forEach(b=>b.onclick=()=>window.payNow?window.payNow(b.dataset.pay):go('payments'));
    root.querySelectorAll('[data-open-notices]').forEach(b=>b.addEventListener('click',()=>window.openAvisosInbox?.()));
  }

  function unmount(){
    document.body.classList.remove('mx-apo-native-home');
    document.getElementById('app')?.removeAttribute('aria-hidden');
    const root=document.getElementById('mxApoNativeDesktop');if(root)root.hidden=true;
  }
  function schedule(){clearTimeout(renderTimer);renderTimer=setTimeout(()=>{activeTab()==='home'?renderHome():unmount();},80);}
  document.addEventListener('click',e=>{if(e.target.closest?.('.apoderado-bottom-nav-item,[data-tab]'))schedule();},true);
  window.addEventListener('cursapp:apoderado-ready',schedule);
  window.addEventListener('cursapp:dataChanged',schedule);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  desktop.addEventListener?.('change',schedule);
})();