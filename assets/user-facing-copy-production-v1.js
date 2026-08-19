(function(){
  'use strict';
  if (window.__MICURSOX_USER_FACING_COPY_PRODUCTION_V1__) return;
  window.__MICURSOX_USER_FACING_COPY_PRODUCTION_V1__ = true;

  try {
    window.CURSAPP = window.CURSAPP || {};
    window.CURSAPP.DEMO_MODE = false;
    const url = new URL(window.location.href);
    let changed = false;
    ['debug','demo','seed','reset'].forEach(function(key){
      if (url.searchParams.has(key)) { url.searchParams.delete(key); changed = true; }
    });
    if (changed) history.replaceState(history.state, document.title, url.pathname + (url.search || '') + url.hash);
  } catch (_) {}

  const exact = new Map([
    ['Cargando perfil desde Supabase…','Cargando tu perfil…'],
    ['Cargando perfil desde Supabase...','Cargando tu perfil...'],
    ['Datos guardados en Supabase','Información de tu cuenta'],
    ['Contexto asociado a tu sesion','Información asociada a tu curso'],
    ['Contexto asociado a tu sesión','Información asociada a tu curso'],
    ['Preferencias sincronizadas entre dispositivos','Tus preferencias se aplican a tu cuenta'],
    ['Datos reales sincronizados desde Supabase','Actividad reciente de tu cuenta'],
    ['Centro de actividad sincronizado','Centro de actividad'],
    ['Notificaciones push','Notificaciones en este dispositivo'],
    ['La contraseña se actualiza mediante Supabase Auth','Actualiza tu contraseña de forma segura'],
    ['Cambios guardados en Supabase.','Cambios guardados correctamente.'],
    ['Preferencias guardadas en Supabase.','Preferencias guardadas correctamente.'],
    ['La sincronización de pagos no está disponible.','No pudimos registrar el pago en este momento.'],
    ['Los indicadores del curso se actualizaron desde Supabase.','Los indicadores del curso se actualizaron correctamente.'],
    ['No encontré el curso en Supabase.','No pudimos encontrar el curso activo.'],
    ['No se encontro el curso en Supabase.','No pudimos encontrar el curso activo.'],
    ['La cuenta no está autenticada con Supabase.','No pudimos validar tu cuenta. Vuelve a iniciar sesión.'],
    ['La configuracion de Supabase no está disponible.','El servicio no está disponible en este momento. Intenta nuevamente.'],
    ['La configuración de Supabase no está disponible.','El servicio no está disponible en este momento. Intenta nuevamente.'],
    ['No se pudo iniciar la conexion con Supabase.','No pudimos conectar con el servicio. Intenta nuevamente.'],
    ['No se pudo iniciar la conexión con Supabase.','No pudimos conectar con el servicio. Intenta nuevamente.'],
    ['La sesion no contiene una identidad valida de Supabase. Vuelve a iniciar sesion.','No pudimos validar tu sesión. Vuelve a iniciar sesión.'],
    ['La sesión no contiene una identidad válida de Supabase. Vuelve a iniciar sesión.','No pudimos validar tu sesión. Vuelve a iniciar sesión.'],
    ['No se encontro el perfil autenticado en Supabase.','No pudimos encontrar tu perfil. Vuelve a iniciar sesión.'],
    ['No se encontró el perfil autenticado en Supabase.','No pudimos encontrar tu perfil. Vuelve a iniciar sesión.'],
    ['Pago realizado ✅ (demo)','Pago realizado ✅'],
    ['Reset demo presidente. ¿Continuar?','¿Deseas reiniciar estos datos?'],
    ['Esto eliminará datos demo. ¿Continuar?','¿Deseas eliminar estos datos? Esta acción no se puede deshacer.'],
    ['Los pagos reales aparecerán aquí.','Los pagos registrados aparecerán aquí.']
  ]);

  function clean(value){
    let text = String(value == null ? '' : value);
    if (!text) return text;
    if (exact.has(text)) return exact.get(text);

    if (/(invalid jwt|jwt expired|missing authorization|auth\.uid|http\s*(401|403))/i.test(text)) {
      return 'No pudimos validar tu sesión. Vuelve a iniciar sesión.';
    }
    if (/(permission denied|row-level security|violates row level security|pgrst\d+|sqlstate|relation\s+.+\s+does not exist|duplicate key|foreign key constraint|apikey|service[_ -]?role|http\s*5\d\d)/i.test(text)) {
      return 'No pudimos completar la operación. Intenta nuevamente. Si continúa, contacta a soporte.';
    }

    return text
      .replace(/El pago de\s+(.+?)\s+quedó conciliado en Supabase\./gi, 'El pago de $1 quedó registrado correctamente.')
      .replace(/No se pudo guardar la conciliación en Supabase:\s*[\s\S]*/gi, 'No se pudo guardar la conciliación. Intenta nuevamente.')
      .replace(/No se pudo actualizar en Supabase:\s*[\s\S]*/gi, 'No se pudo guardar el cambio. Intenta nuevamente.')
      .replace(/Este pago viene de una referencia antigua del navegador\.\s*Actualicé desde Supabase;\s*vuelve a presionar Pagar\./gi, 'Actualizamos la información del pago. Vuelve a presionar Pagar.')
      .replace(/No se pudo eliminar el rol tesorero\.[\s\S]*RLS\/DELETE[\s\S]*/gi, 'No se pudo completar la operación. Intenta nuevamente o contacta a soporte.')
      .replace(/Restante por pagar:\s*([^\n]+?)\s*\(demo\)/gi, 'Restante por pagar: $1')
      .replace(/\s*\(demo\)/gi, '')
      .replace(/Supabase Auth/gi, 'el servicio seguro de MiCursoX')
      .replace(/Supabase/gi, 'MiCursoX')
      .replace(/\bRLS\/DELETE\b/gi, 'permisos de seguridad')
      .replace(/\bUUID\b/gi, 'identificador')
      .replace(/\blegacy\b/gi, 'anterior')
      .replace(/\blocalStorage\b/gi, 'datos del dispositivo')
      .replace(/\bCursapp\b/g, 'MiCursoX');
  }

  function sanitizeTextNode(node){
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    const parent = node.parentElement;
    if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|CODE|PRE)$/i.test(parent.tagName)) return;
    const before = node.nodeValue || '';
    const after = clean(before);
    if (after !== before) node.nodeValue = after;
  }
  function sanitizeElement(el){
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
    if (el.classList?.contains('warnBox') && /En celular no existe F12|ui-monospace|Error en Informe/i.test(el.textContent || '')) {
      el.innerHTML = '<div style="font-weight:950;">No pudimos cargar el informe</div><div class="muted" style="margin-top:6px;">Ocurrió un problema al preparar esta información. Intenta nuevamente. Si continúa, contacta a soporte.</div>';
      return;
    }
    ['title','placeholder','aria-label'].forEach(function(attr){
      if (!el.hasAttribute(attr)) return;
      const before = el.getAttribute(attr) || '';
      const after = clean(before);
      if (after !== before) el.setAttribute(attr, after);
    });
    Array.from(el.childNodes || []).forEach(function(node){ if (node.nodeType === Node.TEXT_NODE) sanitizeTextNode(node); });
  }
  function sanitizeTree(root){
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) { sanitizeTextNode(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) sanitizeElement(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) node.nodeType === Node.TEXT_NODE ? sanitizeTextNode(node) : sanitizeElement(node);
  }

  const originalAlert = typeof window.alert === 'function' ? window.alert.bind(window) : null;
  if (originalAlert) window.alert = function(message){ return originalAlert(clean(message)); };
  const originalConfirm = typeof window.confirm === 'function' ? window.confirm.bind(window) : null;
  if (originalConfirm) window.confirm = function(message){ return originalConfirm(clean(message)); };

  const DEV_IDS = ['resetBtn','resetDemoBtn','demoResetBtn','presResetBtn','tesResetBtn','debugBtn','debugPanel','demoPanel','seedDemoBtn'];
  function neutralizeDevControls(root){
    DEV_IDS.forEach(function(id){
      const el = document.getElementById(id);
      if (!el) return;
      try { el.disabled = true; el.hidden = true; el.setAttribute('aria-hidden','true'); el.tabIndex = -1; } catch (_) {}
    });
    try {
      (root && root.querySelectorAll ? root : document).querySelectorAll('[data-debug],[data-demo-action],[data-reset-demo]').forEach(function(el){
        el.disabled = true; el.hidden = true; el.setAttribute('aria-hidden','true'); el.tabIndex = -1;
      });
    } catch (_) {}
  }

  let queued = false;
  const observer = new MutationObserver(function(mutations){
    if (queued) return;
    queued = true;
    requestAnimationFrame(function(){
      queued = false;
      mutations.forEach(function(m){
        if (m.type === 'characterData') sanitizeTextNode(m.target);
        Array.from(m.addedNodes || []).forEach(function(node){ sanitizeTree(node); if (node?.nodeType === Node.ELEMENT_NODE) neutralizeDevControls(node); });
      });
    });
  });

  function start(){
    sanitizeTree(document.body || document.documentElement);
    neutralizeDevControls(document);
    observer.observe(document.documentElement, {subtree:true, childList:true, characterData:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
