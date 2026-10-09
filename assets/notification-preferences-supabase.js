(function(){
  'use strict';
  const sb=window.CURSAPP_SUPABASE;
  if(!sb||typeof sb.request!=='function'||typeof sb.getCurrentUser!=='function')return;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const role=()=>{const p=location.pathname.toLowerCase();if(p.includes('presidente'))return'presidente';if(p.includes('tesorero'))return'tesorero';try{const s=JSON.parse(localStorage.getItem('cursapp_session_v1')||'{}')||{};const r=String(localStorage.getItem('cursapp_active_role_v1')||s.currentRole||s.activeRole||s.role||'apoderado').toLowerCase();if(r.includes('pres'))return'presidente';if(r.includes('tesor'))return'tesorero'}catch(_){ }return'apoderado'};
  const isStandalone=()=>!!(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||!!navigator.standalone;
  const support=()=>({notification:'Notification'in window,sw:'serviceWorker'in navigator,push:'PushManager'in window,permission:'Notification'in window?Notification.permission:'unsupported',ios:/iphone|ipad|ipod/i.test(navigator.userAgent),standalone:isStandalone()});
  const b64=v=>{const pad='='.repeat((4-v.length%4)%4),raw=atob((v+pad).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...raw].map(x=>x.charCodeAt(0)))};
  const device=()=>{const ua=navigator.userAgent||'';return{platform:/iphone|ipad|ipod/i.test(ua)?'ios':/android/i.test(ua)?'android':'web',browser:/crios|chrome/i.test(ua)?'chrome':/safari/i.test(ua)?'safari':/firefox/i.test(ua)?'firefox':'otro',device:/iphone|ipad|ipod|android/i.test(ua)?'mobile':'desktop'}};
  async function preference(){
    const user=await sb.getCurrentUser();
    const rows=await sb.request(`notification_preferences?select=*&user_id=eq.${encodeURIComponent(user.id)}&rol_destino=eq.${encodeURIComponent(role())}&limit=1`);
    return {user,row:Array.isArray(rows)&&rows[0]?rows[0]:null};
  }
  async function currentPushState(){
    const info=support();
    if(!info.notification||!info.sw||!info.push)return {registered:false,subscription:null,row:null};
    try{
      const registration=await navigator.serviceWorker.getRegistration('/').catch(()=>null) || await navigator.serviceWorker.getRegistration().catch(()=>null);
      const subscription=registration?.pushManager?await registration.pushManager.getSubscription():null;
      if(!subscription?.endpoint)return {registered:false,subscription:null,row:null};
      const user=await sb.getCurrentUser();
      const rows=await sb.request(`push_subscriptions?select=id,endpoint,enabled,updated_at&user_id=eq.${encodeURIComponent(user.id)}&endpoint=eq.${encodeURIComponent(subscription.endpoint)}&limit=1`);
      const row=Array.isArray(rows)&&rows[0]?rows[0]:null;
      return {registered:!!(row&&row.enabled),subscription,row};
    }catch(_){return {registered:false,subscription:null,row:null}}
  }
  async function save(patch){
    const {user,row}=await preference();
    const body=Object.assign({user_id:user.id,rol_destino:role(),push_enabled:false,email_enabled:true,campaigns:true,payments:true,announcements:true,market:true,chat:true,tasks:true,support:true,system:true,updated_at:new Date().toISOString()},row||{},patch||{});
    delete body.id;delete body.created_at;
    await sb.request('notification_preferences?on_conflict=user_id%2Crol_destino',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(body)});
    return body;
  }
  async function activate(){
    const info=support();
    if(!info.notification||!info.sw||!info.push)throw new Error('Este navegador no permite notificaciones web.');
    if(info.ios&&!info.standalone)throw new Error('En iPhone debes abrir Cursapp desde el ícono instalado en la pantalla de inicio.');
    const registration=await navigator.serviceWorker.register('/sw.js?v=push2');
    let permission=Notification.permission;
    if(permission!=='granted')permission=await Notification.requestPermission();
    if(permission!=='granted')throw new Error(permission==='denied'?'El permiso de notificaciones está bloqueado.':'No se otorgó permiso para notificaciones.');
    let sub=await registration.pushManager.getSubscription();
    if(!sub){const key=sb.pushVapidPublicKey;if(!key)throw new Error('Falta la clave pública de notificaciones.');sub=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64(key)})}
    const json=sub.toJSON(),keys=json.keys||{},user=await sb.getCurrentUser(),d=device();
    await sb.request('push_subscriptions?on_conflict=user_id%2Cendpoint',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({user_id:user.id,endpoint:json.endpoint,p256dh:keys.p256dh,auth:keys.auth,platform:d.platform,browser:d.browser,device:d.device,enabled:true,updated_at:new Date().toISOString()})});
    const verified=await currentPushState();
    if(!verified.registered)throw new Error('El permiso fue concedido, pero este dispositivo no quedó registrado en MiCursoX.');
    await save({push_enabled:true});
    return true;
  }
  async function test(){
    const functions=sb.functions;
    if(!functions||typeof functions.invoke!=='function')throw new Error('No se pudo conectar con el servicio push.');
    const result=await functions.invoke('send-web-push',{body:{mode:'test'}});
    if(result.error)throw result.error;
    if(!result.data?.sent)throw new Error(result.data?.error||'No hay un dispositivo activo para esta cuenta.');
    return result.data.sent;
  }
  function css(){if(document.getElementById('npSupabaseCss'))return;const s=document.createElement('style');s.id='npSupabaseCss';s.textContent='.npOverlay{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:1000000;display:flex;align-items:flex-end;justify-content:center;padding-top:18px;box-sizing:border-box}.npCard{width:min(760px,100%);max-height:calc(100dvh - 18px);background:#fff;border-radius:28px 28px 0 0;overflow:auto;padding-bottom:calc(18px + env(safe-area-inset-bottom));box-sizing:border-box}.npHead{padding:20px 20px 16px;display:flex;justify-content:space-between;gap:14px;border-bottom:1px solid #e5e7eb;align-items:flex-start}.npHead>div{min-width:0;padding-right:4px}.npHead h2{margin:0;font-size:22px;line-height:1.12;letter-spacing:-.02em}.npHead p{margin:8px 0 0;color:#64748b;font-size:13px;font-weight:700;line-height:1.35}.npClose{flex:0 0 42px;width:42px;height:42px;border:1px solid #e5e7eb;background:#fff;border-radius:14px;padding:0;font-size:24px;line-height:1;font-weight:900;color:#475569;display:grid;place-items:center}.npBtn{border:1px solid #e5e7eb;background:#fff;border-radius:18px;padding:13px 18px;font-weight:900}.npBody{padding:22px 20px;display:grid;gap:16px}.npStatus{border:1px solid #e5e7eb;border-radius:22px;padding:18px;display:flex;justify-content:space-between;gap:12px}.npStatus b{display:block;font-size:18px}.npStatus p{margin:6px 0 0;color:#64748b;font-weight:700}.npPill{align-self:center;background:#eef2ff;color:#6d28d9;border-radius:999px;padding:10px 14px;font-weight:900}.npActions{display:grid;grid-template-columns:1fr 1fr;gap:12px}.npBtn.primary{background:#7c3aed;color:#fff;border-color:#7c3aed}.npBtn:disabled{opacity:.5}.npNote{background:#f8fafc;border-radius:18px;padding:15px;color:#64748b;font-weight:700;line-height:1.4}.npCats{border-top:1px solid #e5e7eb;padding-top:12px}.npRow{display:flex;justify-content:space-between;align-items:center;padding:14px 2px;border-bottom:1px solid #f1f5f9;font-weight:800}.npRow input{width:24px;height:24px}.npGuide{position:fixed;inset:0;z-index:1000002;background:rgba(15,23,42,.55);display:flex;align-items:flex-end;justify-content:center}.npGuideCard{width:min(680px,100%);background:#fff;border-radius:26px 26px 0 0;padding:20px 20px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -20px 60px rgba(15,23,42,.24)}.npGuideHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.npGuideHead h3{margin:0;font-size:21px;line-height:1.15}.npGuideClose{width:40px;height:40px;border:1px solid #e5e7eb;border-radius:13px;background:#fff;font-size:22px;font-weight:900}.npGuideText{margin:10px 0 0;color:#64748b;font-size:13px;font-weight:700;line-height:1.45}.npGuideSteps{display:grid;gap:10px;margin-top:15px}.npGuideStep{display:grid;grid-template-columns:34px minmax(0,1fr);gap:10px;align-items:start;padding:12px;border:1px solid #e5e7eb;border-radius:16px;background:#fafafa}.npGuideNum{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#ede9fe;color:#6d28d9;font-weight:950}.npGuideStep b{display:block;font-size:14px}.npGuideStep span{display:block;margin-top:3px;color:#64748b;font-size:12px;font-weight:700;line-height:1.4}.npGuideTip{margin-top:14px;padding:12px 13px;border-radius:14px;background:#eff6ff;color:#1e3a8a;font-size:12px;font-weight:800;line-height:1.4}@media(max-width:760px){.npHead{position:sticky;top:0;z-index:2;background:#fff}.npCard{scroll-padding-top:84px}}@media(min-width:761px){.npOverlay{align-items:center;padding:20px}.npCard{border-radius:28px;max-height:88dvh}}';s.textContent+=".npHead.mxApoNotifHead{position:sticky;top:0;z-index:3;background:linear-gradient(110deg,#e8f6ff,#fff)!important;margin:12px 14px 0!important;padding:12px!important;border:1px solid #c4e2fd!important;border-radius:18px!important;align-items:center!important;gap:12px!important}.npHead.mxApoNotifHead>div{min-width:0;flex:1;padding:0!important}.npHead.mxApoNotifHead>div:before{content:\"MÓDULO ACTUAL\";display:block;font-size:9px;color:#0876df;font-weight:900;letter-spacing:.08em;margin-bottom:4px}.npHead.mxApoNotifHead h2{font-size:19px!important;line-height:1.16!important}.npHead.mxApoNotifHead p{font-size:11px!important;margin:4px 0 0!important}.npHead.mxApoNotifHead .npClose{width:40px;height:40px;flex:0 0 40px}";document.head.appendChild(s)}
  function openInstallGuide(){
    document.getElementById('npGuide')?.remove();
    const root=document.createElement('div');root.id='npGuide';root.className='npGuide';
    root.innerHTML=`<section class="npGuideCard" role="dialog" aria-modal="true" aria-label="Cómo abrir o instalar MiCursoX"><div class="npGuideHead"><div><h3>Cómo abrir o instalar MiCursoX</h3><p class="npGuideText">En iPhone, el navegador no puede comprobar si MiCursoX ya está instalada ni abrir automáticamente la versión instalada.</p></div><button class="npGuideClose" type="button" data-guide-close aria-label="Cerrar">×</button></div><div class="npGuideSteps"><div class="npGuideStep"><div class="npGuideNum">1</div><div><b>Si ya la instalaste</b><span>Cierra esta pestaña y abre MiCursoX desde su ícono en la pantalla de inicio. Desde ahí podrás configurar las notificaciones.</span></div></div><div class="npGuideStep"><div class="npGuideNum">2</div><div><b>Si aún no está instalada</b><span>Abre micursox.cl en Safari.</span></div></div><div class="npGuideStep"><div class="npGuideNum">3</div><div><b>Instálala</b><span>En Safari toca Compartir → “Agregar a pantalla de inicio” → Agregar.</span></div></div><div class="npGuideStep"><div class="npGuideNum">4</div><div><b>Ábrela desde el ícono</b><span>Luego entra a Preferencias → Configurar notificaciones.</span></div></div></div><div class="npGuideTip">Apple solo permite Web Push para sitios abiertos como app web desde la pantalla de inicio.</div></section>`;
    root.addEventListener('click',e=>{if(e.target===root||e.target.closest('[data-guide-close]'))root.remove()});
    document.body.appendChild(root);
  }
  async function open(){
    css();document.getElementById('npOverlay')?.remove();
    const info=support();let pref=null;try{pref=(await preference()).row}catch(_){ }
    const pushState=await currentPushState();
    const enabled=info.permission==='granted'&&pref?.push_enabled===true&&pushState.registered===true;
    const state=!info.notification||!info.sw||!info.push?'No disponible en esta pestaña':enabled?'Activas':info.permission==='denied'?'Bloqueadas':'Configuración pendiente';
    const permissionLabel=info.permission==='granted'?'Permitido':info.permission==='denied'?'Bloqueado':info.permission==='default'?'Sin autorizar':'No disponible';
    const pill=!info.notification||!info.sw||!info.push?'Abrir app':enabled?'Activas':'Configurar';
    const cats=[['payments','💰 Pagos y comprobantes'],['campaigns','📅 Campañas'],['announcements','📢 Avisos del curso'],['support','🛠️ Soporte y tickets'],['chat','💬 Chat y mensajes'],['market','🛍️ Mercado Escolar'],['tasks','✅ Tareas y rendiciones'],['system','🔔 Sistema']];
    const root=document.createElement('div');root.id='npOverlay';root.className='npOverlay';
    root.innerHTML=`<section class="npCard"><header class="npHead ${role()==="apoderado"?"mxApoNotifHead":""}"><div><h2>Preferencias de notificaciones</h2><p>Configuración para el rol ${esc(role())}.</p></div><button class="npClose" data-close aria-label="Cerrar">×</button></header><div class="npBody"><div class="npStatus"><div><b>🔔 Notificaciones Push</b><p>Estado: ${esc(state)}</p>${info.notification&&info.sw&&info.push?`<p>Permiso del dispositivo: ${esc(permissionLabel)}</p>`:''}</div><span class="npPill">${esc(pill)}</span></div><div class="npNote">${!info.notification||!info.sw||!info.push?'Para recibir notificaciones en iPhone debes abrir MiCursoX desde el ícono de la pantalla de inicio. Si aún no la instalas, te mostramos cómo hacerlo.':enabled?'Este dispositivo está configurado para recibir notificaciones de MiCursoX. Puedes elegir abajo qué categorías quieres recibir.':'Configura este dispositivo para recibir avisos de pagos, campañas, mensajes y otras novedades de tu curso. Puedes elegir las categorías que quieras recibir.'}</div><div class="npActions"><button class="npBtn primary" ${!info.notification||!info.sw||!info.push?'data-guide':'data-enable'} ${enabled?'disabled':''}>${enabled?'Notificaciones activas':(!info.notification||!info.sw||!info.push?'Cómo abrir/instalar MiCursoX':'Configurar notificaciones')}</button><button class="npBtn" data-test ${enabled?'':'disabled'}>Enviar prueba</button></div><div class="npCats"><h3>Categorías</h3>${cats.map(([k,l])=>`<label class="npRow"><span>${l}</span><input type="checkbox" data-pref="${k}" ${pref?.[k]===false?'':'checked'}></label>`).join('')}</div></div></section>`;
    root.onclick=async e=>{if(e.target===root||e.target.closest('[data-close]')){root.remove();return}if(e.target.closest('[data-guide]')){openInstallGuide();return}if(e.target.closest('[data-enable]')){const b=e.target.closest('[data-enable]');b.disabled=true;try{await activate();alert('Notificaciones activadas correctamente.');root.remove();open()}catch(err){alert(err?.message||String(err));b.disabled=false}return}if(e.target.closest('[data-test]')){try{const n=await test();alert(`Prueba enviada a ${n} dispositivo(s).`)}catch(err){alert(err?.message||String(err))}}};
    root.onchange=async e=>{const input=e.target.closest('[data-pref]');if(!input)return;try{await save({[input.dataset.pref]:!!input.checked})}catch(err){input.checked=!input.checked;alert(err?.message||'No se pudo guardar la preferencia')}};
    document.body.appendChild(root);
  }
  window.CURSAPP_NOTIFICATION_PREFERENCES={open,activate,test,save};
})();
