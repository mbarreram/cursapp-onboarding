
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

  function payments(){ return readMany(k => k.includes("_payments_v1") || k === "cursapp_payments_v1"); }
  function tasks(){ return readMany(k => k.includes("_tasks_v1") || k === "cursapp_tasks_v1"); }
  function expenses(){ return readMany(k => k.includes("_expenses_v1") || k === "cursapp_expenses_v1"); }
  function reports(){ return readMany(k => k.includes("_monthly_reports_v1") || k === "cursapp_monthly_reports_v1"); }
  function receipts(){ return readMany(k => k.includes("_receipts_v1") || k === "cursapp_receipts_v1"); }
  function profiles(){ return load("cursapp_profiles_v1", []); }
  function users(){ return load("cursapp_users_v1", []); }
  function enrollments(){ return load("cursapp_enrollments_v1", []); }

  function courseKeyOf(x){
    return String(x.courseKey || x.__key || "global")
      .replace(/^cursapp_/, "")
      .replace(/_(payments|tasks|expenses|monthly_reports|receipts)_v1$/,"");
  }

  function profileCourse(p){
    return p.course || {};
  }

  function courseLabelFromProfile(p){
    const c = profileCourse(p);
    return [c.schoolName || c.colegio || "Colegio", `${c.level||""}${c.letter||""} ${c.year||""}`.trim(), c.jornada || ""].filter(Boolean).join(" · ");
  }

  function courseFromPayment(p){
    const ck = courseKeyOf(p);
    const ps = profiles();
    const byKey = ps.find(x=>String(x.courseKey||"")===String(ck));
    return byKey ? byKey.course : { courseKey: ck, schoolName: ck, regionName:"Sin región", comunaName:"" };
  }

  function getRegionName(x){
    const c = x.course || x;
    return c.regionName || c.region || c.regionNombre || c.regionId || "Sin región";
  }
  function getSchoolName(x){
    const c = x.course || x;
    return c.schoolName || c.colegio || c.school || c.schoolId || "Sin colegio";
  }
  function getCourseName(x){
    const c = x.course || x;
    const label = `${c.level||""}${c.letter||""} ${c.year||""}`.trim();
    return label || c.courseName || c.curso || c.courseKey || "Sin curso";
  }
  function getJornada(x){
    const c = x.course || x;
    return c.jornada || "";
  }

  function getAllCourses(){
    const map = new Map();

    profiles().forEach(p=>{
      const ck = p.courseKey || "global";
      const c = p.course || {};
      if(!map.has(ck)){
        map.set(ck, {
          courseKey: ck,
          region: getRegionName(c),
          comuna: c.comunaName || c.comuna || c.comunaId || "",
          school: getSchoolName(c),
          course: getCourseName(c),
          jornada: getJornada(c),
          label: courseLabelFromProfile(p),
          miembros: 0,
          presidentes: 0,
          tesoreros: 0,
          apoderados: 0
        });
      }
      const row = map.get(ck);
      row.miembros++;
      if(p.role === "presidente") row.presidentes++;
      if(p.role === "tesorero") row.tesoreros++;
      if(p.role === "apoderado") row.apoderados++;
    });

    tasks().forEach(t=>{
      const ck = courseKeyOf(t);
      if(!map.has(ck)){
        map.set(ck, {courseKey: ck, region:"Sin región", comuna:"", school:ck, course:"—", jornada:"", label:ck, miembros:0, presidentes:0, tesoreros:0, apoderados:0});
      }
    });

    payments().forEach(p=>{
      const ck = courseKeyOf(p);
      if(!map.has(ck)){
        map.set(ck, {courseKey: ck, region:"Sin región", comuna:"", school:ck, course:"—", jornada:"", label:ck, miembros:0, presidentes:0, tesoreros:0, apoderados:0});
      }
    });

    return Array.from(map.values());
  }

  function seedAdminData(){
    if(!load(ADMIN_TICKETS, []).length){
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

  function paymentMethod(p){
    const raw = String([p.method,p.modalidad,p.channel,p.provider,p.gateway,p.ref,p.note,p.statusDetail,p.type].filter(Boolean).join(" ")).toLowerCase();
    if(/transbank|webpay|tbk|card|tarjeta|pasarela/.test(raw)) return "Transbank";
    if(/transfer|transferencia/.test(raw)) return "Transferencia";
    if(/efectivo|cash/.test(raw)) return "Efectivo";
    if(/manual|concili/.test(raw)) return "Conciliación";
    if(String(p.status||"").toLowerCase()==="paid" && !raw) return "Transbank/demo";
    return "No informado";
  }

  function paymentStatus(p){
    const s = String(p.status||"pending").toLowerCase();
    if(s === "paid") return "paid";
    if(["failed","rejected","rechazado","fallido","error"].includes(s)) return "failed";
    if(s === "opted_out") return "opted_out";
    return "pending";
  }

  function paymentStats(){
    const pays = payments();
    const successful = pays.filter(p=>paymentStatus(p)==="paid");
    const failed = pays.filter(p=>paymentStatus(p)==="failed");
    const pending = pays.filter(p=>paymentStatus(p)==="pending");
    const opted = pays.filter(p=>paymentStatus(p)==="opted_out");

    const methods = {};
    successful.forEach(p=>{
      const m = paymentMethod(p);
      methods[m] = methods[m] || {count:0, amount:0};
      methods[m].count++;
      methods[m].amount += Number(p.amount||p.monto||0);
    });

    const totalPaid = successful.reduce((a,b)=>a+Number(b.amount||b.monto||0),0);
    return {pays, successful, failed, pending, opted, methods, totalPaid};
  }

  function stats(){
    const ps = profiles();
    const us = users();
    const ens = enrollments();
    const pays = payments();
    const exps = expenses();
    const reps = reports();
    const ts = tasks();
    const courses = getAllCourses();

    const schools = new Set(courses.map(c=>c.school).filter(Boolean));
    const regions = groupCount(courses, c=>c.region || "Sin región");

    const alumnos = new Set([
      ...ps.map(p=>p.apoderado?.alumnoId || p.apoderado?.alumno).filter(Boolean),
      ...pays.map(p=>p.alumno || p.alumnoId).filter(Boolean),
      ...ens.map(e=>e.alumno || e.alumnoId).filter(Boolean)
    ]);

    const pstats = paymentStats();

    return {ps,us,ens,pays,exps,reps,ts,courses,schools,regions,alumnos,...pstats};
  }

  function groupCount(list, fn){
    const m = {};
    list.forEach(x=>{
      const k = fn(x) || "Sin dato";
      m[k] = (m[k]||0)+1;
    });
    return m;
  }

  function groupCoursesBySchool(){
    const courses = getAllCourses();
    const m = {};
    courses.forEach(c=>{
      const k = c.school || "Sin colegio";
      if(!m[k]) m[k] = {school:k, region:c.region || "Sin región", cursos:0, miembros:0, rows:[]};
      m[k].cursos++;
      m[k].miembros += c.miembros || 0;
      m[k].rows.push(c);
    });
    return Object.values(m).sort((a,b)=>b.cursos-a.cursos || String(a.school).localeCompare(String(b.school)));
  }

  function setTitle(title, sub){
    $("#viewTitle").textContent = title;
    $("#viewSub").textContent = sub || "";
  }

  function kpi(icon,label,value,delta){
    return `<div class="kpi"><div class="kpiIcon">${icon}</div><label>${label}</label><strong>${value}</strong><small>${delta||"Actualizado ahora"}</small></div>`;
  }

  function renderDashboard(){
    setTitle("Hola, Admin 👋", "Panel global de operación Cursapp");
    const s = stats();
    const tickets = load(ADMIN_TICKETS, []);
    const logs = load(ADMIN_LOGS, []);
    const openTickets = tickets.filter(t=>t.status!=="resuelto").length;
    const transbank = s.methods["Transbank"] || s.methods["Transbank/demo"] || {count:0, amount:0};
    const conciliacion = (s.methods["Conciliación"] || {count:0, amount:0});
    const transferencia = (s.methods["Transferencia"] || {count:0, amount:0});
    const manualTotal = {count: conciliacion.count + transferencia.count, amount: conciliacion.amount + transferencia.amount};

    app.innerHTML = `
      <div class="kpis">
        ${kpi("🏫","Colegios registrados",s.schools.size || "—","+ total app")}
        ${kpi("🎓","Cursos activos",s.courses.length || "—","+ cursos detectados")}
        ${kpi("👥","Apoderados / Alumnos",s.alumnos.size || s.ps.length || "—","+ comunidad")}
        ${kpi("💳","Pagos del mes",clp(s.totalPaid),`${s.successful.length} exitosos`)}
        ${kpi("🤝","Conciliación / Manual",manualTotal.count,clp(manualTotal.amount))}
        ${kpi("🎫","Tickets abiertos",openTickets,`${tickets.length} tickets totales`)}
      </div>

      <div class="gridMain adminGrid4">
        <section class="panel">
          <div class="panelHead"><h2>Cursos por región</h2><button onclick="Admin.go('colegios')">Detalle</button></div>
          <div class="list regionList">
            ${regionRows(s.regions)}
          </div>
        </section>

        <section class="panel">
          <div class="panelHead"><h2>Cursos por colegio</h2><button onclick="Admin.go('colegios')">Ver colegios</button></div>
          <div class="list">
            ${groupCoursesBySchool().slice(0,6).map(schoolRow).join("") || emptyRow("Sin colegios")}
          </div>
        </section>

        <section class="panel">
          <div class="panelHead"><h2>Tickets recientes</h2><button onclick="Admin.go('tickets')">Ver todos</button></div>
          <div class="list">
            ${tickets.slice(0,5).map(ticketRow).join("") || emptyRow("Sin tickets")}
          </div>
        </section>

        <section class="panel">
          <div class="panelHead"><h2>Pagos del mes</h2><button onclick="Admin.go('pagos')">Detalle</button></div>
          ${paymentDashboard(s)}
        </section>
      </div>

      <div class="tablesGrid">
        <section class="panel">
          <div class="panelHead"><h2>Últimos movimientos en la plataforma</h2><button onclick="Admin.go('logs')">Ver todos</button></div>
          ${logsTable(logs.slice(0,7))}
        </section>

        <section class="panel">
          <div class="panelHead"><h2>Acciones rápidas</h2></div>
          <div class="actionsGrid">
            <button class="quick" onclick="Admin.go('colegios')">🔍<strong>Buscar curso</strong><span>Por región, colegio o curso</span></button>
            <button class="quick" onclick="Admin.go('comunidad')">👤<strong>Buscar usuario</strong><span>Ver perfil completo</span></button>
            <button class="quick" onclick="Admin.go('tickets')">💬<strong>Resolver ticket</strong><span>Ir a soporte</span></button>
            <button class="quick" onclick="Admin.go('pagos')">💳<strong>Ver pagos</strong><span>Filtrar por colegio/curso</span></button>
            <button class="quick" onclick="Admin.go('logs')">📄<strong>Logs de actividad</strong><span>Ver registros</span></button>
            <button class="quick" onclick="Admin.go('auditoria')">🛡️<strong>Auditar cambios</strong><span>Ver bitácora</span></button>
          </div>
        </section>
      </div>
    `;
  }

  function regionRows(regions){
    const rows = Object.entries(regions).sort((a,b)=>b[1]-a[1]);
    if(!rows.length) return emptyRow("Sin regiones detectadas");
    const max = Math.max(...rows.map(x=>x[1]),1);
    return rows.map(([name,count])=>`
      <div class="regionRow">
        <div>
          <b>${esc(name)}</b>
          <p>${count} curso${count===1?"":"s"} registrado${count===1?"":"s"}</p>
        </div>
        <div class="miniBar"><span style="width:${Math.max(8,Math.round(count/max*100))}%"></span></div>
      </div>
    `).join("");
  }

  function schoolRow(x){
    return `<div class="row"><div class="rowIcon">🏫</div><div><b>${esc(x.school)}</b><p>${esc(x.region)} · ${x.cursos} curso${x.cursos===1?"":"s"} · ${x.miembros} miembros</p></div><span class="badge purple">${x.cursos}</span></div>`;
  }

  function ticketRow(t){
    const cls = t.status==="resuelto" ? "green" : (t.status==="revision" ? "orange" : "red");
    return `<div class="row"><div class="rowIcon">🎫</div><div><b>${esc(t.school)}</b><p>${esc(t.subject)} · ${esc(t.id)}</p></div><span class="badge ${cls}">${esc(t.status)}</span></div>`;
  }

  function emptyRow(text){ return `<div class="row"><div class="rowIcon">—</div><div><b>${text}</b><p>No hay información para mostrar.</p></div></div>`; }

  function paymentDashboard(s){
    const total = Math.max(1, s.pays.length);
    const pieces = [
      {label:"Exitosos", count:s.successful.length, color:"#22c55e", cls:"green"},
      {label:"Fallidos", count:s.failed.length, color:"#f43f5e", cls:"red"},
      {label:"Pendientes", count:s.pending.length, color:"#f59e0b", cls:"orange"},
      {label:"No participó", count:s.opted.length, color:"#94a3b8", cls:"gray"}
    ];

    let acc = 0;
    const stops = pieces.map(p=>{
      const from = acc;
      acc += (p.count / total) * 100;
      const to = acc;
      return `${p.color} ${from.toFixed(2)}% ${to.toFixed(2)}%`;
    }).join(", ");
    const bg = s.pays.length ? `conic-gradient(${stops})` : "conic-gradient(#e5e7eb 0 100%)";

    const methods = Object.entries(s.methods);
    const methodRows = methods.length ? methods.map(([name,v])=>`
      <div class="legendRow">
        <span class="dot" style="background:${name.includes("Transbank")?"#6d28d9":name.includes("Transfer")?"#2563eb":name.includes("Efectivo")?"#f59e0b":"#22c55e"}"></span>
        <span>${esc(name)}</span><b>${v.count}</b><small>${clp(v.amount)}</small>
      </div>
    `).join("") : `<div class="muted" style="font-weight:800">Sin pagos exitosos por modalidad.</div>`;

    return `
      <div class="paymentBox">
        <div class="donut" style="background:${bg};"><div class="donutText"><strong>${s.pays.length}</strong><span>Pagos totales</span></div></div>
        <div class="legend">
          ${pieces.map(p=>legend(p.color,p.label,p.count,pct(p.count,total))).join("")}
          <hr style="width:100%;border:0;border-top:1px solid rgba(16,24,40,.08)">
          <b>Modalidad de pagos exitosos</b>
          ${methodRows}
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

  function paymentFiltersHtml(){
    const courses = getAllCourses();
    const regions = [...new Set(courses.map(c=>c.region).filter(Boolean))].sort();
    const schools = [...new Set(courses.map(c=>c.school).filter(Boolean))].sort();
    const courseOptions = courses.slice().sort((a,b)=>String(a.label).localeCompare(String(b.label)));
    return `
      <div class="toolbar stickyToolbar">
        <input id="paySearch" placeholder="Buscar alumno, concepto, colegio..." oninput="Admin.filterPayments()">
        <select id="payRegion" onchange="Admin.filterPayments()"><option value="">Todas las regiones</option>${regions.map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join("")}</select>
        <select id="paySchool" onchange="Admin.filterPayments()"><option value="">Todos los colegios</option>${schools.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join("")}</select>
        <select id="payCourse" onchange="Admin.filterPayments()"><option value="">Todos los cursos</option>${courseOptions.map(c=>`<option value="${esc(c.courseKey)}">${esc(c.school)} · ${esc(c.course)} ${esc(c.jornada)}</option>`).join("")}</select>
        <select id="payStatus" onchange="Admin.filterPayments()"><option value="">Todos los estados</option><option value="paid">Pagados</option><option value="pending">Pendientes</option><option value="failed">Fallidos</option><option value="opted_out">No participó</option></select>
        <select id="payMethod" onchange="Admin.filterPayments()"><option value="">Todas las modalidades</option><option value="Transbank">Transbank</option><option value="Conciliación">Conciliación</option><option value="Transferencia">Transferencia</option><option value="Efectivo">Efectivo</option></select>
      </div>
    `;
  }

  function filteredPayments(){
    const q = ($("#paySearch")?.value||"").toLowerCase();
    const region = $("#payRegion")?.value || "";
    const school = $("#paySchool")?.value || "";
    const course = $("#payCourse")?.value || "";
    const status = $("#payStatus")?.value || "";
    const method = $("#payMethod")?.value || "";

    return payments().filter(p=>{
      const c = courseFromPayment(p);
      const ck = courseKeyOf(p);
      const m = paymentMethod(p);
      const st = paymentStatus(p);
      const blob = JSON.stringify(p).toLowerCase() + " " + JSON.stringify(c).toLowerCase() + " " + ck.toLowerCase();
      return (!q || blob.includes(q)) &&
        (!region || getRegionName(c)===region) &&
        (!school || getSchoolName(c)===school) &&
        (!course || ck===course) &&
        (!status || st===status) &&
        (!method || m===method || (method==="Transbank" && m==="Transbank/demo"));
    }).sort((a,b)=>String(b.createdAt||b.paidAt||"").localeCompare(String(a.createdAt||a.paidAt||"")));
  }

  function renderPagos(){
    setTitle("Panel de pagos", "Trazabilidad de pagos por colegio, curso, estado y modalidad");
    const s = stats();
    const rows = filteredPayments();
    app.innerHTML = `
      <div class="kpis">
        ${kpi("✅","Pagos efectuados",s.successful.length,clp(s.totalPaid))}
        ${kpi("⚠️","Pagos fallidos",s.failed.length,"revisar rechazos")}
        ${kpi("⏳","Pendientes",s.pending.length,"en curso")}
        ${kpi("🤝","Conciliación / manual",Object.values(s.methods).filter((_,i)=>true).reduce((a,b)=>a+(b.count||0),0),"modalidades")}
        ${kpi("💳","Total pagos",s.pays.length,"todos los estados")}
        ${kpi("📄","Comprobantes",receipts().length,"emitidos")}
      </div>
      ${paymentFiltersHtml()}
      <section class="panel" style="margin-top:16px">
        <div class="panelHead"><h2>Detalle de pagos</h2><span id="payCount" class="badge purple">${rows.length} resultados</span></div>
        <div id="paymentTable">${paymentsTable(rows)}</div>
      </section>`;
  }

  function paymentsTable(pays){
    const visible = pays.slice(0,200);
    return `<div class="tableWrap"><table><thead><tr><th>Región</th><th>Colegio</th><th>Curso</th><th>Alumno</th><th>Concepto</th><th>Monto</th><th>Estado</th><th>Modalidad</th></tr></thead><tbody>
      ${visible.map(p=>{
        const c = courseFromPayment(p);
        return `<tr><td>${esc(getRegionName(c))}</td><td>${esc(getSchoolName(c))}</td><td>${esc(getCourseName(c))} ${esc(getJornada(c))}</td><td>${esc(p.alumno||"—")}</td><td>${esc(p.concept||p.title||"Pago")}</td><td>${clp(p.amount||p.monto)}</td><td>${statusBadge(paymentStatus(p))}</td><td>${esc(paymentMethod(p))}</td></tr>`;
      }).join("") || `<tr><td colspan="8">Sin pagos para los filtros aplicados.</td></tr>`}
      ${pays.length>200 ? `<tr><td colspan="8"><b>Mostrando 200 de ${pays.length} resultados.</b> Usa filtros por colegio/curso para acotar la búsqueda.</td></tr>` : ``}
    </tbody></table></div>`;
  }

  function statusBadge(st){
    const s = String(st||"pending").toLowerCase();
    const cls = s==="paid" ? "green" : (s==="failed" ? "red" : (s==="opted_out" ? "gray" : "orange"));
    return `<span class="badge ${cls}">${esc(s)}</span>`;
  }

  function renderColegios(){
    setTitle("Colegios y cursos", "Cursos registrados por región, colegio y jornada");
    const courses = getAllCourses();
    const schoolRows = groupCoursesBySchool();
    const regions = [...new Set(courses.map(c=>c.region).filter(Boolean))].sort();

    app.innerHTML = `
      <div class="toolbar stickyToolbar">
        <input id="courseSearch" placeholder="Buscar colegio, curso, comuna..." oninput="Admin.filterCourses()">
        <select id="courseRegion" onchange="Admin.filterCourses()"><option value="">Todas las regiones</option>${regions.map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join("")}</select>
      </div>

      <div class="tablesGrid">
        <section class="panel">
          <div class="panelHead"><h2>Cursos por colegio</h2><span class="badge purple">${schoolRows.length} colegios</span></div>
          <div id="schoolTable">${schoolsTable(schoolRows)}</div>
        </section>
        <section class="panel">
          <div class="panelHead"><h2>Cursos por región</h2><span class="badge purple">${courses.length} cursos</span></div>
          <div class="list">${regionRows(groupCount(courses, c=>c.region || "Sin región"))}</div>
        </section>
      </div>

      <section class="panel" style="margin-top:18px">
        <div class="panelHead"><h2>Detalle de cursos registrados</h2><span id="courseCount" class="badge purple">${courses.length} cursos</span></div>
        <div id="courseTable">${coursesTable(courses)}</div>
      </section>`;
  }

  function schoolsTable(rows){
    return `<div class="tableWrap"><table><thead><tr><th>Colegio</th><th>Región</th><th>Cursos</th><th>Miembros</th><th>Acción</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.school)}</td><td>${esc(r.region)}</td><td><span class="badge purple">${r.cursos}</span></td><td>${r.miembros}</td><td><button class="adminBtn ghost" onclick="Admin.setCourseSearch('${esc(r.school)}')">Ver cursos</button></td></tr>`).join("") || `<tr><td colspan="5">Sin colegios.</td></tr>`}</tbody></table></div>`;
  }

  function coursesTable(rows){
    return `<div class="tableWrap"><table><thead><tr><th>Región</th><th>Comuna</th><th>Colegio</th><th>Curso</th><th>Jornada</th><th>Miembros</th><th>Presidentes</th><th>Apoderados</th><th>Acción</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.region)}</td><td>${esc(r.comuna)}</td><td>${esc(r.school)}</td><td>${esc(r.course)}</td><td>${esc(r.jornada)}</td><td>${r.miembros}</td><td>${r.presidentes}</td><td>${r.apoderados}</td><td><button class="adminBtn ghost" onclick="Admin.inspectCourse('${esc(r.courseKey)}')">Ver</button></td></tr>`).join("") || `<tr><td colspan="9">Sin cursos.</td></tr>`}</tbody></table></div>`;
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
      return {name,email,role:p.role, alumno:p.apoderado?.alumno||"—", course:courseLabelFromProfile(p), region:getRegionName(p.course||{}), profileId:p.profileId};
    }) : us.map(u=>({name:u.email,email:u.email,role:"usuario",alumno:"—",course:"—",region:"—",profileId:u.userId}));
    return `<div class="tableWrap"><table><thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Alumno</th><th>Región</th><th>Curso</th><th>Acciones</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(r.email)}</td><td><span class="badge purple">${esc(r.role)}</span></td><td>${esc(r.alumno)}</td><td>${esc(r.region)}</td><td>${esc(r.course)}</td><td><button class="adminBtn ghost" onclick="Admin.openMember('${esc(r.profileId)}')">Administrar</button></td></tr>`).join("") || `<tr><td colspan="7">Sin miembros.</td></tr>`}</tbody></table></div>`;
  }

  function renderAuditoria(){
    setTitle("Auditoría", "Control de cambios sensibles y acciones administrativas");
    const logs = load(ADMIN_LOGS, []).filter(l=>String(l.type||"").includes("admin") || String(l.type||"").includes("audit") || String(l.type||"").includes("member"));
    app.innerHTML = `<section class="panel"><div class="panelHead"><h2>Acciones sensibles</h2><button onclick="Admin.addAuditDemo()">Registrar acción demo</button></div>${logsTable(logs)}</section>`;
  }

  function openModal(html){ modal.innerHTML = `<div class="modalBg"><div class="modalCard">${html}</div></div>`; }
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
    filterPayments(){
      const rows = filteredPayments();
      $("#paymentTable").innerHTML = paymentsTable(rows);
      $("#payCount").textContent = `${rows.length} resultados`;
    },
    setCourseSearch(school){
      Admin.go("colegios");
      setTimeout(()=>{
        const input = $("#courseSearch");
        if(input){ input.value = school; Admin.filterCourses(); }
      },0);
    },
    filterCourses(){
      const q = ($("#courseSearch")?.value||"").toLowerCase();
      const region = $("#courseRegion")?.value || "";
      const rows = getAllCourses().filter(c=>{
        const blob = JSON.stringify(c).toLowerCase();
        return (!q || blob.includes(q)) && (!region || c.region===region);
      });
      $("#courseTable").innerHTML = coursesTable(rows);
      $("#courseCount").textContent = `${rows.length} cursos`;
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
    inspectCourse(courseKey){
      const ps = profiles().filter(p=>p.courseKey===courseKey);
      openModal(`<h2>Curso ${esc(courseKey)}</h2><p class="muted">${ps.length} miembros detectados.</p>${communityTable(ps, [])}<div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="adminBtn ghost" onclick="Admin.closeModal()">Cerrar</button></div>`);
      log("admin_action","Inspeccionó curso",courseKey);
    },
    addAuditDemo(){ log("admin_audit","Revisión manual de auditoría","Admin Console",{reason:"Control preventivo"}); renderAuditoria(); },
    closeModal
  };

  document.addEventListener("DOMContentLoaded", ()=>{
    const s = load(SESSION_KEY, null);
    if(!s || s.role !== "admin" || !s.isAdmin){
      location.href = "/index.html";
      return;
    }
    seedAdminData();
    log("login_admin","Ingreso a panel administrador","Admin Console");
    $("#mobileMenu")?.addEventListener("click", ()=>document.body.classList.toggle("sideOpen"));
    $$(".sideItem").forEach(b=>b.addEventListener("click", ()=>Admin.go(b.dataset.tab)));
    Admin.go("dashboard");
  });
})();
