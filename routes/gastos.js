const express = require("express");
const mongoose = require("mongoose");
const Gasto = require("../models/Gasto");
const Actividad = require("../models/Actividad");
const { auth, soloAdmin } = require("../middlewares/auth");
const { fechaValida, validarGasto } = require("../services/gastoValidation");
const { toCents } = require("../services/money");
const inicioLima = value => new Date(`${value}T00:00:00-05:00`);

module.exports = () => {
  const router = express.Router();

  router.get("/", auth, soloAdmin, async (req, res) => {
    const { desde, hasta, tipo } = req.query;
    if (Boolean(desde) !== Boolean(hasta) || desde && (!fechaValida(desde) || !fechaValida(hasta) || desde > hasta)) {
      return res.status(400).json({ error: "Rango de fechas invÃ¡lido" });
    }
    if (tipo && !["gasto", "compra"].includes(tipo)) return res.status(400).json({ error: "Tipo invÃ¡lido" });
    const filtro = {};
    if (tipo) filtro.tipo = tipo;
    if (desde) {
      const hastaExclusivo = new Date(inicioLima(hasta).getTime() + 86400000);
      filtro.fecha = { $gte: inicioLima(desde), $lt: hastaExclusivo };
    }
    const gastos = await Gasto.find(filtro).sort({ fecha: -1 }).limit(500);
    return res.json(gastos);
  });

  router.post("/", auth, soloAdmin, async (req, res) => {
    const validacion = validarGasto(req.body);
    if (validacion.error) return res.status(400).json({ error: validacion.error });
    const { tipo, categoria, descripcion, monto, metodoPago: metodo, fecha, proveedor } = validacion.value;
    if (req.body.cuentaId && !mongoose.isValidObjectId(req.body.cuentaId)) return res.status(400).json({ error: "Cuenta de servicio invÃ¡lida" });
    const key = req.get("Idempotency-Key");
    if (typeof key !== "string" || !/^[\w.-]{8,100}$/.test(key)) return res.status(400).json({ error: "Falta la clave de idempotencia" });

    if (req.body.cuentaId) { const cuenta = await mongoose.connection.collection("cuentasServicio").findOne({ _id: new mongoose.Types.ObjectId(req.body.cuentaId), activa: true }); if (!cuenta) return res.status(404).json({ error: "Cuenta de servicio no encontrada o inactiva" }); }
    const existente = await Gasto.findOne({ registradoPor: req.user.username, requestId: key });
    if (existente) return res.json(existente);
    const fechaRegistro = fecha ? new Date(`${fecha}T12:00:00-05:00`) : new Date();
    const session = await mongoose.startSession();
    let gasto;
    try {
      await session.withTransaction(async () => {
        const repetido = await Gasto.findOne({ registradoPor: req.user.username, requestId: key }).session(session);
        if (repetido) { gasto = repetido; return; }
        [gasto] = await Gasto.create([{
          tipo,
          categoria: categoria.trim(),
          descripcion: descripcion.trim(),
          monto,
          metodoPago: metodo,
          fecha: fechaRegistro,
          proveedor: proveedor?.trim(),
          cuentaId: req.body.cuentaId || undefined,
          registradoPor: req.user.username,
          requestId: key
        }], { session });
        await Actividad.create([{
          usuario: req.user.username,
          accion: "GASTO_REGISTRADO",
          detalle: `RegistrÃ³ ${tipo} por S/${monto.toFixed(2)} (${categoria})`
        }], { session });

      });
    } catch (err) {
      if (err.code === 11000) {
        const existente = await Gasto.findOne({ registradoPor: req.user.username, requestId: key });
        if (existente) return res.json(existente);
      }
      throw err;
    } finally {
      await session.endSession();
    }
    return res.status(201).json(gasto);
  });


  router.post("/cuentas", auth, soloAdmin, async (req, res) => {
    const { nombre, categoria, montoEstimado, periodicidad = "mensual", diaVencimiento, proveedor = "" } = req.body || {};
    const amount = toCents(montoEstimado);
    if (typeof nombre !== "string" || !nombre.trim() || nombre.trim().length > 120) return res.status(400).json({ error: "Nombre de cuenta inválido" });
    if (!["sunat", "alquiler", "seguridad", "luz", "agua", "gas", "internet", "telefono", "otro"].includes(categoria)) return res.status(400).json({ error: "Categoría inválida" });
    if (amount === null || amount <= 0 || !["mensual", "semanal", "anual", "unico"].includes(periodicidad) || !Number.isInteger(diaVencimiento) || diaVencimiento < 1 || diaVencimiento > 31) return res.status(400).json({ error: "Monto, periodicidad o vencimiento inválido" });
    if (typeof proveedor !== "string" || proveedor.length > 160) return res.status(400).json({ error: "Proveedor inválido" });
    const row = { nombre: nombre.trim(), categoria, montoEstimado: amount / 100, periodicidad, diaVencimiento, proveedor: proveedor.trim(), activa: true, creadoPor: req.user.username, creadoEn: new Date() };
    const result = await mongoose.connection.collection("cuentasServicio").insertOne(row);
    return res.status(201).json({ ...row, _id: result.insertedId });
  });

  router.get("/cuentas", auth, soloAdmin, async (_req, res) => res.json(await mongoose.connection.collection("cuentasServicio").find().sort({ nombre: 1 }).limit(500).toArray()));



  router.post("/cuentas/:id/pago", auth, soloAdmin, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id) || typeof req.body.fecha !== "string" || !fechaValida(req.body.fecha)) return res.status(400).json({ error: "Cuenta o fecha inválida" });
    const result = await mongoose.connection.collection("cuentasServicio").findOneAndUpdate({ _id: new mongoose.Types.ObjectId(req.params.id), activa: true }, { $set: { ultimoPago: new Date(`${req.body.fecha}T12:00:00-05:00`), ultimoPagoMonto: Number(req.body.monto), actualizadoEn: new Date() } }, { returnDocument: "after" });
    if (!result) return res.sendStatus(404);
    return res.json({ ok: true });
  });

  router.put("/cuentas/:id", auth, soloAdmin, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id) || typeof req.body.activa !== "boolean") return res.status(400).json({ error: "Solicitud inválida" });
    const result = await mongoose.connection.collection("cuentasServicio").findOneAndUpdate({ _id: new mongoose.Types.ObjectId(req.params.id) }, { $set: { activa: req.body.activa, actualizadoPor: req.user.username, actualizadoEn: new Date() } }, { returnDocument: "after" });
    if (!result) return res.sendStatus(404);
    return res.json(result);
  });



  return router;
};
