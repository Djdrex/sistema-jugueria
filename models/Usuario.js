const mongoose = require("mongoose");

const UsuarioSchema = new mongoose.Schema({
  username: String,
  password: String,
  rol: String,
  activo: { type: Boolean, default: true },
  pagoDiario: { type: Number, default: 0, min: 0 },
  estadoLaboral: { type: String, enum: ["desconectado", "activo", "descanso", "servicios_higienicos", "almuerzo", "reunion", "otro"], default: "desconectado" },
  ultimaConexion: Date,
  ultimaDesconexion: Date,
  horario: { dias: { type: [Number], default: [] }, horaEntrada: { type: String, default: "" }, horaSalida: { type: String, default: "" } }
});

module.exports = mongoose.model("Usuario", UsuarioSchema);
