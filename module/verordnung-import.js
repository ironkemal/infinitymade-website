/**
 * verordnung-import.js — offene Podologie-Verordnungen aus der Altsoftware.
 *
 * Warum (20.10.2026): Teil des Praxiswechsels (Datenübernahme-Paket, Kemal).
 * Schritt 1 nach gkv-302: NUR Verordnungen, auf die noch keine Einheit
 * erbracht und die nirgends abgerechnet wurden (Fall D). Grund: eine
 * Verordnung rechnet genau ein System genau einmal ab, nach Abschluss
 * (Richtlinien §302 § 7 Abs. 1; Podologie Anlage 3 p). Halb behandelte
 * Verordnungen brauchen jeden Behandlungstag mit Datum + HPNR — das ist
 * Schritt 2 und hier bewusst nicht drin. Regel und Quellen:
 * wissensbank/SPEC-RULES.md „Übernahme offener VOs aus Altsoftware".
 *
 * Schreibweg: ausschließlich POST /api/rezept/confirm über
 * `verordnungFuerBackend()` + `sendeAnServer()` — derselbe Weg wie die
 * Muster-13-Maske (Beschluss 06.09.2026: kein zweiter Weg in prescriptions).
 * Der Server prüft dort nicht hart; die Pflichtprüfung passiert HIER, vor dem
 * Senden. Der Patient muss schon im Stamm sein (patient_id wird immer
 * mitgeschickt — der Server würde sonst mit eigener Regel suchen/anlegen).
 *
 * Zuordnung der Spalten: `zuordnungsSchritt()` aus patienten-import.js.
 */

import { leseCsv, leseDatum, norm, teileName, esc, BTN, SPALTEN, zuordnungsSchritt } from './patienten-import.js?v=20261020vo';
import { findePatientDublette } from './patient-dublette.js?v=20261020imp';
import { kartenIkNormalisieren } from './krankenkasse-suche.js?v=20261003e';
import { pruefeKvnr } from './kvnr.js?v=20260814';
import { behandlungsbeginnFrist } from './heilmittel-fristen.js?v=20261004m113';
import { normDgCode } from '../icd-dg-match.js?v=20261001b';
import { isValidLanr, LANR_ERSATZWERT } from './lanr-pruefung.js?v=20260929r';
import { POD_KATALOG } from './verordnung-regeln.js?v=20260918';
import { verordnungFuerBackend } from './verordnung-an-backend.js?v=20261006b';
import { sendeAnServer } from './verordnung-maske.js?v=20261017seven1';

// ── Spalten ─────────────────────────────────────────────────────────────

