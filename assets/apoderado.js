(function () {
  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modalRoot");

  const navItems = Array.from(document.querySelectorAll(".navItem"));
  const whoCourseLine = document.getElementById("whoCourseLine");
  const logoutBtn = document.getElementById("logoutBtn");

  const KEY_TASKS = "cursapp_tasks_v1";
  const KEY_PAYMENTS = "cursapp_payments_v1";
  const KEY_PROFILES = "cursapp_profiles_v1";
  const KEY_ACTIVE_COURSE = "cursapp_active_course_v1";

  const load = (k, d = []) => {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? d;
    } catch {
      return d;
    }
  };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const clp = (n) => "$" + Number(n || 0).toLocaleString("es-CL");

  function daysTo(iso) {
    if (!iso) return null;
    const d = new Date(iso + "T23:59:59");
    const diff = Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
    return diff;
  }

  function getActiveProfile() {
    const profiles = load(KEY_PROFILES);
    const key = localStorage.getItem(KEY_ACTIVE_COURSE);
    return profiles.find((p) => p.courseKey === key);
  }

  function setHeader() {
    const p = getActiveProfile();
    if (!p) return;

    const c = p.course;
    const a = p.apoderado;

    whoCourseLine.innerHTML = `
      <div style="font-weight:800">${a.name} · Apoderado</div>
      <div class="muted">${a.alumno}</div>
      <div class="muted" style="font-size:12px">
        ${c.schoolName} · ${c.level}${c.letter} ${c.year} · ${c.jornada}
      </div>
    `;
  }

  /* -------------------------
     PAGO CON SALDO A FAVOR
  --------------------------*/
  function applyCredits(pays, idx) {
    let payment = pays[idx];
    let remaining = payment.amountRemaining ?? payment.amount;

    const credits = pays
      .map((p, i) => ({ p, i }))
      .filter((o) => o.p.status === "credit" && o.p.amount > 0);

    for (const c of credits) {
      if (remaining <= 0) break;
      const used = Math.min(remaining, c.p.amount);
      remaining -= used;
      pays[c.i].amount -= used;
      if (pays[c.i].amount <= 0) pays[c.i].status = "credit_used";
    }

    if (remaining <= 0) {
      payment.status = "paid";
      payment.amountRemaining = 0;
    } else {
      payment.status = "partial";
      payment.amountRemaining = remaining;
    }
  }

  /* -------------------------
     PAGOS (AJUSTE FINO)
  --------------------------*/
  function renderPayments() {
    setHeader();

    const tasks = load(KEY_TASKS);
    const pays = load(KEY_PAYMENTS);

    const map = Object.fromEntries(tasks.map((t) => [t.id, t]));
    const grouped = {};

    pays.forEach((p) => {
      if (["paid", "pending", "partial"].includes(p.status)) {
        grouped[p.fromTaskId] = grouped[p.fromTaskId] || [];
        grouped[p.fromTaskId].push(p);
      }
    });

    const cards = Object.keys(grouped)
      .map((taskId) => {
        const t = map[taskId];
        const rows = grouped[taskId];

        const pendientes = rows.filter(
          (r) => r.status === "pending" || r.status === "partial"
        );

        let estado = "Activa";
        let badge = "pill";

        const d = daysTo(t.dueDate);
        if (d !== null && d < 0) {
          estado = "Vencida";
          badge = "pill danger";
        }
        if (pendientes.length === 0) {
          estado = "Pagada";
          badge = "pill ok";
        }

        return `
        <div class="card accentCard" style="margin-bottom:18px">
          <div class="row">
            <div>
              <div class="kTitle">${t.title}</div>
              <span class="${badge}">${estado}</span>
              <div class="muted" style="margin-top:6px;font-size:13px">
                ${t.type === "monthly"
                  ? `${rows.length} cuotas · ${pendientes.length} pendiente(s)`
                  : `Pago único`}
              </div>
            </div>
          </div>

          <div style="margin-top:12px">
            ${rows
              .map((p) => {
                let txt = clp(p.amount);
                if (p.status === "partial") {
                  txt += ` · Restan ${clp(p.amountRemaining)}`;
                }
                return `<div class="muted" style="font-size:13px">• ${txt}</div>`;
              })
              .join("")}
          </div>

          ${
            pendientes.length
              ? `<div style="display:flex;justify-content:flex-end;margin-top:12px">
                   <button class="btnx primary" onclick="pay('${rows[0].id}')">
                     Pagar
                   </button>
                 </div>`
              : ""
          }
        </div>
      `;
      })
      .join("");

    app.innerHTML = `
      <div class="card">
        <div class="kTitle">Pagos</div>
        <div class="muted" style="margin-top:6px">
          Si tienes saldo a favor, se aplicará automáticamente.
        </div>
      </div>
      ${cards || `<div class="card"><div class="muted">Sin pagos</div></div>`}
    `;
  }

  window.pay = function (id) {
    const pays = load(KEY_PAYMENTS);
    const i = pays.findIndex((p) => p.id === id);
    if (i < 0) return;

    applyCredits(pays, i);
    save(KEY_PAYMENTS, pays);
    renderPayments();
  };

  /* -------------------------
     NAV
  --------------------------*/
  function go(tab) {
    navItems.forEach((b) =>
      b.classList.toggle("active", b.dataset.tab === tab)
    );
    if (tab === "payments") renderPayments();
  }

  navItems.forEach((b) => (b.onclick = () => go(b.dataset.tab)));
  logoutBtn.onclick = () => (location.href = "login.html");

  go("payments");
})();
