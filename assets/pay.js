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
      el.innerHTML = `<div class="card"><div class="kTitle">Pago no encontrado</div></div>`;
      return;
    }

    const amount = Number(p.amountRemaining ?? p.amount ?? 0);

    el.innerHTML = `
      <div class="card">
        <div class="kTitle">Resumen</div>
        <div class="muted" style="margin-top:6px;">Campaña: <b>${esc(t?.title||"—")}</b></div>
        <div class="muted" style="margin-top:6px;">Vence: <b>${esc(p.dueDate||"—")}</b></div>
        <div style="margin-top:10px;font-weight:950;font-size:22px;">Total: ${clp(amount)}</div>

        <div class="actions" style="margin-top:14px;justify-content:flex-end;">
          <button class="btnx primary" id="btnWebpay">Ir a Webpay</button>
        </div>
      </div>
    `;

    document.getElementById("btnWebpay").onclick = async ()=>{
      try{
        const data = await callFn("createTransaction", {
          paymentId: pid,
          checkoutId: cid,
          amount,
          // Webpay hará POST a esta URL al finalizar
          returnUrl: `${location.origin}/.netlify/functions/commitTransaction?pid=${encodeURIComponent(pid)}&cid=${encodeURIComponent(cid)}`
        });

        // Webpay requiere POST a data.url con token_ws
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
        alert(e.message || "No se pudo iniciar Webpay");
      }
    };
  }

  render();
})();
