(function(){
  'use strict';
  if(window.__MICURSOX_ONBOARDING_CONSENT_CAPTURE__) return;
  window.__MICURSOX_ONBOARDING_CONSENT_CAPTURE__ = true;
  const sb=window.CURSAPP_SUPABASE;
  const VERSION='2026-08-19-v1';
  if(!sb||typeof sb.request!=='function'||typeof sb.getCurrentUser!=='function') return;
  const originalFetch=window.fetch.bind(window);
  let writing=false;
  function draft(){try{return JSON.parse(localStorage.getItem('cursapp_onb_draft_v1')||'{}')||{}}catch(_){return{}}}
  function relevant(url,opts){
    if(String(opts?.method||'GET').toUpperCase()!=='POST') return false;
    const u=String(url||'');
    return /\/rest\/v1\/miembros_curso(?:\?|$)/.test(u)||/\/rest\/v1\/rpc\/register_apoderado_by_invite(?:\?|$)/.test(u);
  }
  async function persist(){
    if(writing) return;
    const d=draft();
    if(!d.acceptTerms||!d.acceptPrivacy) return;
    writing=true;
    try{
      const user=await sb.getCurrentUser();
      const existing=await sb.request(`consentimientos_usuario?usuario_id=eq.${encodeURIComponent(user.id)}&select=id,version,terminos_aceptados,privacidad_aceptada&order=fecha_aceptacion.desc&limit=1`);
      if(Array.isArray(existing)&&existing[0]?.terminos_aceptados&&existing[0]?.privacidad_aceptada) return;
      await sb.request('consentimientos_usuario',{method:'POST',body:JSON.stringify({
        usuario_id:user.id,version:VERSION,terminos_aceptados:true,privacidad_aceptada:true,mercado_aceptado:false,
        fecha_aceptacion:new Date().toISOString(),navegador:String(navigator.userAgent||'').slice(0,500)
      })});
    }catch(e){console.warn('[MiCursoX] No se pudo registrar consentimiento',e)}finally{writing=false}
  }
  window.fetch=async function(input,opts){
    const res=await originalFetch(input,opts);
    if(relevant(typeof input==='string'?input:input?.url,opts)&&res.ok){setTimeout(persist,0)}
    return res;
  };
})();