const mongoose = require("mongoose");

const AsistenciaSchema = new mongoose.Schema({
  trabajador: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario", required: true },
  fecha: { type: String, required: true },
  entrada: Date,
  salida: Date,
  estado: { type: String, enum: ["asistio", "tardanza", "ausencia"], default: "asistio" },
  minutosTardanza: { type: Number, default: 0, min: 0 },
  pagoDiario: { type: Number, default: 0, min: 0 },
  observaciones: { type: String, default: "" },
  registradoPor: String
}, { timestamps: true });

AsistenciaSchema.index({ trabajador: 1, fecha: 1 }, { unique: true });
module.exports = mongoose.model("Asistencia", AsistenciaSchema);
