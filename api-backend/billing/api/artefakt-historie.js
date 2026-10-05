// Versionshistorie + geschuetzter Download der Abrechnungsdateien (M1.16, Registry 0060).
// Reines Lesen: keine Mutation, keine Loeschung. Pfade verlassen den Server nie —
// die Oberflaeche kennt nur Registry-IDs; der Download prueft Owner, Abrechnung,
// Lebenszyklus und (soweit vorhanden) den gespeicherten SHA-256.
import { createHash } from 'node:crypto';

const SPALTEN = 'id,role,kind,state,sha256,legacy,created_at,published_at,retired_at,storage_path';
const HEADER_PFADE = ['storage_path', 'auftragsdatei_path', 'begleitzettel_path', 'signed_storage_path', 'encrypted_storage_path'];
const ROLLEN_TEXT = { dta: 'DTA (unsigniert)', auftrag: 'Auftragsdatei', begleit: 'Begleitzettel', signed: 'Signierte Datei', encrypted: 'Verschlüsselte Datei' };
const SIEBEN_TAGE_MS = 7 * 24 * 3600 * 1000;

/** Lokaler Download-Name je Rolle — unterscheidbar und verstaendlich (Live-QA C-2). */
export function dateinameFuer(role, dateiname) {
  const basis = String(dateiname || 'abrechnung').replace(/[^A-Za-z0-9._-]/g, '_') || 'abrechnung';
  switch (role) {
    case 'dta':       return `${basis}.dta`;
    case 'auftrag':   return `${basis}.auf`;
    case 'begleit':   return `Begleitzettel_${basis}.html`;
    case 'signed':    return `${basis}.p7m`;
    // SECON § 3.2.3.1: die verschluesselte Nutzdatei traegt keine Dateiendung — der physische Name ist `dateiname`.
    case 'encrypted': return basis;
    default:          return basis;
  }
}

function fehler(status, code, message) {
  const e = new Error(message);
  e.status = status; e.statusCode = status; e.code = code;
  return e;
}

async function ladeHeader(db, ownerId, abrechnungId) {
  const { data, error } = await db.from('abrechnung')
    .select('id,owner_id,status,dateiname,created_at,' + HEADER_PFADE.join(','))
    .eq('id', abrechnungId).maybeSingle();
  if (error || !data) throw fehler(404, 'ABRECHNUNG_NICHT_GEFUNDEN', 'Abrechnung nicht gefunden');
  if (data.owner_id !== ownerId) throw fehler(403, 'FORBIDDEN', 'Forbidden');
  return data;
}

export async function listeArtefaktVersionen({ db, ownerId, abrechnungId, jetzt = new Date() }) {
  const hdr = await ladeHeader(db, ownerId, abrechnungId);
  const { data, error } = await db.from('abrechnung_artefakt_version')
    .select(SPALTEN)
    .eq('owner_id', ownerId).eq('abrechnung_id', abrechnungId)
    .order('created_at', { ascending: true }).order('id', { ascending: true });
  if (error || !Array.isArray(data)) throw fehler(500, 'ARTEFAKT_LISTE_FEHLER', 'Dateiversionen konnten nicht geladen werden.');
  const aktuell = new Set(HEADER_PFADE.map(k => hdr[k]).filter(Boolean));
  const eingereicht = ['gesendet', 'accepted', 'rejected', 'paid'].includes(hdr.status);
  return {
    abrechnungId,
    eingereicht,
    versionen: data.map(r => {
      const alterMs = jetzt - new Date(r.created_at);
      const signiert = r.role === 'signed';
      return {
        id: r.id,
        rolle: r.role,
        bezeichnung: ROLLEN_TEXT[r.role] || r.role,
        dateiname: dateinameFuer(r.role, hdr.dateiname),
        status: r.state,
        aktuell: aktuell.has(r.storage_path),
        erstelltAm: r.created_at,
        veroeffentlichtAm: r.published_at,
        ausgemustertAm: r.retired_at,
        // Pruefstatus: nur was tatsaechlich erfasst ist
        pruefung: r.sha256 ? 'SHA-256 erfasst' : (r.legacy ? 'Bestandsdatei ohne Hash' : 'ohne Hash'),
        herunterladbar: r.state === 'published' || r.state === 'retire_pending',
        // Signaturen: 8 Jahre erst ab dokumentierter Einreichung; ohne Einreichung Wiedervorlage nach 7 Tagen.
        aufbewahrung: signiert
          ? (eingereicht ? 'Aufbewahrung: 8 Jahre ab Einreichung' : 'Noch nicht eingereicht')
          : null,
        wiedervorlage: signiert && !eingereicht && alterMs > SIEBEN_TAGE_MS,
      };
    }),
  };
}

export async function ladeArtefaktVersion({ db, ownerId, abrechnungId, versionId }) {
  const hdr = await ladeHeader(db, ownerId, abrechnungId);
  const { data: reg, error } = await db.from('abrechnung_artefakt_version')
    .select(SPALTEN)
    .eq('id', versionId).eq('owner_id', ownerId).eq('abrechnung_id', abrechnungId)
    .maybeSingle();
  if (error || !reg) throw fehler(404, 'VERSION_NICHT_GEFUNDEN', 'Dateiversion nicht gefunden');
  if (reg.state !== 'published' && reg.state !== 'retire_pending') {
    throw fehler(409, 'VERSION_NICHT_VERFUEGBAR', 'Diese Dateiversion ist nicht verfügbar.');
  }
  if (!String(reg.storage_path).startsWith(ownerId + '/')) {
    throw fehler(403, 'FORBIDDEN', 'Forbidden');
  }
  const dl = await db.storage.from('abrechnungen').download(reg.storage_path);
  if (!dl || dl.error || !dl.data) throw fehler(500, 'DOWNLOAD_FEHLGESCHLAGEN', 'Datei konnte nicht geladen werden.');
  const bytes = Buffer.from(await dl.data.arrayBuffer());
  if (reg.sha256 && createHash('sha256').update(bytes).digest('hex') !== reg.sha256) {
    throw fehler(500, 'HASH_ABWEICHUNG', 'Die gespeicherte Datei stimmt nicht mehr mit ihrem Prüfwert überein. Bitte nicht verwenden.');
  }
  return {
    bytes,
    role: reg.role,
    dateiname: dateinameFuer(reg.role, hdr.dateiname),
    contentType: reg.role === 'begleit' ? 'text/html; charset=utf-8' : 'application/octet-stream',
  };
}
