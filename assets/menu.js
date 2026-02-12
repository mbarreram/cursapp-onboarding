/*
  Cursapp - menu.js
  Menú único para apoderado / tesorero / presidente.
  - No depende de otras funciones globales.
  - Lee roles desde localStorage (cursapp_roles_v1) y rol activo (cursapp_active_role_v1).
  - Mantiene compatibilidad con session (cursapp_session_v1) si existe.
*/
(function () {
  'use strict';

  // -------- keys (localStorage) --------
  var KEY_SESSION = 'cursapp_session_v1';
  var KEY_ROLES = 'cursapp_roles_v1';
  var KEY_ACTIVE_ROLE = 'cursapp_active_role_v1';
  // Opcional: bandera para forzar selector al entrar (debug)
  var KEY_FORCE_ROLE_PICKER = 'cursapp_force_role_picker_v1';

  // -------- small helpers --------
  function safeJsonParse(s, fallback) {
    try {
      return JSON.parse(s);
    } catch (e) {
      return fallback;
    }
  }

  function getSession() {
    return safeJsonParse(localStorage.getItem(KEY_SESSION) || 'null', null) || {};
  }

  function setSessionPatch(patch) {
    var s = getSession();
    for (var k in patch) s[k] = patch[k];
    localStorage.setItem(KEY_SESSION, JSON.stringify(s));
    return s;
  }

  function getRoles() {
    var roles = safeJsonParse(localStorage.getItem(KEY_ROLES) || 'null', null);
    if (Array.isArray(roles)) return roles;
    // compat: si no existe roles_v1, intenta derivar desde session
    var s = getSession();
    if (Array.isArray(s.roles)) return s.roles;
    return [];
  }

  function getActiveRole() {
    var r = localStorage.getItem(KEY_ACTIVE_ROLE);
    if (r) return r;
    var s = getSession();
    return s.role || 'apoderado';
  }

  function setActiveRole(role) {
    localStorage.setItem(KEY_ACTIVE_ROLE, role);
    // compat: mantener session.role sincronizado para pantallas antiguas
    setSessionPatch({ role: role });
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function on(el, ev, fn) {
    if (!el) return;
    el.addEventListener(ev, fn, { passive: false });
  }

  function isFunction(fn) {
    return typeof fn === 'function';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  // -------- menu UI --------
  function injectMenuStyleOnce() {
    if (document.getElementById('cursappMenuStyle')) return;
    var st = document.createElement('style');
    st.id = 'cursappMenuStyle';
    st.textContent = [
      '#menuDropdown{',
      '  position: fixed;',
      '  top: 64px; right: 16px;',
      '  z-index: 9999;',
      '  min-width: 280px;',
      '  max-width: calc(100vw - 24px);',
      '  background: transparent;',
      '}',
      '#menuDropdown .menuItemBtn{',
      '  width: 100%;',
      '  display:flex;',
      '  align-items:center;',
      '  gap:10px;',
      '  padding:14px 14px;',
      '  border-radius: 14px;',
      '  background: rgba(255,255,255,0.98);',
      '  border: 1px solid rgba(0,0,0,0.08);',
      '  box-shadow: 0 10px 26px rgba(0,0,0,0.10);',
      '  font-size: 16px;',
      '  margin: 10px 0;',
      '}',
      '#menuDropdown .menuItemBtn:active{ transform: scale(0.99); }',
      '#menuDropdown .menuItemIcon{ width: 22px; text-align:center; }',
      '#menuDropdown .menuSep{ height: 1px; background: rgba(0,0,0,0.08); margin: 10px 6px; border-radius: 1px; }'
    ].join('\n');
    document.head.appendChild(st);
  }

  function positionDropdown(menuBtn, dd) {
    if (!menuBtn || !dd) return;
    // Anclar al botón
    var r = menuBtn.getBoundingClientRect();
    var top = Math.max(10, Math.round(r.bottom + 10));
    var right = Math.max(10, Math.round(window.innerWidth - r.right));
    dd.style.top = top + 'px';
    dd.style.right = right + 'px';
  }

  function closeDropdown(dd) {
    if (!dd) return;
    dd.style.display = 'none';
    dd.setAttribute('aria-hidden', 'true');
  }

  function openDropdown(menuBtn, dd) {
    if (!dd) return;
    positionDropdown(menuBtn, dd);
    dd.style.display = 'block';
    dd.setAttribute('aria-hidden', 'false');
  }

  function toggleDropdown(menuBtn, dd) {
    if (!dd) return;
    var isOpen = dd.style.display !== 'none' && dd.style.display !== '';
    if (isOpen) closeDropdown(dd);
    else openDropdown(menuBtn, dd);
  }

  // -------- actions --------
  function go(href) {
    window.location.href = href;
  }

  function doLogout() {
    // Mantener datos del curso si existen, solo limpiar sesión/rol activo
    localStorage.removeItem(KEY_SESSION);
    localStorage.removeItem(KEY_ACTIVE_ROLE);
    // Si existe función logout global, úsala
    if (isFunction(window.logout)) {
      try {
        window.logout();
        return;
      } catch (e) {}
    }
    // fallback
    go('index.html');
  }

  function doResetTotalDev() {
    if (!confirm('¿Reset total? Esto borrará datos locales (demo).')) return;
    try {
      localStorage.clear();
    } catch (e) {}
    go('index.html');
  }

  function doResetCursoSoloDatos() {
    // Intenta usar resetCurso() si existe; si no, elimina llaves conocidas de datos
    if (isFunction(window.resetCursoSoloDatos)) {
      window.resetCursoSoloDatos();
      return;
    }
    if (isFunction(window.resetCurso)) {
      window.resetCurso();
      return;
    }
    var keys = [
      'cursapp_campaigns_v1',
      'cursapp_payments_v1',
      'cursapp_reports_v1',
      'cursapp_tasks_v1',
      'cursapp_debtors_v1'
    ];
    keys.forEach(function (k) {
      try { localStorage.removeItem(k); } catch (e) {}
    });
    alert('Datos del curso reseteados (local).');
    location.reload();
  }

  // -------- help handlers --------
  function openHelp(role) {
    // Si la pantalla tiene un modal de ayuda, úsalo
    if (isFunction(window.openHelpModal)) {
      window.openHelpModal(role);
      return;
    }
    // fallback: alert contextual
    if (role === 'presidente') {
      alert('Ayuda Presidente: revisa Campañas, Deudores e Informes.');
    } else if (role === 'tesorero') {
      alert('Ayuda Tesorero: revisa Rendiciones, Pagos e Informes.');
    } else {
      alert('Ayuda: revisa Pagos, campañas obligatorias/no obligatorias e Informes.');
    }
  }

  // -------- menu model --------
  function buildMenuItems(activeRole, roles) {
    var items = [];

    // Switches entre roles
    if (activeRole === 'apoderado') {
      if (roles.indexOf('presidente') >= 0) {
        items.push({ label: 'Volver a directiva', icon: '👨‍💼', onClick: function () { setActiveRole('presidente'); go('presidente.html'); } });
      }
      if (roles.indexOf('tesorero') >= 0) {
        items.push({ label: 'Ir a tesorero', icon: '💼', onClick: function () { setActiveRole('tesorero'); go('tesorero.html'); } });
      }
    }

    if (activeRole === 'presidente') {
      items.push({ label: 'Volver a apoderado', icon: '👤', onClick: function () { setActiveRole('apoderado'); go('apoderado.html'); } });
      items.push({ label: 'Apoderados del curso', icon: '👥', onClick: function () { go('presidente.html#apoderados'); } });
      items.push({ label: 'Campañas', icon: '📌', onClick: function () { go('presidente.html#campanas'); } });
      items.push({ label: 'Deudores', icon: '🧾', onClick: function () { go('presidente.html#deudores'); } });
      items.push({ label: 'Informes', icon: '📄', onClick: function () { go('presidente.html#informes'); } });
      items.push({ sep: true });
      items.push({ label: 'Mi perfil', icon: '👤', onClick: function () { go('presidente.html#perfil'); } });
      items.push({ label: 'Ayuda', icon: '❓', onClick: function () { openHelp('presidente'); } });
      items.push({ sep: true });
      items.push({ label: 'Reset total (dev)', icon: '🧨', onClick: doResetTotalDev });
      items.push({ label: 'Cerrar sesión', icon: '🚪', onClick: doLogout });
      return items;
    }

    if (activeRole === 'tesorero') {
      // Tesorero siempre es también apoderado
      items.push({ label: 'Ir a apoderado', icon: '🏠', onClick: function () { setActiveRole('apoderado'); go('apoderado.html'); } });
      items.push({ label: 'Rendiciones', icon: '🧾', onClick: function () { go('tesorero.html#rendiciones'); } });
      items.push({ label: 'Pagos', icon: '💳', onClick: function () { go('tesorero.html#pagos'); } });
      items.push({ label: 'Informes', icon: '📄', onClick: function () { go('tesorero.html#informes'); } });
      items.push({ sep: true });
      items.push({ label: 'Mi perfil', icon: '👤', onClick: function () { go('tesorero.html#perfil'); } });
      items.push({ label: 'Ayuda', icon: '❓', onClick: function () { openHelp('tesorero'); } });
      items.push({ sep: true });
      items.push({ label: 'Reset total (dev)', icon: '🧨', onClick: doResetTotalDev });
      items.push({ label: 'Cerrar sesión', icon: '🚪', onClick: doLogout });
      return items;
    }

    // Apoderado (por defecto)
    items.push({ label: 'Pagos', icon: '💳', onClick: function () { go('apoderado.html#pagos'); } });
    items.push({ label: 'Informes', icon: '📄', onClick: function () { go('apoderado.html#informes'); } });
    items.push({ label: 'Ayuda', icon: '❓', onClick: function () { openHelp('apoderado'); } });
    items.push({ label: 'Mi perfil', icon: '👤', onClick: function () { go('apoderado.html#perfil'); } });
    items.push({ sep: true });
    items.push({ label: 'Reset curso (solo datos)', icon: '🧹', onClick: doResetCursoSoloDatos });
    items.push({ label: 'Reset total (dev)', icon: '🧨', onClick: doResetTotalDev });
    items.push({ label: 'Cerrar sesión', icon: '🚪', onClick: doLogout });
    return items;
  }

  function renderMenu(dd, items) {
    dd.innerHTML = '';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.sep) {
        var sep = document.createElement('div');
        sep.className = 'menuSep';
        dd.appendChild(sep);
        continue;
      }
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'menuItemBtn';
      btn.innerHTML = '<span class="menuItemIcon">' + esc(it.icon || '') + '</span><span>' + esc(it.label || '') + '</span>';
      (function (fn) {
        on(btn, 'click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          closeDropdown(dd);
          try { fn(); } catch (err) { console.error(err); }
        });
      })(it.onClick || function () {});
      dd.appendChild(btn);
    }
  }

  // -------- role picker (optional) --------
  function shouldForceRolePicker(roles) {
    try {
      return localStorage.getItem(KEY_FORCE_ROLE_PICKER) === '1' && roles && roles.length > 1;
    } catch (e) {
      return false;
    }
  }

  function showRolePickerModal(roles) {
    // Modal simple, sin depender de CSS externo
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;';
    var card = document.createElement('div');
    card.style.cssText = 'width:100%;max-width:520px;background:#fff;border-radius:18px;box-shadow:0 18px 50px rgba(0,0,0,0.22);padding:18px;';
    card.innerHTML =
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">' +
      '  <div>' +
      '    <div style="font-size:22px;font-weight:800;">Elegir rol</div>' +
      '    <div style="margin-top:4px;color:#666;">Selecciona cómo ingresar</div>' +
      '  </div>' +
      '  <button id="cursappRolePickerClose" type="button" style="border:1px solid rgba(0,0,0,0.10);background:#fff;border-radius:14px;padding:10px 14px;font-weight:700;">Cerrar</button>' +
      '</div>' +
      '<div style="height:1px;background:rgba(0,0,0,0.08);margin:14px 0;"></div>';

    function addRoleBtn(role, title, subtitle, icon) {
      var b = document.createElement('button');
      b.type = 'button';
      b.style.cssText = 'width:100%;text-align:left;border:1px solid rgba(0,0,0,0.10);background:#fff;border-radius:16px;padding:14px;display:flex;gap:12px;align-items:flex-start;margin:12px 0;';
      b.innerHTML =
        '<div style="width:34px;height:34px;border-radius:12px;background:rgba(0,0,0,0.05);display:flex;align-items:center;justify-content:center;font-size:18px;">' + esc(icon) + '</div>' +
        '<div style="flex:1;">' +
        '  <div style="font-weight:800;font-size:18px;">' + esc(title) + '</div>' +
        '  <div style="margin-top:2px;color:#666;">' + esc(subtitle) + '</div>' +
        '</div>';
      on(b, 'click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        try { localStorage.removeItem(KEY_FORCE_ROLE_PICKER); } catch (err) {}
        setActiveRole(role);
        document.body.removeChild(overlay);
        if (role === 'presidente') go('presidente.html');
        else if (role === 'tesorero') go('tesorero.html');
        else go('apoderado.html');
      });
      card.appendChild(b);
    }

    // Orden sugerido
    if (roles.indexOf('apoderado') >= 0) addRoleBtn('apoderado', 'Apoderado', 'Aprobado automáticamente', '👥');
    if (roles.indexOf('tesorero') >= 0) addRoleBtn('tesorero', 'Tesorero', 'Rendiciones e informes', '💼');
    if (roles.indexOf('presidente') >= 0) addRoleBtn('presidente', 'Presidente', 'Gestión del curso y campañas', '🎓');

    overlay.appendChild(card);
    document.body.appendChild(overlay);
    var closeBtn = byId('cursappRolePickerClose');
    on(closeBtn, 'click', function () {
      try { localStorage.removeItem(KEY_FORCE_ROLE_PICKER); } catch (err) {}
      document.body.removeChild(overlay);
    });
    on(overlay, 'click', function (e) {
      if (e.target === overlay) {
        try { localStorage.removeItem(KEY_FORCE_ROLE_PICKER); } catch (err) {}
        document.body.removeChild(overlay);
      }
    });
  }

  // -------- init --------
  function initMenu() {
    var menuBtn = byId('menuBtn');
    var dd = byId('menuDropdown');

    if (!menuBtn || !dd) return; // algunas pantallas no usan menú

    injectMenuStyleOnce();
    closeDropdown(dd); // asegurar cerrado al cargar

    var roles = getRoles();
    var activeRole = getActiveRole();

    // Si rol activo no está en roles, intenta corregir
    if (roles.length && roles.indexOf(activeRole) === -1) {
      // prioriza apoderado
      activeRole = roles.indexOf('apoderado') >= 0 ? 'apoderado' : roles[0];
      setActiveRole(activeRole);
    }

    // Role picker forzado (debug): útil para apoderado/tesorero y apoderado/presidente
    if (shouldForceRolePicker(roles)) {
      showRolePickerModal(roles);
    }

    var items = buildMenuItems(activeRole, roles);
    renderMenu(dd, items);

    on(menuBtn, 'click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleDropdown(menuBtn, dd);
    });

    // Cerrar al tocar fuera
    on(document, 'click', function () {
      closeDropdown(dd);
    });

    // Evita que click dentro cierre antes de tiempo
    on(dd, 'click', function (e) {
      e.stopPropagation();
    });

    // Reposicionar en resize/orientación
    on(window, 'resize', function () {
      if (dd.style.display === 'block') positionDropdown(menuBtn, dd);
    });
    on(window, 'scroll', function () {
      if (dd.style.display === 'block') closeDropdown(dd);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMenu);
  } else {
    initMenu();
  }
})();
