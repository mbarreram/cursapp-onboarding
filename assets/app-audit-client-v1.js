/* MiCursoX · Auditoría de interacción. Registra controles de UI, jamás campos, texto libre, URL ni credenciales. */
(function(){
 'use strict';
 if(window.__MX_ACTION_AUDIT_V1__)return;window.__MX_ACTION_AUDIT_V1__=true;
 const sb=()=>window.CURSAPP_SUPABASE;
 const role=()=>{const p=location.pathname.toLowerCase();return p.includes('admin')?'admin':p.includes('tesorero')?'tesorero':p.includes('presidente')?'presidente':p.includes('apoderado')?'apoderado':null};
 const tag=node=>{
  const chosen=node.closest('[data-tab],[data-action],button,a,[role="button"],[type="submit"]');
  if(!chosen)return null;
  if(chosen.matches('input,textarea,select,[contenteditable="true"]'))return null;
  let name=chosen.getAttribute('data-tab')||chosen.getAttribute('data-action')||chosen.id||chosen.getAttribute('type')||chosen.tagName.toLowerCase();
  if(name==='a'&&chosen.getAttribute('href')){try{name='link_'+new URL(chosen.getAttribute('href'),location.origin).pathname.split('/').pop()}catch(_){}}
  return String(name).replace(/[^a-zA-Z0-9_:-]/g,'').slice(0,100)||'control';
 };
 let queue=[],busy=false,ready=false;
 function push(type,target){
  if(!sb()?.request||!target)return;
  if(queue.length>=120)return;
  queue.push({type,target});
  schedule();
 }
 let scheduled=false;
 function schedule(){if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;drain()},1100)}
 async function drain(){
  if(busy||!queue.length||document.visibilityState==='hidden')return;
  busy=true;
  try{
   const item=queue[0];
   await sb().request('rpc/record_app_event',{method:'POST',body:JSON.stringify({p_event_type:item.type,p_target:item.target,p_curso_id:null,p_actor_role:role()})});
   queue.shift();ready=true;
  }catch(e){queue.shift();if(ready)console.warn('[MiCursoX] Audit unavailable',e?.message||e)}
  finally{busy=false;if(queue.length)schedule()}
 }
 document.addEventListener('click',e=>{const target=e.target?.closest?.('button,a,[role="button"],[data-tab],[data-action]');if(!target)return;const id=tag(target);if(id)push('button_click',id)},true);
 document.addEventListener('submit',e=>{const form=e.target;const id=String(form?.id||'form').replace(/[^a-zA-Z0-9_:-]/g,'').slice(0,100);push('form_submit',id)},true);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')drain()});
})();
