
/* Header fix v3 (Apoderado)
   - Título grande: "Rol: Apoderado" (en vez de "Apoderado")
   - Línea 1: Nombre apoderado (sin "· Apoderado")
   - Línea 2: "Alumno/a: <nombre>"
   - Línea 3: Colegio · Curso · Año · Jornada
   Nota: esto corre después del render original y lo reemplaza.
*/
(function(){
  const esc = (s)=>String(s??"").replace(/[&<>'"]/g,(c)=>({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[c]));

  function getDemo(){
    try{ return JSON.parse(localStorage.getItem("cursapp_demo_user")||"{}"); }catch(e){ return {}; }
  }
  function getCourse(){
    // intenta leer desde demo user o desde session
    const d = getDemo();
    if(d?.course) return d.course;
    try{
      const s = JSON.parse(localStorage.getItem("cursapp_session_v1")||"{}");
      return s.course || {};
    }catch(e){}
    return {};
  }

  function fix(){
    const brand = document.querySelector(".topbar .brand");
    if(!brand) return;

    // Cambiar título grande (primer div dentro del contenedor de texto)
    const titleEl = brand.querySelector("div:nth-child(2) > div:first-child");
    if(titleEl) titleEl.textContent = "Rol: Apoderado";

    const who = document.getElementById("whoCourseLine");
    if(!who) return;

    const demo = getDemo();
    const ap = demo.apoderado || {};
    const c = getCourse();

    const name = (ap.name || "").trim() || "Apoderado";
    const alumno = (ap.alumno || "").trim() || "—";
    const courseLine = (c.schoolName||"Colegio") + " · " + (c.level||"") + (c.letter||"") + " " + (c.year||"") + " · " + (c.jornada||"");

    who.innerHTML = `
      <div style="font-weight:950;color:#111827;">${esc(name)}</div>
      <div class="muted" style="margin-top:2px;font-weight:900;">${esc("Alumno/a: " + alumno)}</div>
      <div class="muted" style="margin-top:2px;font-weight:900;font-size:12px;">
        ${esc(courseLine)}
      </div>
    `;
  }

  function run(){
    fix();
    // por si el dashboard re-renderiza, re-aplica
    setTimeout(fix, 150);
    setTimeout(fix, 600);
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded", run);
  }else{
    run();
  }
})();
