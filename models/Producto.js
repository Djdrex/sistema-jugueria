const mongoose = require("mongoose");

const ProductoSchema = new mongoose.Schema({
  nombre: String,
  precio: Number,
  stock: Number,
  categoria: String,
  stockMinimo: { type: Number, min: 0, default: 5 },
  costo: { type: Number, min: 0 },
  unidad: { type: String, trim: true, maxlength: 30, default: "unidad" },
  activo: { type: Boolean, default: true },
  imagen: { type: String, maxlength: 1000 }
});

module.exports = mongoose.model("Producto", ProductoSchema);
