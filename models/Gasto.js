const mongoose = require("mongoose");
const GastoSchema = new mongoose.Schema({
  tipo: { type: String, enum: ["compra", "gasto"], required: true },
  categoria: { type: String, required: true, trim: true },
  descripcion: { type: String, required: true, trim: true },
  monto: { type: Number, required: true, min: 0.01 },
  metodoPago: { type: String, default: "efectivo" },
  fecha: { type: Date, default: Date.now },
  proveedor: String,
  cuentaId: { type: mongoose.Schema.Types.ObjectId },
  registradoPor: String,
  requestId: { type: String, trim: true, maxlength: 100 }
}, { timestamps: true });
GastoSchema.index({ fecha: -1, categoria: 1 });
GastoSchema.index({ registradoPor: 1, requestId: 1 }, { unique: true, partialFilterExpression: { requestId: { $type: "string" } } });
module.exports = mongoose.model("Gasto", GastoSchema);
