(function(){
  'use strict';

  const sb=window.CURSAPP_SUPABASE;
  let hydratingId='';
  let hydratedId='';

  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));

  function draft(){
    try{return JSON.parse(localStorage.getItem('cursapp_onb_draft_v1')||'{}')}catch(_){return{}}
  }

  function selectedId(select){
    const saved=draft();
    return String(select?.value||saved.schoolId||'').trim();
  }

  function selectedNameFallback(select){
    const saved=draft();
    const option=select?.selectedOptions?.[0];
    const text=String(option?.textContent||'').trim();
    return String(saved.schoolName||((text&&text!=='Selecciona un colegio')?text:'')).trim();
  }

  function renderSelectedCard(host,row){
    const card=host.querySelector('#onbSchoolSelected');
    if(!card||!row?.id)return;
    const meta=[
      `RBD ${esc(row.rbd||'—')}`,
      row.dependencia_nombre?esc(row.dependencia_nombre):'',
      row.direccion?esc(row.direccion):''
    ].filter(Boolean).join(' · ');
    card.innerHTML=`<div class="onbSchoolSelectedTop"><div class="onbSchoolBadge">🏫</div><div style="min-width:0;flex:1"><div class="onbSchoolSelectedName">${esc(row.nombre||'Colegio seleccionado')}</div><div class="onbSchoolMeta">${meta}</div><button type="button" class="onbSchoolChange">Cambiar colegio</button></div></div>`;
    card.classList.add('isVisible');
    card.dataset.schoolId=String(row.id);
  }

  async function hydrateSelectedCard(select,host){
    const id=selectedId(select);
    if(!id)return false;
    const card=host.querySelector('#onbSchoolSelected');
    const visibleName=String(card?.querySelector('.onbSchoolSelectedName')?.textContent||'').trim();
    const isComplete=card?.classList.contains('isVisible')&&visibleName&&visibleName!=='Colegio seleccionado'&&!card.textContent.includes('RBD —');
    if(isComplete&&card.dataset.schoolId===id){hydratedId=id;return true}
    if(hydratingId===id)return false;
    hydratingId=id;
    try{
      let row=null;
      if(sb?.request){
        const rows=await sb.request(`colegios?select=id,nombre,rbd,dependencia_nombre,direccion&id=eq.${encodeURIComponent(id)}&limit=1`);
        row=Array.isArray(rows)?rows[0]:null;
      }
      if(!row){
        const saved=draft();
        row={
          id,
          nombre:selectedNameFallback(select)||'Colegio seleccionado',
          rbd:saved.schoolRbd||'',
          dependencia_nombre:saved.schoolDependencia||'',
          direccion:saved.schoolDireccion||''
        };
      }
      renderSelectedCard(host,row);
      hydratedId=id;
      return true;
    }catch(_){
      const saved=draft();
      renderSelectedCard(host,{
        id,
        nombre:selectedNameFallback(select)||'Colegio seleccionado',
        rbd:saved.schoolRbd||'',
        dependencia_nombre:saved.schoolDependencia||'',
        direccion:saved.schoolDireccion||''
      });
      return true;
    }finally{
      hydratingId='';
      requestAnimationFrame(applySchoolFinderFix);
    }
  }

  function applySchoolFinderFix(){
    const select=document.getElementById('onbSchool');
    const host=document.getElementById('onbSchoolFinder');
    if(!select||!host)return;

    const nativeWrap=select.parentElement;
    if(nativeWrap){
      nativeWrap.style.display='none';
      nativeWrap.setAttribute('aria-hidden','true');
    }

    const input=host.querySelector('#onbSchoolSearch');
    const wrap=host.querySelector('.onbSchoolSearchWrap');
    const results=host.querySelector('#onbSchoolResults');
    const hint=host.querySelector('#onbSchoolHint');
    const selected=host.querySelector('#onbSchoolSelected');
    const missing=host.querySelector('#onbSchoolMissing');
    if(!input||!wrap||!results||!hint||!selected)return;

    const id=selectedId(select);
    if(id&&hydratedId!==id)hydrateSelectedCard(select,host);

    const hasSelection=Boolean(id)&&selected.classList.contains('isVisible');
    wrap.style.display=hasSelection?'none':'block';
    if(missing)missing.style.display=hasSelection?'none':'inline-flex';

    if(hasSelection){
      hint.textContent='Colegio seleccionado correctamente.';
      return;
    }

    const term=input.value.trim();
    if(term.length<2){
      results.style.display='none';
      results.replaceChildren();
      hint.textContent='Escribe al menos 2 caracteres del nombre o el RBD.';
    }
  }

  document.addEventListener('focus',function(event){
    const input=event.target;
    if(!(input instanceof HTMLInputElement)||input.id!=='onbSchoolSearch')return;
    if(input.value.trim().length<2){
      event.stopImmediatePropagation();
      setTimeout(applySchoolFinderFix,0);
    }
  },true);

  document.addEventListener('input',function(event){
    const input=event.target;
    if(!(input instanceof HTMLInputElement)||input.id!=='onbSchoolSearch')return;
    if(input.value.trim().length<2){
      event.stopImmediatePropagation();
      applySchoolFinderFix();
    }
  },true);

  document.addEventListener('click',function(event){
    const button=event.target instanceof Element?event.target.closest('.onbSchoolChange'):null;
    if(!button)return;
    const host=document.getElementById('onbSchoolFinder');
    if(!host)return;
    const input=host.querySelector('#onbSchoolSearch');
    const wrap=host.querySelector('.onbSchoolSearchWrap');
    const selected=host.querySelector('#onbSchoolSelected');
    const missing=host.querySelector('#onbSchoolMissing');
    const results=host.querySelector('#onbSchoolResults');
    hydratedId='';
    if(wrap)wrap.style.display='block';
    if(selected){selected.classList.remove('isVisible');selected.removeAttribute('data-school-id')}
    if(missing)missing.style.display='inline-flex';
    if(input){input.value='';setTimeout(()=>input.focus(),0)}
    if(results){results.style.display='none';results.replaceChildren()}
    setTimeout(applySchoolFinderFix,20);
  },true);

  const observer=new MutationObserver(()=>requestAnimationFrame(applySchoolFinderFix));
  document.addEventListener('DOMContentLoaded',function(){
    observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','value']});
    applySchoolFinderFix();
  });
})();