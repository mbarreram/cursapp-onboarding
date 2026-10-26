# Pago múltiple Webpay Plus — contrato de backend (pendiente de implementación)

Esta rama implementa la selección y la vista previa, sin iniciar pagos agrupados.

## Condiciones de activación

- Nueva relación orden-a-cuotas, conservando transbank_transactions.pago_id para compatibilidad.
- Recalcular importes y comisiones exclusivamente desde pagos en el servidor.
- Validar que todas las cuotas sean pendientes, del mismo alumno y curso, y propias de la sesión.
- Reservar cuotas con control de concurrencia e idempotencia para impedir cobros duplicados.
- Confirmar todas las cuotas en una operación atómica en PostgreSQL, comprobando la aprobación remota y el monto exacto.
- webpay-status debe recuperar el mismo estado sin crear nuevas transacciones ni actualizaciones parciales.
- Anular la orden completa con reversión local atómica de todas las cuotas y trazabilidad de cada cuota.
- Conciliación, comprobantes y notificaciones deben referenciar el ID de orden y cada pago.

## Pruebas de bloqueo antes de habilitar el botón

- Dos o más cuotas, de igual o distinta campaña, para un alumno.
- Rechazar alumno/curso mixto, cuota anulada/pagada, UUID manipulado y monto alterado.
- Doble clic, callback duplicado, fallo a mitad de commit, reintento de estado y recuperación.
- Rechazo Transbank no debe cambiar ninguna cuota.
- Reversa total, con comprobantes y saldo consistente en todos los roles.
- Retrocompatibilidad estricta con pago individual y reversas existentes.

NO desplegar checkout agrupado ni ejecutar cobros mientras no estén implantados y validados los puntos anteriores.