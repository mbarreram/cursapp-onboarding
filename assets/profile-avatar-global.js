(function(){
  'use strict';
  if(window.__MICURSOX_PROFILE_AVATAR_GLOBAL__) return;
  window.__MICURSOX_PROFILE_AVATAR_GLOBAL__=true;
  const sb=window.CURSAPP_SUPABASE;
  const MAX=2*1024*1024;
  const ALLOWED=new Set(['image/jpeg','image/png','image/webp']);
  let picker=null,url='',loaded=false;

  function css(){
    if(document.getElementById('mxGlobalAvatarCss')) return;
    const s=document.createElement('style');s.id='mxGlobalAvatarCss';s.textContent=`
      body.cursapp-profile .profileAvatar.mxHasAvatar{position:relative!important;overflow:visible!important;background:#eef2f7!important;color:transparent!important}
      body.cursapp-profile .profileAvatar.mxHasAvatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:20px}
      body.cursapp-profile .profileAvatar .mxAvatarEdit{position:absolute;right:-8px;bottom:-8px;width:31px;height:31px;border:3px solid #fff;border-radius:50%;background:#6d28d9;color:#fff;display:grid;place-items:center;font-size:14px;box-shadow:0 5px 14px rgba(15,23,42,.2);z-index:3;padding:0}
    `;document.head.appendChild(s);
  }
  async function user(){
    if(!sb||typeof sb.getCurrentUser!=='function') throw new Error('No se pudo identificar tu sesión.');
    return sb.getCurrentUser();
  }
  function input(){
    if(picker) return picker;
    picker=document.createElement('input');picker.type='file';picker.accept='image/jpeg,image/png,image/webp';picker.hidden=true;
    picker.onchange=async()=>{const f=picker.files?.[0];picker.value='';if(!f)return;try{await upload(f)}catch(e){alert('No se pudo actualizar la foto: '+(e?.message||e))}};
    document.body.appendChild(picker);return picker;
  }
  async function upload(file){
    if(!ALLOWED.has(String(file.type||'').toLowerCase())) throw new Error('Usa una imagen JPG, PNG o WebP.');
    if(Number(file.size||0)>MAX) throw new Error('La imagen debe pesar máximo 2 MB.');
    const u=await user();
    const headers=await sb.headers({'Content-Type':file.type,'x-upsert':'true'});delete headers.Prefer;
    const res=await fetch(`${sb.url}/storage/v1/object/profile-avatars/${encodeURIComponent(u.id)}/avatar`,{method:'POST',headers,body:file});
    const text=await res.text();if(!res.ok){let d=null;try{d=text?JSON.parse(text):null}catch(_){};throw new Error(d?.message||d?.error||text||`HTTP ${res.status}`)}
    const publicUrl=`${sb.url}/storage/v1/object/public/profile-avatars/${u.id}/avatar`;
    await sb.request(`usuarios?id=eq.${encodeURIComponent(u.id)}`,{method:'PATCH',body:JSON.stringify({avatar_url:publicUrl})});
    url=publicUrl+'?v='+Date.now();loaded=true;paint();
    window.dispatchEvent(new CustomEvent('cursapp:profile-avatar-updated',{detail:{avatar_url:publicUrl}}));
  }
  async function load(){
    if(loaded||!sb?.request) return;
    try{const u=await user();const rows=await sb.request(`usuarios?id=eq.${encodeURIComponent(u.id)}&select=avatar_url&limit=1`);const raw=Array.isArray(rows)&&rows[0]?String(rows[0].avatar_url||'').trim():'';url=raw?raw+(raw.includes('?')?'&':'?')+'v=profile':'';loaded=true;paint()}catch(e){console.warn('[MiCursoX] avatar perfil',e)}
  }
  function paint(){
    css();const host=document.querySelector('.profileIdentity .profileAvatar');if(!host)return;
    host.classList.remove('mx-role-brand-icon');
    host.style.setProperty('background-image','none','important');
    if(url){host.classList.add('mxHasAvatar');let img=host.querySelector('img');if(!img){img=document.createElement('img');img.alt='Foto de perfil';host.prepend(img)}img.src=url}else{host.classList.remove('mxHasAvatar');host.querySelector('img')?.remove()}
    if(!host.querySelector('.mxAvatarEdit')){const b=document.createElement('button');b.type='button';b.className='mxAvatarEdit';b.setAttribute('aria-label','Cambiar foto de perfil');b.textContent='📷';b.onclick=e=>{e.preventDefault();e.stopPropagation();input().click()};host.appendChild(b)}
  }
  const mo=new MutationObserver(()=>{paint();if(!loaded)load()});mo.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{paint();load()},{once:true});else{paint();load()}
})();