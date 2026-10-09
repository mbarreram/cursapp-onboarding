(function(){'use strict';if(window.__MX_POLICY_NOTICE__)return;window.__MX_POLICY_NOTICE__=true;
async function check(){try{const api=window.CURSAPP_SUPABASE;if(!api?.getCurrentUser||!api?.request)return;
const user=await api.getCurrentUser();if(!user?.id)return;
const [rows,versions]=await Promise.all([api.request('consentimientos_usuario?usuario_id=eq.'+encodeURIComponent(user.id)+'&select=version&order=fecha_aceptacion.desc&limit=1'),api.request('politicas_versiones?select=version,titulo&vigente=eq.true&limit=1')]);
const active=Array.isArray(versions)?versions[0]:null;const accepted=Array.isArray(rows)?rows[0]:null;
if(!active?.version||!accepted||active.version===accepted.version)return;
const box=document.createElement('div');box.id='mxPolicyNotice';box.style.cssText='position:fixed;bottom:105px;left:12px;right:12px;max-width:470px;margin:auto;padding:16px;background:white;border:2px solid #a78bfa;border-radius:16px;box-shadow:0 12px 30px #0002;z-index:90000;font:600 14px system-ui;color:#1e293b';
box.innerHTML='<b>Documentos legales actualizados</b><p>Hay una nueva versión de los documentos para revisar. Tu aceptación anterior permanece registrada.</p><button type="button" data-review>Revisar</button> <button type="button" data-later>Más tarde</button>';
box.querySelector('[data-review]').onclick=()=>{box.remove();window.CURSAPP_USER_CONSENTS?.open?.()};box.querySelector('[data-later]').onclick=()=>box.remove();document.body.appendChild(box);
}catch(e){console.info('Aviso de políticas no disponible',e?.message)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(check,2000),{once:true});else setTimeout(check,2000);
})();