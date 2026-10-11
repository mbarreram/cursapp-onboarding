# MiCursoX · Conexión de auditoría separada (pendiente de activación)

## Estado
- Proyecto operacional: `ngxistgymgdkoaiulfbq` (`cursapp-prod`).
- Proyecto auditoría: `qyzogekuiqfaawixbxpm` (`micursox-auditoria`).
- Migración `supabase/audit-project/001_audit_storage.sql` ejecutada en la base de auditoría.
- La escritura de eventos del navegador sigue en la base principal por seguridad. **No conmutar sin prueba.**

## Contrato de ingesta
1. El navegador entrega hasta 25 eventos con UUID estable, categoría permitida (`button_click`, `form_submit`, `navigation`, `download`, `share`) e identificador opaco de control.
2. Una Edge Function **en cursapp-prod** comprueba el JWT del usuario con Supabase Auth; nunca confía en `actor_user_id` ni en el rol declarados por el cliente.
3. La función verifica pertenencia a curso antes de adjuntar `curso_id`. No recopilar texto, contenidos de formularios, URLs completas, tokens ni IP sin una política específica.
4. La función envía el lote al RPC `audit_ingest_server_batch` del proyecto de auditoría utilizando una clave de servicio guardada **solo** en secretos del servidor. No publicar la clave ni incluirla en GitHub.
5. Duplicados por `event_id` se manejan idempotentemente. Aplicar backoff/reintentos y una cola persistente con DLQ antes de la puesta en producción.
6. Admin consulta mediante backend autenticado y autorización administrativa en `cursapp-prod`, que actúa de proxy hacia el RPC `audit_search_server`. Nunca exponer una clave de auditoría al navegador.
7. Una vez comprobados el ingreso, la búsqueda, recuperación de fallos, métricas y la exportación histórica, retirar escrituras de clics de la base principal **sin alterar la contabilidad ni triggers financieros**.

## Configuración necesaria
- `MX_AUDIT_URL=https://qyzogekuiqfaawixbxpm.supabase.co` en secretos de las funciones del proyecto principal.
- `MX_AUDIT_SERVICE_ROLE_KEY`: secreto privado del segundo proyecto, configurado en el proyecto principal, nunca en el frontend ni en el repositorio.
- Auditoría de permisos, cuotas, volumen y política de retención por separado.

## Pruebas de aceptación
1. Usuario de prueba autenticado genera una navegación y se observa un evento único en `micursox-auditoria`.
2. La búsqueda de Admin por UUID de usuario arroja el mismo evento y conserva la paginación.
3. Usuario anónimo no puede insertar ni consultar.
4. Suplantar `actor_user_id` desde el navegador no cambia la identidad registrada.
5. Caída del segundo proyecto no altera pagos, login o navegación. Cola persiste eventos hasta su entrega.
6. Validar throughput, tamaño, latencias y uso de almacenamiento simulados antes de afirmar capacidad para 40.000 usuarios.

**Nota:** Este archivo no activa la migración; requiere credenciales de servidor y pruebas reales.
