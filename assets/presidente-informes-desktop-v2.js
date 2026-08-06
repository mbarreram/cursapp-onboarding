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

  function findRowForCard(card, root){
    if(!card) return null;
    let node = card.parentElement;
    while(node && node !== root){
      const children = Array.from(node.children || []);
      const cards = children.filter(child => child.classList?.contains('card'));
      const style = getComputedStyle(node);
      if(cards.length >= 2 || style.display === 'grid') return node;
      node = node.parentElement;
    }
    return card.parentElement;
  }

  function restoreMovedCards(root){
    const row = root.querySelector(':scope > .mxInformeAnalyticsRow');
    if(!row) return;
    const cards = Array.from(row.children);
    cards.forEach(card => row.parentElement.insertBefore(card, row));
    row.remove();
  }

  function configureInformes(){
    if(!isDesktop()) return;
    const root = document.getElementById('informeRoot');
    if(!root) return;

    restoreMovedCards(root);

    const cumplimiento = findNearestCardFromTitle(root, 'Cumplimiento del mes');
    const cuadratura = findNearestCardFromTitle(root, 'Cuadratura del periodo');
    const resumenRow = findRowForCard(cumplimiento || cuadratura, root);
    if(resumenRow) resumenRow.classList.add('mxInformeSummaryRow');

    const campanas = findNearestCardFromTitle(root, 'Recaudado por campañas activas');
    const trend = findNearestCardFromTitle(root, 'Evolución semanal');

    if(campanas) campanas.classList.add('mxInformeSectionCard');
    if(trend){
      trend.classList.add('mxInformeTrendCard', 'mxInformeSectionCard');
      trend.style.setProperty('margin-top', '24px', 'important');
      trend.querySelectorAll('svg text').forEach(text => {
        text.style.setProperty('font-size', '9px', 'important');
        text.style.setProperty('font-weight', '500', 'important');
      });
      trend.querySelectorAll('svg circle').forEach(circle => {
        const current = Number(circle.getAttribute('r') || 0);
        if(current > 5) circle.setAttribute('r', '4');
      });
    }

    const published = findNearestCardFromTitle(document.getElementById('app') || root, 'Informes mensuales publicados');
    if(published) published.classList.add('mxInformePublishedCard');
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
