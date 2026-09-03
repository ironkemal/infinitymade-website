/**
 * rezeptinfo-geld.js — die Geldzeile der Rezeptinfo im Terminkalender-Panel.
 *
 * Warum es das gibt
 * ─────────────────
 * Die Rezeptinfo zeigte Verordnungsnummer, Arzt und Ausstellungsdatum — Angaben,
 * die man beim Anlegen der Verordnung braucht und danach nie wieder. Was beim
 * Behandeln wirklich gefragt wird, stand nicht da.
 *
 *   Kemal, 31.08.2026: „dann anstatt Nummer, Arzt, Datum in der Rezept-Info …
 *   dass wir Zuzahlung und daneben die gesamte Summe sehen, und daneben mit
 *   einem Euro-Button — also einem Button, wenn man drauf klickt, dass man die
 *   Rechnung erstellt."
 *
 * Der Knopf richtet sich nach dem Patienten
 * ─────────────────────────────────────────
 *   Kemal, 03.09.2026: „bu butona bastığımız hasta eğer privatsa … privat
 *   hesaplanacak, yani tam tutar alınacak, çünkü onun faturasını ödeyecek bir
 *   Krankenkasse yok — yani hastanın durumuna göre davranacak."
 *
 * Also zwei Wege hinter einem Knopf, und sie unterscheiden sich in BEIDEM —
 * im Betrag und in der Preisquelle:
 *
 * | Patient | Betrag | Preisquelle | Knopf tut |
 * |---|---|---|---|
 * | **GKV**    | 10 % je Einheit + 10 € Pauschale (§ 61 SGB V) | GKV-Katalog | kassieren + quittieren |
 * | **Privat** | die volle Leistung | **eigene** Leistungen der Praxis | Rechnungsentwurf öffnen |
 *
 * Die Preisquelle ist kein Detail. Privat wird frei kalkuliert und liegt in der
 * Regel deutlich über dem Kassensatz; wer den GKV-Preis übernimmt, rechnet unter
 * Wert ab und merkt es nicht. Umgekehrt ist der eigene Preis für die
 * GKV-Zuzahlung falsch — dort zählt der Vertragssatz. Dieselbe Trennung zieht
 * `module/rechnung-bruecke.js` („Warum nicht der GKV-Preis").
 *
 * Wenn der Kassenstatus nicht dasteht, wird NICHT geraten
 * ───────────────────────────────────────────────────────
 * `leads.insurance_type` ist am 03.09.2026 bei 111 von 120 Patienten `NULL`, und
 * die Tabelle des Panels (`prescriptions`) führt gar kein Zahlerfeld —
 * `rezept_typ` sagt „blanko/standard", also die Rezeptart, nicht wer zahlt.
 *
 * Raten kostet hier Geld, und zwar in beide Richtungen: ein Privatpatient als
 * GKV behandelt zahlt 28 € statt 180 €; ein GKV-Patient als Privat behandelt
 * bekommt eine Rechnung über einen Betrag, den er nicht schuldet. Der zweite
 * Fall ist der schlimmere. Deshalb fragt der Knopf in diesem Fall einmal nach,
 * statt eine Vorgabe zu wählen — eine Rückfrage ist billiger als eine falsche
 * Rechnung.
 *
 * WELCHE Rechnung — die dritte gibt es auch noch
 * ──────────────────────────────────────────────
 * Es gibt drei Geldwege: (1) Zuzahlung, (2) § 302 an die Kasse per DTA,
 * (3) Privat-/Selbstzahlerrechnung. Dieser Knopf ist (1) oder (3), je nach
 * Patient. (2) läuft ganz woanders und wird hier nie ausgelöst.
 *
 * Warum der Betrag gerechnet und nicht gelesen wird
 * ─────────────────────────────────────────────────
 * `prescriptions.zuzahlung_eur` ist in ALLEN 51 Verordnungen `NULL` — die Spalte
 * wird nirgends gefüllt. Die farbige Zeile darunter erscheint aber nur, wenn dort
 * ein Betrag steht; sie war also für jede Verordnung unsichtbar und der ganze
 * Kassiervorgang aus dem Panel unerreichbar. Gerechnet wird mit
 * `module/zuzahlung-rechnen.js` — derselben Datei, die per Test Fall für Fall
 * gegen den Backend-Calculator geprüft wird. Damit nennt das Panel denselben
 * Betrag, den die gedruckte Quittung ausweist.
 */

import { berechneZuzahlung, wirksameEinheiten } from './zuzahlung-rechnen.js?v=20260831';
import { verordnungStatusInfo } from './abrechnungsstatus.js?v=20260903';

