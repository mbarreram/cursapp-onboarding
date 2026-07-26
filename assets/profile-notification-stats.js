(function(){
  'use strict';
  function pushStatus(){
    try{
      const supported='Notification' in window&&'serviceWorker' in navigator;
      if(!supported)return{label:'No compatible',className:'off'};
      if(Notification.permission==='granted')return{label:'Activadas',className:'ok'};
      if(Notification.permission==='denied')return{label:'Bloqueadas',className:'off'};
      return{label:'Pendientes',className:'pending'};
    }catch(_){return{label:'No disponible',className:'off'}}
  }
  function ensureStyles(){
    if(document.getElementById('profileNotifStatsCss'))return;
    const style=document.createElement('style');style.id='profileNotifStatsCss';style.textContent=`.profileNotifStats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:14px 0}.profileNotifStat{padding:14px;border:1px solid #e8e5f4;border-radius:16px;background:#fff}.profileNotifStat span{display:block;color:#64748b;font-size:12px;font-weight:800}.profileNotifStat b{display:block;margin-top:4px;font-size:24px;color:#0f172a}.profilePushStatus{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 0;border-top:1px solid #eef2f7}.profilePushStatus em{font-style:normal;font-weight:900;padding:6px 10px;border-radius:999px;background:#f1f5f9;color:#475569}.profilePushStatus em.ok{background:#dcfce7;color:#15803d}.profilePushStatus em.pending{background:#fef3c7;color:#a16207}.profilePushStatus em.off{background:#fee2e2;color:#b91c1c}@media(max-width:520px){.profileNotifStats{grid-template-columns:1fr 1fr}.profileNotifStat:first-child{grid-column:1/-1}}`;document.head.appendChild(style);
  }
  function render(stats){
    const root=document.getElementById('perfilContent');if(!root)return;
    let card=document.getElementById('profileNotificationSummary');
    if(!card){
      card=document.createElement('section');card.id='profileNotificationSummary';card.className='card profileCard';
      const target=Array.from(root.querySelectorAll('.profileCard')).find(el=>/Notificaciones/i.test(el.textContent||''));
      if(target)target.insertAdjacentElement('beforebegin',card);else root.appendChild(card);
    }
    const push=pushStatus();
    card.innerHTML=`<div class="profileTitleRow"><div><div class="h2">Actividad de notificaciones</div><div class="muted">Datos reales sincronizados desde Supabase</div></div></div><div class="profileNotifStats"><div class="profileNotifStat"><span>Recibidas</span><b>${Number(stats.total||0)}</b></div><div class="profileNotifStat"><span>No leídas</span><b>${Number(stats.unread||0)}</b></div><div class="profileNotifStat"><span>Leídas</span><b>${Number(stats.read||0)}</b></div></div><div class="profilePushStatus"><span><b>Push en este dispositivo</b><small style="display:block;color:#64748b;margin-top:3px">Permiso del navegador para recibir alertas</small></span><em class="${push.className}">${push.label}</em></div><button type="button" class="btnPrimary profileWideButton" id="profileOpenNotifications">Abrir notificaciones</button>`;
    const btn=document.getElementById('profileOpenNotifications');if(btn)btn.onclick=()=>window.CURSAPP_NOTIFICATIONS?.open?.();
  }
  async function refresh(){
    try{
      const api=window.CURSAPP_NOTIFICATIONS;
      if(api&&typeof api.refresh==='function')await api.refresh();
      const stats=api&&typeof api.getStats==='function'?api.getStats():{total:0,unread:0,read:0};
      render(stats);
    }catch(e){console.warn('No se pudieron cargar estadísticas de notificaciones',e);render({total:0,unread:0,read:0})}
  }
  window.addEventListener('micursox:notification-stats',e=>render(e.detail||{}));
  const observer=new MutationObserver(()=>{if(document.getElementById('perfilContent')?.children.length&&!document.getElementById('profileNotificationSummary'))refresh()});
  function boot(){ensureStyles();observer.observe(document.getElementById('perfilContent')||document.body,{childList:true,subtree:true});setTimeout(refresh,300);setTimeout(refresh,1400)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();