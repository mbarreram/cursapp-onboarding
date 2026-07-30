(function(){
  'use strict';
  if(window.__APODERADO_DESKTOP_RUNTIME_FIX_V6__) return;
  window.__APODERADO_DESKTOP_RUNTIME_FIX_V6__ = true;

  const desktop = window.matchMedia('(min-width:1024px)');
  if(!desktop.matches) return;

  try{
    const patchedSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key,value){
      const name = String(key || '');
      const next = String(value ?? '');
      let current = null;
      try{current = Storage.prototype.getItem.call(localStorage,key);}catch(_e){}
      if(current === next) return;
      if(name.includes('last_seen_payments')){
        return Storage.prototype.setItem.call(localStorage,key,next);
      }
      return patchedSetItem(key,next);
    };
  }catch(_e){}

  let scheduled = 0;

  function money(value){
    try{
      return new Intl.NumberFormat('es-CL',{
        style:'currency',currency:'CLP',maximumFractionDigits:0
      }).format(Number(value)||0);
    }catch(_e){
      return '$'+Math.round(Number(value)||0).toLocaleString('es-CL');
    }
  }

  function financeSnapshot(){
    try{return window.CURSAPP_APO_FINANCE?.snapshot?.() || null;}catch(_e){return null;}
  }

  function rebuildEvolutionChart(svg){
    if(!svg || svg.dataset.mxV6Fixed === '1') return;

    const finance = financeSnapshot();
    const rows = Array.isArray(finance?.evolution) ? finance.evolution : [];
    const now = new Date();
    const keys=[];
    const names=[];
    for(let i=5;i>=0;i--){
      const d=new Date(now.getFullYear(),now.getMonth()-i,1);
      keys.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
      names.push(d.toLocaleDateString('es-CL',{month:'short'}).replace('.',''));
    }
    const values=keys.map(key=>Number(rows.find(item=>item.month===key)?.balance||0));

    const width=520;
    const height=270;
    const left=48;
    const right=width-34;
    const top=50;
    const bottom=height-42;
    const plotHeight=bottom-top;
    const minRaw=Math.min(...values,0);
    const maxRaw=Math.max(...values,0);
    const span=Math.max(1,maxRaw-minRaw);
    const padding=span*.12;
    const min=minRaw-padding;
    const max=maxRaw+padding;
    const range=Math.max(1,max-min);
    const xFor=i=>left+i*((right-left)/Math.max(1,values.length-1));
    const yFor=value=>top+((max-value)/range)*plotHeight;
    const points=values.map((value,index)=>`${xFor(index).toFixed(1)},${yFor(value).toFixed(1)}`);
    const zeroY=Math.min(bottom,Math.max(top,yFor(0)));
    const area=`${left},${zeroY.toFixed(1)} ${points.join(' ')} ${right},${zeroY.toFixed(1)}`;
    const lastValue=values[values.length-1]||0;
    const labelY=Math.max(24,Math.min(height-50,yFor(lastValue)-14));

    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    svg.setAttribute('preserveAspectRatio','xMidYMid meet');
    svg.innerHTML=`
      <defs>
        <linearGradient id="apoReportGradV6" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#2563eb" stop-opacity=".22"/>
          <stop offset="1" stop-color="#2563eb" stop-opacity=".03"/>
        </linearGradient>
      </defs>
      <path d="M${left} ${top}H${right} M${left} ${(top+plotHeight/2).toFixed(1)}H${right} M${left} ${bottom}H${right}" stroke="#dbe5f2" stroke-width="1" fill="none"/>
      <path d="M${left} ${zeroY.toFixed(1)}H${right}" stroke="#a8b8cc" stroke-width="1.2" stroke-dasharray="5 5" fill="none"/>
      <polygon points="${area}" fill="url(#apoReportGradV6)"/>
      <polyline points="${points.join(' ')}" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      ${values.map((value,index)=>`<circle cx="${xFor(index).toFixed(1)}" cy="${yFor(value).toFixed(1)}" r="4" fill="#2563eb"/>`).join('')}
      <text x="${right}" y="${labelY.toFixed(1)}" text-anchor="end" class="apoReportChartValue">${money(lastValue)}</text>
      ${names.map((name,index)=>`<text x="${xFor(index).toFixed(1)}" y="${height-16}" text-anchor="middle" class="apoReportAxis">${name}</text>`).join('')}
    `;
    svg.dataset.mxV6Fixed='1';
  }

  function stabilize(){
    if(!desktop.matches) return;
    document.querySelectorAll('.apoReportLineChart').forEach(rebuildEvolutionChart);
  }

  function schedule(){
    cancelAnimationFrame(scheduled);
    scheduled=requestAnimationFrame(stabilize);
  }

  const app=document.getElementById('app');
  if(app){
    const observer=new MutationObserver(schedule);
    observer.observe(app,{childList:true,subtree:true});
  }
  document.addEventListener('click',function(event){
    if(event.target.closest?.('[data-tab],.navItem,.apoderado-bottom-nav-item')){
      setTimeout(schedule,40);
      setTimeout(schedule,180);
    }
  },true);
  window.addEventListener('hashchange',schedule);
  window.addEventListener('cursapp:apoderado-ready',schedule);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',schedule,{once:true});
  else schedule();
})();