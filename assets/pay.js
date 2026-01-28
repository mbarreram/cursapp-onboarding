
(function(){
  const KEY_TASKS = "cursapp_tasks_v1";
  const KEY_PAYMENTS = "cursapp_payments_v1";

  const load = (k, def)=>{ try{ return JSON.parse(localStorage.getItem(k) || JSON.stringify(def)); }catch{ return def; } };
  const esc = (s)=> String(s??"").replace(/[&<>'"]/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[c]));
  const clp = (n)=> "$"+Number(n||0).toLocaleString("es-CL");

  function qs(){
    const u = new URL(location.href);
    return { pid: u.searchParams.get("pid")||"", cid: u.searchParams.get("cid")||"" };
  }

  async function callFn(name, payload){
    const res = await fetch(`/.netlify/functions/${name}`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(payload||{})
    });
    const data = await res.json().catch(()=> ({}));
    if(!res.ok) throw new Error(data.error || "Error");
    return data;
  }

  function render(){
    const {pid, cid} = qs();
    const el = document.getElementById("content");

    const pays = load(KEY_PAYMENTS, []);
    const tasks = load(KEY_TASKS, []);
    const p = pays.find(x=>x.id===pid);
    const t = p ? tasks.find(tt=>tt.id===p.fromTaskId) : null;

    if(!p){
      el.innerHTML = `<div class="card"><div class="kTitle">Pago no encontrado</div><div class="muted" style="margin-top:6px;">Vuelve a Pagos e inténtalo nuevamente.</div></div>`;
      return;
    }

    const amount = Number(p.amountRemaining ?? p.amount ?? 0);

    el.innerHTML = `
      <div class="card">
        <div class="kTitle">Resumen</div>
        <div class="muted" style="margin-top:6px;">Campaña: <b>${esc(t?.title||"—")}</b></div>
        <div class="muted" style="margin-top:6px;">Vence: <b>${esc(p.dueDate||"—")}</b></div>
        <div style="margin-top:10px;font-weight:950;font-size:22px;">Total: ${clp(amount)}</div>
      </div>

      <div class="card" style="margin-top:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div class="kTitle">Método de pago</div>
          <span class="badge">Transbank</span>
        </div>
        <div class="muted" style="margin-top:6px;">Pago con tarjetas vía Webpay Plus (Integración).</div>

        <div class="method" style="margin-top:12px;">
          <div>
            <div class="t">Webpay Plus</div>
            <div class="muted s">Serás redirigido a Transbank para pagar.</div>
          </div>
          <div>
            <span class="badge">Recomendado</span>
            <div style="margin-top:8px;display:flex;justify-content:flex-end;">
              <button class="btnx primary" id="btnWebpay">Ir a Webpay</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById("btnWebpay").onclick = async ()=>{
      const btn = document.getElementById("btnWebpay");
      btn.disabled = true;
      const old = btn.textContent;
      btn.textContent = "Redirigiendo…";

      try{
        const data = await callFn("createTransaction", {
          paymentId: pid,
          checkoutId: cid,
          amount,
          returnUrl: `${location.origin}/.netlify/functions/commitTransaction?pid=${encodeURIComponent(pid)}&cid=${encodeURIComponent(cid)}`
        });

        const form = document.createElement("form");
        form.method = "POST";
        form.action = data.url;
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = "token_ws";
        input.value = data.token;
        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();
      }catch(e){
        btn.disabled = false;
        btn.textContent = old;
        alert(e.message || "No se pudo iniciar Webpay");
      }
    };
  }

  render();
})();
