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
  function freshShareUrl(){
    const u=new URL(location.href);
    u.searchParams.set('share_preview','micursox_v1');
    return u.toString();
  }
  function shareText(){
    const title=titleText();
    const price=clpText();
    return `Hola 👋\n\nVi esta publicación en Mercado Escolar MiCursoX.\n\n📦 ${title}${price?`\n💰 ${price}`:''}\n\n🔗 Ver publicación:\n${freshShareUrl()}`;
  }
  async function doShare(ev){
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    const title=titleText();
    const url=freshShareUrl();
    const text=shareText();
    if(navigator.share){
      try{
        await navigator.share({title:`${title} · Mercado Escolar MiCursoX`,text,url});
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