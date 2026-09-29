(function(){
  'use strict';
  const query=window.matchMedia('(min-width: 1024px)');
  const ICONS={
    inicio:'<svg viewBox="0 0 24 24"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>',
    pagos:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/><path d="M7 15h4"/></svg>',
    informes:'<svg viewBox="0 0 24 24"><path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/></svg>',
    retiros:'<svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" rx="1"/><path d="M8 12h8"/></svg>',
    avisos:'<svg viewBox="0 0 24 24"><path d="m3 11 18-5v12L3 13z"/><path d="M11 14v4a2 2 0 0 1-2 2H8l-2-6"/></svg>',
    apoderados:'<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.86"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    mercado:'<svg viewBox="0 0 24 24"><path d="M4 10h16l-1-5H5z"/><path d="M6 10v10h12V10"/><path d="M9 20v-6h6v6"/></svg>',
    campañas:'<svg viewBox="0 0 24 24"><path d="m3 11 18-5v12L3 13z"/><path d="M8 14v5"/></svg>',
    deudores:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    conciliar:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 6v12M8.5 9.5c1-1 2-1.5 3.5-1.5 2 0 3.2.9 3.2 2.2 0 3-6.4 1.3-6.4 4.2 0 1.4 1.4 2.4 3.4 2.4 1.4 0 2.7-.5 3.6-1.5"/></svg>',
    rendiciones:'<svg viewBox="0 0 24 24"><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v5h4"/><path d="M10 12h6M10 16h6"/></svg>',
    explorar:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
    publicar:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    'mis avisos':'<svg viewBox="0 0 24 24"><path d="M4 7h16v13H4z"/><path d="M8 7V4h8v3"/></svg>',
    micursox:'<svg viewBox="0 0 24 24"><path d="M4 12h15"/><path d="m13 6 6 6-6 6"/></svg>'
  };
  let sourceObserver=null;
  let documentObserver=null;

  function cleanLabel(el){
    const node=el.querySelector('.nav-label,.tesNavLabel,small')||el.querySelector('span:last-child');
    return String(node?.textContent||el.textContent||'').replace(/\s+/g,' ').trim();
  }
  function iconFor(label){
    const key=label.toLowerCase();
    return ICONS[key]||ICONS[Object.keys(ICONS).find(k=>key.includes(k))]||ICONS.inicio;
  }
  function hideSourceNavigations(){
    if(!query.matches)return;
    document.querySelectorAll('nav.bottomNav,nav.bottomBar,.apoderado-bottom-nav,.presBottomNav,.tesBottomNav,.bottomBarV7').forEach(nav=>{
      nav.classList.add('mxDesktopSourceNav');
      nav.setAttribute('aria-hidden','true');
    });
  }
  function stabilizeTransbank(){
    if(!query.matches || !document.body.classList.contains('cursapp-apoderado'))return;
    const nodes=[...document.querySelectorAll('img[alt*="Transbank" i],img[src*="transbank" i],[class*="transbank" i]')];
    nodes.forEach(node=>{
      const host=node.closest('div,section,aside,span')||node.parentElement;
      if(!host || host.classList.contains('mxTransbankStable'))return;
      if(host.querySelector(':scope > .mxTransbankStable')){
        if(node.tagName==='IMG')node.style.display='none';
        return;
      }
      if(node.tagName==='IMG')node.style.display='none';
      const badge=document.createElement('span');
      badge.className='mxTransbankStable';
      badge.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><span><strong>Pago seguro</strong><br>Débito y crédito</span>';
      host.appendChild(badge);
    });
  }
  function sync(shell,source){
    const originals=[...source.children].filter(el=>el.matches('button,a'));
    shell.querySelectorAll('[data-mx-index]').forEach(btn=>{
      const original=originals[Number(btn.dataset.mxIndex)];
      btn.classList.toggle('is-active',!!original?.classList.contains('active'));
    });
    const canonical=[...shell.querySelectorAll('[data-mx-president-label]')];
    if(canonical.length){
      let active='Inicio';
      if(location.pathname.includes('/apoderados')) active='Apoderados';
      else if(document.body.dataset.mxModule==='retiros-recaudado') active='Retiros';
      else{
        const selected=originals.find(x=>x.classList.contains('active'));
        const label=cleanLabel(selected||document.createElement('span'));
        if(/campañas/i.test(label)) active='Campañas';
        else if(/deudores/i.test(label)) active='Deudores';
        else if(/informes/i.test(label)) active='Informes';
      }
      canonical.forEach(btn=>btn.classList.toggle('is-active',btn.dataset.mxPresidentLabel===active));
    }
  }
  function removeDesktop(){
    document.body.classList.remove('mx-desktop-active');
    document.getElementById('mxDesktopShell')?.remove();
    document.querySelectorAll('.mxDesktopSourceNav').forEach(nav=>{
      nav.classList.remove('mxDesktopSourceNav');
      nav.removeAttribute('aria-hidden');
    });
    sourceObserver?.disconnect();sourceObserver=null;
    documentObserver?.disconnect();documentObserver=null;
  }
  function setPendingTab(tab){
    try{ sessionStorage.setItem('micursox_pending_tab',tab||'home'); }catch(_){}
  }
  function presidentRoute(label){
    const key=String(label||'').toLowerCase().trim();
    if(key==='apoderados'){ window.location.assign('/apoderados.html'); return true; }
    if(key==='crear avisos'){
      if(typeof window.openAvisosConfigSafe==='function'){ window.openAvisosConfigSafe(); return true; }
      setPendingTab('avisos'); window.location.assign('/presidente.html#avisos'); return true;
    }
    const map={inicio:'home','campañas':'campanas','deudores':'deudores','informes':'informes','retiros':'retiros'};
    const tab=map[key];
    if(!tab)return false;
    if(document.body.classList.contains('cursapp-presidente') && typeof window.__cursappPresidentGo==='function'){
      window.__cursappPresidentGo(tab); return true;
    }
    if(tab==='retiros' && document.body.classList.contains('cursapp-presidente') && window.MX_FUNDS?.open){
      window.MX_FUNDS.open(); return true;
    }
    setPendingTab(tab);
    window.location.assign('/presidente.html#'+tab);
    return true;
  }
  function canonicalPresidentItems(){
    return [
      ['Inicio','inicio'],['Campañas','campañas'],['Crear avisos','avisos'],
      ['Apoderados','apoderados'],['Deudores','deudores'],['Informes','informes'],['Retiros','retiros']
    ];
  }

  function build(){
    if(!query.matches){removeDesktop();return;}
    document.body.classList.add('mx-desktop-active');
    hideSourceNavigations();
    stabilizeTransbank();
    if(document.body.classList.contains('onboardingPremium'))return;
    if(document.getElementById('mxDesktopShell'))return;
    const source=document.querySelector('nav.bottomNav,nav.bottomBar');
    if(!source)return;
    const shell=document.createElement('aside');
    shell.id='mxDesktopShell';
    shell.className='mxDesktopShell';
    const profileRole=String(document.body.getAttribute('data-profile-role')||'').toLowerCase();
    const role=document.body.classList.contains('market-v8')?'Mercado Escolar':
      document.body.classList.contains('cursapp-presidente')?'Presidente':
      document.body.classList.contains('cursapp-tesorero')?'Tesorero':
      document.body.classList.contains('cursapp-profile')?(profileRole==='presidente'?'Presidente':profileRole==='tesorero'?'Tesorero':'Apoderado'):
      'Apoderado';
    shell.innerHTML='<a class="mxDesktopBrand" href="/index.html"><img src="/assets/brand/micursox-compact.svg" alt="MiCursoX"></a><div class="mxDesktopRole">'+role+'</div><nav class="mxDesktopNav"></nav><div class="mxDesktopFoot">Gestión escolar simple y segura</div>';
    const target=shell.querySelector('.mxDesktopNav');
    if(role==='Presidente'){
      canonicalPresidentItems().forEach(([label,iconKey])=>{
        const button=document.createElement('button');
        button.type='button';
        button.className='mxDesktopNavItem';
        button.dataset.mxPresidentLabel=label;
        button.innerHTML='<span class="mxDesktopIcon">'+(ICONS[iconKey]||iconFor(label))+'</span><span>'+label+'</span>';
        button.addEventListener('click',event=>{
          event.preventDefault();
          event.stopPropagation();
          presidentRoute(label);
        });
        target.appendChild(button);
      });
    }else{
      [...source.children].filter(el=>el.matches('button,a')).forEach((original,index)=>{
        const label=cleanLabel(original);
        const button=document.createElement('button');
        button.type='button';button.dataset.mxIndex=String(index);button.className='mxDesktopNavItem';
        button.innerHTML='<span class="mxDesktopIcon">'+iconFor(label)+'</span><span>'+label+'</span>';
        button.addEventListener('click',()=>{
          if(original.tagName==='A'&&original.href){window.location.assign(original.href);return;}
          original.click();
          setTimeout(()=>sync(shell,source),40);
        });
        target.appendChild(button);
      });
    }
    document.body.appendChild(shell);
    source.classList.add('mxDesktopSourceNav');
    source.setAttribute('aria-hidden','true');
    sync(shell,source);
    sourceObserver=new MutationObserver(()=>sync(shell,source));
    sourceObserver.observe(source,{attributes:true,subtree:true,attributeFilter:['class']});
    let scheduled=false;
    documentObserver=new MutationObserver(()=>{
      hideSourceNavigations();
      if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;stabilizeTransbank();});}
    });
    documentObserver.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();
  window.addEventListener('load',()=>{hideSourceNavigations();stabilizeTransbank();setTimeout(()=>{hideSourceNavigations();stabilizeTransbank();},500);});
  query.addEventListener?.('change',build);
})();
