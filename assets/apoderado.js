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

  function nowISO(){ return new Date().toISOString(); }
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
  function dueLabelFromDays(d){
    if(d==null) return "";
    if(d<0) return "Vencida";
    if(d===0) return "Vence hoy";
    return `Quedan ${d} días`;
  }
  function monthNameFromISO(iso){
    if(!iso) return "";
    const d = new Date(iso+"T12:00:00");
    if(isNaN(d.getTime())) return "";
    const months = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    return months[d.getMonth()];
  }

  // Nunca más pantalla en blanco: muestra error arriba
  window.onerror = function(msg, src, line){
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

  // -------- Demo seed (si no hay data) --------
  function ensureDemo(){
    const hasTasks = load(KEY_TASKS,[]).length;
    const hasPays = load(KEY_PAYMENTS,[]).length;
    if(hasTasks && hasPays) return;

    save(KEY_TASKS,[
      {id:"t1", title:"Prueba apoderado", startDate:"2026-01-10", dueDate:"2026-01-20", closed:false, mandatoryParticipation:true, type:"single", amount:20000},
      {id:"t2", title:"Cuota paseo", startDate:"2026-04-01", dueDate:"2026-05-31", closed:false, mandatoryParticipation:true, type:"monthly", amount:20000},
      {id:"t3", title:"Regalo profe", startDate:"2026-01-10", dueDate:"2026-01-21", closed:false, mandatoryParticipation:false, type:"single", amount:1500},
    ]);

    save(KEY_PAYMENTS,[
      // pago único (pero el data puede venir duplicado desde antes: lo manejamos igual)
      {id:"p1", fromTaskId:"t1", concept:"Pago único", amount:20000, status:"pending", dueDate:"2026-01-20", createdAt: nowISO()},

      // mensual (2 cuotas)
      {id:"p2", fromTaskId:"t2", concept:"Cuota mes Abril", amount:20000, status:"pending", dueDate:"2026-04-30", createdAt: nowISO()},
      {id:"p3", fromTaskId:"t2", concept:"Cuota mes Mayo", amount:20000, status:"pending", dueDate:"2026-05-31", createdAt: nowISO()},

      // otro pago único
      {id:"p4", fromTaskId:"t3", concept:"Pago único", amount:1500, status:"pending", dueDate:"2026-01-21", createdAt: nowISO()},

      // saldo a favor
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

  // -------- Global demo mode (centralizado) --------
  function demoModeEnabled(){
    try{
      // 1) Flag global (definido en core.js)
      if(window.CURSAPP && window.CURSAPP.DEMO_MODE === true) return true;
      // 2) URL override: ?demo=1
      const qs = new URLSearchParams(location.search);
      if(qs.get("demo") === "1") return true;
      // 3) Local override (persistente): localStorage.cursapp_demo_mode = "1"
      if(localStorage.getItem("cursapp_demo_mode") === "1") return true;
    }catch(e){}
    return false;
  }

  // -------- Modal --------
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

  // -------- Profile / Header --------
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

  // -------- Activation gate --------
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

  // -------- Reports --------
  function reports(){ return load(KEY_REPORTS, []); }
  function latestReport(){ const r = reports(); return r.length ? r[0] : null; }

  function reportSummaryCard(){
    const r = latestReport();
    if(!r){
      return `
        <div class="card">
          <div class="kTitle">Resumen del curso</div>
          <div class="muted" style="margin-top:6px;">Aún no hay informes publicados.</div>
        </div>
      `;
    }
    return `
      <div class="card">
        <div class="kTitle">Resumen del curso · ${esc(r.period||"")}</div>
        <div class="muted" style="margin-top:6px;">Montos del curso (no personales)</div>

        <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">
          <span class="pill ok">Recaudado ${clp(r.recaudadoCurso||0)}</span>
          <span class="pill warn">Rendido ${clp(r.gastadoCurso||0)}</span>
          <span class="pill">Saldo ${clp(r.disponibleCurso||0)}</span>
        </div>

        <div class="actions" style="margin-top:12px;justify-content:flex-end;">
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

  // -------- Credits apply --------
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

  // -------- Pages --------
  function renderHome(){
    app.innerHTML = `
      ${reportSummaryCard()}

      <div class="grid2">
        <div class="card" style="cursor:pointer" onclick="go('payments')">
          <div class="kTitle">💳 Pagos</div>
          <div class="muted" style="margin-top:6px;">Ver pendientes, próximas, pagadas y saldo a favor</div>
        </div>
        <div class="card" style="cursor:pointer" onclick="go('informes')">
          <div class="kTitle">📄 Informes</div>
          <div class="muted" style="margin-top:6px;">Ver informes publicados por la directiva</div>
        </div>
      </div>
    `;
  }

  let payFilter="pending";
  window.setPayFilter=(f)=>{ payFilter=f; renderPayments(); };

  function renderPayments(){
    const pays = load(KEY_PAYMENTS, []);
    const tasks = load(KEY_TASKS, []);
    const tMap = Object.fromEntries(tasks.map(t=>[t.id,t]));

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

    const grouped={};
    list.forEach(p=>{
      const k=p.fromTaskId||"otros";
      grouped[k]=grouped[k]||[];
      grouped[k].push(p);
    });

    const cards = Object.keys(grouped).map(taskId=>{
      const t = tMap[taskId] || { title: grouped[taskId][0].concept || "Pago", type:"single" };
      const rows = grouped[taskId].slice().sort((a,b)=>String(a.dueDate||"").localeCompare(String(b.dueDate||"")));

      // --- UX rule: if campaign is single, show only ONE row (aggregate if multiple exist) ---
      if(t.type==="single"){
        const pend = rows.filter(r=>r.status==="pending" || r.status==="partial");
        const paid = rows.filter(r=>r.status==="paid");
        const status = pend.length ? "Pendiente" : "Pagada";
        const pill = pend.length ? `<span class="pill warn">Pendiente</span>` : `<span class="pill ok">Pagada</span>`;

        const totalAmount = pend.length
          ? pend.reduce((a,r)=>a+Number(r.amountRemaining ?? r.amount ?? 0),0)
          : paid.reduce((a,r)=>a+Number(r.amount||0),0);

        const d = pend.length ? daysTo(pend[0].dueDate) : null;
        const dueLabel = (d!=null) ? dueLabelFromDays(d) : "";

        return `
          <div class="card accentCard" style="margin-bottom:18px;">
            <div class="row">
              <div>
                <div class="kTitle">${esc(t.title)}</div>
                <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                  ${pill}
                  <span class="pill">Pago único</span>
                </div>
              </div>
            </div>

            <div class="payRow">
              <div class="payLeft">
                <div class="payName">Pago único</div>
                <div class="payMeta">${clp(totalAmount)} ${dueLabel?`· ${esc(dueLabel)}`:""}</div>
              </div>
              <div class="payRight">
                ${pend.length ? `<button class="btnx primary" onclick="paySingleCampaign('${taskId}')">Pagar</button>` : `<span class="pill ok">Pagado</span>`}
              </div>
            </div>
          </div>
        `;
      }

      // --- Monthly campaign: show rows with good labels (Cuota mes / Cuota i de n) ---
      const pendingCount = rows.filter(r=>r.status!=="paid").length;
      const subtitle = `${rows.length} cuotas · ${pendingCount} pendiente(s)`;

      const bodyRows = rows.map((r, idx)=>{
        const total = rows.length;
        const monthName = monthNameFromISO(r.dueDate);
        const cuotaLabel =
          r.concept && r.concept.toLowerCase().includes("cuota")
            ? r.concept
            : (monthName ? `Cuota mes ${monthName}` : `Cuota ${idx+1} de ${total}`);

        const d = (r.status==="pending" || r.status==="partial") ? daysTo(r.dueDate) : null;
        const dueLabel = d!=null ? dueLabelFromDays(d) : "";

        const statusPill =
          r.status==="paid" ? `<span class="pill ok">Pagado</span>` :
          r.status==="partial" ? `<span class="pill warn">Parcial</span>` :
          `<span class="pill warn">${esc(dueLabel || "Pendiente")}</span>`;

        const amountLine =
          r.status==="partial" ? `${clp(r.amount||0)} · Restan ${clp(r.amountRemaining||0)}` : `${clp(r.amount||0)}`;

        const btn = (r.status==="pending" || r.status==="partial")
          ? `<button class="btnx primary" onclick="payNow('${r.id}')">Pagar</button>`
          : ``;

        return `
          <div class="payRow">
            <div class="payLeft">
              <div class="payName">${esc(cuotaLabel)}</div>
              <div class="payMeta">${amountLine}</div>
            </div>
            <div class="payRight">
              ${statusPill}
              ${btn}
            </div>
          </div>
        `;
      }).join("");

      return `
        <div class="card accentCard" style="margin-bottom:18px;">
          <div class="row">
            <div>
              <div class="kTitle">${esc(t.title)}</div>
              <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                <span class="pill">Mensual</span>
                <span class="pill">${esc(subtitle)}</span>
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

  // Pagar campaña single: paga todas las filas pendientes de ese taskId
  window.paySingleCampaign = function(taskId){
    const pays = load(KEY_PAYMENTS, []);
    const ids = pays
      .map((p,idx)=>({p,idx}))
      .filter(o=>o.p.fromTaskId===taskId && (o.p.status==="pending" || o.p.status==="partial"))
      .sort((a,b)=>String(a.p.dueDate||"").localeCompare(String(b.p.dueDate||"")));

    if(!ids.length) return;

    let usedCreditTotal = 0;
    let remainingTotal = 0;

    // apply credits/payment for each row
    for(const o of ids){
      const r = applyCreditsToPayment(pays, o.idx);
      if(r.changed){
        usedCreditTotal += Number(r.usedTotal||0);
        remainingTotal += Number(r.remaining||0);
      }else{
        // no credit -> mark paid demo
        pays[o.idx].status="paid";
        pays[o.idx].paidAt=nowISO();
      }
    }

    save(KEY_PAYMENTS, pays);

    if(usedCreditTotal>0){
      if(remainingTotal<=0) alert(`✅ Pago cubierto con saldo a favor.\nAplicado: ${clp(usedCreditTotal)}`);
      else alert(`✅ Se aplicó saldo a favor: ${clp(usedCreditTotal)}\nRestante por pagar: ${clp(remainingTotal)} (demo)`);
    }else{
      alert("Pago realizado ✅ (demo)");
    }

    renderPayments();
  };

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

  // ✅ Router GLOBAL (y expuesto para que onclick del Home no rompa)
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
  window.go = go; // <-- esto elimina el error "Can't find variable: go"

  // Menu
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

  // Bottom nav
  navItems.forEach(b=> b.onclick=()=> go(b.dataset.tab));

  // Boot
  // ✅ Solo sembrar data demo si el modo demo está activado globalmente
  if(demoModeEnabled()) ensureDemo();
  initMenu();
  go("payments"); // para revisión rápida
})();
