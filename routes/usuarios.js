const express = require("express");

const router = express.Router();

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const Usuario = require("../models/Usuario");

const {
  auth,
  soloAdmin,
  soloAdminPrincipal
} = require("../middlewares/auth");

const SECRET = process.env.JWT_SECRET;
const Asistencia = require("../models/Asistencia");
const fechaLocal = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());

module.exports = () => {

  // LOGIN
  router.post("/login", async (req, res) => {

    const { username, password } = req.body;

    if (typeof username !== "string" || typeof password !== "string" || !username.trim() || !password) {
      return res.status(400).json({ error: "Usuario y contraseña son obligatorios" });
    }

    const u = await Usuario.findOne({ username });

    if (!u) {
      return res.json({ error: true });
    }

    const valido = await bcrypt.compare(
      password,
      u.password
    );

    if (!valido) {
      return res.json({ error: true });
    }

    if (["mesero", "barra"].includes(u.rol)) {
      const ahora = new Date();
      u.estadoLaboral = "activo";
      u.ultimaConexion = ahora;
      await u.save();
      await Asistencia.findOneAndUpdate(
        { trabajador: u._id, fecha: fechaLocal() },
        { $setOnInsert: { trabajador: u._id, fecha: fechaLocal(), entrada: ahora, estado: "asistio", registradoPor: u.username }, $set: { estadoActual: "activo" }, $push: { eventos: { estado: "activo", fecha: ahora } } },
        { upsert: true }
      );
    }

    const token = jwt.sign(
      {
        id: u._id,
        username: u.username,
        rol: u.rol
      },
      SECRET,
      {
        expiresIn: "8h"
      }
    );

    res.json({
      token,
      rol: u.rol,
      username: u.username
    });

  });

  // CREAR USUARIO
  router.post("/", auth, soloAdmin, async (req, res) => {

    const { username, password, rol } = req.body;

    if (!username || typeof password !== "string" || password.length < 8 || !["admin", "barra", "mesero"].includes(rol)) {
      return res.status(400).json({ error: "Datos de usuario inválidos" });
    }

    const existe = await Usuario.findOne({
      username
    });

    if (existe) {

      return res.json({
        error: "Usuario ya existe"
      });

    }

    const hash = await bcrypt.hash(password, 10);

    const nuevo = await Usuario.create({

      username,

      password: hash,

      rol

    });

    res.json(nuevo);

  });

  // LISTAR
  router.get("/", auth, soloAdmin, async (req, res) => {

    const usuarios = await Usuario.find().select("username rol activo estadoLaboral ultimaConexion ultimaDesconexion horario");

    res.json(usuarios);

  });

  // ELIMINAR
  router.delete("/:id", auth, soloAdmin, async (req, res) => {

    const user = await Usuario.findById(
      req.params.id
    );

    if (!user) return res.sendStatus(404);

    if (user.username === "admin@titan02") {

      return res.json({
        error:
          "No puedes eliminar el admin principal"
      });

    }

    await Usuario.findByIdAndDelete(req.params.id);

    res.json({ ok: true });

  });

  // CAMBIAR ROL
  router.put("/:id/rol",
    auth,
    soloAdminPrincipal,
    async (req, res) => {

      const { rol } = req.body;

      const user = await Usuario.findById(
        req.params.id
      );

      if (!user) return res.sendStatus(404);

      if (!['admin', 'barra', 'mesero'].includes(rol)) {
        return res.status(400).json({ error: "Rol inválido" });
      }

      if (user.username === "admin@titan02") {

        return res.json({
          error:
            "No puedes modificar el admin principal"
        });

      }

      user.rol = rol;

      await user.save();

      res.json({ ok: true });

    });

  // CAMBIAR PASSWORD ADMIN
  router.put("/:id/password",
    auth,
    soloAdminPrincipal,
    async (req, res) => {

      const { nueva } = req.body;

      const user = await Usuario.findById(
        req.params.id
      );

      if (!user) return res.sendStatus(404);

      if (typeof nueva !== "string" || nueva.length < 8) {
        return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });
      }

      const hash = await bcrypt.hash(
        nueva,
        10
      );

      user.password = hash;

      await user.save();

      res.json({ ok: true });

    });

  // CAMBIAR PASSWORD PERSONAL
  router.put("/cambiar-password",
    auth,
    async (req, res) => {

      const { actual, nueva } = req.body;

      const user = await Usuario.findById(
        req.user.id
      );

      if (!user) return res.sendStatus(404);

      if (typeof nueva !== "string" || nueva.length < 8) {
        return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });
      }

      const valido = await bcrypt.compare(
        actual,
        user.password
      );

      if (!valido) {

        return res.json({
          error:
            "Contraseña actual incorrecta"
  });

  router.post("/mi-estado", auth, async (req, res) => {
    const permitidos = ["activo", "descanso", "servicios_higienicos", "almuerzo", "reunion", "otro", "fin_turno"];
    if (!["mesero", "barra"].includes(req.user.rol) || !permitidos.includes(req.body.estado)) return res.status(400).json({ error: "Estado inválido" });
    const ahora = new Date();
    const finTurno = req.body.estado === "fin_turno";
    const estado = finTurno ? "desconectado" : req.body.estado;
    const usuario = await Usuario.findByIdAndUpdate(req.user.id, { estadoLaboral: estado, ...(finTurno ? { ultimaDesconexion: ahora } : {}) }, { new: true });
    await Asistencia.findOneAndUpdate(
      { trabajador: usuario._id, fecha: fechaLocal() },
      { $setOnInsert: { trabajador: usuario._id, fecha: fechaLocal(), entrada: ahora, estado: "asistio", registradoPor: usuario.username }, $set: { estadoActual: estado, ...(finTurno ? { salida: ahora } : {}) }, $push: { eventos: { estado, fecha: ahora } } },
      { upsert: true }
    );
    res.json({ ok: true, estado, fecha: ahora });
  });

      }

      const hash = await bcrypt.hash(
        nueva,
        10
      );

      user.password = hash;

      await user.save();

      res.json({ ok: true });

    });

  return router;

};
