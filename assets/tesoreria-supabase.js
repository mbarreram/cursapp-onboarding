/* Cursapp · Tesorería persistente en Supabase
   Supabase es la fuente de verdad. localStorage conserva solo una copia de lectura
   para las vistas antiguas de Presidente y Tesorero. */
(function(){
  'use strict';
  if(window.CURSAPP_TREASURY) return;

  const BUCKET='comprobantes-rendiciones';
  const api=()=>window.CURSAPP_SUPABASE;
  const json=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(_){return d}};
  const session=()=>json('cursapp_session_v1',{})||{};
  const authSession=()=>json('cursapp_supabase_auth_session_v1',{})||{};
  const userId=()=>String(authSession()?.user?.id||session()?.user?.id||session()?.id||session()?.userId||'').trim();
  const course=()=>{const x=json('cursapp_course_v1',{})||{};return x.course||x};
  const courseId=()=>String(course()?.id||course()?.curso_id||session()?.courseId||session()?.courseKey||localStorage.getItem('cursapp_active_course_v1')||'').trim();
  const scoped=(base)=>window.CURSAPP?.scopedKey?window.CURSAPP.scopedKey(base):`cursapp_${base}`;
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}};
  const now=()=>new Date().toISOString();
  const safeName=(name)=>String(name||'comprobante').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(-100)||'comprobante';
  const uuid=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;

  function expenseFromDb(row){
    const rendition=Array.isArray(row.rendiciones)?(row.rendiciones[0]||{}):(row.rendiciones||{});
    const history=Array.isArray(rendition.historial)?rendition.historial:[];
    const attachment=row.comprobante_url?{name:row.comprobante_nombre||'Comprobante',type:row.comprobante_tipo||'',size:Number(row.comprobante_tamano||0),path:row.comprobante_url}:null;
    return {
      id:row.id, supabaseId:row.id, scope:row.campana_id?'campaign':'general', campaignId:row.campana_id||null,
      title:row.titulo, concept:row.titulo, description:row.descripcion||'', note:row.descripcion||'',
      category:row.categoria||'Otros', categoria:row.categoria||'Otros', vendor:row.proveedor||'',
      amount:Number(row.monto||0), date:row.fecha_gasto, createdAt:row.created_at, updatedAt:row.actualizado_at,
      approvalStatus:rendition.estado||row.estado||'pendiente_aprobacion', status:rendition.estado||row.estado||'pendiente_aprobacion',
      approvalNote:rendition.observacion||row.observacion_aprobacion||'', approvalHistory:history,
      approvedAt:row.aprobado_at||null, attachments:attachment?[attachment]:[], receipt:attachment,
      createdById:row.creado_por||null, renditionId:rendition.id||null
    };
  }

  function reportFromDb(row){
    let content={};try{content=typeof row.contenido==='string'?JSON.parse(row.contenido||'{}'):(row.contenido||{})}catch(_){content={}}
    return Object.assign({},content,{
      id:row.id, supabaseId:row.id, campaignId:row.campana_id||content.campaignId||'__all__',
      period:row.periodo||content.period||'', title:row.titulo, published:!!row.publicado,
      createdAt:row.created_at, updatedAt:row.actualizado_at||row.created_at,
      publishedAt:row.publicado_at||null, state:row.estado||(row.publicado?'publicado':'borrador')
    });
  }

  async function hydrate(reason){
    if(!api()?.request||!courseId()) return {expenses:0,reports:0,reason:'missing-context'};
    const cid=encodeURIComponent(courseId());
    const [expenseRows,reportRows]=await Promise.all([
      api().request(`gastos?curso_id=eq.${cid}&select=*,rendiciones(*)&order=fecha_gasto.desc,created_at.desc`),
      api().request(`informes?curso_id=eq.${cid}&select=*&order=actualizado_at.desc,created_at.desc`)
    ]);
    const expenses=(Array.isArray(expenseRows)?expenseRows:[]).map(expenseFromDb);
    const reports=(Array.isArray(reportRows)?reportRows:[]).map(reportFromDb);
    write(scoped('expenses_v1'),expenses);write('cursapp_expenses_v1',expenses);
    write(scoped('monthly_reports_v1'),reports);write('cursapp_monthly_reports_v1',reports);
    write('cursapp_campaign_reports_v1',reports);
    window.dispatchEvent(new CustomEvent('cursapp:treasuryHydrated',{detail:{reason:reason||'manual',expenses:expenses.length,reports:reports.length}}));
    return {expenses:expenses.length,reports:reports.length};
  }

  async function uploadReceipt(file,expenseId){
    if(!file) return null;
    if(file.size>5*1024*1024) throw new Error('El comprobante supera el máximo de 5 MB.');
    const cfg=api(),token=await cfg.getAccessToken();
    if(!token) throw new Error('La sesión de Supabase expiró. Vuelve a iniciar sesión.');
    const path=`${courseId()}/${expenseId}/${uuid()}-${safeName(file.name)}`;
    const response=await fetch(`${cfg.url}/storage/v1/object/${BUCKET}/${path}`,{method:'POST',headers:{apikey:cfg.publishableKey,Authorization:`Bearer ${token}`,'Content-Type':file.type||'application/octet-stream','x-upsert':'false'},body:file});
    if(!response.ok){let msg=await response.text();try{msg=JSON.parse(msg)?.message||msg}catch(_){}throw new Error(msg||'No se pudo subir el comprobante.');}
    return {path,name:file.name,type:file.type||'',size:file.size};
  }

  async function deleteReceipt(path){
    if(!path)return;
    const cfg=api(),token=await cfg.getAccessToken();if(!token)return;
    await fetch(`${cfg.url}/storage/v1/object/${BUCKET}/${path}`,{method:'DELETE',headers:{apikey:cfg.publishableKey,Authorization:`Bearer ${token}`}}).catch(()=>{});
  }

  async function signedReceipt(path,expiresIn){
    if(!path) return '';
    const cfg=api(),token=await cfg.getAccessToken();
    const response=await fetch(`${cfg.url}/storage/v1/object/sign/${BUCKET}/${path}`,{method:'POST',headers:{apikey:cfg.publishableKey,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:Number(expiresIn||300)})});
    const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.message||'No se pudo abrir el comprobante.');
    return `${cfg.url}/storage/v1${body.signedURL||body.signedUrl||''}`;
  }

  async function saveExpense(input,file){
    const cid=courseId(),uid=userId();if(!cid||!uid)throw new Error('No se pudo identificar el curso o usuario activo.');
    const existing=String(input?.supabaseId||input?.id||'');
    const isUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing);
    const payload={curso_id:cid,campana_id:input.campaignId&&input.campaignId!=='general'?input.campaignId:null,titulo:String(input.title||'').trim(),descripcion:String(input.description||input.note||'').trim()||null,monto:Number(input.amount||0),fecha_gasto:input.date||new Date().toISOString().slice(0,10),categoria:input.category||'Otros',proveedor:input.vendor||null,estado:'pendiente_aprobacion',actualizado_at:now(),creado_por:uid,observacion_aprobacion:null};
    let rows;
    if(isUuid) rows=await api().request(`gastos?id=eq.${encodeURIComponent(existing)}`,{method:'PATCH',body:JSON.stringify(payload)});
    else rows=await api().request('gastos',{method:'POST',body:JSON.stringify(payload)});
    let row=Array.isArray(rows)?rows[0]:rows;if(!row?.id)throw new Error('Supabase no devolvió el gasto guardado.');
    const attachment=await uploadReceipt(file,row.id);
    if(attachment){const updated=await api().request(`gastos?id=eq.${row.id}`,{method:'PATCH',body:JSON.stringify({comprobante_url:attachment.path,comprobante_nombre:attachment.name,comprobante_tipo:attachment.type,comprobante_tamano:attachment.size,actualizado_at:now()})});row=Array.isArray(updated)?updated[0]:updated||row;}
    const history=Array.isArray(input.approvalHistory)?input.approvalHistory.slice():[];
    history.push({at:now(),action:isUuid?'editada':'registrada',actor:input.createdByName||input.registeredBy||'Tesorero',role:'Tesorero'});
    history.push({at:now(),action:'enviada_aprobacion',actor:'Cursapp',role:'Flujo de aprobación'});
    const renditionPayload={gasto_id:row.id,curso_id:cid,campana_id:payload.campana_id,periodo:String(payload.fecha_gasto).slice(0,7),total_gastado:payload.monto,saldo:0,estado:'pendiente_aprobacion',solicitado_por:uid,revisado_por:null,observacion:null,historial:history,actualizado_at:now()};
    try{
      const existingRendition=await api().request(`rendiciones?gasto_id=eq.${encodeURIComponent(row.id)}&select=id&limit=1`);
      if(Array.isArray(existingRendition)&&existingRendition[0]?.id)await api().request(`rendiciones?id=eq.${encodeURIComponent(existingRendition[0].id)}`,{method:'PATCH',body:JSON.stringify(renditionPayload)});
      else await api().request('rendiciones',{method:'POST',body:JSON.stringify(renditionPayload)});
    }catch(error){
      if(!isUuid){await api().request(`gastos?id=eq.${encodeURIComponent(row.id)}`,{method:'DELETE'}).catch(()=>{});await deleteReceipt(attachment?.path)}
      throw error;
    }
    await hydrate('expense-saved');return row;
  }

  async function updateApproval(expenseId,status,note,actorName){
    const uid=userId(),at=now();
    const current=await api().request(`rendiciones?gasto_id=eq.${encodeURIComponent(expenseId)}&select=*&limit=1`);
    const row=Array.isArray(current)?current[0]:null,history=Array.isArray(row?.historial)?row.historial.slice():[];
    history.push({at,action:status,actor:actorName||'Presidente',role:'Presidente',note:note||''});
    await Promise.all([
      api().request(`gastos?id=eq.${encodeURIComponent(expenseId)}`,{method:'PATCH',body:JSON.stringify({estado:status,aprobado_por:uid,aprobado_at:status==='aprobada'?at:null,observacion_aprobacion:note||null,actualizado_at:at})}),
      api().request(`rendiciones?gasto_id=eq.${encodeURIComponent(expenseId)}`,{method:'PATCH',body:JSON.stringify({estado:status,revisado_por:uid,observacion:note||null,historial:history,actualizado_at:at,publicado:status==='aprobada'})})
    ]);
    await hydrate('rendition-reviewed');return true;
  }

  async function saveReport(payload,published){
    const cid=courseId(),uid=userId(),at=now(),campaignId=payload.campaignId==='__all__'?null:payload.campaignId||null;
    const body={curso_id:cid,campana_id:campaignId,tipo:campaignId?'campana':'general',titulo:payload.campaignTitle||payload.title||'Informe financiero',periodo:payload.period||at.slice(0,7),contenido:JSON.stringify(payload),publicado:!!published,publicado_at:published?at:null,creado_por:uid,estado:published?'publicado':'borrador',actualizado_at:at,metadata:{version:1}};
    const existing=String(payload.supabaseId||payload.id||'');
    const isUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing);
    const rows=isUuid?await api().request(`informes?id=eq.${existing}`,{method:'PATCH',body:JSON.stringify(body)}):await api().request('informes',{method:'POST',body:JSON.stringify(body)});
    await hydrate('report-saved');return Array.isArray(rows)?rows[0]:rows;
  }

  async function unpublishReport(id){
    await api().request(`informes?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({publicado:false,publicado_at:null,estado:'despublicado',actualizado_at:now()})});
    await hydrate('report-unpublished');
  }

  function latestLocalReport(){
    const rows=json('cursapp_campaign_reports_v1',[]);
    return Array.isArray(rows)?rows.slice().sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')))[0]:null;
  }

  function installTreasurerBridges(){
    if(!document.body.classList.contains('cursapp-tesorero')||window.__treasuryBridgesInstalled) return;
    window.__treasuryBridgesInstalled=true;

    window.tesV77Save=async function(id){
      const title=document.getElementById('rv_title')?.value.trim();
      const amount=Number(String(document.getElementById('rv_amount')?.value||'').replace(/[^0-9.-]/g,''));
      if(!title||!amount){alert('Completa concepto y monto.');return;}
      const file=document.getElementById('rv_file')?.files?.[0]||null;
      const expenses=json(scoped('expenses_v1'),[]);const current=(expenses||[]).find(x=>String(x.id)===String(id))||{};
      const actor=session().fullName||session().displayName||session().name||session().nombre||session().email||'Tesorero';
      const input=Object.assign({},current,{id:id||'',supabaseId:current.supabaseId||id||'',campaignId:String(window.__tesRendCampaignId||current.campaignId||''),title,amount,date:document.getElementById('rv_date')?.value||new Date().toISOString().slice(0,10),category:document.getElementById('rv_cat')?.value||'Otros',description:document.getElementById('rv_desc')?.value||'',createdByName:actor,registeredBy:actor});
      const button=document.querySelector('.tesV77ModalActions .primary');if(button){button.disabled=true;button.textContent='Guardando…';}
      try{
        await saveExpense(input,file);
        document.getElementById('modalRoot').innerHTML='<div class="tesV77ModalOverlay"><section class="tesV77Modal"><div class="tesV77Success"><div>✓</div><h2>Rendición guardada en Supabase</h2><p>El presidente ya puede revisarla.</p><button onclick="tesV77Close();tesV77Render()">Aceptar</button></div></section></div>';
        window.tesV77Render?.();
      }catch(e){alert('No se pudo guardar la rendición: '+(e?.message||e));if(button){button.disabled=false;button.textContent='Enviar a aprobación';}}
    };

    const review=(status,title)=>async function(id){
      const note=document.getElementById('rv_approval_note')?.value.trim()||'';
      if((status==='observada'||status==='rechazada')&&!note){alert('Indica el motivo u observación.');return;}
      try{await updateApproval(id,status,note,session().fullName||session().name||'Presidente');alert(title);window.tesV77Close?.();window.tesV77Render?.();}catch(e){alert('No se pudo actualizar la rendición: '+(e?.message||e));}
    };
    window.tesV78Approve=review('aprobada','Rendición aprobada.');
    window.tesV78Observe=review('observada','Corrección solicitada.');
    window.tesV78Reject=review('rechazada','Rendición rechazada.');

    const originalView=window.tesV77View;
    window.tesV77View=function(id){
      originalView?.(id);setTimeout(()=>{
        const expense=(json(scoped('expenses_v1'),[])||[]).find(x=>String(x.id)===String(id));
        const path=expense?.attachments?.[0]?.path;if(!path)return;
        const box=document.querySelector('.tesV78Receipt > div');if(!box||box.querySelector('[data-supa-receipt]'))return;
        const button=document.createElement('button');button.type='button';button.dataset.supaReceipt='1';button.textContent='Abrir';
        button.onclick=async()=>{try{const url=await signedReceipt(path,300);window.open(url,'_blank','noopener')}catch(e){alert(e?.message||e)}};box.appendChild(button);
      },0);
    };

    const originalPublish=window.tesV80Publish;
    window.tesV80Publish=async function(){
      originalPublish?.();const report=latestLocalReport();if(!report)return;
      try{await saveReport(report,true);}catch(e){alert('El informe se mostró localmente, pero no pudo guardarse en Supabase: '+(e?.message||e));}
    };
    const originalUnpublish=window.tesV80Unpublish;
    window.tesV80Unpublish=async function(){
      const report=latestLocalReport();try{if(report?.supabaseId||/^[0-9a-f-]{36}$/i.test(report?.id||''))await unpublishReport(report.supabaseId||report.id);else originalUnpublish?.();}catch(e){alert('No se pudo despublicar el informe: '+(e?.message||e));}
    };
  }

  function installPresidentBridge(){
    if(!document.body.classList.contains('cursapp-presidente')||window.__presidentReportBridgeInstalled) return;
    const original=window.confirmGenerateReport;if(typeof original!=='function')return;
    window.__presidentReportBridgeInstalled=true;
    window.confirmGenerateReport=function(){
      const result=original.apply(this,arguments);
      setTimeout(async()=>{
        const rows=json(scoped('monthly_reports_v1'),[]);const report=Array.isArray(rows)?rows[0]:null;
        if(report)try{await saveReport(report,true)}catch(e){console.error('Informe Presidente no guardado en Supabase',e);alert('No se pudo publicar el informe en Supabase: '+(e?.message||e));}
      },0);
      return result;
    };
  }

  function installPresidentRenditions(){
    if(!document.body.classList.contains('cursapp-presidente')||window.__presidentRenditionsInstalled)return;
    window.__presidentRenditionsInstalled=true;
    const style=document.createElement('style');
    style.textContent='.supaRendSummary{margin:20px 4%;padding:20px;border:1px solid #e6e8ef;border-radius:24px;background:#fff;box-shadow:0 12px 30px rgba(34,42,68,.08)}.supaRendSummary h2{margin:0 0 6px;font-size:24px}.supaRendSummary p{margin:0 0 14px;color:#667085}.supaRendSummary button,.supaRendModal button{border:0;border-radius:14px;padding:12px 18px;font:inherit;font-weight:800;cursor:pointer}.supaRendSummary button,.supaRendPrimary{background:linear-gradient(135deg,#7c2cff,#5520d7);color:#fff}.supaRendOverlay{position:fixed;inset:0;z-index:10060;background:rgba(16,24,40,.55);display:grid;place-items:center;padding:18px}.supaRendModal{width:min(680px,100%);max-height:88vh;overflow:auto;background:#fff;border-radius:26px;padding:22px;box-sizing:border-box}.supaRendHead{display:flex;align-items:center;justify-content:space-between;gap:12px}.supaRendHead button{background:#f2f4f7;color:#101828;font-size:24px}.supaRendItem{border:1px solid #e4e7ec;border-radius:18px;padding:16px;margin-top:14px}.supaRendItem h3{margin:0 0 6px}.supaRendMeta{color:#667085;margin:0 0 12px}.supaRendActions{display:flex;flex-wrap:wrap;gap:8px}.supaRendActions button{background:#f2f4f7;color:#344054}.supaRendActions .approve{background:#dcfae6;color:#067647}.supaRendActions .reject{background:#fee4e2;color:#b42318}.supaRendNote{width:100%;min-height:76px;margin-top:10px;padding:12px;border:1px solid #d0d5dd;border-radius:12px;box-sizing:border-box;font:inherit}.supaRendEmpty{padding:28px 0;text-align:center;color:#667085}';
    document.head.appendChild(style);

    const pending=()=>{const rows=json(scoped('expenses_v1'),[]);return(Array.isArray(rows)?rows:[]).filter(x=>['pendiente','pendiente_aprobacion','observada'].includes(String(x.approvalStatus||x.status||'')))};
    const money=v=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(v||0));
    const close=()=>document.getElementById('supaRendOverlay')?.remove();
    const open=()=>{
      close();const rows=pending(),overlay=document.createElement('div');overlay.id='supaRendOverlay';overlay.className='supaRendOverlay';
      overlay.innerHTML=`<section class="supaRendModal" role="dialog" aria-modal="true" aria-label="Rendiciones pendientes"><div class="supaRendHead"><div><h2>Rendiciones pendientes</h2><p>Revisa los gastos enviados por Tesorería.</p></div><button type="button" data-close aria-label="Cerrar">×</button></div><div data-list>${rows.length?rows.map(x=>`<article class="supaRendItem" data-id="${x.id}"><h3>${String(x.title||x.concept||'Gasto').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</h3><p class="supaRendMeta">${money(x.amount)} · ${x.date||''} · ${x.category||'Otros'}</p><div class="supaRendActions"><button class="approve" data-action="aprobada">Aprobar</button><button data-action="observada">Solicitar corrección</button><button class="reject" data-action="rechazada">Rechazar</button></div><textarea class="supaRendNote" placeholder="Observación (obligatoria al corregir o rechazar)"></textarea></article>`).join(''):'<div class="supaRendEmpty">No existen rendiciones pendientes.</div>'}</div></section>`;
      overlay.querySelector('[data-close]').onclick=close;overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
      overlay.querySelectorAll('[data-action]').forEach(button=>button.onclick=async()=>{const item=button.closest('[data-id]'),status=button.dataset.action,note=item.querySelector('textarea').value.trim();if(status!=='aprobada'&&!note){item.querySelector('textarea').focus();return}button.disabled=true;button.textContent='Guardando…';try{await updateApproval(item.dataset.id,status,note,session().fullName||session().name||'Presidente');item.remove();renderSummary();if(!overlay.querySelector('[data-id]'))overlay.querySelector('[data-list]').innerHTML='<div class="supaRendEmpty">No existen rendiciones pendientes.</div>'}catch(e){alert('No se pudo actualizar la rendición: '+(e?.message||e));button.disabled=false;button.textContent=status==='aprobada'?'Aprobar':status==='observada'?'Solicitar corrección':'Rechazar'}});
      document.body.appendChild(overlay);
    };
    function renderSummary(){
      const app=document.getElementById('app'),rows=pending();if(!app||app.querySelector('.supaRendSummary')||!rows.length)return;
      const card=document.createElement('section');card.className='supaRendSummary';card.innerHTML=`<h2>Rendiciones por revisar</h2><p><strong>${rows.length}</strong> ${rows.length===1?'rendición requiere':'rendiciones requieren'} tu revisión.</p><button type="button">Revisar ahora</button>`;card.querySelector('button').onclick=open;app.prepend(card);
    }
    const observer=new MutationObserver(()=>renderSummary());const app=document.getElementById('app');if(app)observer.observe(app,{childList:true,subtree:false});
    window.addEventListener('cursapp:treasuryHydrated',renderSummary);renderSummary();
  }

  window.CURSAPP_TREASURY={hydrate,saveExpense,updateApproval,saveReport,unpublishReport,signedReceipt,courseId,userId};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{
    hydrate('boot').catch(e=>console.warn('Tesorería Supabase:',e));
    installTreasurerBridges();installPresidentBridge();installPresidentRenditions();
  },180));
})();
