(function(){
'use strict';
const KEY='cursapp_bank_resume_v1';
const raw=localStorage.getItem(KEY);
if(!raw)return;
let resume=null;try{resume=JSON.parse(raw||'{}')}catch(_){resume=null}
if(!resume?.request_id)return;
if(Number(resume.created_at||0)&&Date.now()-Number(resume.created_at)>60*60*1000){localStorage.removeItem(KEY);return}
const sb=window.CURSAPP_SUPABASE;
if(!sb?.functions?.invoke)return;
document.documentElement.style.visibility='hidden';
function parse(key){try{return JSON.parse(localStorage.getItem(key)||'{}')}catch(_){return {}}}
function storeCourse(courseKey,cursoId){if(!courseKey)return;localStorage.setItem('cursapp_active_course_v1',courseKey);const s=parse('cursapp_session_v1');s.courseKey=courseKey;s.course_key=courseKey;if(cursoId){s.courseId=cursoId;s.curso_id=cursoId}s.currentRole='presidente';s.activeRole='presidente';s.role='presidente';localStorage.setItem('cursapp_session_v1',JSON.stringify(s));const p=parse('cursapp_active_profile_v1');p.courseKey=courseKey;p.course_key=courseKey;if(cursoId){p.courseId=cursoId;p.curso_id=cursoId}localStorage.setItem('cursapp_active_profile_v1',JSON.stringify(p));localStorage.setItem('cursapp_active_role_v1','presidente')}
async function run(){try{
  const r=await sb.functions.invoke('bank-verification-context',{body:{request_id:String(resume.request_id),resume:true}});
  if(r.error)throw r.error;
  const ctx=r.data||{};
  if(!ctx.course_key||!ctx.curso_id)throw new Error('No se pudo recuperar el curso de la verificación.');
  storeCourse(String(ctx.course_key),String(ctx.curso_id));
  localStorage.removeItem(KEY);
  location.replace('/presidente.html?mx_open_retiros=1&mx_bank_resume_done=1');
}catch(e){
  document.documentElement.style.visibility='';
  const msg=String(e?.message||e||'');
  if(/cuenta que solicitó|403|unauthorized|forbidden/i.test(msg)){
    setTimeout(()=>alert('Esta verificación pertenece a otra cuenta MiCursoX. Inicia sesión con el correo que recibió la verificación bancaria.'),50);
  }else{
    localStorage.removeItem(KEY);
  }
}}
run();
})();
