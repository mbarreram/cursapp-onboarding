(function(){
  'use strict';

  var client = null;

  function setMessage(text, isError){
    var box = document.getElementById('resetPasswordMessage');
    if(!box) return;
    box.textContent = text || '';
    box.className = 'resetMessage ' + (isError ? 'isError' : 'isSuccess');
  }

  function getClient(){
    if(client) return client;
    if(!window.CURSAPP_SUPABASE || !window.CURSAPP_SUPABASE.url || !window.CURSAPP_SUPABASE.publishableKey){
      throw new Error('No se pudo iniciar la conexión con Supabase.');
    }
    if(!window.supabase || typeof window.supabase.createClient !== 'function'){
      throw new Error('No se pudo cargar Supabase Auth.');
    }
    client = window.supabase.createClient(
      window.CURSAPP_SUPABASE.url,
      window.CURSAPP_SUPABASE.publishableKey,
      {
        auth:{
          flowType:'pkce',
          detectSessionInUrl:true,
          persistSession:true,
          autoRefreshToken:true,
          storageKey:'micursox_password_recovery_v1'
        }
      }
    );
    return client;
  }

  async function ensureRecoverySession(){
    var auth = getClient();
    var params = new URLSearchParams(window.location.search || '');
    var code = params.get('code');

    if(code && typeof auth.auth.exchangeCodeForSession === 'function'){
      var exchanged = await auth.auth.exchangeCodeForSession(code);
      if(exchanged && exchanged.error) throw exchanged.error;
    }

    var result = await auth.auth.getSession();
    if(result && result.error) throw result.error;
    var session = result && result.data && result.data.session;
    if(!session){
      throw new Error('El enlace de recuperación expiró o ya fue utilizado. Solicita uno nuevo desde el inicio de sesión.');
    }
    return session;
  }

  async function submit(event){
    event.preventDefault();
    var password = String((document.getElementById('newPassword') || {}).value || '');
    var confirmation = String((document.getElementById('confirmPassword') || {}).value || '');
    var button = document.getElementById('resetPasswordButton');

    if(password.length < 8){
      setMessage('La nueva contraseña debe tener al menos 8 caracteres.', true);
      return;
    }
    if(password !== confirmation){
      setMessage('Las contraseñas no coinciden.', true);
      return;
    }

    if(button) button.disabled = true;
    setMessage('Validando enlace y actualizando contraseña…', false);

    try{
      await ensureRecoverySession();
      var result = await getClient().auth.updateUser({ password: password });
      if(result && result.error) throw result.error;
      setMessage('Contraseña actualizada correctamente. Ya puedes iniciar sesión con tu nueva contraseña.', false);
      var p1 = document.getElementById('newPassword');
      var p2 = document.getElementById('confirmPassword');
      if(p1) p1.value = '';
      if(p2) p2.value = '';
      try{ await getClient().auth.signOut(); }catch(_){ }
      setTimeout(function(){ window.location.assign('/login.html?password=updated'); }, 1800);
    }catch(error){
      console.error('Reset password error', error);
      setMessage((error && error.message) || 'No se pudo actualizar la contraseña.', true);
    }finally{
      if(button) button.disabled = false;
    }
  }

  window.addEventListener('DOMContentLoaded', async function(){
    var form = document.getElementById('resetPasswordForm');
    if(form) form.addEventListener('submit', submit);
    try{
      await ensureRecoverySession();
      setMessage('Enlace validado. Ingresa tu nueva contraseña.', false);
    }catch(error){
      setMessage((error && error.message) || 'No se pudo validar el enlace de recuperación.', true);
      var button = document.getElementById('resetPasswordButton');
      if(button) button.disabled = true;
    }
  });
})();