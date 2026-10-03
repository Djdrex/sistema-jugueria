# Módulos y estado real

Este inventario refleja las rutas implementadas en el código actual. No implica validación contra la base de producción ni conformidad laboral, contable o tributaria.

## Actualización de interfaz y módulos

- La navegación del frontend se organiza en General, Operaciones, Administración y Configuración, con opciones filtradas por rol y principal; el menú es colapsable y la preferencia claro/oscuro persiste en el navegador.
- El dashboard consulta un endpoint dedicado y muestra importes cobrados, pedidos, gastos registrados y alertas de stock con datos existentes.
- El catálogo admite campos opcionales de costo, unidad y stock mínimo; las categorías tienen colección propia, se pueden crear/editar/desactivar, y los cambios de stock guardan movimientos y actividad.
- Pedidos listan estados/filtros, conservan cancelados en consulta explícita y rechazan transiciones desde cancelado. No se habilitó anulación porque falta definir reversión coordinada de stock/caja.
- Notificaciones admiten filtros y lectura individual. Los trabajadores pueden consultar únicamente sus pagos internos registrados; el sistema aún no calcula remuneración devengada ni saldo laboral.
- Se añadieron directorio de sedes, configuración de identidad básica y exportación CSV. Estos cambios no migran registros existentes ni significan que los módulos operativos ya estén aislados por sede.
- El reinicio tiene vista previa con reautenticación, pero su ejecución continúa bloqueada mientras no exista un destino verificable de respaldo.
- Los recursos estáticos se sirven con revalidación de caché para reflejar actualizaciones al abrir la aplicación.

| Módulo | Rutas principales | Permisos | Estado y límites |
|---|---|---|---|
| Sesión y usuarios | `POST /usuarios/login`, `POST/GET /usuarios`, `PUT /usuarios/:id/rol`, `PUT /usuarios/:id/activo`, `PUT /usuarios/:id/password`, `PUT /usuarios/cambiar-password`, `POST /usuarios/mi-estado` | JWT; administración según rol; rol/contraseña de otros usuarios restringidos al admin principal | Roles solo `admin`, `mesero`, `barra`. Desactivación conserva historial. Sin sucursales, permisos configurables, restablecimiento por flujo seguro o perfiles personales completos. |
| Productos e inventario | `GET/POST /productos`, `PUT /productos/:id/stock`, `DELETE /productos/:id` | Lectura con JWT; mutación solo admin | Precio y stock se validan; ajuste de stock es condicional. No hay ledger de inventario, compras, proveedores, vencimientos ni descontinuación implementada; DELETE responde 405. |
| Pedidos y cobros | `GET/POST /pedidos`, `PUT /pedidos/:id`, `DELETE /pedidos/:id`, `POST /pedidos/:id/pagar` | JWT; crear mesero/admin; estado barra/admin; cobro mesero/admin | Precio autoritativo del catálogo, reserva de stock y claves idempotentes. La cancelación no está implementada. Yape no tiene verificación externa. No se han probado rutas concurrentes contra MongoDB. |
| Avisos | `GET /notificaciones`, `PUT /notificaciones/leido`, `DELETE /notificaciones/:id`, `DELETE /notificaciones` | JWT; filtra por usuario o rol | Avisos simples con lectura y borrado. Sin catálogo de tipos, sucursal, persistencia de entrega socket, retención configurable ni deduplicación. |
| Gastos y compras | `GET/POST /gastos` | Solo admin | Registro/listado con filtro por fecha y tipo, validación de importe, auditoría e idempotencia. Sin aprobación, adjuntos, sucursal, proveedor normalizado ni asociación automática a caja. Requiere transacciones MongoDB. |
| Registro interno de pagos al personal | `GET/POST /pagos-personal` | Solo admin | Historial de pagos manuales con trabajador, importe, método, fecha, responsable e idempotencia. No calcula sueldo devengado, deuda, adelanto ni próximo vencimiento; no sustituye planilla. Requiere transacciones MongoDB. |
| Trabajadores y asistencia parcial | `GET /trabajadores`, `PUT /trabajadores/:id/configuracion`, `POST /trabajadores/:id/asistencia`, `GET /trabajadores/faltas/resumen`, `POST /usuarios/mi-estado` | administración para gestión; trabajador autenticado para estado propio | Horarios básicos, estados de disponibilidad y registro administrativo por fecha. No hay reloj de entrada/descanso/salida completo, aprobación de incidencias ni sucursales. |
| Caja y reportes heredados | `GET /caja`, `POST /caja/cerrar`, `GET /reporte`, `GET /actividad` | Solo admin, salvo actividad que comprueba rol en la ruta | El cierre diario está protegido contra duplicados y usa el día de Lima, pero agrega solo pedidos pagados y no tiene apertura, arqueo, efectivo esperado/contado ni sucursal. No usar como caja confiable. |
| Administrador inicial | `npm run bootstrap-admin` | Operador con acceso a `MONGO_URI` y contraseña configurada en entorno | Solo crea `admin@titan02` si no existe. No se ejecutó en esta sesión. |

## Trabajo pendiente antes de operación real

- Sucursales, asignación y aislamiento de pedidos, personal, stock, pagos, caja, reportes y avisos.
- Flujo completo de asistencia y remuneraciones. El registro de pagos al personal no calcula sueldo devengado, deuda, adelanto ni próximo pago. `Documento` no tiene API operativa.
- Gastos solo tiene captura/listado básico; falta aprobación, vinculación a comprobantes, cierre de caja y sucursal.
- Caja auditable e idempotente; conciliación de pagos; gestión segura de anulaciones y devoluciones.
- Ledger de inventario y transacciones de MongoDB o un mecanismo de consistencia probado para stock y creación de pedidos.
- Validación de todos los esquemas heredados, índices de unicidad después de revisar datos existentes, límites de solicitudes compartidos entre instancias y política de sesión.
- Protección XSS completa del frontend, auditoría centralizada de todos los cambios sensibles y permisos por sucursal.
- Pruebas de integración en una base MongoDB separada, pruebas de Socket.IO/reconexión y pruebas de interfaz en móvil/tablet.
- Decisiones de negocio: identificadores y zonas horarias de sucursal, catálogo de roles, reglas de descuentos/devoluciones, modalidades de pago laboral y responsable de aprobar ajustes.

## Dependencias principales

Express 5 recibe HTTP; Mongoose modela y persiste MongoDB; `jsonwebtoken` y `bcrypt` gestionan autenticación; Socket.IO transmite avisos genéricos de actualización; `cors` controla orígenes. El frontend son scripts clásicos en `public/js`, que comparten estado global inicializado en `app.js`.
