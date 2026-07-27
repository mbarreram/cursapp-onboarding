(function(){
  'use strict';
  function apply(data){
    window.finance=data&&typeof data==='object'?data:{};
    if(document.querySelector('.navItem[data-tab="informes"].active')&&typeof window.go==='function'){
      try{window.go('informes')}catch(_){ }
    }
  }
  function hydrate(){
    const api=window.CURSAPP_APO_FINANCE;
    if(!api||typeof api.snapshot!=='function')return false;
    const cached=api.snapshot();
    if(cached)apply(cached);
    else if(!window.finance||typeof window.finance!=='object')window.finance={};
    if(typeof api.refresh==='function')api.refresh().then(result=>{if(result)apply(result)}).catch(()=>{});
    return true;
  }
  if(!window.finance||typeof window.finance!=='object')window.finance={};
  window.addEventListener('cursapp:apoderado-finanzas',function(event){
    const detail=event&&event.detail;
    if(detail&&typeof detail==='object')apply(detail);
  });
  if(!hydrate()){
    let tries=0;
    const timer=setInterval(()=>{if(hydrate()||++tries>60)clearInterval(timer)},100);
  }
})();