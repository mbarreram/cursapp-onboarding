
(function(){
  function esc(s){
    if(s===null||s===undefined) return "";
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }
  function safeJson(s){
    try{ return JSON.parse(s); }catch(e){ return null; }
  }
  function render(){
    var root=document.getElementById("perfil-root");
    if(!root) return;
    var keys=[];
    try{
      for(var i=0;i<localStorage.length;i++){ keys.push(localStorage.key(i)); }
    }catch(e){
      root.innerHTML="<div style='padding:16px'>No se puede leer localStorage: "+esc(e.message)+"</div>";
      return;
    }
    keys.sort();
    var interesting=[];
    for(var j=0;j<keys.length;j++){
      var k=keys[j]||"";
      var lk=k.toLowerCase();
      if(lk.indexOf("cursapp")>=0 || lk.indexOf("session")>=0 || lk.indexOf("user")>=0 || lk.indexOf("auth")>=0) {
        interesting.push(k);
      }
    }
    var html="";
    html += "<div style='padding:16px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial'>";
    html += "<h2 style='margin:0 0 8px'>Inspector de sesión (v20260215031827)</h2>";
    html += "<p style='margin:0 0 12px;opacity:.75'>Esto muestra qué key usa tu login para guardar la sesión.</p>";
    html += "<div style='padding:12px;border:1px solid rgba(0,0,0,.1);border-radius:12px;background:#fff'>";
    html += "<div style='font-weight:700;margin-bottom:8px'>Keys relevantes ("+interesting.length+")</div>";
    if(interesting.length===0){
      html += "<div style='opacity:.75'>No encontré keys tipo session/user/cursapp.</div>";
    } else {
      for(var a=0;a<interesting.length;a++) {
        var key=interesting[a];
        var val=localStorage.getItem(key);
        var preview=val;
        if(preview && preview.length>260) preview=preview.slice(0,260)+"…";
        var parsed=safeJson(val);
        var hint="";
        if(parsed && typeof parsed==="object") {
          if(parsed.user || parsed.currentRole || parsed.roles || parsed.courseKey) hint=" ✅ parece sesión";
        }
        html += "<div style='margin:10px 0;padding-top:10px;border-top:1px solid rgba(0,0,0,.06)'>";
        html += "<div><code style='font-weight:800'>"+esc(key)+"</code>"+esc(hint)+"</div>";
        html += "<div style='margin-top:6px;font-size:12px;opacity:.85;word-break:break-word'><code>"+esc(preview||"")+"</code></div>";
        html += "</div>";
      }
    }
    html += "</div>";
    html += "<div style='margin-top:12px;font-size:12px;opacity:.75'>Luego me dices cuál key tiene ✅ parece sesión.</div>";
    html += "</div>";
    root.innerHTML=html;
  }
  document.addEventListener("DOMContentLoaded", function(){ try{ render(); }catch(e){ alert("ERROR inspector: "+e.message); } });
})();
