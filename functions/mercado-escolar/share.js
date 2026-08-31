export async function onRequestGet(context){
  const reqUrl=new URL(context.request.url);
  const id=reqUrl.searchParams.get('id')||'';
  if(!id) return new Response('Publicación no encontrada',{status:404});
  const target=new URL('https://ngxistgymgdkoaiulfbq.supabase.co/functions/v1/mercado-share-preview');
  target.searchParams.set('id',id);
  target.searchParams.set('v',reqUrl.searchParams.get('v')||String(Date.now()));
  return Response.redirect(target.href,302);
}
