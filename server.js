const cors = require("cors");


require("dotenv").config();


// IMPORTS

const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const SECRET = process.env.JWT_SECRET;

// APP
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// MIDDLEWARES
app.use(express.json());
app.use(cors());


// ==========================
// DB
// ==========================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("🟢 Mongo conectado"))
  .catch(err => console.log("🔴 Error Mongo:", err));

// ==========================
// MODELOS
// ==========================
const Usuario = mongoose.model("Usuario", {
  username: String,
  password: String,
  rol: String
});

const Producto = mongoose.model("Producto", {
  nombre: String,
  precio: Number,
  stock: Number,
  categoria: String
});

const Pedido = mongoose.model("Pedido", {
  mesa: String,
  estado: { type: String, default: "en_espera" },
  creadoPor: String,
  total: Number,
  items: Array,

  pagado: { type: Boolean, default: false },
  totalPagado: { type: Number, default: 0 },
  pagos: [
    {
      monto: Number,
      metodo: String, // efectivo | yape
      recibido: Number,
      vuelto: Number,
      mesero: String,
      fecha: { type: Date, default: Date.now }
    }
  ],

  fecha: { type: Date, default: Date.now }
});

const Notificacion = mongoose.model("Notificacion", {
  mensaje: String,
  usuario: String,
  rol: String,
  leido: { type: Boolean, default: false },
  fecha: { type: Date, default: Date.now }
});

const Caja = mongoose.model("Caja", {
  fecha: { type: Date, default: Date.now },
  totalVentas: Number,
  cantidadPedidos: Number,
  cerradoPor: String
});

// ==========================
// ADMIN
// ==========================
async function crearAdmin() {
  // 1. Encriptamos la contraseña que tienes en tu archivo .env
  const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
  
  // 2. Buscamos al admin
  const admin = await Usuario.findOne({ username: "admin@titan02" });

  if (!admin) {
    // Si no existe, lo creamos
    await Usuario.create({
      username: "admin@titan02",
      password: hash,
      rol: "admin"
    });
    console.log("✅ ADMIN creado por primera vez");
  } else {
    // 🔥 SI YA EXISTE, LE ACTUALIZAMOS LA CONTRASEÑA
    admin.password = hash;
    await admin.save();
    console.log("✅ Contraseña de ADMIN sincronizada con el .env");
  }
}
crearAdmin();

// ==========================
app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// ==========================
// BACKEND
// ==========================

// LOGIN
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const u = await Usuario.findOne({ username });

  if (!u) {
    return res.json({ error: true });
  }

  const valido = await bcrypt.compare(password, u.password);

  if (!valido) {
    return res.json({ error: true });
  }

  // 🔥 TOKEN JWT
  const token = jwt.sign(
    { id: u._id, username: u.username, rol: u.rol },
    SECRET,
    { expiresIn: "8h" }
  );

  res.json({
    token,
    rol: u.rol,
    username: u.username
  });
});

app.put("/productos/:id/stock", auth, soloAdmin, async (req, res) => {
  const { cambio } = req.body;

  const p = await Producto.findById(req.params.id);

  if (!p) return res.sendStatus(404);

  p.stock = Math.max(0, p.stock + cambio);

  await p.save();

  io.emit("actualizar");
  res.json({ ok: true });
});

app.put("/pedidos/:id", auth, soloBarra, async (req, res) => {
  const { estado } = req.body;
  await Pedido.findByIdAndUpdate(req.params.id, { estado });
  io.emit("actualizar");
  res.json({ ok: true });
});

app.delete("/pedidos/:id", auth, soloAdmin, async (req, res) => {
  await Pedido.findByIdAndDelete(req.params.id);
  io.emit("actualizar");
  res.json({ ok: true });
});

app.post("/caja/cerrar", auth, soloAdmin, async (req, res) => {

  const hoy = new Date();
  hoy.setHours(0,0,0,0);

  const fin = new Date();
  fin.setHours(23,59,59,999);

  const pedidos = await Pedido.find({
    fecha: { $gte: hoy, $lte: fin },
    pagado: true
  });

  let total = 0;

  pedidos.forEach(p => total += p.total);

  const caja = await Caja.create({
    totalVentas: total,
    cantidadPedidos: pedidos.length,
    cerradoPor: req.user.username
  });

  res.json(caja);
});

app.get("/caja", auth, soloAdmin, async (req, res) => {
  const data = await Caja.find().sort({ fecha: -1 });
  res.json(data);
});

