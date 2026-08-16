const express = require("express");
const router = express.Router();
const Usuario = require("../models/Usuario");
const Asistencia = require("../models/Asistencia");
const PagoTrabajador = require("../models/PagoTrabajador");
const { auth, soloAdmin } = require("../middlewares/auth");

const esId = id => /^[a-f\d]{24}$/i.test(id);

router.get("/", auth, soloAdmin, async (req, res) => {
  const trabajadores = await Usuario.find({ rol: { $in: ["mesero", "barra"] } }).select("username rol activo pagoDiario");
  const ids = trabajadores.map(t => t._id);
  const [asistencias, pagos] = await Promise.all([Asistencia.find({ trabajador: { $in: ids } }), PagoTrabajador.find({ trabajador: { $in: ids } })]);
  const resumen = trabajadores.map(t => {
    const ganado = asistencias.filter(a => String(a.trabajador) === String(t._id) && a.estado !== "ausencia").reduce((s, a) => s + a.pagoDiario, 0);
    const pagado = pagos.filter(p => String(p.trabajador) === String(t._id)).reduce((s, p) => s + p.monto, 0);
    return { ...t.toObject(), ganado, pagado, pendiente: ganado - pagado };
  });
  res.json(resumen);
});

router.put("/:id/configuracion", auth, soloAdmin, async (req, res) => {
  if (!esId(req.params.id) || !Number.isFinite(Number(req.body.pagoDiario)) || Number(req.body.pagoDiario) < 0) return res.status(400).json({ error: "Configuración inválida" });
  const trabajador = await Usuario.findOneAndUpdate({ _id: req.params.id, rol: { $in: ["mesero", "barra"] } }, { pagoDiario: Number(req.body.pagoDiario), activo: req.body.activo !== false }, { new: true }).select("username rol activo pagoDiario");
  if (!trabajador) return res.sendStatus(404);
  res.json(trabajador);
});

router.post("/:id/asistencia", auth, soloAdmin, async (req, res) => {
  if (!esId(req.params.id) || !/^\d{4}-\d{2}-\d{2}$/.test(req.body.fecha || "")) return res.status(400).json({ error: "Trabajador o fecha inválidos" });
  const trabajador = await Usuario.findById(req.params.id);
  if (!trabajador || !["mesero", "barra"].includes(trabajador.rol)) return res.sendStatus(404);
  const estado = req.body.estado || "asistio";
  if (!["asistio", "tardanza", "ausencia"].includes(estado)) return res.status(400).json({ error: "Estado inválido" });
  try {
    const asistencia = await Asistencia.create({ trabajador: trabajador._id, fecha: req.body.fecha, entrada: req.body.entrada || undefined, salida: req.body.salida || undefined, estado, minutosTardanza: Number(req.body.minutosTardanza) || 0, pagoDiario: estado === "ausencia" ? 0 : trabajador.pagoDiario, observaciones: req.body.observaciones || "", registradoPor: req.user.username });
    res.status(201).json(asistencia);
  } catch (err) { if (err.code === 11000) return res.status(409).json({ error: "La asistencia ya fue registrada" }); throw err; }
});

router.post("/:id/pagos", auth, soloAdmin, async (req, res) => {
  if (!esId(req.params.id) || !Number.isFinite(Number(req.body.monto)) || Number(req.body.monto) <= 0) return res.status(400).json({ error: "Pago inválido" });
  const trabajador = await Usuario.findById(req.params.id);
  if (!trabajador) return res.sendStatus(404);
  const pago = await PagoTrabajador.create({ trabajador: trabajador._id, monto: Number(req.body.monto), fecha: req.body.fecha || new Date(), nota: req.body.nota || "", registradoPor: req.user.username });
  res.status(201).json(pago);
});

module.exports = router;
