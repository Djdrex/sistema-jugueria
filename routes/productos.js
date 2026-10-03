const express = require("express");
const mongoose = require("mongoose");
const Producto = require("../models/Producto");
const Categoria = require("../models/Categoria");
const MovimientoInventario = require("../models/MovimientoInventario");
const Actividad = require("../models/Actividad");
const { auth, soloAdmin } = require("../middlewares/auth");

module.exports = io => {
  const router = express.Router();
  router.post("/", auth, soloAdmin, async (req, res) => {
    const { nombre, categoria, precio = 0, stock, stockMinimo, costo, unidad, tipo = "producto", receta = [] } = req.body;
    if (typeof nombre !== "string" || !nombre.trim() || nombre.trim().length > 160 || typeof categoria !== "string" || categoria.trim().length > 80 || !Number.isFinite(precio) || precio < 0 || Math.round(precio * 100) !== precio * 100 || !Number.isInteger(stock) || stock < 0) {
      return res.status(400).json({ error: "Nombre, categoría, precio y stock inválidos" });
    }
    if (stockMinimo !== undefined && (!Number.isInteger(stockMinimo) || stockMinimo < 0) || costo !== undefined && (!Number.isFinite(costo) || costo < 0 || Math.round(costo * 100) !== costo * 100) || unidad !== undefined && (typeof unidad !== "string" || !unidad.trim() || unidad.length > 30)) return res.status(400).json({ error: "Costo, unidad o stock mínimo inválido" });
    if (!["producto", "insumo"].includes(tipo) || !Array.isArray(receta) || receta.length > 100) return res.status(400).json({ error:"Tipo o receta inválidos" });
    if (tipo === "insumo" && precio !== 0) return res.status(400).json({ error:"Un insumo se crea con precio de venta cero" });
    const producto = await Producto.create({ nombre: nombre.trim(), categoria: categoria.trim(), precio, stock, stockMinimo, costo, unidad: unidad?.trim(), tipo, receta:tipo === "producto" ? receta : [] });
    io.emit("actualizar");
    return res.status(201).json(producto);
  });

  router.get("/", auth, async (req, res) => {
    const { categoria, disponibilidad, buscar, tipo } = req.query;
    const filtro = {};
    if (categoria) filtro.categoria = categoria;
    if (tipo && !["producto", "insumo"].includes(tipo)) return res.status(400).json({ error:"Tipo inválido" });
    if (tipo) filtro.tipo = tipo;
    if (disponibilidad === "agotado") filtro.stock = 0;
    else if (disponibilidad === "bajo") filtro.$expr = { $and: [{ $gt: ["$stock", 0] }, { $lte: ["$stock", { $ifNull: ["$stockMinimo", 5] }] }] };
    else if (disponibilidad === "disponible") filtro.stock = { $gt: 0 };
    if (buscar) filtro.nombre = { $regex: String(buscar).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    return res.json(await Producto.find(filtro).sort({ nombre: 1 }).limit(1000));
  });

  router.put("/:id", auth, soloAdmin, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Identificador inválido" });
    const allowed = ["nombre", "categoria", "precio", "stockMinimo", "costo", "unidad", "activo"];
    if (Object.keys(req.body).some(key => !allowed.includes(key))) return res.status(400).json({ error: "Campo no editable" });
    const { nombre, categoria, precio, stockMinimo, costo, unidad, activo } = req.body;
    if (nombre !== undefined && (typeof nombre !== "string" || !nombre.trim() || nombre.length > 160) || categoria !== undefined && (typeof categoria !== "string" || !categoria.trim() || categoria.length > 80) || precio !== undefined && (!Number.isFinite(precio) || precio < 0 || Math.round(precio * 100) !== precio * 100) || stockMinimo !== undefined && (!Number.isInteger(stockMinimo) || stockMinimo < 0) || costo !== undefined && (!Number.isFinite(costo) || costo < 0) || unidad !== undefined && (typeof unidad !== "string" || !unidad.trim() || unidad.length > 30) || activo !== undefined && typeof activo !== "boolean") return res.status(400).json({ error: "Datos de producto inválidos" });
    const values = { ...req.body };
    if (values.nombre) values.nombre = values.nombre.trim();
    if (values.categoria) values.categoria = values.categoria.trim();
    if (values.unidad) values.unidad = values.unidad.trim();
    const producto = await Producto.findByIdAndUpdate(req.params.id, { $set: values }, { new: true, runValidators: true });
    if (!producto) return res.sendStatus(404);
    await Actividad.create({ usuario:req.user.username, accion:"PRODUCTO_ACTUALIZADO", detalle:`Actualizó ${producto.nombre}: ${Object.keys(values).join(", ")}` });
    io.emit("actualizar");
    return res.json(producto);
  });

  router.get("/categorias", auth, async (_req, res) => {
    const [categories, rows] = await Promise.all([Categoria.find().sort({ nombre: 1 }).lean(), Producto.aggregate([{ $group: { _id: "$categoria", productos: { $sum: 1 } } }])]);
    const counts = new Map(rows.map(row => [row._id || "Sin categoría", row.productos]));
    const all = new Map(categories.map(category => [category.nombre.toLocaleLowerCase(), { ...category, productos: counts.get(category.nombre) || 0 }]));
    for (const [nombre, productos] of counts) if (!all.has(nombre.toLocaleLowerCase())) all.set(nombre.toLocaleLowerCase(), { nombre, descripcion: "", activo: true, productos, heredada: true });
    return res.json([...all.values()].sort((a, b) => a.nombre.localeCompare(b.nombre)));
  });

  router.get("/insumos", auth, async (_req, res) => res.json(await Producto.find({ tipo:"insumo" }).select("nombre categoria stock stockMinimo costo unidad activo").sort({ nombre:1 }).limit(1000)));

  router.get("/insumos/resumen", auth, soloAdmin, async (_req, res) => {
    const rows = await Producto.find({ tipo:"insumo" }).select("nombre categoria stock stockMinimo costo unidad activo").sort({ stock:1, nombre:1 }).limit(1000);
    const activos = rows.filter(item => item.activo !== false);
    return res.json({ insumos:rows, resumen:{ total:rows.length, agotados:activos.filter(i => i.stock <= 0).length, bajoStock:activos.filter(i => i.stock > 0 && i.stock <= (i.stockMinimo ?? 5)).length, valorizacion:activos.every(i => Number.isFinite(i.costo)) ? activos.reduce((sum,i)=>sum+i.stock*i.costo,0) : null } });
  });

  router.get("/:id/receta", auth, soloAdmin, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error:"Identificador inválido" });
    const producto = await Producto.findById(req.params.id).populate("receta.insumo", "nombre unidad stock stockMinimo");
    if (!producto) return res.sendStatus(404);
    return res.json({ receta:producto.receta, insumos:await Producto.find({ tipo:"insumo", activo:{ $ne:false } }).select("nombre unidad stock stockMinimo").sort({ nombre:1 }) });
  });

  router.put("/:id/receta", auth, soloAdmin, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id) || !Array.isArray(req.body.receta) || req.body.receta.length > 100) return res.status(400).json({ error:"Receta inválida" });
    const ids = new Set();
    for (const row of req.body.receta) {
      if (!row || !mongoose.isValidObjectId(row.insumo) || !Number.isFinite(row.cantidad) || row.cantidad <= 0 || ids.has(String(row.insumo))) return res.status(400).json({ error:"Cada insumo debe ser válido y no repetirse" });
      ids.add(String(row.insumo));
    }
    if (ids.has(String(req.params.id))) return res.status(400).json({ error:"Un producto no puede consumirse a sí mismo como insumo" });
    const insumos = await Producto.countDocuments({ _id:{ $in:[...ids] }, tipo:"insumo" });
    if (insumos !== ids.size) return res.status(400).json({ error:"La receta solo puede referir productos tipo insumo" });
    const producto = await Producto.findOneAndUpdate({ _id:req.params.id, tipo:"producto" }, { $set:{ receta:req.body.receta } }, { new:true });
    if (!producto) return res.status(404).json({ error:"No se encontró producto vendible" });
    io.emit("actualizar");
    return res.json(producto);
  });

  router.post("/categorias", auth, soloAdmin, async (req, res) => {
    const nombre = typeof req.body.nombre === "string" ? req.body.nombre.trim() : "";
    if (!nombre || nombre.length > 80) return res.status(400).json({ error: "Nombre de categoría inválido" });
    const existentes = await Producto.distinct("categoria");
    if (existentes.some(value => value.toLocaleLowerCase() === nombre.toLocaleLowerCase()) || await Categoria.exists({ nombre: new RegExp(`^${nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") })) return res.status(409).json({ error: "La categoría ya existe" });
    const category = await Categoria.create({ nombre, descripcion: typeof req.body.descripcion === "string" ? req.body.descripcion.trim().slice(0, 300) : "" });
    io.emit("actualizar");
    return res.status(201).json(category);
  });

  router.put("/categorias/:id", auth, soloAdmin, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Identificador inválido" });
    const values = {};
    if (req.body.nombre !== undefined) {
      if (typeof req.body.nombre !== "string" || !req.body.nombre.trim() || req.body.nombre.trim().length > 80) return res.status(400).json({ error: "Nombre inválido" });
      values.nombre = req.body.nombre.trim();
    }
    if (req.body.descripcion !== undefined) {
      if (typeof req.body.descripcion !== "string" || req.body.descripcion.length > 300) return res.status(400).json({ error: "Descripción inválida" });
      values.descripcion = req.body.descripcion.trim();
    }
    if (req.body.activo !== undefined) {
      if (typeof req.body.activo !== "boolean") return res.status(400).json({ error: "Estado inválido" });
      values.activo = req.body.activo;
    }
    try {
      const category = await Categoria.findByIdAndUpdate(req.params.id, { $set: values }, { new: true, runValidators: true });
      if (!category) return res.sendStatus(404);
      io.emit("actualizar");
      return res.json(category);
    } catch (error) { if (error.code === 11000) return res.status(409).json({ error: "La categoría ya existe" }); throw error; }
  });

  router.get("/:id/movimientos", auth, soloAdmin, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Identificador inválido" });
    return res.json(await MovimientoInventario.find({ producto: req.params.id }).sort({ fecha: -1 }).limit(200));
  });

  router.delete("/:id", auth, soloAdmin, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Identificador inválido" });
    // Products are referenced by historical orders, so hard deletion is refused.
    return res.status(405).json({ error: "No se elimina el historial. Actualiza o descontinúa el producto" });
  });

  router.put("/:id/stock", auth, soloAdmin, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Identificador inválido" });
    const { cambio } = req.body;
    if (!Number.isInteger(cambio) || cambio === 0 || Math.abs(cambio) > 100000) return res.status(400).json({ error: "El cambio de stock debe ser un entero distinto de cero" });
    const motivo = typeof req.body.motivo === "string" ? req.body.motivo.trim().slice(0, 300) : "Ajuste manual";
    const session = await mongoose.startSession();
    let producto;
    try {
      await session.withTransaction(async () => {
        producto = await Producto.findOneAndUpdate({ _id: req.params.id, ...(cambio < 0 ? { stock: { $gte: -cambio } } : {}) }, { $inc: { stock: cambio } }, { new: true, session });
        if (!producto) throw Object.assign(new Error("Producto inexistente o stock insuficiente"), { status: 409 });
        await MovimientoInventario.create([{ producto: producto._id, nombreProducto: producto.nombre, cambio, saldo: producto.stock, tipo: cambio > 0 ? "entrada" : "salida", motivo, usuario: req.user.username }], { session });
        await Actividad.create([{ usuario: req.user.username, accion: "INVENTARIO_AJUSTE", detalle: `Ajustó ${producto.nombre} en ${cambio > 0 ? "+" : ""}${cambio}. ${motivo}` }], { session });
      });
    } catch (error) { if (error.status) return res.status(error.status).json({ error: error.message }); throw error; }
    finally { await session.endSession(); }
    io.emit("actualizar");
    return res.json(producto);
  });
  return router;
};
