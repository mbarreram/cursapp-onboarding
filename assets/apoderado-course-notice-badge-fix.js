(function(){
  'use strict';
  if(window.__MICURSOX_COURSE_NOTICE_BADGE_FIX__) return;
  window.__MICURSOX_COURSE_NOTICE_BADGE_FIX__=true;

  const noticeCategories=new Set(['aviso','announcement','campana','campaign','cuota','curso']);
  let canonicalUnread=0;
  let refreshing=null;
  let markingRead=false;
  let paintTimer=null;
  let refreshTimer=null;
  let generation=0;

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

  function paint(){
    controls().forEach(control=>{
      let badge=control.querySelector('em,.badge,[class*="badge" i],[class*="count" i],[class*="counter" i]');
      if(canonicalUnread<=0){
        if(badge){
          badge.textContent='';
          badge.style.display='none';
          badge.setAttribute('aria-hidden','true');
        }
        return;
      }
      if(!badge){
        badge=document.createElement('em');
        badge.className='mx-course-notice-canonical-badge';
        control.appendChild(badge);
      }
      badge.textContent=String(canonicalUnread);
      badge.style.display='';
      badge.removeAttribute('aria-hidden');
    });
  }

  async function loadRows(){
    const api=window.CURSAPP_SUPABASE;
    if(!api||typeof api.request!=='function') return [];
    const data=await api.request('rpc/get_my_notifications',{method:'POST',body:JSON.stringify({p_limit:200})});
    return Array.isArray(data)?data:[];
  }

  async function refresh(){
    if(markingRead){
      canonicalUnread=0;
      paint();
      return [];
    }
    if(refreshing) return refreshing;
    const requestGeneration=++generation;
    refreshing=loadRows().then(rows=>{
      if(markingRead||requestGeneration!==generation) return rows;
      canonicalUnread=rows.filter(row=>!row.is_read&&noticeCategories.has(String(row.category||'').toLowerCase())).length;
      paint();
      return rows;
    }).catch(error=>{
      console.warn('No se pudo sincronizar el contador de avisos',error);
      paint();
      return [];
    }).finally(()=>{ refreshing=null; });
    return refreshing;
  }

  async function markRead(){
    if(markingRead) return;
    markingRead=true;
    generation+=1;
    canonicalUnread=0;
    paint();
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
      canonicalUnread=0;
      paint();
      setTimeout(refresh,350);
    }
  }

  function scheduleRefresh(delay){
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(refresh,delay||120);
  }

  document.addEventListener('click',event=>{
    const control=event.target?.closest?.('button,a,[role="button"]');
    if(isEnvelopeControl(control)){
      canonicalUnread=0;
      paint();
      markRead();
      return;
    }
    if(control?.matches?.('.navItem,[data-tab],.apoderado-bottom-nav-item')) scheduleRefresh(180);
  },true);

  new MutationObserver(()=>{
    clearTimeout(paintTimer);
    paintTimer=setTimeout(paint,50);
  }).observe(document.documentElement,{subtree:true,childList:true});

  window.addEventListener('pageshow',()=>scheduleRefresh(80));
  window.addEventListener('focus',()=>scheduleRefresh(120));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleRefresh(120)});

  let tries=0;
  const timer=setInterval(()=>{
    if(window.CURSAPP_SUPABASE?.request){
      clearInterval(timer);
      refresh();
    }else if(++tries>40){
      clearInterval(timer);
    }
  },250);
})();