(function(){
  'use strict';
  const sb=window.CURSAPP_SUPABASE;
  if(!sb||!sb.functions||typeof sb.functions.invoke!=='function')return;
  let running=false;
  async function flush(){
    if(running)return;
    running=true;
    try{
      for(let attempt=0;attempt<3;attempt++){
        if(attempt)await new Promise(r=>setTimeout(r,1200));
        const result=await sb.functions.invoke('send-web-push',{body:{mode:'pending'}});
        if(result?.error)throw result.error;
        const processed=Number(result?.data?.processed||0);
        if(processed===0&&attempt<2)continue;
        console.info('Push Cursapp procesado',result?.data||{});
        break;
      }
    }catch(error){
      console.error('No se pudo procesar la cola push',error);
    }finally{running=false}
  }
  document.addEventListener('click',function(e){
    const button=e.target.closest('#stsave');
    if(!button)return;
    setTimeout(flush,800);
  },true);
  window.CURSAPP_ADMIN_PUSH={flush};
})();