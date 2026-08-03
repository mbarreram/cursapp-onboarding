(function(){
  'use strict';
  if(window.__MICURSOX_TERRITORIAL_STABLE__)return;
  window.__MICURSOX_TERRITORIAL_STABLE__=true;

  const DRAFT_KEY='cursapp_onb_draft_v1';
  const FALLBACK_REGIONS=[
    {codigo:'15',nombre:'Arica y Parinacota'},{codigo:'01',nombre:'Tarapacá'},
    {codigo:'02',nombre:'Antofagasta'},{codigo:'03',nombre:'Atacama'},
    {codigo:'04',nombre:'Coquimbo'},{codigo:'05',nombre:'Valparaíso'},
    {codigo:'13',nombre:'Región Metropolitana de Santiago'},
    {codigo:'06',nombre:"Libertador General Bernardo O'Higgins"},
    {codigo:'07',nombre:'Maule'},{codigo:'16',nombre:'Ñuble'},
    {codigo:'08',nombre:'Biobío'},{codigo:'09',nombre:'La Araucanía'},
    {codigo:'14',nombre:'Los Ríos'},{codigo:'10',nombre:'Los Lagos'},
    {codigo:'11',nombre:'Aysén del General Carlos Ibáñez del Campo'},
    {codigo:'12',nombre:'Magallanes y de la Antártica Chilena'}
  ];

  let regions=[],communes=[],applying=false,observer=null,searchTimer=null,lastSearch=0,loadingRegion='';
  const readDraft=()=>{try{return JSON.parse(localStorage.getItem(DRAFT_KEY)||'{}')}catch(_){return{}}};
  const writeDraft=patch=>{try{localStorage.setItem(DRAFT_KEY,JSON.stringify({...readDraft(),...patch}))}catch(_){}};
  const regionSelect=()=>document.getElementById('onbRegion');
  const communeSelect=()=>document.getElementById('onbComuna');
  const schoolSelect=()=>document.getElementById('onbSchool');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function request(path){
    if(!window.CURSAPP_SUPABASE?.request)throw new Error('Supabase no disponible');
    return window.CURSAPP_SUPABASE.request(path);
  }

  async function load(){
    try{
      const r=await request('regiones?select=codigo,nombre,orden&order=orden.asc');
      regions=Array.isArray(r)&&r.length?r:FALLBACK_REGIONS;
    }catch(_){
      try{
        const r=await request('regiones?select=codigo,nombre&order=nombre.asc');
        regions=Array.isArray(r)&&r.length?r:FALLBACK_REGIONS;
      }catch(e){
        console.error('Regiones MiCursoX',e);regions=FALLBACK_REGIONS;
      }
    }

    try{
      const c=await request('comunas?select=codigo,region_codigo,nombre&order=nombre.asc');
      communes=Array.isArray(c)?c:[];
    }catch(e){
      console.warn('Carga global de comunas no disponible; se cargarán por región.',e);
      communes=[];
    }
  }

  async function loadCommunesForRegion(regionCode){
    const code=String(regionCode||'');
    if(!code)return [];
    const cached=communes.filter(c=>String(c.region_codigo)===code);
    if(cached.length)return cached;
    if(loadingRegion===code)return [];
    loadingRegion=code;
    const cs=communeSelect();
    if(cs){cs.disabled=true;cs.replaceChildren(new Option('Cargando comunas…','',true,true));}
    try{
      const rows=await request(`comunas?select=codigo,region_codigo,nombre&region_codigo=eq.${encodeURIComponent(code)}&order=nombre.asc`);
      const list=Array.isArray(rows)?rows:[];
      if(list.length){
        const existing=new Set(communes.map(c=>String(c.codigo)));
        list.forEach(c=>{if(!existing.has(String(c.codigo)))communes.push(c)});
      }
      return list;
    }catch(e){
      console.error('Comunas MiCursoX',e);
      return [];
    }finally{
      loadingRegion='';
    }
  }

  function replaceOptions(select,rows,placeholder,current){
    if(!select)return;
    const selected=String(current||''),frag=document.createDocumentFragment();
    frag.appendChild(new Option(placeholder,''));
    rows.forEach(row=>frag.appendChild(new Option(String(row.nombre||''),String(row.codigo||''))));
    select.replaceChildren(frag);
    select.disabled=!rows.length;
    select.value=rows.some(row=>String(row.codigo)===selected)?selected:'';
  }

  function ensureFinder(){
    const select=schoolSelect();if(!select)return null;
    let host=document.getElementById('onbSchoolFinderStable');if(host)return host;
    select.style.display='none';
    host=document.createElement('div');host.id='onbSchoolFinderStable';host.className='onbSchoolFinder';
    host.innerHTML='<div class="onbSchoolSearchWrap"><span class="onbSchoolSearchIcon">🔎</span><input id="onbSchoolSearchStable" class="onbSchoolSearch" type="search" autocomplete="off" placeholder="Buscar colegio por nombre o RBD"><button id="onbSchoolClearStable" class="onbSchoolClear" type="button">×</button><div id="onbSchoolResultsStable" class="onbSchoolResults"></div></div><div id="onbSchoolSelectedStable" class="onbSchoolSelected"></div><button id="onbSchoolMissingStable" class="onbSchoolMissing" type="button">No encuentro mi colegio</button><div id="onbSchoolHintStable" class="muted onbSchoolHint">Selecciona primero una comuna.</div>';
    select.parentElement.insertAdjacentElement('afterend',host);
    const input=host.querySelector('#onbSchoolSearchStable');
    input.addEventListener('input',()=>{clearTimeout(searchTimer);const q=input.value.trim();if(q.length<2){host.querySelector('#onbSchoolResultsStable').style.display='none';return}searchTimer=setTimeout(()=>searchSchools(q),250)});
    host.querySelector('#onbSchoolClearStable').onclick=clearSchool;
    host.querySelector('#onbSchoolMissingStable').onclick=()=>alert('Puedes solicitar la incorporación del colegio desde soporte MiCursoX.');
    document.addEventListener('click',e=>{if(!host.contains(e.target))host.querySelector('#onbSchoolResultsStable').style.display='none'});
    return host;
  }

  async function searchSchools(term){
    const d=readDraft(),host=ensureFinder();if(!host||!d.comunaId)return;
    const requestId=++lastSearch,box=host.querySelector('#onbSchoolResultsStable'),hint=host.querySelector('#onbSchoolHintStable');
    hint.textContent='Buscando colegios oficiales...';
    const q=encodeURIComponent(term.trim());
    try{
      const rows=await request(`colegios?select=id,nombre,rbd,dependencia_nombre,direccion,comuna&comuna_codigo=eq.${encodeURIComponent(d.comunaId)}&order=nombre.asc&limit=60&or=(nombre.ilike.*${q}*,rbd.ilike.*${q}*)`);
      if(requestId!==lastSearch)return;
      const list=Array.isArray(rows)?rows:[];
      box.innerHTML=list.length?list.map(r=>`<button type="button" class="onbSchoolResult" data-id="${esc(r.id)}"><b>${esc(r.nombre)}</b><small>RBD ${esc(r.rbd||'—')}${r.dependencia_nombre?' · '+esc(r.dependencia_nombre):''}</small></button>`).join(''):'<div style="padding:14px;color:#64748b">Sin resultados.</div>';
      box.style.display='block';hint.textContent=list.length?'Selecciona tu establecimiento oficial.':'No se encontraron coincidencias.';
      box.querySelectorAll('button').forEach((btn,i)=>btn.onclick=()=>chooseSchool(list[i]));
    }catch(e){hint.textContent='No fue posible consultar colegios.';box.style.display='none'}
  }

  function chooseSchool(row){
    const select=schoolSelect(),host=ensureFinder();if(!select||!host)return;
    select.replaceChildren(new Option(row.nombre,row.id,true,true));select.value=row.id;
    writeDraft({schoolId:row.id,schoolName:row.nombre,schoolRbd:row.rbd||'',schoolDependencia:row.dependencia_nombre||'',schoolDireccion:row.direccion||''});
    host.querySelector('#onbSchoolSelectedStable').innerHTML=`<div class="onbSchoolSelectedTop"><div class="onbSchoolBadge">🏫</div><div><div class="onbSchoolSelectedName">${esc(row.nombre)}</div><div class="onbSchoolMeta">RBD ${esc(row.rbd||'—')}</div><button type="button" class="onbSchoolChange">Cambiar colegio</button></div></div>`;
    host.querySelector('#onbSchoolSelectedStable').classList.add('isVisible');host.querySelector('.onbSchoolSearchWrap').style.display='none';
    host.querySelector('.onbSchoolChange').onclick=clearSchool;select.dispatchEvent(new Event('change',{bubbles:true}));
  }

  function clearSchool(){
    const select=schoolSelect(),host=ensureFinder();writeDraft({schoolId:'',schoolName:'',schoolRbd:'',schoolDependencia:'',schoolDireccion:''});
    if(select)select.replaceChildren(new Option('Selecciona un colegio','',true,true));
    if(host){host.querySelector('.onbSchoolSearchWrap').style.display='block';host.querySelector('#onbSchoolSelectedStable').classList.remove('isVisible');host.querySelector('#onbSchoolSearchStable').value='';host.querySelector('#onbSchoolHintStable').textContent=readDraft().comunaId?'Escribe al menos 2 caracteres del nombre o RBD.':'Selecciona primero una comuna.'}
  }

  function apply(){
    if(applying)return;const rs=regionSelect(),cs=communeSelect();if(!rs||!cs)return;applying=true;
    try{
      const draft=readDraft();let regionCode=String(draft.regionId||rs.value||'');
      if(!regions.some(r=>String(r.codigo)===regionCode))regionCode='';
      replaceOptions(rs,regions,'Selecciona una región',regionCode);
      const regionCommunes=regionCode?communes.filter(c=>String(c.region_codigo)===regionCode):[];
      let communeCode=String(draft.comunaId||cs.value||'');if(!regionCommunes.some(c=>String(c.codigo)===communeCode))communeCode='';
      replaceOptions(cs,regionCommunes,regionCode?(regionCommunes.length?'Selecciona una comuna':'Cargando comunas…'):'Selecciona primero una región',communeCode);
      const region=regions.find(r=>String(r.codigo)===regionCode),commune=regionCommunes.find(c=>String(c.codigo)===communeCode);
      writeDraft({regionId:regionCode,regionName:region?.nombre||'',comunaId:communeCode,comunaName:commune?.nombre||'',...(!communeCode?{schoolId:'',schoolName:'',schoolRbd:'',schoolDependencia:'',schoolDireccion:''}:{})});
      const host=ensureFinder();if(host){host.querySelector('#onbSchoolSearchStable').disabled=!communeCode;host.querySelector('#onbSchoolMissingStable').disabled=!communeCode;host.querySelector('#onbSchoolHintStable').textContent=communeCode?'Escribe al menos 2 caracteres del nombre o RBD.':'Selecciona primero una comuna.'}
      if(regionCode&&!regionCommunes.length){
        setTimeout(async()=>{await loadCommunesForRegion(regionCode);apply()},0);
      }
    }finally{applying=false}
  }

  document.addEventListener('change',async event=>{
    const target=event.target;if(!(target instanceof HTMLSelectElement))return;
    if(target.id==='onbRegion'){
      event.stopImmediatePropagation();const code=String(target.value||''),region=regions.find(r=>String(r.codigo)===code);
      writeDraft({regionId:code,regionName:region?.nombre||'',comunaId:'',comunaName:'',schoolId:'',schoolName:'',schoolRbd:'',schoolDependencia:'',schoolDireccion:''});
      clearSchool();await loadCommunesForRegion(code);apply();
    }else if(target.id==='onbComuna'){
      event.stopImmediatePropagation();const commune=communes.find(c=>String(c.codigo)===String(target.value));
      writeDraft({comunaId:String(target.value||''),comunaName:commune?.nombre||'',schoolId:'',schoolName:'',schoolRbd:'',schoolDependencia:'',schoolDireccion:''});clearSchool();apply();
    }
  },true);

  async function start(){
    await load();
    const initialRegion=String(readDraft().regionId||'');
    if(initialRegion&&!communes.some(c=>String(c.region_codigo)===initialRegion))await loadCommunesForRegion(initialRegion);
    apply();
    observer=new MutationObserver(mutations=>{if(mutations.every(m=>m.target.closest?.('#onbSchoolFinderStable')))return;clearTimeout(observer._timer);observer._timer=setTimeout(apply,60)});
    observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
    window.MICURSOX_TERRITORIAL_CATALOG={regions,communes,refresh:async()=>{await load();const code=String(readDraft().regionId||'');if(code)await loadCommunesForRegion(code);apply()}};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
