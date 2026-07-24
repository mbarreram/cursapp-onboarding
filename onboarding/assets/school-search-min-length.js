(function(){
  'use strict';

  function resetEmptySearch(input){
    const host=input?.closest('#onbSchoolFinder');
    if(!host)return;
    const results=host.querySelector('#onbSchoolResults');
    const hint=host.querySelector('#onbSchoolHint');
    if(results){
      results.style.display='none';
      results.replaceChildren();
    }
    if(hint)hint.textContent='Escribe al menos 2 caracteres del nombre o el RBD.';
  }

  // Se ejecuta antes de los listeners propios del buscador.
  document.addEventListener('focus',function(event){
    const input=event.target;
    if(!(input instanceof HTMLInputElement)||input.id!=='onbSchoolSearch')return;
    if(input.value.trim().length<2){
      event.stopImmediatePropagation();
      resetEmptySearch(input);
    }
  },true);

  document.addEventListener('input',function(event){
    const input=event.target;
    if(!(input instanceof HTMLInputElement)||input.id!=='onbSchoolSearch')return;
    if(input.value.trim().length<2){
      event.stopImmediatePropagation();
      resetEmptySearch(input);
    }
  },true);

  document.addEventListener('DOMContentLoaded',function(){
    const input=document.getElementById('onbSchoolSearch');
    if(input&&input.value.trim().length<2)resetEmptySearch(input);
  });
})();
