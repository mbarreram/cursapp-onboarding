(function(){
  'use strict';

  const $=(s,r=document)=>r.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const LABELS={colegio:'Destacado colegio',comuna:'Destacado comuna',cursapp:'Todo MiCursoX',todo:'Todo MiCursoX'};
  let busy=false;
  let lastKey='';

  function readSession(){
    try{return JSON.parse(localStorage.getItem('cursapp_session_v1')||'{}')||{};}catch(_){return {};}
  }
  async function getUserId(sb){
    try{
      const r=await sb.auth.getSession();
      const id=r?.data?.session?.user?.id;
      if(id) return String(id);
    }catch(_){ }
    const s=readSession();
    return String(s.userId||s.usuario_id||'').trim();
  }
  function daysLeft(v){
    const t=Date.parse(v||'');
    if(!v||Number.isNaN(t)) return 0;
    return Math.max(0,Math.ceil((t-Date.now())/86400000));
  }
  function fmtDate(v){
    try{return new Date(v).toLocaleDateString('es-CL',{day:'2-digit',month:'2-digit',year:'numeric'});}catch(_){return '';}
  }
  function normalizeBrand(root){
    if(!root) return;
    root.querySelectorAll('*').forEach(el=>{
      if(el.children.length===0 && /Todo Cursapp/i.test(el.textContent||'')) el.textContent=(el.textContent||'').replace(/Todo Cursapp/gi,'Todo MiCursoX');
    });
  }
  function ensureHost(){
    const redeem=$('#view-creditos .creditsPanel:nth-of-type(2)');
    if(!redeem) return null;
    let host=$('#activeCreditBoosts');
    if(!host){
      host=document.createElement('section');
      host.id='activeCreditBoosts';
      host.className='activeCreditBoosts';
      const select=$('#boostPostSelect');
      const label=select?.closest('label');
      (label||$('#boostOptions')||redeem.firstChild)?.before?.(host);
    }
    return host;
  }
  function renderActive(rows){
    const host=ensureHost();
    if(!host) return;
    if(!rows.length){host.innerHTML='';host.hidden=true;return;}
    host.hidden=false;
    host.innerHTML=`
      <div class="activeBoostHead">
        <div><span class="activeBoostEyebrow">⭐ EN PROMOCIÓN</span><h3>Tus publicaciones destacadas</h3><p>Estos avisos están usando créditos en este momento.</p></div>
        <span class="activeBoostCount">${rows.length} activa${rows.length===1?'':'s'}</span>
      </div>
      <div class="activeBoostList">${rows.map(r=>{
        const rule=String(r.tipo_destacado||'colegio').toLowerCase();
        const credits=Number(r.creditos_usados??r.creditos_consumidos??0);
        const left=daysLeft(r.fecha_fin);
        const title=r._post?.titulo||'Publicación';
        return `<article class="activeBoostCard">
          <div class="activeBoostStatus"><span class="activeDot"></span>Activo · quedan ${left} día${left===1?'':'s'}</div>
          <h4>${esc(title)}</h4>
          <div class="activeBoostMeta"><span>${esc(LABELS[rule]||'Destacado')}</span><span>${credits} crédito${credits===1?'':'s'} utilizado${credits===1?'':'s'}</span></div>
          <p>Vigente hasta ${esc(fmtDate(r.fecha_fin))}</p>
          <div class="activeBoostActions"><button type="button" data-open-detail="${esc(r.publicacion_id)}">Ver publicación</button><button type="button" data-active-boost-detail="${esc(r.id)}">Ver detalle</button></div>
        </article>`;
      }).join('')}</div>`;
    window.__mercadoActiveBoostRows=rows;
  }
  function contextualMessage(activeCount){
    const msg=$('#creditNoActiveMsg');
    const select=$('#boostPostSelect');
    if(activeCount>0 && msg && (!select || select.disabled || select.options.length<=1)){
      msg.className='creditHelpBox creditHelpContext';
      msg.innerHTML='<b>No tienes otras publicaciones disponibles para destacar.</b><br>Tus publicaciones destacadas aparecen arriba. Para usar créditos en otro aviso, publica uno nuevo o espera a que finalice el destacado actual.';
    }
  }
  async function refresh(){
    if(busy) return;
    const view=$('#view-creditos');
    if(!view) return;
    normalizeBrand(view);
    if(!view.classList.contains('active') && view.style.display==='none') return;
    const sb=window.cursappSupabase;
    if(!sb) return;
    busy=true;
    try{
      const uid=await getUserId(sb);
      if(!uid) return;
      const iso=new Date().toISOString();
      const r=await sb.from('publicaciones_destacadas').select('id,publicacion_id,usuario_id,creditos_usados,creditos_consumidos,fecha_inicio,fecha_fin,activa,estado,tipo_destacado').eq('usuario_id',uid).eq('activa',true).gt('fecha_fin',iso).order('fecha_fin',{ascending:true});
      if(r.error) throw r.error;
      const rows=Array.isArray(r.data)?r.data:[];
      const ids=[...new Set(rows.map(x=>x.publicacion_id).filter(Boolean))];
      let posts=[];
      if(ids.length){
        const p=await sb.from('mercado_publicaciones').select('id,titulo,estado,activo,imagen_principal').in('id',ids);
        if(!p.error && Array.isArray(p.data)) posts=p.data;
      }
      const map=new Map(posts.map(p=>[String(p.id),p]));
      const enriched=rows.map(x=>({...x,_post:map.get(String(x.publicacion_id))||null}));
      const key=JSON.stringify(enriched.map(x=>[x.id,x.fecha_fin,x.creditos_usados,x._post?.titulo]));
      if(key!==lastKey || !$('#activeCreditBoosts')){
        lastKey=key;
        renderActive(enriched);
      }
      contextualMessage(enriched.length);
      normalizeBrand(view);
    }catch(e){console.warn('mercado-active-boosts',e);}
    finally{busy=false;}
  }

  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('[data-active-boost-detail]');
    if(!btn) return;
    const row=(window.__mercadoActiveBoostRows||[]).find(x=>String(x.id)===String(btn.dataset.activeBoostDetail));
    if(!row) return;
    const modal=$('#modal');
    if(!modal) return;
    const rule=String(row.tipo_destacado||'colegio').toLowerCase();
    const credits=Number(row.creditos_usados??row.creditos_consumidos??0);
    const left=daysLeft(row.fecha_fin);
    modal.innerHTML=`<div class="v19ConfirmOverlay"><section class="v19Confirm"><h2>Detalle del destacado</h2><div class="boostConfirmCard"><p>Publicación</p><b>${esc(row._post?.titulo||'Publicación')}</b><p>Tipo</p><b>⭐ ${esc(LABELS[rule]||'Destacado')}</b><p class="muted">${credits} crédito${credits===1?'':'s'} utilizado${credits===1?'':'s'} · quedan ${left} día${left===1?'':'s'}</p><div class="creditSummary"><span>Inicio</span><b>${esc(fmtDate(row.fecha_inicio))}</b></div><div class="creditSummary strong"><span>Vence</span><b>${esc(fmtDate(row.fecha_fin))}</b></div></div><div class="v19ConfirmActions"><button type="button" class="primaryBtn" data-active-boost-close>Cerrar</button></div></section></div>`;
    modal.querySelector('[data-active-boost-close]')?.addEventListener('click',()=>modal.innerHTML='',{once:true});
  });

  document.addEventListener('click',e=>{
    if(e.target.closest?.('[data-view="creditos"]')) setTimeout(refresh,350);
  },true);
  const obs=new MutationObserver(()=>{
    const v=$('#view-creditos');
    if(v && (v.classList.contains('active')||v.style.display!=='none')) setTimeout(refresh,80);
  });
  document.addEventListener('DOMContentLoaded',()=>{
    obs.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
    setTimeout(refresh,900);
    setInterval(refresh,5000);
  },{once:true});
})();