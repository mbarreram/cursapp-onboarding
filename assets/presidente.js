
// === CURSAPP GLOBAL LOADING ===
window.CURSAPP_LOADING = window.CURSAPP_LOADING || {
 show:(role='')=>{
  try{
   let el=document.getElementById('cursapp-loading-overlay');
   if(el) return;
   const msgs={
    presidente:['📊 Preparando dashboard ejecutivo...','👥 Revisando apoderados...','📈 Actualizando indicadores...'],
    tesorero:['💰 Conciliando pagos...','🧾 Actualizando comprobantes...','📋 Revisando rendiciones...'],
    apoderado:['🎒 Revisando información del curso...','📅 Consultando próximas cuotas...','📣 Actualizando avisos...']
   };
   const arr=msgs[(role||'').toLowerCase()]||['Cargando datos...'];
   el=document.createElement('div');
   el.id='cursapp-loading-overlay';
   el.style.cssText='position:fixed;inset:0;background:#fff;z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center';
   el.innerHTML='<div style="font-size:54px;color:#6d28d9;font-weight:700">C</div><div id="ca-msg" style="margin-top:12px;font-weight:600">Cargando datos...</div><div style="width:220px;height:6px;background:#eee;border-radius:8px;overflow:hidden;margin-top:12px"><div style="height:100%;width:100%;background:#6d28d9;animation:caProg 1.4s infinite"></div></div><style>@keyframes caProg{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}</style>';
   document.body.appendChild(el);
   let i=0; el._t=setInterval(()=>{const m=el.querySelector('#ca-msg'); if(m) m.textContent=arr[i++%arr.length];},900);
  }catch(e){}
 },
 hide:()=>{
  const el=document.getElementById('cursapp-loading-overlay');
  if(el){try{clearInterval(el._t);}catch(e){} el.remove();}
 }
};
document.addEventListener('DOMContentLoaded',()=>{try{window.CURSAPP_LOADING.show('presidente'); setTimeout(()=>window.CURSAPP_LOADING.hide(),1200);}catch(e){}});
// === END LOADING ===

// V10.1 · Mantiene contexto de rol coherente al abrir presidente.
(function(){
  try{
    const expected='presidente';
    const raw=localStorage.getItem('cursapp_session_v1');
    const s=raw ? JSON.parse(raw) : {};
    const roles=Array.isArray(s.roles) ? s.roles.map(r=>String(r).toLowerCase().trim()).filter(Boolean) : [];
    if(!roles.includes(expected)) roles.push(expected);
    s.roles=roles; s.currentRole=expected; s.activeRole=expected; s.role=expected;
    const activeCourse=String(localStorage.getItem('cursapp_active_course_v1') || s.courseKey || '').trim();
    if(activeCourse) s.courseKey=activeCourse;
    localStorage.setItem('cursapp_active_role_v1', expected);
    localStorage.setItem('cursapp_session_v1', JSON.stringify(s));
    document.documentElement.setAttribute('data-role', expected);
  }catch(_e){}
})();
/* __CURSAPP_V10_1_ROLE_CONTEXT_PRESIDENTE__ */

