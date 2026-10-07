(function(){
'use strict';
if(window.__MX_PRES_BALANCE_DISCLAIMER_V1__)return;
window.__MX_PRES_BALANCE_DISCLAIMER_V1__=true;
function injectCss(){
 if(document.getElementById('mxPresBalanceDisclaimerCss'))return;
 const s=document.createElement('style');s.id='mxPresBalanceDisclaimerCss';s.textContent=
 '.mxBalanceDisclaimer{margin:12px 0 4px;padding:14px 15px;border:1px solid #e9d5ff;border-radius:18px;background:linear-gradient(135deg,#faf5ff,#f8fafc);display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:11px;align-items:start}'+
 '.mxBalanceDisclaimerIcon{font-size:20px;line-height:1.2}.mxBalanceDisclaimerText{min-width:0}.mxBalanceDisclaimerText b{display:block;color:#4c1d95;font-size:13px;font-weight:950}'+
 '.mxBalanceDisclaimerText p{margin:5px 0 0;color:#64748b;font-size:12px;line-height:1.42;font-weight:700}.mxBalanceDisclaimerText strong{color:#334155}'+
 '.mxBalanceDisclaimer button{border:1px solid #ddd6fe;border-radius:12px;background:#fff;color:#6d28d9;padding:9px 11px;font-size:12px;font-weight:900;white-space:nowrap}'+
 '@media(max-width:560px){.mxBalanceDisclaimer{grid-template-columns:auto minmax(0,1fr);padding:13px}.mxBalanceDisclaimer button{grid-column:1/-1;width:100%;margin-top:2px}}';
 document.head.appendChild(s);
}
function makeNote(kind){
 const el=document.createElement('section');el.className='mxBalanceDisclaimer';el.dataset.mxBalanceDisclaimer=kind;
 const funds=kind==='funds';
 el.innerHTML='<div class="mxBalanceDisclaimerIcon">ℹ️</div><div class="mxBalanceDisclaimerText"><b>'+(funds?'Saldo retirable vs. caja del curso':'Importante sobre el saldo disponible')+'</b><p>'+(funds?'El monto disponible para retirar refleja fondos procesados por MiCursoX. No reemplaza el saldo contable real del curso si existen gastos aún no registrados.':'Este monto se calcula con los ingresos y gastos registrados en MiCursoX. Si la directiva realizó gastos que aún no han sido ingresados, el saldo puede ser mayor al dinero realmente disponible del curso.')+'</p><p><strong>Registra y mantén actualizados los gastos de las campañas</strong> para que la caja del curso refleje la realidad.</p></div><button type="button">Revisar campañas</button>';
 el.querySelector('button').onclick=()=>{if(typeof window.go==='function')window.go('campanas')};
 return el;
}
function rename(root){
 if(!root)return;
 root.querySelectorAll('small,.label,.t,span').forEach(n=>{if(String(n.textContent||'').trim()==='Saldo disponible')n.textContent='Saldo disponible registrado'});
}
function apply(){
 injectCss();
 const kpis=document.querySelector('.presMockKpis');
 if(kpis){
   [...kpis.querySelectorAll('.presMockKpi')].forEach(card=>{
     const label=card.querySelector('small');
     if(String(label?.textContent||'').trim()==='Saldo disponible'){
       label.textContent='Saldo disponible registrado';
       const sub=card.querySelector('em');if(sub)sub.textContent='Ingresos − gastos registrados';
     }
   });
   if(!document.querySelector('[data-mx-balance-disclaimer="home"]'))kpis.insertAdjacentElement('afterend',makeNote('home'));
 }
 document.querySelectorAll('.mxUnifiedReport,.mxR2,#informeRoot').forEach(root=>{
   rename(root);
   const holder=root.querySelector('.mxURKpis,.mxR2Kpis');
   if(holder&&!root.querySelector('[data-mx-balance-disclaimer="report"]'))holder.insertAdjacentElement('afterend',makeNote('report'));
 });
 const hero=document.querySelector('.mxFundsHero');
 if(hero&&!document.querySelector('[data-mx-balance-disclaimer="funds"]'))hero.insertAdjacentElement('afterend',makeNote('funds'));
}
let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}
function boot(){apply();const app=document.getElementById('app');if(app)new MutationObserver(schedule).observe(app,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();