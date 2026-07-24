const sb=window.CURSAPP_SUPABASE;
const app=document.getElementById('adminApp');
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let coverage=[],agents=[],map=null,layer=null,selected=null,initialized=false,initializing=null;

async function req(path,options={}){return sb.request(path,options)}
async function rpc(name,body={}){return req(`rpc/${name}`,{method:'POST',body:JSON.stringify(body)})}
function withTimeout(promise,ms,message){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(message)),ms))])}

function ensureAssets(){
  if(!document.querySelector('link[data-leaflet]')){
    const l=document.createElement('link');l.rel='stylesheet';l.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';l.dataset.leaflet='1';document.head.appendChild(l);
  }
  if(!document.getElementById('territoryStyles')){
    const s=document.createElement('style');s.id='territoryStyles';s.textContent=`
    .territoryToolbar{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}.territoryToolbar select{width:100%;padding:12px;border:1px solid #dbe1ea;border-radius:14px;background:#fff;font:inherit}.territoryStats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}.territoryStat{background:#fff;border:1px solid #e8eaf0;border-radius:18px;padding:14px}.territoryStat span{display:block;color:#64748b;font-size:12px;font-weight:800}.territoryStat strong{font-size:24px;color:#111827}.territoryGrid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(280px,.8fr);gap:14px}.territoryMap{height:62vh;min-height:460px;border-radius:20px;overflow:hidden;border:1px solid #e5e7eb;background:#eef2f7}.territoryPanel{background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:16px;min-width:0}.territoryLegend{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:#64748b;margin:10px 0}.territoryDot{width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:5px}.territoryList{max-height:44vh;overflow:auto}.territoryRow{padding:12px 0;border-bottom:1px solid #eef0f4;cursor:pointer}.territoryRow b{display:block}.territoryRow small{color:#64748b}.territoryAssign{display:grid;gap:10px;margin-top:14px}.territoryAssign select,.territoryAssign textarea{width:100%;box-sizing:border-box;padding:11px;border:1px solid #dbe1ea;border-radius:12px;font:inherit}.territoryEmpty{color:#64748b;padding:16px 0}.leaflet-popup-content{font-family:system-ui,-apple-system,sans-serif}.territorySchoolList{margin-top:12px;max-height:230px;overflow:auto}.territorySchool{padding:9px 0;border-bottom:1px solid #eef0f4}.territorySchool small{display:block;color:#64748b}@media(max-width:820px){.territoryStats{grid-template-columns:1fr 1fr}.territoryGrid{grid-template-columns:1fr}.territoryMap{height:52vh;min-height:380px}.territoryToolbar{grid-template-columns:1fr}.territoryPanel{padding:14px}}
    `;document.head.appendChild(s);
  }
}

