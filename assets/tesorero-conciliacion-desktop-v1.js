(() => {
  'use strict';

  const isDesktop = () => window.matchMedia('(min-width:1024px)').matches;
  const norm = value => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();

  const ICONS = {
    selector: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/><path d="M4.8 4.8 7 7"/></svg>',
    apoderados: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M17 11a4 4 0 0 1 4 4v2"/><path d="M16 3.2a4 4 0 0 1 0 7.6"/></svg>',
    pendientes: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    recaudado: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6" width="16" height="12" rx="2"/><path d="M8 10h8M8 14h5"/></svg>',
    meta: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M15 9l5-5"/></svg>'
  };

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
        emptyOption.textContent = 'Sin campañas disponibles';
        emptyOption.selected = true;
        select.disabled = true;
        select.setAttribute('aria-label', 'Sin campañas disponibles');
      }else{
        const emptyOption = Array.from(select.options).find(option => option.dataset.mxEmpty === 'true');
        emptyOption?.remove();
        select.disabled = false;
      }
    });
  }

  function addModernIcon(container, key, className){
    if(!container || container.querySelector(`.${className}`)) return;
    const icon = document.createElement('span');
    icon.className = className;
    icon.innerHTML = ICONS[key];
    container.prepend(icon);
  }

  function modernizeIcons(root){
    const selector = root.querySelector('select');
    if(selector){
      const selectorWrap = selector.parentElement;
      selectorWrap?.classList.add('mxTesSelectorWrap');
      addModernIcon(selectorWrap, 'selector', 'mxTesSelectorIcon');
    }

    [
      ['Apoderados', 'apoderados'],
      ['Pendientes', 'pendientes'],
      ['Recaudado', 'recaudado'],
      ['Meta total', 'meta']
    ].forEach(([label, key]) => {
      const labelNode = Array.from(root.querySelectorAll('div,span,small,b,strong'))
        .find(node => norm(node.textContent) === norm(label));
      if(!labelNode) return;
      const item = labelNode.parentElement;
      if(!item) return;
      item.classList.add('mxTesMetricItem');
      addModernIcon(item, key, 'mxTesMetricIcon');
      item.querySelectorAll('svg').forEach(svg => {
        if(!svg.closest('.mxTesMetricIcon')) svg.classList.add('mxTesLegacyIcon');
      });
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

    let widthNode = root;
    while(widthNode && widthNode !== app){
      widthNode.classList?.add('mxTesConciliacionWidthNode');
      widthNode = widthNode.parentElement;
    }

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
    modernizeIcons(root);
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