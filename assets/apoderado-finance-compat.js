(function(){
  'use strict';
  let lastSignature='';
  let renderTimer=0;

  function signature(data){
    try{return JSON.stringify(data&&typeof data==='object'?data:{});}catch(_){return '';}
  }

  function scheduleReportRender(){
    clearTimeout(renderTimer);
    renderTimer=setTimeout(function(){
      if(document.querySelector('.navItem[data-tab="informes"].active')&&typeof window.go==='function'){
        try{window.go('informes')}catch(_){ }
      }
    },120);
  }

  function apply(data,options){
    const next=data&&typeof data==='object'?data:{};
    const nextSignature=signature(next);
    window.finance=next;
    if(nextSignature===lastSignature)return false;
    lastSignature=nextSignature;
    if(options?.render!==false)scheduleReportRender();
    return true;
  }

  function hydrate(){
    const api=window.CURSAPP_APO_FINANCE;
    if(!api||typeof api.snapshot!=='function')return false;
    const cached=api.snapshot();
    if(cached)apply(cached,{render:false});
    else if(!window.finance||typeof window.finance!=='object')window.finance={};
    if(typeof api.refresh==='function')api.refresh().catch(()=>{});
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