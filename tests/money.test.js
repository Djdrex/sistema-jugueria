const test = require("node:test");
const assert = require("node:assert/strict");
const { toCents, sumCents } = require("../services/money");

test("toCents validates and converts currency values", () => {
  assert.equal(toCents(19.9), 1990);
  assert.equal(toCents(0), 0);
  assert.equal(toCents(-0.01), null);
  assert.equal(toCents("2.50"), null);
  assert.equal(toCents(2.501), null);
});

test("sumCents adds decimal prices without floating point drift", () => {
  assert.equal(sumCents([0.1, 0.2, 1.05]), 135);
  assert.equal(sumCents([]), 0);
  assert.equal(sumCents([1, Number.NaN]), null);
});
