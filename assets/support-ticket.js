
(function(){
  const KEY_TICKETS = "cursapp_admin_tickets_v1";
  const KEY_LOGS = "cursapp_admin_logs_v1";
  const KEY_SESSION = "cursapp_session_v1";

  function load(k, def){
    try{ const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); }catch(e){ return def; }
  }
  function save(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
  function esc(s){
    return String(s ?? "").replace(/[&<>'"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  }
  function now(){ return new Date().toISOString(); }
  function uid(){ return "TK-" + Math.floor(100000 + Math.random()*900000); }
  function normEmail(e){ return String(e||"").trim().toLowerCase(); }

  function getSession(){
    return load(KEY_SESSION, {}) || {};
  }

  function getActiveProfile(){
    const s = getSession();
    const email = normEmail(s.email || s.userId);
    const role = String(s.currentRole || s.role || "").toLowerCase();
    const ck = localStorage.getItem("cursapp_active_course_v1") || s.courseKey || "";
    const ps = load("cursapp_profiles_v1", []);
    return ps.find(p =>
      String(p.courseKey||"") === String(ck) &&
      (
        normEmail(p.userId) === email ||
        normEmail(p.apoderado?.email) === email
      ) &&
      (!role || String(p.role||"").toLowerCase() === role || role === "tesorero")
    ) || ps.find(p => String(p.courseKey||"") === String(ck) && (normEmail(p.userId)===email || normEmail(p.apoderado?.email)===email)) || null;
  }

  function getRequesterName(profile, session){
    const name = profile?.directiva?.name || profile?.apoderado?.name || session.name || session.userId || "Usuario";
    return String(name || "Usuario");
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
    return ({
      acceso_login:"Acceso / login",
      pago_transaccion:"Pago o transacción no contabilizada",
      menu_visual:"Problema visual / menú",
      campanas:"Campañas / cobros",
      rendiciones:"Rendiciones / boletas",
      informes:"Informes",
      datos:"Corrección de datos",
      otro:"Otro"
    })[v] || v;
  }

  function priorityLabel(v){
    return ({critica:"Crítica", alta:"Alta", media:"Media", baja:"Baja"})[v] || v;
  }

  function log(type, action, target, extra){
    const logs = load(KEY_LOGS, []);
    logs.unshift(Object.assign({
      at: now(),
      user: getCourseMeta().requesterEmail || "directiva",
      type,
      action,
      target,
      ip: "local"
    }, extra || {}));
    save(KEY_LOGS, logs.slice(0,500));
  }

  function openModal(){
    const meta = getCourseMeta();
    const root = document.createElement("div");
    root.className = "supportOverlay";
    root.id = "supportTicketOverlay";

    root.innerHTML = `
      <div class="supportCard" role="dialog" aria-modal="true">
        <div class="supportHead">
          <div>
            <h2>Levantar ticket a soporte</h2>
            <p>Describe el problema para que el equipo Cursapp pueda responder con trazabilidad y SLA.</p>
          </div>
          <button class="supportClose" type="button" data-close>✕</button>
        </div>

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
          <button class="supportBtn" type="button" data-close>Cancelar</button>
          <button class="supportBtn primary" type="button" id="stSubmit">Enviar ticket</button>
        </div>
      </div>
    `;

    root.addEventListener("click", (e)=>{
      if(e.target === root || e.target.matches("[data-close]")) root.remove();
    });
    document.body.appendChild(root);

    document.getElementById("stSubmit").onclick = () => {
      const category = document.getElementById("stCategory").value;
      const priority = document.getElementById("stPriority").value;
      const subject = document.getElementById("stSubject").value.trim();
      const detail = document.getElementById("stDetail").value.trim();

      if(!subject || !detail){
        alert("Completa asunto y detalle del ticket.");
        return;
      }

      const hours = slaHours(priority, category);
      const createdAt = now();
      const slaDueAt = new Date(Date.now() + hours*3600*1000).toISOString();
      const ticket = {
        id: uid(),
        status: "abierto",
        priority,
        priorityLabel: priorityLabel(priority),
        category,
        categoryLabel: categoryLabel(category),
        slaHours: hours,
        slaDueAt,
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
        messages: [
          {at: createdAt, from: meta.requesterName, role: meta.role, body: detail}
        ],
        history: [
          {at: createdAt, event: "ticket_created", by: meta.requesterEmail || meta.requesterName}
        ]
      };

      const list = load(KEY_TICKETS, []);
      list.unshift(ticket);
      save(KEY_TICKETS, list);
      log("support_ticket_created", "Directiva levantó ticket", ticket.id, {school: meta.school, course: meta.course, priority, category});
      root.remove();
      alert(`Ticket enviado ✅\\n\\nFolio: ${ticket.id}\\nSLA respuesta: ${hours} horas`);
    };
  }

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
    btn.onclick = openModal;
    document.body.appendChild(btn);

    // también dejar acción en menú si existe
    const menu = document.getElementById("menuDropdown");
    if(menu && !document.getElementById("supportMenuItem")){
      const item = document.createElement("button");
      item.id = "supportMenuItem";
      item.className = "btn ghost";
      item.type = "button";
      item.style.cssText = "width:100%;margin-top:8px;text-align:left;";
      item.textContent = "💬 Levantar ticket soporte";
      item.onclick = openModal;
      menu.appendChild(item);
    }
  }

  document.addEventListener("DOMContentLoaded", mount);
  setTimeout(mount, 800);
})();
