(function(){
'use strict';
if(window.__MX_RECEIPT_PDF_FIX_V2__) return;
window.__MX_RECEIPT_PDF_FIX_V2__=true;

function receiptNode(){
  return document.querySelector('.receiptV52Card') || document.querySelector('.receiptV51Card');
}

function textOf(sel, root){
  var el=(root||document).querySelector(sel);
  return el ? String(el.textContent||'').trim().replace(/\s+/g,' ') : '';
}

function esc(v){
  return String(v||'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function collect(){
  var node=receiptNode();
  if(!node) return null;
  var rows=[];
  node.querySelectorAll('.receiptV51Row').forEach(function(row){
    var label=textOf('.receiptV51RowLabel',row);
    var value=textOf('strong',row);
    if(label && value) rows.push([label,value]);
  });
  return {
    status:textOf('.receiptV51Status',node)||'Pago confirmado',
    amount:textOf('.receiptV51Amount',node),
    date:textOf('.receiptV51Date',node),
    rows:rows,
    trust:textOf('.receiptV51Trust',node)||'Pago procesado mediante Transbank.'
  };
}

function buildHtml(){
  var d=collect();
  if(!d) return '';
  var rows=d.rows.map(function(r){
    return '<div class="row"><div class="label">'+esc(r[0])+'</div><div class="value">'+esc(r[1])+'</div></div>';
  }).join('');
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>Comprobante MiCursoX</title>'+
    '<style>'+
    '@page{size:A4;margin:14mm}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#111827;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}'+
    'body{padding:0}.sheet{width:100%;max-width:680px;margin:0 auto;border:1px solid #e2e8f0;border-radius:24px;overflow:hidden;background:#fff}'+
    '.brand{padding:22px 28px;border-bottom:1px solid #ede9fe;font-size:24px;font-weight:800;color:#6d28d9;letter-spacing:.2px}'+
    '.main{padding:30px}.status{font-size:20px;font-weight:800;color:#16a34a;margin-bottom:14px}.amount{font-size:48px;line-height:1;font-weight:900;color:#0f172a}.date{margin-top:10px;font-size:15px;color:#64748b}'+
    '.divider{height:1px;background:#e2e8f0;margin:26px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px 26px}.row{min-width:0}.label{font-size:13px;font-weight:700;color:#64748b;margin-bottom:5px}.value{font-size:17px;font-weight:800;color:#111827;overflow-wrap:anywhere}'+
    '.trust{margin-top:28px;padding:16px 18px;border-radius:14px;background:#f8fafc;color:#475569;font-size:14px;line-height:1.5}.footer{padding:16px 28px;text-align:center;background:#faf8ff;border-top:1px solid #ede9fe;color:#64748b;font-size:12px}'+
    '@media(max-width:560px){.grid{grid-template-columns:1fr}.amount{font-size:42px}.main{padding:24px}.brand{padding:18px 24px}}'+
    '@media print{body{padding:0}.sheet{box-shadow:none;break-inside:avoid;page-break-inside:avoid}}'+
    '</style></head><body><div class="sheet">'+
    '<div class="brand">MiCursoX</div>'+
    '<div class="main"><div class="status">✓ '+esc(d.status.replace(/^✓\s*/,''))+'</div>'+
    '<div class="amount">'+esc(d.amount)+'</div><div class="date">'+esc(d.date)+'</div>'+
    '<div class="divider"></div><div class="grid">'+rows+'</div>'+
    '<div class="trust">'+esc(d.trust)+'</div></div>'+
    '<div class="footer">Comprobante de pago · MiCursoX</div></div></body></html>';
}

function printReceipt(){
  var html=buildHtml();
  if(!html){ alert('No se pudo generar el PDF del comprobante.'); return; }
  var frame=document.createElement('iframe');
  frame.setAttribute('aria-hidden','true');
  frame.style.cssText='position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
  document.body.appendChild(frame);
  var doc=frame.contentDocument||frame.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  var fired=false;
  var run=function(){
    if(fired) return;
    fired=true;
    try{ frame.contentWindow.focus(); frame.contentWindow.print(); }
    catch(_e){ alert('No se pudo abrir la vista para compartir el PDF.'); }
    setTimeout(function(){ try{ frame.remove(); }catch(_e){} },3500);
  };
  frame.onload=function(){ setTimeout(run,120); };
  setTimeout(run,500);
}

function install(){
  window.downloadReceiptPdf=printReceipt;
  window.shareReceiptPdf=printReceipt;
  var brand=document.querySelector('.receiptV52Brand span:last-child,.receiptV51Brand span:last-child');
  if(brand && String(brand.textContent||'').trim().toUpperCase()==='CURSAPP') brand.textContent='MiCursoX';
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true}); else install();
var mo=new MutationObserver(function(){install();});
mo.observe(document.documentElement,{childList:true,subtree:true});
})();