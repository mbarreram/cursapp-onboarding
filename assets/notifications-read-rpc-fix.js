(function(){
  'use strict';
  const sb=window.CURSAPP_SUPABASE;
  if(!sb||typeof sb.request!=='function')return;
  async function mark(ids){
    const clean=(ids||[]).filter(Boolean);
    if(!clean.length)return;
    await sb.request('rpc/mark_my_notifications_read',{method:'POST',body:JSON.stringify({p_ids:clean})});
  }
  document.addEventListener('click',async function(e){
    const all=e.target.closest('#cnOverlay [data-readall]');
    const item=e.target.closest('#cnOverlay [data-id]');
    if(!all&&!item)return;
    e.preventDefault();
    e.stopPropagation();
    if(typeof e.stopImmediatePropagation==='function')e.stopImmediatePropagation();
    try{
      const ids=all
        ? Array.from(document.querySelectorAll('#cnOverlay [data-id]')).map(x=>x.dataset.id)
        : [item.dataset.id];
      await mark(ids);
      if(window.CURSAPP_NOTIFICATIONS?.refresh)await window.CURSAPP_NOTIFICATIONS.refresh();
      document.getElementById('cnOverlay')?.remove();
      if(all){window.CURSAPP_NOTIFICATIONS?.open?.();return;}
      const url=item.dataset.url;
      if(url&&url!=='#')location.href=url;
    }catch(err){
      console.error('No se pudieron marcar notificaciones',err);
      alert(err?.message||'No se pudieron marcar como leídas.');
    }
  },true);
})();