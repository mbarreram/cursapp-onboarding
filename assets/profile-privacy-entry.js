(function(){
  'use strict';
  if(window.__MICURSOX_PROFILE_PRIVACY_ENTRY__) return;
  window.__MICURSOX_PROFILE_PRIVACY_ENTRY__=true;
  function mount(){
    const root=document.getElementById('perfilContent');
    if(!root||root.querySelector('[data-mx-profile-privacy]')) return;
    const cards=root.querySelectorAll('.profileCard');
    if(!cards.length) return;
    const card=document.createElement('section');
    card.className='card profileCard';
    card.setAttribute('data-mx-profile-privacy','1');
    card.innerHTML=`<div class="profileTitleRow"><div><div class="h2">Privacidad y consentimiento</div><div class="muted">Tus autorizaciones, derechos y preferencias</div></div></div><div class="profileActions"><button type="button" class="btnPrimary" data-mx-consents>Consentimientos y privacidad</button><button type="button" class="btnGhost" data-mx-notifications>Preferencias de notificaciones</button></div><p class="muted" style="margin:14px 0 0;line-height:1.45">Consulta los consentimientos asociados a tu cuenta y ejerce solicitudes de acceso, rectificación, supresión, oposición, portabilidad o bloqueo.</p>`;
    cards[0].insertAdjacentElement('afterend',card);
    card.querySelector('[data-mx-consents]').onclick=()=>{const api=window.CURSAPP_USER_CONSENTS;if(api?.open)api.open();else alert('Consentimientos y privacidad aún se están cargando.')};
    card.querySelector('[data-mx-notifications]').onclick=()=>{const api=window.CURSAPP_NOTIFICATION_PREFERENCES;if(api?.open)api.open();else alert('Las preferencias aún se están cargando.')};
  }
  new MutationObserver(mount).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();