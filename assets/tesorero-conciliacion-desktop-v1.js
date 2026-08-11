(() => {
  'use strict';

  const isDesktop = () => window.matchMedia('(min-width:1024px)').matches;
  const norm = value => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();

  const ICONS = {
    selector: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/><path d="M8 14h3M13 14h3M8 17h3"/></svg>',
    apoderados: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.4-3.4 2.3-5.2 5.5-5.2s5.1 1.8 5.5 5.2"/><circle cx="17" cy="9" r="2.3"/><path d="M15.5 14.5c2.8-.5 4.7.9 5 3.6"/></svg>',
    pendientes: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5l3 1.8"/></svg>',
    recaudado: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6" width="16" height="12" rx="2.5"/><path d="M4 10h16M8 14h4"/></svg>',
    meta: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="13" r="7"/><circle cx="11" cy="13" r="3"/><path d="M14 10l6-6M16 4h4v4"/></svg>'
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
        Array.from(select.options).find(option => option.dataset.mxEmpty === 'true')?.remove();
        select.disabled = false;
      }
    });
  }

  function addIcon(container, key, className){
    if(!container) return null;
    let icon = container.querySelector(`:scope > .${className}`);
    if(!icon){
      icon = document.createElement('span');
      icon.className = className;
      container.prepend(icon);
    }
    icon.innerHTML = ICONS[key];
    return icon;
  }

  function modernizeSelector(root){
    const select = root.querySelector('select');
    if(!select) return;
    const wrap = select.parentElement;
    if(!wrap) return;
    wrap.classList.add('mxTesSelectorWrap');
    select.classList.add('mxTesCampaignSelect');

    Array.from(wrap.children).forEach(child => {
      if(child === select) return;
      if(child.classList?.contains('mxTesSelectorIcon')) return;
      if(child.classList?.contains('mxTesSelectorArrow')) return;
      child.classList.add('mxTesSelectorLegacyChild');
    });

    addIcon(wrap, 'selector', 'mxTesSelectorIcon');
    let arrow = wrap.querySelector(':scope > .mxTesSelectorArrow');
    if(!arrow){
      arrow = document.createElement('span');
      arrow.className = 'mxTesSelectorArrow';
      arrow.setAttribute('aria-hidden','true');
      arrow.textContent = '⌄';
      wrap.appendChild(arrow);
    }

    root.querySelectorAll('.tesCampaignSelectorIcon').forEach(node => node.classList.add('mxTesHideLegacyCampaignIcon'));
  }

  function modernizeMetrics(root){
    const items = [];
    [['Apoderados','apoderados'],['Pendientes','pendientes'],['Recaudado','recaudado'],['Meta total','meta']].forEach(([label,key]) => {
      const labelNode = Array.from(root.querySelectorAll('div,span,small,b,strong')).find(node => norm(node.textContent) === norm(label));
      const item = labelNode?.parentElement;
      if(!item || items.includes(item)) return;
      items.push(item);
      item.classList.add('mxTesMetricItem');
      addIcon(item,key,'mxTesMetricIcon');
      item.querySelectorAll('svg').forEach(svg => { if(!svg.closest('.mxTesMetricIcon')) svg.closest('span,div')?.classList.add('mxTesLegacyIcon'); });
    });
    if(items.length >= 3){
      const parent = items.map(item => item.parentElement).find(parent => parent && items.filter(item => item.parentElement === parent).length >= 3);
      parent?.classList.add('mxTesMetricGrid');
    }
  }

  function markEmptyState(root){
    const candidates = Array.from(root.querySelectorAll('p,span,small,b,strong,div'))
      .filter(node => norm(node.textContent).includes('no hay pagos en esta vista'))
      .sort((a,b) => a.children.length - b.children.length || a.textContent.length - b.textContent.length);
    const node = candidates[0];
    if(!node) return;
    closestBlock(node,root)?.classList.add('mxTesConciliacionCard','mxTesConciliacionListCard');
    node.classList.add('mxTesEmptyMessage');
  }

  function configure(){
    if(!isDesktop()) return;
    const app = document.getElementById('app');
    if(!app) return;
    const title = findByText(app,'Conciliación por campaña');
    if(!title){ document.body.classList.remove('mx-tes-conciliacion'); return; }

    document.body.classList.add('mx-tes-conciliacion');
    /* La cabecera queda 100% a cargo del componente base de Tesorero, igual que Inicio. */
    title.classList.add('mxTesConciliacionTitle');
    title.parentElement?.classList.add('mxTesConciliacionHeadingWrap');

    let root = title.parentElement;
    while(root && root.parentElement !== app && root.parentElement){
      root = root.parentElement;
      if(root.querySelector && findByText(root,'Resumen de la campaña')) break;
    }
    if(!root || root === document.body) root = app;
    root.classList.add('mxTesConciliacionRoot');

    let widthNode = root;
    while(widthNode && widthNode !== app){ widthNode.classList?.add('mxTesConciliacionWidthNode'); widthNode = widthNode.parentElement; }

    const campaignCard = closestBlock(title,root);
    if(campaignCard && campaignCard !== title.parentElement) campaignCard.classList.add('mxTesConciliacionCard','mxTesConciliacionCampaignCard');

    const pending = findByText(root,'Pendientes');
    const reconciled = findByText(root,'Conciliados');
    const tabsParent = pending && reconciled && pending.parentElement === reconciled.parentElement ? pending.parentElement : pending?.parentElement;
    tabsParent?.classList.add('mxTesConciliacionTabs');

    const summaryTitle = findByText(root,'Resumen de la campaña');
    closestBlock(summaryTitle,root)?.classList.add('mxTesConciliacionCard','mxTesConciliacionSummaryCard');

    ensureEmptySelectText(root);
    modernizeSelector(root);
    modernizeMetrics(root);
    markEmptyState(root);
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