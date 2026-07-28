(function(){
  'use strict';
  const APP_VERSION='2026.07.28.2';

  function loadMiCursoXBrand(){
    if(!document.querySelector('link[data-micursox-brand]')){
      const css=document.createElement('link');css.rel='stylesheet';css.href='/assets/micursox-brand.css?v=4';css.dataset.micursoxBrand='1';document.head.appendChild(css);
    }
    if(!document.querySelector('link[data-micursox-components]')){
      const components=document.createElement('link');components.rel='stylesheet';components.href='/assets/micursox-components.css?v=2';components.dataset.micursoxComponents='1';document.head.appendChild(components);
    }
    if(!document.querySelector('script[data-micursox-brand]')){
      const js=document.createElement('script');js.src='/assets/micursox-brand.js?v=4';js.defer=true;js.dataset.micursoxBrand='1';document.head.appendChild(js);
    }
  }

  async function registerWorker(){
    if(!('serviceWorker' in navigator))return;
    try{
      const registration=await navigator.serviceWorker.register('/sw.js?v='+encodeURIComponent(APP_VERSION),{
        scope:'/',
        updateViaCache:'none'
      });
      registration.update().catch(()=>{});
      if(registration.waiting)registration.waiting.postMessage({type:'SKIP_WAITING'});
      registration.addEventListener('updatefound',()=>{
        const worker=registration.installing;
        if(!worker)return;
        worker.addEventListener('statechange',()=>{
          if(worker.state==='installed'&&navigator.serviceWorker.controller){
            worker.postMessage({type:'SKIP_WAITING'});
          }
        });
      });
    }catch(error){
      console.warn('No se pudo actualizar el Service Worker de MiCursoX',error);
    }
  }

  async function checkVersion(){
    try{
      const response=await fetch('/version.json?t='+Date.now(),{cache:'no-store'});
      if(!response.ok)return;
      const data=await response.json();
      if(data.version&&data.version!==APP_VERSION){
        console.info('Nueva versión MiCursoX disponible:',data.version);
      }
    }catch(_){ }
  }

  loadMiCursoXBrand();
  registerWorker();
  checkVersion();
  window.addEventListener('pageshow',event=>{
    if(event.persisted)checkVersion();
  });
})();