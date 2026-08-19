(function(){
  'use strict';
  if(window.__MICURSOX_PROFILE_MENU_TOGGLE_FIX__) return;
  window.__MICURSOX_PROFILE_MENU_TOGGLE_FIX__ = true;

  function setup(){
    var btn=document.getElementById('menuBtn');
    var dd=document.getElementById('menuDropdown');
    if(!btn||!dd||btn.dataset.mxProfileMenuFix==='1') return false;
    btn.dataset.mxProfileMenuFix='1';

    function place(){
      try{
        var r=btn.getBoundingClientRect();
        dd.style.position='fixed';
        dd.style.zIndex='999999';
        dd.style.top=Math.round(r.bottom+8)+'px';
        dd.style.right=Math.max(12,Math.round(window.innerWidth-r.right))+'px';
        dd.style.left='auto';
        dd.style.width='min(320px, calc(100vw - 24px))';
        dd.style.maxHeight='70vh';
        dd.style.overflowY='auto';
      }catch(_){ }
    }

    function setOpen(open){
      if(open){
        dd.hidden=false;
        dd.removeAttribute('hidden');
        place();
        dd.style.display='block';
        dd.setAttribute('aria-hidden','false');
        btn.setAttribute('aria-expanded','true');
      }else{
        dd.style.display='none';
        dd.hidden=true;
        dd.setAttribute('hidden','');
        dd.setAttribute('aria-hidden','true');
        btn.setAttribute('aria-expanded','false');
      }
    }

    btn.setAttribute('aria-haspopup','menu');
    btn.setAttribute('aria-expanded','false');
    setOpen(false);

    // Captura el evento antes del handler legacy, que en iOS puede ejecutar
    // touchstart + click y dejar el menú cerrado inmediatamente.
    btn.addEventListener('click',function(e){
      e.preventDefault();
      e.stopImmediatePropagation();
      setOpen(dd.hidden || dd.style.display!=='block');
    },true);

    document.addEventListener('click',function(e){
      if(dd.hidden) return;
      if(dd.contains(e.target) || btn.contains(e.target)) return;
      setOpen(false);
    },true);

    window.addEventListener('resize',function(){ if(!dd.hidden) place(); });
    window.addEventListener('orientationchange',function(){ setTimeout(function(){if(!dd.hidden)place();},120); });
    return true;
  }

  if(!setup()){
    var tries=0;
    var timer=setInterval(function(){
      tries++;
      if(setup()||tries>80) clearInterval(timer);
    },100);
  }
})();
