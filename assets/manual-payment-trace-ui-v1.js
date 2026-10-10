(function(){'use strict';if(window.__MX_MANUAL_TRACE_UI_V1__)return;window.__MX_MANUAL_TRACE_UI_V1__=true;
const api=()=>window.CURSAPP_SUPABASE;const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const clp=x=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(x)||0);
const course=()=>{try{const c=JSON.parse(localStorage.getItem('cursapp_course_v1')||'{}'),s=JSON.parse(localStorage.getItem('cursapp_session_v1')||'{}');return c?.course?.id||c?.id||c?.curso_id||s?.courseId||s?.course?.id||''}catch(_){return''}};
const send=(name,obj)=>api().request('rpc/'+name,{method:'POST',body:JSON.stringify(obj)});
const role=()=>document.body.classList.contains('cursapp-tesorero')?'tesorero':document.body.classList.contains('cursapp-presidente')?'presidente':document.body.classList.contains('cursapp-apoderado')?'apoderado':'';
let lastKey='',pending=false,refreshRequested=false,summaryCard=null;
const FINANCIAL_SOURCES=new Set(['reversa-manual','pago-manual','registro-pago-manual','manual-payment','manual-payment-reversal','conciliacion-manual','transbank-payment']);
const isFinancialEvent=e=>{const d=e?.detail||{};return d.financial===true||FINANCIAL_SOURCES.has(d.source)};
function manualReceiptPdf(r,items,courseLabel,schoolLabel,date,reversed){
 const clean=v=>String(v??'—').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\xFF]/g,'-');
 const escPdf=v=>clean(v).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
 const text=(x,y,t,size=10,bold=false,color='0.10 0.15 0.26')=>color+' rg BT /'+(bold?'F2':'F1')+' '+size+' Tf 1 0 0 1 '+x+' '+y+' Tm ('+escPdf(t)+') Tj ET\n';
 const lines=(str,n)=>{let out=[],line='';for(const word of clean(str).split(/\s+/)){if((line+' '+word).trim().length>n&&line){out.push(line);line=word}else line=(line+' '+word).trim()}if(line)out.push(line);return out};
 const rect=(x,y,w,h,fill)=>fill+' rg '+x+' '+y+' '+w+' '+h+' re f\n';
 const line=(x1,y1,x2,y2,color='0.83 0.86 0.90')=>color+' RG 1.2 w '+x1+' '+y1+' m '+x2+' '+y2+' l S\n';
 const circle=(x,y,r,color,fill=false)=>{const k=.5522847498*r;return color+(fill?' rg ':' RG ')+(fill?'':'2 w ')+(x+r)+' '+y+' m '+(x+r)+' '+(y+k)+' '+(x+k)+' '+(y+r)+' '+x+' '+(y+r)+' c '+(x-k)+' '+(y+r)+' '+(x-r)+' '+(y+k)+' '+(x-r)+' '+y+' c '+(x-r)+' '+(y-k)+' '+(x-k)+' '+(y-r)+' '+x+' '+(y-r)+' c '+(x+k)+' '+(y-r)+' '+(x+r)+' '+(y-k)+' '+(x+r)+' '+y+' c '+(fill?'f':'S')+'\n'};
 const purple='0.44 0.16 0.83',green='0.08 0.64 0.34',muted='0.40 0.46 0.55',ink='0.07 0.10 0.19';
 let stream='1 1 1 rg 0 0 595 842 re f\n';
 stream+=rect(28,28,539,786,'0.995 0.995 1');
 stream+=rect(40,767,515,49,'1 1 1');
 stream+=text(55,785,'MiCursoX',24,true,purple);
 stream+=text(427,789,'COMPROBANTE',9,true,purple);
 stream+=line(52,764,542,764);
 stream+=rect(52,81,490,666,'1 1 1');
 stream+=circle(162,709,17,green);
 stream+=green+' RG 3 w 154 709 m 160 703 l 170 717 l S\n';
 stream+=text(193,705,reversed?'Pago reversado':'Registrado por tesoreria',18,true,reversed?'0.73 0.15 0.17':green);
 stream+=text(208,654,clp(r.total),39,true,ink);
 stream+=text(211,633,date,12,true,muted);
 stream+=line(77,613,520,613);
 // Marca de agua circular tenue y centrada en el detalle.
 stream+=circle(301,406,165,'0.95 0.93 0.98');
 stream+=circle(301,406,72,'0.95 0.93 0.98');
 stream+=text(237,519,'DIRECTIVA',21,true,'0.95 0.93 0.98');
 stream+=text(261,405,courseLabel.replace(/\s*2026\s*/,'').trim(),22,true,'0.95 0.93 0.98');
 stream+=text(252,333,String(new Date(r.fecha).getFullYear()||2026),25,true,'0.95 0.93 0.98');
 stream+=text(251,294,reversed?'REVERSADO':'PAGADO',18,true,'0.95 0.93 0.98');
 const fields=[
  ['Campana',items.length===1?(items[0].campana||items[0].concepto||'—'):items.length+' cuotas / campanas'],
  ['Alumno',r.alumno],['Apoderado',r.apoderado],['Curso',courseLabel],
  ['Colegio',schoolLabel],['Forma de pago',String(r.medio||'').replace(/^./,x=>x.toUpperCase())],
  ['Estado',reversed?'Reversado':'Pagado'],['Folio',r.folio]];
 fields.forEach(([label,value],i)=>{
  const col=i%2,row=Math.floor(i/2),x=91+col*244,y=576-row*94;
  stream+=circle(x-16,y-7,9,purple);
  stream+=text(x-20,y-11,i===0?'C':i===1?'A':i===2?'P':i===3?'G':i===4?'E':i===5?'M':i===6?'V':'#',9,true,purple);
  stream+=text(x,y,label,11,true,muted);
  const width=i===7?18:26;
  (i===7?(String(value||'').match(/.{1,18}/g)||[]):lines(value,width)).slice(0,i===7?3:2).forEach((part,j)=>stream+=text(x,y-23-j*17,part,i===7?10:13,true,ink));
 });
 stream+=line(78,195,520,195);
 const count=items.length;
 stream+=rect(69,94,458,75,'0.965 0.985 0.979');
 stream+=text(138,142,reversed?'Operacion reversada - sin vigencia':'Pago registrado y conciliado por tesoreria.',12,true,purple);
 stream+=text(123,121,'Este comprobante acredita un pago registrado por la directiva del curso.',9,false,muted);
 stream+=text(146,105,reversed?'Conservado como evidencia historica.':'No fue procesado mediante Transbank.',9,false,muted);
 const streams=[stream];
 if(count>1){
  for(let start=0;start<count;start+=19){
   let page='1 1 1 rg 0 0 595 842 re f\n';
   page+=text(52,790,'MiCursoX',23,true,purple);
   page+=text(52,763,'Detalle de cuotas · '+r.folio,11,true,muted);
   page+=line(52,746,542,746);
   page+=text(56,719,'Campana / periodo',11,true,muted);
   page+=text(461,719,'Monto',11,true,muted);
   items.slice(start,start+19).forEach((item,i)=>{
    const y=686-i*29;
    const name=(item.campana||item.concepto||'Cuota')+' · '+(item.periodo||'—');
    lines(name,55).slice(0,1).forEach(part=>page+=text(56,y,part,11,false,ink));
    page+=text(454,y,clp(item.monto),11,true,ink);
    page+=line(53,y-10,540,y-10);
   });
   page+=text(300,69,'Total recibido: '+clp(r.total),15,true,ink);
   page+=text(52,46,'Folio oficial: '+r.folio,9,true,muted);
   streams.push(page);
  }
 }
 const bytes=v=>{const a=new Uint8Array(v.length);for(let i=0;i<v.length;i++)a[i]=v.charCodeAt(i)&255;return a};
 const pageCount=streams.length;
 const objects=['','<< /Type /Catalog /Pages 2 0 R >>'];
 const refs=streams.map((_,i)=>(3+i*2)+' 0 R').join(' ');
 objects[2]='<< /Type /Pages /Kids ['+refs+'] /Count '+pageCount+' >>';
 for(let i=0;i<pageCount;i++){
  const pageId=3+i*2,contentId=pageId+1;
  objects[pageId]='<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 '+(3+pageCount*2)+' 0 R /F2 '+(4+pageCount*2)+' 0 R >> >> /Contents '+contentId+' 0 R >>';
  objects[contentId]='<< /Length '+bytes(streams[i]).length+' >>\nstream\n'+streams[i]+'endstream';
 }
 const fontId=3+pageCount*2;
 objects[fontId]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
 objects[fontId+1]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
 const maxId=fontId+1;
 const parts=[bytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')],offsets=[0];let pos=parts[0].length;
 for(let i=1;i<=maxId;i++){offsets[i]=pos;const b=bytes(i+' 0 obj\n'+objects[i]+'\nendobj\n');parts.push(b);pos+=b.length}
 let xref='xref\n0 '+(maxId+1)+'\n0000000000 65535 f \n';
 for(let i=1;i<=maxId;i++)xref+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
 xref+='trailer\n<< /Size '+(maxId+1)+' /Root 1 0 R >>\nstartxref\n'+pos+'\n%%EOF';
 parts.push(bytes(xref));
 return new Blob(parts,{type:'application/pdf'});
}

