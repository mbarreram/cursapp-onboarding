(function(){
  "use strict";

  const esc = (s)=> String(s??"").replace(/[&<>'\"]/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'\"':"&quot;" }[c]));
  const u = new URL(location.href);
  const pid = u.searchParams.get("pid") || "";
  const txId = u.searchParams.get("tx") || "";
  const reason = u.searchParams.get("reason") || "";
  const el = document.getElementById("content");
  const paidUrl = "/apoderado.html#payments_paid";
  const paymentsUrl = "/apoderado.html#payments";

  function loading(title, subtitle){
    if(!el) return;
    el.innerHTML = `
      <section style="min-height:72vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;">
        <div style="width:min(100%,420px);text-align:center;padding:34px 24px;border-radius:26px;background:#fff;box-shadow:0 18px 55px rgba(15,23,42,.08);border:1px solid #e7eaf0;">
          <div style="width:72px;height:72px;margin:0 auto 18px;border-radius:22px;background:#f3f0ff;display:grid;place-items:center;">
            <div style="width:30px;height:30px;border:4px solid #ddd6fe;border-top-color:#6d28d9;border-radius:50%;animation:mxPaySpin .8s linear infinite;"></div>
          </div>
          <h1 style="margin:0;color:#172033;font-size:24px;line-height:1.2;">${esc(title)}</h1>
          <p style="margin:10px 0 0;color:#64748b;font-size:14px;line-height:1.5;">${esc(subtitle)}</p>
        </div>
      </section>
      <style>@keyframes mxPaySpin{to{transform:rotate(360deg)}}</style>`;
  }

  function errorState(title, body){
    if(!el) return;
    el.innerHTML = `
      <section style="min-height:72vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;">
        <div style="width:min(100%,440px);text-align:center;padding:30px 24px;border-radius:26px;background:#fff;box-shadow:0 18px 55px rgba(15,23,42,.08);border:1px solid #e7eaf0;">
          <div style="font-size:42px;margin-bottom:12px;">⚠️</div>
          <h1 style="margin:0;color:#172033;font-size:23px;">${esc(title)}</h1>
          <p style="margin:10px 0 0;color:#64748b;line-height:1.5;">${esc(body)}</p>
          <button id="mxPayResultBack" type="button" style="margin-top:20px;border:0;border-radius:14px;padding:12px 18px;background:#6d28d9;color:#fff;font-weight:800;font-size:14px;">Volver a Pagos</button>
        </div>
      </section>`;
    document.getElementById("mxPayResultBack")?.addEventListener("click", ()=>location.replace(paymentsUrl));
  }

  async function status(){
    if(!window.CURSAPP_SUPABASE || !window.CURSAPP_SUPABASE.functions) throw new Error("No se pudo consultar el pago.");
    const body = txId ? { transaction_id:txId } : { pago_id:pid };
    const result = await window.CURSAPP_SUPABASE.functions.invoke("webpay-status", { body });
    if(result.error) throw result.error;
    return result.data && result.data.transaction;
  }

  const money=n=>'
    loading("Procesando tu pago", "Estamos confirmando la operación con Transbank. No cierres esta ventana.");
    try{
      const tx = await status();
      if(!tx) throw new Error("No se encontró la transacción.");
      const state = String(tx.status || "").toUpperCase();

      if(state === "APPROVED"){
        try{
          sessionStorage.setItem("justPaid","1");
          const paidId = tx.pago_id || tx.payment_id || pid || "";
          if(paidId) sessionStorage.setItem("justPaidPaymentId", paidId);
          if(txId) sessionStorage.setItem("justPaidTransactionId", txId);
          sessionStorage.setItem("justPaidAt", new Date().toISOString());
        }catch(e){}
        try{if(tx.id && await groupedReceipt(tx))return;}catch(_){}
        loading("Pago confirmado", "Listo. Abriremos tu comprobante de pago.");
        setTimeout(function(){ location.replace(paidUrl); }, 650);
        return;
      }

      if(state === "CANCELLED"){
        errorState("Pago cancelado", "La operación fue cancelada antes de completarse. No se registró ningún pago.");
        return;
      }
      if(state === "REJECTED"){
        errorState("Pago no aprobado", "Transbank no aprobó la operación. La cuota continúa pendiente y puedes intentarlo nuevamente.");
        return;
      }

      loading("Verificando tu pago", "La confirmación está tardando un poco más de lo normal.");
      setTimeout(function(){ location.replace(paymentsUrl); }, 1800);
    }catch(e){
      const fallback = reason === "cancelled"
        ? "La operación fue cancelada y no se registró ningún pago."
        : ((e && e.message) || "No se pudo verificar el resultado del pago.");
      errorState("No pudimos confirmar el pago", fallback);
    }
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
  else render();
})();
+Number(n||0).toLocaleString('es-CL');
  async function groupedReceipt(tx){
    const api=window.CURSAPP_SUPABASE;
    if(!api?.functions?.invoke)return false;
    const result=await api.functions.invoke('webpay-group-receipt',{body:{transaction_id:tx.id}});
    if(result.error||!result.data?.ok)return false;
    const r=result.data.receipt;
    if(!r||!Array.isArray(r.cuotas)||r.cuotas.length<2)return false;
    try{['justPaid','justPaidPaymentId','justPaidTransactionId','justPaidAt'].forEach(k=>sessionStorage.removeItem(k));}catch(_){}
    const rows=r.cuotas.map(x=>`<div style="border-top:1px solid #e2e8f0;padding:12px 0;display:flex;justify-content:space-between;gap:14px;"><div><b>${esc(x.campana)}</b><div style="color:#64748b;font-size:12px;">${esc(x.periodo)}</div></div><strong>${money(x.cuota)}</strong></div>`).join('');
    el.innerHTML=`<section id="mxGroupReceipt" style="max-width:620px;margin:20px auto;background:white;border:1px solid #e2e8f0;border-radius:20px;padding:26px;color:#172033;">
     <div style="font-size:15px;color:#5b50b6;font-weight:900;">MiCursoX</div><h1 style="font-size:25px;margin:12px 0;">${r.status==='REFUNDED'?'Comprobante de pago anulado':'Pago múltiple confirmado'}</h1>
     <div style="font-size:13px;color:#64748b;margin-bottom:12px;">Folio: <b>${esc(r.folio)}</b> · ${esc(r.paid_at?new Date(r.paid_at).toLocaleString('es-CL'):'')}</div>
     <h2 style="font-size:16px;margin:18px 0 8px;">Detalle de cuotas (${r.cuotas.length})</h2>${rows}
     <div style="border-top:2px solid #e2e8f0;margin-top:12px;padding-top:12px;display:grid;gap:9px;"><div style="display:flex;justify-content:space-between"><span>Destinado al curso</span><b>${money(r.subtotal)}</b></div><div style="display:flex;justify-content:space-between"><span>Cargos</span><b>${money(r.comisiones)}</b></div><div style="display:flex;justify-content:space-between;font-size:21px"><strong>Total cobrado</strong><strong>${money(r.total)}</strong></div></div>
     <p style="font-size:12px;color:#64748b;margin-top:18px;">Comprobante informativo de MiCursoX. El estado y los valores se obtuvieron del registro oficial del pago.</p></section>
     <div id="mxReceiptActions" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:18px 0;"><button id="mxReceiptPdf" type="button" style="background:#5b50b6;color:white;border:0;border-radius:12px;padding:12px 16px;font-weight:800">Guardar PDF / Imprimir</button><button id="mxReceiptShare" type="button" style="background:white;color:#5b50b6;border:1px solid #5b50b6;border-radius:12px;padding:12px 16px;font-weight:800">Compartir</button><a href="${paidUrl}" style="padding:12px;color:#5b50b6">Ver pagos</a></div>
     <style>@media print{body{background:white!important}.wrap{max-width:100%!important}#mxReceiptActions{display:none!important}#mxGroupReceipt{border:0!important;box-shadow:none!important;max-width:none!important}}</style>`;
    document.getElementById('mxReceiptPdf')?.addEventListener('click',()=>window.print());
    document.getElementById('mxReceiptShare')?.addEventListener('click',async()=>{
      const summary=`MiCursoX · ${r.status==='REFUNDED'?'Pago anulado':'Pago confirmado'}\\nFolio: ${r.folio}\\n${r.cuotas.length} cuotas\\nTotal: ${money(r.total)}`;
      try{if(navigator.share)await navigator.share({title:'Comprobante MiCursoX',text:summary});else if(navigator.clipboard){await navigator.clipboard.writeText(summary);alert('Resumen copiado.');}}catch(_){}
    });
    return true;
  }

  async function render(){
    loading("Procesando tu pago", "Estamos confirmando la operación con Transbank. No cierres esta ventana.");
    try{
      const tx = await status();
      if(!tx) throw new Error("No se encontró la transacción.");
      const state = String(tx.status || "").toUpperCase();

      if(state === "APPROVED"){
        try{
          sessionStorage.setItem("justPaid","1");
          const paidId = tx.pago_id || tx.payment_id || pid || "";
          if(paidId) sessionStorage.setItem("justPaidPaymentId", paidId);
          if(txId) sessionStorage.setItem("justPaidTransactionId", txId);
          sessionStorage.setItem("justPaidAt", new Date().toISOString());
        }catch(e){}
        loading("Pago confirmado", "Listo. Abriremos tu comprobante de pago.");
        setTimeout(function(){ location.replace(paidUrl); }, 650);
        return;
      }

      if(state === "CANCELLED"){
        errorState("Pago cancelado", "La operación fue cancelada antes de completarse. No se registró ningún pago.");
        return;
      }
      if(state === "REJECTED"){
        errorState("Pago no aprobado", "Transbank no aprobó la operación. La cuota continúa pendiente y puedes intentarlo nuevamente.");
        return;
      }

      loading("Verificando tu pago", "La confirmación está tardando un poco más de lo normal.");
      setTimeout(function(){ location.replace(paymentsUrl); }, 1800);
    }catch(e){
      const fallback = reason === "cancelled"
        ? "La operación fue cancelada y no se registró ningún pago."
        : ((e && e.message) || "No se pudo verificar el resultado del pago.");
      errorState("No pudimos confirmar el pago", fallback);
    }
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
  else render();
})();
