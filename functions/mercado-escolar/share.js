function esc(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function safeImage(v,origin){
  try{
    const u=new URL(String(v||''),origin);
    if(u.protocol!=='https:') return `${origin}/mercado-escolar/assets/img/hero-items-final.png`;
    return u.href;
  }catch(_){return `${origin}/mercado-escolar/assets/img/hero-items-final.png`;}
}
export async function onRequestGet(context){
  const reqUrl=new URL(context.request.url);
  const id=reqUrl.searchParams.get('id')||'';
  const title=(reqUrl.searchParams.get('title')||'Publicación').slice(0,140);
  const price=(reqUrl.searchParams.get('price')||'').slice(0,40);
  const image=safeImage(reqUrl.searchParams.get('image'),reqUrl.origin);
  const destination=`${reqUrl.origin}/mercado-escolar/publicacion.html?id=${encodeURIComponent(id)}`;
  const ogTitle=`${title} · Mercado Escolar MiCursoX`;
  const description=price?`${price} · Publicación en Mercado Escolar MiCursoX`:'Publicación en Mercado Escolar MiCursoX';
  const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(ogTitle)}</title><meta name="description" content="${esc(description)}"><meta property="og:type" content="website"><meta property="og:site_name" content="MiCursoX"><meta property="og:title" content="${esc(ogTitle)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(reqUrl.href)}"><meta property="og:image" content="${esc(image)}"><meta property="og:image:secure_url" content="${esc(image)}"><meta property="og:image:alt" content="${esc(title)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(ogTitle)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${esc(image)}"><meta http-equiv="refresh" content="0;url=${esc(destination)}"><link rel="canonical" href="${esc(destination)}"></head><body><p>Abriendo publicación de Mercado Escolar MiCursoX…</p><script>location.replace(${JSON.stringify(destination)});</script></body></html>`;
  return new Response(html,{headers:{'content-type':'text/html; charset=UTF-8','cache-control':'public, max-age=300'}});
}
