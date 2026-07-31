(() => {
  'use strict';
  const isDesktop = () => window.matchMedia('(min-width:1024px)').matches;

  const icons = {
    avisos:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 13v-2Z"/><path d="M11 14v4a2 2 0 0 1-2 2H8l-2-6"/></svg>',
    apoderados:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.86"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
  };

  function item(label, icon, onClick){
    const button=document.createElement('button');
    button.type='button';
    button.className='mxDesktopNavItem apodDesktopNavItem';
    button.innerHTML=`<span class="mxDesktopIcon">${icons[icon]}</span><span>${label}</span>`;
    button.addEventListener('click',onClick);
    return button;
  }

  function setup(){
    if(!isDesktop()) return false;
    const nav=document.querySelector('#mxDesktopShell .mxDesktopNav');
    if(!nav) return false;
    const current=Array.from(nav.querySelectorAll('.mxDesktopNavItem'));
    current.forEach(node=>node.classList.remove('active'));

    let avisos=current.find(node=>node.textContent.trim().toLowerCase()==='crear avisos');
    let apoderados=current.find(node=>node.textContent.trim().toLowerCase()==='apoderados');
    const campanas=current.find(node=>node.textContent.toLowerCase().includes('campañas'));

    if(!avisos){
      avisos=item('Crear avisos','avisos',()=>{ location.href='/presidente.html#avisos'; });
      if(campanas?.nextSibling) nav.insertBefore(avisos,campanas.nextSibling); else nav.appendChild(avisos);
    }
    if(!apoderados){
      apoderados=item('Apoderados','apoderados',()=>{});
      if(avisos.nextSibling) nav.insertBefore(apoderados,avisos.nextSibling); else nav.appendChild(apoderados);
    }
    apoderados.classList.add('active');
    apoderados.setAttribute('aria-current','page');
    return true;
  }

  function start(){
    if(!isDesktop()) return;
    let attempts=0;
    const run=()=>{
      attempts+=1;
      if(setup() || attempts>=20) return;
      setTimeout(run,150);
    };
    run();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
