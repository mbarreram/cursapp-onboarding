(function(){
  'use strict';
  if(window.__MICURSOX_PRIVACY_RIGHTS__) return;
  window.__MICURSOX_PRIVACY_RIGHTS__ = true;

  const sb = window.CURSAPP_SUPABASE;
  const TYPES = {
    access:{label:'Acceso',icon:'👁️',help:'Solicita una copia y detalle de los datos personales tratados por MiCursoX.'},
    rectification:{label:'Rectificación',icon:'✏️',help:'Solicita corregir datos inexactos, desactualizados o incompletos.'},
    suppression:{label:'Supresión',icon:'🗑️',help:'Solicita eliminar datos cuando corresponda. La solicitud será revisada antes de cualquier eliminación.'},
    opposition:{label:'Oposición',icon:'✋',help:'Solicita que un tratamiento específico no continúe cuando corresponda.'},
    portability:{label:'Portabilidad',icon:'📦',help:'Solicita una copia de tus datos en un formato electrónico reutilizable, cuando corresponda.'},
    blocking:{label:'Bloqueo',icon:'⏸️',help:'Solicita la suspensión temporal de un tratamiento mientras se revisa una solicitud relacionada.'}
  };
  const STATUS = {received:'Recibida',in_review:'En revisión',completed:'Completada',rejected:'Rechazada',cancelled:'Cancelada'};

  function esc(v){ return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function fmt(v){ try{return new Date(v).toLocaleString('es-CL',{dateStyle:'medium',timeStyle:'short'});}catch(_){return String(v||'');} }

  function css(){
    if(document.getElementById('mxPrivacyRightsCss')) return;
    const s=document.createElement('style');s.id='mxPrivacyRightsCss';s.textContent=`
      .mxPrivacyLaw{background:linear-gradient(135deg,#f5f3ff,#eef2ff);border:1px solid #ddd6fe;border-radius:18px;padding:14px;margin-top:12px;color:#475569;font-size:13px;font-weight:700;line-height:1.45}.mxPrivacyLaw b{color:#312e81}
      .mxPrivacyRightsGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:14px}.mxPrivacyRight{border:1px solid #e2e8f0;border-radius:16px;background:#fff;padding:12px;text-align:left;color:#0f172a;font-weight:900}.mxPrivacyRight small{display:block;color:#64748b;font-weight:700;line-height:1.35;margin-top:4px}.mxPrivacyRight:hover{border-color:#c4b5fd;background:#faf5ff}
      .mxPrivacyForm{margin-top:14px;border-top:1px solid #eef2f7;padding-top:14px}.mxPrivacyForm h4{margin:0 0 5px}.mxPrivacyForm p{margin:0 0 10px;color:#64748b;font-size:13px;font-weight:700}.mxPrivacyForm textarea{width:100%;box-sizing:border-box;min-height:92px;border:1px solid #dbe3ec;border-radius:14px;padding:11px;font:inherit;resize:vertical}.mxPrivacyFormActions{display:flex;justify-content:flex-end;gap:8px;margin-top:9px}.mxPrivacyFormActions button{border:0;border-radius:12px;padding:10px 13px;font-weight:900}.mxPrivacyCancel{background:#f1f5f9;color:#475569}.mxPrivacySend{background:#6d28d9;color:#fff}.mxPrivacySend:disabled{opacity:.55}
      .mxPrivacyHistory{margin-top:15px;border-top:1px solid #eef2f7;padding-top:13px}.mxPrivacyHistory h4{margin:0 0 9px}.mxPrivacyReq{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:10px 0;border-bottom:1px solid #f1f5f9}.mxPrivacyReq:last-child{border-bottom:0}.mxPrivacyReq b,.mxPrivacyReq small{display:block}.mxPrivacyReq small{color:#64748b;margin-top:3px}.mxPrivacyStatus{align-self:start;border-radius:999px;background:#eef2ff;color:#4338ca;padding:6px 9px;font-size:11px;font-weight:900}.mxPrivacyStatus.done{background:#dcfce7;color:#166534}.mxPrivacyStatus.bad{background:#fee2e2;color:#991b1b}.mxPrivacyEmpty{color:#64748b;font-size:13px;font-weight:700}
      .mxPrivacyMinor{margin-top:12px;padding:13px;border-radius:16px;background:#f8fafc;color:#475569;font-size:13px;font-weight:700;line-height:1.45}.mxPrivacyMinor b{color:#0f172a}
      @media(max-width:560px){.mxPrivacyRightsGrid{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }

  async function currentUser(){
    if(!sb||typeof sb.getCurrentUser!=='function') throw new Error('No se pudo identificar tu sesión.');
    return sb.getCurrentUser();
  }

  async function rows(){
    const user=await currentUser();
    const data=await sb.request(`privacy_rights_requests?user_id=eq.${encodeURIComponent(user.id)}&select=id,request_type,detail,status,created_at,resolved_at,response_note&order=created_at.desc&limit=20`);
    return Array.isArray(data)?data:[];
  }

  function historyHtml(list){
    if(!list.length) return '<div class="mxPrivacyEmpty">Aún no tienes solicitudes de privacidad registradas.</div>';
    return list.map(r=>{
      const type=TYPES[r.request_type]||{label:r.request_type||'Solicitud'};
      const st=STATUS[r.status]||r.status||'Recibida';
      const cls=r.status==='completed'?'done':r.status==='rejected'?'bad':'';
      return `<article class="mxPrivacyReq"><div><b>${esc(type.label)}</b><small>${esc(fmt(r.created_at))}${r.response_note?` · ${esc(r.response_note)}`:''}</small></div><span class="mxPrivacyStatus ${cls}">${esc(st)}</span></article>`;
    }).join('');
  }

  async function refresh(host){
    const target=host.querySelector('[data-privacy-history]');
    if(!target) return;
    target.innerHTML='<div class="mxPrivacyEmpty">Cargando solicitudes…</div>';
    try{ target.innerHTML=historyHtml(await rows()); }
    catch(e){ target.innerHTML=`<div class="mxPrivacyEmpty">No se pudieron cargar las solicitudes: ${esc(e?.message||e)}</div>`; }
  }

  function openForm(host,type){
    const cfg=TYPES[type];if(!cfg)return;
    const slot=host.querySelector('[data-privacy-form]');if(!slot)return;
    const placeholder=type==='rectification'?'Indica qué dato necesitas corregir y cuál debería ser el valor correcto.':type==='opposition'?'Indica a qué tratamiento específico deseas oponerte.':type==='suppression'?'Indica qué datos deseas que sean eliminados y el motivo de la solicitud.':type==='blocking'?'Indica qué tratamiento deseas bloquear temporalmente y qué solicitud relacionada estás ejerciendo.':'Puedes agregar antecedentes adicionales para facilitar la revisión (opcional).';
    slot.innerHTML=`<div class="mxPrivacyForm"><h4>${esc(cfg.icon+' '+cfg.label)}</h4><p>${esc(cfg.help)}</p><textarea data-privacy-detail maxlength="2000" placeholder="${esc(placeholder)}"></textarea><div class="mxPrivacyFormActions"><button class="mxPrivacyCancel" type="button" data-privacy-cancel>Cancelar</button><button class="mxPrivacySend" type="button" data-privacy-send>Enviar solicitud</button></div></div>`;
    slot.dataset.type=type;
    slot.querySelector('[data-privacy-cancel]').onclick=()=>{slot.innerHTML='';delete slot.dataset.type;};
    slot.querySelector('[data-privacy-send]').onclick=()=>submit(host,slot);
    slot.querySelector('textarea')?.focus();
  }

  async function submit(host,slot){
    const type=slot.dataset.type;const cfg=TYPES[type];if(!cfg)return;
    const detail=String(slot.querySelector('[data-privacy-detail]')?.value||'').trim();
    if(['rectification','opposition','suppression','blocking'].includes(type)&&detail.length<5){alert('Agrega un breve detalle para poder revisar la solicitud.');return;}
    const btn=slot.querySelector('[data-privacy-send]');btn.disabled=true;btn.textContent='Enviando…';
    try{
      const user=await currentUser();
      await sb.request('privacy_rights_requests',{method:'POST',body:JSON.stringify({user_id:user.id,request_type:type,detail:detail||null,status:'received',source:'profile'})});
      slot.innerHTML='<div class="mxPrivacyLaw"><b>Solicitud registrada.</b> Puedes seguir su estado en el historial de esta misma sección.</div>';
      delete slot.dataset.type;
      await refresh(host);
    }catch(e){
      btn.disabled=false;btn.textContent='Enviar solicitud';alert('No se pudo registrar la solicitud: '+(e?.message||e));
    }
  }

  function mount(){
    css();
    const body=document.querySelector('#mxConsentOverlay .mxConsentBody');
    if(!body||body.querySelector('[data-mx-privacy-rights]')) return;
    const card=document.createElement('section');card.className='mxConsentCard';card.setAttribute('data-mx-privacy-rights','1');
    card.innerHTML=`<h3 style="margin:0">Tus derechos sobre tus datos</h3><p style="margin:6px 0 0;color:#64748b;font-weight:700;line-height:1.45">Puedes ejercer solicitudes sobre tus datos personales directamente desde MiCursoX.</p><div class="mxPrivacyLaw"><b>Protección de datos en Chile.</b> MiCursoX considera la Ley 19.628 y se está adecuando a la Ley 21.719, cuya entrada en vigencia es el 1 de diciembre de 2026. Las solicitudes quedan registradas para su revisión y trazabilidad.</div><div class="mxPrivacyMinor"><b>Datos de niños, niñas y adolescentes.</b> La información asociada al alumno requiere protección reforzada y debe usarse únicamente para finalidades legítimas relacionadas con la gestión del curso y el servicio.</div><div class="mxPrivacyRightsGrid">${Object.entries(TYPES).map(([k,v])=>`<button type="button" class="mxPrivacyRight" data-privacy-type="${k}">${v.icon} ${esc(v.label)}<small>${esc(v.help)}</small></button>`).join('')}</div><div data-privacy-form></div><div class="mxPrivacyHistory"><h4>Mis solicitudes</h4><div data-privacy-history></div></div>`;
    body.appendChild(card);
    card.querySelectorAll('[data-privacy-type]').forEach(b=>b.addEventListener('click',()=>openForm(card,b.dataset.privacyType)));
    refresh(card);
  }

  const mo=new MutationObserver(()=>mount());
  mo.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',mount,{once:true});
  window.addEventListener('cursapp:profile-opened',()=>setTimeout(mount,0));
})();