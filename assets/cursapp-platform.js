
/* Cursapp V58.8 · Estabiliza campana, lectura, acciones y consultas multi-browser */
(function(){
  'use strict';
  window.addEventListener('error', function(e){ try{ console.warn('Cursapp platform JS warning', e && (e.message||e.error)); }catch(_){} }, true);
  if(window.__CURSAPP_PLATFORM_V5811__) return;
  window.__CURSAPP_PLATFORM_V5811__ = true;

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

  let __actionLoadingTimer = null;
  function showActionLoading(msg){
    try{
      clearTimeout(__actionLoadingTimer);
      let el=document.getElementById('cursappActionLoading');
      if(!el){
        el=document.createElement('div');
        el.id='cursappActionLoading';
        el.innerHTML='<div class="cursapp-action-loading-card"><div class="cursapp-action-spinner">C</div><strong></strong><span>Un momento...</span></div>';
        document.body.appendChild(el);
      }
      const st=el.querySelector('strong'); if(st) st.textContent=msg||'Abriendo';
      el.classList.add('show');
    }catch(_){ }
  }
  function hideActionLoading(delay=550){
    try{
      clearTimeout(__actionLoadingTimer);
      __actionLoadingTimer=setTimeout(()=>{ const el=document.getElementById('cursappActionLoading'); if(el) el.classList.remove('show'); }, delay);
    }catch(_){ }
  }

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
  const moneyCLP = v => '$' + String(Math.round(Number(v||0))).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  const normEmail = v => String(v||'').toLowerCase().trim();
  const isUuid = v => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));
  function applyRecipientFilter(q,u){
    const parts=[];
    if(u && isUuid(u.id)){ parts.push(`user_id.eq.${u.id}`); parts.push(`usuario_id.eq.${u.id}`); }
    if(u && u.email){ parts.push(`email.eq.${u.email}`); parts.push(`destinatario_email.eq.${u.email}`); }
    if(parts.length) return q.or(parts.join(','));
    return q;
  }
  async function loadNotifications(){
    if(!canUsePlatformUI()) return [];
    const u=getUser();
    let rows=[];
    try{
      const sb=await waitSb();
      if(sb && (u.id||u.email)){
        let q=sb.from('notificaciones').select('*').order('created_at',{ascending:false}).limit(80);
        // Compatibilidad robusta multi-browser: algunos registros usan usuario_id/user_id (UUID) y otros email.
        // No consultamos columnas UUID con email para evitar errores silenciosos en Chrome/Safari.
        q=applyRecipientFilter(q,u);
        const {data,error}=await q;
        if(!error && Array.isArray(data)) rows=data;

        // V58.9: fallback multi-browser. En Chrome/Safari puede variar el identificador local
        // del usuario; si la consulta por destinatario no trae filas, leemos eventos de curso+rol
        // que son compartidos por contexto (campañas/avisos para apoderados y pagos para directiva).
        if((!rows || !rows.length)){
          const ctx=getActiveContext();
          if(ctx.cursoId && ctx.role){
            let q2=sb.from('notificaciones').select('*').eq('curso_id',ctx.cursoId).eq('rol_destino',ctx.role).order('created_at',{ascending:false}).limit(80);
            const {data:data2,error:error2}=await q2;
            if(!error2 && Array.isArray(data2)){
              const allowed = data2.filter(n=>{
                const t=String(n.tipo||'').toLowerCase();
                if(ctx.role==='apoderado') return ['campana','aviso','curso','cuota','sistema'].includes(t);
                if(ctx.role==='presidente' || ctx.role==='tesorero') return ['pago','campana','aviso','curso','retiro','sistema'].includes(t);
                return false;
              });
              rows=allowed;
            }
          }
        }
      }
    }catch(e){}
    // V58.6: siempre mezcla Supabase + local. Antes, si Supabase devolvía filas,
    // ignoraba la cola local y se perdían notificaciones creadas en el mismo dispositivo.
    const local=readJson('cursapp_notificaciones_local_v1',[])||[];
    rows=[...(Array.isArray(rows)?rows:[]), ...(Array.isArray(local)?local:[])];
    const seen=new Set();
    rows=rows.filter(n=>{
      if(!shouldShowNotificationForContext(n)) return false;
      const key=String(n.id||'') || [n.titulo,n.detalle,n.created_at,n.rol_destino,n.curso_id,n.curso_key].join('|');
      if(seen.has(key)) return false; seen.add(key); return true;
    }).sort((a,b)=>Date.parse(b.created_at||0)-Date.parse(a.created_at||0)).slice(0,80);
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
    try{ const sb=await waitSb(); if(sb && (u.id||u.email)){
      let q=sb.from('notificaciones').update({leida:true, leida_at:nowISO()});
      q=applyRecipientFilter(q,u);
      await q;
    } }catch(e){}
    const local=readJson('cursapp_notificaciones_local_v1',[]).map(n=>({...n,leida:true})); writeJson('cursapp_notificaciones_local_v1',local); refreshBell();
  }
  async function markNotificationRead(n){
    if(!n) return;
    const u=getUser();
    const id=String(n.id||'').trim();
    const now=nowISO();
    try{
      const sb=await waitSb();
      if(sb && id && !id.startsWith('local_') && !id.startsWith('aviso_local_') && !id.startsWith('notif_')){
        await sb.from('notificaciones').update({leida:true, leida_at:now}).eq('id',id);
      }else if(sb && (u.id||u.email) && n.titulo){
        let q=sb.from('notificaciones').update({leida:true, leida_at:now}).eq('titulo',n.titulo);
        if(n.curso_id) q=q.eq('curso_id',n.curso_id);
        if(n.rol_destino) q=q.eq('rol_destino',n.rol_destino);
        q=applyRecipientFilter(q,u);
        await q;
      }
    }catch(e){ console.warn('No se pudo marcar notificación leída', e); }
    try{
      const local=(readJson('cursapp_notificaciones_local_v1',[])||[]).map(x=>{
        const sameId=id && String(x.id||'')===id;
        const sameFallback=!id && String(x.titulo||'')===String(n.titulo||'') && String(x.created_at||'').slice(0,16)===String(n.created_at||'').slice(0,16);
        return (sameId||sameFallback)?Object.assign({},x,{leida:true,leida_at:now}):x;
      });
      writeJson('cursapp_notificaciones_local_v1',local);
    }catch(_){ }
    await refreshBell();
  }


  function setApoderadoTab(tab){
    try{
      const btn=document.querySelector(`[data-tab="${tab}"]`);
      if(btn){ btn.click(); return true; }
      if(window.location.hash!==('#'+tab)) window.location.hash=tab;
    }catch(_){ }
    return false;
  }
  async function handleNotificationAction(n){
    if(!n) return;
    const role=String(getActiveContext().role||'').toLowerCase();
    const tipo=String(n.tipo||'').toLowerCase();
    const url=String(n.url_destino||'').trim();
    closePlatformModal();
    showActionLoading('Abriendo');
    try{
      // Acciones internas sin recargar la página actual.
      if(role==='apoderado'){
        if(tipo==='pago' || tipo==='cuota' || tipo==='campana'){
          setApoderadoTab('payments');
          hideActionLoading(750);
          return;
        }
        if(tipo==='aviso' || tipo==='curso'){
          setTimeout(()=>{ try{ openCourseNotices(); }catch(_){ } }, 120);
          hideActionLoading(750);
          return;
        }
        if(tipo==='mercado' && !location.pathname.includes('/mercado-escolar/')){
          location.href='/mercado-escolar/mercado-escolar.html';
          return;
        }
      }
      if(role==='presidente'){
        if(tipo==='pago'){
          // Mantener en pantalla actual y mostrar feedback. Más adelante abrirá detalle financiero.
          try{ document.querySelector('[data-tab="dashboard"],[data-tab="home"],[data-section="dashboard"]')?.click(); }catch(_){ }
          hideActionLoading(750);
          return;
        }
      }
      if(role==='tesorero'){
        if(tipo==='pago'){
          try{ document.querySelector('[data-tab="payments"],[data-tab="pagos"],[data-section="pagos"]')?.click(); }catch(_){ }
          hideActionLoading(750);
          return;
        }
      }
      if(url){
        try{
          const target=new URL(url, location.origin);
          if(target.pathname===location.pathname){
            if(target.hash) location.hash=target.hash;
            hideActionLoading(650);
            return;
          }
          location.href=target.href;
          return;
        }catch(_){ }
      }
    }catch(_){ }
    hideActionLoading(650);
  }

  async function openNotifications(){
    const rows=await loadNotifications();
    try{ window.__CURSAPP_LAST_NOTIF_ROWS__=rows; }catch(_){ }
    const list=rows.length?rows.map((n,i)=>`<div class="cursapp-notif-item ${n.leida?'':'unread'}" data-idx="${i}" data-id="${esc(n.id||'')}" data-url="${esc(n.url_destino||'')}"><div class="cursapp-notif-icon">${notifIcons[n.tipo]||'🔔'}</div><div><div class="cursapp-notif-title">${esc(n.titulo||'Notificación')}</div><div class="cursapp-notif-detail">${esc(n.detalle||'')}</div></div><div class="cursapp-notif-time">${esc(timeAgo(n.created_at))}</div></div>`).join(''):`<div class="cursapp-notif-empty"><div style="font-size:38px">🔔</div><b>Sin notificaciones</b><p>Aquí aparecerán mensajes, avisos, pagos, calificaciones y actividad de Mercado Escolar.</p></div>`;
    modal(`<div class="cursapp-notif-backdrop"><div class="cursapp-notif-card"><div class="cursapp-notif-head"><div><h2>Notificaciones</h2><p>Centro de actividad de Cursapp</p></div><button class="cursapp-btn" onclick="CURSAPP_CLOSE_PLATFORM_MODAL()">Cerrar</button></div><div class="cursapp-notif-list">${list}</div><div class="cursapp-notif-actions"><button class="cursapp-btn" id="cursappMarkRead">Marcar todas leídas</button><button class="cursapp-btn primary" id="cursappNotifPrefs">Preferencias</button></div></div></div>`);
    $('#cursappMarkRead').onclick=async()=>{await markAllRead(); closePlatformModal(); openNotifications();};
    $('#cursappNotifPrefs').onclick=()=>{ closePlatformModal(); openNotificationPreferences(); };
    document.querySelectorAll('.cursapp-notif-item').forEach(el=>{el.onclick=async()=>{const idx=Number(el.dataset.idx||0); const n=(window.__CURSAPP_LAST_NOTIF_ROWS__||[])[idx]; showActionLoading('Abriendo'); el.style.pointerEvents='none'; await markNotificationRead(n); el.classList.remove('unread'); await refreshBell(); try{ const em=document.querySelector('[data-cursapp-bell] em'); if(em){ const unread=(await loadNotifications()).filter(x=>!x.leida).length; em.textContent=String(unread); em.parentElement.classList.toggle('has-unread', unread>0); } }catch(_){ } await handleNotificationAction(n); };});
  }
  function ensureBell(){
    if(!canUsePlatformUI()) return;
    // V58.7: crear campana dedicada. No reutilizar el botón de avisos/mensajes del apoderado.
    let existing=document.querySelector('[data-cursapp-bell="1"]');
    if(existing){
      if(!existing.querySelector('em')){ const em=document.createElement('em'); em.textContent='0'; existing.appendChild(em); }
      existing.onclick=openNotifications;
      refreshBell();
      return;
    }
    let host=$('#avisosBellHost');
    if(!host){
      // En Mercado Escolar sí se puede reutilizar su campana nativa si existe.
      existing=$('#marketAlertsBtn') || $('#btnMarketAlerts');
      if(existing && /mercado/i.test(location.pathname+document.title)){
        existing.setAttribute('data-cursapp-bell','1');
        if(!existing.querySelector('em')){ const em=document.createElement('em'); em.textContent='0'; existing.appendChild(em); }
        existing.onclick=openNotifications;
        refreshBell();
        return;
      }
      host=$('.marketHeaderActions') || $('.topbar-actions') || $('.topbar') || document.body;
    }
    const btn=document.createElement('button');
    btn.type='button'; btn.className='cursapp-bell-btn'; btn.setAttribute('data-cursapp-bell','1'); btn.setAttribute('aria-label','Notificaciones'); btn.innerHTML='🔔<em>0</em>';
    btn.onclick=openNotifications;
    if(host===document.body) btn.classList.add('floating');
    try{
      const menuBtn=$('#menuBtn');
      if(host===document.body && menuBtn && menuBtn.parentElement) host=menuBtn.parentElement;
      host.appendChild(btn);
      if(host.id==='avisosBellHost'){
        host.style.position='absolute'; host.style.right='72px'; host.style.top='10px'; host.style.zIndex='10002';
        btn.style.width='42px'; btn.style.height='42px'; btn.style.pointerEvents='auto'; btn.style.display='inline-flex';
      }
      refreshBell();
    }catch(e){
      document.body.appendChild(btn); btn.classList.add('floating'); refreshBell();
    }
  }

  // V58.9: mantener campana visible al cambiar de pestaña/sección o cuando algún render pisa el header.
  function scheduleBellKeepAlive(){
    try{
      ensureBell();
      [350,900,1800].forEach(ms=>setTimeout(()=>{ try{ ensureBell(); refreshBell(); }catch(_){ } },ms));
    }catch(_){ }
  }
  window.addEventListener('pageshow', scheduleBellKeepAlive);
  window.addEventListener('focus', scheduleBellKeepAlive);
  document.addEventListener('click', function(e){
    try{ if(e.target && e.target.closest && e.target.closest('.navItem,[data-tab],.bottomNav button')) setTimeout(scheduleBellKeepAlive,80); }catch(_){ }
  }, true);
  setInterval(()=>{ try{ ensureBell(); }catch(_){ } }, 2500);

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
        const payload={curso_id:ctx.cursoId,titulo:title,mensaje:detail,tipo:String(n?.tipo||'notificacion'),prioridad:n?.prioridad||'normal',visible:true};
        const r=await sb.from('avisos_curso').insert(payload);
        if(r && r.error){
          await sb.from('avisos').insert({curso_id:ctx.cursoId,titulo:title,mensaje:detail,tipo:'notificacion',destino:'curso'});
        }
      }
    }catch(e){ console.warn('No se pudo guardar aviso curso en Supabase', e); }
    // Fallback local siempre, útil si RLS bloquea o si aún no existe curso_id en sesión.
    try{
      const arr=readJson('cursapp_avisos_curso_v1',[])||[];
      arr.unshift({id:'aviso_local_'+Date.now(), curso_id:ctx.cursoId, courseKey:ctx.cursoKey, curso_key:ctx.cursoKey, titulo:title, mensaje:detail, tipo:String(n?.tipo||'notificacion'), created_at:nowISO()});
      writeJson('cursapp_avisos_curso_v1', arr.slice(0,80));
    }catch(_){}
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
    showInAppToast(n);

    try{
      const sb=await waitSb();
      if(sb){
        await sb.from('notificaciones').insert({
          user_id:n.user_id || null,
          usuario_id:n.user_id || null,
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

    // Avisos del curso es respaldo oficial para apoderados: se guarda siempre, con o sin Push.
    if(n.fallback_aviso_curso || ['aviso','campana','cuota','pago','curso'].includes(String(n.tipo||''))) await saveCourseNoticeFallback(n);
    refreshBell();
    return n;
  }

  function notifyForRole(payload, role){
    return createNotification(Object.assign({}, payload||{}, {rol_destino:role || (payload&&payload.rol_destino) || getActiveContext().role}));
  }


  async function loadCourseNotices(){
    const ctx=getActiveContext();
    let rows=[];
    try{
      const sb=await waitSb();
      if(sb){
        if(ctx.cursoId){
          const r1=await sb.from('avisos_curso').select('*').eq('curso_id',ctx.cursoId).eq('visible',true).order('created_at',{ascending:false}).limit(40);
          if(!r1.error && Array.isArray(r1.data)) rows=rows.concat(r1.data);
        }
        if(!rows.length && ctx.cursoId){
          const r2=await sb.from('avisos').select('*').eq('curso_id',ctx.cursoId).order('created_at',{ascending:false}).limit(40);
          if(!r2.error && Array.isArray(r2.data)) rows=rows.concat(r2.data);
        }
        // V58.1.2: Avisos del curso también lee notificaciones importantes del mismo curso.
        // Esto evita que la campana tenga el evento y "Avisos del curso" quede vacío.
        if(ctx.cursoId){
          const r3=await sb.from('notificaciones')
            .select('*')
            .eq('curso_id',ctx.cursoId)
            .in('tipo',['campana','cuota','aviso','pago','curso'])
            .order('created_at',{ascending:false})
            .limit(40);
          if(!r3.error && Array.isArray(r3.data)){
            rows=rows.concat(r3.data.map(n=>({
              id:'notif_'+(n.id||n.created_at),
              curso_id:n.curso_id,
              titulo:n.titulo,
              mensaje:n.detalle || n.mensaje || '',
              tipo:n.tipo,
              prioridad:n.prioridad || 'normal',
              created_at:n.created_at
            })));
          }
        }
      }
    }catch(e){}
    const local=(readJson('cursapp_avisos_curso_v1',[])||[]).filter(a=>{
      if(ctx.cursoId && a.curso_id && String(a.curso_id)!==String(ctx.cursoId)) return false;
      if(ctx.cursoKey && a.courseKey && String(a.courseKey)!==String(ctx.cursoKey)) return false;
      return true;
    });
    const byKey={};
    rows.concat(local).forEach(a=>{
      const k=[a.tipo||'',a.titulo||'',a.mensaje||a.detalle||'',String(a.created_at||'').slice(0,16)].join('|');
      if(!byKey[k]) byKey[k]=a;
    });
    return Object.values(byKey).sort((a,b)=>Date.parse(b.created_at||0)-Date.parse(a.created_at||0));
  }

  async function openCourseNotices(){
    const rows=await loadCourseNotices();
    const html=rows.length ? rows.map(a=>`<div class="cursapp-notif-item"><div class="cursapp-notif-icon">📢</div><div><div class="cursapp-notif-title">${esc(a.titulo||'Aviso del curso')}</div><div class="cursapp-notif-detail">${esc(a.mensaje||a.detalle||a.descripcion||'')}</div></div><div class="cursapp-notif-time">${esc(timeAgo(a.created_at))}</div></div>`).join('') : `<div class="cursapp-notif-empty"><b>Aún no hay avisos.</b><p>Los comunicados importantes de la directiva aparecerán aquí aunque no tengas Push activadas.</p></div>`;
    modal(`<div class="cursapp-notif-backdrop"><div class="cursapp-notif-card compact"><div class="cursapp-notif-head"><div><h2>Avisos del curso</h2><p>Comunicados enviados por la directiva.</p></div><button class="cursapp-btn" onclick="CURSAPP_CLOSE_PLATFORM_MODAL()">Cerrar</button></div><div class="cursapp-notif-list">${html}</div></div></div>`);
  }

  function bindCourseNoticeButtons(){
    if(String(getActiveContext().role||'').toLowerCase()!=='apoderado') return;
    document.addEventListener('click', function(ev){
      const t=ev.target && ev.target.closest ? ev.target.closest('button, .card, .section, [role="button"], div') : null;
      if(!t) return;
      const txt=(t.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
      if(txt.includes('avisos del curso')){
        ev.preventDefault(); ev.stopPropagation(); openCourseNotices();
      }
    }, true);
  }

  async function notifyCourseApoderados(payload){
    const ctx=getActiveContext();
    const base=Object.assign({tipo:'campana',origen:'campanas',rol_destino:'apoderado',curso_id:ctx.cursoId||null,curso_key:ctx.cursoKey||null,fallback_aviso_curso:true},payload||{});
    // Siempre crea aviso del curso como respaldo visible para todos los apoderados del curso.
    await saveCourseNoticeFallback(base);
    try{
      const sb=await waitSb();
      if(!sb) throw new Error('sin supabase');
      let query=sb.from('miembros_curso').select('*').limit(250);
      if(ctx.cursoId) query=query.eq('curso_id',ctx.cursoId);
      else if(ctx.cursoKey) query=query.eq('course_key',ctx.cursoKey);
      else throw new Error('sin curso_id/curso_key');
      const {data:miembros,error}=await query;
      if(error || !Array.isArray(miembros) || !miembros.length) throw error || new Error('sin miembros');
      const inserts=[];
      miembros.forEach(m=>{
        const j=m||{};
        const role=String(j.rol || j.role || (Array.isArray(j.roles)?j.roles.join(','):'') || '').toLowerCase();
        if(role && !role.includes('apoderado')) return;
        const status=String(j.estado || j.status || j.aprobado || '').toLowerCase();
        if(status && /rechaz|bloque|pending|pendiente/.test(status)) return;
        const uid=j.usuario_id || j.user_id || j.auth_user_id || j.profile_id || null;
        const email=String(j.email || j.correo || j.apoderado_email || '').toLowerCase().trim() || null;
        if(!uid && !email) return;
        inserts.push({usuario_id:uid,user_id:uid,email:email,destinatario_email:email,curso_id:ctx.cursoId,curso_key:ctx.cursoKey||null,colegio_id:ctx.colegioId||null,rol_destino:'apoderado',tipo:base.tipo,titulo:base.titulo,detalle:base.detalle,url_destino:base.url_destino||'/apoderado.html',icono:base.icono||'📅',origen:base.origen||'campanas',prioridad:base.prioridad||'normal',leida:false,push_enviado:false,metadata:base.metadata||{}});
      });
      if(inserts.length) await sb.from('notificaciones').insert(inserts);
    }catch(e){
      // Si no se pueden enumerar miembros por RLS, al menos queda aviso curso y notificación local para QA.
      console.warn('No se pudo crear notificaciones masivas a apoderados', e);
    }
    const localNotice=Object.assign({}, base, {rol_destino:'apoderado'});
    addLocalNotification(localNotice);
    showInAppToast(localNotice);
    refreshBell();
  }

  function normalizeCampaignPayload(raw){
    let obj=raw||{};
    if(Array.isArray(obj)) obj=obj[0]||{};
    const title=obj.titulo || obj.nombre || obj.concepto || obj.descripcion || 'Nueva campaña';
    const monto=obj.monto || obj.valor || obj.total || obj.monto_cuota || '';
    const vence=obj.fecha_vencimiento || obj.vencimiento || obj.fecha_fin || obj.due_date || '';
    let detail='Se creó una nueva campaña para tu curso.';
    if(monto || vence) detail += `${monto?' Monto: $'+String(monto).replace(/\B(?=(\d{3})+(?!\d))/g,'.')+'.':''}${vence?' Vence: '+String(vence).slice(0,10)+'.':''}`;
    return {titulo:'Nueva campaña: '+String(title), detalle:detail, metadata:{campana:obj}};
  }

  function installCampaignCreatedWatcher(){
    if(window.__CURSAPP_CAMPAIGN_WATCHER_V5811__) return;
    window.__CURSAPP_CAMPAIGN_WATCHER_V5811__=true;
    const originalFetch=window.fetch;
    if(typeof originalFetch!=='function') return;
    let lastEventAt=0;
    async function handleEvent(data, kind){
      const now=Date.now();
      if(now-lastEventAt<1200) return; // evita duplicados cuando campaña crea varias cuotas/pagos
      lastEventAt=now;
      const payload=Object.assign(normalizeCampaignPayload(data), {url_destino:'/apoderado.html', tipo:kind==='pago'?'cuota':'campana', icono:kind==='pago'?'⏰':'📅', origen:kind==='pago'?'pagos':'campanas'});
      await notifyCourseApoderados(payload);
      // Si quien está probando cambia de rol en el mismo dispositivo, queda visible inmediatamente.
      try{ await saveCourseNoticeFallback(Object.assign({}, payload, {rol_destino:'apoderado', fallback_aviso_curso:true})); }catch(e){}
    }
    window.fetch=async function(input, init){
      const url=String((input&&input.url)||input||'');
      const method=String((init&&init.method)||(input&&input.method)||'GET').toUpperCase();
      const isCampaignInsert=/\/rest\/v1\/campanas(\?|$)/.test(url) && method==='POST';
      const isPagoInsert=/\/rest\/v1\/pagos(\?|$)/.test(url) && method==='POST';
      let bodyPayload=null;
      if(isCampaignInsert || isPagoInsert){
        try{ bodyPayload=JSON.parse((init && init.body) || (input && input.body) || '{}'); }catch(e){}
      }
      const res=await originalFetch.apply(this, arguments);
      if((isCampaignInsert || isPagoInsert) && res && res.ok){
        setTimeout(async()=>{
          let data=bodyPayload;
          try{ data=await res.clone().json(); }catch(e){}
          await handleEvent(data, isPagoInsert?'pago':'campana');
        },350);
      }
      return res;
    };
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
    try{ if(canUsePlatformUI()){ ensureBell(); refreshBell(); setTimeout(()=>{ensureBell(); refreshBell();},800); setTimeout(()=>{ensureBell(); refreshBell();},1800); setTimeout(()=>{ensureBell(); refreshBell();},3500); bindCourseNoticeButtons(); installCampaignCreatedWatcher(); } }catch(e){ console.warn('init platform', e); }
    try{ syncStoredConsents(); }catch(e){}
    // No mostrar consentimiento general en login/landing: se exige en el último paso del onboarding.
    try{ maybeShowMarketplaceConsent(); }catch(e){}
    // No mostrar instalación automáticamente. Se abre desde menú/botón explícito.
  });

  async function notifyPaymentToDirectiva(payment, opts){
    const ctx=getActiveContext();
    const u=getUser();
    const p=payment||{};
    const paymentId=String(p.id || opts?.paymentId || '').trim();
    if(paymentId){
      const doneKey='cursapp_notified_payment_directiva_'+paymentId;
      if(localStorage.getItem(doneKey)==='1') return;
      localStorage.setItem(doneKey,'1');
    }
    const amount=Number(p.monto_pagado || p.monto || p.amount || opts?.amount || 0) || 0;
    const alumno=String(p.alumno || p.nombre_alumno || p.student || opts?.alumno || readJson('cursapp_active_profile_v1',{})?.alumno || readJson('cursapp_active_profile_v1',{})?.apoderado?.alumno || '').trim();
    const apoderado=String(u.nombre || p.apoderado_nombre || p.nombre_apoderado || opts?.apoderado || 'Apoderado').trim();
    let campaign=String(p.campana || p.campana_nombre || p.campaign || p.concepto || opts?.campana || '').trim();
    try{
      const sb=await waitSb();
      const cid=p.campana_id || p.campaign_id || opts?.campana_id;
      if(sb && !campaign && cid){
        const r=await sb.from('campanas').select('titulo,nombre,concepto,descripcion').eq('id',cid).limit(1).maybeSingle();
        if(!r.error && r.data) campaign=String(r.data.titulo||r.data.nombre||r.data.concepto||r.data.descripcion||'').trim();
      }
    }catch(_){ }
    campaign=campaign || 'campaña del curso';
    const detailPres=`${alumno || apoderado} registró un pago de ${moneyCLP(amount)} en ${campaign}.`;
    const detailTes=`Alumno/a: ${alumno || 'No informado'} · Apoderado: ${apoderado} · Campaña: ${campaign} · Monto: ${moneyCLP(amount)} · Estado: pagado.`;
    const base={tipo:'pago',origen:'pagos',curso_id:ctx.cursoId||p.curso_id||null,curso_key:ctx.cursoKey||p.curso_key||null,colegio_id:ctx.colegioId||p.colegio_id||null,evento_id:paymentId||null,metadata:{payment_id:paymentId||null,campana:campaign,alumno,apoderado,monto:amount}};
    try{
      const sb=await waitSb();
      if(!sb) throw new Error('sin supabase');
      let query=sb.from('miembros_curso').select('*').limit(300);
      if(base.curso_id) query=query.eq('curso_id',base.curso_id);
      else if(base.curso_key) query=query.eq('course_key',base.curso_key);
      else throw new Error('sin curso activo');
      const {data:miembros,error}=await query;
      if(error) throw error;
      const inserts=[];
      (miembros||[]).forEach(m=>{
        const roleText=String(m.rol || m.role || (Array.isArray(m.roles)?m.roles.join(','):'') || '').toLowerCase();
        const roles=[];
        if(roleText.includes('presidente')) roles.push('presidente');
        if(roleText.includes('tesorero')) roles.push('tesorero');
        if(!roles.length) return;
        const uid=m.usuario_id || m.user_id || m.auth_user_id || m.profile_id || null;
        const email=normEmail(m.email || m.correo || m.apoderado_email || m.user_email || '');
        if(!uid && !email) return;
        roles.forEach(role=>{
          inserts.push(Object.assign({},base,{usuario_id:uid,user_id:uid,email,destinatario_email:email,rol_destino:role,titulo: role==='tesorero'?'Pago recibido para conciliación':'Pago registrado',detalle: role==='tesorero'?detailTes:detailPres,url_destino: role==='tesorero'?'/tesorero.html':'/presidente.html',icono:'💰',prioridad:'normal',leida:false,push_enviado:false}));
        });
      });
      if(inserts.length) await sb.from('notificaciones').insert(inserts);
    }catch(e){ console.warn('No se pudo notificar pago a directiva', e); }
    // V58.6: si el mismo correo tiene rol directivo en este curso, guardar copia local
    // para presidente/tesorero aunque el pago se haya realizado desde rol apoderado.
    // Esto evita que, por RLS o por user_id distinto, la directiva no vea el evento en QA.
    try{
      const profiles=readJson('cursapp_profiles_v1',[])||[];
      const roles=new Set();
      const email=normEmail(u.email||'');
      (Array.isArray(profiles)?profiles:[]).forEach(pr=>{
        const sameCourse = (ctx.cursoKey && String(pr.courseKey||pr.course_key||'')===String(ctx.cursoKey)) || (ctx.cursoId && String(pr.cursoId||pr.curso_id||pr.supabase?.curso_id||'')===String(ctx.cursoId));
        if(!sameCourse) return;
        const pEmail=normEmail(pr.email || pr.apoderado?.email || pr.user?.email || '');
        if(email && pEmail && email!==pEmail) return;
        const roleText=String(pr.role || pr.user?.role || (Array.isArray(pr.roles)?pr.roles.join(','):'') || '').toLowerCase();
        if(roleText.includes('presidente')) roles.add('presidente');
        if(roleText.includes('tesorero')) roles.add('tesorero');
      });
      const activeRole=String(ctx.role||'').toLowerCase();
      if(activeRole==='presidente' || activeRole==='tesorero') roles.add(activeRole);
      roles.forEach(role=>{
        addLocalNotification(Object.assign({},base,{rol_destino:role,titulo:role==='tesorero'?'Pago recibido para conciliación':'Pago registrado',detalle:role==='tesorero'?detailTes:detailPres,url_destino:role==='tesorero'?'/tesorero.html':'/presidente.html',icono:'💰'}));
      });
      if(roles.size) refreshBell();
    }catch(e){ console.warn('No se pudo crear copia local directiva', e); }
  }

  window.CURSAPP_NOTIFICATIONS = { refresh: refreshBell, open: openNotifications, preferences: openNotificationPreferences, enablePush: enablePushNotifications, testPush: sendTestNotification, create:createNotification, notifyForRole:notifyForRole, markRead:markNotificationRead, context:getActiveContext, openCourseNotices:openCourseNotices, notifyCourseApoderados:notifyCourseApoderados, notifyPaymentToDirectiva:notifyPaymentToDirectiva };
  window.CURSAPP_NOTIFY = { create:createNotification, apoderado:(p)=>notifyForRole(p,'apoderado'), presidente:(p)=>notifyForRole(p,'presidente'), tesorero:(p)=>notifyForRole(p,'tesorero'), paymentToDirectiva:notifyPaymentToDirectiva };
  window.CURSAPP_INSTALL = { open: installCursapp };
  if(window.CURSAPP_CONSENT) window.CURSAPP_CONSENT.openSummary = openConsentSummary;
})();

window.addEventListener('load', function(){ try{ if(canUsePlatformUI && canUsePlatformUI()){ ensureBell(); refreshBell(); } }catch(e){} });
