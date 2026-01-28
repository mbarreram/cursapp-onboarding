(function(){
  const KEY_PAYMENTS = "cursapp_payments_v1";
  const load = (k, def)=>{ try{ return JSON.parse(localStorage.getItem(k) || JSON.stringify(def)); }catch{ return def; } };
  const save = (k, v)=> localStorage.setItem(k, JSON.stringify(v));
  const clp = (n)=> "$"+Number(n||0).toLocaleString("es-CL");
  const esc = (s)=> String(s??"").replace(/[&<>'"]/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[c]));

  const u = new URL(location.href);
  const ok = u.searchParams.get("ok")==="1";
  const pid = u.searchParams.get("pid")||"";
  const amount = Number(u.searchParams.get("amount")||0);
  const auth = u.searchParams.get("auth")||"";
  const resp = u.searchParams.get("resp")||"";
  const buy = u.searchParams.get("buy")||"";
  const reason = u.searchParams.get("reason")||"";
  const msg = u.searchParams.get("msg")||"";

  const el = document.getElementById("content");
  const backToPayments = ()=> location.href = '/apoderado.html#payments';

  if(ok){
    const pays = load(KEY_PAYMENTS, []);
    const i = pays.findIndex(x=>x.id===pid);
    if(i>=0){
      pays[i].status="paid";
      pays[i].paidAt=new Date().toISOString();
      pays[i].paidWith="webpay";
      pays[i].webpay = { authorizationCode: auth, responseCode: resp, amount, buyOrder: buy };
      pays[i].transactionId = buy || pays[i].transactionId;
      save(KEY_PAYMENTS, pays);
    }

    try{ sessionStorage.setItem("justPaid","1"); }catch(e){}

    el.innerHTML = `
      <div class="card">
        <div class="kTitle">✅ Pago aprobado</div>
        <div class="muted" style="margin-top:6px;">Redirigiendo a Pagos…</div>
        <div class="muted" style="margin-top:6px;">Monto: <b>${clp(amount)}</b></div>
        <div class="muted" style="margin-top:6px;">Autorización: <b>${esc(auth||"—")}</b></div>
        <div class="muted" style="margin-top:6px;font-size:12px;">resp_code: <b>${esc(resp||"")}</b></div>
        <div class="actions" style="margin-top:14px;justify-content:flex-end;">
          <button class="btnx primary" id="btnBack">Volver a Pagos</button>
        </div>
      </div>

      <div class="card" style="margin-top:12px;">
        <div class="kTitle">🧾 Comprobante</div>
        <div class="listLines" style="margin-top:12px;">
          <div class="lineItem"><b>Monto:</b> ${clp(amount)}</div>
          <div class="lineItem"><b>Autorización:</b> ${esc(auth||"—")}</div>
          <div class="lineItem"><b>Fecha:</b> ${esc(new Date().toLocaleString("es-CL"))}</div>
          <div class="lineItem"><b>Operación:</b> ${esc(buy||"—")}</div>
          <div class="lineItem"><b>ID pago:</b> ${esc(pid)}</div>
        </div>
      </div>
    `;

    document.getElementById("btnBack").onclick = backToPayments;

    // Redirección automática a Pagos (éxito)
    setTimeout(backToPayments, 1200);

  }else{
    el.innerHTML = `
      <div class="card">
        <div class="kTitle">⚠️ Pago no completado</div>
        <div class="muted" style="margin-top:6px;">Puede haber sido cancelado o rechazado.</div>
        ${reason ? `<div class="muted" style="margin-top:10px;font-size:12px;"><b>reason:</b> ${esc(reason)}</div>` : ``}
        ${msg ? `<div class="muted" style="margin-top:6px;font-size:12px;line-height:1.35;"><b>msg:</b> ${esc(msg)}</div>` : ``}
        ${resp ? `<div class="muted" style="margin-top:6px;font-size:12px;"><b>resp_code:</b> ${esc(resp)}</div>` : ``}
        <div class="actions" style="margin-top:14px;justify-content:flex-end;">
          <button class="btnx" id="btnBack">Volver a Pagos</button>
        </div>
      </div>
    `;
    document.getElementById("btnBack").onclick = backToPayments;

    // Redirección automática a Pagos (éxito)
    setTimeout(backToPayments, 1200);
  }
})();