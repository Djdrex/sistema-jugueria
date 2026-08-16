const mongoose = require("mongoose");

const UsuarioSchema = new mongoose.Schema({
  username: String,
  password: String,
  rol: String,
  activo: { type: Boolean, default: true },
  pagoDiario: { type: Number, default: 0, min: 0 }
});

module.exports = mongoose.model("Usuario", UsuarioSchema);
