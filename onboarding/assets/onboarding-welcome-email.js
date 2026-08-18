(function(){
  'use strict';
  if(window.__MICURSOX_ONBOARDING_WELCOME_EMAIL__) return;
  window.__MICURSOX_ONBOARDING_WELCOME_EMAIL__ = true;

  const cfg = window.CURSAPP_SUPABASE;
  if(!cfg || !cfg.url || !cfg.publishableKey) return;
  const originalFetch = window.fetch.bind(window);
  const SENT_PREFIX = 'micursox_welcome_sent_';

  function requestUrl(input){
    try{return typeof input==='string'?input:(input&&input.url)||'';}catch(_){return '';}
  }
  function parseBody(init){
    try{return init&&typeof init.body==='string'?JSON.parse(init.body):null;}catch(_){return null;}
  }
  function esc(v){return String(v||'').replace(/[&<>\"]/g,function(s){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[s]||s;});}
  function draft(){
    try{return JSON.parse(localStorage.getItem('cursapp_onb_draft_v1')||'{}')||{};}catch(_){return {};}
  }
  function session(){
    try{return JSON.parse(localStorage.getItem(cfg.authSessionKey||'cursapp_supabase_auth_session_v1')||'{}')||{};}catch(_){return {};}
  }
  async function sendWelcome(member){
    try{
      if(!member || String(member.rol||'').toLowerCase()!=='presidente') return;
      const d = draft();
      const email = String(member.email || d.pEmail || '').trim().toLowerCase();
      if(!email) return;
      const cursoId = String(member.curso_id||'');
      const dedupe = SENT_PREFIX + email + '_' + cursoId;
      if(sessionStorage.getItem(dedupe)==='1') return;

      const s = session();
      const token = s && s.access_token ? String(s.access_token) : '';
      if(!token) return;

      const nombre = String(member.nombre_apoderado || d.name || '');
      const colegio = String(d.schoolName || d.school || '').trim();
      const nivel = String(d.level||'').trim();
      const letra = String(d.letter||'').trim().toUpperCase();
      const anio = String(d.year||'').trim();
      const cursoLabel = [nivel + letra, anio].filter(Boolean).join(' ');
      const subject = 'Bienvenido a MiCursoX';
      const html = `<!doctype html><html><body style="margin:0;background:#f6f7fb;font-family:Arial,sans-serif;color:#111827"><div style="max-width:620px;margin:0 auto;padding:28px 18px"><div style="background:#fff;border-radius:22px;padding:30px;border:1px solid #e5e7eb"><div style="font-size:28px;font-weight:800;color:#6d28d9;margin-bottom:20px">MiCursoX</div><h1 style="font-size:28px;margin:0 0 16px">¡Bienvenido${nombre?' '+esc(nombre):''}! 👋</h1><p style="font-size:16px;line-height:1.6;color:#475569">Tu registro como <b>Presidente</b> fue creado correctamente en MiCursoX.</p><div style="background:#f8fafc;border-radius:16px;padding:18px;margin:22px 0"><div style="font-size:14px;color:#64748b;margin-bottom:8px">Curso registrado</div><div style="font-size:18px;font-weight:700">${esc(colegio || 'Tu colegio')}${cursoLabel?' · '+esc(cursoLabel):''}</div></div><p style="font-size:16px;line-height:1.6;color:#475569">Desde ahora puedes crear campañas, invitar a la directiva y apoderados, revisar pagos e informes y administrar los fondos del curso.</p><p style="font-size:14px;line-height:1.6;color:#64748b;margin-top:26px">Correo de acceso: <b>${esc(email)}</b></p><p style="font-size:13px;color:#94a3b8;margin-top:28px">Este es un correo automático de MiCursoX.</p></div></div></body></html>`;
      const text = `Bienvenido a MiCursoX${nombre?' '+nombre:''}. Tu registro como Presidente fue creado correctamente.${cursoLabel?' Curso: '+cursoLabel+'.':''} Correo de acceso: ${email}.`;

      const res = await originalFetch(cfg.url + '/functions/v1/send-email', {
        method:'POST',
        headers:{
          apikey:cfg.publishableKey,
          Authorization:'Bearer '+token,
          'Content-Type':'application/json'
        },
        body:JSON.stringify({to:email,subject,html,text})
      });
      if(res.ok){
        try{sessionStorage.setItem(dedupe,'1');}catch(_){ }
      } else {
        try{console.warn('[MiCursoX] welcome email failed', await res.text());}catch(_){ }
      }
    }catch(e){
      try{console.warn('[MiCursoX] welcome email error', e);}catch(_){ }
    }
  }

  window.fetch = async function(input, init){
    const url = requestUrl(input);
    const body = parseBody(init);
    const response = await originalFetch(input, init);
    if(response && response.ok && /\/rest\/v1\/miembros_curso(?:\?|$)/i.test(url) && String((init&&init.method)||'GET').toUpperCase()==='POST' && body && String(body.rol||'').toLowerCase()==='presidente'){
      setTimeout(function(){ sendWelcome(body); }, 0);
    }
    return response;
  };
})();
