# Fase 0B · Matriz Supabase del rol Presidente

## Alcance conectado

| Pantalla o función | Lecturas | Escrituras | Regla de acceso |
|---|---|---|---|
| Inicio | `colegios`, `cursos`, `miembros_curso`, `usuarios`, `campanas`, `pagos` | — | Datos del curso donde el usuario es Presidente |
| Campañas | `cursos`, `miembros_curso`, `campanas`, `pagos` | `campanas`, `pagos` | Presidente administra campañas y genera cuotas de su curso |
| Deudores | `miembros_curso`, `usuarios`, `campanas`, `pagos` | — | Presidente y Tesorero leen únicamente el curso compartido |
| Informes | `cursos`, `miembros_curso`, `campanas`, `pagos` | — | Cálculos limitados al curso activo |
| Apoderados | `colegios`, `cursos`, `miembros_curso`, `usuarios` | `miembros_curso` | Presidente administra membresías de su curso |
| Avisos y notificaciones | `avisos`, `avisos_curso`, `notificaciones` | Las mismas tablas | Presidente publica al curso; cada usuario lee sus notificaciones |
| Perfil | `usuarios`, `preferencias_notificaciones` | Las mismas tablas | Cada usuario modifica solo su perfil y preferencias |
| Soporte / Mis tickets | `tickets` | `tickets` | Cada usuario administra solo sus tickets |

## Brechas funcionales detectadas

Estas brechas no se resuelven en esta migración de seguridad y deben tratarse
como cambios funcionales separados:

- `assets/configavisos.js` todavía conserva avisos operativos en `localStorage`.
- `assets/support-ticket.js` todavía conserva tickets en `localStorage`.
- `assets/perfil.js` todavía conserva datos editables y preferencias en `localStorage`.
- `assets/global-alerts.js` usa `localStorage` y no tiene una tabla productiva definida.
- `cursapp_consentimientos` y `push_suscripciones` son referenciadas por el
  frontend, pero no existen en el esquema `public` actual.
- Parte de los informes y gastos del Presidente sigue calculándose desde datos
  locales; su migración corresponde a las fases de reglas financieras y
  eliminación de `localStorage` operativo.

## Criterios de validación después de fusionar

1. Inicio carga sin errores de permisos.
2. Campañas permite listar, crear, editar y eliminar dentro del curso activo.
3. La creación de campaña genera cuotas sin duplicarlas.
4. Deudores e Informes cargan pagos y miembros del curso.
5. Apoderados mantiene las acciones ya validadas.
6. Avisos crea registros del curso y notificaciones para sus miembros.
7. Perfil y tickets quedan autorizados en base de datos, aunque su migración
   desde `localStorage` se implementará en un PR funcional posterior.
8. Un Presidente no puede leer ni modificar datos de otro curso.
