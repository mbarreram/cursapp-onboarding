(function(){
  'use strict';
  if(window.__MICURSOX_ONBOARDING_WELCOME_EMAIL__) return;
  window.__MICURSOX_ONBOARDING_WELCOME_EMAIL__ = true;

  const cfg = window.CURSAPP_SUPABASE;
  if(!cfg || !cfg.url || !cfg.publishableKey) return;
  const originalFetch = window.fetch.bind(window);
  const SENT_PREFIX = 'micursox_welcome_sent_';
  const LOGO_URL = 'https://cursapp-onboarding.pages.dev/assets/brand/micursox-compact.svg';

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
      const html = `<!doctype html><html><body style="margin:0;background:#f6f7fb;font-family:Arial,sans-serif;color:#111827">
        <div style="max-width:620px;margin:0 auto;padding:28px 18px">
          <div style="background:#fff;border-radius:22px;border:1px solid #e5e7eb;overflow:hidden">
            <div style="padding:26px 30px 22px;text-align:center;border-bottom:1px solid #ede9fe">
              <img src="${LOGO_URL}" alt="MiCursoX" width="210" style="display:inline-block;max-width:210px;width:100%;height:auto;border:0;outline:none;text-decoration:none">
            </div>
            <div style="padding:30px">
              <h1 style="font-size:28px;line-height:1.2;margin:0 0 16px;color:#111827">¡Bienvenido${nombre?' '+esc(nombre):''}! 👋</h1>
              <p style="font-size:16px;line-height:1.6;color:#475569;margin:0">Tu registro como <b>Presidente</b> fue creado correctamente en MiCursoX.</p>
              <div style="background:#f8fafc;border-radius:16px;padding:18px;margin:22px 0">
                <div style="font-size:14px;color:#64748b;margin-bottom:8px">Curso registrado</div>
                <div style="font-size:18px;line-height:1.4;font-weight:700;color:#111827">${esc(colegio || 'Tu colegio')}${cursoLabel?' · '+esc(cursoLabel):''}</div>
              </div>
              <p style="font-size:16px;line-height:1.6;color:#475569;margin:0">Desde ahora puedes crear campañas, invitar a la directiva y apoderados, revisar pagos e informes y administrar los fondos del curso.</p>
              <p style="font-size:14px;line-height:1.6;color:#64748b;margin:26px 0 0">Correo de acceso: <b>${esc(email)}</b></p>
            </div>
            <div style="background:#faf8ff;border-top:1px solid #ede9fe;padding:18px 30px;text-align:center">
              <div style="font-size:14px;font-weight:700;color:#6d28d9;margin-bottom:6px">MiCursoX</div>
              <div style="font-size:12px;line-height:1.5;color:#64748b">Gestión simple y segura para tu curso.</div>
              <div style="font-size:11px;line-height:1.5;color:#94a3b8;margin-top:10px">Este es un correo automático. Por favor, no respondas a este mensaje.</div>
            </div>
          </div>
          <div style="font-size:11px;line-height:1.5;color:#94a3b8;text-align:center;padding:14px 8px 0">© 2026 MiCursoX · Todos los derechos reservados.</div>
        </div>
      </body></html>`;
      const text = `Bienvenido a MiCursoX${nombre?' '+nombre:''}. Tu registro como Presidente fue creado correctamente.${cursoLabel?' Curso: '+cursoLabel+'.':''} Correo de acceso: ${email}. MiCursoX · Gestión simple y segura para tu curso.`;

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