const fmt = (n) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0);

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Wer zahlt diese Behandlung?
 *
 * Reihenfolge: die Verordnung schlägt den Patientenstamm. Steht an der
 * podologischen Verordnung ausdrücklich „privat" oder „selbstzahler", gilt das
 * auch dann, wenn der Patient sonst gesetzlich versichert ist — genau dafür
 * gibt es das Feld. Erst danach zählt `leads.insurance_type`.
 *
 * @returns {'gkv'|'privat'|'unbekannt'}
 */
export function zahlerTyp(lead, rx) {
  const art = String(rx?.rezeptart || '').toLowerCase();
  if (art === 'privat' || art === 'selbstzahler' || art === 'bg') return 'privat';
  if (art === 'kassen') return 'gkv';

  const vers = String(lead?.insurance_type || '').toLowerCase();
  if (vers === 'privat' || vers === 'selbstzahler') return 'privat';
  if (vers === 'gkv') return 'gkv';
  return 'unbekannt';
}

/**
 * Die Katalogposition zu einer Verordnung finden — nur für den GKV-Weg.
 *
 * Zwei Quellen:
 * • **Podologie** — `podoKarte` aus `module/podologie-positionen.js`, also aus
 *   derselben Datei, aus der die Kassendatei ihre Beträge nimmt. Führt `preis`
 *   UND `zuzahlung`, kennt also die zuzahlungsfreien Positionen (78220, 78530).
 * • **Übrige Fachbereiche** — der Frontend-Katalog führt `price`, aber kein
 *   `zuzahlung`. Kein Mangel: für Heilmittel IST die Zuzahlung 10 % vom Brutto
 *   plus 10 € Pauschale, und genau dahin fällt die Rechnung bei unbekanntem
 *   Katalogbetrag.
 *
 * Die Positionsnummern stehen uneinheitlich in der Datenbank — mal „20501", mal
 * „X0501" für dieselbe Leistung. Beides wird probiert, statt eine Schreibweise
 * zur richtigen zu erklären und die andere still zu verlieren.
 *
 * @returns {{preis:number, zuzahlung:number|null, frei:boolean, quelle:string}|null}
 */
export function findePosition(rx, { podoKarte = null, katalog = [] } = {}) {
  const roh = String(rx?.heilmittel_position || '').trim();
  if (!roh) return null;

  const varianten = [roh];
  if (/^\d/.test(roh)) varianten.push('X' + roh.slice(1));
  if (/^X/i.test(roh)) varianten.push('2' + roh.slice(1));

  if (podoKarte) {
    for (const v of varianten) {
      const p = podoKarte.get?.(v);
      if (p) return { preis: Number(p.preis) || 0, zuzahlung: p.zuzahlung, frei: p.zuzahlung == null, quelle: 'podologie' };
    }
  }
  for (const v of varianten) {
    const e = (katalog || []).find(k => String(k.code) === v);
    if (e) return { preis: Number(e.price) || 0, zuzahlung: null, frei: false, quelle: 'katalog' };
  }
  return null;
}

/**
 * Preis einer eigenen Leistung — erst `price`, sonst die erste aktive Dauer aus
 * `price_config`. Dieselbe Reihenfolge wie `privatpreisFuer` in
 * module/rechnung-bruecke.js; zwei Stellen dürfen nicht verschieden rechnen.
 */
export function preisAusLeistung(service) {
  if (!service) return 0;
  let preis = parseFloat(service.price) || 0;
  if (!preis && service.price_config?.durations) {
    const dur = service.price_config.durations;
    const ersteAktive = Object.keys(dur).find(k => dur[k]?.active);
    preis = parseFloat(dur[ersteAktive]?.price) || 0;
  }
  return preis;
}

/**
 * Privatbetrag: die erbrachten Sitzungen, bewertet mit dem Preis der Leistung,
 * die am jeweiligen Termin hing — also mit dem EIGENEN Preis der Praxis.
 *
 * Positionen ohne hinterlegten Preis werden nicht mit 0,00 € mitgezählt,
 * sondern als Lücke gemeldet. Eine sichtbare Lücke ist besser als eine
 * unsichtbar zu niedrige Rechnung.
 *
 * @returns {Promise<{summe:number, positionen:number, offenePreise:number}>}
 */
