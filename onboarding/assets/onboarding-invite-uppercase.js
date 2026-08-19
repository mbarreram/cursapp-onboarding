(function(){
  'use strict';
  if(window.__MX_INVITE_UPPERCASE__) return;
  window.__MX_INVITE_UPPERCASE__ = true;

  function wire(){
    const input = document.getElementById('onbInviteCode');
    if(!input || input.dataset.mxUppercase === '1') return;
    input.dataset.mxUppercase = '1';
    input.setAttribute('autocapitalize','characters');
    input.setAttribute('autocomplete','off');
    input.setAttribute('spellcheck','false');
    input.style.textTransform = 'uppercase';
    input.addEventListener('input', function(){
      const normalized = String(input.value || '').toUpperCase().replace(/\s+/g,'');
      if(input.value !== normalized) input.value = normalized;
      try{
        const d = JSON.parse(localStorage.getItem('cursapp_onb_draft_v1') || '{}') || {};
        d.inviteCode = normalized;
        localStorage.setItem('cursapp_onb_draft_v1', JSON.stringify(d));
      }catch(_){ }
    });
  }

  const observer = new MutationObserver(wire);
  observer.observe(document.documentElement, {childList:true, subtree:true});
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire, {once:true});
  else wire();
})();
