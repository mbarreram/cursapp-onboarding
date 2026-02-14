
/* Mini patch header Apoderado
   - Mueve 'Rol activo: Apoderado' al header
   - Agrega Alumno/a bajo el nombre
*/
(function(){
  function run(){
    const header = document.querySelector(".topbar .brand");
    if(!header) return;

    // obtener datos desde storage
    let alumno = "";
    try{
      const demo = JSON.parse(localStorage.getItem("cursapp_demo_user")||"{}");
      alumno = demo?.apoderado?.alumno || "";
    }catch(e){}

    // línea actual
    const roleLine = document.getElementById("activeRolePill");
    if(roleLine){
      roleLine.remove(); // ya no va abajo
    }

    // insertar rol + alumno bajo el nombre
    const info = header.querySelector("div > div:last-child");
    if(info){
      let html = info.innerHTML;
      if(!html.includes("Rol activo")){
        html += `<div class="muted" style="font-weight:900;font-size:12px;">👥 Rol: Apoderado</div>`;
      }
      if(alumno && !html.includes(alumno)){
        html += `<div class="muted" style="font-weight:800;font-size:12px;">Alumno/a: ${alumno}</div>`;
      }
      info.innerHTML = html;
    }
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded", run);
  }else{
    run();
  }
})();