export async function ladePrivatSumme(sb, prescriptionId) {
  const leer = { summe: 0, positionen: 0, offenePreise: 0 };
  if (!sb || !prescriptionId) return leer;

  const { data, error } = await sb
    .from('prescription_sessions')
    .select('id, bookings(id, services(price, price_config))')
    .eq('prescription_id', prescriptionId)
    .eq('status', 'done');
  if (error) { console.error('[rezeptinfo-geld:privat]', error); return leer; }

  let summe = 0, offenePreise = 0;
  for (const s of (data || [])) {
    const preis = preisAusLeistung(s.bookings?.services);
    if (preis > 0) summe += preis; else offenePreise++;
  }
  return { summe, positionen: (data || []).length, offenePreise };
}

/**
 * Was für diese Verordnung zu zahlen ist — je nach Zahler.
 *
 * @param {object} args
 * @param {object} args.rx
 * @param {number} args.erbracht        Sitzungen im Status `done`
 * @param {'gkv'|'privat'|'unbekannt'} args.zahler
 * @param {object|null} [args.position] GKV-Katalogposition (findePosition)
 * @param {object|null} [args.privat]   Privatsumme (ladePrivatSumme)
 * @returns {{zahler:string, brutto:number, gesamt:number, befreit:boolean,
 *           einheiten:number, unbekannt:boolean, offenePreise:number}}
 */
export function ermittleGeldstand({ rx, erbracht = 0, zahler = 'unbekannt', position = null, privat = null }) {
  const einheiten = wirksameEinheiten({ verordnet: rx?.anzahl_einheiten, erbracht });

  if (zahler === 'privat') {
    // Kein Prozentanteil, keine Pauschale: es gibt keine Kasse, die den Rest
    // trägt. Der Patient zahlt die Leistung, nicht seinen Anteil daran.
    const summe = Number(privat?.summe) || 0;
    return {
      zahler, einheiten, brutto: summe, gesamt: summe, befreit: false,
      unbekannt: !privat || (summe <= 0 && (privat?.positionen || 0) > 0),
      offenePreise: privat?.offenePreise || 0,
    };
  }

  const betrag = berechneZuzahlung({
    einheiten,
    preisProEinheit: position?.preis || 0,
    zuzahlungProEinheit: position?.zuzahlung ?? null,
    positionFrei: !!position?.frei,
    befreit: !!rx?.zuzahlung_befreit,
  });
  return { ...betrag, zahler, einheiten, unbekannt: !position, offenePreise: 0 };
}

/**
 * Zustand und Handlung des Euro-Knopfes.
 *
 * Ein Knopf, fünf Zustände. Ein zweiter Knopf „Beleg" daneben wäre nur Unruhe:
 * solange nichts kassiert ist, gibt es nichts zu drucken, und danach nichts
 * mehr zu kassieren.
 *
 * @returns {{ton:string, text:string, label:string,
 *            aktion:'kassieren'|'beleg'|'rechnung'|'fragen'|'keine', titel:string}}
 */
export function euroZustand(rx, stand, lead) {
  const leer = { ton: 'unbekannt', text: '—', label: 'Offen', aktion: 'keine', titel: 'Keine Verordnung gewählt' };
  if (!rx || !stand) return leer;

  // Kassenstatus fehlt → einmal fragen statt eine Vorgabe zu wählen. Beide
  // möglichen Vorgaben kosten Geld, wenn sie falsch sind.
  if (stand.zahler === 'unbekannt') {
    return { ton: 'unbekannt', text: '?', label: 'Zahler',
             aktion: 'fragen',
             titel: 'Für diesen Patienten ist kein Kassenstatus hinterlegt — '
                  + 'gesetzlich oder privat? Einmal hinterlegen, dann fragt der Knopf nicht mehr.' };
  }

  if (stand.zahler === 'privat') {
    if (stand.unbekannt || !(stand.gesamt > 0)) {
      return { ton: 'unbekannt', text: '—', label: 'Rechnungsbetrag', aktion: 'keine',
               titel: 'Für die erbrachten Leistungen ist kein eigener Preis hinterlegt — '
                    + 'Betrag lässt sich nicht berechnen. Preise stehen unter „Dienstleistungen".' };
    }
    return { ton: 'offen', text: fmt(stand.gesamt), label: 'Rechnungsbetrag', aktion: 'rechnung',
             titel: `Privatrechnung über ${fmt(stand.gesamt)} vorbereiten`
                  + (stand.offenePreise ? ` · ${stand.offenePreise} Position(en) ohne Preis` : '') };
  }

  // ── GKV ──
  if (rx.zuzahlung_befreit) {
    return { ton: 'befreit', text: 'befreit', label: 'Zuzahlung', aktion: 'beleg',
             titel: 'Zuzahlungsbefreit — Beleg öffnen' };
  }
  if (rx.zuzahlung_kassiert_am) {
    return { ton: 'bezahlt', text: fmt(stand.gesamt), label: 'Zuzahlung', aktion: 'beleg',
             titel: 'Bereits kassiert — Beleg öffnen' };
  }
  if (stand.unbekannt) {
    return { ton: 'unbekannt', text: '—', label: 'Zuzahlung', aktion: 'keine',
             titel: 'Für diese Position steht kein Preis im Katalog — Betrag lässt sich nicht berechnen' };
  }
  if (!(stand.gesamt > 0)) {
    return { ton: 'unbekannt', text: fmt(0), label: 'Zuzahlung', aktion: 'keine',
             titel: 'Für diese Verordnung fällt keine Zuzahlung an' };
  }
  return { ton: 'offen', text: fmt(stand.gesamt), label: 'Zuzahlung', aktion: 'kassieren',
           titel: `${fmt(stand.gesamt)} kassieren und quittieren` };
}

