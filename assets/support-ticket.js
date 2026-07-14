
(function(){
  const KEY_TICKETS = "cursapp_admin_tickets_v1";
  const KEY_LOGS = "cursapp_admin_logs_v1";
  const KEY_SESSION = "cursapp_session_v1";

  function load(k, def){
    try{ const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); }catch(e){ return def; }
  }
  function save(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
  function esc(s){ return String(s ?? "").replace(/[&<>'"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
  function now(){ return new Date().toISOString(); }
  function uid(){ return "TK-" + Math.floor(100000 + Math.random()*900000); }
  function normEmail(e){ return String(e||"").trim().toLowerCase(); }
  function fmtDate(x){ try{return new Date(x).toLocaleString("es-CL",{dateStyle:"short",timeStyle:"short"});}catch(e){return x||"—";} }

  function getSession(){ return load(KEY_SESSION, {}) || {}; }

  function getActiveProfile(){
    const s = getSession();
    const email = normEmail(s.email || s.userId);
    const role = String(s.currentRole || s.role || "").toLowerCase();
    const ck = localStorage.getItem("cursapp_active_course_v1") || s.courseKey || "";
    const ps = load("cursapp_profiles_v1", []);
    return ps.find(p =>
      String(p.courseKey||"") === String(ck) &&
      (normEmail(p.userId) === email || normEmail(p.apoderado?.email) === email) &&
      (!role || String(p.role||"").toLowerCase() === role || role === "tesorero")
    ) || ps.find(p => String(p.courseKey||"") === String(ck) && (normEmail(p.userId)===email || normEmail(p.apoderado?.email)===email)) || null;
  }

  function getRequesterName(profile, session){
    return String(profile?.directiva?.name || profile?.apoderado?.name || session.name || session.userId || "Usuario");
  }

  function getCourseMeta(){
    const s = getSession();
    const p = getActiveProfile();
    const c = p?.course || {};
    const role = String(s.currentRole || s.role || p?.role || "").toLowerCase();
    return {
      role,
      requesterName: getRequesterName(p, s),
      requesterEmail: s.email || s.userId || p?.userId || p?.apoderado?.email || "",
      courseKey: s.courseKey || p?.courseKey || localStorage.getItem("cursapp_active_course_v1") || "",
      region: c.regionName || c.region || c.regionId || "Sin región",
      comuna: c.comunaName || c.comuna || c.comunaId || "",
      school: c.schoolName || c.colegio || c.schoolId || "Colegio no informado",
      course: [String(c.level||"") + String(c.letter||""), c.year, c.jornada].filter(Boolean).join(" · ") || "Curso no informado"
    };
  }

  function slaHours(priority, category){
    if(category === "pago_transaccion") return 4;
    if(category === "acceso_login") return priority === "critica" ? 2 : 8;
    if(priority === "critica") return 2;
    if(priority === "alta") return 8;
    if(priority === "media") return 24;
    return 48;
  }
  function categoryLabel(v){
    return ({acceso_login:"Acceso / login",pago_transaccion:"Pago o transacción no contabilizada",menu_visual:"Problema visual / menú",campanas:"Campañas / cobros",rendiciones:"Rendiciones / boletas",informes:"Informes",datos:"Corrección de datos",otro:"Otro"})[v] || v;
  }
  function priorityLabel(v){ return ({critica:"Crítica",alta:"Alta",media:"Media",baja:"Baja"})[v] || v; }

  function slaState(t){
    if(t.status === "resuelto") return {label:"Resuelto", cls:"green"};
    if(!t.slaDueAt) return {label:"Sin SLA", cls:"gray"};
    const ms = new Date(t.slaDueAt).getTime() - Date.now();
    if(ms < 0) return {label:"SLA vencido", cls:"red"};
    const h = Math.ceil(ms/3600000);
    return {label:`SLA ${h}h`, cls:h<=2?"orange":"green"};
  }

  function log(type, action, target, extra){
    const logs = load(KEY_LOGS, []);
    logs.unshift(Object.assign({at:now(), user:getCourseMeta().requesterEmail || "directiva", type, action, target, ip:"local"}, extra||{}));
    save(KEY_LOGS, logs.slice(0,500));
  }

  function myTickets(){
    const meta = getCourseMeta();
    const email = normEmail(meta.requesterEmail);
    const ck = String(meta.courseKey||"");
    return load(KEY_TICKETS, []).filter(t=>{
      const sameEmail = email && normEmail(t.requesterEmail || t.requester) === email;
      const sameCourse = ck && String(t.courseKey||"") === ck && String(t.sourceRole||"") === String(meta.role||"");
      return sameEmail || sameCourse;
    });
  }

  
  function ticketCard(t){
    const sla = slaState(t);
    const msgs = t.messages || [];
    const hasAdminReply = msgs.some(m=>String(m.role||"").toLowerCase()==="admin");
    const waitingReply = !hasAdminReply && t.status !== "resuelto";

    return `
      <div class="supportTicketItem ${hasAdminReply ? "hasReply" : ""}">
        <div class="supportTicketTop">
          <div>
            <b>${esc(t.id)} · ${esc(t.subject || "Sin asunto")}</b>
            <span>${esc(categoryLabel(t.category))} · ${esc(priorityLabel(t.priority))} · ${fmtDate(t.createdAt)}</span>
          </div>
          <em class="${sla.cls}">${esc(sla.label)}</em>
        </div>

        <div class="supportTicketBadges">
          ${hasAdminReply ? `<span class="reply">💬 Nueva respuesta</span>` : ""}
          ${waitingReply ? `<span class="pending">⏳ Esperando respuesta</span>` : ""}
          ${t.status === "resuelto" ? `<span class="done">✅ Resuelto</span>` : ""}
        </div>

        <p>${esc(t.detail || "")}</p>

        <button class="supportConversationBtn" onclick="this.nextElementSibling.classList.toggle('open')">
          Ver conversación (${msgs.length})
        </button>

        <div class="supportConversation">
          ${msgs.map(m=>`
            <div class="supportBubble ${String(m.role||"").toLowerCase()==="admin" ? "admin" : "user"}">
              <div class="supportBubbleHead">
                <b>${esc(m.from || "Usuario")}</b>
                <small>${fmtDate(m.at)}</small>
              </div>
              <div class="supportBubbleText">${esc(m.body || "")}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function renderMyTickets(){
    const rows = myTickets();
    return `
      <div class="supportTicketList">
        ${rows.length ? rows.map(ticketCard).join("") : `<div class="supportEmpty">Aún no tienes tickets levantados en este perfil.</div>`}
      </div>
    `;
  }

  function newTicketHtml(meta){
    return `
      <div class="supportMeta">
        <b>Contexto detectado:</b><br>
        ${esc(meta.school)} · ${esc(meta.course)}<br>
        ${esc(meta.region)} ${meta.comuna ? "· " + esc(meta.comuna) : ""}<br>
        Solicitante: ${esc(meta.requesterName)} · ${esc(meta.role || "directiva")}
      </div>

      <div class="supportGrid">
        <div class="supportField">
          <label>Motivo / categoría</label>
          <select id="stCategory">
            <option value="acceso_login">Acceso / login</option>
            <option value="pago_transaccion">Pago o transacción no contabilizada</option>
            <option value="menu_visual">Problema visual / menú</option>
            <option value="campanas">Campañas / cobros</option>
            <option value="rendiciones">Rendiciones / boletas</option>
            <option value="informes">Informes</option>
            <option value="datos">Corrección de datos</option>
            <option value="otro">Otro</option>
          </select>
        </div>

        <div class="supportField">
          <label>Criticidad</label>
          <select id="stPriority">
            <option value="media">Media · respuesta 24h</option>
            <option value="alta">Alta · respuesta 8h</option>
            <option value="critica">Crítica · respuesta 2h</option>
            <option value="baja">Baja · respuesta 48h</option>
          </select>
        </div>

        <div class="supportField supportWide">
          <label>Asunto</label>
          <input id="stSubject" placeholder="Ej: Pago no aparece como contabilizado" />
        </div>

        <div class="supportField supportWide">
          <label>Detalle</label>
          <textarea id="stDetail" placeholder="Cuéntanos qué ocurrió, a qué apoderado/alumno afecta, fecha del pago o pantalla donde ocurre..."></textarea>
        </div>
      </div>

      <div class="supportActions">
        <button class="supportBtn primary" type="button" id="stSubmit">Enviar ticket</button>
      </div>
    `;
  }

  function bindSubmit(root){
    const btn = root.querySelector("#stSubmit");
    if(!btn) return;
    btn.onclick = () => {
      const meta = getCourseMeta();
      const category = root.querySelector("#stCategory").value;
      const priority = root.querySelector("#stPriority").value;
      const subject = root.querySelector("#stSubject").value.trim();
      const detail = root.querySelector("#stDetail").value.trim();

      if(!subject || !detail){
        alert("Completa asunto y detalle del ticket.");
        return;
      }

      const hours = slaHours(priority, category);
      const createdAt = now();
      const ticket = {
        id: uid(),
        status: "abierto",
        priority,
        priorityLabel: priorityLabel(priority),
        category,
        categoryLabel: categoryLabel(category),
        slaHours: hours,
        slaDueAt: new Date(Date.now() + hours*3600*1000).toISOString(),
        createdAt,
        updatedAt: createdAt,
        source: "directiva",
        sourceRole: meta.role,
        requesterName: meta.requesterName,
        requesterEmail: meta.requesterEmail,
        school: meta.school,
        course: meta.course,
        courseKey: meta.courseKey,
        region: meta.region,
        comuna: meta.comuna,
        subject,
        detail,
        messages: [{at: createdAt, from: meta.requesterName, role: meta.role, body: detail}],
        history: [{at: createdAt, event: "ticket_created", by: meta.requesterEmail || meta.requesterName}]
      };

      const list = load(KEY_TICKETS, []);
      list.unshift(ticket);
      save(KEY_TICKETS, list);
      log("support_ticket_created", "Directiva levantó ticket", ticket.id, {school: meta.school, course: meta.course, priority, category});
      alert(`Ticket enviado ✅\\n\\nFolio: ${ticket.id}\\nSLA respuesta: ${hours} horas`);
      openModal("mine");
    };
  }

  function openModal(tab){
    document.getElementById("supportTicketOverlay")?.remove();
    const meta = getCourseMeta();
    const root = document.createElement("div");
    root.className = "supportOverlay";
    root.id = "supportTicketOverlay";
    const active = tab || "new";
    root.innerHTML = `
      <div class="supportCard supportCardTabs" role="dialog" aria-modal="true">
        <div class="supportHead">
          <div>
            <h2>Soporte Cursapp</h2>
            <p>Levanta un ticket o revisa respuestas del equipo Cursapp.</p>
          </div>
          <button class="supportClose" type="button" data-close>✕</button>
        </div>

        <div class="supportTabs">
          <button class="${active==="new"?"active":""}" data-tab="new">Nuevo ticket</button>
          <button class="${active==="mine"?"active":""}" data-tab="mine">Mis tickets <span>${myTickets().length}</span></button>
        </div>

        <div id="supportTabBody">
          ${active==="mine" ? renderMyTickets() : newTicketHtml(meta)}
        </div>

        <div class="supportActions">
          <button class="supportBtn" type="button" data-close>Cerrar</button>
        </div>
      </div>
    `;

    root.addEventListener("click", (e)=>{
      if(e.target === root || e.target.matches("[data-close]")) root.remove();
      if(e.target.matches("[data-tab]")){
        const next = e.target.getAttribute("data-tab");
        root.remove();
        openModal(next);
      }
    });
    document.body.appendChild(root);
    if(active === "new") bindSubmit(root);
  }

  window.CURSAPP_SUPPORT = Object.assign(window.CURSAPP_SUPPORT || {}, {
    open: (tab) => openModal(tab || "new"),
    openNewTicket: () => openModal("new"),
    openMyTickets: () => openModal("mine")
  });

  function mount(){
    const s = getSession();
    const role = String(s.currentRole || s.role || "").toLowerCase();
    if(!["presidente","tesorero"].includes(role)) return;

    if(document.getElementById("supportFab")) return;
    const btn = document.createElement("button");
    btn.id = "supportFab";
    btn.className = "supportFab";
    btn.type = "button";
    btn.innerHTML = "💬 <span>Soporte</span>";
    btn.onclick = () => openModal("new");
    document.body.appendChild(btn);

    const menu = document.getElementById("menuDropdown");
    if(menu && !document.getElementById("supportMenuItem")){
      const item = document.createElement("button");
      item.id = "supportMenuItem";
      item.className = "btn ghost";
      item.type = "button";
      item.style.cssText = "width:100%;margin-top:8px;text-align:left;";
      item.textContent = "💬 Soporte / Mis tickets";
      item.onclick = () => openModal("mine");
      menu.appendChild(item);
    }
  }

  document.addEventListener("DOMContentLoaded", mount);
  setTimeout(mount, 800);
})();
