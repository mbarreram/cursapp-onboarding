(function(){
  'use strict';

  function qs(selector){ return document.querySelector(selector); }
  function setMessage(text, isError){
    var box = qs('#pfPasswordMessage');
    if(!box) return;
    box.textContent = text || '';
    box.className = 'profileMessage ' + (isError ? 'error' : 'success');
  }
  function getEmail(){
    try{
      var session = JSON.parse(localStorage.getItem('cursapp_session_v1') || '{}') || {};
      if(session.email) return String(session.email).trim().toLowerCase();
      var auth = JSON.parse(localStorage.getItem('cursapp_supabase_auth_session_v1') || '{}') || {};
      if(auth.user && auth.user.email) return String(auth.user.email).trim().toLowerCase();
    }catch(_){ }
    return '';
  }
  async function reauthenticate(email, password){
    if(!window.CURSAPP_SUPABASE) throw new Error('No se pudo iniciar la conexión con Supabase.');
    var response = await fetch(window.CURSAPP_SUPABASE.url + '/auth/v1/token?grant_type=password', {
      method:'POST',
      headers:{
        apikey: window.CURSAPP_SUPABASE.publishableKey,
        'Content-Type':'application/json'
      },
      body:JSON.stringify({ email:email, password:password })
    });
    var text = await response.text();
    var data = null;
    try{ data = text ? JSON.parse(text) : null; }catch(_){ data = null; }
    if(!response.ok || !data || !data.access_token){
      throw new Error('La contraseña actual no es correcta.');
    }
    return data;
  }
  async function updatePasswordSecure(event){
    var target = event.target && event.target.closest ? event.target.closest('#pfPasswordSave') : null;
    if(!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    var current = String((qs('#pfCurrentPassword') || {}).value || '');
    var next = String((qs('#pfNewPassword') || {}).value || '');
    var confirm = String((qs('#pfConfirmPassword') || {}).value || '');
    var email = getEmail();

    if(!email){ setMessage('No se pudo determinar el correo de la sesión. Vuelve a iniciar sesión.', true); return; }
    if(!current){ setMessage('Ingresa tu contraseña actual.', true); return; }
    if(next.length < 8){ setMessage('La nueva contraseña debe tener al menos 8 caracteres.', true); return; }
    if(next !== confirm){ setMessage('Las contraseñas nuevas no coinciden.', true); return; }
    if(current === next){ setMessage('La nueva contraseña debe ser distinta de la actual.', true); return; }

    target.disabled = true;
    setMessage('Validando contraseña actual…', false);
    try{
      var authSession = await reauthenticate(email, current);
      var response = await fetch(window.CURSAPP_SUPABASE.url + '/auth/v1/user', {
        method:'PUT',
        headers:{
          apikey: window.CURSAPP_SUPABASE.publishableKey,
          Authorization:'Bearer ' + authSession.access_token,
          'Content-Type':'application/json'
        },
        body:JSON.stringify({ password:next })
      });
      var text = await response.text();
      var data = null;
      try{ data = text ? JSON.parse(text) : null; }catch(_){ data = null; }
      if(!response.ok){
        throw new Error((data && (data.message || data.error_description || data.error)) || 'No se pudo actualizar la contraseña.');
      }

      try{
        localStorage.setItem('cursapp_supabase_auth_session_v1', JSON.stringify({
          access_token:authSession.access_token,
          refresh_token:authSession.refresh_token || '',
          expires_at:authSession.expires_at || null,
          user:authSession.user || data || null
        }));
      }catch(_){ }

      if(qs('#pfCurrentPassword')) qs('#pfCurrentPassword').value = '';
      if(qs('#pfNewPassword')) qs('#pfNewPassword').value = '';
      if(qs('#pfConfirmPassword')) qs('#pfConfirmPassword').value = '';
      setMessage('Contraseña actualizada correctamente.', false);
    }catch(error){
      setMessage((error && error.message) || 'No se pudo actualizar la contraseña.', true);
    }finally{
      target.disabled = false;
    }
  }

  document.addEventListener('click', updatePasswordSecure, true);
})();