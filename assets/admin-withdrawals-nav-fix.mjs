(function(){
  'use strict';

  let loadingPromise=null;

  function activateRetiroButton(){
    document.querySelectorAll('.sideItem').forEach(x=>x.classList.remove('active'));
    const btn=document.querySelector('.sideItem[data-tab="retiros"]');
    if(btn) btn.classList.add('active');
    document.body.classList.remove('sideOpen');
  }

  function showError(message){
    const app=document.getElementById('adminApp');
    const title=document.getElementById('viewTitle');
    const sub=document.getElementById('viewSub');
    if(title) title.textContent='Retiros';
    if(sub) sub.textContent='Control de solicitudes, depósitos y saldos por curso';
    if(app) app.innerHTML=`<section class="panel"><div class="panelHead"><h2>No se pudo cargar Retiros</h2></div><p class="muted" style="font-weight:800;color:#b42318">${String(message||'Error desconocido')}</p><button class="adminBtn" id="mxRetryWithdrawals">Reintentar</button></section>`;
    document.getElementById('mxRetryWithdrawals')?.addEventListener('click',openRetiros);
  }

  async function ensureModule(){
    if(window.MX_ADMIN_WITHDRAWALS?.open) return window.MX_ADMIN_WITHDRAWALS;
    if(!loadingPromise){
      loadingPromise=import('/assets/admin-withdrawals.mjs?v=5').then(()=>{
        if(!window.MX_ADMIN_WITHDRAWALS?.open) throw new Error('El módulo cargó pero no expuso su función de apertura.');
        return window.MX_ADMIN_WITHDRAWALS;
      }).finally(()=>{loadingPromise=null});
    }
    return loadingPromise;
  }

  async function openRetiros(){
    activateRetiroButton();
    const app=document.getElementById('adminApp');
    const title=document.getElementById('viewTitle');
    const sub=document.getElementById('viewSub');
    if(title) title.textContent='Retiros';
    if(sub) sub.textContent='Control de solicitudes, depósitos y saldos por curso';
    if(app) app.innerHTML='<section class="panel"><p class="muted" style="font-weight:800">Cargando retiros…</p></section>';
    try{
      const mod=await ensureModule();
      await mod.open();
    }catch(error){
      console.error('[Admin Retiros]',error);
      showError(error?.message||error);
    }
  }

  function patchAdminGo(){
    if(!window.Admin || window.Admin.__mxWithdrawalsPatched) return false;
    const originalGo=typeof window.Admin.go==='function' ? window.Admin.go.bind(window.Admin) : null;
    window.Admin.go=function(tab){
      if(tab==='retiros'){
        openRetiros();
        return;
      }
      return originalGo ? originalGo(tab) : undefined;
    };
    Object.defineProperty(window.Admin,'__mxWithdrawalsPatched',{value:true,configurable:true});
    return true;
  }

  document.addEventListener('click',function(e){
    const b=e.target.closest?.('.sideItem[data-tab="retiros"]');
    if(!b) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    openRetiros();
  },true);

  if(!patchAdminGo()){
    let tries=0;
    const timer=setInterval(()=>{
      tries+=1;
      if(patchAdminGo() || tries>40) clearInterval(timer);
    },150);
  }

  window.MX_ADMIN_WITHDRAWALS_NAV={open:openRetiros};
})();