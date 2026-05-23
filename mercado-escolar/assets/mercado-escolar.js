const products=[
 {img:"poleron.svg",title:"Polerón colegio Talla 14",cat:"Uniformes",dist:"A 0,8 km",price:"$7.000",tag:"DESTACADA"},
 {img:"libros.svg",title:"Pack libros 6° básico 2024",cat:"Libros",dist:"A 1,2 km",price:"$15.000",tag:""},
 {img:"mochila.svg",title:"Mochila colegial excelente estado",cat:"Uniformes",dist:"A 0,5 km",price:"$10.000",tag:""},
 {img:"balon.svg",title:"Balón de fútbol N°5",cat:"Deportes",dist:"A 0,7 km",price:"$6.000",tag:"DESTACADA"},
 {img:"vestido.svg",title:"Vestido colegio Talla 10",cat:"Vestuario",dist:"A 1,1 km",price:"$8.000",tag:""}
];

function card(p){
  return `<article class="productCard" onclick="openDetail('${p.title}')">
    ${p.tag?`<span class="tag">${p.tag}</span>`:""}
    <img src="assets/img/${p.img}" alt="${p.title}">
    <div class="productBody">
      <b>${p.title}</b><strong>${p.price}</strong><span>⌖ ${p.dist}</span>
      <div class="productMeta"><small>${p.cat}</small><small>♡</small></div>
    </div>
  </article>`;
}

function renderProducts(list=products){
  const featured=document.getElementById("featuredList");
  const grid=document.getElementById("marketGrid");
  if(featured) featured.innerHTML=list.map(card).join("");
  if(grid) grid.innerHTML=list.map(card).join("");
}

function showView(v){
  document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(`[id="view-${v}"]`).forEach(x=>x.classList.add("active"));
  document.querySelectorAll(".pillNav button,.bottomBar button").forEach(x=>x.classList.toggle("active", x.dataset.view===v));
  if(v==="creditos" && window.CursappMarketCredits) setTimeout(()=>window.CursappMarketCredits.render(),50);
}

function filterCat(cat){
  showView("explorar");
  const filtered=products.filter(p=>p.cat===cat);
  const grid=document.getElementById("marketGrid");
  if(grid) grid.innerHTML=(filtered.length?filtered:products).map(card).join("");
}

function openDetail(title){
  const p=products.find(x=>x.title===title)||products[0];
  document.getElementById("modal").innerHTML=`<div class="modal">
    <img src="assets/img/${p.img}" alt="${p.title}">
    <h2>${p.title}</h2>
    <p><b>${p.price}</b> · ${p.cat}</p>
    <p>${p.dist} · Apoderado verificado. Cursapp no procesa pagos ni garantiza la transacción.</p>
    <button onclick="toast('Solicitud de contacto enviada')">Contactar / reservar</button>
    <button onclick="toast('Publicación reportada')">🚩 Reportar</button>
    <button onclick="document.getElementById('modal').innerHTML=''">Cerrar</button>
  </div>`;
}

function toast(t){
  const el=document.getElementById("toast");
  el.textContent=t; el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"),1800);
}

document.addEventListener("click", e=>{
  const viewBtn=e.target.closest("[data-view]");
  if(viewBtn){ e.preventDefault(); showView(viewBtn.dataset.view); return; }
  const link=e.target.closest("[data-view-link]");
  if(link){ e.preventDefault(); showView(link.dataset.viewLink); return; }
  const cat=e.target.closest("[data-cat]");
  if(cat){ e.preventDefault(); filterCat(cat.dataset.cat); return; }
});

renderProducts();