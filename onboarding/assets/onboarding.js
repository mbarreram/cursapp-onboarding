/* =========================================================
   Cursapp · Onboarding Premium (Presidente) — v1602
   - Mantiene modelo localStorage (v1), pero con UI más productiva.
   - Ruta esperada:
     /onboarding/dashboard.html
     /onboarding/assets/onboarding.js
     /onboarding/assets/styles.css  (importa ../../assets/styles.css)
   ========================================================= */

(function () {
  // --- storage keys (compatibles con tu app actual) ---
  const KEY_ONB_DRAFT = "cursapp_onb_draft_v1";
  const KEY_COURSES = "cursapp_courses_v1";
  const KEY_USERS = "cursapp_users_v1";
  const KEY_PROFILES = "cursapp_profiles_v1";
  const KEY_ACTIVE_COURSE = "cursapp_active_course_v1";

  const $ = (sel, root = document) => root.querySelector(sel);

  const esc = (s) =>
    String(s ?? "").replace(/[&<>'"]/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[c]));

  const loadJSON = (k, fb) => {
    try { return JSON.parse(localStorage.getItem(k) || ""); } catch { return fb; }
  };
  const saveJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  const uid = (p="id") => p + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,8);
  const randCode = (len=6) => Array.from({length:len},()=> "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random()*32)]).join("");

  // --- app state ---
  const state = loadJSON(KEY_ONB_DRAFT, {
    step: 1,
    course: {
      region: "Región Metropolitana",
      comuna: "Santiago",
      colegio: "Colegio X (Demo)",
      nivel: "2° Básico",
      letra: "B",
      anio: new Date().getFullYear(),
      nombreCurso: "",
    },
    directiva: {
      nombre: "",
      email: "",
      telefono: "",
      alumno: "",
      acepta: false,
    },
    codes: { inviteCode: "", treasurerCode: "" }
  });

  const TOTAL_STEPS = 4;

  // --- dom refs ---
  const contentEl = $("#obContent");
  const stepLabelEl = $("#obStepLabel");
  const progressEl = $("#obProgressBar");
  const helpTextEl = $("#obHelpText");

  const backBtn = $("#obBackBtn");
  const nextBtn = $("#obNextBtn");
  const saveBtn = $("#obSaveBtn");

  // menu
  const menuBtn = $("#obMenuBtn");
  const menuDD = $("#obMenuDD");
  const closeMenu = () => { menuDD.setAttribute("aria-hidden", "true"); };
  menuBtn?.addEventListener("click", () => {
    const isHidden = menuDD.getAttribute("aria-hidden") !== "false";
    menuDD.setAttribute("aria-hidden", isHidden ? "false" : "true");
  });
  document.addEventListener("click", (e) => {
    if (!menuDD) return;
    if (e.target === menuBtn || menuDD.contains(e.target)) return;
    closeMenu();
  });
  menuDD?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    if (action === "reset") {
      if (confirm("¿Reiniciar onboarding? Se borrará el borrador guardado.")) {
        localStorage.removeItem(KEY_ONB_DRAFT);
        location.reload();
      }
    }
    if (action === "backLogin") {
      location.href = "/index.html";
    }
    closeMenu();
  });

  const autosave = () => saveJSON(KEY_ONB_DRAFT, state);

  // --- rendering helpers ---
  function setStep(n) {
    state.step = Math.max(1, Math.min(TOTAL_STEPS, n));
    autosave();
    render();
  }

  function updateChrome() {
    stepLabelEl.textContent = `Paso ${state.step} de ${TOTAL_STEPS}`;
    const pct = Math.round((state.step - 1) / (TOTAL_STEPS - 1) * 100);
    progressEl.style.width = pct + "%";

    backBtn.style.visibility = state.step === 1 ? "hidden" : "visible";

    // button label
    if (state.step < TOTAL_STEPS) {
      nextBtn.textContent = "Continuar";
    } else {
      nextBtn.textContent = "Crear curso";
      nextBtn.classList.remove("ob-btn-primary");
      nextBtn.classList.add("ob-btn-warn");
    }

    // tip text
    const tips = {
      1: "Elige tu colegio y curso. Esto define a quién pertenece el fondo del curso.",
      2: "Agrega tus datos como presidente (directiva). Puedes editarlos después.",
      3: "Confirma para generar los códigos de acceso (apoderados y tesorero).",
      4: "Comparte el código correcto: apoderados vs tesorero. Puedes copiar con un toque."
    };
    helpTextEl.textContent = tips[state.step] || "Tus datos se guardan automáticamente.";
  }

  function field({ id, label, value, placeholder, hint, type="text", inputmode, disabled=false }) {
    const im = inputmode ? ` inputmode="${esc(inputmode)}"` : "";
    const dis = disabled ? " disabled" : "";
    return `
      <div class="ob-field">
        <div class="ob-label">${esc(label)}</div>
        <input class="ob-input" id="${esc(id)}" type="${esc(type)}" value="${esc(value ?? "")}" placeholder="${esc(placeholder ?? "")}"${im}${dis}/>
        ${hint ? `<div class="ob-hint">${esc(hint)}</div>` : ""}
      </div>
    `;
  }

  function select({ id, label, value, options, hint }) {
    const opts = options.map(o => {
      const val = typeof o === "string" ? o : o.value;
      const lab = typeof o === "string" ? o : o.label;
      const sel = String(val) === String(value) ? " selected" : "";
      return `<option value="${esc(val)}"${sel}>${esc(lab)}</option>`;
    }).join("");
    return `
      <div class="ob-field">
        <div class="ob-label">${esc(label)}</div>
        <select class="ob-select" id="${esc(id)}">${opts}</select>
        ${hint ? `<div class="ob-hint">${esc(hint)}</div>` : ""}
      </div>
    `;
  }

  function checkbox({ id, label, checked }) {
    return `
      <label class="ob-field" style="grid-template-columns:auto 1fr;align-items:center;gap:10px;">
        <input id="${esc(id)}" type="checkbox" ${checked ? "checked" : ""} style="width:20px;height:20px;"/>
        <div class="ob-label" style="margin:0;">${esc(label)}</div>
      </label>
    `;
  }

  // --- step views ---
  function viewStep1() {
    const c = state.course;

    return `
      <div class="ob-grid cols-2">
        ${select({ id:"region", label:"Región", value:c.region, options:[
          "Región Metropolitana","Valparaíso","Biobío","La Araucanía","O'Higgins","Maule","Los Lagos"
        ], hint:"Puedes cambiarlo luego. (Demo: datos acotados)" })}
        ${select({ id:"comuna", label:"Comuna", value:c.comuna, options:["Santiago","Providencia","Ñuñoa","La Florida","Maipú"], hint:"Selecciona tu comuna." })}
        ${select({ id:"colegio", label:"Colegio", value:c.colegio, options:["Colegio X (Demo)","Colegio Y (Demo)","Colegio Z (Demo)"], hint:"En producción estará el listado completo." })}
        ${select({ id:"nivel", label:"Nivel", value:c.nivel, options:["Prekínder","Kínder","1° Básico","2° Básico","3° Básico","4° Básico","5° Básico","6° Básico","7° Básico","8° Básico","1° Medio","2° Medio","3° Medio","4° Medio"] })}
      </div>

      <div class="ob-grid cols-3" style="margin-top:12px;">
        ${field({ id:"letra", label:"Letra", value:c.letra, placeholder:"A / B / C", hint:"Ej: B", type:"text" })}
        ${field({ id:"anio", label:"Año", value:c.anio, placeholder:"2026", hint:"Año académico", type:"number", inputmode:"numeric" })}
        ${field({ id:"nombreCurso", label:"Nombre del curso (opcional)", value:c.nombreCurso, placeholder:"Ej: 2°B 2026", hint:"Se mostrará en dashboards." })}
      </div>

      <div class="ob-kpi" style="margin-top:12px;">
        <div class="ob-kpi-title">Resumen</div>
        <div class="ob-kpi-val" id="kpiPreview">${esc(c.colegio)} · ${esc(c.nivel)} ${esc(c.letra)} · ${esc(c.anio)}</div>
      </div>
    `;
  }

  function viewStep2() {
    const d = state.directiva;
    return `
      <div class="ob-grid cols-2">
        ${field({ id:"nombre", label:"Nombre directiva", value:d.nombre, placeholder:"Nombre y apellido" })}
        ${field({ id:"email", label:"Correo", value:d.email, placeholder:"correo@ejemplo.com", type:"email" })}
        ${field({ id:"telefono", label:"Teléfono (opcional)", value:d.telefono, placeholder:"+56 9 1234 5678", inputmode:"tel" })}
        ${field({ id:"alumno", label:"Alumno/a (opcional)", value:d.alumno, placeholder:"Nombre alumno/a", hint:"No publicamos datos personales. Solo referencia interna." })}
      </div>

      <div style="margin-top:12px;">
        ${checkbox({ id:"acepta", label:"Acepto los términos y confirmo que soy parte de la directiva.", checked: !!d.acepta })}
        <div class="ob-hint" style="margin-top:6px;">
          Al crear el curso podrás invitar apoderados y asignar tesorero con códigos.
        </div>
      </div>
    `;
  }

  function ensureCodes() {
    if (!state.codes.inviteCode) state.codes.inviteCode = randCode(6);
    if (!state.codes.treasurerCode) state.codes.treasurerCode = randCode(6);
  }

  function viewStep3() {
    ensureCodes();
    const c = state.course;
    const d = state.directiva;
    return `
      <div class="ob-kpi">
        <div class="ob-kpi-title">Antes de crear</div>
        <div class="ob-hint" style="margin-top:6px;">
          Revisemos que todo esté ok. Si necesitas ajustar, vuelve atrás.
        </div>
        <div style="margin-top:10px;display:grid;gap:10px;">
          <div class="ob-codebox">
            <div>
              <div class="ob-hint">Curso</div>
              <div style="font-weight:950;">${esc(c.colegio)} · ${esc(c.nivel)} ${esc(c.letra)} · ${esc(c.anio)}</div>
            </div>
            <span class="ob-badge">Directiva</span>
          </div>

          <div class="ob-codebox">
            <div>
              <div class="ob-hint">Presidente</div>
              <div style="font-weight:950;">${esc(d.nombre || "—")}</div>
              <div class="ob-hint">${esc(d.email || "")}</div>
            </div>
            <span class="ob-badge">Cuenta</span>
          </div>
        </div>
      </div>

      <div class="ob-grid cols-2" style="margin-top:12px;">
        <div class="ob-kpi">
          <div class="ob-kpi-title">Código apoderados</div>
          <div class="ob-hint" style="margin-top:6px;">Lo usan para unirse al curso y ver cuotas.</div>
          <div class="ob-codebox" style="margin-top:10px;">
            <div class="ob-code" id="inviteCode">${esc(state.codes.inviteCode)}</div>
            <button class="ob-copy" data-copy="invite">Copiar</button>
          </div>
        </div>

        <div class="ob-kpi">
          <div class="ob-kpi-title">Código tesorero</div>
          <div class="ob-hint" style="margin-top:6px;">Permite rendiciones e informes.</div>
          <div class="ob-codebox" style="margin-top:10px;">
            <div class="ob-code" id="treasurerCode">${esc(state.codes.treasurerCode)}</div>
            <button class="ob-copy" data-copy="treasurer">Copiar</button>
          </div>
        </div>
      </div>

      <div class="ob-hint" style="margin-top:12px;">
        * En esta demo los códigos se generan localmente. En producción estarán asociados al curso y usuarios.
      </div>
    `;
  }

  function viewStep4() {
    const c = state.course;
    return `
      <div class="ob-kpi">
        <div class="ob-kpi-title">¡Listo!</div>
        <div class="ob-hint" style="margin-top:6px;">
          Tu curso quedará creado y podrás ir al dashboard para gestionar campañas, pagos y rendiciones.
        </div>
      </div>

      <div class="ob-grid cols-2" style="margin-top:12px;">
        <div class="ob-kpi">
          <div class="ob-kpi-title">Curso creado</div>
          <div class="ob-kpi-val">${esc(c.nivel)} ${esc(c.letra)} · ${esc(c.anio)}</div>
          <div class="ob-hint">${esc(c.colegio)}</div>
        </div>

        <div class="ob-kpi">
          <div class="ob-kpi-title">Siguiente paso</div>
          <div class="ob-hint" style="margin-top:6px;">
            Comparte el código de apoderados por WhatsApp y asigna el tesorero con su código.
          </div>
        </div>
      </div>

      <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
        <button class="ob-btn ob-btn-primary" data-action="goDashboard">Ir al dashboard</button>
        <button class="ob-btn ob-btn-ghost" data-action="copyBoth">Copiar ambos códigos</button>
      </div>
    `;
  }

  function render() {
    updateChrome();

    if (state.step === 1) contentEl.innerHTML = viewStep1();
    if (state.step === 2) contentEl.innerHTML = viewStep2();
    if (state.step === 3) contentEl.innerHTML = viewStep3();
    if (state.step === 4) contentEl.innerHTML = viewStep4();

    bindStepHandlers();
  }

  function bindStepHandlers() {
    // inputs
    const bindInput = (id, getterSetter) => {
      const el = $("#" + id);
      if (!el) return;
      el.addEventListener("input", () => {
        getterSetter(el.value);
        autosave();
        const preview = $("#kpiPreview");
        if (preview) {
          const c = state.course;
          preview.textContent = `${c.colegio} · ${c.nivel} ${c.letra} · ${c.anio}`;
        }
      });
      el.addEventListener("change", () => {
        getterSetter(el.value);
        autosave();
      });
    };

    // step 1
    if (state.step === 1) {
      bindInput("region", (v) => (state.course.region = v));
      bindInput("comuna", (v) => (state.course.comuna = v));
      bindInput("colegio", (v) => (state.course.colegio = v));
      bindInput("nivel", (v) => (state.course.nivel = v));
      bindInput("letra", (v) => (state.course.letra = v.toUpperCase().slice(0,2)));
      bindInput("anio", (v) => (state.course.anio = Number(v || new Date().getFullYear())));
      bindInput("nombreCurso", (v) => (state.course.nombreCurso = v));
    }

    // step 2
    if (state.step === 2) {
      bindInput("nombre", (v) => (state.directiva.nombre = v));
      bindInput("email", (v) => (state.directiva.email = v));
      bindInput("telefono", (v) => (state.directiva.telefono = v));
      bindInput("alumno", (v) => (state.directiva.alumno = v));

      const chk = $("#acepta");
      if (chk) {
        chk.addEventListener("change", () => {
          state.directiva.acepta = !!chk.checked;
          autosave();
        });
      }
    }

    // step 3 copy buttons
    if (state.step === 3) {
      contentEl.addEventListener("click", async (e) => {
        const btn = e.target.closest("[data-copy]");
        if (!btn) return;
        const kind = btn.getAttribute("data-copy");
        const text = kind === "invite" ? state.codes.inviteCode : state.codes.treasurerCode;
        try {
          await navigator.clipboard.writeText(text);
          btn.textContent = "¡Copiado!";
          setTimeout(()=> btn.textContent = "Copiar", 900);
        } catch {
          alert("No se pudo copiar. Código: " + text);
        }
      }, { once: true });
    }

    // step 4 actions
    if (state.step === 4) {
      contentEl.addEventListener("click", async (e) => {
        const btn = e.target.closest("[data-action]");
        if (!btn) return;
        const action = btn.getAttribute("data-action");
        if (action === "goDashboard") {
          // dashboard principal (raíz)
          location.href = "/index.html";
        }
        if (action === "copyBoth") {
          const text = `Código apoderados: ${state.codes.inviteCode}\nCódigo tesorero: ${state.codes.treasurerCode}`;
          try { await navigator.clipboard.writeText(text); alert("Códigos copiados."); }
          catch { alert(text); }
        }
      }, { once: true });
    }
  }

  function validateStep() {
    if (state.step === 1) {
      if (!state.course.colegio || !state.course.nivel || !state.course.letra) {
        alert("Completa al menos colegio, nivel y letra.");
        return false;
      }
    }
    if (state.step === 2) {
      if (!state.directiva.nombre.trim()) { alert("Ingresa tu nombre."); return false; }
      if (!state.directiva.email.trim() || !state.directiva.email.includes("@")) { alert("Ingresa un correo válido."); return false; }
      if (!state.directiva.acepta) { alert("Debes aceptar los términos para continuar."); return false; }
    }
    return true;
  }

  function commitCourse() {
    ensureCodes();

    const courses = loadJSON(KEY_COURSES, []);
    const users = loadJSON(KEY_USERS, []);
    const profiles = loadJSON(KEY_PROFILES, []);

    const courseId = uid("course");
    const now = new Date().toISOString();

    const course = {
      id: courseId,
      createdAt: now,
      region: state.course.region,
      comuna: state.course.comuna,
      colegio: state.course.colegio,
      nivel: state.course.nivel,
      letra: state.course.letra,
      anio: state.course.anio,
      nombreCurso: state.course.nombreCurso || `${state.course.nivel} ${state.course.letra} ${state.course.anio}`,
      inviteCode: state.codes.inviteCode,
      treasurerCode: state.codes.treasurerCode,
    };

    // "usuario presidente" (demo local)
    const userId = uid("user");
    const user = {
      id: userId,
      email: state.directiva.email.trim().toLowerCase(),
      password: "demo", // demo
      roles: ["presidente"],
      activeCourseId: courseId,
      createdAt: now
    };

    const profile = {
      id: uid("profile"),
      userId,
      courseId,
      nombre: state.directiva.nombre.trim(),
      telefono: state.directiva.telefono || "",
      alumno: state.directiva.alumno || "",
      createdAt: now
    };

    courses.push(course);
    users.push(user);
    profiles.push(profile);

    saveJSON(KEY_COURSES, courses);
    saveJSON(KEY_USERS, users);
    saveJSON(KEY_PROFILES, profiles);
    saveJSON(KEY_ACTIVE_COURSE, courseId);

    // cleanup draft to avoid confusion
    localStorage.removeItem(KEY_ONB_DRAFT);
  }

  // --- buttons ---
  backBtn.addEventListener("click", () => setStep(state.step - 1));
  saveBtn.addEventListener("click", () => { autosave(); alert("Borrador guardado."); });

  nextBtn.addEventListener("click", () => {
    if (state.step < TOTAL_STEPS) {
      if (!validateStep()) return;
      setStep(state.step + 1);
      return;
    }

    // final commit
    if (!validateStep()) return;
    commitCourse();
    setStep(4);
    // keep on step 4, with success actions
    // (optional) could redirect, pero dejamos decisión al usuario
    nextBtn.disabled = true;
    nextBtn.textContent = "Curso creado";
  });

  // boot
  render();
})();
