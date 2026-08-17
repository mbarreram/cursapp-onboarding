(function(){
  'use strict';

  function activateRetiroButton(){
    document.querySelectorAll('.sideItem').forEach(x=>x.classList.remove('active'));
    const btn=document.querySelector('.sideItem[data-tab="retiros"]');
    if(btn) btn.classList.add('active');
    document.body.classList.remove('sideOpen');
  }

  async function openRetiros(){
    activateRetiroButton();
    const app=document.getElementById('adminApp');
    const title=document.getElementById('viewTitle');
    const sub=document.getElementById('viewSub');
    if(title) title.textContent='Retiros';
    if(sub) sub.textContent='Control de solicitudes, depósitos y saldos por curso';
    if(!window.MX_ADMIN_WITHDRAWALS || typeof window.MX_ADMIN_WITHDRAWALS.open!=='function'){
      if(app) app.innerHTML='<section class="panel"><div class="panelHead"><h2>Retiros</h2></div><p class="muted" style="font-weight:800;color:#b42318">El módulo de Retiros no terminó de cargar. Recarga la página e intenta nuevamente.</p></section>';
      return;
    }
    try{
      await window.MX_ADMIN_WITHDRAWALS.open();
    }catch(error){
      console.error('[Admin Retiros]',error);
      if(app) app.innerHTML='<section class="panel"><div class="panelHead"><h2>No se pudo cargar Retiros</h2></div><p class="muted" style="font-weight:800;color:#b42318">'+String(error?.message||error||'Error desconocido')+'</p><button class="adminBtn" id="mxRetryWithdrawals">Reintentar</button></section>';
      document.getElementById('mxRetryWithdrawals')?.addEventListener('click',openRetiros);
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
      if(patchAdminGo() || tries>20) clearInterval(timer);
    },150);
  }

  window.MX_ADMIN_WITHDRAWALS_NAV={open:openRetiros};
})();