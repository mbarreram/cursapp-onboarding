const demo = {
    compactMode: false,
    notifications: [
      {type:'Cuota', msg:'Se publicó “Cuota Febrero”.', date:'Hoy'},
      {type:'Retiro', msg:'Solicitud #R-1024 requiere tu autorización.', date:'Ayer'},
      {type:'Pago', msg:'Pago confirmado: Actividad paseo.', date:'12 Ene'}
    ],
    payments: [
      {id:'p1', concept:'Cuota Enero', due:'20 Ene', amount:15000, status:'pending'},
      {id:'p2', concept:'Cuota Febrero', due:'20 Feb', amount:10000, status:'pending'},
      {id:'p3', concept:'Actividad paseo', due:'—', amount:15000, status:'paid', paidDate:'14 Ene', receipt:'RC-8891'}
    ],
    history: [
      {date:'14 Ene', concept:'Actividad paseo', amount:15000, status:'Confirmado'},
      {date:'05 Ene', concept:'Cuota Diciembre', amount:15000, status:'Confirmado'},
      {date:'12 Dic', concept:'Cuota Noviembre', amount:15000, status:'Confirmado'}
    ],
    withdrawals: [
      {id:'R-1024', amount:80000, reason:'Compra materiales actividad', requester:'Tesorero (Demo)', approvals:3, required:5, state:'pending_me', attachment:'cotizacion_materiales.pdf (demo)', audit:null},
      {id:'R-1018', amount:45000, reason:'Transporte paseo', requester:'Tesorero (Demo)', approvals:5, required:5, state:'approved', attachment:'boleta_transporte.jpg (demo)', audit:{by:'Mauricio (Demo)', at:'12 Dic 10:41'}}
    ],
    charts: {
      payments6m: [
        {label:'Ago', value:0},
        {label:'Sep', value:15000},
        {label:'Oct', value:15000},
        {label:'Nov', value:15000},
        {label:'Dic', value:15000},
        {label:'Ene', value:30000},
      ],
      withdrawals6m: [
        {label:'Ago', approved:0, rejected:0},
        {label:'Sep', approved:1, rejected:0},
        {label:'Oct', approved:0, rejected:0},
        {label:'Nov', approved:1, rejected:1},
        {label:'Dic', approved:2, rejected:0},
        {label:'Ene', approved:1, rejected:0},
      ]
    }
  };

window.cursappDemo = demo;
