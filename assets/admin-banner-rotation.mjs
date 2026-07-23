const sb=window.CURSAPP_SUPABASE;
const auth=window.CURSAPP_ADMIN_AUTH;
const modal=document.getElementById('adminModal');
const $=(s,r=document)=>r.querySelector(s);
let editingBannerId=null;

function injectStyles(){
  if(document.getElementById('bannerRotationAdminCss'))return;
  const style=document.createElement('style');
  style.id='bannerRotationAdminCss';
  style.textContent=`
  .bannerCommercialGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .bannerCommercialNote{grid-column:1/-1;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:15px;padding:12px;color:#5b21b6;font-weight:750;line-height:1.4}
  .bannerWeightHelp{font-size:12px;color:#64748b;font-weight:750;line-height:1.35}
  @media(max-width:720px){.bannerCommercialGrid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function addCommercialFields(form){
  if(!form||form.dataset.rotationReady==='1')return;
  form.dataset.rotationReady='1';
  injectStyles();
  const actions=form.querySelector('.commsModalActions');
  if(!actions)return;
  const step=document.createElement('section');
  step.className='commsStep';
  step.innerHTML=`<h3>5. Plan comercial y frecuencia</h3><div class="bannerCommercialGrid">
    <div class="commsField"><label>Plan del banner</label><select name="campaign_tier"><option value="standard">Estándar</option><option value="featured">Destacado</option><option value="premium">Premium</option><option value="exclusive">Exclusivo</option></select></div>
    <div class="commsField"><label>Peso de aparición (1 a 10)</label><input type="number" name="rotation_weight" min="1" max="10" value="1"><div class="bannerWeightHelp">Un banner con peso 5 tendrá aproximadamente cinco veces más oportunidades que uno con peso 1.</div></div>
    <div class="commsField"><label>Máximo por usuario al día</label><input type="number" name="max_impressions_per_user_day" min="1" max="50" value="3"></div>
    <div class="commsField"><label>Máximo total (opcional)</label><input type="number" name="max_total_impressions" min="1" placeholder="Sin límite"></div>
    <div class="commsField"><label>Modo de rotación</label><select name="rotation_mode"><option value="weighted">Aleatoria ponderada</option><option value="sequential">Secuencial</option><option value="exclusive">Exclusiva</option></select></div>
    <div class="commsField"><label>Intervalo de rotación</label><select name="rotation_interval_seconds"><option value="8">8 segundos</option><option value="10" selected>10 segundos</option><option value="12">12 segundos</option><option value="15">15 segundos</option><option value="20">20 segundos</option></select></div>
    <div class="bannerCommercialNote">Se permiten hasta 6 banners activos. Los banners exclusivos desplazan temporalmente a los demás dentro de su segmentación y vigencia.</div>
  </div>`;
  actions.before(step);

  const id=editingBannerId;
  if(id){
    sb.request(`admin_banners?select=campaign_tier,rotation_weight,max_impressions_per_user_day,max_total_impressions,rotation_mode,rotation_interval_seconds&id=eq.${encodeURIComponent(id)}&limit=1`).then(rows=>{
      const b=rows?.[0];if(!b)return;
      for(const key of ['campaign_tier','rotation_weight','max_impressions_per_user_day','max_total_impressions','rotation_mode','rotation_interval_seconds']){
        if(form.elements[key]&&b[key]!=null)form.elements[key].value=String(b[key]);
      }
    }).catch(()=>{});
  }
}

const observer=new MutationObserver(()=>{
  const form=$('#bannerForm',modal);
  if(form)addCommercialFields(form);
});
observer.observe(modal,{childList:true,subtree:true});

document.addEventListener('click',e=>{
  const edit=e.target.closest?.('[data-edit-banner]');
  const copy=e.target.closest?.('[data-copy-banner]');
  const create=e.target.closest?.('#newBannerUx');
  if(edit)editingBannerId=edit.dataset.editBanner||null;
  else if(copy||create)editingBannerId=null;
},true);

document.addEventListener('submit',async e=>{
  const form=e.target;
  if(!(form instanceof HTMLFormElement)||form.id!=='bannerForm'||form.dataset.rotationHandled==='1')return;
  e.preventDefault();
  e.stopImmediatePropagation();
  form.dataset.rotationHandled='1';
  const save=form.querySelector('.save');
  if(save){save.disabled=true;save.textContent='Guardando…'}
  try{
    const mode=form.querySelector('input[name="scope_mode"]:checked')?.value||'global';
    const editing=!!editingBannerId;
    const payload={
      title:form.elements.title.value.trim(),message:form.elements.message.value.trim(),image_url:form.elements.image_url.value.trim()||null,target_url:form.elements.target_url.value.trim()||null,
      audience:form.querySelector('input[name="audience"]:checked')?.value||'all',placement:'dashboard',active:editing?undefined:true,
      priority:Number(form.elements.priority.value||0),sort_order:Number(form.elements.sort_order.value||0),starts_at:form.elements.starts_at.value?new Date(form.elements.starts_at.value).toISOString():new Date().toISOString(),ends_at:form.elements.ends_at.value?new Date(form.elements.ends_at.value).toISOString():null,
      colegio_id:mode==='global'?null:(form.elements.colegio_id.value||null),curso_id:mode==='curso'?(form.elements.curso_id.value||null):null,
      campaign_tier:form.elements.campaign_tier.value||'standard',rotation_weight:Number(form.elements.rotation_weight.value||1),max_impressions_per_user_day:Number(form.elements.max_impressions_per_user_day.value||3),max_total_impressions:form.elements.max_total_impressions.value?Number(form.elements.max_total_impressions.value):null,rotation_mode:form.elements.rotation_mode.value||'weighted',rotation_interval_seconds:Number(form.elements.rotation_interval_seconds.value||10),updated_at:new Date().toISOString()
    };
    if(payload.campaign_tier==='exclusive'){payload.rotation_mode='exclusive';payload.rotation_weight=10}
    if(editing){delete payload.active;await sb.request(`admin_banners?id=eq.${encodeURIComponent(editingBannerId)}`,{method:'PATCH',body:JSON.stringify(payload)})}
    else{payload.created_by=auth.user.id;await sb.request('admin_banners',{method:'POST',body:JSON.stringify(payload)})}
    modal.innerHTML='';editingBannerId=null;
    await window.Admin?.go?.('alertas');
  }catch(err){
    alert(err?.message||String(err));form.dataset.rotationHandled='0';if(save){save.disabled=false;save.textContent=editingBannerId?'Guardar cambios':'Publicar banner'}
  }
},true);
