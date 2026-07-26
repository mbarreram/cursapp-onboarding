(function(){
  'use strict';
  if(window.__MICURSOX_BRAND_V4__)return;
  window.__MICURSOX_BRAND_V4__=true;
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
    if(!el)return;
    el.dataset.micursoxLogo='icon';
    el.textContent='';
    el.innerHTML='<img class="mx-app-isotype" src="'+ICON+'" alt="MiCursoX">';
    el.classList.add('mx-isotype-holder','mx-brand-presence');
    el.setAttribute('aria-label','MiCursoX');
  }

  function isTopArea(el){
    if(!el||el.closest('.landing-header,.footer,.bottom-nav,.bottomNav,.bottom-navigation'))return false;
    const header=el.closest('header,.topbar,.appHeader,.app-header,.roleHeader,.role-header,.profileHeader,.profile-header,.marketHeader,.market-header,.header');
    if(header)return true;
    const r=el.getBoundingClientRect();
    return r.bottom>0&&r.top<260;
  }

  function brandPresenceMarks(){
    const selectors=[
      '.avatar','.user-avatar','.profile-avatar','.profileAvatar','.profile-pic','.profilePic',
      '.user-icon','.userIcon','.header-avatar','.headerAvatar','.role-avatar','.roleAvatar',
      '.market-logo','.marketLogo','.market-icon','.marketIcon','.brand-icon','.brandIcon',
      '[class*="avatar" i]','[class*="market-logo" i]','[class*="marketLogo" i]'
    ].join(',');

    document.querySelectorAll(selectors).forEach(el=>{
      if(!isTopArea(el))return;
      const text=(el.textContent||'').replace(/\s+/g,'').trim();
      const cls=String(el.className||'').toLowerCase();
      if(/^[A-ZÁÉÍÓÚÑ]$/i.test(text)||/[🛍️🎒🏪]/u.test(text)||cls.includes('avatar')||cls.includes('market'))setIcon(el);
    });

    document.querySelectorAll('header div,header span,.topbar div,.appHeader div,.app-header div,.roleHeader div,.role-header div,.profileHeader div,.profile-header div,.marketHeader div,.market-header div').forEach(el=>{
      if(!isTopArea(el)||el.matches('button,a,input,select,textarea')||el.children.length>1)return;
      const text=(el.textContent||'').replace(/\s+/g,'').trim();
      if(/^[A-ZÁÉÍÓÚÑ]$/i.test(text)||/^[🛍️🎒🏪]$/u.test(text))setIcon(el);
    });
  }

  function brandStructuredHeaders(){
    document.querySelectorAll('.onbBrand,a.brand,.appBrand,.headerBrand,.topBrand').forEach(el=>{
      if(el.closest('.landing-header,.footer'))return;
      setFullLogo(el);
    });

    document.querySelectorAll('header,nav,.topbar,.appHeader,.app-header,.roleHeader,.role-header,.profileHeader,.profile-header').forEach(scope=>{
      scope.querySelectorAll('a,div').forEach(el=>{
        if(el.children.length>3)return;
        const text=(el.textContent||'').replace(/\s+/g,' ').trim();
        if(!/^(Cursapp|MiCursoX)$/i.test(text)||el.closest('button'))return;
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
    let scheduled=false;
    const observer=new MutationObserver(()=>{
      if(scheduled)return;
      scheduled=true;
      requestAnimationFrame(()=>{scheduled=false;apply()});
    });
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    window.addEventListener('load',apply,{once:true});
    setTimeout(apply,400);
    setTimeout(apply,1200);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();