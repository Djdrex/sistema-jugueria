const { toCents } = require("./money");
const METODOS = ["efectivo", "yape", "transferencia", "tarjeta", "otro"];
const esId = value => typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
const fechaValida = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;

function validarPagoTrabajador(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) input = {};
  const metodoPago = input.metodoPago || "efectivo";
  if (!esId(input.trabajador)) return { error: "Selecciona un trabajador válido" };
  if (toCents(input.monto) === null || input.monto <= 0) return { error: "El importe debe ser positivo y tener hasta dos decimales" };
  if (!METODOS.includes(metodoPago)) return { error: "Método de pago inválido" };
  if (input.fecha && !fechaValida(input.fecha)) return { error: "Fecha inválida" };
  if (input.nota !== undefined && (typeof input.nota !== "string" || input.nota.length > 500)) return { error: "La observación no puede superar 500 caracteres" };
  return { value: {
    trabajador: input.trabajador,
    monto: toCents(input.monto) / 100,
    metodoPago,
    fecha: input.fecha || null,
    nota: (input.nota || "").trim()
  } };
}

module.exports = { esId, fechaValida, validarPagoTrabajador };
