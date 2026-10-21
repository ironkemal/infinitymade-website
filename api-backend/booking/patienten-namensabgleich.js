/** Literaler, weiterhin groß-/kleinschreibungsunabhängiger Identitätsabgleich. */
export function patientenNameMuster(value) {
  // PostgREST interpretiert auch '*' als LIKE-Platzhalter. Diese Schreibweise
  // wird ausdrücklich abgewiesen, statt sie in einen anderen Namen umzudeuten.
  if (typeof value !== 'string' || !value.trim() || value.includes('*')) return null;
  return value.trim().replace(/[\\%_]/g, zeichen => '\\' + zeichen);
}
