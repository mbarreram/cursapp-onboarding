(function(){
  'use strict';

  const esc = (value)=>String(value ?? '').replace(/[&<>"']/g, c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  let lastItems = [];
  let lastCourseId = null;
  let refreshTimer = null;

  function formatDate(value){
    if(!value) return '';
    try{
      const d = new Date(value);
      if(Number.isNaN(d.getTime())) return '';
      return d.toLocaleString('es-CL', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
    }catch(_){ return ''; }
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
    return Array.isArray(rows) ? rows : [];
  }

  function renderHome(items){
    const host = document.querySelector('.apoV2RealAvisos');
    if(!host) return false;

    if(!items.length){
      host.innerHTML = '<article class="apoV2Notice"><span>📣</span><div><h3>Sin avisos nuevos</h3><p>Aún no hay mensajes publicados por la directiva.</p></div></article>';
      return true;
    }

    host.innerHTML = items.slice(0,3).map(a=>{
      const date = formatDate(a.created_at);
      return '<article class="apoV2Notice apoV40NoticeCard">'
        + '<span class="apoV40NoticeIcon">📣</span>'
        + '<div class="apoV40NoticeCopy"><h3>'+esc(a.titulo || 'Aviso del curso')+'</h3>'
        + '<p>'+esc(a.mensaje || 'Revisa el detalle del aviso publicado por la directiva.')+'</p>'
        + (date ? '<small>'+esc(date)+'</small>' : '')
        + '</div><button type="button" data-current-course-notices="1">Ver</button></article>';
    }).join('');

    host.querySelectorAll('[data-current-course-notices]').forEach(btn=>{
      btn.addEventListener('click', openCurrentCourseNotices);
    });
    return true;
  }

  function openCurrentCourseNotices(){
    const root = document.getElementById('modalRoot');
    if(!root) return;
    const rows = lastItems;
    const content = rows.length ? rows.map(a=>{
      const date = formatDate(a.created_at);
      return '<article style="padding:16px 0;border-bottom:1px solid #e5e7eb">'
        + '<h3 style="margin:0 0 6px;font-size:18px;color:#0f172a">'+esc(a.titulo || 'Aviso del curso')+'</h3>'
        + '<p style="margin:0;color:#64748b;line-height:1.45">'+esc(a.mensaje || '')+'</p>'
        + (date ? '<small style="display:block;margin-top:8px;color:#94a3b8">'+esc(date)+'</small>' : '')
        + '</article>';
    }).join('') : '<div style="padding:18px 0;color:#64748b">No hay avisos publicados para este curso.</div>';

    root.innerHTML = '<div style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:99999;display:flex;align-items:flex-end;justify-content:center" data-current-course-modal>'
      + '<section style="width:min(100%,720px);max-height:78vh;overflow:auto;background:#fff;border-radius:28px 28px 0 0;padding:24px;box-sizing:border-box">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><div><h2 style="margin:0;font-size:28px;color:#0f172a">Avisos del curso</h2><p style="margin:4px 0 0;color:#64748b">Solo comunicaciones del curso activo.</p></div>'
      + '<button type="button" data-close-current-course-modal style="border:1px solid #e2e8f0;background:#fff;border-radius:16px;padding:10px 14px;font-weight:800">Cerrar</button></div>'
      + '<div style="margin-top:12px">'+content+'</div></section></div>';

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
      if(renderHome(items)) wireSectionHeader();
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

  const observer = new MutationObserver(()=>{
    if(document.querySelector('.apoV2NoticeSection')){
      renderHome(lastItems);
      wireSectionHeader();
    }
  });
  observer.observe(document.documentElement, { childList:true, subtree:true });

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=>scheduleRefresh(200));
  else scheduleRefresh(200);
})();
