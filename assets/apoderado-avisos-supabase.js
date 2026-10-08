(function(){
  'use strict';

  const esc = (value)=>String(value ?? '').replace(/[&<>"']/g, c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'
  }[c]));

  let lastItems = [];
  let lastCourseId = null;
  let refreshTimer = null;
  let lastRenderedHost = null;
  let lastRenderedSignature = '';

  function formatDate(value){
    if(!value) return '';
    try{
      const d = new Date(value);
      if(Number.isNaN(d.getTime())) return '';
      return d.toLocaleString('es-CL', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
    }catch(_){ return ''; }
  }

  function signature(items){
    return JSON.stringify((Array.isArray(items) ? items : []).slice(0,3).map(a=>[
      a && a.id || '', a && a.titulo || '', a && a.mensaje || '', a && a.created_at || '', !!(a&&a.isRead)
    ]));
  }
  function ensureNoticeStyles(){
    if(document.getElementById('mx-course-notice-state-css')) return;
    const s=document.createElement('style');s.id='mx-course-notice-state-css';
    s.textContent='.apoV40NoticeCard.mx-notice-new{border-color:#c4b5fd!important;background:#faf7ff!important;box-shadow:0 10px 28px rgba(109,40,217,.08)!important}.mxNoticeState{display:inline-flex;align-items:center;border-radius:999px;padding:4px 8px;font-size:10px;font-weight:950;margin-left:7px;vertical-align:middle}.mxNoticeState.new{background:#ede9fe;color:#6d28d9}.mxNoticeState.read{background:#f1f5f9;color:#64748b}';
    document.head.appendChild(s);
  }

  async function loadCurrentCourseNotices(){
    const api = window.CURSAPP_SUPABASE;
    if(!api || typeof api.notificationContext !== 'function' || typeof api.request !== 'function') return [];

    const ctx = await api.notificationContext();
    const courseId = ctx && ctx.curso_id ? String(ctx.curso_id) : '';
    lastCourseId = courseId || null;
    if(!courseId) return [];

    const now = new Date().toISOString();
    const path = 'avisos_curso?select=id,curso_id,titulo,mensaje,prioridad,visible,created_at,requiere_confirmacion,tipo,expira_en'
      + '&curso_id=eq.' + encodeURIComponent(courseId)
      + '&visible=eq.true'
      + '&or=(expira_en.is.null,expira_en.gte.' + encodeURIComponent(now) + ')'
      + '&order=created_at.desc';

    const rows = await api.request(path, { method:'GET' });
    let readMap=new Map();
    try{
      const noticeApi=window.CURSAPP_COURSE_NOTICES;
      if(noticeApi&&typeof noticeApi.refresh==='function') await noticeApi.refresh({emitDataUpdated:false});
      if(noticeApi&&typeof noticeApi.getRows==='function'){
        readMap=new Map(noticeApi.getRows().map(x=>[String(x.id),!!x.isRead]));
      }
    }catch(_){}
    return (Array.isArray(rows) ? rows : []).map(x=>Object.assign({},x,{isRead:readMap.get(String(x.id))===true}));
  }

  function publishedReportNotice(){
    const state=window.MICURSOX_APO_REPORTS_STATE;
    if(!state || !Array.isArray(state.reports) || !state.reports.length) return null;
    if(lastCourseId && String(state.courseId||'')!==lastCourseId) return null;
    const report=state.reports.find(r=>r && r.published);
    if(!report) return null;
    const stamp=String(report.publishedAt||report.generatedAt||report.updatedAt||'');
    const id=String(report.supabaseId||report.id||report.period||'');
    return { id:'published-report-'+id+'-'+stamp, titulo:'Informe del curso disponible',
      mensaje:'La directiva publicó el informe '+String(report.period||'')+'. Revisa el estado financiero del curso.',
      created_at:stamp, isReport:true, isRead:false };
  }

  function homeItems(items){
    const report=publishedReportNotice();
    return report?[report,...(items||[])]:items||[];
  }

  function renderHome(items, force){
    ensureNoticeStyles();
    const host = document.querySelector('.apoV2RealAvisos');
    if(!host) return false;

    items=homeItems(items);
    const sig = signature(items);
    if(!force && host === lastRenderedHost && sig === lastRenderedSignature) return true;

    if(!items.length){
      host.innerHTML = '<article class="apoV2Notice"><span>📣</span><div><h3>Sin avisos nuevos</h3><p>Aún no hay mensajes publicados por la directiva.</p></div></article>';
    }else{
      host.innerHTML = items.slice(0,3).map(a=>{
        const date = formatDate(a.created_at);
        const state=a.isReport?'Publicado':(a.isRead?'Leído':'Nuevo');
        return '<article class="apoV2Notice apoV40NoticeCard '+(a.isRead?'mx-notice-read':'mx-notice-new')+'">'
          + '<span class="apoV40NoticeIcon">'+(a.isReport?'📊':'📣')+'</span>'
          + '<div class="apoV40NoticeCopy"><h3>'+esc(a.titulo || 'Aviso del curso')+'<span class="mxNoticeState '+(a.isRead?'read':'new')+'">'+state+'</span></h3>'
          + '<p>'+esc(a.mensaje || 'Revisa el detalle del aviso publicado por la directiva.')+'</p>'
          + (date ? '<small>'+esc(date)+'</small>' : '')
          + '</div><button type="button" '+(a.isReport?'data-open-published-report="1"':'data-current-course-notices="1"')+'>'+(a.isReport?'Ver informe':'Ver')+'</button></article>';
      }).join('');

      host.querySelectorAll('[data-open-published-report]').forEach(btn=>{
        btn.addEventListener('click',()=>{
          if(typeof window.go==='function')window.go('informes');
          setTimeout(()=>{if(typeof window.openPublishedReport==='function')window.openPublishedReport();},180);
        });
      });
      host.querySelectorAll('[data-current-course-notices]').forEach(btn=>{
        btn.addEventListener('click', openCurrentCourseNotices);
      });
    }

    lastRenderedHost = host;
    lastRenderedSignature = sig;
    return true;
  }

  async function openCurrentCourseNotices(){
    const root = document.getElementById('modalRoot');
    if(!root) return;
    const rows = lastItems;
    const content = rows.length ? rows.map(a=>{
      const date = formatDate(a.created_at);
      return '<article style="padding:16px 0;border-bottom:1px solid #e5e7eb">'
        + '<h3 style="margin:0 0 6px;font-size:18px;color:#0f172a">'+esc(a.titulo || 'Aviso del curso')+' <span data-modal-notice-state class="mxNoticeState '+(a.isRead?'read':'new')+'">'+(a.isRead?'Leído':'Nuevo')+'</span></h3>'
        + '<p style="margin:0;color:#64748b;line-height:1.45">'+esc(a.mensaje || '')+'</p>'
        + (date ? '<small style="display:block;margin-top:8px;color:#94a3b8">'+esc(date)+'</small>' : '')
        + '</article>';
    }).join('') : '<div style="padding:18px 0;color:#64748b">No hay avisos publicados para este curso.</div>';

    root.innerHTML = '<div style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:99999;display:flex;align-items:flex-end;justify-content:center" data-current-course-modal>'
      + '<section style="width:min(100%,720px);max-height:78vh;overflow:auto;background:#fff;border-radius:28px 28px 0 0;padding:24px;box-sizing:border-box">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><div><h2 style="margin:0;font-size:28px;color:#0f172a">Avisos del curso</h2><p style="margin:4px 0 0;color:#64748b">Solo comunicaciones del curso activo.</p></div>'
      + '<button type="button" data-close-current-course-modal style="border:1px solid #e2e8f0;background:#fff;border-radius:16px;padding:10px 14px;font-weight:800">Cerrar</button></div>'
      + '<div style="margin-top:12px">'+content+'</div></section></div>';

    try{
      const noticesApi=window.CURSAPP_COURSE_NOTICES;
      if(noticesApi&&typeof noticesApi.markAllRead==='function') await noticesApi.markAllRead();
      await refresh();
      root.querySelectorAll('[data-modal-notice-state]').forEach(el=>{el.textContent='Leído';el.classList.remove('new');el.classList.add('read')});
    }catch(error){
      console.warn('MiCursoX: no se pudieron registrar como leídos los avisos del curso.', error);
    }

    root.querySelector('[data-close-current-course-modal]')?.addEventListener('click', ()=>{ root.innerHTML=''; });
    root.querySelector('[data-current-course-modal]')?.addEventListener('click', (ev)=>{ if(ev.target === ev.currentTarget) root.innerHTML=''; });
  }

  function wireSectionHeader(){
    const section = document.querySelector('.apoV2NoticeSection');
    if(!section) return;
    const button = section.querySelector('.apoV2SectionHead button');
    if(button){
      button.onclick = function(ev){ ev.preventDefault(); ev.stopPropagation(); openCurrentCourseNotices(); };
    }
  }

  async function refresh(){
    try{
      const items = await loadCurrentCourseNotices();
      lastItems = items;
      if(renderHome(items, true)) wireSectionHeader();
    }catch(error){
      console.warn('MiCursoX: no se pudieron cargar los avisos del curso activo desde Supabase.', error);
    }
  }

  function scheduleRefresh(delay){
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, delay || 80);
  }

  window.openAvisosInbox = openCurrentCourseNotices;
  window.addEventListener('cursapp:apoderado-ready', ()=>scheduleRefresh(120));
  window.addEventListener('cursapp:dataChanged', ()=>scheduleRefresh(120));
  window.addEventListener('pageshow', ()=>scheduleRefresh(120));
  window.addEventListener('hashchange', ()=>scheduleRefresh(120));
  window.addEventListener('micursox:course-notices-updated', ()=>scheduleRefresh(60));
  window.addEventListener('micursox:published-reports-hydrated', ()=>{
    if(renderHome(lastItems,true))wireSectionHeader();
  });

  const observer = new MutationObserver(()=>{
    const host = document.querySelector('.apoV2RealAvisos');
    if(!host) return;
    if(host !== lastRenderedHost){
      renderHome(lastItems, true);
      wireSectionHeader();
    }
  });
  observer.observe(document.documentElement, { childList:true, subtree:true });

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=>scheduleRefresh(200));
  else scheduleRefresh(200);
})();
