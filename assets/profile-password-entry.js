(function(){
  'use strict';
  if(window.__MICURSOX_PROFILE_PASSWORD_ENTRY__) return;
  window.__MICURSOX_PROFILE_PASSWORD_ENTRY__ = true;

  function isPasswordRow(el){
    if(!el) return false;
    var row = el.closest && el.closest('.apoProfileRow');
    if(!row) return false;
    var title = row.querySelector('b');
    return String(title && title.textContent || '').trim().toLowerCase() === 'contraseña';
  }

  document.addEventListener('click', function(event){
    var target = event.target;
    if(!isPasswordRow(target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.assign('/perfil.html?changePassword=1#seguridad');
  }, true);

  function openPasswordPanel(){
    try{
      var params = new URLSearchParams(window.location.search || '');
      if(params.get('changePassword') !== '1') return false;
      var button = document.getElementById('pfPasswordOpen');
      var panel = document.getElementById('pfPasswordPanel');
      if(!button || !panel) return false;
      if(panel.hidden) button.click();
      setTimeout(function(){
        try{
          var field = document.getElementById('pfCurrentPassword');
          if(field) field.focus({preventScroll:true});
          var security = panel.closest('.profileCard');
          if(security) security.scrollIntoView({behavior:'smooth', block:'start'});
        }catch(_){ }
      }, 80);
      return true;
    }catch(_){ return false; }
  }

  if(window.location.pathname.toLowerCase().endsWith('/perfil.html')){
    if(!openPasswordPanel()){
      var tries = 0;
      var timer = setInterval(function(){
        tries++;
        if(openPasswordPanel() || tries > 80) clearInterval(timer);
      }, 100);
    }
  }
})();
