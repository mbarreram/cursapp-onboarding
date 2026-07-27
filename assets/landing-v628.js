(function(){
  const btn=document.querySelector('[data-menu-btn]');
  const menu=document.querySelector('[data-mobile-menu]');
  if(btn&&menu)btn.addEventListener('click',()=>menu.classList.toggle('open'));

  document.querySelectorAll('a[href^="/recursos/"]').forEach(a=>{
    const href=a.getAttribute('href')||'';
    a.setAttribute('href',href.replace(/^\/recursos\//,'/recursos/index.html'));
  });
  document.querySelectorAll('a[href^="/legal/"]').forEach(a=>{
    const href=a.getAttribute('href')||'';
    a.setAttribute('href',href.replace(/^\/legal\//,'/legal/index.html'));
  });

  if(!document.querySelector('link[data-micursox-landing-v3]')){
    const landingCss=document.createElement('link');
    landingCss.rel='stylesheet';
    landingCss.href='/assets/landing-micursox-v3.css?v=2';
    landingCss.dataset.micursoxLandingV3='1';
    document.head.appendChild(landingCss);
  }
  if(!document.querySelector('link[data-micursox-brand]')){
    const css=document.createElement('link');css.rel='stylesheet';css.href='/assets/micursox-brand.css?v=4';css.dataset.micursoxBrand='1';document.head.appendChild(css);
  }
  if(!document.querySelector('script[data-micursox-brand]')){
    const js=document.createElement('script');js.src='/assets/micursox-brand.js?v=4';js.defer=true;js.dataset.micursoxBrand='1';document.head.appendChild(js);
  }
})();
