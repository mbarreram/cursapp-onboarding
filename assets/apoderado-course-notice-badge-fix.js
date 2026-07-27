(function(){
  'use strict';
  if(window.__MICURSOX_COURSE_NOTICE_BADGE_FIX__) return;
  window.__MICURSOX_COURSE_NOTICE_BADGE_FIX__=true;

  const sb=()=>window.CURSAPP_SUPABASE;
  let suppressUntil=0;

  function isEnvelopeControl(el){
    if(!el) return false;
    const aria=String(el.getAttribute?.('aria-label')||'').toLowerCase();
    const title=String(el.getAttribute?.('title')||'').toLowerCase();
    const text=String(el.textContent||'').toLowerCase();
    return text.includes('✉')||text.includes('📩')||text.includes('📨')||aria.includes('aviso del curso')||title.includes('aviso del curso');
  }

  function envelopeControls(){
    return Array.from(document.querySelectorAll('button,a,[role="button"]')).filter(isEnvelopeControl);
  }

  function clearLegacyBadge(){
    envelopeControls().forEach(control=>{
      control.querySelectorAll('em,.badge,[class*="badge" i],[class*="count" i],[class*="counter" i]').forEach(badge=>{
        const value=String(badge.textContent||'').trim();
        if(/^\d+$/.test(value)||badge.matches('em,[class*="badge" i]')){
          badge.textContent='';
          badge.style.display='none';
          badge.setAttribute('aria-hidden','true');
        }
      });
    });
  }

  async function markCourseNoticesRead(){
    const api=sb();
    if(!api||typeof api.request!=='function') return;
    try{
      const data=await api.request('rpc/get_my_notifications',{method:'POST',body:JSON.stringify({p_limit:200})});
      const rows=Array.isArray(data)?data:[];
      const noticeIds=rows.filter(row=>{
        const category=String(row.category||'').toLowerCase();
        return !row.is_read && ['aviso','announcement','campana','campaign','cuota'].includes(category);
      }).map(row=>row.id).filter(Boolean);
      if(noticeIds.length){
        await api.request('rpc/mark_my_notifications_read',{method:'POST',body:JSON.stringify({p_ids:noticeIds})});
      }
      if(window.CURSAPP_NOTIFICATIONS&&typeof window.CURSAPP_NOTIFICATIONS.refresh==='function'){
        await window.CURSAPP_NOTIFICATIONS.refresh();
      }
    }catch(error){
      console.warn('No se pudo sincronizar la lectura de avisos del curso',error);
    }finally{
      suppressUntil=Date.now()+8000;
      clearLegacyBadge();
    }
  }

  document.addEventListener('click',event=>{
    const control=event.target&&event.target.closest?event.target.closest('button,a,[role="button"]'):null;
    if(!isEnvelopeControl(control)) return;
    suppressUntil=Date.now()+8000;
    clearLegacyBadge();
    markCourseNoticesRead();
    [100,350,900,1800,3500,6500].forEach(ms=>setTimeout(clearLegacyBadge,ms));
  },true);

  const observer=new MutationObserver(()=>{
    if(Date.now()<suppressUntil) clearLegacyBadge();
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['style','class']});

  window.addEventListener('pageshow',()=>{
    if(Date.now()<suppressUntil) clearLegacyBadge();
  });
})();
