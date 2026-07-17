(function(){
  "use strict";
  const PREF_KEY="cursapp_profile_comm_prefs_v1";
  const state={prefs:null,counts:{push:0,email:0,sms:0},ready:false};
  try{localStorage.removeItem("cursapp_profile_editable_v1")}catch(e){}
  function session(){try{return(window.CURSAPP&&typeof window.CURSAPP.getSession==="function"?window.CURSAPP.getSession():JSON.parse(localStorage.getItem("cursapp_session_v1")||"{}"))||{}}catch(e){return{}}}
  function uid(){
    const s=session();
    const direct=String(s.auth_user_id||s.authUserId||s.user_uuid||s.usuario_id||s.supabase?.auth_user_id||"").trim();
    if(direct)return direct;
    try{
      const token=window.CURSAPP_SUPABASE?.getAccessToken?.()||"";
      const payload=JSON.parse(atob(String(token).split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      return String(payload.sub||"").trim();
    }catch(e){return""}
  }
  function api(){return window.CURSAPP_SUPABASE?.request}
  function defaults(){return{push:true,email:true,sms:false,push_pagos:true,push_campanas:true,push_avisos:true,push_informes:true,push_mercado:true,email_pagos:true,email_campanas:true,email_avisos:true,email_informes:true,email_mercado:true,sms_activaciones:false,sms_avisos:false}}
  function cachePrefs(p){try{localStorage.setItem(PREF_KEY,JSON.stringify(p))}catch(e){}}
  function mapPrefs(r){const d=defaults();if(!r)return d;return Object.assign(d,{push:r.push_enabled!==false,email:r.email_enabled!==false,sms:false,push_pagos:r.payments!==false,push_campanas:r.campaigns!==false,push_avisos:r.announcements!==false,push_informes:r.tasks!==false,push_mercado:r.market!==false,email_pagos:r.payments!==false,email_campanas:r.campaigns!==false,email_avisos:r.announcements!==false,email_informes:r.tasks!==false,email_mercado:r.market!==false})}
  function publishCounts(){window.__apoProfileCommunicationCounts=Object.assign({push:0,email:0,sms:0},state.counts)}
  function patchProfile(){publishCounts();if(!state.ready)return;const v=[state.counts.push,state.counts.email,state.counts.sms];document.querySelectorAll(".apoProfileSummaryGrid article b").forEach((el,i)=>{if(i<v.length)el.textContent=String(v[i])})}
  async function sync(){if(!uid()||!api()){publishCounts();return false}const since=new Date(Date.now()-30*86400000).toISOString();try{const[prefsRows,notifications]=await Promise.all([api()("notification_preferences?user_id=eq."+encodeURIComponent(uid())+"&rol_destino=eq.apoderado&select=*"),api()("notifications?created_at=gte."+encodeURIComponent(since)+"&select=category,delivery_state,created_at")]);state.prefs=mapPrefs(Array.isArray(prefsRows)?prefsRows[0]:null);cachePrefs(state.prefs);const rows=Array.isArray(notifications)?notifications:[];state.counts={push:rows.length,email:0,sms:0};state.ready=true;patchProfile();return true}catch(e){state.counts={push:0,email:0,sms:0};state.ready=true;patchProfile();console.warn("No se pudo sincronizar el perfil de comunicaciones",e);return false}}
  async function persistPrefs(){if(!uid()||!api())return;let p=defaults();try{p=Object.assign(p,JSON.parse(localStorage.getItem(PREF_KEY)||"{}"))}catch(e){}const body={user_id:uid(),rol_destino:"apoderado",push_enabled:!!p.push,email_enabled:!!p.email,campaigns:!!(p.push_campanas&&p.email_campanas),payments:!!(p.push_pagos&&p.email_pagos),announcements:!!(p.push_avisos&&p.email_avisos),market:!!(p.push_mercado&&p.email_mercado),tasks:!!(p.push_informes&&p.email_informes),updated_at:new Date().toISOString()};try{await api()("notification_preferences?on_conflict=user_id,rol_destino",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(body)});state.prefs=p}catch(e){console.warn("No se pudieron guardar las preferencias",e)}}
  const originalToggle=window.apoProfileToggle;if(typeof originalToggle==="function"){window.apoProfileToggle=function(key){originalToggle(key);persistPrefs();setTimeout(patchProfile,0)}}
  async function edit(field){const current=field==="phone"?"":document.querySelector(".apoProfileHeroText h1")?.textContent||"";const label=field==="phone"?"teléfono":"nombre completo";const value=prompt("Editar "+label,current);if(value===null)return;if(!uid()||!api()){alert("No se pudo identificar tu usuario en Supabase.");return}const body=field==="phone"?{telefono:String(value).trim()}:{nombre:String(value).trim()};try{await api()("usuarios?id=eq."+encodeURIComponent(uid()),{method:"PATCH",body:JSON.stringify(body)});localStorage.removeItem("cursapp_profile_editable_v1");if(window.CURSAPP&&typeof window.CURSAPP.hydrateOperationalFromSupabase==="function")await window.CURSAPP.hydrateOperationalFromSupabase("profile-updated");location.reload()}catch(e){alert("No se pudo actualizar el perfil: "+(e?.message||e))}}
  window.apoProfileEdit=edit;
  publishCounts();
  new MutationObserver(()=>patchProfile()).observe(document.documentElement,{subtree:true,childList:true});
  let tries=0;const timer=setInterval(()=>{if(api()&&uid()){clearInterval(timer);sync()}else if(++tries>40)clearInterval(timer)},250);
})();
