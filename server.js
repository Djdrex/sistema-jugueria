const cors = require("cors");


require("dotenv").config();


// IMPORTS

const jwt = require("jsonwebtoken");
const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const productosRoutes = require("./routes/productos");
const pedidosRoutes = require("./routes/pedidos");
const usuariosRoutes = require("./routes/usuarios");
const notificacionesRoutes = require("./routes/notificaciones");
const trabajadoresRoutes = require("./routes/trabajadores");
const gastosRoutes = require("./routes/gastos");
const pagosPersonalRoutes = require("./routes/pagosPersonal");
const historialRoutes = require("./routes/historial");

const {
  auth,
  soloAdmin,
  soloAdminPrincipal,
  soloBarra,
  soloMesero
} = require("./middlewares/auth");

// APP
const app = express();
const server = http.createServer(app);
const trustedProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (!Number.isInteger(trustedProxyHops) || trustedProxyHops < 0 || trustedProxyHops > 5) throw new Error("TRUST_PROXY_HOPS debe ser un entero entre 0 y 5");
app.set("trust proxy", trustedProxyHops);
const PORT = process.env.PORT || 3000;
const configuredOrigins = (process.env.CORS_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean);
const corsOrigins = [...new Set([...configuredOrigins, process.env.RENDER_EXTERNAL_URL, `http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`].filter(Boolean))];
const allowOrigin = (origin, callback) => {
  if (!origin || corsOrigins.includes(origin)) return callback(null, true);
  return callback(new Error("Origen CORS no permitido"));
};
const io = new Server(server, { cors: { origin: allowOrigin } });

io.use(async (socket, next) => {
  try {
    if (!process.env.JWT_SECRET) return next(new Error("Autenticación no configurada"));
    const decoded = jwt.verify(socket.handshake.auth?.token || "", process.env.JWT_SECRET);
    const user = await Usuario.findById(decoded.id).select("username rol activo");
    if (!user || user.activo === false) return next(new Error("No autorizado"));
    socket.data.user = { id: String(user._id), username: user.username, rol: user.rol };
    return next();
  } catch {
    return next(new Error("No autorizado"));
  }
});

// MIDDLEWARES
app.use("/historial-financiero", express.json({ limit: "12mb" }));
app.use(express.json({ limit: "64kb" }));
app.use(cors({ origin: allowOrigin }));
app.use("/productos", productosRoutes(io));
app.use("/pedidos", pedidosRoutes(io));
app.use("/usuarios", usuariosRoutes());
app.use("/notificaciones", notificacionesRoutes(io));
app.use("/trabajadores", trabajadoresRoutes);
app.use("/gastos", gastosRoutes);
app.use("/pagos-personal", pagosPersonalRoutes());
app.use("/historial-financiero", historialRoutes());
app.use(express.static(path.join(__dirname, "public"), { etag: true, lastModified: true, maxAge: 0 }));

// DB

// MODELOS
const Actividad = require("./models/Actividad");

const Usuario = require("./models/Usuario");
const Producto = require("./models/Producto");
const Pedido = require("./models/Pedido");
const Caja = require("./models/Caja");
const Notificacion = require("./models/Notificacion");
const Gasto = require("./models/Gasto");
const Categoria = require("./models/Categoria");
const MovimientoInventario = require("./models/MovimientoInventario");
const Documento = require("./models/Documento");
const PagoTrabajador = require("./models/PagoTrabajador");
const Asistencia = require("./models/Asistencia");
const { buildReinicioWorkbook, safe: safeExcelValue } = require("./services/reinicioReport");
const bcrypt = require("bcrypt");
const resetPackages = new Map();
let resetMaintenanceUntil = 0;
const RESET_PACKAGE_TTL = 15 * 60 * 1000;

