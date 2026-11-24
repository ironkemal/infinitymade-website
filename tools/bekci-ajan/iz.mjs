// tools/bekci-ajan/iz.mjs
// Ne: Bekçi-Ajan deterministik parmak izi (ek.iz) üretici saf fonksiyonu.
// Niye: SPEC.md §3.0d uyarınca açık vakaların tekilleştirilmesi için deterministik girdiden
// (anahtarları sıralı kararlı JSON ve sha256 ilk 16 hanesi) parmak izi üretir.

import { createHash } from 'node:crypto';

/**
 * Nesne anahtarlarını deterministik olarak alfabetik sırayla JSON dizgisine dönüştürür.
 * @param {any} val
 * @returns {string|undefined}
 */
export function kararlıStringify(val) {
  if (val === undefined) {
    return undefined;
  }
  if (val === null || typeof val !== 'object') {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return '[' + val.map(v => (v === undefined ? 'null' : kararlıStringify(v))).join(',') + ']';
  }
  const keys = Object.keys(val).sort();
  const pairs = [];
  for (const k of keys) {
    const v = val[k];
    if (v !== undefined && typeof v !== 'function' && typeof v !== 'symbol') {
      pairs.push(`${JSON.stringify(k)}:${kararlıStringify(v)}`);
    }
  }
  return '{' + pairs.join(',') + '}';
}

/**
 * Kararlı JSON + sha256 hex'in ilk 16 hanesini döner.
 * @param {any} deger
 * @returns {string}
 */
export function iz(deger) {
  const jsonStr = typeof deger === 'string' ? deger : kararlıStringify(deger);
  return createHash('sha256').update(jsonStr, 'utf-8').digest('hex').slice(0, 16);
}
