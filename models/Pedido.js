const mongoose = require("mongoose");

const PedidoSchema = new mongoose.Schema({

  mesa: String,

  estado: {
    type: String,
    default: "en_espera"
  },

  creadoPor: String,

  total: Number,

  totalPagado: {
    type: Number,
    default: 0
  },

  pagado: {
    type: Boolean,
    default: false
  },

  pagos: [
    {
      monto: Number,
      metodo: String,
      recibido: Number,
      vuelto: Number,
      mesero: String,
      fecha: {
        type: Date,
        default: Date.now
      }
    }
  ],

  items: [
    {
      producto: String,
      precio: Number,

      pagado: {
        type: Boolean,
        default: false
      },

      azucar: Boolean,
      helado: Boolean,
      nota: String
    }
  ],

  fecha: {
    type: Date,
    default: Date.now
  }

});

module.exports = mongoose.model("Pedido", PedidoSchema);