const TON_FARBE = {
  befreit:   'var(--success)',
  bezahlt:   'var(--success)',
  offen:     'var(--warning-text)',
  unbekannt: 'var(--text-muted)',
};

/**
 * Zeichnet die Geldzeile: Summe · (Zuzahlung|Rechnungsbetrag) · Status · €.
 *
 * @param {HTMLElement} el
 * @param {object} args
 * @param {object} args.rx
 * @param {object} args.stand      Rückgabe von ermittleGeldstand()
 * @param {object} [args.lead]
 * @param {function} args.aufEuro  (aktion, stand) — Klick auf den €-Knopf
 */
export function rendereGeldzeile(el, { rx, stand, lead, aufEuro }) {
  if (!el) return;
  const zz = euroZustand(rx, stand, lead);
  const st = verordnungStatusInfo('physio', rx?.abrechnung_status || rx?.status);
  const aktiv = zz.aktion !== 'keine';

  // Beim Privatpatienten sind Summe und Forderung dieselbe Zahl — sie zweimal
  // nebeneinander zu stellen sieht aus wie zwei Beträge. Dann nur einer.
  const zeigeSumme = stand?.zahler !== 'privat';
  const summeText = stand?.unbekannt ? '—' : fmt(stand?.brutto);

  const feld = (titel, wert, farbe, hilfe) =>
    '<div style="min-width:0;">'
    + '<div style="font-size:9px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);">' + titel + '</div>'
    + '<div style="font-size:13px;font-weight:700;color:' + farbe + ';"'
    + (hilfe ? ' title="' + escapeHtml(hilfe) + '"' : '') + '>' + wert + '</div>'
    + '</div>';

  el.innerHTML =
    '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">'
    + (zeigeSumme
        ? feld('Summe', escapeHtml(summeText), 'var(--text-main)',
               stand?.unbekannt ? 'Position steht nicht im Katalog'
                                : `${stand.einheiten} Einheit(en) — Grundlage der Zuzahlung`)
        : '')
    + feld(zz.label, escapeHtml(zz.text), TON_FARBE[zz.ton], zz.titel)
    + (st ? feld('Status', escapeHtml(st.label), st.farbe, st.hilfe) : '')
    + '<button type="button" id="bkRxEuroBtn" title="' + escapeHtml(zz.titel) + '"'
    + ' style="margin-left:auto;flex-shrink:0;width:34px;height:34px;border-radius:9px;'
    + 'border:1px solid ' + (aktiv ? 'var(--primary)' : 'var(--border)') + ';'
    + 'background:' + (aktiv ? 'hsla(var(--primary-h),var(--primary-s),var(--primary-l),0.12)' : 'transparent') + ';'
    + 'color:' + (aktiv ? 'var(--text-main)' : 'var(--text-muted)') + ';'
    + 'font-size:16px;font-weight:700;font-family:inherit;'
    + 'cursor:' + (aktiv ? 'pointer' : 'not-allowed') + ';">€</button>'
    + '</div>';

  const knopf = el.querySelector('#bkRxEuroBtn');
  if (knopf) {
    knopf.disabled = !aktiv;
    if (aktiv && aufEuro) knopf.onclick = () => aufEuro(zz.aktion, stand);
  }
}

