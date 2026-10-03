const express = require("express");
const mongoose = require("mongoose");
const Producto = require("../models/Producto");
const { auth, soloAdmin } = require("../middlewares/auth");

module.exports = io => {
  const router = express.Router();
  router.post("/", auth, soloAdmin, async (req, res) => {
    const { nombre, categoria, precio, stock } = req.body;
    if (typeof nombre !== "string" || !nombre.trim() || nombre.trim().length > 160 || typeof categoria !== "string" || categoria.trim().length > 80 || !Number.isFinite(precio) || precio < 0 || Math.round(precio * 100) !== precio * 100 || !Number.isInteger(stock) || stock < 0) {
      return res.status(400).json({ error: "Nombre, categoría, precio y stock inválidos" });
    }
    const producto = await Producto.create({ nombre: nombre.trim(), categoria: categoria.trim(), precio, stock });
    io.emit("actualizar");
    return res.status(201).json(producto);
  });

  router.get("/", auth, async (_req, res) => res.json(await Producto.find().sort({ nombre: 1 })));

  router.delete("/:id", auth, soloAdmin, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Identificador inválido" });
    // Products are referenced by historical orders, so hard deletion is refused.
    return res.status(405).json({ error: "No se elimina el historial. Actualiza o descontinúa el producto" });
  });

  router.put("/:id/stock", auth, soloAdmin, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Identificador inválido" });
    const { cambio } = req.body;
    if (!Number.isInteger(cambio) || cambio === 0 || Math.abs(cambio) > 100000) return res.status(400).json({ error: "El cambio de stock debe ser un entero distinto de cero" });
    const update = await Producto.updateOne({ _id: req.params.id, ...(cambio < 0 ? { stock: { $gte: -cambio } } : {}) }, { $inc: { stock: cambio } });
    if (!update.matchedCount) return res.status(409).json({ error: "Producto inexistente o stock insuficiente" });
    const producto = await Producto.findById(req.params.id);
    io.emit("actualizar");
    return res.json(producto);
  });
  return router;
};
