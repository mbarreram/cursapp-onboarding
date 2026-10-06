(function(){
'use strict';
const sb=window.CURSAPP_SUPABASE,app=document.getElementById('pzApp'),modal=document.getElementById('pzModalRoot');
if(!sb||!app)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cats={prueba:['📝','Prueba'],materiales:['🎒','Materiales'],tarea:['📚','Tarea'],horario:['🕒','Horario'],actividad:['🎉','Actividad'],reunion:['👥','Reunión'],otro:['📌','Otro']};
let state={user:null,course:null,member:null,role:'apoderado',posts:[],collabs:[],filter:'week'};
function session(){try{return JSON.parse(localStorage.getItem('cursapp_session_v1')||'{}')||{}}catch(_){return{}}}
function role(){const s=session(),r=String(localStorage.getItem('cursapp_active_role_v1')||s.currentRole||s.activeRole||s.role||'apoderado').toLowerCase();return r.includes('pres')?'presidente':r.includes('tesor')?'tesorero':'apoderado'}
function courseKey(){const s=session();return String(localStorage.getItem('cursapp_active_course_v1')||s.courseKey||s.activeCourseKey||s.course?.courseKey||'').trim()}
function home(){return state.role==='presidente'?'/presidente.html':state.role==='tesorero'?'/tesorero.html':'/apoderado.html'}
function fmtDate(v){if(!v)return'';const d=new Date(v+'T12:00:00');return new Intl.DateTimeFormat('es-CL',{weekday:'long',day:'numeric',month:'short'}).format(d)}
function fmtTime(v){return v?String(v).slice(0,5):''}
function isoToday(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function weekEnd(){const d=new Date();d.setDate(d.getDate()+7);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
async function req(path,opts){return sb.request(path,opts||{})}
async function loadContext(){
 state.role=role();state.user=await sb.getCurrentUser();
 const key=courseKey();if(!key)throw new Error('No hay un curso activo.');
 const isUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key); const rows=await req('cursos?select=id,course_key,nombre,nivel,letra,anio,jornada,colegio_id,colegios(nombre)&'+(isUuid?'id':'course_key')+'=eq.'+encodeURIComponent(key)+'&limit=1');
 state.course=Array.isArray(rows)?rows[0]:null;if(!state.course)throw new Error('No se encontró el curso activo.');
 const members=await req('miembros_curso?select=id,rol,nombre_apoderado,email,usuario_id&curso_id=eq.'+state.course.id+'&usuario_id=eq.'+state.user.id+'&limit=10');
 state.member=(Array.isArray(members)?members:[]).find(m=>String(m.rol).toLowerCase()===state.role)||(Array.isArray(members)?members[0]:null);
 if(!state.member)throw new Error('Tu usuario no pertenece a este curso.');
 document.body.setAttribute('data-role',state.role);
 document.getElementById('pzRole').textContent=state.role.charAt(0).toUpperCase()+state.role.slice(1);
 const school=state.course.colegios?.nombre||'Colegio',course=state.course.nombre||[state.course.nivel,state.course.letra].filter(Boolean).join('');
 document.getElementById('pzCourse').textContent=school+' · '+course+(state.course.anio?' · '+state.course.anio:'');
}
async function loadData(){
 const posts=await req('curso_pizarron_posts?select=*&curso_id=eq.'+state.course.id+'&activo=eq.true&order=fijado.desc,fecha_evento.asc,created_at.desc');
 state.posts=Array.isArray(posts)?posts:[];
 const ids=state.posts.map(x=>x.id);
 if(ids.length){
   const q=ids.map(encodeURIComponent).join(',');
   const c=await req('curso_pizarron_colaboraciones?select=*&post_id=in.('+q+')&order=created_at.asc');
   state.collabs=Array.isArray(c)?c:[];
 }else state.collabs=[];
}
function filtered(){
 const today=isoToday(),end=weekEnd();
 if(state.filter==='today')return state.posts.filter(p=>p.fecha_evento===today);
 if(state.filter==='week')return state.posts.filter(p=>p.fecha_evento>=today&&p.fecha_evento<=end);
 if(state.filter==='upcoming')return state.posts.filter(p=>p.fecha_evento>end);
 return state.posts;
}
function canEdit(p){return p.autor_usuario_id===state.user.id||state.role==='presidente'||state.role==='tesorero'}
function card(p){
 const cat=cats[p.categoria]||cats.otro,rows=state.collabs.filter(c=>c.post_id===p.id);
 const badges=[p.recordatorio_dia_anterior?'<span class="pzBadge">🔔 Día anterior</span>':'',p.recordatorio_mismo_dia?'<span class="pzBadge warn">🔔 Mismo día</span>':'',p.importante?'<span class="pzBadge important">! Importante</span>':''].join('');
 const collab=rows.length?'<div class="pzCollab"><div class="pzCollabTitle">🤝 Colaboraciones</div>'+rows.map(c=>{const assigned=c.estado==='asignado';const mine=String(c.asignado_usuario_id||'')===String(state.user.id||'');const status=assigned?(mine?'✓ Te anotaste':('✓ '+esc(c.asignado_nombre||'Asignado'))):'Disponible';const action=!assigned?'<button class="pzClaim" data-claim="'+c.id+'">✋ Yo me anoto</button>':(mine||state.role!=='apoderado'?'<button class="pzClaim pzRelease" data-release="'+c.id+'">Liberar</button>':'');return '<div class="pzCollabRow"><div class="pzCollabInfo"><b>'+esc(c.item_nombre)+'</b><span class="pzCollabStatus '+(assigned?'pzAssigned':'')+'">'+status+'</span></div>'+action+'</div>'}).join('')+'</div>':'';
 return '<article class="pzCard '+(p.fijado?'isPinned':'')+'" data-post="'+p.id+'"><div class="pzCardTop"><div class="pzCatIcon">'+cat[0]+'</div><div><span class="pzCategory">'+cat[1]+'</span><h2>'+esc(p.titulo)+'</h2><div class="pzMeta">📅 '+esc(fmtDate(p.fecha_evento))+(p.hora_evento?' · '+esc(fmtTime(p.hora_evento)):'')+'</div></div>'+(canEdit(p)?'<button class="pzMenuBtn" data-menu="'+p.id+'" aria-label="Opciones">⋮</button>':'')+'</div>'+(p.descripcion?'<p class="pzDesc">'+esc(p.descripcion)+'</p>':'')+'<div class="pzBadges">'+badges+'</div>'+collab+'<div class="pzAuthor">👥 Publicado por: '+esc(p.autor_nombre||p.autor_rol||'Miembro del curso')+'</div>'+(canEdit(p)?'<div class="pzActions" data-actions="'+p.id+'"><button data-edit="'+p.id+'">Editar</button><button class="danger" data-delete="'+p.id+'">Eliminar</button></div>':'')+'</article>';
}
function render(){
 const rows=filtered();
 app.innerHTML='<section class="pzHero"><div><h1>Pizarrón del curso</h1><p>Recordatorios y anotaciones colaborativas solo para este curso.</p></div><button class="pzPrimary" id="pzAdd" type="button">＋ Agregar al pizarrón</button></section><div class="pzTabs"><button class="pzTab '+(state.filter==='today'?'active':'')+'" data-filter="today">Hoy</button><button class="pzTab '+(state.filter==='week'?'active':'')+'" data-filter="week">Esta semana</button><button class="pzTab '+(state.filter==='upcoming'?'active':'')+'" data-filter="upcoming">Próximamente</button><button class="pzTab '+(state.filter==='all'?'active':'')+'" data-filter="all">Todos</button></div><section class="pzList">'+(rows.length?rows.map(card).join(''):'<div class="pzEmpty">No hay publicaciones para este período.</div>')+'</section>';
}
function postById(id){return state.posts.find(x=>String(x.id)===String(id))}
function openForm(post){
 const edit=!!post,collabs=edit?state.collabs.filter(x=>x.post_id===post.id):[];
 const collabBuilder=!edit?'<div class="pzField pzCollabBuilder"><label>Colaboraciones opcionales</label><div class="pzCollabAddRow"><input id="pzCollabInput" type="text" maxlength="100" placeholder="Ej: Bebidas"><button id="pzCollabAdd" type="button">＋ Agregar</button></div><div id="pzCollabDraft" class="pzCollabDraft"><span class="pzCollabEmpty">Agrega elementos para que los apoderados puedan anotarse.</span></div><input id="pzCollabJson" type="hidden" name="colaboraciones_json" value="[]"><span class="pzHint">Ejemplo: Bebidas, vasos o servilletas. Después cada apoderado podrá elegir “✋ Yo me anoto”.</span></div>':(collabs.length?'<div class="pzHint">Las colaboraciones ya creadas se mantienen para no perder compromisos.</div>':'');
 modal.innerHTML='<div class="pzOverlay"><section class="pzModal"><div class="pzModalHead"><div><h2>'+(edit?'Editar publicación':'Agregar al Pizarrón')+'</h2><p>Visible únicamente para los integrantes del curso activo.</p></div><button class="pzClose" type="button">×</button></div><form class="pzForm" id="pzForm"><div class="pzField"><label>Categoría</label><select name="categoria">'+Object.entries(cats).map(([k,v])=>'<option value="'+k+'" '+((post?.categoria||'otro')===k?'selected':'')+'>'+v[1]+'</option>').join('')+'</select></div><div class="pzField"><label>Título</label><input name="titulo" maxlength="120" required value="'+esc(post?.titulo||'')+'" placeholder="Ej: Prueba de Matemáticas"></div><div class="pzField"><label>Descripción</label><textarea name="descripcion" placeholder="Información breve para los apoderados">'+esc(post?.descripcion||'')+'</textarea></div><div class="pzFormGrid"><div class="pzField"><label>Fecha</label><input type="date" name="fecha_evento" required value="'+esc(post?.fecha_evento||isoToday())+'"></div><div class="pzField"><label>Hora opcional</label><input type="time" name="hora_evento" value="'+esc(fmtTime(post?.hora_evento)||'')+'"></div></div><div class="pzChecks"><label><input type="checkbox" name="recordatorio_dia_anterior" '+(post?.recordatorio_dia_anterior?'checked':'')+'><span>Recordar día anterior</span></label><label><input type="checkbox" name="recordatorio_mismo_dia" '+(post?.recordatorio_mismo_dia?'checked':'')+'><span>Recordar mismo día</span></label><label><input type="checkbox" name="importante" '+(post?.importante?'checked':'')+'><span>Importante</span></label>'+(state.role!=='apoderado'?'<label><input type="checkbox" name="fijado" '+(post?.fijado?'checked':'')+'><span>Fijar arriba</span></label>':'')+'</div>'+collabBuilder+'<div class="pzFormActions"><button type="button" class="pzGhost">Cancelar</button><button type="submit" class="pzSave">'+(edit?'Guardar cambios':'Publicar')+'</button></div></form></section></div>';
 modal.querySelector('.pzOverlay').addEventListener('click',e=>{if(e.target===e.currentTarget)closeForm()});
 modal.querySelector('.pzClose').onclick=closeForm;modal.querySelector('.pzGhost').onclick=closeForm;
 if(!edit){
   let draft=[];
   const input=modal.querySelector('#pzCollabInput'),add=modal.querySelector('#pzCollabAdd'),list=modal.querySelector('#pzCollabDraft'),hidden=modal.querySelector('#pzCollabJson');
   const paint=()=>{hidden.value=JSON.stringify(draft);list.innerHTML=draft.length?draft.map((item,i)=>'<div class="pzCollabDraftItem"><span>✋ '+esc(item)+'</span><button type="button" data-remove-collab="'+i+'" aria-label="Quitar '+esc(item)+'">×</button></div>').join(''):'<span class="pzCollabEmpty">Agrega elementos para que los apoderados puedan anotarse.</span>'};
   const addItem=()=>{const value=String(input.value||'').trim();if(!value)return;if(draft.length>=12)return alert('Puedes agregar hasta 12 colaboraciones.');if(draft.some(x=>x.toLowerCase()===value.toLowerCase()))return alert('Ese elemento ya está agregado.');draft.push(value);input.value='';paint();input.focus()};
   add.onclick=addItem;input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addItem()}});
   list.addEventListener('click',e=>{const b=e.target.closest('[data-remove-collab]');if(!b)return;draft.splice(Number(b.dataset.removeCollab),1);paint()});
   paint();
 }
 modal.querySelector('#pzForm').onsubmit=e=>save(e,post);
}
function closeForm(){modal.innerHTML=''}
async function save(e,post){
 e.preventDefault();const f=new FormData(e.currentTarget),btn=e.currentTarget.querySelector('.pzSave');btn.disabled=true;
 const payload={curso_id:state.course.id,colegio_id:state.course.colegio_id,autor_usuario_id:state.user.id,autor_miembro_id:state.member?.id||null,autor_nombre:state.member?.nombre_apoderado||state.member?.email||state.user.email||'Miembro del curso',autor_rol:state.role,categoria:String(f.get('categoria')||'otro'),titulo:String(f.get('titulo')||'').trim(),descripcion:String(f.get('descripcion')||'').trim()||null,fecha_evento:String(f.get('fecha_evento')||''),hora_evento:String(f.get('hora_evento')||'').trim()||null,recordatorio_dia_anterior:f.has('recordatorio_dia_anterior'),recordatorio_mismo_dia:f.has('recordatorio_mismo_dia'),importante:f.has('importante'),fijado:state.role==='apoderado'?(post?.fijado||false):f.has('fijado')};
 try{
   let saved;
   if(post){const r=await req('curso_pizarron_posts?id=eq.'+post.id,{method:'PATCH',body:JSON.stringify(payload)});saved=Array.isArray(r)?r[0]:r}
   else{const r=await req('curso_pizarron_posts',{method:'POST',body:JSON.stringify(payload)});saved=Array.isArray(r)?r[0]:r}
   if(!post&&saved?.id){
     let items=[];try{items=JSON.parse(String(f.get('colaboraciones_json')||'[]'))}catch(_){items=[]}items=(Array.isArray(items)?items:[]).map(x=>String(x||'').trim()).filter(Boolean).slice(0,12);
     if(items.length)await req('curso_pizarron_colaboraciones',{method:'POST',body:JSON.stringify(items.map(item=>({post_id:saved.id,curso_id:state.course.id,colegio_id:state.course.colegio_id,item_nombre:item})))});
   }
   closeForm();await loadData();render();window.dispatchEvent(new CustomEvent('cursapp:dataChanged',{detail:{source:'pizarron',key:'curso_pizarron_posts'}}));
 }catch(err){alert(err?.message||'No se pudo guardar la publicación.');btn.disabled=false}
}
async function removePost(id){if(!confirm('¿Eliminar esta publicación del Pizarrón?'))return;try{await req('curso_pizarron_posts?id=eq.'+id,{method:'DELETE'});await loadData();render();window.dispatchEvent(new CustomEvent('cursapp:dataChanged',{detail:{source:'pizarron',key:'curso_pizarron_posts'}}))}catch(e){alert(e?.message||'No se pudo eliminar')}}
async function claim(id,release){try{await req('rpc/'+(release?'release_pizarron_colaboracion':'claim_pizarron_colaboracion'),{method:'POST',body:JSON.stringify({p_item_id:id})});await loadData();render();window.dispatchEvent(new CustomEvent('cursapp:dataChanged',{detail:{source:'pizarron',key:'curso_pizarron_colaboraciones'}}))}catch(e){alert(e?.message||'No se pudo actualizar la colaboración')}}
app.addEventListener('click',e=>{
 const f=e.target.closest('[data-filter]');if(f){state.filter=f.dataset.filter;render();return}
 if(e.target.closest('#pzAdd')){openForm(null);return}
 const menuBtn=e.target.closest('[data-menu]');if(menuBtn){const box=document.querySelector('[data-actions="'+menuBtn.dataset.menu+'"]');document.querySelectorAll('.pzActions.open').forEach(x=>{if(x!==box)x.classList.remove('open')});box?.classList.toggle('open');return}
 const edit=e.target.closest('[data-edit]');if(edit){openForm(postById(edit.dataset.edit));return}
 const del=e.target.closest('[data-delete]');if(del){removePost(del.dataset.delete);return}
 const c=e.target.closest('[data-claim]');if(c){claim(c.dataset.claim,false);return}
 const r=e.target.closest('[data-release]');if(r){claim(r.dataset.release,true)}
});
document.getElementById('pzBack').onclick=()=>location.assign(home());
async function boot(){
 try{await loadContext();await loadData();render();const params=new URLSearchParams(location.search);if(params.get('new')==='1')openForm(null);const focus=params.get('post');if(focus)setTimeout(()=>document.querySelector('[data-post="'+CSS.escape(focus)+'"]')?.scrollIntoView({behavior:'smooth',block:'center'}),120)}catch(e){app.innerHTML='<div class="pzError">'+esc(e?.message||e)+'</div>'}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.MICURSOX_PIZARRON={open:()=>location.assign('/pizarron.html')};
})();