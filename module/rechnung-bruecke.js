/**
 * rechnung-bruecke.js — von der Behandlung zur Rechnung.
 *
 * Das Problem
 * ───────────
 * Der Podologe hat den vollständigen Kontext genau einmal: in dem Moment, in
 * dem er die Sitzung dokumentiert. Wer ist der Patient, was wurde gemacht, an
 * welchem Tag, mit welcher Indikation — alles liegt auf dem Bildschirm. Bisher
 * musste er danach das Panel verlassen, unter „Rechnungen" ein leeres Formular
 * öffnen und denselben Patienten ein zweites Mal suchen. Der Kontext wurde
 * weggeworfen und von Hand wiederhergestellt (~8 Interaktionen für eine
 * Selbstzahler-Rechnung).
 *
 * Diese Brücke trägt den Kontext hinüber. Sie erzeugt keine Rechnung im
 * Hintergrund — der Entwurf wird vorbefüllt geöffnet, der Mensch bestätigt.
 *
 * Zwei Einstiege, ein Codeweg (`podoloji`, 16.08.2026)
 * ────────────────────────────────────────────────────
 *   1. „Speichern + Rechnung" an der Behandlung — der Selbstzahler-Rhythmus:
 *      Sitzung fertig, Patient steht noch da, es wird sofort kassiert.
 *      Einheit: EINE Sitzung.
 *   2. „Rechnung erstellen" an der Verordnung — der PKV-Rhythmus: die
 *      Verordnung läuft durch, am Ende geht eine Rechnung an den Patienten,
 *      der sie bei seiner Kasse einreicht. Einheit: ALLE noch nicht
 *      abgerechneten Sitzungen.
 *
 * Kein dritter Knopf an jeder Behandlungszeile: bei zehn Sitzungen sind das
 * zehn Knöpfe, und beide Rhythmen sind oben schon abgedeckt.
 *
 * Warum nicht der GKV-Preis
 * ─────────────────────────
 * `verordnungenLaden()` löst HPNR-Codes gegen den GKV-Katalog auf. Für eine
 * Kassenabrechnung ist das richtig, für eine Privatrechnung **falsch**: privat
 * wird frei kalkuliert und liegt in der Regel deutlich höher. Ein stillschweigend
 * übernommener GKV-Preis heisst, dass der Podologe unter Wert abrechnet und es
 * nicht merkt (`podoloji`: „acele eden podolog GKV fiyatını olduğu gibi
 * bırakır"). `gkv-302` hat denselben Punkt von der anderen Seite: HPNR ist ein
 * Vertragskode und ausserhalb des Vertrags bedeutungslos.
 *
 * Deshalb: privat wird der Preis aus den **eigenen Leistungen** der Praxis
 * gezogen (`services`, verknüpft über `code`/`gkv_position_nr`). Fehlt dort ein
 * Preis, bleibt die Zeile bei 0,00 € und wird als offen markiert — lieber eine
 * sichtbare Lücke als eine unsichtbar falsche Zahl.
 */

import { leistungsartVorschlag, zeilenSteuerVon } from './rechnung-steuer.js?v=20260816';

/** Rezeptarten, die nicht über die Kasse laufen. */
const PRIVATE_ARTEN = ['privat', 'selbstzahler', 'bg'];

export function istPrivatRezeptart(rezeptart) {
  return PRIVATE_ARTEN.includes(String(rezeptart || 'kassen'));
}

/**
 * Lädt die noch nicht abgerechneten Behandlungen einer Verordnung.
 *
 * `invoice_id IS NULL` ist die ganze Bedingung — und der Grund, warum die
 * Spalte am 16.08.2026 angelegt wurde. Vorher liess sich nicht sagen, welche
 * Sitzung schon auf einer Rechnung steht, und dieselbe konnte ein zweites Mal
 * berechnet werden.
 */
export async function offeneBehandlungen(sb, { ownerId, verordnungId }) {
  if (!ownerId || !verordnungId) return [];
  const { data, error } = await sb
    .from('podologie_behandlungen')
    .select('id, behandlungsdatum, hpnr_codes, diagnosegruppe, lokalisation, betrag_gkv, invoice_id')
    .eq('owner_id', ownerId)
    .eq('verordnung_id', verordnungId)
    .is('invoice_id', null)
    .order('behandlungsdatum', { ascending: true });
  if (error) { console.error('[bruecke:offeneBehandlungen]', error); return []; }
  return data || [];
}

