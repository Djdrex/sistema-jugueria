const { toCents } = require("./money");

const METODOS = ["efectivo", "yape", "transferencia", "tarjeta", "otro"];
const fechaValida = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;

function validarGasto(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) input = {};
  const { tipo, categoria, descripcion, monto, fecha, proveedor } = input;
  const metodoPago = input.metodoPago || "efectivo";
  if (!["gasto", "compra"].includes(tipo)) return { error: "Selecciona gasto o compra" };
  if (typeof categoria !== "string" || !categoria.trim() || categoria.trim().length > 80) return { error: "La categoría es obligatoria (máximo 80 caracteres)" };
  if (typeof descripcion !== "string" || !descripcion.trim() || descripcion.trim().length > 300) return { error: "La descripción es obligatoria (máximo 300 caracteres)" };
  if (toCents(monto) === null || monto <= 0) return { error: "El importe debe ser positivo y tener hasta dos decimales" };
  if (!METODOS.includes(metodoPago)) return { error: "Método de pago inválido" };
  if (fecha && !fechaValida(fecha)) return { error: "Fecha inválida" };
  if (proveedor !== undefined && (typeof proveedor !== "string" || proveedor.length > 160)) return { error: "Proveedor inválido" };
  return {
    value: {
      tipo,
      categoria: categoria.trim(),
      descripcion: descripcion.trim(),
      monto: toCents(monto) / 100,
      metodoPago,
      fecha: fecha || null,
      proveedor: proveedor?.trim() || ""
    }
  };
}

module.exports = { fechaValida, validarGasto };