export const VO_SPALTEN = {
  altsystem_vo_nr: ['vonr', 'verordnungsnummer', 'verordnungsnr', 'rezeptnr', 'rezeptnummer', 'vonummer'],
  nachname: SPALTEN.nachname,
  vorname: SPALTEN.vorname,
  vollname: SPALTEN.vollname,
  geburtsdatum: SPALTEN.geburtsdatum,
  versichertennummer: SPALTEN.versichertennummer,
  versichertenstatus: ['versichertenstatus', 'versstatus'],
  krankenkasse: SPALTEN.krankenkasse,
  krankenkasse_ik: [...SPALTEN.krankenkasse_ik, 'ikkrankenkasse', 'ikkrankenkasse9stellig'],
  ausstellungsdatum: ['ausstellungsdatum', 'verordnungsdatum', 'ausgestelltam', 'vodatum', 'rezeptdatum', 'datumverordnung', 'ausstellung'],
  lanr: ['lanr', 'arztnummer', 'arztnr'],
  bsnr: ['bsnr', 'betriebsstaettennummer', 'betriebsstaettennr'],
  arztname: ['arzt', 'arztname', 'verordner', 'verordnenderarzt'],
  unterschrift: ['unterschrift', 'arztunterschrift', 'unterschriftvorhanden', 'stempelunterschrift', 'arztstempelunterschriftvorhanden', 'arztstempelunterschriftvorhandenjanein'],
  diagnosegruppe: ['diagnosegruppe', 'dg', 'indikationsschluessel', 'indikation'],
  icd10: ['icd10', 'icd', 'icd101', 'icdcode', 'icd1'],
  icd10_2: ['icd102', 'icd2'],
  diagnose_text: ['diagnose', 'diagnoseklartext', 'diagnosetext'],
  leitsymptomatik: ['leitsymptomatik', 'leitsymptomatikabc'],
  heilmittel: ['heilmittel', 'leistung', 'behandlungsart'],
  anzahl: ['anzahl', 'anzahleinheiten', 'einheiten', 'anzahleinheitenverordnet', 'menge', 'verordnungsmenge'],
  frequenz: ['frequenz', 'therapiefrequenz'],
  hausbesuch: ['hausbesuch', 'hausbesuchjanein'],
  dringlich: ['dringlich', 'dringend', 'dringlichjanein', 'dringlicherbehandlungsbedarf'],
  bericht: ['therapiebericht', 'therapieberichtangefordert', 'therapieberichtangefordertjanein', 'bericht'],
  zuzahlung_befreit: ['zuzahlungsbefreit', 'zuzahlungsbefreitjanein', 'befreit', 'zuzahlungsfrei'],
  nagel: ['nagel', 'nagelzb', 'nagelzbu1links', 'zeh'],
  wagner_grad: ['wagner', 'wagnergrad'],
  erbracht: ['erbracht', 'einheitenerbracht', 'bereitserbracht', 'behandelt'],
  abgerechnet: ['abgerechnet', 'imaltsystemabgerechnet', 'imaltsystemabgerechnetjanein', 'eingereicht'],
};

export const VO_FELDER = {
  nachname: 'Nachname', vorname: 'Vorname', vollname: 'Name komplett', geburtsdatum: 'Geburtsdatum',
  versichertennummer: 'Versichertennummer', versichertenstatus: 'Versichertenstatus',
  krankenkasse: 'Krankenkasse (Name)', krankenkasse_ik: 'IK der Krankenkasse',
  ausstellungsdatum: 'Ausstellungsdatum', lanr: 'LANR', bsnr: 'BSNR', arztname: 'Arzt (Name)',
  unterschrift: 'Arztstempel/Unterschrift vorhanden',
  diagnosegruppe: 'Diagnosegruppe (DF/NF/QF/UI1/UI2)', icd10: 'ICD-10', icd10_2: 'ICD-10 (2)', diagnose_text: 'Diagnose (Klartext)',
  leitsymptomatik: 'Leitsymptomatik (a/b/c)', heilmittel: 'Heilmittel',
  anzahl: 'Anzahl Einheiten', frequenz: 'Frequenz',
  hausbesuch: 'Hausbesuch (ja/nein)', dringlich: 'Dringlich (ja/nein)', bericht: 'Therapiebericht angefordert',
  zuzahlung_befreit: 'Zuzahlungsbefreit (ja/nein)', nagel: 'Nagel (z. B. U1 links)', wagner_grad: 'Wagner-Grad',
  erbracht: 'Einheiten schon erbracht', abgerechnet: 'Im Altsystem abgerechnet', altsystem_vo_nr: 'VO-Nr. (alt)',
};

const PFLICHT = ['Name', 'Geburtsdatum', 'Ausstellungsdatum', 'LANR', 'Diagnosegruppe', 'Heilmittel', 'Anzahl'];

export function voFehlendePflicht(zu) {
  const fehlt = [];
  if (zu.nachname == null && zu.vollname == null) fehlt.push('Name');
  if (zu.geburtsdatum == null) fehlt.push('Geburtsdatum');
  if (zu.ausstellungsdatum == null) fehlt.push('Ausstellungsdatum');
  if (zu.lanr == null) fehlt.push('LANR');
  if (zu.diagnosegruppe == null) fehlt.push('Diagnosegruppe');
  if (zu.leitsymptomatik == null && zu.heilmittel == null) fehlt.push('Heilmittel');
  if (zu.anzahl == null) fehlt.push('Anzahl');
  return fehlt;
}

// ── Werte ───────────────────────────────────────────────────────────────

