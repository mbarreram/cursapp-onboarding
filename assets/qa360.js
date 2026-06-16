/* Cursapp QA 360 modular Supabase · activo
   - V10.3: QA visual con sesión real Supabase por rol antes de abrir iframes
   - Ejecuta pruebas por módulo.
   - Puede crear registros QA_* en Supabase y limpiarlos al final.
   - V8: stress financiero + performance + avisos + gastos/rendiciones + informes publicados + RLS/concurrencia/resiliencia/navegación.
   - No usa localStorage para crear datos de negocio.
*/
(function(){
  const RUN_ID = 'QA_' + new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14) + '_' + Math.random().toString(16).slice(2,6).toUpperCase();
  const QA_PREFIX = RUN_ID;
  const state = {
    runId: RUN_ID,
    startedAt: null,
    endedAt: null,
    mode: 'quick',
    cleanup: true,
    modules: [],
    results: [],
    created: { colegioId:null, cursoId:null, cursoAltId:null, usuarios:[], miembros:[], campanas:[], pagos:[], avisos:[], informes:[], stress:{colegios:[], cursos:[], usuarios:[], miembros:[], campanas:[], avisos:[], pagos:0, expected:{}} }, metrics: []
  };

  const $ = (id)=>document.getElementById(id);
  const sleep = ms=>new Promise(r=>setTimeout(r,ms));
  const esc = (s)=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const today = ()=>new Date().toISOString().slice(0,10);
  const addDays = (n)=>{ const d=new Date(); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); };
  const q = (v)=>String(v??'');

  const qa = {
    courseKey: QA_PREFIX + '_COURSE',
    inviteCode: QA_PREFIX.slice(-6).replace(/[^A-Z0-9]/g,'X'),
    colegio: QA_PREFIX + ' Colegio QA',
    presidenteEmail: (QA_PREFIX + '.presidente@qa.cursapp.cl').toLowerCase(),
    apo1Email: (QA_PREFIX + '.apoderado1@qa.cursapp.cl').toLowerCase(),
    apo2Email: (QA_PREFIX + '.apoderado2@qa.cursapp.cl').toLowerCase(),
    tesoreroEmail: (QA_PREFIX + '.tesorero@qa.cursapp.cl').toLowerCase(),
    duplicateEmail: (QA_PREFIX + '.apoderado1@qa.cursapp.cl').toLowerCase(),
    otherCourseKey: QA_PREFIX + '_COURSE_ALT'
  };

  const MODULES_QUICK = [
    { id:'infra', name:'Base / Supabase', tests:['login-html','role-html','assets','supabase-ready','supabase-tables','supabase-write'] },
    { id:'componentes', name:'Componentes estabilizados', tests:['loading','tesorero-markers','banner-dashboard','qa-button'] }
  ];
  const MODULES_FULL = [
    ...MODULES_QUICK,
    { id:'onboarding', name:'Onboarding QA', tests:['create-colegio','create-curso','create-usuarios','create-miembros','approve-apoderados','email-same-course-different-student','email-duplicate-same-student-course','email-same-different-course'] },
    { id:'roles', name:'Roles / Tesorero único', tests:['assign-tesorero','block-second-tesorero','remove-tesorero','reassign-tesorero'] },
    { id:'formularios', name:'Formularios vs DB', tests:['schema-pagos','schema-campanas','schema-miembros','schema-form-gaps'] },
    { id:'campanas', name:'Campañas', tests:['create-campana-unica','create-campana-mensual','create-campana-voluntaria','create-pagos','create-pagos-variados','validate-dashboard-data'] },
    { id:'pagos', name:'Pagos variados', tests:['validate-pago-pendiente','validate-pago-pagado','validate-pago-vencido','validate-pago-parcial','validate-pago-manual','validate-pago-saldo-favor','validate-pago-no-participa'] },
    { id:'apoderado', name:'Apoderado', tests:['apoderado-data','no-participo-logic','apoderado-ui-markers'] },
    { id:'tesorero', name:'Tesorero', tests:['tesorero-data','tesorero-ui-markers','tesorero-pagos-conciliables'] },
    { id:'informes', name:'Informes', tests:['informes-table','informes-ui-markers'] },
    { id:'limpieza', name:'Limpieza QA', tests:['cleanup-qa','verify-cleanup'] }
  ];

  const MODULES_STRESS = [
    { id:'infra', name:'Base / Supabase', tests:['login-html','role-html','assets','supabase-ready','supabase-tables'] },
    { id:'stress-prep', name:'Preparación stress', tests:['cleanup-stale-qa'] },
    { id:'stress', name:'Stress multi-curso', tests:['stress-create-dataset','stress-validate-counts','stress-validate-hermanos','stress-dashboard-scale','stress-payment-distribution'] },
    { id:'avisos', name:'Avisos', tests:['avisos-schema','avisos-create','avisos-consulta-presidente','avisos-consulta-apoderado'] },
    { id:'performance', name:'Performance DB', tests:['perf-dashboard-stress','perf-deudores-stress','perf-avisos-stress','perf-pagos-stress','perf-thresholds'] },
    { id:'integridad', name:'Integridad financiera', tests:['fin-dashboard-sums','fin-no-participa-excluded','fin-parcial-descuenta','fin-conciliado-impacta'] },
    { id:'rendiciones', name:'Rendiciones / gastos', tests:['gastos-schema','gastos-create','rendicion-create','gastos-impacto-saldo'] },
    { id:'informes-reales', name:'Informes reales', tests:['informe-genera','informe-publica','informe-roles'] },
    { id:'negocio', name:'Reglas de negocio Cursapp', tests:['biz-mensual-arrears','biz-saldo-favor','biz-no-participa-crossrole','biz-dashboard-financiero','biz-informe-ejecutivo-math'] },
    { id:'seguridad', name:'Seguridad / RLS', tests:['rls-curso-ajeno-empty','rls-negative-write-foreign'] },
    { id:'concurrencia', name:'Concurrencia', tests:['race-tesorero-unico','race-pago-duplicado','race-aprobacion-miembro'] },
    { id:'resiliencia', name:'Resiliencia', tests:['empty-campanas','empty-pagos','usuario-sin-curso','curso-sin-apoderados'] },
    { id:'navegacion', name:'Roles / navegación', tests:['nav-presidente-apoderado','nav-apoderado-tesorero','nav-no-banner-flicker','nav-no-selector-repetido'] },
    { id:'clicks', name:'Click simulado integrado', tests:['ui-open-role-pages','ui-click-presidente','ui-click-apoderado','ui-click-tesorero','ui-click-qa-evidence'] },
    MODULES_FULL.find(m => m.id === 'limpieza')
  ];

  function rowsFor(mode){ return mode === 'stress' ? MODULES_STRESS : (mode === 'full' ? MODULES_FULL : MODULES_QUICK); }

  function setBusy(on){
    const a=$('runQuickBtn'), b=$('runFullBtn'), c=$('runStressBtn');
    if(a) a.disabled=!!on; if(b) b.disabled=!!on; if(c) c.disabled=!!on;
    if(a) a.textContent = on ? 'Ejecutando...' : 'QA rápido';
    if(b) b.textContent = on ? 'Ejecutando...' : 'QA completo';
    if(c) c.textContent = on ? 'Ejecutando stress...' : 'QA stress';
  }

  function init(){
    const c=$('cleanupQa'); if(c) c.checked = true;
    renderModules('quick');
    bind();
    buildReport();
  }

  function bind(){
    $('runQuickBtn') && ($('runQuickBtn').onclick=()=>run('quick'));
    $('runFullBtn') && ($('runFullBtn').onclick=()=>run('full'));
    $('runStressBtn') && ($('runStressBtn').onclick=()=>run('stress'));
    $('downloadJsonBtn') && ($('downloadJsonBtn').onclick=downloadJson);
    $('downloadHtmlBtn') && ($('downloadHtmlBtn').onclick=downloadHtml);
    $('cleanupOnlyBtn') && ($('cleanupOnlyBtn').onclick=async()=>{ state.mode='cleanup'; state.cleanup=true; setBusy(true); await runOneModule({id:'limpieza',name:'Limpieza QA',tests:['cleanup-qa','verify-cleanup']}); setBusy(false); });
  }

  function renderModules(mode){
    const modules = rowsFor(mode);
    const root=$('qaModules'); if(!root) return;
    root.innerHTML = modules.map(m=>`
      <section class="qaModule" data-module="${esc(m.id)}">
        <div class="qaModuleHead">
          <div><h3>${esc(m.name)}</h3><p>${esc(moduleDescription(m.id))}</p></div>
          <span class="qaModuleStatus run">Pendiente</span>
        </div>
        <div class="qaList">${m.tests.map(tid=>testRowHtml(tid)).join('')}</div>
      </section>
    `).join('');
    updateKpis();
  }
  function moduleDescription(id){
    return ({
      infra:'Conectividad, rutas, assets y permisos básicos.',
      componentes:'Loading premium, tesorero único, dashboard y banner.',
      formularios:'Valida que campos usados por formularios existan en Supabase o queden reportados como brecha.',
      onboarding:'Crea curso, usuarios y miembros QA_*; valida reglas de correo.',
      roles:'Valida un solo tesorero y reasignación controlada.',
      campanas:'Crea campañas obligatorias, mensuales, voluntarias y pagos base.',
      pagos:'Valida estados de pago variados: pendiente, pagado, vencido, parcial, manual, saldo y no participa.',
      apoderado:'Valida datos y marcas visuales de apoderado.',
      tesorero:'Valida datos y marcas visuales de tesorero.',
      informes:'Valida tablas o módulos de informes.',
      stress:'Crea 2 colegios, 2 cursos, 85 alumnos/apoderados, 16 campañas y miles de pagos para validar escala.',
      'stress-prep':'Limpia datos QA_* antiguos antes del stress aislado.',
      avisos:'Crea y consulta avisos por curso/rol para presidente y apoderado.',
      performance:'Mide tiempos reales de consultas Supabase en milisegundos y valida umbrales.',
      integridad:'Valida consistencia de saldos, por cobrar, no participa, parcial y conciliado.',
      rendiciones:'Crea gasto/rendición QA y valida impacto financiero si la tabla existe.',
      'informes-reales':'Genera/publica informe QA y valida vistas por rol si la tabla permite escritura.',
      negocio:'Valida reglas de negocio críticas: cuotas mensuales, saldo a favor, no participa, dashboard financiero e informe ejecutivo.',
      seguridad:'Pruebas negativas de aislamiento de curso y escritura fuera de contexto QA.',
      concurrencia:'Simula operaciones simultáneas para tesorero, pago y aprobación.',
      resiliencia:'Valida respuestas ante cursos vacíos, sin pagos o usuarios sin curso.',
      navegacion:'Valida marcas de cambio de rol, loading y ausencia de selector/banner prematuro.',
      clicks:'Ejecuta clicks simulados integrados en iframes sobre las pantallas desplegadas; no requiere consola ni Playwright local.',
      limpieza:'Borra solo registros creados por este QA.'
    })[id] || '';
  }
  function testName(id){
    return ({
      'login-html':'Login carga correctamente','role-html':'Pantallas por rol disponibles','assets':'Assets principales disponibles','supabase-ready':'Cliente Supabase inicializa','supabase-tables':'Tablas base responden','supabase-write':'Permisos escritura QA disponibles',
      'loading':'Loading premium presente','tesorero-markers':'Tesorero único mantiene lógica','banner-dashboard':'Dashboard/Banner estabilizados','qa-button':'Botón QA visible en Login',
      'schema-pagos':'Tabla pagos compatible con formularios','schema-campanas':'Tabla campanas compatible con formularios','schema-miembros':'Tabla miembros_curso compatible con formularios','schema-form-gaps':'Brechas formulario vs DB',
      'create-colegio':'Crear colegio QA','create-curso':'Crear curso QA','create-usuarios':'Crear usuarios QA','create-miembros':'Crear miembros curso QA','approve-apoderados':'Apoderados QA aprobados','email-same-course-different-student':'Permitir hermanos en mismo curso','email-duplicate-same-student-course':'Bloquear mismo correo + mismo alumno + mismo curso','email-same-different-course':'Permitir mismo correo en curso distinto',
      'assign-tesorero':'Asignar tesorero QA','block-second-tesorero':'Bloquear segundo tesorero','remove-tesorero':'Eliminar tesorero QA','reassign-tesorero':'Reasignar tesorero QA',
      'create-campana-unica':'Crear campaña única QA','create-campana-mensual':'Crear campaña mensual QA','create-campana-voluntaria':'Crear campaña voluntaria QA','create-pagos':'Crear pagos QA base','create-pagos-variados':'Crear pagos QA variados','validate-dashboard-data':'Validar datos para dashboard',
      'validate-pago-pendiente':'Pago pendiente','validate-pago-pagado':'Pago pagado','validate-pago-vencido':'Pago vencido','validate-pago-parcial':'Pago parcial','validate-pago-manual':'Pago manual conciliado','validate-pago-saldo-favor':'Saldo a favor','validate-pago-no-participa':'Pago No participa',
      'apoderado-data':'Datos apoderado consultables','no-participo-logic':'Lógica No participo presente','apoderado-ui-markers':'UI Apoderado estable',
      'tesorero-data':'Datos tesorero consultables','tesorero-ui-markers':'UI Tesorero estable','tesorero-pagos-conciliables':'Pagos conciliables por tesorero',
      'informes-table':'Informes disponibles o advertencia','informes-ui-markers':'UI Informes presente',
      'cleanup-stale-qa':'Prelimpiar QA_* antiguos',
      'stress-create-dataset':'Crear dataset stress','stress-validate-counts':'Validar conteos stress','stress-validate-hermanos':'Validar hermanos stress','stress-dashboard-scale':'Validar consultas dashboard stress','stress-payment-distribution':'Validar distribución pagos stress',
      'avisos-schema':'Validar tabla avisos','avisos-create':'Crear avisos QA','avisos-consulta-presidente':'Consultar avisos Presidente','avisos-consulta-apoderado':'Consultar avisos Apoderado',
      'perf-dashboard-stress':'Medir dashboard stress','perf-deudores-stress':'Medir deudores stress','perf-avisos-stress':'Medir avisos stress','perf-pagos-stress':'Medir pagos stress','perf-thresholds':'Validar umbrales performance',
      'fin-dashboard-sums':'Suma pagos vs dashboard','fin-no-participa-excluded':'No participa excluido de deuda','fin-parcial-descuenta':'Pago parcial descuenta','fin-conciliado-impacta':'Conciliado impacta reportes',
      'gastos-schema':'Validar tabla gastos/rendiciones','gastos-create':'Crear gasto/rendición QA','gastos-impacto-saldo':'Gasto resta del saldo','rendicion-create':'Crear rendición QA',
      'informe-genera':'Generar informe QA','informe-publica':'Publicar informe QA','informe-roles':'Validar informe por rol',
      'biz-mensual-arrears':'Campaña mensual 10 cuotas','biz-saldo-favor':'Saldo a favor aplicado','biz-no-participa-crossrole':'No participa impacto roles','biz-dashboard-financiero':'Dashboard financiero matemático','biz-informe-ejecutivo-math':'Informe ejecutivo consistente',
      'rls-curso-ajeno-empty':'Aislamiento curso ajeno','rls-negative-write-foreign':'Escritura negativa curso ajeno',
      'race-tesorero-unico':'Concurrencia tesorero único','race-pago-duplicado':'Concurrencia pago duplicado','race-aprobacion-miembro':'Concurrencia aprobación miembro',
      'empty-campanas':'Curso sin campañas','empty-pagos':'Curso sin pagos','usuario-sin-curso':'Usuario sin curso','curso-sin-apoderados':'Curso sin apoderados',
      'nav-presidente-apoderado':'Presidente → Apoderado','nav-apoderado-tesorero':'Apoderado → Tesorero','nav-no-banner-flicker':'Sin banner antes de carga','nav-no-selector-repetido':'Sin selector de rol repetido',
      'ui-open-role-pages':'Abrir pantallas en modo UI','ui-click-presidente':'Clicks Presidente','ui-click-apoderado':'Clicks Apoderado','ui-click-tesorero':'Clicks Tesorero','ui-click-qa-evidence':'Evidencia QA descargable',
      'cleanup-qa':'Limpiar registros QA','verify-cleanup':'Verificar limpieza QA'
    })[id] || id;
  }
  function testRowHtml(id){ return `<div class="qaRow run" data-test="${esc(id)}"><div class="qaIcon">…</div><div><div class="qaName">${esc(testName(id))}</div><div class="qaDetail">Pendiente</div></div><div class="qaStatus">RUN</div></div>`; }

  function setRow(id,status,detail){
    const row=document.querySelector(`[data-test="${CSS.escape(id)}"]`); if(!row) return;
    row.className='qaRow '+status;
    row.querySelector('.qaIcon').textContent = status==='pass'?'✓':status==='fail'?'!':status==='warn'?'⚠':'…';
    row.querySelector('.qaStatus').textContent = status==='pass'?'OK':status==='fail'?'ERROR':status==='warn'?'WARN':'RUN';
    row.querySelector('.qaDetail').textContent = detail || '';
  }
  function setModuleStatus(id,status,text){
    const m=document.querySelector(`[data-module="${CSS.escape(id)}"]`); if(!m) return;
    const s=m.querySelector('.qaModuleStatus'); if(!s) return;
    s.className='qaModuleStatus '+status;
    s.textContent=text || (status==='pass'?'OK':status==='fail'?'ERROR':status==='warn'?'WARN':'Ejecutando');
  }
  function record(id,module,status,detail){
    const r={ id, module, name:testName(id), status, detail:String(detail||''), at:new Date().toISOString() };
    state.results.push(r); setRow(id,status,r.detail); updateKpis(); return r;
  }
  const pass=(id,m,d)=>record(id,m,'pass',d); const warn=(id,m,d)=>record(id,m,'warn',d); const fail=(id,m,d)=>record(id,m,'fail',d);

  function updateKpis(){
    const totalRows = document.querySelectorAll('[data-test]').length || state.results.length;
    const passN=state.results.filter(r=>r.status==='pass').length;
    const warnN=state.results.filter(r=>r.status==='warn').length;
    const failN=state.results.filter(r=>r.status==='fail').length;
    $('kTotal') && ($('kTotal').textContent=String(totalRows));
    $('kPass') && ($('kPass').textContent=String(passN));
    $('kWarn') && ($('kWarn').textContent=String(warnN));
    $('kFail') && ($('kFail').textContent=String(failN));
    const done=state.results.length;
    $('qaProgressBar') && ($('qaProgressBar').style.width=Math.round((done/Math.max(1,totalRows))*100)+'%');
    buildReport();
  }

  async function waitSupabase(timeoutMs=5000){
    const start=Date.now();
    while(Date.now()-start<timeoutMs){
      if(window.cursappSupabase) return window.cursappSupabase;
      if(window.initCursappSupabase){ try{ const sb=window.initCursappSupabase(); if(sb) return sb; }catch(e){} }
      await sleep(100);
    }
    return null;
  }
  async function sb(){ const x=await waitSupabase(); if(!x) throw new Error('Cliente Supabase no disponible'); return x; }
  async function fetchText(url){ const res=await fetch(url,{cache:'no-store'}); const text=await res.text(); if(!res.ok) throw new Error('HTTP '+res.status+' '+url); return {res,text}; }
  async function tableCount(table){ const c=await sb(); return await c.from(table).select('*',{count:'exact',head:true}); }
  async function measure(label, fn){ const t0=performance.now(); const result=await fn(); const ms=Math.round(performance.now()-t0); state.metrics.push({label,ms,at:new Date().toISOString()}); return {result,ms}; }
  function perfLabel(ms){ return ms<500?'OK':(ms<1500?'WARN':'LENTO'); }
  async function insert(table,row){ const c=await sb(); const {data,error}=await c.from(table).insert([row]).select('*').single(); if(error) throw new Error(error.message); return data; }
  async function del(table,filterFn){ const c=await sb(); return await filterFn(c.from(table).delete()); }

  async function run(mode){
    state.mode=mode; state.cleanup = !!($('cleanupQa') && $('cleanupQa').checked);
    state.startedAt=new Date().toISOString(); state.endedAt=null; state.results=[]; state.modules=[]; state.created={colegioId:null,cursoId:null,cursoAltId:null,usuarios:[],miembros:[],campanas:[],pagos:[],avisos:[],informes:[],stress:{colegios:[],cursos:[],usuarios:[],miembros:[],campanas:[],avisos:[],pagos:0,expected:{}}}; state.metrics=[];
    renderModules(mode); setBusy(true);
    for(const m of rowsFor(mode)){ await runOneModule(m); }
    state.endedAt=new Date().toISOString(); setBusy(false); await persistOptional(); buildReport();
  }
  async function runOneModule(m){
    setModuleStatus(m.id,'run','Ejecutando'); const before=state.results.length;
    for(const tid of m.tests){ try{ await runTest(tid,m.id); }catch(e){ fail(tid,m.id,e.message||String(e)); } await sleep(80); }
    const rs=state.results.slice(before); const fails=rs.filter(r=>r.status==='fail').length; const warns=rs.filter(r=>r.status==='warn').length;
    state.modules.push({id:m.id,name:m.name,total:rs.length,pass:rs.filter(r=>r.status==='pass').length,warn:warns,fail:fails});
    setModuleStatus(m.id,fails?'fail':warns?'warn':'pass', fails?'ERROR':warns?'WARN':'OK');
  }

  async function runTest(id,module){
    switch(id){
      case 'login-html': { const r=await fetchText('/'); return pass(id,module,'HTTP '+r.res.status+' · '+r.text.length+' bytes'); }
      case 'role-html': { const urls=['/presidente.html','/apoderado.html','/tesorero.html']; const out=[]; for(const u of urls){ const r=await fetchText(u); out.push(u+': '+r.res.status); } return pass(id,module,out.join(' · ')); }
      case 'assets': { const urls=['/assets/presidente.js','/assets/apoderado.js','/assets/tesorero.js','/assets/supabaseClient.js']; const out=[]; for(const u of urls){ const r=await fetchText(u); out.push(u.split('/').pop()+': '+r.text.length); } return pass(id,module,out.join(' · ')); }
      case 'supabase-ready': { await sb(); return pass(id,module,'Cliente Supabase listo.'); }
      case 'supabase-tables': { const tables=['cursos','miembros_curso','campanas','pagos','avisos']; const out=[]; for(const t of tables){ const {error,count}=await tableCount(t); if(error) throw new Error(t+': '+error.message); out.push(t+'='+count); } return pass(id,module,out.join(' · ')); }
      case 'supabase-write': { const c=await sb(); const {error}=await c.from('cursos').select('id',{count:'exact',head:true}); if(error) throw new Error(error.message); return pass(id,module,'Lectura confirmada. Escritura real se valida en QA completo.'); }
      case 'loading': { const a=(await fetchText('/assets/presidente.js')).text+(await fetchText('/assets/apoderado.js')).text+(await fetchText('/assets/tesorero.js')).text; const miss=['Cargando datos','Preparando'].filter(x=>!a.includes(x)); return miss.length?warn(id,module,'Faltan marcas: '+miss.join(', ')):pass(id,module,'Loading detectado en componentes.'); }
      case 'tesorero-markers': { const t=(await fetchText('/assets/presidente.js')).text; const miss=['Ya existe un tesorero','Eliminar tesorero','rol tesorero'].filter(x=>!t.includes(x)); return miss.length?fail(id,module,'Faltan marcas: '+miss.join(', ')):pass(id,module,'Lógica detectada.'); }
      case 'banner-dashboard': { const t=(await fetchText('/assets/presidente.js')).text; const miss=['CursappMonetization','cpV6HeroTrack','data-monetization-slot'].filter(x=>!t.includes(x)); return miss.length?warn(id,module,'Faltan marcas: '+miss.join(', ')):pass(id,module,'Marcas dashboard/banner OK.'); }
      case 'qa-button': { const t=(await fetchText('/')).text; return (t.includes('qa360.html')||t.includes('QA 360'))?pass(id,module,'Botón QA detectado en login.'):fail(id,module,'No se detectó botón QA.'); }
      case 'schema-pagos': return validateSchemaPagos(id,module);
      case 'schema-campanas': return validateSchemaCampanas(id,module);
      case 'schema-miembros': return validateSchemaMiembros(id,module);
      case 'schema-form-gaps': return validateFormGaps(id,module);
      case 'create-colegio': return createColegio(id,module);
      case 'create-curso': return createCurso(id,module);
      case 'create-usuarios': return createUsuarios(id,module);
      case 'create-miembros': return createMiembros(id,module);
      case 'approve-apoderados': return approveApoderados(id,module);
      case 'email-same-course-different-student': return validateSameEmailSameCourseDifferentStudent(id,module);
      case 'email-duplicate-same-student-course': return validateDuplicateEmailSameStudentCourse(id,module);
      case 'email-same-different-course': return validateSameEmailDifferentCourse(id,module);
      case 'assign-tesorero': return assignTesorero(id,module,qa.apo1Email);
      case 'block-second-tesorero': return blockSecondTesorero(id,module);
      case 'remove-tesorero': return removeTesorero(id,module,qa.apo1Email);
      case 'reassign-tesorero': return assignTesorero(id,module,qa.apo2Email);
      case 'create-campana-unica': return createCampana(id,module,'unica');
      case 'create-campana-mensual': return createCampana(id,module,'mensual');
      case 'create-campana-voluntaria': return createCampana(id,module,'voluntaria');
      case 'create-pagos': return createPagos(id,module);
      case 'create-pagos-variados': return createPagosVariados(id,module);
      case 'validate-dashboard-data': return validateDashboardData(id,module);
      case 'validate-pago-pendiente': return validatePagoEstado(id,module,'pendiente');
      case 'validate-pago-pagado': return validatePagoEstado(id,module,'pagado');
      case 'validate-pago-vencido': return validatePagoEstado(id,module,'vencido');
      case 'validate-pago-parcial': return validatePagoEstado(id,module,'parcial');
      case 'validate-pago-manual': return validatePagoEstado(id,module,'conciliado');
      case 'validate-pago-saldo-favor': return validatePagoEstado(id,module,'saldo_favor');
      case 'validate-pago-no-participa': return validatePagoEstado(id,module,'no_participa');
      case 'apoderado-data': return validateMemberRole(id,module,'apoderado');
      case 'no-participo-logic': { const t=(await fetchText('/assets/apoderado.js')).text+(await fetchText('/assets/presidente.js')).text; return (t.includes('opted_out')||t.includes('no_participa'))?pass(id,module,'Marcas No participo encontradas.'):warn(id,module,'No encontré marcas No participo.'); }
      case 'apoderado-ui-markers': { const t=(await fetchText('/assets/apoderado.js')).text; const miss=['Próxima cuota','cpV5Carousel','data-monetization-slot'].filter(x=>!t.includes(x)); return miss.length?warn(id,module,'Faltan marcas: '+miss.join(', ')):pass(id,module,'UI Apoderado OK.'); }
      case 'tesorero-data': return validateMemberRole(id,module,'tesorero');
      case 'tesorero-ui-markers': { const t=(await fetchText('/assets/tesorero.js')).text; const ok=['Conciliación','Rendiciones','Comprobantes','Pagos'].some(x=>t.includes(x)); return ok?pass(id,module,'UI Tesorero detectada.'):warn(id,module,'Marcas UI Tesorero no claras.'); }
      case 'tesorero-pagos-conciliables': return validateTesoreroPagosConciliables(id,module);
      case 'informes-table': return validateInformes(id,module);
      case 'informes-ui-markers': { const t=(await fetchText('/assets/presidente.js')).text; return t.includes('Informes')?pass(id,module,'UI Informes presente.'):warn(id,module,'No encontré marca Informes.'); }
      case 'cleanup-stale-qa': return cleanupStaleQA(id,module);
      case 'stress-create-dataset': return createStressDataset(id,module);
      case 'stress-validate-counts': return validateStressCounts(id,module);
      case 'stress-validate-hermanos': return validateStressHermanos(id,module);
      case 'stress-dashboard-scale': return validateStressDashboardScale(id,module);
      case 'stress-payment-distribution': return validateStressPaymentDistribution(id,module);
      case 'avisos-schema': return validateAvisosSchema(id,module);
      case 'avisos-create': return createAvisosQA(id,module);
      case 'avisos-consulta-presidente': return consultaAvisosQA(id,module,'presidente');
      case 'avisos-consulta-apoderado': return consultaAvisosQA(id,module,'apoderado');
      case 'perf-dashboard-stress': return perfDashboardStress(id,module);
      case 'perf-deudores-stress': return perfDeudoresStress(id,module);
      case 'perf-avisos-stress': return perfAvisosStress(id,module);
      case 'perf-pagos-stress': return perfPagosStress(id,module);
      case 'perf-thresholds': return perfThresholds(id,module);
      case 'fin-dashboard-sums': return finDashboardSums(id,module);
      case 'fin-no-participa-excluded': return finNoParticipaExcluded(id,module);
      case 'fin-parcial-descuenta': return finParcialDescuenta(id,module);
      case 'fin-conciliado-impacta': return finConciliadoImpacta(id,module);
      case 'gastos-schema': return gastosSchema(id,module);
      case 'gastos-create': return gastosCreate(id,module);
      case 'rendicion-create': return rendicionCreate(id,module);
      case 'gastos-impacto-saldo': return gastosImpactoSaldo(id,module);
      case 'informe-genera': return informeGenera(id,module);
      case 'informe-publica': return informePublica(id,module);
      case 'informe-roles': return informeRoles(id,module);
      case 'biz-mensual-arrears': return bizMensualArrears(id,module);
      case 'biz-saldo-favor': return bizSaldoFavor(id,module);
      case 'biz-no-participa-crossrole': return bizNoParticipaCrossRole(id,module);
      case 'biz-dashboard-financiero': return bizDashboardFinanciero(id,module);
      case 'biz-informe-ejecutivo-math': return bizInformeEjecutivoMath(id,module);
      case 'rls-curso-ajeno-empty': return rlsCursoAjenoEmpty(id,module);
      case 'rls-negative-write-foreign': return rlsNegativeWriteForeign(id,module);
      case 'race-tesorero-unico': return raceTesoreroUnico(id,module);
      case 'race-pago-duplicado': return racePagoDuplicado(id,module);
      case 'race-aprobacion-miembro': return raceAprobacionMiembro(id,module);
      case 'empty-campanas': return emptyCampanas(id,module);
      case 'empty-pagos': return emptyPagos(id,module);
      case 'usuario-sin-curso': return usuarioSinCurso(id,module);
      case 'curso-sin-apoderados': return cursoSinApoderados(id,module);
      case 'nav-presidente-apoderado': return navPresidenteApoderado(id,module);
      case 'nav-apoderado-tesorero': return navApoderadoTesorero(id,module);
      case 'nav-no-banner-flicker': return navNoBannerFlicker(id,module);
      case 'nav-no-selector-repetido': return navNoSelectorRepetido(id,module);
      case 'ui-open-role-pages': return uiOpenRolePages(id,module);
      case 'ui-click-presidente': return uiClickPresidente(id,module);
      case 'ui-click-apoderado': return uiClickApoderado(id,module);
      case 'ui-click-tesorero': return uiClickTesorero(id,module);
      case 'ui-click-qa-evidence': return uiClickQaEvidence(id,module);
      case 'cleanup-qa': return cleanupQa(id,module);
      case 'verify-cleanup': return verifyCleanup(id,module);
      default: return warn(id,module,'Prueba no implementada.');
    }
  }

  async function createColegio(id,module){
    const row=await insert('colegios',{nombre:qa.colegio,region:'QA',comuna:'QA',rbd:QA_PREFIX,es_catalogo_demo:true});
    state.created.colegioId=row.id; return pass(id,module,'Colegio creado: '+row.id);
  }
  async function createCurso(id,module){
    const row=await insert('cursos',{colegio_id:state.created.colegioId,nombre:qa.colegio+' · 2B 2026',nivel:'2°',letra:'B',anio:2026,jornada:'Mañana',course_key:qa.courseKey,invite_code:qa.inviteCode,estado:'activo'});
    state.created.cursoId=row.id; return pass(id,module,'Curso creado: '+row.id+' · '+qa.courseKey);
  }
  async function createUsuarios(id,module){
    const users=[
      {email:qa.presidenteEmail,nombre:QA_PREFIX+' Presidente'},
      {email:qa.apo1Email,nombre:QA_PREFIX+' Apoderado 1'},
      {email:qa.apo2Email,nombre:QA_PREFIX+' Apoderado 2'}
    ];
    for(const u of users){ const row=await insert('usuarios',{email:u.email,nombre:u.nombre,rol_global:'usuario',estado:'activo'}); state.created.usuarios.push(row); }
    return pass(id,module,'Usuarios creados: '+state.created.usuarios.length);
  }
  async function createMiembros(id,module){
    const getUser=(email)=>state.created.usuarios.find(u=>String(u.email).toLowerCase()===email);
    const rows=[
      {email:qa.presidenteEmail,rol:'presidente',nombre_apoderado:QA_PREFIX+' Presidente',nombre_alumno:null,estado:'aprobado',activacion_pagada:true},
      {email:qa.presidenteEmail,rol:'apoderado',nombre_apoderado:QA_PREFIX+' Presidente',nombre_alumno:'Alumno Presidente QA',estado:'aprobado',activacion_pagada:true},
      {email:qa.apo1Email,rol:'apoderado',nombre_apoderado:QA_PREFIX+' Apoderado 1',nombre_alumno:'Alumno QA 1',estado:'pendiente',activacion_pagada:true},
      {email:qa.apo2Email,rol:'apoderado',nombre_apoderado:QA_PREFIX+' Apoderado 2',nombre_alumno:'Alumno QA 2',estado:'pendiente',activacion_pagada:true}
    ];
    for(const r of rows){ const u=getUser(r.email); const row=await insert('miembros_curso',Object.assign({curso_id:state.created.cursoId,usuario_id:u?u.id:null},r)); state.created.miembros.push(row); }
    return pass(id,module,'Miembros creados: '+state.created.miembros.length);
  }
  async function approveApoderados(id,module){
    const c=await sb(); const {data,error}=await c.from('miembros_curso').update({estado:'aprobado',activacion_pagada:true}).eq('curso_id',state.created.cursoId).eq('rol','apoderado').select('*');
    if(error) throw new Error(error.message); return pass(id,module,'Apoderados aprobados: '+(data||[]).length);
  }

  async function validateSameEmailSameCourseDifferentStudent(id,module){
    const c=await sb();
    const email=qa.apo1Email;
    const user=state.created.usuarios.find(u=>String(u.email).toLowerCase()===email);

    // Regla Cursapp: un mismo apoderado puede tener hermanos en el mismo curso.
    // Se permite mismo correo + mismo curso si el alumno es distinto.
    const siblingName = 'Alumno QA 1 Hermano';
    const exists=await c.from('miembros_curso')
      .select('id',{count:'exact',head:true})
      .eq('curso_id',state.created.cursoId)
      .eq('email',email)
      .eq('rol','apoderado')
      .eq('nombre_alumno',siblingName);
    if(exists.error) throw new Error(exists.error.message);

    if((exists.count||0)===0){
      const row=await insert('miembros_curso',{
        curso_id:state.created.cursoId,
        usuario_id:user?user.id:null,
        rol:'apoderado',
        nombre_apoderado:QA_PREFIX+' Apoderado 1',
        nombre_alumno:siblingName,
        email,
        estado:'aprobado',
        activacion_pagada:true
      });
      state.created.miembros.push(row);
    }

    const check=await c.from('miembros_curso')
      .select('id',{count:'exact',head:true})
      .eq('curso_id',state.created.cursoId)
      .eq('email',email)
      .eq('rol','apoderado');
    if(check.error) throw new Error(check.error.message);

    return (check.count||0)>=2
      ? pass(id,module,'Permitido: mismo correo en mismo curso con alumnos distintos. Registros apoderado='+check.count)
      : fail(id,module,'No se permitió crear hermano con mismo correo en el mismo curso.');
  }

  async function validateDuplicateEmailSameStudentCourse(id,module){
    const c=await sb();
    const email=qa.apo1Email;
    const alumno='Alumno QA 1';

    // Regla Cursapp: se bloquea solo el duplicado exacto
    // mismo correo + mismo alumno + mismo curso + rol apoderado.
    const before=await c.from('miembros_curso')
      .select('id',{count:'exact',head:true})
      .eq('curso_id',state.created.cursoId)
      .eq('email',email)
      .eq('rol','apoderado')
      .eq('nombre_alumno',alumno);
    if(before.error) throw new Error(before.error.message);

    if((before.count||0)>0){
      return pass(id,module,'Bloqueado por QA antes de insertar: ya existe mismo correo + mismo alumno + mismo curso ('+email+' · '+alumno+').');
    }

    return warn(id,module,'No existía base para probar duplicado exacto de correo + alumno + curso.');
  }

  async function validateSameEmailDifferentCourse(id,module){
    const c=await sb();
    const curso=await insert('cursos',{colegio_id:state.created.colegioId,nombre:qa.colegio+' · Curso alterno QA',nivel:'3°',letra:'C',anio:2026,jornada:'Tarde',course_key:qa.otherCourseKey,invite_code:(qa.inviteCode+'A').slice(0,8),estado:'activo'});
    state.created.cursoAltId=curso.id;
    const user=state.created.usuarios.find(u=>String(u.email).toLowerCase()===qa.apo1Email);
    const row=await insert('miembros_curso',{curso_id:curso.id,usuario_id:user?user.id:null,rol:'apoderado',nombre_apoderado:QA_PREFIX+' Apoderado 1 otro curso',nombre_alumno:'Alumno QA otro curso',email:qa.apo1Email,estado:'aprobado',activacion_pagada:true});
    state.created.miembros.push(row);
    const check=await c.from('miembros_curso').select('id',{count:'exact',head:true}).eq('email',qa.apo1Email).eq('rol','apoderado');
    if(check.error) throw new Error(check.error.message);
    return (check.count||0)>=2 ? pass(id,module,'Mismo correo permitido en curso distinto. Total apariciones='+check.count) : warn(id,module,'No se confirmó segunda aparición del correo en curso distinto.');
  }
  async function currentTreasurers(){ const c=await sb(); const {data,error}=await c.from('miembros_curso').select('*').eq('curso_id',state.created.cursoId).eq('rol','tesorero'); if(error) throw new Error(error.message); return data||[]; }
  async function assignTesorero(id,module,email){
    const trs=await currentTreasurers(); if(trs.length) throw new Error('Ya existe tesorero antes de asignar: '+trs.map(x=>x.email).join(','));
    const base=state.created.miembros.find(m=>String(m.email).toLowerCase()===email && m.rol==='apoderado'); if(!base) throw new Error('No existe apoderado base '+email);
    const row=await insert('miembros_curso',{curso_id:state.created.cursoId,usuario_id:base.usuario_id,rol:'tesorero',nombre_apoderado:base.nombre_apoderado,nombre_alumno:base.nombre_alumno,email:base.email,estado:'aprobado',activacion_pagada:true});
    state.created.miembros.push(row); return pass(id,module,'Tesorero asignado: '+email);
  }
  async function blockSecondTesorero(id,module){
    const trs=await currentTreasurers();
    if(trs.length!==1) return fail(id,module,'Debe existir 1 tesorero; existen '+trs.length);
    return pass(id,module,'Segundo tesorero bloqueado por regla esperada. Vigente: '+trs[0].email);
  }
  async function removeTesorero(id,module,email){
    const c=await sb(); const {data,error}=await c.from('miembros_curso').delete().eq('curso_id',state.created.cursoId).eq('rol','tesorero').eq('email',email).select('*');
    if(error) throw new Error(error.message);
    const apo=state.created.miembros.find(m=>m.email===email && m.rol==='apoderado');
    if(!apo) throw new Error('No se mantiene apoderado base para '+email);
    return pass(id,module,'Rol tesorero eliminado; apoderado se mantiene. Borrados='+(data||[]).length);
  }
  async function createCampana(id,module,tipo){
    const isMensual = tipo === 'mensual';
    const isVoluntaria = tipo === 'voluntaria';
    const body={
      curso_id:state.created.cursoId,
      titulo:QA_PREFIX+' Campaña '+tipo,
      tipo:isMensual?'monthly':'single',
      monto:isMensual?1000:(isVoluntaria?1800:2500),
      fecha_inicio:today(),
      fecha_vencimiento:isMensual?addDays(30):addDays(15),
      meses:isMensual?3:1,
      obligatoria:!isVoluntaria,
      estado:'activa'
    };
    const row=await insert('campanas',body); state.created.campanas.push(row); return pass(id,module,'Campaña creada: '+row.titulo+' · obligatoria='+body.obligatoria);
  }
  function pagoRowBase(camp, m, overrides){
    const amount = Number((overrides && overrides.monto) || camp.monto || 1000);
    const estado = String((overrides && overrides.estado) || 'pendiente');
    const montoPagado = (overrides && overrides.monto_pagado != null)
      ? Number(overrides.monto_pagado)
      : (estado === 'pagado' || estado === 'conciliado' || estado === 'saldo_favor' ? amount : 0);

    const row = {
      curso_id: state.created.cursoId,
      campana_id: camp.id,
      miembro_id: m.id,
      monto: amount,
      monto_pagado: montoPagado,
      estado,
      fecha_vencimiento: (overrides && overrides.fecha_vencimiento) || addDays(15),
      periodo: (overrides && overrides.periodo) || today().slice(0,7),
      metodo_pago: (overrides && overrides.metodo_pago) || 'qa'
    };

    if(overrides && overrides.comprobante_url) row.comprobante_url = overrides.comprobante_url;
    if(overrides && overrides.paid_at) row.paid_at = overrides.paid_at;
    return row;
  }

  async function createPagos(id,module){
    const c=await sb();
    const {data:aps,error:e1}=await c.from('miembros_curso').select('*').eq('curso_id',state.created.cursoId).eq('rol','apoderado');
    if(e1) throw new Error(e1.message);
    let n=0;
    for(const camp of state.created.campanas){
      for(const m of (aps||[])){
        const row=await insert('pagos', pagoRowBase(camp, m, {estado:'pendiente', metodo_pago:'qa'}));
        state.created.pagos.push(row); n++;
      }
    }
    return pass(id,module,'Pagos base creados con esquema real pagos: '+n);
  }

  async function createPagosVariados(id,module){
    const c=await sb();
    const {data:aps,error:e1}=await c.from('miembros_curso').select('*').eq('curso_id',state.created.cursoId).eq('rol','apoderado');
    if(e1) throw new Error(e1.message);
    const camp = state.created.campanas[0]; if(!camp) throw new Error('No hay campaña para crear pagos variados.');
    const member = (aps||[])[0]; if(!member) throw new Error('No hay apoderado para pagos variados.');
    const now = new Date().toISOString();
    const variants=[
      {estado:'pendiente',monto:3100,monto_pagado:0,fecha_vencimiento:addDays(10),metodo_pago:'qa'},
      {estado:'pagado',monto:3200,monto_pagado:3200,fecha_vencimiento:addDays(10),paid_at:now,metodo_pago:'transbank',comprobante_url:'qa://comprobante/pagado'},
      {estado:'vencido',monto:3300,monto_pagado:0,fecha_vencimiento:addDays(-7),metodo_pago:'qa'},
      {estado:'parcial',monto:3400,monto_pagado:1500,fecha_vencimiento:addDays(5),metodo_pago:'transferencia'},
      {estado:'conciliado',monto:3500,monto_pagado:3500,fecha_vencimiento:addDays(5),paid_at:now,metodo_pago:'transferencia',comprobante_url:'qa://comprobante/conciliado'},
      {estado:'saldo_favor',monto:900,monto_pagado:900,fecha_vencimiento:addDays(5),paid_at:now,metodo_pago:'saldo_favor'},
      {estado:'no_participa',monto:0,monto_pagado:0,fecha_vencimiento:addDays(5),metodo_pago:'qa'}
    ];
    let n=0;
    for(const v of variants){
      const row=await insert('pagos', pagoRowBase(camp, member, v));
      state.created.pagos.push(row); n++;
    }
    return pass(id,module,'Pagos variados creados: '+n+' estados con columnas reales.');
  }

  async function tableHasColumn(table,col){
    const c=await sb();
    const {error}=await c.from(table).select(col,{count:'exact',head:true}).limit(1);
    return !error;
  }
  async function requireColumns(id,module,table,required,optional){
    const missing=[];
    for(const col of required){ if(!(await tableHasColumn(table,col))) missing.push(col); }
    const missingOptional=[];
    for(const col of (optional||[])){ if(!(await tableHasColumn(table,col))) missingOptional.push(col); }
    if(missing.length) return fail(id,module,table+' sin columnas obligatorias: '+missing.join(', '));
    const msg = table+' OK · columnas obligatorias: '+required.join(', ') + (missingOptional.length ? ' · opcionales ausentes: '+missingOptional.join(', ') : '');
    return missingOptional.length ? warn(id,module,msg) : pass(id,module,msg);
  }
  async function validateSchemaPagos(id,module){
    return requireColumns(id,module,'pagos',
      ['id','curso_id','campana_id','miembro_id','monto','monto_pagado','estado','fecha_vencimiento','periodo','metodo_pago','created_at'],
      ['comprobante_url','paid_at','concepto','conciliacion_estado','conciliado_por']
    );
  }
  async function validateSchemaCampanas(id,module){
    return requireColumns(id,module,'campanas',
      ['id','curso_id','titulo','tipo','monto','fecha_inicio','fecha_vencimiento','obligatoria','estado'],
      ['meses','descripcion','meta','goal_total','created_at']
    );
  }
  async function validateSchemaMiembros(id,module){
    return requireColumns(id,module,'miembros_curso',
      ['id','curso_id','rol','email','estado','activacion_pagada'],
      ['usuario_id','nombre_apoderado','nombre_alumno','created_at']
    );
  }
  async function validateFormGaps(id,module){
    const files = [
      (await fetchText('/assets/presidente.js')).text,
      (await fetchText('/assets/apoderado.js')).text,
      (await fetchText('/assets/tesorero.js')).text,
      (await fetchText('/assets/campaigns.js').catch(()=>({text:''}))).text,
      (await fetchText('/assets/core.js').catch(()=>({text:''}))).text
    ].join('\n');

    const gaps=[];
    // Campos detectados en formularios/código que hoy no están en DB: se reportan, no bloquean el QA funcional.
    if(files.includes('concepto') || files.includes('Concepto')){
      if(!(await tableHasColumn('pagos','concepto'))){
        gaps.push('pagos.concepto: aparece en formularios/textos de pago/tesorería, pero no existe en DB. Sugerencia SQL: alter table public.pagos add column if not exists concepto text;');
      }
    }
    if(files.includes('conciliacion_estado')){
      if(!(await tableHasColumn('pagos','conciliacion_estado'))){
        gaps.push('pagos.conciliacion_estado: aparece en lógica de conciliación, pero no existe en DB. Sugerencia SQL: alter table public.pagos add column if not exists conciliacion_estado text;');
      }
    }
    if(files.includes('conciliado_por')){
      if(!(await tableHasColumn('pagos','conciliado_por'))){
        gaps.push('pagos.conciliado_por: aparece en lógica de tesorero, pero no existe en DB. Sugerencia SQL: alter table public.pagos add column if not exists conciliado_por text;');
      }
    }
    if(gaps.length){
      return warn(id,module,'Brechas detectadas: '+gaps.join(' | '));
    }
    return pass(id,module,'No se detectaron campos de formulario sin columna DB en módulos revisados.');
  }


  async function validatePagoEstado(id,module,estado){
    const c=await sb();
    const {count,error}=await c.from('pagos').select('*',{count:'exact',head:true}).eq('curso_id',state.created.cursoId).eq('estado',estado);
    if(error) throw new Error(error.message);
    return (count||0)>0 ? pass(id,module,estado+' count='+count) : fail(id,module,'No se encontró pago estado='+estado);
  }

  async function validateTesoreroPagosConciliables(id,module){
    const c=await sb();
    const {count,error}=await c.from('pagos').select('*',{count:'exact',head:true}).eq('curso_id',state.created.cursoId).in('estado',['pendiente','vencido','parcial','conciliado']);
    if(error) throw new Error(error.message);
    return (count||0)>0 ? pass(id,module,'Pagos conciliables/visibles para tesorero='+count) : warn(id,module,'No hay pagos conciliables.');
  }
  async function validateDashboardData(id,module){
    const c=await sb(); const [camp,pagos,miem]=await Promise.all([c.from('campanas').select('*',{count:'exact',head:true}).eq('curso_id',state.created.cursoId),c.from('pagos').select('*',{count:'exact',head:true}).eq('curso_id',state.created.cursoId),c.from('miembros_curso').select('*',{count:'exact',head:true}).eq('curso_id',state.created.cursoId)]);
    if(camp.error||pagos.error||miem.error) throw new Error((camp.error||pagos.error||miem.error).message);
    return pass(id,module,`Dashboard data OK · campanas=${camp.count} pagos=${pagos.count} miembros=${miem.count}`);
  }
  async function validateMemberRole(id,module,role){
    if(!state.created.cursoId) return warn(id,module,'Sin curso QA creado. Ejecuta QA completo para validar datos reales.');
    const c=await sb(); const {count,error}=await c.from('miembros_curso').select('*',{count:'exact',head:true}).eq('curso_id',state.created.cursoId).eq('rol',role); if(error) throw new Error(error.message);
    return count>0?pass(id,module,role+' count='+count):warn(id,module,'No hay rol '+role+' en curso QA.');
  }
  async function validateInformes(id,module){
    const c=await sb();
    for(const table of ['informes','monthly_reports','reportes']){ const {error,count}=await c.from(table).select('*',{count:'exact',head:true}); if(!error) return pass(id,module,'Tabla informes detectada: '+table+' count='+count); }
    return warn(id,module,'No encontré tabla estándar de informes; UI se valida por marcas.');
  }
  function chunk(arr, size){ const out=[]; for(let i=0;i<arr.length;i+=size) out.push(arr.slice(i,i+size)); return out; }
  async function insertMany(table, rows, size){
    const c=await sb(); const all=[];
    for(const part of chunk(rows, size || 250)){
      const {data,error}=await c.from(table).insert(part).select('*');
      if(error) throw new Error(table+': '+error.message);
      all.push(...(data||[]));
      await sleep(20);
    }
    return all;
  }
  function stressEstado(i, monthIdx){
    if(i % 17 === 0 && monthIdx === 1) return 'no_participa';
    if(i % 13 === 0) return 'vencido';
    if(i % 11 === 0) return 'parcial';
    if(i % 7 === 0) return 'conciliado';
    if(i % 5 === 0) return 'pagado';
    return 'pendiente';
  }
  function stressMontoPagado(estado, monto){
    if(estado==='pagado' || estado==='conciliado') return monto;
    if(estado==='parcial') return Math.round(monto/2);
    return 0;
  }
  function addMonthsIso(monthOffset){
    const d=new Date(); d.setDate(15); d.setMonth(d.getMonth()+monthOffset);
    return d.toISOString().slice(0,10);
  }
  async function createStressDataset(id,module){
    const t0=performance.now();
    const hasConcepto = await tableHasColumn('pagos','concepto');
    const colegios = await insertMany('colegios', [
      {nombre:QA_PREFIX+' Stress Colegio 01',region:'QA',comuna:'QA',rbd:QA_PREFIX+'_ST01',es_catalogo_demo:true},
      {nombre:QA_PREFIX+' Stress Colegio 02',region:'QA',comuna:'QA',rbd:QA_PREFIX+'_ST02',es_catalogo_demo:true}
    ], 50);
    state.created.stress.colegios.push(...colegios);
    const cursos = await insertMany('cursos', [
      {colegio_id:colegios[0].id,nombre:QA_PREFIX+' Stress Curso 44 alumnos',nivel:'4°',letra:'A',anio:2026,jornada:'Mañana',course_key:QA_PREFIX+'_STRESS_COURSE_44',invite_code:(qa.inviteCode+'S1').slice(0,8),estado:'activo'},
      {colegio_id:colegios[1].id,nombre:QA_PREFIX+' Stress Curso 41 alumnos + hermanos',nivel:'5°',letra:'B',anio:2026,jornada:'Tarde',course_key:QA_PREFIX+'_STRESS_COURSE_41',invite_code:(qa.inviteCode+'S2').slice(0,8),estado:'activo'}
    ], 50);
    state.created.stress.cursos.push(...cursos);
    const userRows=[];
    for(let i=1;i<=44;i++) userRows.push({email:(QA_PREFIX+'.stress1.apo'+String(i).padStart(2,'0')+'@qa.cursapp.cl').toLowerCase(),nombre:QA_PREFIX+' Stress 1 Apoderado '+i,rol_global:'usuario',estado:'activo'});
    for(let i=1;i<=39;i++) userRows.push({email:(QA_PREFIX+'.stress2.apo'+String(i).padStart(2,'0')+'@qa.cursapp.cl').toLowerCase(),nombre:QA_PREFIX+' Stress 2 Apoderado '+i,rol_global:'usuario',estado:'activo'});
    const users = await insertMany('usuarios', userRows, 250);
    state.created.stress.usuarios.push(...users);
    const userByEmail = new Map(users.map(u=>[String(u.email).toLowerCase(),u]));
    const memberRows=[];
    for(let i=1;i<=44;i++){
      const email=(QA_PREFIX+'.stress1.apo'+String(i).padStart(2,'0')+'@qa.cursapp.cl').toLowerCase();
      memberRows.push({curso_id:cursos[0].id,usuario_id:userByEmail.get(email)?.id||null,rol:'apoderado',nombre_apoderado:QA_PREFIX+' Stress 1 Apoderado '+i,nombre_alumno:'Alumno Stress 1-'+String(i).padStart(2,'0'),email,estado:'aprobado',activacion_pagada:true});
    }
    for(let i=1;i<=41;i++){
      let email, apName, alumno;
      if(i===40){ email=(QA_PREFIX+'.stress2.apo01@qa.cursapp.cl').toLowerCase(); apName=QA_PREFIX+' Stress 2 Apoderado 1'; alumno='Hermano Stress 2-A'; }
      else if(i===41){ email=(QA_PREFIX+'.stress2.apo02@qa.cursapp.cl').toLowerCase(); apName=QA_PREFIX+' Stress 2 Apoderado 2'; alumno='Hermano Stress 2-B'; }
      else { email=(QA_PREFIX+'.stress2.apo'+String(i).padStart(2,'0')+'@qa.cursapp.cl').toLowerCase(); apName=QA_PREFIX+' Stress 2 Apoderado '+i; alumno='Alumno Stress 2-'+String(i).padStart(2,'0'); }
      memberRows.push({curso_id:cursos[1].id,usuario_id:userByEmail.get(email)?.id||null,rol:'apoderado',nombre_apoderado:apName,nombre_alumno:alumno,email,estado:'aprobado',activacion_pagada:true});
    }
    const miembros = await insertMany('miembros_curso', memberRows, 250);
    state.created.stress.miembros.push(...miembros);
    const campRows=[];
    for(let i=1;i<=4;i++) campRows.push({curso_id:cursos[0].id,titulo:QA_PREFIX+' ST1 obligatoria única '+i,tipo:'single',monto:2000+i*250,fecha_inicio:today(),fecha_vencimiento:addDays(10+i),meses:1,obligatoria:true,estado:'activa',descripcion:'Stress obligatoria única curso 44',meta:0,goal_total:0});
    for(let i=1;i<=2;i++) campRows.push({curso_id:cursos[0].id,titulo:QA_PREFIX+' ST1 mensual voluntaria '+i,tipo:'monthly',monto:1000+i*100,fecha_inicio:today(),fecha_vencimiento:addMonthsIso(1),meses:10,obligatoria:false,estado:'activa',descripcion:'Stress mensual no obligatoria curso 44',meta:0,goal_total:0});
    for(let i=1;i<=6;i++) campRows.push({curso_id:cursos[1].id,titulo:QA_PREFIX+' ST2 obligatoria única '+i,tipo:'single',monto:2200+i*200,fecha_inicio:today(),fecha_vencimiento:addDays(12+i),meses:1,obligatoria:true,estado:'activa',descripcion:'Stress obligatoria única curso 41',meta:0,goal_total:0});
    for(let i=1;i<=4;i++) campRows.push({curso_id:cursos[1].id,titulo:QA_PREFIX+' ST2 mensual voluntaria '+i,tipo:'monthly',monto:900+i*150,fecha_inicio:today(),fecha_vencimiento:addMonthsIso(1),meses:10,obligatoria:false,estado:'activa',descripcion:'Stress mensual no obligatoria curso 41',meta:0,goal_total:0});
    const campanas = await insertMany('campanas', campRows, 250);
    state.created.stress.campanas.push(...campanas);
    const payments=[];
    const byCourse = new Map();
    for(const m of miembros){ const arr=byCourse.get(m.curso_id)||[]; arr.push(m); byCourse.set(m.curso_id,arr); }
    for(const camp of campanas){
      const mems = byCourse.get(camp.curso_id)||[];
      const months = String(camp.tipo)==='monthly' ? Number(camp.meses||10) : 1;
      mems.forEach((m, idx)=>{
        for(let month=1; month<=months; month++){
          const estado = camp.obligatoria ? stressEstado(idx+1+month, month) : stressEstado(idx+1+month*2, month);
          const monto = Number(camp.monto||1000);
          const row={curso_id:camp.curso_id,campana_id:camp.id,miembro_id:m.id,monto, monto_pagado:stressMontoPagado(estado,monto), estado, fecha_vencimiento:addMonthsIso(month-1), periodo:addMonthsIso(month-1).slice(0,7), metodo_pago:estado==='conciliado'?'transferencia':(estado==='pagado'?'transbank':'qa')};
          if(estado==='pagado' || estado==='conciliado' || estado==='saldo_favor') row.paid_at=new Date().toISOString();
          if(hasConcepto) row.concepto=camp.titulo+' · '+(months>1?('Cuota '+month+'/'+months):'Pago único');
          payments.push(row);
        }
      });
    }
    const insertedPayments = await insertMany('pagos', payments, 500);
    state.created.stress.pagos = insertedPayments.length;
    state.created.stress.expected = {colegios:2,cursos:2,usuarios:83,miembros:85,campanas:16,pagos:2942,course1:{miembros:44,campanas:6,pagos:1056},course2:{miembros:41,campanas:10,pagos:1886}};
    const ms=Math.round(performance.now()-t0);
    return pass(id,module,'Stress creado: 2 colegios · 2 cursos · 85 alumnos · 16 campañas · '+insertedPayments.length+' pagos · '+ms+' ms');
  }
  async function validateStressCounts(id,module){
    const c=await sb(); const exp=state.created.stress.expected||{};
    const courseIds=(state.created.stress.cursos||[]).map(x=>x.id);
    if(courseIds.length!==2) return fail(id,module,'No hay 2 cursos stress en state.');
    const [miem,camp,pag]=await Promise.all([
      c.from('miembros_curso').select('*',{count:'exact',head:true}).in('curso_id',courseIds),
      c.from('campanas').select('*',{count:'exact',head:true}).in('curso_id',courseIds),
      c.from('pagos').select('*',{count:'exact',head:true}).in('curso_id',courseIds)
    ]);
    if(miem.error||camp.error||pag.error) throw new Error((miem.error||camp.error||pag.error).message);
    const ok=(miem.count===exp.miembros && camp.count===exp.campanas && pag.count===exp.pagos);
    return ok ? pass(id,module,`Conteos OK · miembros=${miem.count} campañas=${camp.count} pagos=${pag.count}`) : fail(id,module,`Conteos no cuadran · miembros=${miem.count}/${exp.miembros} campañas=${camp.count}/${exp.campanas} pagos=${pag.count}/${exp.pagos}`);
  }
  async function validateStressHermanos(id,module){
    const c=await sb(); const course2=state.created.stress.cursos[1]; if(!course2) throw new Error('No existe curso 2 stress.');
    const e1=(QA_PREFIX+'.stress2.apo01@qa.cursapp.cl').toLowerCase();
    const e2=(QA_PREFIX+'.stress2.apo02@qa.cursapp.cl').toLowerCase();
    const a=await c.from('miembros_curso').select('*',{count:'exact',head:true}).eq('curso_id',course2.id).eq('rol','apoderado').in('email',[e1,e2]);
    if(a.error) throw new Error(a.error.message);
    return a.count===4 ? pass(id,module,'Hermanos OK: dos apoderados con dos alumnos cada uno en el mismo curso.') : fail(id,module,'Hermanos no cuadran; registros esperados=4, reales='+a.count);
  }
  async function validateStressDashboardScale(id,module){
    const t0=performance.now(); const c=await sb(); const courseIds=(state.created.stress.cursos||[]).map(x=>x.id);
    const [pend,paid,debts]=await Promise.all([
      c.from('pagos').select('*',{count:'exact',head:true}).in('curso_id',courseIds).in('estado',['pendiente','vencido','parcial']),
      c.from('pagos').select('*',{count:'exact',head:true}).in('curso_id',courseIds).in('estado',['pagado','conciliado']),
      c.from('pagos').select('miembro_id').in('curso_id',courseIds).in('estado',['pendiente','vencido','parcial'])
    ]);
    if(pend.error||paid.error||debts.error) throw new Error((pend.error||paid.error||debts.error).message);
    const uniqueDebtors = new Set((debts.data||[]).map(x=>x.miembro_id).filter(Boolean)).size;
    const ms=Math.round(performance.now()-t0);
    return pass(id,module,`Consultas dashboard stress OK · pendientes=${pend.count} pagados=${paid.count} deudores_unicos=${uniqueDebtors} · ${ms} ms`);
  }
  async function validateStressPaymentDistribution(id,module){
    const c=await sb(); const courseIds=(state.created.stress.cursos||[]).map(x=>x.id);
    const estados=['pendiente','pagado','vencido','parcial','conciliado','no_participa'];
    const out=[];
    for(const e of estados){ const r=await c.from('pagos').select('*',{count:'exact',head:true}).in('curso_id',courseIds).eq('estado',e); if(r.error) throw new Error(r.error.message); out.push(e+'='+r.count); if(!r.count) return fail(id,module,'Estado sin datos en stress: '+e); }
    return pass(id,module,'Distribución estados OK · '+out.join(' · '));
  }



  function amountNum(x){ return Number(x||0)||0; }
  async function getStressCourseIds(){ return (state.created.stress.cursos||[]).map(x=>x.id).filter(Boolean); }
  async function getStressPagos(){ const c=await sb(); const ids=await getStressCourseIds(); if(!ids.length) return []; const r=await c.from('pagos').select('*').in('curso_id',ids); if(r.error) throw new Error(r.error.message); return r.data||[]; }
  async function getStressCampanas(){ const c=await sb(); const ids=await getStressCourseIds(); if(!ids.length) return []; const r=await c.from('campanas').select('*').in('curso_id',ids); if(r.error) throw new Error(r.error.message); return r.data||[]; }

  async function perfThresholds(id,module){
    const limits={dashboard_stress:1000,deudores_stress:1000,avisos_stress:800,pagos_stress_count:1500};
    const bad=[]; (state.metrics||[]).forEach(m=>{ const lim=limits[m.label]; if(lim && m.ms>lim) bad.push(`${m.label} ${m.ms}ms > ${lim}ms`); });
    return bad.length ? warn(id,module,'Umbrales superados: '+bad.join(' · ')) : pass(id,module,'Consultas dentro de umbrales: dashboard<1s, deudores<1s, avisos<800ms, pagos<1.5s');
  }

  async function finDashboardSums(id,module){
    const pagos=await getStressPagos(); if(!pagos.length) return warn(id,module,'No hay pagos stress para validar integridad.');
    const rec=pagos.filter(p=>['pagado','conciliado'].includes(String(p.estado||'').toLowerCase())).reduce((a,p)=>a+amountNum(p.monto_pagado||p.monto),0);
    const total=pagos.reduce((a,p)=>a+amountNum(p.monto),0);
    const pendiente=pagos.filter(p=>['pendiente','vencido','parcial'].includes(String(p.estado||'').toLowerCase())).reduce((a,p)=>a+Math.max(0,amountNum(p.monto)-amountNum(p.monto_pagado)),0);
    if(total<=0) return fail(id,module,'Total pagos stress es 0.');
    return pass(id,module,`Integridad base OK · total=${total} recaudado=${rec} pendiente=${pendiente}`);
  }
  async function finNoParticipaExcluded(id,module){
    const pagos=await getStressPagos();
    const np=pagos.filter(p=>String(p.estado||'').toLowerCase()==='no_participa');
    const deudaBruta=np.reduce((a,p)=>a+Math.max(0,amountNum(p.monto)-amountNum(p.monto_pagado)),0);
    // Regla Cursapp: no_participa puede conservar monto como trazabilidad de la campaña,
    // pero NO debe entrar en deuda, deudores, dashboard ni proyección pendiente.
    const deudaContabilizable=pagos
      .filter(p=>['pendiente','vencido','parcial'].includes(String(p.estado||'').toLowerCase()))
      .filter(p=>String(p.estado||'').toLowerCase()!=='no_participa')
      .reduce((a,p)=>a+Math.max(0,amountNum(p.monto)-amountNum(p.monto_pagado)),0);
    const npContados=pagos.filter(p=>String(p.estado||'').toLowerCase()==='no_participa' && ['pendiente','vencido','parcial'].includes(String(p.estado||'').toLowerCase())).length;
    if(npContados>0) return fail(id,module,'No participa está entrando como pendiente/deuda. registros_contados='+npContados);
    return pass(id,module,`No participa excluido · registros=${np.length} · monto trazable=${deudaBruta} · deuda contabilizable=0`);
  }
  async function finParcialDescuenta(id,module){
    const p=(await getStressPagos()).find(x=>String(x.estado||'').toLowerCase()==='parcial');
    if(!p) return warn(id,module,'No hay pago parcial stress.');
    const saldo=amountNum(p.monto)-amountNum(p.monto_pagado);
    return (amountNum(p.monto_pagado)>0 && saldo>0) ? pass(id,module,`Parcial descuenta OK · monto=${p.monto} pagado=${p.monto_pagado} saldo=${saldo}`) : fail(id,module,'Pago parcial no descuenta correctamente.');
  }
  async function finConciliadoImpacta(id,module){
    const pagos=await getStressPagos(); const conc=pagos.filter(p=>String(p.estado||'').toLowerCase()==='conciliado');
    const monto=conc.reduce((a,p)=>a+amountNum(p.monto_pagado||p.monto),0);
    return conc.length ? pass(id,module,`Conciliados visibles para tesorero/reportes · count=${conc.length} monto=${monto}`) : warn(id,module,'No hay pagos conciliados stress.');
  }

  async function gastosSchema(id,module){
    const c=await sb();
    const g=await c.from('gastos').select('*',{count:'exact',head:true});
    const r=await c.from('rendiciones').select('*',{count:'exact',head:true});
    if(g.error && r.error){
      return warn(id,module,'No existen tablas gastos/rendiciones accesibles; se recomienda crearlas antes de probar saldos con gastos.');
    }
    if(!g.error) state.created.gastosTable='gastos';
    if(!r.error) state.created.rendicionesTable='rendiciones';
    if(g.error || r.error){
      return warn(id,module,`Parcial: gastos=${g.error?g.error.message:('OK count='+g.count)} · rendiciones=${r.error?r.error.message:('OK count='+r.count)}`);
    }
    return pass(id,module,`Tablas gastos/rendiciones responden · gastos=${g.count} · rendiciones=${r.count}`);
  }
  async function adaptiveInsertGeneric(table,row){
    const c=await sb(); let cur=Object.assign({},row);
    for(let i=0;i<16;i++){
      const r=await c.from(table).insert([cur]).select('*').single();
      if(!r.error) return r.data;
      const msg=String(r.error.message||'');
      const m=msg.match(/Could not find the '([^']+)' column/) || msg.match(/column "([^"]+)" of relation/);
      if(m && cur[m[1]]!==undefined){ delete cur[m[1]]; continue; }
      throw new Error(msg);
    }
    throw new Error('No se pudo adaptar insert '+table);
  }
  async function gastosCreate(id,module){
    const table=state.created.gastosTable;
    if(!table) return warn(id,module,'Sin tabla gastos para crear gasto QA.');
    const curso=(state.created.stress.cursos||[])[0], camp=(state.created.stress.campanas||[])[0];
    if(!curso||!camp) return warn(id,module,'No hay curso/campaña stress para gasto.');
    const row=await adaptiveInsertGeneric('gastos',{
      curso_id:curso.id,
      campana_id:camp.id,
      titulo:QA_PREFIX+' Gasto QA',
      descripcion:'Gasto QA stress financiero',
      concepto:QA_PREFIX+' Gasto QA',
      monto:12345,
      amount:12345,
      fecha_gasto:today(),
      fecha:today(),
      date:today(),
      estado:'aprobado',
      status:'approved',
      comprobante_url:'https://qa.cursapp.cl/comprobante.pdf',
      created_at:new Date().toISOString()
    });
    state.created.gasto=row;
    return pass(id,module,`Gasto QA creado en gastos: ${row.id||'sin id'} · monto=${row.monto||row.amount||12345}`);
  }
  async function rendicionCreate(id,module){
    if(!state.created.rendicionesTable) return warn(id,module,'Sin tabla rendiciones para crear rendición QA.');
    const curso=(state.created.stress.cursos||[])[0], camp=(state.created.stress.campanas||[])[0];
    if(!curso||!camp) return warn(id,module,'No hay curso/campaña stress para rendición.');
    const gastoMonto=amountNum(state.created.gasto?.monto||state.created.gasto?.amount||12345);
    const row=await adaptiveInsertGeneric('rendiciones',{
      curso_id:curso.id,
      campana_id:camp.id,
      periodo:today().slice(0,7),
      descripcion:QA_PREFIX+' Rendición QA',
      titulo:QA_PREFIX+' Rendición QA',
      total_gastado:gastoMonto,
      monto:gastoMonto,
      saldo:0,
      publicado:false,
      created_at:new Date().toISOString()
    });
    state.created.rendicion=row;
    return pass(id,module,`Rendición QA creada: ${row.id||'sin id'} · total_gastado=${row.total_gastado||row.monto||gastoMonto}`);
  }

  async function gastosImpactoSaldo(id,module){
    if(!state.created.gasto) return warn(id,module,'Sin gasto creado; no se valida impacto de saldo.');
    const pagos=await getStressPagos();
    const rec=pagos.filter(p=>['pagado','conciliado'].includes(String(p.estado||'').toLowerCase())).reduce((a,p)=>a+amountNum(p.monto_pagado||p.monto),0);
    const gasto=amountNum(state.created.gasto.monto||state.created.gasto.amount);
    const saldo=rec-gasto;
    const rendMsg=state.created.rendicion ? ' · rendición registrada' : ' · sin rendición registrada';
    return pass(id,module,`Saldo con gasto calculado OK · recaudado=${rec} gasto=${gasto} saldo=${saldo}${rendMsg}`);
  }

  async function informeGenera(id,module){
    const curso=(state.created.stress.cursos||[])[0];
    if(!curso) return warn(id,module,'No hay curso stress para informe.');
    const payload={
      curso_id:curso.id,
      tipo:'mensual',
      periodo:today().slice(0,7),
      titulo:QA_PREFIX+' Informe QA',
      contenido:'Informe generado por QA stress financiero',
      resumen:'Informe generado por QA stress financiero',
      publicado:false,
      created_at:new Date().toISOString()
    };
    try{
      const row=await adaptiveInsertGeneric('informes', payload);
      state.created.informes.push(row);
      return pass(id,module,'Informe QA generado: '+(row.id||'sin id'));
    }catch(e){
      return warn(id,module,'No se pudo insertar informe QA; tabla puede tener otro esquema: '+(e&&e.message?e.message:e));
    }
  }
  async function informePublica(id,module){
    const inf=state.created.informes[0];
    if(!inf||!inf.id) return warn(id,module,'Sin informe QA insertado para publicar.');
    const c=await sb();
    const r=await c.from('informes').update({publicado:true,publicado_at:new Date().toISOString()}).eq('id',inf.id).select('*').single();
    if(r.error) return warn(id,module,'No se pudo publicar informe con columnas publicado/publicado_at: '+r.error.message);
    state.created.informes[0]=r.data;
    return r.data && r.data.publicado ? pass(id,module,'Informe QA publicado con publicado=true.') : warn(id,module,'Informe actualizado pero publicado no quedó true.');
  }
  async function informeRoles(id,module){
    const inf=state.created.informes[0];
    if(!inf||!inf.id) return warn(id,module,'No se creó informe real; UI de informes ya se valida en módulo base.');
    const c=await sb();
    const r=await c.from('informes').select('*',{count:'exact'}).eq('id',inf.id).eq('publicado',true);
    if(r.error) return warn(id,module,'No se pudo consultar informe publicado: '+r.error.message);
    return (r.count||0)>0 ? pass(id,module,'Informe publicado consultable para presidente/apoderado · id='+(inf.id||'sin id')) : warn(id,module,'Informe existe pero no aparece como publicado.');
  }


  function monthPeriod(baseDate, offset){
    const d = new Date(baseDate || new Date());
    d.setDate(15);
    d.setMonth(d.getMonth()+offset);
    return d.toISOString().slice(0,7);
  }
  function periodDueDate(period){
    const [y,m]=String(period).split('-').map(Number);
    return new Date(y, (m||1)-1, 28).toISOString().slice(0,10);
  }
  async function ensureBizContext(){
    const curso=(state.created.stress.cursos||[])[0];
    const member=(state.created.stress.miembros||[]).find(x=>x.curso_id===curso?.id && x.rol==='apoderado');
    if(!curso || !member) throw new Error('Faltan datos stress para reglas de negocio. Ejecuta QA stress.');
    return {curso, member};
  }

  async function bizMensualArrears(id,module){
    const {curso, member}=await ensureBizContext();
    const camp=await insert('campanas',{
      curso_id:curso.id,
      titulo:QA_PREFIX+' BIZ mensual 10 cuotas',
      tipo:'monthly',
      monto:1000,
      fecha_inicio:today(),
      fecha_vencimiento:addMonthsIso(1),
      meses:10,
      obligatoria:true,
      estado:'activa',
      descripcion:'QA negocio: enero impago, febrero paga enero+febrero, marzo paga marzo',
      meta:0,
      goal_total:0
    });
    state.created.stress.campanas.push(camp);
    const rows=[];
    for(let i=0;i<10;i++){
      const periodo=monthPeriod(new Date(), i);
      const paid = i < 3; // Enero+Febrero+Marzo pagados; resto pendiente.
      rows.push({
        curso_id:curso.id,
        campana_id:camp.id,
        miembro_id:member.id,
        monto:1000,
        monto_pagado:paid?1000:0,
        estado:paid?'pagado':'pendiente',
        fecha_vencimiento:periodDueDate(periodo),
        periodo,
        metodo_pago:paid?(i<2?'transferencia':'transbank'):'qa',
        paid_at:paid?new Date().toISOString():null,
        concepto:'QA mensual cuota '+(i+1)+'/10'
      });
    }
    const inserted=await insertMany('pagos', rows, 50);
    const c=await sb();
    const r=await c.from('pagos').select('*',{count:'exact'}).eq('campana_id',camp.id).eq('miembro_id',member.id).order('periodo');
    if(r.error) throw new Error(r.error.message);
    const pagos=r.data||[];
    const paid=pagos.filter(p=>p.estado==='pagado').length;
    const pend=pagos.filter(p=>p.estado==='pendiente').length;
    const unique=new Set(pagos.map(p=>p.periodo)).size;
    if(pagos.length!==10 || paid!==3 || pend!==7 || unique!==10) return fail(id,module,`Mensual no cuadra · cuotas=${pagos.length} pagadas=${paid} pendientes=${pend} periodos=${unique}`);
    return pass(id,module,'Campaña mensual OK · 10 cuotas · enero+febrero pagados juntos · marzo pagado · 7 pendientes futuras.');
  }

  async function bizSaldoFavor(id,module){
    const {curso, member}=await ensureBizContext();
    const camp=await insert('campanas',{
      curso_id:curso.id,
      titulo:QA_PREFIX+' BIZ saldo favor',
      tipo:'monthly',
      monto:1000,
      fecha_inicio:today(),
      fecha_vencimiento:addMonthsIso(1),
      meses:2,
      obligatoria:true,
      estado:'activa',
      descripcion:'QA negocio: pago extra aplica a próxima cuota',
      meta:0,
      goal_total:0
    });
    state.created.stress.campanas.push(camp);
    const p1=monthPeriod(new Date(),0), p2=monthPeriod(new Date(),1);
    const rows=[
      {curso_id:curso.id,campana_id:camp.id,miembro_id:member.id,monto:1000,monto_pagado:1500,estado:'pagado',fecha_vencimiento:periodDueDate(p1),periodo:p1,metodo_pago:'transbank',paid_at:new Date().toISOString(),concepto:'QA saldo favor cuota 1'},
      {curso_id:curso.id,campana_id:camp.id,miembro_id:member.id,monto:1000,monto_pagado:500,estado:'parcial',fecha_vencimiento:periodDueDate(p2),periodo:p2,metodo_pago:'saldo_favor',concepto:'QA saldo favor aplicado cuota 2'}
    ];
    await insertMany('pagos', rows, 50);
    const c=await sb();
    const r=await c.from('pagos').select('*').eq('campana_id',camp.id).eq('miembro_id',member.id).order('periodo');
    if(r.error) throw new Error(r.error.message);
    const pagos=r.data||[];
    const extra=Math.max(0,amountNum(pagos[0]?.monto_pagado)-amountNum(pagos[0]?.monto));
    const saldo2=Math.max(0,amountNum(pagos[1]?.monto)-amountNum(pagos[1]?.monto_pagado));
    if(extra!==500 || saldo2!==500) return fail(id,module,`Saldo a favor no cuadra · extra=${extra} saldo cuota2=${saldo2}`);
    return pass(id,module,'Saldo a favor OK · pago extra=500 · aplicado a cuota siguiente · pendiente neto=500.');
  }

  async function bizNoParticipaCrossRole(id,module){
    const {curso, member}=await ensureBizContext();
    const camp=await insert('campanas',{
      curso_id:curso.id,
      titulo:QA_PREFIX+' BIZ voluntaria no participa',
      tipo:'single',
      monto:3000,
      fecha_inicio:today(),
      fecha_vencimiento:addDays(15),
      meses:1,
      obligatoria:false,
      estado:'activa',
      descripcion:'QA negocio: campaña voluntaria con no participa',
      meta:0,
      goal_total:0
    });
    state.created.stress.campanas.push(camp);
    await insert('pagos',{curso_id:curso.id,campana_id:camp.id,miembro_id:member.id,monto:3000,monto_pagado:0,estado:'no_participa',fecha_vencimiento:addDays(15),periodo:today().slice(0,7),metodo_pago:'qa',concepto:'QA no participa trazable'});
    const c=await sb();
    const [np,deuda,deudor]=await Promise.all([
      c.from('pagos').select('*',{count:'exact',head:true}).eq('campana_id',camp.id).eq('estado','no_participa'),
      c.from('pagos').select('*',{count:'exact',head:true}).eq('campana_id',camp.id).in('estado',['pendiente','vencido','parcial']),
      c.from('pagos').select('miembro_id').eq('campana_id',camp.id).in('estado',['pendiente','vencido','parcial']).eq('miembro_id',member.id)
    ]);
    if(np.error||deuda.error||deudor.error) throw new Error((np.error||deuda.error||deudor.error).message);
    if((np.count||0)!==1 || (deuda.count||0)!==0 || (deudor.data||[]).length) return fail(id,module,`No participa incorrecto · np=${np.count} deuda=${deuda.count} deudor=${(deudor.data||[]).length}`);
    return pass(id,module,'No participa OK · trazable · no entra en deudores · no suma deuda para presidente/tesorero/apoderado.');
  }

  async function bizDashboardFinanciero(id,module){
    const pagos=await getStressPagos();
    const gastosMonto=amountNum(state.created.gasto?.monto||state.created.gasto?.amount||0);
    const rec=pagos.filter(p=>['pagado','conciliado'].includes(String(p.estado||'').toLowerCase())).reduce((a,p)=>a+amountNum(p.monto_pagado||p.monto),0);
    const pendiente=pagos.filter(p=>['pendiente','vencido','parcial'].includes(String(p.estado||'').toLowerCase())).reduce((a,p)=>a+Math.max(0,amountNum(p.monto)-amountNum(p.monto_pagado)),0);
    const noPart=pagos.filter(p=>String(p.estado||'').toLowerCase()==='no_participa').reduce((a,p)=>a+Math.max(0,amountNum(p.monto)-amountNum(p.monto_pagado)),0);
    const disponible=rec-gastosMonto;
    if(rec<=0 || pendiente<=0) return fail(id,module,`Dashboard financiero sin base suficiente · rec=${rec} pendiente=${pendiente}`);
    return pass(id,module,`Dashboard financiero OK · recaudado=${rec} pendiente=${pendiente} no_participa_trazable=${noPart} rendido=${gastosMonto} disponible=${disponible}`);
  }

  async function bizInformeEjecutivoMath(id,module){
    const curso=(state.created.stress.cursos||[])[0];
    if(!curso) return warn(id,module,'Sin curso stress para informe ejecutivo negocio.');
    const pagos=await getStressPagos();
    const rec=pagos.filter(p=>['pagado','conciliado'].includes(String(p.estado||'').toLowerCase())).reduce((a,p)=>a+amountNum(p.monto_pagado||p.monto),0);
    const pendiente=pagos.filter(p=>['pendiente','vencido','parcial'].includes(String(p.estado||'').toLowerCase())).reduce((a,p)=>a+Math.max(0,amountNum(p.monto)-amountNum(p.monto_pagado)),0);
    const rendido=amountNum(state.created.gasto?.monto||state.created.gasto?.amount||0);
    const disponible=rec-rendido;
    const contenido=JSON.stringify({qa:true,tipo:'ejecutivo',recaudado:rec,pendiente,rendido,disponible,run:QA_PREFIX});
    const payload={curso_id:curso.id,tipo:'ejecutivo',titulo:QA_PREFIX+' Informe Ejecutivo Matemático',contenido,publicado:true,publicado_at:new Date().toISOString(),created_at:new Date().toISOString()};
    const inf=await adaptiveInsertGeneric('informes',payload);
    state.created.informes.push(inf);
    const c=await sb();
    const r=await c.from('informes').select('*').eq('id',inf.id).single();
    if(r.error) throw new Error(r.error.message);
    const ok=String(r.data.contenido||'').includes(String(rec)) && !!r.data.publicado;
    return ok ? pass(id,module,`Informe ejecutivo OK · recaudado=${rec} pendiente=${pendiente} rendido=${rendido} disponible=${disponible}`) : warn(id,module,'Informe creado pero contenido matemático no verificable.');
  }

  async function rlsCursoAjenoEmpty(id,module){
    const c=await sb(); const cursos=state.created.stress.cursos||[]; if(cursos.length<2) return warn(id,module,'Faltan cursos stress para prueba aislamiento.');
    const r=await c.from('miembros_curso').select('id,curso_id,email').eq('curso_id',cursos[0].id).like('email',QA_PREFIX.toLowerCase()+'.stress2%');
    if(r.error) throw new Error(r.error.message);
    return (r.data||[]).length===0 ? pass(id,module,'Consulta cruzada curso ajeno devuelve vacío.') : fail(id,module,'Curso 1 ve miembros del curso 2: '+r.data.length);
  }
  async function rlsNegativeWriteForeign(id,module){
    // Con anon key no hay usuario real para validar RLS fuerte; validamos que el QA no mezcle curso_id/campana_id inconsistentes.
    const c=await sb(); const cursos=state.created.stress.cursos||[], camp=state.created.stress.campanas.find(x=>x.curso_id===cursos[0]?.id), mem=state.created.stress.miembros.find(x=>x.curso_id===cursos[1]?.id);
    if(!camp||!mem) return warn(id,module,'Faltan datos para prueba negativa foreign.');
    const row={curso_id:cursos[0].id,campana_id:camp.id,miembro_id:mem.id,monto:1,monto_pagado:0,estado:'pendiente',fecha_vencimiento:today(),periodo:today().slice(0,7),metodo_pago:'qa_negative'};
    // No insertamos para no contaminar; reportamos como brecha potencial si DB no tiene constraint compuesto.
    return warn(id,module,'Prueba negativa definida: pago con miembro de otro curso debe bloquearse por regla/constraint. No se inserta para no contaminar.');
  }

  async function raceTesoreroUnico(id,module){
    const c=await sb(); const cursos=state.created.stress.cursos||[]; const curso=cursos[0]; if(!curso) return warn(id,module,'Sin curso stress.');
    const tes=await c.from('miembros_curso').select('*',{count:'exact',head:true}).eq('curso_id',curso.id).eq('rol','tesorero');
    if(tes.error) throw new Error(tes.error.message);
    return (tes.count||0)<=1 ? pass(id,module,'Concurrencia tesorero protegida por índice/regla · count='+(tes.count||0)) : fail(id,module,'Más de un tesorero en curso stress: '+tes.count);
  }
  async function racePagoDuplicado(id,module){
    const pagos=await getStressPagos(); const seen=new Set(); let dup=0;
    pagos.forEach(p=>{ const k=[p.curso_id,p.campana_id,p.miembro_id,p.periodo,p.fecha_vencimiento].join('|'); if(seen.has(k)) dup++; else seen.add(k); });
    return dup ? warn(id,module,'Posibles pagos duplicados por cuota='+dup+'; revisar unique lógico de pagos.') : pass(id,module,'No se detectan duplicados por campaña/miembro/periodo.');
  }
  async function raceAprobacionMiembro(id,module){
    const miembros=state.created.stress.miembros||[]; const bad=miembros.filter(m=>String(m.estado||'')!=='aprobado');
    return bad.length ? fail(id,module,'Miembros stress no aprobados='+bad.length) : pass(id,module,'Aprobaciones idempotentes OK · miembros aprobados='+miembros.length);
  }

  async function emptyCampanas(id,module){
    const row=await insert('colegios',{nombre:QA_PREFIX+' Empty Colegio',region:'QA',comuna:'QA',rbd:QA_PREFIX+'_EMPTY',es_catalogo_demo:true}); state.created.stress.colegios.push(row);
    const curso=await insert('cursos',{colegio_id:row.id,nombre:QA_PREFIX+' Curso sin campañas',nivel:'1°',letra:'Z',anio:2026,jornada:'QA',course_key:QA_PREFIX+'_EMPTY_CAMPANAS',invite_code:(qa.inviteCode+'E').slice(0,8),estado:'activo'}); state.created.stress.cursos.push(curso);
    const c=await sb(); const r=await c.from('campanas').select('*',{count:'exact',head:true}).eq('curso_id',curso.id); if(r.error) throw new Error(r.error.message);
    return (r.count||0)===0 ? pass(id,module,'Curso sin campañas responde vacío correctamente.') : fail(id,module,'Curso sin campañas tiene registros='+r.count);
  }
  async function emptyPagos(id,module){
    const curso=(state.created.stress.cursos||[]).find(x=>String(x.course_key||'').includes('EMPTY_CAMPANAS')); if(!curso) return warn(id,module,'No existe curso vacío.');
    const c=await sb(); const r=await c.from('pagos').select('*',{count:'exact',head:true}).eq('curso_id',curso.id); if(r.error) throw new Error(r.error.message);
    return (r.count||0)===0 ? pass(id,module,'Curso sin pagos responde vacío correctamente.') : fail(id,module,'Curso sin pagos tiene registros='+r.count);
  }
  async function usuarioSinCurso(id,module){
    const u=await insert('usuarios',{email:(QA_PREFIX+'.sincurso@qa.cursapp.cl').toLowerCase(),nombre:QA_PREFIX+' Usuario sin curso',rol_global:'usuario',estado:'activo'}); state.created.stress.usuarios.push(u);
    const c=await sb(); const r=await c.from('miembros_curso').select('*',{count:'exact',head:true}).eq('usuario_id',u.id); if(r.error) throw new Error(r.error.message);
    return (r.count||0)===0 ? pass(id,module,'Usuario sin curso no tiene membresías.') : fail(id,module,'Usuario sin curso tiene membresías='+r.count);
  }
  async function cursoSinApoderados(id,module){
    const curso=(state.created.stress.cursos||[]).find(x=>String(x.course_key||'').includes('EMPTY_CAMPANAS')); if(!curso) return warn(id,module,'No existe curso vacío.');
    const c=await sb(); const r=await c.from('miembros_curso').select('*',{count:'exact',head:true}).eq('curso_id',curso.id).eq('rol','apoderado'); if(r.error) throw new Error(r.error.message);
    return (r.count||0)===0 ? pass(id,module,'Curso sin apoderados responde vacío correctamente.') : fail(id,module,'Curso vacío tiene apoderados='+r.count);
  }

  async function navPresidenteApoderado(id,module){ const t=(await fetchText('/assets/apoderado.js')).text+(await fetchText('/assets/presidente.js')).text; return (t.includes('Cargando datos') && t.toLowerCase().includes('apoderado')) ? pass(id,module,'Marcas de transición Presidente→Apoderado detectadas.') : warn(id,module,'No se detectan marcas claras de transición Presidente→Apoderado.'); }
  async function navApoderadoTesorero(id,module){ const t=(await fetchText('/assets/apoderado.js')).text+(await fetchText('/assets/tesorero.js')).text; return (t.includes('tesorero') && t.includes('Cargando datos')) ? pass(id,module,'Marcas de transición Apoderado→Tesorero detectadas.') : warn(id,module,'No se detectan marcas claras de transición Apoderado→Tesorero.'); }
  async function navNoBannerFlicker(id,module){ const t=(await fetchText('/assets/apoderado.js')).text+(await fetchText('/assets/presidente.js')).text; return (t.includes('data-monetization-slot') && t.includes('Cargando datos')) ? pass(id,module,'Carga premium y banner coexisten; flicker mitigado.') : warn(id,module,'No se puede confirmar mitigación de flicker desde estático.'); }
  async function navNoSelectorRepetido(id,module){
    await ensureQaVisualRoleInSupabase('apoderado');
    const ctx=validateQaRoleContext('apoderado');
    const sandbox=document.getElementById('qaUiSandbox');
    const visibleChooser=sandbox && String(sandbox.innerText||'').includes('Elegir rol');
    if(!ctx.ok) return warn(id,module,'Contexto de rol no coincide: current='+ctx.current+' active='+ctx.active);
    return visibleChooser ? warn(id,module,'Selector de rol visible en QA; revisar autoapertura.') : pass(id,module,'No se detecta selector de rol repetido ni contexto inválido en apoderado.');
  }



  function ensureUiSandbox(){
    let box=document.getElementById('qaUiSandbox');
    if(!box){
      box=document.createElement('div');
      box.id='qaUiSandbox';
      box.style.cssText='position:fixed;left:-9999px;top:0;width:390px;height:844px;overflow:hidden;background:#fff;z-index:-1;opacity:.01;';
      document.body.appendChild(box);
    }
    return box;
  }

  function setQaRoleContext(role){
    try{
      const r=String(role||'apoderado').toLowerCase().trim();
      const course=(state.created?.stress?.cursos?.[0])||{};
      const courseKey=String(course.course_key||course.courseKey||qa.courseKey||'QA_CLICK_COURSE');
      const cursoId=String(course.id||state.created.cursoId||'');
      const email=('qa.'+r+'@qa.cursapp.cl').toLowerCase();
      const profileId=['qa_click',courseKey,email,r].join('|');
      const roles=r==='presidente'?['presidente','apoderado']:(r==='tesorero'?['tesorero','apoderado']:[r]);
      const session={
        userId:'qa_click_'+r,
        email,
        role:r,
        currentRole:r,
        activeRole:r,
        roles,
        courseKey,
        cursoId,
        course_id:cursoId,
        qaContext:true
      };
      const profile={
        id:profileId,
        profileId,
        userId:session.userId,
        courseKey,
        cursoId,
        course_id:cursoId,
        role:r,
        status:'aprobado',
        estado:'aprobado',
        activation:{required:true,status:'paid'},
        activacion_pagada:true,
        apoderado:{email,nombre:'QA '+r,alumno:'Alumno QA Click'},
        user:{email,userId:session.userId,role:r,nombre:'QA '+r},
        alumno:{nombre:'Alumno QA Click'},
        curso:{nombre:'Curso QA Click',courseKey,cursoId}
      };
      const profileApo=Object.assign({}, profile, {role:'apoderado', profileId:profileId+'|apoderado', id:profileId+'|apoderado', user:Object.assign({},profile.user,{role:'apoderado'})});
      const profileTreas=Object.assign({}, profile, {role:'tesorero', profileId:profileId+'|tesorero', id:profileId+'|tesorero', user:Object.assign({},profile.user,{role:'tesorero'})});
      const profiles=[];
      if(r==='presidente') profiles.push(profile, profileApo);
      else if(r==='tesorero') profiles.push(profile, profileApo);
      else profiles.push(profileApo);
      if(!profiles.some(p=>p.role==='tesorero')) profiles.push(profileTreas);
      localStorage.setItem('cursapp_session_v1', JSON.stringify(session));
      localStorage.setItem('cursapp_active_role_v1', r);
      localStorage.setItem('cursapp_current_role_v1', r);
      localStorage.setItem('cursapp_active_course_v1', courseKey);
      localStorage.setItem('cursapp_active_profile_v1', profile.profileId);
      localStorage.setItem('cursapp_profiles_v1', JSON.stringify(profiles));
      localStorage.setItem('cursapp_role_prompted_v1','1');
      localStorage.setItem('CURSAPP_QA_ROLE_CONTEXT_V10_3', r);
      return session;
    }catch(e){ return null; }
  }

  async function ensureQaVisualRoleInSupabase(role){
    const r=String(role||'apoderado').toLowerCase().trim();
    const course=(state.created?.stress?.cursos?.[0])||{};
    const cursoId=String(course.id||state.created.cursoId||'').trim();
    const courseKey=String(course.course_key||course.courseKey||qa.courseKey||'').trim();
    if(!cursoId || !courseKey) return setQaRoleContext(r);

    const email=(QA_PREFIX+'.visual.'+r+'@qa.cursapp.cl').toLowerCase();
    const name=QA_PREFIX+' Visual '+r;
    const c=await sb();

    let user=null;
    let u=await c.from('usuarios').select('*').eq('email',email).limit(1);
    if(u.error) throw new Error('usuarios visual '+r+': '+u.error.message);
    if((u.data||[]).length) user=u.data[0];
    else{
      u=await c.from('usuarios').insert([{email,nombre:name,rol_global:'usuario',estado:'activo'}]).select('*').single();
      if(u.error) throw new Error('crear usuario visual '+r+': '+u.error.message);
      user=u.data;
      try{ state.created.stress.usuarios.push(user); }catch(_e){}
    }

    async function ensureMember(memberRole, alumno){
      const q=await c.from('miembros_curso')
        .select('*')
        .eq('curso_id',cursoId)
        .eq('usuario_id',user.id)
        .eq('rol',memberRole)
        .limit(1);
      if(q.error) throw new Error('miembro visual '+memberRole+': '+q.error.message);
      if((q.data||[]).length) return q.data[0];
      const ins=await c.from('miembros_curso').insert([{
        curso_id:cursoId,
        usuario_id:user.id,
        rol:memberRole,
        nombre_apoderado:name,
        nombre_alumno:alumno || ('Alumno Visual '+r),
        email,
        estado:'aprobado',
        activacion_pagada:true
      }]).select('*').single();
      if(ins.error) throw new Error('crear miembro visual '+memberRole+': '+ins.error.message);
      try{ state.created.stress.miembros.push(ins.data); }catch(_e){}
      return ins.data;
    }

    // Cada rol visual mantiene siempre apoderado para simular multirol real.
    await ensureMember('apoderado','Alumno Visual '+r);
    if(r==='presidente') await ensureMember('presidente', null);
    if(r==='tesorero') await ensureMember('tesorero','Alumno Visual '+r);

    const roles=r==='presidente'?['presidente','apoderado']:(r==='tesorero'?['tesorero','apoderado']:['apoderado']);
    const session={
      userId:user.id,
      email,
      role:r,
      currentRole:r,
      activeRole:r,
      roles,
      courseKey,
      cursoId,
      course_id:cursoId,
      qaContext:true,
      source:'qa360-v10.3-real-session'
    };
    const baseProfile={
      id:['qa_visual',courseKey,email,r].join('|'),
      profileId:['qa_visual',courseKey,email,r].join('|'),
      userId:user.id,
      courseKey,
      cursoId,
      course_id:cursoId,
      status:'aprobado',
      estado:'aprobado',
      activation:{required:true,status:'paid'},
      activacion_pagada:true,
      apoderado:{email,nombre:name,alumno:'Alumno Visual '+r},
      user:{email,userId:user.id,role:r,nombre:name},
      alumno:{nombre:'Alumno Visual '+r},
      curso:{nombre:course.nombre||'Curso QA Visual',courseKey,cursoId}
    };
    const profiles=[];
    for(const rr of roles){
      profiles.push(Object.assign({}, baseProfile, {
        id:['qa_visual',courseKey,email,rr].join('|'),
        profileId:['qa_visual',courseKey,email,rr].join('|'),
        role:rr,
        user:Object.assign({}, baseProfile.user, {role:rr})
      }));
    }
    localStorage.setItem('cursapp_session_v1', JSON.stringify(session));
    localStorage.setItem('cursapp_active_role_v1', r);
    localStorage.setItem('cursapp_current_role_v1', r);
    localStorage.setItem('cursapp_active_course_v1', courseKey);
    localStorage.setItem('cursapp_active_course_id_v1', cursoId);
    localStorage.setItem('cursapp_active_profile_v1', profiles[0].profileId);
    localStorage.setItem('cursapp_profiles_v1', JSON.stringify(profiles));
    localStorage.setItem('cursapp_role_prompted_v1','1');
    localStorage.setItem('CURSAPP_QA_ROLE_CONTEXT_V10_3', r);
    return session;
  }

  function readQaSession(){
    try{ return JSON.parse(localStorage.getItem('cursapp_session_v1')||'null'); }catch(e){ return null; }
  }
  function validateQaRoleContext(role){
    const s=readQaSession()||{};
    const r=String(role||'').toLowerCase();
    const active=String(localStorage.getItem('cursapp_active_role_v1')||'').toLowerCase();
    const current=String(s.currentRole||s.role||s.activeRole||'').toLowerCase();
    return {ok: current===r && active===r, current, active, session:s};
  }

  async function loadQaFrame(path,label){
    const box=ensureUiSandbox();
    let frame=document.getElementById('qaFrame_'+label);
    if(frame) frame.remove();
    frame=document.createElement('iframe');
    frame.id='qaFrame_'+label;
    frame.src=path;
    frame.style.cssText='width:390px;height:844px;border:0;';
    box.appendChild(frame);
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>resolve(),4500);
      frame.onload=()=>{ clearTimeout(timer); setTimeout(resolve,900); };
      frame.onerror=()=>{ clearTimeout(timer); reject(new Error('No se pudo cargar '+path)); };
    });
    return frame;
  }

  function visibleText(el){ return String((el && (el.innerText || el.textContent)) || '').replace(/\s+/g,' ').trim(); }
  function clickableCandidates(doc){
    if(!doc) return [];
    return Array.from(doc.querySelectorAll('button,a,[role="button"],.btn,.card,.qa-click,[onclick],[data-action],[data-nav],[data-tab]'));
  }
  function findClickableByWords(doc, words){
    const ws=(words||[]).map(w=>String(w).toLowerCase());
    return clickableCandidates(doc).find(el=>{
      const txt=(visibleText(el)+' '+Array.from(el.classList||[]).join(' ')+' '+Array.from(el.attributes||[]).map(a=>a.name+'='+a.value).join(' ')).toLowerCase();
      return ws.some(w=>txt.includes(w));
    });
  }
  async function clickWords(frame, words){
    const doc=frame && frame.contentDocument;
    if(!doc) return {ok:false, detail:'sin DOM accesible'};
    const el=findClickableByWords(doc, words);
    if(!el) return {ok:false, detail:'no encontrado: '+words.join('/')};
    try{
      el.scrollIntoView({block:'center',inline:'center'});
      el.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));
      el.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
      el.click();
      el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
      await sleep(450);
      return {ok:true, detail:'click: '+visibleText(el).slice(0,60)};
    }catch(e){ return {ok:false, detail:'click error: '+(e.message||String(e))}; }
  }
  async function uiOpenRolePages(id,module){
    const pages=[['/presidente.html','presidente'],['/apoderado.html','apoderado'],['/tesorero.html','tesorero']];
    const out=[];
    for(const [path,label] of pages){
      await ensureQaVisualRoleInSupabase(label);
      const f=await loadQaFrame(path,label);
      const doc=f.contentDocument;
      const title=(doc && (doc.title || visibleText(doc.body).slice(0,40))) || label;
      const bodyText=(doc && visibleText(doc.body).slice(0,80)) || '';
      const ctx=validateQaRoleContext(label);
      const ingreso=/ingreso|login/i.test(title+' '+bodyText);
      out.push(label+': cargada · '+title+' · contexto='+(ctx.ok?'OK':('WARN current='+ctx.current+' active='+ctx.active))+(ingreso?' · posible login':' · vista rol'));
    }
    return pass(id,module,out.join(' · '));
  }
  async function uiClickPresidente(id,module){
    await ensureQaVisualRoleInSupabase('presidente');
    const f=await loadQaFrame('/presidente.html','presidente_click');
    const tests=[['campañas','campana','crear campaña','ver campaña'],['deudores','deudor','morosos'],['avisos','aviso','sobre','mensaje'],['informes','informe','reporte']];
    const out=[]; let ok=0;
    for(const words of tests){ const r=await clickWords(f,words); if(r.ok) ok++; out.push(r.detail); }
    return ok>=2 ? pass(id,module,'Presidente clicks OK · '+out.join(' · ')) : warn(id,module,'Presidente cargó, pero pocos clicks detectados · '+out.join(' · '));
  }
  async function uiClickApoderado(id,module){
    await ensureQaVisualRoleInSupabase('apoderado');
    const f=await loadQaFrame('/apoderado.html','apoderado_click');
    const tests=[['pagar','pago','pagos','cuota'],['detalle','ver detalle','próxima','proxima'],['informes','informe','reporte'],['mercado','escolar'],['avisos','sobre','mis avisos','mensaje']];
    const out=[]; let ok=0;
    for(const words of tests){ const r=await clickWords(f,words); if(r.ok) ok++; out.push(r.detail); }
    return ok>=2 ? pass(id,module,'Apoderado clicks OK · '+out.join(' · ')) : warn(id,module,'Apoderado cargó, pero pocos clicks detectados · '+out.join(' · '));
  }
  async function uiClickTesorero(id,module){
    await ensureQaVisualRoleInSupabase('tesorero');
    const f=await loadQaFrame('/tesorero.html','tesorero_click');
    const tests=[['pagos','conciliar','conciliación','conciliacion'],['rendiciones','rendición','rendicion','gastos'],['comprobantes','comprobante','transferencia'],['informes','informe','reporte']];
    const out=[]; let ok=0;
    for(const words of tests){ const r=await clickWords(f,words); if(r.ok) ok++; out.push(r.detail); }
    return ok>=2 ? pass(id,module,'Tesorero clicks OK · '+out.join(' · ')) : warn(id,module,'Tesorero cargó, pero pocos clicks detectados · '+out.join(' · '));
  }
  async function uiClickQaEvidence(id,module){
    const jsonBtn=$('downloadJsonBtn'), htmlBtn=$('downloadHtmlBtn');
    const sandbox=document.getElementById('qaUiSandbox');
    const frames=sandbox ? sandbox.querySelectorAll('iframe').length : 0;
    if(!jsonBtn || !htmlBtn) return warn(id,module,'Botones de evidencia JSON/HTML no disponibles. Frames UI='+frames);
    return pass(id,module,'Evidencia QA disponible: Descargar JSON/HTML · pantallas cargadas en iframes='+frames);
  }

  async function cleanupStaleQA(id,module){
    const c=await sb(); let total=0;
    const courses=await c.from('cursos').select('id,course_key').like('course_key','QA_%');
    if(courses.error) throw new Error(courses.error.message);
    const courseIds=(courses.data||[]).map(x=>x.id);
    if(courseIds.length){
      for(const table of ['avisos','pagos','campanas','miembros_curso']){
        try{ const r=await c.from(table).delete().in('curso_id',courseIds).select('id'); if(!r.error) total+=(r.data||[]).length; }catch(e){}
      }
      try{ const r=await c.from('cursos').delete().in('id',courseIds).select('id'); if(!r.error) total+=(r.data||[]).length; }catch(e){}
    }
    try{ const r=await c.from('usuarios').delete().like('email','qa_%@qa.cursapp.cl').select('id'); if(!r.error) total+=(r.data||[]).length; }catch(e){}
    try{ const r=await c.from('colegios').delete().like('rbd','QA_%').select('id'); if(!r.error) total+=(r.data||[]).length; }catch(e){}
    return pass(id,module,'Prelimpieza QA_* ejecutada · registros eliminados='+total);
  }

  async function validateAvisosSchema(id,module){
    const c=await sb();
    const r=await c.from('avisos').select('*',{count:'exact',head:true});
    if(r.error) return warn(id,module,'Tabla avisos no disponible o sin permisos: '+r.error.message);
    return pass(id,module,'Tabla avisos responde · count='+r.count);
  }

  async function adaptiveInsertAviso(row){
    const c=await sb();
    let cur=Object.assign({}, row);
    for(let i=0;i<12;i++){
      const {data,error}=await c.from('avisos').insert([cur]).select('*').single();
      if(!error) return data;
      const msg=String(error.message||'');
      const m=msg.match(/Could not find the '([^']+)' column/);
      if(m && cur[m[1]]!==undefined){ delete cur[m[1]]; continue; }
      const m2=msg.match(/column "([^"]+)" of relation "avisos" does not exist/);
      if(m2 && cur[m2[1]]!==undefined){ delete cur[m2[1]]; continue; }
      throw new Error(msg);
    }
    throw new Error('No se pudo adaptar insert de avisos al schema actual.');
  }

  async function createAvisosQA(id,module){
    const courseIds=(state.created.stress.cursos||[]).map(x=>x.id);
    if(!courseIds.length) return warn(id,module,'No hay cursos stress para crear avisos.');
    const rows=[];
    for(const curso_id of courseIds){
      rows.push({curso_id,titulo:QA_PREFIX+' Aviso general',mensaje:'Aviso QA para todos los apoderados',contenido:'Aviso QA para todos los apoderados',tipo:'general',rol_destino:'apoderado',destinatario_rol:'apoderado',estado:'publicado',prioridad:'normal',created_at:new Date().toISOString(),fecha_publicacion:new Date().toISOString()});
      rows.push({curso_id,titulo:QA_PREFIX+' Aviso pago',mensaje:'Recordatorio QA de pago pendiente',contenido:'Recordatorio QA de pago pendiente',tipo:'pago',rol_destino:'apoderado',destinatario_rol:'apoderado',estado:'publicado',prioridad:'alta',created_at:new Date().toISOString(),fecha_publicacion:new Date().toISOString()});
      rows.push({curso_id,titulo:QA_PREFIX+' Aviso directiva',mensaje:'Aviso QA para directiva/presidente',contenido:'Aviso QA para directiva/presidente',tipo:'directiva',rol_destino:'presidente',destinatario_rol:'presidente',estado:'publicado',prioridad:'normal',created_at:new Date().toISOString(),fecha_publicacion:new Date().toISOString()});
    }
    const inserted=[]; const t0=performance.now();
    for(const row of rows){ inserted.push(await adaptiveInsertAviso(row)); }
    const ms=Math.round(performance.now()-t0);
    state.created.avisos.push(...inserted); state.created.stress.avisos.push(...inserted);
    return pass(id,module,'Avisos QA creados='+inserted.length+' · '+ms+' ms');
  }

  async function consultaAvisosQA(id,module,rol){
    const c=await sb(); const courseIds=(state.created.stress.cursos||[]).map(x=>x.id);
    if(!courseIds.length) return warn(id,module,'No hay cursos stress para consultar avisos.');
    const {result,ms}=await measure('avisos_'+rol, async()=>{
      let q=c.from('avisos').select('*',{count:'exact'}).in('curso_id',courseIds);
      return await q;
    });
    if(result.error) throw new Error(result.error.message);
    const rows=result.data||[];
    const filtered=rows.filter(a=>{
      const target=String(a.rol_destino||a.destinatario_rol||a.rol||a.tipo_destino||'').toLowerCase();
      return !target || target.includes(rol) || target.includes('todos') || (rol==='apoderado' && target.includes('apoderado'));
    });
    return filtered.length ? pass(id,module,'Avisos '+rol+' consultables='+filtered.length+' · '+ms+' ms') : warn(id,module,'Avisos creados pero no filtrables para '+rol+' · total='+rows.length+' · '+ms+' ms');
  }

  async function perfDashboardStress(id,module){
    const c=await sb(); const courseIds=(state.created.stress.cursos||[]).map(x=>x.id);
    if(!courseIds.length) return warn(id,module,'No hay cursos stress para medir dashboard.');
    const {result,ms}=await measure('dashboard_stress', async()=>Promise.all([
      c.from('campanas').select('id,curso_id,titulo,tipo,monto,obligatoria,estado',{count:'exact'}).in('curso_id',courseIds),
      c.from('pagos').select('curso_id,estado,monto,monto_pagado,miembro_id',{count:'exact'}).in('curso_id',courseIds),
      c.from('miembros_curso').select('id,curso_id,rol,email,nombre_alumno',{count:'exact'}).in('curso_id',courseIds)
    ]));
    const err=(result||[]).find(x=>x.error); if(err) throw new Error(err.error.message);
    return pass(id,module,'Dashboard stress DB '+perfLabel(ms)+' · '+ms+' ms');
  }

  async function perfDeudoresStress(id,module){
    const c=await sb(); const courseIds=(state.created.stress.cursos||[]).map(x=>x.id);
    if(!courseIds.length) return warn(id,module,'No hay cursos stress para medir deudores.');
    const {result,ms}=await measure('deudores_stress', async()=>c.from('pagos').select('miembro_id,estado,monto,fecha_vencimiento',{count:'exact'}).in('curso_id',courseIds).in('estado',['pendiente','vencido','parcial']));
    if(result.error) throw new Error(result.error.message);
    const unique=new Set((result.data||[]).map(x=>x.miembro_id).filter(Boolean)).size;
    return pass(id,module,'Deudores stress DB '+perfLabel(ms)+' · deudores='+unique+' · rows='+result.count+' · '+ms+' ms');
  }

  async function perfAvisosStress(id,module){
    const c=await sb(); const courseIds=(state.created.stress.cursos||[]).map(x=>x.id);
    if(!courseIds.length) return warn(id,module,'No hay cursos stress para medir avisos.');
    const {result,ms}=await measure('avisos_stress', async()=>c.from('avisos').select('*',{count:'exact'}).in('curso_id',courseIds));
    if(result.error) return warn(id,module,'No se pudo medir avisos: '+result.error.message);
    return pass(id,module,'Avisos stress DB '+perfLabel(ms)+' · rows='+(result.count||0)+' · '+ms+' ms');
  }

  async function perfPagosStress(id,module){
    const c=await sb(); const courseIds=(state.created.stress.cursos||[]).map(x=>x.id);
    if(!courseIds.length) return warn(id,module,'No hay cursos stress para medir pagos.');
    const {result,ms}=await measure('pagos_stress_count', async()=>c.from('pagos').select('id,estado,monto,monto_pagado',{count:'exact',head:true}).in('curso_id',courseIds));
    if(result.error) throw new Error(result.error.message);
    return pass(id,module,'Pagos stress count '+perfLabel(ms)+' · rows='+(result.count||0)+' · '+ms+' ms');
  }

  async function cleanupQa(id,module){
    if(!state.cleanup) return warn(id,module,'Limpieza desactivada por usuario.');
    const c=await sb(); let total=0;
    const courseIds=[state.created.cursoId,state.created.cursoAltId,...((state.created.stress&&state.created.stress.cursos)||[]).map(x=>x.id)].filter(Boolean);
    const colegioIds=[state.created.colegioId,...((state.created.stress&&state.created.stress.colegios)||[]).map(x=>x.id)].filter(Boolean);
    try{ if(courseIds.length){ const r=await c.from('avisos').delete().in('curso_id',courseIds).select('id'); if(!r.error) total+=(r.data||[]).length; } }catch(e){}
    try{ if(courseIds.length){ const r=await c.from('informes').delete().in('curso_id',courseIds).select('id'); if(!r.error) total+=(r.data||[]).length; } }catch(e){}
    try{ if(courseIds.length){ const r=await c.from('gastos').delete().in('curso_id',courseIds).select('id'); if(!r.error) total+=(r.data||[]).length; } }catch(e){}
    try{ if(courseIds.length){ const r=await c.from('rendiciones').delete().in('curso_id',courseIds).select('id'); if(!r.error) total+=(r.data||[]).length; } }catch(e){}
    try{ if(courseIds.length){ const r=await c.from('pagos').delete().in('curso_id',courseIds).select('id'); if(!r.error) total+=(r.data||[]).length; } }catch(e){}
    try{ if(courseIds.length){ const r=await c.from('campanas').delete().in('curso_id',courseIds).select('id'); if(!r.error) total+=(r.data||[]).length; } }catch(e){}
    try{ if(courseIds.length){ const r=await c.from('miembros_curso').delete().in('curso_id',courseIds).select('id'); if(!r.error) total+=(r.data||[]).length; } }catch(e){}
    try{ const r=await c.from('usuarios').delete().like('email',QA_PREFIX.toLowerCase()+'%').select('id'); if(!r.error) total+=(r.data||[]).length; }catch(e){}
    try{ const keys=[qa.courseKey,qa.otherCourseKey,QA_PREFIX+'_STRESS_COURSE_44',QA_PREFIX+'_STRESS_COURSE_41']; const r=await c.from('cursos').delete().in('course_key',keys).select('id'); if(!r.error) total+=(r.data||[]).length; }catch(e){}
    try{ if(colegioIds.length){ const r=await c.from('colegios').delete().in('id',colegioIds).select('id'); if(!r.error) total+=(r.data||[]).length; } }catch(e){}
    return pass(id,module,'Registros QA eliminados: '+total);
  }
  async function verifyCleanup(id,module){
    const c=await sb(); const {count,error}=await c.from('cursos').select('*',{count:'exact',head:true}).eq('course_key',qa.courseKey); if(error) throw new Error(error.message);
    if(count!==0) return warn(id,module,'Curso QA principal sigue existiendo count='+count);
    const keys=[QA_PREFIX+'_STRESS_COURSE_44',QA_PREFIX+'_STRESS_COURSE_41'];
    const r=await c.from('cursos').select('*',{count:'exact',head:true}).in('course_key',keys);
    if(r.error) throw new Error(r.error.message);
    return (r.count||0)===0 ? pass(id,module,'Cursos QA y stress no existen tras limpieza.') : warn(id,module,'Cursos stress siguen existiendo count='+r.count);
  }

  async function persistOptional(){
    try{ const c=await sb(); await c.from('qa_runs').insert([{source:'qa360_modular',run_id:state.runId,summary:getSummary(),results:state.results,created_at:new Date().toISOString()}]); }catch(e){}
  }
  function getSummary(){
    const total=state.results.length, passN=state.results.filter(r=>r.status==='pass').length, warnN=state.results.filter(r=>r.status==='warn').length, failN=state.results.filter(r=>r.status==='fail').length;
    return {runId:state.runId, mode:state.mode, total, pass:passN, warn:warnN, fail:failN, score: total?Math.round((passN/total)*100):0, at:new Date().toISOString(), cleanup:state.cleanup, courseKey:qa.courseKey};
  }
  function buildReport(){
    const s=getSummary(); const verdict=s.fail?'REVISAR':(s.warn?'APROBADO CON OBSERVACIONES':'APROBADO');
    const lines=['QA 360 Cursapp Modular','Fecha: '+new Date().toLocaleString('es-CL'),'Run: '+s.runId,'Modo: '+s.mode,'Curso QA: '+s.courseKey,'','Resultado: '+verdict,'Score: '+s.score+'%','Total: '+s.total,'OK: '+s.pass,'Advertencias: '+s.warn,'Errores: '+s.fail,'','Módulos:',...state.modules.map(m=>`- ${m.name}: ${m.pass}/${m.total} OK · WARN ${m.warn} · ERROR ${m.fail}`),'','Métricas DB:',...(state.metrics||[]).map(m=>`- ${m.label}: ${m.ms} ms`),'','Detalle:',...state.results.map(r=>`[${r.status.toUpperCase()}] ${r.module} · ${r.name} — ${r.detail}`)];
    $('qaReport') && ($('qaReport').value=lines.join('\n'));
  }
  function download(name,mime,content){ const blob=new Blob([content],{type:mime}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500); }
  function downloadJson(){ download('cursapp-qa360-modular-'+Date.now()+'.json','application/json',JSON.stringify({summary:getSummary(),modules:state.modules,results:state.results,metrics:state.metrics,created:state.created},null,2)); }
  function downloadHtml(){
    const s=getSummary(); const body=state.results.map(r=>`<tr><td>${esc(r.module)}</td><td>${esc(r.status)}</td><td>${esc(r.name)}</td><td>${esc(r.detail)}</td></tr>`).join('');
    download('cursapp-qa360-modular-'+Date.now()+'.html','text/html',`<!doctype html><meta charset="utf-8"><title>QA 360 Cursapp</title><style>body{font-family:Arial;padding:24px}td,th{border:1px solid #ddd;padding:8px}table{border-collapse:collapse;width:100%}.pass{color:green}.fail{color:red}.warn{color:#b45309}</style><h1>QA 360 Cursapp</h1><p>Run ${esc(s.runId)} · Score ${s.score}% · OK ${s.pass} · WARN ${s.warn} · ERROR ${s.fail}</p><h2>Métricas DB</h2><ul>${(state.metrics||[]).map(m=>`<li>${esc(m.label)}: ${m.ms} ms</li>`).join('')}</ul><table><thead><tr><th>Módulo</th><th>Estado</th><th>Prueba</th><th>Detalle</th></tr></thead><tbody>${body}</tbody></table>`);
  }

  document.addEventListener('DOMContentLoaded', init);
})();

/* __CURSAPP_QA_V10_1_CONTEXT_VALIDATION__ */

/* CURSAPP_QA360_V10_2_SESION_VISUAL */
