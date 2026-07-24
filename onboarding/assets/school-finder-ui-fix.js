(function(){
  'use strict';

  const sb=window.CURSAPP_SUPABASE;
  const DRAFT_KEY='cursapp_onb_draft_v1';
  let hydratingId='';
  let hydratedId='';
  let scheduled=false;

  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));

  function readDraft(){
    try{return JSON.parse(localStorage.getItem(DRAFT_KEY)||'{}')}catch(_){return{}}
  }

  function writeDraft(patch){
    try{
      const next={...readDraft(),...patch};
      localStorage.setItem(DRAFT_KEY,JSON.stringify(next));
      return next;
    }catch(_){return patch}
  }

  function selectedId(select){
    return String(select?.value||readDraft().schoolId||'').trim();
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
    if(!id||hydratingId===id)return;
    const card=host.querySelector('#onbSchoolSelected');
    const visibleName=String(card?.querySelector('.onbSchoolSelectedName')?.textContent||'').trim();
    const complete=card?.classList.contains('isVisible')&&visibleName&&visibleName!=='Colegio seleccionado'&&!card.textContent.includes('RBD —')&&card.dataset.schoolId===id;
    if(complete){hydratedId=id;return}
    hydratingId=id;
    try{
      let row=null;
      if(sb?.request){
        const rows=await sb.request(`colegios?select=id,nombre,rbd,dependencia_nombre,direccion&id=eq.${encodeURIComponent(id)}&limit=1`);
        row=Array.isArray(rows)?rows[0]:null;
      }
      if(!row){
        const saved=readDraft();
        row={id,nombre:saved.schoolName||'Colegio seleccionado',rbd:saved.schoolRbd||'',dependencia_nombre:saved.schoolDependencia||'',direccion:saved.schoolDireccion||''};
      }
      renderSelectedCard(host,row);
      hydratedId=id;
    }catch(_){
      const saved=readDraft();
      renderSelectedCard(host,{id,nombre:saved.schoolName||'Colegio seleccionado',rbd:saved.schoolRbd||'',dependencia_nombre:saved.schoolDependencia||'',direccion:saved.schoolDireccion||''});
    }finally{
      hydratingId='';
      scheduleApply();
    }
  }

  function applyFix(){
    scheduled=false;
    const select=document.getElementById('onbSchool');
    const host=document.getElementById('onbSchoolFinder');
    if(!select||!host)return;

    const nativeWrap=select.parentElement;
    if(nativeWrap){nativeWrap.style.display='none';nativeWrap.setAttribute('aria-hidden','true')}

    const input=host.querySelector('#onbSchoolSearch');
    const wrap=host.querySelector('.onbSchoolSearchWrap');
    const results=host.querySelector('#onbSchoolResults');
    const hint=host.querySelector('#onbSchoolHint');
    const selected=host.querySelector('#onbSchoolSelected');
    const missing=host.querySelector('#onbSchoolMissing');
    if(!input||!wrap||!results||!hint||!selected)return;

    const id=selectedId(select);
    if(id&&hydratedId!==id)hydrateSelectedCard(select,host);
    const hasSelection=Boolean(id)&&selected.classList.contains('isVisible')&&selected.dataset.schoolId===id;
    wrap.style.display=hasSelection?'none':'block';
    if(missing)missing.style.display=hasSelection?'none':'inline-flex';

    if(hasSelection){hint.textContent='Colegio seleccionado correctamente.';return}
    if(input.value.trim().length<2){
      results.style.display='none';
      results.replaceChildren();
      hint.textContent='Escribe al menos 2 caracteres del nombre o el RBD.';
    }
  }

  function scheduleApply(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(applyFix);
  }

  function resetSchoolSelection(event){
    const button=event.target instanceof Element?event.target.closest('.onbSchoolChange'):null;
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const select=document.getElementById('onbSchool');
    const host=document.getElementById('onbSchoolFinder');
    if(!host)return;
    const input=host.querySelector('#onbSchoolSearch');
    const wrap=host.querySelector('.onbSchoolSearchWrap');
    const selected=host.querySelector('#onbSchoolSelected');
    const missing=host.querySelector('#onbSchoolMissing');
    const results=host.querySelector('#onbSchoolResults');
    const hint=host.querySelector('#onbSchoolHint');

    writeDraft({schoolId:'',schoolName:'',schoolRbd:'',schoolDependencia:'',schoolDireccion:''});
    hydratedId='';
    hydratingId='';
    if(select){select.replaceChildren(new Option('Selecciona un colegio','',true,true));select.value=''}
    if(selected){selected.classList.remove('isVisible');selected.innerHTML='';selected.removeAttribute('data-school-id')}
    if(wrap)wrap.style.display='block';
    if(missing)missing.style.display='inline-flex';
    if(results){results.style.display='none';results.replaceChildren()}
    if(hint)hint.textContent='Escribe al menos 2 caracteres del nombre o el RBD.';
    if(input){input.value='';input.disabled=false;setTimeout(()=>input.focus(),0)}
  }

  document.addEventListener('focus',event=>{
    const input=event.target;
    if(!(input instanceof HTMLInputElement)||input.id!=='onbSchoolSearch')return;
    if(input.value.trim().length<2){event.stopImmediatePropagation();scheduleApply()}
  },true);

  document.addEventListener('input',event=>{
    const input=event.target;
    if(!(input instanceof HTMLInputElement)||input.id!=='onbSchoolSearch')return;
    if(input.value.trim().length<2){event.stopImmediatePropagation();scheduleApply()}
  },true);

  document.addEventListener('click',resetSchoolSelection,true);
  document.addEventListener('change',event=>{
    if(event.target instanceof HTMLSelectElement&&['onbRegion','onbComuna','onbSchool'].includes(event.target.id))setTimeout(scheduleApply,0);
  },false);

  const observer=new MutationObserver(mutations=>{
    const finder=document.getElementById('onbSchoolFinder');
    if(finder&&mutations.every(m=>finder.contains(m.target)))return;
    scheduleApply();
  });

  document.addEventListener('DOMContentLoaded',()=>{
    observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
    scheduleApply();
  });
})();