async function loadLeaflet(){
  ensureAssets();
  if(window.L)return;
  await withTimeout(new Promise((resolve,reject)=>{const existing=document.querySelector('script[data-leaflet]');if(existing){if(window.L)return resolve();existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return}const s=document.createElement('script');s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';s.dataset.leaflet='1';s.onload=resolve;s.onerror=()=>reject(new Error('No fue posible descargar el mapa'));document.head.appendChild(s)}),8000,'El mapa tardó demasiado en cargar.');
}

async function load(){
  const [c,a]=await Promise.all([
    rpc('admin_territory_coverage'),
    req('agentes?select=id,nombre,email,codigo,estado&order=nombre.asc')
  ]);
  coverage=Array.isArray(c)?c:[];agents=(Array.isArray(a)?a:[]).filter(x=>x.estado!=='inactivo');
}

async function ensureInitialized(){
  if(initialized)return;
  if(initializing)return initializing;
  initializing=(async()=>{await loadLeaflet();await load();initialized=true})();
  try{await initializing}finally{initializing=null}
}

function stats(rows){const schools=rows.reduce((n,x)=>n+Number(x.total_colegios||0),0);const active=rows.reduce((n,x)=>n+Number(x.colegios_con_cursapp||0),0);const covered=rows.filter(x=>x.agent_id).length;return{schools,active,covered,uncovered:rows.length-covered}}
function color(row){if(row.agent_id)return '#6d28d9';if(Number(row.colegios_con_cursapp||0)>0)return '#16a34a';return '#94a3b8'}
function radius(row){return Math.max(6,Math.min(18,6+Math.sqrt(Number(row.total_colegios||0))))}
function filtered(){const r=$('#territoryRegion')?.value||'';const c=$('#territoryCommune')?.value||'';return coverage.filter(x=>(!r||x.region_codigo===r)&&(!c||x.comuna_codigo===c))}

function drawMap(rows){
  if(!window.L)return;
  if(!map){map=L.map('territoryMap',{preferCanvas:true}).setView([-33.45,-70.66],5);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:18}).addTo(map)}
  if(layer)layer.remove();layer=L.layerGroup().addTo(map);const bounds=[];
  rows.forEach(row=>{const lat=Number(row.latitud),lng=Number(row.longitud);if(!Number.isFinite(lat)||!Number.isFinite(lng))return;bounds.push([lat,lng]);const marker=L.circleMarker([lat,lng],{radius:radius(row),color:color(row),fillColor:color(row),fillOpacity:.72,weight:2});marker.bindPopup(`<b>${esc(row.comuna_nombre)}</b><br>${Number(row.total_colegios||0)} colegios<br>${row.agent_nombre?'Agente: '+esc(row.agent_nombre):'Sin agente asignado'}`);marker.on('click',()=>selectCommune(row));marker.addTo(layer)});
  if(bounds.length===1)map.setView(bounds[0],11);else if(bounds.length)map.fitBounds(bounds,{padding:[24,24],maxZoom:10});setTimeout(()=>map.invalidateSize(),50);
}

async function selectCommune(row){
  selected=row;$('#territorySelected').innerHTML=`<h3>${esc(row.comuna_nombre)}</h3><p class="muted">${esc(row.region_nombre)}</p><p><b>${Number(row.total_colegios||0)}</b> colegios oficiales · <b>${Number(row.colegios_con_cursapp||0)}</b> con presencia Cursapp</p><p>${row.agent_nombre?`Asignada a <b>${esc(row.agent_nombre)}</b>`:'<b>Sin agente asignado</b>'}</p><div class="territoryAssign"><select id="territoryAgent"><option value="">Seleccionar agente</option>${agents.map(a=>`<option value="${a.id}" ${a.id===row.agent_id?'selected':''}>${esc(a.nombre)}${a.codigo?' · '+esc(a.codigo):''}</option>`).join('')}</select><textarea id="territoryNotes" rows="2" placeholder="Nota de asignación (opcional)"></textarea><button class="adminBtn" id="territorySave">Asignar comuna</button></div><div id="territorySchools" class="territorySchoolList"><p class="muted">Cargando colegios…</p></div>`;
  $('#territorySave').onclick=assign;
  try{const schools=await req(`colegios?select=id,nombre,rbd,direccion,dependencia_nombre&comuna_codigo=eq.${encodeURIComponent(row.comuna_codigo)}&catalogo_oficial=eq.true&estado_establecimiento=eq.1&order=nombre.asc&limit=250`);$('#territorySchools').innerHTML=(schools||[]).map(s=>`<div class="territorySchool"><b>${esc(s.nombre)}</b><small>RBD ${esc(s.rbd||'—')}${s.dependencia_nombre?' · '+esc(s.dependencia_nombre):''}${s.direccion?' · '+esc(s.direccion):''}</small></div>`).join('')||'<p class="muted">Sin colegios.</p>'}catch(e){$('#territorySchools').innerHTML='<p class="muted">No fue posible cargar los colegios.</p>'}
}

async function assign(){
  if(!selected)return;const agent=$('#territoryAgent').value;if(!agent)return alert('Selecciona un agente');const btn=$('#territorySave');btn.disabled=true;btn.textContent='Guardando…';
  try{await rpc('admin_assign_agent_territory',{p_agent_id:agent,p_region_codigo:selected.region_codigo,p_comuna_codigo:selected.comuna_codigo,p_notes:$('#territoryNotes').value.trim()||null});await load();renderData();const updated=coverage.find(x=>x.comuna_codigo===selected.comuna_codigo);if(updated)selectCommune(updated)}catch(e){alert('No fue posible asignar: '+(e.message||e))}finally{btn.disabled=false;btn.textContent='Asignar comuna'}
}

function renderData(){
  const rows=filtered(),s=stats(rows);$('#territoryStats').innerHTML=`<div class="territoryStat"><span>Colegios oficiales</span><strong>${s.schools.toLocaleString('es-CL')}</strong></div><div class="territoryStat"><span>Con presencia Cursapp</span><strong>${s.active.toLocaleString('es-CL')}</strong></div><div class="territoryStat"><span>Comunas asignadas</span><strong>${s.covered}</strong></div><div class="territoryStat"><span>Comunas sin agente</span><strong>${s.uncovered}</strong></div>`;
  $('#territoryList').innerHTML=rows.sort((a,b)=>a.comuna_nombre.localeCompare(b.comuna_nombre)).map(r=>`<div class="territoryRow" data-comuna="${r.comuna_codigo}"><b><span class="territoryDot" style="background:${color(r)}"></span>${esc(r.comuna_nombre)}</b><small>${Number(r.total_colegios||0)} colegios · ${r.agent_nombre?esc(r.agent_nombre):'Sin agente'}</small></div>`).join('')||'<div class="territoryEmpty">Sin resultados.</div>';
  document.querySelectorAll('[data-comuna]').forEach(el=>el.onclick=()=>{const row=coverage.find(x=>x.comuna_codigo===el.dataset.comuna);if(row)selectCommune(row)});drawMap(rows);
}

async function render(){
  document.body.classList.remove('sideOpen');
  $('#viewTitle').textContent='Territorios y cobertura';$('#viewSub').textContent='Mapa comercial de colegios y comunas asignadas a agentes';app.innerHTML='<section class="panel"><p class="muted" style="font-weight:800">Cargando mapa y cobertura territorial…</p></section>';
  try{await ensureInitialized()}catch(e){app.innerHTML=`<section class="panel"><div class="panelHead"><h2>No se pudo cargar el mapa</h2></div><p class="muted">${esc(e.message||e)}</p><button class="adminBtn" id="territoryRetry">Reintentar</button></section>`;$('#territoryRetry').onclick=()=>{initialized=false;render()};return}
  app.innerHTML=`<div class="territoryToolbar"><select id="territoryRegion"><option value="">Todas las regiones</option></select><select id="territoryCommune"><option value="">Todas las comunas</option></select></div><div id="territoryStats" class="territoryStats"></div><div class="territoryLegend"><span><i class="territoryDot" style="background:#6d28d9"></i>Asignada a agente</span><span><i class="territoryDot" style="background:#16a34a"></i>Presencia Cursapp sin territorio</span><span><i class="territoryDot" style="background:#94a3b8"></i>Sin cobertura</span></div><div class="territoryGrid"><div id="territoryMap" class="territoryMap"></div><aside class="territoryPanel"><div id="territorySelected"><h3>Cobertura por comuna</h3><p class="muted">Selecciona un punto del mapa o una comuna de la lista para revisar sus colegios y asignarla a un agente.</p></div><div id="territoryList" class="territoryList"></div></aside></div>`;
  const regions=[...new Map(coverage.map(x=>[x.region_codigo,x.region_nombre])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));$('#territoryRegion').innerHTML+=regions.map(([id,n])=>`<option value="${id}">${esc(n)}</option>`).join('');
  $('#territoryRegion').onchange=()=>{const r=$('#territoryRegion').value;const cs=coverage.filter(x=>!r||x.region_codigo===r).sort((a,b)=>a.comuna_nombre.localeCompare(b.comuna_nombre));$('#territoryCommune').innerHTML='<option value="">Todas las comunas</option>'+cs.map(x=>`<option value="${x.comuna_codigo}">${esc(x.comuna_nombre)}</option>`).join('');renderData()};$('#territoryCommune').onchange=renderData;renderData();
}

const previousGo=window.Admin?.go?.bind(window.Admin);
if(window.Admin){window.Admin.go=tab=>{if(tab==='territorios'){void render();return}previousGo?.(tab)}}

document.addEventListener('click',event=>{
  const button=event.target.closest?.('.sideItem[data-tab="territorios"]');
  if(!button)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  document.querySelectorAll('.sideItem').forEach(x=>x.classList.toggle('active',x===button));
  void render();
},true);
