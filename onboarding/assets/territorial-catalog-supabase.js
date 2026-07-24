(function(){
  'use strict';
  const sb=window.CURSAPP_SUPABASE;
  if(!sb?.request)return;

  const DRAFT_KEY='cursapp_onb_draft_v1';
  let regions=[];
  let communes=[];
  let applying=false;
  let searchTimer=null;
  let lastRequest=0;
  let searchFocused=false;

  const readDraft=()=>{try{return JSON.parse(localStorage.getItem(DRAFT_KEY)||'{}')}catch(_){return{}}};
  const saveDraft=patch=>{try{const d={...readDraft(),...patch};localStorage.setItem(DRAFT_KEY,JSON.stringify(d));return d}catch(_){return patch}};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const regionSel=()=>document.getElementById('onbRegion');
  const communeSel=()=>document.getElementById('onbComuna');
  const schoolSel=()=>document.getElementById('onbSchool');

  function sameOptions(select,rows,valueField,labelField,placeholder){
    const expected=[['',placeholder],...rows.map(r=>[String(r[valueField]),String(r[labelField])])];
    return select&&select.options.length===expected.length&&expected.every((p,i)=>String(select.options[i]?.value||'')===p[0]&&String(select.options[i]?.textContent||'')===p[1]);
  }

  function setOptions(select,rows,valueField,labelField,placeholder,current){
    if(!select)return;
    if(!sameOptions(select,rows,valueField,labelField,placeholder)){
      const frag=document.createDocumentFragment();
      const first=document.createElement('option');
      first.value='';first.textContent=placeholder;frag.appendChild(first);
      rows.forEach(r=>{const o=document.createElement('option');o.value=String(r[valueField]);o.textContent=String(r[labelField]);frag.appendChild(o)});
      select.replaceChildren(frag);
    }
    select.disabled=!rows.length;
    select.value=String(current||'');
  }

  async function loadCatalog(){
    [regions,communes]=await Promise.all([
      sb.request('regiones?select=codigo,nombre,orden&activa=eq.true&order=orden.asc'),
      sb.request('comunas?select=codigo,region_codigo,nombre&activa=eq.true&order=nombre.asc')
    ]);
    regions=Array.isArray(regions)?regions:[];
    communes=Array.isArray(communes)?communes:[];
  }

  function ensureStyles(){
    if(document.getElementById('onbSchoolFinderStyles'))return;
    const s=document.createElement('style');
    s.id='onbSchoolFinderStyles';
    s.textContent=`
      .onbSchoolFinder{margin-top:8px}.onbSchoolSearchWrap{position:relative}.onbSchoolSearch{width:100%;padding:15px 46px;border:1px solid #dbe1ea;border-radius:16px;font:inherit;background:#fff;color:#0f172a;box-sizing:border-box}.onbSchoolSearch:focus{outline:3px solid rgba(34,197,94,.16);border-color:#22c55e}.onbSchoolSearchIcon{position:absolute;left:16px;top:50%;transform:translateY(-50%);font-size:20px}.onbSchoolClear{position:absolute;right:10px;top:50%;transform:translateY(-50%);border:0;background:#eef2f7;width:34px;height:34px;border-radius:999px;font-weight:900;color:#64748b}.onbSchoolResults{display:none;position:absolute;left:0;right:0;top:calc(100% + 7px);z-index:80;background:#fff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 18px 40px rgba(15,23,42,.16);max-height:300px;overflow:auto}.onbSchoolResult{display:block;width:100%;border:0;border-bottom:1px solid #f1f5f9;background:#fff;text-align:left;padding:13px 14px}.onbSchoolResult:last-child{border-bottom:0}.onbSchoolResult b{display:block;color:#0f172a}.onbSchoolResult small{display:block;color:#64748b;margin-top:4px;line-height:1.35}.onbSchoolSelected{display:none;margin-top:12px;padding:14px;border:1px solid #bbf7d0;background:#f0fdf4;border-radius:16px}.onbSchoolSelected.isVisible{display:block}.onbSchoolSelectedTop{display:flex;gap:12px;align-items:flex-start}.onbSchoolBadge{width:44px;height:44px;border-radius:13px;background:#dcfce7;display:flex;align-items:center;justify-content:center;font-size:23px;flex:0 0 auto}.onbSchoolSelectedName{font-weight:950;color:#0f172a}.onbSchoolMeta{font-size:13px;color:#64748b;margin-top:4px}.onbSchoolChange,.onbSchoolMissing{border:0;background:transparent;color:#6d28d9;font-weight:900;padding:8px 0}.onbSchoolHint{font-size:12px;margin-top:4px}.onbMissingModal{position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:18px}.onbMissingCard{width:min(480px,100%);background:#fff;border-radius:20px;padding:18px}.onbMissingCard input{width:100%;box-sizing:border-box;padding:13px;border:1px solid #dbe1ea;border-radius:13px;font:inherit}.onbMissingActions{display:flex;gap:10px;margin-top:14px}.onbMissingActions button{flex:1;border:0;border-radius:13px;padding:12px;font-weight:900}.onbMissingCancel{background:#eef2f7}.onbMissingSend{background:#6d28d9;color:#fff}`;
    document.head.appendChild(s);
  }

  function ensureSchoolFinder(){
    const select=schoolSel();
    if(!select)return null;
    ensureStyles();
    let host=document.getElementById('onbSchoolFinder');
    if(host)return host;
    select.style.display='none';
    host=document.createElement('div');
    host.id='onbSchoolFinder';
    host.className='onbSchoolFinder';
    host.innerHTML=`<div class="onbSchoolSearchWrap"><span class="onbSchoolSearchIcon">🔎</span><input id="onbSchoolSearch" class="onbSchoolSearch" type="search" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="Buscar colegio por nombre o RBD"><button id="onbSchoolClear" class="onbSchoolClear" type="button">×</button><div id="onbSchoolResults" class="onbSchoolResults"></div></div><div id="onbSchoolSelected" class="onbSchoolSelected"></div><button id="onbSchoolMissing" class="onbSchoolMissing" type="button">No encuentro mi colegio</button><div id="onbSchoolHint" class="muted onbSchoolHint">Selecciona primero una comuna.</div>`;
    select.parentElement.insertAdjacentElement('afterend',host);
    const input=host.querySelector('#onbSchoolSearch');
    input.addEventListener('focus',()=>{searchFocused=true;if(input.value.trim().length>=2)searchSchools(input.value)});
    input.addEventListener('blur',()=>setTimeout(()=>{searchFocused=false},180));
    input.addEventListener('input',()=>{
      clearTimeout(searchTimer);
      const typed=input.value.trim();
      if(typed.length<2){
        lastRequest++;
        host.querySelector('#onbSchoolResults').style.display='none';
        host.querySelector('#onbSchoolResults').replaceChildren();
        host.querySelector('#onbSchoolHint').textContent='Escribe al menos 2 caracteres del nombre o el RBD.';
        return;
      }
      searchTimer=setTimeout(()=>searchSchools(typed),250);
    });
    host.querySelector('#onbSchoolClear').addEventListener('click',clearSchool);
    host.querySelector('#onbSchoolMissing').addEventListener('click',openMissingSchoolModal);
    document.addEventListener('click',e=>{if(!host.contains(e.target))host.querySelector('#onbSchoolResults').style.display='none'});
    return host;
  }

  async function searchSchools(term=''){
    const d=readDraft(),host=ensureSchoolFinder();
    if(!host)return;
    const box=host.querySelector('#onbSchoolResults'),hint=host.querySelector('#onbSchoolHint');
    if(!d.comunaId){hint.textContent='Selecciona primero una comuna.';box.style.display='none';return}
    const q=String(term||'').trim();
    if(q.length<2){lastRequest++;box.style.display='none';box.replaceChildren();hint.textContent='Escribe al menos 2 caracteres del nombre o el RBD.';return}
    const requestId=++lastRequest;
    hint.textContent='Buscando colegios oficiales de la comuna...';
    const path=`colegios?select=id,nombre,rbd,dependencia_nombre,direccion,comuna&comuna_codigo=eq.${encodeURIComponent(d.comunaId)}&estado_establecimiento=eq.1&catalogo_oficial=eq.true&order=nombre.asc&limit=60&or=(nombre.ilike.*${encodeURIComponent(q)}*,rbd.ilike.*${encodeURIComponent(q)}*)`;
    try{
      const rows=await sb.request(path);
      if(requestId!==lastRequest)return;
      renderSchoolResults(Array.isArray(rows)?rows:[]);
      hint.textContent=rows?.length?'Selecciona tu establecimiento oficial.':'No se encontraron coincidencias.';
    }catch(e){if(requestId!==lastRequest)return;hint.textContent='No fue posible consultar colegios.';box.style.display='none'}
  }

  function renderSchoolResults(rows){
    const host=ensureSchoolFinder(),box=host.querySelector('#onbSchoolResults');
    if(!rows.length){box.innerHTML='<div style="padding:14px;color:#64748b">Sin resultados. Prueba con parte del nombre o el RBD.</div>';box.style.display='block';return}
    box.innerHTML=rows.map(r=>`<button type="button" class="onbSchoolResult" data-school='${esc(JSON.stringify(r))}'><b>${esc(r.nombre)}</b><small>RBD ${esc(r.rbd||'—')}${r.dependencia_nombre?' · '+esc(r.dependencia_nombre):''}${r.direccion?' · '+esc(r.direccion):''}</small></button>`).join('');
    box.style.display='block';
    box.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{try{chooseSchool(JSON.parse(btn.dataset.school))}catch(_){}}));
  }

  function selectedCard(row){
    const host=ensureSchoolFinder(),card=host.querySelector('#onbSchoolSelected');
    const wrap=host.querySelector('.onbSchoolSearchWrap');
    const missing=host.querySelector('#onbSchoolMissing');
    if(!row?.id){card.classList.remove('isVisible');card.innerHTML='';wrap.style.display='block';missing.style.display='inline-flex';return}
    card.innerHTML=`<div class="onbSchoolSelectedTop"><div class="onbSchoolBadge">🏫</div><div><div class="onbSchoolSelectedName">${esc(row.nombre)}</div><div class="onbSchoolMeta">RBD ${esc(row.rbd||'—')}${row.dependencia_nombre?' · '+esc(row.dependencia_nombre):''}${row.direccion?' · '+esc(row.direccion):''}</div><button type="button" class="onbSchoolChange">Cambiar colegio</button></div></div>`;
    card.classList.add('isVisible');
    wrap.style.display='none';
    missing.style.display='none';
    card.querySelector('.onbSchoolChange').addEventListener('click',clearSchool);
  }

  function chooseSchool(row){
    const select=schoolSel(),host=ensureSchoolFinder();
    select.replaceChildren(new Option(row.nombre,row.id,true,true));
    select.value=row.id;
    host.querySelector('#onbSchoolSearch').value='';
    host.querySelector('#onbSchoolResults').style.display='none';
    host.querySelector('#onbSchoolHint').textContent='Colegio seleccionado correctamente.';
    saveDraft({schoolId:row.id,schoolName:row.nombre,schoolRbd:row.rbd||'',schoolDependencia:row.dependencia_nombre||'',schoolDireccion:row.direccion||''});
    selectedCard(row);
    select.dispatchEvent(new Event('change',{bubbles:true}));
  }

  function clearSchool(){
    const select=schoolSel(),host=ensureSchoolFinder();
    saveDraft({schoolId:'',schoolName:'',schoolRbd:'',schoolDependencia:'',schoolDireccion:''});
    if(select)select.replaceChildren(new Option('Selecciona un colegio','',true,true));
    host.querySelector('#onbSchoolSearch').value='';
    host.querySelector('#onbSchoolResults').style.display='none';
    host.querySelector('#onbSchoolResults').replaceChildren();
    selectedCard(null);
    host.querySelector('#onbSchoolHint').textContent=readDraft().comunaId?'Escribe al menos 2 caracteres del nombre o el RBD.':'Selecciona primero una comuna.';
    setTimeout(()=>host.querySelector('#onbSchoolSearch').focus(),0);
  }

  function openMissingSchoolModal(){
    const d=readDraft();
    if(!d.comunaId)return alert('Selecciona primero una comuna');
    document.getElementById('onbMissingSchoolModal')?.remove();
    const modal=document.createElement('div');
    modal.id='onbMissingSchoolModal';modal.className='onbMissingModal';
    modal.innerHTML=`<div class="onbMissingCard"><h3>Solicitar incorporación</h3><p>Indica el nombre del colegio.</p><input id="onbMissingSchoolName" placeholder="Nombre del colegio"><div class="onbMissingActions"><button class="onbMissingCancel" type="button">Cancelar</button><button class="onbMissingSend" type="button">Enviar solicitud</button></div></div>`;
    document.body.appendChild(modal);
    const input=modal.querySelector('input');setTimeout(()=>input.focus(),50);
    modal.querySelector('.onbMissingCancel').onclick=()=>modal.remove();
    modal.querySelector('.onbMissingSend').onclick=async()=>{const name=input.value.trim();if(name.length<3)return alert('Escribe un nombre válido');try{await sb.request('solicitudes_colegio',{method:'POST',body:JSON.stringify({region_codigo:d.regionId,comuna_codigo:d.comunaId,nombre_sugerido:name})});modal.remove();alert('Solicitud enviada.')}catch(e){alert('No fue posible enviar la solicitud: '+(e.message||e))}};
  }

  async function restoreSelectedSchool(){
    const d=readDraft();
    if(!d.schoolId)return selectedCard(null);
    selectedCard({id:d.schoolId,nombre:d.schoolName,rbd:d.schoolRbd,dependencia_nombre:d.schoolDependencia,direccion:d.schoolDireccion});
  }

  function apply(){
    if(applying||!regions.length)return;
    const rs=regionSel(),cs=communeSel();
    if(!rs||!cs)return;
    applying=true;
    try{
      const d=readDraft();
      let rc=regions.some(r=>r.codigo===String(d.regionId||''))?String(d.regionId):String(rs.value||'');
      if(!regions.some(r=>r.codigo===rc))rc='13';
      const region=regions.find(r=>r.codigo===rc)||regions[0];
      setOptions(rs,regions,'codigo','nombre','Selecciona una región',region.codigo);
      const list=communes.filter(c=>c.region_codigo===region.codigo);
      let cc=list.some(c=>c.codigo===String(d.comunaId||''))?String(d.comunaId):String(cs.value||'');
      if(!list.some(c=>c.codigo===cc))cc='';
      const comuna=list.find(c=>c.codigo===cc)||null;
      setOptions(cs,list,'codigo','nombre','Selecciona una comuna',comuna?.codigo||'');
      saveDraft({regionId:region.codigo,regionName:region.nombre,comunaId:comuna?.codigo||'',comunaName:comuna?.nombre||'',...(comuna?{}:{schoolId:'',schoolName:'',schoolRbd:'',schoolDependencia:'',schoolDireccion:''})});
      const host=ensureSchoolFinder();
      if(host){
        const input=host.querySelector('#onbSchoolSearch');
        input.disabled=!comuna;
        host.querySelector('#onbSchoolMissing').disabled=!comuna;
        if(!comuna){host.querySelector('#onbSchoolHint').textContent='Selecciona primero una comuna.';selectedCard(null)}
        else if(!readDraft().schoolId)host.querySelector('#onbSchoolHint').textContent='Escribe al menos 2 caracteres del nombre o el RBD.';
        if(comuna&&!searchFocused)restoreSelectedSchool();
      }
    }finally{applying=false}
  }

  document.addEventListener('change',e=>{
    const s=e.target;
    if(!(s instanceof HTMLSelectElement))return;
    if(s.id==='onbRegion'){
      const r=regions.find(x=>x.codigo===s.value);
      saveDraft({regionId:r?.codigo||'',regionName:r?.nombre||'',comunaId:'',comunaName:'',schoolId:'',schoolName:'',schoolRbd:'',schoolDependencia:'',schoolDireccion:''});
      e.stopImmediatePropagation();apply();
    }else if(s.id==='onbComuna'){
      const c=communes.find(x=>x.codigo===s.value);
      saveDraft({comunaId:c?.codigo||'',comunaName:c?.nombre||'',schoolId:'',schoolName:'',schoolRbd:'',schoolDependencia:'',schoolDireccion:''});
      e.stopImmediatePropagation();apply();clearSchool();
    }
  },true);

  const observer=new MutationObserver(mutations=>{
    const finder=document.getElementById('onbSchoolFinder');
    if(finder&&mutations.every(m=>finder.contains(m.target)))return;
    clearTimeout(observer._t);
    observer._t=setTimeout(apply,80);
  });

  document.addEventListener('DOMContentLoaded',async()=>{
    try{
      await loadCatalog();
      observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
      apply();
      window.CURSAPP_TERRITORIAL_CATALOG={regions,communes,refresh:async()=>{await loadCatalog();apply()}};
    }catch(e){console.error('Catálogo territorial Cursapp',e)}
  });
})();