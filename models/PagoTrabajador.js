const mongoose = require("mongoose");
const PagoTrabajadorSchema = new mongoose.Schema({
  trabajador: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario", required: true },
  asistencia: { type: mongoose.Schema.Types.ObjectId, ref: "Asistencia" },
  monto: { type: Number, required: true, min: 0.01 },
  fecha: { type: Date, default: Date.now },
  nota: { type: String, default: "" },
  registradoPor: String
}, { timestamps: true });
PagoTrabajadorSchema.index({ trabajador: 1, fecha: -1 });
module.exports = mongoose.model("PagoTrabajador", PagoTrabajadorSchema);
