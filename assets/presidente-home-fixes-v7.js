(() => {
  'use strict';

  const desktop = () => window.matchMedia('(min-width:1024px)').matches;
  const app = () => document.getElementById('app');

  function scrollHeroTo(index){
    const track = document.querySelector('.cursapp-presidente .presHeroCarousel');
    const slides = track ? Array.from(track.querySelectorAll('.presHeroCampaign')) : [];
    if(!track || !slides.length) return;
    const target = Math.max(0, Math.min(index, slides.length - 1));
    track.scrollTo({ left: slides[target].offsetLeft, behavior:'smooth' });
    setTimeout(() => {
      document.querySelectorAll('.presHeroDot').forEach((dot, i) => dot.classList.toggle('active', i === target));
      const prev = document.querySelector('[data-pres-hero="prev"]');
      const next = document.querySelector('[data-pres-hero="next"]');
      if(prev) prev.disabled = target === 0;
      if(next) next.disabled = target === slides.length - 1;
      if(track) track.dataset.activeIndex = String(target);
    }, 260);
  }

  function enhanceCarousel(){
    if(!desktop()) return;
    const hero = document.querySelector('.cursapp-presidente .presMockHero.is-campaign');
    const track = hero && hero.querySelector('.presHeroCarousel');
    const slides = track ? Array.from(track.querySelectorAll('.presHeroCampaign')) : [];
    if(!hero || !track || slides.length < 2) return;

    let nav = hero.querySelector('.presHeroNav');
    if(!nav){
      nav = document.createElement('div');
      nav.className = 'presHeroNav';
      nav.innerHTML = '<button type="button" data-pres-hero="prev" aria-label="Campaña anterior">‹</button><button type="button" data-pres-hero="next" aria-label="Campaña siguiente">›</button>';
      hero.appendChild(nav);
      nav.querySelector('[data-pres-hero="prev"]').addEventListener('click', () => {
        const current = Number(track.dataset.activeIndex || 0);
        scrollHeroTo(current - 1);
      });
      nav.querySelector('[data-pres-hero="next"]').addEventListener('click', () => {
        const current = Number(track.dataset.activeIndex || 0);
        scrollHeroTo(current + 1);
      });
    }

    if(!track.dataset.v7Bound){
      track.dataset.v7Bound = '1';
      track.dataset.activeIndex = '0';
      let timer;
      track.addEventListener('scroll', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const center = track.scrollLeft + track.clientWidth / 2;
          let active = 0;
          let distance = Infinity;
          slides.forEach((slide, index) => {
            const current = Math.abs((slide.offsetLeft + slide.offsetWidth / 2) - center);
            if(current < distance){ distance = current; active = index; }
          });
          track.dataset.activeIndex = String(active);
          document.querySelectorAll('.presHeroDot').forEach((dot, i) => dot.classList.toggle('active', i === active));
          const prev = hero.querySelector('[data-pres-hero="prev"]');
          const next = hero.querySelector('[data-pres-hero="next"]');
          if(prev) prev.disabled = active === 0;
          if(next) next.disabled = active === slides.length - 1;
        }, 70);
      }, {passive:true});
    }
    scrollHeroTo(Number(track.dataset.activeIndex || 0));
  }

  function closeCampaignMenus(except){
    document.querySelectorAll('.presCampaignMenu').forEach(menu => {
      if(menu !== except) menu.remove();
    });
  }

  function enhanceCampaignMenus(){
    if(!desktop()) return;
    document.querySelectorAll('.presMockCampaign').forEach(card => {
      const trigger = card.querySelector('.presMockCampaignTop>button');
      if(!trigger || trigger.dataset.v7Bound) return;
      trigger.dataset.v7Bound = '1';
      trigger.setAttribute('aria-haspopup','menu');
      trigger.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        const open = card.querySelector('.presCampaignMenu');
        closeCampaignMenus(open);
        if(open){ open.remove(); return; }
        const title = (card.querySelector('h3')?.textContent || 'Campaña').trim();
        const menu = document.createElement('div');
        menu.className = 'presCampaignMenu';
        menu.setAttribute('role','menu');
        menu.innerHTML = '<button type="button" data-action="view">Ver campaña</button><button type="button" data-action="manage">Administrar campañas</button>';
        menu.querySelector('[data-action="view"]').addEventListener('click', () => {
          closeCampaignMenus();
          if(typeof window.go === 'function') window.go('campanas');
        });
        menu.querySelector('[data-action="manage"]').addEventListener('click', () => {
          closeCampaignMenus();
          if(typeof window.go === 'function') window.go('campanas');
        });
        menu.setAttribute('aria-label', `Opciones de ${title}`);
        card.appendChild(menu);
      });
    });
  }

  function menuItemExists(container, label){
    return Array.from(container.querySelectorAll('button,a')).some(el => (el.textContent || '').trim().toLowerCase().includes(label.toLowerCase()));
  }

  function addMenuItem(container, label, action){
    if(menuItemExists(container, label)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'caMenuItem presInjectedMenuItem';
    button.textContent = label;
    button.addEventListener('click', action);
    container.appendChild(button);
  }

  function enhancePresidentMenu(){
    const menu = document.getElementById('menuDropdown');
    if(!menu) return;
    addMenuItem(menu, 'Apoderados', () => { window.location.href = 'apoderados.html'; });
    addMenuItem(menu, 'Crear avisos', () => {
      if(typeof window.openAvisosConfigSafe === 'function') window.openAvisosConfigSafe();
      else if(typeof window.go === 'function') window.go('avisos');
    });
  }

  function addPresidentHelp(){
    if(!desktop()) return;
    const page = document.querySelector('.presMockPage');
    if(!page || page.querySelector('.presRoleHelp')) return;
    const help = document.createElement('section');
    help.className = 'presRoleHelp';
    help.innerHTML = `
      <h2>Ayuda para Presidente</h2>
      <div class="presRoleHelpGrid">
        <article><strong>Crear campaña</strong><p>Define el nombre, monto, fechas y participación para comenzar una nueva recaudación del curso.</p></article>
        <article><strong>Deudores</strong><p>Revisa quiénes tienen pagos pendientes y utiliza las opciones disponibles para gestionar el cobro.</p></article>
        <article><strong>Apoderados</strong><p>Consulta integrantes del curso, registros pendientes y la información necesaria para administrar la comunidad.</p></article>
      </div>`;
    const banner = page.querySelector('[data-monetization-slot="presidente"]');
    page.insertBefore(help, banner || null);
  }

  function enhance(){
    enhanceCarousel();
    enhanceCampaignMenus();
    enhancePresidentMenu();
    addPresidentHelp();
  }

  document.addEventListener('click', event => {
    if(!event.target.closest('.presCampaignMenu') && !event.target.closest('.presMockCampaignTop>button')) closeCampaignMenus();
  });

  const observer = new MutationObserver(() => requestAnimationFrame(enhance));
  const start = () => {
    enhance();
    if(app()) observer.observe(app(), {childList:true, subtree:true});
    const menu = document.getElementById('menuDropdown');
    if(menu) observer.observe(menu, {childList:true, subtree:true});
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  window.addEventListener('resize', enhance);
})();
