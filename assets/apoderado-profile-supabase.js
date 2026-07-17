(function(){
  "use strict";
  try{ localStorage.removeItem("cursapp_profile_editable_v1"); }catch(e){}

  function session(){
    try{return (window.CURSAPP&&typeof window.CURSAPP.getSession==="function"?window.CURSAPP.getSession():JSON.parse(localStorage.getItem("cursapp_session_v1")||"{}"))||{}}
    catch(e){return{}}
  }
  async function edit(field){
    const current=field==="phone"?"":document.querySelector(".apoProfileHeroText h1")?.textContent||"";
    const label=field==="phone"?"teléfono":"nombre completo";
    const value=prompt("Editar "+label,current);
    if(value===null)return;
    const s=session();
    const uid=String(s.auth_user_id||s.authUserId||s.user_uuid||s.usuario_id||s.supabase?.auth_user_id||"").trim();
    if(!uid||!window.CURSAPP_SUPABASE||typeof window.CURSAPP_SUPABASE.request!=="function"){
      alert("No se pudo identificar tu usuario en Supabase."); return;
    }
    const body=field==="phone"?{telefono:String(value).trim()}:{nombre:String(value).trim()};
    try{
      await window.CURSAPP_SUPABASE.request("usuarios?id=eq."+encodeURIComponent(uid),{method:"PATCH",body:JSON.stringify(body)});
      localStorage.removeItem("cursapp_profile_editable_v1");
      if(window.CURSAPP&&typeof window.CURSAPP.hydrateOperationalFromSupabase==="function") await window.CURSAPP.hydrateOperationalFromSupabase("profile-updated");
      location.reload();
    }catch(e){alert("No se pudo actualizar el perfil: "+(e?.message||e))}
  }
  window.apoProfileEdit=edit;
})();