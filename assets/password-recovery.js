(function(){
  'use strict';

  function message(text, isError){
    var box = document.getElementById('recoveryMessage');
    if(!box) return;
    box.textContent = text || '';
    box.className = 'recoveryMessage ' + (isError ? 'isError' : 'isSuccess');
  }

  function validEmail(value){
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
  }

  function getClient(){
    if(!window.CURSAPP_SUPABASE || !window.CURSAPP_SUPABASE.url || !window.CURSAPP_SUPABASE.publishableKey){
      throw new Error('No se pudo iniciar la conexión con Supabase.');
    }
    if(!window.supabase || typeof window.supabase.createClient !== 'function'){
      throw new Error('No se pudo cargar Supabase Auth.');
    }
    return window.supabase.createClient(
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
  }

  async function sendRecovery(){
    var input = document.getElementById('username');
    var button = document.getElementById('forgotPasswordBtn');
    var email = String(input && input.value || '').trim().toLowerCase();

    if(!validEmail(email)){
      message('Ingresa primero el correo de tu cuenta MiCursoX.', true);
      if(input) input.focus();
      return;
    }

    if(button) button.disabled = true;
    message('Enviando enlace de recuperación…', false);

    try{
      var client = getClient();
      var redirectTo = new URL('/reset-password.html', window.location.origin).toString();
      var result = await client.auth.resetPasswordForEmail(email, { redirectTo: redirectTo });
      if(result && result.error) throw result.error;
      message('Te enviamos un correo para crear una nueva contraseña. Revisa también spam o promociones.', false);
    }catch(error){
      console.error('Password recovery error', error);
      message((error && error.message) || 'No se pudo enviar el correo de recuperación.', true);
    }finally{
      if(button) button.disabled = false;
    }
  }

  window.addEventListener('DOMContentLoaded', function(){
    var button = document.getElementById('forgotPasswordBtn');
    if(button) button.addEventListener('click', sendRecovery);
  });
})();