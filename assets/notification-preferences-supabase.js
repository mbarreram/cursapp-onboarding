(function(){
  'use strict';
  const sb=window.CURSAPP_SUPABASE;
  if(!sb||typeof sb.request!=='function'||typeof sb.getCurrentUser!=='function')return;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const role=()=>{const p=location.pathname.toLowerCase();if(p.includes('presidente'))return'presidente';if(p.includes('tesorero'))return'tesorero';return'apoderado'};
  const isStandalone=()=>!!(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||!!navigator.standalone;
  const support=()=>({notification:'Notification'in window,sw:'serviceWorker'in navigator,push:'PushManager'in window,permission:'Notification'in window?Notification.permission:'unsupported',ios:/iphone|ipad|ipod/i.test(navigator.userAgent),standalone:isStandalone()});
  const b64=v=>{const pad='='.repeat((4-v.length%4)%4),raw=atob((v+pad).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...raw].map(x=>x.charCodeAt(0)))};
  const device=()=>{const ua=navigator.userAgent||'';return{platform:/iphone|ipad|ipod/i.test(ua)?'ios':/android/i.test(ua)?'android':'web',browser:/crios|chrome/i.test(ua)?'chrome':/safari/i.test(ua)?'safari':/firefox/i.test(ua)?'firefox':'otro',device:/iphone|ipad|ipod|android/i.test(ua)?'mobile':'desktop'}};
  async function preference(){
    const user=await sb.getCurrentUser();
    const rows=await sb.request(`notification_preferences?select=*&user_id=eq.${encodeURIComponent(user.id)}&rol_destino=eq.${encodeURIComponent(role())}&limit=1`);
    return {user,row:Array.isArray(rows)&&rows[0]?rows[0]:null};
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
  function css(){if(document.getElementById('npSupabaseCss'))return;const s=document.createElement('style');s.id='npSupabaseCss';s.textContent='.npOverlay{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:1000000;display:flex;align-items:flex-end;justify-content:center}.npCard{width:min(760px,100%);max-height:92vh;background:#fff;border-radius:28px 28px 0 0;overflow:auto;padding-bottom:calc(18px + env(safe-area-inset-bottom))}.npHead{padding:24px;display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #e5e7eb}.npHead h2{margin:0;font-size:27px}.npHead p{margin:7px 0 0;color:#64748b;font-weight:700}.npClose,.npBtn{border:1px solid #e5e7eb;background:#fff;border-radius:18px;padding:13px 18px;font-weight:900}.npBody{padding:20px 24px;display:grid;gap:16px}.npStatus{border:1px solid #e5e7eb;border-radius:22px;padding:18px;display:flex;justify-content:space-between;gap:12px}.npStatus b{display:block;font-size:18px}.npStatus p{margin:6px 0 0;color:#64748b;font-weight:700}.npPill{align-self:center;background:#eef2ff;color:#6d28d9;border-radius:999px;padding:10px 14px;font-weight:900}.npActions{display:grid;grid-template-columns:1fr 1fr;gap:12px}.npBtn.primary{background:#7c3aed;color:#fff;border-color:#7c3aed}.npBtn:disabled{opacity:.5}.npNote{background:#f8fafc;border-radius:18px;padding:15px;color:#64748b;font-weight:700;line-height:1.4}.npCats{border-top:1px solid #e5e7eb;padding-top:12px}.npRow{display:flex;justify-content:space-between;align-items:center;padding:14px 2px;border-bottom:1px solid #f1f5f9;font-weight:800}.npRow input{width:24px;height:24px}@media(min-width:761px){.npOverlay{align-items:center;padding:20px}.npCard{border-radius:28px}}';document.head.appendChild(s)}
  async function open(){
    css();document.getElementById('npOverlay')?.remove();
    const info=support();let pref=null;try{pref=(await preference()).row}catch(_){ }
    const enabled=info.permission==='granted'&&pref?.push_enabled!==false;
    const state=!info.notification||!info.sw||!info.push?'No soportadas':enabled?'Activas':info.permission==='denied'?'Bloqueadas':'Pendientes';
    const cats=[['payments','💰 Pagos y comprobantes'],['campaigns','📅 Campañas'],['announcements','📢 Avisos del curso'],['support','🛠️ Soporte y tickets'],['chat','💬 Chat y mensajes'],['market','🛍️ Mercado Escolar'],['tasks','✅ Tareas y rendiciones'],['system','🔔 Sistema']];
    const root=document.createElement('div');root.id='npOverlay';root.className='npOverlay';
    root.innerHTML=`<section class="npCard"><header class="npHead"><div><h2>Preferencias de notificaciones</h2><p>Configuración para el rol ${esc(role())}.</p></div><button class="npClose" data-close>Cerrar</button></header><div class="npBody"><div class="npStatus"><div><b>🔔 Notificaciones Push</b><p>Estado: ${esc(state)} · Permiso: ${esc(info.permission)}</p></div><span class="npPill">${enabled?'Activas':'Pendiente'}</span></div>${info.ios&&!info.standalone?'<div class="npNote">En iPhone debes abrir Cursapp desde el ícono instalado en la pantalla de inicio para activar push.</div>':''}<div class="npActions"><button class="npBtn primary" data-enable ${enabled?'disabled':''}>${enabled?'Notificaciones activas':'Activar notificaciones'}</button><button class="npBtn" data-test ${enabled?'':'disabled'}>Enviar prueba</button></div><div class="npCats"><h3>Categorías</h3>${cats.map(([k,l])=>`<label class="npRow"><span>${l}</span><input type="checkbox" data-pref="${k}" ${pref?.[k]===false?'':'checked'}></label>`).join('')}</div></div></section>`;
    root.onclick=async e=>{if(e.target===root||e.target.closest('[data-close]')){root.remove();return}if(e.target.closest('[data-enable]')){const b=e.target.closest('[data-enable]');b.disabled=true;try{await activate();alert('Notificaciones activadas correctamente.');root.remove();open()}catch(err){alert(err?.message||String(err));b.disabled=false}return}if(e.target.closest('[data-test]')){try{const n=await test();alert(`Prueba enviada a ${n} dispositivo(s).`)}catch(err){alert(err?.message||String(err))}}};
    root.onchange=async e=>{const input=e.target.closest('[data-pref]');if(!input)return;try{await save({[input.dataset.pref]:!!input.checked})}catch(err){input.checked=!input.checked;alert(err?.message||'No se pudo guardar la preferencia')}};
    document.body.appendChild(root);
  }
  window.CURSAPP_NOTIFICATION_PREFERENCES={open,activate,test,save};
})();
