(function(){
  const KEY_EXPENSES="cursapp_expenses_v1";
  const KEY_DIRTY="cursapp_reports_dirty_v1";

  const app=document.getElementById("app");
  const nav=document.querySelectorAll(".navItem");

  const load=(k,d)=>JSON.parse(localStorage.getItem(k)||JSON.stringify(d));
  const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const clp=n=>"$"+Number(n||0).toLocaleString("es-CL");

  function markDirty(){
    save(KEY_DIRTY,true);
  }

  function renderRendiciones(){
    const expenses=load(KEY_EXPENSES,[]);
    const sinBoleta=expenses.filter(e=>!e.boleta).length;

    app.innerHTML=`
      ${sinBoleta?`
        <div class="alertBox">
          ⚠️ Hay ${sinBoleta} gasto(s) sin boleta. Debes adjuntarlas.
        </div>`:""}

      <div class="card">
        <div class="kTitle">Rendiciones</div>
        <div class="muted">Control y respaldo de gastos del curso</div>
      </div>

      ${expenses.map(e=>`
        <div class="card ${e.campaign?"exp-campaign":"exp-general"}">
          <div class="lineTop">
            <div>
              <div style="font-weight:900">${e.title}</div>
              <div class="muted" style="margin-top:4px">
                ${e.campaign?"🎯 Campaña":"🏦 Fondo del curso (sin campaña)"}
              </div>
              <div style="margin-top:6px;font-weight:900">${clp(e.amount)}</div>
            </div>
            <div class="actions">
              ${e.boleta
                ? `<span class="pill ok">Con boleta</span>
                   <button class="btn ghost" onclick="replaceBoleta('${e.id}')">Reemplazar</button>`
                : `<span class="pill danger">Sin boleta</span>
                   <button class="btn primary" onclick="uploadBoleta('${e.id}')">📎 Subir boleta</button>`
              }
              <button class="btn ghost" onclick="editExpense('${e.id}')">✏️ Editar</button>
              <button class="btn ghost" onclick="deleteExpense('${e.id}')">🗑️ Eliminar</button>
            </div>
          </div>
        </div>
      `).join("")}
    `;
  }

  // Acciones
  window.uploadBoleta=id=>{
    const ex=load(KEY_EXPENSES,[]);
    const i=ex.findIndex(x=>x.id===id);
    ex[i].boleta=true;
    save(KEY_EXPENSES,ex);
    markDirty();
    renderRendiciones();
  };

  window.replaceBoleta=id=>{
    markDirty();
    alert("Boleta reemplazada (demo)");
  };

  window.editExpense=id=>{
    markDirty();
    alert("Editar gasto → Requiere nuevo informe");
  };

  window.deleteExpense=id=>{
    if(!confirm("Eliminar gasto y marcar nuevo informe?"))return;
    const ex=load(KEY_EXPENSES,[]).filter(x=>x.id!==id);
    save(KEY_EXPENSES,ex);
    markDirty();
    renderRendiciones();
  };

  function go(tab){
    nav.forEach(b=>b.classList.remove("active"));
    document.querySelector(`[data-tab="${tab}"]`).classList.add("active");
    if(tab==="rendiciones") renderRendiciones();
  }

  nav.forEach(b=>b.onclick=()=>go(b.dataset.tab));

  // Demo data init
  if(!localStorage.getItem(KEY_EXPENSES)){
    save(KEY_EXPENSES,[
      {id:"e1",title:"Flores",amount:25000,campaign:true,boleta:false},
      {id:"e2",title:"Materiales",amount:8000,campaign:false,boleta:true}
    ]);
  }

  go("rendiciones");
})();
