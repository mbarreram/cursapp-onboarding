(function(){
  "use strict";

  const esc = (s)=> String(s??"").replace(/[&<>'"]/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[c]));
  const clp = (n)=> "$" + Number(n||0).toLocaleString("es-CL");
  const u = new URL(location.href);
  const pid = u.searchParams.get("pid") || "";
  const txId = u.searchParams.get("tx") || "";
  const reason = u.searchParams.get("reason") || "";
  const el = document.getElementById("content");
  const paidUrl = "/apoderado.html#payments_paid";

  function card(title, body, success){
    if(!el) return;
    el.innerHTML = `
      <div class="card">
        <div class="kTitle">${title}</div>
        <div class="muted" style="margin-top:8px;line-height:1.5;">${body}</div>
        ${success ? `<div style="margin-top:12px;height:10px;border-radius:999px;background:rgba(17,24,39,.08);overflow:hidden;"><div style="height:100%;width:100%;background:rgba(34,197,94,.65);"></div></div>` : ``}
        <div class="actions" style="margin-top:14px;justify-content:flex-end;">
          <button class="btnx ${success ? 'primary' : ''}" onclick="location.href='${success ? paidUrl : '/apoderado.html#payments'}'">${success ? 'Ver pagos' : 'Volver a Pagos'}</button>
        </div>
      </div>`;
  }

  async function status(){
    if(!window.CURSAPP_SUPABASE || !window.CURSAPP_SUPABASE.functions) throw new Error("No se pudo consultar el pago.");
    const body = txId ? { transaction_id:txId } : { pago_id:pid };
    const result = await window.CURSAPP_SUPABASE.functions.invoke("webpay-status", { body });
    if(result.error) throw result.error;
    return result.data && result.data.transaction;
  }

  async function render(){
    card("Confirmando pago…", "Estamos verificando el resultado directamente con MiCursoX y Transbank.", false);
    try{
      const tx = await status();
      if(!tx) throw new Error("No se encontró la transacción.");
      const state = String(tx.status || "").toUpperCase();
      if(state === "APPROVED"){
        try{ sessionStorage.setItem("justPaid","1"); if(tx.pago_id) sessionStorage.setItem("justPaidPaymentId", tx.pago_id); }catch(e){}
        const auth = tx.authorization_code ? `<br>Autorización: <b>${esc(tx.authorization_code)}</b>` : "";
        const date = tx.transaction_date ? `<br>Fecha: <b>${esc(new Date(tx.transaction_date).toLocaleString('es-CL'))}</b>` : "";
        card("✅ Pago confirmado", `Transbank confirmó correctamente tu pago por <b>${clp(tx.amount)}</b>.${auth}${date}<br><br>La cuota ya quedó registrada como pagada en MiCursoX.<br><br>Volviendo a tus pagos…`, true);
        setTimeout(function(){
          location.replace(paidUrl);
        }, 1600);
        return;
      }
      if(state === "CANCELLED"){
        card("Pago cancelado", "La transacción fue cancelada o abandonada antes de completarse. No se registró ningún pago.", false);
        return;
      }
      if(state === "REJECTED"){
        card("⚠️ Pago no aprobado", "Transbank no aprobó la transacción. La cuota continúa pendiente y puedes intentarlo nuevamente.", false);
        return;
      }
      card("Pago en verificación", "La transacción todavía está siendo verificada. Vuelve a Pagos en unos segundos; MiCursoX no marcará la cuota como pagada hasta recibir confirmación de Transbank.", false);
    }catch(e){
      const fallback = reason === "cancelled" ? "La transacción fue cancelada y no se registró ningún pago." : ((e && e.message) || "No se pudo verificar el resultado del pago.");
      card("⚠️ No pudimos confirmar el pago", esc(fallback), false);
    }
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
  else render();
})();
