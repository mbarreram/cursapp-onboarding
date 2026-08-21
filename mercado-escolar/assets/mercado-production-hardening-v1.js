(function(){
'use strict';
if(window.__MICURSOX_MERCADO_HARDENING_V1__) return;
window.__MICURSOX_MERCADO_HARDENING_V1__=true;

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BUCKET='mercado-escolar';
let editingPostId='';
let normalizing=false;

function client(){ return window.cursappSupabase || null; }
function toast(msg){
  const el=document.getElementById('toast');
  if(el){ el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),4200); }
  else alert(msg);
}
function waitClient(timeout=5000){
  return new Promise(resolve=>{
    const start=Date.now();
    const tick=()=>{ const sb=client(); if(sb) return resolve(sb); if(Date.now()-start>=timeout) return resolve(null); setTimeout(tick,100); };
    tick();
  });
}
function postIdFrom(el){
  if(!el) return '';
  const raw=String(el.dataset?.edit||el.dataset?.id||el.dataset?.postId||el.dataset?.publicacionId||'');
  if(UUID.test(raw)) return raw;
  const m=String(el.getAttribute?.('onclick')||'').match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  return m?m[0]:'';
}
function photoPath(url){
  try{
    const marker='/storage/v1/object/public/'+BUCKET+'/';
    const s=String(url||'');
    const i=s.indexOf(marker);
    return i>=0?decodeURIComponent(s.slice(i+marker.length).split('?')[0]):'';
  }catch(_){ return ''; }
}
async function replaceExistingPhotos(postId){
  const sb=client();
  if(!sb || !UUID.test(postId)) throw new Error('No se pudo preparar la edición de fotos.');
  const r=await sb.from('mercado_imagenes').select('id,url_imagen').eq('publicacion_id',postId);
  if(r.error) throw r.error;
  const rows=r.data||[];
  const paths=rows.map(x=>photoPath(x.url_imagen)).filter(Boolean);
  if(paths.length){
    const rm=await sb.storage.from(BUCKET).remove(paths);
    if(rm.error) throw rm.error;
  }
  if(rows.length){
    const del=await sb.from('mercado_imagenes').delete().eq('publicacion_id',postId);
    if(del.error) throw del.error;
  }
}
async function normalizeVigencias(){
  if(normalizing) return;
  normalizing=true;
  try{
    const sb=await waitClient();
    if(!sb?.rpc) return;
    const r=await sb.rpc('mercado_normalizar_vigencias');
    if(r?.error) return;
    setTimeout(()=>{ try{ window.CursappMarket?.reload?.(); }catch(_){} },250);
  }catch(_){} finally{ normalizing=false; }
}
function injectNotice(){
  const form=document.getElementById('publishForm');
  if(!form || document.getElementById('marketValidityNotice')) return;
  const box=document.createElement('div');
  box.id='marketValidityNotice';
  box.style.cssText='margin:0 0 12px;padding:12px 13px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;color:#475569;font-size:12px;line-height:1.4;font-weight:700';
  box.innerHTML='<b style="color:#0f172a">Vigencia del aviso: 30 días.</b><br>Al finalizar ese plazo deja de mostrarse como activo. Los destacados mantienen su propia vigencia de 7 días.';
  form.parentElement?.insertBefore(box,form);
}

document.addEventListener('click',e=>{
  const edit=e.target.closest?.('[data-edit]');
  if(edit){ const id=postIdFrom(edit); if(id) editingPostId=id; return; }
  const pub=e.target.closest?.('[data-view="publicar"]');
  if(pub) editingPostId='';
},true);

document.addEventListener('submit',async e=>{
  const form=e.target;
  if(!(form instanceof HTMLFormElement) || form.id!=='publishForm') return;
  const previews=form.querySelectorAll('.photoPreviewItem').length;
  const title=String(document.querySelector('#view-publicar h2')?.textContent||'').toLowerCase();
  const editing=!!editingPostId || title.includes('editar');

  if(!editing && previews===0){
    e.preventDefault(); e.stopImmediatePropagation();
    toast('Agrega al menos una foto real del producto antes de publicar.');
    document.getElementById('pubPhotos')?.focus();
    return;
  }

  if(editing && previews>0 && form.dataset.mxPhotosPrepared!=='1'){
    e.preventDefault(); e.stopImmediatePropagation();
    const id=editingPostId;
    if(!UUID.test(id)){
      toast('No se pudo identificar el aviso para reemplazar sus fotos.');
      return;
    }
    try{
      await replaceExistingPhotos(id);
      form.dataset.mxPhotosPrepared='1';
      form.requestSubmit();
    }catch(err){
      toast('No se pudieron reemplazar las fotos: '+(err?.message||'intenta nuevamente'));
    }
    return;
  }
  delete form.dataset.mxPhotosPrepared;
},true);

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>{ injectNotice(); normalizeVigencias(); },{once:true});
}else{
  injectNotice(); normalizeVigencias();
}
})();
