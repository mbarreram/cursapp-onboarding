(function(){
  const btn=document.getElementById('hamburger');
  const nav=document.getElementById('mobileNav');
  if(btn && nav){
    btn.addEventListener('click', ()=> nav.classList.toggle('open'));
  }
})();