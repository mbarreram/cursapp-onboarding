/* MiCursoX · Auditoría de interacción. Registra controles de UI, jamás campos, texto libre, URL ni credenciales. */
(function(){
 'use strict';
 if(window.__MX_ACTION_AUDIT_V1__)return;window.__MX_ACTION_AUDIT_V1__=true;
 const sb=()=>window.CURSAPP_SUPABASE;
 const role=()=>{const p=location.pathname.toLowerCase();return p.includes('admin')?'admin':p.includes('tesorero')?'tesorero':p.includes('presidente')?'presidente':p.includes('apoderado')?'apoderado':null};
 const courseId=()=>{try{const a=JSON.parse(localStorage.getItem('cursapp_course_v1')||'{}');const b=JSON.parse(localStorage.getItem('cursapp_session_v1')||'{}');const id=a?.course?.id||a?.id||a?.curso_id||b?.courseId||b?.course?.id||'';return /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)?id:null}catch(_){return null}};
 const tag=node=>{
  const chosen=node.closest('[data-tab],[data-action],button,a,[role="button"],[type="submit"]');
  if(!chosen)return null;
  if(chosen.matches('input,textarea,select,[contenteditable="true"]'))return null;
  let name=chosen.getAttribute('data-tab')||chosen.getAttribute('data-action')||chosen.id||chosen.getAttribute('type')||(chosen.className&&typeof chosen.className==='string'?chosen.className.trim().split(/\s+/).slice(0,2).join('_'):'')||chosen.tagName.toLowerCase();
  if(name==='a'&&chosen.getAttribute('href')){try{name='link_'+new URL(chosen.getAttribute('href'),location.origin).pathname.split('/').pop()}catch(_){}}
  return String(name).replace(/[^a-zA-Z0-9_:-]/g,'').slice(0,100)||'control';
 };
 let queue=[],busy=false,ready=false,retryAfter=0;
 function push(type,target){
  if(!sb()?.request||!target)return;
  if(queue.length>=120)return;
  queue.push({type,target,event_id:crypto.randomUUID()});
  schedule();
 }
 let scheduled=false;
 function schedule(){if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;drain()},Math.max(1100,retryAfter-Date.now()))}
 async function drain(){
  if(busy||!queue.length||document.visibilityState==='hidden')return;
  busy=true;
  try{
   const batch=queue.slice(0,25).map(item=>({type:item.type,target:item.target,course_id:courseId(),role:role()}));
   const response=await sb().functions.invoke('audit-ingest-v1',{body:{events:batch.map((e,i)=>({...e,event_id:queue[i].event_id}))}});
   if(response.error||!response.data?.ok)throw new Error(response.error?.message||response.data?.error||'audit_ingest_unconfirmed');
   queue.splice(0,batch.length);ready=true;retryAfter=0;
  }catch(e){
   // Keep events in memory and back off on delivery failure. Never acknowledge failed batches.
   retryAfter=Date.now()+30000;
   if(ready)console.warn('[MiCursoX] Audit unavailable',e?.message||e)
  }
  finally{busy=false;if(queue.length)schedule()}
 }
 document.addEventListener('click',e=>{const target=e.target?.closest?.('button,a,[role="button"],[data-tab],[data-action]');if(!target)return;const id=tag(target);if(id)push('button_click',id)},true);
 document.addEventListener('submit',e=>{const form=e.target;const id=String(form?.id||'form').replace(/[^a-zA-Z0-9_:-]/g,'').slice(0,100);push('form_submit',id)},true);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')drain()});
})();
