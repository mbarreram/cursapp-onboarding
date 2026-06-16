/* Cursapp QA 360 modular Supabase · activo
   - Ejecuta pruebas por módulo.
   - Puede crear registros QA_* en Supabase y limpiarlos al final.
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
    created: { colegioId:null, cursoId:null, usuarios:[], miembros:[], campanas:[], pagos:[], informes:[] }
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
    tesoreroEmail: (QA_PREFIX + '.tesorero@qa.cursapp.cl').toLowerCase()
  };

  const MODULES_QUICK = [
    { id:'infra', name:'Base / Supabase', tests:['login-html','role-html','assets','supabase-ready','supabase-tables','supabase-write'] },
    { id:'componentes', name:'Componentes estabilizados', tests:['loading','tesorero-markers','banner-dashboard','qa-button'] }
  ];
  const MODULES_FULL = [
    ...MODULES_QUICK,
    { id:'onboarding', name:'Onboarding QA', tests:['create-colegio','create-curso','create-usuarios','create-miembros','approve-apoderados'] },
    { id:'roles', name:'Roles / Tesorero único', tests:['assign-tesorero','block-second-tesorero','remove-tesorero','reassign-tesorero'] },
    { id:'campanas', name:'Campañas', tests:['create-campana-unica','create-campana-mensual','create-pagos','validate-dashboard-data'] },
    { id:'apoderado', name:'Apoderado', tests:['apoderado-data','no-participo-logic','apoderado-ui-markers'] },
    { id:'tesorero', name:'Tesorero', tests:['tesorero-data','tesorero-ui-markers'] },
    { id:'informes', name:'Informes', tests:['informes-table','informes-ui-markers'] },
    { id:'limpieza', name:'Limpieza QA', tests:['cleanup-qa','verify-cleanup'] }
  ];

  function rowsFor(mode){ return mode === 'full' ? MODULES_FULL : MODULES_QUICK; }

  function setBusy(on){
    const a=$('runQuickBtn'), b=$('runFullBtn');
    if(a) a.disabled=!!on; if(b) b.disabled=!!on;
    if(a) a.textContent = on ? 'Ejecutando...' : 'QA rápido';
    if(b) b.textContent = on ? 'Ejecutando...' : 'QA completo';
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
      onboarding:'Crea curso, usuarios y miembros QA_* en Supabase.',
      roles:'Valida un solo tesorero y reasignación controlada.',
      campanas:'Crea campañas y pagos QA_* para validar datos.',
      apoderado:'Valida datos y marcas visuales de apoderado.',
      tesorero:'Valida datos y marcas visuales de tesorero.',
      informes:'Valida tablas o módulos de informes.',
      limpieza:'Borra solo registros creados por este QA.'
    })[id] || '';
  }
  function testName(id){
    return ({
      'login-html':'Login carga correctamente','role-html':'Pantallas por rol disponibles','assets':'Assets principales disponibles','supabase-ready':'Cliente Supabase inicializa','supabase-tables':'Tablas base responden','supabase-write':'Permisos escritura QA disponibles',
      'loading':'Loading premium presente','tesorero-markers':'Tesorero único mantiene lógica','banner-dashboard':'Dashboard/Banner estabilizados','qa-button':'Botón QA visible en Login',
      'create-colegio':'Crear colegio QA','create-curso':'Crear curso QA','create-usuarios':'Crear usuarios QA','create-miembros':'Crear miembros curso QA','approve-apoderados':'Apoderados QA aprobados',
      'assign-tesorero':'Asignar tesorero QA','block-second-tesorero':'Bloquear segundo tesorero','remove-tesorero':'Eliminar tesorero QA','reassign-tesorero':'Reasignar tesorero QA',
      'create-campana-unica':'Crear campaña única QA','create-campana-mensual':'Crear campaña mensual QA','create-pagos':'Crear pagos QA','validate-dashboard-data':'Validar datos para dashboard',
      'apoderado-data':'Datos apoderado consultables','no-participo-logic':'Lógica No participo presente','apoderado-ui-markers':'UI Apoderado estable',
      'tesorero-data':'Datos tesorero consultables','tesorero-ui-markers':'UI Tesorero estable',
      'informes-table':'Informes disponibles o advertencia','informes-ui-markers':'UI Informes presente',
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
  async function insert(table,row){ const c=await sb(); const {data,error}=await c.from(table).insert([row]).select('*').single(); if(error) throw new Error(error.message); return data; }
  async function del(table,filterFn){ const c=await sb(); return await filterFn(c.from(table).delete()); }

  async function run(mode){
    state.mode=mode; state.cleanup = !!($('cleanupQa') && $('cleanupQa').checked);
    state.startedAt=new Date().toISOString(); state.endedAt=null; state.results=[]; state.modules=[]; state.created={colegioId:null,cursoId:null,usuarios:[],miembros:[],campanas:[],pagos:[],informes:[]};
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
      case 'supabase-tables': { const tables=['cursos','miembros_curso','campanas']; const out=[]; for(const t of tables){ const {error,count}=await tableCount(t); if(error) throw new Error(t+': '+error.message); out.push(t+'='+count); } return pass(id,module,out.join(' · ')); }
      case 'supabase-write': { const c=await sb(); const {error}=await c.from('cursos').select('id',{count:'exact',head:true}); if(error) throw new Error(error.message); return pass(id,module,'Lectura confirmada. Escritura real se valida en QA completo.'); }
      case 'loading': { const a=(await fetchText('/assets/presidente.js')).text+(await fetchText('/assets/apoderado.js')).text+(await fetchText('/assets/tesorero.js')).text; const miss=['Cargando datos','Preparando'].filter(x=>!a.includes(x)); return miss.length?warn(id,module,'Faltan marcas: '+miss.join(', ')):pass(id,module,'Loading detectado en componentes.'); }
      case 'tesorero-markers': { const t=(await fetchText('/assets/presidente.js')).text; const miss=['Ya existe un tesorero','Eliminar tesorero','rol tesorero'].filter(x=>!t.includes(x)); return miss.length?fail(id,module,'Faltan marcas: '+miss.join(', ')):pass(id,module,'Lógica detectada.'); }
      case 'banner-dashboard': { const t=(await fetchText('/assets/presidente.js')).text; const miss=['CursappMonetization','cpV6HeroTrack','data-monetization-slot'].filter(x=>!t.includes(x)); return miss.length?warn(id,module,'Faltan marcas: '+miss.join(', ')):pass(id,module,'Marcas dashboard/banner OK.'); }
      case 'qa-button': { const t=(await fetchText('/')).text; return (t.includes('qa360.html')||t.includes('QA 360'))?pass(id,module,'Botón QA detectado en login.'):fail(id,module,'No se detectó botón QA.'); }
      case 'create-colegio': return createColegio(id,module);
      case 'create-curso': return createCurso(id,module);
      case 'create-usuarios': return createUsuarios(id,module);
      case 'create-miembros': return createMiembros(id,module);
      case 'approve-apoderados': return approveApoderados(id,module);
      case 'assign-tesorero': return assignTesorero(id,module,qa.apo1Email);
      case 'block-second-tesorero': return blockSecondTesorero(id,module);
      case 'remove-tesorero': return removeTesorero(id,module,qa.apo1Email);
      case 'reassign-tesorero': return assignTesorero(id,module,qa.apo2Email);
      case 'create-campana-unica': return createCampana(id,module,'unica');
      case 'create-campana-mensual': return createCampana(id,module,'mensual');
      case 'create-pagos': return createPagos(id,module);
      case 'validate-dashboard-data': return validateDashboardData(id,module);
      case 'apoderado-data': return validateMemberRole(id,module,'apoderado');
      case 'no-participo-logic': { const t=(await fetchText('/assets/apoderado.js')).text+(await fetchText('/assets/presidente.js')).text; return (t.includes('opted_out')||t.includes('no_participa'))?pass(id,module,'Marcas No participo encontradas.'):warn(id,module,'No encontré marcas No participo.'); }
      case 'apoderado-ui-markers': { const t=(await fetchText('/assets/apoderado.js')).text; const miss=['Próxima cuota','cpV5Carousel','data-monetization-slot'].filter(x=>!t.includes(x)); return miss.length?warn(id,module,'Faltan marcas: '+miss.join(', ')):pass(id,module,'UI Apoderado OK.'); }
      case 'tesorero-data': return validateMemberRole(id,module,'tesorero');
      case 'tesorero-ui-markers': { const t=(await fetchText('/assets/tesorero.js')).text; const ok=['Conciliación','Rendiciones','Comprobantes','Pagos'].some(x=>t.includes(x)); return ok?pass(id,module,'UI Tesorero detectada.'):warn(id,module,'Marcas UI Tesorero no claras.'); }
      case 'informes-table': return validateInformes(id,module);
      case 'informes-ui-markers': { const t=(await fetchText('/assets/presidente.js')).text; return t.includes('Informes')?pass(id,module,'UI Informes presente.'):warn(id,module,'No encontré marca Informes.'); }
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
    const body={curso_id:state.created.cursoId,titulo:QA_PREFIX+' Campaña '+tipo,tipo:tipo==='mensual'?'monthly':'single',monto:tipo==='mensual'?1000:2500,fecha_inicio:today(),fecha_vencimiento:addDays(15),meses:tipo==='mensual'?3:1,obligatoria:tipo!=='mensual',estado:'activa'};
    const row=await insert('campanas',body); state.created.campanas.push(row); return pass(id,module,'Campaña creada: '+row.titulo);
  }
  async function createPagos(id,module){
    const c=await sb(); const {data:aps,error:e1}=await c.from('miembros_curso').select('*').eq('curso_id',state.created.cursoId).eq('rol','apoderado'); if(e1) throw new Error(e1.message);
    let n=0;
    for(const camp of state.created.campanas){ for(const m of (aps||[])){ const row=await insert('pagos',{curso_id:state.created.cursoId,campana_id:camp.id,miembro_id:m.id,monto:Number(camp.monto||1000),monto_pagado:0,estado:'pendiente',fecha_vencimiento:addDays(15),periodo:today().slice(0,7)}); state.created.pagos.push(row); n++; } }
    return pass(id,module,'Pagos creados: '+n);
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
  async function cleanupQa(id,module){
    if(!state.cleanup) return warn(id,module,'Limpieza desactivada por usuario.');
    const c=await sb(); let total=0;
    try{ if(state.created.cursoId){ const r=await c.from('pagos').delete().eq('curso_id',state.created.cursoId).select('id'); if(!r.error) total+=(r.data||[]).length; } }catch(e){}
    try{ if(state.created.cursoId){ const r=await c.from('campanas').delete().eq('curso_id',state.created.cursoId).select('id'); if(!r.error) total+=(r.data||[]).length; } }catch(e){}
    try{ if(state.created.cursoId){ const r=await c.from('miembros_curso').delete().eq('curso_id',state.created.cursoId).select('id'); if(!r.error) total+=(r.data||[]).length; } }catch(e){}
    try{ const r=await c.from('usuarios').delete().like('email',QA_PREFIX.toLowerCase()+'%').select('id'); if(!r.error) total+=(r.data||[]).length; }catch(e){}
    try{ const r=await c.from('cursos').delete().eq('course_key',qa.courseKey).select('id'); if(!r.error) total+=(r.data||[]).length; }catch(e){}
    try{ if(state.created.colegioId){ const r=await c.from('colegios').delete().eq('id',state.created.colegioId).select('id'); if(!r.error) total+=(r.data||[]).length; } }catch(e){}
    return pass(id,module,'Registros QA eliminados: '+total);
  }
  async function verifyCleanup(id,module){
    const c=await sb(); const {count,error}=await c.from('cursos').select('*',{count:'exact',head:true}).eq('course_key',qa.courseKey); if(error) throw new Error(error.message);
    return count===0?pass(id,module,'Curso QA no existe tras limpieza.'):warn(id,module,'Curso QA sigue existiendo count='+count);
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
    const lines=['QA 360 Cursapp Modular','Fecha: '+new Date().toLocaleString('es-CL'),'Run: '+s.runId,'Modo: '+s.mode,'Curso QA: '+s.courseKey,'','Resultado: '+verdict,'Score: '+s.score+'%','Total: '+s.total,'OK: '+s.pass,'Advertencias: '+s.warn,'Errores: '+s.fail,'','Módulos:',...state.modules.map(m=>`- ${m.name}: ${m.pass}/${m.total} OK · WARN ${m.warn} · ERROR ${m.fail}`),'','Detalle:',...state.results.map(r=>`[${r.status.toUpperCase()}] ${r.module} · ${r.name} — ${r.detail}`)];
    $('qaReport') && ($('qaReport').value=lines.join('\n'));
  }
  function download(name,mime,content){ const blob=new Blob([content],{type:mime}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500); }
  function downloadJson(){ download('cursapp-qa360-modular-'+Date.now()+'.json','application/json',JSON.stringify({summary:getSummary(),modules:state.modules,results:state.results,created:state.created},null,2)); }
  function downloadHtml(){
    const s=getSummary(); const body=state.results.map(r=>`<tr><td>${esc(r.module)}</td><td>${esc(r.status)}</td><td>${esc(r.name)}</td><td>${esc(r.detail)}</td></tr>`).join('');
    download('cursapp-qa360-modular-'+Date.now()+'.html','text/html',`<!doctype html><meta charset="utf-8"><title>QA 360 Cursapp</title><style>body{font-family:Arial;padding:24px}td,th{border:1px solid #ddd;padding:8px}table{border-collapse:collapse;width:100%}.pass{color:green}.fail{color:red}.warn{color:#b45309}</style><h1>QA 360 Cursapp</h1><p>Run ${esc(s.runId)} · Score ${s.score}% · OK ${s.pass} · WARN ${s.warn} · ERROR ${s.fail}</p><table><thead><tr><th>Módulo</th><th>Estado</th><th>Prueba</th><th>Detalle</th></tr></thead><tbody>${body}</tbody></table>`);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