/* Cursapp HOTFIX v7 · Presidente estable
   - Sin loop de banner: render único post Home.
   - Dashboard ejecutivo sin carrusel horizontal que rebote.
   - Asignar tesorero abre selector estable y crea rol tesorero en Supabase sin quitar apoderado.
*/
(function(){
  if(window.__CURSAPP_PRESIDENTE_STABLE_V7__) return;
  window.__CURSAPP_PRESIDENTE_STABLE_V7__ = true;

  const SB_CONFIG = window.CURSAPP_SUPABASE || {};
  const SB_URL = SB_CONFIG.url;
  const SB_KEY = SB_CONFIG.publishableKey;
  const q = (v)=> encodeURIComponent(String(v == null ? "" : v));
  const esc = (s)=> String(s ?? "").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

  // Bloquea SOLO el placeholder antiguo, no los demás alerts reales.
  try{
    if(!window.__CURSAPP_ALERT_ORIGINAL_STABLE_V7__){
      window.__CURSAPP_ALERT_ORIGINAL_STABLE_V7__ = window.alert.bind(window);
      window.alert = function(msg){
        const s = String(msg || "");
        if(s.includes("Asignación de tesorero") || s.includes("perder el rol apoderado") || s.includes("siguiente fase")){
          console.warn("Cursapp v7 bloqueó placeholder tesorero:", s);
          try{ window.CursappPresidentStable.openTreasurerPicker(); }catch(e){}
          return;
        }
        return window.__CURSAPP_ALERT_ORIGINAL_STABLE_V7__(msg);
      };
    }
  }catch(e){}

  function injectStableCss(){
    if(document.getElementById('cursappPresidentStableV7')) return;
    const st=document.createElement('style');
    st.id='cursappPresidentStableV7';
    st.textContent=`
      .cpV6President .cpV6HeroTrack{
        display:flex!important;
        flex-wrap:nowrap!important;
        gap:14px!important;
        overflow-x:auto!important;
        overflow-y:hidden!important;
        scroll-snap-type:none!important;
        scroll-behavior:auto!important;
        -webkit-overflow-scrolling:touch!important;
        touch-action:pan-x pan-y!important;
        padding:2px 4px 10px 4px!important;
        overscroll-behavior-x:contain!important;
      }
      .cpV6President .cpV6HeroTrack .cpV6HeroCard{flex:0 0 88%!important;width:auto!important;min-width:88%!important;max-width:88%!important;scroll-snap-align:none!important;scroll-snap-stop:normal!important;}
      .cpV6President .cpV6Dots{display:flex!important;}
      @media(min-width:760px){.cpV6President .cpV6HeroTrack .cpV6HeroCard{flex-basis:46%!important;min-width:46%!important;max-width:46%!important;}}
      .cpV6President button,.cpV6President a{touch-action:manipulation;}
      .cursappTreasurerOverlay{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:99999;display:flex;align-items:flex-end;justify-content:center;padding:14px;}
      .cursappTreasurerCard{width:min(760px,100%);max-height:82vh;overflow:auto;-webkit-overflow-scrolling:touch;background:#fff;border-radius:24px;padding:16px;box-shadow:0 24px 70px rgba(15,23,42,.24);}
      .cursappMemberRow{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid rgba(15,23,42,.08);border-radius:16px;padding:12px;margin-top:10px;background:#fff;}
      .cursappMemberRow b{display:block}.cursappMemberRow small{display:block;color:#64748b;font-weight:800;margin-top:3px}.cursappMemberRow button{border:0;border-radius:999px;padding:10px 12px;font-weight:950;background:#f59e0b;color:#111827;}
    `;
    document.head.appendChild(st);
  }
  injectStableCss();

  async function sb(path, opts){
    if(window.CURSAPP_SUPABASE && typeof window.CURSAPP_SUPABASE.request === "function"){
      return window.CURSAPP_SUPABASE.request(path, opts);
    }
    const res = await fetch(SB_URL + "/rest/v1/" + path, Object.assign({method:"GET"}, opts || {}, {
      headers:Object.assign({apikey:SB_KEY, Authorization:"Bearer "+SB_KEY, "Content-Type":"application/json", Prefer:"return=representation"}, (opts && opts.headers) || {})
    }));
    const text = await res.text(); let data=null;
    try{ data=text?JSON.parse(text):null; }catch(e){ data=text; }
    if(!res.ok){ const msg=(data&&(data.message||data.error||data.details||data.hint))||text||("HTTP "+res.status); throw new Error(msg); }
    return data;
  }
  function sessionCourseKey(){
    try{ const s=JSON.parse(localStorage.getItem('cursapp_session_v1')||'null')||{}; return String(localStorage.getItem('cursapp_active_course_v1')||s.courseKey||'').trim(); }
    catch(e){ return String(localStorage.getItem('cursapp_active_course_v1')||'').trim(); }
  }
  async function getCurso(){
    const ck=sessionCourseKey(); if(!ck) throw new Error('No hay curso activo en la sesión.');
    const rows=await sb('cursos?course_key=eq.'+q(ck)+'&select=id,course_key,nombre&limit=1');
    const c=Array.isArray(rows)?rows[0]:null; if(!c||!c.id) throw new Error('No encontré el curso en Supabase.');
    return c;
  }
  async function getMembers(){
    const curso=await getCurso();
    const rows=await sb('miembros_curso?curso_id=eq.'+q(curso.id)+'&select=*&order=created_at.asc');
    return {curso, rows:Array.isArray(rows)?rows:[]};
  }
  function memberLabel(m){ return String(m.nombre_apoderado || m.email || 'Miembro del curso').trim(); }
  function memberSub(m){ return [m.email, m.nombre_alumno ? ('Alumno/a: '+m.nombre_alumno) : '', m.rol ? ('Rol actual: '+m.rol) : ''].filter(Boolean).join(' · '); }

  async function assignTreasurerByEmail(email){
    email=String(email||'').toLowerCase().trim(); if(!email) throw new Error('Correo inválido.');
    const {curso, rows}=await getMembers();
    const mine=rows.filter(m=>String(m.email||'').toLowerCase().trim()===email);
    if(!mine.length) throw new Error('No encontré ese miembro en el curso.');

    // V11.4: regla de negocio solicitada.
    // Para asignar, primero se consulta Supabase por el curso activo.
    // Si ya existe tesorero en este curso, no se reasigna automáticamente.
    // El presidente debe eliminar primero el rol tesorero vigente y luego asignar otro.
    const currentTreasurers = rows.filter(m => String(m.rol || '').toLowerCase() === 'tesorero');
    const sameEmail = currentTreasurers.find(m => String(m.email || '').toLowerCase().trim() === email);
    if(sameEmail) return sameEmail;

    if(currentTreasurers.length){
      const names = currentTreasurers.map(t => {
        const n = String(t.nombre_apoderado || t.email || 'tesorero').trim();
        const e = String(t.email || '').trim();
        return e && !n.includes(e) ? (n + ' (' + e + ')') : n;
      }).filter(Boolean).join(', ');
      throw new Error('Ya existe un tesorero asignado en este curso: ' + (names || 'tesorero vigente') + '. Para cambiarlo, primero presiona "Eliminar tesorero" en el tesorero vigente.');
    }

    const src=mine.find(m=>String(m.rol||'').toLowerCase()==='apoderado') || mine[0];
    const body={curso_id:curso.id, usuario_id:src.usuario_id||null, rol:'tesorero', nombre_apoderado:src.nombre_apoderado||null, nombre_alumno:src.nombre_alumno||null, email:src.email||email, estado:'aprobado', activacion_pagada:true};
    const inserted=await sb('miembros_curso', {method:'POST', body:JSON.stringify(body)});
    try{
      const profiles=JSON.parse(localStorage.getItem('cursapp_profiles_v1')||'[]');
      if(Array.isArray(profiles)){
        const ck=sessionCourseKey();
        const base=profiles.find(p=>String(p?.apoderado?.email||p?.email||p?.user?.email||'').toLowerCase().trim()===email && (!ck || String(p?.courseKey||'')===ck));
        const exists=profiles.some(p=>String(p?.apoderado?.email||p?.email||p?.user?.email||'').toLowerCase().trim()===email && String(p?.role||'').toLowerCase()==='tesorero' && (!ck || String(p?.courseKey||'')===ck));
        if(base && !exists){ const copy=JSON.parse(JSON.stringify(base)); copy.role='tesorero'; copy.profileId=[copy.courseKey||ck,email,'tesorero',copy?.apoderado?.alumno||''].join('|'); copy.status='aprobado'; copy.activation=Object.assign({},copy.activation||{},{required:true,status:'paid'}); profiles.push(copy); localStorage.setItem('cursapp_profiles_v1', JSON.stringify(profiles)); }
      }
    }catch(e){}
    return Array.isArray(inserted)?inserted[0]:inserted;
  }

  async function removeTreasurerByEmail(email){
    email=String(email||'').toLowerCase().trim(); if(!email) throw new Error('Correo inválido.');
    const {rows}=await getMembers();
    const targets=rows.filter(m=>String(m.rol||'').toLowerCase()==='tesorero' && String(m.email||'').toLowerCase().trim()===email);
    if(!targets.length) throw new Error('Ese apoderado no tiene rol tesorero vigente.');

    const errors=[];
    for(const t of targets){
      try{
        if(!t.id) throw new Error('Registro sin id');
        await sb('miembros_curso?id=eq.' + q(t.id), { method:'DELETE' });
      }catch(e){
        const msg=(e && e.message) ? e.message : String(e||'Error desconocido');
        errors.push((t.nombre_apoderado || t.email || t.id || 'tesorero') + ': ' + msg);
        try{ console.error('CURSAPP TESORERO DELETE ERROR', {miembro:t, error:e}); }catch(_log){}
      }
    }

    if(errors.length){
      throw new Error('No se pudo eliminar el rol tesorero. Detalle: ' + errors.join(' | ') + '. Revisa política RLS/DELETE en Supabase para miembros_curso.');
    }

    // Limpieza de caché local legacy, sin tocar el rol apoderado.
    try{
      const ck=sessionCourseKey();
      const profiles=JSON.parse(localStorage.getItem('cursapp_profiles_v1')||'[]');
      if(Array.isArray(profiles)){
        const clean=profiles.filter(p=>{
          const pe=String(p?.apoderado?.email||p?.email||p?.user?.email||'').toLowerCase().trim();
          const role=String(p?.role||'').toLowerCase();
          const courseOk=!ck || String(p?.courseKey||'')===ck;
          return !(pe===email && role==='tesorero' && courseOk);
        });
        if(clean.length!==profiles.length) localStorage.setItem('cursapp_profiles_v1', JSON.stringify(clean));
      }
    }catch(e){}
    return true;
  }

  function alertStable(msg){
    try{ window.__CURSAPP_ALERT_ORIGINAL_STABLE_V7__(msg); }
    catch(_e){ alert(msg); }
  }

  async function refreshTreasurerButtons(){
    try{
      const {rows}=await getMembers();
      const currentEmails = new Set(rows.filter(r=>String(r.rol||'').toLowerCase()==='tesorero').map(r=>String(r.email||'').toLowerCase().trim()).filter(Boolean));
      document.querySelectorAll('button,a,[role="button"]').forEach(btn=>{
        const txt=String(btn.textContent||btn.value||'').toLowerCase();
        if(!txt.includes('tesorero')) return;
        const email=findEmailNear(btn);
        if(!email) return;
        if(currentEmails.has(email)){
          btn.textContent='Eliminar tesorero';
          btn.removeAttribute('disabled');
          btn.disabled=false;
          try{ btn.setAttribute('data-remove-treasurer-email', email); btn.removeAttribute('data-assign-treasurer-email'); }catch(e){}
        }else{
          btn.textContent='Asignar como tesorero';
          btn.removeAttribute('disabled');
          btn.disabled=false;
          try{ btn.setAttribute('data-assign-treasurer-email', email); btn.removeAttribute('data-remove-treasurer-email'); }catch(e){}
        }
      });
    }catch(e){ try{ console.warn('No se pudieron refrescar botones tesorero', e); }catch(_w){} }
  }
  function closePicker(){ const el=document.getElementById('cursappTreasurerOverlay'); if(el) el.remove(); }
  async function openTreasurerPicker(){
    injectStableCss();
    let overlay=document.getElementById('cursappTreasurerOverlay'); if(overlay) overlay.remove();
    overlay=document.createElement('div'); overlay.id='cursappTreasurerOverlay'; overlay.className='cursappTreasurerOverlay';
    overlay.innerHTML=`<div class="cursappTreasurerCard"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;"><div><div style="font-weight:950;font-size:20px;">Asignar tesorero</div><div style="color:#64748b;font-weight:800;margin-top:4px;">Selecciona cualquier miembro del curso. Mantendrá su rol actual y además tendrá acceso como tesorero.</div></div><button type="button" style="border:1px solid rgba(0,0,0,.12);background:#fff;border-radius:999px;padding:9px 12px;font-weight:900;" data-close-treasurer> Cerrar </button></div><div id="cursappTreasurerRows" style="margin-top:12px;color:#64748b;font-weight:850;">Cargando miembros...</div></div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click',e=>{ if(e.target===overlay || e.target.closest('[data-close-treasurer]')) closePicker(); });
    const mount=overlay.querySelector('#cursappTreasurerRows');
    try{
      const {rows}=await getMembers();
      const unique=[]; const seen=new Set();
      rows.forEach(m=>{ const email=String(m.email||'').toLowerCase().trim(); if(!email||seen.has(email)) return; seen.add(email); unique.push(m); });
      if(!unique.length){ mount.innerHTML='No hay miembros con correo para asignar.'; return; }
      const currentTreasurerEmails = new Set(rows.filter(r => String(r.rol || '').toLowerCase() === 'tesorero').map(r => String(r.email || '').toLowerCase().trim()).filter(Boolean));
      mount.innerHTML=unique.map(m=>{ const em=String(m.email||'').toLowerCase().trim(); const isCurrent=em && currentTreasurerEmails.has(em); return `<div class="cursappMemberRow"><div><b>${esc(memberLabel(m))}</b><small>${esc(memberSub(m))}</small></div><button type="button" ${isCurrent ? `data-remove-treasurer-email="${esc(em)}"` : `data-assign-treasurer-email="${esc(em)}"`}>${isCurrent?'Eliminar tesorero':'Asignar tesorero'}</button></div>`; }).join('');
      mount.querySelectorAll('[data-assign-treasurer-email]').forEach(btn=>{
        btn.addEventListener('click', async (ev)=>{
          ev.preventDefault(); ev.stopPropagation();
          const email=btn.getAttribute('data-assign-treasurer-email'); const old=btn.textContent;
          btn.disabled=true; btn.textContent='Asignando...';
          try{ await assignTreasurerByEmail(email); btn.textContent='Asignado ✅'; alertStable('Tesorero asignado correctamente ✅'); closePicker(); try{ window.dispatchEvent(new CustomEvent('cursapp:dataUpdated',{detail:{source:'tesorero-v11.4'}})); }catch(e){} setTimeout(refreshTreasurerButtons, 450); }
          catch(err){ btn.disabled=false; btn.textContent=old; alertStable('No se pudo asignar tesorero: '+(err&&err.message?err.message:err)); }
        }, true);
      });
      mount.querySelectorAll('[data-remove-treasurer-email]').forEach(btn=>{
        btn.addEventListener('click', async (ev)=>{
          ev.preventDefault(); ev.stopPropagation();
          const email=btn.getAttribute('data-remove-treasurer-email');
          if(!confirm('¿Eliminar rol tesorero de este apoderado? Mantendrá su rol apoderado.')) return;
          const old=btn.textContent; btn.disabled=true; btn.textContent='Eliminando...';
          try{ await removeTreasurerByEmail(email); alertStable('Rol tesorero eliminado ✅'); closePicker(); try{ window.dispatchEvent(new CustomEvent('cursapp:dataUpdated',{detail:{source:'tesorero-v11.4-remove'}})); }catch(e){} setTimeout(refreshTreasurerButtons, 450); }
          catch(err){ btn.disabled=false; btn.textContent=old; alertStable('No se pudo eliminar tesorero: '+(err&&err.message?err.message:err)); }
        }, true);
      });
    }catch(err){ mount.innerHTML='<div style="color:#b91c1c;font-weight:900;">No se pudieron cargar miembros: '+esc(err&&err.message?err.message:err)+'</div>'; }
  }

  function findEmailNear(btn){ let el=btn; for(let i=0; el && i<10; i++,el=el.parentElement){ const m=String(el.textContent||'').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i); if(m) return m[0].toLowerCase().trim(); } return ''; }
  function isTreasurerButton(btn){
    if(!btn) return false;
    const txt=String(btn.textContent||btn.value||'').toLowerCase().replace(/\s+/g,' ').trim();
    const explicit=String((btn.getAttribute&&((btn.getAttribute('data-assign-treasurer-email')||'')+' '+(btn.getAttribute('data-remove-treasurer-email')||'')))||'').trim();
    // No inspeccionar onclick/URL: "tesorero.html#conciliacion" pertenece al acceso
    // Registrar pago y antes era confundido con el botón de asignación de tesorero.
    return !!explicit || /^(asignar( como)? tesorero|eliminar tesorero)$/.test(txt);
  }
  function isRemoveTreasurerButton(btn){ const txt=String(btn&&btn.textContent||'').toLowerCase(); const attr=String((btn&&btn.getAttribute&&btn.getAttribute('data-remove-treasurer-email'))||'').toLowerCase(); return !!attr || (txt.includes('eliminar') && txt.includes('tesorero')); }

  document.addEventListener('click', async function(ev){
    const btn=ev.target&&ev.target.closest?ev.target.closest('button,a,[role="button"]'):null;
    if(!isTreasurerButton(btn)) return;
    ev.preventDefault(); ev.stopPropagation(); if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    const email=(btn.getAttribute&&btn.getAttribute('data-remove-treasurer-email')) || (btn.getAttribute&&btn.getAttribute('data-assign-treasurer-email')) || findEmailNear(btn);
    if(!email){ openTreasurerPicker(); return false; }

    if(isRemoveTreasurerButton(btn)){
      if(!confirm('¿Eliminar rol tesorero de este apoderado? Mantendrá su rol apoderado.')) return false;
      const old=btn.textContent; btn.disabled=true; btn.textContent='Eliminando...';
      try{ await removeTreasurerByEmail(email); btn.textContent='Asignar como tesorero'; alertStable('Rol tesorero eliminado ✅'); try{ window.dispatchEvent(new CustomEvent('cursapp:dataUpdated',{detail:{source:'tesorero-v11.4-remove-inline'}})); }catch(e){} setTimeout(refreshTreasurerButtons, 450); }
      catch(err){ btn.disabled=false; btn.textContent=old||'Eliminar tesorero'; alertStable('No se pudo eliminar tesorero: '+(err&&err.message?err.message:err)); }
      return false;
    }

    const old=btn.textContent; btn.disabled=true; btn.textContent='Asignando...';
    try{ await assignTreasurerByEmail(email); btn.textContent='Eliminar tesorero'; alertStable('Tesorero asignado correctamente ✅'); try{ window.dispatchEvent(new CustomEvent('cursapp:dataUpdated',{detail:{source:'tesorero-v11.4-assign-inline'}})); }catch(e){} setTimeout(refreshTreasurerButtons, 450); }
    catch(err){ btn.disabled=false; btn.textContent=old||'Asignar como tesorero'; alertStable('No se pudo asignar tesorero: '+(err&&err.message?err.message:err)); }
    return false;
  }, true);

  let __treasurerRefreshTimer=null;
  function scheduleTreasurerRefresh(){ clearTimeout(__treasurerRefreshTimer); __treasurerRefreshTimer=setTimeout(refreshTreasurerButtons, 350); }
  try{ window.addEventListener('cursapp:dataUpdated', scheduleTreasurerRefresh); window.addEventListener('cursapp:dataChanged', scheduleTreasurerRefresh); }catch(e){}
  try{ new MutationObserver(scheduleTreasurerRefresh).observe(document.body,{childList:true,subtree:true}); }catch(e){}
  setTimeout(refreshTreasurerButtons, 900);

  window.CursappPresidentStable={openTreasurerPicker, assignTreasurerByEmail, removeTreasurerByEmail, refreshTreasurerButtons, injectStableCss};
})();

(function () {
  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modalRoot");
  const navItems = Array.from(document.querySelectorAll(".navItem"));
  const menuBtn = document.getElementById("menuBtn");
  const menuDropdown = document.getElementById("menuDropdown");
  const resetBtn = document.getElementById("resetBtn");
  const logoutBtn = document.getElementById("logoutBtn");


  // ---- session bootstrap (evita courseKey vacío tras borrar data) ----
  function readSession(){
    try{ return JSON.parse(localStorage.getItem("cursapp_session_v1") || "null"); }catch(e){ return null; }
  }
  (function ensureActiveCourseFromSession(){
    try{
      const s = readSession();
      if(s && s.courseKey){
        const cur = localStorage.getItem("cursapp_active_course_v1") || "";
        if(!cur) localStorage.setItem("cursapp_active_course_v1", String(s.courseKey));
      }
    }catch(e){}
  })();


  // ===== DEBUG TEMPORAL PRESIDENTE CURSO =====
  // Actívalo entrando a /presidente.html?debug=1
  // o dejando localStorage.cursapp_debug_presidente = "1".
  const PRESIDENTE_DEBUG_VERSION = "20260605-curso-activo";
  function isDebugPresidente(){
    try{
      const qs = new URLSearchParams(window.location.search || "");
      return qs.get("debug") === "1" || localStorage.getItem("cursapp_debug_presidente") === "1";
    }catch(e){ return false; }
  }
  function safeParseDebug(v){
    try{ return JSON.parse(v || "null"); }catch(e){ return v || null; }
  }
  function smallJsonDebug(key, maxLen){
    try{
      const raw = localStorage.getItem(key);
      if(raw == null) return null;
      if(String(raw).length > (maxLen || 900)) return String(raw).slice(0, maxLen || 900) + "...[cortado]";
      return safeParseDebug(raw);
    }catch(e){ return "ERR:" + (e && e.message ? e.message : e); }
  }
  function debugPresidenteAlert(stage){
    if(!isDebugPresidente()) return;
    try{
      const session = smallJsonDebug("cursapp_session_v1", 1200);
      const activeCourse = localStorage.getItem("cursapp_active_course_v1") || "";
      const activeProfile = localStorage.getItem("cursapp_active_profile_v1") || "";
      const activeRole = localStorage.getItem("cursapp_active_role_v1") || "";
      const courseV1 = smallJsonDebug("cursapp_course_v1", 1600);
      const courses = smallJsonDebug("cursapp_courses_v1", 1600);
      const profiles = smallJsonDebug("cursapp_profiles_v1", 1600);
      const enrollments = smallJsonDebug("cursapp_enrollments_v1", 1600);
      let activeCourseResolved = null;
      try{ activeCourseResolved = typeof activeCourse === "function" ? activeCourse() : null; }catch(e){ activeCourseResolved = "ERR:" + e.message; }

      alert("[Presidente DEBUG " + PRESIDENTE_DEBUG_VERSION + "] " + stage + "\\n\\n" + JSON.stringify({
        url: location.href,
        activeCourse,
        activeProfile,
        activeRole,
        session,
        courseV1,
        courses,
        profiles,
        enrollments,
        activeCourseResolved
      }, null, 2));
    }catch(e){
      alert("[Presidente DEBUG] Error: " + (e && e.message ? e.message : e));
    }
  }
  window.cursappDebugPresidente = function(){ debugPresidenteAlert("manual"); };


  // ---- helpers ----
  const esc = (s) =>
    String(s ?? "").replace(/[&<>'"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c])
    );
  const clp = (n) => "$" + Number(n || 0).toLocaleString("es-CL");

  function shareWhatsApp(text){
    const msg = String(text || "").trim();
    if(!msg){ alert("No hay contenido para compartir."); return; }
    const url = "https://wa.me/?text=" + encodeURIComponent(msg);
    const w = window.open(url, "_blank");
    if(!w){
      location.href = url;
    }
  }

  function shareExecutiveWhatsApp(){
    const ym = currentYM();
    const cobradoMes = collectedMonth(ym);
    const gastadoMes = spentMonth(ym);
    const saldoMes = cobradoMes - gastadoMes;
    const saldoDisponible = saldoCourse();

    const msg = [
      `📊 Informe Ejecutivo del Curso`,
      ``,
      `Periodo: ${ym}`,
      ``,
      `💰 Cobrado mes: ${clp(cobradoMes)}`,
      `🧾 Gastado mes: ${clp(gastadoMes)}`,
      `⚖ï¸ Saldo mes: ${clp(saldoMes)}`,
      ``,
      `🏦 Saldo disponible: ${clp(saldoDisponible)}`,
      ``,
      `Informe generado en Cursapp`
    ].join("\n");

    shareWhatsApp(msg);
  }


// ---------- clipboard helper (iOS Safari friendly) ----------
async function copyTextToClipboard(text){
  const s = String(text||"");
  // Prefer modern API (HTTPS + user gesture)
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      await navigator.clipboard.writeText(s);
      return true;
    }
  }catch(e){}
  // Fallback: temporary textarea + execCommand('copy')
  try{
    const ta = document.createElement("textarea");
    ta.value = s;
    ta.setAttribute("readonly","");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.width = "1px";
    ta.style.height = "1px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return !!ok;
  }catch(e){}
  return false;
}
  const uid = (p = "id") => `${p}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;

  function detectKey(candidates) {
    for (const k of candidates) if (localStorage.getItem(k) != null) return k;
    return "";
  }

  // storage keys (scoped por curso; listo para producción)
  const sk = (base)=> (window.CURSAPP && window.CURSAPP.scopedKey) ? window.CURSAPP.scopedKey(base) : `cursapp_${base}`;
  const KEY_TASKS = sk("tasks_v1");
  const KEY_DELETED_TASKS = sk("deleted_tasks_v1");
  const KEY_AVISOS = sk("avisos_v2");
  const KEY_PAYMENTS = sk("payments_v1");
  const KEY_EXPENSES = sk("expenses_v1");
  const KEY_MONTHLY_REPORTS = sk("monthly_reports_v1");
  const KEY_ENROLLMENTS = sk("enrollments_v1");
  const KEY_DIRTY = detectKey(["cursapp_reports_dirty_v1", "reportsDirty", "cursapp_dirty_reports"]) || "cursapp_reports_dirty_v1";

  // ---- notifier: refrescar indicadores cuando se actualiza storage (misma sesión) ----
  // Esto evita que al aprobar un apoderado en Presidente los indicadores queden desfasados hasta re-login.
  (function patchLocalStorageSetItem(){
    try{
      if(window.__cursapp_setItemPatched) return;
      const _orig = localStorage.setItem.bind(localStorage);
      localStorage.setItem = function(k, v){
        _orig(k, v);
        try{ window.dispatchEvent(new CustomEvent('cursapp:dataChanged', { detail: { key: String(k||'') } })); }catch(e){}
      };
      window.__cursapp_setItemPatched = true;
    }catch(e){}
  })();

  const load = (k, def) => {
    try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(def)); }
    catch { return def; }
  };
  const save = (k, v) => {
    localStorage.setItem(k, JSON.stringify(v));
    // localStorage.setItem ya emite cursapp:dataChanged (ver patchLocalStorageSetItem),
    // pero mantenemos este try por compatibilidad si el patch no aplica.
    try{ window.dispatchEvent(new CustomEvent('cursapp:dataChanged', { detail: { key: String(k||'') } })); }catch(e){}
  };


  // ---- Payments materialization (para que indicadores no queden en 0) ----
function hash32(str){
    let h = 5381;
    const s = String(str||"");
    for(let i=0;i<s.length;i++) h = ((h<<5)+h) + s.charCodeAt(i);
    return (h>>>0).toString(16);
  }
  function alumnoIdOf(courseKey, apoderadoEmail, alumnoLabel){
    return "alu_" + hash32([courseKey, apoderadoEmail, alumnoLabel].join("|"));
  }
  function paymentKeyOf(courseKey, taskId, apoderadoEmail, alumnoId, period, installmentIndex){
    return [courseKey, taskId, apoderadoEmail, alumnoId, (period||""), String(installmentIndex||"")].join("|");
  }
    function normalizeTask(t){
    t = t || {};
    const title = t.title || t.name || t.nombre || "Campaña";
    const startDate = t.startDate || t.inicio || t.start || t.from || todayISO();
    const dueDate = t.dueDate || t.endDate || t.fin || t.end || t.to || "";
    const partRaw = (t.participation ?? t.participacion ?? (t.mandatoryParticipation===false ? "no" : "si"));
    const mandatoryParticipation = (t.mandatoryParticipation !== undefined)
      ? !!t.mandatoryParticipation
      : (String(partRaw).toLowerCase().includes("oblig") || String(partRaw).toLowerCase()==="mandatory" || String(partRaw).toLowerCase()==="si");

    const status = String(t.status || t.estado || "").toLowerCase();
    const closed = (t.closed !== undefined) ? !!t.closed : (status==="closed" || status==="cerrada" || status==="canceled" || status==="cancelada");

    const typeRaw = String(t.type || t.tipo || "single").toLowerCase();
    const type = (typeRaw.includes("mens") || typeRaw==="monthly") ? "monthly" : "single";

    const months = Number(t.months || t.cuotas || t.meses || 1) || 1;
    const amount = Number(t.amount || t.monto || 0) || 0;

    return {
      ...t,
      id: t.id || t.taskId || t.campaignId,
      title,
      startDate,
      dueDate,
      endDate: dueDate,
      mandatoryParticipation,
      type,
      months,
      amount,
      closed
    };
  }

  function normalizeTasks(list){
    return (list || []).map(normalizeTask).filter(t=>t && t.id);
  }
  function ensurePaymentsForIdentity(ident, tasksAll, paysAll){
      ident = ident || {};
      const courseKey = String(ident.courseKey || localStorage.getItem(KEY_ACTIVE_COURSE) || "").trim();
      if(!courseKey) return paysAll || [];
      const apoderadoId = String(ident.apoderadoId||"").trim();
      const alumnoLabel = String(ident.alumnoId||"").trim();
      const email = String(ident.email||"").toLowerCase().trim();
      const aidStrong = (apoderadoId || email || "unknown_apoderado");
      const alumnoId = alumnoIdOf(courseKey, aidStrong, alumnoLabel);
  
      const out = (paysAll||[]).slice();
  
      // Normaliza claves legacy (sin period / installmentIndex) para evitar duplicados
      const byKey = new Set(out.map(p=>{
        if(p && p.paymentKey) return String(p.paymentKey);
        const ck = String(p.courseKey||"").trim();
        const aid = String(p.apoderadoKey||p.apoderadoId||"").trim() || String(p.apoderadoEmail||p.email||"").toLowerCase().trim();
        const tid = String(p.fromTaskId||"");
        const per = String(p.period||ymFromISO(p.dueDate)||"");
        // ⚠ï¸ si no existe installmentIndex, asumimos 1 (pago único o legacy)
        const idx = String((p.installmentIndex==null || p.installmentIndex==="") ? 1 : p.installmentIndex);
        const alu = String(p.alumnoId||"");
        return paymentKeyOf(ck, tid, aid, alu, per, idx);
      }));
  
      function pushPay(t, period, installmentIndex, dueDate, concept){
        const pk = paymentKeyOf(courseKey, t.id, aidStrong, alumnoId, period, installmentIndex);
        if(byKey.has(pk)) return;
  
        out.unshift({
          id: uid("pay"),
          paymentKey: pk,
          courseKey,
          apoderadoKey: aidStrong,
          apoderadoId: aidStrong,
          alumnoId: alumnoId,
          apoderadoEmail: aidStrong,
          fromTaskId: t.id,
          concept,
          amount: Number(t.amount||0),
          status: "pending",
          dueDate,
          period,
          installmentIndex,
          createdAt: nowISO()
        });
        byKey.add(pk);
      }
  
      (tasksAll||[]).forEach(t=>{
        if(!t) return;
        if(t.closed) return;
  
        const type = String(t.type||"single").toLowerCase();
        if(type==="monthly"){
          const startYM = ymFromISO(t.startDate||t.dueDate||todayISO());
          const months = Math.max(1, Number(t.months||1));
          for(let i=0;i<months;i++){
            const period = addMonthsYM(startYM, i);
            const dueDate = endOfMonthISO(period);
            const idx = i+1;
            pushPay(t, period, idx, dueDate, `${t.title} · Cuota ${idx}/${months}`);
          }
        }else{
          const period = ymFromISO(t.dueDate||t.startDate||todayISO());
          const dueDate = t.dueDate || endOfMonthISO(period);
          pushPay(t, period, 1, dueDate, t.title);
        }
      });
  
      if(out.length !== (paysAll||[]).length){
        save(KEY_PAYMENTS, out);
      }
      return out;
    }

  const ENROLL_KEY = "cursapp_enrollments_v1";

  function ensurePaymentsForAllApproved(){
    try{
      const courseKey = String(localStorage.getItem("cursapp_active_course_v1") || "");
      if(!courseKey) return;

      const tasksAll = normalizeTasks(load(KEY_TASKS, []));
      if(!tasksAll.length) return;

      const enrolls = load(ENROLL_KEY, []).filter(e => String(e?.courseKey||"")===courseKey && String(e?.status||"").toLowerCase()==="approved");
      if(!enrolls.length) return;

      let paysAll = load(KEY_PAYMENTS, []);
      const beforeLen = paysAll.length;

      for(const e of enrolls){
        const ident = {
          courseKey,
          apoderadoEmail: String(e.email||"").trim().toLowerCase(),
          alumnoLabel: String(e.alumno||"").trim()
        };
        paysAll = ensurePaymentsForIdentity(ident, tasksAll, paysAll);
      }

      if(paysAll.length !== beforeLen){
        save(KEY_PAYMENTS, paysAll);
      }
    }catch(e){}
  }

  const markDirty = () => localStorage.setItem(KEY_DIRTY, "1");
  const clearDirty = () => localStorage.removeItem(KEY_DIRTY);
  const isDirty = () => localStorage.getItem(KEY_DIRTY) === "1";

  const sum = (arr, fn) => (arr || []).reduce((a, x) => a + Number(fn ? fn(x) : x || 0), 0);

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  function currentYM(){
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  }


  function isExpired(t){
    if(!t.dueDate) return false;
    const due = new Date(t.dueDate + "T23:59:59");
    if(isNaN(due.getTime())) return false;
    return due.getTime() < Date.now();
  }

  // payment status tolerance
  function paymentStatusNorm(p){
    const st = String(p?.status || p?.estado || "").toLowerCase().trim();
    if(["opted_out","no_participa","no participa","excluido","excluida"].includes(st)) return "opted_out";
    if(["pagado","paid","conciliado"].includes(st)) return "paid";
    return st;
  }
  const isPaid = (p) => paymentStatusNorm(p) === "paid";
  const isCredit = (p) => paymentStatusNorm(p) === "credit";
  const isPendingLike = (p) => ["pending","pendiente","unpaid","due","partial","overdue","vencido"].includes(paymentStatusNorm(p));

// -------- Deduplicación de pagos (estabilidad) --------
function paymentStableKey(p){
  const cid = String(p.fromTaskId || p.taskId || p.campaignId || "");
  const who = String(p.apoderadoId || p.userId || p.payerId || p.email || p.payerEmail || "").toLowerCase();
  // Si no existe cuota/índice (legacy), asumimos 1 (pago único) para evitar duplicados.
  const cuotaRaw = (p.installmentIndex!=null && p.installmentIndex!=="") ? p.installmentIndex : (p.cuotaNumero || p.installment || p.cuota);
  const cuota = String((cuotaRaw==null || cuotaRaw==="") ? 1 : cuotaRaw);
  const due = String(p.dueDate || "");
  const amt = String(Number(p.amountRemaining ?? p.amount ?? p.monto ?? 0));
  const typ = String(p.type || p.kind || "");
  return [cid, who, cuota, due, amt, typ].join("|");
}

function dedupePaymentsAll(list){
  const map = new Map();
  let changed = false;

  (list || []).forEach(p=>{
    if(!p) return;
    const k = paymentStableKey(p);
    const prev = map.get(k);
    if(!prev){ map.set(k,p); return; }

    const prevPaid = String(prev.status||"").toLowerCase()==="paid";
    const curPaid  = String(p.status||"").toLowerCase()==="paid";
    if(curPaid && !prevPaid){ map.set(k,p); changed=true; return; }

    const prevRem = Number(prev.amountRemaining ?? prev.amount ?? 0);
    const curRem  = Number(p.amountRemaining ?? p.amount ?? 0);
    if(curRem < prevRem){ map.set(k,p); changed=true; return; }

    changed = true;
  });

  return { list: Array.from(map.values()), changed };
}


  // data access
  const tasks = () => load(KEY_TASKS, []);
  const deletedTasks = () => load(KEY_DELETED_TASKS, []);
  const noticesFromSupabase = () => load(KEY_AVISOS, []);
  const payments = () => {
    const raw = load(KEY_PAYMENTS, []);
    const dd = dedupePaymentsAll(raw);
    if(dd.changed) save(KEY_PAYMENTS, dd.list);
    return dd.list;
  };
  const expenses = () => load(KEY_EXPENSES, []);
  
  // -------- Informe Apoderado (idéntico al rol apoderado) --------
  window.openReportApoderado = function(period){
    const reps = reports();
    const r = reps.find(x=>String(x.period||"")===String(period||"")) || reps[0];
    if(!r) return;
  
    const currentYM = ()=>{
      const d=new Date();
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    };
    const pct = (a,b)=>{
      const A=Number(a||0), B=Number(b||0);
      if(B<=0) return 0;
      return Math.max(0, Math.min(100, Math.round((A/B)*100)));
    };
  
    
    const isExcludedStatus = (p)=>{
      const st = paymentStatusNorm(p);
      return st==="opted_out" || st==="void" || st==="cancelled";
    };
  const ym = currentYM();
    const tasksArr = tasks();
    const pays = payments();
  
    // Totales del mes (proyección y cobrado) + deudores únicos
    let cobradoMes=0, proyeccionMes=0;
    const deudoresSet = new Set();
  
    (pays||[]).forEach(p=>{
      if(!p) return;
      if(isExcludedStatus(p)) return;
  
      const dueYM = String(p.dueDate||"").slice(0,7);
      const perYM = String(p.period||"").slice(0,7);
      const matchYM = (dueYM===ym) || (perYM===ym);
      if(!matchYM) return;
  
      const amt = Number(p.amount || p.amountRemaining || 0);
      proyeccionMes += amt;
  
      if(String(p.status||"")==="paid"){
        cobradoMes += Number(p.amount||0);
      }else{
        const pid = String(p.payerProfileId || p.profileId || p.userId || "");
        if(pid) deudoresSet.add(pid);
      }
    });
  
    const cursoPct = pct(cobradoMes, proyeccionMes);
    const sem = (cursoPct>=80) ? "🟢" : (cursoPct>=45 ? "🟡" : "🔴");
    const semMsg = (cursoPct>=80)
      ? "Vamos muy bien este mes"
      : (cursoPct>=45 ? "Vamos avanzando, aún falta un poco" : "Atención: queda bastante por pagar este mes");
  
    // Agrupar pagos por campaña
    const byTask = {};
    (pays||[]).forEach(p=>{
      const tid = String((p && p.fromTaskId) || "");
      if(!tid) return;
      if(isExcludedStatus(p)) return;
      (byTask[tid] ||= []).push(p);
    });
  
    const cardStyle = "background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:18px;padding:14px;";
  
    const kpi = (icon, label, val)=>`
      <div style="${cardStyle}">
        <div style="font-size:13px;opacity:.75;">${icon} ${esc(label)}</div>
        <div style="font-size:22px;font-weight:950;margin-top:6px;">${val}</div>
      </div>
    `;
  
    const campRows = (tasksArr||[])
      .filter(t=>t && !t.closed)
      .map(t=>{
        const tid = String(t.id);
        const title = String(t.title || "Campaña");
        const type = String(t.type || "single");
        const months = Number(t.months || 1);
        const amount = Number(t.amount || 0);
        const meta = Number(t.goalTotal || 0);
  
        const ps = (byTask[tid] || []);
  
        const recaudado = ps
          .filter(x=>String(x.status||"")==="paid")
          .reduce((a,x)=>a+Number(x.amount||0),0);
  
        const pendienteMes = ps
          .filter(x=>String(x.status||"")!=="paid")
          .filter(x=>{
            const dym = String(x.dueDate||"").slice(0,7);
            const pym = String(x.period||"").slice(0,7);
            return (dym===ym)||(pym===ym);
          })
          .reduce((a,x)=>a+Number(x.amountRemaining||x.amount||0),0);
  
        // Objetivo (total curso):
        // - Si el usuario definió goalTotal/meta => lo respetamos como total de curso.
        // - Si no, lo calculamos como (monto por apoderado) x (participantes) x (cuotas si mensual)
        //   Esto evita el bug de ver 100% con 1 pago cuando hay 2 apoderados.
        let objetivo;
        if(meta>0){
          objetivo = meta;
        }else{
          const base = (type==="monthly" ? (amount*months) : amount);
          const mandatory = (t.mandatoryParticipation !== undefined) ? !!t.mandatoryParticipation : true;
          let n = 0;
  
          if(!mandatory){
            // voluntaria: contamos participantes reales (excluye opted_out)
            const s = new Set();
            for(const x of ps){
              if(!x) continue;
              if(isExcludedStatus(x)) continue;
              const k = String(x.apoderadoKey||x.apoderadoEmail||x.payerProfileId||x.profileId||x.userId||x.email||"").toLowerCase().trim();
              if(k) s.add(k);
            }
            n = s.size;
          }
          if(!n){
            // fallback: apoderados del curso (evita 0 / y cubre obligatorias)
            n = (typeof approvedCount==='function' ? approvedCount() : 0);
          }
          if(!n) n = 1;
          objetivo = base * n;
        }
        const p = pct(recaudado, objetivo);
  
        return `
          <div style="${cardStyle}">
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
              <div style="font-weight:950;">${esc(title)}</div>
              <div style="font-weight:950;">${p}%</div>
            </div>
  
            <div style="margin-top:8px;height:10px;background:#eef2ff;border-radius:999px;overflow:hidden;">
              <div style="height:100%;width:${p}%;background:#4f46e5;border-radius:999px;"></div>
            </div>
  
            <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;font-size:13px;opacity:.9;">
              <div>💰 Recaudado: <b>${clp(recaudado)}</b></div>
              <div>⏳ Pendiente mes: <b>${clp(pendienteMes)}</b></div>
              <div>🎯 Objetivo: <b>${clp(objetivo)}</b></div>
            </div>
          </div>
        `;
      }).join("");
  
    openModal(`
      <div style="max-width:900px;margin:auto;">
        <div style="
          background:#ffffff;
          border-radius:22px;
          border:1px solid rgba(0,0,0,.10);
          box-shadow:0 20px 60px rgba(0,0,0,.25);
          padding:0;
          overflow:hidden;
        ">
  
          <div style="
            position:sticky;
            top:0;
            z-index:20;
            background:#ffffff;
            padding:12px 16px;
            border-bottom:1px solid rgba(0,0,0,.08);
          ">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
              <div>
                <div style="font-weight:950;font-size:18px;line-height:1.1;">Informe del curso</div>
                <div style="opacity:.65;font-size:13px;margin-top:4px;line-height:1.2;">
                  Resumen de cómo va el curso (montos globales, no personales)
                </div>
              </div>
              <button onclick="closeModal()"
                style="
                  border:1px solid rgba(0,0,0,.12);
                  background:#fff;
                  border-radius:999px;
                  padding:8px 14px;
                  font-weight:800;
                  cursor:pointer;
                  flex:0 0 auto;
                ">
                Cerrar
              </button>
            </div>
          </div>
  
          <div style="padding:16px;">
  
            <div style="margin-top:2px;${cardStyle}background:#f8fafc;">
              <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
                <div>
                  <div style="font-weight:950;font-size:16px;">${sem} Cumplimiento del mes</div>
                  <div style="font-size:13px;opacity:.75;margin-top:2px;">${esc(semMsg)} · <b>${esc(ym)}</b></div>
                </div>
                <div style="font-weight:950;font-size:18px;">${cursoPct}%</div>
              </div>
  
              <div style="margin-top:10px;height:12px;background:#e5e7eb;border-radius:999px;overflow:hidden;">
                <div style="height:100%;width:${cursoPct}%;background:#16a34a;border-radius:999px;"></div>
              </div>
  
              <div style="margin-top:8px;font-size:13px;opacity:.9;">
                💵 Cobrado mes: <b>${clp(cobradoMes)}</b> · ⏳ Proyección mes: <b>${clp(proyeccionMes)}</b> · 👥 Deudores mes: <b>${deudoresSet.size}</b>
              </div>
            </div>
  
            <div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              ${kpi("💰","Recaudado total", clp(r.recaudadoCurso||0))}
              ${kpi("🧾","Gastado total", clp(r.gastadoCurso||0))}
              ${kpi("🏦","Saldo disponible", clp(r.disponibleCurso||0))}
              ${kpi("⏳","Por cobrar este mes", clp(proyeccionMes - cobradoMes))}
            </div>
  
            <div style="margin-top:16px;">
              <div style="font-weight:950;font-size:16px;margin-bottom:10px;">📌 Indicadores por campaña</div>
              <div style="display:grid;gap:10px;">
                ${campRows || `<div style="opacity:.7;font-size:13px;">No hay campañas activas.</div>`}
              </div>
            </div>
  
            <div class="muted" style="margin-top:14px;font-size:12px;">
              Emitido: ${esc(r.generatedAt||"")}
            </div>
  
          </div>
        </div>
      </div>
    `);
  };
const reports = () => load(KEY_MONTHLY_REPORTS, []);

  const activeTasks = () => tasks().filter(t => !t.closed && !isExpired(t));
  const expiredTasks = () => tasks().filter(t => !t.closed && isExpired(t));
  const closedTasks = () => tasks().filter(t => !!t.closed);
  const courseStudentTotal = () => {
    const c = (typeof activeCourse === "function" ? activeCourse() : null) || {};
    let cached = {};
    try{ cached = JSON.parse(localStorage.getItem("cursapp_course_v1") || "null") || {}; }catch(e){}
    const configured = Number(c.totalAlumnos ?? c.total_alumnos ?? cached.totalAlumnos ?? cached.total_alumnos ?? cached.course?.totalAlumnos ?? cached.course?.total_alumnos ?? 0) || 0;
    return Math.max(configured, approvedCount(), 0);
  };

  const collectedCourse = () => sum(payments().filter(isPaid), p => p.amount);
  const spentCourse = () => sum(expenses(), e => e.amount);
  const saldoCourse = () => collectedCourse() - spentCourse();

  const creditTotal = () => sum(payments().filter(isCredit), p => p.amount);
  // Pendiente financiero del curso: las campañas obligatorias se proyectan
  // contra el total oficial de alumnos, no sólo contra cobros materializados.
  const pendingTotal = () => sum(activeTasks(), t => pendingTaskEstimated(t));
  const deudoresCount = () => {
    const set = new Set();
    payments().filter(isPendingFinancialStatus).forEach(p=>{
      const k = String(p?.apoderadoKey || p?.apoderadoEmail || p?.email || p?.apoderadoId || "").toLowerCase().trim()
        || String(p?.alumnoId || "").trim();
      if(k) set.add(k);
    });
    return set.size;
  };


  // ---- Single source of truth financiero (campañas / dashboard / deudores) ----
  function isExcludedFinancialStatus(p){
    const st = String(p?.status || "").toLowerCase();
    return st === "opted_out" || st === "void" || st === "cancelled" || st === "credit_used";
  }

  function isPendingFinancialStatus(p){
    if(!p) return false;
    if(isExcludedFinancialStatus(p)) return false;
    return isPendingLike(p);
  }

  function campaignPayments(taskId){
    return payments().filter(p => String(p?.fromTaskId || "") === String(taskId || ""));
  }

  function campaignPendingPayments(taskId){
    return campaignPayments(taskId).filter(isPendingFinancialStatus);
  }

  function campaignPaidPayments(taskId){
    return campaignPayments(taskId).filter(p => !isExcludedFinancialStatus(p) && isPaid(p));
  }

  function campaignUniqueDebtors(taskId){
    const task = tasks().find(t=>String(t?.id||"")===String(taskId||""));
    const pendingKeys = new Set();
    campaignPendingPayments(taskId).forEach(p=>{
      const k = String(p?.miembroId || p?.memberId || p?.apoderadoKey || p?.apoderadoEmail || p?.email || p?.apoderadoId || p?.alumnoId || "").toLowerCase().trim();
      if(k) pendingKeys.add(k);
    });
    if(task && task.mandatoryParticipation !== false){
      const total = courseStudentTotal();
      const paidKeys = new Set(campaignPaidPayments(taskId).map(p=>
        String(p?.miembroId || p?.memberId || p?.apoderadoKey || p?.apoderadoEmail || p?.email || p?.apoderadoId || p?.alumnoId || "").toLowerCase().trim()
      ).filter(Boolean));
      return Math.max(0, total - paidKeys.size);
    }
    return pendingKeys.size;
  }

  function campaignPendingAmount(taskId){
    return sum(campaignPendingPayments(taskId), p => (p.amountRemaining ?? p.amount ?? 0));
  }

  function campaignPendingInstallments(taskId){
    return campaignPendingPayments(taskId).length;
  }

  // ---- curso / apoderados aprobados ----
  const KEY_ACTIVE_COURSE = "cursapp_active_course_v1";
  const KEY_ENROLL = "cursapp_enrollments_v1";

  function activeCourseKey(){
    try{
      const s = JSON.parse(localStorage.getItem("cursapp_session_v1") || "null") || {};
      return String(s.courseKey || "").trim();
    }catch(e){ return ""; }
  }
  function approvedApoderados(){
    const ck = activeCourseKey();
    try{
      const list = JSON.parse(localStorage.getItem(KEY_ENROLL) || "[]");
      return list.filter(e => (!ck || e.courseKey===ck) && e.status==="approved");
    }catch(e){
      return [];
    }
  }
  function approvedCount(){
    return approvedApoderados().length;
  }

  // ---- fechas / periodos ----
  function ymFromISO(iso){
    if(!iso) return "";
    const s = String(iso);
    if(s.length >= 7) return s.slice(0,7);
    return "";
  }
  function currentYYYYMM(){
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  }
  function endOfMonthDate(ym){
    const [y,m] = ym.split("-").map(x=>parseInt(x,10));
    if(!y || !m) return null;
    return new Date(y, m, 0); // last day of month
  }
  function withinMonth(iso, ym){
    return ymFromISO(iso) === ym;
  }

  // ---- KPIs mes ----
  function collectedMonth(ym){
    // prefer paidAt / paidDate if exists; fallback dueDate
    return sum(payments().filter(p=>{
      if(!isPaid(p)) return false;
      const dt = p.paidAt || p.paidDate || p.paid_on || "";
      return withinMonth(String(dt).slice(0,10), ym) || withinMonth(p.createdAt||"", ym);
    }), p=>p.amount);
  }

  function spentMonth(ym){
    return sum(expenses().filter(e=> withinMonth(e.date||"", ym)), e=>e.amount);
  }

  function pendingMonthReal(ym){
    return sum(payments().filter(p=>{
      if(!isPendingFinancialStatus(p)) return false;
      const due = p.dueDate || "";
      return withinMonth(due, ym);
    }), p => (p.amountRemaining ?? p.amount ?? 0));
  }


  // Deudores del mes (personas únicas con al menos 1 cuota/pago pendiente del mes)
  function deudoresMonth(ym){
    const mandatory = tasks().filter(t=>{
      if(t.closed || t.mandatoryParticipation === false) return false;
      const type = String(t.type||"single").toLowerCase();
      if(type==="monthly"){
        const startYM = ymFromISO(t.startDate||t.dueDate||"");
        if(!startYM) return false;
        const sy=Number(startYM.slice(0,4)), sm=Number(startYM.slice(5,7));
        const cy=Number(ym.slice(0,4)), cm=Number(ym.slice(5,7));
        const idx=(cy-sy)*12+(cm-sm)+1;
        return idx>=1 && idx<=Math.max(1,Number(t.months||1));
      }
      return ymFromISO(t.dueDate||"")===ym;
    });
    if(!mandatory.length) return 0;
    const paid = new Set();
    payments().forEach(p=>{
      const task = mandatory.find(t=>String(t.id)===String(p.fromTaskId));
      if(!task || !isPaid(p)) return;
      const period = String(p.period || p.dueDate || p.paidAt || p.paidDate || "").slice(0,7);
      if(period && period!==ym) return;
      const k=String(p?.miembroId || p?.memberId || p?.apoderadoKey || p?.apoderadoEmail || p?.email || p?.apoderadoId || p?.alumnoId || "").toLowerCase().trim();
      if(k) paid.add(k);
    });
    return Math.max(0, courseStudentTotal() - paid.size);
  }


  // Pendiente operacional del mes (dashboard):
  // - Usa proyección máxima del mes (campañas) menos lo recaudado.
  // - Evita depender de que los cobros existan ya en payments_v1.
  function pendingMonth(ym){
    const expected = pendingMonthProjected(ym);
    const collected = collectedMonth(ym);
    return Math.max(0, expected - collected);
  }

  // Proyección máxima (ajustada por opt-out si existe)
  function pendingMonthProjected(ym){
    const tks = tasks();
    let expected = 0;

    // monthly campaigns: contribute amount if month is within their schedule
    tks.forEach(t=>{
      if(t.closed) return;
      const type = String(t.type||"single").toLowerCase();
      const amt = Number(t.amount||0);
      const people = t.mandatoryParticipation === false ? approvedCount() : courseStudentTotal();

      if(type==="monthly"){
        // month range: from startDate month to start+months-1
        const startYM = ymFromISO(t.startDate||t.dueDate||"");
        if(!startYM) return;
        const months = Math.max(1, Number(t.months||1));

        // compute index of ym relative to startYM
        const sy = parseInt(startYM.slice(0,4),10), sm = parseInt(startYM.slice(5,7),10);
        const cy = parseInt(ym.slice(0,4),10), cm = parseInt(ym.slice(5,7),10);
        const idx = (cy - sy)*12 + (cm - sm) + 1; // 1-based
        if(idx < 1 || idx > months) return;

        expected += amt * people;

        // opt-out adjustment for non mandatory (if we have opted_out payments for this task+month)
        if(t.mandatoryParticipation === false){
          const opted = payments().filter(p=>{
            return p.fromTaskId===t.id && paymentStatusNorm(p)==="opted_out" && withinMonth(p.dueDate||p.period||"", ym);
          }).length;
          expected -= Math.min(opted, people) * amt;
        }
        return;
      }

      // single payment: only count if dueDate month equals ym
      const dueYM = ymFromISO(t.dueDate||"");
      if(dueYM && dueYM===ym){
        expected += amt * people;

        if(t.mandatoryParticipation === false){
          const opted = payments().filter(p=>{
            return p.fromTaskId===t.id && paymentStatusNorm(p)==="opted_out" && withinMonth(p.dueDate||p.period||"", ym);
          }).length;
          expected -= Math.min(opted, people) * amt;
        }
      }
    });

    return Math.max(0, expected);
  }

  function debtorsMonthCount(ym){
    // count unique apoderados with pending in month (if we have email); else count pending items
    const pend = payments().filter(p=>isPendingFinancialStatus(p) && withinMonth(p.dueDate||"", ym));
    const emails = new Set(pend.map(p=>p.apoderadoEmail||p.email||"").filter(Boolean));
    return emails.size ? emails.size : pend.length;
  }

  function collectedTask(id){
    return sum(payments().filter(p=>p.fromTaskId===id && isPaid(p)), p=>p.amount);
  }
  function pendingTask(id){
    // pendiente operacional (solo cobros instanciados)
    return sum(payments().filter(p=>String(p.fromTaskId||"")===String(id||"") && isPendingFinancialStatus(p)), p => (p.amountRemaining ?? p.amount ?? 0));
  }

  function expectedTaskTotal(t){
    if(!t) return 0;
    const monto = Number(t.amount||0);
    const people = t.mandatoryParticipation === false ? approvedCount() : courseStudentTotal();
    const type = String(t.type||"single").toLowerCase();
    const months = type==="monthly" ? Math.max(1, Number(t.months||1)) : 1;
    return monto * months * people;
  }

  function pendingTaskEstimated(t){
    const id = String(t?.id || "");
    const all = campaignPayments(id);
    const ps = campaignPendingPayments(id);

    // Regla de negocio: en campañas obligatorias el universo es el total
    // oficial del curso. Los cobros creados para usuarios registrados son sólo
    // el detalle operacional; nunca reducen la proyección por sí mismos.
    if(t?.mandatoryParticipation !== false){
      return Math.max(0, expectedTaskTotal(t) - collectedTask(id));
    }

    if(ps.length){
      return sum(ps, p => (p.amountRemaining ?? p.amount ?? 0));
    }

    // Si es campaña voluntaria y los cobros existentes están todos en opted_out/void/cancelled,
    // no hay pendiente real aunque exista objetivo teórico.
    if(t?.mandatoryParticipation === false && all.length){
      const hasOnlyOptedOut = all.every(p => {
        const st = String(p?.status || "").toLowerCase();
        return st === "opted_out" || st === "void" || st === "cancelled";
      });
      if(hasOnlyOptedOut) return 0;
    }

    const expected = expectedTaskTotal(t);
    const rec = collectedTask(id);
    return Math.max(0, expected - rec);
  }


  function deudoresTask(id){
  return campaignUniqueDebtors(id);
}

function cuotasPendientesTask(id){
  return campaignPendingInstallments(id);
}

  function spentTask(id){
    return sum(expenses().filter(e=>e.scope==="campaign" && e.campaignId===id), e=>e.amount);
  }

  function latestReport(){
    const r = reports();
    return r.length ? r[0] : null;
  }

  function openModal(html){
    modalRoot.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:10000;display:flex;align-items:flex-end;justify-content:center;padding:14px;">
        <div class="card" style="width:min(820px,100%);margin-bottom:12px;">
          ${html}
        </div>
      </div>
    `;
  }
  function closeModal(){ modalRoot.innerHTML=""; }
  window.closeModal = closeModal;

  window.openPresidentManualPayment = function(){
    const pending = payments().filter(p=>{
      const st=String(p?.status||p?.estado||'pending').toLowerCase();
      return ['pending','pendiente','partial','overdue'].includes(st) && p?.id;
    });
    const campaigns = normalizeTasks(tasks()).filter(t=>!t.closed);
    const options = pending.map(p=>{
      const camp=campaigns.find(t=>String(t.id)===String(p.fromTaskId||p.campaignId||''));
      const label=[camp?.title||p.concept||'Campaña',p.studentName||p.alumno||'Alumno',p.guardianName||p.apoderadoName||'Apoderado',Number(p.amount||0).toLocaleString('es-CL')].join(' · ');
      return `<option value="${esc(p.id)}">${esc(label)}</option>`;
    }).join('');
    openModal(`<div class="row"><div><div style="font-size:22px;font-weight:950">Registrar pago</div><div class="muted" style="margin-top:5px">Selecciona un cobro pendiente y registra el medio recibido.</div></div><button class="btnMini" onclick="closeModal()">Cerrar</button></div>
      ${pending.length?`<label style="display:block;margin-top:16px;font-weight:900">Apoderado, alumno y campaña<select id="pres_manual_payment" style="width:100%;margin-top:7px"><option value="">Seleccionar cobro pendiente</option>${options}</select></label>
      <label style="display:block;margin-top:12px;font-weight:900">Medio de pago<select id="pres_manual_method" style="width:100%;margin-top:7px"><option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option><option value="otro">Otro medio</option></select></label>
      <div class="actions" style="margin-top:18px;justify-content:flex-end"><button class="btnMini" onclick="closeModal()">Cancelar</button><button class="btnPrimaryMini" onclick="registerPresidentManualPayment()">Registrar pago</button></div>`:`<div class="empty" style="margin-top:16px"><b>No existen cobros pendientes para registrar.</b></div>`}`);
  };

  window.registerPresidentManualPayment = async function(){
    const id=String(document.getElementById('pres_manual_payment')?.value||'');
    const method=String(document.getElementById('pres_manual_method')?.value||'transferencia');
    const payment=payments().find(p=>String(p.id)===id);
    if(!payment) return alert('Selecciona un cobro pendiente.');
    const btn=modalRoot.querySelector('.btnPrimaryMini'); if(btn){btn.disabled=true;btn.textContent='Registrando...';}
    try{
      if(!window.CURSAPP_PAYMENTS_V11?.markPaid) throw new Error('El servicio de pagos no está disponible.');
      await window.CURSAPP_PAYMENTS_V11.markPaid(id,{amount:Number(payment.amount||0),method,conciliated:true});
      closeModal();
      openModal(`<div style="text-align:center;padding:10px"><div style="width:58px;height:58px;border-radius:50%;display:grid;place-items:center;background:#dcfce7;color:#15803d;font-size:30px;font-weight:950;margin:auto">✓</div><h2>Pago registrado</h2><p class="muted">Los indicadores del curso se actualizaron desde Supabase.</p><button class="btnPrimaryMini" onclick="closeModal()">Aceptar</button></div>`);
      try{window.dispatchEvent(new CustomEvent('cursapp:dataUpdated',{detail:{source:'presidente-pago-manual'}}));}catch(_){}
    }catch(err){ if(btn){btn.disabled=false;btn.textContent='Registrar pago';} alert('No se pudo registrar el pago: '+(err?.message||err)); }
  };

  // ----- menu -----
  function initMenu(){
    if(menuBtn && menuDropdown){
      window.CURSAPP_MENU_HANDLED = true;
      enhancePresidentMenu();
      menuBtn.setAttribute("aria-expanded", "false");
      menuBtn.onclick = (e)=>{
        e.preventDefault();
        e.stopPropagation();
        const open = menuDropdown.style.display === "block";
        menuDropdown.style.display = open ? "none" : "block";
        menuDropdown.classList.toggle("caMenuOpen", !open);
        menuBtn.setAttribute("aria-expanded", String(!open));
      };
      menuBtn.onpointerdown = e=>e.stopPropagation();
      if(!menuDropdown.__presidenteMenuCloseBound){
        menuDropdown.__presidenteMenuCloseBound = true;
        document.addEventListener("click", (ev)=>{
          const target = ev.target;
          if(target && (target === menuBtn || menuBtn.contains(target) || menuDropdown.contains(target))) return;
          window.__presMenuClose?.();
        }, true);
      }
    }
    if(resetBtn){
      resetBtn.onclick = ()=>{
        if(!confirm("Reset demo presidente. ¿Continuar?")) return;
        localStorage.removeItem(KEY_TASKS);
        localStorage.removeItem(KEY_PAYMENTS);
        localStorage.removeItem(KEY_EXPENSES);
        localStorage.removeItem(KEY_MONTHLY_REPORTS);
        localStorage.removeItem(KEY_DIRTY);
        alert("Datos reseteados.");
        // ✅ CAMBIO 2: NO re-sembrar demo automáticamente
        go("home");
      };
    }
    if(logoutBtn){
      // ✅ CAMBIO 3: logout al login real
      logoutBtn.onclick = ()=> location.href="/index.html";
    }
  }

  // ----- state -----
  let state = { tab:"home" };
  let campaignFilter = "active"; // active | expired | closed | all | deleted

  
  function normalizeTab(tab){
    const t = String(tab||"").toLowerCase().trim();
    // Compat: algunos builds usan 'informe' (singular) en el dataset del menú
    if(t === "informe" || t === "reportes" || t === "reporte") return "informes";
    if(t === "campaña" || t === "campana") return "campanas";
    return t;
  }

function setActive(tab){
    navItems.forEach(b=>b.classList.toggle("active", b.dataset.tab===tab));
  }

  function go(tab){
  try{ updatePresidentTopbar(); }catch(e){}
    const norm = normalizeTab(tab);
    state.tab = norm;
    setActive(norm);
    if(norm==="home") renderHome();
    if(norm==="campanas") renderCampanas();
    if(norm==="informes") renderInformes();
    if(norm==="deudores") renderDeudores();
  }
  window.go = go;
  window.__cursappPresidentGo = go;

  navItems.forEach(b=> b.onclick=()=> go(b.dataset.tab));

  // ---- Refresh UI when data changes (campaigns/payments) ----
  // campaigns.js emite este evento al crear/editar/cerrar campañas.
  const __refresh = (ev)=>{
    try{
      // V11.9: evitar re-render del Home por eventos no financieros.
      // El parpadeo del banner y el retorno del carrusel venían de renderHome()
      // disparado por localStorage/cursapp:dataChanged de módulos visuales.
      const key = String(ev && ev.detail && ev.detail.key || '');
      const source = String(ev && ev.detail && ev.detail.source || '').toLowerCase();
      const tab = (state && state.tab) ? state.tab : 'home';

      const allowedKeys = new Set([
        KEY_TASKS,
        KEY_PAYMENTS,
        KEY_EXPENSES,
        KEY_MONTHLY_REPORTS,
        KEY_ENROLLMENTS,
        KEY_ENROLL,
        ENROLL_KEY
      ].filter(Boolean));

      if(ev && ev.type === 'cursapp:dataChanged'){
        if(key && !allowedKeys.has(key)) return;
      }

      if(ev && ev.type === 'cursapp:dataUpdated'){
        if(source && (
          source.includes('banner') ||
          source.includes('monetization') ||
          source.includes('support') ||
          source.includes('tesorero')
        )) return;
      }

      // El Home se actualiza sólo para cambios operacionales reales.
      // Así campañas y avisos aparecen inmediatamente sin reaccionar a banners o soporte.
      if(tab==='home'){
        const kind = String(ev && ev.detail && ev.detail.kind || '').toLowerCase();
        const operational = allowedKeys.has(key) || ['tasks','payments','notices','avisos','campaign-created'].includes(kind);
        if(!operational) return;
        renderHome();
        return;
      }

      // materializa pagos faltantes solo si el evento afecta datos operacionales.
      ensurePaymentsForAllApproved();

      if(tab==='campanas') renderCampanas();
      else if(tab==='deudores'){
        if(window.__presDebtQueryActive || (document.activeElement && document.activeElement.id === "debtorQuery")) return;
        renderDeudores();
      }
      else if(tab==='informes') renderInformes();
    }catch(e){}
  };
  window.addEventListener('cursapp:dataChanged', __refresh);
  window.addEventListener('cursapp:dataUpdated', __refresh);

  
  // ----- Watcher: refrescar Campañas cuando cambian las tasks -----
  let __TASKS_SIG = "";
  function __tasksSig(){
    try{
      const raw = localStorage.getItem(KEY_TASKS) || "[]";
      let h=0; for(let i=0;i<raw.length;i++) h=(h*31 + raw.charCodeAt(i))>>>0;
      return String(h);
    }catch(e){ return ""; }
  }
// ----- UI pieces -----
  function statusPillForCampaign(t){
    if(String(t && (t.status || t.estado) || "").toLowerCase() === "eliminada") return `<span class="pill danger">Eliminada</span>`;
    if(t.closed){
      const pend = pendingTaskEstimated(t);
      if(pend > 0) return `<span class="pill warn">Cerrada · con pagos pendientes</span>`;
      return `<span class="pill">Cerrada</span>`;
    }
    if(isExpired(t)) return `<span class="pill danger">Caducada</span>`;
    return `<span class="pill ok">Activa</span>`;
  }

  function lineClassForCampaign(t){
    const pend = pendingTaskEstimated(t);
    const saldo = collectedTask(t.id) - spentTask(t.id);
    if(saldo < 0) return "isDanger";
    if(pend > 0 && t.closed) return "isWarn";
    if(isExpired(t)) return "isWarn";
    return "isOk";
  }

  // ---- Plantillas destacadas (estilo suave) ----
  let __tplStylesInjected = false;
  function templateKind(t){
    const k = String(t?.template || t?.templateKey || t?.templateId || "").toLowerCase();
    if(k.includes("gira")) return "gira";
    if(k.includes("gradu")) return "graduacion";
    const title = String(t?.title || t?.name || "").toLowerCase();
    if(title.includes("gira")) return "gira";
    if(title.includes("gradu")) return "graduacion";
    return "";
  }
  function templateClassForCampaign(t){
    const k = templateKind(t);
    return k ? `tplCamp tplCamp-${k}` : "";
  }
  function ensureTemplateStyles(){
    if(__tplStylesInjected) return;
    __tplStylesInjected = true;
    const css = `
      .campLine{ position:relative; overflow:hidden; padding-left:10px; border-radius:18px; }
      .campLine:before{ content:""; position:absolute; left:0; top:0; bottom:0; width:6px; border-radius:18px 0 0 18px; background: rgba(148,163,184,.55); }
      .tplCamp:before{ background: rgba(59,130,246,.65); }
      .tplCamp.tplCamp-graduacion:before{ background: rgba(139,92,246,.65); }
      .tplCamp{ background: rgba(59,130,246,.05); }
      .tplCamp.tplCamp-graduacion{ background: rgba(139,92,246,.05); }
    `;
    const style = document.createElement("style");
    style.setAttribute("data-cursapp-tpl","1");
    style.textContent = css;
    document.head.appendChild(style);
  }

  function campaignTypeLabel(t){
    const type = String(t.type||"single");
    if(type==="monthly"){
      const m = Number(t.months||1);
      return `Mensual · ${m} cuota(s)`;
    }
    return "Pago único";
  }

  // ----- Home -----
  function openAvisosConfigSafe(){
    try{
      if(typeof window.openAvisosCursoSendModal === "function") return window.openAvisosCursoSendModal();
      if(typeof window.openAvisosConfigReal === "function") return window.openAvisosConfigReal();
      if(typeof window.openAvisosConfig === "function" && window.openAvisosConfig !== openAvisosConfigSafe) return window.openAvisosConfig();
    }catch(e){}
    alert("El módulo de avisos no está disponible. Revisa assets/configavisos.js.");
  }
  window.openAvisosConfig = openAvisosConfigSafe;
  window.openAvisosConfigSafe = openAvisosConfigSafe;


  // Fix definitivo Avisos: delegación robusta para botones del home Presidente.
  function bindAvisosButtonFallback(){
    if(window.__cursappAvisosButtonFallbackBound) return;
    window.__cursappAvisosButtonFallbackBound = true;
    document.addEventListener("click", function(e){
      const btn = e.target && e.target.closest ? e.target.closest("button") : null;
      if(!btn) return;
      // No interceptar acciones internas de la modal de avisos.
      // Antes el listener capturaba "📢 Enviar aviso" y reabría la modal en vez de guardar.
      if(
        btn.id === "saveAvisoCursoBtn" ||
        btn.id === "cerrarAvisosConfig" ||
        btn.hasAttribute("data-del-aviso") ||
        btn.closest("#cursappAvisosConfigOverlay") ||
        btn.closest("#cursappAvisosInboxOverlay")
      ){
        return;
      }

      const txt = (btn.textContent || "").replace(/\s+/g," ").trim().toLowerCase();
      const isAvisosQuick = txt.includes("avisos") || txt.includes("📢") || txt.includes("✉");
      if(!isAvisosQuick) return;
      // Solo interceptar si es botón de la página Presidente y no es cerrar/eliminar.
      if(txt.includes("cerrar") || txt.includes("eliminar")) return;
      try{
        if(typeof window.openAvisosCursoSendModal === "function"){
          e.preventDefault(); e.stopPropagation();
          window.openAvisosCursoSendModal();
          return;
        }
        if(typeof window.openAvisosConfigSafe === "function"){
          e.preventDefault(); e.stopPropagation();
          window.openAvisosConfigSafe();
          return;
        }
      }catch(err){
        console.warn("Error abriendo avisos", err);
      }
    }, true);
  }
  bindAvisosButtonFallback();


  function bindPresidentHeroCarousel(){
    const track = document.querySelector(".cursapp-presidente .presHeroCarousel");
    if(!track || track.__cursappPresHeroBound) return;
    track.__cursappPresHeroBound = true;
    const hero = track.closest(".presMockHero");
    const dots = hero ? Array.from(hero.querySelectorAll(".presHeroDot")) : [];
    const slides = Array.from(track.querySelectorAll(".presHeroCampaign"));
    if(!slides.length) return;
    const update = ()=>{
      const center = track.scrollLeft + (track.clientWidth / 2);
      let active = 0;
      let best = Infinity;
      slides.forEach((slide, idx)=>{
        const slideCenter = slide.offsetLeft + (slide.offsetWidth / 2);
        const distance = Math.abs(slideCenter - center);
        if(distance < best){ best = distance; active = idx; }
      });
      dots.forEach((dot, idx)=>dot.classList.toggle("active", idx === active));
    };
    let timer = null;
    track.addEventListener("scroll", ()=>{
      clearTimeout(timer);
      timer = setTimeout(update, 60);
    }, { passive:true });
    track.addEventListener("touchend", ()=>setTimeout(update, 80), { passive:true });
    update();
  }

  function presSvgIcon(name, className){
    const base = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" focusable="false"';
    const icons = {
      flag: `<svg ${base} aria-hidden="true"><path d="M5 21V5"/><path d="M5 5c3-2 5 2 8 0 2-.9 3-.5 5 .5v9c-2-1-3-1.4-5-.5-3 2-5-2-8 0"/></svg>`,
      users: `<svg ${base} aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.86"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
      familyHome: `<svg ${base} aria-hidden="true"><path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10"/><circle cx="9" cy="14" r="1.7"/><circle cx="15" cy="14" r="1.7"/><path d="M7 19c.6-1.4 1.7-2.1 3-2.1"/><path d="M17 19c-.6-1.4-1.7-2.1-3-2.1"/></svg>`,
      school: `<svg ${base} aria-hidden="true"><path d="m22 10-10-5-10 5 10 5 10-5Z"/><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/><path d="M22 10v6"/></svg>`,
      fileText: `<svg ${base} aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h6"/></svg>`,
      home: `<svg ${base} aria-hidden="true"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>`,
      megaphone: `<svg ${base} aria-hidden="true"><path d="m3 11 18-5v12L3 13v-2Z"/><path d="M11 14v4a2 2 0 0 1-2 2H8l-2-6"/></svg>`,
      clock: `<svg ${base} aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
      plus: `<svg ${base} aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>`,
      creditCard: `<svg ${base} aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/><path d="M7 15h4"/></svg>`,
      barChart: `<svg ${base} aria-hidden="true"><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></svg>`,
      logOut: `<svg ${base} aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>`,
      messageCircle: `<svg ${base} aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 8.7 8.7 0 0 1-4-.9L3 20l1.1-4.3A8.5 8.5 0 1 1 21 11.5Z"/></svg>`,
      arrowRight: `<svg ${base} aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>`,
      x: `<svg ${base} aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`
    };
    return `<span class="${className || "presSvgIcon"}" aria-hidden="true">${icons[name] || ""}</span>`;
  }

  function presCleanText(value){
    return String(value ?? "")
      .replace(/á/g,"á").replace(/é/g,"é").replace(/í/g,"í").replace(/ó/g,"ó").replace(/ú/g,"ú")
      .replace(/Á/g,"Á").replace(/É/g,"É").replace(/Í/g,"Í").replace(/Ó/g,"Ó").replace(/Ú/g,"Ú")
      .replace(/ñ/g,"ñ").replace(/Ñ/g,"Ñ")
      .replace(/°/g,"°").replace(/°/g,"°").replace(/·/g,"·").replace(/→/g,"→")
      .replace(/—/g,"—").replace(/–/g,"–")
      .trim();
  }

  function presFirstText(){
    for(const value of arguments){
      const text = presCleanText(value);
      if(text) return text;
    }
    return "";
  }

  let presResolvedPresidentName = "";
  let presPresidentNameLookup = false;

  function presUsablePersonName(){
    for(const value of arguments){
      const text = presFirstText(value);
      if(!text || text.includes("@")) continue;
      const low = text.toLowerCase();
      if(low === "usuario" || low === "presidente") continue;
      return text;
    }
    return "";
  }

  function presLocalPresidentName(session, course, enrollments){
    const meta = session && (session.user_metadata || session.raw_user_meta_data || session.metadata || session.profile || session.user || {});
    const local = presUsablePersonName(
      meta && meta.full_name,
      meta && meta.name,
      session && session.full_name,
      session && session.fullName,
      session && session.name,
      session && session.nombre,
      session && session.displayName,
      course && course.presidentFullName,
      course && course.presidentName,
      course && course.presidenteNombre,
      course && course.nombrePresidente
    );
    if(local) return local;

    const ck = String(activeCourseKey() || "").trim();
    const email = String(session && session.email || "").toLowerCase().trim();
    try{
      const profiles = JSON.parse(localStorage.getItem("cursapp_profiles_v1") || "[]");
      const match = Array.isArray(profiles) ? profiles.find(p=>{
        const pEmail = String(p?.apoderado?.email || p?.email || p?.user?.email || "").toLowerCase().trim();
        const pRole = String(p?.role || p?.user?.role || "").toLowerCase().trim();
        return (!ck || String(p?.courseKey || "") === ck) && (pRole === "presidente" || p?.presidente === true || (!pRole && (!email || pEmail === email)));
      }) : null;
      const profileName = presUsablePersonName(
        match && match.full_name,
        match && match.fullName,
        match && match.name,
        match && match.nombre,
        match && match.user && match.user.full_name,
        match && match.user && match.user.name,
        match && match.apoderado && match.apoderado.nombre,
        match && match.apoderado && match.apoderado.name
      );
      if(profileName) return profileName;
    }catch(e){}

    const own = (enrollments || []).find(e => String(e.email || e.apoderadoEmail || "").toLowerCase().trim() === email) || (enrollments || [])[0] || {};
    return presUsablePersonName(own.full_name, own.fullName, own.nombre, own.name, own.nombre_apoderado, own.apoderadoNombre);
  }

  async function resolvePresidentNameFromSupabase(){
    if(presResolvedPresidentName || presPresidentNameLookup || typeof sb !== "function") return;
    presPresidentNameLookup = true;
    try{
      const session = readSession() || {};
      const c = (typeof activeCourse === "function" ? activeCourse() : null) || {};
      const email = String(session.email || session.user?.email || "").toLowerCase().trim();
      const userId = presFirstText(session.user_id, session.userId, session.uid, session.id, session.user && session.user.id);
      const cursoId = presFirstText(c.id, c.curso_id, c.courseId, c.course_id);
      const courseKey = presFirstText(activeCourseKey(), c.courseKey, c.course_key);
      const attempts = [];
      if(userId){
        attempts.push(`profiles?select=full_name,name&id=eq.${q(userId)}&limit=1`);
        attempts.push(`profiles?select=full_name,name&user_id=eq.${q(userId)}&limit=1`);
      }
      if(email) attempts.push(`profiles?select=full_name,name,email&email=eq.${q(email)}&limit=1`);
      if(cursoId) attempts.push(`miembros_curso?select=nombre_apoderado,nombre,full_name,name,rol,email&curso_id=eq.${q(cursoId)}&rol=eq.presidente&limit=1`);
      if(courseKey) attempts.push(`miembros_curso?select=nombre_apoderado,nombre,full_name,name,rol,email,course_key&course_key=eq.${q(courseKey)}&rol=eq.presidente&limit=1`);

      for(const path of attempts){
        try{
          const rows = await sb(path);
          const row = Array.isArray(rows) ? rows[0] : rows;
          const name = presUsablePersonName(row && row.full_name, row && row.name, row && row.nombre, row && row.nombre_apoderado);
          if(name){
            presResolvedPresidentName = name;
            const ctx = getPresidentVisualContext(approvedCount());
            updatePresidentHeader(ctx);
            document.querySelectorAll(".presMockWelcome h1").forEach(el=>{ el.textContent = ctx.name; });
            document.querySelectorAll(".presMockAvatar,.brand .logo").forEach(el=>{
              if(ctx.avatar) el.innerHTML = `<img src="${esc(ctx.avatar)}" alt="">`;
              else el.textContent = (ctx.name || "P").slice(0,1).toUpperCase();
            });
            if(menuDropdown && menuDropdown.classList.contains("caMenuOpen")) enhancePresidentMenu();
            break;
          }
        }catch(e){}
      }
    }catch(e){}
    presPresidentNameLookup = false;
  }

  function getPresidentVisualContext(apods){
    const c = (typeof activeCourse === "function" ? activeCourse() : null) || {};
    const session = readSession() || {};
    const enrollments = (typeof approvedApoderados === "function" ? approvedApoderados() : []) || [];
    const ownEnrollment = enrollments.find(e => String(e.email || "").toLowerCase() === String(session.email || "").toLowerCase()) || enrollments[0] || {};
    const school = presFirstText(c.schoolName, c.school, c.colegio) || "Colegio no informado";
    const level = presFirstText(c.level, c.curso, c.course);
    const letter = presFirstText(c.letter);
    const cursoShort = (`${level}${letter ? letter : ""}`.replace(/\s+/g,"").trim()) || "Curso no informado";
    const curso = cursoShort;
    const name = presResolvedPresidentName || presLocalPresidentName(session, c, enrollments) || "Presidente del curso";
    const student = presFirstText(
      session.alumno,
      session.studentName,
      session.nombreAlumno,
      session.nombre_alumno,
      ownEnrollment.alumno,
      ownEnrollment.nombre_alumno,
      ownEnrollment.studentName
    ) || "N/A";
    return {
      name,
      school,
      curso,
      cursoShort,
      student,
      avatar: session.avatar || session.avatarUrl || session.photoURL || session.foto || "",
      apoderado: apods === 1 ? "1 familia" : `${apods} familias`
    };
  }

  function updatePresidentHeader(ctx){
    const brand = document.querySelector("header .brand");
    if(!brand || !ctx) return;
    const logo = brand.querySelector(".logo");
    if(logo){
      if(ctx.avatar){
        logo.innerHTML = `<img src="${esc(ctx.avatar)}" alt="">`;
      }else{
        logo.textContent = (ctx.name || "U").slice(0,1).toUpperCase();
      }
    }
    const textBox = brand.querySelector(":scope > div:last-child");
    if(textBox){
      textBox.innerHTML = `
        <div class="presBrandName">${esc(ctx.name)}</div>
        <div class="muted presBrandRole">Presidente</div>
        <div class="muted presBrandCourse">${esc(ctx.school)} · ${esc(ctx.cursoShort)}</div>
      `;
    }
  }

  function enhancePresidentMenu(){
    if(!menuDropdown) return;
    const closeMenu = function(){
      menuDropdown.style.display = "none";
      menuDropdown.classList.remove("caMenuOpen");
      menuBtn?.setAttribute("aria-expanded", "false");
    };
    window.__presMenuGo = function(tab){
      closeMenu();
      if(tab === "apoderados") location.href = "/apoderados.html";
      else if(typeof window.go === "function") window.go(tab);
    };
    window.__presMenuClose = closeMenu;
    window.__presMenuLogout = async function(){
      let auth = {};
      try{ auth = JSON.parse(localStorage.getItem("cursapp_supabase_auth_session_v1") || "{}") || {}; }catch(_e){}
      if(auth.access_token){
        try{
          await Promise.race([
            fetch(SB_URL + "/auth/v1/logout", {
              method:"POST",
              keepalive:true,
              headers:{
                apikey:SB_KEY,
                Authorization:`Bearer ${auth.access_token}`
              }
            }),
            new Promise(resolve=>setTimeout(resolve, 900))
          ]);
        }catch(_e){}
      }
      [
        "cursapp_session_v1","cursapp_demo_user","cursapp_active_profile_v1",
        "cursapp_active_role_v1","cursapp_active_enrollment_v1","cursapp_active_miembro_id_v1",
        "cursapp_supabase_auth_session_v1","cursapp_supabase_oauth_v1"
      ].forEach(key=>{ try{ localStorage.removeItem(key); }catch(_e){} });
      location.replace("/login.html");
    };
    window.__presMenuSupport = function(){
      closeMenu();
      if(window.CURSAPP_SUPPORT && typeof window.CURSAPP_SUPPORT.openMyTickets === "function"){
        window.CURSAPP_SUPPORT.openMyTickets();
        return;
      }
      if(typeof window.openHelp === "function") window.openHelp("soporte");
    };
    menuDropdown.classList.add("presMenuPanel");
    menuDropdown.dataset.presidentMenuVersion = "36";
    menuDropdown.innerHTML = `
      <button class="menuItem" type="button" data-go="home">${presSvgIcon("home","presMenuGlyph")}<span>Inicio</span></button>
      <button class="menuItem" type="button" data-go="campanas">${presSvgIcon("megaphone","presMenuGlyph")}<span>Campañas</span></button>
      <button class="menuItem" type="button" data-go="deudores">${presSvgIcon("clock","presMenuGlyph")}<span>Deudores</span></button>
      <button class="menuItem" type="button" data-go="informes">${presSvgIcon("barChart","presMenuGlyph")}<span>Informes</span></button>
      <button class="menuItem" type="button" data-go="apoderados">${presSvgIcon("users","presMenuGlyph")}<span>Apoderados</span></button>
      <button class="menuItem" id="supportMenuItem" type="button" data-action="support">${presSvgIcon("messageCircle","presMenuGlyph")}<span>Soporte / Mis tickets</span></button>
      <button class="menuItem presMenuLogoutV36" type="button" data-action="logout">${presSvgIcon("logOut","presMenuGlyph")}<span>Cerrar sesión</span></button>
    `;
    if(!menuDropdown.__presidenteStableActionsBound){
      menuDropdown.__presidenteStableActionsBound = true;
      menuDropdown.addEventListener("click", function(e){
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const item = e.target.closest("button");
        if(!item) return;
        if(item.dataset.action === "support") return window.__presMenuSupport();
        if(item.dataset.action === "logout") return window.__presMenuLogout();
        if(item.dataset.go) return window.__presMenuGo(item.dataset.go);
      }, true);
      menuDropdown.addEventListener("pointerdown", e=>e.stopPropagation(), true);
    }
  }