const DG_ERLAUBT = new Set(['DF', 'NF', 'QF', 'UI1', 'UI2']);
/** Höchstmenge je Verordnung (verordnung-regeln.js, [Q1]: UI2 = 4). */
const HOECHSTMENGE = { DF: 6, NF: 6, QF: 6, UI1: 8, UI2: 4 };
const LS_CODE = { a: '1000', b: '0100', c: '0010' };

/** ja / nein / unbekannt(null) */
export function janein(roh) {
  const s = norm(roh);
  if (!s) return null;
  if (/^(ja|j|x|1|true|yes|y|vorhanden|wahr)$/.test(s)) return true;
  if (/^(nein|n|0|false|no|fehlt|falsch|leer)$/.test(s)) return false;
  return null;
}

/** „U1 links", „u1li", „U 1 L" → 'U1 links'; sonst null */
export function leseNagel(roh) {
  const m = String(roh ?? '').trim().match(/^U\s?([1-5])\s*(links|li|l|rechts|re|r)\.?$/i);
  return m ? `U${m[1]} ${/^l/i.test(m[2]) ? 'links' : 'rechts'}` : null;
}

/** Buchstabe a/b/c aus Leitsymptomatik oder Heilmittel-Text. */
function leitBuchstabe(ls, hm, dg) {
  const l = String(ls ?? '').trim().toLowerCase().replace(/^[a-z]{2}\d?[\s\-–—:.]+/, '');
  if (/^[abc]\)?$/.test(l)) return l[0];
  if (/^[01]{4}$/.test(l)) return ['a', 'b', 'c'][l.indexOf('1')] || null;
  const h = norm(hm);
  if (h) {
    for (const [b, text] of Object.entries(POD_KATALOG[dg] || {})) if (norm(text) === h || h.includes(norm(text))) return b;
    if (/komplex/.test(h)) return 'c';
    if (/nagelspange/.test(h)) return 'a';
    if (/nagel/.test(h)) return 'b';
    if (/hornhaut/.test(h)) return 'a';
  }
  return dg === 'UI1' || dg === 'UI2' ? 'a' : null;   // UI kennt nur a)
}

/**
 * Eine Zeile → Verordnung + Fehler/Hinweise.
 * @param {string[]} werte
 * @param {object} zu  Feld → Spaltenindex
 * @param {{ patienten: object[], vorhandeneVo: Set<string>, heute: string }} k
 */
