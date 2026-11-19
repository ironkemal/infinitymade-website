// Überblick-Datenaufbereitung (Fristen, Geburtstage, Nicht-Erscheiner, Abwesenheiten).
//
// Reine Funktionen ohne DOM- oder Supabase-Abhängigkeit, damit sämtliche Regeln
// (Gruppierung Fund 8, Dringlichkeits-Sortierung, Zeithorizonte, Filter) direkt
// mit node --test geprüft werden können.
import { datumDe } from './datum.js?v=20261001a';
import { behandlungsbeginnFrist, BEHANDLUNGSBEGINN_TAGE } from './heilmittel-fristen.js?v=20261004m113';

/**
 * Legacy-Helfer (Fund 8, QA TEST-Physio 17.11.2026):
 * Fasst wortgleiche Fristmeldungen zu einer Zeile mit Anzahl zusammen.
 *
 * @param {{type:string, text:string}[]} alerts  text ist bereits HTML-escaped
 * @returns {{type:string, text:string}[]}
 */
export function fristenGruppieren(alerts) {
  /** @type {Map<string, {type:string, text:string, anzahl:number}>} */
  const gruppen = new Map();
  for (const a of alerts || []) {
    const k = `${a.type}|${a.text}`;
    const g = gruppen.get(k);
    if (g) g.anzahl++; else gruppen.set(k, { ...a, anzahl: 1 });
  }
  return [...gruppen.values()].map(g => ({
    type: g.type,
    text: g.anzahl > 1 ? `${g.text} · ${g.anzahl} Verordnungen` : g.text,
  }));
}

const TYP = { urlaub: 'Urlaub', krank: 'Krank', frei: 'Frei', elternzeit: 'Elternzeit' };

/** @param {string|null|undefined} typ */
export function abwesenheitTyp(typ) {
  return TYP[/** @type {keyof typeof TYP} */ (String(typ || ''))] || String(typ || 'Abwesend');
}

/**
 * Filtert Abwesenheiten auf laufende oder in den nächsten `tageVoraus` Tagen beginnende.
 *
 * @template {{start_date?:string|null, end_date?:string|null}} T
 * @param {T[]} zeilen
 * @param {string} heute  'YYYY-MM-DD' (Berlin)
 * @param {number} [tageVoraus]
 * @returns {T[]}
 */
export function aktuelleAbwesenheiten(zeilen, heute, tageVoraus = 14) {
  const grenze = addiereTageIso(heute, tageVoraus);
  if (!grenze) return [];
  return (zeilen || []).filter(z => {
    const start = String(z?.start_date || '').slice(0, 10);
    const ende = String(z?.end_date || '').slice(0, 10);
    return ende >= heute && start <= grenze;
  });
}

/** @param {string|null|undefined} wert  ISO-Datum oder Zeitstempel */
export function datumMitJahr(wert) {
  return datumDe(String(wert || '').slice(0, 10), '—');
}

/**
 * Addiert `tage` zu einem ISO-Datum ('YYYY-MM-DD') rein in UTC-Tagesarithmetik (DST-sicher).
 * @param {string} iso
 * @param {number} tage
 * @returns {string|null}
 */
export function addiereTageIso(iso, tage) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').slice(0, 10));
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

/**
 * Differenz in Kalendertagen: `zielIso - basisIso` (positiv = in der Zukunft, negativ = überfällig).
 * @param {string} basisIso
 * @param {string} zielIso
 * @returns {number|null}
 */
export function tageDifferenzIso(basisIso, zielIso) {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(basisIso || '').slice(0, 10));
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(zielIso || '').slice(0, 10));
  if (!a || !b) return null;
  const tA = Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
  const tB = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]));
  return Math.round((tB - tA) / 86400000);
}

/**
 * Extrahiert 1–2 Initialen für ruhige Monogramm-Badges (kein Emoji).
 * @param {string|null|undefined} name
 * @returns {string}
 */
export function initialen(name) {
  const teile = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!teile.length) return '–';
  if (teile.length === 1) return teile[0].slice(0, 2).toUpperCase();
  return (teile[0][0] + teile[teile.length - 1][0]).toUpperCase();
}

/**
 * Diakritika-tolerante Teilstringsuche über beliebige Textfelder.
 * @param {string} suche
 * @param {(string|null|undefined)[]} felder
 * @returns {boolean}
 */
