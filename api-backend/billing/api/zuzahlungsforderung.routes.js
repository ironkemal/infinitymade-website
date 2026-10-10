// § 302 SGB V — Zuzahlungsforderung (VKZ 03) Route
//
// Referenz: Anlage 1 TP5 V21 (15.01.2026, anwendbar ab 01.10.2025)
//   - Kap. 7.2 Grundsätze des Korrekturverfahrens
//   - Kap. 7.3 Rahmenbedingungen & URI-Segment
//   - Kap. 7.4.2 Zuzahlungsforderung (VKZ 03)
//     - 7.4.2.1 KZ2: Nicht gezahlt trotz Mahnung (§ 43c SGB V)
//     - 7.4.2.2 KZ1: Nachträgliche Befreiung
//     - 7.4.2.3 KZ5: Jahresübergang
//   - Kap. 5.5.2 / 5.5.3.3: GZF statt BES, GES-Berechnungsregeln für VKZ 03
//
// Schema & Frozen Intent (api-backend/db/migrations/0058_abrechnung_zuzahlungsforderung.sql):
//   header.zuzahlungsforderung_daten: {
//     grund: '1' | '2' | '5',
//     nachweisDatum: 'YYYY-MM-DD',
//     positionIndices: number[],
//     bestaetigt: true,
//     mahnungId?: string (UUID),
//     nachweisDokumentId?: string (positive bigint string),
//   }

import express from 'express';
import { ladeDtaOriginalbytes } from '../dta/signed-original.js';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { istZuzahlungBezahlt, saldoJeRezept } from '../zuzahlung/bezahlt.js';
import { parseOriginalDtaMessage } from '../dta/zuzahlungsforderung-ursprung.js';
import { berlinHeute, istStichtag } from '../../lib/berlin-tag.js';
import {
  ABRECHNUNG_VERSION_FELDER,
  aktualisiereArtefaktVersion,
  pruefeEntwurfsVersion,
  artefaktVersuchPfad,
} from './artefakt-version.js';
import { bereinigeUnveroeffentlichtenEntwurf } from './entwurf-bereinigung.js';
import { ladeAktivenZuBeleg, fremdeZuNummern } from '../zuzahlung/zu-beleg.js';

