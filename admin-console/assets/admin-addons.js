
(function(){
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const app=()=>$("#adminApp"), modal=()=>$("#adminModal");
  const KAG="cursapp_ref_agents_v1", KRF="cursapp_ref_conversions_v1", KAL="cursapp_global_alerts_v1";
  const esc=s=>String(s??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const load=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}};
  const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const now=()=>new Date().toISOString(), clp=n=>"$"+Number(n||0).toLocaleString("es-CL");
  const setTitle=(t,s)=>{if($("#viewTitle"))$("#viewTitle").textContent=t;if($("#viewSub"))$("#viewSub").textContent=s||""};
  const kpi=(i,l,v,d)=>`<div class="kpi"><div class="kpiIcon">${i}</div><label>${l}</label><strong>${v}</strong><small>${d||"Actualizado ahora"}</small></div>`;
  const openModal=h=>{if(modal())modal().innerHTML=`<div class="modalBg"><div class="modalCard">${h}</div></div>`};
  const closeModal=()=>{if(modal())modal().innerHTML=""};
  const profiles=()=>load("cursapp_profiles_v1",[]);
  const agents=()=>load(KAG,[]), saveAgents=v=>save(KAG,v||[]);
  const refs=()=>load(KRF,[]), saveRefs=v=>save(KRF,v||[]);
  const code=v=>String(v||"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,14);
  const badge=(l,c="purple")=>`<span class="badge ${c}">${esc(l)}</span>`;
  function seedAgents(){
    // Cursapp v11-clean: sin agente demo automático.
    return;
  }
  const agentById=id=>agents().find(a=>String(a.id)===String(id))||null;
  const agentByCode=c=>agents().find(a=>code(a.code)===code(c))||null;
  function courses(){const m=new Map();profiles().forEach(p=>{const ck=p.courseKey||"";if(!ck)return;const c=p.course||{};if(!m.has(ck))m.set(ck,{courseKey:ck,schoolName:c.schoolName||c.school||c.colegio||"Colegio",regionName:c.regionName||c.region||"",courseLabel:[c.level||c.curso||c.course||"",c.letter||"",c.year||"",c.jornada||""].filter(Boolean).join(" ")||ck,estimatedStudents:Number(c.estimatedStudents||c.targetParents||0)})});return Array.from(m.values())}
  function hasRef(ck){return refs().some(r=>String(r.courseKey||"")===String(ck)&&code(r.referralCode)&&!["rechazado","liberado"].includes(String(r.status||"").toLowerCase()))}
  function unassigned(){return courses().filter(c=>!hasRef(c.courseKey)).map(c=>({id:"unassigned_"+c.courseKey.replace(/[^a-zA-Z0-9_-]/g,"_"),courseKey:c.courseKey,referralCode:"",agentId:"",agentName:"",status:"sin_agente",schoolName:c.schoolName,regionName:c.regionName,courseLabel:c.courseLabel,targetParents:c.estimatedStudents||30,createdAt:now()}))}
  function directiva(r){const set=new Set();profiles().filter(p=>String(p.courseKey)===String(r.courseKey)&&["presidente","tesorero"].includes(String(p.role||"").toLowerCase())).forEach(p=>set.add(String(p.userId||p.email||p.profileId||"").toLowerCase()));return set.size||Number(r.directiva||0)}
  function activated(r){const set=new Set();profiles().filter(p=>String(p.courseKey)===String(r.courseKey)&&String(p.role||"").toLowerCase()==="apoderado").forEach(p=>{const a=p.activation||{},st=String(a.status||p.activationStatus||p.status||"").toLowerCase();if(st==="paid"||st==="activo"||st==="active"||a.paidAt||p.activationPaidAt)set.add(String(p.userId||p.email||p.profileId||"").toLowerCase())});return set.size||Number(r.activatedParents||0)}
  const target=r=>Number(r.targetParents||r.expectedParents||0)||30;
  function prog(r){const t=target(r),d=directiva(r),a=activated(r),n=Number(r.commercialCount||0)||(d+a),pct=Math.min(100,Math.round(n/t*100));return{target:t,directiva:d,activated:a,count:n,pct}}
  function tier(r){const p=prog(r);if(p.pct>=100)return{label:"Premium 100%",cls:"green",total:p.activated*550};if(p.pct>=80)return{label:"Mejorada 80%",cls:"blue",total:p.activated*450};if(p.pct>=60)return{label:"Básica 60%",cls:"orange",total:p.activated*350};return{label:"Sin comisión",cls:"gray",total:0}}
  function rows(){const rs=refs().map(r=>{const a=agentById(r.agentId)||agentByCode(r.referralCode)||{};return Object.assign({},r,{agentId:r.agentId||a.id||"",agentName:r.agentName||a.name||"",referralCode:code(r.referralCode||a.code||"")})});unassigned().forEach(u=>{if(!rs.some(r=>String(r.courseKey)===String(u.courseKey)))rs.push(u)});return rs}
  const progressHtml=p=>`<div class="refProgress"><span style="width:${Math.max(0,Math.min(100,Number(p||0)))}%"></span></div><small>${p||0}% avance</small>`;
  function agentStats(a){const r=rows().filter(x=>String(x.agentId)===String(a.id)||code(x.referralCode)===code(a.code));return{rows:r,cursos:r.length,colegios:new Set(r.map(x=>x.schoolName).filter(Boolean)).size,avg:r.length?Math.round(r.reduce((s,x)=>s+prog(x).pct,0)/r.length):0,commission:r.reduce((s,x)=>s+tier(x).total,0)}}
  function renderAgentes(){seedAgents();setTitle("Agentes / Referidos","Crea agentes, administra códigos y asigna cursos");const ag=agents(),rr=rows(),un=rr.filter(r=>r.status==="sin_agente"),linked=rr.filter(r=>r.status!=="sin_agente"),commission=linked.reduce((s,r)=>s+tier(r).total,0);app().innerHTML=`<div class="kpis">${kpi("🏆","Agentes",ag.length,"captadores")}${kpi("🎓","Cursos asociados",linked.length,"con código")}${kpi("🧩","Sin agente",un.length,"por asignar")}${kpi("💰","Comisión estimada",clp(commission),"$350/$450/$550")}</div><section class="refRulesCard"><div class="refRulesHead"><div class="refRulesIcon">ℹ️</div><div><h2>Reglas de agentes</h2><p>La asignación es por curso. Varios agentes pueden trabajar el mismo colegio, pero un curso solo puede quedar asociado a un código.</p></div></div><div class="refTierTable"><div class="refTierCell refTierLabel">Nivel</div><div class="refTierCell"><b>Básica</b><span>60%</span></div><div class="refTierCell"><b>Mejorada</b><span>80%</span></div><div class="refTierCell"><b>Premium</b><span>100%</span></div><div class="refTierCell refTierLabel">Pago por apoderado activado</div><div class="refTierCell refMoney">$350</div><div class="refTierCell refMoney">$450</div><div class="refTierCell refMoney">$550</div></div><button class="adminBtn refCreateBtn" onclick="Admin.openAgentModal()">+ Crear agente</button></section><div class="tablesGrid" style="margin-top:18px"><section class="panel"><div class="panelHead"><h2>Agentes creados</h2><button onclick="Admin.openAgentModal()">Crear agente</button></div><div class="tableWrap"><table><thead><tr><th>Agente</th><th>Código</th><th>Colegios</th><th>Cursos</th><th>Avance</th><th>Comisión</th><th>Acción</th></tr></thead><tbody>${ag.map(a=>{const s=agentStats(a);return`<tr><td><b>${esc(a.name)}</b><br><small>${esc(a.email||"")}</small></td><td>${badge(a.code||"—")}</td><td>${s.colegios}</td><td>${s.cursos}</td><td>${progressHtml(s.avg)}</td><td><b>${clp(s.commission)}</b></td><td><button class="adminBtn ghost" onclick="Admin.openAgentDetail('${esc(a.id)}')">Ver</button></td></tr>`}).join("")||`<tr><td colspan="7">Sin agentes.</td></tr>`}</tbody></table></div></section><section class="panel"><div class="panelHead"><h2>Cursos sin agente</h2><span class="badge orange">${un.length}</span></div><div class="tableWrap"><table><thead><tr><th>Colegio</th><th>Curso</th><th>Meta</th><th>Acción</th></tr></thead><tbody>${un.map(r=>`<tr><td><b>${esc(r.schoolName||"Colegio")}</b><br><small>${esc(r.regionName||"")}</small></td><td>${esc(r.courseLabel||r.courseKey||"—")}</td><td>${target(r)}</td><td><button class="adminBtn ghost" onclick="Admin.openAssignReferral('${esc(r.courseKey)}')">Asignar</button></td></tr>`).join("")||`<tr><td colspan="4">No hay cursos sin agente.</td></tr>`}</tbody></table></div></section></div><section class="panel" style="margin-top:18px"><div class="panelHead"><h2>Todos los cursos referidos</h2></div><div class="tableWrap"><table><thead><tr><th>Código</th><th>Agente</th><th>Colegio</th><th>Curso</th><th>Base</th><th>Avance</th><th>Tramo</th><th>Estado</th><th>Acción</th></tr></thead><tbody>${rr.map(r=>{const p=prog(r),t=tier(r);return`<tr><td>${r.referralCode?badge(r.referralCode):badge("Sin código","orange")}</td><td>${esc(r.agentName||(agentByCode(r.referralCode)||{}).name||"Sin agente")}</td><td><b>${esc(r.schoolName||"Colegio")}</b></td><td>${esc(r.courseLabel||r.courseKey||"—")}</td><td><b>${p.count}/${p.target}</b><br><small>Dir. ${p.directiva} · Apod. ${p.activated}</small></td><td>${progressHtml(p.pct)}</td><td>${badge(t.label,t.cls)}<br><small>${clp(t.total)}</small></td><td>${badge(r.status||"asignado",r.status==="sin_agente"?"orange":"blue")}</td><td><button class="adminBtn ghost" onclick="Admin.openReferralGoal('${esc(r.id)}')">Meta</button> ${r.status==="sin_agente"?`<button class="adminBtn ghost" onclick="Admin.openAssignReferral('${esc(r.courseKey)}')">Asignar</button>`:""}</td></tr>`}).join("")}</tbody></table></div></section>`}
  function renderAlertas(){setTitle("Alertas globales","Gestiona alertas visibles en los roles");const arr=load(KAL,[]);app().innerHTML=`<div class="kpis">${kpi("🚨","Activas",arr.filter(a=>a.status!=="cerrada").length,"visibles")}${kpi("🌐","Total",arr.length,"creadas")}</div><section class="panel globalAlertForm"><div class="panelHead"><h2>Crear alerta</h2></div><div class="gaFormGrid"><div class="gaField"><label>Tipo</label><select id="gaType"><option>Transbank</option><option>Cloud / Hosting</option><option>Mantenimiento</option><option>Operacional</option><option>General</option></select></div><div class="gaField"><label>Severidad</label><select id="gaSeverity"><option value="informativa">Informativa</option><option value="advertencia">Advertencia</option><option value="critica">Crítica</option></select></div><div class="gaField gaFull"><label>Título</label><input id="gaTitle"></div><div class="gaField gaFull"><label>Mensaje</label><textarea id="gaMessage" rows="3"></textarea></div></div><div class="gaFormActions"><button class="adminBtn ghost" onclick="Admin.clearGlobalAlertForm()">Limpiar</button><button class="adminBtn" onclick="Admin.saveGlobalAlert()">Guardar alerta</button></div></section><section class="panel" style="margin-top:18px"><div class="panelHead"><h2>Alertas</h2></div><div class="tableWrap"><table><thead><tr><th>Título</th><th>Tipo</th><th>Estado</th><th>Acción</th></tr></thead><tbody>${arr.map(a=>`<tr><td><b>${esc(a.title)}</b><br><small>${esc(a.message||"")}</small></td><td>${esc(a.type)}</td><td>${badge(a.status||"activa",a.status==="cerrada"?"gray":"green")}</td><td><button class="adminBtn ghost" onclick="Admin.closeGlobalAlert('${esc(a.id)}')">Cerrar</button></td></tr>`).join("")||`<tr><td colspan="4">Sin alertas.</td></tr>`}</tbody></table></div></section>`}
  function openAgentModal(id){const a=id?agentById(id):{};openModal(`<h2>${id?"Editar agente":"Crear agente"}</h2><div class="formGrid"><div><label>Nombre</label><input id="agName" value="${esc(a.name||"")}"></div><div><label>Email</label><input id="agEmail" value="${esc(a.email||"")}"></div><div><label>Teléfono</label><input id="agPhone" value="${esc(a.phone||"")}"></div><div><label>Código</label><input id="agCode" value="${esc(a.code||"")}"></div><div><label>Estado</label><select id="agStatus"><option value="active">Activo</option><option value="inactive">Inactivo</option></select></div><div><label>Clave demo</label><input disabled value="123456"></div></div><div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px"><button class="adminBtn ghost" onclick="Admin.closeModal()">Cancelar</button><button class="adminBtn" onclick="Admin.saveAgent('${esc(id||"")}')">Guardar</button></div>`);if($("#agStatus"))$("#agStatus").value=a.status||"active"}
  function openAgentDetail(id){const a=agentById(id),s=a?agentStats(a):null;if(!a)return;openModal(`<h2>${esc(a.name)}</h2><p class="muted">${esc(a.email||"")} · ${esc(a.code||"")}</p><div class="ticketMetaGrid"><div><label>Cursos</label><b>${s.cursos}</b><span>asociados</span></div><div><label>Colegios</label><b>${s.colegios}</b><span>distintos</span></div><div><label>Avance</label><b>${s.avg}%</b><span>promedio</span></div><div><label>Comisión</label><b>${clp(s.commission)}</b><span>estimada</span></div></div><div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px"><button class="adminBtn ghost" onclick="Admin.openAgentModal('${esc(id)}')">Editar</button><button class="adminBtn" onclick="Admin.closeModal()">Cerrar</button></div>`)}
  function openAssignReferral(ck){if(hasRef(ck)){alert("Este curso ya tiene agente/código asociado.");return}const r=rows().find(x=>String(x.courseKey)===String(ck))||{courseKey:ck},ag=agents().filter(a=>a.status!=="inactive");openModal(`<h2>Asignar agente al curso</h2><p class="muted">${esc(r.schoolName||"Curso")} · ${esc(r.courseLabel||ck)}</p><div class="formGrid"><div><label>Agente</label><select id="assignAgentId"><option value="">Seleccionar agente</option>${ag.map(a=>`<option value="${esc(a.id)}">${esc(a.name)} · ${esc(a.code)}</option>`).join("")}</select></div><div><label>Estado</label><select id="assignStatus"><option value="asignado">Asignado</option><option value="reservado">Reservado 48h</option></select></div></div><div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px"><button class="adminBtn ghost" onclick="Admin.closeModal()">Cancelar</button><button class="adminBtn" onclick="Admin.saveAssignReferral('${esc(ck)}')">Asignar</button></div>`)}
  function openReferralGoal(id){const r=rows().find(x=>String(x.id)===String(id));if(!r)return;const p=prog(r);openModal(`<h2>Meta de inscripción</h2><p>${esc(r.schoolName||"")} · ${esc(r.courseLabel||r.courseKey||"")}</p><div class="formGrid"><div><label>Meta total</label><input id="refTargetParents" type="number" value="${p.target}"></div><div><label>Estado</label><select id="refStatusGoal"><option value="asignado">Asignado</option><option value="validado">Validado</option><option value="pagado">Pagado</option><option value="rechazado">Rechazado</option></select></div></div><div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px"><button class="adminBtn ghost" onclick="Admin.closeModal()">Cancelar</button><button class="adminBtn" onclick="Admin.saveReferralGoal('${esc(id)}')">Guardar</button></div>`);if($("#refStatusGoal"))$("#refStatusGoal").value=r.status||"asignado"}

  // ===== Monetización / Banners / Alianzas =====
  const KMN = "cursapp_monetizacion_v1";
  const KME = "cursapp_monetization_events_v1";

  function monetData(){
    const d = load(KMN, null);
    if(d && typeof d === "object") return d;
    return {banners:[], alliances:[], seguros:[], config:{maxBannersPerScreen:1, hideWhenOperationalAlert:true, allowPresidentHide:true}};
  }
  function saveMonetData(d){ save(KMN, d || {banners:[], alliances:[], seguros:[], config:{}}); }

  function seedMonetizacion(){
    const d = monetData();
    if(d.banners.length || d.alliances.length || d.seguros.length) return;
    d.banners = [
      {id:"bn_libros_1", title:"10% en útiles y libros escolares", partner:"Librería Escolar", category:"Librería", placement:"home_apoderado", cta:"Ver descuento", url:"#", region:"Todas", comuna:"Todas", startAt:now(), endAt:"", priority:1, priceModel:"Fijo", amount:120000, status:"activo", imageEmoji:"📚", createdAt:now()},
      {id:"bn_uniformes_1", title:"Uniformes escolares con despacho", partner:"Uniformes Chile", category:"Uniformes", placement:"home_apoderado", cta:"Cotizar", url:"#", region:"RM", comuna:"Todas", startAt:now(), endAt:"", priority:2, priceModel:"Lead", amount:1500, status:"activo", imageEmoji:"👕", createdAt:now()},
      {id:"bn_seguro_1", title:"Seguro escolar accidentes", partner:"Aseguradora Demo", category:"Seguros", placement:"centro_beneficios", cta:"Solicitar", url:"#", region:"Todas", comuna:"Todas", startAt:now(), endAt:"", priority:3, priceModel:"Lead", amount:3500, status:"borrador", imageEmoji:"🛡️", createdAt:now()}
    ];
    d.alliances = [
      {id:"al_lib_1", partner:"Librería Escolar", category:"Libros", benefit:"10% descuento en textos escolares", mechanics:"Código Cursapp", coupon:"CURSAPP10", status:"activo", region:"Todas", createdAt:now()},
      {id:"al_uni_1", partner:"Uniformes Chile", category:"Uniformes", benefit:"Despacho gratis sobre $30.000", mechanics:"Cupón", coupon:"CURSAPPUNIFORME", status:"activo", region:"RM", createdAt:now()}
    ];
    d.seguros = [
      {id:"sg_acc_1", partner:"Aseguradora Demo", product:"Seguro accidentes escolares", commission:3500, flow:"Lead derivado", status:"activo", description:"Cobertura básica para accidentes del alumno.", createdAt:now()},
      {id:"sg_cuotas_1", partner:"Aseguradora Demo", product:"Protección cuotas curso", commission:4500, flow:"Solicitud", status:"borrador", description:"Protección referencial ante contingencias del apoderado.", createdAt:now()}
    ];
    saveMonetData(d);
  }


  function monetEvents(){ return load(KME, []); }
  function monetMetrics(bannerId){
    const ev = monetEvents().filter(e=>!bannerId || String(e.bannerId)===String(bannerId));
    const impressions = ev.filter(e=>e.type==="impression").length;
    const clicks = ev.filter(e=>e.type==="click").length;
    const ctr = impressions ? ((clicks / impressions) * 100).toFixed(1) + "%" : "0%";
    return {impressions, clicks, ctr};
  }

  function monetStatusBadge(st){
    const s = String(st||"borrador").toLowerCase();
    if(s === "activo") return badge("Activo","green");
    if(s === "pausado") return badge("Pausado","orange");
    if(s === "cerrado") return badge("Cerrado","gray");
    return badge("Borrador","purple");
  }

  function bannerPreview(b){
    return `<article class="monBannerPreview">
      <div class="monBannerIcon">${esc(b.imageEmoji||"🏷️")}</div>
      <div>
        <small>${esc(b.partner||"Partner")}</small>
        <b>${esc(b.title||"Promoción")}</b>
        <span>${esc(b.category||"General")} · ${esc(b.cta||"Ver más")}</span>
      </div>
    </article>`;
  }

  function renderMonetizacion(){
    seedMonetizacion();
    setTitle("Monetización", "Banners, alianzas escolares y seguros");
    const d = monetData();
    const activeBanners = d.banners.filter(b=>String(b.status||"").toLowerCase()==="activo");
    const activeAlliances = d.alliances.filter(a=>String(a.status||"").toLowerCase()==="activo");
    const activeSeguros = d.seguros.filter(s=>String(s.status||"").toLowerCase()==="activo");
    const revenue = d.banners.reduce((s,b)=>s+Number(b.amount||0),0) + d.seguros.reduce((s,x)=>s+Number(x.commission||0),0);

    app().innerHTML = `
      <div class="kpis">
        ${kpi("📣","Banners activos",activeBanners.length,`máximo ${d.config.maxBannersPerScreen || 1} por pantalla`)}
        ${kpi("👆","Clicks banners",monetMetrics().clicks,"eventos registrados")}
        ${kpi("🤝","Alianzas activas",activeAlliances.length,"beneficios escolares")}
        ${kpi("🛡️","Seguros activos",activeSeguros.length,"productos derivados")}
        ${kpi("💰","Potencial ingreso",clp(revenue),"referencial")}
      </div>

      <section class="monHero">
        <div>
          <span>Centro comercial Cursapp</span>
          <h2>Publicidad escolar sin romper la confianza</h2>
          <p>Banners controlados por ubicación, alianzas para libros/uniformes y venta derivada de seguros escolares.</p>
        </div>
        <button class="adminBtn" onclick="Admin.openBannerModal()">+ Crear banner</button>
      </section>

      <div class="monTabs">
        <button class="monTab active" data-mon-tab="banners" onclick="Admin.switchMonetTab('banners')">📣 Banners</button>
        <button class="monTab" data-mon-tab="alianzas" onclick="Admin.switchMonetTab('alianzas')">🤝 Alianzas</button>
        <button class="monTab" data-mon-tab="seguros" onclick="Admin.switchMonetTab('seguros')">🛡️ Seguros</button>
        <button class="monTab" data-mon-tab="reglas" onclick="Admin.switchMonetTab('reglas')">⚙️ Reglas UX</button>
      </div>

      <section id="monetTabContent"></section>
    `;
    renderMonetTab("banners");
  }

  function renderMonetTab(tab){
    const d = monetData();
    const box = $("#monetTabContent");
    if(!box) return;
    $$(".monTab").forEach(b=>b.classList.toggle("active", b.dataset.monTab===tab));

    if(tab === "banners"){
      box.innerHTML = `
        <div class="tablesGrid">
          <section class="panel">
            <div class="panelHead"><h2>Banners comerciales</h2><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="adminBtn ghost" onclick="Admin.clearMonetMetrics()">Limpiar métricas</button><button onclick="Admin.openBannerModal()">Crear banner</button></div></div>
            <div class="tableWrap"><table>
              <thead><tr><th>Banner</th><th>Partner</th><th>Ubicación</th><th>Segmento</th><th>Modelo</th><th>Métricas</th><th>Estado</th><th>Acción</th></tr></thead>
              <tbody>${d.banners.map(b=>`<tr>
                <td>${bannerPreview(b)}</td>
                <td><b>${esc(b.partner||"")}</b><br><small>${esc(b.category||"")}</small></td>
                <td>${esc(b.placement||"")}</td>
                <td>${esc(b.region||"Todas")} · ${esc(b.comuna||"Todas")}</td>
                <td>${esc(b.priceModel||"Fijo")}<br><small>${clp(b.amount||0)}</small></td>
                <td>${(()=>{const m=monetMetrics(b.id);return `<b>${m.clicks}</b> clicks<br><small>${m.impressions} impresiones · CTR ${m.ctr}</small>`})()}</td>
                <td>${monetStatusBadge(b.status)}</td>
                <td><button class="adminBtn ghost" onclick="Admin.openBannerModal('${esc(b.id)}')">Editar</button></td>
              </tr>`).join("") || `<tr><td colspan="7">Sin banners.</td></tr>`}</tbody>
            </table></div>
          </section>

          <section class="panel">
            <div class="panelHead"><h2>Preview en App</h2></div>
            <div class="monPhone">
              <div class="monPhoneTop">Cursapp · Apoderado</div>
              <div class="monPhoneCard"><b>Próxima cuota</b><span>$12.000 · vence el viernes</span></div>
              ${(d.banners.filter(b=>b.status==="activo").slice(0,1).map(b=>bannerPreview(b)).join("")) || `<div class="emptyState">Sin banner activo.</div>`}
              <div class="monPhoneCard soft"><b>Mis pagos</b><span>Ver historial y pendientes</span></div>
            </div>
          </section>
        </div>
      `;
      return;
    }

    if(tab === "alianzas"){
      box.innerHTML = `
        <section class="panel">
          <div class="panelHead"><h2>Alianzas escolares</h2><button onclick="Admin.openAllianceModal()">Crear alianza</button></div>
          <div class="monCategoryGrid">
            ${d.alliances.map(a=>`<article class="monCategoryCard">
              <div class="monCatIcon">${a.category==="Uniformes"?"👕":"📚"}</div>
              <div><h3>${esc(a.partner)}</h3><p>${esc(a.benefit)}</p><span>${esc(a.category)} · ${esc(a.mechanics)} · ${esc(a.coupon)}</span></div>
              ${monetStatusBadge(a.status)}
            </article>`).join("") || `<div class="emptyState">Sin alianzas.</div>`}
          </div>
        </section>
      `;
      return;
    }

    if(tab === "seguros"){
      box.innerHTML = `
        <section class="panel">
          <div class="panelHead"><h2>Seguros escolares</h2><button onclick="Admin.openSeguroModal()">Crear seguro</button></div>
          <div class="tableWrap"><table>
            <thead><tr><th>Producto</th><th>Aseguradora</th><th>Flujo</th><th>Comisión</th><th>Estado</th><th>Descripción</th></tr></thead>
            <tbody>${d.seguros.map(s=>`<tr>
              <td><b>${esc(s.product)}</b></td><td>${esc(s.partner)}</td><td>${esc(s.flow)}</td><td><b>${clp(s.commission)}</b></td><td>${monetStatusBadge(s.status)}</td><td>${esc(s.description||"")}</td>
            </tr>`).join("") || `<tr><td colspan="6">Sin seguros.</td></tr>`}</tbody>
          </table></div>
        </section>
      `;
      return;
    }

    if(tab === "reglas"){
      box.innerHTML = `
        <section class="panel">
          <div class="panelHead"><h2>Reglas UX y confianza</h2></div>
          <div class="monRulesGrid">
            <label><span>Máximo banners por pantalla</span><input id="monMaxBanner" type="number" min="1" max="3" value="${d.config.maxBannersPerScreen || 1}"></label>
            <label><span>Ocultar si hay alerta operativa</span><select id="monHideAlert"><option value="true" ${d.config.hideWhenOperationalAlert!==false?"selected":""}>Sí</option><option value="false">No</option></select></label>
            <label><span>Presidente puede ocultar publicidad</span><select id="monAllowHide"><option value="true" ${d.config.allowPresidentHide!==false?"selected":""}>Sí</option><option value="false">No</option></select></label>
          </div>
          <div class="monTrust">
            <b>Reglas recomendadas</b>
            <span>Máximo 1 banner visible, nunca entre pasos de pago, no tapar cuotas, no mostrar publicidad si existe alerta crítica.</span>
          </div>
          <button class="adminBtn refCreateBtn" onclick="Admin.saveMonetRules()">Guardar reglas</button>
        </section>
      `;
    }
  }

  function openBannerModal(id){
    const d = monetData();
    const b = id ? d.banners.find(x=>String(x.id)===String(id)) : {};
    openModal(`<h2>${id ? "Editar banner" : "Crear banner"}</h2>
      <div class="formGrid">
        <div><label>Título</label><input id="bnTitle" value="${esc(b.title||"")}"></div>
        <div><label>Partner</label><input id="bnPartner" value="${esc(b.partner||"")}"></div>
        <div><label>Categoría</label><select id="bnCategory"><option>Librería</option><option>Uniformes</option><option>Retail</option><option>Seguros</option><option>Gira de estudio</option><option>Graduación</option></select></div>
        <div><label>Ícono</label><input id="bnEmoji" value="${esc(b.imageEmoji||"📚")}"></div>
        <div><label>Ubicación</label><select id="bnPlacement"><option value="todos_perfiles">Todos los perfiles</option><option value="home_apoderado">Home apoderado</option><option value="inicio_presidente">Inicio presidente</option><option value="inicio_tesorero">Inicio tesorero</option><option value="centro_beneficios">Centro beneficios</option><option value="reportes_pdf">Reportes PDF</option></select></div>
        <div><label>CTA</label><input id="bnCta" value="${esc(b.cta||"Ver descuento")}"></div>
        <div><label>Región</label><input id="bnRegion" value="${esc(b.region||"Todas")}"></div>
        <div><label>Comuna</label><input id="bnComuna" value="${esc(b.comuna||"Todas")}"></div>
        <div><label>Modelo</label><select id="bnModel"><option>Fijo</option><option>CPC</option><option>CPM</option><option>Lead</option></select></div>
        <div><label>Monto</label><input id="bnAmount" type="number" value="${Number(b.amount||0)}"></div>
        <div><label>Prioridad</label><input id="bnPriority" type="number" value="${Number(b.priority||1)}"></div>
        <div><label>Estado</label><select id="bnStatus"><option value="activo">Activo</option><option value="borrador">Borrador</option><option value="pausado">Pausado</option><option value="cerrado">Cerrado</option></select></div>
        <div style="grid-column:1/-1"><label>URL</label><input id="bnUrl" value="${esc(b.url||"#")}"></div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
        <button class="adminBtn ghost" onclick="Admin.closeModal()">Cancelar</button>
        <button class="adminBtn" onclick="Admin.saveBanner('${esc(id||"")}')">Guardar banner</button>
      </div>`);
    if($("#bnCategory")) $("#bnCategory").value = b.category || "Librería";
    if($("#bnPlacement")) $("#bnPlacement").value = b.placement || "home_apoderado";
    if($("#bnModel")) $("#bnModel").value = b.priceModel || "Fijo";
    if($("#bnStatus")) $("#bnStatus").value = b.status || "activo";
  }

  function openAllianceModal(){
    openModal(`<h2>Crear alianza escolar</h2>
      <div class="formGrid">
        <div><label>Partner</label><input id="alPartner" placeholder="Librería / Uniformes / Retail"></div>
        <div><label>Categoría</label><select id="alCategory"><option>Libros</option><option>Uniformes</option><option>Transporte</option><option>Preuniversitario</option><option>Gira estudio</option></select></div>
        <div style="grid-column:1/-1"><label>Beneficio</label><input id="alBenefit" placeholder="10% descuento en textos escolares"></div>
        <div><label>Mecánica</label><input id="alMechanics" placeholder="Cupón / QR / Código"></div>
        <div><label>Cupón</label><input id="alCoupon" placeholder="CURSAPP10"></div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
        <button class="adminBtn ghost" onclick="Admin.closeModal()">Cancelar</button>
        <button class="adminBtn" onclick="Admin.saveAlliance()">Guardar alianza</button>
      </div>`);
  }

  function openSeguroModal(){
    openModal(`<h2>Crear seguro escolar</h2>
      <div class="formGrid">
        <div><label>Aseguradora</label><input id="sgPartner" placeholder="Aseguradora"></div>
        <div><label>Producto</label><input id="sgProduct" placeholder="Seguro accidentes escolares"></div>
        <div><label>Flujo</label><select id="sgFlow"><option>Lead derivado</option><option>Cotización</option><option>Solicitud</option></select></div>
        <div><label>Comisión</label><input id="sgCommission" type="number" value="3500"></div>
        <div style="grid-column:1/-1"><label>Descripción</label><input id="sgDescription" placeholder="Cobertura referencial"></div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
        <button class="adminBtn ghost" onclick="Admin.closeModal()">Cancelar</button>
        <button class="adminBtn" onclick="Admin.saveSeguro()">Guardar seguro</button>
      </div>`);
  }

  function install(){if(!window.Admin||window.Admin.__addonsInstalled)return false;const old=window.Admin.go.bind(window.Admin);window.Admin.go=function(tab){$$(".sideItem").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));document.body.classList.remove("sideOpen");if(tab==="agentes"){renderAgentes();return}if(tab==="monetizacion"){renderMonetizacion();return}if(tab==="alertas"){renderAlertas();return}old(tab)};Object.assign(window.Admin,{__addonsInstalled:true,
    switchMonetTab:renderMonetTab,
    openBannerModal,
    openAllianceModal,
    openSeguroModal,
    saveBanner(id){
      const d = monetData();
      const obj = {
        id:id || "bn_"+Date.now().toString(16),
        title:($("#bnTitle")?.value||"").trim(),
        partner:($("#bnPartner")?.value||"").trim(),
        category:$("#bnCategory")?.value||"Retail",
        imageEmoji:$("#bnEmoji")?.value||"🏷️",
        placement:$("#bnPlacement")?.value||"home_apoderado",
        cta:($("#bnCta")?.value||"Ver más").trim(),
        region:($("#bnRegion")?.value||"Todas").trim(),
        comuna:($("#bnComuna")?.value||"Todas").trim(),
        priceModel:$("#bnModel")?.value||"Fijo",
        amount:Number($("#bnAmount")?.value||0),
        priority:Number($("#bnPriority")?.value||1),
        status:$("#bnStatus")?.value||"activo",
        url:($("#bnUrl")?.value||"#").trim(),
        updatedAt:now()
      };
      if(!obj.title || !obj.partner){ alert("Completa título y partner."); return; }
      const i = d.banners.findIndex(x=>String(x.id)===String(id));
      if(i>=0) d.banners[i]=Object.assign({},d.banners[i],obj); else d.banners.unshift(Object.assign({createdAt:now()},obj));
      saveMonetData(d); closeModal(); renderMonetizacion();
    },
    saveAlliance(){
      const d = monetData();
      const obj = {id:"al_"+Date.now().toString(16),partner:($("#alPartner")?.value||"").trim(),category:$("#alCategory")?.value||"Libros",benefit:($("#alBenefit")?.value||"").trim(),mechanics:($("#alMechanics")?.value||"Cupón").trim(),coupon:($("#alCoupon")?.value||"").trim(),status:"activo",createdAt:now()};
      if(!obj.partner || !obj.benefit){ alert("Completa partner y beneficio."); return; }
      d.alliances.unshift(obj); saveMonetData(d); closeModal(); renderMonetizacion(); setTimeout(()=>renderMonetTab("alianzas"),0);
    },
    saveSeguro(){
      const d = monetData();
      const obj = {id:"sg_"+Date.now().toString(16),partner:($("#sgPartner")?.value||"").trim(),product:($("#sgProduct")?.value||"").trim(),flow:$("#sgFlow")?.value||"Lead derivado",commission:Number($("#sgCommission")?.value||0),description:($("#sgDescription")?.value||"").trim(),status:"activo",createdAt:now()};
      if(!obj.partner || !obj.product){ alert("Completa aseguradora y producto."); return; }
      d.seguros.unshift(obj); saveMonetData(d); closeModal(); renderMonetizacion(); setTimeout(()=>renderMonetTab("seguros"),0);
    },
    saveMonetRules(){
      const d = monetData();
      d.config.maxBannersPerScreen = Number($("#monMaxBanner")?.value||1);
      d.config.hideWhenOperationalAlert = ($("#monHideAlert")?.value||"true")==="true";
      d.config.allowPresidentHide = ($("#monAllowHide")?.value||"true")==="true";
      saveMonetData(d); alert("Reglas guardadas");
    },
    openAgentModal,openAgentDetail,openAssignReferral,openReferralGoal,closeModal,saveAgent(id){const a=agents(),c=code($("#agCode")?.value),name=($("#agName")?.value||"").trim(),email=($("#agEmail")?.value||"").trim().toLowerCase();if(!name||!email||!c){alert("Completa nombre, email y código.");return}if(a.find(x=>code(x.code)===c&&String(x.id)!==String(id||""))){alert("Ese código ya existe.");return}const obj={id:id||"ag_"+Date.now().toString(16),name,email,phone:($("#agPhone")?.value||"").trim(),code:c,status:$("#agStatus")?.value||"active",updatedAt:now()};const i=a.findIndex(x=>String(x.id)===String(obj.id));if(i>=0)a[i]=Object.assign({},a[i],obj);else a.unshift(Object.assign({createdAt:now()},obj));saveAgents(a);closeModal();renderAgentes()},saveAssignReferral(ck){const ag=agentById($("#assignAgentId")?.value||"");if(!ag){alert("Selecciona un agente.");return}const r=rows().find(x=>String(x.courseKey)===String(ck))||{},st=$("#assignStatus")?.value||"asignado",a=refs();a.unshift({id:"ref_admin_"+Date.now().toString(16),courseKey:ck,referralCode:code(ag.code),agentId:ag.id,agentName:ag.name,status:st,assignedByAdmin:true,assignedAt:now(),reservedUntil:st==="reservado"?new Date(Date.now()+48*60*60*1000).toISOString():"",schoolName:r.schoolName||"",regionName:r.regionName||"",courseLabel:r.courseLabel||ck,targetParents:r.targetParents||target(r),createdAt:now()});saveRefs(a);closeModal();renderAgentes()},saveReferralGoal(id){const a=refs(),i=a.findIndex(x=>String(x.id)===String(id));if(i>=0){a[i].targetParents=Number($("#refTargetParents")?.value||30);a[i].status=$("#refStatusGoal")?.value||"asignado";a[i].updatedAt=now();saveRefs(a)}closeModal();renderAgentes()},saveGlobalAlert(){const title=($("#gaTitle")?.value||"").trim(),message=($("#gaMessage")?.value||"").trim();if(!title||!message){alert("Completa título y mensaje.");return}const a=load(KAL,[]);a.unshift({id:"ga_"+Date.now().toString(16),type:$("#gaType")?.value||"General",severity:$("#gaSeverity")?.value||"informativa",title,message,status:"activa",createdAt:now()});save(KAL,a);renderAlertas()},clearGlobalAlertForm(){["gaTitle","gaMessage"].forEach(id=>{const e=$("#"+id);if(e)e.value=""})},closeGlobalAlert(id){const a=load(KAL,[]),i=a.findIndex(x=>String(x.id)===String(id));if(i>=0){a[i].status="cerrada";a[i].closedAt=now();save(KAL,a)}renderAlertas()}});return true}
  (function wait(){if(!install())setTimeout(wait,30)})();
})();



