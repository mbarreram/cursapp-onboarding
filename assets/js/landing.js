(function(){
  const b=document.getElementById('hamburger');
  const n=document.getElementById('mobileNav');
  if(b&&n){
    b.addEventListener('click',()=>n.classList.toggle('open'));
  }

  const carousel = document.getElementById('carousel');
  const dots = document.getElementById('dots');
  if(carousel && dots){
    const items = Array.from(carousel.querySelectorAll('.phoneShot'));
    dots.innerHTML = items.map((_,i)=>`<span class="dotI ${i===0?'active':''}"></span>`).join('');
    const dotEls = Array.from(dots.querySelectorAll('.dotI'));

    function setActive(){
      const left = carousel.scrollLeft;
      let idx = 0, best = Infinity;
      items.forEach((el,i)=>{
        const d = Math.abs(el.offsetLeft - left);
        if(d < best){ best = d; idx = i; }
      });
      dotEls.forEach((d,i)=>d.classList.toggle('active', i===idx));
    }

    carousel.addEventListener('scroll', ()=>{
      window.requestAnimationFrame(setActive);
    }, {passive:true});

    dotEls.forEach((d,i)=>{
      d.addEventListener('click', ()=>{
        items[i].scrollIntoView({behavior:'smooth', inline:'center', block:'nearest'});
      });
    });
  }
})();