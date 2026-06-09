(function(){
  "use strict";
  const esc = (s)=> String(s??"").replace(/[&<>'"]/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[c]));
  const u = new URL(location.href);
  const ok = u.searchParams.get("ok")==="1";
  const pid = u.searchParams.get("pid")||"";
  const msg = u.searchParams.get("msg")||"";
  const el = document.getElementById("content");
  const goPaid = ()=> location.href = "/apoderado.html#payments_paid";

  if(ok){
    try{ sessionStorage.setItem("justPaid","1"); if(pid) sessionStorage.setItem("justPaidPaymentId", pid); }catch(e){}
    el.innerHTML = `
      <div class="card">
        <div class="kTitle">✅ Pago registrado</div>
        <div class="muted" style="margin-top:6px;">El pago demo fue actualizado en Supabase.</div>
        <div style="margin-top:12px;height:10px;border-radius:999px;background:rgba(17,24,39,.08);overflow:hidden;">
          <div style="height:100%;width:100%;background:rgba(34,197,94,.65);"></div>
        </div>
        <div class="actions" style="margin-top:14px;justify-content:flex-end;">
          <button class="btnx primary" onclick="location.href='/apoderado.html#payments_paid'">Ver pagos</button>
        </div>
      </div>`;
    setTimeout(goPaid, 900);
  }else{
    el.innerHTML = `
      <div class="card">
        <div class="kTitle">⚠️ Pago no completado</div>
        <div class="muted" style="margin-top:6px;">${esc(msg || "No se registró el pago.")}</div>
        <div class="actions" style="margin-top:14px;justify-content:flex-end;">
          <button class="btnx" onclick="location.href='/apoderado.html#payments'">Volver a Pagos</button>
        </div>
      </div>`;
  }
})();
