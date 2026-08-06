(() => {
  'use strict';

  const isDesktop = () => window.matchMedia('(min-width:1024px)').matches;
  const norm = value => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();

  function closestBlock(node, root){
    let current = node;
    while(current && current !== root){
      if(current.classList?.contains('card')) return current;
      current = current.parentElement;
    }
    return node?.parentElement || null;
  }

  function findByText(root, text){
    const wanted = norm(text);
    return Array.from(root.querySelectorAll('h1,h2,h3,h4,.kTitle,b,strong,button'))
      .find(node => norm(node.textContent).startsWith(wanted)) || null;
  }

  function ensureEmptySelectText(root){
    root.querySelectorAll('select').forEach(select => {
      const meaningful = Array.from(select.options).filter(option => {
        const value = String(option.value || '').trim();
        const label = norm(option.textContent);
        return value && !option.disabled && label && !label.includes('selecciona') && !label.includes('seleccione');
      });

      if(meaningful.length === 0){
        let emptyOption = Array.from(select.options).find(option => option.dataset.mxEmpty === 'true');
        if(!emptyOption){
          emptyOption = document.createElement('option');
          emptyOption.dataset.mxEmpty = 'true';
          emptyOption.value = '';
          emptyOption.disabled = true;
          select.insertBefore(emptyOption, select.firstChild);
        }
        emptyOption.textContent = 'Sin datos disponibles';
        emptyOption.selected = true;
        select.disabled = true;
        select.setAttribute('aria-label', 'Sin datos disponibles');
      }else{
        const emptyOption = Array.from(select.options).find(option => option.dataset.mxEmpty === 'true');
        emptyOption?.remove();
        select.disabled = false;
      }
    });
  }

  function configure(){
    if(!isDesktop()) return;
    const app = document.getElementById('app');
    if(!app) return;

    const title = findByText(app, 'Conciliación por campaña');
    if(!title){
      document.body.classList.remove('mx-tes-conciliacion');
      return;
    }

    document.body.classList.add('mx-tes-conciliacion');
    title.classList.add('mxTesConciliacionTitle');
    title.parentElement?.classList.add('mxTesConciliacionHeadingWrap');

    let root = title.parentElement;
    while(root && root.parentElement !== app && root.parentElement){
      root = root.parentElement;
      if(root.querySelector && findByText(root, 'Resumen de la campaña')) break;
    }
    if(!root || root === document.body) root = app;
    root.classList.add('mxTesConciliacionRoot');

    const campaignCard = closestBlock(title, root);
    if(campaignCard && campaignCard !== title.parentElement){
      campaignCard.classList.add('mxTesConciliacionCard','mxTesConciliacionCampaignCard');
    }

    const pending = findByText(root, 'Pendientes');
    const reconciled = findByText(root, 'Conciliados');
    const tabsParent = pending && reconciled && pending.parentElement === reconciled.parentElement
      ? pending.parentElement
      : pending?.parentElement;
    tabsParent?.classList.add('mxTesConciliacionTabs');

    const emptyMessage = Array.from(root.querySelectorAll('div,p,section'))
      .find(node => norm(node.textContent).includes('no hay pagos en esta vista'));
    closestBlock(emptyMessage, root)?.classList.add('mxTesConciliacionCard','mxTesConciliacionListCard');

    const summaryTitle = findByText(root, 'Resumen de la campaña');
    closestBlock(summaryTitle, root)?.classList.add('mxTesConciliacionCard','mxTesConciliacionSummaryCard');

    ensureEmptySelectText(root);
  }

  function start(){
    configure();
    const app = document.getElementById('app');
    if(!app) return;
    new MutationObserver(() => requestAnimationFrame(configure))
      .observe(app, {childList:true, subtree:true});
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();