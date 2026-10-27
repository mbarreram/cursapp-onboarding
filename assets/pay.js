(function(){
  "use strict";

  const SB_CONFIG = window.CURSAPP_SUPABASE || {};
  const SB_URL = SB_CONFIG.url;
  const SB_KEY = SB_CONFIG.publishableKey;

  const esc = (s)=> String(s??"").replace(/[&<>'"]/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[c]));
  const clp = (n)=> "$" + Number(n||0).toLocaleString("es-CL");
  const q = (v)=> encodeURIComponent(String(v == null ? "" : v));
  const isUuid = (v)=> /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||""));

  // Diagnóstico de pagos: solo referencias UUID; sin datos de tarjeta, token, monto ni contenido de formularios.
  async function auditPayment(type,pagoId){
    if(!isUuid(pagoId))return;
    try{
      const api=window.CURSAPP_SUPABASE;
      if(!api?.functions?.invoke)return;
      await Promise.race([
        api.functions.invoke("audit-ingest-v1",{body:{events:[{event_id:crypto.randomUUID(),type,target:"pay_webpay",pago_id:pagoId}]}}),
        new Promise(resolve=>setTimeout(resolve,1200))
      ]);
    }catch(_){}
  }

  function qs(){
    const u = new URL(location.href);
    const pid=u.searchParams.get("pid")||u.searchParams.get("pago")||"";
    const raw=u.searchParams.get("pagos")||"";
    const ids=[...new Set(raw.split(",").map(x=>x.trim()).filter(isUuid))].slice(0,20);
    return {pid,ids};
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

  function offlinePaymentNotice(el){
    el.innerHTML='<div class="card"><div class="kTitle">Pago no disponible sin Internet</div><div class="muted" style="margin-top:8px">Para proteger tu pago, vuelve a conectarte y consulta nuevamente el estado de la cuota antes de iniciar Webpay.</div><div class="actions" style="margin-top:14px"><button type="button" class="btnx" id="retryPaymentOnline">Reintentar con conexión</button></div></div>';
    const retry=document.getElementById('retryPaymentOnline');
    if(retry)retry.onclick=()=>{if(!navigator.onLine){offlinePaymentNotice(el);return}render()};
  }

  async function render(){
    const {pid} = qs();
    const el = document.getElementById("content");
    if(!el) return;
    if(!navigator.onLine){offlinePaymentNotice(el);return;}
    el.innerHTML = `<div class="card"><div class="kTitle">Cargando pago…</div><div class="muted" style="margin-top:6px;">Consultando Supabase.</div></div>`;

    try{
      if(qs().ids.length){
        const ids=qs().ids;
        if(ids.length!==String(new URL(location.href).searchParams.get("pagos")||"").split(",").length){throw new Error("Hay referencias de cuota inválidas o repetidas.");}
        const rows=await Promise.all(ids.map(loadPago));
        if(rows.some(x=>!x))throw new Error("No se pudieron consultar todas las cuotas.");
        if(new Set(rows.map(x=>x.curso_id)).size!==1||new Set(rows.map(x=>x.miembro_id)).size!==1)throw new Error("Solo se pueden agrupar cuotas de un mismo alumno y curso.");
        if(rows.some(x=>!["pendiente","pending"].includes(String(x.estado||"").toLowerCase())||Number(x.monto_pagado||0)>0))throw new Error("Una cuota cambió de estado. Actualiza la selección.");
        const fin=rows.map(financialBreakdown);
        const subtotal=fin.reduce((s,x)=>s+x.cuota,0), cargos=fin.reduce((s,x)=>s+x.tb+x.mx,0);
        const total=fin.reduce((s,x)=>s+x.total,0);
        el.innerHTML=`<div class="card"><div class="kTitle">Revisar cuotas seleccionadas</div><div class="muted" style="margin:8px 0 12px;">${rows.length} cuota(s) del mismo alumno · ${esc((rows[0].miembros_curso||{}).nombre_alumno||"")}</div>${rows.map((x,i)=>`<div style="display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-top:1px solid #eceaf3"><span>${esc(x.campanas?.titulo||"Campaña")} · ${esc(x.periodo||x.fecha_vencimiento||"")}</span><b>${clp(fin[i].cuota)}</b></div>`).join("")}<div style="border-top:1px solid #ddd;padding-top:12px;display:grid;gap:8px;"><div style="display:flex;justify-content:space-between"><span>Destinado al curso</span><b>${clp(subtotal)}</b></div><div style="display:flex;justify-content:space-between"><span>Cargos estimados</span><b>${clp(cargos)}</b></div><div style="display:flex;justify-content:space-between;font-size:20px"><strong>Total estimado</strong><strong>${clp(total)}</strong></div></div><p class="muted" style="margin-top:12px;">El monto definitivo siempre será validado por el servidor al iniciar Webpay.</p><p class="muted">La confirmación agrupada y la reversa total aún están en preparación. No se iniciará ninguna transacción hasta completar las pruebas.</p><button class="btnx" type="button" onclick="location.href='/apoderado.html#payments'">Volver a mis pagos</button></div>`;
        return;
      }
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
          if(!navigator.onLine){if(msg)msg.textContent="Sin conexión a Internet. No se puede iniciar Webpay.";return;}
          const old = btn.textContent;
          btn.disabled = true;
          btn.textContent = "Conectando con Transbank…";
          if(msg) msg.textContent = "Creando una transacción segura…";
          try{
            await auditPayment("payment_ui_start",pago.id);
            const tx = await startWebpay(pago.id);
            try{
              sessionStorage.setItem("micursox_webpay_tx", tx.transaction_id || "");
              sessionStorage.setItem("micursox_webpay_pid", pago.id);
            }catch(e){}
            await auditPayment("payment_ui_redirect",pago.id);
            submitToWebpay(tx.url, tx.token);
          }catch(e){
            await auditPayment("payment_ui_error",pago.id);
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
