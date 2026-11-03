/** Beschreibung und vorhandene Ausstattung eines Praxisraums. */
export const BESCHREIBUNG_MAX = 2000;
export const AUSSTATTUNG_MAX = 30;
export const AUSSTATTUNG_NAME_MAX = 80;

export function raumDetails(beschreibung = '', ausstattung = []) {
  if (typeof beschreibung !== 'string' || [...beschreibung].length > BESCHREIBUNG_MAX) throw new Error('Beschreibung darf höchstens 2000 Zeichen enthalten.');
  if (!Array.isArray(ausstattung) || ausstattung.length > AUSSTATTUNG_MAX) throw new Error('Höchstens 30 Ausstattungspunkte möglich.');
  const liste = ausstattung.map(text => {
    if (typeof text !== 'string') throw new Error('Ausstattung muss aus Text bestehen.');
    const wert = text.trim();
    if (!wert || [...wert].length > AUSSTATTUNG_NAME_MAX) throw new Error('Ausstattungspunkte brauchen 1 bis 80 Zeichen.');
    return wert;
  });
  if (new Set(liste).size !== liste.length) throw new Error('Ausstattungspunkte dürfen nicht doppelt vorkommen.');
  return { beschreibung: beschreibung.trim(), ausstattung: liste };
}
