(function(){'use strict';if(window.__MX_MANUAL_TRACE_UI_V1__)return;window.__MX_MANUAL_TRACE_UI_V1__=true;
const api=()=>window.CURSAPP_SUPABASE;const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const clp=x=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(x)||0);
const course=()=>{try{const c=JSON.parse(localStorage.getItem('cursapp_course_v1')||'{}'),s=JSON.parse(localStorage.getItem('cursapp_session_v1')||'{}');return c?.course?.id||c?.id||c?.curso_id||s?.courseId||s?.course?.id||''}catch(_){return''}};
const send=(name,obj)=>api().request('rpc/'+name,{method:'POST',body:JSON.stringify(obj)});
const role=()=>document.body.classList.contains('cursapp-tesorero')?'tesorero':document.body.classList.contains('cursapp-presidente')?'presidente':document.body.classList.contains('cursapp-apoderado')?'apoderado':'';
let lastKey='',pending=false,refreshRequested=false,summaryCard=null;
const FINANCIAL_SOURCES=new Set(['reversa-manual','pago-manual','registro-pago-manual','manual-payment','manual-payment-reversal','conciliacion-manual','transbank-payment']);
const isFinancialEvent=e=>{const d=e?.detail||{};return d.financial===true||FINANCIAL_SOURCES.has(d.source)};
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
  const print=()=>w.print();
  const share=async()=>{if(w.navigator.share){try{await w.navigator.share({title:'Comprobante MiCursoX',text:'Folio '+r.folio});return}catch(e){if(e?.name==='AbortError')return}}w.print()};
  ['mxPrint','mxPrintBottom'].forEach(x=>w.document.getElementById(x)?.addEventListener('click',print));
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