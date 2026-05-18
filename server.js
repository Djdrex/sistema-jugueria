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
const productosRoutes = require("./routes/productos");
const pedidosRoutes = require("./routes/pedidos");
const usuariosRoutes = require("./routes/usuarios");
const notificacionesRoutes = require("./routes/notificaciones");

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
const io = new Server(server);

// MIDDLEWARES
app.use(express.json());
app.use(cors());
app.use("/productos", productosRoutes(io));
app.use("/pedidos", pedidosRoutes(io));
app.use("/", usuariosRoutes());
app.use("/notificaciones", notificacionesRoutes(io));

// DB
mongoose.connect(process.env.MONGO_URI, {
  family: 4
})
  .then(() => console.log("🟢 Mongo conectado"))
  .catch(err => console.log("🔴 Error Mongo:", err));

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

// ADMIN
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


const path = require("path");

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// BACKEND

// LOGIN




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

app.post("/pedidos/:id/pagar", auth, (req, res, next) => {
  if (req.user.rol !== "mesero" && req.user.rol !== "admin" && req.user.rol !== "barra") {
    return res.sendStatus(403);
  }
  next();
}, async (req, res) => {

  const { monto, metodo, recibido, indices } = req.body;

  const pedido = await Pedido.findById(req.params.id);

  if (!pedido) return res.sendStatus(404);

  if (pedido.estado !== "entregado") {
    return res.json({ error: "El pedido aún no fue entregado" });
  }

  if (pedido.pagado) {
    return res.json({ error: "Pedido ya pagado" });
  }

  const pagado = pedido.totalPagado || 0;
  const restante = pedido.total - pagado;

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
  
  if(Array.isArray(indices)){

  indices.forEach(i => {

    if(pedido.items[i]){
      pedido.items[i].pagado = true;
    }

  });

  }

  if (pedido.totalPagado >= pedido.total) {
    pedido.pagado = true;
  }

  await pedido.save();
  
  await registrarActividad(
  req.user.username,
  "PEDIDO",
  `Creó pedido para mesa ${pedido.mesa}`
);

  await registrarActividad(
  req.user.username,
  "COBRO",
  `Cobró S/${monto} en mesa ${pedido.mesa} por ${metodo}`
);

  res.json(pedido);
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

// SOCKET
io.on("connection", (socket) => {

  socket.on("actualizar_manual", () => {
    io.emit("actualizar");
  });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("🔥 SISTEMA PRO ESTABLE en puerto " + PORT);
});
