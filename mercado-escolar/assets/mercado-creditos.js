(function(){
  "use strict";

  const K_CFG="cursapp_market_config_v1";
  const K_WALLETS="cursapp_market_credit_wallets_v1";
  const K_ORDERS="cursapp_market_credit_orders_v1";
  const K_MOVES="cursapp_market_credit_movements_v1";
  const K_POSTS="cursapp_market_posts_v1";
  const K_EVENTS="cursapp_market_events_v1";

  const $=(s,r=document)=>r.querySelector(s);
  const load=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}};
  const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const clp=n=>"$"+Number(n||0).toLocaleString("es-CL");
  const now=()=>new Date().toISOString();

  function userId(){
    const a=load("cursapp_demo_user",{})||{};
    const b=load("cursapp_session_v1",{})||{};
    return String(a.email||a.userId||b.email||b.userId||"").toLowerCase();
  }

  function config(){
    let c=load(K_CFG,null);
    if(!c){
      c={
        packages:[
          {id:"starter",name:"Starter",credits:10,price:990,status:"activo",recommended:false},
          {id:"medio",name:"Medio",credits:25,price:1990,status:"activo",recommended:true},
          {id:"pro",name:"Pro",credits:60,price:3990,status:"activo",recommended:false}
        ],
        boosts:[
          {id:"colegio",name:"Destacado colegio",credits:2,durationDays:7,status:"activo",scope:"Mi colegio"},
          {id:"cercanos",name:"Colegios cercanos",credits:5,durationDays:7,status:"activo",scope:"Colegios cercanos"},
          {id:"comuna",name:"Portada comuna",credits:12,durationDays:7,status:"activo",scope:"Mi comuna"}
        ],
        rules:{autoHideReports:3,blockReports:5,creditsExpireDays:365}
      };
      save(K_CFG,c);
    }
    c.packages=Array.isArray(c.packages)?c.packages:[];
    c.boosts=Array.isArray(c.boosts)?c.boosts:[];
    return c;
  }

  function wallets(){return load(K_WALLETS,{})}
  function balance(user=userId()){return Number(wallets()[user]||0)}
  function orders(){return load(K_ORDERS,[])}
  function moves(){return load(K_MOVES,[])}
  function posts(){return load(K_POSTS,[])}

  function setWallet(user, amount){
    const w=wallets();
    w[user]=Number(amount||0);
    save(K_WALLETS,w);
  }

  function addMovement(type, credits, detail, extra={}){
    const list=moves();
    list.unshift({
      id:"mvm_"+Date.now().toString(16),
      userId:userId(),
      type,
      credits:Number(credits||0),
      detail:detail||"",
      at:now(),
      ...extra
    });
    save(K_MOVES,list.slice(0,500));
  }

  function addEvent(type, postId, extra={}){
    const list=load(K_EVENTS,[]);
    list.unshift({id:"ev_"+Date.now().toString(16),type,postId,userId:userId(),at:now(),...extra});
    save(K_EVENTS,list.slice(0,500));
  }

  function credit(amount, detail, orderId){
    setWallet(userId(), balance()+Number(amount||0));
    addMovement("credit", Number(amount||0), detail||"Compra créditos", {orderId:orderId||""});
  }

  function debit(amount, detail, extra={}){
    const n=Number(amount||0);
    if(balance()<n){
      notify("No tienes créditos suficientes");
      return false;
    }
    setWallet(userId(), balance()-n);
    addMovement("debit", -n, detail||"Canje destacado", extra);
    return true;
  }

  function notify(msg){
    const t=$("#toast");
    if(t){
      t.textContent=msg;
      t.classList.add("show");
      setTimeout(()=>t.classList.remove("show"),1800);
    }else{
      alert(msg);
    }
  }

  function renderBalance(){
    const el=$("#creditBalanceBadge");
    if(el) el.textContent=balance()+" créditos";
  }

  function renderPackages(){
    const box=$("#creditPackages");
    if(!box) return;
    const packs=config().packages.filter(p=>p.status!=="inactivo");
    box.innerHTML=packs.map(p=>`
      <article class="creditPackage ${p.recommended?"recommended":""}">
        <h3>${p.name}${p.recommended?" · Recomendado":""}</h3>
        <p>${Number(p.credits||0)} créditos Mercado</p>
        <strong>${clp(p.price)}</strong>
        <button type="button" data-buy-credit="${p.id}">Comprar con pasarela prueba</button>
      </article>
    `).join("") || `<p class="muted">No hay paquetes activos.</p>`;
  }

  function renderBoostPostSelect(){
    const sel=$("#boostPostSelect");
    if(!sel) return;
    const mine=posts().filter(p=>String(p.owner||"").toLowerCase()===userId() && p.status!=="bloqueado" && p.status!=="eliminado");
    sel.innerHTML = mine.length
      ? mine.map(p=>`<option value="${p.id}">${p.title}</option>`).join("")
      : `<option value="">Publica un aviso primero</option>`;
  }

  function renderBoosts(){
    const box=$("#boostOptions");
    if(!box) return;
    const rules=config().boosts.filter(b=>b.status!=="inactivo");
    box.innerHTML=rules.map(b=>`
      <article class="boostOption">
        <b>${b.name}</b>
        <span>${Number(b.credits||0)} créditos · ${Number(b.durationDays||7)} días</span>
        <small>${b.scope||"Vitrina"}</small>
        <button type="button" data-boost-credit="${b.id}">Canjear</button>
      </article>
    `).join("") || `<p class="muted">No hay reglas de canje activas.</p>`;
  }

  function renderHistory(){
    const box=$("#creditHistory");
    if(!box) return;
    const list=moves().filter(m=>String(m.userId||"").toLowerCase()===userId()).slice(0,20);
    box.innerHTML=list.map(m=>`
      <div class="historyItem">
        <b>${Number(m.credits)>0?"+":""}${Number(m.credits||0)} créditos</b>
        <span>${m.detail||""} · ${m.at?new Date(m.at).toLocaleString("es-CL"):""}</span>
      </div>
    `).join("") || `<p class="muted">Sin movimientos todavía.</p>`;
  }

  function render(){
    renderBalance();
    renderPackages();
    renderBoostPostSelect();
    renderBoosts();
    renderHistory();
  }

  function buy(packageId){
    const pkg=config().packages.find(p=>p.id===packageId);
    if(!pkg) return notify("Paquete no disponible");

    const order={
      id:"mko_"+Date.now().toString(16),
      userId:userId(),
      packageId:pkg.id,
      packageName:pkg.name,
      credits:Number(pkg.credits||0),
      amount:Number(pkg.price||0),
      status:"iniciado",
      gateway:"transbank_demo",
      createdAt:now()
    };

    const list=orders();
    list.unshift(order);
    save(K_ORDERS,list);

    const ok=confirm("Pasarela de prueba\n\nComprar "+pkg.credits+" créditos por "+clp(pkg.price)+"?");
    order.status=ok?"pagado":"cancelado";
    order.paidAt=ok?now():"";

    const updated=orders();
    const idx=updated.findIndex(o=>o.id===order.id);
    if(idx>=0) updated[idx]=order;
    save(K_ORDERS,updated);

    if(ok){
      credit(pkg.credits,"Compra paquete "+pkg.name,order.id);
      notify("Pago aprobado. Créditos agregados.");
      render();
    }else{
      notify("Compra cancelada");
    }
  }

  function boost(boostId){
    const rule=config().boosts.find(b=>b.id===boostId);
    if(!rule) return notify("Regla no disponible");

    const sel=$("#boostPostSelect");
    const postId=sel ? sel.value : "";
    if(!postId) return notify("Selecciona una publicación");

    const postList=posts();
    const idx=postList.findIndex(p=>p.id===postId);
    if(idx<0) return notify("Publicación no encontrada");

    if(!debit(Number(rule.credits||0),"Canje "+rule.name,{postId,boostId:rule.id})) return;

    postList[idx].boost=rule.id;
    postList[idx].boostUntil=new Date(Date.now()+Number(rule.durationDays||7)*86400000).toISOString();
    postList[idx].updatedAt=now();
    save(K_POSTS,postList);
    addEvent("boost",postId,{boostId:rule.id,credits:rule.credits});

    notify("Destacado aplicado");
    render();

    if(window.CursappMarket && typeof window.CursappMarket.renderProducts==="function"){
      window.CursappMarket.renderProducts();
    }
  }

  function bind(){
    document.addEventListener("click",e=>{
      const buyBtn=e.target.closest("[data-buy-credit]");
      if(buyBtn){
        e.preventDefault();
        buy(buyBtn.dataset.buyCredit);
        return;
      }

      const boostBtn=e.target.closest("[data-boost-credit]");
      if(boostBtn){
        e.preventDefault();
        boost(boostBtn.dataset.boostCredit);
      }
    });
  }

  window.CursappMarketCredits={render,buy,boost,balance,config,credit,debit};

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",()=>{bind(); setTimeout(render,100);});
  }else{
    bind();
    setTimeout(render,100);
  }

  setTimeout(render,700);
})();