app.post("/pedidos/:id/pagar", auth, soloMesero, async (req, res) => {

  const { monto, metodo, recibido } = req.body;

  const pedido = await Pedido.findById(req.params.id);

  if (!pedido) return res.sendStatus(404);

  if (pedido.estado !== "entregado") {
    return res.json({ error: "El pedido aún no fue entregado" });
  }

  if (pedido.pagado) {
    return res.json({ error: "Pedido ya pagado" });
  }

  const restante = pedido.total - pedido.totalPagado;

  if (monto <= 0) {
    return res.json({ error: "Monto inválido" });
  }

  if (monto > restante) {
    return res.json({ error: "El pago excede el total restante" });
  }

  let vuelto = 0;

  if (metodo === "efectivo") {
    if (!recibido || recibido < monto) {
      return res.json({ error: "Monto recibido inválido" });
    }

    vuelto = recibido - monto;
  }

  pedido.pagos.push({
    monto,
    metodo,
    recibido: metodo === "efectivo" ? recibido : null,
    vuelto,
    mesero: req.user.username
  });

  pedido.totalPagado += monto;

  if (pedido.totalPagado >= pedido.total) {
    pedido.pagado = true;
  }

  await pedido.save();

  res.json(pedido);
});

// ==========================
// 🔐 MIDDLEWARE AUTH (AQUÍ VA)
// ==========================
function auth(req, res, next) {

  const token = req.headers.authorization;

  if (!token) {
    return res.sendStatus(401);
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.sendStatus(403);
  }

}

// ==========================
// 🎭 ROLES
// ==========================
function soloAdminPrincipal(req, res, next) {
  if (req.user.username !== "admin@titan02") {
    return res.status(403).json({ error: "Solo el admin principal puede hacer esto" });
  }
  next();
}

function soloAdmin(req, res, next) {
  if (req.user.rol !== "admin") {
    return res.sendStatus(403);
  }
  next();
}

function soloBarra(req, res, next) {
  if (req.user.rol !== "barra" && req.user.rol !== "admin") {
    return res.sendStatus(403);
  }
  next();
}

function soloMesero(req, res, next) {
  if (req.user.rol !== "mesero" && req.user.rol !== "admin") {
    return res.sendStatus(403);
  }
  next();
}

// ==========================
// PRODUCTOS
// ==========================
app.post("/productos", auth, soloAdmin, async (req, res) => {
  const p = await Producto.create(req.body);
  io.emit("actualizar");
  res.json(p);
});

app.get("/productos", async (req, res) => {
  res.json(await Producto.find());
});

app.delete("/productos/:id", auth, soloAdmin, async (req, res) => {
  await Producto.findByIdAndDelete(req.params.id);
  io.emit("actualizar");
  res.json({ ok: true });
});

// ==========================
// 👤 USUARIOS (ADMIN)
// ==========================

// CREAR USUARIO
app.post("/usuarios", auth, soloAdmin, async (req, res) => {

  const { username, password, rol } = req.body;

  const existe = await Usuario.findOne({ username });
  if (existe) {
    return res.json({ error: "Usuario ya existe" });
  }

  const hash = await bcrypt.hash(password, 10);

  const nuevo = await Usuario.create({
    username,
    password: hash,
    rol
  });

  res.json(nuevo);
});

app.put("/cambiar-password", auth, async (req, res) => {

  const { actual, nueva } = req.body;

  const user = await Usuario.findById(req.user.id);

  const valido = await bcrypt.compare(actual, user.password);
  if (!valido) {
    return res.json({ error: "Contraseña actual incorrecta" });
  }

  const hash = await bcrypt.hash(nueva, 10);

  user.password = hash;
  await user.save();

  res.json({ ok: true });
});

app.put("/usuarios/:id/password", auth, soloAdminPrincipal, async (req, res) => {

  const { nueva } = req.body;

  const user = await Usuario.findById(req.params.id);

  const hash = await bcrypt.hash(nueva, 10);

  user.password = hash;
  await user.save();

  res.json({ ok: true });
});

// LISTAR USUARIOS
app.get("/usuarios", auth, soloAdmin, async (req, res) => {
  const usuarios = await Usuario.find();
  res.json(usuarios);
});

