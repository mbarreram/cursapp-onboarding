(function(){
'use strict';
if(window.__MX_APO_REPORTS_SUPABASE_V1__)return;
window.__MX_APO_REPORTS_SUPABASE_V1__=true;

const api=()=>window.CURSAPP_SUPABASE;
const json=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(_){return d}};
const course=()=>{const x=json('cursapp_course_v1',{})||{};return x.course||x};
const session=()=>json('cursapp_session_v1',{})||{};
const scoped=base=>window.CURSAPP?.scopedKey?window.CURSAPP.scopedKey(base):'cursapp_'+base;
const courseId=()=>{
  try{
    const resolved=window.CURSAPP_APO_FINANCE?.courseId?.();
    if(resolved)return String(resolved).trim();
  }catch(_){}
  const c=course()||{},s=session()||{};
  return String(c.curso_id||c.courseId||c.course_id||c.id||s.curso_id||s.courseId||s.course_id||'').trim();
};

function reportFromDb(row){
  let content={};
  try{content=typeof row.contenido==='string'?JSON.parse(row.contenido||'{}'):(row.contenido||{})}catch(_){content={}}
  const collected=Number(content.recaudadoCurso ?? content.recaudado ?? content.collected ?? 0)||0;
  const spent=Number(content.gastadoCurso ?? content.spent ?? 0)||0;
  const balance=Number(content.disponibleCurso ?? content.balance ?? (collected-spent))||0;
  const campaignRows=Array.isArray(content.campaigns)?content.campaigns:(Array.isArray(content.campaignRows)?content.campaignRows:[]);
  const expenseRows=Array.isArray(content.expenses)?content.expenses:(Array.isArray(content.okE)?content.okE:[]);
  return Object.assign({},content,{
    id:row.id,
    supabaseId:row.id,
    campaignId:row.campana_id||content.campaignId||'__all__',
    period:row.periodo||content.period||'',
    title:row.titulo||content.title||'Informe financiero',
    published:!!row.publicado,
    generatedAt:row.publicado_at||row.actualizado_at||row.created_at||content.generatedAt||content.createdAt||null,
    publishedAt:row.publicado_at||null,
    createdAt:row.created_at||content.createdAt||null,
    updatedAt:row.actualizado_at||row.created_at||null,
    state:row.estado||(row.publicado?'publicado':'borrador'),
    recaudadoCurso:collected,
    gastadoCurso:spent,
    disponibleCurso:balance,
    recaudado:collected,
    campaigns:campaignRows,
    expenses:expenseRows
  });
}

async function hydratePublished(reason){
  const cid=courseId();
  if(!cid||!api()?.request)return {reports:0,reason:'missing-context'};
  const rows=await api().request('rpc/get_my_published_reports',{method:'POST',body:JSON.stringify({p_curso_id:cid})});
  const reports=(Array.isArray(rows)?rows:[]).map(reportFromDb).filter(r=>r.published);
  // Published reports stay in memory, sourced exclusively from the course-scoped RPC.
  // Never persist them to unscoped localStorage (which can mix courses).
  window.MICURSOX_APO_REPORTS_STATE={courseId:cid,reports,loadedAt:new Date().toISOString(),reason:reason||'manual'};
  window.dispatchEvent(new CustomEvent('micursox:published-reports-hydrated',{detail:{reason:reason||'manual',reports:reports.length,courseId:cid}}));
  return {reports:reports.length,courseId:cid};
}

let refreshing=false;
async function refresh(reason){
  if(refreshing)return;
  refreshing=true;
  try{
    const result=await hydratePublished(reason);
    if(document.querySelector('.apoReportPage')&&typeof window.go==='function'){
      setTimeout(()=>window.go('informes'),0);
      setTimeout(()=>window.dispatchEvent(new CustomEvent('micursox:published-reports-hydrated',{detail:result||{}})),40);
    }
    return result;
  }catch(e){console.warn('Informes publicados Apoderado:',e);return null}
  finally{refreshing=false}
}

function boot(){
  let tries=0;
  const timer=setInterval(()=>{
    const cid=courseId();
    if(cid&&api()?.request){clearInterval(timer);refresh('boot-resolved');}
    else if(++tries>40)clearInterval(timer);
  },250);
  document.addEventListener('click',e=>{
    const btn=e.target?.closest?.('.navItem[data-tab="informes"],[onclick*="go(\'informes\')"],[onclick*="go(&quot;informes&quot;)"]');
    if(btn)setTimeout(()=>refresh('open-informes'),60);
  },true);
  window.addEventListener('focus',()=>refresh('focus'));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

window.MICURSOX_APO_REPORTS={refresh,hydratePublished};
})();