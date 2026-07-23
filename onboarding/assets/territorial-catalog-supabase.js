(function(){
  'use strict';
  const sb=window.CURSAPP_SUPABASE;
  if(!sb?.request)return;
  const DRAFT_KEY='cursapp_onb_draft_v1';
  let regions=[],communes=[],schools=[];
  let applying=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const readDraft=()=>{try{return JSON.parse(localStorage.getItem(DRAFT_KEY)||'{}')}catch(_){return{}}};
  const saveDraft=patch=>{try{const d={...readDraft(),...patch};localStorage.setItem(DRAFT_KEY,JSON.stringify(d));return d}catch(_){return patch}};
  const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

  function fieldKind(select){
    const own=normalize([select.id,select.name,select.getAttribute('aria-label')].filter(Boolean).join(' '));
    const wrap=select.closest('label,.field,.formGroup,.onbField,.card,div');
    const nearby=normalize(wrap?.textContent||'');
    const text=own+' '+nearby.slice(0,100);
    if(/region/.test(text))return'region';
    if(/comuna|ciudad/.test(text))return'commune';
    if(/colegio|establecimiento|school/.test(text))return'school';
    const values=[...select.options].map(o=>String(o.value)).join(' ');
    if(/rm-stgo|v-valpo|iv-coq/.test(values))return'commune';
    if(/sch-central|sch-santa/.test(values))return'school';
    if(/\brm\b|\bviii\b|\bix\b/.test(values))return'region';
    return'';
  }

  function findSelect(kind){return [...document.querySelectorAll('#app select')].find(s=>fieldKind(s)===kind)||null}
  function setOptions(select,rows,valueField,labelField,placeholder,current){
    if(!select)return;
    const html=[`<option value="">${esc(placeholder)}</option>`,...rows.map(r=>`<option value="${esc(r[valueField])}" ${String(r[valueField])===String(current)?'selected':''}>${esc(r[labelField])}</option>`)].join('');
    if(select.innerHTML!==html)select.innerHTML=html;
    select.disabled=!rows.length;
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
    applying=true;
    try{
      const d=readDraft();
      const regionSel=findSelect('region');
      const communeSel=findSelect('commune');
      const schoolSel=findSelect('school');
      if(!regionSel||!communeSel)return;

      let regionCode=d.regionId&&regions.some(r=>r.codigo===d.regionId)?d.regionId:(regionSel.value&&regions.some(r=>r.codigo===regionSel.value)?regionSel.value:'');
      if(!regionCode)regionCode='13';
      const region=regions.find(r=>r.codigo===regionCode)||regions[0];
      setOptions(regionSel,regions,'codigo','nombre','Selecciona una región',region.codigo);

      const regionCommunes=communes.filter(c=>c.region_codigo===region.codigo);
      let communeCode=d.comunaId&&regionCommunes.some(c=>c.codigo===d.comunaId)?d.comunaId:(communeSel.value&&regionCommunes.some(c=>c.codigo===communeSel.value)?communeSel.value:'');
      const commune=regionCommunes.find(c=>c.codigo===communeCode)||null;
      setOptions(communeSel,regionCommunes,'codigo','nombre','Selecciona una comuna',commune?.codigo||'');

      if(schoolSel){
        const available=matchingSchools(commune);
        const current=d.schoolId&&available.some(s=>String(s.id)===String(d.schoolId))?d.schoolId:'';
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
    if(!select)return;
    const kind=fieldKind(select);
    if(!kind)return;
    const d=readDraft();
    if(kind==='region'){
      const r=regions.find(x=>x.codigo===select.value);
      saveDraft({regionId:r?.codigo||'',regionName:r?.nombre||'',comunaId:'',comunaName:'',schoolId:'',schoolName:''});
    }else if(kind==='commune'){
      const c=communes.find(x=>x.codigo===select.value);
      saveDraft({comunaId:c?.codigo||'',comunaName:c?.nombre||'',schoolId:'',schoolName:''});
    }else if(kind==='school'){
      const s=schools.find(x=>String(x.id)===String(select.value));
      saveDraft({schoolId:s?.id||'',schoolName:s?.nombre||''});
    }
    setTimeout(apply,0);setTimeout(apply,80);setTimeout(apply,250);
  },true);

  const observer=new MutationObserver(()=>{clearTimeout(observer._t);observer._t=setTimeout(apply,20)});
  document.addEventListener('DOMContentLoaded',async()=>{
    try{
      await loadCatalog();
      observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
      apply();
      window.CURSAPP_TERRITORIAL_CATALOG={regions,communes,refresh:async()=>{await loadCatalog();apply()}};
    }catch(err){console.error('Catálogo territorial Cursapp',err)}
  });
})();