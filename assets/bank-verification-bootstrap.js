(function(){
'use strict';
const u=new URL(location.href);
const requestId=u.searchParams.get('bank_verify_request');
const secret=u.searchParams.get('bank_verify_secret');
if(!requestId||!secret)return;
const booted=u.searchParams.get('mx_bank_bootstrapped');
if(booted===requestId)return;
const style=document.createElement('style');style.id='mxBankBootstrapCss';style.textContent='html.mx-bank-bootstrap body>*{visibility:hidden!important}html.mx-bank-bootstrap body::before{content:"Abriendo el curso de la verificación…";visibility:visible!important;position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:#f8fafc;color:#0f172a;font:800 18px system-ui,-apple-system,sans-serif;z-index:2147483647;text-align:center}';document.head.appendChild(style);document.documentElement.classList.add('mx-bank-bootstrap');
const sb=window.CURSAPP_SUPABASE;
function parse(key){try{return JSON.parse(localStorage.getItem(key)||'{}')}catch(_){return {}}}
function storeCourse(courseKey,cursoId){if(!courseKey)return;localStorage.setItem('cursapp_active_course_v1',courseKey);const s=parse('cursapp_session_v1');s.courseKey=courseKey;s.course_key=courseKey;if(cursoId){s.courseId=cursoId;s.curso_id=cursoId}localStorage.setItem('cursapp_session_v1',JSON.stringify(s));const p=parse('cursapp_active_profile_v1');p.courseKey=courseKey;p.course_key=courseKey;if(cursoId){p.courseId=cursoId;p.curso_id=cursoId}localStorage.setItem('cursapp_active_profile_v1',JSON.stringify(p))}
async function run(){try{if(!sb?.functions?.invoke)throw new Error('Supabase no disponible');const r=await sb.functions.invoke('bank-verification-context',{body:{request_id:requestId,secret}});if(r.error)throw r.error;const ctx=r.data||{};if(ctx.same_user&&ctx.course_key){storeCourse(String(ctx.course_key),String(ctx.curso_id||''));u.searchParams.set('mx_bank_bootstrapped',requestId);location.replace(u.pathname+'?'+u.searchParams.toString()+u.hash);return}document.documentElement.classList.remove('mx-bank-bootstrap')}catch(_){document.documentElement.classList.remove('mx-bank-bootstrap')}}
run();
})();