async function receipt(id,existingWindow){
 const w=existingWindow||window.open('','_blank');
 if(!w){alert('Permite ventanas emergentes para ver el comprobante.');return;}
 try{
  const r=await send('comprobante_operacion_manual',{p_operacion_id:id});
  if(!r?.folio)throw Error('Comprobante no disponible');
  const reversed=r.estado==='reversado',items=Array.isArray(r.cuotas)?r.cuotas:[];
  let courseLabel='—',schoolLabel='—';
  try{
    const cr=await api().request('cursos?select=nombre,nivel,letra,anio,colegios(nombre)&id=eq.'+encodeURIComponent(course())+'&limit=1');
    const c=Array.isArray(cr)?cr[0]:null;
    if(c){courseLabel=([c.nivel||'',c.letra||''].join('').trim()+(c.anio?' '+c.anio:'')).trim()||c.nombre||'—';schoolLabel=c.colegios?.nombre||'—';}
  }catch(_){}
  const dt=r.fecha?new Date(r.fecha):null;
  const date=dt&&!isNaN(dt.getTime())?dt.toLocaleString('es-CL',{dateStyle:'medium',timeStyle:'short'}):'—';
  const icon=name=>({
   bookmark:'<svg viewBox="0 0 24 24"><path d="M7 4h10v16l-5-3-5 3V4Z"/><path d="M10 8h4"/></svg>',
   user:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
   guardian:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M19 9v8M15 13h8"/></svg>',
   cap:'<svg viewBox="0 0 24 24"><path d="m3 9 9-5 9 5-9 5-9-5ZM7 12v5m10-5v5"/></svg>',
   school:'<svg viewBox="0 0 24 24"><path d="M4 21h16M6 21V9l6-4 6 4v12M9 12h6"/></svg>',
   card:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/></svg>',
   check:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>'
  })[name]||'';
  const fields=[
   ['bookmark','Campaña',items.length===1?(items[0].campana||items[0].concepto):items.length+' cuotas / campañas'],
   ['user','Alumno',r.alumno],['guardian','Apoderado',r.apoderado],
   ['cap','Curso',courseLabel],['school','Colegio',schoolLabel],
   ['card','Forma de pago',String(r.medio||'—').replace(/^./,v=>v.toUpperCase())],
   ['check','Estado',reversed?'Reversado':'Pagado'],['check','Folio',r.folio]
  ];
  const rows=fields.map(([kind,label,value])=>'<div class="receiptV51Row '+(label==='Estado'?'is-status':'')+'"><span class="receiptV51RowIcon">'+icon(kind)+'</span><span class="receiptV51RowLabel">'+esc(label)+'</span><strong>'+(label==='Estado'?'<span class="receiptV51PaidPill">'+esc(value)+'</span>':esc(value||'—'))+'</strong></div>').join('');
  const detail=items.length>1?'<div class="mxManualReceiptBreakdown"><b>Detalle de cuotas</b>'+items.map(x=>'<div>'+esc(x.campana||x.concepto||'Cuota')+' · '+esc(x.periodo||'—')+' <b>'+clp(x.monto)+'</b></div>').join('')+'</div>':'';
  const html='<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Comprobante MiCursoX</title><link rel="stylesheet" href="/assets/apoderado-home-v40.css?v=58"><style>'+
   'html,body{margin:0;min-height:100%;background:#f4f6fb}body{padding:20px 12px;font-family:system-ui,-apple-system,sans-serif;color:#0f172a}.mxManualReceiptWrap{max-width:620px;margin:0 auto;background:white;padding:14px;border-radius:24px}.receiptV51Shell{min-height:auto!important}.receiptV52Topbar{display:flex!important;justify-content:space-between!important;align-items:center!important;gap:12px!important;padding:8px 4px 16px!important}.receiptV52Actions{display:flex!important;gap:8px!important}.receiptV52ActionBtn{cursor:pointer}.receiptV51Card{margin:0 auto!important}.receiptV51Row strong{overflow-wrap:anywhere}.receiptV51Details{position:relative}.mxManualReceiptBreakdown{margin:0 22px 18px;text-align:left;font-size:13px}.mxManualReceiptBreakdown>div{display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;padding:7px 0;gap:8px}.receiptV52BottomActions{display:flex!important;gap:12px!important;padding:14px 2px}.receiptV52BottomActions button{flex:1}.mxReversed .receiptV51Status{color:#b91c1c!important}.mxReversed .receiptV51PaidPill{background:#fee2e2!important;color:#b91c1c!important}@media print{@page{margin:10mm}html,body{background:white!important;padding:0!important}.mxManualReceiptWrap{padding:0!important;max-width:560px}.receiptV52Topbar,.receiptV52BottomActions{display:none!important}.receiptV51Card{break-inside:avoid!important;box-shadow:none!important}}'+
   '</style></head><body class="apoderado-home-v40"><div class="mxManualReceiptWrap '+(reversed?'mxReversed':'')+'"><div class="receiptV51Shell"><div class="receiptV51Topbar receiptV52Topbar"><div class="receiptV51Brand receiptV52Brand"><span class="receiptV51BrandIcon">👥</span><span>MiCursoX</span></div><div class="receiptV52Actions"><button class="receiptV52ActionBtn" id="mxPrint">⇩<small>PDF</small></button><button class="receiptV52ActionBtn" id="mxShare">⤴<small>Compartir</small></button><button class="receiptV52ActionBtn" id="mxClose">×<small>Cerrar</small></button></div></div>'+
   '<section class="receiptV51Card receiptV52Card"><div class="receiptV51Status"><span>'+(reversed?'×':'✓')+'</span>'+esc(reversed?'Pago reversado · sin vigencia':'Registrado por tesorería')+'</div><div class="receiptV51Amount">'+clp(r.total)+'</div><div class="receiptV51Date">'+esc(date)+'</div><div class="receiptV51Divider"></div><div class="receiptV51Details"><div class="receiptV51Watermark" aria-hidden="true"><div class="receiptV51StampRing"><div class="receiptV51StampTop">DIRECTIVA</div><div class="receiptV51Shield">'+esc(courseLabel.replace(/\s*2026\s*/,'').trim())+'</div><div class="receiptV51StampYear">'+esc(String(dt?.getFullYear()||''))+'</div><div class="receiptV51StampBottom">'+(reversed?'REVERSADO':'PAGADO')+'</div></div></div>'+rows+'</div>'+detail+'<div class="receiptV51Divider receiptV52DividerBottom"></div><div class="receiptV51Trust"><span>🔒</span><div><p>'+(reversed?'Operación reversada. Comprobante sin vigencia.':'Pago registrado y conciliado por <b>tesorería.</b>')+'</p><small>'+(reversed?'El registro se conserva como evidencia histórica.':'Este comprobante acredita el pago registrado por la directiva del curso.')+'</small></div></div></section><div class="receiptV52BottomActions"><button class="receiptV51Primary" id="mxPrintBottom">⇩ PDF</button><button class="receiptV51Secondary" id="mxShareBottom">⤴ Compartir PDF</button></div></div></div></body></html>';
  w.document.open();w.document.write(html);w.document.close();
  const loadScript=(url,test)=>new Promise((resolve,reject)=>{
    if(test()){resolve();return}
    const script=w.document.createElement('script');
    script.src=url;script.onload=()=>test()?resolve():reject(new Error('Dependencia no disponible'));script.onerror=()=>reject(new Error('No fue posible cargar el generador visual'));
    w.document.head.appendChild(script);
  });
  const visualPdf=async()=>{
    await Promise.all([
      loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',()=>typeof w.html2canvas==='function'),
      loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',()=>!!w.jspdf?.jsPDF)
    ]);
    await w.document.fonts?.ready;
    const card=w.document.querySelector('.receiptV52Card');
    if(!card)throw new Error('Tarjeta de comprobante no encontrada');
    const canvas=await w.html2canvas(card,{backgroundColor:'#ffffff',scale:2,useCORS:true,logging:false,scrollX:0,scrollY:0,windowWidth:Math.max(w.innerWidth,card.scrollWidth)});
    if(!canvas.width||!canvas.height)throw new Error('Captura vacía');
    const pdf=new w.jspdf.jsPDF({orientation:'portrait',unit:'pt',format:'a4',compress:true});
    const margin=26,pageWidth=pdf.internal.pageSize.getWidth(),pageHeight=pdf.internal.pageSize.getHeight();
    const targetW=pageWidth-margin*2;
    const availableH=pageHeight-margin*2;
    const naturalH=canvas.height*targetW/canvas.width;
    if(items.length===1 && naturalH>availableH){
      const fit=Math.min(targetW/canvas.width,availableH/canvas.height);
      pdf.addImage(canvas.toDataURL('image/png'),'PNG',(pageWidth-canvas.width*fit)/2,margin,canvas.width*fit,canvas.height*fit,undefined,'FAST');
      return pdf.output('blob');
    }
    const slicePixels=Math.max(1,Math.floor((pageHeight-margin*2)*canvas.width/targetW));
    let offset=0,page=0;
    while(offset<canvas.height){
      if(page++)pdf.addPage();
      const h=Math.min(slicePixels,canvas.height-offset);
      const fragment=w.document.createElement('canvas');fragment.width=canvas.width;fragment.height=h;
      fragment.getContext('2d').drawImage(canvas,0,offset,canvas.width,h,0,0,canvas.width,h);
      pdf.addImage(fragment.toDataURL('image/png'),'PNG',margin,margin,targetW,h*targetW/canvas.width,undefined,'FAST');
      offset+=h;
    }
    const out=pdf.output('blob');
    if(out.size<1000)throw new Error('PDF visual vacío');
    return out;
  };
  const filename='Comprobante-MiCursoX-'+String(r.folio).replace(/[^a-z0-9-]/gi,'')+'.pdf';
  const blob=async()=>{try{return await visualPdf()}catch(e){console.warn('[MiCursoX] Respaldo PDF vectorial',e);return manualReceiptPdf(r,items,courseLabel,schoolLabel,date,reversed)}};
  const download=async()=>{const url=URL.createObjectURL(await blob());const a=w.document.createElement('a');a.href=url;a.download=filename;w.document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)};
  const share=async()=>{const file=new File([await blob()],filename,{type:'application/pdf'});try{if(w.navigator.share&&(!w.navigator.canShare||w.navigator.canShare({files:[file]}))){await w.navigator.share({title:'Comprobante MiCursoX',files:[file]});return}}catch(e){if(e?.name==='AbortError')return}download()};
  ['mxPrint','mxPrintBottom'].forEach(x=>w.document.getElementById(x)?.addEventListener('click',download));
  ['mxShare','mxShareBottom'].forEach(x=>w.document.getElementById(x)?.addEventListener('click',share));
  w.document.getElementById('mxClose')?.addEventListener('click',()=>w.close());
 }catch(e){try{w.close()}catch(_){}alert(e?.message||'No se pudo consultar el comprobante.')}
}
window.MICURSOX_MANUAL_RECEIPT=receipt;
async function render(){const r=role(),c=course();const app=document.getElementById('app');if(!app||!c||!api()?.request)return;const pay=r==='apoderado'&&!!app.querySelector('.apoPayPage');const dash=r!=='apoderado'&&!!app.querySelector('.mxManualPaymentEntry-home');if(!pay&&!dash){if(summaryCard)summaryCard.hidden=true;return}
 const key=r+'|'+c+'|'+(pay?'pay':'home');const existing=dash?summaryCard:app.querySelector('.apoPayPage .mxManualTraceCard');if(dash&&summaryCard&&summaryCard.parentElement!==app)app.appendChild(summaryCard);if(existing)existing.hidden=false;if(pending){if(lastKey!==key)refreshRequested=true;return}if(lastKey===key&&existing&&!refreshRequested)return;pending=true;refreshRequested=false;lastKey=key;
 const wrapper=existing||document.createElement('section');wrapper.className='mxManualTraceCard';if(dash){wrapper.id='mxManualTraceSummary';summaryCard=wrapper;}if(!existing){wrapper.innerHTML='<strong>'+(pay?'Comprobantes de pagos manuales':'Recaudación por medio de pago')+'</strong><p>Consultando información actualizada…</p>'; (pay?app.querySelector('.apoPayPage'):app).appendChild(wrapper);}
 try{if(dash){const x=await send('resumen_medios_pago_curso',{p_curso_id:c});if(!wrapper.isConnected)return;wrapper.innerHTML='<strong>Recaudación por medio de pago</strong><div class="mxManualTraceGrid">'+[['Transferencias',x.transferencia],['Efectivo',x.efectivo],['Transbank',x.transbank],['Saldo a favor',x.saldo_favor],['Histórico sin clasificar',x.sin_clasificar],['Total recaudado',x.total]].map(a=>'<div><small>'+esc(a[0])+'</small><b>'+clp(a[1])+'</b></div>').join('')+'</div><small>Los pagos históricos sin medio acreditado no se asignan a efectivo ni transferencia.</small>';}
 else{const user=await api().getCurrentUser();const ms=await api().request('miembros_curso?select=id,curso_id,usuario_id&curso_id=eq.'+encodeURIComponent(c)+'&usuario_id=eq.'+encodeURIComponent(user.id)+'&limit=20');const ids=(Array.isArray(ms)?ms:[]).map(m=>m.id);let list=[];for(const id of ids){const rows=await send('listar_operaciones_manuales',{p_curso_id:c,p_miembro_id:id});if(Array.isArray(rows))list.push(...rows)}list.sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)));if(!wrapper.isConnected)return;wrapper.innerHTML='<strong>Comprobantes de pagos manuales</strong>'+(list.length?list.map(o=>'<div class="mxManualTraceRow"><span>'+esc(new Date(o.fecha).toLocaleDateString('es-CL'))+' · '+esc(o.alumno)+'<br><b>'+clp(o.monto_total)+'</b> · '+esc(o.medio)+'</span><button type="button" data-receipt="'+esc(o.id)+'">Ver comprobante</button></div>').join(''):'<p>Aún no hay comprobantes de pagos manuales vinculados a tu cuenta.</p>');wrapper.querySelectorAll('[data-receipt]').forEach(b=>b.addEventListener('click',()=>receipt(b.dataset.receipt)));}
 }catch(e){if(wrapper.isConnected)wrapper.innerHTML='<strong>'+(pay?'Comprobantes de pagos manuales':'Recaudación por medio de pago')+'</strong><p>Información no disponible: '+esc(e?.message||'Revisa tu sesión.')+'</p>';lastKey='';}finally{pending=false;if(refreshRequested){refreshRequested=false;lastKey='';queueMicrotask(render)}}}
function boot(){
 const app=document.getElementById('app')||document.body;
 let queued=false;
 const tick=()=>{if(queued)return;queued=true;setTimeout(()=>{queued=false;render()},350)};
 new MutationObserver(tick).observe(app,{childList:true,subtree:false});
 window.addEventListener('cursapp:dataUpdated',e=>{if(!isFinancialEvent(e))return;lastKey='';if(pending)refreshRequested=true;else tick()});
 window.addEventListener('cursapp:manualTraceRefresh',()=>{lastKey='';if(pending)refreshRequested=true;else tick()});
 window.MICURSOX_REFRESH_MANUAL_TRACE=()=>window.dispatchEvent(new Event('cursapp:manualTraceRefresh'));
 tick();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();