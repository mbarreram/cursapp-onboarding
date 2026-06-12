(function(){"use strict";
const KEY="cursapp_monetizacion_v1",ALERTS_KEY="cursapp_global_alerts_v1",EVENTS_KEY="cursapp_monetization_events_v1";
const dismissedInPage={};
function load(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}}
function save(k,v){localStorage.setItem(k,JSON.stringify(v))}
function esc(s){return String(s??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]))}
function role(){const p=location.pathname.toLowerCase();if(p.includes("presidente"))return"presidente";if(p.includes("tesorero"))return"tesorero";if(p.includes("apoderado"))return"apoderado";return"apoderado"}
function allowed(r){if(r==="presidente")return["todos_perfiles","inicio_presidente","directiva","home"];if(r==="tesorero")return["todos_perfiles","inicio_tesorero","directiva","home"];return["todos_perfiles","home_apoderado","apoderado","home"]}
function seed(){let d=load(KEY,null);if(d&&Array.isArray(d.banners)&&d.banners.length)return d;d={banners:[{id:"bn_uniformes_chile",title:"Uniformes escolares con despacho",subtitle:"Uniformes",partner:"Uniformes Chile",category:"Uniformes",placement:"todos_perfiles",cta:"Cotizar",url:"#",status:"activo",priority:1,startAt:new Date().toISOString(),endAt:"",imageEmoji:"👕",heroGradient:"purple"},{id:"bn_libreria",title:"Libros y útiles escolares",subtitle:"Beneficio para apoderados Cursapp",partner:"Librería Escolar",category:"Librería",placement:"todos_perfiles",cta:"Ver catálogo",url:"#",status:"activo",priority:2,startAt:new Date().toISOString(),endAt:"",imageEmoji:"📚",heroGradient:"blue"}],config:{maxBannersPerScreen:1,hideWhenOperationalAlert:true,rotation:true}};save(KEY,d);return d}
function data(){const d=seed();d.banners=Array.isArray(d.banners)?d.banners:[];d.config=Object.assign({maxBannersPerScreen:1,hideWhenOperationalAlert:true,rotation:true},d.config||{});return d}
function critical(){const arr=load(ALERTS_KEY,[]),now=Date.now();return arr.some(a=>String(a.status||"activa").toLowerCase()!=="cerrada"&&(!a.endAt||Date.parse(a.endAt)>=now)&&String(a.severity||"").toLowerCase()==="critica")}
function active(){const d=data();if(d.config.hideWhenOperationalAlert!==false&&critical())return[];const r=role(),a=allowed(r),now=Date.now();let list=d.banners.filter(b=>String(b.status||"").toLowerCase()==="activo").filter(b=>!b.startAt||Date.parse(b.startAt)<=now).filter(b=>!b.endAt||Date.parse(b.endAt)>=now).filter(b=>a.includes(String(b.placement||"").toLowerCase())).filter(b=>!dismissedInPage[b.id]).sort((x,y)=>Number(x.priority||99)-Number(y.priority||99));const max=Number(d.config.maxBannersPerScreen||1);return list.slice(0,max)}
const seen={};function track(t,b){const id=t+":"+b.id+":"+role();if(t==="impression"&&seen[id])return;if(t==="impression")seen[id]=1;const arr=load(EVENTS_KEY,[]);arr.unshift({at:new Date().toISOString(),type:t,bannerId:b.id,title:b.title,partner:b.partner,role:role(),placement:b.placement});save(EVENTS_KEY,arr.slice(0,500))}
function grad(g){return{blue:"linear-gradient(135deg,#0f172a,#0ea5e9)",green:"linear-gradient(135deg,#064e3b,#22c55e)",pink:"linear-gradient(135deg,#831843,#ec4899)",purple:"linear-gradient(135deg,#4c1d95,#8b5cf6)"}[g]||"linear-gradient(135deg,#4c1d95,#8b5cf6)"}
function removeMotivator(){const classes='.cpV5Community,.cpV6Community,.motivator,.motivador,.bannerMotivador,.motivational,.homeMotivator,[data-motivator]';document.querySelectorAll(classes).forEach(x=>x.remove());const phrases=["tu curso, tu comunidad","con tu apoyo","grandes cosas","gestión clara para tomar mejores decisiones","finanzas claras","movimientos bajo control"];document.querySelectorAll('section,article,div').forEach(el=>{if(el.closest('.cursappRetailSlot,.bottomNav,.topbar,header,nav'))return;const t=(el.textContent||'').trim().toLowerCase();if(t.length>10&&t.length<220&&phrases.some(p=>t.includes(p))&&!el.querySelector('input,select,textarea'))el.remove()})}
function card(b){track("impression",b);return`<article class="cursappRetailBanner" style="background:${grad(b.heroGradient)}"><div class="retailCopy"><span>Beneficio Cursapp · ${esc(b.partner||"Comercio")}</span><b>${esc(b.title||"Promoción escolar")}</b><small>${esc(b.subtitle||b.category||"Beneficio para la comunidad")}</small><button onclick="CursappMonetization.open('${esc(b.id)}')">${esc(b.cta||"Ver")}</button></div><div class="retailVisual">${esc(b.imageEmoji||"🛍️")}</div><button class="retailClose" onclick="CursappMonetization.dismiss('${esc(b.id)}')">×</button></article>`}
function styles(){if(document.getElementById("cursappMonetizationRetailStyle"))return;const st=document.createElement("style");st.id="cursappMonetizationRetailStyle";st.textContent=`.cpV5Community,.cpV6Community,.motivator,.motivador,.bannerMotivador,.motivational,.homeMotivator,[data-motivator]{display:none!important}.cursappRetailSlot{margin:22px 16px 104px;display:grid;gap:12px}.cursappRetailBanner{position:relative;min-height:170px;border-radius:28px;overflow:hidden;display:grid;grid-template-columns:1fr 108px;gap:12px;align-items:center;padding:20px;box-shadow:0 20px 50px rgba(15,23,42,.16);color:#fff}.retailCopy span,.retailCopy small{display:block;color:#ede9fe;font-size:12px;font-weight:850;line-height:1.25}.retailCopy b{display:block;font-size:24px;line-height:1.03;letter-spacing:-.04em;margin:7px 0}.retailCopy button{margin-top:13px;border:0;border-radius:999px;padding:11px 14px;background:#fff;color:#6d28d9;font-weight:950}.retailVisual{font-size:72px;text-align:center;filter:drop-shadow(0 12px 20px rgba(0,0,0,.18))}.retailClose{position:absolute;right:12px;top:12px;width:30px;height:30px;border:0;border-radius:999px;background:rgba(255,255,255,.2);color:#fff;font-size:20px;font-weight:900}@media(max-width:520px){.cursappRetailSlot{margin:20px 14px 100px}.cursappRetailBanner{grid-template-columns:1fr 86px;min-height:155px;padding:18px}.retailCopy b{font-size:21px}.retailVisual{font-size:58px}}`;document.head.appendChild(st)}
function target(){const r=role();const slot=document.querySelector(`[data-monetization-slot="${r}"]`)||document.querySelector('[data-monetization-slot]');if(slot)return slot;for(const s of["main #app","#app","main",".app",".content","body"]){const el=document.querySelector(s);if(el)return el}return null}
function render(){styles();removeMotivator();document.querySelectorAll(".cursappRetailSlot").forEach(x=>x.remove());const bs=active();if(!bs.length)return;const t=target();if(!t)return;const slot=document.createElement("section");slot.className="cursappRetailSlot";slot.innerHTML=bs.map(card).join("");t.appendChild(slot)}
function dismiss(id){dismissedInPage[id]=1;const b=data().banners.find(x=>String(x.id)===String(id));if(b)track("close",b);render()}
function open(id){const b=data().banners.find(x=>String(x.id)===String(id));if(!b)return;track("click",b);if(b.url&&b.url!=="#"){location.href=b.url;return}alert((b.partner||"Beneficio Cursapp")+"\n\n"+(b.title||"")+"\n\nPronto conectaremos el detalle del beneficio.")}
let obs=false;function observer(){return}
window.CursappMonetization={render,dismiss,open};document.addEventListener("DOMContentLoaded",()=>{setTimeout(render,250)});window.addEventListener("pageshow",()=>setTimeout(render,250));
})();

/* Cursapp · Monetization resilient render v2 */
(function(){
  if(window.__CURSAPP_MONETIZATION_RESILIENT_V2__) return;
  window.__CURSAPP_MONETIZATION_RESILIENT_V2__ = true;
  function safeRender(){ try{ if(window.CursappMonetization && typeof window.CursappMonetization.render === "function") window.CursappMonetization.render(); }catch(e){} }
  document.addEventListener("DOMContentLoaded", ()=>setTimeout(safeRender, 450));
  window.addEventListener("pageshow", ()=>setTimeout(safeRender, 450));
  window.addEventListener("cursapp:dataChanged", ()=>setTimeout(safeRender, 180));
  window.addEventListener("cursapp:dataUpdated", ()=>setTimeout(safeRender, 180));
  try{
    const mo = new MutationObserver(()=>{
      if(window.__cursappMonetizationRenderTimer) clearTimeout(window.__cursappMonetizationRenderTimer);
      window.__cursappMonetizationRenderTimer = setTimeout(safeRender, 260);
    });
    mo.observe(document.body, {childList:true, subtree:true});
  }catch(e){}
})();
