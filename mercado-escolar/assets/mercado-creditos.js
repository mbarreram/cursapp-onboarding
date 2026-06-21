(function(){
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const now=()=>new Date().toISOString();
  function voucherNo(){return `CR-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Date.now()).slice(-6)}`;}
  function fmtDateTime(v){try{return new Date(v).toLocaleString('es-CL',{timeZone:'America/Santiago',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});}catch(e){return ''}}
  function daysLeft(v){const ms=Date.parse(v||'')-Date.now(); return Math.max(0,Math.ceil(ms/86400000));}
  const PACKAGES=[
    {name:'Básico',credits:10,price:990},
    {name:'Plus',credits:30,price:1990},
    {name:'Pro',credits:60,price:3990}
  ];
  function clp(n){return '$'+Number(n||0).toLocaleString('es-CL')}
  function readJson(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}}
  function session(){const s=readJson('cursapp_session_v1',{})||{};const p=readJson('cursapp_active_profile_v1',{})||{};return {userId:s.userId||s.usuario_id||p.usuario_id||p.userId||null,email:String(s.email||p.email||'').toLowerCase(),name:s.nombre||s.name||p.nombre||'Apoderado Cursapp'};}
  function toast(t){const el=$('#toast'); if(!el){alert(t);return;} el.textContent=t; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),4200)}
  function confirmCredit({title,body,ok='Confirmar',cancel='Cancelar'}={}){
    return new Promise(resolve=>{
      const modal=document.getElementById('modal');
      if(!modal){resolve(confirm(title||'Confirmar'));return;}
      modal.innerHTML=`<div class="v19ConfirmOverlay"><section class="v19Confirm"><h2>${esc(title||'Confirmar')}</h2><div class="v19ConfirmBody">${body||''}</div><div class="v19ConfirmActions"><button type="button" class="ghost" data-credit-no>${esc(cancel)}</button><button type="button" class="primaryBtn" data-credit-yes>${esc(ok)}</button></div></section></div>`;
      modal.querySelector('[data-credit-no]')?.addEventListener('click',()=>{modal.innerHTML='';resolve(false)},{once:true});
      modal.querySelector('[data-credit-yes]')?.addEventListener('click',()=>{modal.innerHTML='';resolve(true)},{once:true});
    });
  }
  async function waitSb(){for(let i=0;i<50;i++){if(window.cursappSupabase) return window.cursappSupabase;if(window.initCursappSupabase){try{const x=window.initCursappSupabase(); if(x) return x}catch(e){}} await new Promise(r=>setTimeout(r,100));}return null}
  let sb=null, me=null, wallet=null, balanceCol='saldo', historyPage=1; const HISTORY_PAGE_SIZE=8;
  async function insertFlex(table,row){let cleaned={...row}; for(let i=0;i<8;i++){const res=await sb.from(table).insert([cleaned]).select('*').maybeSingle(); if(!res.error) return res; const msg=String(res.error.message||''); const m=msg.match(/'([^']+)' column of '[^']+' in the schema cache/i)||msg.match(/column "([^"]+)"/i); if(m && cleaned[m[1]]!==undefined){delete cleaned[m[1]]; continue;} return res;} return sb.from(table).insert([cleaned]).select('*').maybeSingle();}
  async function safeInsert(table,row){try{return await insertFlex(table,row)}catch(e){return {error:e}}}
  function uniqById(rows){const seen=new Set();return (rows||[]).filter(r=>{const k=String(r.id||r.voucher||r.numero_voucher||JSON.stringify(r)); if(seen.has(k)) return false; seen.add(k); return true;});}
  function movementDate(m){return m.fecha||m.created_at||m.fecha_creacion||m.createdon||m.inserted_at||null;}
  function movementVoucher(m){return m.numero_voucher||m.voucher||m.codigo_voucher||`CR-${String(m.id||'').slice(0,8)}`;}
  function movementQty(m){return Number(m.cantidad??m.creditos??m.monto_creditos??m.monto??0);}
  function localKey(){return 'cursapp_mercado_creditos_movs_'+String(uid()||session().email||'anon').toLowerCase();}
  function saveLocalMovement(row){try{const k=localKey(); const arr=JSON.parse(localStorage.getItem(k)||'[]'); arr.unshift(row); localStorage.setItem(k,JSON.stringify(arr.slice(0,80)));}catch(e){}}
  function localMovements(){try{return JSON.parse(localStorage.getItem(localKey())||'[]')}catch(e){return []}}
  function ownerKeys(){
    me=session();
    return Array.from(new Set([
      uid(), me.email, wallet?.usuario_id, wallet?.email,
      me.userId && String(me.userId).toLowerCase(), me.email && String(me.email).toLowerCase()
    ].filter(Boolean).map(String)));
  }
  function newestRow(rows){
    return (rows||[]).slice().sort((a,b)=>Date.parse(b.updated_at||b.fecha||b.created_at||0)-Date.parse(a.updated_at||a.fecha||a.created_at||0))[0]||null;
  }
  async function updateFlex(table,idCol,id,row){let cleaned={...row}; for(let i=0;i<8;i++){const res=await sb.from(table).update(cleaned).eq(idCol,id).select('*').maybeSingle(); if(!res.error) return res; const msg=String(res.error.message||''); const m=msg.match(/'([^']+)' column of '[^']+' in the schema cache/i)||msg.match(/column "([^"]+)"/i); if(m && cleaned[m[1]]!==undefined){delete cleaned[m[1]]; continue;} return res;} return sb.from(table).update(cleaned).eq(idCol,id).select('*').maybeSingle();}
  function uid(){return me.userId||me.email}
  function detectBalanceCol(row){if(!row) return 'saldo'; return ['saldo','saldo_actual','creditos','creditos_disponibles'].find(k=>row[k]!==undefined)||'saldo'}
  async function loadWallet(){
    if(!sb) sb=await waitSb(); me=session(); if(!sb||!uid()) return null;
    const keys=ownerKeys(); let found=[];
    for(const key of keys){
      try{const r=await sb.from('creditos_usuario').select('*').eq('usuario_id',key).limit(10); if(!r.error && r.data?.length) found=found.concat(r.data);}catch(e){}
      try{const r=await sb.from('creditos_usuario').select('*').eq('email',key).limit(10); if(!r.error && r.data?.length) found=found.concat(r.data);}catch(e){}
    }
    found=uniqById(found);
    if(found.length){wallet=newestRow(found); balanceCol=detectBalanceCol(wallet); return wallet;}
    const ins=await insertFlex('creditos_usuario',{usuario_id:uid(),email:me.email,saldo:0,total_comprado:0,total_usado:0,created_at:now(),updated_at:now()});
    if(!ins.error){wallet=ins.data; balanceCol=detectBalanceCol(wallet); return wallet;} return null;
  }
  function balance(){return Number(wallet?.[balanceCol]||0)}
  async function recordMovement(tipo,cantidad,extra={}){
    if(!sb) sb=await waitSb(); me=session();
    const numero=extra.voucher||voucherNo();
    const base={
      usuario_id:uid(), email:me.email, tipo, tipo_operacion:tipo, operacion:tipo,
      cantidad, creditos:cantidad, monto:extra.monto||0,
      publicacion_id:extra.publicacion_id||null, publicacion_titulo:extra.publicacion_titulo||null,
      regla:extra.regla||null, regla_label:extra.regla_label||extra.destacado_tipo||null,
      destacado_tipo:extra.regla_label||extra.destacado_tipo||extra.regla||null,
      dias:extra.dias||null, vence_at:extra.vence_at||extra.fecha_expiracion||null,
      saldo_anterior:extra.saldo_anterior??null, saldo_posterior:extra.saldo_posterior??null,
      numero_voucher:numero, voucher:numero,
      concepto:extra.concepto||tipo,
      descripcion:extra.descripcion||'',
      created_at:now(), fecha:now()
    };
    saveLocalMovement({...base,__table:'local_cache'});
    const r1=await safeInsert('movimientos_creditos',base);
    await safeInsert('mercado_creditos_historial',base);
    await safeInsert('mercado_vouchers',{
      voucher:numero, usuario_id:uid(), publicacion_id:extra.publicacion_id||null,
      operacion:tipo, descripcion:base.descripcion||base.concepto,
      creditos:cantidad, monto:extra.monto||0,
      saldo_anterior:base.saldo_anterior, saldo_posterior:base.saldo_posterior,
      fecha_expiracion:base.vence_at, fecha:now(), created_at:now()
    });
    return r1;
  }
  async function refresh(){await loadWallet(); const b=$('#creditBalanceBadge'); if(b) b.textContent=balance()+' créditos'; renderPackages(); historyPage=1; renderHistory();}
  function renderPackages(){const box=$('#creditPackages'); if(!box) return; box.innerHTML=PACKAGES.map(p=>`<article class="creditPack"><b>${esc(p.name)}</b><span>${p.credits} créditos Mercado</span><strong>${clp(p.price)}</strong><button type="button" data-buy-credits="${p.credits}" data-price="${p.price}">Comprar créditos</button></article>`).join('');}
  async function buyCredits(credits,price){
    await loadWallet();
    const current=balance();
    const next=current+Number(credits||0);
    const ok=await confirmCredit({
      title:'Comprar créditos Mercado',
      body:`<div class="boostConfirmCard"><p>Comprarás</p><b>${credits} créditos Mercado</b><p class="muted">Monto: ${clp(price)}</p><div class="creditSummary"><span>Saldo actual</span><b>${current}</b></div><div class="creditSummary"><span>Compra</span><b>+${credits}</b></div><div class="creditSummary strong"><span>Saldo posterior</span><b>${next}</b></div></div>`,
      ok:'Confirmar compra'
    });
    if(!ok) return false;
    const voucher=voucherNo();
    let r=await updateFlex('creditos_usuario','usuario_id',uid(),{[balanceCol]:next,total_comprado:Number(wallet?.total_comprado||0)+Number(credits||0),updated_at:now()});
    if(r.error){toast('No se pudo actualizar saldo: '+r.error.message);return false;}
    wallet=r.data||{...wallet,[balanceCol]:next};
    await recordMovement('compra',Number(credits||0),{monto:Number(price||0),concepto:'compra_creditos',descripcion:`Compra ${credits} créditos Mercado`,saldo_anterior:current,saldo_posterior:next,voucher});
    await insertFlex('ordenes_creditos',{usuario_id:uid(),email:me.email,creditos:Number(credits||0),monto:Number(price||0),estado:'pagada',numero_voucher:voucher,created_at:now()});
    toast(`Compra registrada: +${credits} créditos · voucher ${voucher}`);
    refresh();
    return true;
  }
  async function spendCredits(cost,extra={}){
    await loadWallet();
    const c=Number(cost||0);
    if(balance()<c){toast('No tienes créditos suficientes para destacar. Compra créditos primero.'); return {ok:false,message:'No tienes créditos suficientes.'};}
    const before=Number(extra.saldo_anterior ?? balance());
    const next=before-c;
    const voucher=extra.voucher||voucherNo();
    const r=await updateFlex('creditos_usuario','usuario_id',uid(),{[balanceCol]:next,total_usado:Number(wallet?.total_usado||0)+c,updated_at:now()});
    if(r.error){toast('No se pudo descontar créditos: '+r.error.message); return {ok:false,message:r.error.message};}
    wallet=r.data||{...wallet,[balanceCol]:next};
    await recordMovement('uso',-Math.abs(c),{
      publicacion_id:extra.publicacion_id,publicacion_titulo:extra.publicacion_titulo,regla:extra.regla,regla_label:extra.regla_label,dias:extra.dias,vence_at:extra.vence_at,
      saldo_anterior:before,saldo_posterior:next,voucher,concepto:'destacado_mercado',descripcion:extra.descripcion||`Uso de ${c} crédito(s)`
    });
    refresh();
    return {ok:true,balance:next,voucher};
  }
  async function fetchMovements(limit){
    if(!sb) sb=await waitSb();
    await loadWallet();
    const keys=ownerKeys();
    const tables=['mercado_creditos_historial','movimientos_creditos','mercado_creditos_movimientos','creditos_movimientos','marketplace_creditos_historial'];
    let all=[];
    for(const t of tables){
      for(const key of keys){
        for(const col of ['usuario_id','email','user_id','apoderado_id']){
          try{
            let r=await sb.from(t).select('*').eq(col,key).order('fecha',{ascending:false}).limit(limit+80);
            if(r.error) r=await sb.from(t).select('*').eq(col,key).order('created_at',{ascending:false}).limit(limit+80);
            if(r.error) r=await sb.from(t).select('*').eq(col,key).limit(limit+80);
            if(!r.error && r.data?.length) all=all.concat(r.data.map(x=>({...x,__table:t})));
          }catch(e){}
        }
      }
    }
    all=all.concat(localMovements());
    return uniqById(all).sort((a,b)=>Date.parse(movementDate(b)||0)-Date.parse(movementDate(a)||0));
  }
  async function renderHistory(){
    const box=$('#creditHistory'); if(!box) return; if(!sb) sb=await waitSb(); me=session(); if(!uid()){box.innerHTML='<p class="muted">Ingresa para ver movimientos.</p>'; return;}
    const limit=historyPage*HISTORY_PAGE_SIZE;
    fetchMovements(limit+1).then(data=>{
      if(!data||!data.length){box.innerHTML='<p class="muted">Sin movimientos todavía.</p>'; window.__creditMovements=[]; return;}
      const hasMore=data.length>limit;
      const rows=data.slice(0,limit);
      box.innerHTML=rows.map((m,i)=>{
        const qty=movementQty(m);
        const isCompra = qty>0 || m.tipo==='compra' || m.tipo_operacion==='compra' || m.operacion==='compra' || m.concepto==='compra_creditos';
        const rawDesc = String(m.descripcion||'');
        const title = isCompra ? (rawDesc || `Compra ${Math.abs(qty)} créditos Mercado`) : (m.publicacion_titulo || (rawDesc.split('·')[1]||rawDesc||m.regla_label||m.destacado_tipo||'Publicación').trim());
        const label=m.regla_label||m.destacado_tipo||m.regla||'';
        const op = isCompra ? 'Compra créditos Mercado' : (label?`⭐ ${esc(label)}`:'⭐ Destacado Mercado Escolar');
        const meta = `${op}${m.dias?` · ${m.dias} días`:''}${(m.vence_at||m.fecha_expiracion)?` · vence ${fmtDateTime(m.vence_at||m.fecha_expiracion)} · quedan ${daysLeft(m.vence_at||m.fecha_expiracion)} día(s)`:''}`;
        return `<div class="creditMove v20CreditMove"><div><b>${esc(title)}</b><small>${fmtDateTime(movementDate(m))}</small><small>${meta}</small></div><span class="${qty>=0?'pos':'neg'}">${qty>0?'+':''}${qty} crédito(s)</span><button type="button" data-voucher-index="${i}">📄 Ver voucher</button></div>`;
      }).join('') + (hasMore?`<button type="button" class="ghost creditMore" data-credit-more>Ver más movimientos</button>`:'');
      window.__creditMovements=rows;
    });
  }
  function showVoucher(index){
    const m=(window.__creditMovements||[])[Number(index)]; if(!m) return;
    const qty=Number(m.cantidad||m.creditos||0);
    const voucher=movementVoucher(m);
    const modal=document.getElementById('modal');
    if(!modal) return;
    modal.innerHTML=`<div class="v19ConfirmOverlay"><section class="v19Confirm voucherModal"><h2>Voucher ${esc(voucher)}</h2><div class="voucherRows"><p><span>Fecha</span><b>${fmtDateTime(movementDate(m))}</b></p><p><span>Operación</span><b>${esc((Number(m.cantidad||m.creditos||0)>0||m.tipo==='compra')?'Compra créditos Mercado':(m.regla_label||m.concepto||m.tipo||'Movimiento'))}</b></p>${m.publicacion_titulo?`<p><span>Publicación</span><b>${esc(m.publicacion_titulo)}</b></p>`:''}${m.regla_label?`<p><span>Destacado</span><b>${esc(m.regla_label)}</b></p>`:''}${m.dias?`<p><span>Vigencia</span><b>${m.dias} días</b></p>`:''}${m.vence_at?`<p><span>Vence</span><b>${fmtDateTime(m.vence_at)}</b></p>`:''}<p><span>Créditos</span><b>${qty>0?'+':''}${qty}</b></p>${m.monto?`<p><span>Monto</span><b>${clp(m.monto)}</b></p>`:''}<p><span>Saldo anterior</span><b>${m.saldo_anterior??'—'}</b></p><p><span>Saldo posterior</span><b>${m.saldo_posterior??'—'}</b></p><p><span>Estado</span><b>Registrado</b></p></div><div class="v19ConfirmActions"><button type="button" class="ghost" onclick="document.getElementById('modal').innerHTML=''">Cerrar</button></div></section></div>`;
  }
  document.addEventListener('click',e=>{const more=e.target.closest('[data-credit-more]'); if(more){e.preventDefault();historyPage++;renderHistory();return;} const v=e.target.closest('[data-voucher-index]'); if(v){e.preventDefault();showVoucher(v.dataset.voucherIndex);return;} const b=e.target.closest('[data-buy-credits]'); if(!b) return; e.preventDefault(); buyCredits(Number(b.dataset.buyCredits||0),Number(b.dataset.price||0));});
  document.addEventListener('DOMContentLoaded',()=>{setTimeout(refresh,700);});
  window.CursappMarketCredits={refresh,buyCredits,spendCredits,getBalance:()=>balance(),loadWallet,renderHistory,fetchMovements};
})();
