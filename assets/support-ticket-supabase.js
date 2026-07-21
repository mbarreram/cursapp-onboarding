(function(){
  const sb=window.CURSAPP_SUPABASE;
  if(!sb||typeof sb.request!=='function'||typeof sb.getCurrentUser!=='function') return;
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmt=v=>v?new Date(v).toLocaleString('es-CL',{dateStyle:'short',timeStyle:'short'}):'—';
  const read=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(_){return d}};
  const session=()=>read('cursapp_session_v1',{})||{};
  const localContext=()=>{const s=session();return{role:String(s.currentRole||s.role||'usuario').toLowerCase(),name:String(s.name||s.userName||s.nombre||s.email||'Usuario'),email:String(s.email||s.userId||''),school:String(s.schoolName||s.colegioNombre||s.colegio||''),course:String(s.courseName||s.cursoNombre||''),courseId:String(s.cursoId||s.courseId||'')}};
  const slaHours=(p,c)=>c==='pago_transaccion'?4:p==='critica'?2:p==='alta'?8:p==='media'?24:48;
  const categoryLabel=v=>({acceso_login:'Acceso / login',pago_transaccion:'Pago o transacción no contabilizada',menu_visual:'Problema visual / menú',campanas:'Campañas / cobros',rendiciones:'Rendiciones / boletas',informes:'Informes',datos:'Corrección de datos',otro:'Otro'})[v]||v;
  const priorityLabel=v=>({critica:'Crítica',alta:'Alta',media:'Media',baja:'Baja',normal:'Normal'})[v]||v;
  let user=null,tickets=[],resolvedContext=null;
  async function request(path,options={}){return sb.request(path,options)}
  async function resolveContext(force=false){
    if(resolvedContext&&!force)return resolvedContext;
    user=user||await sb.getCurrentUser();
    const local=localContext();
    let membership=null;
    const memberships=await request(`miembros_curso?select=curso_id,rol,estado&usuario_id=eq.${encodeURIComponent(user.id)}&order=created_at.desc`).catch(()=>[]);
    membership=(memberships||[]).find(m=>String(m.rol||'').toLowerCase()===local.role&&!/(rechazad|eliminad|bloquead|pendiente)/i.test(String(m.estado||'')))||(memberships||[]).find(m=>!/(rechazad|eliminad|bloquead|pendiente)/i.test(String(m.estado||'')))||null;
    let course=null,school=null;
    const courseId=local.courseId||membership?.curso_id||'';
    if(courseId){
      const rows=await request(`cursos?select=id,nombre,nivel,letra,jornada,anio,colegio_id&id=eq.${encodeURIComponent(courseId)}&limit=1`).catch(()=>[]);
      course=Array.isArray(rows)?rows[0]:null;
      if(course?.colegio_id){
        const schools=await request(`colegios?select=id,nombre&id=eq.${encodeURIComponent(course.colegio_id)}&limit=1`).catch(()=>[]);
        school=Array.isArray(schools)?schools[0]:null;
      }
    }
    const courseName=course?.nombre||[course?.nivel,course?.letra,course?.jornada,course?.anio].filter(Boolean).join(' · ')||local.course||'Curso no informado';
    resolvedContext={role:local.role,name:local.name,email:user.email||local.email,school:school?.nombre||local.school||'Colegio no informado',course:courseName,courseId:course?.id||courseId||null};
    return resolvedContext;
  }
  async function loadTickets(){
    user=user||await sb.getCurrentUser();
    const ts=await request(`tickets?select=*&usuario_id=eq.${encodeURIComponent(user.id)}&order=created_at.desc`);
    const ids=(ts||[]).map(t=>t.id);let allResponses=[];
    if(ids.length)allResponses=await request(`ticket_responses?select=*&ticket_id=in.(${ids.map(encodeURIComponent).join(',')})&order=created_at.asc`).catch(()=>[]);
    const map=new Map();(allResponses||[]).forEach(r=>{const a=map.get(r.ticket_id)||[];a.push(r);map.set(r.ticket_id,a)});
    tickets=(ts||[]).map(t=>({...t,responses:map.get(t.id)||[]}));
  }
  function card(t){const msgs=t.responses||[],adminReply=msgs.some(m=>m.author_role==='admin');return `<div class="supportTicketItem ${adminReply?'hasReply':''}"><div class="supportTicketTop"><div><b>${esc(t.folio||t.id)} · ${esc(t.asunto)}</b><span>${esc(categoryLabel(t.categoria))} · ${esc(priorityLabel(t.prioridad))} · ${fmt(t.created_at)}</span></div><em class="${t.estado==='resuelto'?'green':'orange'}">${t.estado==='resuelto'?'Resuelto':'SLA pendiente'}</em></div><div class="supportTicketBadges">${adminReply?'<span class="reply">💬 Nueva respuesta</span>':'<span class="pending">⏳ Esperando respuesta</span>'}</div><p>${esc(t.descripcion||'')}</p><button class="supportConversationBtn" onclick="this.nextElementSibling.classList.toggle('open')">Ver conversación (${msgs.length})</button><div class="supportConversation">${msgs.map(m=>`<div class="supportBubble ${m.author_role==='admin'?'admin':'user'}"><div class="supportBubbleHead"><b>${m.author_role==='admin'?'Soporte Cursapp':esc(t.solicitante_nombre||'Usuario')}</b><small>${fmt(m.created_at)}</small></div><div class="supportBubbleText">${esc(m.body)}</div></div>`).join('')}</div></div>`}
  function form(c){return `<div class="supportMeta"><b>Contexto detectado:</b><br>${esc(c.school)} · ${esc(c.course)}<br>Solicitante: ${esc(c.name)} · ${esc(c.role)}</div><div class="supportGrid"><div class="supportField"><label>Motivo / categoría</label><select id="stCategory"><option value="acceso_login">Acceso / login</option><option value="pago_transaccion">Pago o transacción no contabilizada</option><option value="menu_visual">Problema visual / menú</option><option value="campanas">Campañas / cobros</option><option value="rendiciones">Rendiciones / boletas</option><option value="informes">Informes</option><option value="datos">Corrección de datos</option><option value="otro">Otro</option></select></div><div class="supportField"><label>Criticidad</label><select id="stPriority"><option value="media">Media · respuesta 24h</option><option value="alta">Alta · respuesta 8h</option><option value="critica">Crítica · respuesta 2h</option><option value="baja">Baja · respuesta 48h</option></select></div><div class="supportField supportWide"><label>Asunto</label><input id="stSubject"></div><div class="supportField supportWide"><label>Detalle</label><textarea id="stDetail"></textarea></div></div><div class="supportActions"><button class="supportBtn primary" id="stSubmit">Enviar ticket</button></div>`}
  async function open(tab='new'){
    document.getElementById('supportTicketOverlay')?.remove();
    const c=await resolveContext();await loadTickets();
    const root=document.createElement('div');root.className='supportOverlay';root.id='supportTicketOverlay';
    root.innerHTML=`<div class="supportCard supportCardTabs"><div class="supportHead"><div><h2>Soporte Cursapp</h2><p>Levanta un ticket o revisa respuestas del equipo Cursapp.</p></div><button class="supportClose" data-close>✕</button></div><div class="supportTabs"><button class="${tab==='new'?'active':''}" data-tab="new">Nuevo ticket</button><button class="${tab==='mine'?'active':''}" data-tab="mine">Mis tickets <span>${tickets.length}</span></button></div><div id="supportTabBody">${tab==='mine'?`<div class="supportTicketList">${tickets.length?tickets.map(card).join(''):'<div class="supportEmpty">Aún no tienes tickets.</div>'}</div>`:form(c)}</div><div class="supportActions"><button class="supportBtn" data-close>Cerrar</button></div></div>`;
    root.onclick=e=>{if(e.target===root||e.target.matches('[data-close]'))root.remove();if(e.target.matches('[data-tab]')){root.remove();open(e.target.dataset.tab)}};document.body.appendChild(root);
    const btn=root.querySelector('#stSubmit');if(btn)btn.onclick=async()=>{const categoria=root.querySelector('#stCategory').value,prioridad=root.querySelector('#stPriority').value,asunto=root.querySelector('#stSubject').value.trim(),descripcion=root.querySelector('#stDetail').value.trim();if(!asunto||!descripcion){alert('Completa asunto y detalle del ticket.');return}btn.disabled=true;btn.textContent='Enviando…';try{const current=await resolveContext(true),hours=slaHours(prioridad,categoria),folio='TK-'+Math.floor(100000+Math.random()*900000);const rows=await request('tickets',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({usuario_id:user.id,curso_id:current.courseId,asunto,descripcion,estado:'abierto',prioridad,categoria,folio,solicitante_nombre:current.name,solicitante_email:current.email,colegio_nombre:current.school,curso_nombre:current.course,sla_due_at:new Date(Date.now()+hours*3600000).toISOString()})});const ticket=Array.isArray(rows)?rows[0]:rows;if(!ticket?.id)throw new Error('Supabase no devolvió el ticket creado.');await request('ticket_responses',{method:'POST',body:JSON.stringify({ticket_id:ticket.id,author_id:user.id,author_role:current.role||'usuario',body:descripcion})});alert(`Ticket enviado ✅\n\nFolio: ${folio}\nSLA respuesta: ${hours} horas`);root.remove();open('mine')}catch(e){alert('No se pudo enviar el ticket: '+(e.message||e));btn.disabled=false;btn.textContent='Enviar ticket'}};
  }
  function remount(){document.getElementById('supportFab')?.remove();document.getElementById('supportMenuItem')?.remove();const role=localContext().role;if(!['presidente','tesorero'].includes(role))return;const b=document.createElement('button');b.id='supportFab';b.className='supportFab';b.type='button';b.innerHTML='💬 <span>Soporte</span>';b.onclick=()=>open('new');document.body.appendChild(b);const menu=document.getElementById('menuDropdown');if(menu){const i=document.createElement('button');i.id='supportMenuItem';i.className='btn ghost';i.type='button';i.style.cssText='width:100%;margin-top:8px;text-align:left;';i.textContent='💬 Soporte / Mis tickets';i.onclick=()=>open('mine');menu.appendChild(i)}}
  window.CURSAPP_SUPPORT={open,openNewTicket:()=>open('new'),openMyTickets:()=>open('mine')};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(remount,900));else setTimeout(remount,900);
})();