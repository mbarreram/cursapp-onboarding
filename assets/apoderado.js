(function(){
  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modalRoot");

  const navItems = Array.from(document.querySelectorAll(".navItem"));
  const menuBtn = document.getElementById("menuBtn");
  const menuDropdown = document.getElementById("menuDropdown");
  const goOnboarding = document.getElementById("goOnboarding");
  const logoutBtn = document.getElementById("logoutBtn");
  const whoCourseLine = document.getElementById("whoCourseLine");

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
  function nowISO(){ return new Date().toISOString(); }

  function daysTo(iso){
    if(!iso) return null;
    const d = new Date(iso+"T23:59:59");
    const now = new Date();
    return Math.ceil((d.getTime()-now.getTime())/(1000*60*60*24));
  }

  // ---- Error visible ----
  window.onerror = function(msg,src,line){
    if(app){
      app.innerHTML = `
        <div class="card">
          <div class="kTitle">Error en Apoderado</div>
          <div class="muted" style="margin-top:6px;">${esc(msg)}</div>
          <div class="muted" style="margin-top:6px;font-size:12px;">${esc(src||"")} : ${esc(line||"")}</div>
        </div>
      `;
    }
  };

  // ---- Demo seed (solo si no hay data) ----
  function ensureDemo(){
    const hasTasks = load(KEY_TASKS,[]).length;
    const hasPays = load(KEY_PAYMENTS,[]).length;
    if(hasTasks && hasPays) return;

    save(KEY_TASKS,[
      {id:"t1", title:"Prueba apoderado", startDate:"2026-01-10", dueDate:"2026-01-20", closed:false, mandatoryParticipation:true, type:"monthly", amount:20000},
      {id:"t2", title:"Regalo profe", startDate:"2026-01-10", dueDate:"2026-01-21", closed:false, mandatoryParticipation:false, type:"single", amount:1500},
    ]);

    // 3 cuotas pendientes vencidas para demo
    save(KEY_PAYMENTS,[
      {id:"p1", fromTaskId:"t1", concept:"Cuota 1", amount:20000, status:"pending", dueDate:"2026-01-18", createdAt: nowISO()},
      {id:"p2", fromTaskId:"t1", concept:"Cuota 2", amount:20000, status:"pending", dueDate:"2026-01-19", createdAt: nowISO()},
      {id:"p3", fromTaskId:"t1", concept:"Cuota 3", amount:20000, status:"pending", dueDate:"2026-01-20", createdAt: nowISO()},
      {id:"p4", fromTaskId:"t2", concept:"Pago único", amount:1500, status:"pending", dueDate:"2026-01-21", createdAt: nowISO()},
      {id:"c1", fromTaskId:"tX", concept:"Saldo a favor", amount:10000, status:"credit", createdAt: nowISO(), note:"Saldo a favor"}
    ]);

    if(!load(KEY_REPORTS,[]).length){
      save(KEY_REPORTS,[{
        id:"rep_demo",
        period:"2026-01",
        generatedAt:new Date().toLocaleString("es-CL"),
        recaudadoCurso:137500,
        gastadoCurso:75700,
        disponibleCurso:61800
      }]);
    }
  }

  // ---- Modal ----
  function openModal(html){
    modalRoot.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(15,23,42,.55);
           z-index:99999;display:flex;align-items:flex-end;justify-content:center;padding:14px;">
        <div style="width:min(820px,100%);margin-bottom:12px;">${html}</div>
      </div>
    `;
  }
  function closeModal(){ modalRoot.innerHTML=""; }
  window.closeModal = closeModal;

  // ---- Profile / Header ----
  function getActiveProfile(){
    const profiles = load(KEY_PROFILES, []);
    if(!profiles.length) return null;
    const key = localStorage.getItem(KEY_ACTIVE_COURSE) || "";
    return profiles.find(p=>p.courseKey===key) || profiles[0];
  }

  function setHeader(){
    if(!whoCourseLine) return;
    const p = getActiveProfile();
    if(!p || !p.course){
      whoCourseLine.textContent = "Curso Demo · Colegio Demo";
      return;
    }
    const c = p.course;
    const ap = p.apoderado || {};
    whoCourseLine.innerHTML = `
      <div style="font-weight:950;color:#111827;">${esc((ap.name||"Apoderado")+" · Apoderado")}</div>
      <div class="muted" style="margin-top:2px;font-weight:900;">${esc(ap.alumno||"Alumno/a")}</div>
      <div class="muted" style="margin-top:2px;font-weight:900;font-size:12px;">
        ${esc((c.schoolName||"Colegio")+" · "+(c.level||"")+(c.letter||"")+" "+(c.year||"")+" · "+(c.jornada||""))}
      </div>
    `;
  }

  // ---- Activation gate ----
  function isActivationPending(){
    const p = getActiveProfile();
    if(!p) return false;
    if((p.role || p.user?.role) !== "apoderado") return false;
    return !!(p.activation?.required && p.activation.status !== "paid");
  }

  function showActivation(){
    app.innerHTML = `
      <div class="card">
        <div class="kTitle">Activación pendiente</div>
        <div class="muted" style="margin-top:6px;">
          Debes completar la activación de <b>$990</b> para operar en este curso.
          <br><span style="font-weight:900;">Este monto es del sistema, no del curso.</span>
        </div>
        <div class="actions" style="margin-top:14px;justify-content:flex-end;">
          <button class="btnx" onclick="location.href='login.html'">Cerrar sesión</button>
          <button class="btnx primary" onclick="payActivation()">Pagar $990</button>
        </div>
      </div>
    `;

    openModal(`
      <div class="card">
        <div class="kTitle">Activación pendiente</div>
        <div class="muted" style="margin-top:6px;">
          Para operar en este curso debes completar la activación de <b>$990</b>.
          <br><span style="font-weight:900;">Este monto es del sistema, no del curso.</span>
        </div>
        <div class="actions" style="margin-top:14px;justify-content:flex-end;">
          <button class="btnx" onclick="location.href='login.html'">Cerrar sesión</button>
          <button class="btnx primary" onclick="payActivation()">Pagar $990</button>
        </div>
      </div>
    `);
  }

  window.payActivation = function(){
    const profiles = load(KEY_PROFILES, []);
    const activeKey = localStorage.getItem(KEY_ACTIVE_COURSE) || "";
    const i = profiles.findIndex(p=>p.courseKey===activeKey && (p.role==="apoderado" || p.user?.role==="apoderado"));
    if(i>=0){
      profiles[i].activation.status="paid";
      profiles[i].activation.paidAt=nowISO();
      save(KEY_PROFILES, profiles);
    }
    closeModal();
    go("home");
  };

  // ---- Reports ----
  function reports(){ return load(KEY_REPORTS, []); }
  function latestReport(){ const r = reports(); return r.length ? r[0] : null; }

  function reportBanner(){
    const r = latestReport();
    if(!r) return "";
    return `
      <div class="banner">
        <div style="font-weight:950;">📄 Informe disponible · ${esc(r.period || "Mes")}</div>
        <div class="muted" style="margin-top:6px;">Montos del curso (no personales). Publicado por la directiva.</div>
        <div class="actions" style="margin-top:10px;justify-content:flex-end;">
          <button class="btnx primary" onclick="openReport('${esc(r.period||"")}')">Ver informe</button>
        </div>
      </div>
    `;
  }

  window.openReport = function(period){
    const reps = reports();
    const r = reps.find(x=>String(x.period||"")===String(period||"")) || reps[0];
    if(!r) return;

    openModal(`
      <div class="card">
        <div class="row">
          <div>
            <div class="kTitle">Informe del curso</div>
            <div class="muted" style="margin-top:6px;">Montos del curso (no personales)</div>
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

  // ---- Credits apply ----
  function applyCreditsToPayment(pays, paymentIndex){
    const pay = pays[paymentIndex];
    if(!pay || (pay.status!=="pending" && pay.status!=="partial")) return {changed:false};

    let remaining = Number(pay.amountRemaining ?? pay.amount ?? 0);
    if(remaining<=0) return {changed:false};

    const credits = pays
      .map((x, idx)=>({x, idx}))
      .filter(o=>o.x.status==="credit" && Number(o.x.amount||0)>0)
      .sort((a,b)=>{
        const da = a.x.createdAt ? new Date(a.x.createdAt).getTime() : 0;
        const db = b.x.createdAt ? new Date(b.x.createdAt).getTime() : 0;
        return da - db;
      });

    if(!credits.length) return {changed:false};

    let usedTotal=0;

    for(const c of credits){
      if(remaining<=0) break;
      const cAmt = Number(c.x.amount||0);
      if(cAmt<=0) continue;
      const use = Math.min(cAmt, remaining);
      remaining -= use;
      usedTotal += use;

      pays[c.idx].amount = cAmt - use;
      if(pays[c.idx].amount<=0){
        pays[c.idx].amount=0;
        pays[c.idx].status="credit_used";
        pays[c.idx].usedAt=nowISO();
      }
    }

    if(usedTotal>0){
      pays[paymentIndex].amountRemaining = remaining;
      if(remaining<=0){
        pays[paymentIndex].status="paid";
        pays[paymentIndex].paidAt=nowISO();
        pays[paymentIndex].paidWith="credit";
      }else{
        pays[paymentIndex].status="partial";
        pays[paymentIndex].paidWith="credit_partial";
      }
      return {changed:true, usedTotal, remaining};
    }

    return {changed:false};
  }

  // ---- Pages ----
  function renderHome(){
    app.innerHTML = `
      ${reportBanner()}
      <div class="card">
        <div class="kTitle">Inicio</div>
        <div class="muted" style="margin-top:6px;">Accesos directos a pagos e informes.</div>
      </div>

      <div class="grid2">
        <div class="card" style="cursor:pointer" onclick="go('payments')">
          <div class="kTitle">💳 Pagos</div>
          <div class="muted" style="margin-top:6px;">Pendientes / Próximas / Pagadas / Saldo a favor</div>
        </div>
        <div class="card" style="cursor:pointer" onclick="go('informes')">
          <div class="kTitle">📄 Informes</div>
          <div class="muted" style="margin-top:6px;">Ver informes publicados</div>
        </div>
      </div>
    `;
  }

  let payFilter="pending";
  window.setPayFilter=(f)=>{ payFilter=f; renderPayments(); };

  function dueLabel(p){
    const d = daysTo(p.dueDate);
    if(d==null) return "";
    if(d<0) return "Vencida";
    if(d===0) return "Vence hoy";
    return `Quedan ${d} días`;
  }

  function renderPayments(){
    const pays = load(KEY_PAYMENTS, []);
    const tasks = load(KEY_TASKS, []);
    const map = Object.fromEntries(tasks.map(t=>[t.id,t]));

    const chips = `
      <div class="chips">
        <button class="chip ${payFilter==="pending"?"active":""}" onclick="setPayFilter('pending')">Pendientes</button>
        <button class="chip ${payFilter==="upcoming"?"active":""}" onclick="setPayFilter('upcoming')">Próximas</button>
        <button class="chip ${payFilter==="paid"?"active":""}" onclick="setPayFilter('paid')">Pagadas</button>
        <button class="chip ${payFilter==="credit"?"active":""}" onclick="setPayFilter('credit')">Saldo a favor</button>
      </div>
    `;

    let list=[];
    if(payFilter==="pending") list=pays.filter(p=>p.status==="pending" || p.status==="partial");
    if(payFilter==="paid") list=pays.filter(p=>p.status==="paid");
    if(payFilter==="credit") list=pays.filter(p=>p.status==="credit");
    if(payFilter==="upcoming"){
      list=pays.filter(p=>p.status==="pending" || p.status==="partial").filter(p=>{
        const d=daysTo(p.dueDate); return d!=null && d>=1 && d<=3;
      });
    }

    // group by taskId
    const grouped={};
    list.forEach(p=>{
      const k=p.fromTaskId||"otros";
      grouped[k]=grouped[k]||[];
      grouped[k].push(p);
    });

    // Render one card per campaign
    const cards = Object.keys(grouped).map(taskId=>{
      const t = map[taskId] || null;
      const title = t ? t.title : "Pago";
      const rows = grouped[taskId];

      // sort rows by due date
      rows.sort((a,b)=> String(a.dueDate||"").localeCompare(String(b.dueDate||"")));

      const anyPending = rows.some(r=>r.status==="pending" || r.status==="partial");
      const isVencida = anyPending && rows.some(r=>{
        const d=daysTo(r.dueDate);
        return d!=null && d<0;
      });

      const status = anyPending ? (isVencida ? "Vencida" : "Pendiente") : "Pagada";

      const statusPill =
        status==="Pagada" ? `<span class="pill ok">Pagada</span>` :
        status==="Vencida" ? `<span class="pill danger">Vencida</span>` :
        `<span class="pill warn">Pendiente</span>`;

      const subtitle = t
        ? (t.type==="monthly" ? `${rows.length} cuotas · ${rows.filter(r=>r.status!=="paid").length} pendiente(s)` : `Pago único`)
        : "";

      const bodyRows = rows.map(r=>{
        const label = r.status==="paid"
          ? `<span class="pill ok">Pagado</span>`
          : (r.status==="partial"
              ? `<span class="pill warn">Parcial</span>`
              : `<span class="pill warn">${esc(dueLabel(r) || "Pendiente")}</span>`);

        const amtLine = r.status==="partial"
          ? `${clp(r.amount||0)} · Restan ${clp(r.amountRemaining||0)}`
          : `${clp(r.amount||0)}`;

        const btn = (r.status==="pending" || r.status==="partial")
          ? `<button class="btnx primary" onclick="payNow('${r.id}')">Pagar</button>`
          : ``;

        return `
          <div class="payRow">
            <div class="payLeft">
              <div class="payName">${esc(r.concept || "Cuota")}</div>
              <div class="payMeta">${amtLine}</div>
            </div>
            <div class="payRight">
              ${label}
              ${btn}
            </div>
          </div>
        `;
      }).join("");

      return `
        <div class="card accentCard" style="margin-bottom:18px;">
          <div class="row">
            <div>
              <div class="kTitle">${esc(title)}</div>
              <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                ${statusPill}
                ${subtitle?`<span class="pill">${esc(subtitle)}</span>`:""}
              </div>
            </div>
          </div>
          ${bodyRows}
        </div>
      `;
    }).join("");

    app.innerHTML = `
      <div class="card">
        <div class="kTitle">Pagos</div>
        <div class="muted" style="margin-top:6px;">Si tienes saldo a favor, se aplicará automáticamente al pagar.</div>
        ${chips}
      </div>
      ${cards || `<div class="card"><div class="muted">Sin pagos para este filtro.</div></div>`}
    `;
  }

  window.payNow = function(id){
    const pays = load(KEY_PAYMENTS, []);
    const i = pays.findIndex(p=>p.id===id);
    if(i<0) return;

    const r = applyCreditsToPayment(pays, i);

    if(r.changed){
      save(KEY_PAYMENTS, pays);
      if(r.remaining<=0) alert(`✅ Pago cubierto con saldo a favor.\nAplicado: ${clp(r.usedTotal)}`);
      else alert(`✅ Se aplicó saldo a favor: ${clp(r.usedTotal)}\nRestante por pagar: ${clp(r.remaining)} (demo)`);
    }else{
      pays[i].status="paid";
      pays[i].paidAt=nowISO();
      save(KEY_PAYMENTS, pays);
      alert("Pago realizado ✅ (demo)");
    }

    renderPayments();
  };

  function renderInformes(){
    const reps = reports();
    app.innerHTML = `
      <div class="card">
        <div class="kTitle">Informes</div>
        <div class="muted" style="margin-top:6px;">Montos del curso (no personales).</div>
      </div>
      ${reps.length ? reps.map(r=>`
        <div class="card accentCard">
          <div class="row">
            <div>
              <div class="kTitle">Informe ${esc(r.period||"")}</div>
              <div class="muted" style="margin-top:6px;font-size:12px;">${esc(r.generatedAt||"")}</div>
            </div>
            <button class="btnx primary" onclick="openReport('${esc(r.period||"")}')">Ver</button>
          </div>
        </div>
      `).join("") : `<div class="card"><div class="muted">Aún no hay informes publicados.</div></div>`}
    `;
  }

  // ---- Router ----
  function go(tab){
    navItems.forEach(b=>b.classList.toggle("active", b.dataset.tab===tab));
    setHeader();

    if(isActivationPending()){
      showActivation();
      return;
    }else{
      closeModal();
    }

    if(tab==="home") renderHome();
    if(tab==="payments") renderPayments();
    if(tab==="informes") renderInformes();
  }

  // ---- Menu ----
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

  navItems.forEach(b=> b.onclick=()=> go(b.dataset.tab));

  // Boot
  ensureDemo();
  initMenu();
  go("payments"); // start in payments for review
})();
