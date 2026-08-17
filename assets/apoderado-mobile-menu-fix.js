(function(){
  'use strict';
  function mobile(){ return !window.matchMedia('(min-width:1024px)').matches; }
  function force(el,p,v){ try{ el.style.setProperty(p,v,'important'); }catch(_e){} }
  function ensureStyle(){
    if(document.getElementById('mx-apod-mobile-menu-style')) return;
    const s=document.createElement('style');
    s.id='mx-apod-mobile-menu-style';
    s.textContent='@media(max-width:1023px){#menuDropdown{width:min(86vw,360px)!important;max-width:360px!important;max-height:calc(100dvh - 190px)!important;height:auto!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;border-radius:22px!important;padding:14px!important;}#menuDropdown .menuPanel,#menuDropdown .menuContent,#menuDropdown .menuDrawer,#menuDropdown .menuSheet{width:100%!important;max-width:none!important;height:auto!important;min-height:0!important;display:block!important;}#menuDropdown .menuSection,#menuDropdown section{margin:0 0 14px!important;padding:0!important;}#menuDropdown .menuTitle,#menuDropdown h2,#menuDropdown h3{margin:0 0 10px!important;}#menuDropdown button,#menuDropdown a{min-height:44px!important;margin:0!important;}#menuDropdown hr{margin:10px 0!important;}#menuDropdown .menuProfile,#menuDropdown .menuUser,#menuDropdown .roleCard{margin-bottom:12px!important;padding-bottom:12px!important;}}';
    document.head.appendChild(s);
  }
  function setup(){
    if(!mobile()) return;
    ensureStyle();
    const btn=document.getElementById('menuBtn');
    const menu=document.getElementById('menuDropdown');
    if(!btn||!menu) return;
    if(btn.dataset.mxMobileMenuFix!=='2'){
      btn.dataset.mxMobileMenuFix='2';
      const toggle=function(e){
        e.preventDefault();
        e.stopImmediatePropagation();
        const open=menu.dataset.mxOpen==='1';
        if(open){
          menu.dataset.mxOpen='0';
          force(menu,'display','none');
          return;
        }
        menu.dataset.mxOpen='1';
        force(menu,'position','fixed');
        force(menu,'top','82px');
        force(menu,'right','12px');
        force(menu,'left','auto');
        force(menu,'bottom','auto');
        force(menu,'z-index','10050');
        force(menu,'display','block');
        force(menu,'visibility','visible');
        force(menu,'opacity','1');
        force(menu,'pointer-events','auto');
        force(menu,'background','#fff');
        force(menu,'border','1px solid #e2e8f0');
        force(menu,'box-shadow','0 20px 50px rgba(15,23,42,.20)');
      };
      btn.addEventListener('pointerdown',toggle,true);
      document.addEventListener('pointerdown',function(e){
        if(menu.dataset.mxOpen==='1'&&!menu.contains(e.target)&&e.target!==btn&&!btn.contains(e.target)){
          menu.dataset.mxOpen='0'; force(menu,'display','none');
        }
      },true);
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',setup,{once:true}); else setup();
  [300,900,1800].forEach(t=>setTimeout(setup,t));
})();