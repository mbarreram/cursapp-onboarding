(function(){
  'use strict';

  if(window.__MICURSOX_ONBOARDING_SCHOOL_REUSE_DB__) return;
  window.__MICURSOX_ONBOARDING_SCHOOL_REUSE_DB__ = true;

  const current = window.CURSAPP_SUPABASE;
  if(!current || typeof current.request !== 'function') return;

  const originalRequest = current.request.bind(current);
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function readDraft(){
    try {
      return JSON.parse(localStorage.getItem('cursapp_onb_draft_v1') || '{}');
    } catch (_) {
      return {};
    }
  }

  async function request(path, options){
    const cleanPath = String(path || '').replace(/^\/+/, '');
    const method = String((options && options.method) || 'GET').toUpperCase();

    if(cleanPath === 'colegios' && method === 'POST'){
      const draft = readDraft();
      const selectedId = String(draft.schoolId || '').trim();

      if(UUID_RE.test(selectedId)){
        const rows = await originalRequest(
          'colegios?id=eq.' + encodeURIComponent(selectedId) + '&select=*&limit=1',
          { method:'GET' }
        );

        if(Array.isArray(rows) && rows[0] && rows[0].id){
          return rows;
        }
      }
    }

    return originalRequest(path, options);
  }

  window.CURSAPP_SUPABASE = Object.freeze(Object.assign({}, current, { request }));
})();