app.use((req, res, next) => {
  if (resetMaintenanceUntil > Date.now() && !req.path.startsWith("/reinicio/") && req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") return res.status(423).json({ error: "El sistema está en cierre mensual o anual. Reintenta al terminar el reinicio." });
  if (resetMaintenanceUntil && resetMaintenanceUntil <= Date.now()) { resetMaintenanceUntil = 0; resetPackages.clear(); }
  next();
});

async function registrarActividad(usuario, accion, detalle){

  try{

    await Actividad.create({
      usuario,
      accion,
      detalle
    });

  }catch(err){

    console.log("Error registrando actividad:", err);

  }

}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// BACKEND

// LOGIN




app.post("/caja/cerrar", auth, soloAdmin, async (req, res) => {
  const fechaOperativa = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
  if (await Caja.exists({ fechaOperativa })) return res.status(409).json({ error: "La caja de hoy ya fue cerrada" });
  const inicio = new Date(`${fechaOperativa}T00:00:00-05:00`);
  const fin = new Date(new Date(inicio).getTime() + 24 * 60 * 60 * 1000);
  const pedidos = await Pedido.find({ fecha: { $gte: inicio, $lt: fin }, pagado: true });
  const total = pedidos.reduce((sum, pedido) => sum + Math.round((Number(pedido.total) || 0) * 100), 0) / 100;
  try {
    const caja = await Caja.create({ fechaOperativa, totalVentas: total, cantidadPedidos: pedidos.length, cerradoPor: req.user.username });
    return res.status(201).json(caja);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "La caja de hoy ya fue cerrada" });
    throw err;
  }
});

app.get("/caja", auth, soloAdmin, async (req, res) => {
  const data = await Caja.find().sort({ fecha: -1 });
  res.json(data);
});

// 🔐 MIDDLEWARE AUTH


// 🎭 ROLES


// PRODUCTOS





app.get("/actividad", auth, async (req,res)=>{

  if(req.user.rol !== "admin"){
    return res.sendStatus(403);
  }

  const actividad = await Actividad
    .find()
    .sort({ fecha:-1 })
    .limit(100);

  res.json(actividad);

});

// 👤 USUARIOS (ADMIN)

// CREAR USUARIO


// LISTAR USUARIOS

// ELIMINAR USUARIO


// 🗑️ ELIMINAR UNA NOTIFICACIÓN

// 🧹 LIMPIAR TODAS LAS NOTIFICACIONES

// PEDIDOS


app.get("/reporte", auth, soloAdmin, async (req, res) => {

  const { desde, hasta } = req.query;

  let filtro = {};

  if (Boolean(desde) !== Boolean(hasta)) return res.status(400).json({ error: "Indica ambas fechas del período" });
  if (desde && hasta) {
    const validaFecha = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
    if (!validaFecha(desde) || !validaFecha(hasta) || desde > hasta) return res.status(400).json({ error: "Rango de fechas inválido" });
    const fechaDesde = new Date(`${desde}T00:00:00-05:00`);
    const fechaHasta = new Date(`${hasta}T00:00:00-05:00`);
    fechaHasta.setTime(fechaHasta.getTime() + 24 * 60 * 60 * 1000);

    filtro.fecha = {
      $gte: fechaDesde,
      $lt: fechaHasta
    };
  }

  const pedidos = await Pedido.find(filtro).sort({ fecha: -1 }).limit(5000);

  let total = 0;

  pedidos.forEach(p => { total += Number(p.totalPagado) || (p.pagado ? Number(p.total) || 0 : 0); });

  res.json({
  total,
  cantidad: pedidos.length,
  pedidos
});
});

