/**
 * podologie-abrechnung.js — „Behandlungen": Tagesbehandlung und Verordnungsliste
 * der Podologie.
 *
 * ⚠ Der Dateiname stimmt seit dem 09.09.2026 nicht mehr ganz. Der §302-Teil ist
 * ausgezogen: Auswahlliste, Sammellauf, Dateieinheit-Abzeichen, „trotzdem
 * übernehmen" und der Abrechnungszeitraum stehen jetzt in
 * `module/abrechnung-auswahl.js`, gemeinsam mit Physio/Ergo/Logo — EIN
 * §302-Bildschirm für alle vier Fachbereiche (`ABRECHNUNG_BILDSCHIRM_PLAN.md`,
 * Abschnitt 0 Nr. 1 und Phase 1). Umbenannt wurde die Datei NICHT: ein
 * Dateiname ist billiger falsch als eine Umbenennung, die jeden Import, jeden
 * Cache-Buster und jede Fundstelle in `funktionen/INDEX.json` mitzieht.
 * Was hier bleibt: eine Behandlung auf eine bestehende Verordnung buchen, mit
 * allen Vertragssperren (78040 · 78100 · Erstbefundung je Nagel), und die
 * Verordnungsliste dieser Praxis.
 *
 * Herkunft
 * ────────
 * Reiner Umzug aus `dashboard.js` (Zeilen 23351–24617), Stand 27.08.2026.
 * Grundlage ist die Einkreisungs-Entscheidung des Konseys vom 13.08.2026:
 * `dashboard.js` wächst nicht mehr, und was angefasst wird, zieht um. Die
 * Podologie war als zusammenhängender Block der erste Kandidat.
 *
 * ⚠ An Aussehen und Verhalten wurde beim Umzug NICHTS geändert. Auch bekannte
 * Fehler sind mitgezogen worden, statt sie unterwegs zu reparieren — ein Umzug,
 * bei dem gleichzeitig repariert wird, lässt sich hinterher nicht mehr prüfen.
 *
 * Nachgereicht am 28.08.2026: der Zuhörer der §302-Knöpfe hängte sich bei jedem
 * Rendern erneut an das statische `#podBillingContent` und sammelte sich an —
 * ein Klick löste nach N Renderungen N Anfragen aus. Er sitzt jetzt wie der
 * Listen-Zuhörer EINMAL auf Modulebene (siehe dort). Gegenstück im Backend:
 * bereits abgerechnete Verordnungen werden mit 409 abgewiesen.
 *
 * Was NICHT mitgekommen ist
 * ─────────────────────────
 * `rechnungAusVerordnung()` bleibt in `dashboard.js`. Die Funktion SCHREIBT in
 * `invLines`, `invVerordnungId`, `invBehandlungIds` und
 * `invPatientInsuranceType` — Modul-Variablen des Rechnungseditors. Import-
 * Bindungen sind in ES-Modulen schreibgeschützt, eine Zuweisung von hier aus
 * wäre ein TypeError. Sie kommt als `ctx.rechnungAusVerordnung` herein und
 * holt sich die Verordnung über den Export `getPodVerordnung()`.
 *
 * Die ICD-Regeln der Diagnosegruppen sind in `diagnosegruppen-regeln.js`
 * gelandet, nicht hier: die Tabelle `diagnosegruppen` gehört nicht der
 * Podologie, `_wireDgIcdPair` bedient damit auch Rezept-Formular und
 * Rezept-Scan.
 *
 * Nicht verwechseln
 * ─────────────────
 * `POD_HEILMITTEL_KATALOG` hier und `POD_KATALOG` in `verordnung-podo.js`
 * halten ähnliche Angaben, gehören aber zu zwei verschiedenen Bildschirmen.
 * Nicht zusammenlegen.
 *
 * Verdrahtung
 * ───────────
 * `dashboard.js` ruft `mountPodologieAbrechnung(podoCtx())` auf. `podoCtx()`
 * liefert die Abhängigkeiten; `leads` und `services` kommen als GETTER, weil
 * `leadsCache` und `ownerServices` in dashboard.js neu zugewiesen werden — als
 * Wert übergeben hielte dieses Modul für immer das leere Array vom ersten
 * Aufruf.
 */

import { parseIcdList, matchIcdToDg } from '../icd-dg-match.js?v=20260810e';
import { searchHeilmittel, heilmittelOptionsHtml } from '../katalog-suche.js?v=20260817';
import { statusBadge as abrStatusBadge, oeffneStatusDialogFuer } from './abrechnungsstatus.js?v=20260910b';
import { rechnungButtonHtml } from './rechnung-bruecke.js?v=20260816';
import { belegnummerRosette } from './belegnummer.js?v=20260817';
import { loadDgIcdRules } from './diagnosegruppen-regeln.js?v=20260827';
import { standortZuschnitt, istPraxisweit } from './standort-zuschnitt.js?v=20260828';
import { alsISODatum } from './datum.js?v=20260901';
// 78030/78040: Regel und Begruendung liegen in eingangsbefundung-regel.js,
// dort neben ihrem Test — diese Datei laesst sich in node nicht importieren.
import { darf78040, darf78100, darfErstbefundungNagel,
         POD_EINGANGSBEFUNDUNG, POD_BEFUNDPAUSCHALE,
         POD_ERSTBEFUNDUNG_GROSS, POD_ERSTBEFUNDUNGEN,
         nagelLabel }
  from './eingangsbefundung-regel.js?v=20260904';
// Seit 04.09.2026 gibt es EINEN Verordnungstopf (`prescriptions`). Diese Datei
// behaelt ihren podologischen Wortschatz; uebersetzt wird an der Grenze.
import { TOPF, PODO_SELECT, PODO_ARBEITSLISTE_OR, ausTopf, inTopf, statusInTopf, patientAnzeigename }
  from './verordnung-topf.js?v=20260910';

let ctx = null;                 // Abhängigkeiten aus dashboard.js, gesetzt in mountPodologieAbrechnung()

// ===== PODOLOGIE BILLING =====

// HPNR-Positionen kommen aus `heilmittel_katalog` (RPC search_heilmittel),
// erzeugt aus den Abrechnungs-Codedateien. Die früher hier fest verdrahtete
// Liste kannte nur 13 Kodes und keine Gültigkeitsdaten — dadurch fehlten der
// Hausbesuch (79933/79934) bei UI1/UI2, und abgelöste Positionen hätten nicht
// von den gültigen unterschieden werden können.
let _hpnrByDiag = new Map();   // diagRoot -> [{code,label,preis_eur,…}]
let _podCurrentHpnr = [];      // die aktuell gerenderte Liste

