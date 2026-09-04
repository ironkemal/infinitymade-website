/**
 * verordnung-detail.js — die untere Hälfte der Seite „Verordnungen":
 * eine aufgeschlagene Verordnung, links ihre Daten, rechts Verschreibung und
 * Termine.
 *
 * Befund (Kemal, 17.08.2026):
 *   „Eine angelegte Verordnung können wir nicht mehr aufmachen. Wenn man
 *   draufklickt, sollte sie zeigen, was wir vorher eingetragen haben."
 *
 * Vorher gab es genau eine Stelle, die eine Verordnung anzeigte:
 * `openPatRxDetail()` in `dashboard.js`, erreichbar nur über die
 * Qikbee-Tabelle unter „Patienten" — und dort standen zehn Felder. Alles, was
 * die Muster-13-Maske sonst noch speichert (Diagnosegruppe, Leitsymptomatik,
 * Einheiten, Frequenz, LANR/BSNR, Zuzahlung, Therapiebericht, Hinweise), war
 * nach dem Speichern nicht mehr einsehbar.
 *
 * Umbau in zwei Hälften (Kemal, 31.08.2026)
 * ─────────────────────────────────────────
 *   „In [der] unteren Hälfte von [der] Seite: da hat man für [den]
 *    ausgewählten Patienten alle möglichen Daten … rechte Seite sozusagen so
 *    20–30% von der Seite, da[mit] man die Termine sieht. … Darüber eine
 *    Verschreibung"
 *
 * Daraus die Aufteilung unten: links die Felder der Verordnung, rechts eine
 * schmale Spalte mit der Verschreibung (was an dieser Verordnung erbracht und
 * gebucht wurde) und darunter die Termine, getrennt in vergeben und unvergeben.
 * Die Spalte wird nicht über eine Medienabfrage schmal gehalten, sondern über
 * `flex-wrap`: auf dem Telefon rutscht sie unter die Felder, ohne dass es dafür
 * einen eigenen Breakpoint braucht.
 *
 * Beide Zweige
 * ────────────
 * Diese Datei bedient BEIDE Fachbereichs-Zweige:
 *
 *   Physio · Ergo · Logo   | prescriptions (therapie_bereich ≠ 'podo') | prescription_sessions
 *   Podologie              | prescriptions (therapie_bereich = 'podo') | podologie_behandlungen
 *
 * Bis 31.08.2026 war nur der erste dabei; der Kopf dieser Datei sagte
 * ausdrücklich, Podologie werde „hier NICHT mitbedient". Das ist die Zeile, die
 * der Umbau umdreht — für einen Podologen war die Seite sonst leer.
 *
 * Seit 04.09.2026 (Zusammenlegung der Verordnungstöpfe) stehen beide Zweige in
 * DERSELBEN Tabelle — vorher zwei getrennte (`prescriptions` + `verordnungen`).
 * Diese Datei behält trotzdem zwei Lader und zwei Feldlisten: `zeigeVerordnungDetail()`
 * übersetzt eine podologische Zeile über `module/verordnung-topf.js` (`ausTopf()`)
 * zurück in den podologischen Wortschatz, den `_felderPodo()` & Co. schon immer
 * erwarteten (`icd10` als Array statt Spalte, `behandlungseinheiten` statt
 * `anzahl_einheiten`) — die beiden Vokabulare bleiben verschieden, nur die
 * Tabelle darunter ist jetzt eine.
 *
 * Lesen — mit genau EINER Ausnahme
 * ────────────────────────────────
 * Diese Ansicht hat bewusst kein Formular. Ein Teil der Felder ist nach der
 * Abrechnung eingefroren (`belegnummer`, Anlage 1 TP5 V21 Kap. 7.3), und im
 * Physio-Topf hängen die Sitzungszeilen an `anzahl_einheiten` (siehe
 * `module/sitzung-abgleich.js`). Ein allgemeiner Bearbeiten-Pfad muss beides
 * mitdenken und ist ein eigenes Stück Arbeit — nicht ein Nebeneffekt der
 * Ansicht.
 *
 * Die Ausnahme ist die verordnete Menge im PODOLOGIE-Topf (Beta-1, 31.08.2026:
 * nach der Eingangsbefundung steht oft erst fest, wie viele Einheiten nötig
 * sind). Sie ist dort gefahrlos änderbar, weil die Zuzahlung nicht an ihr
 * hängt, sondern an den dokumentierten Positionen. Riegel, Prüfung und
 * Schreibweg stehen in `module/verordnung-einheiten.js`; im Physio-Topf bleibt
 * das Feld unangetastet — dort wäre es zugleich eine Geldänderung und gehört
 * über `module/zuzahlung-korrektur.js`.
 */

import { belegnummerText } from './belegnummer.js?v=20260817';
import { statusBadgeGross, bereichBadge } from './abrechnungsstatus.js?v=20260903';
import { podoPositionsFinder } from './podologie-positionen.js?v=20260902';
import { zuzahlungFuerPodoVerordnung } from './zuzahlung-rechnen.js?v=20260902';
import { einheitenAenderungErlaubt, pruefeNeueMenge, speichereEinheiten } from './verordnung-einheiten.js?v=20260902';
import { ladePodoTermine, terminZaehler, istVergeben, bindeTermin, loeseTermin } from './verordnung-termine.js?v=20260903';
import { emit } from './signal.js?v=20260813';
// Seit 04.09.2026 EIN Verordnungstopf (`prescriptions`). `ausTopf()` übersetzt
// eine podologische Zeile in den Wortschatz, den `_felderPodo()` und die
// restlichen Podologie-Funktionen dieser Datei schon immer erwartet haben.
import { ausTopf } from './verordnung-topf.js?v=20260904';

/** Alles, was die Muster-13-Maske schreibt — plus Patient, Arzt und Nummer. */
const SELECT_PHYSIO = `
  *,
  leads!patient_id ( id, first_name, last_name, title, geburtsdatum,
                     versichertennummer, versichertenstatus, krankenkasse,
                     patientennummer ),
  aerzte!arzt_id ( arzt_name, lanr, bsnr, fachrichtung ),
  prescription_sessions ( id, session_number, status, booking_id,
                          bookings!booking_id ( start_time, status, no_show ) )
`;

