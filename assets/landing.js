(function(){
  const toggle = document.getElementById("billingToggle");
  const prices = Array.from(document.querySelectorAll(".priceVal"));

  function formatCLP(n){
    const v = Number(n||0);
    return "$" + v.toLocaleString("es-CL");
  }

  function apply(isYear){
    prices.forEach(el=>{
      const val = isYear ? el.getAttribute("data-year") : el.getAttribute("data-month");
      el.textContent = formatCLP(val);
    });
  }

  if(toggle){
    toggle.onclick = ()=>{
      const on = toggle.classList.toggle("on");
      toggle.setAttribute("aria-pressed", on ? "true" : "false");
      apply(on);
    };
    apply(false);
  }
})();
