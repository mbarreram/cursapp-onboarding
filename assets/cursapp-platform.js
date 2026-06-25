
/* Cursapp V58 · Consentimientos, notificaciones inteligentes por rol/curso y PWA */
(function(){
  'use strict';
  window.addEventListener('error', function(e){ try{ console.warn('Cursapp platform JS warning', e && (e.message||e.error)); }catch(_){} }, true);
  if(window.__CURSAPP_PLATFORM_V58__) return;
  window.__CURSAPP_PLATFORM_V58__ = true;

  const POLICY_VERSION = '1.0.0';
  const MARKET_POLICY_VERSION = '1.0.0';
  const KEY_GENERAL = 'cursapp_consent_general_v1';
  const KEY_MARKET = 'cursapp_consent_market_v1';
  const KEY_INSTALL_LATER = 'cursapp_install_later_until_v1';
  const KEY_INSTALL_COUNT = 'cursapp_install_seen_count_v1';
  const KEY_PUSH_STATE = 'cursapp_push_state_v1';
  let deferredInstallPrompt = null;
  let sbCache = null;

  const $ = (s,r=document)=>r.querySelector(s);
  const esc = s => String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const readJson=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}};
  const writeJson=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const nowISO=()=>new Date().toISOString();

  function getSession(){
    try{ if(window.CURSAPP && typeof window.CURSAPP.getSession==='function') return window.CURSAPP.getSession() || {}; }catch(e){}
    return readJson('cursapp_session_v1',{}) || {};
  }
  function getUser(){
    const s=getSession();
    const p=readJson('cursapp_active_profile_v1',{})||{};
    const userId = s.auth_user_id || s.authUserId || s.user_uuid || s.usuario_id || s.supabase?.auth_user_id || s.supabase?.usuario_id || p.supabase?.auth_user_id || p.supabase?.usuario_id || p.userId || p.usuario_id || s.userId || s.email || p.email || '';
    const email = String(s.email || p.email || s.userId || '').toLowerCase().trim();
    const nombre = s.nombre || s.name || p.nombre || p.nombre_apoderado || p.apoderado?.name || 'Usuario Cursapp';
    return { id:String(userId||email||'').trim(), email, nombre };
  }

  function getActiveContext(){
    const s=getSession() || {};
    const p=readJson('cursapp_active_profile_v1',{}) || {};
    const role = String(localStorage.getItem('cursapp_active_role_v1') || s.currentRole || s.activeRole || s.role || p.role || '').toLowerCase().trim();
    const cursoKey = String(localStorage.getItem('cursapp_active_course_v1') || s.courseKey || s.course_key || p.courseKey || p.course_key || '').trim();
    const cursoId = String(s.curso_id || s.courseId || s.supabase?.curso_id || p.supabase?.curso_id || p.curso_id || '').trim();
    const colegioId = String(s.colegio_id || s.colegioId || s.supabase?.colegio_id || p.supabase?.colegio_id || p.colegio_id || '').trim();
    return { role: role || 'apoderado', cursoKey, cursoId, colegioId };
  }

  function shouldShowNotificationForContext(n){
    const ctx=getActiveContext();
    const nRole=String(n?.rol_destino || n?.role || '').toLowerCase().trim();
    const nCursoId=String(n?.curso_id || '').trim();
    const nCursoKey=String(n?.curso_key || n?.courseKey || '').trim();
    if(nRole && ctx.role && nRole !== ctx.role && nRole !== 'todos') return false;
    if(nCursoId && ctx.cursoId && nCursoId !== ctx.cursoId) return false;
    if(nCursoKey && ctx.cursoKey && nCursoKey !== ctx.cursoKey) return false;
    return true;
  }

  function pushIsEnabled(){
    try{ return ('Notification' in window && Notification.permission === 'granted') || readJson(KEY_PUSH_STATE,{})?.enabled === true; }catch(e){ return false; }
  }
  async function waitSb(ms=2500){
    const start=Date.now();
    while(Date.now()-start<ms){
      if(window.cursappSupabase) return sbCache=window.cursappSupabase;
      if(window.initCursappSupabase){try{const x=window.initCursappSupabase(); if(x) return sbCache=x;}catch(e){}}
      await new Promise(r=>setTimeout(r,80));
    }
    return sbCache;
  }
  function modal(html){
    closePlatformModal();
    const wrap=document.createElement('div');
    wrap.id='cursappPlatformModal';
    wrap.innerHTML=html;
    document.body.appendChild(wrap);
  }
  function closePlatformModal(){ const el=$('#cursappPlatformModal'); if(el) el.remove(); }
  window.CURSAPP_CLOSE_PLATFORM_MODAL = closePlatformModal;

  function policyText(){
    return `
      <div class="cursapp-link-row">
        <a href="#" data-policy="privacy">Ver Política de Privacidad</a>
        <a href="#" data-policy="terms">Ver Términos de Uso</a>
      </div>
      <div class="cursapp-consent-box" id="cursappPolicyText" style="display:none"></div>
    `;
  }

  function renderPolicy(kind){
    const box=$('#cursappPolicyText'); if(!box) return;
    box.style.display='block';
    if(kind==='terms'){
      box.innerHTML = '<b>Términos de Uso Cursapp v'+POLICY_VERSION+'</b><br>Cursapp es una plataforma de gestión escolar y comunitaria. El usuario se compromete a usarla de forma responsable, publicar información veraz y respetar las reglas internas del curso y la comunidad escolar.';
    }else{
      box.innerHTML = '<b>Política de Privacidad Cursapp v'+POLICY_VERSION+'</b><br>Cursapp tratará datos personales mínimos para operar cuentas, cursos, pagos, avisos, soporte, comunicaciones y funcionalidades de comunidad. Los datos se usarán para prestar el servicio y mantener la seguridad de la plataforma.';
    }
  }

  async function saveConsent(tipo, version, metadata){
    const u=getUser();
    const payload={ tipo, version, accepted:true, accepted_at:nowISO(), user_id:u.id||null, email:u.email||null, metadata:metadata||{} };
    writeJson(tipo==='marketplace'?KEY_MARKET:KEY_GENERAL, payload);
    try{
      const sb=await waitSb();
      if(sb && u.id){ await sb.from('cursapp_consentimientos').insert({ usuario_id:u.id, email:u.email||null, tipo, version, aceptado:true, metadata:payload.metadata, user_agent:navigator.userAgent }); }
    }catch(e){ console.warn('No se pudo guardar consentimiento en Supabase', e); }
    return payload;
  }


  function hasAuthenticatedUser(){
    const u=getUser();
    return !!(u && (u.id || u.email));
  }
  function isPublicEntryPage(){
    const path=String(location.pathname || '').toLowerCase();
    return path.endsWith('/') || path.endsWith('/index.html') || path.endsWith('/login.html') || path.endsWith('/landing.html');
  }
  function isOnboardingPage(){
    return String(location.pathname || '').toLowerCase().indexOf('/onboarding/') >= 0;
  }
  function canUsePlatformUI(){
    return hasAuthenticatedUser() && !isPublicEntryPage() && !isOnboardingPage();
  }

  function hasConsent(key, version){ const c=readJson(key,null); return !!(c && c.accepted && c.version===version); }

  function showGeneralConsent(){
    if(hasConsent(KEY_GENERAL, POLICY_VERSION)) return false;
    const html=`<div class="cursapp-consent-backdrop"><div class="cursapp-consent-card">
      <h2 class="cursapp-consent-title">Bienvenido a Cursapp</h2>
      <div class="cursapp-consent-sub">Antes de continuar necesitamos tu autorización para operar la plataforma y proteger tu información.</div>
      <div class="cursapp-consent-section"><ul class="cursapp-consent-list">
        <li><span>✅</span><div>Tratamiento de datos personales necesarios para cuentas, cursos, pagos, avisos y soporte.</div></li>
        <li><span>✅</span><div>Uso de correo para autenticación, recuperación de contraseña y comunicaciones del servicio.</div></li>
        <li><span>✅</span><div>Visualización de tu nombre dentro de tu comunidad escolar y roles autorizados.</div></li>
        <li><span>✅</span><div>Uso de datos técnicos mínimos para seguridad, auditoría y mejora de experiencia.</div></li>
      </ul>${policyText()}</div>
      <label class="cursapp-consent-check"><input id="cursappConsentCheck" type="checkbox"> <span>He leído y acepto la Política de Privacidad y los Términos de Uso de Cursapp.</span></label>
      <div class="cursapp-consent-actions"><button class="cursapp-btn primary" id="cursappConsentAccept" disabled>Continuar</button></div>
    </div></div>`;
    modal(html);
    $('#cursappConsentCheck').onchange=e=>$('#cursappConsentAccept').disabled=!e.target.checked;
    $('#cursappConsentAccept').onclick=async()=>{ await saveConsent('general',POLICY_VERSION,{source:'first_login'}); closePlatformModal(); maybeShowMarketplaceConsent(); };
    document.addEventListener('click', function h(e){ const a=e.target.closest('[data-policy]'); if(!a) return; e.preventDefault(); renderPolicy(a.dataset.policy); }, {once:false});
    return true;
  }

  function isMarketplace(){ return location.pathname.includes('/mercado-escolar'); }
  function showMarketplaceConsent(){
    if(hasConsent(KEY_MARKET, MARKET_POLICY_VERSION)) return false;
    const html=`<div class="cursapp-consent-backdrop"><div class="cursapp-consent-card">
      <h2 class="cursapp-consent-title">Condiciones de Mercado Escolar</h2>
      <div class="cursapp-consent-sub">Mercado Escolar permite contactar a otros miembros registrados de la comunidad escolar. Cursapp no actúa como vendedor, comprador ni intermediario de pagos.</div>
      <div class="cursapp-consent-section"><ul class="cursapp-consent-list">
        <li><span>🛍️</span><div>Cursapp solo facilita la publicación y el contacto entre usuarios registrados.</div></li>
        <li><span>💳</span><div><b>Cursapp no procesa pagos entre usuarios</b>. Todo pago, entrega o intercambio se acuerda fuera de la plataforma y bajo responsabilidad de comprador y vendedor.</div></li>
        <li><span>📱</span><div>Si decides compartir o permitir contacto por WhatsApp, esa decisión y sus consecuencias son responsabilidad del usuario.</div></li>
        <li><span>🛡️</span><div>Recomendamos acordar entregas en lugares seguros y reportar publicaciones sospechosas.</div></li>
        <li><span>⭐</span><div>Las calificaciones se generan desde conversaciones asociadas a ventas o intercambios declarados por los usuarios.</div></li>
      </ul></div>
      <label class="cursapp-consent-check"><input id="cursappMarketConsentCheck" type="checkbox"> <span>Entiendo y acepto las condiciones de uso de Mercado Escolar.</span></label>
      <div class="cursapp-consent-actions"><button class="cursapp-btn" onclick="history.back()">Volver</button><button class="cursapp-btn primary" id="cursappMarketConsentAccept" disabled>Entrar a Mercado Escolar</button></div>
    </div></div>`;
    modal(html);
    $('#cursappMarketConsentCheck').onchange=e=>$('#cursappMarketConsentAccept').disabled=!e.target.checked;
    $('#cursappMarketConsentAccept').onclick=async()=>{ await saveConsent('marketplace',MARKET_POLICY_VERSION,{no_payments_between_users:true, whatsapp_user_responsibility:true}); closePlatformModal(); };
    return true;
  }
  function maybeShowMarketplaceConsent(){ if(isMarketplace()) showMarketplaceConsent(); }

  function ensureGeneralConsent(options){
    if(hasConsent(KEY_GENERAL, POLICY_VERSION)){
      try{ syncStoredConsents(); }catch(e){}
      return Promise.resolve(true);
    }
    return new Promise((resolve)=>{
      const html=`<div class="cursapp-consent-backdrop"><div class="cursapp-consent-card">
        <h2 class="cursapp-consent-title">Bienvenido a Cursapp</h2>
        <div class="cursapp-consent-sub">Antes de continuar necesitamos tu autorización para operar la plataforma y proteger tu información.</div>
        <div class="cursapp-consent-section"><ul class="cursapp-consent-list">
          <li><span>✅</span><div>Tratamiento de datos personales necesarios para cuentas, cursos, pagos, avisos y soporte.</div></li>
          <li><span>✅</span><div>Uso de correo para autenticación, recuperación de contraseña y comunicaciones del servicio.</div></li>
          <li><span>✅</span><div>Visualización de tu nombre dentro de tu comunidad escolar y roles autorizados.</div></li>
          <li><span>✅</span><div>Uso de datos técnicos mínimos para seguridad, auditoría y mejora de experiencia.</div></li>
        </ul>${policyText()}</div>
        <label class="cursapp-consent-check"><input id="cursappConsentCheck" type="checkbox"> <span>He leído y acepto la Política de Privacidad y los Términos de Uso de Cursapp.</span></label>
        <div class="cursapp-consent-actions"><button class="cursapp-btn" id="cursappConsentCancel">Cancelar</button><button class="cursapp-btn primary" id="cursappConsentAccept" disabled>Continuar</button></div>
      </div></div>`;
      modal(html);
      $('#cursappConsentCheck').onchange=e=>$('#cursappConsentAccept').disabled=!e.target.checked;
      $('#cursappConsentCancel').onclick=()=>{ closePlatformModal(); resolve(false); };
      $('#cursappConsentAccept').onclick=async()=>{ await saveConsent('general',POLICY_VERSION,Object.assign({source:'onboarding_required'}, options||{})); closePlatformModal(); resolve(true); };
      document.addEventListener('click', function h(e){ const a=e.target.closest('[data-policy]'); if(!a) return; e.preventDefault(); renderPolicy(a.dataset.policy); }, {once:false});
    });
  }

  async function syncStoredConsents(){
    const u=getUser();
    if(!u.id && !u.email) return;
    const gen=readJson(KEY_GENERAL,null);
    const market=readJson(KEY_MARKET,null);
    try{
      const sb=await waitSb();
      if(!sb) return;
      if(gen && gen.accepted){ await sb.from('cursapp_consentimientos').insert({usuario_id:u.id||null,email:u.email||null,tipo:'general',version:gen.version||POLICY_VERSION,aceptado:true,metadata:Object.assign({},gen.metadata||{}, {sync_from_local:true}),user_agent:navigator.userAgent}); }
      if(market && market.accepted){ await sb.from('cursapp_consentimientos').insert({usuario_id:u.id||null,email:u.email||null,tipo:'marketplace',version:market.version||MARKET_POLICY_VERSION,aceptado:true,metadata:Object.assign({},market.metadata||{}, {sync_from_local:true}),user_agent:navigator.userAgent}); }
    }catch(e){}
  }

  window.CURSAPP_CONSENT = {
    ensureGeneral: ensureGeneralConsent,
    ensureMarketplace: function(){ return Promise.resolve(!showMarketplaceConsent()); },
    hasGeneral: function(){ return hasConsent(KEY_GENERAL, POLICY_VERSION); },
    hasMarketplace: function(){ return hasConsent(KEY_MARKET, MARKET_POLICY_VERSION); },
    sync: syncStoredConsents
  };

  const notifIcons={chat:'💬',calificacion:'⭐',favorito:'❤️',pago:'💰',campana:'📅',aviso:'📢',mercado:'🛍️',ticket:'🛠️',sistema:'🔔'};
  async function loadNotifications(){
    if(!canUsePlatformUI()) return [];
    const u=getUser();
    const ctx=getActiveContext();
    let rows=[];
    try{
      const sb=await waitSb();
      if(sb && (u.id||u.email)){
        let q=sb.from('notificaciones').select('*').order('created_at',{ascending:false}).limit(80);
        // Compatibilidad: algunos ambientes guardan user_id como UUID y otros sólo email.
        if(u.id && u.email) q=q.or(`user_id.eq.${u.id},email.eq.${u.email},destinatario_email.eq.${u.email}`);
        else if(u.id) q=q.eq('user_id',u.id);
        else if(u.email) q=q.or(`email.eq.${u.email},destinatario_email.eq.${u.email}`);
        const {data,error}=await q;
        if(!error && Array.isArray(data)) rows=data;
      }
    }catch(e){}
    if(!rows.length) rows=readJson('cursapp_notificaciones_local_v1',[]);
    rows=(rows||[]).filter(shouldShowNotificationForContext);
    return rows;
  }

  function timeAgo(v){
    const t=Date.parse(v||''); if(!t) return '';
    const s=Math.max(1,Math.floor((Date.now()-t)/1000));
    if(s<60) return 'Hace segundos'; const m=Math.floor(s/60); if(m<60) return `Hace ${m} min`;
    const h=Math.floor(m/60); if(h<24) return `Hace ${h} h`; const d=Math.floor(h/24); if(d<30) return `Hace ${d} día(s)`;
    const mo=Math.floor(d/30); return `Hace ${mo} mes(es)`;
  }
  async function refreshBell(){
    const rows=await loadNotifications();
    const unread=rows.filter(n=>!n.leida).length;
    document.querySelectorAll('[data-cursapp-bell]').forEach(btn=>{ const em=btn.querySelector('em'); if(em) em.textContent=String(unread); btn.classList.toggle('has-unread', unread>0); });
    const existing=$('#marketAlertsBadge'); if(existing){ existing.style.display=unread?'inline-flex':'none'; existing.textContent=String(unread); }
  }
  async function markAllRead(){
    const u=getUser();
    try{ const sb=await waitSb(); if(sb && u.id) await sb.from('notificaciones').update({leida:true}).eq('user_id',u.id); }catch(e){}
    const local=readJson('cursapp_notificaciones_local_v1',[]).map(n=>({...n,leida:true})); writeJson('cursapp_notificaciones_local_v1',local); refreshBell();
  }
  async function openNotifications(){
    const rows=await loadNotifications();
    const list=rows.length?rows.map(n=>`<div class="cursapp-notif-item ${n.leida?'':'unread'}" data-url="${esc(n.url_destino||'')}"><div class="cursapp-notif-icon">${notifIcons[n.tipo]||'🔔'}</div><div><div class="cursapp-notif-title">${esc(n.titulo||'Notificación')}</div><div class="cursapp-notif-detail">${esc(n.detalle||'')}</div></div><div class="cursapp-notif-time">${esc(timeAgo(n.created_at))}</div></div>`).join(''):`<div class="cursapp-notif-empty"><div style="font-size:38px">🔔</div><b>Sin notificaciones</b><p>Aquí aparecerán mensajes, avisos, pagos, calificaciones y actividad de Mercado Escolar.</p></div>`;
    modal(`<div class="cursapp-notif-backdrop"><div class="cursapp-notif-card"><div class="cursapp-notif-head"><div><h2>Notificaciones</h2><p>Centro de actividad de Cursapp</p></div><button class="cursapp-btn" onclick="CURSAPP_CLOSE_PLATFORM_MODAL()">Cerrar</button></div><div class="cursapp-notif-list">${list}</div><div class="cursapp-notif-actions"><button class="cursapp-btn" id="cursappMarkRead">Marcar todas leídas</button><button class="cursapp-btn primary" id="cursappNotifPrefs">Preferencias</button></div></div></div>`);
    $('#cursappMarkRead').onclick=async()=>{await markAllRead(); closePlatformModal(); openNotifications();};
    $('#cursappNotifPrefs').onclick=()=>{ closePlatformModal(); openNotificationPreferences(); };
    document.querySelectorAll('.cursapp-notif-item[data-url]').forEach(el=>{el.onclick=()=>{const u=el.dataset.url; if(u) location.href=u;};});
  }
  function ensureBell(){
    if(!canUsePlatformUI()) return;
    if(document.querySelector('[data-cursapp-bell]')) return;
    let host=$('#avisosBellHost') || $('.marketHeaderActions') || $('.topbar') || document.body;
    const btn=document.createElement('button');
    btn.type='button'; btn.className='cursapp-bell-btn'; btn.setAttribute('data-cursapp-bell','1'); btn.setAttribute('aria-label','Notificaciones'); btn.innerHTML='🔔<em>0</em>';
    btn.onclick=openNotifications;
    if(host===document.body) btn.classList.add('floating');
    if(host.classList && host.classList.contains('marketHeaderActions')){
      const marketBtn=$('#btnMarketAlerts');
      if(marketBtn){ marketBtn.onclick=openNotifications; marketBtn.setAttribute('data-cursapp-bell','1'); return; }
    }
    host.appendChild(btn);
  }

  window.addEventListener('beforeinstallprompt', e=>{ try{ e.preventDefault(); deferredInstallPrompt=e; }catch(_){ } });
  function canShowInstall(){
    if(!canUsePlatformUI()) return false;
    const until=Number(localStorage.getItem(KEY_INSTALL_LATER)||0); if(Date.now()<until) return false;
    if(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return false;
    return true;
  }
  function maybeShowInstallBanner(){
    if(!canShowInstall()) return;
    const count=Number(localStorage.getItem(KEY_INSTALL_COUNT)||0)+1; localStorage.setItem(KEY_INSTALL_COUNT,String(count));
    if(count<3 && !deferredInstallPrompt) return;
    if($('#cursappInstallBanner')) return;
    const b=document.createElement('div'); b.id='cursappInstallBanner'; b.className='cursapp-install-banner show';
    b.innerHTML='<div>📲</div><div><strong>Instalar Cursapp</strong><span>Accede más rápido y prepara notificaciones futuras.</span></div><div class="spacer"></div><button class="install">Instalar</button><button class="later">Ahora no</button>';
    document.body.appendChild(b);
    b.querySelector('.install').onclick=installCursapp;
    b.querySelector('.later').onclick=()=>{ localStorage.setItem(KEY_INSTALL_LATER,String(Date.now()+30*86400000)); b.remove(); };
  }
  async function installCursapp(){
    const b=$('#cursappInstallBanner'); if(b) b.remove();
    if(deferredInstallPrompt){ deferredInstallPrompt.prompt(); try{await deferredInstallPrompt.userChoice;}catch(e){} deferredInstallPrompt=null; return; }
    const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
    modal(`<div class="cursapp-install-backdrop"><div class="cursapp-install-card"><h2>Instalar Cursapp</h2><div class="cursapp-consent-sub">${isIOS?'En iPhone debes agregarla desde Safari.':'Tu navegador puede permitir agregar Cursapp a la pantalla de inicio.'}</div><div class="cursapp-install-steps">${isIOS?'<div class="cursapp-install-step">1. Toca el botón Compartir de Safari.</div><div class="cursapp-install-step">2. Elige “Agregar a pantalla de inicio”.</div><div class="cursapp-install-step">3. Confirma con “Agregar”.</div>':'<div class="cursapp-install-step">Abre el menú del navegador y elige “Instalar app” o “Agregar a pantalla de inicio”.</div>'}</div><div class="cursapp-consent-actions"><button class="cursapp-btn primary" onclick="CURSAPP_CLOSE_PLATFORM_MODAL()">Entendido</button></div></div></div>`);
  }
  function registerSW(){ if('serviceWorker' in navigator){ navigator.serviceWorker.register('/sw.js').catch(()=>{}); } }

  function openConsentSummary(){
    const gen=readJson(KEY_GENERAL,null);
    const market=readJson(KEY_MARKET,null);
    function row(label, data){
      const ok=!!(data && data.accepted);
      const date=data && data.accepted_at ? new Date(data.accepted_at).toLocaleString('es-CL') : 'Pendiente';
      const ver=data && data.version ? data.version : '-';
      return `<div class="cursapp-consent-status-row"><div><b>${esc(label)}</b><p>Versión ${esc(ver)} · ${esc(date)}</p></div><span class="${ok?'ok':'pending'}">${ok?'Aceptado':'Pendiente'}</span></div>`;
    }
    modal(`<div class="cursapp-notif-backdrop"><div class="cursapp-notif-card"><div class="cursapp-notif-head"><div><h2>Mis consentimientos</h2><p>Registro de aceptaciones vigentes en este dispositivo.</p></div><button class="cursapp-btn" onclick="CURSAPP_CLOSE_PLATFORM_MODAL()">Cerrar</button></div><div class="cursapp-consent-status">${row('Política de Privacidad y Términos de Uso', gen)}${row('Condiciones de Mercado Escolar', market)}</div><div class="cursapp-consent-note">El registro legal queda asociado al usuario cuando se acepta durante el onboarding o al ingresar a Mercado Escolar.</div></div></div>`);
  }



  function isStandalonePWA(){
    try{ return !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || !!window.navigator.standalone; }catch(e){ return false; }
  }
  function pushSupportInfo(){
    const hasNotification = 'Notification' in window;
    const hasSW = 'serviceWorker' in navigator;
    const permission = hasNotification ? Notification.permission : 'unsupported';
    const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    return { hasNotification, hasSW, permission, isiOS, standalone:isStandalonePWA() };
  }
  function savePushState(patch){
    const cur=readJson(KEY_PUSH_STATE,{})||{};
    const next=Object.assign({},cur,patch||{}, {updated_at:nowISO()});
    writeJson(KEY_PUSH_STATE,next);
    return next;
  }
  async function persistPushState(state){
    const u=getUser();
    try{
      const sb=await waitSb();
      if(sb && (u.id||u.email)){
        await sb.from('push_suscripciones').insert({
          usuario_id:u.id||null,
          email:u.email||null,
          endpoint:state.endpoint||'local-device-notifications',
          permiso:state.permission||null,
          navegador:navigator.userAgent,
          activo:state.enabled===true,
          metadata:{standalone:!!state.standalone, mode:state.mode||'local_test'}
        });
      }
    }catch(e){ console.warn('No se pudo guardar estado push', e); }
  }
  async function enablePushNotifications(){
    const info=pushSupportInfo();
    if(!info.hasNotification || !info.hasSW){
      alert('Este navegador no permite notificaciones web en Cursapp.');
      return false;
    }
    if(info.isiOS && !info.standalone){
      alert('En iPhone debes abrir Cursapp desde el ícono instalado en la pantalla de inicio para activar notificaciones.');
      return false;
    }
    try{ await navigator.serviceWorker.register('/sw.js'); }catch(e){}
    let permission=Notification.permission;
    if(permission !== 'granted'){
      permission = await Notification.requestPermission();
    }
    const state = savePushState({permission, enabled:permission==='granted', standalone:info.standalone, mode:'permission'});
    await persistPushState(state);
    if(permission === 'granted'){
      alert('Notificaciones activadas correctamente.');
      return true;
    }
    if(permission === 'denied') alert('El permiso quedó bloqueado. Debes habilitar notificaciones para Cursapp desde la configuración del dispositivo/navegador.');
    else alert('No se activaron las notificaciones.');
    return false;
  }
  async function sendTestNotification(){
    const ok = (('Notification' in window) && Notification.permission==='granted') || await enablePushNotifications();
    if(!ok) return;
    try{
      const reg = await navigator.serviceWorker.ready;
      if(reg && reg.active){
        reg.active.postMessage({type:'CURSAPP_TEST_NOTIFICATION', title:'Cursapp', body:'Notificación de prueba activada correctamente.'});
      }else if(reg && reg.showNotification){
        reg.showNotification('Cursapp', { body:'Notificación de prueba activada correctamente.', icon:'/assets/icons/cursapp-icon-192.png', badge:'/assets/icons/cursapp-icon-192.png', data:{url:'/'} });
      }
      addLocalNotification({tipo:'sistema',titulo:'Notificación de prueba',detalle:'Push local enviada correctamente.',url_destino:location.pathname,leida:false});
      refreshBell();
    }catch(e){
      try{ new Notification('Cursapp', { body:'Notificación de prueba activada correctamente.' }); }catch(_){ alert('No se pudo mostrar la notificación de prueba.'); }
    }
  }
  function addLocalNotification(n){
    const ctx=getActiveContext();
    const rows=readJson('cursapp_notificaciones_local_v1',[])||[];
    rows.unshift(Object.assign({id:'local_'+Date.now(),created_at:nowISO(),leida:false, curso_key:ctx.cursoKey, curso_id:ctx.cursoId, rol_destino:ctx.role},n||{}));
    writeJson('cursapp_notificaciones_local_v1', rows.slice(0,80));
  }

  async function saveCourseNoticeFallback(n){
    // Fallback para Apoderados: si no hay Push, los avisos importantes de curso quedan visibles en "Avisos del curso".
    const ctx=getActiveContext();
    const role=String(n?.rol_destino || ctx.role || '').toLowerCase();
    if(role !== 'apoderado' && role !== 'todos') return;
    if(!n?.fallback_aviso_curso && !['aviso','campana','cuota','pago','curso'].includes(String(n?.tipo||''))) return;
    const title=String(n?.titulo || 'Aviso Cursapp').trim();
    const detail=String(n?.detalle || '').trim();
    try{
      const sb=await waitSb();
      if(sb && ctx.cursoId){
        await sb.from('avisos').insert({
          curso_id:ctx.cursoId,
          titulo:title,
          mensaje:detail,
          tipo:'notificacion',
          destino:'curso'
        });
      }
    }catch(e){
      // fallback local legacy, útil para QA y módulos que aún leen localStorage
      try{
        const arr=readJson('cursapp_avisos_curso_v1',[])||[];
        arr.unshift({id:'aviso_local_'+Date.now(), curso_id:ctx.cursoId, courseKey:ctx.cursoKey, titulo:title, mensaje:detail, tipo:'notificacion', created_at:nowISO()});
        writeJson('cursapp_avisos_curso_v1', arr.slice(0,80));
      }catch(_){}
    }
  }

  async function createNotification(payload){
    const u=getUser();
    const ctx=getActiveContext();
    const n=Object.assign({
      tipo:'sistema',
      titulo:'Cursapp',
      detalle:'',
      url_destino:location.pathname,
      origen:'sistema',
      leida:false,
      push_enviado:false,
      rol_destino:ctx.role,
      curso_id:ctx.cursoId || null,
      curso_key:ctx.cursoKey || null,
      colegio_id:ctx.colegioId || null,
      user_id:u.id || null,
      email:u.email || null,
      destinatario_email:u.email || null,
      created_at:nowISO()
    }, payload || {});

    // Siempre guarda en campana interna/local aunque Push no esté activo.
    addLocalNotification(n);

    try{
      const sb=await waitSb();
      if(sb){
        await sb.from('notificaciones').insert({
          user_id:n.user_id || null,
          email:n.email || null,
          destinatario_email:n.destinatario_email || n.email || null,
          curso_id:n.curso_id || null,
          curso_key:n.curso_key || null,
          colegio_id:n.colegio_id || null,
          rol_destino:n.rol_destino || null,
          tipo:n.tipo,
          titulo:n.titulo,
          detalle:n.detalle,
          url_destino:n.url_destino,
          icono:n.icono || notifIcons[n.tipo] || '🔔',
          origen:n.origen || n.tipo || 'sistema',
          prioridad:n.prioridad || 'normal',
          leida:false,
          push_enviado:false,
          metadata:n.metadata || {}
        });
      }
    }catch(e){ console.warn('No se pudo guardar notificación Supabase', e); }

    // Si no hay Push y corresponde a un aviso de curso para apoderados, duplicar como Aviso del curso.
    if(!pushIsEnabled()) await saveCourseNoticeFallback(n);
    refreshBell();
    return n;
  }

  function notifyForRole(payload, role){
    return createNotification(Object.assign({}, payload||{}, {rol_destino:role || (payload&&payload.rol_destino) || getActiveContext().role}));
  }
  function openNotificationPreferences(){
    const info=pushSupportInfo();
    const state=readJson(KEY_PUSH_STATE,{})||{};
    const enabled=(info.permission==='granted') || state.enabled===true;
    const status = !info.hasNotification ? 'No soportadas' : (enabled ? 'Activas' : (info.permission==='denied' ? 'Bloqueadas' : 'No configuradas'));
    const iosNote = (info.isiOS && !info.standalone) ? '<div class="cursapp-consent-note">En iPhone debes abrir Cursapp desde el ícono instalado en la pantalla de inicio para activar push. En Chrome iPhone usa Safari para instalar Cursapp.</div>' : '';
    const noPushNote = !enabled ? '<div class="cursapp-consent-note"><b>Puedes seguir usando Cursapp normalmente.</b> Si no activas Push, las alertas seguirán llegando a la campana interna. Los avisos importantes del curso para apoderados también aparecerán en Avisos del curso.</div>' : '';
    const prefs=readJson('cursapp_notif_prefs_v1',{chat:true,mercado:true,cuotas:true,pagos:true,campanas:true,avisos:true,tickets:true,push:true,email:true});
    const cats=[['chat','💬 Chat y mensajes'],['mercado','🛍️ Mercado Escolar'],['cuotas','⏰ Cuotas por vencer'],['pagos','💰 Pagos y comprobantes'],['campanas','📅 Campañas'],['avisos','📢 Avisos del curso'],['tickets','🛠️ Soporte y tickets']];
    const catHtml=cats.map(([k,label])=>`<label class="cursapp-pref-row"><span>${label}</span><input type="checkbox" data-pref="${k}" ${prefs[k]!==false?'checked':''}></label>`).join('');
    modal(`<div class="cursapp-notif-backdrop"><div class="cursapp-notif-card"><div class="cursapp-notif-head"><div><h2>Preferencias de notificaciones</h2><p>Elige qué quieres recibir por rol y curso activo.</p></div><button class="cursapp-btn" onclick="CURSAPP_CLOSE_PLATFORM_MODAL()">Cerrar</button></div><div class="cursapp-push-panel"><div class="cursapp-consent-status-row"><div><b>🔔 Notificaciones Push</b><p>Estado: ${esc(status)} · Permiso: ${esc(info.permission)}</p></div><span class="${enabled?'ok':'pending'}">${enabled?'Activas':'Pendiente'}</span></div>${iosNote}${noPushNote}<div class="cursapp-push-actions"><button class="cursapp-btn primary" id="cursappEnablePush" ${enabled?'disabled':''}>${enabled?'Notificaciones activas':'Activar notificaciones'}</button><button class="cursapp-btn" id="cursappTestPush" ${enabled?'':'disabled'}>Enviar prueba</button></div><div class="cursapp-notif-prefs"><h3>Categorías</h3>${catHtml}</div><div class="cursapp-consent-note">V58 separa notificaciones por <b>curso activo</b> y <b>rol</b> para evitar cruces entre cursos o directivas.</div></div></div></div>`);
    const en=$('#cursappEnablePush'); if(en) en.onclick=async()=>{ await enablePushNotifications(); closePlatformModal(); openNotificationPreferences(); };
    const ts=$('#cursappTestPush'); if(ts) ts.onclick=async()=>{ await sendTestNotification(); };
    document.querySelectorAll('[data-pref]').forEach(ch=>{ ch.onchange=()=>{ const p=readJson('cursapp_notif_prefs_v1',{})||{}; p[ch.dataset.pref]=!!ch.checked; writeJson('cursapp_notif_prefs_v1',p); }; });
  }

  document.addEventListener('DOMContentLoaded', async()=>{
    try{ registerSW(); }catch(e){}
    try{ if(canUsePlatformUI()){ ensureBell(); refreshBell(); setTimeout(refreshBell,1200); } }catch(e){}
    try{ syncStoredConsents(); }catch(e){}
    // No mostrar consentimiento general en login/landing: se exige en el último paso del onboarding.
    try{ maybeShowMarketplaceConsent(); }catch(e){}
    // No mostrar instalación automáticamente. Se abre desde menú/botón explícito.
  });
  window.CURSAPP_NOTIFICATIONS = { refresh: refreshBell, open: openNotifications, preferences: openNotificationPreferences, enablePush: enablePushNotifications, testPush: sendTestNotification, create:createNotification, notifyForRole:notifyForRole, context:getActiveContext };
  window.CURSAPP_NOTIFY = { create:createNotification, apoderado:(p)=>notifyForRole(p,'apoderado'), presidente:(p)=>notifyForRole(p,'presidente'), tesorero:(p)=>notifyForRole(p,'tesorero') };
  window.CURSAPP_INSTALL = { open: installCursapp };
  if(window.CURSAPP_CONSENT) window.CURSAPP_CONSENT.openSummary = openConsentSummary;
})();
