/* Cursapp demoData.js
 * Datos demo realistas para probar KPIs/tablas y (opcionalmente) gráficos.
 *
 * Modo recomendado (A+B):
 * - Dejamos los gráficos DESACTIVADOS por defecto para no "mentir" si aún no usas data real.
 * - Pero los datos están listos para activar gráficos cuando quieras.
 *
 * Para activar gráficos:
 *   window.CURSAPP_ENABLE_CHARTS = true;
 */

window.CURSAPP_ENABLE_CHARTS = window.CURSAPP_ENABLE_CHARTS ?? false;

window.CursappDemoData = {
  meta: {
    currency: "CLP",
    courseName: "2°B - 2026",
    updatedAt: new Date().toISOString()
  },

  months: ["Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic", "Ene"],

  collection: {
    collected: [180000, 240000, 210000, 260000, 275000, 290000, 310000, 295000, 330000, 360000, 340000, 380000],
    pending:   [ 45000,  60000,  52000,  40000,  38000,  35000,  30000,  32000,  28000,  25000,  27000,  22000],
    refunds:   [     0,      0,      0,   5000,      0,      0,      0,      0,      0,   8000,      0,      0]
  },

  budget: [
    { category: "Paseo / Actividad", planned: 450000, spent: 310000 },
    { category: "Materiales",        planned: 250000, spent: 195000 },
    { category: "Eventos",           planned: 200000, spent: 120000 },
    { category: "Fondo emergencia",  planned: 150000, spent:  20000 }
  ],

  transactions: [
    { date: "2026-01-12", type: "Ingreso", concept: "Cuota Enero",   name: "Ana Soto",     amount: 15000, status: "paid" },
    { date: "2026-01-11", type: "Ingreso", concept: "Cuota Enero",   name: "Carlos Díaz",  amount: 15000, status: "paid" },
    { date: "2026-01-10", type: "Gasto",   concept: "Materiales",    name: "Librería XYZ", amount:  28000, status: "done" },
    { date: "2026-01-09", type: "Ingreso", concept: "Rifa",          name: "Paula Muñoz",  amount:  10000, status: "paid" },
    { date: "2026-01-08", type: "Gasto",   concept: "Evento curso",  name: "Centro Vec.",  amount:  45000, status: "done" }
  ],

  kpis: {
    monthCollected: 380000,
    monthPending: 22000,
    payersThisMonth: 18,
    pendingPayers: 3
  }
};
