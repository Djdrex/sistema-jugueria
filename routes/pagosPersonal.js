const express = require("express");
const mongoose = require("mongoose");
const PagoTrabajador = require("../models/PagoTrabajador");
const Usuario = require("../models/Usuario");
const Actividad = require("../models/Actividad");
const { auth, soloAdmin } = require("../middlewares/auth");
const { esId, fechaValida, validarPagoTrabajador } = require("../services/pagoTrabajadorValidation");

const inicioLima = fecha => new Date(`${fecha}T00:00:00-05:00`);

module.exports = () => {
  const router = express.Router();

  router.get("/mios", auth, async (req, res) => {
    if (!["mesero", "barra"].includes(req.user.rol)) return res.status(403).json({ error: "Esta vista es exclusiva para trabajadores" });
    const usuario = await Usuario.findById(req.user.id).select("username pagoDiario modalidadPago transporteDiario");
    if (!usuario) return res.sendStatus(404);
    const desde = req.query.desde, hasta = req.query.hasta;
    if (Boolean(desde) !== Boolean(hasta) || desde && (!fechaValida(desde) || !fechaValida(hasta) || desde > hasta)) return res.status(400).json({ error: "Rango de fechas inválido" });
    const filtro = { trabajador: usuario._id };
    if (desde) filtro.fecha = { $gte: inicioLima(desde), $lt: new Date(inicioLima(hasta).getTime() + 86400000) };
    const pagos = await PagoTrabajador.find(filtro).sort({ fecha: -1 }).limit(500).select("monto metodoPago fecha nota registradoPor");
    return res.json({ trabajador: { username: usuario.username, remuneracionDiaria: usuario.pagoDiario || 0, modalidad: usuario.modalidadPago || "no configurada", transporteDiario: usuario.transporteDiario || 0 }, pagos });
  });

  router.get("/", auth, soloAdmin, async (req, res) => {
    const { trabajador, desde, hasta } = req.query;
    if (trabajador && !esId(trabajador)) return res.status(400).json({ error: "Identificador de trabajador inválido" });
    if (Boolean(desde) !== Boolean(hasta) || desde && (!fechaValida(desde) || !fechaValida(hasta) || desde > hasta)) return res.status(400).json({ error: "Rango de fechas inválido" });
    const filtro = {};
    if (trabajador) filtro.trabajador = trabajador;
    if (desde) filtro.fecha = { $gte: inicioLima(desde), $lt: new Date(inicioLima(hasta).getTime() + 86400000) };
    const pagos = await PagoTrabajador.find(filtro).populate({ path:"trabajador", select:"username rol" }).sort({ fecha:-1 }).limit(500);
    return res.json(pagos);
  });

  router.post("/", auth, soloAdmin, async (req, res) => {
    const validacion = validarPagoTrabajador(req.body);
    if (validacion.error) return res.status(400).json({ error: validacion.error });
    const key = req.get("Idempotency-Key");
    if (typeof key !== "string" || !/^[\w.-]{8,100}$/.test(key)) return res.status(400).json({ error: "Falta la clave de idempotencia" });
    const datos = validacion.value;
    const trabajador = await Usuario.findOne({ _id: datos.trabajador, rol: { $in:["mesero", "barra"] } }).select("username rol activo");
    if (!trabajador) return res.status(404).json({ error: "No se encontró un trabajador válido" });
    const existente = await PagoTrabajador.findOne({ registradoPor:req.user.username, requestId:key });
    if (existente) return res.json(existente);
    const fecha = datos.fecha ? new Date(`${datos.fecha}T12:00:00-05:00`) : new Date();
    const session = await mongoose.startSession();
    let pago;
    try {
      await session.withTransaction(async () => {
        const repetido = await PagoTrabajador.findOne({ registradoPor:req.user.username, requestId:key }).session(session);
        if (repetido) { pago = repetido; return; }
        [pago] = await PagoTrabajador.create([{
          trabajador: trabajador._id,
          monto: datos.monto,
          metodoPago: datos.metodoPago,
          fecha,
          nota: datos.nota,
          registradoPor: req.user.username,
          autorizadoPor: req.user.username,
          requestId: key
        }], { session });
        await Actividad.create([{
          usuario:req.user.username,
          accion:"PAGO_PERSONAL_REGISTRADO",
          detalle:`Registró pago interno de S/${datos.monto.toFixed(2)} para ${trabajador.username}`
        }], { session });
      });
    } catch (err) {
      if (err.code === 11000) {
        const repetido = await PagoTrabajador.findOne({ registradoPor:req.user.username, requestId:key });
        if (repetido) return res.json(repetido);
      }
      throw err;
    } finally {
      await session.endSession();
    }
    await pago.populate({ path:"trabajador", select:"username rol" });
    return res.status(201).json(pago);
  });

  return router;
};
