const mongoose = require("mongoose");

const CategoriaSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true, maxlength: 80, unique: true },
  descripcion: { type: String, trim: true, maxlength: 300, default: "" },
  activo: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("Categoria", CategoriaSchema);
