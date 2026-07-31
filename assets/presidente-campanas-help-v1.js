(() => {
  'use strict';
  const isDesktop = () => window.matchMedia('(min-width:1024px)').matches;

  function isCampaignsScreen(){
    const app = document.getElementById('app');
    return !!(app && app.querySelector('.listLines') && app.querySelector('.chips'));
  }

  function closeHelp(){
    document.querySelector('.presCampaignHelpOverlay')?.remove();
  }

  function openHelp(){
    if(!isDesktop() || document.querySelector('.presCampaignHelpOverlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'presCampaignHelpOverlay';
    overlay.innerHTML = `
      <section class="presCampaignHelpModal" role="dialog" aria-modal="true" aria-labelledby="presCampaignHelpTitle">
        <header>
          <div><small>Centro de ayuda</small><h2 id="presCampaignHelpTitle">Guía de campañas</h2></div>
          <button type="button" data-campaign-help-close aria-label="Cerrar">×</button>
        </header>
        <div class="presCampaignHelpSteps">
          <article><span>1</span><div><h3>Crear una campaña</h3><p>Presiona <b>Nueva campaña</b>, completa el nombre, descripción, monto, fechas y participación. Revisa la información antes de publicarla.</p></div></article>
          <article><span>2</span><div><h3>Usar una plantilla</h3><p>Selecciona <b>Usar plantilla</b> en una opción destacada para comenzar con una estructura ya preparada y completar solo los datos del curso.</p></div></article>
          <article><span>3</span><div><h3>Gestionar campañas activas</h3><p>Utiliza <b>Ver detalles</b> para revisar pagos y avance. Desde la misma card también puedes editar o eliminar según el estado de la campaña.</p></div></article>
        </div>
        <footer><button type="button" data-campaign-help-close>Entendido</button></footer>
      </section>`;
    document.body.appendChild(overlay);
  }

  function injectHelp(){
    if(!isDesktop() || !isCampaignsScreen()) return;
    const app = document.getElementById('app');
    if(!app || app.querySelector('.presCampaignHelp')) return;

    const help = document.createElement('section');
    help.className = 'presCampaignHelp';
    help.innerHTML = '<div class="presCampaignHelpIcon">?</div><div><small>¿Necesitas orientación?</small><h2>Ayuda para campañas</h2><p>Consulta cómo crear, usar plantillas y administrar campañas activas.</p></div><button type="button" data-campaign-help-open>Ver guía</button>';

    /* La ayuda queda como último bloque de la pantalla Campañas. */
    app.appendChild(help);
  }

  document.addEventListener('click', event => {
    if(event.target.closest('[data-campaign-help-open]')){
      event.preventDefault();
      event.stopPropagation();
      openHelp();
      return;
    }
    if(event.target.classList.contains('presCampaignHelpOverlay') || event.target.closest('[data-campaign-help-close]')){
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
      if(isCampaignsScreen() && !app.querySelector('.presCampaignHelp')) requestAnimationFrame(injectHelp);
    });
    observer.observe(app, {childList:true, subtree:false});
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
