// Überblick-Datenaufbereitung (Praxis-Cockpit: Wochenauslastung, Fristen & Berichte,
// Vorgänge/Eingänge, Nicht-Erscheiner, Team-Abwesenheiten, Geburtstage).
//
// Reine Funktionen ohne DOM- oder Supabase-Abhängigkeit, vollständig unit-testbar.
import { datumDe } from './datum.js?v=20261001a';
import { behandlungsbeginnFrist, BEHANDLUNGSBEGINN_TAGE } from './heilmittel-fristen.js?v=20261121f01';
import { alsBerlinDatum } from './berlin-datum.js';
import { rxGeschlossen } from './termin-verordnung.js?v=20261119serie';

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
 * Differenz in Kalendertagen: `zielIso - basisIso` (positiv = Zukunft, negativ = überfällig).
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
 * Extrahiert 1–2 Initialen (Hilfsfunktion).
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
 * Fallunabhängige Teilstringsuche über beliebige Textfelder.
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
 * Bereinigt eine Telefonnummer zu einem sicheren `tel:`-Ziel (nur führendes `+` und Ziffern).
 * @param {string|null|undefined} nummer
 * @returns {{ anzeige: string, href: string } | null}
 */
export function telefonLink(nummer) {
  const roh = String(nummer || '').trim();
  if (!roh) return null;
  const fuehrendPlus = roh.startsWith('+');
  const ziffern = roh.replace(/[^\d]/g, '');
  if (ziffern.length < 4) return null;
  return {
    anzeige: roh,
    href: `tel:${fuehrendPlus ? '+' : ''}${ziffern}`,
  };
}

const WOCHENTAGE_KURZ = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONATE_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const MONATE_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

/**
 * Erzeugt die 7-Tage-Auslastung ab `heuteIso` (heute + 6 Folgetage).
 *
 * @param {Array<{start_time?:string|null, status?:string|null, hausbesuch?:boolean|null}>} bookings
 * @param {string} heuteIso 'YYYY-MM-DD'
 * @param {Date} [jetzt]
 */
