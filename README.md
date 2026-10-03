# jugueria-app

Aplicación interna en Node.js, Express, MongoDB/Mongoose y Socket.IO para gestionar pedidos, productos, usuarios, avisos y una parte del control de asistencia. El repositorio ya existía; este documento distingue lo que funciona en el código de lo que todavía necesita desarrollo antes de operar con dinero o varias sucursales.

## Requisitos e instalación

- Node.js 20 o posterior (la revisión se hizo con Node.js 24.14.1).
- MongoDB local para desarrollo o MongoDB Atlas.
- Dependencias declaradas en `package.json` y fijadas en `package-lock.json`.

```sh
npm ci
```

Copia `.env.example` a `.env` y completa `MONGO_URI` y un `JWT_SECRET` aleatorio de al menos 32 caracteres. No compartas ni subas `.env`. Para desarrollo local se recomienda una base separada llamada `jugueria_dev`; las pruebas automatizadas actuales no se conectan a MongoDB.

```sh
npm test
npm start
```

Abre `http://localhost:3000`. El servidor no crea ni cambia cuentas o documentos al iniciar. Si la base ya contiene el usuario administrador esperado, usa esa cuenta. Para inicializar una base vacía, revisa cuidadosamente `ADMIN_BOOTSTRAP_PASSWORD` y ejecuta una sola vez `npm run bootstrap-admin`; el script crea `admin@titan02` solo si no existe y nunca cambia su contraseña. Luego elimina esa variable del entorno. No ejecutes el comando sin verificar primero a qué MongoDB apunta `MONGO_URI`.

## Organización

- `server.js`: configuración de Express, conexión de MongoDB, Socket.IO y rutas generales antiguas.
- `routes/`: API para pedidos, productos, usuarios, avisos y trabajadores.
- `models/`: documentos Mongoose existentes.
- `middlewares/auth.js`: validación JWT y permisos por rol.
- `services/`: funciones de dominio compartidas.
- `public/`: interfaz web y JavaScript del navegador.
- `scripts/bootstrap-admin.js`: creación explícita y no destructiva del primer administrador.
- `tests/`: pruebas unitarias que no requieren una base de datos.
- `docs/MODULOS.md`: estado, rutas y limitaciones conocidas de los módulos.

## Seguridad y datos

- Los endpoints de la API requieren JWT salvo inicio de sesión y archivos estáticos. Los permisos se vuelven a leer de MongoDB en cada petición.
- Socket.IO valida JWT y estado activo de la cuenta. `CORS_ORIGINS` acepta orígenes adicionales separados por comas; localhost y la URL Render predeterminada se permiten. Añade cualquier dominio personalizado del frontend.
- El inicio de sesión limita intentos por IP en memoria del proceso. No reemplaza un limitador compartido si Render escala a varias instancias. Configura `TRUST_PROXY_HOPS=1` solo detrás del proxy confiable de Render; en local deja `0`.
- El servidor no migra usuarios ni sincroniza contraseñas automáticamente al arrancar.
- La creación de pedidos toma precios y existencias del servidor, reserva stock y guarda pedido/aviso dentro de una transacción multi-documento, con `Idempotency-Key`. MongoDB debe operar como replica set (Atlas lo hace); un MongoDB standalone no admite esta operación y debe fallar sin crear pedidos parciales.
- Los cobros usan importes en céntimos, validación de efectivo y clave idempotente; los intentos concurrentes usan el saldo anterior como condición de escritura. Yape se registra como método declarado: el sistema no verifica una operación real de Yape.
- Las cuentas se desactivan para conservar referencias históricas. El reinicio que borraba pedidos y avisos está deshabilitado. La eliminación de productos y pedidos se rechaza.
- Usa HTTPS en cualquier entorno remoto. No guardes secretos en el frontend ni en GitHub.

## Base de pruebas y copias de seguridad

Configura `MONGO_URI` para que apunte a una base distinta de producción antes de probar endpoints con datos. Mantén datos de prueba aislados. Actualmente `npm test` solo ejecuta pruebas de conversión y suma de importes; no prueba rutas conectadas ni flujos completos contra MongoDB.

Para MongoDB local, usa `mongodump` hacia un directorio de respaldo protegido. Para Atlas, usa la herramienta de respaldo del clúster o `mongodump` con una URI guardada en un entorno seguro. No pegues URI con credenciales en historial de terminal o tickets. Antes de restaurar, restaura a una base alternativa y comprueba colecciones y conteos; solo después planifica una restauración de producción con una copia reciente y una ventana de mantenimiento. La configuración de retención depende del proveedor.

## Render

1. Conecta el repositorio existente en Render y configura Node.js 20 o posterior.
2. Usa `npm ci` como comando de instalación y `npm start` como comando de inicio.
3. Define `MONGO_URI`, `JWT_SECRET`, `TRUST_PROXY_HOPS=1` y, si aplica, `CORS_ORIGINS` en el panel de Render. No definas `ADMIN_BOOTSTRAP_PASSWORD` después de inicializar la cuenta.
4. Confirma que MongoDB permita conexiones desde Render y que TLS esté habilitado.
5. Despliega primero a un entorno de prueba y valida inicio de sesión, pedidos, cobros y conexión de socket con una base separada.
6. Revisa logs y estado de salud después de desplegar. Este repositorio no tiene una ruta de health-check dedicada.

No se ejecutó ni se autorizó un despliegue en esta sesión. Antes de producción faltan los módulos de sucursales, caja segura y pruebas de integración descritos en `docs/MODULOS.md`.

## Actualizaciones y recuperación

- Antes de actualizar: revisa `git status`, guarda cambios, inspecciona el diff, respalda MongoDB y despliega primero a pruebas.
- Ante caída: revisa los logs de Render, comprueba disponibilidad de MongoDB y variables del servicio. El servidor no escucha hasta conectarse a MongoDB.
- Ante una actualización defectuosa: vuelve a desplegar el último commit estable. No restaures una base de datos como primera medida para un fallo de código.
- Para recuperar datos: prueba primero la restauración en otra base y documenta qué punto de recuperación se usará antes de sustituir datos productivos.

## Git

No se hizo commit ni push. Antes de guardar, revisa el estado y los cambios preparados que ya estaban en el índice:

```sh
git status
git diff
git diff --cached
```

Selecciona explícitamente los archivos que quieres incluir, crea un commit local y verifica el resultado. Ejecuta `git push origin main` solo cuando decidas publicar el commit y hayas revisado que no incluya `.env`, datos privados ni cambios ajenos.
