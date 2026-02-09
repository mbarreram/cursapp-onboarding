
(function(){
  'use strict';

  const $ = (sel, root=document)=> root.querySelector(sel);
  const $$ = (sel, root=document)=> Array.from(root.querySelectorAll(sel));

  function safeJSON(v, def=null){
    try{ return JSON.parse(v); }catch(e){ return def; }
  }

  function getSession(){
    try{
      if(window.CURSAPP && typeof window.CURSAPP.getSession === 'function'){
        return window.CURSAPP.getSession() || null;
      }
    }catch(e){}
    return safeJSON(localStorage.getItem('cursapp_session_v1') || 'null', null);
  }

  function getProfiles(){
    return safeJSON(localStorage.getItem('cursapp_profiles_v1') || '[]', []);
  }

  function getActiveProfileId(){
    return localStorage.getItem('cursapp_active_profile_v1') || '';
  }

  function getActiveCourseKey(){
    return localStorage.getItem('cursapp_active_course_v1') || '';
  }

  function normalizeRole(r){
    r = String(r||'').toLowerCase().trim();
    if(r.includes('tesor')) return 'tesorero';
    if(r.includes('pres')) return 'presidente';
    if(r.includes('direct')) return 'presidente';
    if(r.includes('apod')) return 'apoderado';
    return r || 'apoderado';
  }

  function getCurrentRole(){
    const s = getSession() || {};
    // 1) session.role
    const r1 = normalizeRole(s.role || s.userRole || s.currentRole || '');
    if(['apoderado','presidente','tesorero'].includes(r1)) return r1;

    // 2) active profile
    const pid = getActiveProfileId();
    const profiles = getProfiles();
    if(pid){
      const p = profiles.find(x => String(x?.profileId||x?.id||'') === String(pid));
      const r2 = normalizeRole(p?.role || p?.user?.role || '');
      if(['apoderado','presidente','tesorero'].includes(r2)) return r2;
    }

    // 3) infer by page title as last resort
    const t = document.title.toLowerCase();
    if(t.includes('tesorero')) return 'tesorero';
    if(t.includes('presidente')) return 'presidente';
    if(t.includes('apoderado')) return 'apoderado';

    return 'apoderado';
  }

  function canSwitchToDirectiva(){
    // If helper exists, allow
    if(window.CURSAPP_SWITCH && typeof window.CURSAPP_SWITCH.toDirectiva === 'function') return true;

    // Otherwise, allow if user has presidente profile for active course
    const s = getSession() || {};
    const email = String(s.userId || s.email || '').trim().toLowerCase();
    if(!email) return false;

    const courseKey = getActiveCourseKey();
    const profiles = getProfiles();
    return profiles.some(p=>{
      const pEmail = String(p?.apoderado?.email || p?.user?.email || '').trim().toLowerCase();
      const pCourse = String(p?.courseKey || '').trim();
      const r = normalizeRole(p?.role || p?.user?.role || '');
      return pEmail && pEmail===email && r==='presidente' && (!courseKey || pCourse===courseKey);
    });
  }

  function goTab(tab){
    try{
      const btn = $(`.navItem[data-tab="${tab}"]`);
      if(btn){
        btn.click();
        closeMenu();
        return true;
      }
    }catch(e){}
    return false;
  }

  function openHelp(){
    try{
      if(typeof window.openHelp === 'function'){
        window.openHelp('general');
        closeMenu();
        return;
      }
    }catch(e){}
    // fallback modal
    showInfoModal('Ayuda', 'La ayuda aún no está disponible en esta pantalla.');
  }

  function openProfile(){
    // "Mi perfil" (sesión nueva): por ahora mostramos un modal con datos de sesión, sin tocar lógica existente.
    const s = getSession() || {};
    const email = String(s.userId || s.email || '—');
    const courseKey = String(s.courseKey || getActiveCourseKey() || '—');
    const role = getCurrentRole();

    const html = `
      <div class="card helpModalCard">
        <div class="helpModalHeader">
          <div>
            <div class="helpModalTitle">👤 Mi perfil</div>
            <div class="helpModalSub">Información de tu sesión</div>
          </div>
        </div>

        <div class="helpModalBody">
          <div class="helpQA">
            <div class="helpQ">Correo</div>
            <div class="helpA">${escapeHtml(email)}</div>
          </div>
          <div class="helpQA">
            <div class="helpQ">Rol activo</div>
            <div class="helpA">${escapeHtml(role)}</div>
          </div>
          <div class="helpQA">
            <div class="helpQ">Curso (key)</div>
            <div class="helpA">${escapeHtml(courseKey)}</div>
          </div>
          <div class="muted" style="margin-top:10px;font-weight:800;">
            Próximamente: cambiar datos, alumno/a, preferencias y notificaciones.
          </div>
        </div>

        <div class="helpModalFooter">
          <button class="btnx primary" type="button" onclick="closeModal()">Cerrar</button>
        </div>
      </div>
    `;
    if(typeof window.openModal === 'function'){
      window.openModal(html);
    }else{
      alert(`Perfil\n\nCorreo: ${email}\nRol: ${role}\nCurso: ${courseKey}`);
    }
    closeMenu();
  }

  function logout(){
    // Prefer existing logout button handler if present
    const b = $('#logoutBtn');
    if(b){
      b.click();
      return;
    }
    // fallback: clear session and go index
    try{ localStorage.removeItem('cursapp_session_v1'); }catch(e){}
    location.href = '/index.html';
  }

  function resetTotal(){
    if(window.CURSAPP && typeof window.CURSAPP.hardReset === 'function'){
      window.CURSAPP.hardReset();
      closeMenu();
      return;
    }
    // fallback: clear all (danger)
    if(confirm('Reset total (dev): borrará datos locales de esta demo. ¿Continuar?')){
      localStorage.clear();
      location.reload();
    }
  }

  function showInfoModal(title, text){
    const html = `
      <div class="card helpModalCard">
        <div class="helpModalHeader">
          <div>
            <div class="helpModalTitle">${escapeHtml(title)}</div>
            <div class="helpModalSub">Cursapp</div>
          </div>
        </div>
        <div class="helpModalBody">
          <div class="muted" style="font-weight:850;line-height:1.45;">${escapeHtml(text)}</div>
        </div>
        <div class="helpModalFooter">
          <button class="btnx primary" type="button" onclick="closeModal()">Cerrar</button>
        </div>
      </div>
    `;
    if(typeof window.openModal === 'function') window.openModal(html);
    else alert(`${title}\n\n${text}`);
  }

  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function menuButton(label, onClick, opts={}){
    const icon = opts.icon ? `${opts.icon} ` : '';
    const id = opts.id ? ` id="${opts.id}"` : '';
    return `<button class="btn ghost" type="button"${id} style="width:100%;text-align:left;" data-menu-action="${escapeHtml(onClick)}">${icon}${escapeHtml(label)}</button>`;
  }

  function renderMenu(role){
    const dd = $('#menuDropdown');
    if(!dd) return;

    role = normalizeRole(role);

    const items = [];

    if(role === 'apoderado'){
      if(canSwitchToDirectiva()){
        items.push(menuButton('Volver a directiva', 'toDirectiva', {icon:'🧑‍💼'}));
      }
      items.push(menuButton('Pagos', 'goPayments', {icon:'💳'}));
      items.push(menuButton('Informes', 'goInformes', {icon:'📄'}));
      items.push(menuButton('Ayuda', 'help', {icon:'❓'}));
      items.push(menuButton('Mi perfil', 'profile', {icon:'👤'}));
      items.push(menuButton('Reset total (dev)', 'resetTotal', {icon:'🧨'}));
      items.push(menuButton('Cerrar sesión', 'logout', {icon:'🚪'}));
    }

    if(role === 'presidente'){
      items.push(menuButton('Volver a apoderado', 'toApoderado', {icon:'👤'}));
      items.push(menuButton('Apoderados del curso', 'goApoderados', {icon:'👥'}));
      items.push(menuButton('Campañas', 'goCampanas', {icon:'📌'}));
      items.push(menuButton('Deudores', 'goDeudores', {icon:'🧾'}));
      items.push(menuButton('Informes', 'goInformes', {icon:'📄'}));
      items.push(menuButton('Mi perfil', 'profile', {icon:'👤'}));
      items.push(menuButton('Ayuda', 'help', {icon:'❓'}));
      items.push(menuButton('Reset total (dev)', 'resetTotal', {icon:'🧨'}));
      items.push(menuButton('Cerrar sesión', 'logout', {icon:'🚪'}));
    }

    if(role === 'tesorero'){
      items.push(menuButton('Volver a apoderado', 'toApoderado', {icon:'👤'}));
      items.push(menuButton('Rendiciones', 'goRendiciones', {icon:'🧾'}));
      items.push(menuButton('Informes', 'goInformes', {icon:'📊'}));
      items.push(menuButton('Mi perfil', 'profile', {icon:'👤'}));
      items.push(menuButton('Ayuda', 'help', {icon:'❓'}));
      items.push(menuButton('Reset total (dev)', 'resetTotal', {icon:'🧨'}));
      items.push(menuButton('Cerrar sesión', 'logout', {icon:'🚪'}));
    }

    dd.innerHTML = items.join('\n');

    // Bind clicks (single handler)
    dd.onclick = function(ev){
      const btn = ev.target.closest('[data-menu-action]');
      if(!btn) return;
      const a = btn.getAttribute('data-menu-action') || '';
      switch(a){
        case 'toDirectiva':
          if(window.CURSAPP_SWITCH && typeof window.CURSAPP_SWITCH.toDirectiva === 'function') window.CURSAPP_SWITCH.toDirectiva();
          else location.href = '/presidente.html';
          closeMenu();
          break;
        case 'toApoderado':
          if(window.CURSAPP_SWITCH && typeof window.CURSAPP_SWITCH.toApoderado === 'function') window.CURSAPP_SWITCH.toApoderado();
          else location.href = '/apoderado.html';
          closeMenu();
          break;
        case 'goApoderados':
          location.href = '/apoderados.html';
          closeMenu();
          break;
        case 'goCampanas':
          if(!goTab('campanas')) showInfoModal('Campañas', 'No pude cambiar de vista. Revisa que el tab "Campañas" exista en esta pantalla.');
          break;
        case 'goDeudores':
          if(!goTab('deudores')) showInfoModal('Deudores', 'No pude cambiar de vista. Revisa que el tab "Deudores" exista en esta pantalla.');
          break;
        case 'goPayments':
          if(!goTab('payments')) showInfoModal('Pagos', 'No pude cambiar de vista. Revisa que el tab "Pagos" exista en esta pantalla.');
          break;
        case 'goInformes':
          if(!goTab('informes')) showInfoModal('Informes', 'No pude cambiar de vista. Revisa que el tab "Informes" exista en esta pantalla.');
          break;
        case 'goRendiciones':
          if(!goTab('rendiciones')) showInfoModal('Rendiciones', 'No pude cambiar de vista. Revisa que el tab "Rendiciones" exista en esta pantalla.');
          break;
        case 'help':
          openHelp();
          break;
        case 'profile':
          openProfile();
          break;
        case 'resetTotal':
          resetTotal();
          break;
        case 'logout':
          logout();
          break;
      }
    };
  }

  function closeMenu(){
    const dd = $('#menuDropdown');
    if(dd) dd.style.display = 'none';
  }

  function initMenu(){
    const btn = $('#menuBtn');
    const dd = $('#menuDropdown');
    if(!btn || !dd) return;

    const role = getCurrentRole();
    renderMenu(role);

    btn.onclick = function(){
      dd.style.display = (dd.style.display === 'none' || !dd.style.display) ? 'block' : 'none';
    };

    // close on outside click
    document.addEventListener('click', function(ev){
      if(!dd) return;
      if(ev.target === btn || btn.contains(ev.target)) return;
      if(dd.contains(ev.target)) return;
      dd.style.display = 'none';
    });

    // expose rerender for role switches
    window.CURSAPP_MENU = window.CURSAPP_MENU || {};
    window.CURSAPP_MENU.render = function(){
      renderMenu(getCurrentRole());
    };
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initMenu);
  }else{
    initMenu();
  }
})();
