const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Usuario = require("../models/Usuario");
const { auth, soloAdmin, soloAdminPrincipal } = require("../middlewares/auth");

const ROLES = ["admin", "barra", "mesero"];
const esId = id => mongoose.isValidObjectId(id);
const publicUser = user => ({
  _id: user._id,
  username: user.username,
  rol: user.rol,
  activo: user.activo,
  estadoLaboral: user.estadoLaboral,
  ultimaConexion: user.ultimaConexion,
  ultimaDesconexion: user.ultimaDesconexion,
  horario: user.horario
});

module.exports = () => {
  const router = express.Router();
  const loginAttempts = new Map();

  router.post("/login", async (req, res) => {
    const now = Date.now();
    const ip = req.ip || "unknown";
    if (loginAttempts.size > 5000) {
      for (const [address, entry] of loginAttempts) if (entry.expiresAt <= now) loginAttempts.delete(address);
    }
    let attempts = loginAttempts.get(ip);
    if (!attempts || attempts.expiresAt <= now) attempts = { count: 0, expiresAt: now + 15 * 60 * 1000 };
    if (attempts.count >= 10) return res.status(429).json({ error: "Demasiados intentos; espera 15 minutos" });
    attempts.count += 1;
    loginAttempts.set(ip, attempts);
    const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
    const password = req.body.password;
    if (!username || typeof password !== "string" || !password || password.length > 1024) {
      return res.status(400).json({ error: "Usuario y contraseña son obligatorios" });
    }
    if (!process.env.JWT_SECRET) return res.status(503).json({ error: "Autenticación no configurada" });
    const user = await Usuario.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    }
    if (user.activo === false) return res.status(403).json({ error: "Esta cuenta está desactivada" });
    user.ultimaConexion = new Date();
    await user.save();
    loginAttempts.delete(ip);
    const token = jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: "8h" });
    return res.json({ token, rol: user.rol, username: user.username });
  });

  router.post("/", auth, soloAdmin, async (req, res) => {
    const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
    const { password, rol } = req.body;
    if (username.length < 3 || username.length > 120 || typeof password !== "string" || password.length < 8 || password.length > 1024 || !ROLES.includes(rol)) {
      return res.status(400).json({ error: "Datos de usuario inválidos" });
    }
    if (await Usuario.exists({ username })) return res.status(409).json({ error: "Usuario ya existe" });
    const user = await Usuario.create({ username, password: await bcrypt.hash(password, 12), rol });
    return res.status(201).json(publicUser(user));
  });

  router.get("/", auth, soloAdmin, async (_req, res) => {
    const users = await Usuario.find().sort({ username: 1 });
    return res.json(users.map(publicUser));
  });

  router.put("/:id/rol", auth, soloAdminPrincipal, async (req, res) => {
    if (!esId(req.params.id)) return res.status(400).json({ error: "Identificador inválido" });
    if (!ROLES.includes(req.body.rol)) return res.status(400).json({ error: "Rol inválido" });
    const user = await Usuario.findById(req.params.id);
    if (!user) return res.sendStatus(404);
    if (user.username === "admin@titan02") return res.status(400).json({ error: "No puedes modificar el admin principal" });
    if (user._id.equals(req.user.id)) return res.status(400).json({ error: "No puedes cambiar tu propio rol" });
    user.rol = req.body.rol;
    if (!['mesero', 'barra'].includes(user.rol)) user.estadoLaboral = "desconectado";
    await user.save();
    return res.json({ ok: true });
  });

  router.put("/:id/activo", auth, soloAdminPrincipal, async (req, res) => {
    if (!esId(req.params.id)) return res.status(400).json({ error: "Identificador inválido" });
    if (typeof req.body.activo !== "boolean") return res.status(400).json({ error: "Estado de cuenta inválido" });
    const user = await Usuario.findById(req.params.id);
    if (!user) return res.sendStatus(404);
    if (user.username === "admin@titan02" || user._id.equals(req.user.id) && !req.body.activo) {
      return res.status(400).json({ error: "No puedes desactivar esta cuenta" });
    }
    user.activo = req.body.activo;
    if (!user.activo) {
      user.estadoLaboral = "desconectado";
      user.ultimaDesconexion = new Date();
    }
    await user.save();
    return res.json({ ok: true, activo: user.activo });
  });

  // Keep historical references intact: DELETE is retained as a legacy soft deactivation.
  router.delete("/:id", auth, soloAdmin, async (req, res) => {
    if (!esId(req.params.id)) return res.status(400).json({ error: "Identificador inválido" });
    const user = await Usuario.findById(req.params.id);
    if (!user) return res.sendStatus(404);
    if (user.username === "admin@titan02" || user._id.equals(req.user.id)) return res.status(400).json({ error: "No puedes desactivar esta cuenta" });
    user.activo = false;
    user.estadoLaboral = "desconectado";
    user.ultimaDesconexion = new Date();
    await user.save();
    return res.json({ ok: true, activo: false });
  });

  router.put("/:id/password", auth, soloAdminPrincipal, async (req, res) => {
    if (!esId(req.params.id)) return res.status(400).json({ error: "Identificador inválido" });
    const nueva = req.body.nueva;
    if (typeof nueva !== "string" || nueva.length < 8 || nueva.length > 1024) return res.status(400).json({ error: "La contraseña debe tener entre 8 y 1024 caracteres" });
    const user = await Usuario.findById(req.params.id);
    if (!user) return res.sendStatus(404);
    user.password = await bcrypt.hash(nueva, 12);
    await user.save();
    return res.json({ ok: true });
  });

  router.put("/cambiar-password", auth, async (req, res) => {
    const { actual, nueva } = req.body;
    if (typeof nueva !== "string" || nueva.length < 8 || nueva.length > 1024 || typeof actual !== "string") {
      return res.status(400).json({ error: "Contraseña inválida" });
    }
    const user = await Usuario.findById(req.user.id);
    if (!user || !(await bcrypt.compare(actual, user.password))) return res.status(401).json({ error: "Contraseña actual incorrecta" });
    user.password = await bcrypt.hash(nueva, 12);
    await user.save();
    return res.json({ ok: true });
  });

  router.post("/mi-estado", auth, async (req, res) => {
    const permitidos = ["activo", "descanso", "servicios_higienicos", "almuerzo", "reunion", "otro", "fin_turno"];
    if (!["mesero", "barra"].includes(req.user.rol) || !permitidos.includes(req.body.estado)) {
      return res.status(400).json({ error: "Estado inválido" });
    }
    const usuario = await Usuario.findById(req.user.id);
    if (!usuario || usuario.activo === false) return res.status(403).json({ error: "Cuenta no disponible" });
    const ahora = new Date();
    usuario.estadoLaboral = req.body.estado === "fin_turno" ? "desconectado" : req.body.estado;
    if (req.body.estado === "fin_turno") usuario.ultimaDesconexion = ahora;
    await usuario.save();
    return res.json({ ok: true, estado: usuario.estadoLaboral, fecha: ahora });
  });

  return router;
};
