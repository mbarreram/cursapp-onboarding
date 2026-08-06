(() => {
  'use strict';

  const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches;

  function normalize(text){
    return String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function findTitleNode(root, title){
    const wanted = normalize(title);
    return Array.from(root.querySelectorAll('h1,h2,h3,h4,.kTitle,[style*="font-weight:950"],[style*="font-weight:900"]'))
      .find(node => {
        const own = normalize(node.textContent);
        return own === wanted || (own.startsWith(wanted) && own.length <= wanted.length + 40);
      }) || null;
  }

  function findNearestCardFromTitle(root, title){
    const titleNode = findTitleNode(root, title);
    if(!titleNode) return null;
    let node = titleNode;
    while(node && node !== root){
      if(node.classList && node.classList.contains('card')) return node;
      node = node.parentElement;
    }
    return titleNode.parentElement;
  }

  function configureInformes(){
    if(!isDesktop()) return;
    const root = document.getElementById('informeRoot');
    if(!root) return;

    const trend = findNearestCardFromTitle(root, 'Evolución semanal');
    if(trend && !trend.classList.contains('mxInformeTrendCard')){
      trend.classList.add('mxInformeTrendCard', 'mxInformeSectionCard');
      trend.querySelectorAll('svg text').forEach(text => {
        text.style.setProperty('font-size', '11px', 'important');
        text.style.setProperty('font-weight', '650', 'important');
      });
      trend.querySelectorAll('svg circle').forEach(circle => {
        const current = Number(circle.getAttribute('r') || 0);
        if(current > 5) circle.setAttribute('r', '4');
      });
    }

    ['Recaudado por campañas activas', 'Informes mensuales publicados'].forEach(title => {
      const card = findNearestCardFromTitle(document.getElementById('app') || root, title);
      if(card) card.classList.add('mxInformeSectionCard');
    });
  }

  function start(){
    if(!isDesktop()) return;
    configureInformes();
    const app = document.getElementById('app');
    if(!app) return;
    const observer = new MutationObserver(() => requestAnimationFrame(configureInformes));
    observer.observe(app, { childList: true, subtree: true });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
