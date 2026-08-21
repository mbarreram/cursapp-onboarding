(function(){
  'use strict';
  const PACKAGE_BY_CREDITS={10:'basic',30:'plus',60:'pro'};
  const $=(s,r=document)=>r.querySelector(s);
  const clp=n=>'$'+Number(n||0).toLocaleString('es-CL');
  let busy=false;

  function toast(text){
    const el=$('#toast');
    if(!el){ alert(text); return; }
    el.textContent=text;
    el.classList.add('show');
    setTimeout(()=>el.classList.remove('show'),4500);
  }

  function currentBalance(){
    const t=String($('#creditBalanceBadge')?.textContent||'0');
    const n=parseInt(t.replace(/[^0-9-]/g,''),10);
    return Number.isFinite(n)?n:0;
  }

  function confirmPurchase(credits,price){
    return new Promise(resolve=>{
      const modal=$('#modal');
      if(!modal){ resolve(window.confirm(`Comprar ${credits} créditos por ${clp(price)}?`)); return; }
      modal.innerHTML=`<div class="v19ConfirmOverlay"><section class="v19Confirm"><h2>Comprar créditos Mercado</h2><div class="v19ConfirmBody"><div class="boostConfirmCard"><p>Comprarás</p><b>${credits} créditos Mercado</b><p class="muted">Monto a pagar con Transbank: ${clp(price)}</p><div class="creditSummary"><span>Saldo actual</span><b>${currentBalance()}</b></div><div class="creditSummary strong"><span>Saldo después del pago</span><b>${currentBalance()+Number(credits||0)}</b></div></div></div><div class="v19ConfirmActions"><button type="button" class="ghost" data-credit-wp-no>Cancelar</button><button type="button" class="primaryBtn" data-credit-wp-yes>Ir a pagar</button></div></section></div>`;
      modal.querySelector('[data-credit-wp-no]')?.addEventListener('click',()=>{modal.innerHTML='';resolve(false)},{once:true});
      modal.querySelector('[data-credit-wp-yes]')?.addEventListener('click',()=>{modal.innerHTML='';resolve(true)},{once:true});
    });
  }

  function goToTransbank(url,token){
    const form=document.createElement('form');
    form.method='POST';
    form.action=url;
    form.style.display='none';
    const input=document.createElement('input');
    input.type='hidden';
    input.name='token_ws';
    input.value=token;
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
  }

  async function startPurchase(btn){
    if(busy) return;
    const credits=Number(btn.dataset.buyCredits||0);
    const price=Number(btn.dataset.price||0);
    const packageCode=PACKAGE_BY_CREDITS[credits];
    if(!packageCode){ toast('Este paquete no está disponible.'); return; }
    if(!(await confirmPurchase(credits,price))) return;
    busy=true;
    btn.disabled=true;
    const old=btn.textContent;
    btn.textContent='Conectando con Transbank…';
    try{
      const fn=window.CURSAPP_SUPABASE?.functions?.invoke;
      if(typeof fn!=='function') throw new Error('No se pudo iniciar el pago.');
      const result=await fn('mercado-credit-create',{body:{package_code:packageCode}});
      if(result?.error) throw result.error;
      const data=result?.data||{};
      if(!data.token||!data.url) throw new Error('No se pudo iniciar el pago.');
      try{sessionStorage.setItem('micursox_market_credit_order',String(data.order_id||''));}catch(_){ }
      goToTransbank(data.url,data.token);
    }catch(e){
      console.error('mercado-credit-webpay',e);
      toast('No se pudo iniciar la compra. Intenta nuevamente.');
      busy=false;
      btn.disabled=false;
      btn.textContent=old;
    }
  }

  function installSecureSpend(){
    const api=window.CursappMarketCredits;
    const sb=window.cursappSupabase;
    if(!api||!sb||typeof sb.rpc!=='function') return false;
    api.spendCredits=async function(cost,extra={}){
      const rule=String(extra.regla||'').toLowerCase();
      try{
        const res=await sb.rpc('spend_mercado_credits',{
          p_rule:rule,
          p_publicacion_id:extra.publicacion_id?String(extra.publicacion_id):null,
          p_descripcion:extra.descripcion||extra.regla_label||'Destacado Mercado'
        });
        if(res.error) throw res.error;
        const data=res.data||{};
        if(typeof api.refresh==='function') await api.refresh();
        return {ok:true,balance:Number(data.saldo_posterior??0),voucher:null};
      }catch(e){
        console.error('mercado-credit-spend',e);
        const msg=String(e?.message||'').toLowerCase().includes('insuficient')?'No tienes créditos suficientes.':'No se pudo usar los créditos. Intenta nuevamente.';
        toast(msg);
        return {ok:false,message:msg};
      }
    };
    return true;
  }

  document.addEventListener('click',function(e){
    const btn=e.target.closest?.('[data-buy-credits]');
    if(!btn) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    startPurchase(btn);
  },true);

  function handleReturn(){
    const qs=new URLSearchParams(location.search);
    const status=qs.get('credit_payment');
    if(!status) return;
    const clean=new URL(location.href);
    ['credit_payment','order','tx','reason'].forEach(k=>clean.searchParams.delete(k));
    history.replaceState({},'',clean.pathname+(clean.search||'')+(clean.hash||''));
    setTimeout(()=>{
      document.querySelector('[data-view="creditos"]')?.click();
      if(status==='approved') toast('Pago confirmado. Tus créditos ya están disponibles.');
      else if(status==='cancelled') toast('Compra cancelada. No se descontó dinero ni se agregaron créditos.');
      else if(status==='rejected') toast('Transbank rechazó la compra. No se agregaron créditos.');
      else if(status==='processing') toast('El pago fue recibido y estamos confirmando los créditos.');
      else toast('No pudimos completar la compra. Intenta nuevamente.');
    },500);
  }

  function boot(){
    handleReturn();
    if(!installSecureSpend()){
      let n=0;
      const timer=setInterval(()=>{n++;if(installSecureSpend()||n>30)clearInterval(timer);},150);
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();