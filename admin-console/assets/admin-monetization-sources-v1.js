(function(){
  'use strict';
  const clp=n=>'$'+Number(n||0).toLocaleString('es-CL');
  const paid=s=>['pagado','pagada','paid'].includes(String(s||'').toLowerCase());
  let loading=false,lastAt=0;

  async function loadRows(path){
    try{
      const fn=window.CURSAPP_SUPABASE?.request;
      if(typeof fn!=='function') return [];
      const data=await fn(path);
      return Array.isArray(data)?data:[];
    }catch(e){console.warn('admin monetization sources',e);return [];}
  }

  function card(label,value,detail){
    return `<div class="kpi"><div class="kpiIcon">💰</div><label>${label}</label><strong>${value}</strong><small>${detail}</small></div>`;
  }

  async function render(){
    const title=document.querySelector('#viewTitle');
    const app=document.querySelector('#adminApp');
    if(!title||!app||String(title.textContent||'').trim()!=='Monetización') return;
    if(app.querySelector('#mxIncomeSources')) return;
    if(loading||Date.now()-lastAt<600) return;
    loading=true;lastAt=Date.now();
    const [orders,pagos]=await Promise.all([
      loadRows('ordenes_creditos?select=estado,monto,monto_total,ingreso_cursapp,creditos,created_at'),
      loadRows('pagos?select=estado,monto,monto_cuota,comision_micursox,paid_at,created_at')
    ]);
    loading=false;
    if(String(document.querySelector('#viewTitle')?.textContent||'').trim()!=='Monetización') return;
    const paidOrders=orders.filter(o=>paid(o.estado));
    const ingresoCreditos=paidOrders.reduce((s,o)=>s+Number(o.ingreso_cursapp||o.monto_total||o.monto||0),0);
    const pagosPagados=pagos.filter(p=>paid(p.estado));
    const ingresoCuotas=pagosPagados.reduce((s,p)=>{
      const stored=Number(p.comision_micursox||0);
      if(stored>0) return s+stored;
      const base=Number(p.monto_cuota??p.monto??0)||0;
      return s+Math.round(base*2.25/100);
    },0);
    const total=ingresoCreditos+ingresoCuotas;
    const wrap=document.createElement('section');
    wrap.id='mxIncomeSources';
    wrap.className='panel';
    wrap.style.marginBottom='18px';
    wrap.innerHTML=`<div class="panelHead"><div><h2>Origen de ingresos MiCursoX</h2><p class="muted">Separación entre comisiones por cuotas y venta directa de créditos Mercado.</p></div></div><div class="kpis" style="margin-top:12px">${card('Comisión pagos de cuotas',clp(ingresoCuotas),`${pagosPagados.length} pagos confirmados`)}${card('Venta créditos Mercado',clp(ingresoCreditos),`${paidOrders.length} compras confirmadas`)}${card('Total monetización',clp(total),'Suma de ambos conceptos')}</div>`;
    app.prepend(wrap);
  }

  const obs=new MutationObserver(()=>render());
  document.addEventListener('DOMContentLoaded',()=>{
    const app=document.querySelector('#adminApp');
    if(app) obs.observe(app,{childList:true,subtree:true});
    const title=document.querySelector('#viewTitle');
    if(title) obs.observe(title,{childList:true,subtree:true,characterData:true});
    render();
  });
})();