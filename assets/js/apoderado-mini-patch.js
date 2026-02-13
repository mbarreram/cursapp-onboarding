
/* Mini patch UI Apoderado
   - Evita competencia visual cuando está "Todo al día"
   - Prioriza banner de estado + pagos pendientes
*/
(function(){
  function run(){
    // Caso: Home renderizado
    const cardNextDue = document.getElementById("cardNextDue");
    const cardPending = document.getElementById("cardPending");

    if(!cardNextDue || !cardPending) return;

    const title = cardNextDue.querySelector(".kTitle");
    if(!title) return;

    // Detectar estado "Todo al día"
    if(title.innerText.includes("Todo al día")){
      // 1) Simplificar cardNextDue
      title.innerText = "Estado de pagos";
      const amount = cardNextDue.querySelector("#homeNextDueAmount");
      if(amount){
        amount.innerText = "Sin pagos pendientes";
        amount.style.fontSize = "18px";
      }

      // Ocultar meta redundante
      cardNextDue.querySelectorAll(".muted").forEach(m=>{
        if(m.innerText.includes("Vence")) m.style.display="none";
      });

      // 2) Ajustar cardPending copy (deja solo resumen)
      const txt = document.getElementById("homePendingText");
      if(txt){
        txt.innerHTML = "No tienes pagos pendientes por ahora";
      }
    }
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded", run);
  }else{
    run();
  }
})();
