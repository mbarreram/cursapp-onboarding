(() => {
  'use strict';
  const isDesktop = () => window.matchMedia('(min-width:1024px)').matches;
  const norm = v => String(v || '').replace(/\s+/g,' ').trim().toLowerCase();

  function configure(){
    if(!isDesktop()) return;
    const app = document.getElementById('app');
    if(!app) return;
    const title = Array.from(app.querySelectorAll('h1,h2,h3,h4,.kTitle,b,strong'))
      .find(n => norm(n.textContent).startsWith('rendiciones por campaña'));
    if(!title) return;

    const selects = Array.from(app.querySelectorAll('select'));
    const select = selects.find(sel => {
      const rect = sel.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      return rect.top >= titleRect.top && rect.top - titleRect.top < 260;
    }) || selects[0];
    if(!select) return;

    const meaningful = Array.from(select.options).filter(opt => {
      const value = String(opt.value || '').trim();
      const label = norm(opt.textContent);
      return value && !opt.disabled && label && !label.includes('ver todas') && !label.includes('selecciona') && !label.includes('seleccione');
    });

    if(meaningful.length === 0){
      let empty = Array.from(select.options).find(opt => opt.dataset.mxEmptyRend === 'true');
      if(!empty){
        empty = document.createElement('option');
        empty.dataset.mxEmptyRend = 'true';
        empty.value = '';
        select.insertBefore(empty, select.firstChild);
      }
      empty.textContent = 'Sin campañas disponibles';
      empty.selected = true;
      select.disabled = true;
      select.setAttribute('aria-label','Sin campañas disponibles');
    }else{
      Array.from(select.options).find(opt => opt.dataset.mxEmptyRend === 'true')?.remove();
      select.disabled = false;
    }
  }

  function start(){
    configure();
    const app = document.getElementById('app');
    if(!app) return;
    let scheduled = false;
    new MutationObserver(() => {
      if(scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => { scheduled = false; configure(); });
    }).observe(app,{childList:true,subtree:true});
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();