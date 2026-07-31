(() => {
  'use strict';

  const isDesktop = () => window.matchMedia('(min-width:1024px)').matches;
  const configuredPages = new WeakSet();
  let activeHero = 0;

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
    if(!isDesktop()) return false;
    const avisos = addSidebarItem('Crear avisos', 'avisos', () => {
      if(typeof window.openAvisosConfigSafe === 'function') window.openAvisosConfigSafe();
      else if(typeof window.go === 'function') window.go('avisos');
    }, 'Campañas');
    const apoderados = addSidebarItem('Apoderados', 'apoderados', () => {
      window.location.href = 'apoderados.html';
    }, 'Crear avisos');
    return avisos && apoderados;
  }

  function heroElements(page){
    const hero = page?.querySelector('.presMockHero.is-campaign');
    const track = hero?.querySelector('.presHeroCarousel');
    const slides = track ? Array.from(track.querySelectorAll('.presHeroCampaign')) : [];
    return {hero, track, slides};
  }

  function paintHeroState(hero, slides, index){
    activeHero = Math.max(0, Math.min(index, slides.length - 1));
    hero.querySelectorAll('.presHeroDot').forEach((dot, i) => dot.classList.toggle('active', i === activeHero));
    const prev = hero.querySelector('[data-stable-hero="prev"]');
    const next = hero.querySelector('[data-stable-hero="next"]');
    if(prev) prev.disabled = activeHero === 0;
    if(next) next.disabled = activeHero === slides.length - 1;
  }

  function updateHero(page, index){
    const {hero, track, slides} = heroElements(page);
    if(!hero || !track || slides.length < 2) return;
    const target = Math.max(0, Math.min(index, slides.length - 1));
    paintHeroState(hero, slides, target);
    track.scrollTo({left: target * track.clientWidth, behavior:'smooth'});
  }

  function setupCarousel(page){
    if(!isDesktop()) return;
    const {hero, track, slides} = heroElements(page);
    if(!hero || !track || slides.length < 2 || hero.dataset.presCarouselReady === '1') return;

    hero.dataset.presCarouselReady = '1';
    activeHero = 0;

    const nav = document.createElement('div');
    nav.className = 'presHeroNav presHeroStableNav';
    nav.innerHTML = '<button type="button" data-stable-hero="prev" aria-label="Campaña anterior">‹</button><button type="button" data-stable-hero="next" aria-label="Campaña siguiente">›</button>';
    nav.addEventListener('click', event => {
      const button = event.target.closest('button');
      if(!button) return;
      event.preventDefault();
      event.stopPropagation();
      updateHero(page, activeHero + (button.dataset.stableHero === 'next' ? 1 : -1));
    });
    hero.appendChild(nav);

    hero.querySelectorAll('.presHeroDot').forEach((dot, index) => {
      dot.style.cursor = 'pointer';
      dot.setAttribute('role', 'button');
      dot.setAttribute('tabindex', '0');
      dot.addEventListener('click', () => updateHero(page, index));
      dot.addEventListener('keydown', event => {
        if(event.key === 'Enter' || event.key === ' '){
          event.preventDefault();
          updateHero(page, index);
        }
      });
    });

    let scrollTimer = 0;
    track.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        if(!track.clientWidth) return;
        const closest = Math.round(track.scrollLeft / track.clientWidth);
        paintHeroState(hero, slides, closest);
      }, 100);
    }, {passive:true});

    paintHeroState(hero, slides, 0);
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

  function setupHelp(page){
    if(!isDesktop() || !page || page.querySelector('.presRoleHelpCompact')) return;
    const help = document.createElement('section');
    help.className = 'presRoleHelp presRoleHelpCompact';
    help.innerHTML = '<div class="presRoleHelpIcon">?</div><div><small>¿Necesitas orientación?</small><h2>Ayuda para Presidente</h2><p>Revisa el paso a paso para crear campañas, gestionar deudores y administrar apoderados.</p></div><button type="button">Ver guía</button>';
    help.querySelector('button').addEventListener('click', openHelp);
    const banner = page.querySelector('[data-monetization-slot="presidente"]');
    page.insertBefore(help, banner || null);
  }

  function configurePage(page){
    if(!isDesktop() || !page || configuredPages.has(page)) return;
    configuredPages.add(page);
    setupCarousel(page);
    setupHelp(page);
  }

  function configureCurrentPage(){
    setupSidebar();
    const page = document.querySelector('#app > .presMockPage, #app .presMockPage');
    if(page) configurePage(page);
  }

  function start(){
    if(!isDesktop()) return;
    configureCurrentPage();

    const app = document.getElementById('app');
    if(app){
      const observer = new MutationObserver(() => {
        const page = app.querySelector('.presMockPage');
        if(page && !configuredPages.has(page)) requestAnimationFrame(() => configurePage(page));
      });
      observer.observe(app, {childList:true, subtree:false});
    }

    let sidebarAttempts = 0;
    const sidebarTimer = setInterval(() => {
      sidebarAttempts += 1;
      if(setupSidebar() || sidebarAttempts >= 20) clearInterval(sidebarTimer);
    }, 150);
  }

  document.addEventListener('keydown', event => {
    if(event.key === 'Escape') closeHelp();
  });

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
