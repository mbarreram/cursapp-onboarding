(function(){
  'use strict';
  const CACHE='cursapp_apoderado_financial_summary_v1';
  let state=null,loading=null;
  const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||'')||d}catch(_){return d}};
  function courseId(){
    const raw=read('cursapp_course_v1',{})||{},c=raw.course||raw;
    return String(c.id||c.curso_id||'').trim();
  }
  function snapshot(){
    if(state)return state;
    const cached=read(CACHE,null);
    return cached&&cached.course_id===courseId()?cached:null;
  }
  async function refresh(){
    if(loading)return loading;
    const cid=courseId(),api=window.CURSAPP_SUPABASE?.request;
    if(!cid||!api)return null;
    loading=api('rpc/apoderado_financial_summary',{method:'POST',body:JSON.stringify({p_curso_id:cid})})
      .then(data=>{state=data||null;if(state)localStorage.setItem(CACHE,JSON.stringify(state));window.dispatchEvent(new CustomEvent('cursapp:apoderado-finanzas',{detail:state}));return state})
      .catch(error=>{console.warn('No se pudo cargar el resumen financiero del curso',error);return null})
      .finally(()=>{loading=null});
    return loading;
  }
  window.CURSAPP_APO_FINANCE={snapshot,refresh};
  window.addEventListener('cursapp:apoderado-finanzas',()=>{if(document.querySelector('.navItem[data-tab="informes"].active')&&typeof window.go==='function')window.go('informes')});
  let tries=0,timer=setInterval(()=>{if(courseId()&&window.CURSAPP_SUPABASE?.request){clearInterval(timer);refresh()}else if(++tries>40)clearInterval(timer)},250);
})();
