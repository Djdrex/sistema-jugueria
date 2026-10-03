const mongoose = require("mongoose");

const PedidoSchema = new mongoose.Schema({

  mesa: String,

  estado: {
    type: String,
    default: "en_espera"
  },

  creadoPor: String,

  // Client generated key reused if a request times out and is retried.
  requestId: { type: String, trim: true, maxlength: 100 },

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
      requestId: String,
      monto: { type: Number, min: 0.01, required: true },
      metodo: { type: String, enum: ["efectivo", "yape"], required: true },
      recibido: { type: Number, min: 0 },
      vuelto: { type: Number, min: 0 },
      mesero: { type: String, required: true },
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

PedidoSchema.index({ creadoPor: 1, requestId: 1 }, { unique: true, partialFilterExpression: { requestId: { $type: "string" } } });

module.exports = mongoose.model("Pedido", PedidoSchema);
