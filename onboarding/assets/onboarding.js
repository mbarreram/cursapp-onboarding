alert("onboarding.js ejecutado");

document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("app");

  if (!root) {
    alert("ERROR: #app no existe");
    return;
  }

  root.innerHTML = `
    <div class="card" style="margin-top:16px">
      <h2>Onboarding activo</h2>
      <p>El JS se ejecutó correctamente.</p>
    </div>
  `;
});
