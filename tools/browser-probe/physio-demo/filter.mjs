/**
 * PostgREST-`or`-Ausdruck → Zeilenprädikat für die lokale Testpraxis.
 *
 * Ohne Auswertung las die Testpraxis `.or()` gar nicht: die Akte zeigte Termine
 * fremder Patienten, die Rechnung deren Sitzungen. `baueFixture` bettet diese
 * Funktion per `toString()` in den Browser-Fixture ein, deshalb keine Importe
 * und kein Zugriff auf den umgebenden Modulbereich.
 *
 * @param {string} ausdruck  z. B. `lead_id.eq.1,and(lead_id.is.null,customer_phone.eq."+49 1")`
 * @param {(zeile:object, spalte:string, op:string, wert:unknown)=>boolean} vergleiche
 * @returns {((zeile:object)=>boolean)|null} `null` bei unbekannter Syntax
 */
export function oderPraedikat(ausdruck, vergleiche) {
  const teile = (text) => {
    const stuecke = [];
    let tiefe = 0, inText = false, start = 0;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"' && text[i - 1] !== '\\') inText = !inText;
      else if (!inText && c === '(') tiefe++;
      else if (!inText && c === ')') tiefe--;
      else if (!inText && tiefe === 0 && c === ',') { stuecke.push(text.slice(start, i)); start = i + 1; }
    }
    if (inText || tiefe !== 0) return null;
    stuecke.push(text.slice(start));
    return stuecke;
  };
  const wert = (roh) => {
    if (/^".*"$/s.test(roh)) return roh.slice(1, -1).replace(/\\(.)/gs, '$1');
    return roh === 'null' ? null : roh === 'true' ? true : roh === 'false' ? false : roh;
  };
  const knoten = (text) => {
    const logik = /^(not\.)?(and|or)\((.*)\)$/s.exec(text);
    if (logik) {
      const kinder = teile(logik[3])?.map(knoten);
      if (!kinder || kinder.includes(null)) return null;
      const passt = logik[2] === 'and' ? (r) => kinder.every((k) => k(r)) : (r) => kinder.some((k) => k(r));
      return logik[1] ? (r) => !passt(r) : passt;
    }
    const feld = /^([^.,()]+)\.(not\.)?(eq|neq|gt|gte|lt|lte|like|ilike|is|in)\.(.*)$/s.exec(text);
    if (!feld) return null;
    const [, spalte, nicht, op, roh] = feld;
    let vergleichswert = wert(roh);
    if (op === 'in') {
      if (!/^\(.*\)$/s.test(roh)) return null;
      vergleichswert = teile(roh.slice(1, -1))?.map(wert);
      if (!vergleichswert) return null;
    }
    if (op === 'like' || op === 'ilike') vergleichswert = String(vergleichswert).replaceAll('*', '%');
    return (r) => (nicht ? !vergleiche(r, spalte, op, vergleichswert) : vergleiche(r, spalte, op, vergleichswert));
  };
  const wurzel = teile(String(ausdruck ?? ''))?.map(knoten);
  return wurzel && !wurzel.includes(null) ? (r) => wurzel.some((k) => k(r)) : null;
}
