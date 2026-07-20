const CACHE='cursapp-v59-push';
self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>self.clients.claim());
self.addEventListener('fetch',e=>{});
self.addEventListener('push', event=>{
  let data={};
  try{ data=event.data ? event.data.json() : {}; }catch(e){ data={body:event.data ? event.data.text() : ''}; }
  const title=data.title || 'Cursapp';
  const options={
    body:data.body || data.detalle || 'Tienes una nueva notificación.',
    icon:data.icon || '/assets/icons/cursapp-icon-192.png',
    badge:data.badge || '/assets/icons/cursapp-icon-192.png',
    tag:data.tag || undefined,
    data:{url:data.url || data.url_destino || '/', notification_id:data.notification_id || null}
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('message', event=>{
  const data=event.data || {};
  if(data.type === 'CURSAPP_TEST_NOTIFICATION'){
    self.registration.showNotification(data.title || 'Cursapp', {
      body:data.body || 'Notificación de prueba activada correctamente.',
      icon:'/assets/icons/cursapp-icon-192.png',
      badge:'/assets/icons/cursapp-icon-192.png',
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
