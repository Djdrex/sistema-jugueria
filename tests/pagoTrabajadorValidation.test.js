const test = require("node:test");
const assert = require("node:assert/strict");
const { validarPagoTrabajador } = require("../services/pagoTrabajadorValidation");

test("validates and normalizes an internal staff payment", () => {
  const result = validarPagoTrabajador({ trabajador:"507f1f77bcf86cd799439011", monto:125.5, metodoPago:"yape", fecha:"2026-10-03", nota:" Adelanto " });
  assert.deepEqual(result.value, { trabajador:"507f1f77bcf86cd799439011", monto:125.5, metodoPago:"yape", fecha:"2026-10-03", nota:"Adelanto" });
});

test("rejects invalid worker identifiers, amounts and overlong notes", () => {
  assert.match(validarPagoTrabajador({ trabajador:"x", monto:10 }).error, /trabajador/);
  assert.match(validarPagoTrabajador({ trabajador:"507f1f77bcf86cd799439011", monto:10.999 }).error, /importe/);
  assert.match(validarPagoTrabajador({ trabajador:"507f1f77bcf86cd799439011", monto:10, nota:"x".repeat(501) }).error, /observación/);
});