/**
 * Sucht den Privatpreis einer HPNR in den eigenen Leistungen der Praxis.
 *
 * Die Praxis legt ihre Leistungen ohnehin unter „Dienstleistungen" an (Preis,
 * `price_config`, `code`) — deshalb wurde für die Privatpreise bewusst keine
 * neue Tabelle aufgemacht.
 *
 * @returns {{title:string, preis:number}|null}
 */
export function privatpreisFuer(code, services) {
  const c = String(code || '').trim();
  if (!c) return null;
  const treffer = (services || []).find(s =>
    String(s.gkv_position_nr || '').trim() === c || String(s.code || '').trim() === c
  );
  if (!treffer) return null;

  let preis = parseFloat(treffer.price) || 0;
  if (!preis && treffer.price_config?.durations) {
    const dur = treffer.price_config.durations;
    const ersteAktive = Object.keys(dur).find(k => dur[k]?.active);
    preis = parseFloat(dur[ersteAktive]?.price) || 0;
  }
  return { title: treffer.title || c, preis };
}

/**
 * Baut aus Behandlungen die Rechnungszeilen.
 *
 * Jede Zeile trägt ihr eigenes `leistungsdatum` (§ 14 Abs. 4 Nr. 6 UStG) und
 * ihre eigene Steuerangabe — eine Sitzung kann medizinische und kosmetische
 * Positionen mischen, und dann verlangt § 14 Abs. 4 Nr. 7 UStG getrennte
 * Summen.
 *
 * @param {Array}  behandlungen  Rückgabe von offeneBehandlungen
 * @param {object} opts
 * @param {object} opts.verordnung   die zugehörige Verordnung (darf fehlen)
 * @param {Array}  opts.services     eigene Leistungen der Praxis
 * @param {Array}  opts.katalogPodo  GKV-Katalog — nur für die Bezeichnung
 * @returns {{zeilen:Array, leistungsart:string, offenePreise:number}}
 */
export function zeilenAusBehandlungen(behandlungen, { verordnung, services, katalogPodo } = {}) {
  const zeilen = [];
  let offenePreise = 0;

  for (const beh of (behandlungen || [])) {
    const art = leistungsartVorschlag({ verordnung, behandlung: beh });
    const steuer = zeilenSteuerVon(art);
    const codes = beh.hpnr_codes || [];

    if (!codes.length) {
      // Ohne Kode gibt es keinen Katalogbezug — eine Zeile mit dem Anlass als
      // Bezeichnung. „Podologische Komplexbehandlung" ist als
      // handelsübliche Bezeichnung ausreichend (legal-de, Konsey 2026-08-10).
      const titel = verordnung?.behandlungsanlass || 'Podologische Komplexbehandlung';
      zeilen.push({
        title: titel, quantity: 1, unit_price: 0,
        leistungsdatum: beh.behandlungsdatum, ...steuer,
      });
      offenePreise++;
      continue;
    }

    for (const code of codes) {
      const eigen = privatpreisFuer(code, services);
      const katalogEintrag = (katalogPodo || []).find(k => k.code === String(code));
      const titel = eigen?.title || katalogEintrag?.title || String(code);
      const preis = eigen?.preis || 0;
      if (!preis) offenePreise++;
      zeilen.push({
        title: titel, quantity: 1, unit_price: preis,
        leistungsdatum: beh.behandlungsdatum, ...steuer,
      });
    }
  }

  const leistungsart = leistungsartVorschlag({
    verordnung,
    behandlung: behandlungen?.[0] || null,
  });
  return { zeilen, leistungsart, offenePreise };
}

/**
 * Hängt die abgerechneten Sitzungen an die Rechnung.
 *
 * Nach dem Speichern, nicht vorher: schlägt das Speichern fehl, darf keine
 * Behandlung als abgerechnet markiert sein.
 */
