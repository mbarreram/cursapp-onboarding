(function(){
  'use strict';
  const sb=window.CURSAPP_SUPABASE;
  if(!sb||typeof sb.request!=='function'||typeof sb.getCurrentUser!=='function') return;
  window.__MICURSOX_NOTIFICATIONS_CANONICAL__=true;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=c=>({ticket:'🛠️',pago:'💰',payment:'💰',campana:'📅',campaign:'📅',aviso:'📢',announcement:'📢',rendicion:'🧾',rendition:'🧾',mercado:'🛍️',sistema:'🔔',system:'🔔'})[String(c||'').toLowerCase()]||'🔔';
  const ago=v=>{const t=Date.parse(v||'');if(!t)return'';const m=Math.floor((Date.now()-t)/60000);if(m<1)return'Hace segundos';if(m<60)return`Hace ${m} min`;const h=Math.floor(m/60);if(h<24)return`Hace ${h} h`;return`Hace ${Math.floor(h/24)} día(s)`};
  let user=null,rows=[],lastError='';
  const stats=()=>({total:rows.length,unread:rows.filter(x=>!x.is_read).length,read:rows.filter(x=>x.is_read).length,delivered:rows.filter(x=>String(x.delivery_state||'').toLowerCase()==='delivered').length});
  function emit(){try{window.dispatchEvent(new CustomEvent('micursox:notification-stats',{detail:stats()}));}catch(_){}}
  async function load(){
    user=user||await sb.getCurrentUser();
    const data=await sb.request('rpc/get_my_notifications',{method:'POST',body:JSON.stringify({p_limit:100})});
    rows=Array.isArray(data)?data:[];
    lastError='';paintBadge();emit();return rows;
  }
  function setDisplay(el,value){if(el.style.display!==value)el.style.display=value}
  function paintBadge(){
    const n=stats().unread;
    document.querySelectorAll('#tesHeaderBadge,[data-cursapp-bell] em,.apoV42BellDot,#notifBadge,.presNotificationBadge,[data-notification-count]').forEach(el=>{
      if(el.dataset.canonicalNotificationCount!=='1')el.dataset.canonicalNotificationCount='1';
      if(el.classList.contains('apoV42BellDot')){setDisplay(el,n?'block':'none');return}
      const next=n?String(n):'';
      if(el.textContent!==next)el.textContent=next;
      setDisplay(el,n?'inline-flex':'none');
    });
  }
  async function mark(ids){
    ids=Array.from(new Set((ids||[]).filter(Boolean)));
    if(!ids.length)return 0;
    const updated=await sb.request('rpc/mark_my_notifications_read',{method:'POST',body:JSON.stringify({p_ids:ids})});
    if(Number(updated)<1) throw new Error('Supabase no confirmó la lectura de la notificación.');
    await load();
    return Number(updated);
  }
  async function markByCategories(categories){
    const wanted=new Set((categories||[]).map(x=>String(x||'').toLowerCase()));
    if(!rows.length) await load();
    return mark(rows.filter(x=>!x.is_read&&wanted.has(String(x.category||'').toLowerCase())).map(x=>x.id));
  }
  function styles(){if(document.getElementById('cnSupabaseCss'))return;const s=document.createElement('style');s.id='cnSupabaseCss';s.textContent=`.cnOverlay{position:fixed;inset:0;background:rgba(15,23,42,.48);z-index:999999;display:flex;align-items:flex-end;justify-content:center}.cnCard{width:min(760px,100%);max-height:86vh;background:#fff;border-radius:28px 28px 0 0;overflow:hidden;display:flex;flex-direction:column}.cnHead{padding:24px;display:flex;justify-content:space-between;border-bottom:1px solid #e5e7eb}.cnHead h2{margin:0;font-size:28px}.cnHead p{margin:6px 0 0;color:#64748b;font-weight:700}.cnClose{border:1px solid #e5e7eb;background:#fff;border-radius:18px;padding:12px 18px;font-weight:900}.cnList{overflow:auto;-webkit-overflow-scrolling:touch}.cnItem{display:grid;grid-template-columns:54px 1fr;gap:14px;padding:20px 24px;border:0;border-bottom:1px solid #e5e7eb;width:100%;text-align:left;background:#fff;border-left:5px solid transparent}.cnItem.unread{border-left-color:#7c3aed;background:#faf7ff}.cnIcon{width:54px;height:54px;border-radius:18px;background:#f1f5f9;display:grid;place-items:center;font-size:26px}.cnItem b{display:block;font-size:18px}.cnItem p{margin:6px 0;color:#64748b;font-weight:700;line-height:1.35}.cnItem small{color:#94a3b8;font-weight:800}.cnEmpty{padding:28px;color:#64748b;font-weight:800}.cnError{padding:22px 28px;color:#b42318;background:#fff1f0;font-weight:800;line-height:1.4}.cnFoot{padding:16px 24px calc(16px + env(safe-area-inset-bottom));display:flex;gap:12px;border-top:1px solid #e5e7eb}.cnBtn{flex:1;border:0;border-radius:18px;padding:15px;font-weight:900;background:#7c3aed;color:#fff}.cnBtn.ghost{background:#fff;color:#111827;border:1px solid #e5e7eb}@media(max-width:430px){.cnFoot{padding-left:14px;padding-right:14px}.cnBtn{font-size:14px;padding:14px 10px}}@media(min-width:761px){.cnOverlay{align-items:center;padding:20px}.cnCard{border-radius:28px}}`;document.head.appendChild(s)}
  function listHtml(){
    if(lastError)return`<div class="cnError">No se pudieron cargar las notificaciones.<br><small>${esc(lastError)}</small></div>`;
    if(!rows.length)return'<p class="cnEmpty">No tienes notificaciones.</p>';
    return rows.map(n=>`<button type="button" class="cnItem ${n.is_read?'':'unread'}" data-id="${esc(n.id)}" data-url="${esc(n.url_destino||'')}"><span class="cnIcon">${icon(n.category)}</span><span><b>${esc(n.title)}</b><p>${esc(n.message||'')}</p><small>${ago(n.created_at)}</small></span></button>`).join('');
  }
  function openPreferences(){
    const api=window.CURSAPP_NOTIFICATION_PREFERENCES;
    if(api&&typeof api.open==='function'){api.open();return}
    const legacy=window.CURSAPP_NOTIFICATIONS&&window.CURSAPP_NOTIFICATIONS.preferences;
    if(typeof legacy==='function'){legacy();return}
    alert('Las preferencias todavía no están disponibles. Recarga MiCursoX e intenta nuevamente.');
  }
  async function open(){
    styles();try{await load()}catch(e){lastError=e?.message||String(e);console.error('No se pudieron cargar notificaciones',e)}
    document.getElementById('cnOverlay')?.remove();
    const root=document.createElement('div');root.id='cnOverlay';root.className='cnOverlay';
    root.innerHTML=`<section class="cnCard"><header class="cnHead"><div><h2>Notificaciones</h2><p>Centro de actividad sincronizado</p></div><button class="cnClose" type="button" data-close>Cerrar</button></header><div class="cnList">${listHtml()}</div><footer class="cnFoot"><button type="button" class="cnBtn ghost" data-readall>Marcar todas leídas</button><button type="button" class="cnBtn" data-prefs>Preferencias</button></footer></section>`;
    root.addEventListener('click',async e=>{
      if(e.target===root||e.target.closest('[data-close]')){root.remove();return}
      if(e.target.closest('[data-prefs]')){root.remove();openPreferences();return}
      const all=e.target.closest('[data-readall]');
      if(all){all.disabled=true;try{await mark(rows.filter(x=>!x.is_read).map(x=>x.id));root.remove();open()}catch(err){all.disabled=false;alert(err?.message||'No se pudieron marcar como leídas')}return}
      const item=e.target.closest('[data-id]');
      if(item){item.disabled=true;try{await mark([item.dataset.id])}catch(err){item.disabled=false;alert(err?.message||'No se pudo guardar la lectura');return}const url=item.dataset.url;if(url&&url!=='#')location.href=url;else{root.remove();open()}}
    });
    document.body.appendChild(root);
  }
  function isBell(el){
    if(!el)return false;
    if(el.matches('#notificationBtn,#avisosBellHost button,[data-cursapp-bell],#notifBtn,.notificationBtn,.presNotificationBtn'))return true;
    const aria=String(el.getAttribute('aria-label')||'').toLowerCase(),title=String(el.getAttribute('title')||'').toLowerCase(),text=String(el.textContent||'');
    return aria.includes('notific')||title.includes('notific')||text.includes('🔔');
  }
  function isSupport(el){if(!el)return false;if(el.matches('#supportMenuItem,#supportFab,[data-support],[data-open-support]'))return true;return /soporte/i.test(String(el.textContent||'').trim())}
  document.addEventListener('click',e=>{
    const control=e.target.closest('button,a,[role="button"],.card,.section');if(!control)return;
    const text=String(control.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
    if(text.includes('avisos del curso')) setTimeout(()=>markByCategories(['aviso','announcement','campana','campaign']).catch(console.warn),50);
    if(isBell(control)){e.preventDefault();e.stopPropagation();if(typeof e.stopImmediatePropagation==='function')e.stopImmediatePropagation();open();return}
    if(isSupport(control)){const api=window.CURSAPP_SUPPORT;if(api&&typeof api.openMyTickets==='function'){e.preventDefault();e.stopPropagation();if(typeof e.stopImmediatePropagation==='function')e.stopImmediatePropagation();api.openMyTickets()}}
  },true);
  let badgePaintTimer=null;
  const observer=new MutationObserver(mutations=>{
    let needsPaint=false;
    for(const mutation of mutations){
      for(const node of mutation.addedNodes||[]){
        if(node.nodeType!==1)continue;
        if(node.matches?.('#tesHeaderBadge,[data-cursapp-bell],.apoV42BellDot,#notifBadge,.presNotificationBadge,[data-notification-count]')||node.querySelector?.('#tesHeaderBadge,[data-cursapp-bell],.apoV42BellDot,#notifBadge,.presNotificationBadge,[data-notification-count]')){needsPaint=true;break}
      }
      if(needsPaint)break;
    }
    if(!needsPaint)return;
    clearTimeout(badgePaintTimer);
    badgePaintTimer=setTimeout(paintBadge,50);
  });
  function observe(){if(document.body)observer.observe(document.body,{childList:true,subtree:true})}
  async function boot(){try{await load()}catch(e){lastError=e?.message||String(e);console.error('Centro notificaciones:',e)}observe();setInterval(()=>load().catch(e=>{lastError=e?.message||String(e)}),15000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.CURSAPP_NOTIFICATIONS=Object.assign({},window.CURSAPP_NOTIFICATIONS||{},{open,refresh:load,preferences:openPreferences,mark,markByCategories,getStats:stats,getRows:()=>rows.slice()});
})();