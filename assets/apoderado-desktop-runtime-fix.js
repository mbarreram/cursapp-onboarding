(function(){
  'use strict';
  const desktop = window.matchMedia('(min-width:1024px)');
  if(!desktop.matches) return;

  // Reduce duplicate desktop rerenders caused by two dataChanged emissions
  // for the same localStorage write. Mobile is untouched because this file
  // exits below 1024px and is loaded only by apoderado.html.
  const originalDispatch = window.dispatchEvent.bind(window);
  let dataTimer = 0;
  let pendingDataEvent = null;
  window.dispatchEvent = function(event){
    if(event && event.type === 'cursapp:dataChanged'){
      pendingDataEvent = event;
      clearTimeout(dataTimer);
      dataTimer = window.setTimeout(function(){
        const next = pendingDataEvent;
        pendingDataEvent = null;
        if(next) originalDispatch(next);
      }, 220);
      return true;
    }
    return originalDispatch(event);
  };

  function removeLoading(){
    try{
      const overlay = document.getElementById('cursapp-loading-overlay');
      if(overlay){
        try{ clearInterval(overlay._t); }catch(_e){}
        overlay.remove();
      }
      document.body.classList.add('cursapp-ready');
    }catch(_e){}
  }

  // A payment return must never leave the app behind an endless loading layer.
  function recoverPaymentReturn(){
    const hash = String(location.hash || '');
    if(!/payments_(paid|success|cancel|failed)/i.test(hash)) return;
    removeLoading();
    try{
      const clean = location.pathname + location.search;
      history.replaceState(history.state, document.title, clean);
    }catch(_e){}
    window.setTimeout(function(){
      try{ originalDispatch(new CustomEvent('cursapp:apoderado-ready')); }catch(_e){}
      try{ originalDispatch(new CustomEvent('cursapp:dataChanged',{detail:{key:'payment-return'}})); }catch(_e){}
    }, 120);
  }

  function buildDesktopMenu(dropdown){
    if(dropdown.dataset.mxDesktopBuilt === '1') return;
    dropdown.dataset.mxDesktopBuilt = '1';
    dropdown.className = (dropdown.className || '') + ' mxDesktopSafeMenu';
    dropdown.innerHTML = [
      ['home','Inicio'],
      ['payments','Pagos'],
      ['informes','Informes']
    ].map(function(item){
      return '<button type="button" data-mx-menu-tab="'+item[0]+'"><span>'+item[1]+'</span><b>›</b></button>';
    }).join('') +
    '<a href="/mercado-escolar/mercado-escolar.html"><span>Mercado Escolar</span><b>›</b></a>' +
    '<button type="button" data-mx-profile><span>Mi perfil</span><b>›</b></button>';

    dropdown.querySelectorAll('[data-mx-menu-tab]').forEach(function(button){
      button.addEventListener('click',function(){
        const tab = button.dataset.mxMenuTab;
        const target = document.querySelector('.navItem[data-tab="'+tab+'"],.apoderado-bottom-nav-item[data-tab="'+tab+'"]');
        dropdown.style.display = 'none';
        if(target) target.click();
      });
    });
    dropdown.querySelector('[data-mx-profile]')?.addEventListener('click',function(){
      dropdown.style.display = 'none';
      const candidates = [
        '[data-action="profile"]','[data-open-profile]','#profileBtn','.profileBtn',
        'button[onclick*="profile"]','button[onclick*="perfil"]'
      ];
      for(const selector of candidates){
        const target = document.querySelector(selector);
        if(target){ target.click(); return; }
      }
      if(typeof window.openProfile === 'function') window.openProfile();
      else if(typeof window.openApoProfile === 'function') window.openApoProfile();
    });
  }

  function installMenu(){
    const button = document.getElementById('menuBtn');
    const dropdown = document.getElementById('menuDropdown');
    if(!button || !dropdown || button.dataset.mxDesktopMenu === '1') return;
    button.dataset.mxDesktopMenu = '1';
    buildDesktopMenu(dropdown);
    button.addEventListener('click',function(event){
      event.preventDefault();
      event.stopImmediatePropagation();
      const open = dropdown.style.display === 'block';
      dropdown.style.display = open ? 'none' : 'block';
      button.setAttribute('aria-expanded', String(!open));
    },true);
    document.addEventListener('click',function(event){
      if(!dropdown.contains(event.target) && event.target !== button){
        dropdown.style.display = 'none';
        button.setAttribute('aria-expanded','false');
      }
    });
  }

  document.addEventListener('DOMContentLoaded',function(){
    installMenu();
    recoverPaymentReturn();
    window.setTimeout(removeLoading, 6500);
  },{once:true});
  window.addEventListener('pageshow',function(){
    installMenu();
    recoverPaymentReturn();
    window.setTimeout(removeLoading, 4500);
  });
  window.addEventListener('load',function(){
    installMenu();
    window.setTimeout(removeLoading, 5200);
  });
})();
