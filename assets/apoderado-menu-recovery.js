(function(){
  'use strict';
  if(window.__APODERADO_MENU_RECOVERY__) return;
  window.__APODERADO_MENU_RECOVERY__ = true;

  const esc = (value)=>String(value ?? '').replace(/[&<>"']/g, ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));

  function getRoleData(){
    let session = {};
    try{ session = JSON.parse(localStorage.getItem('cursapp_session_v1') || '{}') || {}; }catch(_e){}
    const roles = (Array.isArray(session.roles) ? session.roles : [])
      .concat([session.role, session.currentRole, session.activeRole])
      .filter(Boolean)
      .map(v=>String(v).trim().toLowerCase());
    return { hasTesorero: roles.includes('tesorero') };
  }

  function menuMarkup(){
    const title = document.getElementById('whoRoleTitle')?.textContent?.trim() || 'Apoderado';
    const course = (document.getElementById('whoCourseLine')?.innerText || 'Curso actual').replace(/\n/g,' · ').trim();
    const initial = title.charAt(0).toUpperCase() || 'A';
    const { hasTesorero } = getRoleData();
    const item = (icon,label,action,extra='') => `<button class="apoV42MenuItem ${extra}" type="button" data-action="${esc(action)}"><span>${icon}</span><b>${esc(label)}</b></button>`;
    const group = (name,items)=>`<div class="apoV42MenuGroup"><small>${esc(name)}</small>${items}</div>`;

    return `<div class="apoV42MenuHeader"><div class="apoV42MenuAvatar">${esc(initial)}</div><div><strong>${esc(title)}</strong><span>${esc(course)}</span></div></div>
      ${group('Principal',[
        item('🏠','Inicio','home'),
        item('💳','Pagos','payments'),
        item('📄','Informes','informes'),
        item('🛍️','Mercado Escolar','market','market')
      ].join(''))}
      ${group('Cuenta',[
        item('👤','Mi perfil','profile'),
        item('🔔','Notificaciones','avisos'),
        item('📄','Consentimientos','consentimientos')
      ].join(''))}
      ${group('Otros',[
        hasTesorero ? item('💰','Ir a tesorero','tesorero') : '',
        item('❓','Ayuda','ayuda'),
        item('📱','Instalar App','install'),
        item('🚪','Cerrar sesión','logout','danger')
      ].join(''))}`;
  }

  function closeMenu(menu){
    if(!menu) return;
    menu.style.display = 'none';
    menu.setAttribute('aria-hidden','true');
    document.body.classList.remove('apo-menu-open');
  }

  function runAction(action, menu){
    closeMenu(menu);
    if(['home','payments','informes','profile'].includes(action)){
      if(typeof window.go === 'function') window.go(action);
      return;
    }
    if(action === 'market'){ location.href='/mercado-escolar/mercado-escolar.html'; return; }
    if(action === 'tesorero'){ location.href='/tesorero.html'; return; }
    if(action === 'avisos'){
      if(typeof window.openAvisosInbox === 'function') window.openAvisosInbox();
      else if(window.CURSAPP_NOTIFICATIONS?.open) window.CURSAPP_NOTIFICATIONS.open();
      return;
    }
    if(action === 'consentimientos'){ alert('Consentimientos estará disponible próximamente.'); return; }
    if(action === 'ayuda'){
      if(typeof window.openHelp === 'function') window.openHelp('general');
      else alert('Ayuda MiCursoX');
      return;
    }
    if(action === 'install'){ alert('Para instalar MiCursoX, usa Compartir → Agregar a inicio.'); return; }
    if(action === 'logout'){ location.href='/index.html'; }
  }

  function install(){
    const oldBtn = document.getElementById('menuBtn');
    const menu = document.getElementById('menuDropdown');
    if(!oldBtn || !menu) return false;

    const btn = oldBtn.cloneNode(true);
    oldBtn.replaceWith(btn);
    btn.id = 'menuBtn';
    btn.type = 'button';
    btn.classList.add('apoV42MenuBtn');
    btn.innerHTML = '☰';
    btn.setAttribute('aria-label','Abrir menú');
    btn.setAttribute('aria-expanded','false');

    menu.className = 'apoV42Menu';
    menu.innerHTML = menuMarkup();
    menu.style.display = 'none';
    menu.setAttribute('aria-hidden','true');

    btn.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      const open = menu.style.display === 'block';
      if(open){
        closeMenu(menu);
        btn.setAttribute('aria-expanded','false');
      }else{
        menu.innerHTML = menuMarkup();
        menu.style.display = 'block';
        menu.setAttribute('aria-hidden','false');
        btn.setAttribute('aria-expanded','true');
        document.body.classList.add('apo-menu-open');
      }
    }, true);

    menu.addEventListener('click', function(ev){
      const item = ev.target.closest('.apoV42MenuItem');
      if(!item) return;
      ev.preventDefault();
      ev.stopPropagation();
      runAction(item.dataset.action || '', menu);
    }, true);

    document.addEventListener('click', function(ev){
      if(ev.target.closest('#menuBtn,#menuDropdown')) return;
      closeMenu(menu);
      btn.setAttribute('aria-expanded','false');
    });

    document.addEventListener('keydown', function(ev){
      if(ev.key !== 'Escape') return;
      closeMenu(menu);
      btn.setAttribute('aria-expanded','false');
    });

    return true;
  }

  function boot(){
    if(install()) return;
    let attempts = 0;
    const timer = setInterval(()=>{
      attempts += 1;
      if(install() || attempts >= 20) clearInterval(timer);
    },250);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
  window.addEventListener('cursapp:apoderado-ready',()=>setTimeout(boot,0));
})();
