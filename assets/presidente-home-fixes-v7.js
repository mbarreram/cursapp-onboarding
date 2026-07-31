(() => {
  'use strict';

  const DESKTOP_QUERY = '(min-width:1024px)';
  const desktop = () => window.matchMedia(DESKTOP_QUERY).matches;
  let setupTimer = 0;
  let campaignPortal = null;

  function svgIcon(name){
    const icons = {
      avisos:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 13v-2Z"/><path d="M11 14v4a2 2 0 0 1-2 2H8l-2-6"/></svg>',
      apoderados:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.86"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
    };
    return icons[name] || '';
  }

  function activeHeroIndex(track){
    const slides = Array.from(track.querySelectorAll('.presHeroCampaign'));
    if(!slides.length) return 0;
    const center = track.scrollLeft + track.clientWidth / 2;
    let index = 0;
    let best = Infinity;
    slides.forEach((slide, i) => {
      const distance = Math.abs((slide.offsetLeft + slide.offsetWidth / 2) - center);
      if(distance < best){ best = distance; index = i; }
    });
    return index;
  }

  function updateHeroState(hero, track, index){
    const slides = Array.from(track.querySelectorAll('.presHeroCampaign'));
    const safe = Math.max(0, Math.min(index, slides.length - 1));
    track.dataset.activeIndex = String(safe);
    hero.querySelectorAll('.presHeroDot').forEach((dot, i) => dot.classList.toggle('active', i === safe));
    const prev = hero.querySelector('[data-pres-hero="prev"]');
    const next = hero.querySelector('[data-pres-hero="next"]');
    if(prev) prev.disabled = safe <= 0;
    if(next) next.disabled = safe >= slides.length - 1;
  }

  function goHero(hero, index){
    const track = hero.querySelector('.presHeroCarousel');
    const slides = track ? Array.from(track.querySelectorAll('.presHeroCampaign')) : [];
    if(!track || !slides.length) return;
    const safe = Math.max(0, Math.min(index, slides.length - 1));
    track.dataset.userNavigating = '1';
    track.scrollTo({left: slides[safe].offsetLeft, behavior:'smooth'});
    updateHeroState(hero, track, safe);
    window.setTimeout(() => { delete track.dataset.userNavigating; }, 500);
  }

  function setupCarousel(){
    if(!desktop()) return;
    const hero = document.querySelector('.cursapp-presidente .presMockHero.is-campaign');
    const track = hero?.querySelector('.presHeroCarousel');
    const slides = track ? Array.from(track.querySelectorAll('.presHeroCampaign')) : [];
    if(!hero || !track || slides.length < 2) return;

    if(!hero.querySelector('.presHeroNav')){
      const nav = document.createElement('div');
      nav.className = 'presHeroNav';
      nav.innerHTML = '<button type="button" data-pres-hero="prev" aria-label="Campaña anterior">‹</button><button type="button" data-pres-hero="next" aria-label="Campaña siguiente">›</button>';
      hero.appendChild(nav);
      nav.addEventListener('click', event => {
        const button = event.target.closest('button');
        if(!button) return;
        event.preventDefault();
        event.stopPropagation();
        const current = Number(track.dataset.activeIndex || activeHeroIndex(track));
        goHero(hero, current + (button.dataset.presHero === 'next' ? 1 : -1));
      });
    }

    hero.querySelectorAll('.presHeroDot').forEach((dot, index) => {
      if(dot.dataset.presBound) return;
      dot.dataset.presBound = '1';
      dot.setAttribute('role','button');
      dot.setAttribute('tabindex','0');
      dot.setAttribute('aria-label', `Ver campaña ${index + 1}`);
      const activate = () => goHero(hero, index);
      dot.addEventListener('click', activate);
      dot.addEventListener('keydown', event => {
        if(event.key === 'Enter' || event.key === ' '){ event.preventDefault(); activate(); }
      });
    });

    if(!track.dataset.presStableBound){
      track.dataset.presStableBound = '1';
      track.dataset.activeIndex = String(activeHeroIndex(track));
      let scrollTimer = 0;
      track.addEventListener('scroll', () => {
        window.clearTimeout(scrollTimer);
        scrollTimer = window.setTimeout(() => {
          if(!track.isConnected) return;
          updateHeroState(hero, track, activeHeroIndex(track));
        }, 90);
      }, {passive:true});
    }
    updateHeroState(hero, track, Number(track.dataset.activeIndex || activeHeroIndex(track)));
  }

  function removeOldHamburgerItems(){
    document.querySelectorAll('#menuDropdown .presInjectedMenuItem').forEach(item => item.remove());
  }

  function addDesktopSideItem(label, icon, action, afterLabel){
    if(!desktop()) return;
    const nav = document.querySelector('#mxDesktopShell .mxDesktopNav');
    if(!nav) return;
    const existing = Array.from(nav.querySelectorAll('.mxDesktopNavItem')).find(item => item.textContent.trim().toLowerCase() === label.toLowerCase());
    if(existing) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mxDesktopNavItem presDesktopExtraItem';
    button.dataset.presExtra = label.toLowerCase();
    button.innerHTML = `<span class="mxDesktopIcon">${svgIcon(icon)}</span><span>${label}</span>`;
    button.addEventListener('click', action);
    const anchor = Array.from(nav.querySelectorAll('.mxDesktopNavItem')).find(item => item.textContent.trim().toLowerCase().includes(afterLabel.toLowerCase()));
    if(anchor?.nextSibling) nav.insertBefore(button, anchor.nextSibling);
    else nav.appendChild(button);
  }

  function setupDesktopSidebar(){
    if(!desktop()) return;
    removeOldHamburgerItems();
    addDesktopSideItem('Crear avisos','avisos',() => {
      if(typeof window.openAvisosConfigSafe === 'function') window.openAvisosConfigSafe();
      else if(typeof window.go === 'function') window.go('avisos');
    },'Campañas');
    addDesktopSideItem('Apoderados','apoderados',() => { window.location.href = 'apoderados.html'; },'Crear avisos');
  }

  function closeCampaignPortal(){
    campaignPortal?.remove();
    campaignPortal = null;
  }

  function openCampaignPortal(trigger, card){
    closeCampaignPortal();
    const rect = trigger.getBoundingClientRect();
    const title = card.querySelector('h3')?.textContent?.trim() || 'Campaña';
    const portal = document.createElement('div');
    portal.className = 'presCampaignMenu presCampaignMenuPortal';
    portal.setAttribute('role','menu');
    portal.setAttribute('aria-label', `Opciones de ${title}`);
    portal.style.top = `${Math.min(window.innerHeight - 110, rect.bottom + 6)}px`;
    portal.style.left = `${Math.max(12, Math.min(window.innerWidth - 180, rect.right - 170))}px`;
    portal.innerHTML = '<button type="button" data-action="view">Ver campaña</button><button type="button" data-action="manage">Administrar campañas</button>';
    portal.addEventListener('click', event => {
      const action = event.target.closest('button')?.dataset.action;
      if(!action) return;
      event.preventDefault();
      event.stopPropagation();
      closeCampaignPortal();
      if(typeof window.go === 'function') window.go('campanas');
    });
    document.body.appendChild(portal);
    campaignPortal = portal;
  }

  function setupCampaignMenus(){
    if(!desktop()) return;
    document.querySelectorAll('.presMockCampaign').forEach(card => {
      const trigger = card.querySelector('.presMockCampaignTop>button');
      if(!trigger || trigger.dataset.presStableMenu) return;
      trigger.dataset.presStableMenu = '1';
      trigger.setAttribute('aria-haspopup','menu');
      trigger.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        if(campaignPortal?.dataset.owner === trigger.dataset.menuOwner){ closeCampaignPortal(); return; }
        trigger.dataset.menuOwner ||= `campaign-${Math.random().toString(36).slice(2)}`;
        openCampaignPortal(trigger, card);
        if(campaignPortal) campaignPortal.dataset.owner = trigger.dataset.menuOwner;
      });
    });
  }

  function helpModalMarkup(){
    return `<div class="presHelpOverlay" role="presentation">
      <section class="presHelpModal" role="dialog" aria-modal="true" aria-labelledby="presHelpTitle">
        <header><div><small>Centro de ayuda</small><h2 id="presHelpTitle">Guía para Presidente</h2></div><button type="button" data-help-close aria-label="Cerrar">×</button></header>
        <div class="presHelpSteps">
          <article><span>1</span><div><h3>Crear una campaña</h3><p>Ingresa a <b>Crear campaña</b>, define nombre, monto, fechas y participación. Revisa los datos y confirma para publicarla al curso.</p></div></article>
          <article><span>2</span><div><h3>Revisar deudores</h3><p>Abre <b>Deudores</b>, selecciona una campaña y revisa las familias pendientes. Desde ahí puedes usar las opciones de contacto y exportación disponibles.</p></div></article>
          <article><span>3</span><div><h3>Gestionar apoderados</h3><p>En <b>Apoderados</b> puedes revisar registrados, solicitudes pendientes, datos del curso e invitaciones para nuevos integrantes.</p></div></article>
        </div>
        <footer><button type="button" data-help-close>Entendido</button></footer>
      </section>
    </div>`;
  }

  function openPresidentHelp(){
    if(document.querySelector('.presHelpOverlay')) return;
    document.body.insertAdjacentHTML('beforeend', helpModalMarkup());
    const overlay = document.querySelector('.presHelpOverlay');
    const close = () => overlay?.remove();
    overlay.querySelectorAll('[data-help-close]').forEach(button => button.addEventListener('click', close));
    overlay.addEventListener('click', event => { if(event.target === overlay) close(); });
    const onKey = event => {
      if(event.key === 'Escape'){
        close();
        document.removeEventListener('keydown', onKey);
      }
    };
    document.addEventListener('keydown', onKey);
  }

  function setupHelp(){
    if(!desktop()) return;
    const page = document.querySelector('.presMockPage');
    if(!page) return;
    const old = page.querySelector('.presRoleHelp');
    if(old && !old.classList.contains('presRoleHelpCompact')) old.remove();
    if(page.querySelector('.presRoleHelpCompact')) return;
    const help = document.createElement('section');
    help.className = 'presRoleHelp presRoleHelpCompact';
    help.innerHTML = '<div class="presRoleHelpIcon">?</div><div><small>¿Necesitas orientación?</small><h2>Ayuda para Presidente</h2><p>Revisa el paso a paso para crear campañas, gestionar deudores y administrar apoderados.</p></div><button type="button">Ver guía</button>';
    help.querySelector('button').addEventListener('click', openPresidentHelp);
    const banner = page.querySelector('[data-monetization-slot="presidente"]');
    page.insertBefore(help, banner || null);
  }

  function setup(){
    if(!desktop()) return;
    setupCarousel();
    setupDesktopSidebar();
    setupCampaignMenus();
    setupHelp();
  }

  function scheduleSetup(){
    window.clearTimeout(setupTimer);
    setupTimer = window.setTimeout(setup, 80);
  }

  document.addEventListener('click', event => {
    if(campaignPortal && !event.target.closest('.presCampaignMenuPortal') && !event.target.closest('.presMockCampaignTop>button')) closeCampaignPortal();
  }, true);
  window.addEventListener('scroll', closeCampaignPortal, true);
  window.addEventListener('resize', () => {
    closeCampaignPortal();
    if(desktop()) scheduleSetup();
  });

  const start = () => {
    if(!desktop()) return;
    setup();
    const app = document.getElementById('app');
    if(app){
      const observer = new MutationObserver(scheduleSetup);
      observer.observe(app, {childList:true, subtree:false});
    }
    const shellWait = window.setInterval(() => {
      if(document.querySelector('#mxDesktopShell .mxDesktopNav')){
        window.clearInterval(shellWait);
        setupDesktopSidebar();
      }
    }, 100);
    window.setTimeout(() => window.clearInterval(shellWait), 5000);
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
