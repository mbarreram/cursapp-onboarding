(function(){
'use strict';
if(window.__MICURSOX_CAMPAIGN_DETAIL_SELECTION_FIX_V1__) return;
window.__MICURSOX_CAMPAIGN_DETAIL_SELECTION_FIX_V1__=true;

var hint={id:'',title:'',at:0};
function norm(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();}
function uuid(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));}
function extractId(el){
  var nodes=[];var n=el;
  for(var i=0;n&&i<5;i++,n=n.parentElement) nodes.push(n);
  for(var j=0;j<nodes.length;j++){
    var x=nodes[j];
    var vals=[x.dataset&&x.dataset.id,x.dataset&&x.dataset.campaignId,x.dataset&&x.dataset.campanaId,x.dataset&&x.dataset.taskId,x.getAttribute&&x.getAttribute('data-id'),x.getAttribute&&x.getAttribute('data-campaign-id'),x.getAttribute&&x.getAttribute('data-campana-id'),x.getAttribute&&x.getAttribute('onclick')];
    for(var k=0;k<vals.length;k++){
      var s=String(vals[k]||'');
      if(uuid(s)) return s;
      var m=s.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
      if(m) return m[0];
    }
  }
  return '';
}
function extractTitle(el){
  var n=el;
  for(var i=0;n&&i<5;i++,n=n.parentElement){
    var heads=n.querySelectorAll&&n.querySelectorAll('h1,h2,h3,h4,.campaign-title,.campana-title,[data-campaign-title],[data-campana-title]');
    if(heads&&heads.length){
      for(var j=0;j<heads.length;j++){
        var t=String(heads[j].textContent||'').trim();
        if(t&&!/campañas|campanas|detalle campaña|detalle de campaña/i.test(t)) return t;
      }
    }
  }
  return '';
}
function remember(ev){
  var b=ev.target&&ev.target.closest?ev.target.closest('button,a,[role="button"]'):null;
  if(!b) return;
  var txt=norm(b.textContent);
  if(!(txt==='ver detalle'||txt.includes('ver detalle')||txt==='detalle'||txt.includes('detalle campaña'))) return;
  hint={id:extractId(b),title:extractTitle(b),at:Date.now()};
  window.__MICURSOX_CAMPAIGN_DETAIL_HINT__=hint;
}
document.addEventListener('pointerdown',remember,true);
document.addEventListener('click',remember,true);

function install(){
  var sb=window.CURSAPP_SUPABASE;
  if(!sb||typeof sb.request!=='function'||sb.__mxCampaignDetailWrapped) return false;
  var original=sb.request.bind(sb);
  sb.request=async function(path,opt){
    var active=(Date.now()-Number(hint.at||0))<5000;
    var p=String(path||'');
    if(active&&/^campanas\?select=\*/i.test(p)){
      if(hint.id){
        try{return await original('campanas?select=*&id=eq.'+encodeURIComponent(hint.id)+'&limit=1',opt);}catch(_e){}
      }
      if(hint.title){
        try{
          var rows=await original('campanas?select=*&order=created_at.desc&limit=100',opt);
          if(Array.isArray(rows)){
            var nt=norm(hint.title);
            var exact=rows.find(function(r){return norm(r&&r.titulo)===nt;});
            if(exact) return [exact];
            var close=rows.find(function(r){var rt=norm(r&&r.titulo);return rt&&nt&&(rt.includes(nt)||nt.includes(rt));});
            if(close) return [close];
          }
        }catch(_e){}
      }
    }
    return original(path,opt);
  };
  sb.__mxCampaignDetailWrapped=true;
  return true;
}
var tries=0;var timer=setInterval(function(){tries++;if(install()||tries>80)clearInterval(timer);},50);
install();
})();
