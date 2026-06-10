(function(){
  "use strict";

  const SB_URL = "https://ngxistgymgdkoaiulfbq.supabase.co";
  const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5neGlzdGd5bWdka29haXVsZmJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2OTg1NDQsImV4cCI6MjA5NjI3NDU0NH0.1r-aLijYEWvUifKcLjlClnA8-oYw11lgThY0swg_xbg";

  const esc = (s)=> String(s??"").replace(/[&<>'"]/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[c]));
  const clp = (n)=> "$" + Number(n||0).toLocaleString("es-CL");
  const q = (v)=> encodeURIComponent(String(v == null ? "" : v));
  const isUuid = (v)=> /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||""));

  function qs(){
    const u = new URL(location.href);
    return { pid: u.searchParams.get("pid")||u.searchParams.get("pago")||"", cid: u.searchParams.get("cid")||"" };
  }

  async function sb(path, opts){
    const headers = Object.assign({
      apikey: SB_KEY,
      Authorization: "Bearer " + SB_KEY,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    }, (opts && opts.headers) || {});
    const res = await fetch(SB_URL + "/rest/v1/" + path, Object.assign({}, opts || {}, { headers }));
    const txt = await res.text();
    let data = null;
    try{ data = txt ? JSON.parse(txt) : null; }catch(e){ data = txt; }
    if(!res.ok){
      const msg = (data && (data.message || data.error || data.hint || data.details)) || txt || ("HTTP " + res.status);
      throw new Error(msg);
    }
    return Array.isArray(data) ? data : (data ? [data] : []);
  }

  async function loadPago(pid){
    if(!pid || !isUuid(pid)) return null;
    const rows = await sb("pagos?id=eq." + q(pid) + "&select=*%2Ccampanas(*)%2Cmiembros_curso(*)&limit=1");
    return rows[0] || null;
  }

  async function pagarDemo(pago){
    const monto = Number(pago.monto || pago.amount || 0) || 0;
    if(window.CURSAPP && typeof window.CURSAPP.markPaymentPaidSupabase === "function"){
      try{
        await window.CURSAPP.markPaymentPaidSupabase(pago.id, { amount:monto, method:"demo", paidAt:new Date().toISOString() });
        return;
      }catch(e){ console.warn("markPaymentPaidSupabase falló, usando REST directo", e); }
    }
    await sb("pagos?id=eq." + q(pago.id), {
      method:"PATCH",
      body: JSON.stringify({
        estado:"pagado",
        monto_pagado:monto,
        metodo_pago:"demo",
        paid_at:new Date().toISOString()
      })
    });
  }

  async function render(){
    const {pid} = qs();
    const el = document.getElementById("content");
    if(!el) return;
    el.innerHTML = `<div class="card"><div class="kTitle">Cargando pago…</div><div class="muted" style="margin-top:6px;">Consultando Supabase.</div></div>`;

    try{
      const pago = await loadPago(pid);
      if(!pago){
        el.innerHTML = `<div class="card"><div class="kTitle">Pago no encontrado</div><div class="muted" style="margin-top:6px;">Vuelve a Pagos e inténtalo nuevamente.</div></div>`;
        return;
      }
      const camp = pago.campanas || {};
      const miembro = pago.miembros_curso || {};
      const montoPendiente = Math.max(0, Number(pago.monto || 0) - Number(pago.monto_pagado || 0));
      const estado = String(pago.estado || "pendiente").toLowerCase();
      const yaPagado = estado === "pagado" || estado === "paid";

      el.innerHTML = `
        <div class="card">
          <div class="kTitle">Resumen del pago</div>
          <div class="muted" style="margin-top:6px;">Campaña: <b>${esc(camp.titulo || "Campaña")}</b></div>
          <div class="muted" style="margin-top:6px;">Alumno/a: <b>${esc(miembro.nombre_alumno || "—")}</b></div>
          <div class="muted" style="margin-top:6px;">Vence: <b>${esc(pago.fecha_vencimiento || camp.fecha_vencimiento || "—")}</b></div>
          <div style="margin-top:10px;font-weight:950;font-size:22px;">Total: ${clp(montoPendiente || pago.monto)}</div>
          ${yaPagado ? `<div style="margin-top:10px;"><span class="badge">Pagado</span></div>` : ``}
        </div>

        <div class="card" style="margin-top:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
            <div class="kTitle">Modo demo Supabase</div>
            <span class="badge">MVP</span>
          </div>
          <div class="muted" style="margin-top:6px;">Transbank queda desactivado temporalmente. Este botón actualiza la tabla <b>pagos</b> en Supabase.</div>
          <div class="method" style="margin-top:12px;">
            <div>
              <div class="t">Pago demo</div>
              <div class="muted s">Marca el pago como pagado para validar deudores, avisos e informes.</div>
            </div>
            <div style="display:flex;justify-content:flex-end;align-items:center;">
              ${yaPagado ? `<button class="btnx" onclick="location.href='/apoderado.html#payments_paid'">Volver</button>` : `<button class="btnx primary" id="btnDemoPay">Pagar ahora</button>`}
            </div>
          </div>
        </div>
      `;

      const btn = document.getElementById("btnDemoPay");
      if(btn){
        btn.onclick = async ()=>{
          const old = btn.textContent;
          btn.disabled = true;
          btn.textContent = "Registrando…";
          try{
            await pagarDemo(pago);
            try{ sessionStorage.setItem("justPaid", "1"); sessionStorage.setItem("justPaidPaymentId", pago.id); }catch(e){}
            location.href = `/pay_result.html?ok=1&pid=${encodeURIComponent(pago.id)}&amount=${encodeURIComponent(pago.monto||0)}&method=demo`;
          }catch(e){
            btn.disabled = false;
            btn.textContent = old;
            alert("No se pudo registrar el pago demo: " + (e.message || e));
          }
        };
      }
    }catch(e){
      el.innerHTML = `<div class="card"><div class="kTitle">Error</div><div class="muted" style="margin-top:6px;">${esc(e.message || e)}</div><div class="actions" style="margin-top:14px;justify-content:flex-end;"><button class="btnx" onclick="location.href='/apoderado.html#payments'">Volver a Pagos</button></div></div>`;
    }
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
  else render();
})();
