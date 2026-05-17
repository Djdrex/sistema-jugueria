const mongoose = require("mongoose");

const ActividadSchema = new mongoose.Schema({

  usuario:String,

  accion:String,

  detalle:String,

  fecha:{
    type:Date,
    default:Date.now
  }

});

module.exports = mongoose.model(
  "Actividad",
  ActividadSchema
);