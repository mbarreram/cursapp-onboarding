(function(){
'use strict';
if(window.__MX_RUT_BANK_VALIDATION__) return;
window.__MX_RUT_BANK_VALIDATION__=true;

function normalizeRut(value){
  return String(value||'').toUpperCase().replace(/[^0-9K]/g,'');
}

function isValidRut(value){
  const rut=normalizeRut(value);
  if(rut.length<2) return false;
  const body=rut.slice(0,-1);
  const dv=rut.slice(-1);
  if(!/^\d+$/.test(body)) return false;
  let sum=0,multiplier=2;
  for(let i=body.length-1;i>=0;i--){
    sum+=Number(body[i])*multiplier;
    multiplier=multiplier===7?2:multiplier+1;
  }
  const remainder=11-(sum%11);
  const expected=remainder===11?'0':remainder===10?'K':String(remainder);
  return dv===expected;
}

function formatRut(value){
  const rut=normalizeRut(value);
  if(rut.length<2) return rut;
  const body=rut.slice(0,-1);
  const dv=rut.slice(-1);
  return body+'-'+dv;
}

function setRutState(input, valid, message){
  const card=input.closest('.mxBankModalCard');
  let hint=card?.querySelector('[data-rut-client-error]');
  if(!hint&&card){
    hint=document.createElement('div');
    hint.setAttribute('data-rut-client-error','');
    hint.style.marginTop='7px';
    hint.style.fontWeight='800';
    hint.style.fontSize='13px';
    input.insertAdjacentElement('afterend',hint);
  }
  if(valid===true){
    input.style.borderColor='#22c55e';
    input.style.boxShadow='0 0 0 3px rgba(34,197,94,.10)';
    if(hint){hint.textContent='RUT válido';hint.style.color='#15803d';}
  }else if(valid===false){
    input.style.borderColor='#ef4444';
    input.style.boxShadow='0 0 0 3px rgba(239,68,68,.10)';
    if(hint){hint.textContent=message||'El RUT ingresado no es válido.';hint.style.color='#b42318';}
  }else{
    input.style.borderColor='';
    input.style.boxShadow='';
    if(hint)hint.textContent='';
  }
}

function validateInput(input, showEmptyError=false){
  const raw=String(input.value||'').trim();
  if(!raw){setRutState(input,showEmptyError?false:null,showEmptyError?'Ingresa el RUT del titular.':'');return false;}
  const valid=isValidRut(raw);
  setRutState(input,valid,valid?'':'El RUT del titular no es válido. Revisa el número y dígito verificador.');
  return valid;
}

document.addEventListener('input',function(e){
  const input=e.target?.closest?.('#mxBankRut');
  if(!input) return;
  const cleaned=String(input.value||'').toUpperCase().replace(/[^0-9Kk.\-]/g,'');
  if(input.value!==cleaned) input.value=cleaned;
  if(normalizeRut(input.value).length>=2) validateInput(input,false); else setRutState(input,null,'');
},true);

document.addEventListener('blur',function(e){
  const input=e.target?.closest?.('#mxBankRut');
  if(!input) return;
  if(normalizeRut(input.value).length>=2) input.value=formatRut(input.value);
  validateInput(input,true);
},true);

document.addEventListener('click',function(e){
  const button=e.target?.closest?.('.mxBankModal [data-submit]');
  if(!button) return;
  const modal=button.closest('.mxBankModalCard');
  const input=modal?.querySelector('#mxBankRut');
  if(!input) return;
  if(!validateInput(input,true)){
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    input.focus();
  }
},true);

window.MX_RUT_VALIDATION={isValidRut,normalizeRut,formatRut};
})();