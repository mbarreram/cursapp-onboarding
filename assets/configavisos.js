(function(){
  "use strict";

  const esc=s=>String(s??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const json=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||"null")??d}catch(e){return d}};
  const session=()=>json("cursapp_session_v1",{})||{};
  const role=()=>String(localStorage.getItem("cursapp_active_role_v1")||session().activeRole||session().role||"").toLowerCase();
  const userId=()=>String(session().auth_user_id||session().authUserId||session().user_uuid||session().usuario_id||session().supabase?.auth_user_id||"").trim();
  const courseKey=()=>String(localStorage.getItem("cursapp_active_course_v1")||session().courseKey||session().activeCourseKey||"").trim();
  const cacheKey=()=>`cursapp_${courseKey().replace(/[^a-zA-Z0-9_-]/g,"_")||"global"}_avisos_v2`;
  let rows=[];
  let course=null;

  async function request(path,opts){
    if(!window.CURSAPP_SUPABASE||typeof window.CURSAPP_SUPABASE.request!=="function") throw new Error("Supabase no está disponible.");
    return window.CURSAPP_SUPABASE.request(path,opts||{method:"GET"});
  }
  async function activeCourse(){
    if(course&&course.id) return course;
    const cached=json("cursapp_course_v1",{})||{};
    const cachedId=String(cached.id||cached.curso_id||cached.course?.id||session().curso_id||session().courseId||session().supabase?.curso_id||"").trim();
    if(cachedId){ course={id:cachedId,total_alumnos:Number(cached.total_alumnos??cached.totalAlumnos??cached.course?.total_alumnos??0)||0}; return course; }
    const ck=courseKey();
    if(!ck) throw new Error("No se encontró el curso activo.");
    const found=await request("cursos?course_key=eq."+encodeURIComponent(ck)+"&select=id,total_alumnos&limit=1",{method:"GET"});
    course=Array.isArray(found)?found[0]:null;
    if(!course) throw new Error("El curso activo no existe.");
    return course;
  }
  function normalize(a,readingList=[]){
    const reads=readingList.filter(r=>String(r.aviso_id)===String(a.id)&&r.leido!==false);
    const me=userId();
    return {
      id:String(a.id), type:"manual", category:String(a.tipo||"info"), priority:String(a.prioridad||"normal"),
      title:String(a.titulo||"Aviso"), message:String(a.mensaje||""), createdAt:String(a.created_at||""),
      readBy:Array.from(new Set(reads.map(r=>String(r.usuario_id||"")).filter(Boolean))),
      readCount:new Set(reads.map(r=>String(r.usuario_id||"")).filter(Boolean)).size,
      audienceCount:Math.max(0,Number(course?.total_alumnos||0)),
      isRead:!!(me&&reads.some(r=>String(r.usuario_id)===me)), courseScope:courseKey()
    };
  }
  function persist(){
    localStorage.setItem(cacheKey(),JSON.stringify(rows));
    try{window.dispatchEvent(new CustomEvent("cursapp:dataUpdated",{detail:{kind:"notices"}}))}catch(e){}
    try{window.renderAvisosBell&&window.renderAvisosBell()}catch(e){}
  }
  async function refresh(){
    const c=await activeCourse();
    const legacy=json(cacheKey(),[])||[];
    let notices=await request("avisos_curso?curso_id=eq."+encodeURIComponent(c.id)+"&visible=eq.true&order=created_at.desc&select=*",{method:"GET"});
    if(role()==="presidente" && Array.isArray(legacy) && legacy.length){
      const remote=Array.isArray(notices)?notices:[];
      const pending=legacy.filter(a=>String(a?.type||"")==="manual" && a?.title && a?.message).filter(a=>
        !remote.some(r=>String(r.titulo||"").trim()===String(a.title||"").trim() && String(r.mensaje||"").trim()===String(a.message||"").trim())
      );
      for(const a of pending.slice(0,50)){
        try{await request("avisos_curso",{method:"POST",body:JSON.stringify({curso_id:c.id,titulo:String(a.title),mensaje:String(a.message),prioridad:String(a.priority||"normal"),visible:true,tipo:String(a.category||"info"),created_at:a.createdAt||new Date().toISOString()})})}catch(e){console.warn("No se pudo migrar aviso local",e)}
      }
      if(pending.length) notices=await request("avisos_curso?curso_id=eq."+encodeURIComponent(c.id)+"&visible=eq.true&order=created_at.desc&select=*",{method:"GET"});
    }
    const ids=(Array.isArray(notices)?notices:[]).map(x=>x.id).filter(Boolean);
    let readings=[];
    if(ids.length){
      try{readings=await request("avisos_curso_lecturas?aviso_id=in.("+ids.map(encodeURIComponent).join(",")+")&select=aviso_id,usuario_id,leido,fecha_lectura",{method:"GET"})}catch(e){console.warn("Lecturas de avisos no disponibles",e)}
    }
    rows=(Array.isArray(notices)?notices:[]).map(a=>normalize(a,Array.isArray(readings)?readings:[]));
    persist();
    return rows;
  }
  const visible=()=>rows.slice();
  const isRead=a=>!!a.isRead;
  const tag=t=>({info:"ℹ️",financial:"💳",report:"📊",campaign:"📌",urgent:"⚠️"})[String(t||"info")]||"ℹ️";
  const date=iso=>{try{return new Date(iso).toLocaleString("es-CL",{dateStyle:"short",timeStyle:"short"})}catch(e){return""}};

  async function markRead(id){
    const uid=userId(); if(!uid||!id) return;
    try{
      await request("avisos_curso_lecturas?on_conflict=aviso_id,usuario_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({aviso_id:id,usuario_id:uid,leido:true,fecha_lectura:new Date().toISOString()})});
    }catch(e){
      await request("avisos_curso_lecturas?aviso_id=eq."+encodeURIComponent(id)+"&usuario_id=eq."+encodeURIComponent(uid),{method:"PATCH",body:JSON.stringify({leido:true,fecha_lectura:new Date().toISOString()})});
    }
  }

  function close(){
    document.getElementById("cursappAvisosConfigOverlay")?.remove();
    document.getElementById("cursappAvisosInboxOverlay")?.remove();
  }
  window.closeAvisosModal=close;

  window.renderAvisosBell=function(){
    const host=document.getElementById("avisosBellHost"); if(!host)return;
    const unread=visible().filter(a=>!isRead(a)).length;
    host.innerHTML=`<button class="btn ghost" id="avisosBtn" type="button" aria-label="Avisos" style="position:absolute;right:68px;top:10px;z-index:10001;width:42px;height:42px;border-radius:999px;">✉️${unread?`<span style="position:absolute;top:-4px;right:-2px;min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:#7c3aed;color:#fff;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center;">${unread>9?"9+":unread}</span>`:""}</button>`;
    document.getElementById("avisosBtn").onclick=()=>window.openAvisosInbox();
  };

  window.openAvisosInbox=async function(){
    const all=visible();
    const ov=document.createElement("div"); ov.id="cursappAvisosInboxOverlay";
    ov.style.cssText="position:fixed;inset:0;z-index:999998;background:rgba(15,23,42,.48);display:flex;align-items:flex-end;justify-content:center;padding:14px;";
    ov.innerHTML=`<div style="width:min(720px,100%);max-height:82vh;overflow:auto;background:#fff;border-radius:28px;padding:22px;box-shadow:0 30px 90px rgba(15,23,42,.30);font-family:system-ui,sans-serif;"><div style="display:flex;justify-content:space-between;gap:12px"><div><div style="font-size:24px;font-weight:950">Avisos del curso</div><div style="color:#667085;margin-top:6px;font-weight:750">Comunicados enviados por la directiva.</div></div><button id="cerrarAvisosInbox" class="btn ghost">Cerrar</button></div><div style="margin-top:16px;display:grid;gap:10px;">${all.length?all.map(a=>`<article style="border:1px solid #e5e7eb;border-radius:18px;padding:14px"><b>${tag(a.category)} ${esc(a.title)}</b><p style="color:#667085;font-weight:700">${esc(a.message)}</p><small>${date(a.createdAt)}</small></article>`).join(""):`<div style="color:#667085;font-weight:800;padding:14px">Aún no hay avisos.</div>`}</div></div>`;
    document.body.appendChild(ov); document.getElementById("cerrarAvisosInbox").onclick=()=>ov.remove();
    await Promise.all(all.filter(a=>!a.isRead).map(a=>markRead(a.id).catch(()=>{}))); await refresh();
  };

  function sentList(){
    return rows.length?rows.map(a=>`<div style="border:1px solid #e5e7eb;border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;gap:10px"><div><b>${tag(a.category)} ${esc(a.title)}</b><p style="color:#667085;font-weight:700">${esc(a.message)}</p><small>${date(a.createdAt)} · ${a.readCount} de ${a.audienceCount} vistos</small></div><button data-del-aviso="${esc(a.id)}" style="border:0;background:#fee2e2;color:#b91c1c;border-radius:12px;padding:8px">Eliminar</button></div></div>`).join(""):`<div style="color:#667085;font-weight:800;padding:14px">Aún no hay avisos enviados.</div>`;
  }
  async function openSend(){
    await refresh().catch(()=>{});
    close(); const ov=document.createElement("div"); ov.id="cursappAvisosConfigOverlay";
    ov.style.cssText="position:fixed;inset:0;z-index:999999;background:rgba(15,23,42,.48);display:flex;align-items:flex-end;justify-content:center;padding:14px;";
    ov.innerHTML=`<div style="width:min(720px,100%);max-height:86vh;overflow:auto;background:#fff;border-radius:28px;padding:22px;font-family:system-ui,sans-serif"><div style="display:flex;justify-content:space-between"><div><h2 style="margin:0">Enviar aviso al curso</h2><p style="color:#667085">Se guardará en Supabase y será visible para este curso.</p></div><button id="cerrarAvisosConfig" class="btn ghost">Cerrar</button></div><div style="display:grid;gap:12px;background:#fbfbff;border-radius:22px;padding:14px"><input id="av_title" placeholder="Título del aviso"><textarea id="av_msg" placeholder="Escribe el mensaje..." style="min-height:110px"></textarea><select id="av_type"><option value="info">ℹ️ Informativo</option><option value="financial">💳 Financiero</option><option value="report">📊 Informe</option><option value="campaign">📌 Campaña</option><option value="urgent">⚠️ Urgente</option></select><button id="saveAvisoCursoBtn" class="btn primary">📢 Enviar aviso</button></div><h3>Avisos enviados</h3><div style="display:grid;gap:10px">${sentList()}</div></div>`;
    document.body.appendChild(ov); document.getElementById("cerrarAvisosConfig").onclick=()=>ov.remove();
    document.getElementById("saveAvisoCursoBtn").onclick=()=>window.saveAvisoCurso();
    ov.querySelectorAll("[data-del-aviso]").forEach(b=>b.onclick=()=>window.deleteAvisoCurso(b.dataset.delAviso));
  }
  window.saveAvisoCurso=async function(){
    const title=document.getElementById("av_title")?.value.trim(),message=document.getElementById("av_msg")?.value.trim(),category=document.getElementById("av_type")?.value||"info";
    if(!title||!message){alert("Completa título y mensaje.");return}
    const c=await activeCourse();
    await request("avisos_curso",{method:"POST",body:JSON.stringify({curso_id:c.id,titulo:title,mensaje:message,prioridad:category==="urgent"?"alta":"normal",visible:true,tipo:category})});
    await refresh(); alert("Aviso enviado correctamente ✅"); openSend();
  };
  window.deleteAvisoCurso=async id=>{await request("avisos_curso?id=eq."+encodeURIComponent(id),{method:"DELETE"});await refresh();openSend()};
  window.openAvisosCursoSendModal=openSend; window.openAvisosConfigReal=openSend; window.openAvisosConfig=openSend;

  document.addEventListener("DOMContentLoaded",async()=>{try{await refresh()}catch(e){console.warn("No se pudieron cargar avisos",e)}window.renderAvisosBell()});
})();