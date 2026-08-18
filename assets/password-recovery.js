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

  async function sendRecovery(){
    var input = document.getElementById('username');
    var button = document.getElementById('forgotPasswordBtn');
    var email = String(input && input.value || '').trim().toLowerCase();

    if(!validEmail(email)){
      message('Ingresa primero el correo de tu cuenta MiCursoX.', true);
      if(input) input.focus();
      return;
    }

    if(!window.CURSAPP_SUPABASE || !window.CURSAPP_SUPABASE.url || !window.CURSAPP_SUPABASE.publishableKey){
      message('No se pudo iniciar la conexión con Supabase.', true);
      return;
    }

    if(button) button.disabled = true;
    message('Enviando enlace de recuperación…', false);

    try{
      var redirectTo = new URL('/reset-password.html', window.location.origin).toString();
      var response = await fetch(window.CURSAPP_SUPABASE.url + '/functions/v1/password-recovery-email', {
        method: 'POST',
        headers: {
          apikey: window.CURSAPP_SUPABASE.publishableKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: email, redirectTo: redirectTo })
      });

      if(!response.ok){
        throw new Error('No se pudo procesar la solicitud de recuperación.');
      }

      // Respuesta genérica: evita revelar si el correo existe o no.
      message('Si el correo está registrado en MiCursoX, recibirás un enlace para crear una nueva contraseña. Revisa también spam o promociones.', false);
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