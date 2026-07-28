(function(){
  'use strict';
  const desktop=window.matchMedia('(min-width: 1024px)');
  let observer=null;
  const svg={
    card:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/></svg>',
    receipt:'<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
    report:'<svg viewBox="0 0 24 24"><path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
    market:'<svg viewBox="0 0 24 24"><path d="M4 10h16l-1-5H5z"/><path d="M6 10v10h12V10M9 20v-6h6v6"/></svg>',
    user:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7"/></svg>'
  };
  function dateParts(meta){
    const text=String(meta||'');
    const m=text.match(/(\d{1,2})\s+([a-záéíóúñ]{3,})\s+(\d{4})/i);
    if(!m)return {day:'—',month:'',weekday:''};
    const months={ene:0,feb:1,mar:2,abr:3,may:4,jun:5,jul:6,ago:7,sep:8,oct:9,nov:10,dic:11};
    const key=m[2].slice(0,3).toLowerCase();
    const d=new Date(Number(m[3]),months[key]??0,Number(m[1]));
    const weekday=isNaN(d.getTime())?'':d.toLocaleDateString('es-CL',{weekday:'long'});
    return {day:m[1].padStart(2,'0'),month:key.toUpperCase(),weekday:weekday?weekday.charAt(0).toUpperCase()+weekday.slice(1):''};
  }
  function enhanceDues(root){
    const section=root.querySelector('.cpV5Next');
    if(!section||section.dataset.mxDesktopReady==='1')return;
    section.dataset.mxDesktopReady='1';
    section.classList.add('mxStripeDues');
    const head=section.querySelector('.cpV5NextHead');
    if(head){
      head.innerHTML='<div><div class="mxStripeSectionTitle">Próximas cuotas</div></div><button type="button" class="mxStripeViewAll">Ver todas</button>';
      head.querySelector('button')?.addEventListener('click',()=>window.go?.('payments'));
    }
    const cards=[...section.querySelectorAll('.cpV5DueCard')];
    cards.forEach((card,index)=>{
      if(index>2){card.hidden=true;return;}
      card.classList.add('mxStripeDueCard');
      const oldTitle=card.querySelector('.cpV5DueTitle')?.textContent?.trim()||'Pago';
      const indexEl=card.querySelector('.cpV5DueIndex');
      const total=Math.min(cards.length,3);
      if(indexEl)indexEl.textContent=`Cuota ${index+1} de ${total}`;
      const title=card.querySelector('.cpV5DueTitle');
      if(title){
        title.textContent=`Cuota ${index+1} de ${total}`;
        const campaign=document.createElement('div');
        campaign.className='mxStripeCampaign';
        campaign.textContent=`Campaña: ${oldTitle}`;
        title.insertAdjacentElement('afterend',campaign);
      }
      const meta=card.querySelector('.cpV5DueMeta');
      const parts=dateParts(meta?.textContent);
      const box=document.createElement('div');
      box.className='mxStripeDateBox';
      box.innerHTML=`<b>${parts.month}</b><strong>${parts.day}</strong><span>${parts.weekday}</span>`;
      card.prepend(box);
      if(index>0)card.querySelector('.cpV5Pay')?.remove();
      const detail=card.querySelector('.cpV5Detail');
      if(detail)detail.textContent='Ver detalle';
    });
    section.querySelector('.cpV5Dots')?.remove();
  }
  function enhanceQuick(root){
    const grid=root.querySelector('.cpV5QuickGrid');
    if(!grid||grid.dataset.mxDesktopReady==='1')return;
    grid.dataset.mxDesktopReady='1';
    const defs=[
      ['Pagos','Revisa y paga tus cuotas pendientes','card',()=>window.go?.('payments')],
      ['Comprobantes','Descarga tus comprobantes de pago','receipt',()=>window.go?.('payments')],
      ['Informes','Revisa los informes publicados del curso','report',()=>window.go?.('informes')],
      ['Mercado Escolar','Encuentra productos y servicios del curso','market',()=>{window.location.href='/mercado-escolar/mercado-escolar.html';}]
    ];
    [...grid.children].slice(0,4).forEach((button,index)=>{
      const d=defs[index]; if(!d)return;
      button.className='mxStripeQuickCard';
      button.removeAttribute('onclick');
      button.innerHTML=`<span class="mxStripeQuickIcon">${svg[d[2]]}</span><span class="mxStripeQuickCopy"><b>${d[0]}</b><small>${d[1]}</small></span><span class="mxStripeArrow">›</span>${index===3?'<em>Nuevo</em>':''}`;
      button.addEventListener('click',d[3]);
    });
    const title=root.querySelector('.cpV5QuickTitle');
    if(title)title.textContent='Accesos rápidos';
  }
  function enhanceHeader(){
    const menu=document.getElementById('menuBtn');
    if(menu&&menu.dataset.mxDesktopReady!=='1'){
      menu.dataset.mxDesktopReady='1';
      menu.innerHTML=svg.user;
      menu.setAttribute('aria-label','Abrir perfil y cuenta');
      menu.classList.add('mxDesktopProfileButton');
    }
  }
  function enhanceNotices(root){
    [...root.querySelectorAll('details.cpV5Section')].forEach(details=>{
      const title=details.querySelector('.cpV5SecTitle')?.textContent||'';
      if(!/Avisos del curso/i.test(title))return;
      details.open=true;
      details.classList.add('mxStripeNotices');
      const summary=details.querySelector('summary');
      if(summary&&!summary.querySelector('.mxStripeViewAll')){
        const b=document.createElement('button'); b.type='button'; b.className='mxStripeViewAll'; b.textContent='Ver todos';
        b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();}); summary.appendChild(b);
      }
    });
  }
  function enhance(){
    if(!desktop.matches||!document.body.classList.contains('cursapp-apoderado'))return;
    const root=document.getElementById('app'); if(!root)return;
    enhanceHeader(); enhanceDues(root); enhanceQuick(root); enhanceNotices(root);
  }
  function start(){
    if(!desktop.matches)return;
    enhance();
    observer?.disconnect();
    observer=new MutationObserver(()=>requestAnimationFrame(enhance));
    const app=document.getElementById('app'); if(app)observer.observe(app,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
  window.addEventListener('load',start);
  desktop.addEventListener?.('change',()=>{if(desktop.matches)start();else observer?.disconnect();});
})();