async function podLoadHpnr(diagRoot, datum = null) {
  const key = `${diagRoot}|${datum || ''}`;
  if (_hpnrByDiag.has(key)) return _hpnrByDiag.get(key);
  const rows = await searchHeilmittel(ctx.supabase, '', {
    bereich: 'podologie', diagnosegruppe: diagRoot || null, datum, limit: 100,
  });
  _hpnrByDiag.set(key, rows);
  return rows;
}

/** Label für eine HPNR aus dem geladenen Katalog (Fallback: der Kode selbst). */
function hpnrLabel(code) {
  const cur = _podCurrentHpnr.find(r => r.code === code);
  if (cur) return cur.label;
  for (const rows of _hpnrByDiag.values()) {
    const hit = rows.find(r => r.code === code);
    if (hit) return hit.label;
  }
  return code;
}

function podDiagRoot(diagCode) {
  if (!diagCode) return '';
  if (diagCode.startsWith('DF')) return 'DF';
  return diagCode; // NF, QF, UI1, UI2
}

// ─── Muster 13, Feld g: verordnetes Heilmittel ────────────────────────────────
//
// Quelle: HeilM-RL (Stand 15.05.2025, iK 05.08.2025), Heilmittelkatalog
// Podologische Therapie. Für DF, NF und QF ist der Katalog wortgleich; UI1/UI2
// haben keinen a/b/c-Katalog (dort läuft die Nagelspangenbehandlung).
// Leitsymptomatik und Heilmittel sind in der Richtlinie parallel buchstabiert:
// a↔a, b↔b, c↔c.
//
// ⚠ Positionszuordnung — hier wird am häufigsten zu viel abgerechnet:
// Hornhautabtragung ODER Nagelbearbeitung allein werden IMMER mit 78010 zzgl.
// 78030 abgerechnet, auch bei mehr als 20 Minuten Therapiezeit
// (FAK Podologie Q25). 78020 „Podologische Behandlung (groß)" ist
// ausschließlich bei verordneter Komplexbehandlung mit Therapiezeit über
// 20 Minuten abrechenbar — sonst Retaxation (~15 € je Sitzung).
// Siehe wissensbank/SPEC-RULES.md und Podoloji/podologie-hpnr-reference.js.
const POD_HEILMITTEL_KATALOG = {
  a: {
    heilmittel:      'Hornhautabtragung',
    leitsymptomatik: 'Hyperkeratose (schmerzlos und schmerzhaft)',
    hpnr:            '78010',
    hpnrGross:       null,
  },
  b: {
    heilmittel:      'Nagelbearbeitung',
    leitsymptomatik: 'Pathologisches Nagelwachstum (Verdickung, Tendenz zum Einwachsen)',
    hpnr:            '78010',
    hpnrGross:       null,
  },
  c: {
    heilmittel:      'Podologische Komplexbehandlung',
    leitsymptomatik: 'Hyperkeratose und pathologisches Nagelwachstum',
    hpnr:            '78010',
    hpnrGross:       '78020',   // nur bei Therapiezeit > 20 Min
  },
};
const POD_HEILMITTEL_DGS  = ['DF', 'NF', 'QF'];  // UI1/UI2 haben keinen a/b/c-Katalog

/**
 * Darf für diesen Patienten heute noch die Eingangsbefundung (78040) gesetzt
 * werden — und ist der gewählte Tag der richtige dafür?
 *
 * Die Regel steht in Anlage 1a Leistungsbeschreibung i.d.F. 17.06.2024
 * (Vertrag § 125 Abs. 1 SGB V Podologie), Teil 1 Nr. 2 und Teil 2 Ziffer 4.1:
 *
 *   „Bei Patienten die ab dem 01.11.2023 erstmalig eine podologische Leistung
 *    bei einem zugelassenen Leistungserbringer in Anspruch nehmen, ist ohne
 *    gesonderte Verordnung … einmalig eine podologische Eingangsbefundung …
 *    durchzuführen. Die podologische Eingangsbefundung erfolgt VOR DER ERSTEN
 *    ABGABE einer podologischen Leistung …"
 *
 * Daraus folgen zwei Sperren — die zweite fehlte bis zum 31.08.2026 und war
 * der eigentliche Absetzungsgrund: bisher wurde nur geprüft, ob 78040 schon
 * einmal abgerechnet wurde, nicht, ob der Patient überhaupt noch am Anfang
 * steht. Wer im dritten Termin einer laufenden Serie „die haben wir ja noch
 * nie abgerechnet" dachte, bekam die 78040 durch — und von der Kasse zurück.
 *
 * ⚠️ Bezugsgröße: die Sperre läuft über `owner_id`, also je Praxis. Ob der
 * Vertrag „einmal je Praxis" oder „einmal im Leben" meint, ist aus dem
 * Wortlaut („bei einem zugelassenen Leistungserbringer") NICHT entscheidbar;
 * die klärende Änderungsvereinbarung vom 20.10.2023 liegt nicht im Archiv.
 * Praxisweit ist die vorsichtigere der beiden Lesarten — deshalb so, bis der
 * Beleg da ist (wissensbank/SPEC-RULES.md, Doğrulama kuyruğu).
 *
 * ⚠️ NICHT abgedeckt: Patienten, die schon VOR dem 01.11.2023 podologisch
 * behandelt wurden, erwerben den Anspruch nie. Diese Historie steht bei einer
 * frisch migrierten Praxis in keiner Datenbank; dafür braucht es eine
 * quittierte Anamneseangabe am Patienten (eigene Aufgabe, Ops-Dashboard).
 *
 * @param {object} vord   Zeile im podologischen Wortschatz (verordnung-topf.js), braucht lead_id ODER patient_name
 * @param {string} datum  geplanter Behandlungstag, `YYYY-MM-DD`
 * @returns {Promise<{erlaubt:boolean, grund:string, schonAm:?string, ersteAm:?string}>}
 */
