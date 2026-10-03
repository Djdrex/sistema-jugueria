# Módulos y estado real

Este inventario refleja las rutas implementadas en el código actual. No implica validación contra la base de producción ni conformidad laboral, contable o tributaria.

| Módulo | Rutas principales | Permisos | Estado y límites |
|---|---|---|---|
| Sesión y usuarios | `POST /usuarios/login`, `POST/GET /usuarios`, `PUT /usuarios/:id/rol`, `PUT /usuarios/:id/activo`, `PUT /usuarios/:id/password`, `PUT /usuarios/cambiar-password`, `POST /usuarios/mi-estado` | JWT; administración según rol; rol/contraseña de otros usuarios restringidos al admin principal | Roles solo `admin`, `mesero`, `barra`. Desactivación conserva historial. Sin sucursales, permisos configurables, restablecimiento por flujo seguro o perfiles personales completos. |
| Productos e inventario | `GET/POST /productos`, `PUT /productos/:id/stock`, `DELETE /productos/:id` | Lectura con JWT; mutación solo admin | Precio y stock se validan; ajuste de stock es condicional. No hay ledger de inventario, compras, proveedores, vencimientos ni descontinuación implementada; DELETE responde 405. |
| Pedidos y cobros | `GET/POST /pedidos`, `PUT /pedidos/:id`, `DELETE /pedidos/:id`, `POST /pedidos/:id/pagar` | JWT; crear mesero/admin; estado barra/admin; cobro mesero/admin | Precio autoritativo del catálogo, reserva de stock y claves idempotentes. La cancelación no está implementada. Yape no tiene verificación externa. No se han probado rutas concurrentes contra MongoDB. |
| Avisos | `GET /notificaciones`, `PUT /notificaciones/leido`, `DELETE /notificaciones/:id`, `DELETE /notificaciones` | JWT; filtra por usuario o rol | Avisos simples con lectura y borrado. Sin catálogo de tipos, sucursal, persistencia de entrega socket, retención configurable ni deduplicación. |
| Trabajadores y asistencia parcial | `GET /trabajadores`, `PUT /trabajadores/:id/configuracion`, `POST /trabajadores/:id/asistencia`, `GET /trabajadores/faltas/resumen`, `POST /usuarios/mi-estado` | administración para gestión; trabajador autenticado para estado propio | Horarios básicos, estados de disponibilidad y registro administrativo por fecha. No hay reloj de entrada/descanso/salida completo, aprobación de incidencias ni sucursales. |
| Caja y reportes heredados | `GET /caja`, `POST /caja/cerrar`, `GET /reporte`, `GET /actividad` | Solo admin, salvo actividad que comprueba rol en la ruta | El cierre diario está protegido contra duplicados y usa el día de Lima, pero agrega solo pedidos pagados y no tiene apertura, arqueo, efectivo esperado/contado ni sucursal. No usar como caja confiable. |
| Administrador inicial | `npm run bootstrap-admin` | Operador con acceso a `MONGO_URI` y contraseña configurada en entorno | Solo crea `admin@titan02` si no existe. No se ejecutó en esta sesión. |

## Trabajo pendiente antes de operación real

- Sucursales, asignación y aislamiento de pedidos, personal, stock, pagos, caja, reportes y avisos.
- Flujo completo de asistencia y remuneraciones. `PagoTrabajador`, `Gasto` y `Documento` existen como modelos, pero no hay APIs operativas integradas.
- Caja auditable e idempotente; conciliación de pagos; gestión segura de anulaciones y devoluciones.
- Ledger de inventario y transacciones de MongoDB o un mecanismo de consistencia probado para stock y creación de pedidos.
- Validación de todos los esquemas heredados, índices de unicidad después de revisar datos existentes, límites de solicitudes compartidos entre instancias y política de sesión.
- Protección XSS completa del frontend, auditoría centralizada de todos los cambios sensibles y permisos por sucursal.
- Pruebas de integración en una base MongoDB separada, pruebas de Socket.IO/reconexión y pruebas de interfaz en móvil/tablet.
- Decisiones de negocio: identificadores y zonas horarias de sucursal, catálogo de roles, reglas de descuentos/devoluciones, modalidades de pago laboral y responsable de aprobar ajustes.

## Dependencias principales

Express 5 recibe HTTP; Mongoose modela y persiste MongoDB; `jsonwebtoken` y `bcrypt` gestionan autenticación; Socket.IO transmite avisos genéricos de actualización; `cors` controla orígenes. El frontend son scripts clásicos en `public/js`, que comparten estado global inicializado en `app.js`.
