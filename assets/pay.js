(function(){
  "use strict";

  const SB_CONFIG = window.CURSAPP_SUPABASE || {};
  const SB_URL = SB_CONFIG.url;
  const SB_KEY = SB_CONFIG.publishableKey;

  const esc = (s)=> String(s??"").replace(/[&<>'"]/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[c]));
  const clp = (n)=> "$" + Number(n||0).toLocaleString("es-CL");
  const q = (v)=> encodeURIComponent(String(v == null ? "" : v));
  const isUuid = (v)=> /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||""));

  function qs(){
    const u = new URL(location.href);
    return { pid: u.searchParams.get("pid")||u.searchParams.get("pago")||"" };
  }

  async function sb(path, opts){
    if(window.CURSAPP_SUPABASE && typeof window.CURSAPP_SUPABASE.request === "function"){
      const data = await window.CURSAPP_SUPABASE.request(path, opts);
      return Array.isArray(data) ? data : (data ? [data] : []);
    }
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

  function financialBreakdown(pago){
    const camp = pago?.campanas || {};
    const cuota = Math.max(0, Number(pago?.monto_cuota ?? pago?.monto ?? 0) || 0);
    const tasaTb = Number(pago?.tasa_transbank ?? camp?.tasa_transbank ?? 1.79) || 1.79;
    const tasaMx = Number(pago?.tasa_micursox ?? camp?.tasa_micursox ?? 2.25) || 2.25;
    const tb = Math.round(Number(pago?.comision_transbank ?? (cuota*tasaTb/100)) || 0);
    const mx = Math.round(Number(pago?.comision_micursox ?? (cuota*tasaMx/100)) || 0);
    const total = Math.round(Number(pago?.monto_total_cobrado ?? (cuota+tb+mx)) || 0);
    return {cuota,tasaTb,tasaMx,tb,mx,total};
  }

  async function startWebpay(pagoId){
    if(!window.CURSAPP_SUPABASE || !window.CURSAPP_SUPABASE.functions){
      throw new Error("No se pudo iniciar la conexión de pago.");
    }
    const result = await window.CURSAPP_SUPABASE.functions.invoke("webpay-create", { body:{ pago_id:pagoId } });
    if(result.error) throw result.error;
    const data = result.data || {};
    if(!data.token || !data.url) throw new Error("Transbank no devolvió los datos de inicio.");
    return data;
  }

  function submitToWebpay(url, token){
    const form = document.createElement("form");
    form.method = "POST";
    form.action = url;
    form.style.display = "none";
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "token_ws";
    input.value = token;
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
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
      const miembro = Array.isArray(pago.miembros_curso) ? (pago.miembros_curso[0] || {}) : (pago.miembros_curso || {});
      const fin = financialBreakdown(pago);
      const estado = String(pago.estado || "pendiente").toLowerCase();
      const yaPagado = estado === "pagado" || estado === "paid";

      el.innerHTML = `
        <div class="card">
          <div class="kTitle">Resumen del pago</div>
          <div class="muted" style="margin-top:6px;">Campaña: <b>${esc(camp.titulo || "Campaña")}</b></div>
          <div class="muted" style="margin-top:6px;">Alumno/a: <b>${esc(miembro.nombre_alumno || "—")}</b></div>
          <div class="muted" style="margin-top:6px;">Vence: <b>${esc(pago.fecha_vencimiento || camp.fecha_vencimiento || "—")}</b></div>
          <div style="margin-top:14px;border-top:1px solid rgba(15,23,42,.08);padding-top:12px;display:grid;gap:8px;">
            <div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;"><span>Cuota destinada al curso</span><b>${clp(fin.cuota)}</b></div>
            <div style="display:flex;justify-content:space-between;gap:12px;font-size:12px;color:#64748b;"><span>Transbank · ${String(fin.tasaTb).replace('.',',')}%</span><b>${clp(fin.tb)}</b></div>
            <div style="display:flex;justify-content:space-between;gap:12px;font-size:12px;color:#64748b;"><span>MiCursoX · ${String(fin.tasaMx).replace('.',',')}%</span><b>${clp(fin.mx)}</b></div>
            <div style="display:flex;justify-content:space-between;gap:12px;border-top:1px solid rgba(15,23,42,.08);padding-top:10px;font-size:20px;font-weight:950;"><span>Total a pagar</span><b>${clp(fin.total)}</b></div>
          </div>
          <div class="muted" style="margin-top:10px;font-size:11px;line-height:1.45;">Los cargos se agregan al monto de la cuota. El valor destinado al curso permanece íntegro.</div>
          ${yaPagado ? `<div style="margin-top:10px;"><span class="badge">Pagado</span></div>` : ``}
        </div>

        <div class="card" style="margin-top:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
            <div class="kTitle">Pago seguro con Webpay Plus</div>
            <span class="badge">Integración</span>
          </div>
          <div class="muted" style="margin-top:6px;">Serás redirigido al ambiente de integración de Transbank. MiCursoX nunca recibe ni almacena los datos de tu tarjeta.</div>
          <div class="method" style="margin-top:12px;">
            <div>
              <div class="t">Webpay Plus</div>
              <div class="muted s">Transbank confirmará el resultado antes de registrar la cuota como pagada.</div>
            </div>
            <div style="display:flex;justify-content:flex-end;align-items:center;">
              ${yaPagado ? `<button class="btnx" onclick="location.href='/apoderado.html#payments_paid'">Volver</button>` : `<button class="btnx primary" id="btnWebpay">Pagar ${clp(fin.total)}</button>`}
            </div>
          </div>
          <div id="paymentMessage" class="muted" style="margin-top:10px;font-size:12px;"></div>
        </div>
      `;

      const btn = document.getElementById("btnWebpay");
      const msg = document.getElementById("paymentMessage");
      if(btn){
        btn.onclick = async ()=>{
          const old = btn.textContent;
          btn.disabled = true;
          btn.textContent = "Conectando con Transbank…";
          if(msg) msg.textContent = "Creando una transacción segura…";
          try{
            const tx = await startWebpay(pago.id);
            try{
              sessionStorage.setItem("micursox_webpay_tx", tx.transaction_id || "");
              sessionStorage.setItem("micursox_webpay_pid", pago.id);
            }catch(e){}
            submitToWebpay(tx.url, tx.token);
          }catch(e){
            btn.disabled = false;
            btn.textContent = old;
            if(msg) msg.textContent = (e && e.message) ? e.message : "No se pudo iniciar el pago.";
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