/**
 * Alle Behandlungen dieses Patienten — ueber ALLE seine Verordnungen, auch
 * abgeschlossene. Die Grundlage jeder Frequenzregel (78040, 78100).
 *
 * Kein Standort-Zuschnitt: die Verordnung gehoert der Praxis, nicht der
 * Filiale (standort-zuschnitt.js) — auch wenn die Zieltabelle seit der
 * Zusammenlegung `business_id` fuehrt, bleibt diese Sperre praxisweit,
 * sonst umgeht ein Standortwechsel sie.
 *
 * ⚠️ Der `patient_name`-Zweig ist ein reiner Zeichenkettenvergleich und
 * greift nur bei Verordnungen ohne `lead_id` (Altbestand). Zwei gleichnamige
 * Patienten derselben Praxis sperren sich damit gegenseitig. Bewusst so
 * gelassen: die Meldung nennt Name und Datum, der Podologe sieht den Irrtum
 * sofort — eine faelschlich DURCHGELASSENE Position faellt dagegen erst als
 * Absetzung auf, Monate spaeter.
 *
 * Jede Zeile traegt zusaetzlich den `nagel` IHRER Verordnung — die
 * Serienregel (§ 3b lit. a) braucht ihn, und ohne ihn hier waere eine dritte
 * Rundreise noetig.
 *
 * @param {object} vord  Zeile im podologischen Wortschatz (verordnung-topf.js), braucht lead_id ODER patient_name
 * @returns {Promise<Array<{behandlungsdatum:string, hpnr_codes:?Array<string>, nagel:?string}>>}
 */
async function podPatientBehandlungen(vord) {
  if (!vord || !(vord.lead_id || vord.patient_name)) return [];

  // `therapie_bereich` gehoert dazu, seit beide Verordnungstoepfe eine Tabelle
  // sind: ohne ihn nimmt die `.in()`-Liste auch Physio-Verordnungen auf. Heute
  // folgenlos (an denen haengt keine `podologie_behandlungen`-Zeile), aber eine
  // einzige Fehlzuordnung wuerde diese Sperren still oeffnen.
  let q = ctx.supabase.from(TOPF).select('id, nagel')
    .eq('owner_id', ctx.getOwnerId())
    .eq('therapie_bereich', 'podo');
  q = vord.lead_id ? q.eq('patient_id', vord.lead_id) : q.eq('patient_name', vord.patient_name);
  const { data: allVords } = await q;
  if (!allVords?.length) return [];

  // Eine Abfrage für alle Sperren — hpnr_codes wird von den Regeln
  // ausgewertet, nicht per `.contains()` gefiltert, sonst braeuchte jede
  // Regel ihre eigene Rundreise.
  const { data: behs } = await ctx.supabase
    .from('podologie_behandlungen').select('verordnung_id, behandlungsdatum, hpnr_codes')
    .eq('owner_id', ctx.getOwnerId())
    .in('verordnung_id', allVords.map(v => v.id))
    .order('behandlungsdatum', { ascending: true });

  const nagelJeVord = new Map(allVords.map(v => [v.id, v.nagel || null]));
  return (behs || []).map(b => ({ ...b, nagel: nagelJeVord.get(b.verordnung_id) || null }));
}

async function podEingangsbefundungLage(vord, datum) {
  const behs = await podPatientBehandlungen(vord);
  if (!behs.length) return { erlaubt: true, grund: '', schonAm: null, ersteAm: null };
  return darf78040(behs, datum);
}

/**
 * Welche Positionen wurden fuer diesen Tag schon im TERMIN geplant?
 *
 * Seit Ops-Karte 235 traegt ein Termin mehrere Leistungen (`booking_leistungen`),
 * und jede Leistung traegt ueber `services.gkv_position_nr` ihre HPNR. Wer am
 * Telefon „Behandlung + Eingangsbefundung" gebucht hat, soll die Kaestchen hier
 * nicht ein zweites Mal suchen.
 *
 * ⚠️ Das ist eine VORBELEGUNG, kein zweiter Schreibweg. Geschrieben wird weiter
 * nur ueber `checks` beim Speichern — nur so laufen alle Sperren mit. Der
 * Podologe darf jedes Kaestchen aendern: geplant und tatsaechlich erbracht sind
 * nicht dasselbe.
 *
 * @param {object} vord   Zeile im podologischen Wortschatz (verordnung-topf.js)
 * @param {string} datum  `YYYY-MM-DD`
 * @returns {Promise<Set<string>>} HPNR der geplanten Leistungen
 */
async function podGeplanteHpnr(vord, datum) {
  if (!vord?.id || !datum) return new Set();
  const { data } = await ctx.supabase
    .from('bookings')
    .select('start_time, booking_leistungen(services(gkv_position_nr))')
    .eq('owner_id', ctx.getOwnerId())
    .eq('verordnung_id', vord.id)
    .neq('status', 'cancelled');
  const treffer = new Set();
  for (const b of data || []) {
    // Tagesvergleich in Berlin, nicht per toISOString() — sonst faellt ein
    // Termin um Mitternacht auf den Vortag (derselbe Grund wie bei todayStr).
    if (!b.start_time || alsISODatum(new Date(b.start_time)) !== datum) continue;
    for (const zeile of b.booking_leistungen || []) {
      const code = String(zeile?.services?.gkv_position_nr || '').trim();
      if (code) treffer.add(code);
    }
  }
  return treffer;
}

/**
 * Darf am `datum` noch die Erstbefundung gross (78100) gesetzt werden?
 * Regel und Fundstelle in `eingangsbefundung-regel.js` → `darf78100`.
 *
 * @param {object} vord   Zeile im podologischen Wortschatz (verordnung-topf.js)
 * @param {string} datum  geplanter Behandlungstag, `YYYY-MM-DD`
 * @returns {Promise<{erlaubt:boolean, grund:string, schonAm:?string}>}
 */
async function podErstbefundungGrossLage(vord, datum) {
  const behs = await podPatientBehandlungen(vord);
  if (!behs.length) return { erlaubt: true, grund: '', schonAm: null };
  return darf78100(behs, datum);
}

/**
 * Darf am `datum` in DIESER Nagelspangen-Serie noch eine Erstbefundung
 * (78110 oder 78100) abgerechnet werden?
 *
 * Die zweite, von `podErstbefundungGrossLage` unabhaengige Grenze: § 3b lit. a
 * erlaubt die Erstbefundung einmalig zu Beginn einer Serie, und die Serie
 * gehoert zu EINEM Nagel — ueber Verordnungsgrenzen hinweg. Deshalb wird nicht
 * nach `verordnung_id` gefiltert, sondern nach dem Nagel: alle Behandlungen
 * des Patienten, deren Verordnung denselben Nagel traegt.
 *
 * Regel und Fundstelle in `eingangsbefundung-regel.js` → `darfErstbefundungNagel`.
 *
 * @param {object} vord   Zeile im podologischen Wortschatz (verordnung-topf.js)
 * @param {string} datum  geplanter Behandlungstag, `YYYY-MM-DD`
 * @returns {Promise<{erlaubt:boolean, grund:string, schonAm:?string, schonCode:?string, serieSeit:?string}>}
 */