export function suchePasst(suche, felder) {
  const q = String(suche || '').trim().toLowerCase();
  if (!q) return true;
  const heuhaufen = (felder || []).filter(Boolean).join(' ').toLowerCase();
  return heuhaufen.includes(q);
}

/**
 * @typedef {object} FristEintrag
 * @property {string} schluessel
 * @property {'beginn'|'abrechnung'} art
 * @property {'ueberfaellig'|'bald'|'geplant'|'abrechnung'} kategorie
 * @property {'danger'|'warning'|'neutral'} schwere
 * @property {string} patientName
 * @property {string|null} patientId
 * @property {string|null} rxId
 * @property {'physio'|'podologie'} quelle
 * @property {boolean} dringend
 * @property {string} stichtagIso
 * @property {string} stichtagDe
 * @property {number} tageDiff
 * @property {string} fristLabel
 * @property {string} artLabel
 * @property {string} kontextMeta
 * @property {number} fortschrittProzent
 * @property {number} anzahl
 */

const KATEGORIE_RANG = { ueberfaellig: 0, bald: 1, geplant: 2, abrechnung: 3 };

/**
 * Wertet offene Verordnungen aus `prescriptions` zu strukturierten, gruppierten
 * und nach Dringlichkeit sortierten Frist-Einträgen aus.
 *
 * - Unbegonnene Verordnungen: 14 Tage (dringlich) / 28 Tage (regulär) ab Ausstellungsdatum (§ 15 HeilM-RL)
 * - Begonnene Verordnungen: 9-Monats-Abrechnungsfrist (274 Tage), angezeigt ab ≤ 60 Tagen Restzeit
 * - Gruppierung (Fund 8): gleiche (Patient, Art, Stichtag, Dringlichkeit) → 1 Zeile mit `anzahl`
 *
 * @param {Array<Record<string, any>>} rezepte
 * @param {string} heuteIso 'YYYY-MM-DD'
 * @returns {FristEintrag[]}
 */