// ELIMINAR USUARIO
app.delete("/usuarios/:id", auth, soloAdmin, async (req, res) => {

  const user = await Usuario.findById(req.params.id);

  // 🚫 PROTEGER ADMIN PRINCIPAL
  if (user.username === "admin@titan02") {
    return res.json({ error: "No puedes eliminar el admin principal" });
  }

  await Usuario.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

app.put("/usuarios/:id/rol", auth, soloAdminPrincipal, async (req, res) => {

  const { rol } = req.body;

  const user = await Usuario.findById(req.params.id);

  // 🚫 PROTEGER ADMIN PRINCIPAL
  if (user.username === "admin@titan02") {
    return res.json({ error: "No puedes modificar el admin principal" });
  }

  user.rol = rol;
  await user.save();

  res.json({ ok: true });
});
app.get("/notificaciones", auth, async (req, res) => {
  const data = await Notificacion.find({
    $or: [
      { rol: req.user.rol },
      { usuario: req.user.username }
    ]
  })
    .sort({ _id: -1 })
    .limit(20);

  res.json(data);
});
app.put("/notificaciones/leido", auth, async (req, res) => {
  await Notificacion.updateMany({
    $or: [
      { rol: req.user.rol },
      { usuario: req.user.username }
    ]
  }, { leido: true });

  res.json({ ok: true });
});

// 🗑️ ELIMINAR UNA NOTIFICACIÓN
app.delete("/notificaciones/:id", auth, async (req, res) => {
  await Notificacion.findByIdAndDelete(req.params.id);
  io.emit("actualizar");
  res.json({ ok: true });
});

// 🧹 LIMPIAR TODAS LAS NOTIFICACIONES
app.delete("/notificaciones", auth, async (req, res) => {
  await Notificacion.deleteMany({
    $or: [
      { rol: req.user.rol },
      { usuario: req.user.username }
    ]
  });

  io.emit("actualizar");
  res.json({ ok: true });
});

// ==========================
// PEDIDOS
// ==========================
app.get("/pedidos", async (req, res) => {
  res.json(await Pedido.find());
});

app.get("/reporte", auth, soloAdmin, async (req, res) => {

  const { desde, hasta } = req.query;

  let filtro = {};

  if (desde && hasta) {
    const fechaDesde = new Date(desde);
    const fechaHasta = new Date(hasta);

    fechaHasta.setHours(23, 59, 59, 999); // 🔥 CLAVE

    filtro.fecha = {
      $gte: fechaDesde,
      $lte: fechaHasta
    };
  }

  const pedidos = await Pedido.find(filtro);

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

app.post("/pedidos", auth, soloMesero, async (req, res) => {

  let total = 0;
  req.body.items.forEach(i => total += i.precio);


  // ==========================
  // VALIDAR Y DESCONTAR STOCK (CORRECTO)
  // ==========================

  // 1. Contar productos repetidos
  const conteo = {};

  req.body.items.forEach(i => {
    conteo[i.producto] = (conteo[i.producto] || 0) + 1;
  });

  // 2. Validar y descontar stock en UNA sola operación por producto
  for (let nombre in conteo) {
    const cantidad = conteo[nombre];

    const prod = await Producto.findOneAndUpdate(
      { nombre, stock: { $gte: cantidad } },
      { $inc: { stock: -cantidad } },
      { returnDocument: "after" }
    );

    if (!prod) {
      return res.status(400).json({ error: "Stock insuficiente de " + nombre });
    }

    // 🔔 Notificación stock bajo
    if (prod.stock <= 5) {
      await Notificacion.create({
        mensaje: "⚠️ Stock bajo: " + prod.nombre + " (" + prod.stock + ")",
        usuario: "sistema",
        rol: "admin",
        fecha: new Date()
      });
    }
  }

  // ==========================
  // 2. CREAR PEDIDO
  // ==========================
  const p = await Pedido.create({
    ...req.body,
    creadoPor: req.user.username,
    total,
    estado: "en_espera"
  });



  // ==========================
  // 4. NOTIFICACIÓN A BARRA
  // ==========================
  await Notificacion.create({
    mensaje: "Nuevo pedido en mesa " + req.body.mesa,
    usuario: req.user.username,
    rol: "barra",
    fecha: new Date()
  });

  io.emit("actualizar");
  res.json(p);
});


// 🔄 RESET SISTEMA (SOLO ADMIN)
app.delete("/reset", auth, soloAdminPrincipal, async (req, res) => {

  if (req.body.confirmacion !== "CONFIRMAR") {
    return res.json({ error: "Confirmación requerida" });
  }

  await Pedido.deleteMany({});
  await Notificacion.deleteMany({});


  io.emit("actualizar");

  res.json({ ok: true });
});

// ==========================
// SOCKET
// ==========================
io.on("connection", (socket) => {

  socket.on("actualizar_manual", () => {
    io.emit("actualizar");
  });

});
// ==========================
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("🔥 SISTEMA PRO ESTABLE en puerto " + PORT);
});