async function podErstbefundungSerieLage(vord, datum) {
  const nagel = vord?.nagel || '';
  if (!nagel) return darfErstbefundungNagel([], '', datum);
  const behs = await podPatientBehandlungen(vord);
  return darfErstbefundungNagel(behs.filter(b => b.nagel === nagel), nagel, datum);
}

/**
 * Verordnetes Heilmittel einer Verordnung als Buchstabe a|b|c, sonst ''.
 * Neue Verordnungen führen ihn in `leitsymptomatik`; ältere nur in den
 * einzelnen `heilmittel_items` — und ganz alte gar nicht, dann bleibt es leer
 * und es wird nicht geprüft (lieber keine Regel als eine falsche).
 *
 * Altbestand steht als "DF-a" in der Spalte (die Diagnosegruppe war mit
 * eingetragen); der Buchstabe dahinter ist dieselbe Leitsymptomatik.
 * Das gilt für JEDE Diagnosegruppe mit a/b/c-Katalog, nicht nur DF — ein
 * Altbestand "NF-c" muss genauso gelesen werden, sonst fällt bei ihm die
 * 78020-Sperre still aus (Retaxationsrisiko, ~15 € je Sitzung).
 */
function podVordMassnahme(vord) {
  const roh = String(vord?.leitsymptomatik || '').trim().toLowerCase();
  const _dgPrefix = POD_HEILMITTEL_DGS.map(d => d.toLowerCase()).join('|');
  const direkt = (roh.match(new RegExp(`^(?:(?:${_dgPrefix})-)?([abc])$`)) || [])[1] || '';
  if (POD_HEILMITTEL_KATALOG[direkt]) return direkt;
  const items = Array.isArray(vord?.heilmittel_items) ? vord.heilmittel_items : [];
  const ausItem = items.map(i => i?.massnahme).find(m => POD_HEILMITTEL_KATALOG[m]);
  return ausItem || '';
}

let _podState = { selectedVordId: null, verordnungen: [] };

// Nur 'kassen' ist eine GKV-Verordnung. Für alles andere gibt es weder eine
// Diagnosegruppe nach HeilM-RL noch einen Kostenträger — die Abrechnungsfelder
// klappen weg und dürfen nie in eine §302-Datei geraten (Konsey 2026-08-10).
const POD_GKV_REZEPTART = 'kassen';
const POD_ANLASS_DEFAULT = 'Podologische Komplexbehandlung';

// Klicks der Verordnungsliste — EINMAL an `document`. Vorher hing der Zuhörer am
// Ende von loadPodologieBilling(), nach Kassenliste/Heilmittel/Katalogen: warf
// etwas dazwischen, waren die Knöpfe sichtbar aber tot ("Status lässt sich nicht
// klicken"). Am document ist er unabhängig davon, wie weit das Rendern kommt.
document.addEventListener('click', (e) => {
  if (!e.target.closest?.('#podVordList')) return;
  const stBtn = e.target.closest('.pod-vord-status');
  if (stBtn) {
    e.stopPropagation();
    oeffneStatusDialogFuer(stBtn.dataset.statusId, { supabase: ctx.supabase, onFertig: loadPodologieBilling })
      .catch(err => { console.error('[pod-status]', err); ctx.showToast(err.message || 'Status konnte nicht geöffnet werden', 'error'); });
    return;
  }
  const reBtn = e.target.closest('.pod-vord-rechnung');
  if (reBtn) {
    e.stopPropagation();
    ctx.rechnungAusVerordnung(reBtn.dataset.rechnungVordId)
      .catch(err => { console.error('[pod-rechnung]', err); ctx.showToast(err.message || 'Rechnung konnte nicht vorbereitet werden', 'error'); });
    return;
  }
  const row = e.target.closest('[data-vord-id]');
  if (!row) return;
  _podState.selectedVordId = row.dataset.vordId === _podState.selectedVordId ? null : row.dataset.vordId;
  loadPodologieBilling();
});

/** Zeile ohne Standortzuordnung — sie steht bewusst in jeder Filiale. */
function podPraxisweitMarke(v) {
  return istPraxisweit(v)
    ? `<span title="Ohne Standortzuordnung — in jeder Filiale sichtbar" style="font-size:11px;background:var(--bg-card-solid,#1f2937);border:1px solid var(--border);padding:2px 7px;border-radius:12px;color:var(--text-muted);">Praxisweit</span>`
    : '';
}

