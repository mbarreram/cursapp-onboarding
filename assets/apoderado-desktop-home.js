(function(){
  'use strict';
  const mq=window.matchMedia('(min-width:1024px)');
  let observer=null;
  let rendering=false;

  const icon={
    card:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/></svg>',
    receipt:'<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
    report:'<svg viewBox="0 0 24 24"><path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
    market:'<svg viewBox="0 0 24 24"><path d="M4 10h16l-1-5H5z"/><path d="M6 10v10h12V10M9 20v-6h6v6"/></svg>',
    wallet:'<svg viewBox="0 0 24 24"><path d="M4 7h15a2 2 0 0 1 2 2v9H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12v3"/><path d="M16 12h5"/></svg>',
    check:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></svg>',
    calendar:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
    chart:'<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>'
  };

  const text=(el)=>String(el?.textContent||'').replace(/\s+/g,' ').trim();
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const first=(root,selectors)=>selectors.map(s=>root.querySelector(s)).find(Boolean)||null;

  function parseDate(meta){
    const raw=text(meta);
    const iso=raw.match(/(20\d{2})-(\d{2})-(\d{2})/);
    let d=null;
    if(iso)d=new Date(Number(iso[1]),Number(iso[2])-1,Number(iso[3]));
    if(!d){
      const short=raw.match(/(\d{1,2})\s+([a-záéíóúñ]{3,})\s+(20\d{2})/i);
      if(short){
        const months={ene:0,feb:1,mar:2,abr:3,may:4,jun:5,jul:6,ago:7,sep:8,oct:9,nov:10,dic:11};
        d=new Date(Number(short[3]),months[short[2].slice(0,3).toLowerCase()]??0,Number(short[1]));
      }
    }
    if(!d||isNaN(d.getTime()))return {month:'—',day:'—',weekday:'Fecha por confirmar',long:raw||'Fecha por confirmar'};
    return {
      month:d.toLocaleDateString('es-CL',{month:'short'}).replace('.','').toUpperCase(),
      day:String(d.getDate()).padStart(2,'0'),
      weekday:d.toLocaleDateString('es-CL',{weekday:'long'}),
      long:d.toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'})
    };
  }

  function collectDues(source){
    return [...source.querySelectorAll('.cpV5DueCard')].slice(0,3).map((card,index)=>{
      const title=text(card.querySelector('.cpV5DueTitle'))||'Cuota pendiente';
      const campaign=text(card.querySelector('.mxStripeCampaign'))||title;
      const meta=card.querySelector('.cpV5DueMeta');
      const amount=text(card.querySelector('.cpV5Amount'))||'$0';
      const pay=card.querySelector('.cpV5Pay');
      const detail=card.querySelector('.cpV5Detail');
      return {index,title,campaign:campaign.replace(/^Campaña:\s*/i,''),meta:text(meta),date:parseDate(meta),amount,pay,detail};
    });
  }

  function collectSummary(source){
    const labels=['Pendiente','Pagadas','Próximas','Total pagado'];
    const fallbacks=[
      ['#homePendingTotal','#homePendingCount'],
      ['.quick-summary-card'],
      ['.quick-summary-card'],
      ['.quick-summary-card']
    ];
    const items=[];
    const summary=first(source,['.apoV2SummaryCard','.quick-summary-card','.cpV5Summary','.summary-card']);
    labels.forEach((label,i)=>{
      let value='—',sub='';
      if(summary){
        const cells=[...summary.querySelectorAll(':scope > *, .summaryItem, .apoV2SummaryItem')].filter(el=>text(el).toLowerCase().includes(label.toLowerCase()));
        const cell=cells[0];
        if(cell){
          const lines=text(cell).split(' ');
          const match=text(cell).match(/\$[\d\.]+|\b\d+\b/);
          value=match?.[0]||'—';
          sub=text(cell).replace(label,'').replace(value,'').trim();
        }
      }
      if(i===0){value=text(source.querySelector('#homePendingTotal'))||value;sub=text(source.querySelector('#homePendingCount'))?text(source.querySelector('#homePendingCount'))+' pago(s) pendiente(s)':sub;}
      return items.push({label,value,sub,icon:[icon.wallet,icon.check,icon.calendar,icon.chart][i],tone:['purple','green','orange','blue'][i]});
    });
    return items;
  }

  function collectNotice(source){
    const details=[...source.querySelectorAll('details.cpV5Section')].find(d=>/Avisos del curso/i.test(text(d.querySelector('.cpV5SecTitle'))));
    const card=details?.querySelector('.card')||[...source.querySelectorAll('.card')].find(c=>/Avisos del curso/i.test(text(c)));
    if(!card)return null;
    const candidates=[...card.querySelectorAll('article,li,.notice,.aviso,.row,.item')];
    const item=candidates.find(x=>text(x).length>10)||card;
    const title=text(item.querySelector('b,strong,h3,h4'))||text(item).split(/\d{1,2}[-/]\d{1,2}/)[0].slice(0,80)||'Aviso del curso';
    const body=text(item.querySelector('p,.muted,small'))||text(item).replace(title,'').slice(0,140);
    const action=item.querySelector('button,a');
    return {title,body,action};
  }

  function actionButton(label,kind,handler){
    const b=document.createElement('button');
    b.type='button'; b.className='mxApoDesktopButton '+kind; b.textContent=label; b.addEventListener('click',handler); return b;
  }

  function build(source){
    const dues=collectDues(source);
    const summary=collectSummary(source);
    const notice=collectNotice(source);
    const shell=document.createElement('section');
    shell.id='mxApoderadoDesktopHome';
    shell.className='mxApoDesktopHome';
    shell.innerHTML=`
      <div class="mxApoPageHead">
        <div><span class="mxApoEyebrow">Panel del apoderado</span><h1>Resumen de tu curso</h1><p>Revisa tus próximas cuotas, pagos y novedades del curso.</p></div>
        <button type="button" class="mxApoAllPayments">Ver todos los pagos</button>
      </div>
      <section class="mxApoSection mxApoDuesSection">
        <div class="mxApoSectionHead"><div><h2>Próximas cuotas</h2><p>${dues.length?`${dues.length} cuota${dues.length===1?'':'s'} por revisar`:'No tienes cuotas pendientes'}</p></div></div>
        <div class="mxApoDuesGrid"></div>
      </section>
      <section class="mxApoSummaryGrid"></section>
      <div class="mxApoLowerGrid">
        <section class="mxApoSection mxApoQuickSection"><div class="mxApoSectionHead"><div><h2>Accesos rápidos</h2><p>Todo lo que necesitas en un solo lugar.</p></div></div><div class="mxApoQuickGrid"></div></section>
        <section class="mxApoSection mxApoNoticeSection"><div class="mxApoSectionHead"><div><h2>Avisos del curso</h2><p>Comunicaciones recientes de la directiva.</p></div><button type="button" class="mxApoTextButton">Ver todos</button></div><div class="mxApoNoticeBody"></div></section>
      </div>`;

    shell.querySelector('.mxApoAllPayments').addEventListener('click',()=>window.go?.('payments'));

    const duesGrid=shell.querySelector('.mxApoDuesGrid');
    if(!dues.length){
      duesGrid.innerHTML='<div class="mxApoEmpty"><strong>Todo al día</strong><span>No tienes pagos urgentes por ahora.</span></div>';
    } else dues.forEach((due,i)=>{
      const article=document.createElement('article'); article.className='mxApoDueCard';
      article.innerHTML=`<div class="mxApoDate"><b>${esc(due.date.month)}</b><strong>${esc(due.date.day)}</strong><span>${esc(due.date.weekday)}</span></div><div class="mxApoDueContent"><span class="mxApoDueCount">Cuota ${i+1} de ${dues.length}</span><h3>${esc(due.campaign)}</h3><p>${esc(due.meta||('Vence el '+due.date.long))}</p><strong class="mxApoAmount">${esc(due.amount)}</strong><div class="mxApoDueActions"></div></div>`;
      const actions=article.querySelector('.mxApoDueActions');
      if(i===0&&due.pay)actions.appendChild(actionButton('Pagar ahora','primary',()=>due.pay.click()));
      actions.appendChild(actionButton('Ver detalle','secondary',()=>due.detail?.click()||window.go?.('payments')));
      duesGrid.appendChild(article);
    });

    const summaryGrid=shell.querySelector('.mxApoSummaryGrid');
    summary.forEach(item=>{
      const card=document.createElement('article'); card.className='mxApoMetric';
      card.innerHTML=`<span class="mxApoMetricIcon ${item.tone}">${item.icon}</span><div><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong><small>${esc(item.sub)}</small></div>`;
      summaryGrid.appendChild(card);
    });

    const quickDefs=[
      ['Pagos','Revisa y paga tus cuotas pendientes',icon.card,()=>window.go?.('payments')],
      ['Comprobantes','Descarga tus comprobantes de pago',icon.receipt,()=>window.go?.('payments')],
      ['Informes','Consulta los informes publicados',icon.report,()=>window.go?.('informes')],
      ['Mercado Escolar','Compra, vende o intercambia',icon.market,()=>location.href='/mercado-escolar/mercado-escolar.html']
    ];
    const quickGrid=shell.querySelector('.mxApoQuickGrid');
    quickDefs.forEach((d,i)=>{
      const b=document.createElement('button'); b.type='button'; b.className='mxApoQuickCard';
      b.innerHTML=`<span class="mxApoQuickIcon">${d[2]}</span><span><b>${d[0]}</b><small>${d[1]}</small></span><i>›</i>${i===3?'<em>Nuevo</em>':''}`;
      b.addEventListener('click',d[3]); quickGrid.appendChild(b);
    });

    const noticeBody=shell.querySelector('.mxApoNoticeBody');
    if(notice){
      noticeBody.innerHTML=`<div class="mxApoNoticeIcon">${icon.report}</div><div><h3>${esc(notice.title)}</h3><p>${esc(notice.body)}</p></div>`;
      if(notice.action)noticeBody.appendChild(actionButton('Ver aviso','secondary',()=>notice.action.click()));
    } else noticeBody.innerHTML='<div class="mxApoEmpty compact"><strong>Sin avisos nuevos</strong><span>Cuando la directiva publique algo, aparecerá aquí.</span></div>';
    shell.querySelector('.mxApoTextButton').addEventListener('click',()=>notice?.action?.click());
    return shell;
  }

  function mount(){
    if(rendering||!mq.matches||!document.body.classList.contains('cursapp-apoderado'))return;
    const app=document.getElementById('app'); if(!app)return;
    const source=app.querySelector('.cpHomeV5,.apoderado-home,.apoV2Page')||app.firstElementChild;
    if(!source||source.id==='mxApoderadoDesktopHome')return;
    rendering=true;
    app.querySelector('#mxApoderadoDesktopHome')?.remove();
    source.classList.add('mxApoMobileSourceHiddenDesktop');
    app.prepend(build(source));
    document.getElementById('menuBtn')?.classList.add('mxApoHideDesktop');
    document.getElementById('menuDropdown')?.classList.add('mxApoHideDesktop');
    rendering=false;
  }

  function start(){
    if(!mq.matches)return;
    mount();
    observer?.disconnect();
    const app=document.getElementById('app');
    if(app)observer=new MutationObserver(()=>{if(!rendering&&!app.querySelector('#mxApoderadoDesktopHome'))requestAnimationFrame(mount);}),observer.observe(app,{childList:true,subtree:false});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
  window.addEventListener('load',()=>setTimeout(start,80));
  window.addEventListener('cursapp:dataChanged',()=>setTimeout(mount,120));
  mq.addEventListener?.('change',()=>{if(mq.matches)start();else{observer?.disconnect();document.querySelector('#mxApoderadoDesktopHome')?.remove();document.querySelector('.mxApoMobileSourceHiddenDesktop')?.classList.remove('mxApoMobileSourceHiddenDesktop');}});
})();