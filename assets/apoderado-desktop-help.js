(function(){
  'use strict';

  var timers = [];

  function isDesktop(){
    return window.matchMedia && window.matchMedia('(min-width: 1024px)').matches;
  }

  function getTarget(){
    var app = document.getElementById('app');
    if(!app) return null;
    var module = document.body && document.body.getAttribute('data-apo-module');
    if(module === 'payments') return app.querySelector('.apoPayPage');
    if(module === 'informes') return app.querySelector('.apoReportPage');
    return app.querySelector('.apoPayPage,.apoReportPage');
  }

  function modalContent(type){
    if(type === 'help'){
      return {title:'Centro de ayuda',text:'Encuentra orientación sobre cuotas, comprobantes, informes y uso de MiCursoX sin salir de esta pantalla. Si necesitas asistencia adicional, puedes enviar un mensaje al equipo de soporte.'};
    }
    if(type === 'messages'){
      return {title:'Mensajes y comunicaciones',text:'Aquí puedes revisar las comunicaciones del curso, avisos de la directiva y novedades relevantes. Tus mensajes se mantienen asociados a tu curso y perfil.'};
    }
    return {title:'Pago seguro',text:'Los pagos se procesan mediante los medios habilitados por MiCursoX. La plataforma no almacena los datos completos de tu tarjeta y mantiene la información de la transacción protegida.'};
  }

  function closeModal(){
    var modal = document.querySelector('.apoDesktopModal');
    if(modal) modal.remove();
  }

  function openModal(type){
    closeModal();
    var data = modalContent(type);
    var modal = document.createElement('div');
    modal.className = 'apoDesktopModal';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.innerHTML = '<div class="apoDesktopModalCard"><h3>'+data.title+'</h3><p>'+data.text+'</p><button type="button" class="apoDesktopModalClose">Entendido</button></div>';
    modal.addEventListener('click',function(event){
      if(event.target === modal || event.target.closest('.apoDesktopModalClose')) closeModal();
    });
    document.body.appendChild(modal);
  }

  function buildHelp(){
    var wrap = document.createElement('section');
    wrap.className = 'apoDesktopHelp';
    wrap.setAttribute('aria-label','Ayuda y soporte');
    wrap.innerHTML = '<div class="apoDesktopHelpIntro"><span class="apoDesktopHelpIcon">?</span><span><strong>¿Necesitas ayuda?</strong><small>Estamos aquí para apoyarte.</small></span></div><button type="button" data-apo-help="help"><span class="apoDesktopHelpIcon">▣</span><span><strong>Centro de ayuda</strong><small>Resuelve tus dudas con nuestras guías.</small></span></button><button type="button" data-apo-help="messages"><span class="apoDesktopHelpIcon">✉</span><span><strong>Mensajes</strong><small>Revisa tus comunicaciones y avisos.</small></span></button><button type="button" data-apo-help="secure"><span class="apoDesktopHelpIcon">♢</span><span><strong>Pago seguro</strong><small>Conoce cómo protegemos tus datos.</small></span></button>';
    wrap.addEventListener('click',function(event){
      var button = event.target.closest('[data-apo-help]');
      if(button) openModal(button.getAttribute('data-apo-help'));
    });
    return wrap;
  }

  function enhanceDescriptions(target){
    var module = document.body.getAttribute('data-apo-module');
    if(module === 'payments'){
      var p = target.querySelector('.apoPayHeader p');
      if(p && !p.dataset.premiumText){
        p.textContent = 'Revisa tus cuotas, paga de forma segura y descarga tus comprobantes en un solo lugar. Mantén tus compromisos al día con información clara y siempre disponible.';
        p.dataset.premiumText = 'true';
      }
    } else if(module === 'informes'){
      var reportP = target.querySelector('.apoReportHero p');
      if(reportP && !reportP.dataset.premiumText){
        reportP.textContent = 'Consulta la evolución financiera del curso, la distribución de gastos y las últimas rendiciones con información clara, actualizada y transparente.';
        reportP.dataset.premiumText = 'true';
      }
    }
  }

  function mount(){
    if(!isDesktop()) return false;
    var target = getTarget();
    if(!target || !target.isConnected) return false;
    enhanceDescriptions(target);
    var existing = target.querySelector(':scope > .apoDesktopHelp');
    if(!existing) target.appendChild(buildHelp());
    return true;
  }

  function scheduleMounts(){
    timers.forEach(window.clearTimeout);
    timers = [60,180,420,850,1400,2300,3600,5200].map(function(delay){
      return window.setTimeout(mount,delay);
    });
  }

  function start(){
    scheduleMounts();
    document.addEventListener('click',function(event){
      if(event.target.closest('[data-tab], .navItem, [data-desktop-nav], #menuDropdown, .apoV42MenuItem')) scheduleMounts();
    },true);
    window.addEventListener('resize',scheduleMounts,{passive:true});
    window.addEventListener('hashchange',scheduleMounts);
    window.addEventListener('popstate',scheduleMounts);
    window.addEventListener('keydown',function(event){ if(event.key === 'Escape') closeModal(); });
    window.addEventListener('cursapp:apoderado-ready',scheduleMounts);
    window.addEventListener('cursapp:dataChanged',scheduleMounts);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();