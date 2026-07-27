(function(){
  'use strict';
  if(window.__MICURSOX_COURSE_NOTICE_BADGE_FIX__) return;
  window.__MICURSOX_COURSE_NOTICE_BADGE_FIX__=true;

  const noticeCategories=new Set(['aviso','announcement','campana','campaign','cuota','curso']);
  let markingRead=false;

  function isEnvelopeControl(el){
    if(!el) return false;
    const aria=String(el.getAttribute?.('aria-label')||'').toLowerCase();
    const title=String(el.getAttribute?.('title')||'').toLowerCase();
    const text=String(el.textContent||'').toLowerCase();
    return text.includes('✉')||text.includes('📩')||text.includes('📨')||aria.includes('aviso del curso')||title.includes('aviso del curso');
  }

  function controls(){
    return Array.from(document.querySelectorAll('button,a,[role="button"]')).filter(isEnvelopeControl);
  }

  function clearLegacyBadges(){
    controls().forEach(control=>{
      control.classList.add('mx-course-envelope-canonical');
      control.querySelectorAll('em,.badge,[class*="badge" i],[class*="count" i],[class*="counter" i]').forEach(badge=>{
        badge.textContent='';
        badge.style.setProperty('display','none','important');
        badge.setAttribute('aria-hidden','true');
      });
    });
  }

  const style=document.createElement('style');
  style.textContent='.mx-course-envelope-canonical em,.mx-course-envelope-canonical .badge,.mx-course-envelope-canonical [class*="badge" i],.mx-course-envelope-canonical [class*="count" i],.mx-course-envelope-canonical [class*="counter" i]{display:none!important}';
  document.head.appendChild(style);

  async function loadRows(){
    const api=window.CURSAPP_SUPABASE;
    if(!api||typeof api.request!=='function') return [];
    const data=await api.request('rpc/get_my_notifications',{method:'POST',body:JSON.stringify({p_limit:200})});
    return Array.isArray(data)?data:[];
  }

  async function markRead(){
    if(markingRead) return;
    markingRead=true;
    clearLegacyBadges();
    try{
      const rows=await loadRows();
      const ids=rows.filter(row=>!row.is_read&&noticeCategories.has(String(row.category||'').toLowerCase())).map(row=>row.id).filter(Boolean);
      if(ids.length){
        await window.CURSAPP_SUPABASE.request('rpc/mark_my_notifications_read',{method:'POST',body:JSON.stringify({p_ids:ids})});
      }
      if(window.CURSAPP_NOTIFICATIONS?.refresh) await window.CURSAPP_NOTIFICATIONS.refresh();
    }catch(error){
      console.warn('No se pudo marcar avisos como leídos',error);
    }finally{
      markingRead=false;
      clearLegacyBadges();
    }
  }

  document.addEventListener('click',event=>{
    const control=event.target?.closest?.('button,a,[role="button"]');
    if(isEnvelopeControl(control)) markRead();
  },true);

  new MutationObserver(clearLegacyBadges).observe(document.documentElement,{subtree:true,childList:true});
  document.addEventListener('DOMContentLoaded',clearLegacyBadges);
  window.addEventListener('pageshow',clearLegacyBadges);
})();