export function wochenAuslastungAufbereiten(bookings, heuteIso, jetzt = new Date()) {
  const tage = [];
  const nachTag = new Map();
  for (let i = 0; i < 7; i++) {
    const iso = addiereTageIso(heuteIso, i);
    if (!iso) continue;
    const [j, m, t] = iso.split('-').map(Number);
    const wd = new Date(Date.UTC(j, m - 1, t)).getUTCDay();
    const eintrag = {
      tagIso: iso,
      wochentag: WOCHENTAGE_KURZ[wd],
      tagKurz: `${t}.`,
      istHeute: i === 0,
      istWochenende: wd === 0 || wd === 6,
      anzahl: 0,
      hausbesuche: 0,
      offenHeute: 0,
      prozent: 0,
    };
    tage.push(eintrag);
    nachTag.set(iso, eintrag);
  }

  const jetztMs = jetzt.getTime();
  let gesamt7 = 0;
  let hausbesuche7 = 0;

  for (const b of bookings || []) {
    if (!b?.start_time) continue;
    if (b.status === 'cancelled') continue;
    const tagIso = alsBerlinDatum(b.start_time);
    const slot = nachTag.get(tagIso);
    if (!slot) continue;
    slot.anzahl += 1;
    gesamt7 += 1;
    if (b.hausbesuch) {
      slot.hausbesuche += 1;
      hausbesuche7 += 1;
    }
    if (slot.istHeute && b.status !== 'completed' && b.status !== 'no_show') {
      const ms = Date.parse(b.start_time);
      if (Number.isNaN(ms) || ms >= jetztMs - 15 * 60000) slot.offenHeute += 1;
    }
  }

  const maxTag = Math.max(6, ...tage.map(t => t.anzahl));
  for (const t of tage) {
    t.prozent = t.anzahl > 0 ? Math.max(14, Math.min(100, Math.round((t.anzahl / maxTag) * 100))) : 0;
  }

  const heute = tage[0] || { anzahl: 0, hausbesuche: 0, offenHeute: 0 };
  return {
    tage,
    heuteGesamt: heute.anzahl,
    heuteOffen: heute.offenHeute,
    heuteHausbesuche: heute.hausbesuche,
    gesamt7,
    hausbesuche7,
  };
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
 * @param {Array<Record<string, any>>} rezepte
 * @param {string} heuteIso 'YYYY-MM-DD'
 * @returns {FristEintrag[]}
 */
export function fristenAuswerten(rezepte, heuteIso) {
  /** @type {Map<string, FristEintrag>} */
  const gruppen = new Map();

  for (const rx of rezepte || []) {
    if (!rx || rxGeschlossen(rx)) continue;
    const lead = rx?.leads || null;
    const patientName = [lead?.first_name, lead?.last_name].filter(Boolean).join(' ').trim() || 'Ohne Namen';
    const patientId = rx?.patient_id || lead?.id || null;
    const telefon = telefonLink(lead?.handy || lead?.phone);
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
              telefon,
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
              telefon,
              rxId,
              quelle,
              dringend: false,
              stichtagIso: frist9m,
              stichtagDe: datumDe(frist9m, '—'),
              tageDiff: diff,
              fristLabel,
              artLabel: 'Abrechnungsfrist (9 Mon.)',
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

/**
 * Kennzahlen für die Dashboard-Rezeptkarte (`#physioRezKpi`) aus derselben
 * Berechnungsquelle wie der Überblick (`fristenAuswerten`), damit „überfällig“
 * und „in ≤7 Tagen“ auf Dashboard und Überblick garantiert übereinstimmen (F-01).
 *
 * - Entwürfe (`status === 'parsed'`) zählen mit.
 * - Geschlossene Verordnungen (`completed`, `billed`, `cancelled` sowie
 *   abgerechnete/stornierte/archivierte Podologie-VOs via `rxGeschlossen`) werden
 *   ausgeschlossen.
 *
 * @param {Array<Record<string, any>>} rezepte
 * @param {string} heuteIso  'YYYY-MM-DD' (Europe/Berlin)
 * @returns {{ overdue: Array<Record<string, any>>, soon: Array<Record<string, any>>, active: Array<Record<string, any>>, fristen: FristEintrag[] }}
 */
export function rezKpiAuswerten(rezepte, heuteIso) {
  const offene = (rezepte || []).filter(rx => rx && !rxGeschlossen(rx));
  const fristen = fristenAuswerten(offene, heuteIso);
  const overdue = fristen
    .filter(f => f.kategorie === 'ueberfaellig')
    .map(f => ({ ...f, id: f.rxId, patient_id: f.patientId }));
  const soon = fristen
    .filter(f => f.kategorie === 'bald')
    .map(f => ({ ...f, id: f.rxId, patient_id: f.patientId }));
  const active = offene.filter(rx => rx.status === 'in_therapy');
  return { overdue, soon, active, fristen };
}

/**
 * Filtert Rezepte mit offenem Prüfbedarf:
 *  - Kassen-Absetzungen (`abrechnung_status` in `'rejected' | 'teilabsetzung'` laut DB-CHECK) — höchste Priorität
 *  - Noch unbestätigte OCR-Scans (`status === 'parsed'`)
 *
 * @param {Array<Record<string, any>>} rezepte
 */
export function rezeptPruefbedarfAufbereiten(rezepte) {
  const out = [];
  for (const rx of rezepte || []) {
    if (!rx || rxGeschlossen(rx)) continue;
    const istTeilabsetzung = rx?.abrechnung_status === 'teilabsetzung';
    const absetzung = rx?.abrechnung_status === 'rejected' || istTeilabsetzung;
    const scanOffen = rx?.status === 'parsed';
    if (!absetzung && !scanOffen) continue;
    const lead = rx?.leads || null;
    const patientName = [lead?.first_name, lead?.last_name].filter(Boolean).join(' ').trim() || 'Ohne Namen';
    const kontextMeta = [rx?.heilmittel, rx?.diagnosegruppe].map(s => String(s || '').trim()).filter(Boolean).join(' · ');
    out.push({
      rxId: rx?.id || null,
      patientId: rx?.patient_id || lead?.id || null,
      quelle: rx?.therapie_bereich === 'podo' ? 'podologie' : 'physio',
      patientName,
      telefon: telefonLink(lead?.handy || lead?.phone),
      art: absetzung ? 'absetzung' : 'scan',
      schwere: absetzung ? 'danger' : 'warning',
      etikett: istTeilabsetzung ? 'Teilabsetzung' : absetzung ? 'Absetzung' : 'Scan offen',
      hinweis: istTeilabsetzung ? 'Teilabsetzung prüfen' : absetzung ? 'Kassen-Absetzung prüfen' : 'Rezept-Scan bestätigen',
      kontextMeta: kontextMeta || 'Verordnung',
      ausgestelltDe: rx?.ausstellungsdatum ? datumMitJahr(rx.ausstellungsdatum) : '—',
    });
  }
  return out.sort((a, b) => (a.art === b.art ? a.patientName.localeCompare(b.patientName, 'de-DE') : a.art === 'absetzung' ? -1 : 1));
}

/**
 * Filtert offene angeforderte Therapieberichte aus bereits geladenen Verordnungen.
 * @param {Array<Record<string, any>>} rezepte
 */
export function therapieberichteAufbereiten(rezepte) {
  return (rezepte || [])
    .filter(rx => rx && !rxGeschlossen(rx) && rx?.bericht_angefordert && rx?.bericht_status === 'offen')
    .map(rx => {
      const lead = rx?.leads || null;
      const patientName = [lead?.first_name, lead?.last_name].filter(Boolean).join(' ').trim() || 'Ohne Namen';
      const kontextMeta = [rx?.heilmittel, rx?.diagnosegruppe].map(s => String(s || '').trim()).filter(Boolean).join(' · ');
      return {
        rxId: rx?.id || null,
        patientId: rx?.patient_id || lead?.id || null,
        quelle: rx?.therapie_bereich === 'podo' ? 'podologie' : 'physio',
        patientName,
        kontextMeta: kontextMeta || 'Verordnung',
        ausgestelltDe: rx?.ausstellungsdatum ? datumMitJahr(rx.ausstellungsdatum) : '—',
      };
    })
    .sort((a, b) => a.patientName.localeCompare(b.patientName, 'de-DE'));
}

const ZAHLUNG_LABEL = {
  gkv: 'GKV',
  pkv: 'PKV',
  privat: 'Privat',
  selbstzahler: 'Selbstzahler',
  bg: 'BG',
};

/**
 * Bereitet offene Online-Terminanfragen (`booking_requests`) auf.
 * @param {Array<Record<string, any>>} anfragen
 * @param {string} heuteIso
 */
export function anfragenAufbereiten(anfragen, heuteIso) {
  return (anfragen || []).map(a => {
    const p = a?.patients || null;
    const name = [p?.vorname, p?.nachname].filter(Boolean).join(' ').trim() || 'Anfrage';
    const wunschDatum = a?.preferred_date ? datumMitJahr(a.preferred_date) : 'Flexibel';
    const wunschZeit = a?.preferred_time ? String(a.preferred_time).slice(0, 5) : '';
    const art = ZAHLUNG_LABEL[/** @type {keyof typeof ZAHLUNG_LABEL} */ (String(a?.payment_type || '').toLowerCase())] || String(a?.payment_type || '');
    const erstelltTag = a?.created_at ? alsBerlinDatum(a.created_at) : '';
    const diff = erstelltTag ? tageDifferenzIso(erstelltTag, heuteIso) : null;
    const alterLabel = diff === null ? '' : diff <= 0 ? 'Heute' : diff === 1 ? 'Gestern' : `vor ${diff} T.`;
    return {
      id: a?.id || null,
      name,
      wunsch: wunschZeit ? `${wunschDatum} · ${wunschZeit}` : wunschDatum,
      art,
      leistung: String(a?.behandlungsart || '').trim(),
      alterLabel,
    };
  });
}

/**
 * Bereitet wartende Einträge der `warteliste` auf (höchste Priorität zuerst).
 * @param {Array<Record<string, any>>} eintraege
 * @param {string} heuteIso
 */
export function wartelisteAufbereiten(eintraege, heuteIso) {
  return (eintraege || [])
    .map(w => {
      const lead = w?.leads || null;
      const name = [lead?.first_name, lead?.last_name].filter(Boolean).join(' ').trim() || 'Patient';
      const prio = Number(w?.priority) || 1;
      const prioLabel = prio >= 3 ? 'Dringend' : prio === 2 ? 'Erhöht' : 'Normal';
      const erstelltTag = w?.created_at ? alsBerlinDatum(w.created_at) : '';
      const diff = erstelltTag ? tageDifferenzIso(erstelltTag, heuteIso) : null;
      const wartetLabel = diff === null ? '' : diff <= 0 ? 'Seit heute' : diff === 1 ? 'Seit 1 Tag' : `Seit ${diff} Tagen`;
      return {
        id: w?.id || null,
        leadId: w?.lead_id || lead?.id || null,
        name,
        leistung: String(w?.services?.title || '').trim(),
        prio,
        prioLabel,
        wartetLabel,
      };
    })
    .sort((a, b) => b.prio - a.prio || a.name.localeCompare(b.name, 'de-DE'));
}

/**
 * Bereitet offene `praxis_aufgaben` auf (überfällige und fällige zuerst).
 * @param {Array<Record<string, any>>} aufgaben
 * @param {string} heuteIso
 */
export function aufgabenAufbereiten(aufgaben, heuteIso) {
  return (aufgaben || [])
    .map(a => {
      const lead = a?.leads || null;
      const patientName = [lead?.first_name, lead?.last_name].filter(Boolean).join(' ').trim();
      const faelligIso = a?.faellig_am ? String(a.faellig_am).slice(0, 10) : '';
      const diff = faelligIso ? tageDifferenzIso(heuteIso, faelligIso) : null;
      const ueberfaellig = diff !== null && diff < 0;
      const faelligLabel = !faelligIso
        ? 'Ohne Datum'
        : diff === 0
          ? 'Heute'
          : diff === 1
            ? 'Morgen'
            : diff !== null && diff < 0
              ? `${Math.abs(diff)} T. überfällig`
              : datumMitJahr(faelligIso);
      return {
        id: a?.id || null,
        leadId: a?.lead_id || lead?.id || null,
        erstelltVon: a?.erstellt_von || null,
        patientName,
        text: String(a?.text || '').trim() || 'Aufgabe',
        faelligIso,
        faelligLabel,
        ueberfaellig,
        sortRang: ueberfaellig ? 0 : diff === 0 ? 1 : faelligIso ? 2 : 3,
      };
    })
    .sort((a, b) => a.sortRang - b.sortRang || (a.faelligIso || '9999').localeCompare(b.faelligIso || '9999'));
}

/**
 * Bereitet offene gesendete Rechnungen (`invoices`) für Inhaber auf.
 * @param {Array<Record<string, any>>} rechnungen
 * @param {string} heuteIso
 */
export function rechnungenAufbereiten(rechnungen, heuteIso) {
  let summeEur = 0;
  let ueberfaelligAnzahl = 0;
  const liste = (rechnungen || []).map(r => {
    const betrag = Number(r?.brutto_gesamt ?? r?.total_patient ?? 0) || 0;
    summeEur += betrag;
    const datumIso = r?.issued_at ? String(r.issued_at).slice(0, 10) : '';
    const tageOffen = datumIso ? (tageDifferenzIso(datumIso, heuteIso) ?? 0) : 0;
    const ueberfaellig = tageOffen > 14;
    if (ueberfaellig) ueberfaelligAnzahl += 1;
    return {
      id: r?.id || null,
      leadId: r?.lead_id || null,
      nummer: String(r?.invoice_number || '').trim() || 'Rechnung',
      patientName: String(r?.patient_name || '').trim() || 'Ohne Namen',
      betrag,
      datumDe: datumIso ? datumMitJahr(datumIso) : '—',
      tageOffen,
      ueberfaellig,
      offenLabel: tageOffen <= 0 ? 'Heute gestellt' : `Offen seit ${tageOffen} T.`,
    };
  });
  return { liste, summeEur, ueberfaelligAnzahl };
}

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
    const abstandLabel = diff === 0 ? 'Heute' : diff === 1 ? 'Morgen' : `In ${diff} T.`;
    out.push({
      patientId: p.id || null,
      name,
      initialen: initialen(name),
      datumKurz: `${String(gebTag).padStart(2, '0')}. ${MONATE_DE[gebMonat - 1]}`,
      datumKompakt: `${gebTag}. ${MONATE_KURZ[gebMonat - 1]}`,
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
        ? (tageBisEnde === 0 ? 'Letzter Tag' : 'Aktiv')
        : (tageBisStart === 1 ? 'Ab morgen' : `In ${tageBisStart} T.`);
      return {
        id: v?.id || null,
        employeeId: v?.employee_id || v?.profiles?.id || null,
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
    const tagIso = gueltig ? alsBerlinDatum(d) : '';
    const diff = tagIso ? tageDifferenzIso(tagIso, heuteIso) : null;
    const vorText = diff === null
      ? ''
      : diff <= 0
        ? 'Heute'
        : diff === 1
          ? 'Gestern'
          : `vor ${diff} T.`;
    const name = String(b?.customer_name || '').trim() || 'Ohne Namen';
    const leistung = b?.services?.title ? String(b.services.title).trim() : '';
    const telefon = telefonLink(b?.leads?.handy || b?.leads?.phone || b?.customer_phone);
    return {
      id: b?.id || null,
      leadId: b?.lead_id || null,
      userId: b?.user_id || null,
      name,
      initialen: initialen(name),
      telefon,
      datumDe: datumDeText,
      zeitDe: zeitText,
      vorText,
      leistung,
    };
  });
}
