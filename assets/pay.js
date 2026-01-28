
(function(){
  const KEY_TASKS = "cursapp_tasks_v1";
  const KEY_PAYMENTS = "cursapp_payments_v1";
  const KEY_PROFILES = "cursapp_profiles_v1";
  const KEY_ACTIVE_COURSE = "cursapp_active_course_v1";
  const KEY_CHECKOUTS = "cursapp_checkouts_v1";

  const load = (k, def)=>{ try{ return JSON.parse(localStorage.getItem(k) || JSON.stringify(def)); }catch{ return def; } };
  const save = (k, v)=> localStorage.setItem(k, JSON.stringify(v));
  const esc = (s)=> String(s??"").replace(/[&<>'"]/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[c]));
  const clp = (n)=> "$"+Number(n||0).toLocaleString("es-CL");
  function nowISO(){ return new Date().toISOString(); }

  function qs(){
    const u = new URL(location.href);
    return {
      pid: u.searchParams.get("pid") || "",
      cid: u.searchParams.get("cid") || ""
    };
  }

  function findProfile(){
    const profiles = load(KEY_PROFILES, []);
    const key = localStorage.getItem(KEY_ACTIVE_COURSE) || "";
    return profiles.find(p=>p.courseKey===key) || profiles[0] || null;
  }

  async function callFn(name, payload){
    const res = await fetch(`/.netlify/functions/${name}`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(payload||{})
    });
    const data = await res.json().catch(()=> ({}));
    if(!res.ok) throw new Error(data.error || "Error al iniciar pago");
    return data;
  }

  function markCheckout(cid, patch){
    const list = load(KEY_CHECKOUTS, []);
    const i = list.findIndex(x=>x.id===cid);
    if(i>=0){
      list[i] = Object.assign({}, list[i], patch, {updatedAt: nowISO()});
      save(KEY_CHECKOUTS, list);
    }
  }

  function render(){
    const {pid, cid} = qs();
    const el = document.getElementById("content");

    const pays = load(KEY_PAYMENTS, []);
    const tasks = load(KEY_TASKS, []);
    const p = pays.find(x=>x.id===pid);
    const t = p ? tasks.find(tt=>tt.id===p.fromTaskId) : null;
    const prof = findProfile();
    const who = prof?.apoderado?.name || "Apoderado";

    if(!p){
      el.innerHTML = `<div class="card"><div class="kTitle">Pago no encontrado</div><div class="muted" style="margin-top:6px;">Vuelve a Pagos e inténtalo nuevamente.</div></div>`;
      return;
    }

    const amount = Number(p.amountRemaining ?? p.amount ?? 0);

    el.innerHTML = `
      <div class="card">
        <div class="kTitle">Resumen</div>
        <div class="muted" style="margin-top:6px;">Revisa los datos antes de pagar.</div>

        <div class="kDivider"></div>

        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <div class="muted">Apoderado</div>
          <div style="font-weight:950;">${esc(who)}</div>
        </div>
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:8px;">
          <div class="muted">Campaña</div>
          <div style="font-weight:950;">${esc(t?.title || "—")}</div>
        </div>
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:8px;">
          <div class="muted">Vence</div>
          <div style="font-weight:950;">${esc(p.dueDate || "—")}</div>
        </div>

        <div class="kDivider"></div>

        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <div style="font-weight:950;">Total a pagar</div>
          <div style="font-weight:950;font-size:22px;">${clp(amount)}</div>
        </div>
      </div>

      <div class="card" style="margin-top:12px;">
        <div class="kTitle">Método de pago</div>
        <div class="muted" style="margin-top:6px;">Elige cómo quieres pagar.</div>

        <div class="kMethods" style="margin-top:12px;">
          <div class="method">
            <div class="meta">
              <div class="t">Webpay (real)</div>
              <div class="muted s">Tarjetas débito/crédito (requiere configuración).</div>
            </div>
            <div>
              <span class="badge">Recomendado</span>
              <div style="margin-top:8px;display:flex;justify-content:flex-end;">
                <button class="btnx primary" id="btnWebpay">Ir a Webpay</button>
              </div>
            </div>
          </div>

          <div class="method">
            <div class="meta">
              <div class="t">Simular pago (demo)</div>
              <div class="muted s">Marca como pagado sin pasarela.</div>
            </div>
            <div>
              <button class="btnx" id="btnSim">Simular</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById("btnSim").onclick = ()=>{
      const pays2 = load(KEY_PAYMENTS, []);
      const i = pays2.findIndex(x=>x.id===pid);
      if(i>=0){
        pays2[i].status="paid";
        pays2[i].paidAt=nowISO();
        pays2[i].paidWith="simulated";
        save(KEY_PAYMENTS, pays2);
      }
      markCheckout(cid, {status:"paid_simulated"});
      location.href = "/apoderado.html";
    };

    document.getElementById("btnWebpay").onclick = async ()=>{
      try{
        markCheckout(cid, {status:"starting_gateway"});
        const data = await callFn("createTransaction", {
          paymentId: pid,
          checkoutId: cid,
          amount,
          returnUrl: `${location.origin}/pay_return.html?cid=${encodeURIComponent(cid)}&pid=${encodeURIComponent(pid)}`
        });
        if(!data.redirectUrl) throw new Error("No se recibió URL de redirección");
        location.href = data.redirectUrl;
      }catch(e){
        markCheckout(cid, {status:"gateway_error", error: String(e.message||e)});
        alert(e.message || "No se pudo iniciar Webpay");
      }
    };
  }

  render();
})();
