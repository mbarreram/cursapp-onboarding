# Compatibilidad local temporal

`admin-console/assets/admin.js` conserva rutas heredadas basadas en `localStorage`. El bootstrap seguro reemplaza las funciones visibles de tickets, alertas y banners por módulos Supabase.

No deben agregarse nuevas escrituras de negocio a las rutas heredadas. Su eliminación física se realizará de forma progresiva para no reescribir componentes estables en un solo cambio.
