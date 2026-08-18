(function(){
  'use strict';
  const sb=window.CURSAPP_SUPABASE;
  if(!sb||typeof sb.request!=='function'||sb.__mxNotificationCourseScope)return;

  const originalRequest=sb.request.bind(sb);
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  let cache={key:'',id:null,at:0};

  function readSession(){
    try{return JSON.parse(localStorage.getItem('cursapp_session_v1')||'{}')||{}}catch(_){return{}}
  }
  function activeRole(){
    const s=readSession();
    const html=String(document.documentElement.getAttribute('data-role')||'').toLowerCase().trim();
    if(html)return html;
    const role=String(s.currentRole||s.activeRole||s.role||'').toLowerCase().trim();
    if(role)return role;
    const p=location.pathname.toLowerCase();
    if(p.includes('presidente'))return'presidente';
    if(p.includes('tesorero'))return'tesorero';
    if(p.includes('apoderado'))return'apoderado';
    return null;
  }
  function activeCourseKey(){
    const s=readSession();
    try{
      return String(localStorage.getItem('cursapp_active_course_v1')||s.courseKey||s.activeCourseKey||'').trim();
    }catch(_){return String(s.courseKey||s.activeCourseKey||'').trim()}
  }
  async function resolveCourseId(){
    const key=activeCourseKey();
    if(!key)return null;
    if(UUID.test(key))return key;
    if(cache.key===key&&Date.now()-cache.at<60000)return cache.id;
    const rows=await originalRequest(`cursos?select=id,course_key&course_key=eq.${encodeURIComponent(key)}&limit=1`,{method:'GET'});
    const row=Array.isArray(rows)?rows[0]:rows;
    cache={key,id:row?.id||null,at:Date.now()};
    return cache.id;
  }
  async function context(){
    return {curso_id:await resolveCourseId(),rol_destino:activeRole()};
  }
  function bodyOf(opts){
    try{return opts&&opts.body?JSON.parse(opts.body):{}}catch(_){return{}}
  }
  function withBody(opts,body){return Object.assign({},opts||{},{method:'POST',body:JSON.stringify(body)})}

  sb.request=async function(path,opts){
    if(path==='rpc/get_my_notifications'){
      const ctx=await context();
      const body=bodyOf(opts);
      return originalRequest('rpc/get_my_notifications_for_context',withBody(opts,{
        p_curso_id:ctx.curso_id,
        p_rol_destino:ctx.rol_destino,
        p_limit:Number(body.p_limit||100)
      }));
    }
    if(path==='rpc/mark_my_notifications_read'){
      const ctx=await context();
      const body=bodyOf(opts);
      return originalRequest('rpc/mark_my_notifications_read_for_context',withBody(opts,{
        p_ids:Array.isArray(body.p_ids)?body.p_ids:[],
        p_curso_id:ctx.curso_id,
        p_rol_destino:ctx.rol_destino
      }));
    }
    return originalRequest(path,opts);
  };

  Object.defineProperty(sb,'__mxNotificationCourseScope',{value:true,configurable:false});
  window.CURSAPP_NOTIFICATION_SCOPE={
    getContext:context,
    clear(){cache={key:'',id:null,at:0}}
  };
  window.addEventListener('storage',e=>{if(e.key==='cursapp_active_course_v1'||e.key==='cursapp_session_v1')cache={key:'',id:null,at:0}});
  window.addEventListener('cursapp:dataChanged',()=>{cache={key:'',id:null,at:0}});
})();