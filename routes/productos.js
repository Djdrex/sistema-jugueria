const express = require("express");

const router = express.Router();

const Producto = require("../models/Producto");

const {
  auth,
  soloAdmin
} = require("../middlewares/auth");

module.exports = (io) => {

  // CREAR PRODUCTO
  router.post("/", auth, soloAdmin, async (req, res) => {

    const p = await Producto.create(req.body);

    io.emit("actualizar");

    res.json(p);
  });

  // LISTAR PRODUCTOS
  router.get("/", async (req, res) => {

    res.json(await Producto.find());

  });

  // ELIMINAR PRODUCTO
  router.delete("/:id", auth, soloAdmin, async (req, res) => {

    await Producto.findByIdAndDelete(req.params.id);

    io.emit("actualizar");

    res.json({ ok: true });

  });

  // MODIFICAR STOCK
  router.put("/:id/stock", auth, soloAdmin, async (req, res) => {

    const { cambio } = req.body;

    const p = await Producto.findById(req.params.id);

    if (!p) {
      return res.sendStatus(404);
    }

    if (p.stock + cambio < 0) {

      return res.json({
        error: "Stock no puede ser negativo"
      });

    }

    p.stock = Math.max(0, p.stock + cambio);

    await p.save();

    io.emit("actualizar");

    res.json({ ok: true });

  });

  return router;

};