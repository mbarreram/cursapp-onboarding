(function(){
  const app = document.getElementById("app");
  const nav = document.querySelectorAll(".navItem");

  function renderHome(){
    app.innerHTML = `
      <div class="card">
        <div class="kTitle">Estado financiero del curso</div>
        <p class="muted">Vista general de recaudación y gastos.</p>
      </div>

      <div class="card">
        <div class="kTitle">Campañas activas</div>
        <ul>
          <li>Rifa del curso</li>
          <li>Paseo de curso</li>
        </ul>
      </div>
    `;
  }

  function renderRendiciones(){
    app.innerHTML = `
      <div class="card">
        <div class="kTitle">Rendiciones</div>
        <p class="muted">Registrar gastos del curso.</p>

        <div class="card" style="margin-top:10px">
          <strong>Gasto general</strong>
          <p class="muted">
            Gasto sin campaña, uso rápido del fondo del curso.
          </p>
          <button>Agregar gasto</button>
        </div>
      </div>
    `;
  }

  function renderInformes(){
    app.innerHTML = `
      <div class="card">
        <div class="kTitle">Informes</div>
        <p class="muted">
          Generar informe mensual para apoderados y directiva.
        </p>
        <button>Generar informe</button>
      </div>
    `;
  }

  function go(tab){
    nav.forEach(b=>b.classList.remove("active"));
    document.querySelector(`[data-tab="${tab}"]`).classList.add("active");

    if(tab==="home") renderHome();
    if(tab==="rendiciones") renderRendiciones();
    if(tab==="informes") renderInformes();
  }

  nav.forEach(b=>b.onclick=()=>go(b.dataset.tab));
  renderHome();
})();
