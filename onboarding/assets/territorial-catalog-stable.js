(function(){
  'use strict';
  if(window.__MICURSOX_TERRITORIAL_STABLE__)return;
  window.__MICURSOX_TERRITORIAL_STABLE__=true;

  const DRAFT_KEY='cursapp_onb_draft_v1';
  const REQUEST_TIMEOUT_MS=6500;
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
  const FALLBACK_COMMUNES={
    '13':[
      '13101|Santiago','13102|Cerrillos','13103|Cerro Navia','13104|Conchalí','13105|El Bosque','13106|Estación Central','13107|Huechuraba','13108|Independencia','13109|La Cisterna','13110|La Florida','13111|La Granja','13112|La Pintana','13113|La Reina','13114|Las Condes','13115|Lo Barnechea','13116|Lo Espejo','13117|Lo Prado','13118|Macul','13119|Maipú','13120|Ñuñoa','13121|Pedro Aguirre Cerda','13122|Peñalolén','13123|Providencia','13124|Pudahuel','13125|Quilicura','13126|Quinta Normal','13127|Recoleta','13128|Renca','13129|San Joaquín','13130|San Miguel','13131|San Ramón','13132|Vitacura','13201|Puente Alto','13202|Pirque','13203|San José de Maipo','13301|Colina','13302|Lampa','13303|Tiltil','13401|San Bernardo','13402|Buin','13403|Calera de Tango','13404|Paine','13501|Melipilla','13502|Alhué','13503|Curacaví','13504|María Pinto','13505|San Pedro','13601|Talagante','13602|El Monte','13603|Isla de Maipo','13604|Padre Hurtado','13605|Peñaflor'
    ].map(x=>{const [codigo,nombre]=x.split('|');return{codigo,region_codigo:'13',nombre}})
  };

  let regions=[],communes=[],applying=false,observer=null,searchTimer=null,lastSearch=0;
  const loadingByRegion=new Map();
  const failedRegions=new Set();

  const readDraft=()=>{try{return JSON.parse(localStorage.getItem(DRAFT_KEY)||'{}')}catch(_){return{}}};
  const writeDraft=patch=>{try{localStorage.setItem(DRAFT_KEY,JSON.stringify({...readDraft(),...patch}))}catch(_){}};
  const regionSelect=()=>document.getElementById('onbRegion');
  const communeSelect=()=>document.getElementById('onbComuna');
  const schoolSelect=()=>document.getElementById('onbSchool');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));

  function withTimeout(promise,label){
    return Promise.race([
      promise,
      new Promise((_,reject)=>setTimeout(()=>reject(new Error(`${label||'Consulta'} excedió ${REQUEST_TIMEOUT_MS} ms`)),REQUEST_TIMEOUT_MS))
    ]);
  }

  async function request(path){
    if(!window.CURSAPP_SUPABASE?.request)throw new Error('Supabase no disponible');
    return withTimeout(Promise.resolve(window.CURSAPP_SUPABASE.request(path)),'Consulta territorial');
  }

  function mergeCommunes(rows){
    if(!Array.isArray(rows)||!rows.length)return;
    const existing=new Set(communes.map(c=>String(c.codigo)));
    rows.forEach(c=>{if(!existing.has(String(c.codigo))){communes.push(c);existing.add(String(c.codigo));}});
  }

  async function load(){
    try{
      const r=await request('regiones?select=codigo,nombre,orden&order=orden.asc');
      regions=Array.isArray(r)&&r.length?r:FALLBACK_REGIONS;
    }catch(_){
      regions=FALLBACK_REGIONS;
    }
    try{
      const c=await request('comunas?select=codigo,region_codigo,nombre&order=nombre.asc');
      communes=Array.isArray(c)?c:[];
    }catch(e){
      console.warn('Carga global de comunas no disponible; se usarán consultas regionales.',e);
      communes=[];
    }
  }

  async function loadCommunesForRegion(regionCode){
    const code=String(regionCode||'');
    if(!code)return [];
    const cached=communes.filter(c=>String(c.region_codigo)===code);
    if(cached.length)return cached;
    if(loadingByRegion.has(code))return loadingByRegion.get(code);

    const task=(async()=>{
      try{
        const rows=await request(`comunas?select=codigo,region_codigo,nombre&region_codigo=eq.${encodeURIComponent(code)}&order=nombre.asc`);
        const list=Array.isArray(rows)?rows:[];
        if(list.length){mergeCommunes(list);failedRegions.delete(code);return list;}
        throw new Error('La consulta no devolvió comunas');
      }catch(e){
        console.warn('Comunas MiCursoX',e);
        failedRegions.add(code);
        const fallback=FALLBACK_COMMUNES[code]||[];
        mergeCommunes(fallback);
        return fallback;
      }finally{
        loadingByRegion.delete(code);
      }
    })();

    loadingByRegion.set(code,task);
    return task;
  }

  function replaceOptions(select,rows,placeholder,current,disabled){
    if(!select)return;
    const selected=String(current||''),frag=document.createDocumentFragment();
    frag.appendChild(new Option(placeholder,''));
    rows.forEach(row=>frag.appendChild(new Option(String(row.nombre||''),String(row.codigo||''))));
    select.replaceChildren(frag);
    select.disabled=Boolean(disabled)||!rows.length;
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
    }catch(e){hint.textContent='No fue posible consultar colegios. Intenta nuevamente.';box.style.display='none'}
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
      replaceOptions(rs,regions,'Selecciona una región',regionCode,false);

      const regionCommunes=regionCode?communes.filter(c=>String(c.region_codigo)===regionCode):[];
      let communeCode=String(draft.comunaId||cs.value||'');
      if(!regionCommunes.some(c=>String(c.codigo)===communeCode))communeCode='';

      const isLoading=regionCode&&loadingByRegion.has(regionCode)&&!regionCommunes.length;
      const placeholder=!regionCode?'Selecciona primero una región':isLoading?'Cargando comunas…':regionCommunes.length?'Selecciona una comuna':'No fue posible cargar comunas';
      replaceOptions(cs,regionCommunes,placeholder,communeCode,isLoading||!regionCommunes.length);

      const region=regions.find(r=>String(r.codigo)===regionCode),commune=regionCommunes.find(c=>String(c.codigo)===communeCode);
      writeDraft({regionId:regionCode,regionName:region?.nombre||'',comunaId:communeCode,comunaName:commune?.nombre||'',...(!communeCode?{schoolId:'',schoolName:'',schoolRbd:'',schoolDependencia:'',schoolDireccion:''}:{})});
      const host=ensureFinder();if(host){host.querySelector('#onbSchoolSearchStable').disabled=!communeCode;host.querySelector('#onbSchoolMissingStable').disabled=!communeCode;host.querySelector('#onbSchoolHintStable').textContent=communeCode?'Escribe al menos 2 caracteres del nombre o RBD.':'Selecciona primero una comuna.'}

      if(regionCode&&!regionCommunes.length&&!loadingByRegion.has(regionCode)&&!failedRegions.has(regionCode)){
        loadCommunesForRegion(regionCode).then(apply);
      }
    }finally{applying=false}
  }

  document.addEventListener('change',async event=>{
    const target=event.target;if(!(target instanceof HTMLSelectElement))return;
    if(target.id==='onbRegion'){
      event.stopImmediatePropagation();const code=String(target.value||''),region=regions.find(r=>String(r.codigo)===code);
      writeDraft({regionId:code,regionName:region?.nombre||'',comunaId:'',comunaName:'',schoolId:'',schoolName:'',schoolRbd:'',schoolDependencia:'',schoolDireccion:''});
      clearSchool();apply();await loadCommunesForRegion(code);apply();
    }else if(target.id==='onbComuna'){
      event.stopImmediatePropagation();const commune=communes.find(c=>String(c.codigo)===String(target.value));
      writeDraft({comunaId:String(target.value||''),comunaName:commune?.nombre||'',schoolId:'',schoolName:'',schoolRbd:'',schoolDependencia:'',schoolDireccion:''});clearSchool();apply();
    }
  },true);

  async function start(){
    await load();
    const initialRegion=String(readDraft().regionId||'');
    if(initialRegion&&!communes.some(c=>String(c.region_codigo)===initialRegion)){
      apply();await loadCommunesForRegion(initialRegion);
    }
    apply();
    observer=new MutationObserver(mutations=>{if(mutations.every(m=>m.target.closest?.('#onbSchoolFinderStable')))return;clearTimeout(observer._timer);observer._timer=setTimeout(apply,80)});
    observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
    window.MICURSOX_TERRITORIAL_CATALOG={regions,communes,refresh:async()=>{failedRegions.clear();await load();const code=String(readDraft().regionId||'');if(code)await loadCommunesForRegion(code);apply()}};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
