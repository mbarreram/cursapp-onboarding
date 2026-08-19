(function(){
  'use strict';
  if(window.__MICURSOX_USER_CONSENTS__) return;
  window.__MICURSOX_USER_CONSENTS__ = true;

  const sb = window.CURSAPP_SUPABASE;
  const TERMS_URL = '/index.html#terminos';
  const PRIVACY_URL = '/index.html#privacidad';

  function esc(v){ return String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function fmt(v){ try{return v?new Date(v).toLocaleString('es-CL',{dateStyle:'medium',timeStyle:'short'}):'Sin registro de fecha';}catch(_){return v||'Sin registro de fecha';} }
  function injectCss(){
    if(document.getElementById('mxConsentCss')) return;
    const s=document.createElement('style');s.id='mxConsentCss';s.textContent=`
      .mxConsentOverlay{position:fixed;inset:0;z-index:120000;background:rgba(15,23,42,.52);backdrop-filter:blur(7px);display:flex;align-items:flex-end;justify-content:center;padding:0}
      .mxConsentSheet{width:min(820px,100%);max-height:92dvh;overflow:auto;background:#f8fafc;border-radius:28px 28px 0 0;padding:0 0 calc(18px + env(safe-area-inset-bottom));box-shadow:0 30px 90px rgba(15,23,42,.28)}
      .mxConsentHead{position:sticky;top:0;z-index:2;background:rgba(255,255,255,.96);backdrop-filter:blur(14px);padding:22px 22px 17px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;gap:14px;align-items:start}.mxConsentHead h2{margin:0;font-size:25px;color:#0f172a}.mxConsentHead p{margin:6px 0 0;color:#64748b;font-weight:700;line-height:1.4}.mxConsentClose{border:1px solid #e5e7eb;background:#fff;width:42px;height:42px;border-radius:14px;font-size:25px;font-weight:900;color:#334155}
      .mxConsentBody{padding:18px;display:grid;gap:14px}.mxConsentCard{background:#fff;border:1px solid #e5e7eb;border-radius:22px;padding:18px;box-shadow:0 8px 24px rgba(15,23,42,.04)}.mxConsentTop{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.mxConsentTitle{display:flex;gap:12px;align-items:flex-start}.mxConsentIcon{width:44px;height:44px;border-radius:14px;background:#ede9fe;color:#6d28d9;display:grid;place-items:center;font-size:21px;flex:0 0 auto}.mxConsentTitle h3{margin:1px 0 4px;font-size:18px;color:#0f172a}.mxConsentTitle p{margin:0;color:#64748b;font-size:13px;font-weight:700}.mxConsentBadge{background:#dcfce7;color:#166534;border-radius:999px;padding:8px 11px;font-size:12px;font-weight:900;white-space:nowrap}.mxConsentBadge.pending{background:#f1f5f9;color:#64748b}
      .mxConsentList{margin:14px 0 0;padding-left:22px;color:#334155;display:grid;gap:8px;font-size:14px;font-weight:700;line-height:1.4}.mxConsentMeta{margin-top:15px;padding-top:13px;border-top:1px solid #eef2f7;display:flex;gap:8px;flex-wrap:wrap;color:#64748b;font-size:12px;font-weight:800}.mxConsentActions{display:flex;gap:9px;flex-wrap:wrap;margin-top:14px}.mxConsentBtn{border:0;border-radius:13px;padding:11px 14px;font-weight:900;background:#6d28d9;color:#fff;text-decoration:none}.mxConsentBtn.ghost{background:#f8fafc;color:#6d28d9;border:1px solid #ddd6fe}
      .mxConsentControls h3{margin:0 0 8px;font-size:17px}.mxConsentControls p{margin:0;color:#64748b;font-weight:700;line-height:1.45}.mxConsentControlGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:13px}.mxConsentControl{border:1px solid #e5e7eb;background:#fff;border-radius:16px;padding:13px;text-align:left;font-weight:900;color:#0f172a}.mxConsentControl small{display:block;margin-top:4px;color:#64748b;font-weight:700}
      @media(min-width:761px){.mxConsentOverlay{align-items:center;padding:20px}.mxConsentSheet{border-radius:28px;max-height:88vh}.mxConsentBody{padding:22px}}
      @media(max-width:560px){.mxConsentControlGrid{grid-template-columns:1fr}.mxConsentTop{align-items:flex-start}.mxConsentBadge{font-size:11px;padding:7px 9px}}
    `;document.head.appendChild(s);
  }
  async function getConsent(){
    if(!sb||typeof sb.getCurrentUser!=='function'||typeof sb.request!=='function') throw new Error('No se pudo consultar tus consentimientos.');
    const user=await sb.getCurrentUser();
    const rows=await sb.request(`consentimientos_usuario?usuario_id=eq.${encodeURIComponent(user.id)}&select=*&order=fecha_aceptacion.desc&limit=1`);
    return {user,row:Array.isArray(rows)?rows[0]:null};
  }
  function card(title,icon,accepted,meta,items,url){
    return `<section class="mxConsentCard"><div class="mxConsentTop"><div class="mxConsentTitle"><span class="mxConsentIcon">${icon}</span><div><h3>${esc(title)}</h3><p>${accepted?'Autorización entregada durante el registro':'No encontramos una aceptación registrada'}</p></div></div><span class="mxConsentBadge ${accepted?'':'pending'}">${accepted?'✓ Aceptado':'Sin registro'}</span></div><ul class="mxConsentList">${items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><div class="mxConsentMeta"><span>${esc(meta.date)}</span><span>·</span><span>Versión: ${esc(meta.version)}</span></div><div class="mxConsentActions"><a class="mxConsentBtn ghost" href="${url}" target="_blank" rel="noopener">Ver documento completo</a></div></section>`;
  }
  async function open(){
    injectCss();document.getElementById('mxConsentOverlay')?.remove();
    const root=document.createElement('div');root.id='mxConsentOverlay';root.className='mxConsentOverlay';
    root.innerHTML='<section class="mxConsentSheet"><header class="mxConsentHead"><div><h2>Consentimientos y privacidad</h2><p>Resumen de las autorizaciones asociadas a tu cuenta MiCursoX.</p></div><button class="mxConsentClose" type="button" aria-label="Cerrar">×</button></header><div class="mxConsentBody"><section class="mxConsentCard"><p style="margin:0;color:#64748b;font-weight:800">Cargando tus consentimientos…</p></section></div></section>';
    document.body.appendChild(root);
    root.addEventListener('click',e=>{if(e.target===root||e.target.closest('.mxConsentClose'))root.remove()});
    try{
      const {row}=await getConsent();
      const date=fmt(row?.fecha_aceptacion||row?.created_at);
      const version=String(row?.version||'sin versión registrada');
      const terms=!!row?.terminos_aceptados,privacy=!!row?.privacidad_aceptada;
      root.querySelector('.mxConsentBody').innerHTML =
        card('Términos y Condiciones','📄',terms,{date,version},[
          'Uso de MiCursoX para la gestión y participación en actividades del curso.',
          'Acceso a campañas, cuotas, pagos, comprobantes, avisos e informes según tu rol.',
          'Registro de acciones necesarias para seguridad, trazabilidad y soporte.',
          'Uso de funcionalidades adicionales, como Mercado Escolar, bajo sus condiciones específicas.'
        ],TERMS_URL)+
        card('Política de Privacidad','🔐',privacy,{date,version},[
          'Tratamiento de nombre, correo, teléfono y datos necesarios para identificar tu perfil.',
          'Asociación de tu cuenta con alumno, colegio, curso y roles correspondientes.',
          'Uso de datos necesarios para campañas, pagos, comprobantes, avisos e informes.',
          'Envío de comunicaciones según las preferencias de notificaciones que configures.',
          'Uso de información técnica mínima para seguridad y funcionamiento de la cuenta.',
          'Aislamiento de la información para evitar que datos personales se mezclen entre cursos.'
        ],PRIVACY_URL)+
        `<section class="mxConsentCard mxConsentControls"><h3>Tus controles</h3><p>Los consentimientos obligatorios del registro se muestran como historial. Las preferencias operativas sí pueden modificarse.</p><div class="mxConsentControlGrid"><button class="mxConsentControl" type="button" data-notifications>🔔 Preferencias de notificaciones<small>Push, correos y categorías.</small></button><button class="mxConsentControl" type="button" data-profile>👤 Datos de mi perfil<small>Nombre, teléfono, foto y seguridad.</small></button></div></section>`;
      root.querySelector('[data-notifications]')?.addEventListener('click',()=>{root.remove();const api=window.CURSAPP_NOTIFICATION_PREFERENCES;if(api&&typeof api.open==='function')api.open();else alert('Las preferencias aún se están cargando.');});
      root.querySelector('[data-profile]')?.addEventListener('click',()=>{root.remove();try{window.go?.('profile')}catch(_){}});
    }catch(e){
      root.querySelector('.mxConsentBody').innerHTML=`<section class="mxConsentCard"><h3 style="margin-top:0">No se pudo cargar</h3><p style="color:#64748b;font-weight:700">${esc(e?.message||String(e))}</p></section>`;
    }
  }

  document.addEventListener('click',function(ev){
    const el=ev.target?.closest?.('button,a,[data-action]');if(!el)return;
    const text=String(el.textContent||'').toLowerCase();
    const action=String(el.dataset?.action||'').toLowerCase();
    if(action==='consentimientos'||text.includes('consentimientos')){
      ev.preventDefault();ev.stopImmediatePropagation();open();
    }
  },true);
  window.CURSAPP_USER_CONSENTS=Object.freeze({open});
})();