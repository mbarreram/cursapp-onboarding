(function(){
  "use strict";
  const KEY="cursapp_monetizacion_v1", ALERTS_KEY="cursapp_global_alerts_v1", DISMISS_KEY="cursapp_monetization_dismissed_session_v1", EVENTS_KEY="cursapp_monetization_events_v1";
  const load=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}};
  const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const esc=s=>String(s??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  function seedIfEmpty(){
    const d=load(KEY,null);
    if(d&&Array.isArray(d.banners)&&d.banners.length)return d;
    const seeded={banners:[{id:"bn_demo_libros",title:"10% en útiles y libros escolares",partner:"Librería Escolar",category:"Librería",placement:"todos_perfiles",cta:"Ver descuento",url:"#",region:"Todas",comuna:"Todas",startAt:new Date().toISOString(),endAt:"",priority:1,priceModel:"Fijo",amount:120000,status:"activo",imageEmoji:"📚",createdAt:new Date().toISOString()},{id:"bn_demo_uniformes",title:"Uniformes escolares con despacho",partner:"Uniformes Chile",category:"Uniformes",placement:"home_apoderado",cta:"Cotizar",url:"#",region:"Todas",comuna:"Todas",startAt:new Date().toISOString(),endAt:"",priority:2,priceModel:"Lead",amount:1500,status:"activo",imageEmoji:"👕",createdAt:new Date().toISOString()}],alliances:[],seguros:[],config:{maxBannersPerScreen:1,hideWhenOperationalAlert:true,allowPresidentHide:true}};
    save(KEY,seeded);return seeded;
  }
  function role(){
    const path=location.pathname.toLowerCase();
    if(path.includes("presidente"))return"presidente";
    if(path.includes("tesorero"))return"tesorero";
    if(path.includes("apoderado"))return"apoderado";
    return String(load("cursapp_session_v1",{})?.role||"apoderado").toLowerCase();
  }
  function placements(r){if(r==="presidente")return["inicio_presidente","directiva","todos_perfiles","todos","home"];if(r==="tesorero")return["inicio_tesorero","directiva","todos_perfiles","todos","home"];return["home_apoderado","apoderado","todos_perfiles","todos","home"]}
  function criticalAlert(){const arr=load(ALERTS_KEY,[]),now=Date.now();return arr.some(a=>String(a.status||"activa").toLowerCase()!=="cerrada"&&(!a.endAt||Date.parse(a.endAt)>=now)&&String(a.severity||"").toLowerCase()==="critica")}
  function data(){const d=seedIfEmpty();d.banners=Array.isArray(d.banners)?d.banners:[];d.config=d.config||{};if(!d.config.maxBannersPerScreen)d.config.maxBannersPerScreen=1;return d}
  function sessionDismissed(){try{return JSON.parse(sessionStorage.getItem(DISMISS_KEY)||"{}")||{}}catch(e){return{}}}
  function activeBanners(){
    const d=data();if(d.config.hideWhenOperationalAlert!==false&&criticalAlert())return[];
    const r=role(),allowed=placements(r),now=Date.now(),dismissed=sessionDismissed();
    const list=d.banners.filter(b=>String(b.status||"").toLowerCase()==="activo").filter(b=>!b.startAt||Date.parse(b.startAt)<=now).filter(b=>!b.endAt||Date.parse(b.endAt)>=now).filter(b=>allowed.includes(String(b.placement||"").toLowerCase())).filter(b=>!dismissed[b.id]).sort((a,b)=>Number(a.priority||99)-Number(b.priority||99));
    const max=Number(d.config.maxBannersPerScreen||1),key="cursapp_monetization_rotation_"+r;let cursor=Number(sessionStorage.getItem(key)||0);if(cursor>=list.length)cursor=0;
    const rotated=list.slice(cursor).concat(list.slice(0,cursor));if(list.length)sessionStorage.setItem(key,String((cursor+max)%Math.max(1,list.length)));return rotated.slice(0,max);
  }
  const seen=new Set();
  function track(type,b){const id=type+":"+b.id+":"+role();if(type==="impression"&&seen.has(id))return;if(type==="impression")seen.add(id);const arr=load(EVENTS_KEY,[]);arr.unshift({at:new Date().toISOString(),type,bannerId:b.id,title:b.title,partner:b.partner,placement:b.placement,role:role()});save(EVENTS_KEY,arr.slice(0,500))}
  function dismiss(id){const d=sessionDismissed();d[id]=new Date().toISOString();sessionStorage.setItem(DISMISS_KEY,JSON.stringify(d));render()}
  function openBanner(id){const b=data().banners.find(x=>String(x.id)===String(id));if(!b)return;track("click",b);if(b.url&&b.url!=="#"){location.href=b.url;return}alert(`${b.partner||"Beneficio Cursapp"}\n\n${b.title||""}\n\nPronto conectaremos el detalle del beneficio.`)}
  function card(b){track("impression",b);return`<article class="cursappAdBanner"><div class="cursappAdIcon">${esc(b.imageEmoji||"🏷️")}</div><div class="cursappAdBody"><span>${esc(b.partner||"Beneficio Cursapp")}</span><b>${esc(b.title||"Promoción escolar")}</b><small>${esc(b.category||"Beneficio")} · ${esc(b.region||"Todas")}</small></div><button class="cursappAdCta" onclick="CursappMonetization.open('${esc(b.id)}')">${esc(b.cta||"Ver")}</button><button class="cursappAdClose" onclick="CursappMonetization.dismiss('${esc(b.id)}')">×</button></article>`}
  function styles(){if(document.getElementById("cursappMonetizationStyle"))return;const st=document.createElement("style");st.id="cursappMonetizationStyle";st.textContent=`.cursappMonetizationSlot{margin:14px 20px 18px;display:grid;gap:10px}.cursappAdBanner{position:relative;display:grid;grid-template-columns:50px minmax(0,1fr) auto;gap:12px;align-items:center;padding:14px 42px 14px 14px;border-radius:22px;background:linear-gradient(135deg,#fff,#fbf8ff);border:1px solid rgba(124,58,237,.16);box-shadow:0 14px 36px rgba(15,23,42,.08);overflow:hidden}.cursappAdBanner:before{content:"";position:absolute;inset:0 auto 0 0;width:5px;background:linear-gradient(180deg,#7c3aed,#22c55e)}.cursappAdIcon{width:50px;height:50px;border-radius:18px;display:grid;place-items:center;background:#f3e8ff;font-size:26px}.cursappAdBody span,.cursappAdBody small{display:block;color:#667085;font-size:12px;font-weight:850;line-height:1.2}.cursappAdBody b{display:block;color:#101828;font-size:15px;font-weight:950;line-height:1.2;margin:3px 0}.cursappAdCta{border:0;border-radius:14px;padding:11px 13px;background:linear-gradient(135deg,#6d28d9,#8b5cf6);color:#fff;font-weight:950;white-space:nowrap}.cursappAdClose{position:absolute;top:10px;right:10px;width:26px;height:26px;border:0;border-radius:999px;background:#f1f5f9;color:#667085;font-size:18px;line-height:1;font-weight:900}@media(max-width:560px){.cursappMonetizationSlot{margin:12px 16px 16px}.cursappAdBanner{grid-template-columns:44px minmax(0,1fr);padding:13px 40px 13px 13px}.cursappAdIcon{width:44px;height:44px;border-radius:16px;font-size:23px}.cursappAdCta{grid-column:1/-1;width:100%}}`;document.head.appendChild(st)}
  function target(){for(const s of["[data-monetization-slot]","#monetizationSlot","#app","main",".app",".content"]){const el=document.querySelector(s);if(el)return{el,inside:s.includes("monetization")}}return null}
  function render(){styles();document.querySelector(".cursappMonetizationSlot")?.remove();const bs=activeBanners();if(!bs.length)return;const t=target();if(!t)return;const slot=document.createElement("section");slot.className="cursappMonetizationSlot";slot.innerHTML=bs.map(card).join("");t.inside?t.el.appendChild(slot):t.el.prepend(slot)}
  let obs=false;function observer(){if(obs)return;obs=true;new MutationObserver(()=>{if(!document.querySelector(".cursappMonetizationSlot")){clearTimeout(window.__cursappMonetTimer);window.__cursappMonetTimer=setTimeout(render,80)}}).observe(document.body,{childList:true,subtree:true})}
  window.CursappMonetization={render,dismiss,open:openBanner,debug(){alert("Debug Monetización\nRol: "+role()+"\nBanners activos: "+activeBanners().length);console.log({role:role(),data:data(),banners:activeBanners(),target:target()})}};
  document.addEventListener("DOMContentLoaded",()=>{observer();setTimeout(render,120);setTimeout(render,600);setTimeout(render,1600)});
  window.addEventListener("pageshow",()=>setTimeout(render,120));
})();