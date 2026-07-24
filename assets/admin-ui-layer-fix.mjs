const header=document.querySelector('.adminTop');

function cleanDuplicateBells(){
  const headerBell=header?.querySelector('.topIcon:not(:last-child)');
  const candidates=[...document.querySelectorAll('button,[role="button"],a')];
  candidates.forEach(el=>{
    if(el===headerBell||el.closest('.adminSide')||el.closest('.adminTop'))return;
    const text=String(el.textContent||'').replace(/\s+/g,' ').trim();
    if(!text.startsWith('🔔'))return;
    const style=getComputedStyle(el);
    const rect=el.getBoundingClientRect();
    const isFloating=style.position==='fixed'||style.position==='absolute'||rect.top<180;
    if(isFloating){
      el.style.setProperty('display','none','important');
      el.setAttribute('aria-hidden','true');
      el.dataset.adminDuplicateBell='1';
    }
  });
}

function closeMenuFromBackdrop(event){
  if(!document.body.classList.contains('sideOpen'))return;
  if(event.target.closest('.adminSide')||event.target.closest('#mobileMenu'))return;
  document.body.classList.remove('sideOpen');
}

cleanDuplicateBells();
new MutationObserver(cleanDuplicateBells).observe(document.body,{childList:true,subtree:true});
document.addEventListener('click',closeMenuFromBackdrop,false);