export function fristenAuswerten(rezepte, heuteIso) {
  /** @type {Map<string, FristEintrag>} */
  const gruppen = new Map();

  for (const rx of rezepte || []) {
    const lead = rx?.leads || null;
    const patientName = [lead?.first_name, lead?.last_name].filter(Boolean).join(' ').trim() || 'Ohne Namen';
    const patientId = rx?.patient_id || lead?.id || null;
    const rxId = rx?.id || null;
    const quelle = rx?.therapie_bereich === 'podo' ? 'podologie' : 'physio';
    const dringend = !!rx?.is_dringend;
    const kontextTeile = [rx?.heilmittel, rx?.diagnosegruppe].map(s => String(s || '').trim()).filter(Boolean);
    const kontextMeta = kontextTeile.join(' · ');
    const gestartet = rx?.behandlungsbeginn ? String(rx.behandlungsbeginn).slice(0, 10) : null;

    if (!gestartet && rx?.ausstellungsdatum) {
      const fristIso = behandlungsbeginnFrist(String(rx.ausstellungsdatum).slice(0, 10), dringend);
      if (fristIso) {
        const diff = tageDifferenzIso(heuteIso, fristIso);
        if (diff !== null && diff <= 28) {
          const gesamtTage = dringend ? BEHANDLUNGSBEGINN_TAGE.dringend : BEHANDLUNGSBEGINN_TAGE.normal;
          const verstrichen = Math.max(0, gesamtTage - diff);
          const fortschrittProzent = Math.min(100, Math.max(6, Math.round((verstrichen / gesamtTage) * 100)));
          const kategorie = diff < 0 ? 'ueberfaellig' : diff <= 7 ? 'bald' : 'geplant';
          const schwere = diff < 0 ? 'danger' : diff <= 7 ? 'warning' : 'neutral';
          const fristLabel = diff < 0
            ? (Math.abs(diff) === 1 ? 'Seit 1 Tag überfällig' : `Seit ${Math.abs(diff)} Tagen überfällig`)
            : diff === 0
              ? 'Heute fällig'
              : diff === 1
                ? 'Morgen fällig'
                : `In ${diff} Tagen`;

          const key = `beginn|${patientId || patientName}|${fristIso}|${dringend ? '1' : '0'}`;
          const vorhanden = gruppen.get(key);
          if (vorhanden) {
            vorhanden.anzahl += 1;
            if (!vorhanden.kontextMeta && kontextMeta) vorhanden.kontextMeta = kontextMeta;
          } else {
            gruppen.set(key, {
              schluessel: key,
              art: 'beginn',
              kategorie,
              schwere,
              patientName,
              patientId,
              rxId,
              quelle,
              dringend,
              stichtagIso: fristIso,
              stichtagDe: datumDe(fristIso, '—'),
              tageDiff: diff,
              fristLabel,
              artLabel: dringend ? '14-Tage-Beginnfrist' : 'Behandlungsbeginn',
              kontextMeta,
              fortschrittProzent,
              anzahl: 1,
            });
          }
        }
      }
    }

    if (gestartet) {
      const frist9m = addiereTageIso(gestartet, 274);
      if (frist9m) {
        const diff = tageDifferenzIso(heuteIso, frist9m);
        if (diff !== null && diff <= 60) {
          const verstrichen = Math.max(0, 274 - diff);
          const fortschrittProzent = Math.min(100, Math.max(10, Math.round((verstrichen / 274) * 100)));
          const kategorie = diff <= 0 ? 'ueberfaellig' : 'abrechnung';
          const schwere = diff <= 0 ? 'danger' : diff <= 14 ? 'warning' : 'neutral';
          const fristLabel = diff < 0
            ? (Math.abs(diff) === 1 ? 'Seit 1 Tag abgelaufen' : `Seit ${Math.abs(diff)} Tagen abgelaufen`)
            : diff === 0
              ? 'Heute ablaufend'
              : diff === 1
                ? 'Noch 1 Tag'
                : `In ${diff} Tagen`;

          const key = `abrechnung|${patientId || patientName}|${frist9m}`;
          const vorhanden = gruppen.get(key);
          if (vorhanden) {
            vorhanden.anzahl += 1;
            if (!vorhanden.kontextMeta && kontextMeta) vorhanden.kontextMeta = kontextMeta;
          } else {
            gruppen.set(key, {
              schluessel: key,
              art: 'abrechnung',
              kategorie,
              schwere,
              patientName,
              patientId,
              rxId,
              quelle,
              dringend: false,
              stichtagIso: frist9m,
              stichtagDe: datumDe(frist9m, '—'),
              tageDiff: diff,
              fristLabel,
              artLabel: 'Abrechnungsfrist (9 Monate)',
              kontextMeta,
              fortschrittProzent,
              anzahl: 1,
            });
          }
        }
      }
    }
  }

  return [...gruppen.values()].sort((a, b) => {
    const rDiff = KATEGORIE_RANG[a.kategorie] - KATEGORIE_RANG[b.kategorie];
    if (rDiff !== 0) return rDiff;
    if (a.tageDiff !== b.tageDiff) return a.tageDiff - b.tageDiff;
    return a.patientName.localeCompare(b.patientName, 'de-DE');
  });
}

const MONATE_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

/**
 * Berechnet anstehende Geburtstage in den nächsten `tageVoraus` Tagen (DST-sicher, inkl. Alter).
 *
 * @param {Array<{id?:string, first_name?:string|null, last_name?:string|null, geburtsdatum?:string|null}>} leads
 * @param {string} heuteIso 'YYYY-MM-DD'
 * @param {number} [tageVoraus]
 */
export function geburtstageAufbereiten(leads, heuteIso, tageVoraus = 7) {
  const mHeute = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(heuteIso || '').slice(0, 10));
  if (!mHeute) return [];
  const jahrHeute = Number(mHeute[1]);
  const out = [];

  for (const p of leads || []) {
    const mGeb = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(p?.geburtsdatum || '').slice(0, 10));
    if (!mGeb) continue;
    const gebJahr = Number(mGeb[1]);
    const gebMonat = Number(mGeb[2]);
    const gebTag = Number(mGeb[3]);
    if (gebMonat < 1 || gebMonat > 12 || gebTag < 1 || gebTag > 31) continue;

    // 29.02. in Nicht-Schaltjahren auf 28.02. abbilden
    const tagInJahr = (j) => {
      const schalt = (j % 4 === 0 && j % 100 !== 0) || j % 400 === 0;
      const t = gebMonat === 2 && gebTag === 29 && !schalt ? 28 : gebTag;
      return `${j}-${String(gebMonat).padStart(2, '0')}-${String(t).padStart(2, '0')}`;
    };

    let zielJahr = jahrHeute;
    let zielIso = tagInJahr(zielJahr);
    let diff = tageDifferenzIso(heuteIso, zielIso);
    if (diff !== null && diff < 0) {
      zielJahr = jahrHeute + 1;
      zielIso = tagInJahr(zielJahr);
      diff = tageDifferenzIso(heuteIso, zielIso);
    }
    if (diff === null || diff < 0 || diff > tageVoraus) continue;

    const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || 'Ohne Namen';
    const alterWird = gebJahr > 1900 && zielJahr >= gebJahr ? zielJahr - gebJahr : null;
    const abstandLabel = diff === 0 ? 'Heute' : diff === 1 ? 'Morgen' : `In ${diff} Tagen`;
    out.push({
      patientId: p.id || null,
      name,
      initialen: initialen(name),
      datumKurz: `${String(gebTag).padStart(2, '0')}. ${MONATE_DE[gebMonat - 1]}`,
      alterWird,
      tageBis: diff,
      istHeute: diff === 0,
      abstandLabel,
    });
  }

  return out.sort((a, b) => a.tageBis - b.tageBis || a.name.localeCompare(b.name, 'de-DE'));
}