/* Cursapp Mercado Admin Supabase V3 START */
(function(){
if(window.__MercadoAdminSupabaseV3)return;window.__MercadoAdminSupabaseV3=true;
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=s=>String(s??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const clp=v=>"$"+Number(v||0).toLocaleString("es-CL");
const fmt=x=>{try{return new Date(x).toLocaleString("es-CL",{dateStyle:"short",timeStyle:"short"})}catch(e){return x||"—"}};
const SB_URL="https://ngxistgymgdkoaiulfbq.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5neGlzdGd5bWdka29haXVsZmJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2OTg1NDQsImV4cCI6MjA5NjI3NDU0NH0.1r-aLijYEWvUifKcLjlClnA8-oYw11lgThY0swg_xbg";
async function api(path,opt={}){const res=await fetch(SB_URL+"/rest/v1/"+path,{...opt,headers:{apikey:SB_KEY,Authorization:"Bearer "+SB_KEY,"Content-Type":"application/json",Prefer:opt.prefer||"return=representation",...(opt.headers||{})}});const t=await res.text();let data=[];try{data=t?JSON.parse(t):[]}catch(e){data=t}if(!res.ok)throw new Error((data&&data.message)||t||res.statusText);return Array.isArray(data)?data:data?[data]:[]}
function badge(t,cls){return `<span class="badge ${esc(cls||"purple")}">${esc(t)}</span>`}
function kpi(i,l,v,d){return `<div class="kpi"><div class="kpiIcon">${i}</div><label>${esc(l)}</label><strong>${esc(v)}</strong><small>${esc(d||"Supabase")}</small></div>`}
function title(t,s){const a=$("#viewTitle"),b=$("#viewSub");if(a)a.textContent=t;if(b)b.textContent=s||""}
function app(){return $("#adminApp")}
function statusBadge(st){const s=String(st||"disponible").toLowerCase();return badge(s,s==="disponible"?"green":s==="reservado"?"orange":s==="vendido"?"purple":s==="en_revision"?"orange":s==="oculto"||s==="bloqueado"?"red":"gray")}
async function load(){
 const [cats,pubs,contacts,reports,imgs,reasons,words]=await Promise.all([
  api("mercado_categorias?select=*&order=nombre.asc"),
  api("mercado_publicaciones?select=*&order=created_at.desc"),
  api("mercado_contactos?select=*&order=created_at.desc"),
  api("mercado_reportes?select=*&order=created_at.desc"),
  api("mercado_imagenes?select=*&order=orden.asc"),
  api("mercado_motivos_reporte?select=*&order=orden.asc").catch(()=>[]),
  api("mercado_palabras_bloqueadas?select=*&order=palabra.asc").catch(()=>[])
 ]);
 const catMap=new Map(cats.map(c=>[String(c.id),c])); const pubMap=new Map(pubs.map(p=>[String(p.id),p]));
 return {cats,pubs,contacts,reports,imgs,reasons,words,catMap,pubMap};
}
async function render(){
 title("Mercado Escolar","Publicaciones, contactos WhatsApp, reportes y moderación desde Supabase");
 const el=app(); if(!el)return; el.innerHTML=`<section class="panel"><h2>Cargando Mercado Escolar...</h2><p class="muted" style="font-weight:800">Consultando Supabase.</p></section>`;
 let d; try{d=await load()}catch(e){el.innerHTML=`<section class="panel"><h2>Error Mercado</h2><p style="color:#b42318;font-weight:900">${esc(e.message)}</p></section>`;return}
 const activos=d.pubs.filter(p=>p.activo!==false && !["eliminado","oculto","bloqueado"].includes(String(p.estado||"").toLowerCase()));
 const revision=d.pubs.filter(p=>String(p.estado||"").toLowerCase()==="en_revision");
 const pendientes=d.reports.filter(r=>String(r.estado||"pendiente").toLowerCase()==="pendiente");
 const destacados=d.pubs.filter(p=>p.destacado===true);
 el.innerHTML=`<div class="kpis">${kpi("🛍️","Activas",activos.length,`${d.pubs.length} totales`)}${kpi("🟠","En revisión",revision.length,"moderación")}${kpi("🚩","Reportes pendientes",pendientes.length,`${d.reports.length} reportes`)}${kpi("💬","Contactos WhatsApp",d.contacts.length,"interacciones")}${kpi("⭐","Destacadas",destacados.length,"visibilidad")}${kpi("🛡️","Motivos",d.reasons.length,"configurables")}</div>
 <div class="monTabs"><button class="monTab active" data-mtab="posts">📦 Publicaciones</button><button class="monTab" data-mtab="reports">🚩 Reportes</button><button class="monTab" data-mtab="reasons">⚙️ Motivos</button><button class="monTab" data-mtab="words">🛡️ Palabras</button></div><section id="marketAdminTab"></section>`;
 $$("[data-mtab]").forEach(b=>b.onclick=()=>{ $$("[data-mtab]").forEach(x=>x.classList.remove("active")); b.classList.add("active"); tab(b.dataset.mtab,d); });
 tab("posts",d);
}
function tab(t,d){const box=$("#marketAdminTab");if(!box)return;
 if(t==="posts"){box.innerHTML=`<section class="panel"><div class="panelHead"><h2>Publicaciones</h2><button onclick="CursappMarketAdminV3.reload()">Actualizar</button></div><div class="tableWrap"><table><thead><tr><th>Publicación</th><th>Categoría</th><th>Precio</th><th>Vendedor</th><th>Métricas</th><th>Estado</th><th>Moderación</th></tr></thead><tbody>${d.pubs.map(p=>`<tr><td><b>${esc(p.titulo)}</b><br><small>${esc((p.descripcion||"").slice(0,90))}</small></td><td>${esc(d.catMap.get(String(p.categoria_id))?.nombre||p.categoria_id||"—")}</td><td>${clp(p.precio)}</td><td>${esc(p.nombre_vendedor||"—")}<br><small>${esc(p.whatsapp||"—")}</small></td><td>👁️ ${Number(p.visualizaciones||0)} · 💬 ${Number(p.contactos||0)} · ♥ ${Number(p.favoritos||0)}</td><td>${statusBadge(p.estado)}${p.destacado?"<br>⭐ Destacada":""}<br><small>${fmt(p.created_at)}</small></td><td><button class="adminBtn ghost" onclick="CursappMarketAdminV3.setPost('${p.id}','disponible')">Aprobar</button> <button class="adminBtn ghost" onclick="CursappMarketAdminV3.setPost('${p.id}','oculto')">Ocultar</button> <button class="adminBtn ghost" onclick="CursappMarketAdminV3.setPost('${p.id}','bloqueado')">Bloquear</button> <button class="adminBtn ghost" onclick="CursappMarketAdminV3.toggleFeatured('${p.id}',${p.destacado?"false":"true"})">${p.destacado?"Quitar ⭐":"Destacar ⭐"}</button></td></tr>`).join("")||`<tr><td colspan="7">Sin publicaciones.</td></tr>`}</tbody></table></div></section>`;return}
 if(t==="reports"){box.innerHTML=`<section class="panel"><h2>Reportes</h2><div class="tableWrap"><table><thead><tr><th>Publicación</th><th>Motivo</th><th>Detalle</th><th>Estado</th><th>Acción</th></tr></thead><tbody>${d.reports.map(r=>{const p=d.pubMap.get(String(r.publicacion_id))||{};return `<tr><td><b>${esc(p.titulo||r.publicacion_id)}</b></td><td>${esc(r.motivo||"—")}</td><td>${esc(r.detalle||"")}</td><td>${statusBadge(r.estado||"pendiente")}</td><td><button class="adminBtn ghost" onclick="CursappMarketAdminV3.resolveReport('${r.id}','revisado')">Marcar revisado</button> <button class="adminBtn ghost" onclick="CursappMarketAdminV3.setPost('${r.publicacion_id}','oculto')">Ocultar publicación</button></td></tr>`}).join("")||`<tr><td colspan="5">Sin reportes.</td></tr>`}</tbody></table></div></section>`;return}
 if(t==="reasons"){box.innerHTML=`<section class="panel"><div class="panelHead"><h2>Motivos de reporte configurables</h2><button onclick="CursappMarketAdminV3.newReason()">+ Motivo</button></div><div class="tableWrap"><table><thead><tr><th>Orden</th><th>Código</th><th>Nombre</th><th>Detalle</th><th>Activo</th></tr></thead><tbody>${d.reasons.map(r=>`<tr><td>${r.orden||0}</td><td>${esc(r.codigo)}</td><td><b>${esc(r.nombre)}</b></td><td>${r.requiere_detalle?"Sí":"No"}</td><td>${r.activo===false?badge("inactivo","gray"):badge("activo","green")}</td></tr>`).join("")||`<tr><td colspan="5">Sin motivos configurados.</td></tr>`}</tbody></table></div></section>`;return}
 if(t==="words"){box.innerHTML=`<section class="panel"><div class="panelHead"><h2>Palabras bloqueadas</h2><button onclick="CursappMarketAdminV3.newWord()">+ Palabra</button></div><div class="tableWrap"><table><thead><tr><th>Palabra</th><th>Categoría</th><th>Activo</th></tr></thead><tbody>${d.words.map(w=>`<tr><td><b>${esc(w.palabra)}</b></td><td>${esc(w.categoria||"prohibido")}</td><td>${w.activo===false?badge("inactivo","gray"):badge("activo","green")}</td></tr>`).join("")||`<tr><td colspan="3">Sin palabras configuradas.</td></tr>`}</tbody></table></div></section>`;return}
}
window.CursappMarketAdminV3={reload:render,async setPost(id,estado){try{await api(`mercado_publicaciones?id=eq.${id}`,{method:"PATCH",body:JSON.stringify({estado,moderado_por:"admin@cursapp.cl",moderado_at:new Date().toISOString(),updated_at:new Date().toISOString()})});render()}catch(e){alert(e.message)}},async toggleFeatured(id,destacado){try{await api(`mercado_publicaciones?id=eq.${id}`,{method:"PATCH",body:JSON.stringify({destacado,updated_at:new Date().toISOString()})});render()}catch(e){alert(e.message)}},async resolveReport(id,estado){try{await api(`mercado_reportes?id=eq.${id}`,{method:"PATCH",body:JSON.stringify({estado,resuelto_por:"admin@cursapp.cl",resuelto_at:new Date().toISOString()})});render()}catch(e){alert(e.message)}},async newReason(){const nombre=prompt("Nuevo motivo de reporte"); if(!nombre)return; const codigo=nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,""); try{await api("mercado_motivos_reporte",{method:"POST",body:JSON.stringify({codigo,nombre,activo:true,orden:50})});render()}catch(e){alert(e.message)}},async newWord(){const palabra=prompt("Nueva palabra bloqueada"); if(!palabra)return; try{await api("mercado_palabras_bloqueadas",{method:"POST",body:JSON.stringify({palabra:palabra.toLowerCase(),activo:true})});render()}catch(e){alert(e.message)}}};
function install(){const A=window.Admin;if(A&&!A.__marketSupabaseV3Patched&&typeof A.go==="function"){const old=A.go.bind(A);A.go=function(t){$$(".sideItem").forEach(b=>b.classList.toggle("active",b.dataset.tab===t));document.body.classList.remove("sideOpen");if(t==="mercado"){render();return}return old(t)};A.__marketSupabaseV3Patched=true}}
document.addEventListener("DOMContentLoaded",()=>setTimeout(install,400)); setTimeout(install,1000);
})();
/* Cursapp Mercado Admin Supabase V3 END */



/* Cursapp Mercado Remove Dummy START */
(function(){
  const KP="cursapp_market_posts_v1";
  const DEMO_OWNERS=["otro@cursapp.cl","demo@cursapp.cl","demo2@cursapp.cl","demo3@cursapp.cl"];
  const DEMO_TITLES=["Polerón colegio Talla 14","Pack libros 6° básico 2024","Mochila colegial excelente estado","Balón de fútbol N°5","Vestido colegio Talla 10","Traje de huaso niño talla 10","Pack libros 6° básico","Polerón colegio talla 14","Aviso demo nuevo"];
  function load(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}}
  function save(k,v){localStorage.setItem(k,JSON.stringify(v))}
  function clean(){
    if(localStorage.getItem("cursapp_market_demo_seed_v1")==="1") return;
    const ps=load(KP,[]);
    if(!Array.isArray(ps)) return;
    const cleaned=ps.filter(p=>!DEMO_OWNERS.includes(String(p.owner||"").toLowerCase()) && !DEMO_TITLES.includes(String(p.title||"")));
    if(cleaned.length!==ps.length) save(KP,cleaned);
  }
  clean();
  window.CursappMarketCleanDemo=clean;
})();
/* Cursapp Mercado Remove Dummy END */
