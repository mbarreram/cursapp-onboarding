const APP_VERSION='2026.07.27.7';
const CACHE=`cursapp-${APP_VERSION}`;

self.addEventListener('install',event=>{
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
    const clientsList=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    clientsList.forEach(client=>client.postMessage({type:'CURSAPP_VERSION_ACTIVATED',version:APP_VERSION}));
  })());
});

// HTML, JS, CSS y manifiestos siempre se solicitan a red para evitar shells obsoletos.
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(request.mode==='navigate'||/\.(?:html|js|mjs|css|json|webmanifest)$/i.test(url.pathname)){
    event.respondWith(fetch(request,{cache:'no-store'}));
  }
});

self.addEventListener('push', event=>{
  let data={};
  try{ data=event.data ? event.data.json() : {}; }catch(e){ data={body:event.data ? event.data.text() : ''}; }
  const title=data.title || 'MiCursoX';
  const options={
    body:data.body || data.detalle || 'Tienes una nueva notificación.',
    icon:data.icon || '/assets/brand/micursox-isotype.svg',
    badge:data.badge || '/assets/brand/micursox-isotype.svg',
    tag:data.tag || undefined,
    data:{url:data.url || data.url_destino || '/', notification_id:data.notification_id || null}
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('message', event=>{
  const data=event.data || {};
  if(data.type==='SKIP_WAITING')self.skipWaiting();
  if(data.type === 'CURSAPP_TEST_NOTIFICATION'){
    self.registration.showNotification(data.title || 'MiCursoX', {
      body:data.body || 'Notificación de prueba activada correctamente.',
      icon:'/assets/brand/micursox-isotype.svg',
      badge:'/assets/brand/micursox-isotype.svg',
      data:{url:data.url || '/'}
    });
  }
});

self.addEventListener('notificationclick', event=>{
  event.notification.close();
  const url=(event.notification && event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const client of list){ if('focus' in client){ client.focus(); if(client.navigate) client.navigate(url); return; } }
    if(clients.openWindow) return clients.openWindow(url);
  }));
});