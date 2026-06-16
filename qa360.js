/* Cursapp QA 360 integrado · sin localStorage
   - No crea registros por defecto.
   - Lee Supabase mediante cliente ANON existente.
   - Genera informe descargable en navegador.
*/
(function(){
  const tests = [
    { id:'login-html', name:'Login carga correctamente', kind:'fetch', url:'/' },
    { id:'presidente-html', name:'Pantalla Presidente disponible', kind:'fetch', url:'/presidente.html' },
    { id:'apoderado-html', name:'Pantalla Apoderado disponible', kind:'fetch', url:'/apoderado.html' },
    { id:'tesorero-html', name:'Pantalla Tesorero disponible', kind:'fetch', url:'/tesorero.html' },
    { id:'core-js', name:'Core Supabase disponible', kind:'fetch', url:'/assets/core.js' },
    { id:'login-js', name:'Login JS disponible', kind:'fetch', url:'/assets/login.js' },
    { id:'presidente-js', name:'Presidente JS disponible', kind:'fetch', url:'/assets/presidente.js' },
    { id:'apoderado-js', name:'Apoderado JS disponible', kind:'fetch', url:'/assets/apoderado.js' },
    { id:'tesorero-js', name:'Tesorero JS disponible', kind:'fetch', url:'/assets/tesorero.js' },
    { id:'banners-js', name:'Banners comerciales disponibles', kind:'fetch', url:'/assets/monetization-banners.js' },
    { id:'supabase-ready', name:'Cliente Supabase inicializa', kind:'supabase-ready' },
    { id:'supabase-cursos', name:'Supabase cursos responde', kind:'supabase-table', table:'cursos' },
    { id:'supabase-miembros', name:'Supabase miembros_curso responde', kind:'supabase-table', table:'miembros_curso' },
    { id:'supabase-campanas', name:'Supabase campañas responde', kind:'supabase-table-any', tables:['campanas','campañas','tasks','campanias'] },
    { id:'qa-localstorage', name:'QA no persiste datos en localStorage', kind:'no-localstorage' },
    { id:'login-button', name:'Botón QA visible en Login', kind:'dom-login-button' },
    { id:'loading-markers', name:'Loading premium presente en roles', kind:'asset-contains', url:'/assets/presidente.js', patterns:['Cargando datos','Preparando','loading'] },
    { id:'tesorero-unico-markers', name:'Tesorero único mantiene lógica', kind:'asset-contains', url:'/assets/presidente.js', patterns:['Ya existe un tesorero','Eliminar tesorero','rol tesorero'] },
    { id:'dashboard-banner-markers', name:'Dashboard/Banner estabilizados', kind:'asset-contains', url:'/assets/presidente.js', patterns:['CursappMonetization','cpV6HeroTrack','data-monetization-slot'] }
  ];

  let results = [];
  const $ = (id)=>document.getElementById(id);

  function setRow(id, status, detail){
    const row = document.querySelector('[data-test-row="'+id+'"]');
    if(!row) return;
    row.className = 'qaRow ' + (status || 'run');
    const icon = row.querySelector('.qaIcon');
    const st = row.querySelector('.qaStatus');
    const det = row.querySelector('.qaDetail');
    icon.textContent = status === 'pass' ? '✓' : status === 'fail' ? '!' : status === 'warn' ? '⚠' : '…';
    st.textContent = status === 'pass' ? 'OK' : status === 'fail' ? 'ERROR' : status === 'warn' ? 'WARN' : 'RUN';
    if(detail) det.textContent = detail;
  }

  function renderRows(){
    $('qaList').innerHTML = tests.map(t=>`<div class="qaRow run" data-test-row="${t.id}"><div class="qaIcon">…</div><div><div class="qaName">${escapeHtml(t.name)}</div><div class="qaDetail">Pendiente</div></div><div class="qaStatus">RUN</div></div>`).join('');
    updateKpis();
  }

  function escapeHtml(s){ return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function updateKpis(){
    const total = results.length || tests.length;
    const pass = results.filter(r=>r.status==='pass').length;
    const warn = results.filter(r=>r.status==='warn').length;
    const fail = results.filter(r=>r.status==='fail').length;
    $('kTotal').textContent = String(total);
    $('kPass').textContent = String(pass);
    $('kWarn').textContent = String(warn);
    $('kFail').textContent = String(fail);
    $('qaProgressBar').style.width = Math.round((results.length / tests.length) * 100) + '%';
    buildReport();
  }

  async function waitSupabase(timeoutMs=4000){
    const start = Date.now();
    while(Date.now()-start < timeoutMs){
      if(window.cursappSupabase) return window.cursappSupabase;
      if(window.initCursappSupabase){
        try{ const sb = window.initCursappSupabase(); if(sb) return sb; }catch(e){}
      }
      await sleep(120);
    }
    return null;
  }
  const sleep = ms=>new Promise(r=>setTimeout(r,ms));

  async function fetchOk(url){
    const res = await fetch(url, { cache:'no-store' });
    const text = await res.text();
    if(!res.ok) throw new Error('HTTP '+res.status+' en '+url);
    return { status:res.status, length:text.length, text };
  }

  async function runTest(t){
    try{
      setRow(t.id,'run','Ejecutando...');
      if(t.kind === 'fetch'){
        const r = await fetchOk(t.url);
        if(r.length < 20) return warn(t, 'Respuesta muy pequeña ('+r.length+' bytes).');
        return pass(t, 'HTTP '+r.status+' · '+r.length+' bytes');
      }
      if(t.kind === 'supabase-ready'){
        const sb = await waitSupabase();
        if(!sb) return fail(t,'No se inicializó window.cursappSupabase.');
        return pass(t,'Cliente Supabase listo.');
      }
      if(t.kind === 'supabase-table'){
        const sb = await waitSupabase();
        if(!sb) return fail(t,'Cliente Supabase no disponible.');
        const { data, error, count } = await sb.from(t.table).select('*', { count:'exact', head:true });
        if(error) return fail(t, error.message || JSON.stringify(error));
        return pass(t,'Tabla '+t.table+' responde. count='+(count ?? 's/d'));
      }
      if(t.kind === 'supabase-table-any'){
        const sb = await waitSupabase();
        if(!sb) return fail(t,'Cliente Supabase no disponible.');
        const errors = [];
        for(const table of t.tables){
          const { error, count } = await sb.from(table).select('*', { count:'exact', head:true });
          if(!error) return pass(t,'Tabla encontrada: '+table+' · count='+(count ?? 's/d'));
          errors.push(table+': '+(error.message||'error'));
        }
        return warn(t,'No se encontró tabla estándar de campañas. Detalle: '+errors.join(' | '));
      }
      if(t.kind === 'no-localstorage'){
        // No escribimos ni leemos datos de negocio. Solo verificamos que este QA no use setItem.
        const src = await fetchOk('/assets/qa360.js?v=20260616-1');
        if(src.text.includes('localStorage.setItem')) return fail(t,'qa360.js contiene localStorage.setItem');
        return pass(t,'QA no usa localStorage.setItem.');
      }
      if(t.kind === 'dom-login-button'){
        const r = await fetchOk('/');
        if(r.text.includes('Ejecutar QA 360') && r.text.includes('/qa360.html')) return pass(t,'Botón presente en index.html.');
        return fail(t,'No encontré botón QA en login.');
      }
      if(t.kind === 'asset-contains'){
        const r = await fetchOk(t.url);
        const missing = t.patterns.filter(p=>!r.text.includes(p));
        if(missing.length) return warn(t,'No encontré marcas: '+missing.join(', '));
        return pass(t,'Marcas encontradas: '+t.patterns.join(', '));
      }
      return warn(t,'Tipo de prueba no implementado: '+t.kind);
    }catch(e){
      return fail(t, e && e.message ? e.message : String(e));
    }
  }

  function pushResult(t,status,detail){
    const r = { id:t.id, name:t.name, status, detail, at:new Date().toISOString() };
    results.push(r);
    setRow(t.id,status,detail);
    updateKpis();
    return r;
  }
  const pass=(t,d)=>pushResult(t,'pass',d);
  const warn=(t,d)=>pushResult(t,'warn',d);
  const fail=(t,d)=>pushResult(t,'fail',d);

  async function runAll(){
    results = [];
    renderRows();
    $('runQaBtn').disabled = true;
    $('runQaBtn').textContent = 'Ejecutando...';
    for(const t of tests){ await runTest(t); await sleep(80); }
    $('runQaBtn').disabled = false;
    $('runQaBtn').textContent = 'Ejecutar QA';
    await tryPersistRunInSupabase();
  }

  async function tryPersistRunInSupabase(){
    // Opcional y seguro: intenta guardar si existe tabla qa_runs. Si no existe, no falla el QA.
    try{
      const sb = await waitSupabase(1200);
      if(!sb) return;
      const summary = getSummary();
      const { error } = await sb.from('qa_runs').insert([{ source:'qa360_frontend', summary, results, created_at:new Date().toISOString() }]);
      if(error){
        // No creamos tablas desde frontend. Solo avisamos en el informe.
        results.push({ id:'qa_runs', name:'Persistencia opcional en Supabase', status:'warn', detail:'No se guardó en qa_runs: '+error.message, at:new Date().toISOString() });
        updateKpis();
      }else{
        results.push({ id:'qa_runs', name:'Persistencia opcional en Supabase', status:'pass', detail:'Resultado guardado en qa_runs.', at:new Date().toISOString() });
        updateKpis();
      }
    }catch(e){}
  }

  function getSummary(){
    return {
      total: results.length,
      pass: results.filter(r=>r.status==='pass').length,
      warn: results.filter(r=>r.status==='warn').length,
      fail: results.filter(r=>r.status==='fail').length,
      url: location.origin,
      at: new Date().toISOString()
    };
  }

  function buildReport(){
    const s = getSummary();
    const verdict = s.fail ? 'REVISAR' : (s.warn ? 'APROBADO CON OBSERVACIONES' : 'APROBADO');
    const lines = [
      'QA 360 Cursapp',
      'Fecha: '+new Date().toLocaleString('es-CL'),
      'Origen: '+location.origin,
      '',
      'Resultado: '+verdict,
      'Total: '+s.total,
      'OK: '+s.pass,
      'Advertencias: '+s.warn,
      'Errores: '+s.fail,
      '',
      'Detalle:',
      ...results.map(r=>'['+r.status.toUpperCase()+'] '+r.name+' — '+r.detail)
    ];
    $('qaReport').value = lines.join('\n');
  }

  function download(name, mime, content){
    const blob = new Blob([content], { type:mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function downloadJson(){ download('cursapp-qa360-'+Date.now()+'.json','application/json',JSON.stringify({ summary:getSummary(), results }, null, 2)); }
  function downloadHtml(){
    const body = '<pre style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;">'+escapeHtml($('qaReport').value)+'</pre>';
    download('cursapp-qa360-'+Date.now()+'.html','text/html','<!doctype html><meta charset="utf-8"><title>QA 360 Cursapp</title>'+body);
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    renderRows();
    $('runQaBtn').addEventListener('click', runAll);
    $('downloadJsonBtn').addEventListener('click', downloadJson);
    $('downloadHtmlBtn').addEventListener('click', downloadHtml);
    buildReport();
  });
})();