/**
 * Die Geldzeile aufbauen und verdrahten — der ganze Ablauf, injiziert.
 *
 * Steht hier und nicht in dashboard.js: die Datei waechst nicht mehr
 * (Konsey 2026-08-13), und an die Oberflaeche ist der Ablauf ohnehin nur ueber
 * die hereingereichten Funktionen gebunden. Dasselbe Muster wie
 * `starteRechnungAusVerordnung` in module/rechnung-bruecke.js.
 *
 * Gezeichnet wird bis zu dreimal, und das mit Absicht:
 *   1. sofort — mit dem GKV-Katalog, damit die Zeile nicht leer beginnt
 *   2. nach dem Nachladen von Privatsumme und Podologie-Katalog
 *   3. sobald der Patient geladen ist — erst dann steht der Zahler fest
 * Ohne (3) fragt der Knopf beim Privatpatienten nach, obwohl die Antwort im
 * Patientenstamm steht.
 *
 * @param {object} args
 * @param {HTMLElement} args.el       #bkRxGeldZeile
 * @param {object} args.rx            angezeigte Verordnung
 * @param {object} args.booking
 * @param {number} args.erbracht      Sitzungen im Status `done`
 * @param {object} args.deps          alles aus dashboard.js — siehe unten
 * @returns {{ patientGesetzt: (lead:object) => void }}
 */
export function verdrahteGeldzeile({ el, rx, booking, erbracht, deps }) {
  const {
    sb, ownerId, sector, katalog = [], patientName = '',
    ladePodoPositionen, kassieren, belegOeffnen, rechnungAusVerordnung,
    rechnungsEditorFuerPatient, frage, panelSchliessen, nachKassieren,
  } = deps;

  let lead = null, position = null, privat = null;
  let standGkv = null, standPrivat = null;

  const zeichne = () => {
    if (!el || !el.isConnected) return;
    const zahler = zahlerTyp(lead, rx);
    standGkv    = ermittleGeldstand({ rx, erbracht, zahler: 'gkv', position });
    standPrivat = ermittleGeldstand({ rx, erbracht, zahler: 'privat', privat });
    const stand = zahler === 'privat' ? { ...standPrivat, zahler }
                : zahler === 'gkv'    ? { ...standGkv, zahler }
                : { ...standGkv, zahler: 'unbekannt' };
    rendereGeldzeile(el, { rx, stand, lead, aufEuro });
  };

  async function aufEuro(aktion, stand) {
    if (aktion === 'beleg') return belegOeffnen(rx.id);

    // Kassenstatus fehlt: einmal fragen statt raten. Beide Vorgaben kosten
    // Geld, wenn sie falsch sind — die falsche Privatrechnung trifft dabei
    // den Patienten, und das ist der schlimmere der beiden Fehler.
    if (aktion === 'fragen') {
      const istPrivat = await frage(patientName);
      return aufEuro(istPrivat ? 'rechnung' : 'kassieren', istPrivat ? standPrivat : standGkv);
    }

    // Privat: die volle Leistung. Die Podologie hat dafuer eine gebaute
    // Bruecke (podologie_behandlungen → Rechnungszeilen); sie haengt an
    // `verordnungen` und wird ueber den PATIENTEN gefunden — zwischen
    // `prescriptions` und `verordnungen` gibt es keine Verbindung. Ohne solche
    // Verordnung bleibt der vorhandene Rechnungseditor.
    if (aktion === 'rechnung') {
      if (sector === 'podologie' && booking.lead_id) {
        const { data: vs } = await sb.from('verordnungen')
          .select('id').eq('owner_id', ownerId).eq('lead_id', booking.lead_id)
          .order('ausstellungsdatum', { ascending: false }).limit(1);
        if (vs?.[0]) { panelSchliessen(); return rechnungAusVerordnung(vs[0].id); }
      }
      panelSchliessen();
      return rechnungsEditorFuerPatient(rx.patient_id || booking.lead_id || '');
    }

    if (aktion !== 'kassieren') return;
    const ok = await kassieren({
      rxId: rx.id,
      patientId: rx.patient_id || booking.lead_id || null,
      patientName,
      betragEur: stand.gesamt,
    });
    if (ok) await nachKassieren(rx.id);
  }

  position = findePosition(rx, { katalog });
  zeichne();

  (async () => {
    privat = await ladePrivatSumme(sb, rx.id);
    if (sector === 'podologie' && ladePodoPositionen) {
      const karte = await ladePodoPositionen(rx.ausstellungsdatum).catch(() => null);
      position = findePosition(rx, { podoKarte: karte, katalog }) || position;
    }
    zeichne();
  })().catch(e => console.error('[verdrahteGeldzeile]', e));

  return { patientGesetzt: (l) => { lead = l; zeichne(); } };
}
