const sb=window.CURSAPP_SUPABASE;
const app=document.getElementById('adminApp');
const pages=new Map();
let applying=false;
const rpc=(name,body={})=>sb.request(`rpc/${name}`,{method:'POST',body:JSON.stringify(body)});
const n=v=>Number(v||0).toLocaleString('es-CL');

function ensureStyles(){
  if(document.getElementById('territoryUxStyles'))return;
  const s=document.createElement('style');s.id='territoryUxStyles';s.textContent=`
  .territoryPager{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:12px 0 2px;padding-top:10px;border-top:1px solid #eef0f4}.territoryPagerInfo{font-size:12px;color:#64748b;font-weight:750;text-align:center;flex:1}.territoryPager button{border:1px solid #ddd6fe;background:#fff;color:#6d28d9;border-radius:12px;padding:9px 12px;font-weight:850;min-width:44px}.territoryPager button:disabled{opacity:.35}.schoolOfficialMetric{display:inline-flex;gap:5px;align-items:center;margin-top:5px;padding:5px 8px;border-radius:999px;background:#eefdf4;color:#166534;font-size:11px!important;font-weight:850}.territoryPhaseSwitch{position:sticky;top:0;z-index:450;background:rgba(248,250,252,.96);backdrop-filter:blur(12px);padding:8px 4px;margin:0 -4px 12px!important;scrollbar-width:none}.territoryPhaseSwitch::-webkit-scrollbar{display:none}.territoryPhaseSwitch button{min-height:42px;box-shadow:0 3px 10px rgba(15,23,42,.05)}
  @media(max-width:820px){.adminTop{min-height:auto!important;padding:10px 14px!important;display:grid!important;grid-template-columns:48px minmax(0,1fr) 48px 64px!important;gap:8px!important;align-items:center!important;position:sticky!important;top:0!important;z-index:700!important;background:rgba(255,255,255,.96)!important;backdrop-filter:blur(14px)}.adminTop>div:nth-child(2){min-width:0}.adminTop h1{font-size:21px!important;line-height:1.08!important;margin:0!important}.adminTop p{font-size:12px!important;line-height:1.25!important;margin:4px 0 0!important;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.adminTop .topSearch{display:none!important}.adminTop .mobileMenu,.adminTop .topIcon{width:48px!important;height:48px!important;min-width:48px!important;border-radius:15px!important;padding:0!important}.adminTop .topIcon:last-child{width:64px!important;min-width:64px!important;font-size:0!important}.adminTop .topIcon:last-child:after{content:'Salir';font-size:15px;font-weight:850;color:#0284c7}.adminContent{padding-top:12px!important}.territoryStats{margin-top:2px!important}.territoryStat{padding:11px!important}.territoryStat strong{font-size:21px!important}.territoryMap,.commercialHeatMap{min-height:390px!important;height:48vh!important}.commercialBlock,.panel{border-radius:18px!important}.commercialBlock{padding:14px!important}.commercialKpis{margin-top:8px!important}.commercialKpi{padding:11px!important}.commercialKpi b{font-size:21px!important}.opportunityItem{padding:10px!important}.territoryPanel{padding:12px!important}}
  `;document.head.appendChild(s);
}

function pager(items,size,key,after){
  const total=items.length;if(!total)return;
  let page=Math.max(1,Math.min(pages.get(key)||1,Math.ceil(total/size)));pages.set(key,page);
  const start=(page-1)*size,end=Math.min(start+size,total);
  items.forEach((el,i)=>el.style.display=i>=start&&i<end?'':'none');
  const parent=items[0].parentElement;let bar=parent.nextElementSibling;
  if(!bar||bar.dataset.pagerKey!==key){bar=document.createElement('div');bar.className='territoryPager';bar.dataset.pagerKey=key;parent.insertAdjacentElement('afterend',bar)}
  const totalPages=Math.ceil(total/size);bar.innerHTML=`<button data-prev ${page<=1?'disabled':''}>‹</button><div class="territoryPagerInfo">${start+1}–${end} de ${total} · Página ${page}/${totalPages}</div><button data-next ${page>=totalPages?'disabled':''}>›</button>`;
  bar.querySelector('[data-prev]').onclick=()=>{pages.set(key,page-1);schedule()};bar.querySelector('[data-next]').onclick=()=>{pages.set(key,page+1);schedule()};
  if(after)after(items.slice(start,end));
}

async function addSchoolMetrics(visible){
  const pending=visible.filter(el=>!el.dataset.metricsLoaded);if(!pending.length)return;
  const ids=pending.map(el=>el.dataset.school).filter(Boolean);if(!ids.length)return;
  try{const rows=await rpc('admin_school_metrics',{p_colegio_ids:ids});const byId=new Map((rows||[]).map(x=>[x.colegio_id,x]));pending.forEach(el=>{const m=byId.get(el.dataset.school);if(!m)return;el.dataset.metricsLoaded='1';const small=document.createElement('small');small.className='schoolOfficialMetric';small.textContent=m.matricula_oficial!=null?`👥 ${n(m.matricula_oficial)} alumnos · ${n(m.cursos_oficiales)} cursos oficiales`:'👥 Matrícula oficial no disponible';el.appendChild(small)})}catch(_){ }
}

function applyPagination(){
  if(applying)return;applying=true;
  try{
    const commune=[...document.querySelectorAll('#territoryList > .territoryRow')];if(commune.length)pager(commune,12,'communes');
    const school=[...document.querySelectorAll('#territorySchools .territorySchool')];if(school.length)pager(school,10,'schools',addSchoolMetrics);
    const opportunities=[...document.querySelectorAll('.opportunityList > .opportunityItem')];if(opportunities.length)pager(opportunities,5,'opportunities');
    const potential=[...document.querySelectorAll('.potentialTable > .potentialCard')];if(potential.length)pager(potential,10,'potential');
    const agents=[...document.querySelectorAll('.agentDashboardGrid > .agentSummaryCard')];if(agents.length)pager(agents,6,'agents');
  }finally{applying=false}
}

let timer;function schedule(){clearTimeout(timer);timer=setTimeout(applyPagination,60)}
ensureStyles();
app.addEventListener('input',e=>{if(e.target?.id==='territorySchoolSearch'){pages.set('schools',1);schedule()}},true);
app.addEventListener('change',e=>{if(e.target?.id==='potentialData'){pages.set('potential',1);schedule()}},true);
new MutationObserver(schedule).observe(app,{childList:true,subtree:true});
schedule();
