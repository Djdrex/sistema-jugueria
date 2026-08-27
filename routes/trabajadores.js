const express = require("express");
const router = express.Router();
const Usuario = require("../models/Usuario");
const Asistencia = require("../models/Asistencia");
const { auth, soloAdmin } = require("../middlewares/auth");

const esId = id => /^[a-f\d]{24}$/i.test(id);
const esFecha = fecha => /^\d{4}-\d{2}-\d{2}$/.test(fecha || "");
const fechaHoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());

router.get("/", auth, soloAdmin, async (req, res) => {
  const trabajadores = await Usuario.find({ rol: { $in: ["mesero", "barra"] } }).select("username rol activo estadoLaboral ultimaConexion ultimaDesconexion horario");
  const asistencias = await Asistencia.find({ trabajador: { $in: trabajadores.map(t => t._id) } }).sort({ fecha: -1 });
  res.json(trabajadores.map(t => ({ ...t.toObject(), asistencias: asistencias.filter(a => String(a.trabajador) === String(t._id)).slice(0, 30) })));
});

router.put("/:id/configuracion", auth, soloAdmin, async (req, res) => {
  const horario = req.body.horario || {};
  const dias = Array.isArray(horario.dias) ? horario.dias.map(Number) : [];
  const horaValida = hora => !hora || /^\d{2}:\d{2}$/.test(hora);
  if (!esId(req.params.id) || dias.some(d => !Number.isInteger(d) || d < 0 || d > 6) || !horaValida(horario.horaEntrada) || !horaValida(horario.horaSalida)) return res.status(400).json({ error: "Configuración inválida" });
  const trabajador = await Usuario.findOneAndUpdate({ _id: req.params.id, rol: { $in: ["mesero", "barra"] } }, { activo: req.body.activo !== false, horario: { dias, horaEntrada: horario.horaEntrada || "", horaSalida: horario.horaSalida || "" } }, { new: true }).select("username rol activo estadoLaboral horario");
  if (!trabajador) return res.sendStatus(404);
  res.json(trabajador);
});

router.post("/:id/asistencia", auth, soloAdmin, async (req, res) => {
  if (!esId(req.params.id) || !esFecha(req.body.fecha)) return res.status(400).json({ error: "Trabajador o fecha inválidos" });
  const trabajador = await Usuario.findById(req.params.id);
  if (!trabajador || !["mesero", "barra"].includes(trabajador.rol)) return res.sendStatus(404);
  const estado = req.body.estado || "asistio";
  if (!["asistio", "tardanza", "ausencia"].includes(estado)) return res.status(400).json({ error: "Estado inválido" });
  const asistencia = await Asistencia.findOneAndUpdate({ trabajador: trabajador._id, fecha: req.body.fecha }, { trabajador: trabajador._id, fecha: req.body.fecha, entrada: req.body.entrada || undefined, salida: req.body.salida || undefined, estado, estadoActual: estado === "ausencia" ? "desconectado" : "activo", minutosTardanza: Number(req.body.minutosTardanza) || 0, observaciones: req.body.observaciones || "", registradoPor: req.user.username }, { upsert: true, new: true, setDefaultsOnInsert: true });
  res.status(201).json(asistencia);
});

router.get("/faltas/resumen", auth, soloAdmin, async (req, res) => {
  const desde = esFecha(req.query.desde) ? req.query.desde : new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const hasta = esFecha(req.query.hasta) ? req.query.hasta : new Date().toISOString().slice(0, 10);
  const trabajadores = await Usuario.find({ rol: { $in: ["mesero", "barra"] }, activo: true }).select("username horario");
  const asistencias = await Asistencia.find({ fecha: { $gte: desde, $lte: hasta } });
  const faltas = [];
  for (const t of trabajadores) for (let d = new Date(`${desde}T12:00:00`), fin = new Date(`${hasta}T12:00:00`); d <= fin; d.setDate(d.getDate() + 1)) {
    const fecha = d.toISOString().slice(0, 10);
    if (fecha < fechaHoy() && (t.horario.dias || []).includes(d.getDay()) && !asistencias.some(a => String(a.trabajador) === String(t._id) && a.fecha === fecha && a.estado !== "ausencia")) faltas.push({ trabajador: t._id, username: t.username, fecha });
  }
  res.json({ desde, hasta, faltas });
});

module.exports = router;
