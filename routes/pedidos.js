const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Pedido = require("../models/Pedido");
const Producto = require("../models/Producto");
const Notificacion = require("../models/Notificacion");
const Actividad = require("../models/Actividad");
const { toCents, sumCents } = require("../services/money");
const { auth, soloAdmin, soloBarra, soloMesero } = require("../middlewares/auth");

const ESTADOS = ["en_espera", "preparando", "listo", "entregado"];
const cents = toCents;

module.exports = io => {
  router.get("/", auth, async (req, res) => {
    const { estado, desde, hasta, metodo } = req.query;
    const filtro = {};
    if (estado && ![...ESTADOS, "cancelado"].includes(estado)) return res.status(400).json({ error: "Estado de pedido inválido" });
    if (estado) filtro.estado = estado;
    else if (req.user.rol === "mesero") filtro.estado = { $in: ["entregado"] };
    if (Boolean(desde) !== Boolean(hasta)) return res.status(400).json({ error: "Indica ambas fechas del período" });
    if (desde && hasta) {
      const validaFecha = value => /^\\d{4}-\\d{2}-\\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
      if (!validaFecha(desde) || !validaFecha(hasta) || desde > hasta) return res.status(400).json({ error: "Rango de fechas inválido" });
      const inicio = new Date(`${desde}T00:00:00-05:00`), fin = new Date(`${hasta}T00:00:00-05:00`);
      fin.setTime(fin.getTime() + 86400000);
      filtro.fecha = { $gte: inicio, $lt: fin };
    }
    if (metodo && !["efectivo", "yape"].includes(metodo)) return res.status(400).json({ error: "Método de pago inválido" });
    if (metodo) filtro["pagos.metodo"] = metodo;
    if (!estado) filtro.estado = { $ne: "cancelado" };
    const pedidos = await Pedido.find(filtro).sort({ fecha: -1 }).limit(500);
    return res.json(pedidos);
  });

  router.put("/:id", auth, soloBarra, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Identificador inválido" });
    if (!ESTADOS.includes(req.body.estado)) return res.status(400).json({ error: "Estado de pedido inválido" });
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) return res.sendStatus(404);
    if (pedido.estado === "cancelado") return res.status(409).json({ error: "Un pedido cancelado no puede avanzar" });
    const transiciones = { en_espera: ["preparando"], preparando: ["listo"], listo: ["preparando", "entregado"], entregado: [] };
    if (pedido.estado !== req.body.estado && !transiciones[pedido.estado]?.includes(req.body.estado)) {
      return res.status(409).json({ error: "Transición de estado no permitida" });
    }
    pedido.estado = req.body.estado;
    await pedido.save();
    io.to(`role:${req.user.rol}`).emit("actualizar");
    return res.json({ ok: true, pedido });
  });

  // Orders are retained for accounting/history; cancellation is not deletion.
  router.delete("/:id", auth, soloAdmin, async (_req, res) => res.status(405).json({ error: "Los pedidos no se eliminan; registra una anulación auditada" }));

  router.post("/:id/pagar", auth, async (req, res) => {
    if (!["mesero", "admin"].includes(req.user.rol)) return res.sendStatus(403);
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Identificador inválido" });
    const { monto, metodo, recibido, indices } = req.body;
    const key = req.get("Idempotency-Key");
    if (typeof key !== "string" || !/^[\w.-]{8,100}$/.test(key)) return res.status(400).json({ error: "Se requiere una clave de pago" });
    if (!Number.isFinite(monto) || monto <= 0 || cents(monto) === null || !["efectivo", "yape"].includes(metodo)) return res.status(400).json({ error: "Importe o método inválido" });
    if (metodo === "efectivo" && (!Number.isFinite(recibido) || recibido < monto || cents(recibido) === null)) return res.status(400).json({ error: "Monto recibido inválido" });
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) return res.sendStatus(404);
    const pagoPrevio = pedido.pagos.find(p => p.requestId === key);
    if (pagoPrevio) return res.json(pedido);
    if (pedido.estado !== "entregado" || pedido.pagado) return res.status(409).json({ error: "El pedido no está disponible para cobrar" });
    const totalCents = cents(pedido.total);
    const paidCents = cents(pedido.totalPagado || 0);
    const amountCents = cents(monto);
    if (totalCents === null || paidCents === null || paidCents > totalCents) return res.status(409).json({ error: "Los importes guardados requieren revisión administrativa" });
    if (amountCents > totalCents - paidCents) return res.status(409).json({ error: "El pago excede el total restante" });
    if (indices !== undefined) {
      if (!Array.isArray(indices) || indices.length === 0 || new Set(indices).size !== indices.length || indices.some(i => !Number.isInteger(i) || i < 0 || i >= pedido.items.length || pedido.items[i].pagado)) return res.status(400).json({ error: "Selección de productos inválida" });
      const selectedCents = sumCents(indices.map(i => pedido.items[i].precio));
      if (selectedCents === null) return res.status(409).json({ error: "Los precios del pedido requieren revisión administrativa" });
      if (selectedCents !== amountCents) return res.status(400).json({ error: "El importe no coincide con los productos seleccionados" });
    }
    const nextCents = paidCents + amountCents;
    const set = { totalPagado: nextCents / 100, pagado: nextCents === totalCents };
    if (Array.isArray(indices)) indices.forEach(i => { set[`items.${i}.pagado`] = true; });
    const pagoFilter = { _id: pedido._id, estado: "entregado", pagado: false, "pagos.requestId": { $ne: key } };
    if (paidCents === 0) pagoFilter.$or = [{ totalPagado: 0 }, { totalPagado: { $exists: false } }];
    else pagoFilter.totalPagado = paidCents / 100;
    const updated = await Pedido.findOneAndUpdate(
      pagoFilter,
      { $set: set, $push: { pagos: { monto, metodo, recibido: metodo === "efectivo" ? recibido : null, vuelto: metodo === "efectivo" ? (cents(recibido) - amountCents) / 100 : 0, mesero: req.user.username, requestId: key, fecha: new Date() } } },
      { new: true }
    );
    if (!updated) {
      const current = await Pedido.findById(pedido._id);
      if (current?.pagos.some(p => p.requestId === key)) return res.json(current);
      return res.status(409).json({ error: "El pedido cambió durante el cobro; actualiza e inténtalo de nuevo" });
    }
    await Actividad.create({ usuario: req.user.username, accion: "COBRO", detalle: `Cobró S/${monto.toFixed(2)} en mesa ${pedido.mesa} por ${metodo}` });
    io.emit("actualizar");
    return res.json(updated);
  });

  router.post("/", auth, soloMesero, async (req, res) => {
    const mesa = typeof req.body.mesa === "string" ? req.body.mesa.trim() : "";
    const items = req.body.items;
    const requestId = req.get("Idempotency-Key") || req.body.requestId;
    if (!mesa || mesa.length > 80 || !Array.isArray(items) || items.length < 1 || items.length > 100) {
      return res.status(400).json({ error: "Mesa e ítems válidos son obligatorios" });
    }
    if (typeof requestId !== "string" || !/^[\w.-]{8,100}$/.test(requestId)) {
      return res.status(400).json({ error: "Se requiere una clave de idempotencia válida" });
    }
    const existente = await Pedido.findOne({ creadoPor: req.user.username, requestId });
    if (existente) return res.json(existente);

    const cantidades = new Map();
    const keyPorItem = new Map();
    for (const item of items) {
      if (!item || typeof item.producto !== "string" || !item.producto.trim() || item.producto.length > 160 || item.productoId !== undefined && !mongoose.isValidObjectId(item.productoId) || typeof item.nota === "string" && item.nota.length > 300) {
        return res.status(400).json({ error: "Ítem de pedido inválido" });
      }
      const nombre = item.producto.trim();
      const key = item.productoId ? String(item.productoId) : `name:${nombre}`;
      keyPorItem.set(item, key);
      cantidades.set(key, (cantidades.get(key) || 0) + 1);
    }
    const productos = new Map();
    for (const key of cantidades.keys()) {
      const p = key.startsWith("name:") ? await Producto.findOne({ nombre: key.slice(5) }) : await Producto.findById(key);
      if (!p || !Number.isFinite(p.precio) || p.precio < 0) return res.status(400).json({ error: `Producto no disponible: ${key.startsWith("name:") ? key.slice(5) : key}` });
      if (!Number.isInteger(p.stock) || p.stock < cantidades.get(key)) return res.status(409).json({ error: `Stock insuficiente de ${p.nombre}` });
      productos.set(key, p);
    }

    const session = await mongoose.startSession();
    let pedidoCreado;
    try {
      await session.withTransaction(async () => {
        const duplicado = await Pedido.findOne({ creadoPor: req.user.username, requestId }).session(session);
        if (duplicado) {
          pedidoCreado = duplicado;
          return;
        }
        for (const [key, cantidad] of cantidades) {
          const p = productos.get(key);
          const reservado = await Producto.findOneAndUpdate({ _id: p._id, stock: { $gte: cantidad } }, { $inc: { stock: -cantidad } }, { new: true, session });
          if (!reservado) throw Object.assign(new Error(`Stock insuficiente de ${p.nombre}`), { status: 409 });
        }
        const safeItems = items.map(item => {
          const p = productos.get(keyPorItem.get(item));
          return { producto: p.nombre, precio: p.precio, pagado: false, azucar: item.azucar === true, helado: item.helado === true, nota: typeof item.nota === "string" ? item.nota.trim() : "" };
        });
        const totalCents = sumCents(safeItems.map(item => item.precio));
        if (totalCents === null) throw Object.assign(new Error("Los precios del pedido requieren revisión administrativa"), { status: 409 });
        const total = totalCents / 100;
        [pedidoCreado] = await Pedido.create([{ mesa, items: safeItems, creadoPor: req.user.username, requestId, total, totalPagado: 0, estado: "en_espera" }], { session });
        await Notificacion.create([{ mensaje: `Nuevo pedido en mesa ${mesa}`, usuario: req.user.username, rol: "barra" }], { session });
      });
    } catch (err) {
      if (err.code === 11000) {
        const pedido = await Pedido.findOne({ creadoPor: req.user.username, requestId });
        if (pedido) return res.json(pedido);
      }
      if (err.status) return res.status(err.status).json({ error: err.message });
      throw err;
    } finally {
      await session.endSession();
    }
    io.emit("actualizar");
    return res.status(201).json(pedidoCreado);
  });

  return router;
};
