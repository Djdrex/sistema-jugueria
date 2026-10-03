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
app.use(express.json({ limit: "64kb" }));
app.use(cors({ origin: allowOrigin }));
app.use("/productos", productosRoutes(io));
app.use("/pedidos", pedidosRoutes(io));
app.use("/usuarios", usuariosRoutes());
app.use("/notificaciones", notificacionesRoutes(io));
app.use("/trabajadores", trabajadoresRoutes);
app.use("/gastos", gastosRoutes);
app.use("/pagos-personal", pagosPersonalRoutes());
app.use(express.static(path.join(__dirname, "public")));

// DB

// MODELOS
const Actividad = require("./models/Actividad");

const Usuario = require("./models/Usuario");
const Producto = require("./models/Producto");
const Pedido = require("./models/Pedido");
const Caja = require("./models/Caja");
const Notificacion = require("./models/Notificacion");

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

  pedidos.forEach(p => {
    if (p.pagado) {
      total += p.total;
    }
  });

  res.json({
  total,
  cantidad: pedidos.length,
  pedidos
});

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
