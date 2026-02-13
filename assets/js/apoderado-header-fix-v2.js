
/* Header fix v2 Apoderado
   - Cambia título grande a 'Rol: Apoderado'
   - Inserta Alumno/a bajo el nombre del apoderado
   - Evita duplicación visual
*/
(function(){
  function getAlumno(){
    try{
      const s = JSON.parse(localStorage.getItem("cursapp_session_v1")||"{}");
      if(s.alumno) return s.alumno;
    }catch(e){}
    try{
      const demo = JSON.parse(localStorage.getItem("cursapp_demo_user")||"{}");
      return demo?.apoderado?.alumno || "";
    }catch(e){}
    return "";
  }

  function run(){
    const header = document.querySelector(".topbar .brand");
    if(!header) return;

    const h1 = header.querySelector("h1");
    if(h1){
      h1.innerText = "Rol: Apoderado";
    }

    const info = header.querySelector("div > div:last-child");
    if(!info) return;

    const alumno = getAlumno();

    // limpiar líneas duplicadas de rol
    info.querySelectorAll("div").forEach(d=>{
      if(d.innerText.toLowerCase().includes("rol: apoderado")){
        d.remove();
      }
    });

    // insertar alumno
    if(alumno && !info.innerText.includes(alumno)){
      const d = document.createElement("div");
      d.className = "muted alumnoLine";
      d.innerText = "Alumno/a: " + alumno;
      info.appendChild(d);
    }
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded", run);
  }else{
    run();
  }
})();
