(function(){
'use strict';
if(window.__MX_RECEIPT_PDF_FIX_V1__) return;
window.__MX_RECEIPT_PDF_FIX_V1__=true;

function receiptNode(){
  return document.querySelector('.receiptV52Card') || document.querySelector('.receiptV51Card');
}

function cssLinks(){
  return Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(function(l){
    try{return '<link rel="stylesheet" href="'+String(l.href||'')+'">';}catch(_e){return '';}
  }).join('');
}

function buildHtml(){
  var node=receiptNode();
  if(!node) return '';
  var clone=node.cloneNode(true);
  clone.querySelectorAll('button,.receiptV52Topbar,.receiptV52BottomActions,.receiptV51Primary,.receiptV51Secondary').forEach(function(x){x.remove();});
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+cssLinks()+
  '<style>@page{size:A4;margin:10mm}html,body{margin:0!important;padding:0!important;background:#fff!important;overflow:visible!important}body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important}.mxReceiptPrintWrap{width:100%;max-width:560px;margin:0 auto;padding:0}.mxReceiptPrintWrap .receiptV52Card,.mxReceiptPrintWrap .receiptV51Card{display:block!important;position:static!important;transform:none!important;width:100%!important;max-width:560px!important;height:auto!important;max-height:none!important;overflow:visible!important;margin:0 auto!important;box-shadow:none!important;border:1px solid #e2e8f0!important;background:#fff!important}.mxReceiptPrintWrap *{visibility:visible!important}@media print{html,body{width:auto!important;height:auto!important}.mxReceiptPrintWrap{break-inside:avoid;page-break-inside:avoid}}</style></head><body><div class="mxReceiptPrintWrap">'+clone.outerHTML+'</div></body></html>';
}

function printReceipt(){
  var html=buildHtml();
  if(!html){ alert('No se pudo generar el PDF del comprobante.'); return; }
  var w=null;
  try{ w=window.open('','_blank'); }catch(_e){}
  if(!w){
    var frame=document.createElement('iframe');
    frame.style.cssText='position:fixed;left:-10000px;top:0;width:800px;height:1200px;border:0;background:#fff';
    document.body.appendChild(frame);
    var d=frame.contentDocument||frame.contentWindow.document;
    d.open();d.write(html);d.close();
    setTimeout(function(){try{frame.contentWindow.focus();frame.contentWindow.print();}catch(_e){}setTimeout(function(){try{frame.remove();}catch(_e){}},3000);},1200);
    return;
  }
  try{
    w.document.open();w.document.write(html);w.document.close();
    var fire=function(){try{w.focus();w.print();}catch(_e){}};
    if(w.document.readyState==='complete') setTimeout(fire,900);
    else w.addEventListener('load',function(){setTimeout(fire,900);},{once:true});
    setTimeout(fire,1800);
  }catch(_e){try{w.close();}catch(__e){}}
}

function install(){
  window.downloadReceiptPdf=printReceipt;
  window.shareReceiptPdf=printReceipt;
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true}); else install();
var mo=new MutationObserver(function(){install();});
mo.observe(document.documentElement,{childList:true,subtree:true});
})();
