(function(){
  'use strict';
  const sb=window.CURSAPP_SUPABASE;
  if(!sb?.request)return;
  const DRAFT_KEY='cursapp_onb_draft_v1';
  let regions=[],communes=[],schools=[];
  let applying=false;

  const readDraft=()=>{try{return JSON.parse(localStorage.getItem(DRAFT_KEY)||'{}')}catch(_){return{}}};
  const saveDraft=patch=>{try{const d={...readDraft(),...patch};localStorage.setItem(DRAFT_KEY,JSON.stringify(d));return d}catch(_){return patch}};
  const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

  function fieldKind(select){
    if(!select)return'';
    if(select.id==='onbRegion')return'region';
    if(select.id==='onbComuna')return'commune';
    if(select.id==='onbSchool')return'school';
    return'';
  }

  function findSelect(kind){
    return kind==='region'?document.getElementById('onbRegion'):
      kind==='commune'?document.getElementById('onbComuna'):
      kind==='school'?document.getElementById('onbSchool'):null;
  }

  function sameOptions(select,rows,valueField,labelField,placeholder){
    if(!select)return false;
    const expected=[['',placeholder],...rows.map(r=>[String(r[valueField]),String(r[labelField])])];
    if(select.options.length!==expected.length)return false;
    return expected.every((pair,i)=>String(select.options[i]?.value||'')===pair[0]&&String(select.options[i]?.textContent||'')===pair[1]);
  }

  function setOptions(select,rows,valueField,labelField,placeholder,current){
    if(!select)return;
    if(!sameOptions(select,rows,valueField,labelField,placeholder)){
      const frag=document.createDocumentFragment();
      const first=document.createElement('option');
      first.value='';first.textContent=placeholder;frag.appendChild(first);
      rows.forEach(r=>{
        const option=document.createElement('option');
        option.value=String(r[valueField]);
        option.textContent=String(r[labelField]);
        frag.appendChild(option);
      });
      select.replaceChildren(frag);
    }
    select.disabled=!rows.length;
    const desired=String(current||'');
    if(select.value!==desired)select.value=desired;
  }

  async function loadCatalog(){
    const [r,c,s]=await Promise.all([
      sb.request('regiones?select=codigo,nombre,nombre_corto,orden&activa=eq.true&order=orden.asc'),
      sb.request('comunas?select=codigo,region_codigo,nombre&activa=eq.true&order=nombre.asc'),
      sb.request('colegios?select=id,nombre,region,comuna,region_codigo,comuna_codigo,es_catalogo_demo&order=nombre.asc')
    ]);
    regions=Array.isArray(r)?r:[];
    communes=Array.isArray(c)?c:[];
    schools=Array.isArray(s)?s:[];
  }

  function matchingSchools(commune){
    if(!commune)return[];
    return schools.filter(s=>String(s.comuna_codigo||'')===String(commune.codigo)||(!s.comuna_codigo&&normalize(s.comuna)===normalize(commune.nombre)));
  }

  function apply(){
    if(applying||!regions.length)return;
    const regionSel=findSelect('region');
    const communeSel=findSelect('commune');
    const schoolSel=findSelect('school');
    if(!regionSel||!communeSel)return;
    applying=true;
    try{
      const d=readDraft();
      let regionCode=regions.some(r=>r.codigo===String(d.regionId||''))?String(d.regionId):'';
      if(!regionCode&&regions.some(r=>r.codigo===String(regionSel.value||'')))regionCode=String(regionSel.value);
      if(!regionCode)regionCode='13';
      const region=regions.find(r=>r.codigo===regionCode)||regions[0];
      setOptions(regionSel,regions,'codigo','nombre','Selecciona una región',region.codigo);

      const regionCommunes=communes.filter(c=>c.region_codigo===region.codigo);
      let communeCode=regionCommunes.some(c=>c.codigo===String(d.comunaId||''))?String(d.comunaId):'';
      if(!communeCode&&regionCommunes.some(c=>c.codigo===String(communeSel.value||'')))communeCode=String(communeSel.value);
      const commune=regionCommunes.find(c=>c.codigo===communeCode)||null;
      setOptions(communeSel,regionCommunes,'codigo','nombre','Selecciona una comuna',commune?.codigo||'');

      if(schoolSel){
        const available=matchingSchools(commune);
        const current=available.some(s=>String(s.id)===String(d.schoolId||''))?String(d.schoolId):'';
        setOptions(schoolSel,available,'id','nombre',commune?(available.length?'Selecciona un colegio':'No hay colegios cargados en esta comuna'):'Selecciona primero una comuna',current);
      }

      saveDraft({
        regionId:region.codigo,
        regionName:region.nombre,
        comunaId:commune?.codigo||'',
        comunaName:commune?.nombre||'',
        ...(commune?{}:{schoolId:'',schoolName:''})
      });
      regionSel.dataset.territorialReady='1';
      communeSel.dataset.territorialReady='1';
      if(schoolSel)schoolSel.dataset.territorialReady='1';
    }finally{applying=false}
  }

  document.addEventListener('change',e=>{
    const select=e.target instanceof HTMLSelectElement?e.target:null;
    const kind=fieldKind(select);
    if(!kind)return;

    if(kind==='region'){
      const r=regions.find(x=>x.codigo===String(select.value));
      saveDraft({regionId:r?.codigo||'',regionName:r?.nombre||'',comunaId:'',comunaName:'',schoolId:'',schoolName:''});
    }else if(kind==='commune'){
      const c=communes.find(x=>x.codigo===String(select.value));
      saveDraft({comunaId:c?.codigo||'',comunaName:c?.nombre||'',schoolId:'',schoolName:''});
    }else if(kind==='school'){
      const s=schools.find(x=>String(x.id)===String(select.value));
      saveDraft({schoolId:s?.id||'',schoolName:s?.nombre||''});
    }

    e.stopImmediatePropagation();
    apply();
  },true);

  const observer=new MutationObserver(()=>{
    clearTimeout(observer._t);
    observer._t=setTimeout(apply,60);
  });

  document.addEventListener('DOMContentLoaded',async()=>{
    try{
      await loadCatalog();
      observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
      apply();
      window.CURSAPP_TERRITORIAL_CATALOG={regions,communes,refresh:async()=>{await loadCatalog();apply()}};
    }catch(err){console.error('Catálogo territorial Cursapp',err)}
  });
})();