
(function(){
  const SESSION_KEY = "cursapp_session_v1";
  const ADMIN_LOGS = "cursapp_admin_logs_v1";
  const ADMIN_TICKETS = "cursapp_admin_tickets_v1";

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const app = $("#adminApp");
  const modal = $("#adminModal");

  function esc(s){
    return String(s ?? "").replace(/[&<>'"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  }
  function load(k, def){
    try{ const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); }catch(e){ return def; }
  }
  function save(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
  function clp(v){ return "$" + Number(v||0).toLocaleString("es-CL"); }
  function now(){ return new Date().toISOString(); }
  function fmtDate(x){
    try{ return new Date(x).toLocaleString("es-CL", {dateStyle:"short", timeStyle:"short"}); }catch(e){ return x || "—"; }
  }

  function requireAdmin(){
    const s = load(SESSION_KEY, null);
    if(!s || s.role !== "admin" || !s.isAdmin){
      location.href = "/index.html";
      return false;
    }
    return true;
  }

  function allKeys(){
    const keys = [];
    for(let i=0;i<localStorage.length;i++) keys.push(localStorage.key(i));
    return keys;
  }
  function readMany(match){
    return allKeys().filter(match).flatMap(k=>{
      const v = load(k, []);
      return Array.isArray(v) ? v.map(x=>Object.assign({__key:k}, x)) : [];
    });
  }

  function payments(){
    return readMany(k => k.includes("_payments_v1") || k === "cursapp_payments_v1");
  }
  function tasks(){
    return readMany(k => k.includes("_tasks_v1") || k === "cursapp_tasks_v1");
  }
  function expenses(){
    return readMany(k => k.includes("_expenses_v1") || k === "cursapp_expenses_v1");
  }
  function reports(){
    return readMany(k => k.includes("_monthly_reports_v1") || k === "cursapp_monthly_reports_v1");
  }
  function profiles(){
    return load("cursapp_profiles_v1", []);
  }
  function users(){
    return load("cursapp_users_v1", []);
  }
  function enrollments(){
    return load("cursapp_enrollments_v1", []);
  }

  function courseKeyOf(x){
    return String(x.courseKey || x.__key || "global").replace(/^cursapp_/, "").replace(/_(payments|tasks|expenses|monthly_reports)_v1$/,"");
  }
  function courseLabelFromProfile(p){
    const c = p.course || {};
    return [c.schoolName || c.colegio || "Colegio", `${c.level||""}${c.letter||""} ${c.year||""}`.trim(), c.jornada || ""].filter(Boolean).join(" · ");
  }

  function seedAdminData(){
    const t = load(ADMIN_TICKETS, null);
    if(!t || !t.length){
      save(ADMIN_TICKETS, [
        {id:"TK-3487", status:"abierto", priority:"alta", school:"Colegio San Ignacio El Bosque", course:"8° Básico A", requester:"presidente@demo.cl", subject:"Problema con pago por Webpay", createdAt:now(), detail:"Apoderado indica pago rechazado pero aparece cargo bancario."},
        {id:"TK-3486", status:"revision", priority:"media", school:"Colegio Manquecura Ciudad", course:"2° Medio B", requester:"tesorero@demo.cl", subject:"No podemos acceder a rendiciones", createdAt:new Date(Date.now()-3600e3*4).toISOString(), detail:"Tesorero no visualiza gastos asociados a campaña."},
        {id:"TK-3485", status:"resuelto", priority:"baja", school:"Colegio Los Andes", course:"1° Medio A", requester:"directiva@demo.cl", subject:"Solicitud de corrección de curso", createdAt:new Date(Date.now()-3600e3*26).toISOString(), detail:"Se corrigió jornada del curso."}
      ]);
    }

    if(!load(ADMIN_LOGS, []).length){
      save(ADMIN_LOGS, [
        {at:now(), user:"admin@cursapp.cl", type:"login_admin", action:"Ingreso a panel administrador", target:"Admin Console", ip:"local"},
        {at:new Date(Date.now()-600000).toISOString(), user:"presidente@demo.cl", type:"campaign_created", action:"Creó campaña Gira de Estudio", target:"Colegio Demo · 2°B", ip:"local"},
        {at:new Date(Date.now()-1200000).toISOString(), user:"apoderado@demo.cl", type:"payment_success", action:"Pago realizado por apoderado", target:"Gira de Estudio", ip:"local"},
        {at:new Date(Date.now()-1800000).toISOString(), user:"tesorero@demo.cl", type:"expense_created", action:"Registró gasto con boleta", target:"Rendiciones", ip:"local"}
      ]);
    }
  }

  function log(type, action, target, extra={}){
    const logs = load(ADMIN_LOGS, []);
    logs.unshift(Object.assign({at:now(), user:"admin@cursapp.cl", type, action, target, ip:"local"}, extra));
    save(ADMIN_LOGS, logs.slice(0,500));
  }

  function stats(){
    const ps = profiles();
    const us = users();
    const ens = enrollments();
    const pays = payments();
    const exps = expenses();
    const reps = reports();
    const ts = tasks();

    const courseKeys = new Set(ps.map(p=>p.courseKey).filter(Boolean));
    tasks().forEach(t=>courseKeys.add(courseKeyOf(t)));
    payments().forEach(p=>courseKeys.add(courseKeyOf(p)));

    const schools = new Set(ps.map(p=>p.course?.schoolName || p.course?.colegio || "").filter(Boolean));
    const alumnos = new Set([
      ...ps.map(p=>p.apoderado?.alumnoId || p.apoderado?.alumno).filter(Boolean),
      ...pays.map(p=>p.alumno || p.alumnoId).filter(Boolean),
      ...ens.map(e=>e.alumno || e.alumnoId).filter(Boolean)
    ]);

    const paid = pays.filter(p=>p.status==="paid");
    const failed = pays.filter(p=>["failed","rejected","rechazado","fallido"].includes(String(p.status||"").toLowerCase()));
    const pending = pays.filter(p=>!["paid","opted_out"].includes(String(p.status||"").toLowerCase()));
    const manual = paid.filter(p=>/manual|transfer|efectivo|concili/i.test(String(p.method||p.note||p.ref||"")));
    const totalPaid = paid.reduce((a,b)=>a+Number(b.amount||b.monto||0),0);

    return {ps,us,ens,pays,exps,reps,ts,schools,courseKeys,alumnos,paid,failed,pending,manual,totalPaid};
  }

  function setTitle(title, sub){
    $("#viewTitle").textContent = title;
    $("#viewSub").textContent = sub || "";
  }

  function kpi(icon,label,value,delta){
    return `<div class="kpi"><div class="kpiIcon">${icon}</div><label>${label}</label><strong>${value}</strong><small>${delta||"Actualizado ahora"}</small></div>`;
  }

  function renderDashboard(){
    setTitle("Hola, Admin 👋", "Bienvenido al panel de administración de Cursapp");
    const s = stats();
    const tickets = load(ADMIN_TICKETS, []);
    const logs = load(ADMIN_LOGS, []);
    const openTickets = tickets.filter(t=>t.status!=="resuelto").length;

    app.innerHTML = `
      <div class="kpis">
        ${kpi("🏫","Colegios registrados",s.schools.size || "—","+ total app")}
        ${kpi("🎓","Cursos activos",s.courseKeys.size || "—","+ cursos detectados")}
        ${kpi("👥","Apoderados / Alumnos",s.alumnos.size || s.ps.length || "—","+ comunidad")}
        ${kpi("💳","Pagos del mes",clp(s.totalPaid),`${s.paid.length} pagos exitosos`)}
        ${kpi("⚠️","Pagos fallidos",s.failed.length,`${s.pending.length} pendientes`)}
        ${kpi("🎫","Tickets abiertos",openTickets,`${tickets.length} tickets totales`)}
      </div>

      <div class="gridMain">
        <section class="panel">
          <div class="panelHead"><h2>Alertas operacionales</h2><button onclick="Admin.go('auditoria')">Ver todas</button></div>
          <div class="list">
            ${alertRows(s, tickets)}
          </div>
        </section>

        <section class="panel">
          <div class="panelHead"><h2>Tickets recientes</h2><button onclick="Admin.go('tickets')">Ver todos</button></div>
          <div class="list">
            ${tickets.slice(0,5).map(ticketRow).join("") || emptyRow("Sin tickets")}
          </div>
        </section>

        <section class="panel">
          <div class="panelHead"><h2>Dashboard de pagos</h2><button onclick="Admin.go('pagos')">Detalle</button></div>
          ${paymentDashboard(s)}
        </section>
      </div>

      <div class="tablesGrid">
        <section class="panel">
          <div class="panelHead"><h2>Últimos movimientos en la plataforma</h2><button onclick="Admin.go('logs')">Ver todos los logs</button></div>
          ${logsTable(logs.slice(0,7))}
        </section>

        <section class="panel">
          <div class="panelHead"><h2>Acciones rápidas</h2></div>
          <div class="actionsGrid">
            <button class="quick" onclick="Admin.go('colegios')">🔍<strong>Buscar curso</strong><span>Ver información</span></button>
            <button class="quick" onclick="Admin.go('comunidad')">👤<strong>Buscar usuario</strong><span>Ver perfil completo</span></button>
            <button class="quick" onclick="Admin.go('tickets')">💬<strong>Resolver ticket</strong><span>Ir a soporte</span></button>
            <button class="quick" onclick="Admin.go('pagos')">💳<strong>Ver pagos</strong><span>Panel financiero</span></button>
            <button class="quick" onclick="Admin.go('logs')">📄<strong>Logs de actividad</strong><span>Ver registros</span></button>
            <button class="quick" onclick="Admin.go('auditoria')">🛡️<strong>Auditar cambios</strong><span>Ver bitácora</span></button>
          </div>
        </section>
      </div>
    `;
  }

  function alertRows(s,tickets){
    const rows = [];
    if(s.failed.length) rows.push({icon:"⚠️", title:"Pagos fallidos detectados", body:`${s.failed.length} pagos fallidos en la plataforma`, tag:"red"});
    if(tickets.filter(t=>t.status==="abierto").length) rows.push({icon:"🎫", title:"Tickets sin responder", body:`${tickets.filter(t=>t.status==="abierto").length} tickets abiertos`, tag:"orange"});
    if(s.pending.length) rows.push({icon:"💳", title:"Pagos pendientes", body:`${s.pending.length} pagos pendientes o en revisión`, tag:"purple"});
    rows.push({icon:"🛡️", title:"Auditoría activa", body:"Todas las acciones admin quedan registradas", tag:"blue"});
    return rows.map(r=>`<div class="row"><div class="rowIcon">${r.icon}</div><div><b>${r.title}</b><p>${r.body}</p></div><span class="badge ${r.tag}">Ver</span></div>`).join("");
  }

  function ticketRow(t){
    const cls = t.status==="resuelto" ? "green" : (t.status==="revision" ? "orange" : "red");
    return `<div class="row"><div class="rowIcon">C</div><div><b>${esc(t.school)}</b><p>${esc(t.subject)} · ${esc(t.id)}</p></div><span class="badge ${cls}">${esc(t.status)}</span></div>`;
  }

  function emptyRow(text){ return `<div class="row"><div class="rowIcon">—</div><div><b>${text}</b><p>No hay información para mostrar.</p></div></div>`; }

  function paymentDashboard(s){
    const total = Math.max(1, s.pays.length);
    const successful = s.paid.length;
    const failed = s.failed.length;
    const pending = s.pending.length;
    const manual = s.manual.length;
    return `
      <div class="paymentBox">
        <div class="donut"><div class="donutText"><strong>${s.pays.length}</strong><span>Pagos totales</span></div></div>
        <div class="legend">
          ${legend("#22c55e","Exitosos",successful, pct(successful,total))}
          ${legend("#f43f5e","Fallidos",failed, pct(failed,total))}
          ${legend("#f59e0b","Pendientes",pending, pct(pending,total))}
          ${legend("#6d28d9","Conciliación manual",manual, pct(manual,total))}
          <hr style="width:100%;border:0;border-top:1px solid rgba(16,24,40,.08)">
          <div><b>Monto total transado</b><h2>${clp(s.totalPaid)}</h2></div>
        </div>
      </div>
    `;
  }
  function pct(v,t){ return `${Math.round((v/t)*100)}%`; }
  function legend(color,label,count,p){ return `<div class="legendRow"><span class="dot" style="background:${color}"></span><span>${label}</span><b>${count}</b><small>${p}</small></div>`; }

  function logsTable(logs){
    return `<div class="tableWrap"><table><thead><tr><th>Fecha / Hora</th><th>Usuario</th><th>Acción</th><th>Objetivo</th><th>Tipo</th></tr></thead><tbody>${logs.map(l=>`<tr><td>${fmtDate(l.at)}</td><td>${esc(l.user)}</td><td>${esc(l.action)}</td><td>${esc(l.target)}</td><td><span class="badge purple">${esc(l.type)}</span></td></tr>`).join("") || `<tr><td colspan="5">Sin logs.</td></tr>`}</tbody></table></div>`;
  }

  function renderLogs(){
    setTitle("Logs de movimientos", "Trazabilidad operacional de la app");
    const logs = load(ADMIN_LOGS, []);
    app.innerHTML = `
      <div class="toolbar">
        <input id="logSearch" placeholder="Buscar por usuario, acción o curso..." oninput="Admin.filterLogs()">
        <select id="logType" onchange="Admin.filterLogs()">
          <option value="">Todos los tipos</option>
          <option value="login_admin">Login admin</option>
          <option value="campaign_created">Campañas</option>
          <option value="payment_success">Pagos</option>
          <option value="admin_action">Acciones admin</option>
        </select>
        <button class="adminBtn ghost" onclick="Admin.exportLogs()">Exportar CSV</button>
      </div>
      <section class="panel"><div class="panelHead"><h2>Bitácora</h2><button onclick="Admin.addDemoLog()">Agregar log demo</button></div><div id="logsTable">${logsTable(logs)}</div></section>
    `;
  }

  function renderTickets(){
    setTitle("Tickets de soporte", "Buscar y resolver solicitudes de directivas por curso y colegio");
    const tickets = load(ADMIN_TICKETS, []);
    app.innerHTML = `
      <div class="toolbar">
        <input id="ticketSearch" placeholder="Buscar colegio, curso, correo o folio..." oninput="Admin.filterTickets()">
        <select id="ticketStatus" onchange="Admin.filterTickets()"><option value="">Todos</option><option value="abierto">Abiertos</option><option value="revision">En revisión</option><option value="resuelto">Resueltos</option></select>
        <button class="adminBtn" onclick="Admin.openTicketModal()">Nuevo ticket</button>
      </div>
      <section class="panel"><div class="panelHead"><h2>Tickets</h2><span class="badge purple">${tickets.length} total</span></div><div id="ticketsList" class="list">${tickets.map(ticketFullRow).join("")}</div></section>
    `;
  }

  function ticketFullRow(t){
    const cls = t.status==="resuelto" ? "green" : (t.status==="revision" ? "orange" : "red");
    return `<div class="row" onclick="Admin.openTicket('${esc(t.id)}')" style="cursor:pointer"><div class="rowIcon">🎫</div><div><b>${esc(t.id)} · ${esc(t.subject)}</b><p>${esc(t.school)} · ${esc(t.course)} · ${esc(t.requester)}</p></div><span class="badge ${cls}">${esc(t.status)}</span></div>`;
  }

  function renderPagos(){
    setTitle("Panel de pagos", "Trazabilidad de pagos efectuados, fallidos y modalidades");
    const s = stats();
    const pays = s.pays.slice().sort((a,b)=>String(b.createdAt||b.paidAt||"").localeCompare(String(a.createdAt||a.paidAt||"")));
    app.innerHTML = `
      <div class="kpis">
        ${kpi("✅","Pagos efectuados",s.paid.length,clp(s.totalPaid))}
        ${kpi("⚠️","Pagos fallidos",s.failed.length,"revisar rechazos")}
        ${kpi("⏳","Pendientes",s.pending.length,"en curso")}
        ${kpi("🤝","Manuales / conciliados",s.manual.length,"transferencia / efectivo")}
        ${kpi("💳","Total pagos",s.pays.length,"todos los estados")}
        ${kpi("📄","Comprobantes",readMany(k=>k.includes("_receipts_v1") || k==="cursapp_receipts_v1").length,"emitidos")}
      </div>
      <section class="panel" style="margin-top:20px"><div class="panelHead"><h2>Detalle de pagos</h2><button onclick="Admin.go('logs')">Ver logs</button></div>
      <div class="tableWrap"><table><thead><tr><th>Alumno</th><th>Concepto</th><th>Monto</th><th>Estado</th><th>Modalidad</th><th>Curso</th></tr></thead><tbody>
      ${pays.map(p=>`<tr><td>${esc(p.alumno||"—")}</td><td>${esc(p.concept||p.title||"Pago")}</td><td>${clp(p.amount||p.monto)}</td><td>${statusBadge(p.status)}</td><td>${esc(p.method||p.ref||"Webpay/demo")}</td><td>${esc(courseKeyOf(p))}</td></tr>`).join("") || `<tr><td colspan="6">Sin pagos.</td></tr>`}
      </tbody></table></div></section>`;
  }

  function statusBadge(st){
    const s = String(st||"pending").toLowerCase();
    const cls = s==="paid" ? "green" : (["failed","rejected","rechazado","fallido"].includes(s) ? "red" : (s==="opted_out" ? "gray" : "orange"));
    return `<span class="badge ${cls}">${esc(s)}</span>`;
  }

  function renderComunidad(){
    setTitle("Administración de comunidad", "Dar de baja miembros o corregir datos con trazabilidad");
    const ps = profiles();
    const us = users();
    app.innerHTML = `
      <div class="toolbar">
        <input id="communitySearch" placeholder="Buscar nombre, correo, alumno, colegio..." oninput="Admin.filterCommunity()">
        <button class="adminBtn ghost" onclick="Admin.go('auditoria')">Ver auditoría</button>
      </div>
      <section class="panel"><div class="panelHead"><h2>Miembros</h2><span class="badge purple">${ps.length || us.length} registros</span></div><div id="communityTable">${communityTable(ps,us)}</div></section>`;
  }

  function communityTable(ps,us){
    const rows = ps.length ? ps.map(p=>{
      const email = p.userId || p.apoderado?.email || "";
      const name = p.apoderado?.name || p.directiva?.name || email || "Usuario";
      return {name,email,role:p.role, alumno:p.apoderado?.alumno||"—", course:courseLabelFromProfile(p), profileId:p.profileId};
    }) : us.map(u=>({name:u.email,email:u.email,role:"usuario",alumno:"—",course:"—",profileId:u.userId}));
    return `<div class="tableWrap"><table><thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Alumno</th><th>Curso</th><th>Acciones</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(r.email)}</td><td><span class="badge purple">${esc(r.role)}</span></td><td>${esc(r.alumno)}</td><td>${esc(r.course)}</td><td><button class="adminBtn ghost" onclick="Admin.openMember('${esc(r.profileId)}')">Administrar</button></td></tr>`).join("") || `<tr><td colspan="6">Sin miembros.</td></tr>`}</tbody></table></div>`;
  }

  function renderColegios(){
    setTitle("Colegios y cursos", "Visión global de cursos registrados en Cursapp");
    const ps = profiles();
    const byCourse = {};
    ps.forEach(p=>{
      const ck = p.courseKey || "global";
      if(!byCourse[ck]) byCourse[ck] = {courseKey:ck, label:courseLabelFromProfile(p), miembros:0, presidentes:0, tesoreros:0, apoderados:0};
      byCourse[ck].miembros++;
      byCourse[ck][`${p.role}s`] = (byCourse[ck][`${p.role}s`]||0)+1;
    });
    const rows = Object.values(byCourse);
    app.innerHTML = `<div class="toolbar"><input id="courseSearch" placeholder="Buscar colegio, curso o jornada..." oninput="Admin.filterCourses()"></div>
    <section class="panel"><div class="panelHead"><h2>Cursos registrados</h2><span class="badge purple">${rows.length} cursos</span></div><div id="courseTable"><div class="tableWrap"><table><thead><tr><th>Curso</th><th>Miembros</th><th>Presidentes</th><th>Tesoreros</th><th>Apoderados</th><th>Acción</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.label || r.courseKey)}</td><td>${r.miembros}</td><td>${r.presidentes||0}</td><td>${r.tesoreros||0}</td><td>${r.apoderados||0}</td><td><button class="adminBtn ghost" onclick="Admin.inspectCourse('${esc(r.courseKey)}')">Ver</button></td></tr>`).join("") || `<tr><td colspan="6">Sin cursos.</td></tr>`}</tbody></table></div></div></section>`;
  }

  function renderAuditoria(){
    setTitle("Auditoría", "Control de cambios sensibles y acciones administrativas");
    const logs = load(ADMIN_LOGS, []).filter(l=>String(l.type||"").includes("admin") || String(l.type||"").includes("audit") || String(l.type||"").includes("member"));
    app.innerHTML = `<section class="panel"><div class="panelHead"><h2>Acciones sensibles</h2><button onclick="Admin.addAuditDemo()">Registrar acción demo</button></div>${logsTable(logs)}</section>`;
  }

  function openModal(html){
    modal.innerHTML = `<div class="modalBg"><div class="modalCard">${html}</div></div>`;
  }
  function closeModal(){ modal.innerHTML = ""; }

  window.Admin = {
    go(tab){
      $$(".sideItem").forEach(b=>b.classList.toggle("active", b.dataset.tab===tab));
      document.body.classList.remove("sideOpen");
      if(tab==="dashboard") renderDashboard();
      if(tab==="logs") renderLogs();
      if(tab==="tickets") renderTickets();
      if(tab==="pagos") renderPagos();
      if(tab==="comunidad") renderComunidad();
      if(tab==="colegios") renderColegios();
      if(tab==="auditoria") renderAuditoria();
    },
    logout(){
      log("logout_admin","Salida de panel administrador","Admin Console");
      localStorage.removeItem(SESSION_KEY);
      location.href="/index.html";
    },
    filterLogs(){
      const q = ($("#logSearch")?.value||"").toLowerCase();
      const t = $("#logType")?.value || "";
      const rows = load(ADMIN_LOGS, []).filter(l=>(!t || l.type===t) && JSON.stringify(l).toLowerCase().includes(q));
      $("#logsTable").innerHTML = logsTable(rows);
    },
    exportLogs(){
      const logs = load(ADMIN_LOGS, []);
      const csv = ["fecha,usuario,tipo,accion,objetivo"].concat(logs.map(l=>[l.at,l.user,l.type,l.action,l.target].map(x=>`"${String(x||"").replace(/"/g,'""')}"`).join(","))).join("\\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], {type:"text/csv"}));
      a.download = "cursapp_admin_logs.csv";
      a.click();
      log("admin_action","Exportó logs CSV","Logs");
    },
    addDemoLog(){ log("admin_action","Revisó logs operacionales","Logs"); renderLogs(); },
    filterTickets(){
      const q = ($("#ticketSearch")?.value||"").toLowerCase();
      const st = $("#ticketStatus")?.value || "";
      const rows = load(ADMIN_TICKETS, []).filter(t=>(!st || t.status===st) && JSON.stringify(t).toLowerCase().includes(q));
      $("#ticketsList").innerHTML = rows.map(ticketFullRow).join("") || emptyRow("Sin tickets");
    },
    openTicket(id){
      const t = load(ADMIN_TICKETS, []).find(x=>x.id===id);
      if(!t) return;
      openModal(`<h2>${esc(t.id)} · ${esc(t.subject)}</h2><p class="muted">${esc(t.school)} · ${esc(t.course)}</p><p>${esc(t.detail||"")}</p><div class="formGrid"><div><label>Estado</label><select id="tkStatus"><option value="abierto">Abierto</option><option value="revision">En revisión</option><option value="resuelto">Resuelto</option></select></div><div><label>Prioridad</label><select id="tkPriority"><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select></div><div style="grid-column:1/-1"><label>Nota resolución</label><textarea id="tkNote" placeholder="Describe la gestión realizada..."></textarea></div></div><div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="adminBtn ghost" onclick="Admin.closeModal()">Cancelar</button><button class="adminBtn" onclick="Admin.resolveTicket('${esc(t.id)}')">Guardar</button></div>`);
      $("#tkStatus").value = t.status;
      $("#tkPriority").value = t.priority;
    },
    resolveTicket(id){
      const list = load(ADMIN_TICKETS, []);
      const i = list.findIndex(t=>t.id===id);
      if(i>=0){
        list[i].status = $("#tkStatus").value;
        list[i].priority = $("#tkPriority").value;
        list[i].adminNote = $("#tkNote").value;
        list[i].updatedAt = now();
        save(ADMIN_TICKETS, list);
        log("admin_action","Actualizó ticket",id,{note:list[i].adminNote});
      }
      closeModal();
      renderTickets();
    },
    openTicketModal(){
      openModal(`<h2>Nuevo ticket interno</h2><div class="formGrid"><div><label>Colegio</label><input id="ntSchool" placeholder="Colegio"></div><div><label>Curso</label><input id="ntCourse" placeholder="2°B"></div><div><label>Solicitante</label><input id="ntReq" placeholder="correo"></div><div><label>Prioridad</label><select id="ntPri"><option>media</option><option>alta</option><option>baja</option></select></div><div style="grid-column:1/-1"><label>Asunto</label><input id="ntSub" placeholder="Motivo"></div><div style="grid-column:1/-1"><label>Detalle</label><textarea id="ntDet"></textarea></div></div><div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="adminBtn ghost" onclick="Admin.closeModal()">Cancelar</button><button class="adminBtn" onclick="Admin.createTicket()">Crear</button></div>`);
    },
    createTicket(){
      const list = load(ADMIN_TICKETS, []);
      const id = "TK-" + Math.floor(1000+Math.random()*9000);
      list.unshift({id,status:"abierto",priority:$("#ntPri").value,school:$("#ntSchool").value,course:$("#ntCourse").value,requester:$("#ntReq").value,subject:$("#ntSub").value,detail:$("#ntDet").value,createdAt:now()});
      save(ADMIN_TICKETS, list);
      log("admin_action","Creó ticket interno",id);
      closeModal(); renderTickets();
    },
    filterCommunity(){
      const q = ($("#communitySearch")?.value||"").toLowerCase();
      const ps = profiles().filter(p=>JSON.stringify(p).toLowerCase().includes(q));
      $("#communityTable").innerHTML = communityTable(ps, users());
    },
    openMember(profileId){
      const ps = profiles();
      const p = ps.find(x=>String(x.profileId||x.userId)===String(profileId));
      if(!p) return;
      openModal(`<h2>Administrar miembro</h2><p class="muted">${esc(p.role)} · ${esc(courseLabelFromProfile(p))}</p><div class="formGrid"><div><label>Nombre</label><input id="mName" value="${esc(p.apoderado?.name || p.directiva?.name || "")}"></div><div><label>Email</label><input id="mEmail" value="${esc(p.apoderado?.email || p.userId || "")}"></div><div><label>Alumno</label><input id="mAlumno" value="${esc(p.apoderado?.alumno || "")}"></div><div><label>Estado</label><select id="mStatus"><option value="active">Activo</option><option value="suspended">Suspendido</option><option value="inactive">Baja</option></select></div><div style="grid-column:1/-1"><label>Motivo obligatorio</label><textarea id="mReason" placeholder="Explica por qué se realiza el cambio"></textarea></div></div><div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="adminBtn ghost" onclick="Admin.closeModal()">Cancelar</button><button class="adminBtn" onclick="Admin.saveMember('${esc(profileId)}')">Guardar cambios</button></div>`);
      $("#mStatus").value = p.status || "active";
    },
    saveMember(profileId){
      const reason = ($("#mReason").value||"").trim();
      if(!reason){ alert("Debes ingresar un motivo para auditar el cambio."); return; }
      const ps = profiles();
      const i = ps.findIndex(x=>String(x.profileId||x.userId)===String(profileId));
      if(i>=0){
        if(ps[i].apoderado){
          ps[i].apoderado.name = $("#mName").value;
          ps[i].apoderado.email = $("#mEmail").value;
          ps[i].apoderado.alumno = $("#mAlumno").value;
        }
        if(ps[i].directiva) ps[i].directiva.name = $("#mName").value;
        ps[i].status = $("#mStatus").value;
        ps[i].updatedByAdminAt = now();
        ps[i].updatedByAdminReason = reason;
        save("cursapp_profiles_v1", ps);
        log("admin_member_update","Actualizó datos de miembro",profileId,{reason});
      }
      closeModal(); renderComunidad();
    },
    filterCourses(){
      const q = ($("#courseSearch")?.value||"").toLowerCase();
      // simple rerender filtered by hiding rows
      $$("#courseTable tbody tr").forEach(tr=>tr.style.display = tr.textContent.toLowerCase().includes(q) ? "" : "none");
    },
    inspectCourse(courseKey){
      const ps = profiles().filter(p=>p.courseKey===courseKey);
      openModal(`<h2>Curso ${esc(courseKey)}</h2><p class="muted">${ps.length} miembros detectados.</p>${communityTable(ps, [])}<div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="adminBtn ghost" onclick="Admin.closeModal()">Cerrar</button></div>`);
      log("admin_action","Inspeccionó curso",courseKey);
    },
    addAuditDemo(){ log("admin_audit","Revisión manual de auditoría","Admin Console",{reason:"Control preventivo"}); renderAuditoria(); },
    closeModal
  };

  document.addEventListener("DOMContentLoaded", ()=>{
    if(!requireAdmin()) return;
    seedAdminData();
    log("login_admin","Ingreso a panel administrador","Admin Console");
    $("#mobileMenu")?.addEventListener("click", ()=>document.body.classList.toggle("sideOpen"));
    $$(".sideItem").forEach(b=>b.addEventListener("click", ()=>Admin.go(b.dataset.tab)));
    Admin.go("dashboard");
  });
})();
