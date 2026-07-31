(() => {
  'use strict';
  const isDesktop = () => window.matchMedia('(min-width:1024px)').matches;

  function isDebtScreen(){
    const app = document.getElementById('app');
    return !!(app && app.querySelector('.presDebtHero') && app.querySelector('#debtorQuery'));
  }

  function closeHelp(){
    document.querySelector('.presDebtHelpOverlay')?.remove();
  }

  function openHelp(){
    if(!isDesktop() || document.querySelector('.presDebtHelpOverlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'presDebtHelpOverlay';
    overlay.innerHTML = `
      <section class="presDebtHelpModal" role="dialog" aria-modal="true" aria-labelledby="presDebtHelpTitle">
        <header>
          <div><small>Centro de ayuda</small><h2 id="presDebtHelpTitle">Guía de cobranza</h2></div>
          <button type="button" data-debt-help-close aria-label="Cerrar">×</button>
        </header>
        <div class="presDebtHelpSteps">
          <article><span>1</span><div><h3>Revisar el resumen</h3><p>Consulta los alumnos pendientes, la deuda obligatoria del mes y cuántas familias están al día.</p></div></article>
          <article><span>2</span><div><h3>Analizar por campaña</h3><p>El indicador muestra las campañas con mayor deuda pendiente para que priorices la cobranza.</p></div></article>
          <article><span>3</span><div><h3>Buscar una familia</h3><p>Escribe el nombre del alumno, apoderado o correo para revisar sus deudas y obtener el texto listo para WhatsApp.</p></div></article>
          <article><span>4</span><div><h3>Exportar información</h3><p>Usa PDF, Excel o WhatsApp para compartir el estado general del curso manteniendo los filtros actuales.</p></div></article>
        </div>
        <footer><button type="button" data-debt-help-close>Entendido</button></footer>
      </section>`;
    document.body.appendChild(overlay);
  }

  function injectHelp(){
    if(!isDesktop() || !isDebtScreen()) return;
    const app = document.getElementById('app');
    if(!app || app.querySelector('.presDebtHelp')) return;
    const help = document.createElement('section');
    help.className = 'presDebtHelp';
    help.innerHTML = '<div class="presDebtHelpIcon">?</div><div><small>¿Necesitas orientación?</small><h2>Ayuda para cobranza</h2><p>Revisa cómo analizar deudas, buscar familias y exportar información.</p></div><button type="button" data-debt-help-open>Ver guía</button>';
    app.appendChild(help);
  }

  document.addEventListener('click', event => {
    if(event.target.closest('[data-debt-help-open]')){
      event.preventDefault();
      event.stopPropagation();
      openHelp();
      return;
    }
    if(event.target.classList.contains('presDebtHelpOverlay') || event.target.closest('[data-debt-help-close]')){
      event.preventDefault();
      closeHelp();
    }
  }, true);

  document.addEventListener('keydown', event => {
    if(event.key === 'Escape') closeHelp();
  });

  function start(){
    if(!isDesktop()) return;
    injectHelp();
    const app = document.getElementById('app');
    if(!app) return;
    const observer = new MutationObserver(() => {
      if(isDebtScreen() && !app.querySelector('.presDebtHelp')) requestAnimationFrame(injectHelp);
    });
    observer.observe(app, {childList:true, subtree:false});
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
