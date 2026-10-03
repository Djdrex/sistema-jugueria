const mongoose = require("mongoose");

const MovimientoInventarioSchema = new mongoose.Schema({
  producto: { type: mongoose.Schema.Types.ObjectId, ref: "Producto", required: true },
  nombreProducto: { type: String, required: true },
  cambio: { type: Number, required: true },
  saldo: { type: Number, required: true, min: 0 },
  tipo: { type: String, enum: ["entrada", "salida", "ajuste"], required: true },
  motivo: { type: String, trim: true, maxlength: 300, default: "" },
  usuario: { type: String, required: true },
  fecha: { type: Date, default: Date.now }
});

MovimientoInventarioSchema.index({ producto: 1, fecha: -1 });
module.exports = mongoose.model("MovimientoInventario", MovimientoInventarioSchema);
