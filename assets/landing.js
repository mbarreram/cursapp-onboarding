(function(){
  const btn=document.getElementById('hamburger');
  const nav=document.getElementById('mobileNav');
  if(btn && nav){
    btn.addEventListener('click', ()=> nav.classList.toggle('open'));
  }

  // dots for carousel
  const carousel = document.getElementById('carousel');
  const dotsWrap = document.getElementById('dots');
  if(carousel && dotsWrap){
    const items = Array.from(carousel.children);
    dotsWrap.innerHTML = items.map(()=>'<span class="dotI"></span>').join('');
    const dots = Array.from(dotsWrap.querySelectorAll('.dotI'));

    function setActive(){
      const rect = carousel.getBoundingClientRect();
      let bestIdx = 0, bestDist = 1e9;
      items.forEach((el, i)=>{
        const r = el.getBoundingClientRect();
        const mid = r.left + r.width/2;
        const dist = Math.abs((rect.left + rect.width/2) - mid);
        if(dist < bestDist){ bestDist = dist; bestIdx = i; }
      });
      dots.forEach((d,i)=>d.classList.toggle('active', i===bestIdx));
    }
    carousel.addEventListener('scroll', ()=>{ window.requestAnimationFrame(setActive); }, {passive:true});
    setActive();
  }
})();
