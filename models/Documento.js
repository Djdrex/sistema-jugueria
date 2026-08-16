const mongoose = require("mongoose");
const DocumentoSchema = new mongoose.Schema({
  tipo: { type: String, enum: ["boleta", "factura", "recibo", "compra", "servicio", "otro"], required: true },
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
  archivoUrl: String,
  gasto: { type: mongoose.Schema.Types.ObjectId, ref: "Gasto" },
  registradoPor: String
}, { timestamps: true });
DocumentoSchema.index({ fecha: -1, tipo: 1, proveedor: 1, numero: 1 });
module.exports = mongoose.model("Documento", DocumentoSchema);
