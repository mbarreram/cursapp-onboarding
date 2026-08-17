(function(){
'use strict';
if(window.__MX_BANK_VERIFY_RETURN_V1__)return;window.__MX_BANK_VERIFY_RETURN_V1__=true;
const sb=window.CURSAPP_SUPABASE;
const u=new URL(location.href);
const requestId=u.searchParams.get('bank_verify_request');
const secret=u.searchParams.get('bank_verify_secret');
let ctx=null;
function parse(key){try{return JSON.parse(localStorage.getItem(key)||'{}')}catch(_){return {}}}
function storeCourse(courseKey,cursoId){if(!courseKey)return;localStorage.setItem('cursapp_active_course_v1',courseKey);const s=parse('cursapp_session_v1');s.courseKey=courseKey;s.course_key=courseKey;if(cursoId){s.courseId=cursoId;s.curso_id=cursoId}localStorage.setItem('cursapp_session_v1',JSON.stringify(s));const p=parse('cursapp_active_profile_v1');p.courseKey=courseKey;p.course_key=courseKey;if(cursoId){p.courseId=cursoId;p.curso_id=cursoId}localStorage.setItem('cursapp_active_profile_v1',JSON.stringify(p))}
async function loadContext(){if(!requestId||!secret||!sb?.functions?.invoke)return null;try{const r=await sb.functions.invoke('bank-verification-context',{body:{request_id:requestId,secret}});if(r.error)throw r.error;ctx=r.data||null;return ctx}catch(_){return null}}
function patchSuccess(){const card=document.querySelector('.mxBankModalCard');if(!card)return false;const title=card.querySelector('h2');if(!title||!String(title.textContent||'').includes('Cuenta verificada'))return false;const btn=card.querySelector('[data-ok]');if(!btn||btn.dataset.mxCourseReturn==='1')return true;btn.dataset.mxCourseReturn='1';if(ctx?.nombre){const p=card.querySelector('p');if(p)p.textContent='La cuenta quedó activa únicamente para '+ctx.nombre+'. No se comparte con otros cursos o colegios.'}
btn.onclick=()=>{document.querySelector('.mxBankModal')?.remove();if(ctx?.same_user&&ctx?.course_key){storeCourse(String(ctx.course_key),String(ctx.curso_id||''));location.replace('/presidente.html?mx_open_retiros=1')}else{location.replace('/presidente.html')}};return true}
function openRetirosIfRequested(){if(u.searchParams.get('mx_open_retiros')!=='1')return;let tries=0;const timer=setInterval(()=>{tries++;const buttons=[...document.querySelectorAll('button,[role="button"]')];const b=buttons.find(x=>String(x.dataset?.tab||'').toLowerCase()==='retiros'||String(x.textContent||'').trim().toLowerCase()==='retiros');if(b){clearInterval(timer);b.click();const cleanUrl=new URL(location.href);cleanUrl.searchParams.delete('mx_open_retiros');history.replaceState({},'',cleanUrl.pathname+cleanUrl.search+cleanUrl.hash)}else if(tries>30)clearInterval(timer)},150)}
async function boot(){if(requestId&&secret)await loadContext();const obs=new MutationObserver(()=>{if(patchSuccess())obs.disconnect()});obs.observe(document.body,{childList:true,subtree:true});patchSuccess();openRetirosIfRequested()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();