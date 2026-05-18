const mongoose = require("mongoose");

const UsuarioSchema = new mongoose.Schema({
  username: String,
  password: String,
  rol: String
});

module.exports = mongoose.model("Usuario", UsuarioSchema);