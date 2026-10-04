const mongoose = require("mongoose");
const DocumentoSchema = new mongoose.Schema({
  tipo: { type: String, enum: ["boleta", "factura", "recibo", "compra", "servicio", "yape", "gasto", "pago", "otro"], required: true },
  serie: String,
  numero: String,
  fecha: { type: Date, required: true },
  proveedor: String,
  ruc: String,
  categoria: String,
  concepto: String,
  monto: { type: Number, min: 0 },
  igv: { type: Number, min: 0 },
  metodoPago: String,
  observaciones: String,
  archivo: {
    datos: { type: Buffer, select: false },
    nombre: String,
    tipoMime: String,
    tamano: Number
  },
  origen: { type: String, enum: ["historial", "gasto", "pago_personal"], default: "historial" },
  referencia: mongoose.Schema.Types.ObjectId,
  gasto: { type: mongoose.Schema.Types.ObjectId, ref: "Gasto" },
  registradoPor: String
}, { timestamps: true });
DocumentoSchema.index({ fecha: -1, tipo: 1, proveedor: 1, numero: 1 });
module.exports = mongoose.model("Documento", DocumentoSchema);
