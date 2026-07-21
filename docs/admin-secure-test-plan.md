# Pruebas del Admin seguro

1. Iniciar sesión con `mauricio.barrera.m@gmail.com` y abrir `/admin-console/admin`.
2. Confirmar que carga el Dashboard y que Tickets indica `Fuente oficial: Supabase`.
3. Crear un ticket desde el Admin, recargar y comprobar que permanece.
4. Abrir la cuenta en otro dispositivo y comprobar que aparece el mismo ticket.
5. Responder el ticket y validar que la conversación persiste tras recargar.
6. Crear una alerta global y un banner, desactivarlos y comprobar que el estado persiste.
7. Iniciar sesión con una cuenta no administrativa e intentar abrir directamente `/admin-console/admin`; debe mostrarse `Acceso denegado`.
8. Ejecutar `node scripts/check-admin-business-storage.mjs`; debe finalizar con estado OK.
