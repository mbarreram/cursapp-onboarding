(function(){
  'use strict';
  const PREVIEW_BASE='https://ngxistgymgdkoaiulfbq.supabase.co/functions/v1/mercado-share-preview';
  function txt(v){return String(v||'').trim();}
  function publicationId(){return new URL(location.href).searchParams.get('id')||'';}
  function titleText(){
    const root=document.querySelector('#publicacionRoot');
    const h=Array.from(root?.querySelectorAll('h2')||[]).find(x=>txt(x.textContent)&&txt(x.textContent)!=='Detalle del aviso');
    return txt(h?.textContent)||'Publicación';
  }
  function priceText(){return txt(document.querySelector('#publicacionRoot .bigPrice')?.textContent)||'';}
  function previewUrl(){
    const u=new URL(PREVIEW_BASE);
    u.searchParams.set('id',publicationId());
    u.searchParams.set('v',String(Date.now()));
    return u.href;
  }
  function body(){
    const price=priceText();
    return `Hola 👋\n\nVi esta publicación en Mercado Escolar MiCursoX.\n\n📦 ${titleText()}${price?`\n💰 ${price}`:''}\n\n🔗 Ver publicación:`;
  }
  async function shareNow(ev){
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    const url=previewUrl();
    const text=body();
    try{
      if(navigator.share){
        await navigator.share({title:`${titleText()} · Mercado Escolar MiCursoX`,text,url});
        return;
      }
    }catch(e){ if(e&&e.name==='AbortError') return; }
    try{
      await navigator.clipboard.writeText(`${text}\n${url}`);
      const toast=document.getElementById('toast');
      if(toast){toast.textContent='Enlace copiado';toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2200);}
    }catch(_){ }
  }
  document.addEventListener('click',function(ev){
    if(ev.target.closest('#btnShare,#btnShareTop')) shareNow(ev);
  },true);
})();
