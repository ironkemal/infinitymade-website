// ZAA-Rueckmeldung verarbeiten — eigenstaendiges Modul (testbar ohne service-role-Client,
// siehe verworfen.js). Die Route reicht Auth/Owner-Pruefung durch und ruft nur diese
// Funktion; sie liefert { status, body } fuer res.status(status).json(body).
//
// ⛔ Guard VOR jeder Mutation: nur eine strukturell gueltige Fehlerliste mit mindestens
// einem Fehler wird verarbeitet. Leere, unbekannte oder kaputte Rueckmeldungen aendern
// NICHTS. Eine fehlerfreie Datei beweist keine DAS-Annahme — eine authentische Quittung
// gibt es im DAS-Kanal noch nicht (M1.16b offen); es wird nie 'accepted'/'akzeptiert' erfunden.
// Fehlerbestand + Header + Verordnungs-/Zeilenstatus laufen atomar in der RPC
// `zaa_fehler_anwenden` (Migration 0061), gebunden an die gelesene Header-Version.
import { parseZaaFile } from './parser.js';

// „Uebersetzung" nur, wenn sie dem Anwender etwas Neues sagt: ist sie identisch mit dem Dateitext (z. B. gleiche
// Woerterbuch-Formulierung), bleibt sie leer und die Oberflaeche zeigt den Text nicht doppelt (Live-QA 3. Lauf, C-3).
function istEchteUebersetzung(e) {
  const u = String(e?.uebersetzung || '').trim();
  return u !== '' && u.toLowerCase() !== String(e?.text || '').trim().toLowerCase();
}

export async function zaaRueckmeldungAnwenden({ db, tenantId, abrechnungId, ab, buf, filename, abgesetztStatus, heute }) {
  const { data: rxRows } = await db
    .from('prescriptions')
    .select('id, belegnummer')
    .eq('abrechnung_id', abrechnungId);
  // Zuordnung ueber die eingefrorene `belegnummer`; UUID-Anfang als zweiter Schluessel
  // fuer Dateien aus der Zeit vor <Patientennummer>-<Verordnungsnummer>.
  const belegToRxId = new Map();
  for (const r of (rxRows || [])) {
    if (r.belegnummer) belegToRxId.set(r.belegnummer, r.id);
    belegToRxId.set(r.id.slice(0, 10), r.id);
  }

  const parsed = parseZaaFile(buf);
  if (!parsed.valid || !Array.isArray(parsed.errors) || parsed.errors.length === 0) {
    const grund = parsed.reason === 'empty' ? 'leer'
      : parsed.reason === 'invalid' ? 'strukturell ungültig' : 'nicht erkennbar';
    return { status: 422, body: {
      error: `ZAA-Datei ${grund}: Die Rückmeldung wurde nicht verarbeitet, es wurde nichts verändert.`,
      reason: parsed.reason || 'unknown',
      unveraendert: true,
    } };
  }

  let nichtZugeordnet = 0;
  const fehler = parsed.errors.map(e => {
    const rxId = e.belegnummer ? (belegToRxId.get(e.belegnummer) || null) : null;
    if (e.belegnummer && !rxId) nichtZugeordnet++;
    return {
      prescription_id: rxId,
      fehler_code:     e.code,
      fehler_text:     e.text || null,
      uebersetzung:    istEchteUebersetzung(e) ? e.uebersetzung : null,
      loesung_hint:    e.loesung || null,
    };
  });

  // ⛔ EINE Regel fuer beide Zweige: 'abgesetzt' mit Grund und Datum an der Verordnung.
  // Kein stiller Ruecksprung (Doppelabrechnung, Anlage 1 TP5 V21 Kap. 7.4.3 — Korrektur
  // gegen Kuerzung immer mit VKZ 4). 'abgesetzt' statt 'teilabsetzung': die ZAA nennt
  // Fehler je Beleg, keine Betraege. Absetzungsbetrag kommt von Hand (Phase 4).
  const vordGrund = new Map();
  for (const e of parsed.errors) {
    if (!e.belegnummer) continue;
    const vId = belegToRxId.get(e.belegnummer);
    if (!vId) continue;
    const txt = [e.code, e.uebersetzung || e.text].filter(Boolean).join(' — ');
    vordGrund.set(vId, [...(vordGrund.get(vId) || []), txt]);
  }
  const gruende = [...vordGrund].map(([vId, g]) => ({ prescription_id: vId, grund: g.join('\n') }));

  const { data: anw, error: anwErr } = await db.rpc('zaa_fehler_anwenden', {
    p_owner: tenantId,
    p_abrechnung: abrechnungId,
    p_expected_updated_at: ab.updated_at,
    p_fehler: fehler,
    p_gruende: gruende,
    p_vord_status: abgesetztStatus,
    p_datum: heute,
  });
  if (anwErr) {
    console.error('[abrechnung/upload-zaa] zaa_fehler_anwenden', anwErr);
    return { status: 500, body: { error: 'ZAA-Rückmeldung konnte nicht gespeichert werden.' } };
  }
  if (!anw || anw.konflikt) {
    return { status: 409, body: {
      error: 'Die Abrechnung wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren und die ZAA-Datei erneut hochladen.',
      unveraendert: true,
    } };
  }
  return { status: 200, body: {
    ok: true,
    format: parsed.format,
    errorCount: fehler.length,
    status: 'rejected',
    errors: parsed.errors.map(e => ({ ...e, uebersetzung: istEchteUebersetzung(e) ? e.uebersetzung : null })),
    verordnungenAbgesetzt: vordGrund.size,
    nichtZugeordnet,
    zeilenAktualisiert: anw.zeilen || 0,
    filename: filename || null,
  } };
}
