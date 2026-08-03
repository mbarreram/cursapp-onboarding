(function(){
  'use strict';

  /* Sustituye completamente la implementación territorial anterior. */
  window.__MICURSOX_TERRITORIAL_STABLE__ = true;
  if(window.__MICURSOX_TERRITORIAL_V2__) return;
  window.__MICURSOX_TERRITORIAL_V2__ = true;

  const DRAFT_KEY = 'cursapp_onb_draft_v1';
  const REQUEST_TIMEOUT_MS = 10000;
  const REGION_FALLBACK = [
    ['15','Región de Arica y Parinacota'],['01','Región de Tarapacá'],
    ['02','Región de Antofagasta'],['03','Región de Atacama'],
    ['04','Región de Coquimbo'],['05','Región de Valparaíso'],
    ['13','Región Metropolitana de Santiago'],
    ['06',"Región del Libertador General Bernardo O'Higgins"],
    ['07','Región del Maule'],['16','Región de Ñuble'],
    ['08','Región del Biobío'],['09','Región de La Araucanía'],
    ['14','Región de Los Ríos'],['10','Región de Los Lagos'],
    ['11','Región Aysén del General Carlos Ibáñez del Campo'],
    ['12','Región de Magallanes y de la Antártica Chilena']
  ].map((item,index)=>({codigo:item[0],nombre:item[1],orden:index+1}));

  let regions = [];
  let communes = [];
  let rendering = false;
  let searchTimer = null;
  let searchSequence = 0;

  const clean = value => String(value == null ? '' : value).trim();
  const readDraft = () => {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); }
    catch (_) { return {}; }
  };
  const writeDraft = patch => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(Object.assign({}, readDraft(), patch || {})));
    } catch (_) {}
  };
  const esc = value => clean(value).replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));

  function config(){
    const current = window.CURSAPP_SUPABASE;
    if(!current || !current.url || !current.publishableKey){
      throw new Error('Configuración pública de Supabase no disponible');
    }
    return current;
  }

  async function publicGet(path){
    const current = config();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(
        current.url + '/rest/v1/' + clean(path).replace(/^\/+/, ''),
        {
          method:'GET',
          cache:'no-store',
          signal:controller.signal,
          headers:{
            apikey:current.publishableKey,
            Authorization:'Bearer ' + current.publishableKey,
            Accept:'application/json',
            'Cache-Control':'no-cache'
          }
        }
      );
      const text = await response.text();
      let payload = [];
      try { payload = text ? JSON.parse(text) : []; }
      catch (_) { payload = []; }
      if(!response.ok){
        throw new Error((payload && (payload.message || payload.error || payload.details)) || ('HTTP ' + response.status));
      }
      return Array.isArray(payload) ? payload : [];
    } finally {
      clearTimeout(timer);
    }
  }

  function regionSelect(){ return document.getElementById('onbRegion'); }
  function communeSelect(){ return document.getElementById('onbComuna'); }
  function schoolSelect(){ return document.getElementById('onbSchool'); }

  function setOptions(select, rows, placeholder, selected, disabled){
    if(!select) return;
    const value = clean(selected);
    const fragment = document.createDocumentFragment();
    fragment.appendChild(new Option(placeholder, ''));
    rows.forEach(row => fragment.appendChild(new Option(clean(row.nombre), clean(row.codigo))));
    select.replaceChildren(fragment);
    select.disabled = Boolean(disabled);
    select.value = rows.some(row => clean(row.codigo) === value) ? value : '';
  }

  function resetSchoolState(){
    writeDraft({
      schoolId:'', schoolName:'', schoolRbd:'', schoolDependencia:'', schoolDireccion:''
    });
    const select = schoolSelect();
    if(select) select.replaceChildren(new Option('Selecciona un colegio', '', true, true));
    const host = document.getElementById('onbSchoolFinderV2');
    if(host){
      host.querySelector('.onbSchoolSearchWrap').style.display = 'block';
      host.querySelector('.onbSchoolSelected').classList.remove('isVisible');
      host.querySelector('.onbSchoolSearch').value = '';
      host.querySelector('.onbSchoolResults').style.display = 'none';
    }
  }

  function ensureSchoolFinder(){
    const select = schoolSelect();
    if(!select) return null;

    const obsolete = document.getElementById('onbSchoolFinderStable');
    if(obsolete) obsolete.remove();

    let host = document.getElementById('onbSchoolFinderV2');
    if(host) return host;

    select.style.display = 'none';
    host = document.createElement('div');
    host.id = 'onbSchoolFinderV2';
    host.className = 'onbSchoolFinder';
    host.innerHTML = '<div class="onbSchoolSearchWrap">' +
      '<span class="onbSchoolSearchIcon">🔎</span>' +
      '<input class="onbSchoolSearch" type="search" autocomplete="off" placeholder="Buscar colegio por nombre o RBD">' +
      '<button class="onbSchoolClear" type="button">×</button>' +
      '<div class="onbSchoolResults"></div></div>' +
      '<div class="onbSchoolSelected"></div>' +
      '<button class="onbSchoolMissing" type="button">No encuentro mi colegio</button>' +
      '<div class="muted onbSchoolHint">Selecciona primero una comuna.</div>';

    select.parentElement.insertAdjacentElement('afterend', host);

    const input = host.querySelector('.onbSchoolSearch');
    input.addEventListener('input', () => {
      clearTimeout(searchTimer);
      const term = input.value.trim();
      if(term.length < 2){
        host.querySelector('.onbSchoolResults').style.display = 'none';
        return;
      }
      searchTimer = setTimeout(() => searchSchools(term), 250);
    });
    host.querySelector('.onbSchoolClear').addEventListener('click', resetSchoolState);
    host.querySelector('.onbSchoolMissing').addEventListener('click', () => {
      alert('Puedes solicitar la incorporación del colegio desde soporte MiCursoX.');
    });
    return host;
  }

  function updateSchoolFinder(communeCode){
    const host = ensureSchoolFinder();
    if(!host) return;
    const enabled = Boolean(clean(communeCode));
    host.querySelector('.onbSchoolSearch').disabled = !enabled;
    host.querySelector('.onbSchoolMissing').disabled = !enabled;
    host.querySelector('.onbSchoolHint').textContent = enabled
      ? 'Escribe al menos 2 caracteres del nombre o RBD.'
      : 'Selecciona primero una comuna.';
  }

  async function searchSchools(term){
    const draft = readDraft();
    const communeCode = clean(draft.comunaId);
    const host = ensureSchoolFinder();
    if(!host || !communeCode) return;

    const sequence = ++searchSequence;
    const results = host.querySelector('.onbSchoolResults');
    const hint = host.querySelector('.onbSchoolHint');
    hint.textContent = 'Buscando colegios oficiales…';

    try {
      const normalized = term.trim();
      const encoded = encodeURIComponent(normalized);
      let filter = 'nombre.ilike.*' + encoded + '*';
      if(/^\d+$/.test(normalized)) filter += ',rbd.eq.' + encodeURIComponent(normalized);

      const rows = await publicGet(
        'colegios?select=id,nombre,rbd,dependencia_nombre,direccion,comuna' +
        '&comuna_codigo=eq.' + encodeURIComponent(communeCode) +
        '&order=nombre.asc&limit=60&or=(' + filter + ')'
      );
      if(sequence !== searchSequence) return;

      results.innerHTML = rows.length ? rows.map(row =>
        '<button type="button" class="onbSchoolResult" data-id="' + esc(row.id) + '">' +
        '<b>' + esc(row.nombre) + '</b>' +
        '<small>RBD ' + esc(row.rbd || '—') + (row.dependencia_nombre ? ' · ' + esc(row.dependencia_nombre) : '') + '</small>' +
        '</button>'
      ).join('') : '<div style="padding:14px;color:#64748b">Sin resultados.</div>';

      results.style.display = 'block';
      hint.textContent = rows.length ? 'Selecciona tu establecimiento oficial.' : 'No se encontraron coincidencias.';
      results.querySelectorAll('button').forEach((button,index) => {
        button.addEventListener('click', () => chooseSchool(rows[index]));
      });
    } catch (error) {
      console.warn('Colegios MiCursoX', error);
      results.style.display = 'none';
      hint.textContent = 'No fue posible consultar colegios. Intenta nuevamente.';
    }
  }

  function chooseSchool(row){
    if(!row) return;
    const select = schoolSelect();
    const host = ensureSchoolFinder();
    if(!select || !host) return;

    select.replaceChildren(new Option(clean(row.nombre), clean(row.id), true, true));
    select.value = clean(row.id);
    const patch = {
      schoolId:clean(row.id), schoolName:clean(row.nombre), schoolRbd:clean(row.rbd),
      schoolDependencia:clean(row.dependencia_nombre), schoolDireccion:clean(row.direccion)
    };
    writeDraft(patch);

    host.querySelector('.onbSchoolSelected').innerHTML =
      '<div class="onbSchoolSelectedTop"><div class="onbSchoolBadge">🏫</div><div>' +
      '<div class="onbSchoolSelectedName">' + esc(row.nombre) + '</div>' +
      '<div class="onbSchoolMeta">RBD ' + esc(row.rbd || '—') + '</div>' +
      '<button type="button" class="onbSchoolChange">Cambiar colegio</button>' +
      '</div></div>';
    host.querySelector('.onbSchoolSelected').classList.add('isVisible');
    host.querySelector('.onbSchoolSearchWrap').style.display = 'none';
    host.querySelector('.onbSchoolChange').addEventListener('click', resetSchoolState);

    select.dispatchEvent(new Event('change', {bubbles:true}));
    setTimeout(() => writeDraft(patch), 0);
  }

  function render(){
    if(rendering) return;
    const region = regionSelect();
    const commune = communeSelect();
    if(!region || !commune || !regions.length || !communes.length) return;

    rendering = true;
    try {
      const draft = readDraft();
      let regionCode = clean(draft.regionId || region.value);
      if(!regions.some(row => clean(row.codigo) === regionCode)) regionCode = '';
      setOptions(region, regions, 'Selecciona una región', regionCode, false);

      const matching = regionCode
        ? communes.filter(row => clean(row.region_codigo) === regionCode)
        : [];
      let communeCode = clean(draft.comunaId || commune.value);
      if(!matching.some(row => clean(row.codigo) === communeCode)) communeCode = '';
      setOptions(
        commune,
        matching,
        regionCode ? 'Selecciona una comuna' : 'Selecciona primero una región',
        communeCode,
        !regionCode
      );

      const regionRow = regions.find(row => clean(row.codigo) === regionCode);
      const communeRow = matching.find(row => clean(row.codigo) === communeCode);
      writeDraft({
        regionId:regionCode,
        regionName:clean(regionRow && regionRow.nombre),
        comunaId:communeCode,
        comunaName:clean(communeRow && communeRow.nombre)
      });
      updateSchoolFinder(communeCode);
    } finally {
      rendering = false;
    }
  }

  document.addEventListener('change', event => {
    const target = event.target;
    if(!(target instanceof HTMLSelectElement)) return;

    if(target.id === 'onbRegion'){
      event.preventDefault();
      event.stopImmediatePropagation();
      const code = clean(target.value);
      const row = regions.find(item => clean(item.codigo) === code);
      writeDraft({
        regionId:code, regionName:clean(row && row.nombre),
        comunaId:'', comunaName:'',
        schoolId:'', schoolName:'', schoolRbd:'', schoolDependencia:'', schoolDireccion:''
      });
      resetSchoolState();
      render();
    } else if(target.id === 'onbComuna'){
      event.preventDefault();
      event.stopImmediatePropagation();
      const code = clean(target.value);
      const row = communes.find(item => clean(item.codigo) === code);
      writeDraft({
        comunaId:code, comunaName:clean(row && row.nombre),
        schoolId:'', schoolName:'', schoolRbd:'', schoolDependencia:'', schoolDireccion:''
      });
      resetSchoolState();
      render();
    }
  }, true);

  async function start(){
    try {
      const result = await Promise.all([
        publicGet('regiones?select=codigo,nombre,orden&order=orden.asc'),
        publicGet('comunas?select=codigo,region_codigo,nombre&order=nombre.asc')
      ]);
      regions = result[0].length === 16 ? result[0] : REGION_FALLBACK;
      communes = result[1];
      if(communes.length < 300) throw new Error('Catálogo de comunas incompleto');
    } catch (error) {
      console.error('Catálogo territorial MiCursoX', error);
      regions = REGION_FALLBACK;
      communes = [];
      const commune = communeSelect();
      if(commune){
        setOptions(commune, [], 'No fue posible cargar comunas', '', true);
      }
      return;
    }

    render();
    const observer = new MutationObserver(() => {
      clearTimeout(observer._timer);
      observer._timer = setTimeout(render, 60);
    });
    observer.observe(document.getElementById('app') || document.body, {childList:true,subtree:true});

    window.MICURSOX_TERRITORIAL_CATALOG = {
      get regions(){ return regions.slice(); },
      get communes(){ return communes.slice(); },
      refresh:render
    };
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', start, {once:true});
  } else {
    start();
  }
})();
