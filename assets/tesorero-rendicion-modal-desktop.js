(function(){
  if(!window.matchMedia || !window.matchMedia('(min-width:1024px)').matches) return;

  function markRendicionModal(){
    var root=document.getElementById('modalRoot');
    if(!root) return;

    var candidates=Array.from(root.querySelectorAll('div'));
    var card=candidates.find(function(el){
      var txt=(el.textContent||'').toLowerCase();
      var hasTitle=txt.includes('agregar rendición') || txt.includes('nueva rendición');
      var hasFields=!!el.querySelector('input[type="file"]') && !!el.querySelector('textarea') && !!el.querySelector('input[inputmode="numeric"], input[type="number"]');
      return hasTitle || hasFields;
    });
    if(!card) return;

    // Elegir el contenedor visual más cercano que no sea el overlay de pantalla completa.
    var visual=card;
    while(visual.parentElement && visual.parentElement!==root){
      var p=visual.parentElement;
      var r=p.getBoundingClientRect();
      if(r.width < window.innerWidth*0.92 && r.height < window.innerHeight*0.98){ visual=p; }
      else break;
    }
    visual.classList.add('mxTesRendicionModal');
    var overlay=visual.parentElement;
    if(overlay && overlay!==root) overlay.classList.add('mxTesRendicionOverlay');
  }

  var root=document.getElementById('modalRoot');
  if(root){
    new MutationObserver(function(){ requestAnimationFrame(markRendicionModal); }).observe(root,{childList:true,subtree:true});
  }
  document.addEventListener('click',function(){ setTimeout(markRendicionModal,0); },true);
})();
