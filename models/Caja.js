const mongoose = require("mongoose");

const CajaSchema = new mongoose.Schema({

  fecha: {
    type: Date,
    default: Date.now
  },

  totalVentas: Number,

  cantidadPedidos: Number,

  cerradoPor: String

});

module.exports = mongoose.model("Caja", CajaSchema);