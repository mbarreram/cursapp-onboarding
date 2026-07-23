const sb=window.CURSAPP_SUPABASE;
const BUCKET='admin-banners';
const MAX_BYTES=5*1024*1024;
const TYPES=new Set(['image/jpeg','image/png','image/webp']);
const state=new WeakMap();

function injectStyles(){
  if(document.getElementById('adminBannerUploadCss'))return;
  const style=document.createElement('style');
  style.id='adminBannerUploadCss';
  style.textContent=`
    .bannerUploadBox{display:grid;gap:10px;border:1.5px dashed #c4b5fd;border-radius:18px;padding:14px;background:#faf7ff}
    .bannerUploadPick{display:flex;align-items:center;justify-content:center;gap:9px;min-height:48px;border:0;border-radius:14px;background:#ede9fe;color:#6d28d9;font-weight:900;cursor:pointer;text-align:center;padding:0 14px}
    .bannerUploadPick input{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none}
    .bannerUploadHelp{color:#64748b;font-size:12px;font-weight:750;line-height:1.4}
    .bannerUploadName{color:#334155;font-size:13px;font-weight:850;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .bannerUploadError{color:#b42318;font-size:12px;font-weight:850;min-height:16px}
    .commsLivePreview,.commsPreview{aspect-ratio:16/9!important;height:auto!important;min-height:0!important;max-height:280px!important;overflow:hidden!important}
    .commsLivePreview img,.commsPreview img{width:100%!important;height:100%!important;object-fit:cover!important;object-position:center!important}
    @media(max-width:720px){.commsLivePreview,.commsPreview{max-height:210px!important}}
  `;
  document.head.appendChild(style);
}

function extFor(file){
  if(file.type==='image/png')return'png';
  if(file.type==='image/webp')return'webp';
  return'jpg';
}

async function upload(file){
  if(!sb?.url||!sb?.getAccessToken)throw new Error('No se pudo inicializar Supabase Storage.');
  const token=await sb.getAccessToken();
  if(!token)throw new Error('La sesión administrativa expiró.');
  const safeId=crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const path=`${new Date().toISOString().slice(0,10)}/${safeId}.${extFor(file)}`;
  const response=await fetch(`${sb.url}/storage/v1/object/${BUCKET}/${path}`,{
    method:'POST',
    headers:{
      apikey:sb.publishableKey,
      Authorization:`Bearer ${token}`,
      'Content-Type':file.type,
      'x-upsert':'false'
    },
    body:file
  });
  const text=await response.text();
  if(!response.ok){
    let message=text;
    try{const data=JSON.parse(text);message=data.message||data.error||text}catch(_){ }
    throw new Error(message||'No se pudo subir la imagen.');
  }
  return `${sb.url}/storage/v1/object/public/${BUCKET}/${path}`;
}

function enhance(form){
  if(!form||form.dataset.bannerUploadReady==='1')return;
  const urlInput=form.elements.image_url;
  if(!urlInput)return;
  injectStyles();
  form.dataset.bannerUploadReady='1';
  urlInput.type='hidden';
  const field=urlInput.closest('.commsField');
  if(!field)return;
  const label=field.querySelector('label');
  if(label)label.textContent='Imagen del banner';
  const box=document.createElement('div');
  box.className='bannerUploadBox';
  box.innerHTML=`<label class="bannerUploadPick">📷 Elegir imagen desde el dispositivo<input type="file" accept="image/jpeg,image/png,image/webp"></label><div class="bannerUploadName">${urlInput.value?'Imagen actual cargada':'Ningún archivo seleccionado'}</div><div class="bannerUploadHelp">Formatos JPG, PNG o WebP · máximo 5 MB. La imagen se mostrará dentro de un marco 16:9 y se recortará al centro sin deformarse.</div><div class="bannerUploadError"></div>`;
  field.appendChild(box);
  const picker=box.querySelector('input[type=file]');
  const name=box.querySelector('.bannerUploadName');
  const error=box.querySelector('.bannerUploadError');
  const preview=form.querySelector('[data-preview] img');
  const data={file:null,objectUrl:null,uploaded:false};
  state.set(form,data);
  picker.addEventListener('change',()=>{
    error.textContent='';
    const file=picker.files?.[0]||null;
    data.file=null;data.uploaded=false;
    if(data.objectUrl){URL.revokeObjectURL(data.objectUrl);data.objectUrl=null}
    if(!file){name.textContent=urlInput.value?'Imagen actual cargada':'Ningún archivo seleccionado';return}
    if(!TYPES.has(file.type)){error.textContent='Formato no permitido. Usa JPG, PNG o WebP.';picker.value='';return}
    if(file.size>MAX_BYTES){error.textContent='La imagen supera el máximo de 5 MB.';picker.value='';return}
    data.file=file;
    name.textContent=`${file.name} · ${(file.size/1024/1024).toFixed(1)} MB`;
    data.objectUrl=URL.createObjectURL(file);
    if(preview){preview.src=data.objectUrl;preview.style.display='block'}
  });
}

const observer=new MutationObserver(()=>document.querySelectorAll('#bannerForm').forEach(enhance));
observer.observe(document.documentElement,{childList:true,subtree:true});
document.querySelectorAll('#bannerForm').forEach(enhance);

document.addEventListener('submit',async event=>{
  const form=event.target;
  if(!(form instanceof HTMLFormElement)||form.id!=='bannerForm')return;
  const data=state.get(form);
  if(!data?.file||data.uploaded)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const button=form.querySelector('.save');
  const error=form.querySelector('.bannerUploadError');
  const original=button?.textContent||'Guardar';
  if(button){button.disabled=true;button.textContent='Subiendo imagen…'}
  try{
    const url=await upload(data.file);
    form.elements.image_url.value=url;
    data.uploaded=true;
    if(button){button.disabled=false;button.textContent=original}
    form.requestSubmit(button||undefined);
  }catch(err){
    if(error)error.textContent=err?.message||String(err);
    if(button){button.disabled=false;button.textContent=original}
  }
},true);
