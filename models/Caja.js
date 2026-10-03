const mongoose = require("mongoose");

const CajaSchema = new mongoose.Schema({

  fecha: {
    type: Date,
    default: Date.now
  },

  fechaOperativa: { type: String },

  totalVentas: Number,

  cantidadPedidos: Number,

  cerradoPor: String

});

CajaSchema.index({ fechaOperativa: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Caja", CajaSchema);
