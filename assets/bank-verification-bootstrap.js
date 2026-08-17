(function(){
'use strict';
const original=new URL(location.href);
const requestId=original.searchParams.get('bank_verify_request');
const secret=original.searchParams.get('bank_verify_secret');
if(!requestId||!secret)return;
const booted=original.searchParams.get('mx_bank_bootstrapped');
if(booted===requestId)return;
const style=document.createElement('style');style.id='mxBankBootstrapCss';style.textContent='html.mx-bank-bootstrap body>*{visibility:hidden!important}html.mx-bank-bootstrap body::before{content:"Abriendo el curso de la verificación…";visibility:visible!important;position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:#f8fafc;color:#0f172a;font:800 18px system-ui,-apple-system,sans-serif;z-index:2147483647;text-align:center}';document.head.appendChild(style);document.documentElement.classList.add('mx-bank-bootstrap');
// Oculta temporalmente los parámetros para que el flujo antiguo no consuma el token
// antes de que identifiquemos y activemos el curso exacto de la solicitud.
const neutral=new URL(original.href);neutral.searchParams.delete('bank_verify_request');neutral.searchParams.delete('bank_verify_secret');history.replaceState({},'',neutral.pathname+(neutral.search?'?'+neutral.searchParams.toString():'')+neutral.hash);
const sb=window.CURSAPP_SUPABASE;
function parse(key){try{return JSON.parse(localStorage.getItem(key)||'{}')}catch(_){return {}}}
function storeCourse(courseKey,cursoId){if(!courseKey)return;localStorage.setItem('cursapp_active_course_v1',courseKey);const s=parse('cursapp_session_v1');s.courseKey=courseKey;s.course_key=courseKey;if(cursoId){s.courseId=cursoId;s.curso_id=cursoId}localStorage.setItem('cursapp_session_v1',JSON.stringify(s));const p=parse('cursapp_active_profile_v1');p.courseKey=courseKey;p.course_key=courseKey;if(cursoId){p.courseId=cursoId;p.curso_id=cursoId}localStorage.setItem('cursapp_active_profile_v1',JSON.stringify(p))}
async function run(){try{if(!sb?.functions?.invoke)throw new Error('Supabase no disponible');const r=await sb.functions.invoke('bank-verification-context',{body:{request_id:requestId,secret}});if(r.error)throw r.error;const ctx=r.data||{};if(ctx.same_user&&ctx.course_key){storeCourse(String(ctx.course_key),String(ctx.curso_id||''));original.searchParams.set('mx_bank_bootstrapped',requestId);location.replace(original.pathname+'?'+original.searchParams.toString()+original.hash);return}document.documentElement.classList.remove('mx-bank-bootstrap');location.replace(original.pathname+'?'+original.searchParams.toString()+original.hash)}catch(_){document.documentElement.classList.remove('mx-bank-bootstrap');location.replace(original.pathname+'?'+original.searchParams.toString()+original.hash)}}
run();
})();