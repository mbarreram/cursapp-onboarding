(function(){
  'use strict';
  const sb=window.CURSAPP_SUPABASE;
  let rows=[],idx=0,timer=null,user=null;
  const seen=new Set();
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const role=()=>{const p=location.pathname.toLowerCase();if(p.includes('presidente'))return'presidente';if(p.includes('tesorero'))return'tesorero';return'apoderado'};
  const read=()=>{try{return JSON.parse(localStorage.getItem('cursapp_session_v1')||'{}')}catch(_){return{}}};
  const allowed=b=>{const a=String(b.audience||'all').toLowerCase(),r=role(),s=read()||{},cursoId=String(s.cursoId||s.courseId||s.activeCourseId||''),colegioId=String(s.colegioId||s.schoolId||'');if(!(a==='all'||a==='todos'||a===r||(a==='directiva'&&(r==='presidente'||r==='tesorero'))))return false;if(b.curso_id&&cursoId&&String(b.curso_id)!==cursoId)return false;if(b.colegio_id&&colegioId&&String(b.colegio_id)!==colegioId)return false;const now=Date.now();if(b.starts_at&&Date.parse(b.starts_at)>now)return false;if(b.ends_at&&Date.parse(b.ends_at)<now)return false;return true};
  async function track(type,b){try{user=user||await sb.getCurrentUser();const key=type+':'+b.id;if(type==='impression'&&seen.has(key))return;if(type==='impression')seen.add(key);await sb.request('admin_banner_events',{method:'POST',body:JSON.stringify({banner_id:b.id,user_id:user.id,event_type:type,role:role()})})}catch(_){}}
  async function load(){if(!sb?.request)return[];try{rows=(await sb.request('admin_banners?select=*&active=eq.true&order=priority.desc,sort_order.asc,created_at.desc')).filter(allowed);return rows}catch(e){console.warn('Banners Supabase',e);rows=[];return[]}}
  function css(){
    if(document.getElementById('cursappRetailSupabaseStyle'))return;
    const s=document.createElement('style');
    s.id='cursappRetailSupabaseStyle';
    s.textContent=`
      .cursappRetailSlot{margin:18px 0 calc(190px + env(safe-area-inset-bottom,0px));position:relative;z-index:1}
      .cursappRetailBanner{position:relative;width:100%;aspect-ratio:2.55/1;min-height:190px;border-radius:24px;overflow:hidden;color:#fff;background:linear-gradient(135deg,#4c1d95,#8b5cf6);box-shadow:0 16px 36px rgba(15,23,42,.16);isolation:isolate}
      .retailBackground{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;z-index:-3}
      .cursappRetailBanner:before{content:"";position:absolute;inset:0;z-index:-2;background:linear-gradient(90deg,rgba(15,23,42,.82) 0%,rgba(15,23,42,.60) 44%,rgba(15,23,42,.12) 76%,rgba(15,23,42,.05) 100%)}
      .cursappRetailBanner.noImage:before{background:linear-gradient(135deg,#4c1d95,#8b5cf6)}
      .retailCopy{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:22px 24px;max-width:62%;box-sizing:border-box;text-shadow:0 2px 10px rgba(15,23,42,.35)}
      .retailCopy span,.retailCopy small{display:block;font-size:13px;font-weight:850;line-height:1.35}
      .retailCopy span{letter-spacing:.02em}
      .retailCopy b{display:block;font-size:clamp(24px,4.4vw,36px);line-height:1.04;margin:7px 0}
      .retailCopy small{font-size:clamp(14px,2.5vw,18px)}
      .retailCopy button{margin-top:15px;border:0;border-radius:999px;padding:11px 18px;background:#fff;color:#6d28d9;font-weight:950;font-size:15px;box-shadow:0 8px 20px rgba(15,23,42,.18)}
      .retailDots{text-align:center;margin-top:8px;font-size:11px;color:#667085}
      @media(max-width:520px){.cursappRetailBanner{aspect-ratio:2.35/1;min-height:174px;border-radius:22px}.retailCopy{max-width:72%;padding:18px 20px}.retailCopy b{font-size:25px}.retailCopy small{font-size:14px}.retailCopy button{margin-top:12px;padding:10px 16px}}
    `;
    document.head.appendChild(s);
  }
  function target(){return document.querySelector(`[data-monetization-slot="${role()}"]`)||document.querySelector('[data-monetization-slot]')||document.querySelector('#app')||document.body}
  function draw(){
    css();
    const t=target();if(!t)return;
    let slot=t.querySelector(':scope > .cursappRetailSlot');
    if(!rows.length){slot?.remove();return}
    idx%=rows.length;
    const b=rows[idx];
    if(!slot){slot=document.createElement('section');slot.className='cursappRetailSlot';t.appendChild(slot)}
    const hasImage=!!String(b.image_url||'').trim();
    const hasAction=!!String(b.target_url||'').trim();
    slot.innerHTML=`<article class="cursappRetailBanner ${hasImage?'':'noImage'}" ${hasAction?'role="link" tabindex="0"':''}>${hasImage?`<img class="retailBackground" src="${esc(b.image_url)}" alt="">`:''}<div class="retailCopy"><span>Beneficio Cursapp</span>${b.title?`<b>${esc(b.title)}</b>`:''}${b.message?`<small>${esc(b.message)}</small>`:''}${hasAction?`<button type="button" id="bannerOpen">Conocer</button>`:''}</div></article>${rows.length>1?`<div class="retailDots">${idx+1} de ${rows.length}</div>`:''}`;
    track('impression',b);
    const open=()=>{if(!hasAction)return;track('click',b);location.href=b.target_url};
    slot.querySelector('#bannerOpen')?.addEventListener('click',e=>{e.stopPropagation();open()});
    const article=slot.querySelector('.cursappRetailBanner');
    if(hasAction){article.onclick=open;article.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}}}
    clearTimeout(timer);
    if(rows.length>1)timer=setTimeout(()=>{idx=(idx+1)%rows.length;draw()},7000);
  }
  async function render(){await load();draw()}
  document.addEventListener('DOMContentLoaded',render);
  window.addEventListener('pageshow',render);
  window.CursappMonetization={render};
})();