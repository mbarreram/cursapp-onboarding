(function(){
  'use strict';

  function applySchoolFinderFix(){
    const select=document.getElementById('onbSchool');
    const host=document.getElementById('onbSchoolFinder');
    if(!select||!host)return;

    // El selector nativo permanece sincronizado, pero no debe dejar una caja vacía visible.
    const nativeWrap=select.parentElement;
    if(nativeWrap){
      nativeWrap.style.display='none';
      nativeWrap.setAttribute('aria-hidden','true');
    }

    const input=host.querySelector('#onbSchoolSearch');
    const wrap=host.querySelector('.onbSchoolSearchWrap');
    const results=host.querySelector('#onbSchoolResults');
    const hint=host.querySelector('#onbSchoolHint');
    const selected=host.querySelector('#onbSchoolSelected');
    const missing=host.querySelector('#onbSchoolMissing');
    if(!input||!wrap||!results||!hint||!selected)return;

    const hasSelection=selected.classList.contains('isVisible');
    wrap.style.display=hasSelection?'none':'block';
    if(missing)missing.style.display=hasSelection?'none':'inline-flex';

    const term=input.value.trim();
    if(!hasSelection&&term.length<2){
      results.style.display='none';
      results.replaceChildren();
      hint.textContent='Escribe al menos 2 caracteres del nombre o el RBD.';
    }
  }

  // Evita que el listener original consulte y despliegue todos los colegios al enfocar vacío.
  document.addEventListener('focus',function(event){
    const input=event.target;
    if(!(input instanceof HTMLInputElement)||input.id!=='onbSchoolSearch')return;
    if(input.value.trim().length<2){
      event.stopImmediatePropagation();
      setTimeout(applySchoolFinderFix,0);
    }
  },true);

  // Con 0 o 1 carácter no se consulta Supabase. Desde 2 caracteres se conserva la búsqueda original.
  document.addEventListener('input',function(event){
    const input=event.target;
    if(!(input instanceof HTMLInputElement)||input.id!=='onbSchoolSearch')return;
    if(input.value.trim().length<2){
      event.stopImmediatePropagation();
      applySchoolFinderFix();
    }
  },true);

  // Al pedir cambiar colegio se vuelve a mostrar únicamente el buscador limpio.
  document.addEventListener('click',function(event){
    const button=event.target instanceof Element?event.target.closest('.onbSchoolChange'):null;
    if(!button)return;
    const host=document.getElementById('onbSchoolFinder');
    if(!host)return;
    const input=host.querySelector('#onbSchoolSearch');
    const wrap=host.querySelector('.onbSchoolSearchWrap');
    const selected=host.querySelector('#onbSchoolSelected');
    const missing=host.querySelector('#onbSchoolMissing');
    const results=host.querySelector('#onbSchoolResults');
    if(wrap)wrap.style.display='block';
    if(selected)selected.classList.remove('isVisible');
    if(missing)missing.style.display='inline-flex';
    if(input){input.value='';setTimeout(()=>input.focus(),0)}
    if(results){results.style.display='none';results.replaceChildren()}
    setTimeout(applySchoolFinderFix,20);
  },true);

  const observer=new MutationObserver(()=>requestAnimationFrame(applySchoolFinderFix));
  document.addEventListener('DOMContentLoaded',function(){
    observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    applySchoolFinderFix();
  });
})();
