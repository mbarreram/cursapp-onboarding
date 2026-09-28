(function(){
'use strict';
if(window.__MX_RECEIPT_PDF_FIX_V3__) return;
window.__MX_RECEIPT_PDF_FIX_V3__=true;

function receiptNode(){
  return document.querySelector('.receiptV52Card') || document.querySelector('.receiptV51Card');
}

function textOf(sel, root){
  var el=(root||document).querySelector(sel);
  return el ? String(el.textContent||'').trim().replace(/\s+/g,' ') : '';
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
  var folio='';
  rows.forEach(function(r){ if(String(r[0]).toLowerCase()==='folio') folio=r[1]; });
  return {
    status:textOf('.receiptV51Status',node)||'Pago confirmado',
    amount:textOf('.receiptV51Amount',node),
    date:textOf('.receiptV51Date',node),
    rows:rows,
    trust:textOf('.receiptV51Trust',node)||'Pago procesado mediante Transbank.',
    folio:folio
  };
}

function cleanPdfText(v){
  return String(v||'')
    .replace(/[\u2010-\u2015]/g,'-')
    .replace(/[\u2018\u2019]/g,"'")
    .replace(/[\u201c\u201d]/g,'"')
    .replace(/\u2022/g,'-')
    .replace(/[^\x20-\xFF]/g,'');
}

function pdfEscape(v){
  return cleanPdfText(v).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
}

function bytesLatin1(str){
  var out=new Uint8Array(str.length);
  for(var i=0;i<str.length;i++){
    var code=str.charCodeAt(i);
    out[i]=code<=255?code:63;
  }
  return out;
}

function concatBytes(parts){
  var total=parts.reduce(function(n,p){return n+p.length;},0);
  var out=new Uint8Array(total), offset=0;
  parts.forEach(function(p){out.set(p,offset);offset+=p.length;});
  return out;
}

function cmdText(x,y,size,text,bold,color){
  color=color||'0.06 0.09 0.16';
  return color+' rg BT /'+(bold?'F2':'F1')+' '+size+' Tf 1 0 0 1 '+x+' '+y+' Tm ('+pdfEscape(text)+') Tj ET\n';
}

function wrapText(text,maxChars){
  var words=cleanPdfText(text).split(/\s+/).filter(Boolean);
  var lines=[], line='';
  words.forEach(function(w){
    var next=line?line+' '+w:w;
    if(next.length>maxChars && line){ lines.push(line); line=w; }
    else line=next;
  });
  if(line) lines.push(line);
  return lines;
}

function buildPdfBlob(){
  var d=collect();
  if(!d) return null;

  var W=420, H=595;
  var stream='';
  stream+='q\n';
  stream+='1 1 1 rg 0 0 '+W+' '+H+' re f\n';
  stream+='0.88 0.90 0.94 RG 1 w 16 16 388 563 re S\n';
  stream+='0.98 0.97 1 rg 17 525 386 53 re f\n';
  stream+=cmdText(34,548,20,'MiCursoX',true,'0.43 0.16 0.85');
  stream+=cmdText(34,505,16,'Pago confirmado',true,'0.09 0.64 0.29');
  stream+=cmdText(34,468,34,d.amount||'',true,'0.04 0.07 0.14');
  stream+=cmdText(34,445,11,d.date||'',false,'0.39 0.45 0.55');
  stream+='0.88 0.90 0.94 RG 0.8 w 34 428 m 386 428 l S\n';

  d.rows.slice(0,8).forEach(function(r,i){
    var col=i%2, row=Math.floor(i/2);
    var x=34+(col*190), y=401-(row*54);
    stream+=cmdText(x,y,9,r[0],true,'0.39 0.45 0.55');
    var valueLines=wrapText(r[1],col===0?25:22).slice(0,2);
    valueLines.forEach(function(line,j){
      stream+=cmdText(x,y-18-(j*13),12,line,true,'0.04 0.07 0.14');
    });
  });

  stream+='0.97 0.98 0.99 rg 30 112 360 74 re f\n';
  var trustLines=wrapText(d.trust,60).slice(0,3);
  trustLines.forEach(function(line,i){
    stream+=cmdText(46,157-(i*15),10,line,false,'0.29 0.35 0.45');
  });
  stream+=cmdText(34,78,9,'Comprobante de pago · MiCursoX',true,'0.43 0.16 0.85');
  if(d.folio) stream+=cmdText(34,60,8,'Folio: '+d.folio,false,'0.39 0.45 0.55');
  stream+=cmdText(34,42,8,'Documento generado para respaldo y conciliacion con la directiva del curso.',false,'0.50 0.55 0.63');
  stream+='Q\n';

  var objects=[];
  objects[1]='<< /Type /Catalog /Pages 2 0 R >>';
  objects[2]='<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
  objects[3]='<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+W+' '+H+'] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>';
  objects[4]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[5]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  var streamBytes=bytesLatin1(stream);
  objects[6]='<< /Length '+streamBytes.length+' >>\nstream\n'+stream+'endstream';

  var parts=[bytesLatin1('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')];
  var offsets=[0];
  var current=parts[0].length;
  for(var i=1;i<=6;i++){
    offsets[i]=current;
    var obj=bytesLatin1(i+' 0 obj\n'+objects[i]+'\nendobj\n');
    parts.push(obj); current+=obj.length;
  }
  var xrefOffset=current;
  var xref='xref\n0 7\n0000000000 65535 f \n';
  for(var j=1;j<=6;j++) xref+=String(offsets[j]).padStart(10,'0')+' 00000 n \n';
  xref+='trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n'+xrefOffset+'\n%%EOF';
  parts.push(bytesLatin1(xref));

  return new Blob([concatBytes(parts)],{type:'application/pdf'});
}

function filename(){
  var d=collect();
  var folio=d&&d.folio?String(d.folio).replace(/[^a-zA-Z0-9_-]/g,'-'):'pago';
  return 'Comprobante-MiCursoX-'+folio+'.pdf';
}

function downloadReceipt(){
  var blob=buildPdfBlob();
  if(!blob){ alert('No se pudo generar el PDF del comprobante.'); return; }
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url; a.download=filename();
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){URL.revokeObjectURL(url);},4000);
}

async function shareReceipt(){
  var blob=buildPdfBlob();
  if(!blob){ alert('No se pudo generar el PDF del comprobante.'); return; }
  var file=new File([blob],filename(),{type:'application/pdf'});
  try{
    if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
      await navigator.share({
        title:'Comprobante de pago MiCursoX',
        text:'Comprobante de pago para respaldo y conciliación con la directiva del curso.',
        files:[file]
      });
      return;
    }
  }catch(e){
    if(e && e.name==='AbortError') return;
  }
  downloadReceipt();
}

function install(){
  window.downloadReceiptPdf=downloadReceipt;
  window.shareReceiptPdf=shareReceipt;
  var brand=document.querySelector('.receiptV52Brand span:last-child,.receiptV51Brand span:last-child');
  if(brand && String(brand.textContent||'').trim().toUpperCase()==='CURSAPP') brand.textContent='MiCursoX';
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true}); else install();
var mo=new MutationObserver(function(){install();});
mo.observe(document.documentElement,{childList:true,subtree:true});
})();