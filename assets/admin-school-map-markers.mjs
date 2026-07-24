// Marcadores visuales para colegios en Territorios y cobertura.
// Se aplica de forma incremental sobre Leaflet sin modificar la lógica territorial existente.
(function installSchoolMarkers(){
  let attempts=0;
  const timer=setInterval(()=>{
    attempts+=1;
    const L=window.L;
    if(!L||typeof L.circleMarker!=='function'){
      if(attempts>80)clearInterval(timer);
      return;
    }
    if(L.__cursappSchoolMarkersInstalled){clearInterval(timer);return;}

    const originalCircleMarker=L.circleMarker.bind(L);
    L.circleMarker=function(latlng,options={}){
      // Los colegios se dibujan con radius 7 en admin-territories.mjs.
      // Los centros de comuna conservan sus círculos originales.
      if(Number(options.radius)===7){
        const statusColor=options.fillColor||options.color||'#64748b';
        const icon=L.divIcon({
          className:'cursapp-school-map-icon-host',
          html:`<div aria-label="Colegio" style="
            width:34px;height:34px;border-radius:12px;
            display:flex;align-items:center;justify-content:center;
            background:#fff;border:3px solid ${statusColor};
            box-shadow:0 5px 14px rgba(15,23,42,.24);
            font-size:19px;line-height:1;box-sizing:border-box;
          ">🏫</div>`,
          iconSize:[34,34],
          iconAnchor:[17,30],
          popupAnchor:[0,-29]
        });
        return L.marker(latlng,{icon,keyboard:true,riseOnHover:true});
      }
      return originalCircleMarker(latlng,options);
    };
    L.__cursappSchoolMarkersInstalled=true;
    clearInterval(timer);
  },100);
})();