export function zeileZuVerordnung(werte, zu, k) {
  const w = (f) => (zu[f] != null ? String(werte[zu[f]] ?? '').trim() : '');
  const fehler = [], hinweise = [];

  // Patient — muss im Stamm sein
  let vor = w('vorname'), nach = w('nachname');
  if ((!vor || !nach) && w('vollname')) ({ vor, nach } = teileName(w('vollname')));
  const geburtsdatum = leseDatum(w('geburtsdatum'));
  const kvnrRoh = w('versichertennummer');
  const patient = findePatientDublette(
    { first_name: vor, last_name: nach, geburtsdatum, versichertennummer: kvnrRoh }, k.patienten);
  if (!patient) fehler.push('Patient nicht im Patientenstamm — zuerst Patienten importieren');

  // Versicherung: Zeile, sonst Patientenakte
  const kvnr = pruefeKvnr(kvnrRoh || patient?.versichertennummer || '');
  if (!kvnr.normalisiert) fehler.push('Versichertennummer fehlt');
  else if (!kvnr.ok) hinweise.push('Versichertennummer auffällig');
  const ikRoh = w('krankenkasse_ik');
  const ik = kartenIkNormalisieren(ikRoh) || kartenIkNormalisieren(patient?.krankenkasse_ik);
  if (ikRoh && !kartenIkNormalisieren(ikRoh)) fehler.push('IK der Krankenkasse nicht 9-stellig');
  const kasse = w('krankenkasse') || patient?.krankenkasse || '';
  if (!ik && !kasse) fehler.push('Krankenkasse fehlt');
  else if (!ik) hinweise.push('Karten-IK fehlt — Abrechnung erst nach Ergänzung');
  const vsRoh = w('versichertenstatus') || patient?.versichertenstatus || '';
  if (vsRoh && !/^[1359]\d{4}$/.test(vsRoh)) hinweise.push('Versichertenstatus ungewöhnlich');

  // Arzt
  const ausstellungsdatum = leseDatum(w('ausstellungsdatum'));
  if (!ausstellungsdatum) fehler.push(w('ausstellungsdatum') ? 'Ausstellungsdatum nicht lesbar' : 'Ausstellungsdatum fehlt');
  const lanr = w('lanr').replace(/\D/g, '');
  if (!/^\d{9}$/.test(lanr) || lanr === LANR_ERSATZWERT) fehler.push('LANR fehlt oder nicht 9-stellig');
  else if (!isValidLanr(lanr)) hinweise.push('LANR-Prüfziffer stimmt nicht');
  const bsnr = w('bsnr').replace(/\D/g, '');
  if (!bsnr) hinweise.push('BSNR fehlt');
  if (zu.unterschrift != null && janein(w('unterschrift')) !== true) fehler.push('Ohne Arztstempel/Unterschrift');

  // Diagnose + Heilmittel
  const dg = normDgCode(w('diagnosegruppe'));
  if (!DG_ERLAUBT.has(dg)) fehler.push(dg ? `Diagnosegruppe „${w('diagnosegruppe')}" ist keine Podologie-Gruppe` : 'Diagnosegruppe fehlt');
  const buchstabe = DG_ERLAUBT.has(dg) ? leitBuchstabe(w('leitsymptomatik'), w('heilmittel'), dg) : null;
  const heilmittel = buchstabe ? POD_KATALOG[dg]?.[buchstabe] : null;
  if (DG_ERLAUBT.has(dg) && !heilmittel) fehler.push(buchstabe ? `${dg} kennt Leitsymptomatik ${buchstabe}) nicht` : 'Heilmittel/Leitsymptomatik nicht erkennbar');
  const icd10 = w('icd10').toUpperCase() || null;
  const diagnoseText = w('diagnose_text') || null;
  if (!icd10 && !diagnoseText) hinweise.push('Ohne ICD und Diagnosetext — vor der Abrechnung ergänzen');
  if ((dg === 'UI1' || dg === 'UI2') && icd10 && !/^L60\.0/.test(icd10)) hinweise.push('UI verlangt ICD L60.0');

  const anzahl = Number.parseInt(w('anzahl'), 10);
  if (!Number.isInteger(anzahl) || anzahl < 1) fehler.push('Anzahl Einheiten fehlt');
  else if (HOECHSTMENGE[dg] && anzahl > HOECHSTMENGE[dg]) hinweise.push(`Mehr als ${HOECHSTMENGE[dg]} Einheiten — nur bis zur Höchstmenge abrechenbar`);

  const nagelRoh = w('nagel');
  const nagel = leseNagel(nagelRoh);
  if (nagelRoh && !nagel) hinweise.push(`Nagel „${nagelRoh}" nicht erkannt`);
  if ((dg === 'UI1' || dg === 'UI2') && !nagel) hinweise.push('Nagel fehlt (Pflicht vor der Abrechnung)');
  const wRoh = w('wagner_grad');
  const wagner = /^[0-5]$/.test(wRoh) ? Number(wRoh) : null;
  if (wRoh && wagner == null) hinweise.push('Wagner-Grad nicht 0–5');

  // Schritt 1: nur unbehandelte, nirgends abgerechnete Verordnungen
  const dringlich = janein(w('dringlich')) === true;
  const erbracht = Number.parseInt(w('erbracht'), 10);
  if (erbracht > 0) fehler.push('Schon behandelt — halb behandelte Verordnungen folgen in einem späteren Schritt');
  if (janein(w('abgerechnet')) === true) fehler.push('Im Altsystem schon abgerechnet — nicht übernehmen');
  const frist = ausstellungsdatum ? behandlungsbeginnFrist(ausstellungsdatum, dringlich) : null;
  if (frist && k.heute > frist) fehler.push(`Beginnfrist am ${frist.split('-').reverse().join('.')} abgelaufen (HeilM-RL § 15)`);

  // Schon vorhanden?
  const schluessel = patient && ausstellungsdatum ? `${patient.id}|${ausstellungsdatum}|${lanr}|${dg}` : null;
  if (schluessel && k.vorhandeneVo.has(schluessel)) fehler.push('Verordnung ist schon in Praxura');

  const verordnung = {
    patient, csvName: [nach, vor].filter(Boolean).join(', '), ausstellungsdatum, lanr, bsnr: bsnr || null, arztName: w('arztname') || null,
    dg, buchstabe, heilmittel, icd10, icd10_2: w('icd10_2').toUpperCase() || null, diagnoseText,
    anzahl: Number.isInteger(anzahl) ? anzahl : null, frequenz: w('frequenz') || null,
    hausbesuch: janein(w('hausbesuch')) === true, dringlich,
    bericht: janein(w('bericht')) === true, befreit: janein(w('zuzahlung_befreit')) === true,
    nagel, wagner, ik, kasse, kvnr: kvnr.normalisiert || null, versichertenstatus: vsRoh || null,
    altNr: w('altsystem_vo_nr') || null,
  };
  return { verordnung, fehler, hinweise, schluessel };
}

