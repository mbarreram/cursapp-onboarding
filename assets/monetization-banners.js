(function(){
'use strict';
const sb=window.CURSAPP_SUPABASE;
let rows=[],current=null,timer=null,user=null,rendering=false;
const lastImpressionAt=new Map();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const role=()=>{const p=location.pathname.toLowerCase();if(p.includes('presidente'))return'presidente';if(p.includes('tesorero'))return'tesorero';return'apoderado'};
const readSession=()=>{try{return JSON.parse(localStorage.getItem('cursapp_session_v1')||'{}')}catch(_){return{}}};
const dayKey=()=>new Date().toISOString().slice(0,10);
const exposureKey=()=>`cursapp_banner_exposure_${dayKey()}`;
const lastKey=()=>`cursapp_banner_last_${role()}`;
function exposures(){try{return JSON.parse(localStorage.getItem(exposureKey())||'{}')}catch(_){return{}}}
function saveExposure(id){const x=exposures();x[id]=(x[id]||0)+1;localStorage.setItem(exposureKey(),JSON.stringify(x));localStorage.setItem(lastKey(),String(id))}
function allowed(b){
  const a=String(b.audience||'all').toLowerCase(),r=role(),s=readSession()||{},cursoId=String(s.cursoId||s.courseId||s.activeCourseId||''),colegioId=String(s.colegioId||s.schoolId||'');
  if(!(a==='all'||a==='todos'||a===r||(a==='directiva'&&(r==='presidente'||r==='tesorero'))))return false;
  if(b.curso_id&&cursoId&&String(b.curso_id)!==cursoId)return false;
  if(b.colegio_id&&colegioId&&String(b.colegio_id)!==colegioId)return false;
  const now=Date.now();if(b.starts_at&&Date.parse(b.starts_at)>now)return false;if(b.ends_at&&Date.parse(b.ends_at)<now)return false;
  if(b.max_total_impressions&&Number(b.impressions_count||0)>=Number(b.max_total_impressions))return false;
  const daily=exposures()[b.id]||0;if(daily>=Number(b.max_impressions_per_user_day||3))return false;
  return true;
}
async function track(type,b){
  try{
    user=user||await sb.getCurrentUser();
    await sb.request('admin_banner_events',{method:'POST',body:JSON.stringify({banner_id:b.id,user_id:user.id,event_type:type,role:role()})});
  }catch(_){ }
}
function registerImpression(b){
  const now=Date.now(),prev=lastImpressionAt.get(String(b.id))||0;
  if(now-prev<30000)return;
  lastImpressionAt.set(String(b.id),now);
  saveExposure(b.id);
  track('impression',b);
}
async function load(){
  if(!sb?.request)return[];
  try{
    const all=await sb.request('admin_banners?select=*&active=eq.true&order=priority.desc,sort_order.asc,created_at.desc');
    rows=(all||[]).filter(allowed).slice(0,6);
    return rows;
  }catch(e){console.warn('Banners Supabase',e);rows=[];return[]}
}
function weightedPick(pool){
  if(!pool.length)return null;
  const last=localStorage.getItem(lastKey());
  let candidates=pool.length>1?pool.filter(b=>String(b.id)!==String(last)):pool.slice();
  if(!candidates.length)candidates=pool.slice();
  const total=candidates.reduce((s,b)=>s+Math.max(1,Number(b.rotation_weight||1)),0);
  let n=Math.random()*total;
  for(const b of candidates){n-=Math.max(1,Number(b.rotation_weight||1));if(n<=0)return b}
  return candidates[candidates.length-1];
}
function nextBanner(){
  const exclusive=rows.filter(b=>String(b.campaign_tier||'')==='exclusive'||String(b.rotation_mode||'')==='exclusive');
  if(exclusive.length)return weightedPick(exclusive);
  const sequential=rows.filter(b=>String(b.rotation_mode||'weighted')==='sequential');
  const weighted=rows.filter(b=>String(b.rotation_mode||'weighted')!=='sequential');
  if(sequential.length&&!weighted.length){const last=localStorage.getItem(lastKey());const i=sequential.findIndex(b=>String(b.id)===String(last));return sequential[(i+1)%sequential.length]}
  return weightedPick(weighted.length?weighted:rows);
}
function css(){
  if(document.getElementById('cursappRetailSupabaseStyle'))return;
  const s=document.createElement('style');s.id='cursappRetailSupabaseStyle';s.textContent=`
  .cursappRetailSlot{margin:18px 0 calc(190px + env(safe-area-inset-bottom,0px));position:relative;z-index:1}
  .cursappRetailBanner{position:relative;min-height:180px;aspect-ratio:16/9;border-radius:24px;overflow:hidden;color:#fff;background:linear-gradient(135deg,#4c1d95,#8b5cf6);box-shadow:0 16px 36px rgba(15,23,42,.14);cursor:pointer}
  .cursappRetailBanner>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center}
  .cursappRetailBanner:after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(15,23,42,.78) 0%,rgba(15,23,42,.48) 48%,rgba(15,23,42,.12) 100%)}
  .retailCopy{position:relative;z-index:2;display:flex;flex-direction:column;justify-content:flex-end;align-items:flex-start;height:100%;box-sizing:border-box;padding:22px;max-width:72%}
  .retailCopy span,.retailCopy small{display:block;font-size:12px;font-weight:800}.retailCopy b{display:block;font-size:24px;line-height:1.05;margin:7px 0}.retailCopy button{margin-top:12px;border:0;border-radius:999px;padding:10px 15px;background:#fff;color:#6d28d9;font-weight:950}.retailDots{text-align:center;margin-top:8px;font-size:11px;color:#667085}
  @media(max-width:430px){.cursappRetailBanner{min-height:165px}.retailCopy{padding:18px;max-width:82%}.retailCopy b{font-size:21px}}
  `;document.head.appendChild(s)
}
function target(){return document.querySelector(`[data-monetization-slot="${role()}"]`)||document.querySelector('[data-monetization-slot]')||document.querySelector('#app')||document.body}
function draw(){
  css();const t=target();if(!t)return;let slot=t.querySelector(':scope > .cursappRetailSlot');
  if(!rows.length){slot?.remove();return}
  current=nextBanner();if(!current){slot?.remove();return}
  if(!slot){slot=document.createElement('section');slot.className='cursappRetailSlot';t.appendChild(slot)}
  const hasAction=!!current.target_url;
  slot.innerHTML=`<article class="cursappRetailBanner" tabindex="0" role="${hasAction?'link':'img'}" aria-label="${esc(current.title)}">${current.image_url?`<img src="${esc(current.image_url)}" alt="">`:''}<div class="retailCopy"><span>${esc(current.campaign_tier==='premium'?'Beneficio Premium':current.campaign_tier==='exclusive'?'Beneficio exclusivo':'Beneficio MiCursoX')}</span><b>${esc(current.title)}</b>${current.message?`<small>${esc(current.message)}</small>`:''}${hasAction?`<button type="button">${esc(current.action_label||'Conocer')}</button>`:''}</div></article>${rows.length>1?`<div class="retailDots">Rotación de ${rows.length} banners</div>`:''}`;
  registerImpression(current);
  const open=()=>{if(!current.target_url)return;track('click',current);location.href=current.target_url};
  const card=slot.querySelector('.cursappRetailBanner');card.onclick=open;card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}};
  clearTimeout(timer);const seconds=Math.max(5,Math.min(60,Number(current.rotation_interval_seconds||10)));
  if(rows.length>1)timer=setTimeout(async()=>{await render()},seconds*1000);
}
async function render(){
  if(rendering)return;
  rendering=true;
  try{await load();draw()}finally{rendering=false}
}
function rerenderSoon(){setTimeout(()=>render(),80)}
document.addEventListener('DOMContentLoaded',render);
window.addEventListener('pageshow',render);
window.addEventListener('cursapp:apoderado-ready',rerenderSoon);
window.addEventListener('cursapp:presidente-ready',rerenderSoon);
window.addEventListener('cursapp:tesorero-ready',rerenderSoon);
window.CursappMonetization={render};
})();