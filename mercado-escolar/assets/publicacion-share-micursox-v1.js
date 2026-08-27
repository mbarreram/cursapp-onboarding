(function(){
  'use strict';
  function cleanText(v){return String(v||'').trim();}
  function clpText(){return cleanText(document.querySelector('#publicacionRoot .bigPrice')?.textContent)||'';}
  function titleText(){
    const root=document.querySelector('#publicacionRoot');
    if(!root) return 'Publicación';
    const headings=Array.from(root.querySelectorAll('h2'));
    const h=headings.find(x=>cleanText(x.textContent)&&cleanText(x.textContent)!=='Detalle del aviso');
    return cleanText(h?.textContent)||'Publicación';
  }
  function shareUrl(){
    const u=new URL(location.href);
    const id=u.searchParams.get('id');
    return `${location.origin}/mercado-escolar/publicacion.html?id=${encodeURIComponent(id||'')}`;
  }
  function shareText(){
    const title=titleText();
    const price=clpText();
    return `Hola 👋\n\nVi esta publicación en Mercado Escolar MiCursoX.\n\n📦 ${title}${price?`\n💰 ${price}`:''}\n\n🔗 Ver publicación:\n${shareUrl()}`;
  }
  async function doShare(ev){
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    const title=titleText();
    const text=shareText();
    if(navigator.share){
      try{
        await navigator.share({title:`${title} · Mercado Escolar MiCursoX`,text});
        return;
      }catch(e){
        if(e && e.name==='AbortError') return;
      }
    }
    try{
      await navigator.clipboard.writeText(text);
      const toast=document.getElementById('toast');
      if(toast){toast.textContent='Enlace copiado';toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2200);}
    }catch(e){}
  }
  document.addEventListener('click',function(ev){
    const btn=ev.target.closest('#btnShare,#btnShareTop');
    if(btn) doShare(ev);
  },true);
})();