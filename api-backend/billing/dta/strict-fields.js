// TP5 V21 §5.5.3.3: EHE quantity ..4,2; money ..10,2.
// Numeric syntax is deliberately narrower than Number(): no whitespace-only,
// exponent notation, booleans, NaN or Infinity. Comma is opt-in for VKZ03.
export function isDtaDecimal(value, integerDigits, { positive = false, comma = false } = {}) {
  if (typeof value !== 'number' && typeof value !== 'string') return false;
  const s = String(value).trim();
  const pattern = comma ? /^\d+(?:[.,]\d{1,2})?$/ : /^\d+(?:\.\d{1,2})?$/;
  if (!pattern.test(s)) return false;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) && (positive ? n > 0 : n >= 0)
    && n < 10 ** integerDigits;
}

// GKV §290 Anlage 1, Stand 02.01.2023, examples C000500021/A000500015.
// A=01 .. Z=26; alternating weights 1/2; digit sums modulo 10.
export function hasKvnrChecksum(value) {
  if (typeof value !== 'string' || !/^[A-Z]\d{9}$/.test(value)) return false;
  const digits = String(value.charCodeAt(0) - 64).padStart(2, '0') + value.slice(1, 9);
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const product = Number(digits[i]) * (i % 2 ? 2 : 1);
    sum += product > 9 ? product - 9 : product;
  }
  return sum % 10 === Number(value[9]);
}