/** Ganze Datei prüfen. */
export function pruefeVerordnungen(text, zu, k) {
  const [, ...daten] = leseCsv(text);
  const gesehen = new Map();
  const zeilen = daten.map((werte, i) => {
    const z = { nr: i + 2, ...zeileZuVerordnung(werte, zu, k) };
    if (!z.fehler.length && z.schluessel) {
      if (gesehen.has(z.schluessel)) z.fehler.push(`doppelt in Datei (Zeile ${gesehen.get(z.schluessel)})`);
      else gesehen.set(z.schluessel, z.nr);
    }
    return z;
  });
  return { zeilen, ok: zeilen.filter(z => !z.fehler.length).length, fehlerhaft: zeilen.filter(z => z.fehler.length).length };
}

/** Rumpf für POST /api/rezept/confirm — über den gemeinsamen Baustein der Maske. */
export function voRumpf(v, heute) {
  const p = v.patient || {};
  return verordnungFuerBackend({
    nutzlast: {
      patient_id: p.id,
      therapie_bereich: 'podo',
      ausstellungsdatum: v.ausstellungsdatum,
      doctor_lanr: v.lanr,
      doctor_bsnr: v.bsnr,
      diagnosegruppe: v.dg,
      icd10: v.icd10,
      icd10_2: v.icd10_2,
      diagnose_freitext: v.diagnoseText,
      leitsymptomatik: LS_CODE[v.buchstabe] || null,
      heilmittel: v.heilmittel,
      heilmittel_feld_text: v.heilmittel,
      anzahl_einheiten: v.anzahl,
      frequenz: v.frequenz,
      is_dringend: v.dringlich,
      hausbesuch: v.hausbesuch,
      zuzahlung_befreit: v.befreit,
      bericht_angefordert: v.bericht,
      unterschrift_vorhanden: true,   // ohne Unterschrift wird die Zeile vorher abgelehnt
      nagel: v.nagel,
      wagner_grad: v.wagner,
      hinweise: `Aus Altsystem übernommen am ${heute.split('-').reverse().join('.')}${v.altNr ? ` (VO-Nr. ${v.altNr})` : ''}.`,
    },
    patientFelder: {
      rzPatVorname: p.first_name || '', rzPatName: p.last_name || '',
      rzPatGeb: p.geburtsdatum || '', rzPatVersNr: v.kvnr || '', rzPatStatus: v.versichertenstatus || '',
      rzPatKasse: v.kasse || '', rzPatKasseIk: v.ik || '', rzArztName: v.arztName || '',
    },
  });
}

