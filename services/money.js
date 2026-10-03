function toCents(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  const scaled = value * 100;
  const rounded = Math.round(scaled);
  if (!Number.isSafeInteger(rounded) || Math.abs(scaled - rounded) > 1e-7) return null;
  return rounded;
}

function sumCents(values) {
  if (!Array.isArray(values)) return null;
  let total = 0;
  for (const value of values) {
    const cents = toCents(value);
    if (cents === null) return null;
    total += cents;
    if (!Number.isSafeInteger(total)) return null;
  }
  return total;
}

module.exports = { toCents, sumCents };
