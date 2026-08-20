(function(){
  'use strict';
  if(window.__MX_APODERADO_PAYMENT_RETURN__) return;
  window.__MX_APODERADO_PAYMENT_RETURN__ = true;

  var paidPaymentId = '';
  var paidTransactionId = '';
  var paidAt = '';
  var justPaid = '';
  try{
    paidPaymentId = sessionStorage.getItem('justPaidPaymentId') || '';
    paidTransactionId = sessionStorage.getItem('justPaidTransactionId') || '';
    paidAt = sessionStorage.getItem('justPaidAt') || '';
    justPaid = sessionStorage.getItem('justPaid') || '';
  }catch(_e){}

  function shouldOpenPaid(){
    return String(location.hash || '').toLowerCase() === '#payments_paid';
  }

  function isPaymentReturn(){
    return shouldOpenPaid() && !!(justPaid || paidPaymentId || paidTransactionId || paidAt);
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

  function isPaid(p){
    var st=String((p && (p.status || p.estado)) || '').toLowerCase();
    return st==='paid' || st==='pagado' || st==='conciliado';
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
    var paidRows = rows.filter(isPaid).sort(function(a,b){ return rowDate(b)-rowDate(a); });
    if(!paidRows.length) return null;
    if(paidAt){
      var t = new Date(paidAt).getTime();
      if(!isNaN(t)){
        var near = paidRows.find(function(p){ return Math.abs(rowDate(p)-t) <= 15*60*1000; });
        if(near) return near;
      }
    }
    return paidRows[0];
  }

  function openPaidOnce(){
    if(!shouldOpenPaid()) return false;
    try{
      if(typeof window.go === 'function') window.go('payments');
      if(typeof window.setPayFilter === 'function') window.setPayFilter('paid');
      document.querySelectorAll('.navItem').forEach(function(btn){
        btn.classList.toggle('active', String(btn.dataset.tab || '') === 'payments');
      });
      return typeof window.go === 'function';
    }catch(_){ return false; }
  }

  function clearHandoff(){
    try{
      sessionStorage.removeItem('justPaid');
      sessionStorage.removeItem('justPaidPaymentId');
      sessionStorage.removeItem('justPaidTaskId');
      sessionStorage.removeItem('justPaidTransactionId');
      sessionStorage.removeItem('justPaidAt');
    }catch(_e){}
  }

  function receiptIsOpen(){
    var root=document.getElementById('modalRoot');
    if(!root) return false;
    var txt=String(root.textContent||'').toLowerCase();
    return !!root.firstElementChild && (txt.indexOf('pago confirmado')>=0 || txt.indexOf('comprobante')>=0 || txt.indexOf('folio')>=0);
  }

  function openReceiptCandidate(){
    if(!isPaymentReturn() || typeof window.openReceipt !== 'function') return false;
    var candidate=findReceiptCandidate();
    var id=String((candidate && (candidate.id || candidate.remoteId)) || '');
    if(!id) return false;
    try{
      window.openReceipt(id);
      return true;
    }catch(_e){ return false; }
  }

  function pinReceiptOpen(){
    if(!isPaymentReturn()) return;
    var attempts=0;
    var openedAt=0;
    var timer=setInterval(function(){
      attempts++;
      if(!shouldOpenPaid()){
        clearInterval(timer);
        return;
      }
      if(receiptIsOpen()){
        if(!openedAt) openedAt=Date.now();
        if(Date.now()-openedAt > 2600){
          clearInterval(timer);
          clearHandoff();
        }
        return;
      }
      openedAt=0;
      if(attempts>=5) openReceiptCandidate();
      if(attempts>=55){
        clearInterval(timer);
        if(receiptIsOpen()) clearHandoff();
      }
    },180);
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

  function settlePaymentsView(done){
    var tries=0;
    var timer=setInterval(function(){
      tries++;
      var ok=openPaidOnce();
      if(ok || tries>=35){
        clearInterval(timer);
        setTimeout(done,900);
      }
    },120);
  }

  function boot(){
    if(!shouldOpenPaid()) return;
    refreshPaidData().finally(function(){
      settlePaymentsView(function(){
        if(isPaymentReturn()){
          openReceiptCandidate();
          pinReceiptOpen();
        }
      });
    });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
