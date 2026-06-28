
(function(){
  const btn = document.querySelector('[data-menu-btn]');
  const menu = document.querySelector('[data-mobile-menu]');
  if(btn && menu){ btn.addEventListener('click', ()=> menu.classList.toggle('open')); }
})();
