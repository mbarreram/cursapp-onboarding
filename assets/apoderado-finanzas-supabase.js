(function(){
  'use strict';
  const CACHE='cursapp_apoderado_financial_summary_v1';
  let state=null,loading=null,lastSignature='';
  const read=(k,d)=>{try{const raw=localStorage.getItem(k);return raw?JSON.parse(raw):d}catch(_){return d}};
  const clean=v=>String(v||'').trim();
  const signature=value=>{try{return JSON.stringify(value&&typeof value==='object'?value:{});}catch(_){return '';}};

  function firstId(source){
    if(!source||typeof source!=='object')return '';
    const nested=source.course||source.curso||source.supabase||{};
    return clean(source.curso_id||source.courseId||source.course_id||source.id||nested.curso_id||nested.courseId||nested.course_id||nested.id);
  }

  function courseId(){
    const candidates=[
      read('cursapp_course_v1',null),
      read('cursapp_active_profile_v1',null),
      read('cursapp_alumno_activo_v1',null),
      read('cursapp_session_v1',null),
      read('cursapp_demo_user',null)
    ];
    for(const candidate of candidates){
      const id=firstId(candidate);
      if(id)return id;
    }
    return '';
  }

  function snapshot(){
    const cid=courseId();
    if(state&&(!cid||clean(state.course_id)===cid))return state;
    const cached=read(CACHE,null);
    if(cached&&cid&&clean(cached.course_id)===cid){state=cached;lastSignature=signature(cached);return cached;}
    if(cached&&cid&&clean(cached.course_id)!==cid){try{localStorage.removeItem(CACHE)}catch(_){} }
    return null;
  }

  async function refresh(){
    if(loading)return loading;
    const cid=courseId(),api=window.CURSAPP_SUPABASE?.request;
    if(!cid||!api)return null;
    const cached=read(CACHE,null);
    if(cached&&clean(cached.course_id)!==cid){try{localStorage.removeItem(CACHE)}catch(_){} }
    loading=api('rpc/apoderado_financial_summary',{method:'POST',body:JSON.stringify({p_curso_id:cid})})
      .then(data=>{
        const next=data&&typeof data==='object'?data:null;
        const nextSignature=signature(next);
        const changed=nextSignature!==lastSignature;
        state=next;
        if(state){
          lastSignature=nextSignature;
          const serialized=JSON.stringify(state);
          if(localStorage.getItem(CACHE)!==serialized)localStorage.setItem(CACHE,serialized);
        }
        if(changed)window.dispatchEvent(new CustomEvent('cursapp:apoderado-finanzas',{detail:state}));
        return state;
      })
      .catch(error=>{console.warn('No se pudo cargar el resumen financiero del curso',error);return null})
      .finally(()=>{loading=null});
    return loading;
  }

  window.CURSAPP_APO_FINANCE={snapshot,refresh,courseId};
  window.addEventListener('cursapp:dataChanged',event=>{
    const key=String(event?.detail?.key||'');
    if(/course|profile|alumno|session/i.test(key)){state=null;lastSignature='';refresh();}
  });
  let tries=0,timer=setInterval(()=>{
    if(courseId()&&window.CURSAPP_SUPABASE?.request){clearInterval(timer);refresh();}
    else if(++tries>60)clearInterval(timer);
  },250);
})();