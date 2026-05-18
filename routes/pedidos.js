const express = require("express");

const router = express.Router();

const Pedido = require("../models/Pedido");
const Producto = require("../models/Producto");
const Notificacion = require("../models/Notificacion");

const {
  auth,
  soloAdmin,
  soloBarra,
  soloMesero
} = require("../middlewares/auth");

module.exports = (io) => {

  // LISTAR PEDIDOS
  router.get("/", async (req, res) => {

    res.json(await Pedido.find());

  });

  // CAMBIAR ESTADO
  router.put("/:id", auth, soloBarra, async (req, res) => {

    const { estado } = req.body;

    await Pedido.findByIdAndUpdate(
      req.params.id,
      { estado }
    );

    io.emit("actualizar");

    res.json({ ok: true });

  });

  // ELIMINAR PEDIDO
  router.delete("/:id", auth, soloAdmin, async (req, res) => {

    await Pedido.findByIdAndDelete(req.params.id);

    io.emit("actualizar");

    res.json({ ok: true });

  });

  // CREAR PEDIDO
  router.post("/", auth, soloMesero, async (req, res) => {

    let total = 0;

    req.body.items.forEach(i => {
      total += i.precio;
    });

    const conteo = {};

    req.body.items.forEach(i => {

      conteo[i.producto] =
        (conteo[i.producto] || 0) + 1;

    });

    for (let nombre in conteo) {

      const cantidad = conteo[nombre];

      const prod = await Producto.findOneAndUpdate(
        {
          nombre,
          stock: { $gte: cantidad }
        },
        {
          $inc: { stock: -cantidad }
        },
        {
          returnDocument: "after"
        }
      );

      if (!prod) {

        return res.status(400).json({
          error:
            "Stock insuficiente de " + nombre
        });

      }

      if (prod.stock <= 5) {

        await Notificacion.create({

          mensaje:
            "⚠️ Stock bajo: " +
            prod.nombre +
            " (" +
            prod.stock +
            ")",

          usuario: "sistema",

          rol: "admin",

          fecha: new Date()

        });

      }

    }

    const p = await Pedido.create({

      ...req.body,

      creadoPor: req.user.username,

      total,

      estado: "en_espera"

    });

    await Notificacion.create({

      mensaje:
        "Nuevo pedido en mesa " +
        req.body.mesa,

      usuario: req.user.username,

      rol: "barra",

      fecha: new Date()

    });

    io.emit("actualizar");

    res.json(p);

  });

  return router;

};