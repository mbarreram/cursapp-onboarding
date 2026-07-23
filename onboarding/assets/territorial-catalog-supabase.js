(function(){
  'use strict';
  const sb=window.CURSAPP_SUPABASE;
  if(!sb?.request)return;
  const DRAFT_KEY='cursapp_onb_draft_v1';
  let regions=[],communes=[],schools=[];
  let loadedCommune='';
  let applying=false;

  const readDraft=()=>{try{return JSON.parse(localStorage.getItem(DRAFT_KEY)||'{}')}catch(_){return{}}};
  const saveDraft=patch=>{try{const d={...readDraft(),...patch};localStorage.setItem(DRAFT_KEY,JSON.stringify(d));return d}catch(_){return patch}};

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

  async function loadTerritories(){
    const [r,c]=await Promise.all([
      sb.request('regiones?select=codigo,nombre,nombre_corto,orden&activa=eq.true&order=orden.asc'),
      sb.request('comunas?select=codigo,region_codigo,nombre&activa=eq.true&order=nombre.asc')
    ]);
    regions=Array.isArray(r)?r:[];
    communes=Array.isArray(c)?c:[];
  }

  async function loadSchoolsForCommune(communeCode){
    const code=String(communeCode||'');
    if(!code){schools=[];loadedCommune='';return schools;}
    if(loadedCommune===code)return schools;
    const result=await sb.request(
      'colegios?select=id,nombre,nombre_oficial,rbd,region_codigo,comuna_codigo,catalogo_oficial,estado_establecimiento'+
      '&comuna_codigo=eq.'+encodeURIComponent(code)+
      '&order=nombre.asc'
    );
    schools=(Array.isArray(result)?result:[]).filter(row=>row.estado_establecimiento==null||Number(row.estado_establecimiento)===1);
    loadedCommune=code;
    return schools;
  }

  function selectedTerritory(){
    const d=readDraft();
    const regionSel=findSelect('region');
    const communeSel=findSelect('commune');
    let regionCode=regions.some(r=>r.codigo===String(d.regionId||''))?String(d.regionId):'';
    if(!regionCode&&regions.some(r=>r.codigo===String(regionSel?.value||'')))regionCode=String(regionSel.value);
    if(!regionCode)regionCode='13';
    const region=regions.find(r=>r.codigo===regionCode)||regions[0]||null;
    const availableCommunes=communes.filter(c=>c.region_codigo===region?.codigo);
    let communeCode=availableCommunes.some(c=>c.codigo===String(d.comunaId||''))?String(d.comunaId):'';
    if(!communeCode&&availableCommunes.some(c=>c.codigo===String(communeSel?.value||'')))communeCode=String(communeSel.value);
    const commune=availableCommunes.find(c=>c.codigo===communeCode)||null;
    return{region,availableCommunes,commune};
  }

  async function apply(){
    if(applying||!regions.length)return;
    const regionSel=findSelect('region');
    const communeSel=findSelect('commune');
    const schoolSel=findSelect('school');
    if(!regionSel||!communeSel)return;
    applying=true;
    try{
      const d=readDraft();
      const {region,availableCommunes,commune}=selectedTerritory();
      if(!region)return;
      setOptions(regionSel,regions,'codigo','nombre','Selecciona una región',region.codigo);
      setOptions(communeSel,availableCommunes,'codigo','nombre','Selecciona una comuna',commune?.codigo||'');

      if(schoolSel){
        if(commune&&loadedCommune!==commune.codigo){
          schoolSel.disabled=true;
          setOptions(schoolSel,[],'id','nombre','Cargando colegios…','');
          await loadSchoolsForCommune(commune.codigo);
        }else if(!commune){
          schools=[];loadedCommune='';
        }
        const current=schools.some(s=>String(s.id)===String(d.schoolId||''))?String(d.schoolId):'';
        const placeholder=commune?(schools.length?'Selecciona un colegio':'No hay colegios cargados en esta comuna'):'Selecciona primero una comuna';
        setOptions(schoolSel,schools,'id','nombre',placeholder,current);
      }

      saveDraft({
        regionId:region.codigo,
        regionName:region.nombre,
        comunaId:commune?.codigo||'',
        comunaName:commune?.nombre||'',
        ...(commune?{}:{schoolId:'',schoolName:'',schoolRbd:''})
      });
      regionSel.dataset.territorialReady='1';
      communeSel.dataset.territorialReady='1';
      if(schoolSel)schoolSel.dataset.territorialReady='1';
    }catch(err){
      console.error('Catálogo territorial Cursapp',err);
      const schoolSel=findSelect('school');
      if(schoolSel)setOptions(schoolSel,[],'id','nombre','No fue posible cargar colegios','');
    }finally{applying=false}
  }

  document.addEventListener('change',async e=>{
    const select=e.target instanceof HTMLSelectElement?e.target:null;
    const kind=fieldKind(select);
    if(!kind)return;

    if(kind==='region'){
      const r=regions.find(x=>x.codigo===String(select.value));
      schools=[];loadedCommune='';
      saveDraft({regionId:r?.codigo||'',regionName:r?.nombre||'',comunaId:'',comunaName:'',schoolId:'',schoolName:'',schoolRbd:''});
    }else if(kind==='commune'){
      const c=communes.find(x=>x.codigo===String(select.value));
      schools=[];loadedCommune='';
      saveDraft({comunaId:c?.codigo||'',comunaName:c?.nombre||'',schoolId:'',schoolName:'',schoolRbd:''});
    }else if(kind==='school'){
      const s=schools.find(x=>String(x.id)===String(select.value));
      saveDraft({schoolId:s?.id||'',schoolName:s?.nombre||'',schoolRbd:s?.rbd||''});
    }

    e.stopImmediatePropagation();
    await apply();
  },true);

  const observer=new MutationObserver(()=>{
    clearTimeout(observer._t);
    observer._t=setTimeout(()=>{void apply()},80);
  });

  document.addEventListener('DOMContentLoaded',async()=>{
    try{
      await loadTerritories();
      observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
      await apply();
      window.CURSAPP_TERRITORIAL_CATALOG={
        regions,
        communes,
        refresh:async()=>{await loadTerritories();loadedCommune='';schools=[];await apply()}
      };
    }catch(err){console.error('Catálogo territorial Cursapp',err)}
  });
})();