export async function behandlungenVerknuepfen(sb, { invoiceId, behandlungIds }) {
  const ids = (behandlungIds || []).filter(Boolean);
  if (!invoiceId || !ids.length) return { ok: true, anzahl: 0 };
  const { error } = await sb
    .from('podologie_behandlungen')
    .update({ invoice_id: invoiceId })
    .in('id', ids);
  if (error) { console.error('[bruecke:verknuepfen]', error); return { ok: false, error }; }
  return { ok: true, anzahl: ids.length };
}

/**
 * Löst die Verknüpfung wieder — für den Storno einer Rechnung.
 *
 * Ohne diesen Weg bliebe eine stornierte Rechnung als „schon abgerechnet"
 * an den Sitzungen kleben und der Podologe könnte sie nie neu berechnen.
 */
export async function verknuepfungLoesen(sb, { invoiceId }) {
  if (!invoiceId) return { ok: true };
  const { error } = await sb
    .from('podologie_behandlungen')
    .update({ invoice_id: null })
    .eq('invoice_id', invoiceId);
  if (error) { console.error('[bruecke:loesen]', error); return { ok: false, error }; }
  return { ok: true };
}

/**
 * Öffnet den vorbefüllten Rechnungsentwurf zu einer Verordnung.
 *
 * Der ganze Ablauf liegt hier und nicht in dashboard.js: die Datei wächst nicht
 * mehr (Konsey 2026-08-13), und der Weg ist ohnehin nur über den injizierten
 * Kontext an die Oberfläche gebunden.
 *
 * Gebucht wird nichts — der Entwurf geht auf, bestätigt wird von Hand.
 *
 * @param {object} ctx  Alles, was aus dashboard.js kommt:
 *   {sb, ownerId, verordnung, services, katalogPodo, switchPanel, openInvEditor,
 *    setzeEntwurf, toast}
 */
export async function starteRechnungAusVerordnung(ctx) {
  const { sb, ownerId, verordnung, services, katalogPodo,
          switchPanel, openInvEditor, setzeEntwurf, toast } = ctx;
  if (!verordnung) return;

  const offene = await offeneBehandlungen(sb, { ownerId, verordnungId: verordnung.id });
  if (!offene.length) {
    toast?.('Alle Behandlungen dieser Verordnung sind bereits abgerechnet.', 'info');
    return;
  }

  const { zeilen, offenePreise } = zeilenAusBehandlungen(offene, {
    verordnung, services, katalogPodo,
  });

  switchPanel('rechnungen');
  await openInvEditor(null);
  setzeEntwurf({
    patientId: verordnung.lead_id || verordnung.patient_id || '',
    zeilen,
    verordnungId: verordnung.id,
    behandlungIds: offene.map(b => b.id),
    // `rezeptart` sagt, WER zahlt. Der Steuersatz steht davon unabhängig an der
    // Zeile — siehe module/rechnung-steuer.js.
    zahlertyp: verordnung.rezeptart === 'selbstzahler' ? 'selbstzahler' : 'privat',
  });

  if (offenePreise > 0) {
    // Lieber eine sichtbare Lücke als eine unsichtbar falsche Zahl: der
    // GKV-Preis gilt privat nicht, und wer ihn übernimmt, rechnet unter Wert ab.
    toast?.(`${offenePreise} Position(en) ohne Privatpreis — bitte Betrag eintragen.`, 'warning');
  }
}

/**
 * Knopf-Markup für die Verordnungszeile.
 *
 * Nur bei Rezeptarten ausserhalb der Kasse: eine GKV-Verordnung wird über
 * § 302 abgerechnet, nicht über eine Patientenrechnung. Sie hier anzubieten
 * würde zu einer Rechnung führen, die der Patient nie zahlen muss.
 */
export function rechnungButtonHtml(vord, { label = 'Rechnung' } = {}) {
  if (!istPrivatRezeptart(vord?.rezeptart)) return '';
  return `<button class="pod-vord-rechnung" data-rechnung-vord-id="${vord.id}"
    title="Rechnung aus den offenen Behandlungen erstellen"
    style="padding:2px 8px;border-radius:6px;border:1px solid var(--border);
           background:var(--bg-card-solid,#1f2937);color:var(--text-main);
           font-size:12px;cursor:pointer;white-space:nowrap;">${label}</button>`;
}
