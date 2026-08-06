(() => {
  'use strict';

  const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches;

  function normalize(text){
    return String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function findCardByTitle(root, title){
    const wanted = normalize(title);
    const candidates = Array.from(root.querySelectorAll('div,section,article'));
    const titleNode = candidates.find(node => normalize(node.textContent).startsWith(wanted));
    if(!titleNode) return null;
    return titleNode.closest('.card') || titleNode.parentElement;
  }

  function configureInformes(){
    if(!isDesktop()) return;
    const root = document.getElementById('informeRoot');
    if(!root) return;

    const trend = findCardByTitle(root, 'Evolución semanal');
    if(trend){
      trend.classList.add('mxInformeTrendCard', 'mxInformeSectionCard');
      trend.querySelectorAll('svg text').forEach(text => {
        text.style.setProperty('font-size', '11px', 'important');
        text.style.setProperty('font-weight', '650', 'important');
      });
      trend.querySelectorAll('svg circle').forEach(circle => {
        circle.setAttribute('r', '3.5');
      });
    }

    ['Recaudado por campañas activas', 'Informes mensuales publicados'].forEach(title => {
      const card = findCardByTitle(document.getElementById('app') || root, title);
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
