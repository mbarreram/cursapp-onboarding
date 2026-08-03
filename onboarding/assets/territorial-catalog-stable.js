(function(){
  'use strict';
  if(window.__MICURSOX_TERRITORIAL_STABLE__) return;
  window.__MICURSOX_TERRITORIAL_STABLE__ = true;

  const DRAFT_KEY = 'cursapp_onb_draft_v1';
  const REQUEST_TIMEOUT_MS = 8000;
  const MAX_ATTEMPTS = 2;

  let regions = [];
  let communes = [];
  let applying = false;
  let searchTimer = null;
  let searchRequestId = 0;
  const loadingByRegion = new Map();

  const readDraft = () => {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); }
    catch (_) { return {}; }
  };

  const writeDraft = patch => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...readDraft(), ...(patch || {}) }));
    } catch (_) {}
  };

  const regionSelect = () => document.getElementById('onbRegion');
  const communeSelect = () => document.getElementById('onbComuna');
  const schoolSelect = () => document.getElementById('onbSchool');
  const clean = value => String(value ?? '').trim();
  const esc = value => clean(value).replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));

  function delay(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function publicRequest(path, attempt = 1){
    const config = window.CURSAPP_SUPABASE;
    if(!config?.url || !config?.publishableKey){
      throw new Error('Configuración pública de Supabase no disponible');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(
        `${config.url}/rest/v1/${String(path || '').replace(/^\/+/, '')}`,
        {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            apikey: config.publishableKey,
            Accept: 'application/json'
          }
        }
      );

      const text = await response.text();
      let data = null;
      try { data = text ? JSON.parse(text) : []; }
      catch (_) { data = []; }

      if(!response.ok){
        const message = data?.message || data?.error || data?.details || `HTTP ${response.status}`;
        throw new Error(message);
      }

      return Array.isArray(data) ? data : [];
    } catch (error) {
      if(attempt < MAX_ATTEMPTS){
        await delay(350 * attempt);
        return publicRequest(path, attempt + 1);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  function mergeCommunes(rows){
    const existing = new Set(communes.map(row => clean(row.codigo)));
    (Array.isArray(rows) ? rows : []).forEach(row => {
      const code = clean(row.codigo);
      if(code && !existing.has(code)){
        communes.push(row);
        existing.add(code);
      }
    });
  }

  async function loadRegions(){
    regions = await publicRequest('regiones?select=codigo,nombre,orden&order=orden.asc');
    if(!regions.length) throw new Error('Supabase no devolvió regiones');
  }

  async function loadCommunesForRegion(regionCode, force = false){
    const code = clean(regionCode);
    if(!code) return [];

    const cached = communes.filter(row => clean(row.region_codigo) === code);
    if(cached.length && !force) return cached;
    if(loadingByRegion.has(code)) return loadingByRegion.get(code);

    const task = (async () => {
      const rows = await publicRequest(
        `comunas?select=codigo,region_codigo,nombre&region_codigo=eq.${encodeURIComponent(code)}&order=nombre.asc`
      );
      if(!rows.length) throw new Error(`No se encontraron comunas para la región ${code}`);
      mergeCommunes(rows);
      return rows;
    })().finally(() => loadingByRegion.delete(code));

    loadingByRegion.set(code, task);
    return task;
  }

  function replaceOptions(select, rows, placeholder, currentValue, disabled){
    if(!select) return;
    const current = clean(currentValue);
    const fragment = document.createDocumentFragment();
    fragment.appendChild(new Option(placeholder, ''));
    rows.forEach(row => fragment.appendChild(new Option(clean(row.nombre), clean(row.codigo))));
    select.replaceChildren(fragment);
    select.disabled = Boolean(disabled);
    select.value = rows.some(row => clean(row.codigo) === current) ? current : '';
  }

  function ensureFinder(){
    const select = schoolSelect();
    if(!select) return null;

    let host = document.getElementById('onbSchoolFinderStable');
    if(host) return host;

    select.style.display = 'none';
    host = document.createElement('div');
    host.id = 'onbSchoolFinderStable';
    host.className = 'onbSchoolFinder';
    host.innerHTML = `
      <div class="onbSchoolSearchWrap">
        <span class="onbSchoolSearchIcon">🔎</span>
        <input id="onbSchoolSearchStable" class="onbSchoolSearch" type="search" autocomplete="off" placeholder="Buscar colegio por nombre o RBD">
        <button id="onbSchoolClearStable" class="onbSchoolClear" type="button">×</button>
        <div id="onbSchoolResultsStable" class="onbSchoolResults"></div>
      </div>
      <div id="onbSchoolSelectedStable" class="onbSchoolSelected"></div>
      <button id="onbSchoolMissingStable" class="onbSchoolMissing" type="button">No encuentro mi colegio</button>
      <div id="onbSchoolHintStable" class="muted onbSchoolHint">Selecciona primero una comuna.</div>`;

    select.parentElement.insertAdjacentElement('afterend', host);

    const input = host.querySelector('#onbSchoolSearchStable');
    input.addEventListener('input', () => {
      clearTimeout(searchTimer);
      const term = input.value.trim();
      if(term.length < 2){
        host.querySelector('#onbSchoolResultsStable').style.display = 'none';
        return;
      }
      searchTimer = setTimeout(() => searchSchools(term), 250);
    });

    host.querySelector('#onbSchoolClearStable').addEventListener('click', clearSchool);
    host.querySelector('#onbSchoolMissingStable').addEventListener('click', () => {
      alert('Puedes solicitar la incorporación del colegio desde soporte MiCursoX.');
    });

    document.addEventListener('click', event => {
      if(!host.contains(event.target)){
        host.querySelector('#onbSchoolResultsStable').style.display = 'none';
      }
    });

    return host;
  }

  async function searchSchools(term){
    const draft = readDraft();
    const host = ensureFinder();
    if(!host || !draft.comunaId) return;

    const requestId = ++searchRequestId;
    const box = host.querySelector('#onbSchoolResultsStable');
    const hint = host.querySelector('#onbSchoolHintStable');
    hint.textContent = 'Buscando colegios oficiales...';

    try {
      const q = encodeURIComponent(term.trim());
      const rows = await publicRequest(
        `colegios?select=id,nombre,rbd,dependencia_nombre,direccion,comuna&comuna_codigo=eq.${encodeURIComponent(draft.comunaId)}&order=nombre.asc&limit=60&or=(nombre.ilike.*${q}*,rbd.ilike.*${q}*)`
      );
      if(requestId !== searchRequestId) return;

      box.innerHTML = rows.length
        ? rows.map(row => `
            <button type="button" class="onbSchoolResult" data-id="${esc(row.id)}">
              <b>${esc(row.nombre)}</b>
              <small>RBD ${esc(row.rbd || '—')}${row.dependencia_nombre ? ` · ${esc(row.dependencia_nombre)}` : ''}</small>
            </button>`).join('')
        : '<div style="padding:14px;color:#64748b">Sin resultados.</div>';

      box.style.display = 'block';
      hint.textContent = rows.length
        ? 'Selecciona tu establecimiento oficial.'
        : 'No se encontraron coincidencias.';

      box.querySelectorAll('button').forEach((button, index) => {
        button.addEventListener('click', () => chooseSchool(rows[index]));
      });
    } catch (error) {
      console.warn('Colegios MiCursoX', error);
      hint.textContent = 'No fue posible consultar colegios. Intenta nuevamente.';
      box.style.display = 'none';
    }
  }

  function chooseSchool(row){
    const select = schoolSelect();
    const host = ensureFinder();
    if(!select || !host || !row) return;

    select.replaceChildren(new Option(clean(row.nombre), clean(row.id), true, true));
    select.value = clean(row.id);

    writeDraft({
      schoolId: clean(row.id),
      schoolName: clean(row.nombre),
      schoolRbd: clean(row.rbd),
      schoolDependencia: clean(row.dependencia_nombre),
      schoolDireccion: clean(row.direccion)
    });

    host.querySelector('#onbSchoolSelectedStable').innerHTML = `
      <div class="onbSchoolSelectedTop">
        <div class="onbSchoolBadge">🏫</div>
        <div>
          <div class="onbSchoolSelectedName">${esc(row.nombre)}</div>
          <div class="onbSchoolMeta">RBD ${esc(row.rbd || '—')}</div>
          <button type="button" class="onbSchoolChange">Cambiar colegio</button>
        </div>
      </div>`;

    host.querySelector('#onbSchoolSelectedStable').classList.add('isVisible');
    host.querySelector('.onbSchoolSearchWrap').style.display = 'none';
    host.querySelector('.onbSchoolChange').addEventListener('click', clearSchool);

    select.dispatchEvent(new Event('change', { bubbles: true }));
    setTimeout(() => {
      writeDraft({
        schoolId: clean(row.id),
        schoolName: clean(row.nombre),
        schoolRbd: clean(row.rbd),
        schoolDependencia: clean(row.dependencia_nombre),
        schoolDireccion: clean(row.direccion)
      });
    }, 0);
  }

  function clearSchool(){
    const select = schoolSelect();
    const host = ensureFinder();

    writeDraft({
      schoolId:'', schoolName:'', schoolRbd:'', schoolDependencia:'', schoolDireccion:''
    });

    if(select) select.replaceChildren(new Option('Selecciona un colegio', '', true, true));
    if(!host) return;

    host.querySelector('.onbSchoolSearchWrap').style.display = 'block';
    host.querySelector('#onbSchoolSelectedStable').classList.remove('isVisible');
    host.querySelector('#onbSchoolSearchStable').value = '';
    host.querySelector('#onbSchoolHintStable').textContent = readDraft().comunaId
      ? 'Escribe al menos 2 caracteres del nombre o RBD.'
      : 'Selecciona primero una comuna.';
  }

  function updateFinder(communeCode){
    const host = ensureFinder();
    if(!host) return;
    host.querySelector('#onbSchoolSearchStable').disabled = !communeCode;
    host.querySelector('#onbSchoolMissingStable').disabled = !communeCode;
    host.querySelector('#onbSchoolHintStable').textContent = communeCode
      ? 'Escribe al menos 2 caracteres del nombre o RBD.'
      : 'Selecciona primero una comuna.';
  }

  function render(){
    if(applying) return;
    const region = regionSelect();
    const commune = communeSelect();
    if(!region || !commune) return;

    applying = true;
    try {
      const draft = readDraft();
      let regionCode = clean(draft.regionId || region.value);
      if(!regions.some(row => clean(row.codigo) === regionCode)) regionCode = '';

      replaceOptions(region, regions, 'Selecciona una región', regionCode, false);

      const regionCommunes = communes.filter(row => clean(row.region_codigo) === regionCode);
      let communeCode = clean(draft.comunaId || commune.value);
      if(!regionCommunes.some(row => clean(row.codigo) === communeCode)) communeCode = '';

      const loading = regionCode && loadingByRegion.has(regionCode) && !regionCommunes.length;
      const placeholder = !regionCode
        ? 'Selecciona primero una región'
        : loading
          ? 'Cargando comunas…'
          : regionCommunes.length
            ? 'Selecciona una comuna'
            : 'Reintenta seleccionar la región';

      replaceOptions(commune, regionCommunes, placeholder, communeCode, loading || !regionCommunes.length);

      const regionRow = regions.find(row => clean(row.codigo) === regionCode);
      const communeRow = regionCommunes.find(row => clean(row.codigo) === communeCode);

      writeDraft({
        regionId: regionCode,
        regionName: clean(regionRow?.nombre),
        comunaId: communeCode,
        comunaName: clean(communeRow?.nombre),
        ...(!communeCode ? {
          schoolId:'', schoolName:'', schoolRbd:'', schoolDependencia:'', schoolDireccion:''
        } : {})
      });

      updateFinder(communeCode);
    } finally {
      applying = false;
    }
  }

  async function handleRegionChange(target){
    const code = clean(target.value);
    const row = regions.find(item => clean(item.codigo) === code);

    writeDraft({
      regionId: code,
      regionName: clean(row?.nombre),
      comunaId:'', comunaName:'',
      schoolId:'', schoolName:'', schoolRbd:'', schoolDependencia:'', schoolDireccion:''
    });

    clearSchool();
    render();

    if(!code) return;
    try {
      await loadCommunesForRegion(code, true);
    } catch (error) {
      console.warn('Comunas MiCursoX', error);
    }
    render();
  }

  function handleCommuneChange(target){
    const code = clean(target.value);
    const row = communes.find(item => clean(item.codigo) === code);

    writeDraft({
      comunaId: code,
      comunaName: clean(row?.nombre),
      schoolId:'', schoolName:'', schoolRbd:'', schoolDependencia:'', schoolDireccion:''
    });

    clearSchool();
    render();
  }

  document.addEventListener('change', event => {
    const target = event.target;
    if(!(target instanceof HTMLSelectElement)) return;

    if(target.id === 'onbRegion'){
      event.stopImmediatePropagation();
      void handleRegionChange(target);
    } else if(target.id === 'onbComuna'){
      event.stopImmediatePropagation();
      handleCommuneChange(target);
    }
  }, true);

  async function start(){
    try {
      await loadRegions();
    } catch (error) {
      console.error('No fue posible cargar regiones desde Supabase', error);
      return;
    }

    render();

    const initialRegion = clean(readDraft().regionId);
    if(initialRegion){
      try { await loadCommunesForRegion(initialRegion, true); }
      catch (error) { console.warn('Comunas iniciales MiCursoX', error); }
      render();
    }

    const observer = new MutationObserver(mutations => {
      if(mutations.every(mutation => mutation.target.closest?.('#onbSchoolFinderStable'))) return;
      clearTimeout(observer._timer);
      observer._timer = setTimeout(render, 80);
    });

    observer.observe(document.getElementById('app') || document.body, {
      childList: true,
      subtree: true
    });

    window.MICURSOX_TERRITORIAL_CATALOG = {
      get regions(){ return regions.slice(); },
      get communes(){ return communes.slice(); },
      refresh: async () => {
        await loadRegions();
        const code = clean(readDraft().regionId);
        if(code) await loadCommunesForRegion(code, true);
        render();
      }
    };
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    void start();
  }
})();