/**
 * Podologie-Gegenstück. `podologie_behandlungen` hängt an der Verordnung und
 * trägt kein `lead_id` — deshalb kommt es über den Verbund und nicht über den
 * Patienten.
 */
const SELECT_PODO = `
  *,
  leads!patient_id ( id, first_name, last_name, geburtsdatum,
                  versichertennummer, versichertenstatus, krankenkasse,
                  patientennummer ),
  aerzte!arzt_id ( arzt_name, lanr, bsnr, fachrichtung ),
  podologie_behandlungen ( id, behandlungsdatum, hpnr_codes, lokalisation,
                           betrag_gkv, invoice_id, notizen )
`;

const BERICHT_LABEL = {
  offen: 'offen', erstellt: 'erstellt', versendet: 'versendet'
};

function _datum(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? String(d) : dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function _datumZeit(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  return dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
       + ' · ' + dt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function _euro(v) {
  if (v === null || v === undefined || v === '') return '—';
  return Number(v).toFixed(2).replace('.', ',') + ' €';
}

function _jaNein(v) {
  if (v === true) return 'ja';
  if (v === false) return 'nein';
  return '—';
}

/**
 * Ein Feld im Raster. Leere Werte werden zu `—`, damit die Lücke sichtbar ist:
 * bei einer Kassenverordnung ist ein fehlendes Pflichtfeld eine Information,
 * kein Grund, die Zeile wegzulassen.
 */
function _feld(label, wert, esc, opt = {}) {
  const leer = wert === null || wert === undefined || wert === '' || wert === '—';
  const text = leer ? '—' : String(wert);
  const mono = opt.mono ? 'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;' : '';
  const farbe = leer ? 'var(--text-muted)' : 'var(--text-main)';
  return `<div>
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px;">${esc(label)}</div>
    <div style="color:${farbe};${mono}${opt.fett ? 'font-weight:600;' : ''}">${esc(text)}</div>
  </div>`;
}

/**
 * Ein Abschnitt der linken Spalte (Verordnung, Diagnose, Heilmittel, Arzt …)
 * als eigene Karte — derselbe Rahmen/Radius/Hintergrund wie `_spaltenKasten`
 * rechts (Verschreibung, Termine).
 *
 * Kemal, 03.09.2026: „hala frontend olarak zayıf" — vorher stand hier nur
 * eine Überschrift über frei fliessendem Text, ohne Kante zwischen den
 * Abschnitten. Auf einer Verordnung mit vielen Feldern (Podologie: sieben
 * Abschnitte) lief das optisch ineinander. Jetzt trägt jeder Abschnitt seine
 * eigene Karte, wie rechts schon die Verschreibung ihre trägt — eine
 * Formsprache für beide Spalten statt zwei.
 */
function _block(titel, felder, esc) {
  const inhalt = felder.filter(Boolean).join('');
  if (!inhalt) return '';
  return `<div style="border:1px solid var(--border);border-radius:10px;padding:12px 14px;background:var(--bg-card);margin-top:12px;">
    ${_ueberschrift(titel, esc)}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;">${inhalt}</div>
  </div>`;
}

/** Freitext (Hinweise/Notizen) als dieselbe Karte wie `_block`, statt frei fliessend. */
function _freitextBlock(titel, text, esc) {
  if (!text) return '';
  return `<div style="border:1px solid var(--border);border-radius:10px;padding:12px 14px;background:var(--bg-card);margin-top:12px;">
    ${_ueberschrift(titel, esc)}
    <div style="color:var(--text-main);white-space:pre-wrap;">${esc(text)}</div>
  </div>`;
}

function _ueberschrift(titel, esc) {
  return `<div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px;">${esc(titel)}</div>`;
}

/**
 * Die Merkmale, die ein Rezept ausmachen (dringlich, Hausbesuch, Blanko …),
 * als Reihe kleiner Rosetten. Nur gesetzte Merkmale werden gezeigt — eine Liste
 * aus acht „nein" liest niemand.
 */
function _merkmale(rx, esc, quelle) {
  const an = [];
  const dringend = quelle === 'podologie' ? rx.dringend : rx.is_dringend;
  if (dringend) an.push(['Dringlicher Behandlungsbedarf', '#ef4444']);
  if (rx.hausbesuch) an.push(['Hausbesuch', '#38bdf8']);
  if (rx.is_blanko) an.push(['Blankoverordnung', '#a855f7']);
  if (rx.is_lhb_bvb) an.push(['LHB/BVB', '#a855f7']);
  if (rx.zuzahlung_befreit) an.push(['Zuzahlungsbefreit', '#22c55e']);
  if (rx.bericht_angefordert || rx.therapiebericht) an.push(['Therapiebericht angefordert', '#f59e0b']);
  if (rx.unterschrift_vorhanden === false) an.push(['Unterschrift fehlt', '#ef4444']);
  if (rx.proceed_anyway) an.push(['Trotz Lücken gespeichert', '#f59e0b']);
  if (!an.length) return '';
  return `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;">` + an.map(([txt, farbe]) =>
    `<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:12px;border:1px solid ${farbe};color:${farbe};">${esc(txt)}</span>`
  ).join('') + '</div>';
}

/* ═══════════════════════════════════════════════════════════════════════════
   Rechte Spalte: Verschreibung und Termine
   ═══════════════════════════════════════════════════════════════════════════ */

function _spaltenKasten(titel, inhalt, esc) {
  return `<div style="border:1px solid var(--border);border-radius:10px;padding:12px 14px;background:var(--bg-card);">
    ${_ueberschrift(titel, esc)}
    ${inhalt}
  </div>`;
}

const _LEER = (text, esc) => `<div style="font-size:12px;color:var(--text-muted);">${esc(text)}</div>`;

/**
 * Der Fuss der Verschreibung: Gesamtbetrag und Anteil des Patienten.
 *
 * Beta-1, 31.08.2026 — „dass er die Summe schon automatisch ausrechnet".
 * Gemeint ist der Kontrollblick VOR der Abrechnung: kommen an einem Tag
 * podologische Behandlung und Befundung zusammen, stand der Gesamtbetrag
 * bisher nirgends und wurde von Hand nachgerechnet.
 *
 * Gerechnet wird in `module/zuzahlung-rechnen.js` — dieselbe Datei, die gegen
 * den Backend-Calculator testverriegelt ist. Hier wird nur gezeigt.
 *
 * `unbekannt` ist wichtig genug für eine eigene Zeile: eine Position ohne
 * Katalogtreffer geht mit 0 € in die Summe ein und sieht dann aus wie eine
 * vollständige Rechnung, die sie nicht ist.
 */
function _summeHtml(summe, esc) {
  if (!summe) return '';
  const zeile = (label, wert, fett) =>
    `<div style="display:flex;justify-content:space-between;gap:8px;${fett ? 'font-weight:700;' : ''}">
       <span style="font-size:${fett ? 12 : 11}px;color:${fett ? 'var(--text-main)' : 'var(--text-muted)'};">${esc(label)}</span>
       <span style="font-size:${fett ? 13 : 11}px;color:var(--text-main);white-space:nowrap;">${esc(wert)}</span>
     </div>`;

  return `<div style="border-top:2px solid var(--border);margin-top:6px;padding-top:6px;display:flex;flex-direction:column;gap:3px;">
    ${zeile('Gesamt', _euro(summe.brutto), true)}
    ${summe.befreit
      ? zeile('Zuzahlung', 'befreit')
      : zeile(`Zuzahlung (${_euro(summe.prozent)} + ${_euro(summe.pauschale)} Pauschale)`, _euro(summe.gesamt))}
    ${summe.unbekannt?.length
      ? `<div style="font-size:11px;color:var(--warning,#f59e0b);margin-top:4px;">Ohne Preis im Katalog: ${esc(summe.unbekannt.join(', '))} — die Summe ist unvollständig.</div>`
      : ''}
  </div>`;
}

/**
 * „Verschreibung" — was an dieser Verordnung tatsächlich erbracht und gebucht
 * wurde. Kemal nennt so die Liste der gebuchten Leistungen; sie steht über den
 * Terminen, weil sie die Frage „was ist bisher gelaufen" beantwortet, während
 * die Termine die Frage „was steht noch an" beantworten.
 *
 * Podologie: eine Zeile je `podologie_behandlungen` mit ihren HPNR-Positionen.
 * Physio: die erledigten Sitzungen.
 */
function _verschreibung(rx, esc, quelle, summe) {
  if (quelle === 'podologie') {
    const behs = (Array.isArray(rx.podologie_behandlungen) ? rx.podologie_behandlungen : [])
      .slice()
      .sort((a, b) => String(a.behandlungsdatum || '').localeCompare(String(b.behandlungsdatum || '')));
    if (!behs.length) return _spaltenKasten('Verschreibung', _LEER('Noch keine Behandlung dokumentiert.', esc), esc);

    const zeilen = behs.map(b => {
      const codes = Array.isArray(b.hpnr_codes) ? b.hpnr_codes.filter(Boolean) : [];
      // `invoice_id` gesetzt heisst: diese Sitzung steht bereits auf einer
      // Rechnung. Ohne diesen Hinweis liesse sich dieselbe Sitzung zweimal
      // berechnen (deshalb trägt die Spalte es überhaupt).
      const berechnet = b.invoice_id
        ? '<span title="Steht bereits auf einer Rechnung" style="font-size:10px;color:var(--text-muted);">berechnet</span>'
        : '';
      return `<div style="display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-top:1px solid var(--border);">
        <div style="min-width:0;">
          <div style="font-size:12px;color:var(--text-main);">${esc(_datum(b.behandlungsdatum))}</div>
          <div style="font-size:11px;color:var(--text-muted);word-break:break-word;">${esc(codes.join(' · ') || '—')}</div>
          ${b.lokalisation ? `<div style="font-size:11px;color:var(--text-muted);">${esc(b.lokalisation)}</div>` : ''}
        </div>
        <div style="text-align:right;white-space:nowrap;">
          <div style="font-size:12px;color:var(--text-main);">${esc(_euro(b._betrag ?? b.betrag_gkv))}</div>
          ${berechnet}
        </div>
      </div>`;
    }).join('');

    return _spaltenKasten('Verschreibung', zeilen + _summeHtml(summe, esc), esc);
  }

  const sitzungen = (Array.isArray(rx.prescription_sessions) ? rx.prescription_sessions : [])
    .filter(s => s.status === 'done' || s.status === 'completed')
    .sort((a, b) => (a.session_number || 0) - (b.session_number || 0));
  if (!sitzungen.length) return _spaltenKasten('Verschreibung', _LEER('Noch keine erbrachte Sitzung.', esc), esc);

  const zeilen = sitzungen.map(s => `<div style="display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-top:1px solid var(--border);">
      <span style="font-size:12px;color:var(--text-main);">${s.session_number ? `${s.session_number}. Sitzung` : 'Sitzung'}</span>
      <span style="font-size:11px;color:var(--text-muted);white-space:nowrap;">${esc(s.bookings?.start_time ? _datum(s.bookings.start_time) : '—')}</span>
    </div>`).join('');

  return _spaltenKasten('Verschreibung', zeilen, esc);
}

/**
 * Termine der Verordnung, getrennt in vergeben und unvergeben.
 *
 * Beta-1, 31.08.2026: aus der unvergebenen Liste soll sich EIN Termin gezielt
 * vergeben lassen, nicht gleich mehrere. Deshalb steht hier jede offene Einheit
 * als eigene Zeile und nicht als blosse Zahl.
 *
 * Die beiden Töpfe verknüpfen Termin und Verordnung verschieden, und das ist
 * Absicht (Entscheidung vom 03.09.2026, Begründung in `db/REGISTER.md`):
 *
 *   Physio: `prescription_sessions.booking_id` — leer heisst unvergeben. Die
 *     Zeilen legt `saveRezept` in Höhe der verordneten Einheiten an; fehlende
 *     zieht `module/sitzung-abgleich.js` nach. Es gibt also je Einheit eine
 *     Zeile, die man anfassen kann.
 *   Podologie: `bookings.verordnung_id` — dort gibt es kein Einheiten-Hauptbuch,
 *     „unvergeben" ist deshalb eine Restzahl und keine Zeile. Zählregeln und
 *     Schreibweg stehen in `module/verordnung-termine.js`.
 */
/**
 * Podologie: die Termine dieser Verordnung, und daneben die, die man ihr noch
 * zuordnen kann.
 *
 * Beta-1, 31.08.2026, wörtlich: „Dann entscheide dich zwischen beiden, was ich
 * auswähle." Deshalb steht jeder zuordenbare Termin als eigene Zeile mit
 * eigenem Knopf — es gibt bewusst kein „alle zuordnen".
 *
 * Zählregeln (abgesagte Termine, fehlende Einheitenzahl) stehen in
 * `module/verordnung-termine.js` und werden hier nur angezeigt.
 */
function _terminePodo(rx, esc, termine) {
  const vergeben   = termine?.vergeben   || [];
  const kandidaten = termine?.kandidaten || [];
  const { verordnet, belegt, offen } = terminZaehler(rx, vergeben);

  const knopfStil = 'font-size:11px;padding:2px 8px;border-radius:6px;border:1px solid var(--border);'
    + 'background:var(--bg-card-solid,#1f2937);color:var(--text-main);cursor:pointer;white-space:nowrap;';

  const zaehler = verordnet === null
    // `behandlungseinheiten` ist NULLABLE und live gibt es solche Zeilen. Eine
    // Restmenge zu behaupten, die niemand erfasst hat, wäre eine erfundene Zahl.
    ? `<div style="font-size:12px;color:var(--text-muted);">
         <span style="font-size:18px;font-weight:700;color:var(--text-main);">${belegt}</span> vergeben ·
         Einheitenzahl nicht erfasst
       </div>`
    : `<div style="display:flex;gap:10px;margin-bottom:8px;">
         <div><span style="font-size:18px;font-weight:700;color:var(--text-main);">${belegt}</span>
              <span style="font-size:11px;color:var(--text-muted);"> vergeben</span></div>
         <div><span style="font-size:18px;font-weight:700;color:${offen ? 'var(--warning,#f59e0b)' : 'var(--text-main)'};">${offen}</span>
              <span style="font-size:11px;color:var(--text-muted);"> unvergeben</span></div>
       </div>`;

  const zeile = (b) => {
    const abgesagt = !istVergeben(b);
    return `<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;padding:4px 0;">
      <span style="font-size:11px;color:${abgesagt ? 'var(--text-muted)' : 'var(--text-main)'};${abgesagt ? 'text-decoration:line-through;' : ''}">
        ${esc(_datumZeit(b.start_time))}${abgesagt ? ' · abgesagt' : ''}
      </span>
      <button type="button" data-termin-loesen="${esc(b.id)}" title="Zuordnung zu dieser Verordnung aufheben"
        style="${knopfStil}">lösen</button>
    </div>`;
  };

  const vorschlag = (b) => `<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;padding:4px 0;">
      <span style="font-size:11px;color:var(--text-main);">${esc(_datumZeit(b.start_time))}</span>
      <button type="button" data-termin-binden="${esc(b.id)}" title="Diesen einen Termin dieser Verordnung zuordnen"
        style="${knopfStil}">zuordnen</button>
    </div>`;

  const inhalt = `
    ${zaehler}
    ${vergeben.length
      ? `<div style="border-top:1px solid var(--border);padding-top:4px;">${vergeben.map(zeile).join('')}</div>`
      : ''}
    ${(offen === null || offen > 0) && kandidaten.length
      ? `<div style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px;">
           <div style="font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--text-muted);margin-bottom:2px;">Termine ohne Verordnung</div>
           ${kandidaten.map(vorschlag).join('')}
         </div>`
      : ''}
    ${!vergeben.length && !kandidaten.length
      ? `<div style="font-size:11px;color:var(--text-muted);margin-top:6px;line-height:1.5;">${
          rx.lead_id
            ? 'Für diesen Patienten steht kein Termin offen, der sich zuordnen liesse.'
            : 'Diese Verordnung hängt an keiner Patientenakte — Termine lassen sich deshalb nicht zuordnen.'
        }</div>`
      : ''}
    <div data-termin-fehler style="font-size:11px;color:var(--danger,#ef4444);margin-top:6px;"></div>`;

  return _spaltenKasten('Termine', inhalt, esc);
}

function _termine(rx, esc, quelle, termine) {
  if (quelle === 'podologie') return _terminePodo(rx, esc, termine);

  const sitzungen = (Array.isArray(rx.prescription_sessions) ? rx.prescription_sessions : [])
    .slice()
    .sort((a, b) => (a.session_number || 0) - (b.session_number || 0));
  if (!sitzungen.length) return _spaltenKasten('Termine', _LEER('Keine Sitzungszeilen angelegt.', esc), esc);

  const vergeben = sitzungen.filter(s => s.booking_id);
  const unvergeben = sitzungen.filter(s => !s.booking_id);

  const zeile = (s, mitDatum) => `<div style="display:flex;justify-content:space-between;gap:8px;padding:4px 0;">
      <span style="font-size:12px;color:var(--text-main);">${s.session_number ? `${s.session_number}.` : '·'}</span>
      <span style="font-size:11px;color:var(--text-muted);white-space:nowrap;">${mitDatum ? esc(_datumZeit(s.bookings?.start_time)) : 'ohne Termin'}</span>
    </div>`;

  const inhalt = `
    <div style="display:flex;gap:10px;margin-bottom:8px;">
      <div><span style="font-size:18px;font-weight:700;color:var(--text-main);">${vergeben.length}</span>
           <span style="font-size:11px;color:var(--text-muted);"> vergeben</span></div>
      <div><span style="font-size:18px;font-weight:700;color:${unvergeben.length ? 'var(--warning,#f59e0b)' : 'var(--text-main)'};">${unvergeben.length}</span>
           <span style="font-size:11px;color:var(--text-muted);"> unvergeben</span></div>
    </div>
    ${vergeben.length ? `<div style="border-top:1px solid var(--border);padding-top:4px;">${vergeben.map(s => zeile(s, true)).join('')}</div>` : ''}
    ${unvergeben.length ? `<div style="border-top:1px solid var(--border);padding-top:4px;margin-top:4px;">${unvergeben.map(s => zeile(s, false)).join('')}</div>` : ''}`;

  return _spaltenKasten('Termine', inhalt, esc);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Linke Spalte: die Felder der Verordnung
   ═══════════════════════════════════════════════════════════════════════════ */

function _felderPhysio(rx, esc) {
  const p = rx.leads || {};
  const arzt = rx.aerzte || {};
  const nummer = belegnummerText(rx, { patientennummer: p.patientennummer });

  const sitzungen = Array.isArray(rx.prescription_sessions) ? rx.prescription_sessions : [];
  // CHECK status IN (planned, done, cancelled, no_show) — nur `done` zählt.
  const erledigt = sitzungen.filter(s => s.status === 'done').length;
  const sitzungText = sitzungen.length ? `${erledigt} von ${sitzungen.length} erledigt` : '—';

  const icd = [rx.icd10, rx.icd10_2].filter(Boolean).join(' · ');
  const leit = [rx.leitsymptomatik, rx.pat_leitsymptomatik].filter(Boolean).join(' · ');
  const heilmittel = [rx.heilmittel, rx.heilmittel_position ? `(${rx.heilmittel_position})` : '']
    .filter(Boolean).join(' ');
  const ergaenzend = rx.ergaenzendes_heilmittel
    ? `${rx.ergaenzendes_heilmittel}${rx.ergaenzend_einheiten ? ` · ${rx.ergaenzend_einheiten} EH` : ''}`
    : '';

  return `
    ${_block('Verordnung', [
      _feld('Belegnummer', nummer, esc, { mono: true }),
      _feld('Ausstellungsdatum', _datum(rx.ausstellungsdatum), esc),
      _feld('Gültig bis (Behandlungsbeginn)', _datum(rx.gueltig_bis), esc),
      _feld('Behandlungsbeginn', _datum(rx.behandlungsbeginn), esc),
      _feld('Rezept-Typ', rx.rezept_typ, esc),
      _feld('Therapiebereich', rx.therapie_bereich, esc)
    ], esc)}

    ${_block('Diagnose', [
      _feld('ICD-10', icd, esc, { mono: true }),
      _feld('Diagnosegruppe', rx.diagnosegruppe, esc, { mono: true }),
      _feld('Leitsymptomatik', leit, esc),
      _feld('Diagnose (Freitext)', rx.diagnose_freitext, esc)
    ], esc)}

    ${_block('Heilmittel', [
      _feld('Heilmittel', heilmittel, esc, { fett: true }),
      _feld('Behandlungseinheiten', rx.anzahl_einheiten, esc),
      _feld('Ergänzendes Heilmittel', ergaenzend, esc),
      _feld('Frequenz', rx.frequenz, esc),
      _feld('Sitzungen', sitzungText, esc)
    ], esc)}

    ${_block('Arzt', [
      _feld('Name', arzt.arzt_name, esc),
      _feld('Fachrichtung', arzt.fachrichtung, esc),
      _feld('LANR', rx.doctor_lanr || arzt.lanr, esc, { mono: true }),
      _feld('BSNR', rx.doctor_bsnr || arzt.bsnr, esc, { mono: true }),
      _feld('Unterschrift vorhanden', _jaNein(rx.unterschrift_vorhanden), esc)
    ], esc)}

    ${_block('Kostenträger und Zuzahlung', [
      _feld('Krankenkasse', p.krankenkasse, esc),
      _feld('IK des Kostenträgers', rx.kostentraeger_ik, esc, { mono: true }),
      _feld('Versichertennummer', p.versichertennummer, esc, { mono: true }),
      _feld('Versichertenstatus', p.versichertenstatus, esc, { mono: true }),
      _feld('Geburtsdatum', _datum(p.geburtsdatum), esc),
      _feld('Zuzahlung', rx.zuzahlung_befreit ? 'befreit' : _euro(rx.zuzahlung_eur), esc),
      _feld('Zuzahlung kassiert am', _datum(rx.zuzahlung_kassiert_am), esc)
    ], esc)}

    ${_block('Therapiebericht', [
      _feld('Angefordert', _jaNein(rx.bericht_angefordert), esc),
      _feld('Status', BERICHT_LABEL[rx.bericht_status] || rx.bericht_status, esc)
    ], esc)}

    ${_freitextBlock('Hinweise', rx.hinweise, esc)}

    ${_block('Erfassung', [
      _feld('Quelle', rx.quelle, esc),
      _feld('Angelegt am', _datum(rx.created_at), esc),
      _feld('Abrechnungsstatus', rx.abrechnung_status, esc)
    ], esc)}
  `;
}

/**
 * Die verordnete Menge — als einziges Feld dieser Ansicht änderbar.
 *
 * Beta-1, 31.08.2026: nach der Eingangsbefundung steht oft erst fest, wie viele
 * Einheiten wirklich nötig sind („es sind doch nur zwei oder so"). Bisher war
 * die Zahl beim Anlegen festgeschrieben, und wer sich vertan hatte, legte eine
 * zweite Verordnung an.
 *
 * Regeln und Riegel stehen in `module/verordnung-einheiten.js` — hier wird nur
 * gezeigt und verdrahtet. Ist die Verordnung schon bei der Kasse gewesen,
 * erscheint gar kein Knopf, sondern der Grund.
 */
function _feldEinheiten(v, esc, erbracht) {
  const riegel = einheitenAenderungErlaubt(v);
  const wert = v.behandlungseinheiten ?? '';
  const knopfStil = 'font-size:11px;padding:2px 8px;border-radius:6px;border:1px solid var(--border);'
    + 'background:var(--bg-card-solid,#1f2937);color:var(--text-main);cursor:pointer;';

  return `<div data-einheiten-feld data-erbracht="${erbracht || 0}">
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px;">Behandlungseinheiten</div>
    <div data-einheiten-anzeige style="display:flex;align-items:center;gap:8px;">
      <span style="color:${wert === '' ? 'var(--text-muted)' : 'var(--text-main)'};">${esc(wert === '' ? '—' : wert)}</span>
      ${riegel.erlaubt
        ? `<button type="button" data-einheiten-aendern style="${knopfStil}">ändern</button>`
        : `<span title="${esc(riegel.grund)}" style="font-size:11px;color:var(--text-muted);">festgeschrieben</span>`}
    </div>
    ${riegel.erlaubt ? `<div data-einheiten-form hidden style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;">
      <input type="number" min="1" max="60" value="${esc(wert)}" data-einheiten-eingabe style="width:70px;padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:13px;">
      <button type="button" data-einheiten-speichern style="${knopfStil}">Speichern</button>
      <button type="button" data-einheiten-abbrechen style="${knopfStil}">Abbrechen</button>
      <div data-einheiten-fehler style="flex-basis:100%;font-size:11px;color:var(--danger,#ef4444);"></div>
    </div>` : ''}
  </div>`;
}

function _felderPodo(v, esc) {
  const p = v.leads || {};
  const arzt = v.aerzte || {};
  const nummer = belegnummerText(v, { patientennummer: p.patientennummer });

  // `icd10` ist im Podologie-Topf ein text[], im Physio-Topf eine Spalte —
  // beim Umschreiben leicht zu verwechseln (db/SCHEMA.sql, Warnung dort).
  const icd = Array.isArray(v.icd10) ? v.icd10.filter(Boolean).join(' · ') : (v.icd10 || '');

  // `heilmittel_items` ist jsonb: [{code, bezeichnung, anzahl, massnahme}]
  const items = Array.isArray(v.heilmittel_items) ? v.heilmittel_items : [];
  const heilmittel = items
    .map(i => [i.code, i.bezeichnung].filter(Boolean).join(' ') + (i.anzahl > 1 ? ` ×${i.anzahl}` : ''))
    .join(' · ');

  const behs = Array.isArray(v.podologie_behandlungen) ? v.podologie_behandlungen : [];

  return `
    ${_block('Verordnung', [
      _feld('Belegnummer', nummer, esc, { mono: true }),
      _feld('Ausstellungsdatum', _datum(v.ausstellungsdatum), esc),
      _feld('Behandlungsbeginn spätestens', _datum(v.beginn_spaetestens), esc),
      _feld('Behandlungsstart', _datum(v.behandlungsstart), esc),
      _feld('Rezeptart', v.rezeptart, esc),
      _feld('Behandlungsanlass', v.behandlungsanlass, esc)
    ], esc)}

    ${_block('Diagnose', [
      _feld('ICD-10', icd, esc, { mono: true }),
      _feld('Diagnosegruppe', v.diagnosegruppe, esc, { mono: true }),
      _feld('Leitsymptomatik', [v.leitsymptomatik, v.pat_leitsymptomatik].filter(Boolean).join(' · '), esc),
      // Wagner ist klinische Dokumentation (§630f BGB), kein Abrechnungsfeld.
      _feld('Wagner-Klassifikation', v.wagner_grad === null || v.wagner_grad === undefined ? '' : `Grad ${v.wagner_grad}`, esc)
    ], esc)}

    ${_block('Heilmittel', [
      _feld('Verordnete Positionen', heilmittel, esc, { fett: true }),
      _feldEinheiten(v, esc, behs.length),
      _feld('Frequenz', v.therapiefrequenz, esc),
      _feld('Dokumentierte Behandlungen', behs.length ? `${behs.length} erbracht` : '', esc)
    ], esc)}

    ${_block('Arzt', [
      _feld('Name', arzt.arzt_name, esc),
      _feld('Fachrichtung', arzt.fachrichtung, esc),
      _feld('LANR', arzt.lanr, esc, { mono: true }),
      _feld('BSNR', arzt.bsnr, esc, { mono: true })
    ], esc)}

    ${_block('Kostenträger und Zuzahlung', [
      _feld('Krankenkasse', p.krankenkasse, esc),
      _feld('IK des Kostenträgers', v.kostentraeger_ik, esc, { mono: true }),
      _feld('Versichertennummer', v.versichertennummer || p.versichertennummer, esc, { mono: true }),
      _feld('Versichertenstatus', p.versichertenstatus, esc, { mono: true }),
      _feld('Geburtsdatum', _datum(p.geburtsdatum), esc),
      _feld('Zuzahlung', v.zuzahlung_befreit ? 'befreit' : '', esc)
    ], esc)}

    ${(v.absetzung_betrag || v.absetzung_grund) ? _block('Absetzung durch die Kasse', [
      _feld('Betrag', _euro(v.absetzung_betrag), esc),
      _feld('Am', _datum(v.absetzung_am), esc),
      _feld('Grund', v.absetzung_grund, esc)
    ], esc) : ''}

    ${_freitextBlock('Notizen', v.notizen, esc)}

    ${_block('Erfassung', [
      _feld('Angelegt am', _datum(v.created_at), esc),
      _feld('Patient (Freitext)', v.lead_id ? '' : v.patient_name, esc)
    ], esc)}
  `;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Zusammenbau
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Die vollständige Ansicht einer Verordnung als HTML.
 *
 * @param {object} rx   Zeile aus `prescriptions` — beim podologischen Zweig
 *                      bereits durch `ausTopf()` übersetzt — inkl. der
 *                      Verbunde aus SELECT_PHYSIO / SELECT_PODO.
 * @param {object} opt
 * @param {(s:string)=>string} opt.escapeHtml  Pflicht.
 * @param {'physio'|'podologie'} [opt.quelle='physio']
 * @param {string} [opt.leadId]  Ist er gesetzt, erscheint „Patient öffnen →".
 * @returns {string}
 */
export function verordnungDetailHtml(rx, opt = {}) {
  const esc = opt.escapeHtml || (s => String(s));
  const quelle = opt.quelle === 'podologie' ? 'podologie' : 'physio';
  const p = rx.leads || {};
  const name = [p.first_name, p.last_name].filter(Boolean).join(' ')
    || (quelle === 'podologie' ? (rx.patient_name || '') : '')
    || '—';

  const nummer = belegnummerText(rx, { patientennummer: p.patientennummer });
  const nummerHerkunft = rx.belegnummer
    ? 'eingefroren bei der Abrechnung'
    : 'vorläufig — wird bei der Abrechnung festgeschrieben';

  return `
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <span style="font-size:15px;font-weight:700;color:var(--text-main);">${esc(name)}</span>
      ${nummer ? `<span title="${esc(nummerHerkunft)}" style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;font-weight:700;padding:2px 9px;border-radius:10px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);">${esc(nummer)}</span>` : ''}
      ${bereichBadge(quelle, { gross: true })}
      ${statusBadgeGross(quelle, rx.status)}
    </div>
    ${_merkmale(rx, esc, quelle)}

    <!-- Untere Hälfte: links die Felder, rechts Verschreibung und Termine.
         flex-wrap statt Medienabfrage — auf schmalen Bildschirmen rutscht
         die rechte Spalte unter die Felder. -->
    <div style="display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start;margin-top:6px;">
      <div style="flex:1 1 380px;min-width:0;">
        ${quelle === 'podologie' ? _felderPodo(rx, esc) : _felderPhysio(rx, esc)}
      </div>
      <div style="flex:0 1 260px;min-width:230px;display:flex;flex-direction:column;gap:12px;margin-top:14px;">
        ${_verschreibung(rx, esc, quelle, opt.summe)}
        ${_termine(rx, esc, quelle, opt.termine)}
      </div>
    </div>

    ${opt.leadId ? `<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn-primary btn-sm" onclick="switchPanel('kunden');openPatientDetail('${esc(opt.leadId)}')">Patient öffnen →</button>
    </div>` : ''}
  `;
}

/**
 * Das Einheitenfeld zum Leben erwecken.
 *
 * Nach dem Speichern wird die Ansicht neu geladen (statt den Wert im DOM zu
 * ersetzen): an der Zahl hängen der Zähler, die Restmenge und die Frage, ob die
 * Verordnung ausgeschöpft ist. Eine halb nachgezogene Anzeige wäre genau der
 * Fehler, gegen den `module/signal.js` angetreten ist.
 */
function _verdrahteEinheiten(wurzel, { supabase, vord, ctx }) {
  const feld = wurzel.querySelector('[data-einheiten-feld]');
  if (!feld) return;

  const anzeige  = feld.querySelector('[data-einheiten-anzeige]');
  const form     = feld.querySelector('[data-einheiten-form]');
  const eingabe  = feld.querySelector('[data-einheiten-eingabe]');
  const fehlerEl = feld.querySelector('[data-einheiten-fehler]');
  if (!form || !eingabe) return;   // gesperrt — dann gibt es kein Formular

  const erbracht = Number(feld.dataset.erbracht) || 0;
  const umschalten = (bearbeiten) => {
    form.hidden = !bearbeiten;
    if (anzeige) anzeige.hidden = bearbeiten;
    if (bearbeiten) { eingabe.focus(); eingabe.select(); }
  };

  feld.querySelector('[data-einheiten-aendern]')?.addEventListener('click', () => umschalten(true));
  feld.querySelector('[data-einheiten-abbrechen]')?.addEventListener('click', () => {
    eingabe.value = vord.behandlungseinheiten ?? '';
    if (fehlerEl) fehlerEl.textContent = '';
    umschalten(false);
  });

  const speichern = async () => {
    const neu = parseInt(eingabe.value, 10);
    const fehler = pruefeNeueMenge(neu, erbracht);
    if (fehler) { if (fehlerEl) fehlerEl.textContent = fehler; return; }
    if (fehlerEl) fehlerEl.textContent = '';

    const knopf = feld.querySelector('[data-einheiten-speichern]');
    if (knopf) { knopf.disabled = true; knopf.textContent = 'Speichert…'; }

    const res = await speichereEinheiten(supabase, { vordId: vord.id, neu });
    if (!res.ok) {
      if (fehlerEl) fehlerEl.textContent = res.fehler || 'Speichern fehlgeschlagen.';
      if (knopf) { knopf.disabled = false; knopf.textContent = 'Speichern'; }
      return;
    }
    // Wer schreibt, meldet — die Liste oben und die Akte ziehen selbst nach.
    emit('verordnungen:changed', { id: vord.id, behandlungseinheiten: neu });
    await zeigeVerordnungDetail(ctx);
  };

  feld.querySelector('[data-einheiten-speichern]')?.addEventListener('click', speichern);
  eingabe.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); speichern(); }
    if (e.key === 'Escape') { e.preventDefault(); umschalten(false); }
  });
}

/**
 * Zuordnen und Lösen einzelner Termine.
 *
 * Ein Klick betrifft genau EINEN Termin — das ist der Punkt der Karte
 * (Beta-1: „kann ich halt nur eins nehmen statt beide"). Nach dem Schreiben
 * wird neu geladen, weil sich Zähler, Restmenge und Kandidatenliste zugleich
 * ändern.
 */
function _verdrahteTermine(wurzel, { supabase, vord, ctx }) {
  const fehlerEl = wurzel.querySelector('[data-termin-fehler]');

  const lauf = async (knopf, arbeit) => {
    if (fehlerEl) fehlerEl.textContent = '';
    knopf.disabled = true;
    const alt = knopf.textContent;
    knopf.textContent = '…';
    const res = await arbeit();
    if (!res.ok) {
      // Der Owner-Riegel der Datenbank (42501) bringt einen fertigen deutschen
      // Satz mit — er wird gezeigt, nicht durch einen eigenen ersetzt.
      if (fehlerEl) fehlerEl.textContent = res.fehler;
      knopf.disabled = false;
      knopf.textContent = alt;
      return;
    }
    emit('verordnungen:changed', { id: vord.id });
    emit('bookings:changed', { verordnungId: vord.id });
    await zeigeVerordnungDetail(ctx);
  };

  wurzel.querySelectorAll('[data-termin-binden]').forEach(b => {
    b.addEventListener('click', () => lauf(b, () =>
      bindeTermin(supabase, { bookingId: b.dataset.terminBinden, vordId: vord.id })));
  });

  wurzel.querySelectorAll('[data-termin-loesen]').forEach(b => {
    b.addEventListener('click', () => lauf(b, () =>
      loeseTermin(supabase, { bookingId: b.dataset.terminLoesen })));
  });
}

/**
 * Verordnung laden und in einen bestehenden Bereich zeichnen.
 *
 * Der Bereich wird nicht von diesem Modul erzeugt — beide Aufrufer haben schon
 * einen (die Qikbee-Tabelle unter „Patienten" und die Verordnungsliste).
 *
 * @param {object} ctx
 * @param {object} ctx.supabase
 * @param {string} [ctx.verordnungId]  Zeile im gewählten Topf.
 * @param {string} [ctx.rxId]          Altform für den Physio-Topf; `openPatRxDetail`
 *                                     ruft weiterhin so auf.
 * @param {'physio'|'podologie'} [ctx.quelle='physio']
 * @param {HTMLElement|null} [ctx.panel]    Wird sichtbar gemacht und gescrollt.
 * @param {HTMLElement|null} [ctx.titel]    textContent = Patientenname.
 * @param {HTMLElement} ctx.inhalt          Ziel für das HTML.
 * @param {(s:string)=>string} ctx.escapeHtml
 * @returns {Promise<object|null>} die geladene Zeile (oder null bei Fehler)
 */
export async function zeigeVerordnungDetail(ctx) {
  const { supabase, panel, titel, inhalt, escapeHtml } = ctx;
  const quelle = ctx.quelle === 'podologie' ? 'podologie' : 'physio';
  const id = ctx.verordnungId || ctx.rxId;
  if (!inhalt || !id) return null;

  if (panel) panel.hidden = false;
  inhalt.innerHTML = '<span style="color:var(--text-muted);">Lade…</span>';

  // Alles ab hier in EINEM try/catch: ohne ihn blieb ein Wurf oder ein nie
  // settelndes Promise irgendwo zwischen hier und dem finalen innerHTML() die
  // Seite für immer bei „Lade…" stehen — ohne Fehlermeldung, ohne Konsolen-
  // hinweis, der Anwender sah nur ein Rad, das nie aufhört. Gefunden 04.09.2026
  // bei Beta-1: eine podologische Verordnung liess sich nicht mehr öffnen, und
  // es gab keine Spur, WARUM — dieser Rahmen ist genau dafür da, dass es beim
  // nächsten Mal eine gibt.
  try {
    // Seit 04.09.2026 EIN Verordnungstopf: beide Zweige lesen `prescriptions`.
    // `.eq('therapie_bereich','podo')` ist Pflicht beim Podologie-Zweig — sonst
    // könnte eine physiotherapeutische id hier durchlaufen und mit den
    // podologischen Feldnamen (`ausTopf()`) falsch angezeigt werden.
    let q = supabase.from('prescriptions')
      .select(quelle === 'podologie' ? SELECT_PODO : SELECT_PHYSIO)
      .eq('id', id);
    if (quelle === 'podologie') q = q.eq('therapie_bereich', 'podo');
    const { data: rxRoh, error } = await q.maybeSingle();
    const rx = (quelle === 'podologie' && rxRoh) ? ausTopf(rxRoh) : rxRoh;

    if (error || !rx) {
      console.error('[zeigeVerordnungDetail]', error);
      inhalt.innerHTML = '<span style="color:var(--danger,#ef4444);">Verordnung konnte nicht geladen werden.</span>';
      if (titel) titel.textContent = '—';
      return null;
    }

    const p = rx.leads || {};
    const name = [p.first_name, p.last_name].filter(Boolean).join(' ')
      || (quelle === 'podologie' ? (rx.patient_name || '') : '')
      || '—';
    if (titel) titel.textContent = name;

    // Summe und Zuzahlung — nur im Podologie-Topf, und zwar aus DEM Katalog, aus
    // dem auch die Kassendatei ihre Beträge nimmt (module/podologie-positionen.js
    // erklärt, warum nicht aus `GKV_LEISTUNGSKATALOG`).
    //
    // Für den Physio-Topf gibt es diesen Weg im Browser nicht: dort kommen die
    // Preise heute aus `services.price` (Terminpreis), den GKV-Preis kennt nur
    // das Backend beim Erzeugen der DTA. Eine Summe daraus wäre eine zweite,
    // abweichende Zahl neben der Abrechnung — deshalb steht dort weiter die
    // Sitzungsliste ohne Betrag.
    let summe = null;
    let termine = null;
    if (quelle === 'podologie') {
      const behs = Array.isArray(rx.podologie_behandlungen) ? rx.podologie_behandlungen : [];
      try {
        termine = await ladePodoTermine(supabase, {
          ownerId: rx.owner_id, vordId: rx.id, leadId: rx.lead_id,
        });
      } catch (e) {
        console.warn('[zeigeVerordnungDetail] Termine:', e.message);
      }
      try {
        const finde = await podoPositionsFinder(supabase, behs);
        summe = zuzahlungFuerPodoVerordnung(rx, behs, finde);
        for (const b of behs) {
          const codes = Array.isArray(b.hpnr_codes) ? b.hpnr_codes.filter(Boolean) : [];
          if (!codes.length) continue;
          b._betrag = codes.reduce((s, c) => s + (Number(finde(c, b.behandlungsdatum)?.preis) || 0), 0);
        }
      } catch (e) {
        // Ohne Preise bleibt die Ansicht stehen — sie ist in erster Linie die
        // Verordnung, nicht die Rechnung.
        console.warn('[zeigeVerordnungDetail] Summe:', e.message);
      }
    }

    inhalt.innerHTML = verordnungDetailHtml(rx, {
      escapeHtml, quelle, summe, termine, leadId: p.id || ctx.leadId || '',
    });
    if (quelle === 'podologie') {
      _verdrahteEinheiten(inhalt, { supabase, vord: rx, ctx });
      _verdrahteTermine(inhalt, { supabase, vord: rx, ctx });
    }
    if (panel && typeof panel.scrollIntoView === 'function') {
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    return rx;
  } catch (e) {
    console.error('[zeigeVerordnungDetail]', e);
    const esc = escapeHtml || (s => String(s));
    inhalt.innerHTML = '<span style="color:var(--danger,#ef4444);">Verordnung konnte nicht geladen werden — '
      + esc(e?.message || 'unbekannter Fehler') + '</span>';
    if (titel) titel.textContent = '—';
    return null;
  }
}
