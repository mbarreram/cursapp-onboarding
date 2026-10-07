(function(){
'use strict';
if(window.__MICURSOX_PRESIDENT_HELP_V1__) return;
window.__MICURSOX_PRESIDENT_HELP_V1__=true;

function read(k,d){try{return JSON.parse(localStorage.getItem(k)||'')||d}catch(_){return d}}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function scoped(base){
  try{if(window.CURSAPP&&typeof window.CURSAPP.scopedKey==='function')return window.CURSAPP.scopedKey(base)}catch(_){}
  const ck=String(localStorage.getItem('cursapp_active_course_v1')||'').trim();
  return ck?'cursapp_'+ck+'_'+base:'cursapp_'+base;
}
function currentCourse(){
  const one=read('cursapp_course_v1',null);
  const c=one?.course||one||{};
  return c;
}
function tasks(){
  const a=read(scoped('tasks_v1'),[]);
  return Array.isArray(a)?a:[];
}
function enrollments(){
  const a=read(scoped('enrollments_v1'),read('cursapp_enrollments_v1',[]));
  return Array.isArray(a)?a:[];
}
function totalStudents(){
  const c=currentCourse();
  return Math.max(0,Number(c.totalAlumnos||c.total_alumnos||c.students||0)||0);
}
function registeredGuardians(){
  return enrollments().filter(e=>String(e.status||'').toLowerCase()!=='eliminado').length;
}
function campaignCount(){
  return tasks().filter(t=>!t.deleted && String(t.status||t.estado||'').toLowerCase()!=='eliminada').length;
}
function close(){document.getElementById('mxPresidentHelpV1')?.remove()}
function go(hash){
  close();
  if(hash==='/apoderados.html'||hash==='apoderados'){location.href='/apoderados.html';return}
  if(hash==='retiros'){
    if(window.MX_DIRECTIVA_FUNDS&&typeof window.MX_DIRECTIVA_FUNDS.open==='function'){window.MX_DIRECTIVA_FUNDS.open();return}
    const funds=document.querySelector('[data-mx-funds="1"]');if(funds){funds.click();return}
  }
  if(hash==='avisos'){
    document.getElementById('cnOverlay')?.remove();
    document.getElementById('npOverlay')?.remove();
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        if(typeof window.openAvisosConfigReal==='function'){window.openAvisosConfigReal();return}
        if(typeof window.openAvisosConfig==='function'){window.openAvisosConfig();return}
        if(typeof window.openAvisosCursoSendModal==='function'){window.openAvisosCursoSendModal();return}
        alert('Avisos aún se está cargando. Intenta nuevamente en unos segundos.');
      });
    });
    return;
  }
  if(typeof window.go==='function'){window.go(hash);return}
  try{
    if(window.CURSAPP&&typeof window.CURSAPP.setNextNavTab==='function')window.CURSAPP.setNextNavTab(hash);
    else{localStorage.setItem('cursapp_nav_tab_v1',String(hash));localStorage.setItem('cursapp_nav_at_v1',String(Date.now()))}
  }catch(_){}
  location.href='/presidente.html';
}
function style(){
  if(document.getElementById('mxPresidentHelpStyleV1'))return;
  const s=document.createElement('style');s.id='mxPresidentHelpStyleV1';s.textContent=`
#mxPresidentHelpV1{position:fixed;inset:0;z-index:2147483100;background:rgba(15,23,42,.55);display:flex;align-items:flex-end;justify-content:center;padding:0}
#mxPresidentHelpV1 *{box-sizing:border-box}
.mxHelpSheet{width:min(720px,100%);max-height:92dvh;overflow:auto;background:#f8fafc;border-radius:28px 28px 0 0;padding:18px 16px max(24px,env(safe-area-inset-bottom));box-shadow:0 -18px 60px rgba(15,23,42,.24)}
.mxHelpGrab{width:58px;height:6px;background:#dbe2ea;border-radius:999px;margin:0 auto 14px}
.mxHelpTop{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:2px 4px 14px}
.mxHelpTop h2{margin:0;font-size:25px;line-height:1.05;color:#0f172a;letter-spacing:-.4px}
.mxHelpTop p{margin:6px 0 0;color:#64748b;font-size:14px;font-weight:700;line-height:1.35}
.mxHelpClose{border:1px solid #e2e8f0;background:#fff;border-radius:16px;width:44px;height:44px;font-size:22px;color:#64748b;font-weight:900}
.mxHelpIntro{background:#eff6ff;border:1px solid #bfdbfe;border-radius:18px;padding:13px 14px;color:#1e3a8a;font-size:13px;font-weight:800;line-height:1.4;margin-bottom:14px}
.mxHelpProgress{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:12px 14px;margin-bottom:14px}
.mxHelpProgressBar{height:8px;flex:1;background:#eef2f7;border-radius:999px;overflow:hidden}.mxHelpProgressBar i{display:block;height:100%;background:#7c3aed;border-radius:999px}
.mxHelpProgress b{font-size:12px;color:#6d28d9;white-space:nowrap}
.mxHelpSectionTitle{font-size:15px;font-weight:950;color:#0f172a;margin:18px 4px 9px}
.mxHelpCard{width:100%;border:1px solid #e2e8f0;background:#fff;border-radius:18px;padding:13px 14px;display:grid;grid-template-columns:42px minmax(0,1fr) 26px;align-items:center;gap:11px;text-align:left;margin-bottom:9px;color:#0f172a}
.mxHelpNum{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:#ede9fe;color:#6d28d9;font-weight:950;font-size:16px}
.mxHelpCard strong{display:block;font-size:15px}.mxHelpCard small{display:block;color:#64748b;font-size:12px;font-weight:700;line-height:1.3;margin-top:3px}.mxHelpCard em{display:block;color:#7c3aed;font-style:normal;font-size:11px;font-weight:900;margin-top:5px}
.mxHelpChevron{font-size:25px;color:#94a3b8;text-align:center}
.mxHelpMore{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.mxHelpMini{border:1px solid #e2e8f0;background:#fff;border-radius:16px;padding:12px;min-height:92px;text-align:left}
.mxHelpMini span{font-size:22px}.mxHelpMini strong{display:block;margin-top:7px;font-size:13px;color:#0f172a}.mxHelpMini small{display:block;color:#64748b;font-size:11px;font-weight:700;margin-top:3px;line-height:1.3}
.mxHelpFooter{margin:16px 4px 0;color:#94a3b8;font-size:11px;font-weight:700;text-align:center}
@media(min-width:760px){#mxPresidentHelpV1{align-items:center;padding:24px}.mxHelpSheet{border-radius:28px;max-height:86dvh}.mxHelpMore{grid-template-columns:repeat(4,1fr)}}
`;document.head.appendChild(s)
}
function open(){
  close();style();
  const total=totalStudents(),reg=registeredGuardians(),camps=campaignCount();
  const steps=[total>0,reg>0,camps>0],done=steps.filter(Boolean).length,pct=Math.round(done/3*100);
  const school=String(currentCourse().schoolName||currentCourse().school||'Tu colegio');
  const course=[currentCourse().level,currentCourse().letter].filter(Boolean).join('')||'Tu curso';

  const root=document.createElement('div');root.id='mxPresidentHelpV1';
  root.innerHTML=`
    <div class="mxHelpSheet" role="dialog" aria-modal="true" aria-label="Ayuda y primeros pasos">
      <div class="mxHelpGrab"></div>
      <div class="mxHelpTop">
        <div><h2>Ayuda y primeros pasos</h2><p>Presidente · ${esc(school)} · ${esc(course)}</p></div>
        <button class="mxHelpClose" type="button" data-close>×</button>
      </div>
      <div class="mxHelpIntro">ℹ️ Te guiamos para dejar tu curso listo y aprovechar MiCursoX. Puedes entrar a esta ayuda cuando quieras, sin bloquear el uso normal de la app.</div>
      <div class="mxHelpProgress"><div class="mxHelpProgressBar"><i style="width:${pct}%"></i></div><b>${done}/3 esenciales</b></div>

      <div class="mxHelpSectionTitle">Empieza por aquí</div>
      <button class="mxHelpCard" type="button" data-go="apoderados">
        <span class="mxHelpNum">1</span><span><strong>Configura tu curso</strong><small>Revisa la información del curso y confirma el número total de alumnos.</small><em>${total>0?total+' alumnos configurados':'Pendiente de configurar'}</em></span><span class="mxHelpChevron">›</span>
      </button>
      <button class="mxHelpCard" type="button" data-go="apoderados">
        <span class="mxHelpNum">2</span><span><strong>Invita a los apoderados</strong><small>Comparte el enlace de invitación para que cada familia pueda registrarse.</small><em>${reg}${total?' de '+total:''} apoderados registrados</em></span><span class="mxHelpChevron">›</span>
      </button>
      <button class="mxHelpCard" type="button" data-go="campanas">
        <span class="mxHelpNum">3</span><span><strong>Crea tu primera campaña</strong><small>Configura una cuota, rifa, actividad o aporte voluntario desde la pantalla real de Campañas.</small><em>${camps>0?camps+' campaña'+(camps===1?'':'s')+' creada'+(camps===1?'':'s'):'Aún no tienes campañas'}</em></span><span class="mxHelpChevron">›</span>
      </button>

      <div class="mxHelpSectionTitle">Más funciones</div>
      <div class="mxHelpMore">
        <button class="mxHelpMini" data-go="deudores"><span>🕘</span><strong>Deudores</strong><small>Revisa pendientes y comparte estados de pago.</small></button>
        <button class="mxHelpMini" data-go="informes"><span>📊</span><strong>Informes</strong><small>Consulta el estado financiero del curso.</small></button>
        <button class="mxHelpMini" data-go="retiros"><span>💰</span><strong>Retiros</strong><small>Revisa recaudación y solicitudes.</small></button>
        <button class="mxHelpMini" data-go="avisos"><span>🔔</span><strong>Avisos</strong><small>Comunica novedades importantes al curso.</small></button>
      </div>
      <div class="mxHelpFooter">Esta guía es opcional. Puedes cerrarla y continuar trabajando normalmente.</div>
    </div>`;
  document.body.appendChild(root);
  root.addEventListener('click',e=>{
    if(e.target===root||e.target.closest('[data-close]')){close();return}
    const b=e.target.closest('[data-go]');if(!b)return;
    const target=b.dataset.go;
    if(target==='apoderados')go('/apoderados.html');else go(target);
  });
}
window.MICURSOX_PRESIDENT_HELP={open,close};
})();