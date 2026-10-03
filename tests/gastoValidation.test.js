const test = require("node:test");
const assert = require("node:assert/strict");
const { fechaValida, validarGasto } = require("../services/gastoValidation");

test("expense validation normalizes a valid expense record", () => {
  const result = validarGasto({ tipo:"gasto", categoria:"  Servicios ", descripcion:" Luz ", monto:12.5, metodoPago:"transferencia", fecha:"2026-10-03", proveedor:" Luz SA " });
  assert.deepEqual(result.value, {
    tipo:"gasto", categoria:"Servicios", descripcion:"Luz", monto:12.5,
    metodoPago:"transferencia", fecha:"2026-10-03", proveedor:"Luz SA"
  });
});

test("expense validation rejects invalid amounts, dates and methods", () => {
  assert.match(validarGasto({ tipo:"gasto", categoria:"Otros", descripcion:"Compra", monto:1.005 }).error, /importe/);
  assert.equal(fechaValida("2026-02-30"), false);
  assert.match(validarGasto({ tipo:"gasto", categoria:"Otros", descripcion:"Compra", monto:1, metodoPago:"crypto" }).error, /Método/);
});
