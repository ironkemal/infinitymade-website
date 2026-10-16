/** Optional open bounds; compare strict time-of-day values, never lexically. */
export function wartelisteZeitfensterGueltig(von, bis) {
  function seconds(value) {
    if (value == null || value === '') return null;
    if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)) return NaN;
    const [h, m, s = '0'] = value.split(':');
    return Number(h) * 3600 + Number(m) * 60 + Number(s);
  }
  const start = seconds(von), end = seconds(bis);
  return !Number.isNaN(start) && !Number.isNaN(end) && (start === null || end === null || start < end);
}
