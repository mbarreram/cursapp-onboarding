(function(){
  const KEY_PAYMENTS = "cursapp_payments_v1";
  const load = (k, def)=>{ try{ return JSON.parse(localStorage.getItem(k) || JSON.stringify(def)); }catch{ return def; } };
  const save = (k, v)=> localStorage.setItem(k, JSON.stringify(v));
  const clp = (n)=> "$"+Number(n||0).toLocaleString("es-CL");

  const u = new URL(location.href);
  const ok = u.searchParams.get("ok")==="1";
  const pid = u.searchParams.get("pid")||"";
  const amount = Number(u.searchParams.get("amount")||0);
  const auth = u.searchParams.get("auth")||"";
  const resp = u.searchParams.get("resp")||"";

  const el = document.getElementById("content");

  if(ok){
    // DEMO: marcar pagado en localStorage (producción: backend/db)
    const pays = load(KEY_PAYMENTS, []);
    const i = pays.findIndex(x=>x.id===pid);
    if(i>=0){
      pays[i].status="paid";
      pays[i].paidAt=new Date().toISOString();
      pays[i].paidWith="webpay";
      pays[i].webpay = { authorizationCode: auth, responseCode: resp, amount };
      save(KEY_PAYMENTS, pays);
    }

    el.innerHTML = `
      <div class="card">
        <div class="kTitle">✅ Pago aprobado</div>
        <div class="muted" style="margin-top:6px;">Monto: <b>${clp(amount)}</b></div>
        <div class="muted" style="margin-top:6px;">Autorización: <b>${auth||"—"}</b></div>
        <div class="actions" style="margin-top:14px;justify-content:flex-end;">
          <button class="btnx primary" onclick="location.href='/apoderado.html'">Volver a Pagos</button>
        </div>
      </div>
    `;
  }else{
    el.innerHTML = `
      <div class="card">
        <div class="kTitle">⚠️ Pago no completado</div>
        <div class="muted" style="margin-top:6px;">Puede haber sido cancelado o rechazado.</div>
        <div class="actions" style="margin-top:14px;justify-content:flex-end;">
          <button class="btnx" onclick="location.href='/apoderado.html'">Volver</button>
        </div>
      </div>
    `;
  }
})();