/**
 * Bereitet Abwesenheiten für den gewählten Zeithorizont (14 oder 30 Tage) auf.
 *
 * @param {Array<Record<string, any>>} zeilen
 * @param {string} heuteIso 'YYYY-MM-DD'
 * @param {number} [tageVoraus]
 */
export function abwesenheitenAufbereiten(zeilen, heuteIso, tageVoraus = 14) {
  const gefiltert = aktuelleAbwesenheiten(zeilen || [], heuteIso, tageVoraus);
  return gefiltert
    .map(v => {
      const startIso = String(v?.start_date || '').slice(0, 10);
      const endIso = String(v?.end_date || '').slice(0, 10);
      const empName = v?.profiles?.business_name
        || (v?.profiles?.email ? String(v.profiles.email).split('@')[0] : '')
        || 'Mitarbeiter';
      const tageBisStart = tageDifferenzIso(heuteIso, startIso) ?? 0;
      const tageBisEnde = tageDifferenzIso(heuteIso, endIso) ?? 0;
      const istAktiv = startIso <= heuteIso && endIso >= heuteIso;
      const startDe = datumMitJahr(startIso);
      const endDe = datumMitJahr(endIso);
      const zeitraum = startIso === endIso ? startDe : `${startDe} – ${endDe}`;
      const statusLabel = istAktiv
        ? (tageBisEnde === 0 ? 'Heute letzter Tag' : 'Aktiv')
        : (tageBisStart === 1 ? 'Ab morgen' : `In ${tageBisStart} Tagen`);
      return {
        id: v?.id || null,
        name: empName,
        initialen: initialen(empName),
        typKey: String(v?.type || 'frei'),
        typLabel: abwesenheitTyp(v?.type),
        startIso,
        endIso,
        zeitraum,
        istAktiv,
        tageBisStart,
        statusLabel,
      };
    })
    .sort((a, b) => {
      if (a.istAktiv !== b.istAktiv) return a.istAktiv ? -1 : 1;
      return a.startIso.localeCompare(b.startIso) || a.name.localeCompare(b.name, 'de-DE');
    });
}

/**
 * Bereitet die letzten Nicht-Erscheiner sauber für die Darstellung auf.
 *
 * @param {Array<Record<string, any>>} bookings
 * @param {string} heuteIso 'YYYY-MM-DD'
 */
export function nichtErscheinerAufbereiten(bookings, heuteIso) {
  return (bookings || []).map(b => {
    const startRaw = b?.start_time ? String(b.start_time) : '';
    const d = startRaw ? new Date(startRaw) : null;
    const gueltig = d && !Number.isNaN(d.getTime());
    const datumDeText = gueltig
      ? d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' })
      : '—';
    const zeitText = gueltig
      ? d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })
      : '';
    const tagIso = gueltig
      ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(d)
      : '';
    const diff = tagIso ? tageDifferenzIso(tagIso, heuteIso) : null;
    const vorText = diff === null
      ? ''
      : diff <= 0
        ? 'Heute'
        : diff === 1
          ? 'Gestern'
          : `vor ${diff} Tagen`;
    const name = String(b?.customer_name || '').trim() || 'Ohne Namen';
    const leistung = b?.services?.title ? String(b.services.title).trim() : '';
    return {
      id: b?.id || null,
      leadId: b?.lead_id || null,
      name,
      initialen: initialen(name),
      datumDe: datumDeText,
      zeitDe: zeitText,
      vorText,
      leistung,
    };
  });
}
