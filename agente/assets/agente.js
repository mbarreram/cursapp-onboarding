
(function(){
  const KEY_AGENTS="cursapp_ref_agents_v1", KEY_CONV="cursapp_ref_conversions_v1", KEY_SESSION="cursapp_agent_session_v1";
  const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
  const fmt=n=>"$"+Number(n||0).toLocaleString("es-CL");
  const load=(k,fb)=>{try{return JSON.parse(localStorage.getItem(k)||"null")??fb}catch(e){return fb}};
  const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  function seed(){
    let agents=load(KEY_AGENTS,[]);
    if(!agents.find(a=>a.email==="agente@cursapp.cl")){
      agents.unshift({id:"ag_demo_cursapp",name:"Agente Demo Cursapp",email:"agente@cursapp.cl",code:"MAU2026",status:"active"});
      save(KEY_AGENTS,agents);
    }
    if(!load(KEY_CONV,[]).length){
      save(KEY_CONV,[
        {id:"c1",agentId:"ag_demo_cursapp",agentName:"Agente Demo Cursapp",referralCode:"MAU2026",schoolName:"Colegio Central",courseLabel:"2°B",courseKey:"central-2b",targetParents:40,status:"asignado",commercialCount:22,directiva:2,activatedParents:20,createdAt:new Date().toISOString()},
        {id:"c2",agentId:"ag_demo_cursapp",agentName:"Agente Demo Cursapp",referralCode:"MAU2026",schoolName:"Colegio Los Robles",courseLabel:"5°B",courseKey:"robles-5b",targetParents:60,status:"validado",commercialCount:48,directiva:2,activatedParents:46,createdAt:new Date().toISOString()},
        {id:"c3",agentId:"ag_demo_cursapp",agentName:"Agente Demo Cursapp",referralCode:"MAU2026",schoolName:"Colegio San José",courseLabel:"3°A",courseKey:"sanjose-3a",targetParents:60,status:"pagado",commercialCount:60,directiva:2,activatedParents:58,createdAt:new Date().toISOString()}
      ]);
    }
  }
  function agent(){const s=load(KEY_SESSION,null);let a=load(KEY_AGENTS,[]).find(x=>s&&x.id===s.agentId)||load(KEY_AGENTS,[])[0];return a||{id:"ag_demo_cursapp",name:"Agente",code:"MAU2026",email:"agente@cursapp.cl"}}
  function rows(){const a=agent();return load(KEY_CONV,[]).filter(x=>x.agentId===a.id||x.referralCode===a.code)}
  function pct(r){return Math.min(100,Math.round((Number(r.commercialCount||0)/Number(r.targetParents||30))*100))}
  function tier(r){const p=pct(r), act=Number(r.activatedParents||0);if(p>=100)return{name:"Premium",cls:"green",amount:550,total:act*550,next:"¡Meta lograda!"};if(p>=80)return{name:"Mejorada",cls:"blue",amount:450,total:act*450,next:`Faltan ${Math.max(0,Math.ceil(r.targetParents)-r.commercialCount)} para 100%`};if(p>=60)return{name:"Básica",cls:"orange",amount:350,total:act*350,next:`Faltan ${Math.max(0,Math.ceil(r.targetParents*.8)-r.commercialCount)} para 80%`};return{name:"En crecimiento",cls:"",amount:0,total:0,next:`Faltan ${Math.max(0,Math.ceil(r.targetParents*.6)-r.commercialCount)} para básica`}}
  function totals(){const rs=rows();return{cursos:rs.length,activated:rs.reduce((a,r)=>a+Number(r.activatedParents||0),0),estimated:rs.reduce((a,r)=>a+tier(r).total,0),paid:rs.filter(r=>r.status==="pagado").reduce((a,r)=>a+tier(r).total,0)}}
  function kpis(){const t=totals();return`<div class="kpis"><div class="kpi"><div class="kpiIcon">🎓</div><span>Cursos captados</span><strong>${t.cursos}</strong></div><div class="kpi"><div class="kpiIcon">👥</div><span>Apoderados activados</span><strong>${t.activated}</strong></div><div class="kpi"><div class="kpiIcon">🎯</div><span>Comisión estimada</span><strong>${fmt(t.estimated)}</strong></div><div class="kpi"><div class="kpiIcon">💼</div><span>Comisión pagada</span><strong>${fmt(t.paid)}</strong></div></div>`}
  function courses(limit=99){return`<div class="card"><h2>Mis cursos captados</h2><p>Avance de tus cursos asociados.</p><div class="tableWrap"><table><thead><tr><th>Colegio</th><th>Curso</th><th>Código</th><th>Estado</th><th>Avance</th><th>Apoderados</th><th>Próxima meta</th></tr></thead><tbody>${rows().slice(0,limit).map(r=>{const p=pct(r),t=tier(r);return`<tr><td><b>${r.schoolName}</b></td><td><b>${r.courseLabel}</b></td><td><span class="badge">${r.referralCode}</span></td><td><span class="badge ${t.cls}">${t.name}</span></td><td><b>${r.commercialCount}/${r.targetParents}</b><div class="progress"><span style="width:${p}%"></span></div>${p}%</td><td>${r.activatedParents}</td><td><b>${t.next}</b></td></tr>`}).join("")}</tbody></table></div></div>`}
  function goal(){return`<div class="card goalCard"><h2>Establece tu meta</h2><p>Simula cuánto podrías ganar.</p><div class="goalControls"><div><label>Cursos a captar</label><input id="goalCourses" type="number" value="5"></div><div><label>Apoderados por curso</label><input id="goalParents" type="number" value="40"></div><div><label>Tramo objetivo</label><select id="goalTier"><option value="350" data-pct="60">Básica 60% · $350</option><option value="450" data-pct="80" selected>Mejorada 80% · $450</option><option value="550" data-pct="100">Premium 100% · $550</option></select></div><div><label>Resultado</label><div class="goalResult"><strong id="goalMoney">$72.000</strong><div class="formula" id="goalFormula">5 cursos x 32 apoderados x $450</div></div></div></div></div>`}
  function code(){const a=agent();return`<div class="card"><h2>Mi código de agente</h2><p>Compártelo con directivas.</p><div class="codeBox">${a.code}</div><button class="actionBtn" id="copyCode">Copiar código</button><button class="actionBtn ghost">Compartir por WhatsApp</button><button class="actionBtn ghost">Descargar QR</button></div>`}
  function material(){return`
    <div class="card materialCard">
      <div class="materialHead">
        <div>
          <h2>Kit agente</h2>
          <p>Herramientas listas para presentar Cursapp, motivar directivas y activar apoderados.</p>
        </div>
        <span class="materialBadge">Material comercial</span>
      </div>

      <div class="kitHero">
        <div>
          <b>Tu código activo</b>
          <strong>${agent().code}</strong>
          <span>Inclúyelo cuando compartas mensajes o presentes la app.</span>
        </div>
        <button onclick="navigator.clipboard?.writeText('${agent().code}')">Copiar código</button>
      </div>

      <div class="materialGrid">
        <article class="materialItem">
          <div class="materialIcon whatsapp">💬</div>
          <div><b>Mensaje para directivas</b><span>Plantilla editable para presidentes y tesoreros.</span></div>
          <button onclick="AgentKit.openTool('directiva')">Abrir</button>
        </article>

        <article class="materialItem">
          <div class="materialIcon parents">👨‍👩‍👧</div>
          <div><b>Mensaje para apoderados</b><span>Invitación para activar cuenta y entrar al curso.</span></div>
          <button onclick="AgentKit.openTool('apoderados')">Abrir</button>
        </article>

        <article class="materialItem">
          <div class="materialIcon flyer">🖼️</div>
          <div><b>Flyer Cursapp</b><span>Vista tipo afiche para compartir en WhatsApp.</span></div>
          <button onclick="AgentKit.openTool('flyer')">Ver</button>
        </article>

        <article class="materialItem">
          <div class="materialIcon video">▶️</div>
          <div><b>Guion video demo</b><span>Script corto para explicar Cursapp en 45 segundos.</span></div>
          <button onclick="AgentKit.openTool('video')">Ver</button>
        </article>

        <article class="materialItem">
          <div class="materialIcon benefits">⭐</div>
          <div><b>Beneficios principales</b><span>Argumentos simples para reuniones o chats.</span></div>
          <button onclick="AgentKit.openTool('beneficios')">Ver</button>
        </article>

        <article class="materialItem">
          <div class="materialIcon faq">❓</div>
          <div><b>Preguntas frecuentes</b><span>Respuestas para objeciones y dudas comunes.</span></div>
          <button onclick="AgentKit.openTool('faq')">Ver FAQ</button>
        </article>
      </div>

      <div class="kitTips">
        <b>Consejo comercial</b>
        <span>Primero conversa con la directiva. Luego ayuda a que el curso llegue al 60%, 80% o 100% de incorporación.</span>
      </div>
    </div>`}

  function guide(){return`<div class="card"><h2>Guía de motivación</h2><div class="steps">${["Contacta a la directiva","Comparte tu código","Ayuda a crear el curso","Motiva a los apoderados","Sigue el avance hasta 100%"].map((x,i)=>`<div class="step"><div class="num">${i+1}</div><div><b>${x}</b><br><span>Acción recomendada para avanzar.</span></div></div>`).join("")}</div></div>`}
  function home(){return kpis()+courses(5)+`<div class="grid">${goal()}${code()}</div><div class="grid">${material()}${guide()}</div><div class="banner"><h2>Tu trabajo ayuda a ordenar comunidades escolares ⭐</h2><p>Más cursos activos, más apoderados usando Cursapp.</p></div>`}
  function render(v="home"){if(v==="home")$("#app").innerHTML=home(); if(v==="cursos")$("#app").innerHTML=kpis()+courses(); if(v==="metas")$("#app").innerHTML=kpis()+goal(); if(v==="codigo")$("#app").innerHTML=code(); if(v==="material")$("#app").innerHTML=material()+guide(); bindGoal(); bindCopy();}
  function bindGoal(){const c=$("#goalCourses"),p=$("#goalParents"),t=$("#goalTier");if(!c||!p||!t)return;function calc(){const courses=+c.value||0,parents=+p.value||0,opt=t.options[t.selectedIndex],pct=+opt.dataset.pct||0,amount=+t.value||0,act=Math.ceil(parents*pct/100),total=courses*act*amount;$("#goalMoney").textContent=fmt(total);$("#goalFormula").textContent=`${courses} cursos x ${act} apoderados x ${fmt(amount)}`}[c,p,t].forEach(el=>{el.oninput=calc;el.onchange=calc});calc()}
  function bindCopy(){const b=$("#copyCode");if(b)b.onclick=()=>navigator.clipboard?.writeText(agent().code)}

  function kitText(kind){
    const code = agent().code || "MAU2026";
    const templates = {
      directiva: {
        title:"Mensaje para directivas",
        copy:`Hola, soy agente Cursapp. Les quería mostrar una forma simple de ordenar las cuotas, campañas, avisos y reportes del curso.\n\nCursapp ayuda a que la directiva tenga más control y menos trabajo manual.\n\nPueden crear el curso usando este código: ${code}\n\n¿Les puedo compartir una demo rápida?`,
        body:`<p>Usa este mensaje para contactar presidentes, tesoreros o directivas de curso.</p>`
      },
      apoderados: {
        title:"Mensaje para apoderados",
        copy:`Hola, el curso está usando Cursapp para ordenar pagos, campañas, avisos y reportes.\n\nActiva tu cuenta para ver tus cuotas, próximos pagos y comunicaciones del curso.\n\nCódigo del curso/agente: ${code}`,
        body:`<p>Este mensaje sirve cuando la directiva ya decidió usar Cursapp y necesita que los apoderados entren.</p>`
      },
      video: {
        title:"Guion video demo",
        copy:`Hola, soy agente Cursapp.\n\nEn menos de un minuto les muestro cómo Cursapp ayuda a un curso a ordenar cuotas, campañas, pagos, avisos y reportes.\n\nLa directiva puede ver el estado financiero y los apoderados pueden revisar sus pagos pendientes desde el celular.\n\nPara crear el curso pueden usar el código: ${code}`,
        body:`<ol class="kitList"><li>Presenta el problema: cuotas dispersas, planillas y poca visibilidad.</li><li>Muestra la solución: dashboard, pagos, avisos y reportes.</li><li>Cierra con acción: crear curso con tu código.</li></ol>`
      }
    };
    return templates[kind];
  }

  function openKitModal(title, html, copyText){
    const root = document.getElementById("agentModalRoot");
    if(!root) return;
    root.innerHTML = `
      <div class="agentModalBg" onclick="AgentKit.close(event)">
        <div class="agentModal" onclick="event.stopPropagation()">
          <button class="agentModalClose" onclick="AgentKit.close()">×</button>
          <h2>${title}</h2>
          <div class="agentModalBody">${html}</div>
          ${copyText ? `<textarea id="kitCopyText" readonly>${copyText}</textarea>
          <button class="actionBtn" onclick="AgentKit.copyText()">Copiar texto</button>` : ``}
        </div>
      </div>
    `;
  }

  window.AgentKit = {
    openTool(kind){
      const code = agent().code || "MAU2026";

      if(kind === "directiva" || kind === "apoderados" || kind === "video"){
        const t = kitText(kind);
        openKitModal(t.title, t.body, t.copy);
        return;
      }

      if(kind === "flyer"){
        openKitModal("Flyer Cursapp", `
          <div class="flyerPreview">
            <div class="flyerLogo">C</div>
            <h3>Ordena las finanzas de tu curso</h3>
            <p>Cuotas, campañas, avisos, pagos y reportes en una sola app.</p>
            <div class="flyerBullets">
              <span>✅ Control para la directiva</span>
              <span>✅ Claridad para apoderados</span>
              <span>✅ Reportes simples</span>
            </div>
            <strong>Código agente: ${code}</strong>
          </div>
          <p class="mutedModal">Próximo paso: conectar este flyer a una imagen descargable.</p>
        `, `Cursapp ordena las finanzas del curso: cuotas, campañas, avisos, pagos y reportes. Código agente: ${code}`);
        return;
      }

      if(kind === "beneficios"){
        openKitModal("Beneficios principales", `
          <div class="benefitGrid">
            <div><b>📌 Menos desorden</b><span>Centraliza cuotas, campañas y avisos.</span></div>
            <div><b>💳 Pagos claros</b><span>Apoderados ven qué deben pagar y cuándo.</span></div>
            <div><b>📊 Reportes simples</b><span>La directiva puede mostrar avances y estados.</span></div>
            <div><b>👥 Más transparencia</b><span>Todos entienden el estado del curso.</span></div>
            <div><b>📣 Mejor comunicación</b><span>Avisos claros para todo el curso.</span></div>
            <div><b>🔒 Orden por curso</b><span>Cada curso mantiene sus datos separados.</span></div>
          </div>
        `, `Beneficios Cursapp: menos desorden, pagos claros, reportes simples, más transparencia, mejor comunicación y datos separados por curso. Código agente: ${code}`);
        return;
      }

      if(kind === "faq"){
        openKitModal("Preguntas frecuentes", `
          <div class="faqList">
            <details open><summary>¿La directiva paga?</summary><p>No. La directiva se considera para el avance, pero la incorporación pagada aplica a apoderados.</p></details>
            <details><summary>¿Qué pasa si el curso no tiene código?</summary><p>Queda disponible para asignación manual desde el Admin.</p></details>
            <details><summary>¿Puede haber varios agentes en un colegio?</summary><p>Sí. La regla es por curso, no por colegio.</p></details>
            <details><summary>¿Puede un curso tener dos agentes?</summary><p>No. El primer código o asignación bloquea ese curso.</p></details>
            <details><summary>¿Cuándo se cumple la meta?</summary><p>Cuando el curso alcanza 60%, 80% o 100% de incorporación según la meta configurada.</p></details>
          </div>
        `, "");
        return;
      }
    },
    copyText(){
      const txt = document.getElementById("kitCopyText")?.value || "";
      navigator.clipboard?.writeText(txt);
      alert("Texto copiado");
    },
    close(ev){
      if(ev && ev.target && !ev.target.classList.contains("agentModalBg")) return;
      const root = document.getElementById("agentModalRoot");
      if(root) root.innerHTML = "";
    }
  };

  document.addEventListener("DOMContentLoaded",()=>{seed();const a=agent();$("#helloTitle").textContent=`¡Hola, ${a.name.split(" ")[0]}! 👋`;$("#agentNameSide").textContent=a.name;$("#agentCodeSide").textContent=a.code;$("#agentAvatar").textContent=(a.name||"AG").split(" ").map(x=>x[0]).join("").slice(0,2).toUpperCase();$$(".nav").forEach(b=>b.onclick=()=>{$$(".nav").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.body.classList.remove("sideOpen");render(b.dataset.view)});$(".help button").onclick=()=>render("material");$("#menuBtn").onclick=()=>document.body.classList.toggle("sideOpen");$("#logoutBtn").onclick=()=>{localStorage.removeItem(KEY_SESSION);location.href="/index.html"};render()})
})();
