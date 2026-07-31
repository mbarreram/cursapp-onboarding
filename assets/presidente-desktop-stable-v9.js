(() => {
  'use strict';

  const isDesktop = () => window.matchMedia('(min-width:1024px)').matches;
  let activeHero = 0;
  let initAttempts = 0;
  let initTimer = null;

  const icons = {
    avisos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 13v-2Z"/><path d="M11 14v4a2 2 0 0 1-2 2H8l-2-6"/></svg>',
    apoderados: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.86"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
  };

  function addSidebarItem(label, icon, onClick, afterText){
    if(!isDesktop()) return false;
    const nav = document.querySelector('#mxDesktopShell .mxDesktopNav');
    if(!nav) return false;
    const items = Array.from(nav.querySelectorAll('.mxDesktopNavItem'));
    if(items.some(item => item.textContent.trim().toLowerCase() === label.toLowerCase())) return true;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mxDesktopNavItem presDesktopStableItem';
    button.innerHTML = `<span class="mxDesktopIcon">${icons[icon]}</span><span>${label}</span>`;
    button.addEventListener('click', onClick);

    const anchor = items.find(item => item.textContent.toLowerCase().includes(afterText.toLowerCase()));
    if(anchor?.nextSibling) nav.insertBefore(button, anchor.nextSibling);
    else nav.appendChild(button);
    return true;
  }

  function setupSidebar(){
    if(!isDesktop()) return;
    addSidebarItem('Crear avisos', 'avisos', () => {
      if(typeof window.openAvisosConfigSafe === 'function') window.openAvisosConfigSafe();
      else if(typeof window.go === 'function') window.go('avisos');
    }, 'Campañas');
    addSidebarItem('Apoderados', 'apoderados', () => {
      window.location.href = 'apoderados.html';
    }, 'Crear avisos');
  }

  function heroElements(){
    const hero = document.querySelector('.cursapp-presidente .presMockHero.is-campaign');
    const track = hero?.querySelector('.presHeroCarousel');
    const slides = track ? Array.from(track.querySelectorAll('.presHeroCampaign')) : [];
    return {hero, track, slides};
  }

  function updateHero(index){
    const {hero, track, slides} = heroElements();
    if(!hero || !track || slides.length < 2) return;
    activeHero = Math.max(0, Math.min(index, slides.length - 1));
    track.scrollTo({left: slides[activeHero].offsetLeft, behavior:'smooth'});
    hero.querySelectorAll('.presHeroDot').forEach((dot, i) => dot.classList.toggle('active', i === activeHero));
    const prev = hero.querySelector('[data-stable-hero="prev"]');
    const next = hero.querySelector('[data-stable-hero="next"]');
    if(prev) prev.disabled = activeHero === 0;
    if(next) next.disabled = activeHero === slides.length - 1;
  }

  function setupCarousel(){
    if(!isDesktop()) return false;
    const {hero, track, slides} = heroElements();
    if(!hero || !track || slides.length < 2) return false;

    if(!hero.querySelector('.presHeroStableNav')){
      const nav = document.createElement('div');
      nav.className = 'presHeroNav presHeroStableNav';
      nav.innerHTML = '<button type="button" data-stable-hero="prev" aria-label="Campaña anterior">‹</button><button type="button" data-stable-hero="next" aria-label="Campaña siguiente">›</button>';
      nav.addEventListener('click', event => {
        const button = event.target.closest('button');
        if(!button) return;
        event.preventDefault();
        event.stopPropagation();
        updateHero(activeHero + (button.dataset.stableHero === 'next' ? 1 : -1));
      });
      hero.appendChild(nav);
    }

    hero.querySelectorAll('.presHeroDot').forEach((dot, index) => {
      if(dot.dataset.stableBound) return;
      dot.dataset.stableBound = '1';
      dot.style.cursor = 'pointer';
      dot.addEventListener('click', () => updateHero(index));
    });

    if(!track.dataset.stableScrollBound){
      track.dataset.stableScrollBound = '1';
      let timer = 0;
      track.addEventListener('scroll', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const center = track.scrollLeft + track.clientWidth / 2;
          let closest = 0;
          let distance = Infinity;
          slides.forEach((slide, index) => {
            const current = Math.abs((slide.offsetLeft + slide.offsetWidth / 2) - center);
            if(current < distance){ distance = current; closest = index; }
          });
          activeHero = closest;
          hero.querySelectorAll('.presHeroDot').forEach((dot, i) => dot.classList.toggle('active', i === closest));
        }, 80);
      }, {passive:true});
    }

    activeHero = Math.min(activeHero, slides.length - 1);
    hero.querySelectorAll('.presHeroDot').forEach((dot, i) => dot.classList.toggle('active', i === activeHero));
    return true;
  }

  function closeHelp(){
    document.querySelector('.presHelpOverlay')?.remove();
  }

  function openHelp(){
    if(document.querySelector('.presHelpOverlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'presHelpOverlay';
    overlay.innerHTML = `
      <section class="presHelpModal" role="dialog" aria-modal="true" aria-labelledby="presHelpTitle">
        <header>
          <div><small>Centro de ayuda</small><h2 id="presHelpTitle">Guía para Presidente</h2></div>
          <button type="button" data-help-close aria-label="Cerrar">×</button>
        </header>
        <div class="presHelpSteps">
          <article><span>1</span><div><h3>Crear una campaña</h3><p>Selecciona <b>Crear campaña</b>, ingresa nombre, monto, fechas y participación. Revisa los datos y confirma la publicación.</p></div></article>
          <article><span>2</span><div><h3>Revisar deudores</h3><p>Ingresa a <b>Deudores</b>, selecciona la campaña y revisa las familias pendientes. Desde ahí podrás usar las opciones de contacto y exportación.</p></div></article>
          <article><span>3</span><div><h3>Gestionar apoderados</h3><p>En <b>Apoderados</b> puedes revisar integrantes registrados, solicitudes pendientes e invitaciones para nuevos miembros del curso.</p></div></article>
        </div>
        <footer><button type="button" data-help-close>Entendido</button></footer>
      </section>`;
    overlay.addEventListener('click', event => {
      if(event.target === overlay || event.target.closest('[data-help-close]')) closeHelp();
    });
    document.body.appendChild(overlay);
  }

  function setupHelp(){
    if(!isDesktop()) return false;
    const page = document.querySelector('.presMockPage');
    if(!page) return false;
    if(page.querySelector('.presRoleHelpCompact')) return true;

    page.querySelectorAll('.presRoleHelp').forEach(node => node.remove());
    const help = document.createElement('section');
    help.className = 'presRoleHelp presRoleHelpCompact';
    help.innerHTML = '<div class="presRoleHelpIcon">?</div><div><small>¿Necesitas orientación?</small><h2>Ayuda para Presidente</h2><p>Revisa el paso a paso para crear campañas, gestionar deudores y administrar apoderados.</p></div><button type="button">Ver guía</button>';
    help.querySelector('button').addEventListener('click', openHelp);
    const banner = page.querySelector('[data-monetization-slot="presidente"]');
    page.insertBefore(help, banner || null);
    return true;
  }

  function initialize(){
    if(!isDesktop()) return;
    setupSidebar();
    setupCarousel();
    setupHelp();
  }

  function startFiniteInitialization(){
    clearInterval(initTimer);
    initAttempts = 0;
    initialize();
    initTimer = setInterval(() => {
      initAttempts += 1;
      initialize();
      if(initAttempts >= 60) clearInterval(initTimer);
    }, 250);
  }

  document.addEventListener('click', event => {
    if(event.target.closest('#mxDesktopShell, .presBottomNav, .presMockQuick, .presMockSection header button')){
      setTimeout(initialize, 120);
      setTimeout(initialize, 500);
    }
  });
  document.addEventListener('keydown', event => {
    if(event.key === 'Escape') closeHelp();
  });
  window.addEventListener('resize', () => {
    if(isDesktop()) startFiniteInitialization();
    else closeHelp();
  });

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startFiniteInitialization, {once:true});
  else startFiniteInitialization();
})();
