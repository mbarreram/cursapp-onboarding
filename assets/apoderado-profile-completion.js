(function(){
  'use strict';
  if(window.__MICURSOX_APODERADO_PROFILE_COMPLETION__) return;
  window.__MICURSOX_APODERADO_PROFILE_COMPLETION__ = true;

  const sb = window.CURSAPP_SUPABASE;
  const MAX_BYTES = 2 * 1024 * 1024;
  const ALLOWED = new Set(['image/jpeg','image/png','image/webp']);
  let avatarUrl = '';
  let avatarLoaded = false;
  let picker = null;

  function esc(v){ return String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  async function currentUser(){
    if(!sb || typeof sb.getCurrentUser !== 'function') throw new Error('No se pudo identificar la sesión.');
    return sb.getCurrentUser();
  }

  function ensurePicker(){
    if(picker) return picker;
    picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = 'image/jpeg,image/png,image/webp';
    picker.hidden = true;
    picker.addEventListener('change', async function(){
      const file = picker.files && picker.files[0];
      picker.value = '';
      if(!file) return;
      try { await uploadAvatar(file); }
      catch(e){ alert('No se pudo actualizar la foto: ' + (e?.message || e)); }
    });
    document.body.appendChild(picker);
    return picker;
  }

  function openPicker(){ ensurePicker().click(); }

  async function uploadAvatar(file){
    if(!ALLOWED.has(String(file.type || '').toLowerCase())) throw new Error('Usa una imagen JPG, PNG o WebP.');
    if(Number(file.size || 0) > MAX_BYTES) throw new Error('La imagen debe pesar máximo 2 MB.');
    const user = await currentUser();
    const path = `${user.id}/avatar`;
    const headers = await sb.headers({'Content-Type':file.type,'x-upsert':'true'});
    delete headers.Prefer;
    const res = await fetch(`${sb.url}/storage/v1/object/profile-avatars/${encodeURIComponent(user.id)}/avatar`,{
      method:'POST',headers,body:file
    });
    const text = await res.text();
    if(!res.ok){
      let data=null; try{data=text?JSON.parse(text):null}catch(_){ }
      throw new Error(data?.message || data?.error || text || `HTTP ${res.status}`);
    }
    const publicUrl = `${sb.url}/storage/v1/object/public/profile-avatars/${path}`;
    await sb.request(`usuarios?id=eq.${encodeURIComponent(user.id)}`,{
      method:'PATCH',
      body:JSON.stringify({avatar_url:publicUrl})
    });
    avatarUrl = publicUrl + '?v=' + Date.now();
    avatarLoaded = true;
    applyAvatar();
    try{ window.dispatchEvent(new CustomEvent('cursapp:profile-avatar-updated',{detail:{avatar_url:publicUrl}})); }catch(_){ }
  }

  async function loadAvatar(){
    if(avatarLoaded || !sb || typeof sb.request !== 'function') return;
    try{
      const user = await currentUser();
      const rows = await sb.request(`usuarios?id=eq.${encodeURIComponent(user.id)}&select=avatar_url&limit=1`);
      const raw = Array.isArray(rows) && rows[0] ? String(rows[0].avatar_url || '').trim() : '';
      avatarUrl = raw ? raw + (raw.includes('?')?'&':'?') + 'v=profile' : '';
      avatarLoaded = true;
      applyAvatar();
    }catch(e){
      console.warn('[MiCursoX] No se pudo cargar avatar',e);
    }
  }

  function applyAvatar(){
    const host = document.querySelector('.apoProfileAvatar');
    if(!host) return;
    host.classList.toggle('hasPhoto',!!avatarUrl);
    let img = host.querySelector('img.mxProfileAvatarImage');
    if(avatarUrl){
      if(!img){
        img = document.createElement('img');
        img.className = 'mxProfileAvatarImage';
        img.alt = 'Foto de perfil';
        host.prepend(img);
      }
      if(img.src !== avatarUrl) img.src = avatarUrl;
      const initials = host.querySelector(':scope > span');
      if(initials) initials.style.visibility = 'hidden';
    }else{
      if(img) img.remove();
      const initials = host.querySelector(':scope > span');
      if(initials) initials.style.visibility = '';
    }
  }

  function injectCss(){
    if(document.getElementById('mxProfileCompletionCss')) return;
    const s=document.createElement('style');
    s.id='mxProfileCompletionCss';
    s.textContent=`.apoProfileAvatar{position:relative;overflow:visible}.apoProfileAvatar .mxProfileAvatarImage{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;z-index:0}.apoProfileAvatar>span{position:relative;z-index:1}.apoProfileAvatar>button{position:relative;z-index:2}.apoProfileAvatar.hasPhoto{background:#eef2f7}`;
    document.head.appendChild(s);
  }

  function openNotificationPreferences(){
    const api = window.CURSAPP_NOTIFICATION_PREFERENCES;
    if(api && typeof api.open === 'function') return api.open();
    alert('Las preferencias de notificaciones aún se están cargando. Intenta nuevamente en unos segundos.');
  }

  function patchGlobals(){
    window.apoProfileOpenPrefs = openNotificationPreferences;
  }

  document.addEventListener('click',function(ev){
    const target = ev.target;
    const avatarButton = target?.closest?.('.apoProfileAvatar button');
    const profileRow = target?.closest?.('.apoProfileRow');
    const rowTitle = String(profileRow?.querySelector('b')?.textContent || '').trim().toLowerCase();
    if(avatarButton || (profileRow && rowTitle === 'foto de perfil' && target.closest('button'))){
      ev.preventDefault(); ev.stopImmediatePropagation(); openPicker(); return;
    }
    const quick = target?.closest?.('.cpV5Quick');
    if(quick && /ayuda/i.test(quick.textContent || '')){
      ev.preventDefault(); ev.stopImmediatePropagation();
      if(typeof window.openHelp === 'function') window.openHelp('general');
      else alert('Centro de ayuda no disponible en este momento.');
      return;
    }
  },true);

  injectCss();
  patchGlobals();
  loadAvatar();
  const app = document.getElementById('app');
  if(app){
    const mo = new MutationObserver(function(){
      if(document.querySelector('.apoProfileAvatar')){
        applyAvatar();
        patchGlobals();
      }
    });
    mo.observe(app,{childList:true,subtree:true});
  }
  window.addEventListener('cursapp:profile-opened',function(){ loadAvatar(); setTimeout(applyAvatar,0); });
})();
