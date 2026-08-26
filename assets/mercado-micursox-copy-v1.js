/* MiCursoX · Mercado Escolar · normalización de marca visible */
(function(){
  'use strict';

  function replaceVisibleBrand(root){
    if(!root) return;
    const walker=document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function(node){
      const parent=node.parentElement;
      if(!parent || /^(SCRIPT|STYLE)$/i.test(parent.tagName)) return;
      if(node.nodeValue && /Cursapp/i.test(node.nodeValue)){
        node.nodeValue=node.nodeValue.replace(/Cursapp/g,'MiCursoX').replace(/cursapp/g,'MiCursoX');
      }
    });
  }

  function sync(){
    const modal=document.getElementById('cursappPlatformModal');
    if(modal) replaceVisibleBrand(modal);
  }

  sync();
  new MutationObserver(sync).observe(document.documentElement,{childList:true,subtree:true});
})();
