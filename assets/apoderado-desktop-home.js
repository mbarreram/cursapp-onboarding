(function(){
  'use strict';
  const mq=window.matchMedia('(min-width:1024px)');
  let timer=null, rendering=false, lastSignature='', hydrationOpen=true;

  const icons={
    card:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/></svg>',
    receipt:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
    report:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6V3Z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
    market:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16l-1-5H5l-1 5Z"/><path d="M6 10v10h12V10M9 20v-6h6v6"/></svg>',
    wallet:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h15a2 2 0 0 1 2 2v9H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12v3"/><path d="M16 12h5"/></svg>',
    check:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></svg>',
    calendar:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
    chart:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>'
  };
  const text=el=>String(el?.textContent||'').replace(/\s+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function isHome(app){
    const active=document.querySelector('.apoderado-bottom-nav-item.active,[data-tab].active');
    if(active?.getAttribute('data-tab') && active.getAttribute('data-tab')!=='home') return false;
    return !!app.querySelector('.apoV2DueCarousel.next-payment-card,.apoV2SummaryCard.quick-summary-card');
  }

  function sourceHome(app){return app.querySelector('.apoV2Page,.apoderado-home,.cpHomeV5')||app;}

  function collectDues(source){
    const slides=[...source.querySelectorAll('.apoV2DueSlide')];
    return slides.filter(card=>!/^Todo al día$/i.test(text(card.querySelector('h1,.cpV5DueTitle')))).slice(0,3).map((card,index)=>({
      index,
      month:text(card.querySelector('.apoV2DateBox b'))||'—',
      day:text(card.querySelector('.apoV2DateBox span'))||'—',
      weekday:text(card.querySelector('.apoV2DateBox small'))||'',
      title:text(card.querySelector('.apoV2DueMain h1'))||'Cuota pendiente',
      meta:text(card.querySelector('.apoV2DueMeta'))||'Fecha por confirmar',
      amount:text(card.querySelector('.apoV2DueMain>strong'))||'$0',
      pay:card.querySelector('.apoV2Pay'), detail:card.querySelector('.apoV2Detail')
    }));
  }

  function collectSummary(source){
    const cells=[...source.querySelectorAll('.apoV2Summary .quick-summary-item')];
    const defs=[
      ['Pendiente',icons.wallet,'purple'],['Pagadas',icons.check,'green'],['Próximas',icons.calendar,'orange'],['Total pagado',icons.chart,'blue']
    ];
    return defs.map((def,index)=>{
      const cell=cells[index];
      return {label:def[0],icon:def[1],tone:def[2],value:text(cell?.querySelector('b'))||'—',sub:text(cell?.querySelector('em'))||''};
    });
  }

  function collectNotice(source){
    const section=[...source.querySelectorAll('details.cpV5Section,section')].find(el=>/Avisos del curso/i.test(text(el.querySelector('.cpV5SecTitle,h2'))));
    if(!section)return null;
    const item=section.querySelector('article,.apoV2Notice,.notice,.aviso,.card');
    if(!item)return null;
    return {title:text(item.querySelector('b,strong,h3,h4'))||'Aviso del curso',body:text(item.querySelector('p,.muted,small'))||'',action:item.querySelector('button,a')};
  }

  function button(label,kind,fn){const el=document.createElement('button');el.type='button';el.className='mxApoDesktopButton '+kind;el.textContent=label;el.addEventListener('click',fn);return el;}

  function build(source){
    const dues=collectDues(source), metrics=collectSummary(source), notice=collectNotice(source);
    const shell=document.createElement('section');
    shell.id='mxApoderadoDesktopHome'; shell.className='mxApoDesktopHome';
    shell.innerHTML=`
      <div class="mxApoPageHead"><div><span class="mxApoEyebrow">Panel del apoderado</span><h1>Resumen de tu curso</h1><p>Revisa tus próximas cuotas, pagos y novedades del curso.</p></div><button class="mxApoAllPayments" type="button">Ver todos los pagos</button></div>
      <section class="mxApoSection mxApoDuesSection"><div class="mxApoSectionHead"><div><h2>Próximas cuotas</h2><p>${dues.length?`${dues.length} cuota${dues.length===1?'':'s'} pendiente${dues.length===1?'':'s'}`:'No tienes cuotas pendientes'}</p></div></div><div class="mxApoDuesGrid" style="--mx-due-count:${Math.max(1,dues.length)}"></div></section>
      <section class="mxApoSummaryGrid"></section>
      <div class="mxApoLowerGrid"><section class="mxApoSection mxApoQuickSection"><div class="mxApoSectionHead"><div><h2>Accesos rápidos</h2><p>Todo lo que necesitas en un solo lugar.</p></div></div><div class="mxApoQuickGrid"></div></section><section class="mxApoSection mxApoNoticeSection"><div class="mxApoSectionHead"><div><h2>Avisos del curso</h2><p>Comunicaciones recientes de la directiva.</p></div><button class="mxApoTextButton" type="button">Ver todos</button></div><div class="mxApoNoticeBody"></div></section></div>`;
    shell.querySelector('.mxApoAllPayments').onclick=()=>window.go?.('payments');

    const grid=shell.querySelector('.mxApoDuesGrid');
    if(!dues.length)grid.innerHTML='<div class="mxApoEmpty"><strong>Todo al día</strong><span>No tienes pagos urgentes por ahora.</span></div>';
    dues.forEach((due,i)=>{
      const card=document.createElement('article'); card.className='mxApoDueCard';
      card.innerHTML=`<div class="mxApoDate"><b>${esc(due.month)}</b><strong>${esc(due.day)}</strong><span>${esc(due.weekday)}</span></div><div class="mxApoDueContent"><span class="mxApoDueCount">Cuota ${i+1} de ${dues.length}</span><h3>${esc(due.title)}</h3><p>${esc(due.meta)}</p><strong class="mxApoAmount">${esc(due.amount)}</strong><div class="mxApoDueActions"></div></div>`;
      const actions=card.querySelector('.mxApoDueActions');
      actions.append(button('Pagar ahora','primary',()=>due.pay?.click()||window.go?.('payments')));
      actions.append(button('Ver detalle','secondary',()=>due.detail?.click()||window.go?.('payments')));
      grid.append(card);
    });

    const summary=shell.querySelector('.mxApoSummaryGrid');
    metrics.forEach(m=>{const card=document.createElement('article');card.className='mxApoMetric';card.innerHTML=`<span class="mxApoMetricIcon ${m.tone}">${m.icon}</span><div><span>${esc(m.label)}</span><strong>${esc(m.value)}</strong><small>${esc(m.sub)}</small></div>`;summary.append(card);});

    const quick=[['Pagos','Revisa y paga tus cuotas pendientes',icons.card,()=>window.go?.('payments')],['Comprobantes','Descarga tus comprobantes de pago',icons.receipt,()=>window.go?.('payments')],['Informes','Consulta los informes publicados',icons.report,()=>window.go?.('informes')],['Mercado Escolar','Compra, vende o intercambia',icons.market,()=>location.href='/mercado-escolar/mercado-escolar.html']];
    const qgrid=shell.querySelector('.mxApoQuickGrid');
    quick.forEach((q,i)=>{const el=document.createElement('button');el.type='button';el.className='mxApoQuickCard';el.innerHTML=`<span class="mxApoQuickIcon">${q[2]}</span><span><b>${q[0]}</b><small>${q[1]}</small></span><i>›</i>${i===3?'<em>Nuevo</em>':''}`;el.onclick=q[3];qgrid.append(el);});

    const nbody=shell.querySelector('.mxApoNoticeBody');
    if(notice){nbody.innerHTML=`<div class="mxApoNoticeIcon">${icons.report}</div><div><h3>${esc(notice.title)}</h3><p>${esc(notice.body)}</p></div>`;if(notice.action)nbody.append(button('Ver aviso','secondary',()=>notice.action.click()));}
    else nbody.innerHTML='<div class="mxApoEmpty compact"><strong>Sin avisos nuevos</strong><span>Cuando la directiva publique algo, aparecerá aquí.</span></div>';
    shell.querySelector('.mxApoTextButton').onclick=()=>notice?.action?.click();
    return shell;
  }

  function cleanup(app){app?.classList.remove('mx-apo-desktop-home-active');document.body.classList.remove('mx-apo-home-view');app?.querySelector('#mxApoderadoDesktopHome')?.remove();lastSignature='';}
  function signature(source){return [text(source.querySelector('.apoV2DueCarousel')),text(source.querySelector('.apoV2SummaryCard')),text(source.querySelector('details.cpV5Section'))].join('|');}
  function mount(){
    if(rendering||!mq.matches||!document.body.classList.contains('cursapp-apoderado'))return;
    const app=document.getElementById('app'); if(!app)return;
    if(!isHome(app)){cleanup(app);return;}
    const source=sourceHome(app), sig=signature(source);
    if(app.querySelector('#mxApoderadoDesktopHome')&&sig===lastSignature)return;
    rendering=true;
    try{
      app.querySelector('#mxApoderadoDesktopHome')?.remove();
      app.prepend(build(source));
      app.classList.add('mx-apo-desktop-home-active');
      document.body.classList.add('mx-apo-home-view');
      lastSignature=sig;
      document.getElementById('menuBtn')?.classList.add('mxApoHideDesktop');
      document.getElementById('menuDropdown')?.classList.add('mxApoHideDesktop');
    }finally{
      rendering=false;
    }
  }
  function schedule(delay=500){
    clearTimeout(timer);
    timer=setTimeout(mount,delay);
  }
  function start(){
    if(!mq.matches)return;
    hydrationOpen=true;
    schedule(250);
    setTimeout(()=>schedule(0),1400);
    setTimeout(()=>schedule(0),3200);
    setTimeout(()=>{hydrationOpen=false;},4500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.addEventListener('cursapp:dataChanged',()=>{if(hydrationOpen)schedule(650);});
  mq.addEventListener?.('change',()=>{const app=document.getElementById('app');if(mq.matches)start();else cleanup(app);});
})();