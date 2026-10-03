const express = require("express");

const router = express.Router();

const Notificacion = require("../models/Notificacion");

const {
  auth
} = require("../middlewares/auth");

module.exports = (io) => {

  // OBTENER
  router.get("/", auth, async (req, res) => {
    const { leido, tipo, desde, hasta } = req.query;
    const filtro = { $or: [{ rol: req.user.rol }, { usuario: req.user.username }] };
    if (leido === "true") filtro.leido = true;
    else if (leido === "false") filtro.leido = false;
    if (tipo) filtro.mensaje = { $regex: String(tipo).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    if (Boolean(desde) !== Boolean(hasta)) return res.status(400).json({ error: "Indica ambas fechas" });
    if (desde && hasta) {
      const valid = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T12:00:00Z`).toISOString().slice(0,10) === value;
      if (!valid(desde) || !valid(hasta) || desde > hasta) return res.status(400).json({ error: "Rango de fechas inválido" });
      filtro.fecha = { $gte: new Date(`${desde}T00:00:00-05:00`), $lt: new Date(new Date(`${hasta}T00:00:00-05:00`).getTime() + 86400000) };
    }
    const data = await Notificacion.find({
      ...filtro
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

  router.put("/:id/leido", auth, async (req, res) => {
    const result = await Notificacion.updateOne({ _id: req.params.id, $or: [{ rol: req.user.rol }, { usuario: req.user.username }] }, { $set: { leido: true } });
    if (!result.matchedCount) return res.sendStatus(404);
    return res.json({ ok: true });
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
