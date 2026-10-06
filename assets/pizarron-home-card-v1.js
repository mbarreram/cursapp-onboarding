(function(){
'use strict';
if(window.__MICURSOX_PIZARRON_HOME_V1__)return;window.__MICURSOX_PIZARRON_HOME_V1__=true;
const sb=window.CURSAPP_SUPABASE;if(!sb)return;
let cache={key:'',rows:[],at:0},busy=false;
function session(){try{return JSON.parse(localStorage.getItem('cursapp_session_v1')||'{}')||{}}catch(_){return{}}}
function role(){const s=session(),r=String(localStorage.getItem('cursapp_active_role_v1')||s.currentRole||s.activeRole||s.role||'apoderado').toLowerCase();return r.includes('pres')?'presidente':r.includes('tesor')?'tesorero':'apoderado'}
function key(){const s=session();return String(localStorage.getItem('cursapp_active_course_v1')||s.courseKey||s.activeCourseKey||'').trim()}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function fmt(v){if(!v)return'';return new Intl.DateTimeFormat('es-CL',{weekday:'short',day:'numeric',month:'short'}).format(new Date(v+'T12:00:00'))}
function styles(){if(document.getElementById('pzHomeCss'))return;const s=document.createElement('style');s.id='pzHomeCss';s.textContent='.pzHomeCard{background:#fff;border:1px solid #e2e8f0;border-radius:22px;padding:16px;box-shadow:0 10px 28px rgba(15,23,42,.055);margin:14px 0}.pzHomeHead{display:flex;justify-content:space-between;gap:12px;align-items:center}.pzHomeHead h3{margin:0;font-size:18px}.pzHomeHead button{border:0;background:#f3e8ff;color:#6d28d9;border-radius:12px;padding:9px 12px;font-weight:900}.pzHomeSub{margin-top:4px;color:#64748b;font-size:12px;font-weight:750}.pzHomeRows{display:grid;gap:8px;margin-top:12px}.pzHomeRow{display:grid;grid-template-columns:26px minmax(0,1fr) auto;gap:8px;align-items:center;padding:9px 0;border-top:1px solid #eef2f7}.pzHomeRow b{font-size:13px}.pzHomeRow span{font-size:11px;color:#64748b;font-weight:750}.pzHomeCreate{margin-top:10px;width:100%;height:40px;border:1px solid #ddd6fe;border-radius:13px;background:#fff;color:#6d28d9;font-weight:900}.pzHomeCard-apoderado{position:relative;overflow:hidden;background:linear-gradient(145deg,#27443d,#1f3530);border:4px solid #d7bd91;border-radius:20px;box-shadow:0 12px 28px rgba(15,23,42,.16),inset 0 0 0 1px rgba(255,255,255,.08)}.pzHomeCard-apoderado:before{content:"";position:absolute;inset:8px;border:1px solid rgba(255,255,255,.07);border-radius:12px;pointer-events:none}.pzHomeCard-apoderado .pzHomeHead{position:relative;z-index:1}.pzHomeCard-apoderado .pzHomeHead h3{color:#fff;font-size:20px;letter-spacing:-.01em}.pzHomeCard-apoderado .pzHomeSub{color:#dbe9e4}.pzHomeCard-apoderado .pzHomeHead button{background:#fff7e8;color:#5b21b6;box-shadow:0 5px 14px rgba(0,0,0,.14)}.pzHomeCard-apoderado .pzHomeRows{position:relative;z-index:1}.pzHomeCard-apoderado .pzHomeRow{border-top-color:rgba(255,255,255,.18)}.pzHomeCard-apoderado .pzHomeRow b{color:#fff;font-size:14px}.pzHomeCard-apoderado .pzHomeRow span{color:#dbe9e4}.pzHomeCard-apoderado .pzHomeRow>span:first-child{font-size:18px;color:#fff}';document.head.appendChild(s)}
async function data(){
 const k=key();if(!k)return[];if(cache.key===k&&Date.now()-cache.at<30000)return cache.rows;
 const isUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(k);const courses=await sb.request('cursos?select=id&'+(isUuid?'id':'course_key')+'=eq.'+encodeURIComponent(k)+'&limit=1');const c=Array.isArray(courses)?courses[0]:null;if(!c)return[];
 const today=new Date().toISOString().slice(0,10);
 const rows=await sb.request('curso_pizarron_posts?select=id,categoria,titulo,fecha_evento,hora_evento,importante&curso_id=eq.'+c.id+'&activo=eq.true&fecha_evento=gte.'+today+'&order=fijado.desc,fecha_evento.asc&limit=3');
 cache={key:k,rows:Array.isArray(rows)?rows:[],at:Date.now()};return cache.rows
}
function target(){const r=role();if(r==='apoderado')return document.querySelector('.apoV2Page.apoderado-home');if(r==='presidente')return document.querySelector('.presMockPage');return document.querySelector('.tesV57Page.tesV68Page')}
function cardHtml(rows,r,loading){
 return '<div class="pzHomeHead"><div><h3>📝 Pizarrón del curso</h3><div class="pzHomeSub">'+(loading?'Actualizando recordatorios...':(rows.length?rows.length+' próximo'+(rows.length===1?'':'s')+' recordatorio'+(rows.length===1?'':'s'):'Sin recordatorios próximos'))+'</div></div><button type="button" data-pz-open>Ver pizarrón</button></div>'+(rows.length?'<div class="pzHomeRows">'+rows.slice(0,2).map(x=>'<div class="pzHomeRow"><span>'+({prueba:'📝',materiales:'🎒',tarea:'📚',horario:'🕒',actividad:'🎉',reunion:'👥'}[x.categoria]||'📌')+'</span><b>'+esc(x.titulo)+'</b><span>'+esc(fmt(x.fecha_evento))+'</span></div>').join('')+'</div>':'')+(r!=='apoderado'?'<button class="pzHomeCreate" type="button" data-pz-new>＋ Publicar en el Pizarrón</button>':'');
}
function bindCard(card){
 const open=card.querySelector('[data-pz-open]');if(open)open.onclick=()=>location.assign('/pizarron.html');
 const create=card.querySelector('[data-pz-new]');if(create)create.onclick=()=>location.assign('/pizarron.html?new=1');
}
function insertCard(host,card){
 const notice=host.querySelector('.apoV2NoticeSection')||host.querySelector('.presMockSection:last-of-type')||host.querySelector('[data-monetization-slot="tesorero"]');
 if(notice&&notice.parentNode===host)host.insertBefore(card,notice);else host.appendChild(card);
}
async function mount(){
 const host=target();if(!host)return;
 let card=host.querySelector(':scope > .pzHomeCard');
 if(!card){
   styles();
   card=document.createElement('section');
   card.className='pzHomeCard pzHomeCard-'+role();
   const cached=(cache.key===key()?cache.rows:[]);
   card.innerHTML=cardHtml(cached,role(),false);
   bindCard(card);
   insertCard(host,card);
 }
 if(busy)return;
 busy=true;
 try{
   const rows=await data();
   if(!card.isConnected)return;
   const next=cardHtml(rows,role(),false);
   if(card.innerHTML!==next){card.innerHTML=next;bindCard(card);}
 }catch(_e){
   if(card.isConnected){
     card.innerHTML=cardHtml(cache.key===key()?cache.rows:[],role(),false);
     bindCard(card);
   }
 }finally{busy=false}
}
let mountQueued=false;
const mo=new MutationObserver(()=>{
 if(mountQueued)return;
 mountQueued=true;
 queueMicrotask(()=>{mountQueued=false;mount()});
});
function boot(){
 const root=document.getElementById('app');
 if(root)mo.observe(root,{childList:true});
 mount();
}
window.addEventListener('cursapp:dataChanged',(ev)=>{
 const detail=ev&&ev.detail||{};
 const source=String(detail.source||'').toLowerCase();
 const dataKey=String(detail.key||'').toLowerCase();
 if(source!=='pizarron' && dataKey!=='curso_pizarron_posts' && dataKey!=='curso_pizarron_colaboraciones')return;
 cache.at=0;
 mount();
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();