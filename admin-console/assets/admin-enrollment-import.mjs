const sb=window.CURSAPP_SUPABASE;
const $=s=>document.querySelector(s);
const logEl=$('#log');
function log(t){logEl.style.display='block';logEl.textContent+=(logEl.textContent?'\n':'')+t;logEl.scrollTop=logEl.scrollHeight}
function norm(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_|_$/g,'')}
function splitLine(line,sep){const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}else if(ch===sep&&!q){out.push(cur);cur=''}else cur+=ch}out.push(cur);return out}
function numberValue(v){const n=Number(String(v??'').trim().replace(/\./g,'').replace(',','.').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?Math.max(0,Math.round(n)):0}
function parse(text){
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim());
  if(lines.length<2)throw new Error('El archivo no contiene datos');
  const sample=lines[0];
  const sep=(sample.match(/;/g)||[]).length>(sample.match(/,/g)||[]).length?';':',';
  const headers=splitLine(lines[0],sep).map(norm);
  const find=(names)=>names.map(x=>headers.indexOf(x)).find(i=>i>=0);
  const rbdIndex=find(['RBD','RBD_ESTABLECIMIENTO','CODIGO_RBD']);
  let matIndex=find(['MAT_TOTAL','MATRICULA','MATRICULA_TOTAL','TOTAL_MATRICULA','MATRICULA_ESTABLECIMIENTO']);
  let coursesIndex=find(['CUR_SIM_TOT','CURSOS_TOTAL','TOTAL_CURSOS','CANTIDAD_CURSOS']);
  if(matIndex==null||matIndex<0)matIndex=headers.findIndex(h=>h.includes('MATRICULA')&&h.includes('TOTAL'));
  if(coursesIndex==null||coursesIndex<0)coursesIndex=headers.findIndex(h=>h.includes('CUR')&&h.includes('TOT'));
  if(rbdIndex==null||rbdIndex<0)throw new Error('No se encontró la columna RBD');
  if(matIndex<0)throw new Error('No se encontró MAT_TOTAL o una columna de matrícula total');
  const grouped=new Map();
  for(let i=1;i<lines.length;i++){
    const cols=splitLine(lines[i],sep);
    const rbd=String(cols[rbdIndex]??'').trim().replace(/\.0$/,'');
    if(!rbd)continue;
    const current=grouped.get(rbd)||{rbd,matricula:0,cursos:0,filas:0};
    current.matricula+=numberValue(cols[matIndex]);
    current.cursos+=coursesIndex>=0?numberValue(cols[coursesIndex]):0;
    current.filas++;
    grouped.set(rbd,current);
  }
  return [...grouped.values()];
}
async function rpc(name,body){return sb.request(`rpc/${name}`,{method:'POST',body:JSON.stringify(body)})}
async function validate(){const user=await sb.getCurrentUser();if(!user)throw new Error('Debes iniciar sesión');const rows=await sb.request(`admin_users?select=user_id&user_id=eq.${encodeURIComponent(user.id)}&active=eq.true&limit=1`);if(!Array.isArray(rows)||!rows.length)throw new Error('La cuenta no tiene rol administrativo')}
$('#start').onclick=async()=>{
  const file=$('#csv').files?.[0];const year=Number($('#year').value);
  if(!file)return alert('Selecciona el archivo CSV');
  if(!Number.isInteger(year))return alert('Indica el año');
  const btn=$('#start');btn.disabled=true;btn.textContent='Procesando…';logEl.textContent='';
  try{
    await validate();
    const rows=parse(await file.text());
    $('#detected').textContent=rows.length.toLocaleString('es-CL');
    log(`${rows.length.toLocaleString('es-CL')} RBD únicos detectados. Matrícula y cursos fueron sumados por establecimiento.`);
    let updated=0,notFound=0;const size=350;
    for(let i=0;i<rows.length;i+=size){
      const batch=rows.slice(i,i+size).map(({rbd,matricula,cursos})=>({rbd,matricula,cursos}));
      const result=await rpc('admin_import_school_enrollment_batch',{p_rows:batch,p_source_year:year,p_source_name:file.name});
      const r=Array.isArray(result)?result[0]:result;
      updated+=Number(r?.updated||0);notFound+=Number(r?.not_found||0);
      $('#processed').textContent=updated.toLocaleString('es-CL');$('#errors').textContent=notFound.toLocaleString('es-CL');
      $('#progress').style.width=`${Math.min(100,Math.round((i+batch.length)/rows.length*100))}%`;
      $('#status').textContent=`Procesando ${Math.min(i+batch.length,rows.length).toLocaleString('es-CL')} de ${rows.length.toLocaleString('es-CL')} colegios`;
      log(`Lote ${Math.floor(i/size)+1}: ${Number(r?.updated||0)} actualizados · ${Number(r?.not_found||0)} RBD no encontrados`);
    }
    $('#status').textContent=`Importación terminada: ${updated.toLocaleString('es-CL')} colegios actualizados con matrícula y cursos oficiales.`;
    log('Importación finalizada correctamente.');
  }catch(e){$('#status').textContent='Error: '+(e.message||e);log('ERROR: '+(e.message||e))}
  finally{btn.disabled=false;btn.textContent='Procesar e importar'}
};