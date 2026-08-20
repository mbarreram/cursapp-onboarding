(function(){
  'use strict';
  if(window.__MX_APODERADO_PAYMENT_RETURN__) return;
  window.__MX_APODERADO_PAYMENT_RETURN__ = true;

  var paidPaymentId = '';
  try{ paidPaymentId = sessionStorage.getItem('justPaidPaymentId') || ''; }catch(_e){}

  function shouldOpenPaid(){
    return String(location.hash || '').toLowerCase() === '#payments_paid';
  }

  function openPaid(){
    if(!shouldOpenPaid()) return false;
    try{
      if(typeof window.go === 'function') window.go('payments');
      if(typeof window.setPayFilter === 'function') window.setPayFilter('paid');
      document.querySelectorAll('.navItem').forEach(function(btn){
        btn.classList.toggle('active', String(btn.dataset.tab || '') === 'payments');
      });
      return typeof window.go === 'function' && typeof window.setPayFilter === 'function';
    }catch(_){ return false; }
  }

  function openReceiptAfterPayment(){
    if(!shouldOpenPaid() || !paidPaymentId) return;
    var tries = 0;
    var timer = setInterval(function(){
      tries += 1;
      try{
        if(typeof window.openReceipt === 'function'){
          var key = (window.CURSAPP && typeof window.CURSAPP.scopedKey === 'function')
            ? window.CURSAPP.scopedKey('payments_v1')
            : 'cursapp_payments_v1';
          var rows = JSON.parse(localStorage.getItem(key) || '[]');
          var found = Array.isArray(rows) && rows.some(function(p){ return String((p && (p.id || p.remoteId)) || '') === String(paidPaymentId); });
          if(found){
            clearInterval(timer);
            window.openReceipt(paidPaymentId);
            try{
              sessionStorage.removeItem('justPaidPaymentId');
              sessionStorage.removeItem('justPaidTaskId');
            }catch(_e){}
            return;
          }
        }
      }catch(_e){}
      if(tries >= 70) clearInterval(timer);
    }, 120);
  }

  async function refreshPaidData(){
    if(!shouldOpenPaid()) return;
    try{
      if(typeof window.MICURSOX_REFRESH_BUSINESS_DATA === 'function'){
        await window.MICURSOX_REFRESH_BUSINESS_DATA('webpay-return');
      }else if(window.CURSAPP && typeof window.CURSAPP.hydrateOperationalFromSupabase === 'function'){
        await window.CURSAPP.hydrateOperationalFromSupabase('webpay-return');
      }
    }catch(_e){}
  }

  function boot(){
    if(!shouldOpenPaid()) return;
    refreshPaidData().finally(function(){
      let tries = 0;
      const timer = setInterval(function(){
        tries += 1;
        if(openPaid() || tries >= 40) clearInterval(timer);
      }, 100);
      openReceiptAfterPayment();
    });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
  window.addEventListener('hashchange', function(){ openPaid(); openReceiptAfterPayment(); });
})();