function sha256Hex(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

const CODE_TO_SECTOR = Object.freeze({
  '71': 'podologie',
  '72': 'podologie',
  '22': 'physiotherapy',
  '41': 'ergotherapie',
  '31': 'logopaedie',
});

const SECTOR_TO_CODE = Object.freeze({
  podologie: '71',
  podo: '71',
  physiotherapy: '22',
  physio: '22',
  ergotherapie: '41',
  ergo: '41',
  logopaedie: '31',
  logo: '31',
});

function matchesFrozenIntent(existingIntent, requestIntent) {
  if (!existingIntent || typeof existingIntent !== 'object') return false;
  if (!requestIntent || typeof requestIntent !== 'object') return false;

  if (existingIntent.grund !== requestIntent.grund) return false;
  if (existingIntent.nachweisDatum !== requestIntent.nachweisDatum) return false;
  if (JSON.stringify(existingIntent.positionIndices) !== JSON.stringify(requestIntent.positionIndices)) return false;
  if ((existingIntent.mahnungId || null) !== (requestIntent.mahnungId || null)) return false;
  if ((existingIntent.nachweisDokumentId || null) !== (requestIntent.nachweisDokumentId || null)) return false;

  const auditKeys = new Set(['geprueftAm', 'geprueftZeitpunkt', 'prueferId', 'patientId', 'kostentraegerIk']);
  const humanProof = proof => Object.fromEntries(Object.entries(proof || {}).filter(([key]) => !auditKeys.has(key)).sort(([a], [b]) => a.localeCompare(b)));
  if (!existingIntent.nachweisPruefung || !requestIntent.nachweisPruefung) return false;
  if (JSON.stringify(humanProof(existingIntent.nachweisPruefung)) !== JSON.stringify(humanProof(requestIntent.nachweisPruefung))) return false;

  return true;
}

function isSnapshotContentValid(snapZeile, sourceZeile, expectedClaimAmount, historicalSessions) {
  if (!snapZeile) return false;
  if (snapZeile.prescription_id !== sourceZeile.prescription_id) return false;
  if (snapZeile.owner_id !== sourceZeile.owner_id) return false;
  if ((snapZeile.business_id ?? null) !== (sourceZeile.business_id ?? null)) return false;
  if ((snapZeile.karten_ik ?? null) !== (sourceZeile.karten_ik ?? null)) return false;
  if ((snapZeile.kostentraeger_ik||'') !== (sourceZeile.kostentraeger_ik||'')) return false;
  if ((snapZeile.belegnummer||'') !== (sourceZeile.belegnummer||'')) return false;
  if ((snapZeile.versichertennummer||'') !== (sourceZeile.versichertennummer||'')) return false;
  if ((snapZeile.verordnungsdatum||'') !== (sourceZeile.verordnungsdatum||'')) return false;
  if ((snapZeile.patient_name||'') !== (sourceZeile.patient_name||'')) return false;

  if (!isDeepStrictEqual(snapZeile.leistungen || [], historicalSessions || [])) return false;

  const brutto = Number(snapZeile.brutto_eur);
  const netto = Number(snapZeile.netto_eur);
  const zuzahlung = Number(snapZeile.zuzahlung_eur);
  const expected = Number(expectedClaimAmount);
  if (!Number.isFinite(brutto) || !Number.isFinite(netto) || !Number.isFinite(zuzahlung) || !Number.isFinite(expected)) {
    return false;
  }
  const bruttoCents = Math.round(brutto * 100);
  const nettoCents = Math.round(netto * 100);
  const zuzahlungCents = Math.round(zuzahlung * 100);
  const expectedCents = Math.round(expected * 100);

  if (bruttoCents !== expectedCents) return false;
  if (nettoCents !== expectedCents) return false;
  if (zuzahlungCents !== 0) return false;
  return true;
}

/**
 * Factory zur Erstellung des Zuzahlungsforderungs-Routers mit injizierten Abhängigkeiten.
 *
 * @param {object} deps
 * @param {object} deps.supabase
 * @param {Function} deps.vergebeNummern
 * @param {Function} deps.speichereAuftragsdatei
 * @param {Function} deps.baueBegleitzettel
 * @param {Function} [deps.rechnungsartFuer]
 * @param {Function} deps.ladeBetriebsart
 * @param {Function} deps.ladeAnnahmestelle
 * @param {Function} [deps.annahmestelleFehlt]
 * @param {Function} deps.buildDtaFile
 * @param {Function} [deps.logAccess]
 * @param {Function} [deps.bereichFuerAbrechnung]
 * @param {Function} deps.isoWeek
 * @param {Function} deps.buildSammelRechnungsnummer
 * @returns {express.Router}
 */
export function createZuzahlungsforderungRouter(deps) {
  if (!deps || typeof deps.isoWeek !== 'function' || typeof deps.buildSammelRechnungsnummer !== 'function') {
    throw new Error('createZuzahlungsforderungRouter: isoWeek und buildSammelRechnungsnummer müssen als Funktionen injiziert werden.');
  }

  const {
    supabase,
    vergebeNummern,
    speichereAuftragsdatei,
    baueBegleitzettel,
    rechnungsartFuer,
    ladeBetriebsart,
    ladeAnnahmestelle,
    annahmestelleFehlt,
    buildDtaFile,
    logAccess,
    bereichFuerAbrechnung,
    isoWeek,
    buildSammelRechnungsnummer,
  } = deps;

  const router = express.Router();

  router.post('/abrechnung/zuzahlungsforderung', async (req, res) => {
    let claimAbrechnungId = null;
    let claimVersion = null;
    let ownAttemptDir = null;
    const uploadedPaths = [];
    let isPublished = false;
    let numbersPersisted = false;
    let datennummer = null;
    let transfernummer = null;
    let sammelRechnungsnummer = null;
    let tenantId = null;

    try {
      // 1. Authentifizierung (Fail-closed)

      const hdr = req.headers.authorization || '';
      const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
      if (!token) return res.status(401).json({ error: 'Anmeldetoken fehlt.' });

      const { data: u, error: uErr } = await supabase.auth.getUser(token);
      if (uErr || !u?.user) return res.status(401).json({ error: 'Anmeldetoken ist ungültig.' });

      const { data: profile, error: pErr } = await supabase
        .from('profiles')
        .select('id, role, owner_id, business_name, phone, city, zip, street, house_number, ik_number, sector')
        .eq('id', u.user.id)
        .maybeSingle();

      if (pErr || !profile) return res.status(403).json({ error: 'Praxisprofil nicht gefunden.' });

      // Strikte Rollenprüfung: Nur Inhaber
      if (profile.role !== 'owner') {
        return res.status(403).json({
          error: 'Zuzahlungsforderungen dürfen nur durch den Praxisinhaber erstellt werden.',
          code: 'NUR_INHABER',
        });
      }

      tenantId = profile.id;

      // 2. Eingabeprüfung
      const {
        zeileId,
        grund,
        reason,
        bestaetigt,
        erfolgloserEinzugBestaetigt,
        nachweisDatum,
        befreiungDatum,
        befreiungGueltigAb,
        positionIndices,
        selectedSessionIndices,
        mahnungId,
        dokumentReferenz,
        nachweisDokumentId,
        nachweisPruefung,
      } = req.body || {};

      if (!zeileId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(zeileId)) {
        return res.status(400).json({ error: 'zeileId (ID des Ursprungsbelegs) ist erforderlich und muss eine UUID sein.', code: 'INVALID_ZEILE_ID' });
      }



      // Grund normalisieren: Schema verlangt '1', '2' oder '5'
      const rawGrund = String(grund || reason || '').trim().toUpperCase();
      let canonicalGrund = null;
      if (rawGrund === 'KZ1' || rawGrund === '1' || rawGrund === 'BEFREIT') canonicalGrund = '1';
      else if (rawGrund === 'KZ2' || rawGrund === '2' || rawGrund === 'NICHT_GEZAHLT' || rawGrund === 'MAHNUNG') canonicalGrund = '2';
      else if (rawGrund === 'KZ5' || rawGrund === '5' || rawGrund === 'JAHRESWECHSEL') canonicalGrund = '5';
      else {
        return res.status(400).json({
          error: `Ungültiger Grund für Zuzahlungsforderung: "${grund || reason}". Zulässig sind 1 (nachträgliche Befreiung), 2 (Zahlungsverweigerung trotz Mahnung) oder 5 (Jahresübergang).`,
          code: 'INVALID_REASON',
        });
      }

      // Bestätigung prüfen: Strikt true, keine Truthiness
      const isConfirmed = (bestaetigt === true) || (erfolgloserEinzugBestaetigt === true);
      if (isConfirmed !== true) {
        return res.status(422).json({
          error: 'Die Bestätigung (bestaetigt: true) ist als strikter Boolean erforderlich.',
          code: 'CONFIRMATION_REQUIRED',
        });
      }

      // 3. Ursprungszeile und Abrechnungskopf mandantensicher laden
      const { data: sourceZeile, error: zeileErr } = await supabase
        .from('abrechnung_zeile')
        .select(`
          id, owner_id, business_id, abrechnung_id, prescription_id,
          belegnummer, versichertennummer, kostentraeger_ik, karten_ik, leistungen,
          brutto_eur, zuzahlung_eur, netto_eur, status,
          patient_name, verordnungsdatum, therapie_bereich,
          herkunft, sort_order,
          abrechnung:abrechnung_id (
            id, owner_id, business_id, rechnungsnummer,
            empfaenger_ik, kostentraeger_ik,
            verarbeitungskennzeichen, status, storage_path, dta_sha256, signed_storage_path, signed_sha256
          )
        `)
        .eq('id', zeileId)
        .eq('owner_id', tenantId)
        .maybeSingle();

      if (zeileErr) {
        if (zeileErr.code === '42703' || /column.*does not exist/i.test(zeileErr.message)) {
          return res.status(503).json({ error: 'Die Datenbank-Migration für Zuzahlungsforderungen (VKZ 03) ist auf diesem System noch nicht angewendet. Vorgang abgebrochen.', code: 'MIGRATION_FEHLT' });
        }
        return res.status(500).json({ error: 'Fehler beim Laden des Ursprungsbelegs.' });
      }

      if (!sourceZeile) {
        return res.status(404).json({
          error: 'Ursprungsbeleg nicht gefunden oder gehört nicht zu Ihrem Mandanten.',
          code: 'SOURCE_LINE_NOT_FOUND',
        });
      }

      const sourceHeader = sourceZeile.abrechnung;
      if (!sourceHeader) {
        return res.status(422).json({
          error: 'Ursprungsrechnung (Abrechnungskopf) zu dieser Zeile nicht gefunden.',
          code: 'SOURCE_HEADER_NOT_FOUND',
        });
      }

      // Prüfen, ob Ursprungsabrechnung erfolgreich validiert/akzeptiert wurde
      if (sourceZeile.business_id !== sourceHeader.business_id || sourceZeile.owner_id !== tenantId || sourceHeader.owner_id !== tenantId) {
        return res.status(409).json({ error: 'Mandantenkonflikt bei den Ursprungsdaten.', code: 'OWNER_MISMATCH' });
      }

      const validZeilenStatuses = ['akzeptiert'];
      if (!validZeilenStatuses.includes(sourceZeile.status) || sourceZeile.herkunft !== 'einreichung') {
        return res.status(422).json({
          error: `Der Ursprungsbeleg hat den Status „${sourceZeile.status}“ (Kopf: „${sourceHeader.status}“). Eine Zuzahlungsforderung ist nur für erfolgreich eingereichte Belege zulässig.`,
          code: 'SOURCE_NOT_ACCEPTED',
        });
      }

      if (sourceHeader.verarbeitungskennzeichen && sourceHeader.verarbeitungskennzeichen !== '01') {
        return res.status(422).json({
          error: `Die Ursprungsrechnung hat VKZ "${sourceHeader.verarbeitungskennzeichen}". Zuzahlungsforderungen dürfen nur für Erstrechnungen (VKZ 01) erstellt werden.`,
          code: 'INVALID_SOURCE_VKZ',
        });
      }

      // 4. Nachweisdatum validieren
      const rawDate = nachweisDatum || befreiungDatum || befreiungGueltigAb;
      if (typeof rawDate !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(rawDate)) {
        return res.status(422).json({
          error: 'Ein gültiges Nachweisdatum im Format YYYY-MM-DD ist erforderlich.',
          code: 'INVALID_PROOF_DATE',
        });
      }

      const parsedProofDate = new Date(`${rawDate}T00:00:00Z`);
      if (Number.isNaN(parsedProofDate.getTime()) || parsedProofDate.toISOString().slice(0, 10) !== rawDate) {
        return res.status(422).json({
          error: 'Ein gültiges kalendarisches Nachweisdatum ist erforderlich.',
          code: 'INVALID_PROOF_DATE',
        });
      }

      const berlinToday = berlinHeute();
      if (rawDate > berlinToday) {
        return res.status(422).json({
          error: `Das Nachweisdatum (${rawDate}) darf nicht in der Zukunft liegen (heutiges Berliner Datum: ${berlinToday}).`,
          code: 'PROOF_DATE_IN_FUTURE',
        });
      }

      const { data: existing, error: existErr } = await supabase
        .from('abrechnung')
        .select(`
          ${ABRECHNUNG_VERSION_FELDER},
          auftragsdatei_size, auftragsdatei_sha256,
          datenaustauschreferenz, transfernummer, rechnungsnummer, verarbeitungskennzeichen,
          zuzahlungsforderung_daten, total_eur, zuzahlung_total
        `)
        .eq('owner_id', tenantId)
        .eq('zuzahlungsforderung_ursprung_id', sourceZeile.id)
        .maybeSingle();

      if (existErr) {
        return res.status(500).json({ error: 'Datenbankfehler bei der Suche nach bestehenden Forderungen.', code: 'EXISTING_LOOKUP_FAILED' });
      }

      const { data: snapZeile, error: snapErr } = existing ? await supabase
          .from('abrechnung_zeile')
          .select('id, owner_id, business_id, karten_ik, kostentraeger_ik, belegnummer, versichertennummer, verordnungsdatum, patient_name, leistungen, brutto_eur, netto_eur, zuzahlung_eur, status, prescription_id')
          .eq('owner_id', tenantId)
          .eq('abrechnung_id', existing.id)
          .maybeSingle() : { data: null, error: null };

        if (snapErr) {
          return res.status(500).json({
            error: 'Datenbankfehler beim Prüfen der Abrechnungszeile.',
            code: 'SNAPSHOT_LOOKUP_FAILED',
          });
        }

      const immutableReplay = Boolean(snapZeile);

      // Zahlungsstatus prüfen (Kassenbuch belegliste + Verordnungsstempel)
      const [belegRes, rxRes] = await Promise.all([
        supabase
          .from('belegliste')
          .select('prescription_id, amount_eur, type')
          .eq('owner_id', tenantId)
          .eq('prescription_id', sourceZeile.prescription_id),
        supabase
          .from('prescriptions')
          .select('id, patient_id, zuzahlung_kassiert_am, zuzahlung_eur')
          .eq('id', sourceZeile.prescription_id)
          .eq('owner_id', tenantId)
          .maybeSingle(),
      ]);

      if (belegRes.error) return res.status(500).json({ error: 'Kassenbuch-Prüfung fehlgeschlagen.', code: 'LEDGER_LOOKUP_FAILED' });
      if (rxRes.error) return res.status(500).json({ error: 'Verordnungs-Prüfung fehlgeschlagen.', code: 'PRESCRIPTION_LOOKUP_FAILED' });
      if (!rxRes.data) {
        return res.status(422).json({
          error: 'Zugehörige Verordnung konnte nicht geladen werden.',
          code: 'PRESCRIPTION_LOOKUP_FAILED',
        });
      }

      // 5. Positionsindizes validieren
      const rawIndices = positionIndices || selectedSessionIndices;
      let validatedIndices = [];

      const totalLeistungen = Array.isArray(sourceZeile.leistungen) ? sourceZeile.leistungen.length : 0;
      if (canonicalGrund === '5') {
        if (!Array.isArray(rawIndices) || rawIndices.length === 0) {
          return res.status(422).json({
            error: 'Für Grund 5 (Jahresübergang) müssen die betroffenen Positionsindizes explizit übergeben werden.',
            code: 'POSITION_INDICES_REQUIRED',
          });
        }
      }

      if (rawIndices !== undefined) {
        if (!Array.isArray(rawIndices) || rawIndices.length === 0) {
          return res.status(422).json({
            error: 'Die Positionsindizes müssen als nicht-leeres Array übergeben werden.',
            code: 'PARTIAL_SELECTION_REJECTED',
          });
        }
        const seen = new Set();
        for (const idx of rawIndices) {
          if (!Number.isInteger(idx) || idx < 0 || idx >= totalLeistungen) {
            return res.status(422).json({
              error: `Ungültiger Positionsindex ${idx}. Der Ursprungsbeleg enthält ${totalLeistungen} Positionen.`,
              code: 'INVALID_POSITION_INDEX',
            });
          }
          if (seen.has(idx)) {
            return res.status(422).json({
              error: `Doppelter Positionsindex ${idx} übergeben.`,
              code: 'DUPLICATE_POSITION_INDEX',
            });
          }
          seen.add(idx);
        }
        validatedIndices = Array.from(seen);
      } else {
        if (totalLeistungen <= 0) {
          return res.status(422).json({
            error: 'Der Ursprungsbeleg enthält keine Leistungspositionen.',
            code: 'NO_ORIGINAL_SESSIONS',
          });
        }
        // Bei Grund 1 und 2 defaulten alle Indizes des Ursprungs
        validatedIndices = sourceZeile.leistungen.map((_, i) => i);
      }

      // 6. Grundspezifische Nachweise und ID-Prüfungen
      let enrichedNachweisPruefung = undefined;

      if (canonicalGrund === '1' || canonicalGrund === '2' || canonicalGrund === '5') {
        const clientProof = nachweisPruefung || req.body.nachweisPruefung;
        let unverifiedCode = 'UNEXPECTED_PROOF_KEYS';
        if (canonicalGrund === '1') unverifiedCode = 'EXEMPTION_EVIDENCE_UNVERIFIED';
        if (canonicalGrund === '2') unverifiedCode = 'PAYMENT_DEMAND_EVIDENCE_UNVERIFIED';
        if (canonicalGrund === '5') unverifiedCode = 'YEAR_TRANSITION_EVIDENCE_UNVERIFIED';

        if (!clientProof || typeof clientProof !== 'object' || Array.isArray(clientProof)) {
          return res.status(422).json({
            error: `Für Grund ${canonicalGrund} ist ein expliziter Nachweis (nachweisPruefung) erforderlich.`,
            code: unverifiedCode,
          });
        }

        let allowedKeys = [];
        if (canonicalGrund === '1') {
          allowedKeys = ['art', 'referenz', 'gueltigAb', 'gueltigBis', 'bestaetigt'];
        } else if (canonicalGrund === '2') {
          allowedKeys = ['art', 'referenz', 'versandDatum', 'versandArt', 'nachweisBeigefuegtBestaetigt', 'erfolgloserEinzugBestaetigt', 'bestaetigt'];
        } else if (canonicalGrund === '5') {
          allowedKeys = ['art', 'referenz', 'gueltigAb', 'gueltigBis', 'statusWechselDatum', 'zahlungsaufforderungReferenz', 'zahlungsaufforderungDatum', 'originalAbzugBestaetigt', 'bestaetigt'];
        }

        for (const key of Object.keys(clientProof)) {
          if (!allowedKeys.includes(key)) {
            return res.status(422).json({
              error: `Unerlaubtes Feld "${key}" im Nachweisobjekt. Audit-Felder dürfen nicht vom Client übergeben werden.`,
              code: 'UNEXPECTED_PROOF_KEYS',
            });
          }
        }

        let expectedArt = '';
        if (canonicalGrund === '1') expectedArt = 'belastungsgrenze62';
        if (canonicalGrund === '2') expectedArt = 'zahlungsaufforderung43c';
        if (canonicalGrund === '5') expectedArt = 'statuswechsel_jahreswechsel';

        if (clientProof.art !== expectedArt) {
          return res.status(422).json({
            error: `Ungültige Nachweisart "${clientProof.art}" für Grund ${canonicalGrund}. Erwartet: "${expectedArt}".`,
            code: 'INVALID_PROOF_ART',
          });
        }

        if (typeof clientProof.referenz !== 'string' || !clientProof.referenz.trim() || clientProof.referenz.trim().length > 240) {
          return res.status(422).json({
            error: 'Die Nachweisreferenz ist erforderlich und darf maximal 240 Zeichen lang sein.',
            code: 'INVALID_PROOF_REFERENCE',
          });
        }
        const trimmedReferenz = clientProof.referenz.trim();

        if (clientProof.bestaetigt !== true) {
          return res.status(422).json({
            error: 'Die Prüfung des Nachweises muss explizit bestätigt sein (bestaetigt: true).',
            code: 'CONFIRMATION_REQUIRED',
          });
        }

        if (canonicalGrund === '1' || canonicalGrund === '5') {
          if (!istStichtag(clientProof.gueltigAb) || !istStichtag(clientProof.gueltigBis)) {
            return res.status(422).json({
              error: 'Ungültiges Datum im Nachweis (gueltigAb oder gueltigBis).',
              code: 'INVALID_PROOF_PERIOD',
            });
          }
          if (clientProof.gueltigAb > clientProof.gueltigBis) {
            return res.status(422).json({
              error: 'Das Beginn-Datum darf nicht nach dem Ende-Datum liegen.',
              code: 'INVALID_PROOF_PERIOD',
            });
          }
        }

        if (canonicalGrund === '1') {
          if (validatedIndices.length !== totalLeistungen) {
            return res.status(422).json({
              error: 'Für Grund 1 werden keine Teilselektionen unterstützt. Es müssen alle Positionen abgerechnet werden.',
              code: 'PARTIAL_SELECTION_REJECTED',
            });
          }
        }

        let versandDatum = null;
        let versandArt = null;
        let nachweisBeigefuegtBestaetigt = null;
        let erfolgloserEinzugBestaetigt = null;

        if (canonicalGrund === '2') {
          if (clientProof.versandDatum !== rawDate) {
            return res.status(422).json({
              error: 'versandDatum muss mit nachweisDatum übereinstimmen.',
              code: 'INVALID_SHIPPING_DATE',
            });
          }
          if (!istStichtag(clientProof.versandDatum) || clientProof.versandDatum > berlinHeute(new Date())) {
            return res.status(422).json({
              error: 'versandDatum ungültig oder in der Zukunft.',
              code: 'INVALID_SHIPPING_DATE',
            });
          }
          versandDatum = clientProof.versandDatum;

          const allowedVersandArten = ['post', 'elektronisch', 'persoenlich'];
          if (!allowedVersandArten.includes(clientProof.versandArt)) {
            return res.status(422).json({
              error: 'Ungültige versandArt.',
              code: unverifiedCode,
            });
          }
          versandArt = clientProof.versandArt;

          if (clientProof.nachweisBeigefuegtBestaetigt !== true) {
            return res.status(422).json({
              error: 'nachweisBeigefuegtBestaetigt muss true sein.',
              code: unverifiedCode,
            });
          }
          nachweisBeigefuegtBestaetigt = true;

          if (clientProof.erfolgloserEinzugBestaetigt !== true) {
            return res.status(422).json({
              error: 'erfolgloserEinzugBestaetigt muss true sein.',
              code: unverifiedCode,
            });
          }
          erfolgloserEinzugBestaetigt = true;
        }

        let statusWechselDatum = null;
        let zahlungsaufforderungReferenz = null;
        let zahlungsaufforderungDatum = null;
        let originalAbzugBestaetigt = null;

        if (canonicalGrund === '5') {
          if (!istStichtag(clientProof.statusWechselDatum) || clientProof.statusWechselDatum <= clientProof.gueltigBis || clientProof.statusWechselDatum > berlinToday) {
            return res.status(422).json({
              error: 'Statuswechseldatum muss nach dem Befreiungsende liegen und darf nicht zukünftig sein.',
              code: unverifiedCode,
            });
          }
          statusWechselDatum = clientProof.statusWechselDatum;

          if (typeof clientProof.zahlungsaufforderungReferenz !== 'string' || !clientProof.zahlungsaufforderungReferenz.trim() || clientProof.zahlungsaufforderungReferenz.trim().length > 240) {
            return res.status(422).json({
              error: 'Ungültige Zahlungsaufforderungsreferenz für Jahresübergang.',
              code: unverifiedCode,
            });
          }
          zahlungsaufforderungReferenz = clientProof.zahlungsaufforderungReferenz.trim();

          if (!istStichtag(clientProof.zahlungsaufforderungDatum) || clientProof.zahlungsaufforderungDatum < statusWechselDatum || clientProof.zahlungsaufforderungDatum > berlinHeute(new Date()) || clientProof.zahlungsaufforderungDatum > rawDate) {
            return res.status(422).json({
              error: 'Ungültiges Datum der Zahlungsaufforderung für Jahresübergang.',
              code: unverifiedCode,
            });
          }
          zahlungsaufforderungDatum = clientProof.zahlungsaufforderungDatum;

          if (clientProof.originalAbzugBestaetigt !== true) {
            return res.status(422).json({
              error: 'Der ursprüngliche Kassenabzug muss bestätigt sein.',
              code: unverifiedCode,
            });
          }
          originalAbzugBestaetigt = true;

          if (!Array.isArray(validatedIndices) || validatedIndices.length === 0) {
            return res.status(422).json({
              error: 'Für Jahresübergang (Grund 5) müssen die betroffenen Positionsindizes explizit übergeben werden.',
              code: unverifiedCode,
            });
          }
        }

        // Server enriches audit fields
        const nowUtc = new Date();
        const geprueftZeitpunkt = nowUtc.toISOString();
        const geprueftAm = berlinHeute(nowUtc);

        enrichedNachweisPruefung = {
          art: expectedArt,
          referenz: trimmedReferenz,
          geprueftAm,
          geprueftZeitpunkt,
          prueferId: tenantId,
          patientId: rxRes.data.patient_id,
          kostentraegerIk: sourceHeader.kostentraeger_ik,
          bestaetigt: true,
        };

        if (canonicalGrund === '1' || canonicalGrund === '5') {
          enrichedNachweisPruefung.gueltigAb = clientProof.gueltigAb;
          enrichedNachweisPruefung.gueltigBis = clientProof.gueltigBis;
        }
        if (canonicalGrund === '2') {
          Object.assign(enrichedNachweisPruefung, { versandDatum, versandArt, nachweisBeigefuegtBestaetigt, erfolgloserEinzugBestaetigt });
        }
        if (canonicalGrund === '5') {
          enrichedNachweisPruefung.statusWechselDatum = statusWechselDatum;
          enrichedNachweisPruefung.zahlungsaufforderungReferenz = zahlungsaufforderungReferenz;
          enrichedNachweisPruefung.zahlungsaufforderungDatum = zahlungsaufforderungDatum;
          enrichedNachweisPruefung.originalAbzugBestaetigt = true;
        }
      }

      let validatedMahnungId = undefined;
      let validatedDokumentId = undefined;

      if (canonicalGrund === '2') {
        const refMahnung = mahnungId || dokumentReferenz;
        if (!refMahnung || typeof refMahnung !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(refMahnung)) {
          return res.status(422).json({
            error: 'Für Grund 2 (§ 43c SGB V) ist eine gültige Mahnungs-ID (UUID) als schriftlicher Nachweis erforderlich.',
            code: 'MAHNUNG_ID_REQUIRED',
          });
        }

        if (validatedIndices.length !== totalLeistungen) {
          return res.status(422).json({ error: 'Für Grund 2 werden keine Teilselektionen unterstützt.', code: 'PARTIAL_SELECTION_REJECTED' });
        }
        if (immutableReplay) {
          validatedMahnungId = refMahnung;
        } else {
        const { data: mahnRow, error: mahnErr } = await supabase
          .from('mahnungen')
          .select('id, owner_id, patient_id, prescription_id, ausfallrechnung_id, status, sent_at, neue_faelligkeit, original_faelligkeit')
          .eq('id', refMahnung)
          .eq('owner_id', tenantId)
          .eq('prescription_id', sourceZeile.prescription_id)
          .maybeSingle();

        if (mahnErr) return res.status(500).json({ error: 'Fehler beim Prüfen der Mahnung.' });
        if (!mahnRow) {
          return res.status(422).json({
            error: `Keine passende Mahnung für diese Verordnung gefunden (ID: ${refMahnung}).`,
            code: 'MAHNUNG_NOT_FOUND',
          });
        }

        if (!mahnRow.patient_id || mahnRow.patient_id !== rxRes.data.patient_id || mahnRow.owner_id !== tenantId || mahnRow.prescription_id !== sourceZeile.prescription_id) {
          return res.status(422).json({
            error: 'Die Mahnung ist einem anderen Patienten zugeordnet als die Ursprungsverordnung.',
            code: 'MAHNUNG_PATIENT_MISMATCH',
          });
        }

        if (mahnRow.ausfallrechnung_id) {
          return res.status(422).json({
            error: 'Die angegebene Mahnung bezieht sich auf eine Ausfallrechnung und ist für die Zuzahlungsforderung unzulässig.',
            code: 'MAHNUNG_AUSFALLRECHNUNG_NOT_ALLOWED',
          });
        }

        if (mahnRow.status !== 'offen') {
          return res.status(422).json({ error: 'Nur offene Mahnungen sind als Nachweis zulässig.', code: 'MAHNUNG_NOT_OPEN' });
        }
        const faelligkeit = mahnRow.neue_faelligkeit || mahnRow.original_faelligkeit;
        if (!istStichtag(faelligkeit) || faelligkeit >= berlinToday) {
          return res.status(422).json({ error: 'Die gültige Zahlungsfrist der Mahnung muss abgelaufen sein.', code: 'MAHNUNG_DEADLINE_NOT_EXPIRED' });
        }
        if (enrichedNachweisPruefung.versandDatum > faelligkeit) {
          return res.status(422).json({ error: 'Der Versand muss spätestens zur Zahlungsfrist erfolgt sein.', code: 'INVALID_SHIPPING_DATE' });
        }
        // Genannte ZU-Nummer muss der aktive ZU-Beleg dieser Verordnung sein (gkv-302 10.10.2026)
        if (/ZU-\d{4}-\d+/i.test(enrichedNachweisPruefung.referenz)) {
          const { data: aktiverZu, error: zuErr } = await ladeAktivenZuBeleg(supabase, { prescriptionId: sourceZeile.prescription_id, tenantId });
          if (zuErr) return res.status(500).json({ error: 'Fehler beim Prüfen des Zuzahlungsbelegs.' });
          const fremd = fremdeZuNummern(enrichedNachweisPruefung.referenz, aktiverZu);
          if (fremd.length) {
            return res.status(422).json({
              error: `Die Nachweisreferenz nennt ${fremd.join(', ')} — das ist nicht der aktive Zuzahlungsbeleg dieser Verordnung${aktiverZu?.invoice_number ? ` (${aktiverZu.invoice_number})` : ''}.`,
              code: 'ZU_REFERENZ_MISMATCH',
            });
          }
        }
        validatedMahnungId = mahnRow.id;
        }
      }

      if (nachweisDokumentId !== undefined) {
        const docIdStr = String(nachweisDokumentId).trim();
        if (typeof nachweisDokumentId !== 'string' || !/^[1-9][0-9]{0,17}$/.test(docIdStr)) {
          return res.status(422).json({
            error: 'Ungültige nachweisDokumentId (positive Ganzzahl als String erforderlich).',
            code: 'INVALID_DOCUMENT_ID',
          });
        }

        if (!immutableReplay) {
        const { data: docRow, error: docErr } = await supabase
          .from('prescription_documents')
          .select('id, owner_id, prescription_id, patient_id, business_id')
          .eq('id', docIdStr)
          .eq('owner_id', tenantId)
          .eq('prescription_id', sourceZeile.prescription_id)
          .maybeSingle();

        if (docErr) return res.status(500).json({ error: 'Fehler beim Prüfen des Nachweisdokuments.' });
        if (!docRow) {
          return res.status(422).json({
            error: `Nachweisdokument ${docIdStr} gehört nicht zur ursprünglichen Verordnung oder zum Mandanten.`,
            code: 'DOCUMENT_NOT_FOUND',
          });
        }

        // patient NULL or match
        if (docRow.patient_id && rxRes.data?.patient_id && docRow.patient_id !== rxRes.data.patient_id) {
          return res.status(422).json({
            error: 'Das Nachweisdokument ist einem anderen Patienten zugeordnet als die Verordnung.',
            code: 'DOCUMENT_PATIENT_MISMATCH',
          });
        }

        // business NULL or match
        const origBusinessId = sourceZeile.business_id || sourceHeader.business_id;
        if (docRow.business_id && docRow.business_id !== (origBusinessId ?? null)) {
          return res.status(422).json({
            error: 'Das Nachweisdokument gehört zu einer anderen Betriebsstätte als der Ursprungsbeleg.',
            code: 'DOCUMENT_BUSINESS_MISMATCH',
          });
        }

        }
        validatedDokumentId = docIdStr;
      }

      // Frozen Intent zusammenstellen (nur exakt erlaubte Schlüssel)
      const frozenIntent = {
        grund: canonicalGrund,
        nachweisDatum: rawDate,
        positionIndices: validatedIndices,
        bestaetigt: true,
      };
      if (validatedMahnungId) frozenIntent.mahnungId = validatedMahnungId;
      if (validatedDokumentId) frozenIntent.nachweisDokumentId = validatedDokumentId;
      if (enrichedNachweisPruefung) frozenIntent.nachweisPruefung = enrichedNachweisPruefung;

      if (!rxRes.data) {
        return res.status(422).json({
          error: 'Zugehörige Verordnung konnte nicht geladen werden.',
          code: 'PRESCRIPTION_LOOKUP_FAILED',
        });
      }

      const belege = belegRes.data || [];
      for (const b of belege) {
        if (!b || typeof b.amount_eur !== 'number' || !Number.isFinite(b.amount_eur)) {
          return res.status(422).json({
            error: 'Ungültiger Kassenbuch-Eintrag (Betrag fehlt oder ist keine gültige Zahl).',
            code: 'LEDGER_INVALID_ROW',
          });
        }
      }

      const salden = saldoJeRezept(belege);
      const saldo = salden.get(sourceZeile.prescription_id) || 0;

      if (Number.isNaN(saldo) || saldo < 0) {
        return res.status(422).json({
          error: 'Ungültiger oder negativer Kassenbuch-Saldo. Die Zahlungsdaten der Verordnung sind inkonsistent.',
          code: 'LEDGER_INVALID_SALDO',
        });
      }

      const hasPositivePayment = belege.some(b => b.amount_eur > 0);
      if (!immutableReplay && (hasPositivePayment || saldo > 0)) {
        if (saldo > 0 && saldo < Number(sourceZeile.zuzahlung_eur)) {
          return res.status(422).json({
            error: `Teilzahlung (${saldo.toFixed(2)} €) im Kassenbuch vorhanden. Teil-Zuzahlungsforderungen werden vor Klärung der Allokation nicht unterstützt.`,
            code: 'PARTIAL_PAYMENT_REJECTED',
          });
        }
        return res.status(422).json({
          error: 'Die Zuzahlung für diese Verordnung wurde laut Kassenbuch/Zahlungsvermerk bereits bezahlt. Eine Zuzahlungsforderung ist unzulässig.',
          code: 'COPAYMENT_ALREADY_PAID',
        });
      }

      const istBezahlt = istZuzahlungBezahlt({
        zuzahlungEur: sourceZeile.zuzahlung_eur,
        kassiertAm: rxRes.data?.zuzahlung_kassiert_am,
        saldo,
      });

      if (!immutableReplay && (istBezahlt || rxRes.data?.zuzahlung_kassiert_am)) {
        return res.status(422).json({
          error: 'Die Zuzahlung für diese Verordnung wurde laut Kassenbuch/Zahlungsvermerk bereits bezahlt. Eine Zuzahlungsforderung ist unzulässig.',
          code: 'COPAYMENT_ALREADY_PAID',
        });
      }



      // ===== EXISTING LOOKUP (BEFORE PARSER) =====
      // claimAbrechnungId is already declared at the top
      let existingReferenz = null;
      let existingTransfer = null;
      let existingSammelNummer = null;


      if (existing) {
        if (!matchesFrozenIntent(existing.zuzahlungsforderung_daten, frozenIntent)) {
          return res.status(409).json({
            error: 'Die Zuzahlungsforderung ist bereits für diese Ursprungszeile reserviert, aber mit anderen Parametern. Ein bestehender Vorgang kann nur mit identischem Nachweis/Intent wiederaufgenommen werden.',
            code: 'FROZEN_INTENT_MISMATCH',
            abrechnungId: existing.id,
          });
        }

        if (existing.zuzahlungsforderung_daten?.nachweisPruefung) {
          enrichedNachweisPruefung = existing.zuzahlungsforderung_daten.nachweisPruefung;
          frozenIntent.nachweisPruefung = existing.zuzahlungsforderung_daten.nachweisPruefung;
        }

      }
      // ===== END EXISTING LOOKUP =====

      // 8. Praxis-Zertifikat / Absender-IK laden
      const { data: certRow, error: certErr } = await supabase
        .from('terapeut_zertifikat')
        .select('ik_nummer, betriebsart, zulassung_referenz, zulassung_datum')
        .eq('owner_id', tenantId)
        .maybeSingle();

      if (certErr) return res.status(500).json({ error: 'Fehler beim Lesen des Praxis-Zertifikats.' });

      const currentSenderIk = certRow?.ik_nummer || profile.ik_number;
      if (!currentSenderIk) {
        return res.status(422).json({
          error: 'Keine gültige IK-Nummer für die Praxis hinterlegt.',
          code: 'NO_SENDER_IK',
        });
      }

      // 9. Ursprungs-DTA herunterladen und parsen
      let parseResult = null;
      try {
        const rawBuffer = await ladeDtaOriginalbytes({
          db: supabase,
          abrechnung: sourceHeader,
        });
        parseResult = parseOriginalDtaMessage({
          dtaContent: rawBuffer,
          expectedSha256: sourceHeader.dta_sha256,
          sourceHeader,
          sourceZeile,
          reason: canonicalGrund,
          selectedSessionIndices: validatedIndices,
          currentSenderIk,
          nachweisPruefung: enrichedNachweisPruefung,
          verifiedSourcePatientId: rxRes.data.patient_id,
          sourcePatientId: rxRes.data.patient_id,
        });
      } catch (parseErr) {
        return res.status(parseErr.status || 422).json({
          error: parseErr.message,
          code: parseErr.code || 'ORIGINAL_DTA_PARSE_FAILED',
        });
      }

      const { prescription: dtaPrescription, claimAmount, ursprung } = parseResult;

      if (existing) {
        const hasArtifacts =
          Boolean(existing.storage_path) &&
          Boolean(existing.dta_sha256) &&
          Boolean(existing.begleitzettel_path) &&
          Boolean(existing.auftragsdatei_path) &&
          typeof existing.auftragsdatei_size === 'number' &&
          Boolean(existing.auftragsdatei_sha256) &&
          Number.isInteger(existing.datenaustauschreferenz) &&
          Number.isInteger(existing.transfernummer) &&
          Boolean(existing.rechnungsnummer) &&
          existing.verarbeitungskennzeichen === '03' &&
          Math.round(Number(existing.total_eur) * 100) === Math.round(claimAmount * 100) &&
          Number(existing.zuzahlung_total) === 0;

        const snapValid = isSnapshotContentValid(snapZeile, sourceZeile, claimAmount, dtaPrescription.sessions);
        const completedStatuses = ['erstellt', 'heruntergeladen', 'gesendet', 'accepted', 'paid', 'abgerechnet', 'eingereicht'];

        if (snapZeile) {
          if (completedStatuses.includes(existing.status)) {
            if (hasArtifacts && snapValid) {
              return res.status(200).json({
                ok: true,
                status: existing.status,
                idempotent: true,
                abrechnungId: existing.id,
                rechnungsnummer: existing.rechnungsnummer,
                total_eur: existing.total_eur,
                zuzahlung_total: existing.zuzahlung_total,
                storage_path: existing.storage_path,
                begleitzettel_path: existing.begleitzettel_path,
                auftragsdatei_path: existing.auftragsdatei_path,
              });
            } else if (!snapValid) {
              return res.status(409).json({
                error: 'Die Zuzahlungsforderung ist bereits für diese Ursprungszeile reserviert, aber mit anderen Parametern.',
                code: 'FROZEN_INTENT_MISMATCH',
                abrechnungId: existing.id,
              });
            } else {
              return res.status(409).json({
                error: 'Inkonsistenter Zustand: Abrechnungszeile existiert, aber Artefakte fehlen. Bitte an den Support wenden.',
                code: 'MISSING_ARTIFACTS_AFTER_SNAPSHOT',
                abrechnungId: existing.id,
              });
            }
          } else {
            return res.status(409).json({
              error: `Für diesen Beleg existiert bereits eine Zuzahlungsforderung mit Status „${existing.status}“.`,
              code: 'CLAIM_EXISTS',
              abrechnungId: existing.id,
            });
          }
        } else {
          if (existing.status !== 'verworfen') {
            return res.status(409).json({
              error: 'Eine Zuzahlungsforderung für diesen Beleg wird bereits bearbeitet.',
              code: 'CLAIM_IN_PROGRESS',
              abrechnungId: existing.id,
            });
          }

        }
      }

      // 10. Empfänger & Annahmestelle ermitteln
      const dasIk = sourceHeader.empfaenger_ik;
      if (!dasIk) {
        return res.status(422).json({
          error: 'Empfänger-IK (Datenannahmestelle) in Ursprungsrechnung nicht vorhanden.',
          code: 'NO_RECIPIENT_IK',
        });
      }

      const { data: ktRow } = await supabase
        .from('kostentraeger')
        .select('ik, name')
        .eq('ik', sourceHeader.kostentraeger_ik)
        .maybeSingle();

      const kk = ktRow ? { name: ktRow.name, ik: ktRow.ik } : { name: 'Krankenkasse', ik: sourceHeader.kostentraeger_ik };

      // Fachbereich und Abrechnungscode aus dem unveränderlichen Originaltarif ermitteln (kein pauschales '22')
      let bereich = null;
      let eigenerAbrechnungscode = null;

      // 1. Immutable original tarif from parsed DTA message
      if (dtaPrescription.tarif?.abrechnungscode) {
        eigenerAbrechnungscode = String(dtaPrescription.tarif.abrechnungscode).trim();
        bereich = CODE_TO_SECTOR[eigenerAbrechnungscode] || null;
      }

      // 2. Source zeile therapie_bereich if not determined
      if (!bereich && sourceZeile.therapie_bereich) {
        const normTb = String(sourceZeile.therapie_bereich).trim().toLowerCase();
        bereich = normTb.includes('podo') ? 'podologie'
          : normTb.includes('ergo') ? 'ergotherapie'
          : normTb.includes('logo') ? 'logopaedie'
          : normTb.includes('physio') ? 'physiotherapy'
          : normTb;
        if (!eigenerAbrechnungscode) {
          eigenerAbrechnungscode = SECTOR_TO_CODE[normTb] || SECTOR_TO_CODE[bereich] || null;
        }
      }

      // 3. bereichFuerAbrechnung helper if available
      if (typeof bereichFuerAbrechnung === 'function') {
        try {
          const r = await bereichFuerAbrechnung(supabase, sourceHeader, { tenantId, tenantSector: profile.sector });
          if (r) {
            if (!bereich) bereich = r.bereich;
            if (!eigenerAbrechnungscode) eigenerAbrechnungscode = r.eigenerAbrechnungscode;
          }
        } catch (ignored) {}
      }

      // 4. Mandantenprofil-Sektor
      if (!bereich && profile.sector) {
        bereich = profile.sector;
        if (!eigenerAbrechnungscode) eigenerAbrechnungscode = SECTOR_TO_CODE[bereich] || null;
      }

      // Fallback only if still unset
      if (!bereich) bereich = 'physiotherapy';
      if (!eigenerAbrechnungscode) eigenerAbrechnungscode = SECTOR_TO_CODE[bereich] || '22';

      // Betriebsart laden: Signatur ladeBetriebsart({ ownerId, empfaengerIk, cert, db })
      let betriebsart;
      try {
        betriebsart = await ladeBetriebsart({
          ownerId: tenantId,
          empfaengerIk: dasIk,
          cert: certRow,
          db: supabase,
        });
        if (!['test', 'erprobung', 'echt'].includes(betriebsart)) {
          throw new Error(`Ungültige Betriebsart: "${betriebsart}". Zulässig sind nur test, erprobung oder echt.`);
        }
      } catch (bErr) {
        return res.status(bErr.status || 422).json({
          error: 'Betriebsart konnte nicht ermittelt werden.',
          code: 'BETRIEBSART_FEHLER',
        });
      }

      // Erst nach sämtlichen Prüfungen eine Reservierung atomar übernehmen/anlegen.
      if (existing) {
        try {
          pruefeEntwurfsVersion({ ...existing, status: 'erstellt' });
        } catch {
          return res.status(409).json({
            error: 'Kollision bei der Validierung des Entwurfssnapshots.',
            code: 'CLAIM_RESUME_CONFLICT',
          });
        }

        const signedEncTransportNull =
          existing.status === 'verworfen' &&
          existing.signed_storage_path === null &&
          existing.signed_sha256 === null &&
          existing.signed_at === null &&
          existing.signed_by_cert_thumbprint === null &&
          existing.encrypted_storage_path === null &&
          existing.encrypted_sha256 === null &&
          existing.verschluesselt_am === null &&
          existing.verschluesselt_fuer_fingerprint === null &&
          existing.verschluesselung_hinweis === null &&
          existing.zaa_uploaded_at === null &&
          existing.paid_at === null;

        if (!signedEncTransportNull) {
          return res.status(409).json({
            error: 'Kollision: Bestehende Abrechnung befindet sich nicht in einem wiederaufnehmbaren Zustand.',
            code: 'CLAIM_RESUME_CONFLICT',
          });
        }

        let resumeQuery = supabase
          .from('abrechnung')
          .update({
            status: 'erstellt',
            verwerfungsgrund: null,
            zuzahlungsforderung_daten: frozenIntent,
            storage_path: null,
            dta_sha256: null,
            auftragsdatei_path: null,
            auftragsdatei_size: null,
            auftragsdatei_sha256: null,
            begleitzettel_path: null,
          })
          .eq('id', existing.id)
          .eq('owner_id', tenantId);

        for (const feld of ABRECHNUNG_VERSION_FELDER.split(',')) {
          if (feld === 'id' || feld === 'owner_id') continue;
          const val = existing[feld];
          if (val === null) {
            resumeQuery = resumeQuery.is(feld, null);
          } else {
            resumeQuery = resumeQuery.eq(feld, val);
          }
        }

        const { data: casData, error: casErr } = await resumeQuery.select(
          `${ABRECHNUNG_VERSION_FELDER},datenaustauschreferenz,transfernummer,rechnungsnummer`
        );

        if (casErr || !casData || casData.length !== 1) {
          return res.status(409).json({
            error: 'Kollision: Die Reservierung wird bereits von einem anderen Vorgang bearbeitet.',
            code: 'CLAIM_RESUME_CONFLICT',
          });
        }
        const casRow = casData[0];

        let snapValid = false;
        try {
          snapValid = pruefeEntwurfsVersion(casRow);
        } catch {
          snapValid = false;
        }

        if (!snapValid || casRow.id !== existing.id || casRow.owner_id !== tenantId || casRow.status !== 'erstellt') {
          return res.status(409).json({
            error: 'Kollision bei der Validierung des übernommenen Entwurfssnapshots.',
            code: 'CLAIM_RESUME_CONFLICT',
          });
        }

        claimAbrechnungId = casRow.id;
        claimVersion = casRow;

        if (Number.isInteger(casRow.datenaustauschreferenz) && Number.isInteger(casRow.transfernummer) && casRow.rechnungsnummer) {
          existingReferenz = casRow.datenaustauschreferenz;
          existingTransfer = casRow.transfernummer;
          existingSammelNummer = casRow.rechnungsnummer;
        }
      } else {
        const reservationPayload = {
          owner_id: tenantId,
          business_id: sourceZeile.business_id || sourceHeader.business_id || null,
          kostentraeger_ik: sourceHeader.kostentraeger_ik,
          status: 'erstellt',
          verarbeitungskennzeichen: '03',
          zuzahlungsforderung_ursprung_id: sourceZeile.id,
          zuzahlungsforderung_daten: frozenIntent,
          total_eur: 0,
          zuzahlung_total: 0,
        };
        const { data: reservedHeader, error: reserveErr } = await supabase
          .from('abrechnung')
          .insert(reservationPayload)
          .select(ABRECHNUNG_VERSION_FELDER)
          .single();

        if (reserveErr) {
          if (reserveErr.code === '42703' || /column.*does not exist/i.test(reserveErr.message)) {
            return res.status(503).json({
              error: 'Die Datenbank-Migration für Zuzahlungsforderungen (VKZ 03) ist auf diesem System noch nicht angewendet. Vorgang abgebrochen.',
              code: 'MIGRATION_FEHLT',
            });
          }
          if (reserveErr.code === '23505' || /unique/i.test(reserveErr.message)) {
            return res.status(409).json({
              error: 'Kollision bei der Reservierung der Zuzahlungsforderung.',
              code: 'CLAIM_RESERVATION_CONFLICT',
            });
          }
          return res.status(500).json({
            error: 'Datenbankfehler bei der Reservierung des Abrechnungskopfs.',
            code: 'RESERVATION_FAILED',
          });
        }

        try {
          pruefeEntwurfsVersion(reservedHeader);
        } catch {
          return res.status(500).json({
            error: 'Reservierter Abrechnungskopf unvollständig oder ungültig.',
            code: 'RESERVATION_INVALID',
          });
        }

        claimAbrechnungId = reservedHeader.id;
        claimVersion = reservedHeader;
      }

      ownAttemptDir = dirname(
        artefaktVersuchPfad({
          ownerId: tenantId,
          abrechnungId: claimAbrechnungId,
          kind: 'unsigned',
        })
      );


      // 12. Nummernvergabe
      const now = new Date();

      if (Number.isInteger(existingReferenz) && Number.isInteger(existingTransfer)) {
        datennummer = existingReferenz;
        transfernummer = existingTransfer;
        sammelRechnungsnummer = existingSammelNummer;
      } else {
        const nummern = await vergebeNummern({
          ownerId: tenantId,
          absenderIk: currentSenderIk,
          empfaengerIk: dasIk,
        });
        datennummer = nummern.datennummer;
        transfernummer = nummern.transfernummer;
      }

      const { year, week } = isoWeek(now);
      if (!sammelRechnungsnummer) {
        sammelRechnungsnummer = buildSammelRechnungsnummer(year, week, datennummer);
      }

      claimVersion = await aktualisiereArtefaktVersion({
        db: supabase,
        vorher: claimVersion,
        patch: {
          datenaustauschreferenz: datennummer,
          transfernummer,
          rechnungsnummer: sammelRechnungsnummer,
        },
      });
      numbersPersisted = true;

      // 13. DTA-Datei (VKZ 03) über den echten Builder generieren
      const praxisIk = certRow?.ik_nummer || profile.ik_number;
      const rechnungsart = deps.rechnungsartFuer ? deps.rechnungsartFuer({ absenderIk: praxisIk }) : '1';

      const dta = deps.buildDtaFile({
        absender: {
          ik: praxisIk,
          name: profile.business_name || 'Praxis',
        },
        empfaenger: {
          ik: dasIk,
          name: ktRow?.name || 'Krankenkasse',
        },
        rechnung: {
          sammelRechnungsnummer,
          einzelRechnungsnummer: '0',
          datum: now,
          datennummer,
          rechnungsart,
        },
        prescriptions: [dtaPrescription],
        kind: betriebsart,
        vkz: '03',
        transfernummer,
        rechnungssteller: {
          name: profile.business_name || 'Praxis',
          telefon: profile.phone || '',
        },
      });

      // Betragsabstimmung zwischen Kernforderung und DTA-Rechnungsbetrag vor Veröffentlichung
      const dtaNetto = dta.totals ? Number(dta.totals.netto) : Number(dta.netto);
      const dtaBrutto = dta.totals ? Number(dta.totals.brutto) : Number(dta.brutto);

      if (!Number.isFinite(claimAmount) || !Number.isFinite(dtaNetto) || !Number.isFinite(dtaBrutto) || Math.round(claimAmount * 100) !== Math.round(dtaNetto * 100) || Math.round(dtaBrutto * 100) !== 0) {
        const err = new Error(
          `Abweichung bei der Forderungssumme: DTA berechnet ${Number.isFinite(dtaNetto) ? dtaNetto.toFixed(2) : dtaNetto} €, erwartete historische Forderung ist ${Number.isFinite(claimAmount) ? claimAmount.toFixed(2) : claimAmount} €.`
        );
        err.status = 422;
        err.code = 'CLAIM_AMOUNT_MISMATCH';
        throw err;
      }

      // 14. Artefakte im Storage speichern
      const isTraversing =
        typeof dta?.filename !== 'string' ||
        !dta.filename ||
        dta.filename === '.' ||
        dta.filename === '..' ||
        dta.filename.includes('/') ||
        dta.filename.includes('\\') ||
        dta.filename.includes('..') ||
        dta.filename.includes('%');

      const hasForbiddenSubstring =
        typeof dta?.filename === 'string' &&
        (dta.filename.toLowerCase().includes('.p7m') || dta.filename.toLowerCase().includes('.enc'));

      const isSuffixlessEsolTsol =
        typeof dta?.filename === 'string' && /^(?:ESOL|TSOL)0\d{3}$/i.test(dta.filename);

      const isGenericDta =
        typeof dta?.filename === 'string' && /^[a-zA-Z0-9_-]+\.dta$/i.test(dta.filename);

      if (isTraversing || hasForbiddenSubstring || (!isSuffixlessEsolTsol && !isGenericDta)) {
        const fnErr = new Error('Ungültiger DTA-Dateiname.');
        fnErr.status = 422;
        fnErr.code = 'INVALID_DTA_FILENAME';
        throw fnErr;
      }

      const dtaPath = `${ownAttemptDir}/${dta.filename}`;
      const begleitPath = `${ownAttemptDir}/begleitzettel.html`;

      let dtaSha256 = undefined;
      let auftrag = null;

      // DTA-Datei hochladen
      const dtaBuffer = Buffer.from(dta.content, 'latin1');
      const upDta = await supabase.storage.from('abrechnungen').upload(dtaPath, dtaBuffer, {
        contentType: 'application/octet-stream',
        upsert: false,
      });
      if (upDta.error || !upDta.data) {
        throw new Error('DTA-Upload fehlgeschlagen: ' + (upDta.error?.message || 'Keine Upload-Daten zurückgegeben'));
      }
      uploadedPaths.push(dtaPath);

      dtaSha256 = sha256Hex(dtaBuffer);

      // Auftragsdatei hochladen
      auftrag = await speichereAuftragsdatei({
        dta,
        verzeichnis: ownAttemptDir,
        upsert: false,
      });
      if (!auftrag || auftrag.fehler || !auftrag.pfad || typeof auftrag.groesse !== 'number' || !auftrag.sha256) {
        throw new Error('Auftragsdatei-Speicherung fehlgeschlagen: ' + (auftrag?.fehler || 'Unvollständige Auftragsdatei-Rückgabe'));
      }
      uploadedPaths.push(auftrag.pfad);

      // Begleitzettel bauen und hochladen
      const np = {
        nachname: dtaPrescription.patient?.nachname || sourceZeile.patient_name || '',
        vorname: dtaPrescription.patient?.vorname || '',
      };

      const begleitHtml = await baueBegleitzettel({
        dta,
        belege: [{
          _i: 0,
          belegnummer: sourceZeile.belegnummer,
          patient_nachname: np.nachname,
          patient_vorname: np.vorname,
          versichertennummer: sourceZeile.versichertennummer,
          verordnungsdatum: dtaPrescription.verordnung?.ausstellungsdatum || sourceZeile.verordnungsdatum,
          brutto: claimAmount.toFixed(2),
        }],
        kk,
        kostentraegerIk: sourceHeader.kostentraeger_ik,
        now,
        praxis: {
          name: profile.business_name || 'Praxis',
          strasse: [profile.street, profile.house_number].filter(Boolean).join(' '),
          plz_ort: [profile.zip, profile.city].filter(Boolean).join(' ').trim(),
          telefon: profile.phone || '',
          ik: certRow?.ik_nummer || profile.ik_number,
        },
        sammelRechnungsnummer,
        bereich,
        eigenerAbrechnungscode,
      });

      const upBeg = await supabase.storage.from('abrechnungen').upload(begleitPath, Buffer.from(begleitHtml, 'utf8'), {
        contentType: 'text/html; charset=utf-8',
        upsert: false,
      });
      if (upBeg.error || !upBeg.data) {
        throw new Error('Begleitzettel-Upload fehlgeschlagen: ' + (upBeg.error?.message || 'Keine Upload-Daten zurückgegeben'));
      }
      uploadedPaths.push(begleitPath);

      // 15. Exact saved artifacts + consumed numbers MUST persist before line
      claimVersion = await aktualisiereArtefaktVersion({
        db: supabase,
        vorher: claimVersion,
        patch: {
          dateiname: dta.filename,
          rechnungsnummer: sammelRechnungsnummer,
          total_eur: claimAmount,
          zuzahlung_total: 0,
          status: 'erstellt',
          dta_file_size: dta.byteLength,
          dta_segment_count: dta.segmentCount,
          prescription_count: 1,
          rejected_count: 0,
          datenaustauschreferenz: datennummer,
          transfernummer: dta.transfernummer,
          empfaenger_ik: dasIk,
          kostentraeger_ik: sourceHeader.kostentraeger_ik,
          betriebsart,
          storage_path: dtaPath,
          dta_sha256: dtaSha256,
          begleitzettel_path: begleitPath,
          auftragsdatei_path: auftrag.pfad,
          auftragsdatei_size: auftrag.groesse,
          auftragsdatei_sha256: auftrag.sha256,
        },
      });
      isPublished = true;

      // 16. Unveränderliche Abrechnungszeile anlegen (wenn nicht bereits vorhanden)

        const dtaEinzelRechnungsnummer = String(dta.gruppen?.[0]?.einzelRechnungsnummer ?? '1');

        const { data: existingLine, error: lineCheckErr } = await supabase
        .from('abrechnung_zeile')
        .select('id, owner_id, business_id, karten_ik, kostentraeger_ik, belegnummer, versichertennummer, verordnungsdatum, patient_name, leistungen, brutto_eur, netto_eur, zuzahlung_eur, status, prescription_id')
          .eq('owner_id', tenantId)
          .eq('abrechnung_id', claimAbrechnungId)
          .maybeSingle();

        if (lineCheckErr) {
          throw new Error('Fehler bei der Prüfung bestehender Abrechnungszeilen: ' + lineCheckErr.message);
        }


      if (existingLine) {
        if (!isSnapshotContentValid(existingLine, sourceZeile, claimAmount, dtaPrescription.sessions)) {
          throw new Error('Eine Abrechnungszeile existiert bereits, aber mit abweichenden Inhalten (Frozen Intent Mismatch).');
        }
      } else {

          const claimZeile = {
            owner_id: tenantId,
            business_id: sourceZeile.business_id || sourceHeader.business_id || null,
            abrechnung_id: claimAbrechnungId,
            prescription_id: sourceZeile.prescription_id,
            kostentraeger_ik: sourceZeile.kostentraeger_ik || sourceHeader.kostentraeger_ik,
            karten_ik: sourceZeile.karten_ik || null,
            einzel_rechnungsnummer: dtaEinzelRechnungsnummer,
            sort_order: 0,
            belegnummer: sourceZeile.belegnummer || null,
            patient_name: sourceZeile.patient_name || null,
            versichertennummer: sourceZeile.versichertennummer || null,
            verordnungsdatum: dtaPrescription.verordnung?.ausstellungsdatum || sourceZeile.verordnungsdatum || null,
            therapie_bereich: sourceZeile.therapie_bereich || 'physio',
            leistungen: dtaPrescription.sessions || [],
            brutto_eur: claimAmount,
            zuzahlung_eur: 0,
            netto_eur: claimAmount,
            status: 'eingereicht',
            herkunft: 'einreichung',
          };

          const { data: insZeileData, error: insZeileErr } = await supabase
            .from('abrechnung_zeile')
            .insert(claimZeile)
            .select('id');
          if (insZeileErr) {
            throw new Error('Fehler beim Einfügen der Abrechnungszeile: ' + insZeileErr.message);
          }
          if (!insZeileData || insZeileData.length === 0) {
            throw new Error('Fehler beim Einfügen der Abrechnungszeile: Kein Datensatz erstellt.');
          }
        }

      if (typeof logAccess === 'function') {
        try {
          await logAccess(supabase, {
            action: 'abrechnung_zuzahlungsforderung_erstellt',
            ownerId: tenantId,
            resourceId: claimAbrechnungId,
            details: {
              zeileId: sourceZeile.id,
              grund: canonicalGrund,
              claimAmount,
              sammelRechnungsnummer,
            },
          });
        } catch (ignored) {}
      }

      return res.status(200).json({
        ok: true,
        abrechnungId: claimAbrechnungId,
        dateiname: dta.filename,
        rechnungsnummer: sammelRechnungsnummer,
        total_eur: claimAmount,
        zuzahlung_total: 0,
        status: 'erstellt',
        storage_path: dtaPath,
        begleitzettel_path: begleitPath,
        auftragsdatei_path: auftrag.pfad,
      });

    } catch (err) {
      const isVersionConflict =
        err?.status === 409 ||
        err?.statusCode === 409 ||
        err?.code === 'ABRECHNUNG_VERSION_CONFLICT';

      if (claimAbrechnungId && tenantId && claimVersion && !isVersionConflict) {
        if (isPublished) {
          try {
            await aktualisiereArtefaktVersion({
              db: supabase,
              vorher: claimVersion,
              patch: {
                status: 'verworfen',
                verwerfungsgrund: 'Fehler bei Erstellung der Zuzahlungsforderung: [CREATION_FAILED]',
              },
            });
          } catch (postPubErr) {
            console.warn('[zuzahlungsforderung] Post-publication CAS verworfen fehlgeschlagen:', {
              code: postPubErr.code || 'POST_PUB_CAS_FAILED',
              abrechnungId: claimAbrechnungId,
            });
          }
        } else {
          let canCleanup = true;
          if (!numbersPersisted && Number.isInteger(datennummer) && Number.isInteger(transfernummer) && sammelRechnungsnummer) {
            canCleanup = false;
            try {
              claimVersion = await aktualisiereArtefaktVersion({
                db: supabase,
                vorher: claimVersion,
                patch: {
                  datenaustauschreferenz: datennummer,
                  transfernummer,
                  rechnungsnummer: sammelRechnungsnummer,
                },
              });
              canCleanup = true;
            } catch {
              console.warn('[zuzahlungsforderung] Nummern-Audit Sicherung fehlgeschlagen:', {
                code: 'NUMBERN_AUDIT_FAILED',
                abrechnungId: claimAbrechnungId,
              });
            }
          }

          if (canCleanup) {
            try {
              const cleanupRes = await bereinigeUnveroeffentlichtenEntwurf({
                db: supabase,
                vorher: claimVersion,
                pfade: uploadedPaths,
                verzeichnis: ownAttemptDir,
                grund: 'CREATION_FAILED',
              });
              if (cleanupRes && cleanupRes.bereinigt === false) {
                console.warn('[zuzahlungsforderung] Unvollständige Artefakt-Bereinigung:', {
                  code: 'CLEANUP_ARTIFACTS_NOT_REMOVED',
                  abrechnungId: claimAbrechnungId,
                });
              }
            } catch (cleanupErr) {
              console.warn('[zuzahlungsforderung] Bereinigung fehlgeschlagen:', {
                code: cleanupErr.code || 'CLEANUP_FAILED',
                abrechnungId: claimAbrechnungId,
              });
            }
          }
        }
      }

      // Safe coded error log (NO PHI, NO raw SQL/db messages)
      console.error('[zuzahlungsforderung] Vorgang fehlgeschlagen:', {
        code: err.code || 'CREATION_FAILED',
        status: err.status || 500,
        abrechnungId: claimAbrechnungId,
      });

      const userError = err.status
        ? (err.message || 'Verarbeitungsfehler bei der Zuzahlungsforderung.')
        : 'Serverfehler beim Erstellen der Zuzahlungsforderung.';

      return res.status(err.status || 500).json({
        error: userError,
        code: err.code || 'CREATION_FAILED',
        abrechnungId: claimAbrechnungId,
      });
    }
  });

  return router;
}

/**
 * Registriert die Zuzahlungsforderungs-Route auf einem bestehenden Express-Router.
 */
export function mountZuzahlungsforderungRoutes(router, deps) {
  const subRouter = createZuzahlungsforderungRouter(deps);
  router.use(subRouter);
}