app.get("/dashboard", auth, soloAdmin, async (req, res) => {
  const ahora = new Date();
  const limaAhora = new Date(ahora.toLocaleString("en-US", { timeZone: "America/Lima" }));
  const hoy = new Date(Date.UTC(limaAhora.getFullYear(), limaAhora.getMonth(), limaAhora.getDate(), 5));
  const inicioSemana = new Date(hoy);
  inicioSemana.setUTCDate(inicioSemana.getUTCDate() - ((inicioSemana.getUTCDay() + 6) % 7));
  const inicioMes = new Date(Date.UTC(limaAhora.getFullYear(), limaAhora.getMonth(), 1, 5));
  const inicioDiaSiguiente = new Date(hoy.getTime() + 86400000);
  const consultas = await Promise.allSettled([
    Pedido.find({ fecha: { $gte: hoy, $lt: inicioDiaSiguiente }, estado: { $ne: "cancelado" } }).select("total totalPagado pagado estado items fecha"),
    Pedido.find({ fecha: { $gte: inicioSemana, $lt: inicioDiaSiguiente }, estado: { $ne: "cancelado" } }).select("total totalPagado pagado estado"),
    Pedido.find({ fecha: { $gte: inicioMes, $lt: inicioDiaSiguiente }, estado: { $ne: "cancelado" } }).select("total totalPagado pagado estado"),
    Pedido.aggregate([{ $match: { fecha: { $gte: hoy, $lt: inicioDiaSiguiente } } }, { $group: { _id: "$estado", cantidad: { $sum: 1 } } }]),
    Gasto.aggregate([{ $match: { fecha: { $gte: inicioMes, $lt: inicioDiaSiguiente } } }, { $group: { _id: null, total: { $sum: "$monto" } } }]),
    Producto.find().select("nombre stock stockMinimo tipo activo").sort({ stock: 1 }).limit(1000)
  ]);
  const nombresConsultas = ["pedidos de hoy", "pedidos de la semana", "pedidos del mes", "estados", "gastos del mes", "inventario"];
  const advertencias = consultas.flatMap((resultado, indice) => resultado.status === "rejected" ? [`No se pudieron cargar ${nombresConsultas[indice]}`] : []);
  const [pedidosDia = [], pedidosSemana = [], pedidosMes = [], estados = [], gastosMes = [], stock = []] = consultas.map(resultado => resultado.status === "fulfilled" ? resultado.value : []);
  consultas.forEach((resultado, indice) => { if (resultado.status === "rejected") console.error(`Dashboard: error consultando ${nombresConsultas[indice]}:`, resultado.reason?.message); });
  const agregados = pedidos => ({
    ventas: Math.round(pedidos.reduce((sum, pedido) => sum + (Number(pedido.totalPagado) || (pedido.pagado ? Number(pedido.total) || 0 : 0)), 0) * 100) / 100,
    pedidos: pedidos.length,
    pendientesPago: pedidos.filter(p => !p.pagado).length
  });
  const productos = {};
  for (const pedido of pedidosDia.filter(p => p.estado === "entregado")) for (const item of pedido.items || []) productos[item.producto] = (productos[item.producto] || 0) + 1;
  return res.json({
    dia: agregados(pedidosDia), semana: agregados(pedidosSemana), mes: agregados(pedidosMes), advertencias,
    estados: Object.fromEntries(estados.map(item => [item._id || "sin_estado", item.cantidad])),
    gastosMes: Math.round((gastosMes[0]?.total || 0) * 100) / 100,
    bajoStock: stock.filter(p => p.activo !== false && Number.isFinite(p.stock) && p.stock <= (p.stockMinimo ?? 5) && p.stock > 0).map(p => ({ nombre: p.nombre, stock: p.stock, minimo:p.stockMinimo ?? 5, tipo:p.tipo })),
    agotados: stock.filter(p => p.activo !== false && p.stock === 0).map(p => ({ nombre: p.nombre, stock: p.stock, minimo:p.stockMinimo ?? 5, tipo:p.tipo })),
    topProductos: Object.entries(productos).sort((a, b) => b[1] - a[1]).slice(0, 5)
  });
});

app.get("/configuracion", auth, soloAdminPrincipal, async (_req, res) => {
  const config = await mongoose.connection.collection("configuracion").findOne({ _id: "negocio" });
  return res.json(config || { nombreComercial: "Juguería", moneda: "PEN", zonaHoraria: "America/Lima", direccion: "", contacto: "", horario: "", logoUrl: "" });
});

app.put("/configuracion", auth, soloAdminPrincipal, async (req, res) => {
  const allowed = ["nombreComercial", "nombreLegal", "direccion", "contacto", "horario", "logoUrl"];
  if (Object.keys(req.body).some(key => !allowed.includes(key))) return res.status(400).json({ error: "Campo de configuración no permitido" });
  const clean = {};
  for (const key of allowed) if (req.body[key] !== undefined) {
    if (typeof req.body[key] !== "string" || req.body[key].length > (key === "logoUrl" ? 1000 : 200)) return res.status(400).json({ error: `Valor inválido para ${key}` });
    clean[key] = req.body[key].trim();
  }
  const result = await mongoose.connection.collection("configuracion").findOneAndUpdate({ _id: "negocio" }, { $set: { ...clean, actualizadoPor: req.user.username, actualizadoEn: new Date() }, $setOnInsert: { moneda: "PEN", zonaHoraria: "America/Lima" } }, { upsert: true, returnDocument: "after" });
  await Actividad.create({ usuario: req.user.username, accion: "CONFIGURACION_NEGOCIO", detalle: `Actualizó configuración: ${Object.keys(clean).join(", ")}` });
  return res.json(result);
});

app.get("/sedes", auth, soloAdminPrincipal, async (_req, res) => {
  return res.json(await mongoose.connection.collection("sedes").find().sort({ nombre: 1 }).toArray());
});

