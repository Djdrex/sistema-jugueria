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
      return res.status(400).json({ error: "Rango de fechas inválido" });
    }
    if (tipo && !["gasto", "compra"].includes(tipo)) return res.status(400).json({ error: "Tipo inválido" });
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
    const key = req.get("Idempotency-Key");
    if (typeof key !== "string" || !/^[\w.-]{8,100}$/.test(key)) return res.status(400).json({ error: "Falta la clave de idempotencia" });

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
          registradoPor: req.user.username,
          requestId: key
        }], { session });
        await Actividad.create([{
          usuario: req.user.username,
          accion: "GASTO_REGISTRADO",
          detalle: `Registró ${tipo} por S/${monto.toFixed(2)} (${categoria})`
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

  return router;
};
