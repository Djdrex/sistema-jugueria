const mongoose = require("mongoose");
const PagoTrabajadorSchema = new mongoose.Schema({
  trabajador: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario", required: true },
  asistencia: { type: mongoose.Schema.Types.ObjectId, ref: "Asistencia" },
  monto: { type: Number, required: true, min: 0.01 },
  metodoPago: { type: String, enum: ["efectivo", "yape", "transferencia", "tarjeta", "otro"], default: "efectivo" },
  fecha: { type: Date, default: Date.now },
  nota: { type: String, default: "" },
  registradoPor: String,
  autorizadoPor: String,
  requestId: { type: String, trim: true, maxlength: 100 }
}, { timestamps: true });
PagoTrabajadorSchema.index({ trabajador: 1, fecha: -1 });
PagoTrabajadorSchema.index({ registradoPor: 1, requestId: 1 }, { unique: true, partialFilterExpression: { requestId: { $type: "string" } } });
module.exports = mongoose.model("PagoTrabajador", PagoTrabajadorSchema);
