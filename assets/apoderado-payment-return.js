(function(){
  'use strict';
  if(window.__MX_APODERADO_PAYMENT_RETURN__) return;
  window.__MX_APODERADO_PAYMENT_RETURN__ = true;

  var paidPaymentId = '';
  var paidTransactionId = '';
  var paidAt = '';
  try{
    paidPaymentId = sessionStorage.getItem('justPaidPaymentId') || '';
    paidTransactionId = sessionStorage.getItem('justPaidTransactionId') || '';
    paidAt = sessionStorage.getItem('justPaidAt') || '';
  }catch(_e){}

  function shouldOpenPaid(){
    return String(location.hash || '').toLowerCase() === '#payments_paid';
  }

  function paymentsKey(){
    return (window.CURSAPP && typeof window.CURSAPP.scopedKey === 'function')
      ? window.CURSAPP.scopedKey('payments_v1')
      : 'cursapp_payments_v1';
  }

  function readRows(){
    try{
      var rows = JSON.parse(localStorage.getItem(paymentsKey()) || '[]');
      return Array.isArray(rows) ? rows : [];
    }catch(_e){ return []; }
  }

  function rowDate(p){
    var raw = p && (p.paidAt || p.paid_at || p.updatedAt || p.updated_at || p.createdAt || p.created_at);
    var d = raw ? new Date(raw) : null;
    return d && !isNaN(d.getTime()) ? d.getTime() : 0;
  }

  function findReceiptCandidate(){
    var rows = readRows();
    if(!rows.length) return null;
    if(paidPaymentId){
      var exact = rows.find(function(p){ return String((p && (p.id || p.remoteId)) || '') === String(paidPaymentId); });
      if(exact) return exact;
    }
    if(paidTransactionId){
      var tx = rows.find(function(p){
        return String((p && (p.transactionId || p.transaction_id || (p.webpay && (p.webpay.transactionId || p.webpay.buyOrder)))) || '') === String(paidTransactionId);
      });
      if(tx) return tx;
    }
    var paidRows = rows.filter(function(p){
      var st=String((p && (p.status || p.estado)) || '').toLowerCase();
      return st==='paid' || st==='pagado' || st==='conciliado';
    }).sort(function(a,b){ return rowDate(b)-rowDate(a); });
    if(!paidRows.length) return null;
    if(paidAt){
      var t = new Date(paidAt).getTime();
      if(!isNaN(t)){
        var near = paidRows.find(function(p){ return Math.abs(rowDate(p)-t) <= 10*60*1000; });
        if(near) return near;
      }
    }
    return paidRows[0];
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

  function clearHandoff(){
    try{
      sessionStorage.removeItem('justPaidPaymentId');
      sessionStorage.removeItem('justPaidTaskId');
      sessionStorage.removeItem('justPaidTransactionId');
      sessionStorage.removeItem('justPaidAt');
    }catch(_e){}
  }

  function openReceiptAfterPayment(){
    if(!shouldOpenPaid()) return;
    var tries = 0;
    var timer = setInterval(function(){
      tries += 1;
      try{
        if(typeof window.openReceipt === 'function'){
          var candidate=findReceiptCandidate();
          var id=String((candidate && (candidate.id || candidate.remoteId)) || '');
          if(id){
            clearInterval(timer);
            setTimeout(function(){
              try{ window.openReceipt(id); clearHandoff(); }catch(_e){}
            },220);
            return;
          }
        }
      }catch(_e){}
      if(tries >= 80) clearInterval(timer);
    }, 125);
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
      var tries = 0;
      var timer = setInterval(function(){
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
