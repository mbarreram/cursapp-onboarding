(function(){
  'use strict';
  if(window.__MICURSOX_BRAND_V3__)return;
  window.__MICURSOX_BRAND_V3__=true;
  const LOGO='/assets/brand/micursox-compact.svg';
  const ICON='/assets/brand/micursox-isotype.svg';
  const replacements=[[/\bCursapp\b/g,'MiCursoX'],[/\bCURSAPP\b/g,'MiCursoX']];

  function replaceText(root){
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(n){
      if(!n.nodeValue||!/(Cursapp|CURSAPP)/.test(n.nodeValue))return NodeFilter.FILTER_REJECT;
      const p=n.parentElement;
      if(!p||/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/.test(p.tagName))return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }});
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(n=>{let v=n.nodeValue;replacements.forEach(([r,t])=>v=v.replace(r,t));n.nodeValue=v});
  }

  function setFullLogo(el){
    if(!el||el.dataset.micursoxLogo==='full')return;
    el.dataset.micursoxLogo='full';
    el.innerHTML='<img class="mx-app-wordmark" src="'+LOGO+'" alt="MiCursoX">';
    el.classList.add('micursox-brand','mx-app-brand');
    el.setAttribute('aria-label','MiCursoX');
  }

  function setIcon(el){
    if(!el||el.dataset.micursoxLogo==='icon')return;
    el.dataset.micursoxLogo='icon';
    el.textContent='';
    el.innerHTML='<img class="mx-app-isotype" src="'+ICON+'" alt="MiCursoX">';
    el.classList.add('mx-isotype-holder','mx-brand-presence');
    el.setAttribute('aria-label','MiCursoX');
  }

  function isTopPresenceCandidate(el){
    if(!el||el.closest('.landing-header,.footer,.bottom-nav,.bottomNav'))return false;
    if(el.matches('button,a,input,select,textarea'))return false;
    const r=el.getBoundingClientRect();
    if(r.top>320||r.bottom<0||r.width<34||r.height<34||r.width>130||r.height>130)return false;
    return true;
  }

  function brandPresenceMarks(){
    const selectors='[class*="avatar" i],[class*="profilePic" i],[class*="profile-pic" i],[class*="userIcon" i],[class*="user-icon" i],[class*="marketLogo" i],[class*="market-logo" i],[class*="brandIcon" i],[class*="brand-icon" i]';
    document.querySelectorAll(selectors).forEach(el=>{
      if(!isTopPresenceCandidate(el)||el.dataset.micursoxLogo)return;
      const text=(el.textContent||'').replace(/\s+/g,'').trim();
      if(/^[A-ZÁÉÍÓÚÑ]$/i.test(text)||/[🛍️🎒🏪]/u.test(text)||el.className.toString().toLowerCase().includes('market'))setIcon(el);
    });

    document.querySelectorAll('header div,header span,.appHeader div,.roleHeader div,.profileHeader div,.marketHeader div,.market-header div').forEach(el=>{
      if(!isTopPresenceCandidate(el)||el.dataset.micursoxLogo||el.children.length>1)return;
      const text=(el.textContent||'').replace(/\s+/g,'').trim();
      if(/^[A-ZÁÉÍÓÚÑ]$/i.test(text)||/^[🛍️🎒🏪]$/u.test(text))setIcon(el);
    });
  }

  function brandStructuredHeaders(){
    document.querySelectorAll('.onbBrand,a.brand,.appBrand,.headerBrand,.topBrand').forEach(el=>{
      if(el.closest('.landing-header,.footer'))return;
      setFullLogo(el);
    });

    document.querySelectorAll('header,nav,.topbar,.appHeader,.roleHeader,.profileHeader').forEach(scope=>{
      scope.querySelectorAll('a,div').forEach(el=>{
        if(el.dataset.micursoxLogo||el.children.length>3)return;
        const text=(el.textContent||'').replace(/\s+/g,' ').trim();
        if(!/^(Cursapp|MiCursoX)$/i.test(text))return;
        if(el.closest('button'))return;
        setFullLogo(el);
      });
    });

    document.querySelectorAll('.logo,.sideLogo,.brandMark,.appLogo,.headerLogo').forEach(el=>{
      const text=(el.textContent||'').trim();
      if(text==='C'||text==='M'||el.classList.contains('sideLogo'))setIcon(el);
    });

    brandPresenceMarks();
  }

  function apply(){
    document.documentElement.dataset.brand='micursox';
    document.title=document.title.replace(/Cursapp/gi,'MiCursoX');
    document.querySelectorAll('meta[name="description"]').forEach(m=>m.content=m.content.replace(/Cursapp/gi,'MiCursoX'));
    document.querySelectorAll('link[rel="apple-touch-icon"],link[rel="icon"]').forEach(l=>l.href=ICON);
    brandStructuredHeaders();
    replaceText(document.body);
  }

  function start(){
    apply();
    const observer=new MutationObserver(()=>requestAnimationFrame(apply));
    observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('load',apply,{once:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();