function renderHome(){
    const ym = currentYYYYMM();
    const recMes = collectedMonth(ym);
    const recTot = collectedCourse();
    const gasMes = spentMonth(ym);
    const gasTot = spentCourse();
    const sal = saldoCourse();
    const pendMes = pendingMonth(ym);
    const pendProjMes = pendingMonthProjected(ym);
    const debtorsMes = pendMes > 0 ? deudoresMonth(ym) : 0;
    const credit = creditTotal();
    const apods = approvedCount();
    const last = latestReport();
    const active = activeTasks();
    const dirty = isDirty();

    const heroAlerts = [];
    if(pendMes > 0) heroAlerts.push(`${clp(pendMes)} por cobrar este mes`);
    if(debtorsMes > 0) heroAlerts.push(`${debtorsMes} deudor(es) mes`);
    if(dirty) heroAlerts.push(`informe desactualizado`);

    const campaignSlides = active.slice(0,5).map((t,i)=>{
      const rec = collectedTask(t.id);
      const pend = pendingTaskEstimated(t);
      const pct = Math.max(0, Math.min(100, Math.round((rec / Math.max(1, rec + pend)) * 100)));
      return `
        <article class="cpV6HeroCard">
          <div class="cpV6HeroIndex">${i+1} de ${Math.max(1, active.length)}</div>
          <div class="cpV6HeroTitle">${esc(t.title||"Campaña")}</div>
          <div class="cpV6HeroMeta">${esc(campaignTypeLabel(t))} · vence ${esc(t.dueDate||"—")}</div>
          <div class="cpV6HeroAmount">${clp(pend)}</div>
          <div class="cpV6Progress"><span style="width:${pct}%"></span></div>
          <div class="cpV6HeroActions"><button class="cpV6PrimaryBtn" onclick="window.go('campanas')">Ver campaña</button><button class="cpV6LinkBtn" onclick="window.go('deudores')">Deudores ›</button></div>
        </article>`;
    }).join("") || `<article class="cpV6HeroCard"><div class="cpV6HeroTitle">Sin campañas activas</div><div class="cpV6HeroMeta">Crea una campaña para iniciar cobros del curso.</div><div class="cpV6HeroAmount">${clp(0)}</div><div class="cpV6HeroActions"><button class="cpV6PrimaryBtn" onclick="openCreateCampaign()">Crear campaña</button></div></article>`;

    app.innerHTML = `
      <div class="cpV6Page cpV6President">
        <section class="cpV6Welcome"><div class="cpV6Avatar">P</div><div class="cpV6WelcomeText"><div class="cpV6Hello">Hola, Presidente 👋</div><div class="cpV6Sub">Gestión ejecutiva del curso</div><div class="cpV6Sub small">Periodo ${esc(ym)} · ${apods} apoderado(s)</div></div><button class="cpV6IconBtn" onclick="window.openAvisosConfigSafe()">✉ï¸</button></section>
        <section class="cpV6Hero"><div class="cpV6HeroHead"><span class="cpV6HeroIcon">📊</span><span>DASHBOARD EJECUTIVO</span></div><div class="cpV6HeroTrack">${campaignSlides}</div><div class="cpV6Dots"><span class="active"></span><span></span><span></span></div></section>
        ${heroAlerts.length ? `<div class="cpV6Notice"><b>Resumen rápido</b><span>${esc(heroAlerts.join(" · "))}</span></div>` : ``}
        <div class="cpV6KpiGrid"><div class="cpV6Kpi"><span>💰</span><small>Cobrado mes</small><b>${clp(recMes)}</b></div><div class="cpV6Kpi"><span>⏳</span><small>Por cobrar</small><b>${clp(pendMes)}</b></div><div class="cpV6Kpi"><span>👥</span><small>Deudores</small><b>${debtorsMes}</b></div><div class="cpV6Kpi"><span>🏦</span><small>Saldo</small><b>${clp(sal)}</b></div></div>
        <details class="cpV6Section" open><summary><span><i>📌</i><b>Campañas activas</b><em>${active.length} en gestión</em></span><strong>${active.length}</strong><u>⌄</u></summary><div class="cpV6SectionBody">${active.slice(0,4).map(t=>`<div class="cpV6ListItem"><div><b>${esc(t.title||"Campaña")}</b><small>${esc(campaignTypeLabel(t))} · ${esc(t.dueDate||"sin fecha")}</small></div><strong>${clp(pendingTaskEstimated(t))}</strong></div>`).join("") || `<div class="muted">Sin campañas activas.</div>`}<button class="cpV6SoftBtn" onclick="window.go('campanas')">Ver todas las campañas</button></div></details>
        <details class="cpV6Section"><summary><span><i>🧾</i><b>Deudores</b><em>Personas con cuotas pendientes</em></span><strong>${debtorsMes}</strong><u>⌄</u></summary><div class="cpV6SectionBody"><div class="cpV6ListItem"><div><b>Pendiente del mes</b><small>Proyección máxima: ${clp(pendProjMes)}</small></div><strong>${clp(pendMes)}</strong></div><button class="cpV6SoftBtn" onclick="window.go('deudores')">Ver deudores</button></div></details>
        <details class="cpV6Section"><summary><span><i>📄</i><b>Informes</b><em>${last ? 'Último publicado disponible' : 'Sin informes publicados'}</em></span><strong>${dirty ? 'Actualizar' : 'Ver'}</strong><u>⌄</u></summary><div class="cpV6SectionBody">${last ? `<div class="cpV6ListItem"><div><b>Periodo ${esc(last.period)}</b><small>Emitido ${esc(last.generatedAtHuman||last.generatedAt||"")}</small></div><button class="cpV6MiniBtn" onclick="window.go('informes')">Ver</button></div>` : `<div class="muted">Aún no hay informes publicados.</div>`}<button class="cpV6SoftBtn" onclick="confirmGenerateReport()">${dirty ? 'Actualizar y publicar' : 'Publicar informe'}</button></div></details>
        <div class="cpV6QuickTitle">Accesos rápidos</div><div class="cpV6QuickGrid"><button onclick="openCreateCampaign()"><span>➕</span>Crear campaña</button><button onclick="window.go('campanas')"><span>📌</span>Campañas</button><button onclick="window.go('deudores')"><span>🧾</span>Deudores</button><button onclick="window.openAvisosConfigSafe()"><span>📢</span>Avisos</button></div>
        <div data-monetization-slot="presidente"></div>
      </div>`;
    try{ if(window.CursappPresidentStable) window.CursappPresidentStable.injectStableCss(); }catch(e){}
    try{
      // V11.9: render del banner una sola vez por ciclo de Home.
      // No se vuelve a llamar en cada scroll/evento para evitar parpadeo.
      if(window.CursappMonetization && typeof window.CursappMonetization.render === 'function'){
        const slot = document.querySelector('[data-monetization-slot="presidente"]');
        if(slot && !slot.getAttribute('data-cursapp-banner-rendered')){
          slot.setAttribute('data-cursapp-banner-rendered','1');
          setTimeout(()=>{
            try{
              if(!slot.childElementCount) window.CursappMonetization.render();
            }catch(_e){}
          }, 250);
        }
      }
    }catch(e){}
  }

  // ----- Presidente Home mockup visual override -----
  renderHome = function(){
    const ym = currentYYYYMM();
    const recMes = collectedMonth(ym);
    const recTot = collectedCourse();
    const gasTot = spentCourse();
    const sal = saldoCourse();
    const pendMes = pendingMonth(ym);
    const pendProjMes = pendingMonthProjected(ym);
    const debtorsMes = pendMes > 0 ? deudoresMonth(ym) : 0;
    const apods = approvedCount();
    const studentTotal = courseStudentTotal();
    const active = activeTasks();
    const dirty = isDirty();
    const hasCampaigns = active.length > 0;
    const campaignHeroItems = active.slice()
      .map(t=>{
        const rec = collectedTask(t.id);
        const pend = pendingTaskEstimated(t);
        const expected = Math.max(1, Number(expectedTaskTotal(t)||0), rec + pend);
        const pct = Math.max(0, Math.min(100, Math.round((rec / expected) * 100)));
        const paidRows = campaignPaidPayments(t.id);
        const paidKeys = new Set(paidRows.map(p=>String(p.apoderadoEmail || p.email || p.apoderadoId || p.userId || p.payerId || "").toLowerCase()).filter(Boolean));
        const paidFamilies = paidKeys.size || Math.min(studentTotal, Math.round((pct / 100) * studentTotal));
        const dueTime = t.dueDate ? new Date(t.dueDate + "T23:59:59").getTime() : Number.MAX_SAFE_INTEGER;
        return { t, rec, pend, expected, pct, paidFamilies, dueTime: Number.isFinite(dueTime) ? dueTime : Number.MAX_SAFE_INTEGER };
      })
      .sort((a,b)=> (b.pend - a.pend) || (a.dueTime - b.dueTime));
    const campaignHeroSlides = campaignHeroItems.map((item,idx)=>`
      <article class="presHeroCampaign" style="--pct:${item.pct}">
        <div class="presHeroCampaignCopy">
          <span class="presHeroLabel">${presSvgIcon("flag","presHeroBadgeIcon")}Campaña destacada</span>
          <h3>${esc(presCleanText(item.t.title || "Campaña"))}</h3>
          <div class="presHeroMetrics">
            <div><small>Meta</small><b>${clp(item.expected)}</b></div>
            <div><small>Recaudado</small><b>${clp(item.rec)}</b></div>
          </div>
          <p class="presHeroFamilies">${presSvgIcon("familyHome","presHeroFamiliesIcon")}${item.paidFamilies} de ${studentTotal} alumnos con pago</p>
          <button type="button" onclick="window.go('campanas')">Ver campaña ${presSvgIcon("arrowRight","presBtnArrow")}</button>
        </div>
        <div class="presHeroRing" aria-label="${item.pct}% del objetivo">${presSvgIcon("flag","presHeroRingFlag")}<b>${item.pct}%</b><small>del objetivo</small></div>
        <div class="presHeroIndex">${esc(presCleanText(item.t.title || "Campaña"))} · ${idx + 1} de ${campaignHeroItems.length}</div>
      </article>
    `).join("");

    const goalFromCampaigns = active.reduce((total,t)=>{
      const expected = (typeof expectedTaskTotal === "function") ? Number(expectedTaskTotal(t)||0) : 0;
      return total + (expected || Number(collectedTask(t.id)||0) + Number(pendingTaskEstimated(t)||0));
    },0);
    const goalTotal = Math.max(goalFromCampaigns, recTot + pendMes + gasTot, recTot, 0);
    const progressPct = goalTotal > 0 ? Math.max(0, Math.min(100, Math.round((recTot / goalTotal) * 100))) : 0;
    const kpiCards = [
      { icon:"$", tone:"green", label:"Cobrado", value:clp(recMes), sub:"Este mes" },
      { icon:"!", tone:"orange", label:"Por cobrar", value:clp(pendMes), sub:"Pendiente" },
      { icon:"F", tone:"blue", label:"Familias pendientes", value:String(debtorsMes), sub:`De ${studentTotal} alumnos del curso` },
      { icon:"B", tone:"purple", label:"Saldo disponible", value:clp(sal), sub:"En arcas" }
    ].map(k=>`
      <article class="presMockKpi presMockTone-${k.tone}">
        <span>${esc(k.icon)}</span>
        <small>${esc(k.label)}</small>
        <b>${esc(k.value)}</b>
        <em>${esc(k.sub)}</em>
        <i></i>
      </article>
    `).join("");

    const quickActions = [
      { label:"Crear campaña", icon:"plus", tone:"violet", action:"openCreateCampaign()" },
      { label:"Enviar aviso", icon:"megaphone", tone:"cyan", action:"window.openAvisosConfigSafe()" },
      { label:"Apoderados", icon:"users", tone:"emerald", action:"window.location.href='apoderados.html'" },
      { label:"Informe ejecutivo", icon:"barChart", tone:"amber", action:"window.go('informes')" },
      { label:"Registrar pago", icon:"creditCard", tone:"rose", action:"window.openPresidentManualPayment()" },
      { label:"Ver deudores", icon:"clock", tone:"indigo", action:"window.go('deudores')" }
    ].map(a=>`
      <button class="presMockQuick presMockQuick-${a.tone}" type="button" onclick="${a.action}">
        ${presSvgIcon(a.icon,"presMockQuickIcon")}
        <b>${esc(a.label)}</b>
      </button>
    `).join("");

    const campaignCards = active.slice(0,3).map((t,idx)=>{
      const rec = collectedTask(t.id);
      const pend = pendingTaskEstimated(t);
      const expected = Math.max(1, rec + pend);
      const pct = Math.max(0, Math.min(100, Math.round((rec / expected) * 100)));
      const icons = ["B","M","R"];
      return `
        <article class="presMockCampaign">
          <div class="presMockCampaignIcon">${icons[idx] || "C"}</div>
          <div class="presMockCampaignTop">
            <h3>${esc(t.title || "Campana")}</h3>
            <button type="button" aria-label="Mas opciones">...</button>
          </div>
          <p>${pct}% del objetivo</p>
          <strong>${clp(rec)}</strong>
          <small>de ${clp(expected)}</small>
          <div class="presMockBar"><span style="width:${pct}%"></span></div>
          <footer><span>${apods} familias</span><span>Vence ${esc(t.dueDate || "sin fecha")}</span></footer>
        </article>
      `;
    }).join("") || `
      <article class="presMockEmpty">
        <strong>Todavia no hay campanas activas</strong>
        <p>Crea una campana para iniciar cobros del curso.</p>
        <button type="button" onclick="openCreateCampaign()">Crear campana</button>
      </article>
    `;

    const notices = noticesFromSupabase().slice(0, 4).map(n=>{
      const priority = String(n.priority || "normal").toLowerCase();
      const tag = priority === "alta" || priority === "urgente" ? "Importante" : "Aviso";
      const when = n.createdAt ? new Date(n.createdAt).toLocaleDateString("es-CL", {day:"2-digit", month:"short"}) : "";
      const readCount = Math.max(0, Number(n.readCount || n.read_count || 0));
      const audience = Math.max(0, Number(n.audienceCount || n.audience_count || courseStudentTotal()));
      return `
        <article class="presMockNotice">
          <span>A</span>
          <div>
            <h3>${esc(n.title || "Aviso del curso")} <em>${esc(tag)}</em></h3>
            <p>${esc(n.message || "Sin detalle adicional.")}</p>
            <small>${readCount} de ${audience} apoderados lo han visto</small>
          </div>
          <time>${esc(when)}</time>
        </article>
      `;
    }).join("") || `
      <article class="presMockEmpty presMockEmptyNotices">
        <strong>No existen avisos importantes</strong>
        <p>Cuando se publique un aviso para el curso aparecerá aquí.</p>
      </article>
    `;
    const visualContext = getPresidentVisualContext(apods);
    updatePresidentHeader(visualContext);
    resolvePresidentNameFromSupabase();
    const homeAvatar = visualContext.avatar
      ? `<img src="${esc(visualContext.avatar)}" alt="">`
      : esc((visualContext.name || "U").slice(0,1).toUpperCase());
    const summaryTable = `
      <section class="presInfoTable" aria-label="Datos principales del curso">
        <article>
          ${presSvgIcon("users","presInfoIcon presInfoPeople")}
          <small>Alumno/a</small>
          <strong>${esc(visualContext.student)}</strong>
        </article>
        <article>
          ${presSvgIcon("school","presInfoIcon presInfoSchool")}
          <small>Colegio</small>
          <strong>${esc(visualContext.school)}</strong>
        </article>
        <article>
          ${presSvgIcon("fileText","presInfoIcon presInfoCourse")}
          <small>Curso</small>
          <strong>${esc(visualContext.cursoShort)}</strong>
        </article>
      </section>
    `;

    app.innerHTML = `
      <div class="presMockPage">
        <section class="presMockWelcome">
          <div class="presMockAvatar">${homeAvatar}</div>
          <div>
            <h1>${esc(visualContext.name)}</h1>
            <p>Presidente<br>${esc(visualContext.school)} · ${esc(visualContext.cursoShort)}</p>
          </div>
        </section>

        <div class="presMockUpdated">Última actualización: Hoy 09:35</div>

        ${summaryTable}

        <section class="presMockHero ${hasCampaigns ? "is-filled is-campaign" : "is-empty"}">
          ${hasCampaigns ? `
            <div class="presHeroCarousel" aria-label="Campañas destacadas">
              ${campaignHeroSlides}
            </div>
            <div class="presHeroDots" aria-hidden="true">
              ${campaignHeroItems.map((_,idx)=>`<span class="presHeroDot ${idx === 0 ? "active" : ""}"></span>`).join("")}
            </div>
          ` : `
            <div class="presMockHeroEmpty">
              <span class="presMockHeroEmptyIcon">${presSvgIcon("barChart","presMockHeroEmptySvg")}</span>
              <div>
                <h2>Dashboard ejecutivo</h2>
                <p>No existen campañas activas. Crea la primera para comenzar a visualizar el resumen financiero.</p>
              </div>
              <button type="button" onclick="openCreateCampaign()">Crear primera campaña ${presSvgIcon("arrowRight","presBtnArrow")}</button>
            </div>
          `}
        </section>

        <section class="presMockKpis">${kpiCards}</section>

        <section class="presMockSection">
          <header><h2>Accesos rapidos</h2><button type="button">Personalizar</button></header>
          <div class="presMockQuickGrid">${quickActions}</div>
        </section>

        <section class="presMockSection">
          <header><h2>Campanas activas (${active.length})</h2><button type="button" onclick="window.go('campanas')">Ver todas</button></header>
          <div class="presMockCampaignGrid">${campaignCards}</div>
        </section>

        <section class="presMockSection">
          <header><h2>Avisos importantes</h2><button type="button" onclick="window.openAvisosConfigSafe()">Ver todas</button></header>
          <div class="presMockNoticeList">${notices}</div>
        </section>

        <div data-monetization-slot="presidente"></div>
      </div>`;

    try{ if(window.CursappPresidentStable) window.CursappPresidentStable.injectStableCss(); }catch(e){}
    try{ bindPresidentHeroCarousel(); }catch(e){}
    try{
      if(window.CursappMonetization && typeof window.CursappMonetization.render === 'function'){
        const slot = document.querySelector('[data-monetization-slot="presidente"]');
        if(slot && !slot.getAttribute('data-cursapp-banner-rendered')){
          slot.setAttribute('data-cursapp-banner-rendered','1');
          setTimeout(()=>{ try{ if(!slot.childElementCount) window.CursappMonetization.render(); }catch(_e){} }, 250);
        }
      }
    }catch(e){}
  };

  // ----- Campaigns ----// ----- Campaigns -----
  function setFilter(f){
    campaignFilter = f;
    __TASKS_SIG = __tasksSig();
    renderCampanas();
    requestAnimationFrame(()=>{
      const active = document.querySelector('.presCampaignFilters .chip.active');
      try{ active?.scrollIntoView({block:'nearest', inline:'center', behavior:'smooth'}); }catch(_e){}
      try{ active?.focus({preventScroll:true}); }catch(_e){}
    });
  }
  window.setFilter = setFilter;

  function getFilteredCampaigns(){
    if(campaignFilter==="active") return activeTasks();
    if(campaignFilter==="expired") return expiredTasks();
    if(campaignFilter==="closed") return closedTasks();
    if(campaignFilter==="deleted") return deletedTasks();
    return tasks();
  }

  // ---- Cotizaciones visibles (Plantilla Gira) ----
  function normCotizaciones(t){
    const arr = Array.isArray(t?.cotizaciones) ? t.cotizaciones : [];
    const one = t?.cotizacion && (t.cotizacion.texto || t.cotizacion.link || t.cotizacion.nombre || t.cotizacion.monto_total || t.cotizacion.descripcion)
      ? [t.cotizacion]
      : [];
    const merged = [...arr, ...one]
      .map(c=>({
        nombre: String(c?.nombre || c?.title || c?.name || "").trim(),
        url: String(c?.url || c?.link || "").trim(),
        monto_total: Number(c?.monto_total ?? c?.monto ?? c?.total ?? 0),
        descripcion: String(c?.descripcion || c?.texto || c?.description || "").trim()
      }))
      .filter(c=>c.nombre || c.url || c.monto_total || c.descripcion);

    // Dedupe (cuando viene tanto cotizacion como cotizaciones[])
    const seen = new Set();
    const out = [];
    for(const c of merged){
      const key = [c.nombre.toLowerCase(), c.url.toLowerCase(), String(c.monto_total||0), c.descripcion.toLowerCase()].join("|");
      if(seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
    return out;
  }

  function renderCotizacionesInfo(t){
    const kind = String(t?.template||"");
    if(!["gira","graduacion"].includes(kind)) return "";
    const cotz = normCotizaciones(t);
    if(!cotz.length) return "";
    const total = cotz.reduce((s,c)=>s + (Number(c.monto_total)||0), 0);
    const first = cotz.slice(0,2);

    return `
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(17,24,39,.08);">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
          <div>
            <div style="font-weight:950;">Información</div>
            <div class="muted" style="margin-top:4px;">Cotizaciones · ${cotz.length} ítem(s)${total?` · Total ${clp(total)}`:""}</div>
          </div>
          <button class="btnx" onclick="Campaigns.openQuotesDetailById('${esc(t.id)}')">Ver detalle</button>
        </div>
        <div class="muted" style="margin-top:10px;display:grid;gap:6px;">
          ${first.map(c=>`<div>• ${esc(c.nombre || "Cotización")} ${c.monto_total?`· <b>${clp(c.monto_total)}</b>`:""}${c.descripcion?` · ${esc(c.descripcion)}`:""}</div>`).join("")}
          ${cotz.length>2 ? `<div>… y ${cotz.length-2} más</div>` : ``}
        </div>
      </div>
    `;
  }

  function renderCampanas(){
    ensureTemplateStyles();
    const filtered = getFilteredCampaigns();

    const chips = `
      <div class="chips presCampaignFilters" aria-label="Filtros de campanas">
        <button class="chip ${campaignFilter==="active"?"active":""}" onclick="setFilter('active')">Activas</button>
        <button class="chip ${campaignFilter==="closed"?"active":""}" onclick="setFilter('closed')">Cerradas</button>
        <button class="chip ${campaignFilter==="all"?"active":""}" onclick="setFilter('all')">Todas</button>
        <button class="chip ${campaignFilter==="expired"?"active":""}" onclick="setFilter('expired')">Caducadas</button>
        <button class="chip ${campaignFilter==="deleted"?"active":""}" onclick="setFilter('deleted')">Eliminadas</button>
      </div>
    `;

    const fmtCampDate = (value)=>{
      const raw = String(value || "").slice(0,10);
      if(!raw) return "";
      const parts = raw.split("-");
      if(parts.length !== 3) return raw;
      const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
      const m = Math.max(0, Math.min(11, Number(parts[1] || 1) - 1));
      return `${parts[2]} ${months[m]} ${parts[0]}`;
    };

    const list = filtered.map(t=>{
      const isDeletedCampaign = String(t && (t.status || t.estado) || "").toLowerCase() === "eliminada";
      const rec = isDeletedCampaign ? 0 : collectedTask(t.id);
      const gas = isDeletedCampaign ? 0 : spentTask(t.id);
      const saldo = rec - gas;
      const pend = pendingTaskEstimated(t);
      const debtors = deudoresTask(t.id);
      const cuotasPendientes = cuotasPendientesTask(t.id);
      const monto = Number(t.amount||0);
      const tipo = presCleanText(campaignTypeLabel(t));
      const part = (t.mandatoryParticipation === false) ? "No obligatoria" : "Obligatoria";
      const meta = (t.goalTotal != null && Number(t.goalTotal)>0) ? Number(t.goalTotal) : 0;
      const expected = Math.max(1, meta, rec + pend, monto);
      const pct = Math.max(0, Math.min(100, Math.round((rec / expected) * 100)));
      const dateLine = [fmtCampDate(t.startDate), fmtCampDate(t.dueDate)].filter(Boolean).join(" — ");
      const chipsInfo = [
        `<span class="presCampaignMiniChip"><b>${clp(monto)}</b></span>`,
        `<span class="presCampaignMiniChip">${esc(tipo)}</span>`,
        `<span class="presCampaignMiniChip">${esc(part)}</span>`
      ].join("");

      return `        <article class="campCard campLine presCampaignCard ${lineClassForCampaign(t)} ${templateClassForCampaign(t)}">
          <div class="presCampaignCardTop">
            <div class="presCampaignTitleBlock">
              <div class="presCampaignTitleRow">
                <h3>${esc(presCleanText(t.title || "Campaña"))}</h3>
                ${statusPillForCampaign(t)}
              </div>
              <p>${esc(dateLine || "Sin fecha definida")}</p>
            </div>
            <div class="presCampaignProgressRing" style="--pct:${pct}" aria-label="${pct}% recaudado">
              <b>${pct}%</b>
              <small>recaudado</small>
            </div>
          </div>

          <div class="presCampaignChips">${chipsInfo}</div>

          <div class="presCampaignStats">
            <div><small>Recaudado</small><b>${clp(rec)}</b></div>
            <div><small>Gastado</small><b>${clp(gas)}</b></div>
            <div><small>Saldo</small><b>${clp(saldo)}</b></div>
            <div><small>Deudores</small><b>${Number(debtors||0)}</b></div>
          </div>

          <div class="presCampaignProgress">
            <span style="--pct:${pct}"></span>
          </div>
          <div class="presCampaignPending"><span>Pendiente:</span> <b>${clp(pend)}</b></div>

          ${isDeletedCampaign ? `<div class="muted presCampaignNote">Registro histórico · eliminada${t.deletedAt ? ` el ${fmtCampDate(t.deletedAt)}` : ""}. No participa en indicadores ni deudas.</div>` : `
          <div class="presCampaignActions">
            <button class="btnx primary presCampaignPrimary" onclick="Campaigns.openCampaignDetail('${t.id}','presidente')">Ver detalles ${presSvgIcon("arrowRight","presCampaignBtnIcon")}</button>
            <button class="btnx presCampaignSecondary" onclick="openEditCampaign('${t.id}')">Editar</button>
            ${(!t.closed && !isExpired(t)) ? `<button class="btnx danger presCampaignSecondary" onclick="deleteCampaign('${t.id}')">Eliminar</button>` : ""}
          </div>
          `}

          ${(t.mandatoryParticipation===false && pend===0 && cuotasPendientes===0 && debtors===0 && campaignPayments(t.id).some(p=>paymentStatusNorm(p)==="opted_out")) ? `<div class="muted presCampaignNote">No participan apoderados en esta campaña por ahora.</div>` : ``}
          ${t.closed && pend>0 ? `<div class="muted presCampaignNote">
            Esta campaña está cerrada, pero aún hay aportes pendientes (arrastran al siguiente mes).
          </div>` : ``}
        </article>
    `;
    }).join("");

    app.innerHTML = `
      <section class="presCampaignPage">
        <div class="presCampaignHeader">
          <div>
            <h1>Campañas</h1>
            <p>Gestiona las actividades económicas del curso.</p>
          </div>
          <button class="btnx primary presCampaignNewBtn" onclick="openCreateCampaign()">+ Nueva campaña</button>
        </div>

        <div class="presCampaignTemplates">
          <h2>Plantillas destacadas</h2>
          <div class="presCampaignTemplateTrack" aria-label="Plantillas destacadas">
            <article class="presCampaignTemplate">
              ${presSvgIcon("school","presCampaignTemplateIcon")}
              <b>Gira de estudio</b>
              <span>Cuotas + saldo anterior</span>
              <button type="button" onclick="Campaigns.openCreateTemplate('gira')">Usar plantilla ${presSvgIcon("arrowRight","presCampaignBtnIcon")}</button>
            </article>
            <article class="presCampaignTemplate">
              ${presSvgIcon("flag","presCampaignTemplateIcon")}
              <b>Graduación</b>
              <span>Cotizaciones + plan de cuotas</span>
              <button type="button" onclick="Campaigns.openCreateTemplate('graduacion')">Usar plantilla ${presSvgIcon("arrowRight","presCampaignBtnIcon")}</button>
            </article>
          </div>
        </div>

        <div class="presCampaignSectionHead">
          <h2>Mis campañas</h2>
        </div>
        ${chips}

        <div class="listLines">
          ${list || `<article class="presMockEmpty"><strong>No existe información</strong><p>No hay campañas registradas para este filtro.</p></article>`}
        </div>
      </section>
    `;
  }

  // ----- Informes -----
  // =========================
// Modulo Cobranza / Deudores
// =========================
function todayISO(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const da = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${da}`;
}
function isPast(iso){
  if(!iso) return false;
  return String(iso).slice(0,10) < todayISO();
}
function taskById(id){
  return tasks().find(t => String(t.id) === String(id));
}
function apoderadoKey(p){
  return String((p.apoderadoEmail||p.email||"")).toLowerCase();
}
function money(n){ return clp(Number(n||0)); }

function debtorRowsFor(email){
  const em = String(email||"").toLowerCase();
  const pays = payments().filter(p => apoderadoKey(p) === em);
  const pending = pays.filter(isPendingFinancialStatus);

  return pending.map(p=>{
    const t = taskById(p.fromTaskId);
    const mandatory = t ? (t.mandatoryParticipation !== false) : true;
    return {
      pay: p,
      task: t,
      mandatory,
      dueDate: String(p.dueDate||"").slice(0,10),
      amount: Number(p.amount||0),
      overdue: isPast(p.dueDate||"")
    };
  });
}

function summarizeDebts(email){
  const rows = debtorRowsFor(email);
  const byCampaign = new Map();
  let totalAll = 0, totalOverdue = 0, totalUpcoming = 0;

  rows.forEach(r=>{
    totalAll += r.amount;
    if(r.overdue) totalOverdue += r.amount; else totalUpcoming += r.amount;

    const id = String(r.task?.id || r.pay.fromTaskId || "unknown");
    if(!byCampaign.has(id)){
      byCampaign.set(id, {
        taskId: id,
        title: r.task?.title || r.pay.title || "Campaña",
        mandatory: r.mandatory,
        pendingCount: 0,
        overdueAmount: 0,
        upcomingAmount: 0,
        pendingAmount: 0
      });
    }
    const s = byCampaign.get(id);
    s.pendingCount += 1;
    s.pendingAmount += r.amount;
    if(r.overdue) s.overdueAmount += r.amount; else s.upcomingAmount += r.amount;
  });

  const campaigns = Array.from(byCampaign.values()).sort((a,b)=>{
    if(a.mandatory !== b.mandatory) return a.mandatory ? -1 : 1;
    return b.pendingAmount - a.pendingAmount;
  });

  return { campaigns, totalAll, totalOverdue, totalUpcoming };
}

function monthMandatoryOutstanding(ym){
  let projected = 0;
  tasks().forEach(t=>{
    if(t.closed || t.mandatoryParticipation === false) return;
    const amount=Number(t.amount||0);
    const type=String(t.type||"single").toLowerCase();
    let applies=false;
    if(type==="monthly"){
      const start=ymFromISO(t.startDate||t.dueDate||"");
      if(start){
        const idx=(Number(ym.slice(0,4))-Number(start.slice(0,4)))*12+(Number(ym.slice(5,7))-Number(start.slice(5,7)))+1;
        applies=idx>=1 && idx<=Math.max(1,Number(t.months||1));
      }
    }else applies=ymFromISO(t.dueDate||"")===ym;
    if(applies) projected += amount * courseStudentTotal();
  });
  const collected = sum(payments().filter(p=>{
    if(!isPaid(p)) return false;
    const t=taskById(p.fromTaskId);
    if(!t || t.mandatoryParticipation===false) return false;
    return String(p.period || p.dueDate || p.paidAt || p.paidDate || "").slice(0,7)===ym;
  }), p=>Number(p.amount||0));
  return Math.max(0, projected-collected);
}

function renderBar(label, value, max){
  const pct = max>0 ? Math.max(2, Math.round((value/max)*100)) : 0;
  return `
    <div class="barRow">
      <div class="barLabel">${esc(label)}</div>
      <div class="barTrack"><div class="barFill" style="width:${pct}%;"></div></div>
      <div class="barVal">${money(value)}</div>
    </div>
  `;
}

function activeCourse(){
  try{
    const ck = activeCourseKey();

    // 1) Catalogo nuevo temporal hasta Supabase
    const courses = JSON.parse(localStorage.getItem("cursapp_courses_v1")||"[]");
    const found = Array.isArray(courses) ? courses.find(c=>String(c.courseKey||"")===String(ck)) : null;
    if(found) return found;

    // 2) Curso actual creado desde onboarding
    const current = JSON.parse(localStorage.getItem("cursapp_course_v1")||"null");
    if(current && String(current.courseKey||"")===String(ck)){
      return Object.assign({ courseKey: current.courseKey, inviteCode: current.inviteCode }, current.course || {});
    }

    // 3) Perfil presidente/apoderado asociado al curso
    const profiles = JSON.parse(localStorage.getItem("cursapp_profiles_v1")||"[]");
    const prof = Array.isArray(profiles) ? profiles.find(p=>String(p.courseKey||"")===String(ck) && p.course) : null;
    if(prof && prof.course) return Object.assign({ courseKey: prof.courseKey }, prof.course || {});

    // 4) Si no hay active_course pero existe un unico curso actual, usalo y corrige active_course
    if(current && current.courseKey){
      localStorage.setItem(KEY_ACTIVE_COURSE, String(current.courseKey));
      return Object.assign({ courseKey: current.courseKey, inviteCode: current.inviteCode }, current.course || {});
    }

    // 5) Fallback temporal: si existe un unico curso en catalogo, usarlo.
    if(Array.isArray(courses) && courses.length === 1 && courses[0] && courses[0].courseKey){
      localStorage.setItem(KEY_ACTIVE_COURSE, String(courses[0].courseKey));
      return courses[0];
    }

    return null;
  }catch(e){ return null; }
}

function courseDisplayLine(c){
  if(!c) return "Curso no seleccionado";
  const school = c.schoolName || c.school || c.colegio || "Colegio";
  const level = c.level || c.curso || c.course || "";
  const letter = c.letter || "";
  const year = c.year || "";
  const jornada = c.jornada || "";
  return `${school} · ${level}${letter} ${year} · ${jornada}`.replace(/\s+/g," ").trim();
}

function updatePresidentTopbar(){
  try{ updatePresidentHeader(getPresidentVisualContext(approvedCount())); }catch(e){}
}

function buildWhatsappText(profile, summary){
  const name = (profile.apoderadoName||profile.name||"").trim() || "Apoderado/a";
  const alumno = (profile.alumno||"").trim();
  const c = activeCourse() || {};
  const courseLine = `${c.schoolName||"Colegio"} · ${c.level||""}${c.letter||""} ${c.year||""} · ${c.jornada||""}`.replace(/\s+/g," ").trim();
  const today = todayISO();

  let lines = [];
  lines.push(`Hola ${name}${alumno?` (Alumno/a: ${alumno})`:``}.`);
  lines.push(`Te comparto el resumen de cobros del curso ${courseLine} al ${today}:`);
  lines.push("");

  if(summary.campaigns.length===0){
    lines.push("No registras deudas pendientes.");
  }else{
    summary.campaigns.forEach(ca=>{
      const tag = ca.mandatory ? "Obligatoria" : "Voluntaria";
      lines.push(`- ${ca.title} (${tag}): ${ca.pendingCount} pendiente(s) por ${money(ca.pendingAmount)}.`);
      const det = [];
      if(ca.overdueAmount>0) det.push(`vencido ${money(ca.overdueAmount)}`);
      if(ca.upcomingAmount>0) det.push(`por vencer ${money(ca.upcomingAmount)}`);
      if(det.length) lines.push(`  (${det.join(" · ")})`);
    });
    lines.push("");
    lines.push(`Total pendiente: ${money(summary.totalAll)}.`);
  }

  lines.push("");
  lines.push("Gracias.");
  return lines.join("\n");
}

function renderDeudores(){
  const existingDebtQuery = document.getElementById("debtorQuery");
  const debtQueryDraft = String(window.__presDebtQueryDraft ?? existingDebtQuery?.value ?? "");
  const ym = ymFromISO(todayISO());

  const aprobados = approvedApoderados().map(e=>({
    email: String(e.email||"").toLowerCase(),
    apoderadoName: e.apoderadoName||e.name||"",
    alumno: e.alumno||""
  }));

  // Pendiente del mes (solo obligatorias) por email
  const pendingMonth = payments().filter(isPendingFinancialStatus).filter(p=> withinMonth(p.dueDate||"", ym));
  const mandatoryPendingByEmail = new Map();
  pendingMonth.forEach(p=>{
    const t = taskById(p.fromTaskId);
    if(t && t.mandatoryParticipation === false) return;
    const em = apoderadoKey(p);
    if(!em) return;
    mandatoryPendingByEmail.set(em, (mandatoryPendingByEmail.get(em)||0) + Number(p.amount||0));
  });

  const debtors = aprobados
    .map(a=>({ ...a, monthPendingMandatory: mandatoryPendingByEmail.get(a.email)||0 }))
    .filter(a=> a.monthPendingMandatory > 0)
    .sort((a,b)=> b.monthPendingMandatory - a.monthPendingMandatory);

  const totalMandatoryMonth = monthMandatoryOutstanding(ym);

  app.innerHTML = `
    <div class="presDebtHero">
      <div>
        <div class="kTitle">Cobranza</div>
        <div class="muted" style="margin-top:6px;">Busca por apoderado o alumno y obtén el resumen de deudas (con texto listo para WhatsApp).</div>
      </div>

      <section class="presDebtExportCard" aria-label="Exportaciones generales del curso">
        <div class="presDebtExportTitle">General del curso</div>
        <div class="presDebtExportActions">
          <button class="presDebtExportBtn pdf" type="button" data-debt-export="pdf" aria-label="Exportar PDF general del curso">
            <span class="presDebtExportIcon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/><path d="M9 16v-4h2a1.5 1.5 0 0 1 0 3H9"/><path d="M13.5 16v-4h1.2a2 2 0 0 1 0 4h-1.2"/><path d="M17.5 12h2.2"/><path d="M17.5 14h1.8"/></svg>
            </span>
            <span>PDF</span>
          </button>
          <button class="presDebtExportBtn excel" type="button" data-debt-export="excel" aria-label="Exportar Excel general del curso">
            <span class="presDebtExportIcon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 4h10l6 6v10a2 2 0 0 1-2 2H4z"/><path d="M14 4v6h6"/><path d="M8 12l4 6"/><path d="M12 12l-4 6"/><path d="M15 13h2"/><path d="M15 16h2"/></svg>
            </span>
            <span>Excel</span>
          </button>
          <button class="presDebtExportBtn whatsapp" type="button" data-debt-export="whatsapp" aria-label="Exportar WhatsApp general del curso">
            <span class="presDebtExportIcon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 11.5a8 8 0 0 1-11.9 7l-3.6 1 1-3.5A8 8 0 1 1 20 11.5z"/><path d="M9 8.5c.2 3 2.1 5.1 5 6"/><path d="M8.8 8.4l.8-.4 1.2 2-.6.7"/><path d="M14 14.5l.7-.6 2 .9-.4.9"/></svg>
            </span>
            <span>WhatsApp</span>
          </button>
        </div>
      </section>
    </div>

    <div class="kpiGrid" style="margin-top:12px;">
      <div class="kpi">
        <div class="kpiLabel">Alumnos pendientes de pago (mes)</div>
        <div class="kpiVal">${deudoresMonth(ym)}</div>
      </div>
      <div class="kpi">
        <div class="kpiLabel">Deuda obligatoria del mes</div>
        <div class="kpiVal">${clp(totalMandatoryMonth)}</div>
      </div>
      <div class="kpi">
        <div class="kpiLabel">Alumnos al día (mes)</div>
        <div class="kpiVal">${Math.max(0, courseStudentTotal() - deudoresMonth(ym))}</div>
      </div>
    </div>

    <div class="card" style="margin-top:12px;">
      <div style="font-weight:950;">Indicador por campañas (pendiente total)</div>
      <div class="muted" style="margin-top:6px;">Top campañas con mayor deuda pendiente (todas, incluyendo voluntarias).</div>
      <div id="barsMount" style="margin-top:10px;"></div>
    </div>

    <div class="card presDebtSearchCard" style="margin-top:12px;">
      <div style="font-weight:950;">Buscar apoderado / alumno</div>
      <div class="muted" style="margin-top:6px;">Escribe un nombre o correo.</div>

      <div class="presDebtSearchControls" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;">
        <input id="debtorQuery" type="text" autocomplete="off" inputmode="search" enterkeyhint="search" value="${esc(debtQueryDraft)}" placeholder="Ej: Matías, Mauricio, apoderado@mail.com" style="flex:1;min-width:240px;" />
        <button class="btn primary" id="debtorSearchBtn" type="button" onclick="window.__presDebtorSearch && window.__presDebtorSearch()">Buscar</button>
      </div>

      <div id="debtorResults" style="margin-top:10px;"></div>
    </div>

    <style>
      .presDebtHero{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,520px);gap:18px;align-items:start;margin-bottom:12px;}
      .presDebtExportCard{background:#fff;border:1px solid rgba(34,197,94,.38);border-radius:24px;box-shadow:0 14px 36px rgba(15,23,42,.07);padding:16px;}
      .presDebtExportTitle{font-size:15px;font-weight:900;color:#111827;margin-bottom:12px;}
      .presDebtExportActions{display:grid;grid-template-columns:repeat(3,1fr);gap:0;align-items:stretch;}
      .presDebtExportBtn{appearance:none;border:0;background:transparent;min-height:64px;padding:8px 12px;display:flex;align-items:center;justify-content:center;gap:10px;color:#111827;font-size:14px;font-weight:900;border-radius:16px;cursor:pointer;}
      .presDebtExportBtn + .presDebtExportBtn{border-left:1px solid rgba(226,232,240,.95);border-radius:0;}
      .presDebtExportBtn:hover{background:rgba(15,23,42,.035);}
      .presDebtExportIcon{width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 30px;}
      .presDebtExportIcon svg{width:30px;height:30px;display:block;}
      .presDebtExportBtn.pdf .presDebtExportIcon{color:#dc2626;}
      .presDebtExportBtn.excel .presDebtExportIcon{color:#16a34a;}
      .presDebtExportBtn.whatsapp .presDebtExportIcon{color:#25d366;}
      .presDebtSearchCard{position:relative;z-index:5;isolation:isolate;pointer-events:auto !important;}
      .presDebtSearchControls{position:relative;z-index:6;pointer-events:auto !important;}
      #debtorQuery{position:relative;z-index:7;width:100%;min-width:0 !important;height:52px;box-sizing:border-box;background:#fff;cursor:text;pointer-events:auto !important;user-select:text !important;-webkit-user-select:text !important;touch-action:manipulation;-webkit-appearance:none;appearance:none;}
      #debtorSearchBtn{position:relative;z-index:7;pointer-events:auto !important;}
      @media (max-width:760px){
        .presDebtHero{grid-template-columns:1fr;gap:12px;}
        .presDebtExportCard{border-radius:22px;padding:14px;}
        .presDebtExportActions{gap:8px;}
        .presDebtExportBtn{border:1px solid rgba(226,232,240,.95);border-radius:16px !important;min-height:60px;flex-direction:column;gap:5px;font-size:12px;}
        .presDebtExportBtn + .presDebtExportBtn{border-left:1px solid rgba(226,232,240,.95);}
        .presDebtExportIcon,.presDebtExportIcon svg{width:26px;height:26px;}
        .presDebtSearchControls{display:grid !important;grid-template-columns:1fr;gap:10px !important;}
        #debtorQuery{min-width:0 !important;font-size:16px;}
      }
      .kpiGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
      @media (max-width:760px){.kpiGrid{grid-template-columns:1fr;}}
      .kpi{border:1px solid rgba(15,23,42,.10);border-radius:16px;background:#fff;padding:12px;}
      .kpiLabel{color:rgba(15,23,42,.62);font-weight:900;font-size:12px;}
      .kpiVal{font-weight:950;font-size:22px;margin-top:4px;}
      .barRow{display:grid;grid-template-columns:140px 1fr 90px;gap:10px;align-items:center;margin:8px 0;}
      .barLabel{font-weight:900;font-size:12px;color:rgba(15,23,42,.75);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .barTrack{height:10px;border-radius:999px;background:rgba(15,23,42,.08);overflow:hidden;}
      .barFill{height:100%;border-radius:999px;background:rgba(91,92,226,.65);}
      .barVal{font-weight:950;font-size:12px;text-align:right;}
      .resultRow{padding:10px;border:1px solid rgba(15,23,42,.10);border-radius:14px;background:#fff;margin-top:10px;}
      .resultTop{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;}
      .resultName{font-weight:950;}
      .pill{display:inline-flex;padding:6px 10px;border-radius:999px;font-weight:900;font-size:12px;border:1px solid rgba(15,23,42,.12);background:rgba(15,23,42,.04);}
      .pill.bad{border-color:rgba(239,68,68,.22);background:rgba(239,68,68,.08);}
      .pill.good{border-color:rgba(34,197,94,.22);background:rgba(34,197,94,.08);}
      textarea{width:100%;min-height:120px;padding:10px;border-radius:12px;border:1px solid rgba(15,23,42,.10);font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;}
    </style>
  `;

  document.querySelectorAll("[data-debt-export]").forEach(btn=>{
    btn.onclick = ()=>{
      const type = btn.getAttribute("data-debt-export");
      const candidates = {
        pdf: ["exportDebtorsPdf", "exportDeudoresPdf", "downloadDebtorsPdf", "downloadDeudoresPdf", "printDebtorsPdf", "printDeudoresPdf"],
        excel: ["exportDebtorsExcel", "exportDeudoresExcel", "downloadDebtorsExcel", "downloadDeudoresExcel"],
        whatsapp: ["shareDebtorsWhatsApp", "shareDeudoresWhatsApp", "exportDebtorsWhatsApp", "exportDeudoresWhatsApp"]
      }[type] || [];
      const fnName = candidates.find(name=> typeof window[name] === "function");
      if(fnName){
        window[fnName]();
        return;
      }
      toast("Exportación general no disponible en esta versión.");
    };
  });

  // bars
  // La deuda de una campaña obligatoria se proyecta sobre el total oficial del
  // curso, no únicamente sobre los apoderados que ya se registraron.
  const bars = activeTasks()
    .map(t=>({ id:String(t.id), amt:pendingTaskEstimated(t), title:t.title || t.name || "Campaña" }))
    .filter(r=>r.amt > 0)
    .sort((a,b)=> b.amt - a.amt)
    .slice(0,5);
  const max = bars[0]?.amt || 0;
  const barsMount = document.getElementById("barsMount");
  barsMount && (barsMount.innerHTML = bars.length
    ? bars.map(r=> renderBar(r.title, r.amt, max)).join("")
    : `<div class="muted">No hay deuda pendiente registrada.</div>`);

  const qInp = document.getElementById("debtorQuery");
  const btn = document.getElementById("debtorSearchBtn");
  const out = document.getElementById("debtorResults");

  function fallbackCopy(txt){
    try{
      const tmp = document.createElement("textarea");
      tmp.value = txt;
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand("copy");
      tmp.remove();
      toast("Copiado.");
    }catch(e){
      // En iOS a veces copia igual pero lanza excepcion. Evitamos alertas invasivas.
      toast("Si no se copio, selecciona y copia manualmente.");
    }
  }

  function doSearch(){
    const q = String(qInp?.value||"").trim().toLowerCase();
    if(!q){
      out.innerHTML = `<div class="muted">Escribe un nombre o correo para buscar.</div>`;
      return;
    }
    window.__presDebtSearchCommitted = q;
    window.__presDebtQueryDraft = qInp?.value || q;
    const matches = aprobados.filter(a=>{
      return a.email.includes(q) ||
        String(a.apoderadoName||"").toLowerCase().includes(q) ||
        String(a.alumno||"").toLowerCase().includes(q);
    }).slice(0,10);

    if(!matches.length){
      out.innerHTML = `<div class="muted">Sin resultados.</div>`;
      return;
    }

    out.innerHTML = matches.map(profile=>{
      const sum = summarizeDebts(profile.email);
      const monthMand = mandatoryPendingByEmail.get(profile.email) || 0;
      const wa = buildWhatsappText(profile, sum);
      return `
        <div class="resultRow">
          <div class="resultTop">
            <div>
              <div class="resultName">${esc(profile.apoderadoName||profile.email||"Apoderado")}</div>
              <div class="muted" style="margin-top:2px;">Alumno/a: <b>${esc(profile.alumno||"-")}</b></div>
              <div class="muted" style="margin-top:2px;">Correo: <b>${esc(profile.email||"-")}</b></div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <span class="pill ${monthMand>0?"bad":"good"}">Deuda obligatoria mes: ${money(monthMand)}</span>
              <span class="pill ${sum.totalAll>0?"bad":"good"}">Deuda total: ${money(sum.totalAll)}</span>
            </div>
          </div>

          <div style="margin-top:10px;">
            <div style="font-weight:950;">Cuotas / pagos pendientes por campaña</div>
            ${sum.campaigns.length ? `
              <div style="margin-top:8px;display:grid;gap:8px;">
                ${sum.campaigns.map(ca=>`
                  <div style="border:1px solid rgba(15,23,42,.10);border-radius:14px;padding:10px;background:rgba(255,255,255,.9);">
                    <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;">
                      <div style="font-weight:950;">${esc(ca.title)}</div>
                      <div class="muted" style="font-weight:900;">${ca.mandatory ? "Obligatoria" : "Voluntaria"}</div>
                    </div>
                    <div class="muted" style="margin-top:6px;">
                      Pendientes: <b>${ca.pendingCount}</b> · Monto: <b>${money(ca.pendingAmount)}</b>
                      ${ca.overdueAmount>0 ? `· Vencido: <b>${money(ca.overdueAmount)}</b>` : ``}
                      ${ca.upcomingAmount>0 ? `· Por vencer: <b>${money(ca.upcomingAmount)}</b>` : ``}
                    </div>
                  </div>
                `).join("")}
              </div>
            ` : `<div class="muted" style="margin-top:8px;">No registra deudas pendientes.</div>`}
          </div>

          <div style="margin-top:12px;">
            <div style="font-weight:950;">Resumen para WhatsApp</div>
            <div class="muted" style="margin-top:6px;">Copia y pega este texto.</div>
            <textarea readonly>${esc(wa)}</textarea>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;">
              <button class="btn primary" type="button" data-copy="1">Copiar texto</button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    out.querySelectorAll('button[data-copy="1"]').forEach((b, idx)=>{
      b.onclick = async (event)=>{
        event?.preventDefault();
        event?.stopPropagation();
        window.__presDebtQueryActive = true;
        const ta = out.querySelectorAll("textarea")[idx];
        const txt = ta?.value || "";
        const copied = await copyTextToClipboard(txt);
        if(copied) toast("Texto copiado para WhatsApp.");
        else fallbackCopy(txt);
        setTimeout(()=>{ window.__presDebtQueryActive = false; }, 1500);
      };
    });
  }

  window.__presDebtorSearch = doSearch;
  btn && (btn.onclick = doSearch);
  qInp && (qInp.onkeydown = (e)=>{ if(e.key==="Enter") doSearch(); });
  if(qInp){
    qInp.value = debtQueryDraft;
    qInp.addEventListener("input", ()=>{
      window.__presDebtQueryDraft = qInp.value || "";
      if(String(window.__presDebtSearchCommitted || "") !== String(qInp.value || "").trim().toLowerCase()) window.__presDebtSearchCommitted = "";
    });
    qInp.addEventListener("focus", ()=>{ window.__presDebtQueryActive = true; });
    qInp.addEventListener("blur", ()=>{ setTimeout(()=>{ window.__presDebtQueryActive = false; }, 120); });
    qInp.addEventListener("pointerdown", (e)=>{ e.stopPropagation(); }, { passive:true });
    qInp.addEventListener("mousedown", (e)=>{ e.stopPropagation(); });
    qInp.addEventListener("touchstart", (e)=>{ e.stopPropagation(); }, { passive:true });
    qInp.addEventListener("click", (e)=>{ e.stopPropagation(); qInp.focus({ preventScroll:true }); });
  }

  out.innerHTML = debtors.length
    ? `<div class="muted">Sugerencia: deudores del mes (obligatorias) → ${debtors.slice(0,5).map(d=>esc(d.alumno||d.apoderadoName||d.email)).join(" · ")} ...</div>`
    : `<div class="muted">No hay deudores obligatorios este mes.</div>`;
  if(window.__presDebtSearchCommitted && qInp){
    qInp.value = window.__presDebtQueryDraft || window.__presDebtSearchCommitted;
    requestAnimationFrame(()=>doSearch());
  }
}

function renderInformes(){
    try{
    const reps = reports().slice().sort((a,b)=>String(b.period||"").localeCompare(String(a.period||"")));
    const allTasks = tasks();
    const ps = payments();
    // alias for backward-compat (some helpers expect pays())
    const pays = () => ps;
    const ex = expenses();

    // Live executive numbers (current state, not snapshot)
    const recTotal = collectedCourse();
    const gasTotal = spentCourse();
    const saldo = recTotal - gasTotal;

    const ym = currentYM();
    const recMes = collectedMonth(ym);
    const gasMes = spentMonth(ym);
    const porCobrarMes = pendingMonth(ym);
    const deudMes = deudoresMonth(ym);

    // Recent expenses (approved + submitted, newest first)
    const recentEx = ex.slice().sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).slice(0,8)
    // Report view toggle (apoderados vs directiva)
    const reportView = localStorage.getItem("cursapp_report_view") || "apoderados";
    window.setReportView = window.setReportView || function(v){
      try{ localStorage.setItem("cursapp_report_view", v); }catch(e){}
      try{ if(state && state.tab){ go(state.tab); } else { renderInformes(); } }catch(e){ try{ renderInformes(); }catch(_e){} }
    };

    const projMaxMes = (typeof projectionMaxMonth==="function") ? projectionMaxMonth(ym) : (recMes + porCobrarMes);
    const cumplimientoMes = projMaxMes>0 ? Math.round((recMes/projMaxMes)*100) : 0;

    function pct(n){ n=Number(n||0); if(!isFinite(n)) n=0; return Math.max(0, Math.min(100, n)); }
    function bar(p, label){
      const pp = pct(p);
      return `
        <div style="margin-top:8px;">
          ${label?`<div class="muted" style="font-size:12px;margin-bottom:6px;">${label}</div>`:""}
          <div style="height:10px;border-radius:999px;background:#eef2ff;overflow:hidden;">
            <div style="height:10px;border-radius:999px;background:linear-gradient(90deg,#60a5fa,#34d399);width:${pp}%"></div>
          </div>
          <div class="muted" style="font-size:12px;margin-top:6px;">${pp}%</div>
        </div>
      `;
    }

    function statusChip(){
      // Semáforo simple por cumplimiento mes y deudores
      if(cumplimientoMes>=85 && deudMes<=2) return `<span class="chipInfoPill ok">🟢 En buen camino</span>`;
      if(cumplimientoMes>=55) return `<span class="chipInfoPill warn">🟡 Atención</span>`;
      return `<span class="chipInfoPill danger">🔴 Urgente</span>`;
    }

    function gastosPorCategoria(){
      const map = {};
      ex.forEach(e=>{
        const st = String(e.status||"submitted");
        if(st==="rejected") return;
        const cat = String(e.category||e.tipo||e.type||"Otro").trim() || "Otro";
        map[cat] = (map[cat]||0) + Number(e.amount||0);
      });
      const arr = Object.entries(map).map(([k,v])=>({cat:k, total:v})).sort((a,b)=>b.total-a.total);
      return arr;
    }

    function informeApoderadosHTML(){
        // payments data (defensive)
  const paysArr = (typeof payments === 'function') ? (payments() || []) : [];

// --- visual helpers (local scope to avoid reference errors) ---
  const cardStyle = 'border:1px solid rgba(0,0,0,.06);border-radius:18px;padding:14px 14px;box-shadow:0 10px 30px rgba(2,6,23,.06);';
  const kpi = (ico, label, val) => `
    <div style="${cardStyle}background:#fff;">
      <div style="display:flex;gap:10px;align-items:flex-start;">
        <div style="font-size:18px;line-height:1;">${ico}</div>
        <div style="flex:1;">
          <div style="font-size:13px;opacity:.75;">${label}</div>
          <div style="font-weight:950;font-size:22px;margin-top:4px;">${val}</div>
        </div>
      </div>
    </div>`;

const ym = currentYM();
    const people = approvedCount();
    const allPays = paysArr;

    // --- metrics (defensive, month-scoped; excludes opted_out) ---
    const isExcludedPay = (p) => {
      const st = String(p?.status || "").toLowerCase();
      return st === "opted_out" || st === "void" || st === "cancelled";
    };
    const payYM = (p) => (String(p?.dueDate || "").slice(0,7) || String(p?.period || "").slice(0,7));
    const expYM = (e) => String(e?.date || e?.createdAt || e?.ts || e?.at || "").slice(0,7);

    const recMes = (allPays||[])
      .filter(p => p && !isExcludedPay(p) && String(p.status||"").toLowerCase()==="paid" && payYM(p)===ym)
      .reduce((a,p)=>a+Number(p.amount||0),0);

    const proyMes = (allPays||[])
      .filter(p => p && !isExcludedPay(p) && payYM(p)===ym)
      .reduce((a,p)=>a+Number(p.amount || p.amountRemaining || 0),0);

    const porCobrarMes = Math.max(0, proyMes - recMes);

    const gastoMes = (typeof expenses === "function" ? expenses() : [])
      .filter(e => e && expYM(e)===ym)
      .reduce((a,e)=>a+Number(e.amount||e.monto||0),0);

    const recTotal = (allPays||[])
      .filter(p => p && !isExcludedPay(p) && String(p.status||"").toLowerCase()==="paid")
      .reduce((a,p)=>a+Number(p.amount||0),0);

    const gastoTotal = (typeof expenses === "function" ? expenses() : [])
      .reduce((a,e)=>a+Number(e?.amount||e?.monto||0),0);

    const saldo = recTotal - gastoTotal;

    const camps = tasks().filter(t => t && t.kind==="campaign" && t.id && (t.status||"open")!=="closed");

    const pct = Math.max(0, Math.min(100, Number(cumplimientoMes||0)));
    const chip = statusChip(); // ya viene calculado arriba
    const semMsg = pct>=90 ? "¡Vamos excelente!" : (pct>=50 ? "Vamos avanzando, aún falta un poco" : "Atención: queda bastante por pagar este mes");

    const campRows = camps.map(t=>{
      const title = esc(t.title || t.name || "Campaña");
      const icon = esc(t.icon || "");
      const isMonthly = !!t.isMonthly;
      const isVol = t.isMandatory===false || t.mandatory===false || t.obligatoria===false;
      const mode = isMonthly ? "Mensual" : "Único";
      const mand = isVol ? "Voluntaria" : "Obligatoria";

      // Solo pagos del mes (si existen dueYm). Si no existen, cae a estimación.
      const rel = allPays.filter(p => p && (p.fromTaskId===t.id || p.taskId===t.id));
      const relYm = rel.filter(p => (p.dueYm||p.ym||"")===ym);

      const monthProjected = relYm.length
        ? relYm.filter(p=>paymentStatusNorm(p)!=="opted_out").reduce((a,p)=>a+Number(p.amount||0),0)
        : (isMonthly ? Number(t.amountPerStudent||t.amount||0)*people : 0);

      const monthPaid = relYm.length
        ? relYm.filter(p=>p.status==="paid").reduce((a,p)=>a+Number(p.amount||0),0)
        : 0;

      // pendiente estimado total (considera opt-out si es voluntaria)
      const totalExpected = expectedTaskTotal(t);
      const totalCollected = collectedTask(t.id);
      const totalPendingEst = pendingTaskEstimated(t);

      const campPct = totalExpected>0 ? Math.round((totalCollected/totalExpected)*100) : 0;
      const campPctClamped = Math.max(0, Math.min(100, campPct));

      return `
        <div style="${cardStyle}">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div>
              <div style="font-weight:950;font-size:18px;">${title} ${icon}</div>
              <div class="muted" style="margin-top:2px;font-size:13px;">${mode} · ${mand}</div>
            </div>
            <div style="font-weight:950;font-size:18px;">${campPctClamped}%</div>
          </div>
          <div style="margin-top:10px;height:10px;background:#e5e7eb;border-radius:999px;overflow:hidden;">
            <div style="height:100%;width:${campPctClamped}%;background:#4f46e5;border-radius:999px;"></div>
          </div>
          <div style="margin-top:10px;font-size:13px;opacity:.92;display:grid;gap:4px;">
            <div>💰 Recaudado: <b>${clp(totalCollected)}</b></div>
            <div>⏳ Pendiente mes: <b>${clp(Math.max(0, monthProjected - monthPaid))}</b></div>
            <div>🎯 Objetivo: <b>${clp(totalExpected)}</b></div>
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="card" style="padding:16px;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
          <div>
            <div class="kTitle" style="margin:0;">Informe para Apoderados</div>
            <div class="muted" style="margin-top:6px;">Sencillo, visual y transparente.</div>
          </div>
          ${chip}
        </div>

        <div style="margin-top:14px;${cardStyle}background:#f8fafc;">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div>
              <div style="font-weight:950;font-size:16px;">🟡 Cumplimiento del mes</div>
              <div style="font-size:13px;opacity:.75;margin-top:2px;">${esc(semMsg)} · <b>${esc(ym)}</b></div>
            </div>
            <div style="font-weight:950;font-size:18px;">${pct}%</div>
          </div>
          <div style="margin-top:10px;height:12px;background:#e5e7eb;border-radius:999px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:#16a34a;border-radius:999px;"></div>
          </div>
          <div style="margin-top:8px;font-size:13px;opacity:.9;">
            💵 Cobrado mes: <b>${clp(recMes)}</b> · ⏳ Proyección mes: <b>${clp(projMaxMes)}</b> · 👥 Deudores mes: <b>${deudMes}</b>
          </div>
        </div>

        <div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          ${kpi("💰","Recaudado este mes", clp(recMes))}
          ${kpi("🧾","Gastado este mes", clp(gastoMes))}
          ${kpi("🏦","Saldo disponible", clp(saldo))}
          ${kpi("⏳","Por cobrar este mes", clp(Math.max(0, porCobrarMes)))}
        </div>

        <div style="margin-top:16px;">
          <div style="font-weight:950;font-size:16px;margin-bottom:10px;">📌 Indicadores por campaña</div>
          <div style="display:grid;gap:10px;">
            ${campRows || `<div style="opacity:.7;font-size:13px;">No hay campañas activas.</div>`}
          </div>
        </div>

        <div style="margin-top:14px;display:flex;justify-content:flex-end;">
          <button class="btn" onclick="window.go('pagos')">Ir a pagos</button>
        </div>
      </div>
    `;
  }

    function informeDirectivaHTML(){
      const saldoPrev = sum(allTasks.filter(t=>Number(t.saldo_prev||0)>0), t=>Number(t.saldo_prev||0));
      const saldoInicial = saldoPrev; // en este MVP usamos saldo_prev como base; si no existe, 0
      const ingresosPeriodo = recMes;
      const gastosPeriodo = gasMes;
      const saldoFinal = saldoInicial + ingresosPeriodo - gastosPeriodo;

      const campRows = allTasks
        .slice()
        .filter(t=>!t.closed)
        .map(t=>{
          const rec = collectedTask(t.id);
          const gas = spentTask(t.id);
          const sal = rec - gas;
          const pend = pendingTask(t.id);
          const meta = Number(t.goalTotal||0);
          const av = meta>0 ? Math.round((rec/meta)*100) : null;
          return {t, rec, gas, sal, pend, meta, av};
        })
        .sort((a,b)=> (b.rec - a.rec));

      const cumplimientoBar = bar(cumplimientoMes, "Cumplimiento del mes (recaudado vs proyección)");
      const cats = gastosPorCategoria().slice(0,6);
      const catsBars = cats.length ? `
        <div class="card" style="margin-top:14px;padding:14px;">
          <div style="font-weight:950;">Gastos por categoría</div>
          <div class="muted" style="margin-top:6px;">Distribución total (no solo mes)</div>
          <div style="margin-top:10px;display:grid;gap:10px;">
            ${cats.map(c=>{
              const total = sum(cats, x=>x.total);
              const p = total>0 ? Math.round((c.total/total)*100) : 0;
              return `
                <div>
                  <div style="display:flex;justify-content:space-between;gap:10px;">
                    <div style="font-weight:900;">${esc(c.cat)}</div>
                    <div style="font-weight:950;">${clp(c.total)}</div>
                  </div>
                  <div style="height:8px;border-radius:999px;background:#eef2ff;overflow:hidden;margin-top:6px;">
                    <div style="height:8px;border-radius:999px;background:#60a5fa;width:${pct(p)}%"></div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `:"";

      const table = campRows.length ? `
        <div class="card" style="margin-top:14px;padding:14px;">
          <div style="font-weight:950;">Campañas activas (cuadratura)</div>
          <div style="margin-top:10px;overflow:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              <thead>
                <tr class="muted">
                  <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Campaña</th>
                  <th style="text-align:right;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Recaudado</th>
                  <th style="text-align:right;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Gastado</th>
                  <th style="text-align:right;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Saldo</th>
                  <th style="text-align:right;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Pendiente</th>
                  <th style="text-align:center;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Meta</th>
                </tr>
              </thead>
              <tbody>
                ${campRows.map(r=>`
                  <tr>
                    <td style="padding:8px;border-bottom:1px solid rgba(0,0,0,.05);">
                      <div style="font-weight:900;">${esc(r.t.title||"")}</div>
                      <div class="muted" style="font-size:12px;">${esc(r.t.type==="monthly"?"Mensual":"Único")} · ${r.t.mandatoryParticipation===false?"Voluntaria":"Obligatoria"}</div>
                    </td>
                    <td style="padding:8px;border-bottom:1px solid rgba(0,0,0,.05);text-align:right;">${clp(r.rec)}</td>
                    <td style="padding:8px;border-bottom:1px solid rgba(0,0,0,.05);text-align:right;">${clp(r.gas)}</td>
                    <td style="padding:8px;border-bottom:1px solid rgba(0,0,0,.05);text-align:right;font-weight:950;">${clp(r.sal)}</td>
                    <td style="padding:8px;border-bottom:1px solid rgba(0,0,0,.05);text-align:right;">${clp(r.pend)}</td>
                    <td style="padding:8px;border-bottom:1px solid rgba(0,0,0,.05);text-align:center;">${r.av==null?"—":(pct(r.av)+"%")}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      ` : "";

      const cuadOK = (Math.abs((recTotal - gasTotal) - saldo) < 0.5); // always true but keeps concept
      return `
        <div class="card" style="padding:14px;">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
            <div>
              <div style="font-weight:950;font-size:18px;">Informe para Directiva</div>
              <div class="muted" style="margin-top:4px;">Cuadratura, control y seguimiento.</div>
            </div>
            <span class="chipInfoPill ${cuadOK?"ok":"warn"}">🧮 Cuadratura ${cuadOK?"OK":"Revisar"}</span>
          </div>

          <div style="margin-top:12px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
            <div style="border:1px solid rgba(0,0,0,.08);border-radius:16px;padding:12px;background:#fff;"><div class="muted">Cobrado mes</div><div class="big">${clp(recMes)}</div></div>
            <div style="border:1px solid rgba(0,0,0,.08);border-radius:16px;padding:12px;background:#fff;"><div class="muted">Por cobrar mes</div><div class="big">${clp(porCobrarMes)}</div></div>
            <div style="border:1px solid rgba(0,0,0,.08);border-radius:16px;padding:12px;background:#fff;"><div class="muted">Gastado mes</div><div class="big">${clp(gasMes)}</div></div>
            <div style="border:1px solid rgba(0,0,0,.08);border-radius:16px;padding:12px;background:#fff;"><div class="muted">Deudores mes</div><div class="big">${Number(deudMes||0)}</div></div>
          </div>

          <div class="card" style="margin-top:14px;padding:14px;">
            <div style="font-weight:950;">Cuadratura del periodo (mes actual)</div>
            <div style="margin-top:10px;display:grid;gap:8px;">
              <div style="display:flex;justify-content:space-between;"><span>Saldo inicial</span><b>${clp(saldoInicial)}</b></div>
              <div style="display:flex;justify-content:space-between;"><span>+ Ingresos del mes</span><b>${clp(ingresosPeriodo)}</b></div>
              <div style="display:flex;justify-content:space-between;"><span>- Gastos del mes</span><b>${clp(gastosPeriodo)}</b></div>
              <div style="display:flex;justify-content:space-between;border-top:1px dashed rgba(0,0,0,.15);padding-top:8px;"><span><b>Saldo final</b></span><b>${clp(saldoFinal)}</b></div>
            </div>
            ${cumplimientoBar}
          </div>

          ${table}
          ${catsBars}
        </div>
      `;
    }

    const toggleHTML = `
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin:12px 0;">
        <button class="btnx ${reportView==='apoderados'?'primary':''}" onclick="window.setReportView('apoderados')">👨‍👩‍👧‍👦 Apoderados</button>
        <button class="btnx ${reportView==='directiva'?'primary':''}" onclick="window.setReportView('directiva')">🏛ï¸ Directiva</button>
      </div>
    `;
;

    function hasAttachment(e){
      return !!(e && Array.isArray(e.attachments) && e.attachments[0] && e.attachments[0].dataUrl);
    }


function viewExpenseAttachment(expenseId){
  try{
    const e = expenses().find(x=>String(x.id)===String(expenseId));
    if(!e || !Array.isArray(e.attachments) || !e.attachments.length){
      alert("No hay comprobante adjunto.");
      return;
    }
    const file = e.attachments[0];
    const dataUrl = file.dataUrl || file.dataURL || file.url || "";
    const type = String(file.type||"");
    if(!dataUrl){
      alert("Comprobante no disponible.");
      return;
    }
    const win = window.open();
    if(!win){ alert("Bloqueado por el navegador. Permite pop-ups para ver el comprobante."); return; }
    win.document.write(`
      <html>
        <head><title>Comprobante</title></head>
        <body style="margin:0;">
          ${
            type.includes("image")
              ? `<img src="${dataUrl}" style="width:100%;height:auto;display:block;" />`
              : `<iframe src="${dataUrl}" style="width:100%;height:100vh;border:0;"></iframe>`
          }
        </body>
      </html>
    `);
  }catch(err){
    alert("No se pudo abrir el comprobante.");
  }
}

    const totalProyectadoMes = Math.max(0, Number(projMaxMes || (recMes + porCobrarMes) || 0));
    const pendienteMes = Math.max(0, Number(porCobrarMes || 0), totalProyectadoMes - recMes);
    const porcentajeCobrado = totalProyectadoMes > 0 ? Math.round((recMes / totalProyectadoMes) * 100) : 0;
    const porcentajePorCobrar = totalProyectadoMes > 0 ? Math.round((pendienteMes / totalProyectadoMes) * 100) : 0;
    const porcentajeGastado = recMes > 0 ? Math.round((gasMes / recMes) * 100) : 0;
    const saldoInicial = sum(allTasks.filter(t=>Number(t.saldo_prev||0)>0), t=>Number(t.saldo_prev||0));
    const saldoFinal = saldoInicial + recMes - gasMes;
    const cuadraturaOk = saldoFinal >= 0;

    const activeCampaigns = allTasks
      .filter(t=>t && !t.closed && String(t.status||"open")!=="closed")
      .map(t=>{
        const rec = collectedTask(t.id);
        const pend = Math.max(0, pendingTaskEstimated(t));
        const meta = Math.max(0, Number(t.goalTotal||0), expectedTaskTotal(t));
        return {
          id: t.id,
          title: t.title || t.name || "Campaña",
          rec,
          pend,
          meta,
          pct: 0
        };
      })
      .sort((a,b)=>b.pend-a.pend);
    const totalPendienteCampanas = sum(activeCampaigns, c=>c.pend);
    activeCampaigns.forEach(c=>{
      c.pct = totalPendienteCampanas > 0 ? Math.round((c.pend / totalPendienteCampanas) * 100) : 0;
    });
    const svgIcon = (name)=>({
      file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h6"/></svg>',
      users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      dollar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"/></svg>',
      arrowUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>',
      arrowDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>',
      check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
      send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>'
    }[name] || "");

    function informeDonut(percent, color, centerHtml, cls){
      const p = pct(percent);
      return `
        <div class="${cls||"presReportDonut"}" style="--p:${p};--c:${color||"#6d28d9"};">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle class="track" cx="60" cy="60" r="48"></circle>
            <circle class="fill" cx="60" cy="60" r="48" pathLength="100"></circle>
          </svg>
          <div class="presReportDonutCenter">${centerHtml}</div>
        </div>
      `;
    }

    function reportKpi(icon, label, value, sub, color, percent){
      return `
        <article class="presReportKpi" style="--accent:${color};">
          <div class="presReportKpiIcon">${svgIcon(icon)}</div>
          <div class="presReportKpiLabel">${esc(label)}</div>
          <div class="presReportKpiValue">${esc(value)}</div>
          <div class="presReportKpiSub">${esc(sub)}</div>
          <div class="presReportKpiBar"><span style="width:${pct(percent)}%;"></span></div>
        </article>
      `;
    }

    const shortMonthNames = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    function dateFromValue(v){
      const s = String(v || "");
      if(!s) return null;
      const d = new Date(s.length <= 10 ? `${s}T12:00:00` : s);
      return isNaN(d.getTime()) ? null : d;
    }
    function weekStart(d){
      const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const day = x.getDay() || 7;
      x.setDate(x.getDate() - day + 1);
      x.setHours(0,0,0,0);
      return x;
    }
    function sameWeek(a,b){ return a && b && weekStart(a).getTime() === weekStart(b).getTime(); }
    function weekLabel(d){
      return `${d.getDate()} ${shortMonthNames[d.getMonth()] || ""}`.trim();
    }
    function weeklyRows(){
      const now = new Date();
      const current = weekStart(now);
      const weeks = Array.from({length:6}, (_,i)=>{
        const d = new Date(current);
        d.setDate(current.getDate() - (5-i)*7);
        return d;
      });
      const rows = weeks.map(w=>({ mes: weekLabel(w), recaudado:0, proyeccion:0 }));
      ps.forEach(p=>{
        const paidDate = isPaid(p) ? dateFromValue(p.paidAt || p.paidDate || p.paid_on || p.createdAt || p.date) : null;
        const dueDate = dateFromValue(p.dueDate || p.period || p.createdAt);
        weeks.forEach((w,idx)=>{
          if(paidDate && sameWeek(paidDate, w)) rows[idx].recaudado += Number(p.amount || 0);
          if(dueDate && sameWeek(dueDate, w) && paymentStatusNorm(p) !== "opted_out") rows[idx].proyeccion += Number(p.amount || p.amountRemaining || 0);
        });
      });
      const hasData = rows.some(r=>Number(r.recaudado||0) || Number(r.proyeccion||0));
      if(!hasData && (recMes || totalProyectadoMes)){
        rows[rows.length - 1].recaudado = recMes;
        rows[rows.length - 1].proyeccion = totalProyectadoMes;
      }
      return rows;
    }

    function lineChart(rows){
      if(!rows || rows.length < 2){
        return `<div class="presReportEmptyLine">Aún no hay histórico suficiente para graficar la evolución.</div>`;
      }
      const max = Math.max(1, ...rows.map(r=>Math.max(Number(r.recaudado||0), Number(r.proyeccion||0))));
      const w = 320, h = 150, pad = 28;
      const x = i => pad + (i * ((w - pad*2) / Math.max(1, rows.length-1)));
      const y = v => h - pad - ((Number(v||0) / max) * (h - pad*2));
      const path = key => rows.map((r,i)=>`${i?"L":"M"} ${x(i).toFixed(1)} ${y(r[key]).toFixed(1)}`).join(" ");
      return `
        <div class="presReportLineWrap">
          <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Evolución semanal">
            <path class="grid" d="M${pad} ${y(max*.75)}H${w-pad} M${pad} ${y(max*.5)}H${w-pad} M${pad} ${y(max*.25)}H${w-pad}"></path>
            <path class="projection" d="${path("proyeccion")}"></path>
            <path class="collected" d="${path("recaudado")}"></path>
            ${rows.map((r,i)=>`<circle class="dot projected" cx="${x(i)}" cy="${y(r.proyeccion)}" r="3"/><circle class="dot collectedDot" cx="${x(i)}" cy="${y(r.recaudado)}" r="3"/>`).join("")}
            ${rows.map((r,i)=>`<text x="${x(i)}" y="${h-5}" text-anchor="middle">${esc(r.mes)}</text>`).join("")}
          </svg>
          <div class="presReportLegend compact"><span><i class="projectionKey"></i>Proyección</span><span><i></i>Recaudado</span></div>
        </div>
      `;
    }

    const campaignRows = activeCampaigns.map(c=>`
      <div class="presReportCampaignRow">
        <span class="dot"></span>
        <b>${esc(c.title)}</b>
        <strong>${clp(c.pend)}</strong>
        <em>${pct(c.pct)}%</em>
      </div>
    `).join("");

    const informesPublicados = reps.length
      ? reps.slice(0,4).map(r=>`
        <div class="presReportPublishedItem">
          <div class="presReportPublishedIcon">${svgIcon("file")}</div>
          <div>
            <b>${esc(r.period || "Informe")}</b>
            <span>Publicado ${esc(r.generatedAtHuman || r.generatedAt || "")}</span>
          </div>
          <button type="button" onclick="openReportApoderado('${esc(r.period||"")}')">Descargar PDF</button>
        </div>
      `).join("")
      : `<div class="presReportPublishedEmpty">${svgIcon("file")}<span>Sin informes publicados.</span></div>`;

    const informeVisualHTML = `
      <section class="presReportsExecutive">
        <div class="presReportsExecHeader">
          <div>
            <h2>Informe ejecutivo del curso</h2>
            <p>Estado actual · Periodo: <b>${esc(ym)}</b></p>
          </div>
          <div class="presReportsActions">
            <button type="button" onclick="printCurrentInforme()">${svgIcon("file")} Descargar PDF</button>
            <button type="button" onclick="shareExecutiveWhatsApp()">${svgIcon("users")} Enviar informe al grupo</button>
          </div>
        </div>
        <div class="presReportsKpiGrid">
          ${reportKpi("dollar","Cobrado mes", clp(recMes), `${porcentajeCobrado}% del total`, "#6d28d9", porcentajeCobrado)}
          ${reportKpi("arrowUp","Por cobrar", clp(pendienteMes), `${porcentajePorCobrar}% del total`, "#22c55e", porcentajePorCobrar)}
          ${reportKpi("arrowDown","Gastado mes", clp(gasMes), `${porcentajeGastado}% del ingreso`, "#3b82f6", porcentajeGastado)}
          ${reportKpi("users","Deudores mes", String(Number(deudMes||0)), "Obligatorias", "#f59e0b", deudMes ? 100 : 0)}
        </div>
      </section>

      <section class="presReportsTwoCols">
        <article class="presReportsCard">
          <h3>Cumplimiento del mes</h3>
          <p>Recaudado vs Proyección</p>
          <div class="presReportFulfillment">
            ${informeDonut(porcentajeCobrado, "#6d28d9", `<b>${pct(porcentajeCobrado)}%</b><span>Recaudado</span>`)}
            <div class="presReportLegend">
              <span><i></i>Recaudado <b>${clp(recMes)}</b></span>
              <span><i class="pending"></i>Pendiente <b>${clp(pendienteMes)}</b></span>
              <span>Meta del mes <b>${clp(totalProyectadoMes)}</b></span>
            </div>
          </div>
        </article>

        <article class="presReportsCard">
          <h3>Cuadratura del periodo</h3>
          <p>Mes actual</p>
          <div class="presReportBalance">
            <div><span>Saldo inicial</span><b>${clp(saldoInicial)}</b></div>
            <div><span>+ Ingresos del mes</span><b class="ok">${clp(recMes)}</b></div>
            <div><span>- Gastos del mes</span><b class="danger">${clp(gasMes)}</b></div>
            <div class="total"><span>Saldo final</span><b>${clp(saldoFinal)}</b></div>
          </div>
          <div class="presReportOk">${svgIcon("check")} ${cuadraturaOk ? "Cuadratura OK" : "Revisar cuadratura"}</div>
        </article>
      </section>

      <section class="presReportsCard presReportsCampaigns">
        <div>
          <h3>Recaudado por campañas activas</h3>
          <p>Distribución del pendiente por campaña</p>
        </div>
        <div class="presReportCampaignLayout">
          ${informeDonut(totalPendienteCampanas ? 100 : 0, "#6d28d9", `<span>Total por cobrar</span><b>${clp(totalPendienteCampanas)}</b>`, "presReportDonut campaign")}
          <div class="presReportCampaignRanking">
            ${campaignRows || `<div class="presReportEmptyLine">No hay campañas activas con pendiente.</div>`}
            <button type="button" onclick="window.go('campanas')">Ver todas las campañas activas →</button>
          </div>
        </div>
      </section>

      <section class="presReportsCard">
        <h3>Evolución semanal</h3>
        <p>Recaudado vs Proyección últimas 6 semanas</p>
        ${lineChart(weeklyRows())}
      </section>
    `;

    app.innerHTML = `
      <section class="presReportsScreen">
        <header class="presReportsTitle">
          <h1>Informes</h1>
          <p>Estado financiero y cuadratura del curso.</p>
        </header>

        ${isDirty()?`
          <section class="presReportsOutdated">
            <div class="presReportsOutdatedIcon">${svgIcon("file")}</div>
            <div>
              <h2>Informe desactualizado</h2>
              <p>Hubo cambios posteriores al último informe. Publica uno nuevo para dejar un corte oficial.</p>
            </div>
            <button type="button" onclick="confirmGenerateReport()">Actualizar y publicar</button>
          </section>
        `:""}

        <div id="informeRoot">${informeVisualHTML}</div>

        <section class="presReportsCard presReportsPublished">
          <h3>Informes mensuales publicados</h3>
          <p>Últimos informes publicados (cortes oficiales).</p>
          <div class="presReportsPublishedList">${informesPublicados}</div>
        </section>
      </section>

      <style>
        .presReportsScreen{display:grid;gap:16px;padding-bottom:150px;}
        .presReportsTitle h1{margin:0;color:#0f172a;font-size:30px;line-height:1.05;font-weight:850;}
        .presReportsTitle p{margin:6px 0 0;color:#64748b;font-size:15px;font-weight:650;}
        .presReportsOutdated,.presReportsExecutive,.presReportsCard{background:#fff;border:1px solid rgba(226,232,240,.95);border-radius:24px;box-shadow:0 14px 36px rgba(15,23,42,.06);}
        .presReportsOutdated{display:grid;grid-template-columns:58px minmax(0,1fr) auto;gap:14px;align-items:center;padding:18px;}
        .presReportsOutdatedIcon,.presReportKpiIcon,.presReportPublishedIcon{display:inline-flex;align-items:center;justify-content:center;background:#f1eafe;color:#6d28d9;border-radius:18px;}
        .presReportsOutdatedIcon{width:54px;height:54px;}
        .presReportsOutdatedIcon svg,.presReportKpiIcon svg,.presReportPublishedIcon svg{width:26px;height:26px;}
        .presReportsOutdated h2,.presReportsExecHeader h2,.presReportsCard h3{margin:0;color:#0f172a;font-size:19px;font-weight:850;line-height:1.1;}
        .presReportsOutdated p,.presReportsExecHeader p,.presReportsCard p{margin:6px 0 0;color:#64748b;font-size:14px;font-weight:650;line-height:1.35;}
        .presReportsOutdated button{height:48px;border:0;border-radius:16px;background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;font-weight:850;padding:0 18px;white-space:nowrap;}
        .presReportsExecutive{padding:18px;display:grid;gap:18px;}
        .presReportsExecHeader{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;}
        .presReportsActions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;}
        .presReportsActions button{height:44px;border:1px solid rgba(124,58,237,.35);border-radius:15px;background:#fff;color:#6d28d9;font-weight:850;padding:0 14px;display:inline-flex;align-items:center;gap:8px;}
        .presReportsActions svg{width:18px;height:18px;}
        .presReportsKpiGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;}
        .presReportKpi{border:1px solid rgba(226,232,240,.95);border-radius:18px;padding:14px;min-width:0;}
        .presReportKpiIcon{width:42px;height:42px;color:var(--accent);}
        .presReportKpiLabel{margin-top:10px;color:#475569;font-size:12px;font-weight:850;}
        .presReportKpiValue{margin-top:4px;color:#0f172a;font-size:23px;line-height:1.05;font-weight:900;white-space:nowrap;}
        .presReportKpiSub{margin-top:6px;color:#64748b;font-size:12px;font-weight:650;}
        .presReportKpiBar{margin-top:12px;height:9px;border-radius:999px;background:#eef2f7;overflow:hidden;}
        .presReportKpiBar span{display:block;height:100%;border-radius:999px;background:var(--accent);}
        .presReportsTwoCols{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
        .presReportsCard{padding:18px;}
        .presReportFulfillment,.presReportCampaignLayout{display:grid;grid-template-columns:220px minmax(0,1fr);gap:18px;align-items:center;margin-top:16px;}
        .presReportDonut{position:relative;width:190px;height:190px;display:grid;place-items:center;}
        .presReportDonut svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg);}
        .presReportDonut circle{fill:none;stroke-width:15;}
        .presReportDonut .track{stroke:#eef2f7;}
        .presReportDonut .fill{stroke:var(--c);stroke-linecap:round;stroke-dasharray:var(--p) 100;}
        .presReportDonutCenter{position:relative;z-index:1;text-align:center;color:#0f172a;display:grid;gap:2px;justify-items:center;}
        .presReportDonutCenter b{font-size:30px;line-height:1;font-weight:900;}
        .presReportDonutCenter span{color:#64748b;font-size:13px;font-weight:750;}
        .presReportDonut.campaign .presReportDonutCenter b{font-size:20px;}
        .presReportLegend{display:grid;gap:12px;color:#64748b;font-size:14px;font-weight:750;}
        .presReportLegend span{display:grid;grid-template-columns:14px minmax(0,1fr) auto;gap:9px;align-items:center;}
        .presReportLegend i,.presReportCampaignRow .dot{width:12px;height:12px;border-radius:50%;background:#6d28d9;display:inline-block;}
        .presReportLegend .pending{background:#e2e8f0;}
        .presReportLegend b{color:#0f172a;font-weight:900;}
        .presReportBalance{display:grid;gap:12px;margin-top:18px;}
        .presReportBalance div{display:flex;justify-content:space-between;gap:12px;color:#0f172a;font-size:15px;}
        .presReportBalance span{color:#334155;font-weight:650;}
        .presReportBalance b{font-weight:900;}
        .presReportBalance .ok{color:#16a34a;}
        .presReportBalance .danger{color:#ef4444;}
        .presReportBalance .total{border-top:1px dashed rgba(100,116,139,.35);padding-top:12px;}
        .presReportOk{margin-top:16px;background:#ecfdf5;border:1px solid rgba(34,197,94,.20);border-radius:16px;color:#16a34a;font-weight:900;padding:14px 16px;display:flex;align-items:center;gap:10px;}
        .presReportOk svg{width:22px;height:22px;}
        .presReportsCampaigns{display:grid;gap:12px;}
        .presReportCampaignRow{display:grid;grid-template-columns:14px minmax(0,1fr) auto 58px;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid rgba(226,232,240,.9);}
        .presReportCampaignRow:nth-child(2) .dot{background:#3b82f6;}
        .presReportCampaignRow:nth-child(3) .dot{background:#94a3b8;}
        .presReportCampaignRow b{font-size:14px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .presReportCampaignRow strong{font-size:14px;color:#0f172a;}
        .presReportCampaignRow em{font-style:normal;justify-self:end;background:#f1eafe;color:#6d28d9;border-radius:999px;padding:7px 11px;font-size:13px;font-weight:900;}
        .presReportCampaignRanking button{margin-top:10px;border:0;background:transparent;color:#6d28d9;font-weight:850;padding:8px 0;}
        .presReportLineWrap{margin-top:14px;}
        .presReportLineWrap svg{width:100%;height:auto;overflow:visible;}
        .presReportLineWrap .grid{stroke:#e2e8f0;stroke-dasharray:4 4;fill:none;}
        .presReportLineWrap .projection{fill:none;stroke:#a78bfa;stroke-width:3;stroke-dasharray:7 6;}
        .presReportLineWrap .collected{fill:none;stroke:#5b21b6;stroke-width:3;}
        .presReportLineWrap .dot{fill:#a78bfa;}
        .presReportLineWrap .collectedDot{fill:#5b21b6;}
        .presReportLineWrap text{font-size:11px;fill:#64748b;font-weight:750;}
        .presReportLegend.compact{display:flex;justify-content:flex-end;gap:18px;margin-top:8px;}
        .presReportLegend.compact span{display:flex;gap:8px;}
        .presReportLegend .projectionKey{background:#a78bfa;}
        .presReportEmptyLine{padding:14px;border-radius:16px;background:#f8fafc;color:#64748b;font-size:14px;font-weight:700;}
        .presReportsPublishedList{display:grid;gap:10px;margin-top:14px;}
        .presReportPublishedItem{display:grid;grid-template-columns:46px minmax(0,1fr) auto;gap:12px;align-items:center;border:1px solid rgba(226,232,240,.95);border-radius:16px;padding:12px;}
        .presReportPublishedIcon{width:44px;height:44px;}
        .presReportPublishedItem b{display:block;font-size:15px;color:#0f172a;}
        .presReportPublishedItem span{display:block;margin-top:3px;font-size:12px;color:#64748b;font-weight:650;}
        .presReportPublishedItem button{height:40px;border:1px solid rgba(124,58,237,.35);border-radius:14px;background:#fff;color:#6d28d9;font-weight:850;padding:0 12px;}
        .presReportPublishedEmpty{display:flex;align-items:center;gap:12px;border-radius:16px;background:linear-gradient(135deg,rgba(124,58,237,.08),rgba(37,99,235,.04));padding:14px;color:#64748b;font-weight:750;}
        .presReportPublishedEmpty svg{width:22px;height:22px;color:#6d28d9;}
        @media (max-width:760px){
          .presReportsScreen{gap:14px;}
          .presReportsOutdated{grid-template-columns:52px 1fr;padding:16px;}
          .presReportsOutdated button{grid-column:1/-1;width:100%;}
          .presReportsExecHeader{display:grid;gap:12px;}
          .presReportsActions{justify-content:stretch;}
          .presReportsActions button{flex:1;min-width:0;font-size:12px;padding:0 10px;}
          .presReportsKpiGrid{grid-template-columns:1fr 1fr;}
          .presReportsTwoCols{grid-template-columns:1fr;}
          .presReportFulfillment,.presReportCampaignLayout{grid-template-columns:1fr;justify-items:center;}
          .presReportDonut{width:170px;height:170px;}
          .presReportCampaignRanking{width:100%;}
          .presReportCampaignRow{grid-template-columns:14px minmax(0,1fr) auto 54px;}
          .presReportPublishedItem{grid-template-columns:42px 1fr;}
          .presReportPublishedItem button{grid-column:2;width:max-content;}
        }
      </style>
    `;

    }catch(e){
      try{ console.error('Informe error:', e); }catch(_){}
      const msg = (e && (e.message||e.toString())) ? (e.message||e.toString()) : "Error desconocido";
      const stack = (e && e.stack) ? String(e.stack) : "";
      try{ localStorage.setItem("cursapp_last_informe_error", JSON.stringify({msg, stack, at: new Date().toISOString()})); }catch(_){}
      app.innerHTML = `
        <div class="warnBox">
          <div style="font-weight:950;">Error en Informe</div>
          <div class="muted" style="margin-top:6px;">En celular no existe F12. Copia el detalle de abajo y pégamelo aquí.</div>
          <div class="card" style="margin-top:12px;border:1px dashed rgba(0,0,0,.18);">
            <div style="font-weight:900;margin-bottom:8px;">Detalle</div>
            <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;white-space:pre-wrap;word-break:break-word;">${esc(msg)}${stack?`\n\n${esc(stack)}`:""}</div>
          </div>
          <div class="actions" style="margin-top:12px;gap:10px;flex-wrap:wrap;">
            <button class="btnx" onclick="(function(){try{const x=localStorage.getItem('cursapp_last_informe_error')||''; if(navigator.clipboard){navigator.clipboard.writeText(x);} else {prompt('Copia esto:', x);} }catch(_){}})()">Copiar detalle</button>
            <button class="btnx primary" onclick="window.go('home')">Volver</button>
          </div>
        </div>
      `;
    }

  }

  // ---- Informe: utilidades (PDF/print) ----
  window.viewExpenseAttachment = function(expenseId){
    const ex = expenses();
    const e = ex.find(x=>String(x.id)===String(expenseId));
    if(!e || !e.attachments || !e.attachments.length || !e.attachments[0].dataUrl){
      alert("No hay comprobante adjunto.");
      return;
    }
    const f = e.attachments[0];
    const w = window.open();
    const isImg = String(f.type||"").includes("image");
    w.document.write(`
      <html><head><title>Comprobante</title></head>
      <body style="margin:0;">
        ${isImg ? `<img src="${f.dataUrl}" style="width:100%;height:auto;display:block;" />`
               : `<iframe src="${f.dataUrl}" style="width:100%;height:100vh;border:0;"></iframe>`}
      </body></html>
    `);
  };

  
  // Imprime el informe actualmente visible (Apoderados/Directiva) tal como se ve en pantalla
  window.printCurrentInforme = function(){
    try{
      const root = document.getElementById("informeRoot");
      if(!root){ alert("No se encontró el informe en pantalla."); return; }
      const html = buildPrintShell(root.innerHTML);
      openPrintWindow(html);
    }catch(e){
      console.error(e);
      alert("No se pudo generar el PDF.");
    }
  };

  function buildPrintShell(inner){
    return `
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Informe Cursapp</title>
        <style>
          body{ font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial; margin: 24px; color:#111827; }
          .card{ border:1px solid rgba(0,0,0,.08); border-radius:18px; padding:14px; background:#fff; }
          .muted{ color:rgba(17,24,39,.6); }
          .big{ font-size:22px; font-weight:900; margin-top:6px; }
          .chipInfoPill{ display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:999px; font-weight:800; font-size:12px; border:1px solid rgba(0,0,0,.08); }
          .chipInfoPill.ok{ background:#ecfdf5; }
          .chipInfoPill.warn{ background:#fffbeb; }
          .chipInfoPill.danger{ background:#fef2f2; }
          .btnx{ display:none !important; } /* en PDF no mostramos botones */
          table{ width:100%; border-collapse:collapse; }
          th,td{ border-bottom:1px solid rgba(0,0,0,.08); padding:8px 6px; font-size:12px; text-align:left; }
          h1,h2,h3{ margin:0; }
          @media print{ body{ margin:0; } }
        </style>
      </head>
      <body>
        ${inner}
      </body>
      </html>
    `;
  }
window.shareExecutiveWhatsApp = shareExecutiveWhatsApp;
window.printExecutive = function(){
    const ym = currentYM();
    const html = buildExecutivePrintHTML(ym);
    openPrintWindow(html);
  };

  // PDF de informes publicados: reutiliza el mismo layout del "Informe Ejecutivo del Curso"
  // para que no existan diferencias entre el PDF y lo que se ve arriba.
  function openPrintWindow(html){
    // Reutiliza la misma ventana para evitar PDFs duplicados
    const w = window.open("", "cursapp_print");
    if(!w){ alert("No se pudo abrir la ventana de impresión. Revisa el bloqueador de popups."); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    // imprimir al cargar (una sola vez)
    setTimeout(()=>{ try{ w.print(); }catch(e){} }, 350);
  }
  function buildExecutivePrintHTML(ym){
    const recMes = collectedMonth(ym);
    const gasMes = spentMonth(ym);
    const porCobrarMes = pendingMonth(ym);
    const deudMes = deudoresMonth(ym);

    const recTotal = collectedCourse();
    const gasTotal = spentCourse();
    const saldo = recTotal - gasTotal;

    const cumplimientoBase = recMes + porCobrarMes;
    const cumplimientoPct = cumplimientoBase > 0 ? Math.round((recMes / cumplimientoBase) * 100) : 0;

    const health = (() => {
      if (saldo > 0 && cumplimientoPct >= 70) return { label: "🟢 Salud financiera: Buena", cls: "good" };
      if (saldo >= 0 && cumplimientoPct >= 40) return { label: "🟡 Salud financiera: Atención", cls: "warn" };
      return { label: "🔴 Salud financiera: Riesgo", cls: "risk" };
    })();

    const campRows = tasks()
      .filter(t=>t)
      .map(t=>{
        const rec = collectedTask(t.id);
        const gas = spentTask(t.id);
        const sal = rec - gas;
        const pend = pendingTaskEstimated(t);
        const meta = Number(t.goalTotal || 0);
        const tipo = String(t.type || "") === "monthly" ? "Mensual" : "Único";
        const part = t.mandatoryParticipation === false ? "Voluntaria" : "Obligatoria";
        return `
          <tr>
            <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;">
              <div style="font-weight:900;">${esc(t.title || "")}</div>
              <div class="small">${tipo} · ${part}</div>
            </td>
            <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${clp(rec)}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${clp(gas)}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:900;">${clp(sal)}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${clp(pend)}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${meta ? clp(meta) : "—"}</td>
          </tr>
        `;
      }).join("");

    const gastos = expenses()
      .slice()
      .sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")))
      .slice(0, 10)
      .map(g=>{
        const ambito = g.scope === "campaign"
          ? (tasks().find(t => t.id === g.campaignId)?.title || "Campaña")
          : "Curso";
        return `
          <tr>
            <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;">${esc(g.date || "")}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;">${esc(ambito)}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;">${esc(g.title || "")}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${clp(g.amount || 0)}</td>
          </tr>
        `;
      }).join("");

    const saldoInicial = 0;
    const saldoFinal = saldoInicial + recMes - gasMes;

    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Informe Directiva ${esc(ym)}</title>
          <style>
            body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;margin:24px;color:#0f172a;background:#fff;}
            .page{max-width:980px;margin:0 auto;}
            h1{margin:0;font-size:24px;} h2{margin:0 0 10px 0;font-size:18px;}
            .sub{color:#64748b;margin-top:6px;}
            .badge{display:inline-flex;align-items:center;padding:7px 12px;border-radius:999px;font-size:12px;font-weight:800;border:1px solid #d1d5db;background:#f8fafc;}
            .badge.good{background:#ecfdf5;border-color:#bbf7d0;} .badge.warn{background:#fffbeb;border-color:#fde68a;} .badge.risk{background:#fef2f2;border-color:#fecaca;}
            .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:16px;}
            .card{border:1px solid #e5e7eb;border-radius:16px;padding:14px;background:#fff;}
            .label{font-size:12px;color:#6b7280;} .value{font-size:28px;font-weight:900;margin-top:6px;}
            .section{margin-top:18px;} .small{font-size:12px;color:#64748b;margin-top:2px;}
            .rowline{display:flex;justify-content:space-between;gap:12px;padding:6px 0;}
            table{width:100%;border-collapse:collapse;margin-top:10px;} th{text-align:left;color:#64748b;padding:10px 8px;border-bottom:1px solid #cbd5e1;font-size:13px;} td{font-size:13px;}
            @media print{body{margin:0;}.page{max-width:none;}}
          </style>
        </head>
        <body>
          <div class="page">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;">
              <div>
                <h1>Informe Ejecutivo del Curso</h1>
                <div class="sub">Periodo: <b>${esc(ym)}</b> · Emitido: ${esc(new Date().toLocaleString("es-CL"))}</div>
              </div>
              <div class="badge ${health.cls}">${health.label}</div>
            </div>

            <div class="grid">
              <div class="card"><div class="label">Cobrado este mes</div><div class="value">${clp(recMes)}</div></div>
              <div class="card"><div class="label">Por cobrar este mes</div><div class="value">${clp(porCobrarMes)}</div><div class="small">Deudores del mes: <b>${Number(deudMes || 0)}</b></div></div>
              <div class="card"><div class="label">Cobrado total</div><div class="value">${clp(recTotal)}</div></div>
              <div class="card"><div class="label">Gastado total</div><div class="value">${clp(gasTotal)}</div></div>
              <div class="card"><div class="label">Saldo disponible</div><div class="value">${clp(saldo)}</div></div>
              <div class="card"><div class="label">Cumplimiento del mes</div><div class="value">${Math.max(0, Math.min(100, cumplimientoPct))}%</div></div>
            </div>

            <div class="section card">
              <h2>Cuadratura del periodo</h2>
              <div class="rowline"><span>Saldo inicial</span><b>${clp(saldoInicial)}</b></div>
              <div class="rowline"><span>+ Ingresos del mes</span><b>${clp(recMes)}</b></div>
              <div class="rowline"><span>- Gastos del mes</span><b>${clp(gasMes)}</b></div>
              <div class="rowline" style="margin-top:6px;padding-top:10px;border-top:1px dashed #cbd5e1;"><span><b>Saldo final</b></span><b>${clp(saldoFinal)}</b></div>
            </div>

            <div class="section card">
              <h2>Campañas</h2>
              <table>
                <thead>
                  <tr><th>Campaña</th><th style="text-align:right;">Recaudado</th><th style="text-align:right;">Gastado</th><th style="text-align:right;">Saldo</th><th style="text-align:right;">Pendiente</th><th style="text-align:right;">Meta</th></tr>
                </thead>
                <tbody>${campRows || `<tr><td colspan="6" style="padding:12px 8px;" class="small">Sin campañas registradas.</td></tr>`}</tbody>
              </table>
            </div>

            <div class="section card">
              <h2>Gastos recientes</h2>
              <table>
                <thead><tr><th>Fecha</th><th>Ámbito</th><th>Concepto</th><th style="text-align:right;">Monto</th></tr></thead>
                <tbody>${gastos || `<tr><td colspan="4" style="padding:12px 8px;" class="small">Sin gastos registrados.</td></tr>`}</tbody>
              </table>
            </div>

            <div class="sub" style="margin-top:18px;">Generado por Cursapp</div>
          </div>
        </body>
      </html>
    `;
  }

  
function buildSnapshotExecutivePrintHTML(rep){
    const ym = rep.period || "";
    const recTotal = Number((rep.recaudadoCurso ?? rep.recaudado) || 0);
    const gasTotal = Number(rep.gastadoCurso || 0);
    const saldo = Number((rep.disponibleCurso ?? (recTotal - gasTotal)) || 0);
    const pendTotal = Number((rep.pendienteCurso ?? rep.pendiente) || 0);

    const recMes = Number(rep.cobradoMes || 0);
    const gasMes = Number(rep.gastadoMes || 0);
    const porCobrarMes = Number(rep.porCobrarMes || 0);
    const deudMes = Number((rep.deudoresMes ?? rep.deudores) || 0);

    const ex = Array.isArray(rep.expenses) ? rep.expenses : [];
    const camps = Array.isArray(rep.campaigns) ? rep.campaigns : [];

    const rowsEx = ex.length ? ex.map(e=>{
      const scope = (e.scope==="campaign") ? (camps.find(c=>c.id===e.campaignId)?.title || "Campaña") : "Curso";
      return `<tr>
        <td>${esc(e.date||"")}</td>
        <td>${esc(scope)}</td>
        <td>${esc(e.title||"")}</td>
        <td style="text-align:right;">${clp(e.amount||0)}</td>
      </tr>`;
    }).join("") : `<tr><td colspan="4" style="opacity:.7;">Sin rendiciones</td></tr>`;

    const rowsCamp = camps.length ? camps.map(c=>{
      const sal = (Number(c.recaudado||0) - Number(c.gastado||0));
      return `<tr>
        <td>
          <div style="font-weight:800;">${esc(c.title||"")}</div>
          <div style="opacity:.75;font-size:12px;">${(c.kind==="monthly"?"Mensual":"Único")} · ${(c.participation==="mandatory"?"Obligatoria":"Voluntaria")}</div>
        </td>
        <td style="text-align:right;">${clp(c.recaudado||0)}</td>
        <td style="text-align:right;">${clp(c.gastado||0)}</td>
        <td style="text-align:right;font-weight:900;">${clp(sal)}</td>
      </tr>`;
    }).join("") : `<tr><td colspan="4" style="opacity:.7;">Sin campañas activas</td></tr>`;

    const css = `
      body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial; padding:18px; color:#0f172a;}
      h1{margin:0 0 6px 0; font-size:22px;}
      .muted{color:#64748b;}
      .grid{display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:14px;}
      .card{border:1px solid rgba(0,0,0,.08); border-radius:14px; padding:12px;}
      .label{font-size:12px; color:#6b7280;}
      .val{font-size:22px; font-weight:900; margin-top:6px;}
      table{width:100%; border-collapse:collapse; margin-top:10px;}
      th,td{padding:10px; border-bottom:1px solid rgba(0,0,0,.08); font-size:13px; text-align:left;}
      th{color:#6b7280; font-weight:800;}
    `;

    return `
      <html>
      <head><meta charset="utf-8"><style>${css}</style></head>
      <body>
        <h1>Informe Ejecutivo del Curso • ${esc(ym)}</h1>
        <div class="muted">Emitido: ${esc(rep.generatedAtHuman||rep.generatedAt||"")}</div>

        <div class="grid">
          <div class="card"><div class="label">Cobrado este mes</div><div class="val">${clp(recMes)}</div></div>
          <div class="card"><div class="label">Por cobrar este mes</div><div class="val">${clp(porCobrarMes)}</div><div class="muted" style="margin-top:6px;">Deudores (mes): ${esc(deudMes)}</div></div>
          <div class="card"><div class="label">Gastado este mes</div><div class="val">${clp(gasMes)}</div></div>
          <div class="card"><div class="label">Saldo disponible</div><div class="val">${clp(saldo)}</div></div>
          <div class="card"><div class="label">Cobrado total</div><div class="val">${clp(recTotal)}</div></div>
          <div class="card"><div class="label">Gastado total</div><div class="val">${clp(gasTotal)}</div></div>
          <div class="card"><div class="label">Pendiente total</div><div class="val">${clp(pendTotal)}</div></div>
          <div class="card"><div class="label">Generado por</div><div class="val" style="font-size:18px;">Cursapp</div></div>
        </div>

        <h2 style="margin-top:22px;font-size:16px;">Campañas activas (cuadratura)</h2>
        <table>
          <thead><tr><th>Campaña</th><th style="text-align:right;">Recaudado</th><th style="text-align:right;">Gastado</th><th style="text-align:right;">Saldo</th></tr></thead>
          <tbody>${rowsCamp}</tbody>
        </table>

        <h2 style="margin-top:22px;font-size:16px;">Gastos recientes</h2>
        <table>
          <thead><tr><th>Fecha</th><th>Ámbito</th><th>Concepto</th><th style="text-align:right;">Monto</th></tr></thead>
          <tbody>${rowsEx}</tbody>
        </table>
      </body>
      </html>
    `;
  }

function buildSnapshotPrintHTML(r){
    // Snapshot PDF (publicado): más completo y consistente con Directiva.
    const esc = (s)=>String(s??"").replace(/[&<>'"]/g,(c)=>({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[c]));
    const clp = (n)=>"$"+Number(n||0).toLocaleString("es-CL");

    const period = r.period || "";
    const genAt = r.generatedAt || "";

    // Totales
    const recTotal = Number(r.recaudadoCurso||0);
    const gasTotal = Number(r.gastadoCurso||0);
    const salTotal = Number(r.disponibleCurso||0);
    const penTotal = Number(r.pendienteCurso||0);
    const deuTotal = Number(r.deudores||0);

    // Si el snapshot trae métricas del mes, las mostramos (si no, se ocultan)
    const cobMes = Number(r.cobradoMes ?? r.recaudadoMes ?? 0);
    const proyMes = Number(r.proyeccionMes ?? r.porCobrarMesTarget ?? 0);
    const porCobMes = Number(r.porCobrarMes ?? (proyMes ? (proyMes - cobMes) : 0));
    const deuMes = Number(r.deudoresMes ?? r.deudoresMonth ?? 0);

    // Campañas (si el snapshot las guarda)
    const camps = Array.isArray(r.campaigns) ? r.campaigns : (Array.isArray(r.byCampaign) ? r.byCampaign : []);
    const campRows = camps.length ? camps.map(c=>{
      const title = esc(c.title||c.name||"Campaña");
      const pct = Math.max(0, Math.min(100, Number(c.pct ?? c.progress ?? 0)));
      const rec = Number(c.recaudado ?? c.collected ?? 0);
      const pen = Number(c.pendienteMes ?? c.pendingMonth ?? c.pendiente ?? 0);
      const goal = Number(c.objetivo ?? c.goal ?? c.target ?? 0);
      return `
        <div class="camp">
          <div class="row">
            <div class="ct">${title}</div>
            <div class="pct">${pct}%</div>
          </div>
          <div class="bar"><div class="fill" style="width:${pct}%;"></div></div>
          <div class="meta">Recaudado: <b>${clp(rec)}</b> · Pendiente mes: <b>${clp(pen)}</b> · Objetivo: <b>${clp(goal)}</b></div>
        </div>
      `;
    }).join("") : `<div class="muted" style="margin-top:8px;">Sin detalle por campaña en este snapshot.</div>`;

    const showMonth = !!(r.cobradoMes || r.recaudadoMes || r.proyeccionMes || r.porCobrarMes || r.deudoresMes);

    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Informe del Curso ${esc(period)}</title>
          <style>
            body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial; margin:24px; color:#0f172a;}
            h1{font-size:20px; margin:0;}
            .sub{color:#475569; margin-top:6px;}
            .grid{display:grid; grid-template-columns:repeat(2,1fr); gap:10px; margin-top:14px;}
            .k{border:1px solid #e2e8f0; border-radius:14px; padding:12px;}
            .k .t{color:#64748b; font-size:12px;}
            .k .v{font-weight:900; font-size:18px; margin-top:6px;}
            .section{margin-top:18px;}
            .st{font-weight:950; font-size:15px; margin-bottom:10px;}
            .muted{color:#64748b;}
            .camp{border:1px solid #e2e8f0; border-radius:14px; padding:12px; margin-top:10px;}
            .row{display:flex; justify-content:space-between; gap:10px; align-items:flex-start;}
            .ct{font-weight:900;}
            .pct{font-weight:950;}
            .bar{margin-top:10px; height:10px; background:#e2e8f0; border-radius:999px; overflow:hidden;}
            .fill{height:100%; background:#1d4ed8; border-radius:999px;}
            .meta{margin-top:8px; font-size:12px; color:#334155;}
            @media (max-width:520px){ .grid{grid-template-columns:1fr;} }
          </style>
        </head>
        <body>
          <h1>Informe del Curso · ${esc(period)}</h1>
          <div class="sub">Emitido: ${esc(genAt || new Date().toLocaleString("es-CL"))}</div>

          ${showMonth ? `
          <div class="section">
            <div class="st">Mes publicado</div>
            <div class="grid">
              <div class="k"><div class="t">Cobrado mes</div><div class="v">${clp(cobMes)}</div></div>
              <div class="k"><div class="t">Proyección mes</div><div class="v">${clp(proyMes)}</div></div>
              <div class="k"><div class="t">Por cobrar mes</div><div class="v">${clp(porCobMes)}</div></div>
              <div class="k"><div class="t">Deudores mes</div><div class="v">${Number(deuMes||0)}</div></div>
            </div>
          </div>` : ``}

          <div class="section">
            <div class="st">Totales del curso</div>
            <div class="grid">
              <div class="k"><div class="t">Recaudado total</div><div class="v">${clp(recTotal)}</div></div>
              <div class="k"><div class="t">Gastado total</div><div class="v">${clp(gasTotal)}</div></div>
              <div class="k"><div class="t">Saldo disponible</div><div class="v">${clp(salTotal)}</div></div>
              <div class="k"><div class="t">Pendiente total</div><div class="v">${clp(penTotal)}</div></div>
              <div class="k"><div class="t">Deudores</div><div class="v">${Number(deuTotal)}</div></div>
            </div>
            <div class="muted" style="margin-top:8px;font-size:12px;">*Este PDF es un snapshot (corte) del periodo publicado.</div>
          </div>

          <div class="section">
            <div class="st">Indicadores por campaña</div>
            ${campRows}
          </div>

          <div class="muted" style="margin-top:18px;">Generado por Cursapp</div>
        </body>
      </html>
    `;
  }


  // ----- Campaign actions (delegated to campaigns.js) -----
  window.openCreateCampaign = function () { Campaigns.openCreate(); };
  window.openEditCampaign = function (taskId) { Campaigns.openEdit(taskId); };
  window.openCloseCampaign = function () { Campaigns.openClose(() => activeTasks()); };

  // Mantener ELIMINAR campaña (activa) en Presidente
  
  // ✅ Publicar cobros (canónico): evita generar pagos "globales" que luego duplican montos.
  // Algunos handlers antiguos llamaban a window.publishCobros, por eso lo mantenemos como puente.
  window.publishCobros = function(taskId){
    if(typeof window.publishCobrosForTask === "function"){
      return window.publishCobrosForTask(taskId);
    }
    alert("No se pudo publicar (función no disponible).");
  };
// ----- Publicar cobros (genera pagos por apoderado aprobado) -----
  function endOfMonthISO(ym){
    const d = endOfMonthDate(ym);
    if(!d) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function addMonthsYM(ym, add){
    const y = parseInt(ym.slice(0,4),10);
    const m = parseInt(ym.slice(5,7),10);
    const base = (y*12 + (m-1)) + add;
    const ny = Math.floor(base/12);
    const nm = (base%12)+1;
    return `${ny}-${String(nm).padStart(2,'0')}`;
  }

  function paymentsForTask(taskId){
    return payments().filter(p=>p.fromTaskId===taskId);
  }

  function publishCobrosForTask(taskId){
    const t = tasks().find(x=>x.id===taskId);
    if(!t) return;
    const people = approvedApoderados();
    if(!people.length){
      alert('No hay apoderados aprobados para generar cobros.');
      return;
    }
    const existing = paymentsForTask(taskId);
    const byKey = new Set(existing.map(p=>`${p.apoderadoEmail||p.email||''}||${p.period||ymFromISO(p.dueDate)||''}||${p.installmentIndex||''}`));
    const out = payments().slice();
    const type = String(t.type||'single').toLowerCase();
    if(type==='monthly'){
      const startYM = ymFromISO(t.startDate||t.dueDate||currentYYYYMM());
      const months = Math.max(1, Number(t.months||1));
      for(let i=0;i<months;i++){
        const period = addMonthsYM(startYM, i);
        const dueDate = endOfMonthISO(period);
        const idx = i+1;
        people.forEach(e=>{
          const email = e.email || '';
          const key = `${email}||${period}||${idx}`;
          if(byKey.has(key)) return;
          out.unshift({
            id: uid('pay'), fromTaskId: t.id,
            concept: `${t.title} · Cuota ${idx}/${months}`,
            amount: Number(t.amount||0), status: 'pending', dueDate,
            period, installmentIndex: idx, apoderadoEmail: email,
            apoderadoName: e.apoderadoName||'', alumno: e.alumno||'',
            createdAt: new Date().toISOString()
          });
          byKey.add(key);
        });
      }
    } else {
      const period = ymFromISO(t.dueDate||t.startDate||currentYYYYMM());
      const dueDate = t.dueDate||endOfMonthISO(period);
      people.forEach(e=>{
        const email = e.email || '';
        const key = `${email}||${period}||1`;
        if(byKey.has(key)) return;
        out.unshift({
          id: uid('pay'), fromTaskId: t.id, concept: t.title,
          amount: Number(t.amount||0), status: 'pending', dueDate,
          period, installmentIndex: 1, apoderadoEmail: email,
          apoderadoName: e.apoderadoName||'', alumno: e.alumno||'',
          createdAt: new Date().toISOString()
        });
        byKey.add(key);
      });
    }
    save(KEY_PAYMENTS, out);
    markDirty();
    alert('Cobros publicados ✅');
    go('campanas');
  }

  window.publishCobrosForTask = publishCobrosForTask;
  window.publishCobros = publishCobrosForTask;

  // Eliminación productiva: Supabase conserva trazabilidad, anula cobros
  // pendientes y crea saldos a favor por los pagos ya abonados.
  window.deleteCampaign = async function(taskId){
    const t = tasks().find(x=>x.id===taskId);
    if(!t) return;
    if(t.closed){ alert("No se puede eliminar una campaña cerrada."); return; }
    if(isExpired(t)){ alert("No se puede eliminar una campaña caducada."); return; }

    const remoteId = String(t.supabaseId || t.campana_id || t.id || "").trim();
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(remoteId)){
      alert("No se puede eliminar: la campaña no está vinculada correctamente con Supabase.");
      return;
    }

    const msg = `¿Eliminar campaña "${t.title}"?\n\n` +
      `Los pagos realizados pasarán a saldo a favor.\n` +
      `Los cobros pendientes quedarán anulados.\n\n` +
      `La operación conservará la trazabilidad contable.`;
    if(!confirm(msg)) return;

    try{
      if(!window.CURSAPP_SUPABASE || typeof window.CURSAPP_SUPABASE.request !== "function"){
        throw new Error("Supabase no está disponible.");
      }
      const result = await window.CURSAPP_SUPABASE.request("rpc/eliminar_campana", {
        method:"POST",
        body:JSON.stringify({ p_campana_id: remoteId })
      });

      if(window.CURSAPP && typeof window.CURSAPP.hydrateOperationalFromSupabase === "function"){
        await window.CURSAPP.hydrateOperationalFromSupabase("campaign-soft-delete");
      }else{
        save(KEY_TASKS, tasks().filter(x=>String(x.supabaseId || x.campana_id || x.id) !== remoteId));
      }

      markDirty();
      const credits = Number(result && result.credits_created || 0);
      const cancelled = Number(result && result.payments_cancelled || 0);
      alert(`Campaña eliminada ✅\nCobros anulados: ${cancelled}\nSaldos a favor creados: ${credits}`);
      go("campanas");
    }catch(err){
      console.error("No se pudo eliminar campaña en Supabase", err);
      alert("No se pudo eliminar la campaña: " + (err && err.message ? err.message : String(err)));
    }
  };

  // ----- Publish report (monthly) -----
  window.confirmGenerateReport = function(){
    if(!confirm("¿Publicar informe mensual del curso?")) return;
    publishMonthly();
  };

  function publishMonthly(period){
    period = period || currentYM();
    if(!/^\d{4}-\d{2}$/.test(period)){
      alert("Formato inválido. Usa YYYY-MM");
      return;
    }

    // ✅ Snapshot: corte oficial (no cambia después)
    const s0 = readSession && readSession();
    const courseKey = activeCourseKey() || String(s0?.courseKey||"").trim() || "course";
    const id = `${courseKey}::${period}`;

    const list = normalizeTasks(tasks());
    const exAll = expenses();
    const paysAll = payments();

    // Métricas del mes (periodo publicado)
    const cobradoMes = collectedMonth(period);
    const gastadoMes = spentMonth(period);
    const porCobrarMes = pendingMonth(period);
    const deudoresMes = deudoresMonth(period);

    // Totales del curso (al momento de publicar)
    const recaudadoCurso = collectedCourse();
    const gastadoCurso = spentCourse();
    const disponibleCurso = recaudadoCurso - gastadoCurso;
    const pendienteCurso = pendingTotal();
    const deudores = deudoresCount();

    // Detalle por campañas (para PDF ejecutivo del snapshot)
    const campaigns = list.map(t=>{
      const kind = String(t.type||"single").toLowerCase()==="monthly" ? "monthly" : "single";
      const participation = (t.mandatoryParticipation === false) ? "voluntary" : "mandatory";

      const rec = collectedTask(t.id);
      const gas = spentTask(t.id);
      const sal = rec - gas;

      // Pendiente del mes (si aplica)
      let pendienteMes = 0;
      if(kind==="monthly"){
        // cuota del mes si el periodo cae dentro del rango
        const startYM = ymFromISO(t.startDate||t.dueDate||"");
        if(startYM){
          const months = Math.max(1, Number(t.months||1));
          // calcula índice relativo
          const sy = parseInt(startYM.slice(0,4),10), sm = parseInt(startYM.slice(5,7),10);
          const cy = parseInt(period.slice(0,4),10), cm = parseInt(period.slice(5,7),10);
          const idx = (cy - sy)*12 + (cm - sm) + 1;
          if(idx>=1 && idx<=months){
            // usa proyección del mes (ajustada por opted_out si existe)
            const people = approvedCount();
            let expected = Number(t.amount||0) * people;
            if(t.mandatoryParticipation === false){
              const opted = paysAll.filter(p=>p.fromTaskId===t.id && paymentStatusNorm(p)==='opted_out' && withinMonth(p.dueDate||p.period||'', period)).length;
              expected -= Math.min(opted, people) * Number(t.amount||0);
            }
            const paid = paysAll.filter(p=>p.fromTaskId===t.id && isPaid(p) && withinMonth((p.paidAt||p.paidDate||p.createdAt||p.dueDate||''), period)).reduce((s,p)=>s+Number(p.amount||0),0);
            pendienteMes = Math.max(0, expected - paid);
          }
        }
      }else{
        const dueYM = ymFromISO(t.dueDate||"");
        if(dueYM===period){
          const people = approvedCount();
          let expected = Number(t.amount||0) * people;
          if(t.mandatoryParticipation === false){
            const opted = paysAll.filter(p=>p.fromTaskId===t.id && paymentStatusNorm(p)==='opted_out' && withinMonth(p.dueDate||p.period||'', period)).length;
            expected -= Math.min(opted, people) * Number(t.amount||0);
          }
          const paid = paysAll.filter(p=>p.fromTaskId===t.id && isPaid(p) && withinMonth((p.paidAt||p.paidDate||p.createdAt||p.dueDate||''), period)).reduce((s,p)=>s+Number(p.amount||0),0);
          pendienteMes = Math.max(0, expected - paid);
        }
      }

      const objetivo = expectedTaskTotal(t);
      const pct = objetivo>0 ? Math.max(0, Math.min(100, Math.round((rec/objetivo)*100))) : 0;

      return {
        id: t.id,
        title: t.title || "Campaña",
        kind,
        participation,
        amount: Number(t.amount||0),
        months: Math.max(1, Number(t.months||1)),
        objetivo,
        recaudado: rec,
        gastado: gas,
        saldo: sal,
        pendienteMes,
        pct,
        deudores: deudoresTask(t.id)
      };
    });

    // Gastos del mes (para PDF snapshot)
    const expensesMonth = exAll.filter(e=>String(e.date||"").startsWith(period)).slice(0, 40);

    const rep = {
      version: 4,
      id,
      courseKey,
      period,

      generatedAt: new Date().toISOString(),
      generatedAtHuman: new Date().toLocaleString("es-CL"),

      // Totales del curso (corte)
      recaudadoCurso,
      gastadoCurso,
      disponibleCurso,
      pendienteCurso,
      deudores,

      // Métricas del mes publicado
      cobradoMes,
      gastadoMes,
      porCobrarMes,
      deudoresMes,

      campaigns,
      expenses: expensesMonth
    };

    // Guardar sin duplicados (mismo id/period)
    const arr0 = load(KEY_MONTHLY_REPORTS, []);
    const arr = (arr0||[]).filter(x=>!(x && (String(x.id)===id || String(x.period)===period)));
    arr.unshift(rep);
    save(KEY_MONTHLY_REPORTS, arr.slice(0, 3));
    try{ if(window.createAviso){ window.createAviso({ type:"auto", category:"report", title:"📊 Nuevo informe disponible", message:`Ya puedes revisar el informe ${period}.`, createdAt:new Date().toISOString(), actionType:"open_report", dedupeKey:`report:${id||period}` }); } }catch(e){}

    clearDirty();
    try{ toast(`Informe publicado (${period}) ✅`); }catch(e){ alert(`Informe publicado (${period}) ✅`); }

    // refrescar vista
    renderInformes();
  }
  try{ debugPresidenteAlert("antes boot"); }catch(e){}

  window.configurarCurso = function(){
    try{ debugPresidenteAlert("click Configurar curso"); }catch(e){}
    try{ updatePresidentTopbar(); }catch(e){}
    return false;
  };
  window.openConfigurarCurso = window.configurarCurso;
  window.openCourseConfig = window.configurarCurso;

  // ----- boot -----
  // Cursapp Fase 1D.6: antes de renderizar, hidratar datos oficiales desde Supabase.
  // localStorage queda solo como caché técnica generada desde Supabase, no como fuente operacional.
  async function __bootPresidenteSupabaseFirst(){
    const DEMO_SEED = !!(window.CURSAPP && window.CURSAPP.DEMO_MODE);
    if (DEMO_SEED) ensureDemo();

    try{
      if(window.CURSAPP && typeof window.CURSAPP.clearOperationalCache === "function") window.CURSAPP.clearOperationalCache();
      if(window.CURSAPP && typeof window.CURSAPP.hydrateOperationalFromSupabase === "function"){
        await window.CURSAPP.hydrateOperationalFromSupabase("presidente-boot");
      }
    }catch(e){
      console.warn("Presidente: no se pudo hidratar Supabase antes del render", e);
    }

    initMenu();
    setInterval(()=>{
      if(state.tab!=="campanas") return;
      const sig = __tasksSig();
      if(sig && sig!==__TASKS_SIG){ __TASKS_SIG=sig; renderCampanas(); }
    }, 800);
    var __nextTab = (window.CURSAPP && typeof window.CURSAPP.consumeNextNavTab === "function")
      ? window.CURSAPP.consumeNextNavTab()
      : null;
    go(__nextTab || "home");
    try{ debugPresidenteAlert("después go home"); }catch(e){}
  }
  __bootPresidenteSupabaseFirst();
})();

window.openHelp = function(topic){
  const html =
    '<div class="card" style="max-height:70vh;overflow:auto;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">' +
        '<div style="font-weight:900;font-size:18px;">❓ Ayuda Presidente</div>' +
        '<button class="btn ghost" type="button" onclick="closeModal()">Cerrar</button>' +
      '</div>' +

      '<div style="margin-top:12px;line-height:1.45;">' +

        '<b>Campaña obligatoria</b>' +
        '<div class="muted">Todos los apoderados deben pagar. No existe “No participo”.</div>' +
        '<div style="height:10px;"></div>' +

        '<b>Campaña no obligatoria</b>' +
        '<div class="muted">Cada apoderado elige Participar o No participo. Solo los que participan cuentan en pendiente.</div>' +
        '<div style="height:10px;"></div>' +

        '<b>Deudores vs Cuotas pendientes</b>' +
        '<div class="muted"><b>Deudores</b> = cantidad de apoderados con deuda vigente. <b>Cuotas pendientes</b> = detalle de cuotas sin pagar.</div>' +
        '<div style="height:10px;"></div>' +

        '<b>Crear y publicar campaña</b>' +
        '<div class="muted">Crea la campaña, revisa monto/fechas y luego publícala. Al publicar, queda visible para apoderados.</div>' +
        '<div style="height:10px;"></div>' +

        '<b>Aprobación de apoderados</b>' +
        '<div class="muted">Los apoderados quedan “pendientes” hasta que el presidente los apruebe para ingresar al curso.</div>' +
        '<div style="height:10px;"></div>' +

        '<b>Cobranza (WhatsApp)</b>' +
        '<div class="muted">Usa la sección Deudores para copiar mensajes listos por apoderado y enviarlos.</div>' +
        '<div style="height:10px;"></div>' +

        '<b>Cierre de campaña</b>' +
        '<div class="muted">Cierra manualmente indicando motivo (meta cumplida, fin de plazo, error, etc.).</div>' +

      '</div>' +
    '</div>';

  if (typeof openModal === "function") openModal(html);
  else alert("Ayuda Presidente: revisa campañas, deudores y cobranza.");
};
// --- Ayuda Presidente (misma UX que Apoderado) ---
(function () {
  function esc(s){
    return String(s ?? "").replace(/[&<>'"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[c]));
  }

  // Si no existe openModal/closeModal, fallback suave
  function _open(html){
    if (typeof window.openModal === "function") return window.openModal(html);
    alert("Ayuda Presidente: revisa Campañas, Deudores e Informes.");
  }
  function _close(){
    if (typeof window.closeModal === "function") return window.closeModal();
    const mr = document.getElementById("modalRoot");
    if (mr) mr.innerHTML = "";
  }

  // Contenido FAQ Presidente (puedes ajustar texto)
  function buildFaqHTML(){
    const items = [
      ["¿Qué es una campaña obligatoria?", "Es un cobro del curso donde todos participan. No puedes excluirte."],
      ["¿Qué es una campaña no obligatoria?", "El apoderado elige Participar o No participo. Si elige No participo, ese cobro se excluye de su pendiente."],
      ["Deudores vs Cuotas pendientes", "Deudores = apoderados con deuda vigente. Cuotas pendientes = cantidad de cuotas impagas (detalle)."],
      ["Crear y publicar campaña", "Crea la campaña, revisa monto/fechas y publícala para que quede visible a apoderados."],
      ["Cobranza (WhatsApp)", "En Deudores puedes copiar un texto listo por apoderado y enviarlo."],
      ["Cierre de campaña", "Cierra manualmente e indica el motivo (meta cumplida, fin de plazo, error, etc.)."],
      ["Aprobación de apoderados", "Los apoderados quedan pendientes hasta que el presidente los apruebe para ingresar al curso."]
    ];

    let body = "";
    for (const [q,a] of items){
      body += `
        <div class="helpQ">${esc(q)}</div>
        <div class="helpA">${esc(a)}</div>
        <div class="helpSep"></div>
      `;
    }

    return `
      <div class="helpModal">
        <div class="helpHead">
          <div class="helpTitle">❓ Ayuda Presidente</div>
        </div>

        <div class="helpBody">
          ${body}
        </div>

        <div class="helpFoot">
          <button class="btn primary" type="button" onclick="window.__closeHelpPresident()">Cerrar</button>
        </div>
      </div>
    `;
  }

  // API pública igual a Apoderado
  window.__closeHelpPresident = _close;
  window.openHelp = function(topic){
    _open(buildFaqHTML());
  };

  // Si no existen estilos help*, los inyecta (para que se vea igual)
  (function ensureHelpStyles(){
    if (document.getElementById("helpStyles_v1")) return;
    const css = `
      .helpModal{ width:min(560px, 92vw); max-height:78vh; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 18px 40px rgba(0,0,0,.18); }
      .helpHead{ padding:14px 16px; border-bottom:1px solid rgba(0,0,0,.08); }
      .helpTitle{ font-weight:900; font-size:18px; }
      .helpBody{ padding:14px 16px; overflow:auto; max-height:56vh; -webkit-overflow-scrolling:touch; }
      .helpQ{ font-weight:800; font-size:16px; margin-top:10px; }
      .helpA{ color:rgba(0,0,0,.65); margin-top:6px; line-height:1.45; }
      .helpSep{ height:1px; background:rgba(0,0,0,.06); margin:12px 0; }
      .helpFoot{ padding:12px 16px; border-top:1px solid rgba(0,0,0,.08); display:flex; justify-content:flex-end; position:sticky; bottom:0; background:#fff; }
    `;
    const style = document.createElement("style");
    style.id = "helpStyles_v1";
    style.textContent = css;
    document.head.appendChild(style);
  })();
})();

/* Supabase Bridge retirado de presidente.js. La sincronización vive solo en /assets/core.js. */


/* Cursapp stable v10 · Presidente dashboard carousel + clickable inline actions */
(function(){
  if(window.__CURSAPP_PRESIDENTE_STABLE_V10__) return;
  window.__CURSAPP_PRESIDENTE_STABLE_V10__ = true;
  const st = document.createElement('style');
  st.id = 'cursappPresidentStableV10';
  st.textContent = `
    .cpV6President .cpV6HeroTrack{
      display:flex!important;
      flex-wrap:nowrap!important;
      gap:14px!important;
      overflow-x:auto!important;
      overflow-y:hidden!important;
      scroll-snap-type:none!important;
      scroll-behavior:auto!important;
      -webkit-overflow-scrolling:touch!important;
      touch-action:pan-x pan-y!important;
      padding:2px 4px 10px 4px!important;
      overscroll-behavior-x:contain!important;
    }
    .cpV6President .cpV6HeroTrack .cpV6HeroCard{
      flex:0 0 88%!important;
      width:auto!important;
      min-width:88%!important;
      max-width:88%!important;
      scroll-snap-align:none!important;
      scroll-snap-stop:normal!important;
    }
    .cpV6President .cpV6Dots{display:flex!important;}
    .cpV6President .cpV6HeroActions button,
    .cpV6President .cpV6QuickGrid button,
    .cpV6President .cpV6SoftBtn,
    .cpV6President .cpV6PrimaryBtn,
    .cpV6President .cpV6LinkBtn{pointer-events:auto!important;position:relative!important;z-index:2!important;}
    @media(min-width:760px){.cpV6President .cpV6HeroTrack .cpV6HeroCard{flex-basis:46%!important;min-width:46%!important;max-width:46%!important;}}
  `;
  document.head.appendChild(st);
})();


/* __CURSAPP_PRESIDENTE_V11_4_TESORERO_BLOQUEO_Y_ELIMINAR__ */


/* __CURSAPP_PRESIDENTE_V11_9_DASHBOARD_BANNER_STABLE__ */
(function(){
  if(window.__CURSAPP_PRESIDENTE_V11_9_DASHBOARD_BANNER_STABLE__) return;
  window.__CURSAPP_PRESIDENTE_V11_9_DASHBOARD_BANNER_STABLE__ = true;

  function inject(){
    if(document.getElementById('cursappPresidentV119DashboardBanner')) return;
    const st=document.createElement('style');
    st.id='cursappPresidentV119DashboardBanner';
    st.textContent=`
      .cpV6President .cpV6HeroTrack{
        scroll-snap-type:none!important;
        scroll-behavior:auto!important;
        overflow-x:auto!important;
        -webkit-overflow-scrolling:touch!important;
        overscroll-behavior-x:contain!important;
      }
      .cpV6President .cpV6HeroTrack .cpV6HeroCard{
        scroll-snap-align:none!important;
        scroll-snap-stop:normal!important;
      }
      .cpV6President [data-monetization-slot="presidente"]{
        display:block!important;
        min-height:0!important;
        contain:layout paint!important;
        overflow:hidden!important;
      }
      .cpV6President [data-monetization-slot="presidente"]:empty{
        display:none!important;
      }
    `;
    document.head.appendChild(st);
  }

  let lastLeft = 0;
  let userTouching = false;
  function bindTrack(){
    inject();
    const track=document.querySelector('.cpV6President .cpV6HeroTrack');
    if(!track || track.__cursappV119Bound) return;
    track.__cursappV119Bound = true;
    track.addEventListener('touchstart',()=>{userTouching=true;},{passive:true});
    track.addEventListener('touchend',()=>{setTimeout(()=>{userTouching=false; lastLeft=track.scrollLeft||0;},120);},{passive:true});
    track.addEventListener('scroll',()=>{ if(userTouching) lastLeft=track.scrollLeft||0; },{passive:true});
  }
  function tick(){ bindTrack(); }
  document.addEventListener('DOMContentLoaded', tick);
  window.addEventListener('load', tick);
  try{ new MutationObserver(tick).observe(document.body,{childList:true,subtree:true}); }catch(e){}
  setTimeout(tick, 300);
})();


/* __CURSAPP_PRESIDENTE_V11_11_HOME_NO_RERENDER_BANNER_NO_FLICKER__
   - Home Presidente no se vuelve a renderizar por dataChanged/dataUpdated.
   - Banner: no se recrea si ya existe en el slot.
   - Dashboard: no se fuerza scrollLeft en cada mutación del DOM.
*/
(function(){
  if(window.__CURSAPP_PRESIDENTE_V11_11_HOME_STABLE__) return;
  window.__CURSAPP_PRESIDENTE_V11_11_HOME_STABLE__ = true;

  function inject(){
    if(document.getElementById('cursappPresidentV1111Stable')) return;
    const st=document.createElement('style');
    st.id='cursappPresidentV1111Stable';
    st.textContent=`
      .cpV6President .cpV6HeroTrack{
        overflow-x:auto!important;
        overflow-y:hidden!important;
        scroll-snap-type:x mandatory!important;
        scroll-behavior:auto!important;
        -webkit-overflow-scrolling:touch!important;
        overscroll-behavior-x:contain!important;
        transform:translateZ(0)!important;
        will-change:auto!important;
      }
      .cpV6President .cpV6HeroTrack .cpV6HeroCard{
        scroll-snap-align:center!important;
        scroll-snap-stop:normal!important;
        transform:translateZ(0)!important;
        backface-visibility:hidden!important;
      }
      .cpV6President [data-monetization-slot="presidente"]{
        overflow-anchor:none!important;
        contain:layout paint!important;
      }
      .cpV6President [data-monetization-slot="presidente"] .cursappRetailSlot,
      .cpV6President [data-monetization-slot="presidente"] .cursappRetailBanner{
        transform:translateZ(0)!important;
        backface-visibility:hidden!important;
        will-change:auto!important;
      }
    `;
    document.head.appendChild(st);
  }

  function patchBannerRender(){
    try{
      if(!window.CursappMonetization || typeof window.CursappMonetization.render !== 'function') return;
      if(window.CursappMonetization.__presidenteV1111NoFlicker) return;
      const original = window.CursappMonetization.render.bind(window.CursappMonetization);
      window.CursappMonetization.render = function(){
        const slot = document.querySelector('.cpV6President [data-monetization-slot="presidente"]');
        const existing = slot && slot.querySelector('.cursappRetailSlot,.cursappRetailBanner');
        if(existing) return existing;
        return original();
      };
      window.CursappMonetization.__presidenteV1111NoFlicker = true;
    }catch(e){}
  }

  let dotTimer=null;
  function updateDotsOnly(){
    try{
      const track=document.querySelector('.cpV6President .cpV6HeroTrack');
      if(!track) return;
      const hero=track.closest('.cpV6Hero');
      const dots=hero ? Array.from(hero.querySelectorAll('.cpV6Dots span')) : [];
      const cards=Array.from(track.querySelectorAll('.cpV6HeroCard'));
      if(!dots.length || !cards.length) return;
      const center=track.scrollLeft + track.clientWidth/2;
      let best=0, dist=Infinity;
      cards.forEach((card,i)=>{
        const d=Math.abs((card.offsetLeft + card.offsetWidth/2)-center);
        if(d<dist){dist=d; best=i;}
      });
      dots.forEach((d,i)=>d.classList.toggle('active', i===best));
    }catch(e){}
  }
  function bindTrackPassive(){
    try{
      const track=document.querySelector('.cpV6President .cpV6HeroTrack');
      if(!track || track.__cursappV1111PassiveBound) return;
      track.__cursappV1111PassiveBound=true;
      track.addEventListener('scroll',()=>{
        clearTimeout(dotTimer);
        dotTimer=setTimeout(updateDotsOnly,90);
      },{passive:true});
      updateDotsOnly();
    }catch(e){}
  }

  function boot(){
    inject();
    patchBannerRender();
    bindTrackPassive();
    try{
      if(window.CursappMonetization && typeof window.CursappMonetization.render === 'function'){
        setTimeout(()=>{ try{ window.CursappMonetization.render(); }catch(e){} },160);
      }
    }catch(e){}
  }
  document.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('load', boot);
  window.addEventListener('pageshow', boot);
  setTimeout(boot,300);
})();