app.post("/sedes", auth, soloAdminPrincipal, async (req, res) => {
  const nombre = typeof req.body.nombre === "string" ? req.body.nombre.trim() : "";
  if (!nombre || nombre.length > 120 || typeof req.body.direccion === "string" && req.body.direccion.length > 200) return res.status(400).json({ error: "Nombre o dirección de sede inválidos" });
  const row = { nombre, direccion: typeof req.body.direccion === "string" ? req.body.direccion.trim() : "", activa: true, creadaPor: req.user.username, creadaEn: new Date() };
  try { const result = await mongoose.connection.collection("sedes").insertOne(row); await Actividad.create({ usuario:req.user.username, accion:"SEDE_CREADA", detalle:`Creó sede ${nombre}` }); return res.status(201).json({ ...row, _id: result.insertedId }); }
  catch (error) { if (error.code === 11000) return res.status(409).json({ error:"La sede ya existe" }); throw error; }
});

app.put("/sedes/:id", auth, soloAdminPrincipal, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error:"Identificador de sede inválido" });
  const fields = {};
  if (req.body.nombre !== undefined) { if (typeof req.body.nombre !== "string" || !req.body.nombre.trim() || req.body.nombre.length > 120) return res.status(400).json({ error:"Nombre inválido" }); fields.nombre = req.body.nombre.trim(); }
  if (req.body.direccion !== undefined) { if (typeof req.body.direccion !== "string" || req.body.direccion.length > 200) return res.status(400).json({ error:"Dirección inválida" }); fields.direccion = req.body.direccion.trim(); }
  if (req.body.activa !== undefined) { if (typeof req.body.activa !== "boolean") return res.status(400).json({ error:"Estado inválido" }); fields.activa = req.body.activa; }
  const result = await mongoose.connection.collection("sedes").findOneAndUpdate({ _id:new mongoose.Types.ObjectId(req.params.id) }, { $set:{ ...fields, actualizadoPor:req.user.username, actualizadoEn:new Date() } }, { returnDocument:"after" });
  if (!result) return res.sendStatus(404);
  await Actividad.create({ usuario:req.user.username, accion:"SEDE_ACTUALIZADA", detalle:`Actualizó sede ${result.nombre}` });
  return res.json(result);
});

