(function(){
  'use strict';
  const APP_VERSION='2026.07.24.1';
  const RELOAD_KEY='cursapp_version_reload_v1';

  function reloadOnce(version){
    try{
      if(sessionStorage.getItem(RELOAD_KEY)===version)return;
      sessionStorage.setItem(RELOAD_KEY,version);
    }catch(_){ }
    const url=new URL(window.location.href);
    url.searchParams.set('_cv',version.replace(/[^0-9]/g,''));
    window.location.replace(url.toString());
  }

  async function registerWorker(){
    if(!('serviceWorker' in navigator))return;
    try{
      const registration=await navigator.serviceWorker.register('/sw.js?v='+encodeURIComponent(APP_VERSION),{
        scope:'/',
        updateViaCache:'none'
      });
      await registration.update();
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
      console.warn('No se pudo actualizar el Service Worker de Cursapp',error);
    }
  }

  navigator.serviceWorker?.addEventListener('controllerchange',()=>reloadOnce(APP_VERSION));
  navigator.serviceWorker?.addEventListener('message',event=>{
    if(event.data?.type==='CURSAPP_VERSION_ACTIVATED'&&event.data.version===APP_VERSION){
      reloadOnce(APP_VERSION);
    }
  });

  async function checkVersion(){
    try{
      const response=await fetch('/version.json?t='+Date.now(),{cache:'no-store'});
      if(!response.ok)return;
      const data=await response.json();
      if(data.version&&data.version!==APP_VERSION)reloadOnce(data.version);
    }catch(_){ }
  }

  registerWorker();
  checkVersion();
  window.addEventListener('pageshow',event=>{
    if(event.persisted)checkVersion();
  });
})();