export const VO_VORLAGE_CSV = '﻿Nachname;Vorname;Geburtsdatum;Versichertennummer;Versichertenstatus;Krankenkasse;IK Krankenkasse;Ausstellungsdatum;LANR;BSNR;Arzt;Arztstempel/Unterschrift vorhanden;Diagnosegruppe;ICD-10;Diagnose;Leitsymptomatik;Anzahl Einheiten;Frequenz;Hausbesuch;Dringlich;Therapiebericht angefordert;Zuzahlungsbefreit;Nagel;Einheiten schon erbracht;Im Altsystem abgerechnet;VO-Nr\n'
  + 'Muster;Erika;01.02.1950;A123456780;10000;AOK Rheinland/Hamburg;104212505;15.10.2026;123456601;123456700;Dr. Beispiel;ja;DF;E11.74;;c;6;1x in 4-6 Wochen;nein;nein;nein;nein;;0;nein;4711\n';

// ── Oberfläche ──────────────────────────────────────────────────────────

const berlinHeute = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());

/**
 * @param {{ supabase, ownerId: string, apiBasis: string, bestehende: () => object[], showToast: Function, nachImport: (anzahl:number) => Promise<void>|void }} d
 */
export function oeffneVerordnungImport(d) {
  document.getElementById('verordnungImportModal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'verordnungImportModal';
  modal.className = 'modal-overlay';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.innerHTML = `
    <div role="dialog" aria-modal="true" aria-labelledby="viTitel" style="background:var(--bg-card-solid);color:var(--text-main);border:1px solid var(--border);border-radius:12px;max-width:820px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:20px 24px 12px;">
        <h3 id="viTitel" style="margin:0;font-size:18px;">Offene Verordnungen importieren <span style="font-weight:400;color:var(--text-muted);font-size:14px;">· Podologie</span></h3>
        <button type="button" data-pi="zu" aria-label="Schließen" style="background:none;border:none;font-size:22px;color:var(--text-muted);cursor:pointer;">✕</button>
      </div>
      <div data-pi="inhalt" style="padding:0 24px;overflow:auto;flex:1;"></div>
      <div data-pi="fuss" style="display:flex;gap:8px;justify-content:flex-end;align-items:center;flex-wrap:wrap;padding:16px 24px;border-top:1px solid var(--border);"></div>
    </div>`;
  document.body.appendChild(modal);

  const inhalt = modal.querySelector('[data-pi="inhalt"]');
  const fuss = modal.querySelector('[data-pi="fuss"]');
  let laeuft = false;
  const schliessen = () => { if (laeuft) return; modal.remove(); document.removeEventListener('keydown', escTaste); };
  const escTaste = (e) => { if (e.key === 'Escape') schliessen(); };
  document.addEventListener('keydown', escTaste);
  modal.querySelector('[data-pi="zu"]').addEventListener('click', schliessen);
  modal.addEventListener('click', (e) => { if (e.target === modal) schliessen(); });

  const schritt1 = () => {
    inhalt.innerHTML = `
      <p style="margin:0 0 10px;color:var(--text-muted);font-size:14px;line-height:1.5;">
        Übernommen werden nur Verordnungen, auf die <b>noch keine Behandlung</b> erbracht wurde und die Ihre bisherige Software
        <b>nicht abrechnet</b>. Halb behandelte Verordnungen rechnen Sie bitte im Altsystem zu Ende ab.
      </p>
      <p style="margin:0 0 12px;color:var(--text-muted);font-size:14px;line-height:1.5;">
        Die Patienten müssen schon in Praxura sein (zuerst <i>Patienten importieren</i>). Pro Verordnung nötig:
        Ausstellungsdatum, LANR, Diagnosegruppe, Leitsymptomatik bzw. Heilmittel, Anzahl.
      </p>
      <label style="display:block;border:1px dashed var(--border);border-radius:8px;padding:28px;text-align:center;cursor:pointer;">
        <input type="file" accept=".csv,.txt,text/csv" data-pi="datei" style="display:none;" />
        <span style="font-weight:600;">CSV-Datei auswählen</span>
      </label>
      <p style="margin:12px 0 16px;font-size:13px;"><a href="#" data-pi="vorlage">Vorlage herunterladen</a></p>`;
    fuss.innerHTML = `<button type="button" class="btn-ghost" data-pi="abbr" style="${BTN}">Abbrechen</button>`;
    fuss.querySelector('[data-pi="abbr"]').addEventListener('click', schliessen);
    inhalt.querySelector('[data-pi="vorlage"]').addEventListener('click', (e) => {
      e.preventDefault();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([VO_VORLAGE_CSV], { type: 'text/csv;charset=utf-8' }));
      a.download = 'praxura-verordnungen-vorlage.csv';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    inhalt.querySelector('[data-pi="datei"]').addEventListener('change', async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      let text = await f.text();
      if (text.includes('�')) {
        try { text = new TextDecoder('windows-1252').decode(await f.arrayBuffer()); } catch { /* bleibt UTF-8 */ }
      }
      const [kopf = [], ...daten] = leseCsv(text);
      if (!kopf.length || !daten.length) { d.showToast('Die Datei enthält keine Zeilen.', 'error'); return; }
      zuordnungsSchritt({
        inhalt, fuss, kopf, daten,
        felder: VO_FELDER, spalten: VO_SPALTEN, fehlendePflicht: voFehlendePflicht, pflichtNamen: PFLICHT,
        merkPraefix: 'praxura.import.vo.zuordnung.',
        hinweis: 'Fehlen Versichertennummer oder Kasse in der Datei, nimmt Praxura sie aus der Patientenakte.',
        zurueck: schritt1,
        weiter: (zu, wiederZeigen) => vorschau(text, zu, wiederZeigen),
      });
    });
  };

  const vorschau = async (text, zu, zurZuordnung) => {
    inhalt.innerHTML = '<p style="font-size:14px;color:var(--text-muted);">Vorhandene Verordnungen werden abgeglichen …</p>';
    const { data: vorhanden, error } = await d.supabase.from('prescriptions')
      .select('patient_id, ausstellungsdatum, doctor_lanr, diagnosegruppe')
      .eq('owner_id', d.ownerId).eq('therapie_bereich', 'podo');
    if (error) { d.showToast('Vorhandene Verordnungen konnten nicht geladen werden.', 'error'); zurZuordnung(); return; }
    const vorhandeneVo = new Set((vorhanden || []).map(r => `${r.patient_id}|${r.ausstellungsdatum}|${r.doctor_lanr || ''}|${r.diagnosegruppe || ''}`));
    const heute = berlinHeute();
    const erg = pruefeVerordnungen(text, zu, { patienten: d.bestehende() || [], vorhandeneVo, heute });

    const status = (z) => z.fehler.length
      ? `<span style="color:var(--danger,#b42318);">${esc(z.fehler.join(' · '))}</span>`
      : z.hinweise.length ? `<span style="color:var(--warning,#b54708);">übernehmen · ${esc(z.hinweise.join(' · '))}</span>`
      : 'übernehmen';
    const reihen = erg.zeilen.slice(0, 200).map(z => {
      const v = z.verordnung;
      const name = v.patient ? `${v.patient.last_name}, ${v.patient.first_name}` : (v.csvName || '—');
      return `<tr style="border-top:1px solid var(--border);">
        <td style="padding:6px 8px;color:var(--text-muted);">${z.nr}</td>
        <td style="padding:6px 8px;white-space:nowrap;">${esc(name)}</td>
        <td style="padding:6px 8px;white-space:nowrap;">${esc(v.ausstellungsdatum ? v.ausstellungsdatum.split('-').reverse().join('.') : '')}</td>
        <td style="padding:6px 8px;white-space:nowrap;">${esc([v.dg, v.buchstabe && v.buchstabe + ')', v.anzahl && '× ' + v.anzahl].filter(Boolean).join(' '))}</td>
        <td style="padding:6px 8px;">${status(z)}</td></tr>`;
    }).join('');
    inhalt.innerHTML = `
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin:0 0 12px;font-size:14px;">
        <span><b>${erg.ok}</b> übernehmen</span>
        <span style="color:${erg.fehlerhaft ? 'var(--danger,#b42318)' : 'var(--text-muted)'};"><b>${erg.fehlerhaft}</b> nicht übernehmbar</span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="text-align:left;color:var(--text-muted);"><th style="padding:6px 8px;">Zeile</th><th style="padding:6px 8px;">Patient</th><th style="padding:6px 8px;">Ausgestellt</th><th style="padding:6px 8px;">DG</th><th style="padding:6px 8px;">Ergebnis</th></tr></thead>
        <tbody>${reihen}</tbody>
      </table>
      ${erg.zeilen.length > 200 ? `<p style="font-size:13px;color:var(--text-muted);">… und ${erg.zeilen.length - 200} weitere Zeilen.</p>` : ''}
      <label style="display:flex;gap:10px;align-items:flex-start;margin:16px 0;padding:12px;border:1px solid var(--border);border-radius:8px;font-size:13px;line-height:1.5;cursor:pointer;">
        <input type="checkbox" data-pi="bestaetigt" style="margin-top:3px;" />
        <span>Ich bestätige: Auf keine dieser Verordnungen wurde schon eine Behandlung erbracht. Jede trägt Arztstempel und Unterschrift.
        Meine bisherige Software rechnet sie <b>nicht</b> ab — abgerechnet wird nur noch über Praxura (sonst Doppelabrechnung).</span>
      </label>`;
    fuss.innerHTML = `
      <button type="button" class="btn-ghost" data-pi="zuordnung" style="${BTN}">Zuordnung ändern</button>
      <button type="button" class="btn-primary" data-pi="los" style="${BTN}opacity:.45;cursor:not-allowed;" disabled>${erg.ok} Verordnung${erg.ok === 1 ? '' : 'en'} übernehmen</button>`;
    const los = fuss.querySelector('[data-pi="los"]');
    inhalt.querySelector('[data-pi="bestaetigt"]').addEventListener('change', (e) => {
      const an = e.target.checked && erg.ok > 0;
      los.disabled = !an;
      los.style.opacity = an ? '' : '.45';
      los.style.cursor = an ? 'pointer' : 'not-allowed';
    });
    fuss.querySelector('[data-pi="zuordnung"]').addEventListener('click', zurZuordnung);
    los.addEventListener('click', () => senden(erg.zeilen.filter(z => !z.fehler.length), heute));
  };

  const senden = async (zeilen, heute) => {
    laeuft = true;
    let ok = 0;
    const fehlgeschlagen = [];
    fuss.innerHTML = '';
    for (const [i, z] of zeilen.entries()) {
      inhalt.innerHTML = `<p style="font-size:15px;margin:0 0 16px;">Übernehme Verordnung ${i + 1} von ${zeilen.length} …</p>`;
      try {
        await sendeAnServer(d.supabase, { methode: 'POST', pfad: '/rezept/confirm', rumpf: voRumpf(z.verordnung, heute), apiBasis: d.apiBasis });
        ok++;
      } catch (err) {
        // Nur Zeilennummer + Servertext — keine Patientendaten ins Log.
        fehlgeschlagen.push({ nr: z.nr, grund: err?.message || 'Fehler' });
      }
    }
    laeuft = false;
    if (ok) await d.nachImport(ok);
    inhalt.innerHTML = `
      <p style="margin:0 0 12px;font-size:15px;"><b>${ok}</b> Verordnung${ok === 1 ? '' : 'en'} übernommen.</p>
      ${fehlgeschlagen.length ? `<p style="margin:0 0 8px;font-size:14px;color:var(--danger,#b42318);">${fehlgeschlagen.length} nicht übernommen:</p>
        <ul style="margin:0 0 12px;padding-left:18px;font-size:13px;">${fehlgeschlagen.map(f => `<li>Zeile ${f.nr}: ${esc(f.grund)}</li>`).join('')}</ul>` : ''}
      <p style="margin:0 0 16px;font-size:13px;color:var(--text-muted);">Übernommene Verordnungen tragen den Hinweis „Aus Altsystem übernommen". Bitte vor dem ersten Termin kurz gegen das Papier prüfen.</p>`;
    fuss.innerHTML = `<button type="button" class="btn-primary" data-pi="fertig" style="${BTN}">Fertig</button>`;
    fuss.querySelector('[data-pi="fertig"]').addEventListener('click', schliessen);
  };

  schritt1();
}
