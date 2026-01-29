(function(){
  const KEY_PAYMENTS = "cursapp_payments_v1";
  const load = (k, def)=>{ try{ return JSON.parse(localStorage.getItem(k) || JSON.stringify(def)); }catch{ return def; } };
  const save = (k, v)=> localStorage.setItem(k, JSON.stringify(v));
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
  const goPaid = ()=> location.href = "/apoderado.html#payments_paid";

  if(ok){
    const pays = load(KEY_PAYMENTS, []);
    const i = pays.findIndex(x=>x.id===pid);
    let taskId = "";
    if(i>=0){
      taskId = pays[i].fromTaskId || "";
      pays[i].status="paid";
      pays[i].paidAt=new Date().toISOString();
      pays[i].paidWith="webpay";
      pays[i].webpay = { authorizationCode: auth, responseCode: resp, amount, buyOrder: buy };
      pays[i].transactionId = buy || pays[i].transactionId;
      save(KEY_PAYMENTS, pays);
    }

    try{
      sessionStorage.setItem("justPaid","1");
      sessionStorage.setItem("justPaidPaymentId", pid);
      if(taskId) sessionStorage.setItem("justPaidTaskId", taskId);
    }catch(e){}

    el.innerHTML = `
      <div class="card">
        <div class="kTitle">✅ Pago aprobado</div>
        <div class="muted" style="margin-top:6px;">Redirigiendo a Pagos…</div>
        <div style="margin-top:12px;height:10px;border-radius:999px;background:rgba(17,24,39,.08);overflow:hidden;">
          <div style="height:100%;width:70%;background:rgba(34,197,94,.65);"></div>
        </div>
      </div>
    `;
    setTimeout(goPaid, 450);
  }else{
    el.innerHTML = `
      <div class="card">
        <div class="kTitle">⚠️ Pago no completado</div>
        <div class="muted" style="margin-top:6px;">Puede haber sido cancelado o rechazado.</div>
        ${reason?`<div class="muted" style="margin-top:10px;font-size:12px;"><b>reason:</b> ${esc(reason)}</div>`:""}
        ${msg?`<div class="muted" style="margin-top:6px;font-size:12px;line-height:1.35;"><b>msg:</b> ${esc(msg)}</div>`:""}
        ${resp?`<div class="muted" style="margin-top:6px;font-size:12px;"><b>resp_code:</b> ${esc(resp)}</div>`:""}
        <div class="actions" style="margin-top:14px;justify-content:flex-end;">
          <button class="btnx" onclick="location.href='/apoderado.html#payments'">Volver a Pagos</button>
        </div>
      </div>
    `;
  }
})();