(function(){
  'use strict';
  if(window.__MICURSOX_TERRITORIAL_STABLE__)return;
  window.__MICURSOX_TERRITORIAL_STABLE__=true;

  const DRAFT_KEY='cursapp_onb_draft_v1';
  const FALLBACK_REGIONS=[
    {codigo:'15',nombre:'Arica y Parinacota'},
    {codigo:'01',nombre:'Tarapacá'},
    {codigo:'02',nombre:'Antofagasta'},
    {codigo:'03',nombre:'Atacama'},
    {codigo:'04',nombre:'Coquimbo'},
    {codigo:'05',nombre:'Valparaíso'},
    {codigo:'13',nombre:'Región Metropolitana de Santiago'},
    {codigo:'06',nombre:"Libertador General Bernardo O'Higgins"},
    {codigo:'07',nombre:'Maule'},
    {codigo:'16',nombre:'Ñuble'},
    {codigo:'08',nombre:'Biobío'},
    {codigo:'09',nombre:'La Araucanía'},
    {codigo:'14',nombre:'Los Ríos'},
    {codigo:'10',nombre:'Los Lagos'},
    {codigo:'11',nombre:'Aysén del General Carlos Ibáñez del Campo'},
    {codigo:'12',nombre:'Magallanes y de la Antártica Chilena'}
  ];

  let regions=[];
  let communes=[];
  let applying=false;
  let observer=null;

  const readDraft=()=>{try{return JSON.parse(localStorage.getItem(DRAFT_KEY)||'{}')}catch(_){return{}}};
  const writeDraft=patch=>{try{localStorage.setItem(DRAFT_KEY,JSON.stringify({...readDraft(),...patch}))}catch(_){}};
  const regionSelect=()=>document.getElementById('onbRegion');
  const communeSelect=()=>document.getElementById('onbComuna');

  async function request(path){
    if(!window.CURSAPP_SUPABASE?.request)throw new Error('Supabase no disponible');
    return window.CURSAPP_SUPABASE.request(path);
  }

  async function load(){
    try{
      const [r,c]=await Promise.all([
        request('regiones?select=codigo,nombre,orden&order=orden.asc'),
        request('comunas?select=codigo,region_codigo,nombre&order=nombre.asc')
      ]);
      regions=Array.isArray(r)&&r.length?r:FALLBACK_REGIONS;
      communes=Array.isArray(c)?c:[];
    }catch(firstError){
      try{
        const [r,c]=await Promise.all([
          request('regiones?select=codigo,nombre&order=nombre.asc'),
          request('comunas?select=codigo,region_codigo,nombre&order=nombre.asc')
        ]);
        regions=Array.isArray(r)&&r.length?r:FALLBACK_REGIONS;
        communes=Array.isArray(c)?c:[];
      }catch(secondError){
        console.error('Catálogo territorial MiCursoX',secondError||firstError);
        regions=FALLBACK_REGIONS;
        communes=[];
      }
    }
  }

  function replaceOptions(select,rows,placeholder,current){
    if(!select)return;
    const selected=String(current||'');
    const frag=document.createDocumentFragment();
    frag.appendChild(new Option(placeholder,''));
    rows.forEach(row=>frag.appendChild(new Option(String(row.nombre||''),String(row.codigo||''))));
    select.replaceChildren(frag);
    select.disabled=!rows.length;
    if(rows.some(row=>String(row.codigo)===selected))select.value=selected;
    else select.value='';
  }

  function apply(){
    if(applying)return;
    const rs=regionSelect(),cs=communeSelect();
    if(!rs||!cs)return;
    applying=true;
    try{
      const draft=readDraft();
      let regionCode=String(draft.regionId||rs.value||'');
      if(!regions.some(r=>String(r.codigo)===regionCode))regionCode='';
      replaceOptions(rs,regions,'Selecciona una región',regionCode);

      const regionCommunes=regionCode?communes.filter(c=>String(c.region_codigo)===regionCode):[];
      let communeCode=String(draft.comunaId||cs.value||'');
      if(!regionCommunes.some(c=>String(c.codigo)===communeCode))communeCode='';
      replaceOptions(cs,regionCommunes,regionCode?'Selecciona una comuna':'Selecciona primero una región',communeCode);

      const region=regions.find(r=>String(r.codigo)===regionCode);
      const commune=regionCommunes.find(c=>String(c.codigo)===communeCode);
      writeDraft({
        regionId:regionCode,
        regionName:region?.nombre||'',
        comunaId:communeCode,
        comunaName:commune?.nombre||'',
        ...(!communeCode?{schoolId:'',schoolName:'',schoolRbd:'',schoolDependencia:'',schoolDireccion:''}:{})
      });
    }finally{applying=false}
  }

  document.addEventListener('change',event=>{
    const target=event.target;
    if(!(target instanceof HTMLSelectElement))return;
    if(target.id==='onbRegion'){
      event.stopImmediatePropagation();
      const region=regions.find(r=>String(r.codigo)===String(target.value));
      writeDraft({regionId:String(target.value||''),regionName:region?.nombre||'',comunaId:'',comunaName:'',schoolId:'',schoolName:'',schoolRbd:'',schoolDependencia:'',schoolDireccion:''});
      apply();
      target.dispatchEvent(new CustomEvent('micursox:territory-change',{bubbles:true,detail:{type:'region'}}));
    }else if(target.id==='onbComuna'){
      event.stopImmediatePropagation();
      const commune=communes.find(c=>String(c.codigo)===String(target.value));
      writeDraft({comunaId:String(target.value||''),comunaName:commune?.nombre||'',schoolId:'',schoolName:'',schoolRbd:'',schoolDependencia:'',schoolDireccion:''});
      target.dispatchEvent(new CustomEvent('micursox:territory-change',{bubbles:true,detail:{type:'commune'}}));
    }
  },true);

  async function start(){
    await load();
    apply();
    observer=new MutationObserver(mutations=>{
      if(mutations.every(m=>m.target.closest?.('#onbSchoolFinder')))return;
      clearTimeout(observer._timer);
      observer._timer=setTimeout(apply,60);
    });
    observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
    window.MICURSOX_TERRITORIAL_CATALOG={regions,communes,refresh:async()=>{await load();apply()}};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
