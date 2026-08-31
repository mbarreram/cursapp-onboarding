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
  function publicationId(){return new URL(location.href).searchParams.get('id')||'';}
  function directUrl(){return `${location.origin}/mercado-escolar/publicacion.html?id=${encodeURIComponent(publicationId())}`;}
  function imageUrl(){
    const img=document.querySelector('#publicacionRoot .publicacionHero img');
    const src=img?.currentSrc||img?.src||'';
    try{return src?new URL(src,location.origin).href:'';}catch(_){return '';}
  }
  function previewUrl(){
    const u=new URL(`${location.origin}/mercado-escolar/share`);
    u.searchParams.set('id',publicationId());
    u.searchParams.set('title',titleText());
    if(clpText()) u.searchParams.set('price',clpText());
    if(imageUrl()) u.searchParams.set('image',imageUrl());
    u.searchParams.set('v',String(Date.now()));
    return u.href;
  }
  function messageBody(){
    const title=titleText();
    const price=clpText();
    return `Hola 👋\n\nVi esta publicación en Mercado Escolar MiCursoX.\n\n📦 ${title}${price?`\n💰 ${price}`:''}\n\n🔗 Ver publicación:`;
  }
  function clipboardText(){return `${messageBody()}\n${previewUrl()}`;}
  async function doShare(ev){
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    const title=titleText();
    const text=messageBody();
    const url=previewUrl();
    if(navigator.share){
      try{
        await navigator.share({title:`${title} · Mercado Escolar MiCursoX`,text,url});
        return;
      }catch(e){
        if(e && e.name==='AbortError') return;
      }
    }
    try{
      await navigator.clipboard.writeText(clipboardText());
      const toast=document.getElementById('toast');
      if(toast){toast.textContent='Enlace copiado';toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2200);}
    }catch(e){
      try{await navigator.clipboard.writeText(directUrl());}catch(_){}
    }
  }
  document.addEventListener('click',function(ev){
    const btn=ev.target.closest('#btnShare,#btnShareTop');
    if(btn) doShare(ev);
  },true);
})();