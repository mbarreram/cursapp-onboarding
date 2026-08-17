(function(){
'use strict';
const card=document.getElementById('verifyCard');
const sb=window.CURSAPP_SUPABASE;
const u=new URL(location.href);
const requestId=u.searchParams.get('bank_verify_request');
const secret=u.searchParams.get('bank_verify_secret');
const RESUME_KEY='cursapp_bank_resume_v1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function parse(key){try{return JSON.parse(localStorage.getItem(key)||'{}')}catch(_){return {}}}
function storeCourse(courseKey,cursoId){if(!courseKey)return;localStorage.setItem('cursapp_active_course_v1',courseKey);const s=parse('cursapp_session_v1');s.courseKey=courseKey;s.course_key=courseKey;if(cursoId){s.courseId=cursoId;s.curso_id=cursoId}localStorage.setItem('cursapp_session_v1',JSON.stringify(s));const p=parse('cursapp_active_profile_v1');p.courseKey=courseKey;p.course_key=courseKey;if(cursoId){p.courseId=cursoId;p.curso_id=cursoId}localStorage.setItem('cursapp_active_profile_v1',JSON.stringify(p))}
async function invoke(name,body){const r=await sb.functions.invoke(name,{body});if(r.error)throw r.error;return r.data||{}}
function clearWrongSessionContext(){['cursapp_active_course_v1','cursapp_session_v1','cursapp_active_profile_v1','cursapp_demo_user','cursapp_active_role_v1'].forEach(k=>localStorage.removeItem(k))}
function fail(message){card.innerHTML='<div class="logo">C</div><h1 class="title">No se pudo verificar</h1><div class="error">'+esc(message||'Ocurrió un error inesperado.')+'</div><button class="btn" type="button" id="closeVerify">Volver a MiCursoX</button>';document.getElementById('closeVerify').onclick=()=>location.replace('/index.html')}
async function run(){try{
  if(!requestId||!secret)throw new Error('El enlace de verificación está incompleto.');
  if(!sb?.functions?.invoke)throw new Error('No se pudo iniciar la verificación.');
  const ctx=await invoke('bank-verification-context',{request_id:requestId,secret});
  if(!ctx?.course_key||!ctx?.curso_id)throw new Error('No se pudo identificar el curso de esta solicitud.');
  if(ctx.same_user)storeCourse(String(ctx.course_key),String(ctx.curso_id));
  await invoke('secure-bank-account',{action:'verify_change',request_id:requestId,secret});
  const courseName=ctx.nombre||'el curso correspondiente';
  const wrongSession=!ctx.same_user;
  card.innerHTML='<div class="logo">C</div><h1 class="title">Cuenta verificada ✅</h1><p class="text">La cuenta quedó activa únicamente para este curso.</p><div class="course">'+esc(courseName)+'</div><p class="text" style="margin-top:14px">No se comparte con otros cursos o colegios.</p>'+(wrongSession?'<div class="error" style="margin-top:16px;color:#92400e;background:#fffbeb">En este navegador hay otra cuenta MiCursoX abierta. Para entrar a Retiros debes iniciar sesión con '+esc(ctx.requester_email_masked||'la cuenta que solicitó la verificación')+'.</div><button class="btn" type="button" id="continueVerify">Cambiar cuenta e ir a Retiros</button>':'<button class="btn" type="button" id="continueVerify">Continuar a Retiros</button>');
  document.getElementById('continueVerify').onclick=async()=>{
    if(!wrongSession){storeCourse(String(ctx.course_key),String(ctx.curso_id));location.replace('/presidente.html?mx_open_retiros=1');return;}
    localStorage.setItem(RESUME_KEY,JSON.stringify({request_id:requestId,created_at:Date.now()}));
    try{await sb.auth?.signOut?.()}catch(_e){}
    clearWrongSessionContext();
    location.replace('/index.html?mx_bank_resume=1');
  };
}catch(e){fail(e?.message||e)}}
run();
})();
