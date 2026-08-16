const express = require("express");

const router = express.Router();

const Notificacion = require("../models/Notificacion");

const {
  auth
} = require("../middlewares/auth");

module.exports = (io) => {

  // OBTENER
  router.get("/", auth, async (req, res) => {

    const data = await Notificacion.find({
      $or: [
        { rol: req.user.rol },
        { usuario: req.user.username }
      ]
    })
      .sort({ _id: -1 })
      .limit(20);

    res.json(data);

  });

  // MARCAR LEÍDO
  router.put("/leido", auth, async (req, res) => {

    await Notificacion.updateMany({
      $or: [
        { rol: req.user.rol },
        { usuario: req.user.username }
      ]
    }, {
      leido: true
    });

    res.json({ ok: true });

  });

  // ELIMINAR UNA
  router.delete("/:id", auth, async (req, res) => {

    const notificacion = await Notificacion.findById(req.params.id);

    if (!notificacion) return res.sendStatus(404);

    const corresponde = notificacion.rol === req.user.rol || notificacion.usuario === req.user.username;
    if (!corresponde && req.user.rol !== "admin") {
      return res.status(403).json({ error: "No puedes eliminar esta notificación" });
    }

    await notificacion.deleteOne();

    io.emit("actualizar");

    res.json({ ok: true });

  });

  // LIMPIAR TODAS
  router.delete("/", auth, async (req, res) => {

    await Notificacion.deleteMany({
      $or: [
        { rol: req.user.rol },
        { usuario: req.user.username }
      ]
    });

    io.emit("actualizar");

    res.json({ ok: true });

  });

  return router;

};