function resetPeriod(body = {}) {
  const type = body.periodo;
  let desde, hasta;
  if (type === "mensual" && /^\d{4}-\d{2}$/.test(body.mes || "")) {
    const [year, month] = body.mes.split("-").map(Number);
    if (year < 2000 || year > 2200 || month < 1 || month > 12) return null;
    desde = `${body.mes}-01`;
    hasta = `${body.mes}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;
  } else if (type === "anual" && /^\d{4}$/.test(body.anio || "")) {
    const year = Number(body.anio); if (year < 2000 || year > 2200) return null;
    desde = `${body.anio}-01-01`; hasta = `${body.anio}-12-31`;
  } else return null;
  return { desde, hasta, etiqueta: type === "mensual" ? body.mes : body.anio, tipo: type, inicio: new Date(`${desde}T00:00:00-05:00`), fin: new Date(new Date(`${hasta}T00:00:00-05:00`).getTime() + 86400000) };
}

async function resetSnapshot(period) {
  const dateQuery = { $gte: period.inicio, $lt: period.fin };
  const [pedidos, gastos, pagos, movimientos, asistencias, caja, notificaciones, documentos, cuentas, productos, categorias] = await Promise.all([
    Pedido.find({ fecha: dateQuery }).lean(), Gasto.find({ fecha: dateQuery }).lean(), PagoTrabajador.find({ fecha: dateQuery }).lean(), MovimientoInventario.find({ fecha: dateQuery }).lean(),
    Asistencia.find({ fecha: { $gte: period.desde, $lte: period.hasta } }).lean(), Caja.find({ fecha: dateQuery }).lean(), Notificacion.find({ fecha: dateQuery }).lean(),
    Documento.find({ fecha: dateQuery }).select("+archivo.datos").lean(), mongoose.connection.collection("cuentasServicio").find().sort({ nombre: 1 }).toArray(), Producto.find().lean(), Categoria.find().lean()
  ]);
  const adjuntos = [];
  for (const documento of documentos) if (documento.archivo?.datos?.length) adjuntos.push({ documentoId: String(documento._id), nombre: documento.archivo.nombre || "archivo", mime: documento.archivo.tipoMime || "application/octet-stream", tamano: documento.archivo.tamano || documento.archivo.datos.length, datos: documento.archivo.datos });
  for (const row of [...gastos, ...pagos, ...movimientos, ...asistencias, ...caja, ...notificaciones, ...documentos, ...cuentas, ...productos, ...categorias]) for (const key of Object.keys(row)) row[key] = safeExcelValue(row[key]);
  for (const pedido of pedidos) for (const key of Object.keys(pedido)) pedido[key] = safeExcelValue(pedido[key]);
  return { pedidos, gastos, pagos, movimientos, asistencias, caja, notificaciones, documentos, cuentas, productos, categorias, adjuntos };
}

app.post("/reinicio/preview", auth, soloAdminPrincipal, async (req, res) => {
  const actual = await Usuario.findById(req.user.id).select("password username");
  if (!actual || typeof req.body.password !== "string" || !(await bcrypt.compare(req.body.password, actual.password))) return res.status(401).json({ error:"Contraseña actual incorrecta" });
  const period = resetPeriod(req.body);
  if (!period) return res.status(400).json({ error:"Selecciona un mes o año válido para el informe." });
  const [pedidos, gastos, pagos, movimientos, asistencias, caja, notificaciones, documentos, cuentas, productos, categorias] = await Promise.all([
    Pedido.countDocuments({ fecha: { $gte: period.inicio, $lt: period.fin } }), Gasto.countDocuments({ fecha: { $gte: period.inicio, $lt: period.fin } }), PagoTrabajador.countDocuments({ fecha: { $gte: period.inicio, $lt: period.fin } }),
    MovimientoInventario.countDocuments({ fecha: { $gte: period.inicio, $lt: period.fin } }), Asistencia.countDocuments({ fecha: { $gte: period.desde, $lte: period.hasta } }), Caja.countDocuments({ fecha: { $gte: period.inicio, $lt: period.fin } }),
    Notificacion.countDocuments({ fecha: { $gte: period.inicio, $lt: period.fin } }), Documento.countDocuments({ fecha: { $gte: period.inicio, $lt: period.fin } }), mongoose.connection.collection("cuentasServicio").countDocuments(), Producto.countDocuments(), Categoria.countDocuments()
  ]);
  return res.json({ modo:"prueba", modificaciones:0, archivoCreado:false, periodo:{ tipo:period.tipo, desde:period.desde, hasta:period.hasta }, colecciones:["Pedidos", "Gastos", "Pagos de personal", "Movimientos de inventario", "Asistencias", "Cierres de caja", "Notificaciones", "Documentos financieros", "Cuentas de servicio", "Productos e insumos", "Categorías"].map((nombre, index) => ({ nombre, registros:[pedidos,gastos,pagos,movimientos,asistencias,caja,notificaciones,documentos,cuentas,productos,categorias][index] })), mensaje:"Modo prueba: consulta de solo lectura; no se guardó un archivo ni se modificaron datos." });
});

app.post("/reinicio/preparar", auth, soloAdminPrincipal, async (req, res) => {
  const actual = await Usuario.findById(req.user.id).select("password username");
  if (!actual || typeof req.body.password !== "string" || !(await bcrypt.compare(req.body.password, actual.password))) return res.status(401).json({ error:"Contraseña actual incorrecta" });
  if (req.body.modo !== "real") return res.status(400).json({ error:"Selecciona modo de uso real para preparar un reinicio." });
  const period = resetPeriod(req.body);
  if (!period) return res.status(400).json({ error:"Selecciona un mes o año válido para el informe." });
  if (resetMaintenanceUntil > Date.now()) return res.status(409).json({ error:"Ya hay un cierre en preparación." });
  resetPackages.clear();
  resetMaintenanceUntil = Date.now() + RESET_PACKAGE_TTL;
  try {
    const snapshot = await resetSnapshot(period);
    const workbook = await buildReinicioWorkbook(snapshot, period);
    const id = require("crypto").randomBytes(24).toString("hex");
    resetPackages.set(id, { creadoPor:String(req.user.id), workbook, desde:period.inicio, fin:period.fin, tipo:period.tipo, etiqueta:period.etiqueta, conteos:{ pedidos:snapshot.pedidos.length, notificaciones:snapshot.notificaciones.length, documentos:snapshot.documentos.length }, expires:Date.now() + RESET_PACKAGE_TTL, usado:false });
    for (const [key, value] of resetPackages) if (value.expires <= Date.now()) resetPackages.delete(key);
    res.set({ "Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition":`attachment; filename="informe-${period.tipo}-${period.etiqueta}.xlsx"`, "Cache-Control":"no-store", "X-Reset-Token":id });
    return res.send(Buffer.from(workbook));
  } catch (error) {
    resetMaintenanceUntil = 0;
    throw error;
  }
});

app.post("/reinicio/cancelar", auth, soloAdminPrincipal, (req, res) => {
  const pack = resetPackages.get(req.body.id);
  if (pack && pack.creadoPor === String(req.user.id)) resetPackages.delete(req.body.id);
  if (!pack || pack.creadoPor === String(req.user.id)) resetMaintenanceUntil = 0;
  return res.json({ ok:true });
});

app.post("/reinicio/confirmar", auth, soloAdminPrincipal, async (req, res) => {
  const pack = resetPackages.get(req.body.id);
  if (!pack || pack.creadoPor !== String(req.user.id) || pack.expires < Date.now() || pack.usado) return res.status(410).json({ error:"El informe expiró o ya se utilizó. Prepara una nueva descarga." });
  if (req.body.confirmacion !== "REINICIAR" || req.body.descargado !== true) return res.status(400).json({ error:"Confirma la descarga del Excel y escribe REINICIAR." });
  if (resetMaintenanceUntil <= Date.now()) return res.status(410).json({ error:"El periodo de confirmación expiró. Prepara una nueva descarga." });
  pack.usado = true;
  const session = await mongoose.startSession();
  try {
    const ordersInScope = await Pedido.countDocuments({ fecha: { $gte: pack.desde, $lt: pack.fin } }).session(session);
    const notificationsInScope = await Notificacion.countDocuments({ fecha: { $gte: pack.desde, $lt: pack.fin } }).session(session);
    const archive = await Documento.countDocuments({ fecha: { $gte: pack.desde, $lt: pack.fin } }).session(session);
    if (ordersInScope !== pack.conteos.pedidos || notificationsInScope !== pack.conteos.notificaciones || archive !== pack.conteos.documentos) throw Object.assign(new Error("Los datos del periodo cambiaron desde que se generó el informe. Descarga un nuevo Excel."), { code:"RESET_SNAPSHOT_CHANGED" });
    await session.withTransaction(async () => {
      await Pedido.deleteMany({ fecha: { $gte: pack.desde, $lt: pack.fin } }, { session });
      await Notificacion.deleteMany({ fecha: { $gte: pack.desde, $lt: pack.fin } }, { session });
    });
    resetPackages.delete(req.body.id); resetMaintenanceUntil = 0;
    return res.json({ ok:true, mensaje:`Cierre ${pack.tipo} ${pack.etiqueta} completado. El Excel ya fue descargado; los demás datos siguen en el sistema.` });
  } catch (error) {
    pack.usado = false; resetMaintenanceUntil = 0;
    if (error.code === "RESET_SNAPSHOT_CHANGED") return res.status(409).json({ error:error.message });
    if (error.code === 20 || /replica set|transaction numbers are only allowed/i.test(error.message || "")) return res.status(503).json({ error:"MongoDB no admite transacciones en esta instancia; no se eliminó ningún pedido ni notificación. Usa un MongoDB con transacciones y vuelve a intentar." });
    throw error;
  } finally { await session.endSession(); }
});



// 🔄 RESET SISTEMA (SOLO ADMIN)
app.delete("/reset", auth, soloAdminPrincipal, (_req, res) => res.status(410).json({ error: "El reinicio que elimina datos está deshabilitado" }));

// SOCKET
io.on("connection", (socket) => {
  socket.join(`role:${socket.data.user.rol}`);
  socket.join(`user:${socket.data.user.id}`);
});

app.use((req, res) => res.status(404).json({ error: "Ruta no encontrada" }));
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status <= 599 ? err.status : 500;
  if (status >= 500) console.error("Error de solicitud:", err.message);
  return res.status(status).json({ error: status >= 500 ? "Error interno del servidor" : err.message });
});

if (!process.env.MONGO_URI || !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("Configura MONGO_URI y JWT_SECRET (mínimo 32 caracteres)");
}
mongoose.connect(process.env.MONGO_URI, { family: 4 })
  .then(() => server.listen(PORT, () => console.log(`Servidor listo en puerto ${PORT}`)))
  .catch(err => {
    console.error("No se pudo conectar con MongoDB:", err.message);
    process.exitCode = 1;
  });
