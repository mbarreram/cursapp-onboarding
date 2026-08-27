(function(){
  'use strict';

  const escText=v=>String(v||'').trim();
  const clp=n=>'$'+Number(n||0).toLocaleString('es-CL');
  const canonicalUrl=id=>`${location.origin}/mercado-escolar/publicacion.html?id=${encodeURIComponent(id)}`;

  function toast(msg){
    const el=document.getElementById('toast');
    if(!el) return;
    el.textContent=msg; el.classList.add('show');
    setTimeout(()=>el.classList.remove('show'),2200);
  }

  function domPostData(id){
    const modal=document.getElementById('modal');
    const title=escText(modal?.querySelector('.v6DetailBody h2')?.textContent)||'Publicación';
    const price=escText(modal?.querySelector('.v6Price')?.textContent)||'';
    return {id,title,price};
  }

  async function loadPost(id){
    const fallback=domPostData(id);
    try{
      const sb=window.cursappSupabase || (window.initCursappSupabase&&window.initCursappSupabase());
      if(!sb) return fallback;
      const r=await sb.from('mercado_publicaciones').select('id,titulo,precio').eq('id',id).maybeSingle();
      if(r.error||!r.data) return fallback;
      return {id,title:r.data.titulo||fallback.title,price:Number(r.data.precio||0)===0?'Intercambio':clp(r.data.precio)};
    }catch(e){ return fallback; }
  }

  async function sharePost(id){
    const p=await loadPost(id);
    const url=canonicalUrl(id);
    const text=`Hola 👋\n\nVi esta publicación en Mercado Escolar MiCursoX.\n\n📦 ${p.title}${p.price?`\n💰 ${p.price}`:''}\n\n🔗 Ver publicación:\n${url}`;
    if(navigator.share){
      try{
        await navigator.share({title:`${p.title} · Mercado Escolar MiCursoX`,text});
        return;
      }catch(e){ if(e&&e.name==='AbortError') return; }
    }
    try{ await navigator.clipboard.writeText(text); toast('Enlace copiado'); }
    catch(e){ toast('No se pudo compartir. Intenta nuevamente.'); }
  }

  document.addEventListener('click',function(ev){
    const btn=ev.target.closest('[data-share]');
    if(!btn) return;
    ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
    const id=btn.getAttribute('data-share');
    if(id) sharePost(id);
  },true);

  const replacements=[
    [/Apoderado Cursapp/g,'Apoderado MiCursoX'],
    [/Vendedor Cursapp/g,'Vendedor MiCursoX'],
    [/Todo Cursapp/g,'Todo MiCursoX'],
    [/Mercado Escolar Cursapp/g,'Mercado Escolar MiCursoX'],
    [/Sin pagos dentro de Cursapp/g,'Sin pagos dentro de MiCursoX'],
    [/Debes ingresar a Cursapp/g,'Debes ingresar a MiCursoX']
  ];
  function normalize(root){
    if(!root) return;
    const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[]; while(w.nextNode()) nodes.push(w.currentNode);
    nodes.forEach(n=>{let v=n.nodeValue||''; let next=v; replacements.forEach(([re,to])=>{next=next.replace(re,to)}); if(next!==v)n.nodeValue=next;});
  }
  normalize(document.body);
  new MutationObserver(m=>m.forEach(x=>x.addedNodes.forEach(n=>{if(n.nodeType===1) normalize(n)}))).observe(document.body,{childList:true,subtree:true});
})();