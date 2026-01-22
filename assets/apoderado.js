(function(){
  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modalRoot");

  const navItems = Array.from(document.querySelectorAll(".navItem"));
  const menuBtn = document.getElementById("menuBtn");
  const menuDropdown = document.getElementById("menuDropdown");
  const goOnboarding = document.getElementById("goOnboarding");
  const logoutBtn = document.getElementById("logoutBtn");
  const whoCourseLine = document.getElementById("whoCourseLine");

  // Storage keys (alineadas con tu ecosistema)
  const KEY_TASKS = "cursapp_tasks_v1";
  const KEY_PAYMENTS = "cursapp_payments_v1";
  const KEY_REPORTS = "cursapp_monthly_reports_v1";
  const KEY_PROFILES = "cursapp_profiles_v1";
  const KEY_ACTIVE_COURSE = "cursapp_active_course_v1";

  const load = (k, def)=>{ try{ return JSON.parse(localStorage.getItem(k) || JSON.stringify(def)); }catch{ return def; } };
  const save = (k, v)=> localStorage.setItem(k, JSON.stringify(v));
  const esc = (s)=> String(s??"").replace(/[&<>'"]/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[c]));
  const clp = (n)=> "$"+Number(n||0).toLocaleString("es-CL");

  function todayISO(){
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  function daysTo(iso){
    if(!iso) return null;
    const d = new Date(iso+"T23:59:59");
    const now = new Date();
    return Math.ceil((d.getTime()-now.getTime())/(1000*60*60*24));
  }

  // ---- Demo seed (si no hay data) ----
  function ensureDemo(){
    if(load(KEY_TASKS,[]).length && load(KEY_PAYMENTS,[]).length) return;

    save(KEY_TASKS,[
      {id:"t1", title:"Rifa del curso", startDate:"2026-01-10", dueDate:"2026-01-31", closed:false, mandatoryParticipation:true, type:"single", amount:10000},
      {id:"t2", title:"Paseo de curso", startDate:todayISO(), dueDate:"2026-04-10", closed:false, mandatoryParticipation:false, type:"monthly", amount:20000},
    ]);

    save(KEY_PAYMENTS,[
      {id:"p1", fromTaskId:"t1", concept:"Rifa del curso", amount:10000, status:"pending", dueDate:"2026-01-31"},
      {id:"p2", fromTaskId:"t2", concept:"Paseo de curso", amount:20000, status:"pending", dueDate:"2026-02-10"},
      {id:"p3", fromTaskId:"t2", concept:"Paseo de curso", amount:20000, status:"paid", dueDate:"2026-03-10"},
      // ejemplo de saldo a favor
      {id:"p4", fromTaskId:"t1", concept:"Rifa del curso", amount:10000, status:"credit", creditFromTaskId:"t1", note:"Saldo a favor por campaña eliminada"}
    ]);

    save(KEY_REPORTS,[]);
  }

  // ---- Profiles / activation gate ----
  function getActiveProfile(){
    const profiles = load(KEY_PROFILES, []);
    if(!profiles.length) return null;
    const key = localStorage.getItem(KEY_ACTIVE_COURSE) || "";
    return profiles.find(p=>p.courseKey===key) || profiles[0];
  }

  function activationGate(){
    const p = getActiveProfile();
    if(!p) return false;
    if(p.user?.role !== "apoderado") return false;
    if(p.activation?.required && p.activation.status !== "paid"){
      openModal(`
        <div class="card">
          <div class="kTitle">Activación pendiente</div>
          <div class="muted" style="margin-top:6px;">
            Para operar en este curso debes completar la activación de <b>$990</b>.
            <br><span style="font-weight:900">Este monto es del sistema, no del curso.</span>
          </div>
          <div class="actions" style="margin-top:14px;justify-content:flex-end;">
            <button class="btnx" onclick="location.href='login.html'">Cerrar sesión</button>
            <button class="btnx primary" onclick="payActivation()">Pagar $990</button>
          </div>
        </div>
      `);
      return true;
    }
    return false;
  }

  window.payActivation = function(){
    const profiles = load(KEY_PROFILES, []);
    const active = localStorage.getItem(KEY_ACTIVE_COURSE) || "";
    const i = profiles.findIndex(p=>p.courseKey===active);
    if(i>=0){
      profiles[i].activation.status="paid";
      profiles[i].activation.paidAt=new Date().toISOString();
      save(KEY_PROFILES, profiles);
    }
    closeModal();
    renderHome();
  };

  // ---- modal ----
  function openModal(html){
    modalRoot.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:10000;display:flex;align-items:flex-end;justify-content:center;padding:14px;">
        <div style="width:min(820px,100%);margin-bottom:12px;">${html}</div>
      </div>
    `;
  }
  function closeModal(){ modalRoot.innerHTML=""; }
  window.closeModal = closeModal;

  // ---- header ----
  function setHeaderCourse(){
    const prof = getActiveProfile();
    if(prof?.course){
      whoCourseLine.textContent = `${prof.course.schoolName} · ${prof.course.level}${prof.course.letter} ${prof.course.year} · ${prof.course.jornada}`;
    }
  }

  // ---- report banner + report list ----
  function latestReport(){
    const reps = load(KEY_REPORTS, []);
    return reps.length ? reps[0] : null;
  }

  function reportBanner(){
    const r = latestReport();
    if(!r) return "";
    return `
      <div class="banner">
        <div style="font-weight:950;">📄 Informe disponible · ${esc(r.period || "Mes")}</div>
        <div class="muted" style="margin-top:6px;">
          Publicado por la directiva. Montos generales del curso (no personales).
        </div>
        <div class="actions" style="margin-top:10px;justify-content:flex-end;">
          <button class="btnx primary" onclick="openReport('${esc(r.period||"")}')">Ver informe</button>
        </div>
      </div>
    `;
  }

  window.openReport = function(period){
    const reps = load(KEY_REPORTS, []);
    const r = reps.find(x=>String(x.period||"")===String(period||"")) || reps[0];
    if(!r) return;

    openModal(`
      <div class="card">
        <div class="row">
          <div>
            <div class="kTitle">Informe del curso</div>
            <div class="muted" style="margin-top:6px;">
              Publicado por la directiva · Montos del curso (no personales)
            </div>
          </div>
          <button class="btnx" onclick="closeModal()">Cerrar</button>
        </div>

        <div class="listLines" style="margin-top:12px;">
          <div class="lineItem"><b>Periodo:</b> ${esc(r.period||"")}</div>
          <div class="lineItem"><b>Recaudado:</b> ${clp(r.recaudadoCurso||0)}</div>
          <div class="lineItem"><b>Gastado:</b> ${clp(r.gastadoCurso||0)}</div>
          <div class="lineItem"><b>Saldo:</b> ${clp(r.disponibleCurso||0)}</div>
          <div class="lineItem"><b>Emitido:</b> ${esc(r.generatedAt||"")}</div>
        </div>
      </div>
    `);
  };

  // ---- Home ----
  function activeTasks(){
    const ts = load(KEY_TASKS, []);
    return ts.filter(t=>!t.closed).slice(0,3);
  }

  function renderHome(){
    setHeaderCourse();
    if(activationGate()) return;

    const tasks = activeTasks();
    const notices = tasks.length ? `
      <div class="card">
        <div class="kTitle">📣 Avisos de campañas activas</div>
        <div class="muted" style="margin-top:6px;">Solo informativo</div>
        <div class="listLines" style="margin-top:10px;">
          ${tasks.map(t=>`<div class="lineItem">${esc(t.title)}</div>`).join("")}
        </div>
      </div>
    ` : "";

    const pays = load(KEY_PAYMENTS, []);
    const pending = pays.filter(p=>p.status==="pending");
    const paid = pays.filter(p=>p.status==="paid");
    const upcoming = pending.filter(p=>{
      const d = daysTo(p.dueDate);
      return d!=null && d>=1 && d<=3;
    });

    app.innerHTML = `
      ${reportBanner()}
      ${notices}

      <div class="grid2">
        <div class="card" style="cursor:pointer" onclick="go('payments','pending')">
          <div class="kTitle">⏳ Mis cuotas pendientes</div>
          <div class="muted" style="margin-top:6px;">${pending.length} cuotas</div>
        </div>

        <div class="card" style="cursor:pointer" onclick="go('payments','paid')">
          <div class="kTitle">✅ Historial de pagos</div>
          <div class="muted" style="margin-top:6px;">${paid.length} pagos</div>
        </div>
      </div>

      <div class="card" style="cursor:pointer" onclick="go('payments','upcoming')">
        <div class="kTitle">📅 Próximas cuotas</div>
        <div class="muted" style="margin-top:6px;">${upcoming.length} cuotas (1 a 3 días)</div>
      </div>

      <div class="card">
        <div class="kTitle">📄 Informes del curso</div>
        <div class="muted" style="margin-top:6px;">Revisa los informes publicados por la directiva.</div>
        <div class="actions" style="margin-top:10px;justify-content:flex-end;">
          <button class="btnx primary" onclick="go('informes')">Ver informes</button>
        </div>
      </div>
    `;
  }

  // ---- Pagos ----
  let payFilter = "pending"; // pending | upcoming | paid | credit | opted_out

  function tasksMap(){
    const ts = load(KEY_TASKS, []);
    return Object.fromEntries(ts.map(t=>[t.id, t]));
  }

  function filterPayments(){
    const pays = load(KEY_PAYMENTS, []);
    if(payFilter==="pending") return pays.filter(p=>p.status==="pending");
    if(payFilter==="paid") return pays.filter(p=>p.status==="paid");
    if(payFilter==="credit") return pays.filter(p=>p.status==="credit");
    if(payFilter==="opted_out") return pays.filter(p=>p.status==="opted_out");
    if(payFilter==="upcoming"){
      return pays.filter(p=>p.status==="pending").filter(p=>{
        const d = daysTo(p.dueDate);
        return d!=null && d>=1 && d<=3;
      });
    }
    return pays.filter(p=>p.status==="pending");
  }

  function renderPayments(){
    setHeaderCourse();
    if(activationGate()) return;

    const tsMap = tasksMap();
    const list = filterPayments();

    const chips = `
      <div class="chips">
        <button class="chip ${payFilter==="pending"?"active":""}" onclick="setPayFilter('pending')">Pendientes</button>
        <button class="chip ${payFilter==="upcoming"?"active":""}" onclick="setPayFilter('upcoming')">Próximas</button>
        <button class="chip ${payFilter==="paid"?"active":""}" onclick="setPayFilter('paid')">Pagadas</button>
        <button class="chip ${payFilter==="credit"?"active":""}" onclick="setPayFilter('credit')">Saldo a favor</button>
        <button class="chip ${payFilter==="opted_out"?"active":""}" onclick="setPayFilter('opted_out')">No participé</button>
      </div>
    `;

    // group by campaign id
    const grouped = {};
    list.forEach(p=>{
      const key = p.fromTaskId || "otros";
      grouped[key] = grouped[key] || [];
      grouped[key].push(p);
    });

    const blocks = Object.keys(grouped).map(taskId=>{
      const t = tsMap[taskId] || null;
      const title = t ? t.title : (grouped[taskId][0].concept || "Pago");
      const dateLine = t ? `${t.startDate||""} → ${t.dueDate||""}` : "";
      const mandatory = t ? !!t.mandatoryParticipation : true;

      const rows = grouped[taskId].map(p=>{
        const d = daysTo(p.dueDate);
        const showDue = (p.status==="pending" && d!=null);
        const dueTxt = showDue ? `Quedan ${d} días` : "";

        // Right side
        let right = "";
        if(p.status==="pending"){
          right = `<button class="btnx primary" onclick="payNow('${p.id}')">Pagar</button>`;
        }else if(p.status==="paid"){
          right = `<span class="pill ok">Pagado</span>`;
        }else if(p.status==="credit"){
          right = `<span class="pill ok">Saldo a favor</span>`;
        }else if(p.status==="opted_out"){
          right = `<span class="pill warn">No participé</span>`;
        }

        // Opt-out only if not mandatory & pending
        const optOutBtn = (!mandatory && p.status==="pending")
          ? `<button class="btnx" onclick="optOut('${p.id}')">No participé</button>`
          : "";

        return `
          <div class="payRow">
            <div class="payLeft">
              <div class="payName">${esc(p.concept||title)}</div>
              <div class="payMeta">${clp(p.amount||0)} ${dueTxt?`· ${esc(dueTxt)}`:""}</div>
            </div>
            <div class="payRight">
              ${optOutBtn}
              ${right}
            </div>
          </div>
        `;
      }).join("");

      return `
        <div class="card">
          <div class="row">
            <div>
              <div class="kTitle">${esc(title)} <span class="pill">Campaña</span></div>
              ${dateLine ? `<div class="muted" style="margin-top:6px;font-weight:800;font-size:12px;">${esc(dateLine)}</div>` : ``}
              ${!mandatory ? `<div class="muted" style="margin-top:6px;">Participación: <b>No obligatoria</b></div>` : ``}
            </div>
          </div>
          ${rows}
        </div>
      `;
    }).join("");

    app.innerHTML = `
      <div class="card">
        <div class="kTitle">Pagos</div>
        <div class="muted" style="margin-top:6px;">Filtra y gestiona tus cuotas.</div>
        ${chips}
      </div>

      ${blocks || `<div class="card"><div class="muted">Sin pagos para este filtro.</div></div>`}
    `;
  }

  window.setPayFilter = function(f){
    payFilter = f;
    renderPayments();
  };

  window.payNow = function(paymentId){
    const pays = load(KEY_PAYMENTS, []);
    const i = pays.findIndex(p=>p.id===paymentId);
    if(i<0) return;
    pays[i].status = "paid";
    save(KEY_PAYMENTS, pays);
    renderPayments();
  };

  window.optOut = function(paymentId){
    const pays = load(KEY_PAYMENTS, []);
    const i = pays.findIndex(p=>p.id===paymentId);
    if(i<0) return;
    pays[i].status = "opted_out";
    save(KEY_PAYMENTS, pays);
    renderPayments();
  };

  // ---- Informes ----
  function renderInformes(){
    setHeaderCourse();
    if(activationGate()) return;

    const reps = load(KEY_REPORTS, []);
    app.innerHTML = `
      <div class="card">
        <div class="kTitle">📄 Informes del curso</div>
        <div class="muted" style="margin-top:6px;">Montos generales del curso (no personales).</div>
      </div>

      ${reps.length ? reps.map(r=>`
        <div class="card">
          <div class="row">
            <div>
              <div class="kTitle">Informe ${esc(r.period||"")}</div>
              <div class="muted" style="margin-top:6px;font-size:12px;">Emitido: ${esc(r.generatedAt||"")}</div>
            </div>
            <button class="btnx primary" onclick="openReport('${esc(r.period||"")}')">Ver</button>
          </div>
        </div>
      `).join("") : `<div class="card"><div class="muted">Aún no hay informes publicados.</div></div>`}
    `;
  }

  // ---- navigation + menu ----
  function go(tab, sub){
    navItems.forEach(b=>b.classList.toggle("active", b.dataset.tab===tab));
    if(tab==="home") renderHome();
    if(tab==="payments"){ payFilter = sub || payFilter; renderPayments(); }
    if(tab==="informes") renderInformes();
  }

  navItems.forEach(b=> b.onclick=()=> go(b.dataset.tab));

  function initMenu(){
    if(menuBtn && menuDropdown){
      menuBtn.onclick=(e)=>{e.stopPropagation(); menuDropdown.style.display=(menuDropdown.style.display==="block"?"none":"block");};
      document.addEventListener("click",()=> menuDropdown.style.display="none");
    }
    if(goOnboarding){
      goOnboarding.onclick = ()=> location.href="onboarding/dashboard.html?onboarding=1";
    }
    if(logoutBtn){
      logoutBtn.onclick = ()=> location.href="login.html";
    }
  }

  // Boot
  ensureDemo();
  initMenu();
  go("home");

})();