async function loadPodologieBilling() {
  const el = document.getElementById('podBillingContent');
  if (!el) return;
  el.innerHTML = '<span style="color:var(--text-muted);font-size:13px;">Lade…</span>';

  // ICD-Prüfregeln der Diagnosegruppen — die Behandlung prüft damit, ob der
  // ICD-Kode der Verordnung zur gebuchten Leistung passt (_icdMatchesDgRule)
  await loadDgIcdRules(ctx.supabase);

  const ownerId = ctx.getOwnerId();
  // Seit 04.09.2026 EIN Topf: die Arbeitsliste liest `prescriptions`. Damit
  // erscheinen hier endlich auch die podologischen Rezepte, die ueber die
  // Muster-13-Maske oder den KI-Scan hereinkamen — live waren das neun Stueck,
  // die bis dahin nie abgerechnet werden konnten, weil die §-302-Kette sie
  // schlicht nicht sah.
  //
  // Der Statusfilter steht in `verordnung-topf.js` (`aktiv` ist dort NULL, und
  // `.in()` trifft NULL nicht — deshalb die `or`-Form).
  //
  // ⚠️ SPIEGEL von `VERORDNUNG_EINREICHBAR` in
  // `api-backend/billing/utils/einreichbar.js`. Dieselbe Liste, zwei Deploys
  // (Vercel hier, Docker dort) — ein gemeinsamer Import ginge nur ueber einen
  // Build-Schritt, den es nicht gibt. Wer eine der beiden aendert, aendert
  // BEIDE: sonst zeigt die Arbeitsliste eine Verordnung an, die das Backend
  // beim Abrechnen mit 409 zurueckweist. (fonksiyon-ustasi, 28.08.2026)
  // ⚠️ `therapie_bereich = 'podo'` ist Pflicht, nicht Kosmetik: ohne diesen
  // Filter zeigt diese Arbeitsliste JEDE abrechnungsbereite Verordnung des
  // Mandanten — bei einer interdisziplinären Praxis (Podologie + Physio unter
  // demselben owner_id) auch die physiotherapeutischen. Live bestaetigt: eine
  // Zeile ohne therapie_bereich trug „Krankengymnastik am Gerät" unter einem
  // Podologie-Mandanten — eindeutig kein Podologie-Fall, gehoert nicht hierher.
  const { data: rohZeilen, error } = await ctx.supabase
    .from(TOPF)
    .select(PODO_SELECT)
    .eq('owner_id', ownerId)
    .eq('therapie_bereich', 'podo')
    .or(PODO_ARBEITSLISTE_OR)
    .order('created_at', { ascending: false });

  if (error) { el.innerHTML = `<p style="color:var(--danger)">Fehler: ${ctx.escapeHtml(error.message)}</p>`; return; }

  // Ab hier spricht diese Datei weiter podologisch (`lead_id`,
  // `behandlungseinheiten`, `status='aktiv'`) — uebersetzt wird nur hier.
  const vords = (rohZeilen || []).map(ausTopf);
  // Standort-Zuschnitt: Regel und Begruendung stehen in standort-zuschnitt.js,
  // dort liegt sie neben ihrem Test. Kurz: die podologische Verordnung ist
  // praxisweit, nicht standortgebunden — deshalb kein `bizScope` hier; gefiltert
  // wird nur auf ausdruecklichen Wunsch des Inhabers, und Zeilen ohne
  // Standortzuordnung verschwinden nie.
  const zuschnitt = standortZuschnitt(vords || [], ctx.aktiverStandort?.());
  _podState.verordnungen = zuschnitt.zeilen;
  const zeigeHerkunft = zuschnitt.zeigeHerkunft;

  const today = new Date(); today.setHours(0,0,0,0);

  function vordAlerts(v) {
    const alerts = [];
    if (!v.behandlungsstart) {
      let deadline = null;
      if (v.beginn_spaetestens) {
        deadline = new Date(v.beginn_spaetestens);
      } else if (v.ausstellungsdatum) {
        const issued = new Date(v.ausstellungsdatum);
        const frist = v.dringend ? 14 : 28;
        deadline = new Date(issued); deadline.setDate(deadline.getDate() + frist);
      }
      if (deadline && today > deadline) {
        const frist = v.dringend ? 14 : 28;
        alerts.push({ type: 'danger', msg: `Behandlungsfrist abgelaufen (${frist}-Tage-Regel)` });
      }
    }
    // Absetzungsgrund = Arbeitsanweisung für die Korrektur, gehört an die Zeile.
    if (v.absetzung_grund) alerts.push({ type: 'danger', msg: `Kasse: ${v.absetzung_grund.split('\n')[0]}` });
    return alerts;
  }

  const vordListHtml = _podState.verordnungen.length === 0
    ? `<p style="color:var(--text-muted);padding:12px 0;">${ctx.t('pod_no_vord')}</p>`
    : _podState.verordnungen.map(v => {
        const alerts = vordAlerts(v);
        const alertHtml = alerts.map(a =>
          `<div style="color:${a.type==='danger'?'#ef4444':'#f59e0b'};font-size:12px;margin-top:4px;">⚠ ${ctx.escapeHtml(a.msg)}</div>`
        ).join('');
        const isSelected = _podState.selectedVordId === v.id;
        const _hmLetter = podVordMassnahme(v);
        const _isGkv    = (v.rezeptart || 'kassen') === POD_GKV_REZEPTART;
        const _hmRozet  = (_isGkv && _hmLetter && POD_HEILMITTEL_KATALOG[_hmLetter])
          ? `<span style="font-size:12px;background:var(--bg-card-solid,#1f2937);padding:2px 8px;border-radius:12px;color:var(--text-main);border:1px solid var(--border);">` +
            ctx.escapeHtml((v.diagnosegruppe ? `${v.diagnosegruppe}-` : '') + `${_hmLetter} · ${POD_HEILMITTEL_KATALOG[_hmLetter].heilmittel}`) +
            `</span>`
          : '';
        return `<div class="pod-vord-row${isSelected?' pod-vord-selected':''}" data-vord-id="${v.id}" style="
          padding:12px 14px;border:1px solid ${isSelected?'var(--primary)':'var(--border-subtle,var(--border))'};
          border-radius:8px;cursor:pointer;background:${isSelected?'var(--bg-card)':'transparent'};
          margin-bottom:8px;transition:border-color .15s;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
            <div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;">
              <span style="font-weight:600;color:var(--text-main);">${ctx.escapeHtml(patientAnzeigename(v) || '—')}</span>${belegnummerRosette(v, { patientennummer: v.leads?.patientennummer, escapeHtml: ctx.escapeHtml, titel: 'Patientennummer-Verordnungsnummer — dieselbe Nummer steht auf Rechnung und Abrechnungsdatei' })}
              <span style="font-size:12px;background:var(--bg-card-solid,#1f2937);padding:2px 8px;border-radius:12px;color:var(--text-main);">${ctx.escapeHtml(
                _isGkv
                  ? (v.diagnosegruppe || '—')
                  : (v.behandlungsanlass || POD_ANLASS_DEFAULT)
              )}</span>
              ${_hmRozet}
              ${zeigeHerkunft ? podPraxisweitMarke(v) : ''}
              ${!_isGkv ? `<span style="font-size:11px;background:var(--bg-card-solid,#1f2937);border:1px solid var(--border);padding:2px 7px;border-radius:12px;color:var(--text-muted);">${ctx.escapeHtml(v.rezeptart)}</span>` : ''}
              ${v.status && v.status !== 'aktiv' ? abrStatusBadge(v.status) : ''}
              ${v.absetzung_betrag ? `<span style="font-size:11px;color:#c2410c;font-weight:600;">−${Number(v.absetzung_betrag).toFixed(2).replace('.', ',')} €</span>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
              <span style="font-size:12px;color:var(--text-muted);">${v.ausstellungsdatum ? new Date(v.ausstellungsdatum).toLocaleDateString('de-DE') : '—'}</span>
              <button class="pod-vord-status" data-status-id="${v.id}" title="Abrechnungsstatus ändern" style="padding:2px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:12px;cursor:pointer;white-space:nowrap;">Status</button>
              ${rechnungButtonHtml(v, { label: ctx.t('pod_rechnung') })}
            </div>
          </div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:3px;">
            ${v.behandlungseinheiten ? `${v.behandlungseinheiten} Einheiten` : ''}
            ${v.therapiefrequenz ? ' · ' + ctx.escapeHtml(v.therapiefrequenz) : ''}
            ${v.dringend ? ' · <strong style="color:#ef4444;">Dringend</strong>' : ''}
            ${v.hausbesuch ? ' · Hausbesuch' : ''}
          </div>
          ${alertHtml}
        </div>`;
      }).join('');

  const selectedVord = _podState.verordnungen.find(v => v.id === _podState.selectedVordId);
  const diagRoot = selectedVord ? podDiagRoot(selectedVord.diagnosegruppe) : '';
  const isUI = diagRoot === 'UI1' || diagRoot === 'UI2';
  // `toISOString()` rechnet nach UTC — in Berlin (UTC+1/+2) ergab das um
  // Mitternacht den VORTAG, also ein falsches Vorbelegungsdatum im Formular
  // und eine falsche Gültigkeitsprüfung der HPNR-Liste. `alsISODatum()`
  // liest die lokalen Feldwerte (Projektstandard, s. CLAUDE.md).
  const todayStr = alsISODatum(today);
  // Gültige Positionen zum Behandlungsdatum — abgelöste (z. B. Ross-Fraser)
  // filtert die RPC bereits heraus.
  const hpnrRows = diagRoot ? await podLoadHpnr(diagRoot, todayStr) : [];
  _podCurrentHpnr = hpnrRows;

  // Welche Befundung gehört auf DIESEN Tag? Genau eine von beiden:
  //   • 78040 Eingangsbefundung — nur am allerersten Behandlungstag des
  //     Patienten, und dann OHNE 78030 (die beiden schliessen sich am selben
  //     Tag aus, Anlage 1a i.d.F. 17.06.2024 Teil 2 Ziff. 4.1).
  //   • 78030 Befundung — an jedem anderen Behandlungstag, „im Vorfeld jeder
  //     Behandlung" (ebd. Teil 2 Ziff. 4.2), nicht je Serie.
  // Bei UI1/UI2 gibt es beide nicht; dort läuft die Erstbefundung 78100/78110.
  // Vorher war 78030 pauschal angekreuzt und 78040 nie — der Podologe musste
  // beim ersten Termin von Hand umstellen, und wer das vergass, verlor die
  // Eingangsbefundung; wer sie zu spät nachtrug, bekam eine Absetzung.
  const eingangsLage = (selectedVord && !isUI)
    ? await podEingangsbefundungLage(selectedVord, todayStr)
    : { erlaubt: false };

  // Was am Telefon fuer heute gebucht wurde (Ops 235) — nur Vorbelegung.
  const geplanteHpnr = selectedVord ? await podGeplanteHpnr(selectedVord, todayStr) : new Set();

  const behandlungFormHtml = selectedVord ? `
    <div class="card" style="margin-top:0;background:var(--bg-card);border:1px solid var(--border-subtle,var(--border));border-radius:10px;padding:18px;">
      <h4 style="margin:0 0 14px;color:var(--text-main);font-size:15px;">${ctx.t('pod_tagesbehandlung')} — ${ctx.escapeHtml(patientAnzeigename(selectedVord) || '—')}</h4>
      <div style="display:grid;gap:12px;">
        <div>
          <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">${ctx.t('pod_behandlungsdatum')}</label>
          <input type="date" id="podBehDatum" value="${todayStr}" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;">
        </div>
        <div>
          <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:6px;">${ctx.t('pod_hpnr')}</label>
          <div id="podHpnrChecks" style="display:flex;flex-wrap:wrap;gap:8px;">
            ${hpnrRows.map(r => {
              const code = r.code;
              const isHausbesuch = selectedVord?.hausbesuch === true;
              const autoChecked =
                (!isUI && code === POD_EINGANGSBEFUNDUNG && eingangsLage.erlaubt) ? 'checked' :
                (!isUI && code === POD_BEFUNDPAUSCHALE && !eingangsLage.erlaubt) ? 'checked' :
                (isHausbesuch && code === '79933') ? 'checked' : '';
              // Die im Termin geplanten Positionen ankreuzen — aber NICHT die
              // beiden Befundungen: welche davon auf diesen Tag gehoert,
              // entscheidet oben die Vertragsregel, nicht der Terminplan.
              const geplant = (!autoChecked
                && code !== POD_EINGANGSBEFUNDUNG && code !== POD_BEFUNDPAUSCHALE
                && geplanteHpnr.has(code)) ? 'checked' : '';
              return `<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;background:var(--bg-card-solid,#1f2937);padding:5px 10px;border-radius:6px;border:1px solid var(--border);">
                <input type="checkbox" class="pod-hpnr-cb" value="${ctx.escapeHtml(code)}" ${autoChecked || geplant}> ${ctx.escapeHtml(code)} – ${ctx.escapeHtml(r.label)}
              </label>`;
            }).join('')}
          </div>
        </div>
        <!-- Lokalisation: seit dem 04.09.2026 steht der Nagel an der
             VERORDNUNG (§ 3b Satz 3-5) und wird hier nur noch angezeigt. Die
             Spalte podologie_behandlungen.lokalisation wird weiter
             mitgeschrieben, weil Verordnungsdetail und Rechnungsbruecke sie
             lesen. Das Freitextfeld bleibt nur fuer Verordnungen aus der Zeit
             davor, die noch keinen Nagel tragen — sonst laesst sich so eine
             Behandlung gar nicht mehr speichern. -->
        <div id="podLokalisationWrap" style="display:${isUI?'block':'none'};">
          <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">${ctx.t('pod_lokalisation')} ${selectedVord?.nagel ? '' : '<span style="color:#ef4444;">*</span>'}</label>
          ${selectedVord?.nagel
            ? `<div style="padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;">${ctx.escapeHtml(nagelLabel(selectedVord.nagel))}<span style="color:var(--text-muted);font-size:12px;"> — aus der Verordnung</span></div>`
            : `<input type="text" id="podLokalisation" placeholder="z. B. Zehe II rechts" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;">`}
        </div>
        <div>
          <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">${ctx.t('pod_notizen')}</label>
          <textarea id="podBehNotizen" rows="2" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;resize:vertical;"></textarea>
        </div>
        <div id="podBehError" style="color:#ef4444;font-size:13px;display:none;"></div>
        <button id="podSaveBehBtn" class="btn-primary" style="width:fit-content;">${ctx.t('pod_save_behandlung')}</button>
      </div>
    </div>` : `<div style="color:var(--text-muted);font-size:13px;padding:12px 0;">← Wählen Sie eine Verordnung aus der Liste.</div>`;

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start;">

      <!-- Links: Neue Verordnung + Liste -->
      <div>
        <!-- Das Formular „Neue Verordnung" stand bis zum 06.09.2026 hier.
             Es war der DRITTE Weg, eine Verordnung anzulegen — neben der
             Muster-13-Maske und dem OCR-Pfad — und der einzige, der
             nagel, wagner_grad und behandlungsanlass kannte. Drei Wege
             heissen drei Datenformen in EINER Tabelle; genau das sollte
             aufhoeren (Kemal, 06.09.2026: „tek bir modül, her tarafta
             kullanilan, sabit ayni").
             Angelegt und bearbeitet wird jetzt ausschliesslich in der
             Muster-13-Maske (#rzMaskeWrap, module/verordnung-maske.js);
             die drei podologischen Felder stehen dort in
             module/verordnung-podo.js. Diese Seite dokumentiert die
             Behandlung; abgerechnet wird seit 09.09.2026 im §302-Bildschirm
             (module/abrechnung-auswahl.js). -->

        <div class="card" style="background:var(--bg-card);border:1px solid var(--border-subtle,var(--border));border-radius:10px;padding:18px;">
          <h4 style="margin:0 0 12px;color:var(--text-main);font-size:15px;">${ctx.t('pod_active_vord')}</h4>
          <div id="podVordList">${vordListHtml}</div>
        </div>
      </div>

      <!-- Rechts: Tagesbehandlung -->
      <div id="podBehPanel">
        ${behandlungFormHtml}
      </div>

    </div>`;

  // ---- Event Listeners ----

  // Die Verdrahtung des Verordnungsformulars stand bis zum 06.09.2026 hier
  // (Rezeptart-Umschaltung, Heilmittelzeilen, ICD/Diagnosegruppen-Paar,
  // Arzt-Picker, L60.0-Rueckfrage). Sie ist mit dem Formular selbst
  // entfallen — angelegt wird jetzt nur noch in der Muster-13-Maske.
  // Diese Seite behaelt die BEHANDLUNG: sie bucht Leistungen auf eine
  // bestehende Verordnung und rechnet ab.

  document.getElementById('podSaveBehBtn')?.addEventListener('click', async () => {
    const datum   = document.getElementById('podBehDatum').value;
    const checks  = [...document.querySelectorAll('.pod-hpnr-cb:checked')].map(cb => cb.value);
    // Der Nagel der Verordnung hat Vorrang vor dem Freitextfeld; das Feld
    // existiert nur noch bei Verordnungen ohne Nagel (Altbestand).
    const lokalFrei = (document.getElementById('podLokalisation')?.value || '').trim();
    const notiz   = document.getElementById('podBehNotizen').value.trim();
    const errEl   = document.getElementById('podBehError');

    // ICD-Regeln sicherstellen, BEVOR geprüft wird: _icdMatchesDgRule()
    // ist bei fehlenden Regeln absichtlich nachsichtig (nur Hinweis-Text), für
    // die harte UI1/UI2-Abrechnungsregel darf es das aber nicht sein.
    await loadDgIcdRules(ctx.supabase);

    const vord = _podState.verordnungen.find(v => v.id === _podState.selectedVordId);
    const dRoot = vord ? podDiagRoot(vord.diagnosegruppe) : '';
    const isUIx = dRoot === 'UI1' || dRoot === 'UI2';
    const icd10 = vord?.icd10 || [];
    const uiRule = (_dgIcdRules || {})[dRoot];
    // Der Nagel aus der Verordnung ist die Lokalisation. Nur wo er fehlt
    // (Verordnung von vor dem 04.09.2026), zaehlt noch der Freitext.
    const lokal = vord?.nagel || lokalFrei;

    // Validasyon
    let err = '';
    if (checks.length === 0) err = ctx.t('pod_kein_hpnr');
    else if (isUIx && checks.includes('78030')) err = 'Befundung (78030) kann bei UI1/UI2 nicht verwendet werden.';
    // Regeln nicht geladen → auf die feste Literal-Regel zurückfallen, nicht durchwinken.
    else if (isUIx && !(uiRule
              ? icd10.some(c => matchIcdToDg(parseIcdList(c), uiRule).status === 'ok')
              : icd10.some(c => String(c).trim().toUpperCase().startsWith('L60.0'))))
      err = 'UI1/UI2 erfordert ICD-10 L60.0.';
    else if (checks.includes('78040') && checks.includes('78030')) err = 'Eingangsbefundung (78040) und Befundung (78030) können nicht am gleichen Tag kombiniert werden.';
    else if ((checks.includes('78610') || checks.includes('78620')) && dRoot !== 'UI2') err = 'Nagelspange (78610/78620) ist nur bei UI2 zulässig.';
    // 78020 „Behandlung groß" gilt nur für die Komplexbehandlung. Bei einzeln
    // verordneter Hornhautabtragung oder Nagelbearbeitung ist immer 78010 zzgl.
    // 78030 abzurechnen — auch über 20 Minuten (FAK Podologie Q25). Sonst wird
    // die Differenz später zurückgefordert.
    else if (checks.includes('78020') && ['a', 'b'].includes(podVordMassnahme(vord)))
      err = `78020 ist nur bei verordneter Komplexbehandlung abrechenbar. Verordnet ist `
          + `„${POD_HEILMITTEL_KATALOG[podVordMassnahme(vord)].heilmittel}" — bitte 78010 zzgl. 78030 verwenden.`;
    else if (isUIx && !lokal) err = ctx.t('pod_lokalisation') + ' ist bei UI1/UI2 erforderlich.';

    if (err) { errEl.textContent = err; errEl.style.display = 'block'; return; }
    errEl.style.display = 'none';

    // 78040 gehört einmalig VOR die erste podologische Leistung des Patienten —
    // begründet in podEingangsbefundungLage(). Zwei getrennte Sperren, damit die
    // Meldung sagt, was der Fall ist: schon abgerechnet vs. zu spät in der Serie.
    if (checks.includes(POD_EINGANGSBEFUNDUNG)) {
      const lage = await podEingangsbefundungLage(vord, datum);
      if (!lage.erlaubt) {
        const name = patientAnzeigename(vord) || 'diesen Patienten';
        errEl.textContent = lage.grund === 'schon_abgerechnet'
          ? `Eingangsbefundung (78040) wurde für ${name} bereits am `
            + `${new Date(lage.schonAm).toLocaleDateString('de-DE')} abgerechnet — sie ist einmalig `
            + `und wird auch bei einer neuen Verordnung nicht erneut abgerechnet.`
          : `Eingangsbefundung (78040) gehört vor die erste podologische Leistung. `
            + `${name} wurde in dieser Praxis bereits am `
            + `${new Date(lage.ersteAm).toLocaleDateString('de-DE')} behandelt — sie kann jetzt `
            + `nicht mehr nachgeholt werden (Anlage 1a i.d.F. 17.06.2024, Teil 1 Nr. 2).`;
        errEl.style.display = 'block';
        return;
      }
    }

    // Erstbefundung gross (78100) ist auf eine Abgabe je Patient und
    // Kalenderjahr beschraenkt (Anlage 1c i.d.F. 01.07.2025, Teil 1 Nr. 5 I.1).
    // Bis zum 03.09.2026 stand das nur als Hinweistext im Katalog — ankreuzen
    // liess es sich beliebig oft, abgesetzt wurde es hinterher.
    if (checks.includes(POD_ERSTBEFUNDUNG_GROSS)) {
      const lage = await podErstbefundungGrossLage(vord, datum);
      if (!lage.erlaubt) {
        const name = patientAnzeigename(vord) || 'diesen Patienten';
        errEl.textContent = `Erstbefundung gross (78100) wurde für ${name} am `
          + `${new Date(lage.schonAm).toLocaleDateString('de-DE')} bereits abgerechnet — sie ist `
          + `auf eine Abgabe je Patient im Kalenderjahr beschränkt `
          + `(Anlage 1c i.d.F. 01.07.2025, Teil 1 Nr. 5 I.1). Für eine weitere `
          + `Befundung in diesem Jahr ist 78110 „klein" vorgesehen.`;
        errEl.style.display = 'block';
        return;
      }
    }

    // Zweite, unabhaengige Grenze: die Erstbefundung — gross ODER klein —
    // gehoert einmalig an den Anfang einer Nagelspangen-Serie, und die Serie
    // haengt am Nagel, nicht an der Verordnung (§ 3b lit. a). Eine Folge-
    // verordnung fuer denselben Nagel setzt sie also NICHT zurueck; erst der
    // Behandlungsabschluss 78520 beginnt eine neue Serie.
    if (checks.some(c => POD_ERSTBEFUNDUNGEN.includes(c))) {
      const lage = await podErstbefundungSerieLage(vord, datum);
      if (!lage.erlaubt) {
        errEl.textContent = `Für ${nagelLabel(vord?.nagel)} wurde am `
          + `${new Date(lage.schonAm).toLocaleDateString('de-DE')} bereits eine `
          + `Erstbefundung (${lage.schonCode}) abgerechnet. Sie ist einmalig zu Beginn `
          + `einer Nagelspangen-Behandlungsserie abrechenbar und gilt über mehrere `
          + `Verordnungen hinweg (§ 3b lit. a, Änderungsvereinbarung vom 16.06.2025). `
          + `Erst nach dem Behandlungsabschluss (78520) beginnt an diesem Nagel eine `
          + `neue Serie.`;
        errEl.style.display = 'block';
        return;
      }
    }

    // beginn_spaetestens check: warn if first treatment is after deadline
    if (vord && !vord.behandlungsstart && datum) {
      let deadline = null;
      if (vord.beginn_spaetestens) {
        deadline = vord.beginn_spaetestens;
      } else if (vord.ausstellungsdatum) {
        const issued = new Date(vord.ausstellungsdatum);
        const frist = vord.dringend ? 14 : 28;
        issued.setDate(issued.getDate() + frist);
        deadline = issued.toISOString().split('T')[0];
      }
      if (deadline && datum > deadline) {
        const datumFormatted = new Date(datum).toLocaleDateString('de-DE');
        const deadlineFormatted = new Date(deadline).toLocaleDateString('de-DE');
        const proceed = await ctx.showConfirmModal({
          title: '⚠️ Datum nach Beginn spätestens',
          message: `Das gewählte Datum (${datumFormatted}) liegt nach dem Beginn spätestens (${deadlineFormatted}). Trotzdem fortfahren?`,
          confirmText: 'Trotzdem fortfahren',
          cancelText: 'Abbrechen'
        });
        if (!proceed) return;
      }
    }

    const { error } = await ctx.supabase.from('podologie_behandlungen').insert({
      owner_id: ctx.getOwnerId(),
      verordnung_id: _podState.selectedVordId,
      behandlungsdatum: datum,
      hpnr_codes: checks,
      diagnosegruppe: dRoot,
      lokalisation: lokal || null,
      notizen: notiz || null,
    });
    if (error) { errEl.textContent = error.message; errEl.style.display = 'block'; return; }

    // Status machine: wenn alle Einheiten verbraucht → abrechenbar
    if (vord?.behandlungseinheiten) {
      const { count } = await ctx.supabase
        .from('podologie_behandlungen')
        .select('*', { count: 'exact', head: true })
        .eq('verordnung_id', _podState.selectedVordId);
      if (count != null && count >= vord.behandlungseinheiten) {
        await ctx.supabase.from(TOPF)
          .update({ abrechnung_status: statusInTopf('abrechenbar') })
          // Nur aus 'aktiv' (= abrechnung_status IS NULL) heraus: sonst holt
          // eine nachgetragene Behandlung eine bereits eingereichte oder
          // stornierte Verordnung zurück in die Abrechnung.
          .eq('id', _podState.selectedVordId).is('abrechnung_status', null);
        ctx.showToast('Alle Einheiten aufgebraucht — Verordnung bereit zur Abrechnung ✓', 'info');
      } else {
        ctx.showToast('Behandlung gespeichert ✓');
      }
    } else {
      ctx.showToast('Behandlung gespeichert ✓');
    }

    loadPodologieBilling();
  });
}

// ── Öffentliche Schnittstelle ──────────────────────────────────────────────

/** Einstieg aus dem Router (`switchPanel('podologie-billing')`). */
export async function mountPodologieAbrechnung(deps) {
  ctx = deps;
  return loadPodologieBilling();
}

/**
 * Verordnung vorwählen, bevor das Panel öffnet — Sprung aus der Patientenakte.
 * Ersetzt den früheren Direktzugriff `_podState.selectedVordId = id` in dashboard.js.
 */
export function setPodVorwahl(id) {
  _podState.selectedVordId = id;
}

/**
 * Eine geladene Verordnung nach Kennung. Nur für `rechnungAusVerordnung()` in
 * dashboard.js, das nicht mit umziehen konnte und trotzdem an `_podState` muss.
 */
export function getPodVerordnung(id) {
  return _podState.verordnungen.find(v => v.id === id);
}
