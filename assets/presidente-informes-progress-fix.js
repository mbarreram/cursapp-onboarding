(function(){
  'use strict';
  if(window.__MX_PRES_INF_PROGRESS_V3__) return;
  window.__MX_PRES_INF_PROGRESS_V3__=true;

  const clp=v=>'$'+Math.round(Number(v)||0).toLocaleString('es-CL');
  const q=v=>encodeURIComponent(String(v??''));
  const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLowerCase();

  function courseKey(){
    try{
      const s=JSON.parse(localStorage.getItem('cursapp_session_v1')||'{}');
      const p=JSON.parse(localStorage.getItem('cursapp_active_profile_v1')||'{}');
      return String(s.courseKey||p.courseKey||p.course_key||localStorage.getItem('cursapp_active_course_v1')||'').trim();
    }catch(_e){ return String(localStorage.getItem('cursapp_active_course_v1')||'').trim(); }
  }
  async function sb(path){
    if(!window.CURSAPP_SUPABASE?.request) throw new Error('Supabase no disponible');
    const d=await window.CURSAPP_SUPABASE.request(path,{method:'GET'});
    return Array.isArray(d)?d:(d?[d]:[]);
  }
  function findCard(){
    const root=document.getElementById('informeRoot')||document.getElementById('app');
    if(!root) return null;
    const title=Array.from(root.querySelectorAll('h1,h2,h3,h4,.kTitle,strong,b,div')).find(n=>norm(n.textContent)==='recaudado por campañas activas');
    if(!title) return null;
    let node=title;
    while(node&&node!==root){
      if(node.classList?.contains('card')) return node;
      node=node.parentElement;
    }
    return title.parentElement;
  }
  function injectCss(){
    if(document.getElementById('mxPresProgressCssV3')) return;
    const s=document.createElement('style');s.id='mxPresProgressCssV3';s.textContent=`
      .mxPresProgressShell{padding:0}
      .mxPresProgressShell h3{margin:0 0 4px;font-size:inherit}
      .mxPresProgressSub{color:#64748b;font-weight:700;margin-bottom:18px}
      .mxPresProgressWrap{display:flex;align-items:center;gap:20px;flex-wrap:wrap;margin:8px 0 8px}
      .mxPresProgressDonut{--p:0deg;width:190px;height:190px;border-radius:50%;background:conic-gradient(#6d28d9 var(--p),#e9e5f5 0);display:grid;place-items:center;position:relative;flex:0 0 auto}
      .mxPresProgressDonut:after{content:'';position:absolute;inset:25px;background:white;border-radius:50%}
      .mxPresProgressCenter{position:relative;z-index:1;text-align:center;line-height:1.1}.mxPresProgressCenter small{display:block;color:#64748b;font-weight:800;margin-bottom:5px}.mxPresProgressCenter b{font-size:26px;color:#0f172a}.mxPresProgressCenter span{display:block;color:#6d28d9;font-weight:900;margin-top:6px}
      .mxPresProgressLegend{display:grid;gap:10px;min-width:180px}.mxPresProgressLegend div{display:flex;justify-content:space-between;gap:18px;font-weight:800}.mxPresProgressLegend small{color:#64748b}.mxPresProgressLegend b{color:#0f172a}
      .mxPresProgressLink{display:inline-block;margin-top:14px;color:#6d28d9;font-weight:850;text-decoration:none}
      @media(max-width:700px){.mxPresProgressWrap{justify-content:center;gap:14px}.mxPresProgressDonut{width:168px;height:168px}.mxPresProgressDonut:after{inset:22px}.mxPresProgressLegend{width:100%;min-width:0}.mxPresProgressCenter b{font-size:23px}.mxPresProgressSub{font-size:14px}}
    `;document.head.appendChild(s);
  }
  async function data(){
    const ck=courseKey(); if(!ck) throw new Error('curso');
    const c=(await sb('cursos?course_key=eq.'+q(ck)+'&select=id,total_alumnos&limit=1'))[0];
    if(!c?.id) throw new Error('curso');
    const camps=await sb('campanas?curso_id=eq.'+q(c.id)+'&estado=eq.activa&select=id,monto');
    if(!camps.length) return {target:0,paid:0,pending:0,pct:0};
    const ids=camps.map(x=>x.id);
    const pagos=await sb('pagos?campana_id=in.('+ids.map(q).join(',')+')&estado=eq.pagado&select=campana_id,monto_pagado');
    const target=camps.reduce((a,x)=>a+(Number(x.monto)||0)*(Number(c.total_alumnos)||0),0);
    const paid=pagos.reduce((a,x)=>a+(Number(x.monto_pagado)||0),0);
    const pending=Math.max(0,target-paid);
    const pct=target>0?Math.max(0,Math.min(100,(paid/target)*100)):0;
    return {target,paid,pending,pct};
  }
  async function apply(){
    const card=findCard(); if(!card||card.dataset.mxProgressReplacing==='1') return;
    card.dataset.mxProgressReplacing='1';
    try{
      const d=await data(); injectCss();
      card.innerHTML='<div class="mxPresProgressShell"><h3>Recaudado por campañas activas</h3><div class="mxPresProgressSub">Avance de recaudación de campañas activas</div><div class="mxPresProgressWrap"><div class="mxPresProgressDonut" style="--p:'+((d.pct/100)*360).toFixed(2)+'deg"><div class="mxPresProgressCenter"><small>Recaudado</small><b>'+clp(d.paid)+'</b><span>'+d.pct.toFixed(1).replace('.0','')+'%</span></div></div><div class="mxPresProgressLegend"><div><small>Meta total</small><b>'+clp(d.target)+'</b></div><div><small>Pagado</small><b>'+clp(d.paid)+'</b></div><div><small>Pendiente</small><b>'+clp(d.pending)+'</b></div></div></div><a class="mxPresProgressLink" href="#" data-mx-go-campanas>Ver todas las campañas activas →</a></div>';
      const link=card.querySelector('[data-mx-go-campanas]');
      if(link) link.onclick=function(e){e.preventDefault();const b=document.querySelector('.bottomNav [data-tab="campanas"]');if(b)b.click();};
      card.dataset.mxProgressStable='1';
    }catch(_e){}finally{card.dataset.mxProgressReplacing='0';}
  }
  function schedule(){[0,120,350,800].forEach(t=>setTimeout(apply,t));}
  function boot(){
    schedule();
    document.addEventListener('click',function(e){const b=e.target.closest?.('.bottomNav [data-tab="informes"]');if(b)schedule();},true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();