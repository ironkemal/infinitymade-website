/**
 * podologie-abrechnung.js — Verordnungen und Tagesbehandlungen der Podologie.
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

import { parseIcdList, matchIcdToDg, soleIcdForDg } from '../icd-dg-match.js?v=20260810e';
import { searchHeilmittel, heilmittelOptionsHtml } from '../katalog-suche.js?v=20260817';
import { attachPatientSearch } from '../patient-suche.js?v=20260817';
import { statusBadge as abrStatusBadge, oeffneStatusDialogFuer } from './abrechnungsstatus.js?v=20260905a';
import { rechnungButtonHtml } from './rechnung-bruecke.js?v=20260816';
import { belegnummerRosette } from './belegnummer.js?v=20260817';
import { wireArztFeld } from './arzt-register.js?v=20260816';
import { loadDgIcdRules, podDiagOptionsHtml } from './diagnosegruppen-regeln.js?v=20260827';
import { standortZuschnitt, istPraxisweit } from './standort-zuschnitt.js?v=20260828';
import { alsISODatum } from './datum.js?v=20260901';
import { podoPositionsFinder } from './podologie-positionen.js?v=20260902';
import { zuzahlungFuerPodoVerordnung } from './zuzahlung-rechnen.js?v=20260902';
// 78030/78040: Regel und Begruendung liegen in eingangsbefundung-regel.js,
// dort neben ihrem Test — diese Datei laesst sich in node nicht importieren.
import { darf78040, darf78100, darfErstbefundungNagel,
         POD_EINGANGSBEFUNDUNG, POD_BEFUNDPAUSCHALE,
         POD_ERSTBEFUNDUNG_GROSS, POD_ERSTBEFUNDUNGEN,
         NAGEL_WERTE, nagelLabel }
  from './eingangsbefundung-regel.js?v=20260904';
// Seit 04.09.2026 gibt es EINEN Verordnungstopf (`prescriptions`). Diese Datei
// behaelt ihren podologischen Wortschatz; uebersetzt wird an der Grenze.
import { TOPF, PODO_SELECT, PODO_ARBEITSLISTE_OR, ausTopf, inTopf, statusInTopf }
  from './verordnung-topf.js?v=20260904';

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
// Siehe Handbücher/SPEC-RULES.md und Podoloji/podologie-hpnr-reference.js.
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
 * Beleg da ist (Handbücher/SPEC-RULES.md, Doğrulama kuyruğu).
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

let _podState = { selectedVordId: null, editVordId: null, verordnungen: [] };
let _podKkCache = [];

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
  // Edit-Schaltfläche: Zeile NICHT als Behandlungsauswahl markieren
  const editBtn = e.target.closest('.pod-vord-edit');
  if (editBtn) {
    e.stopPropagation();
    _podState.editVordId = editBtn.dataset.editId;
    loadPodologieBilling();
    return;
  }
  const row = e.target.closest('[data-vord-id]');
  if (!row) return;
  _podState.selectedVordId = row.dataset.vordId === _podState.selectedVordId ? null : row.dataset.vordId;
  loadPodologieBilling();
});

// §302-Knopf — ebenfalls EINMAL, aus demselben Grund und noch einem zweiten.
//
// Der Zuhoerer hing bis 28.08.2026 am Ende von loadPodologieBilling() an
// `#podBillingContent`. Dieses Element steht aber statisch in dashboard.html:1637;
// loadPodologieBilling() tauscht nur sein innerHTML aus, nie das Element selbst.
// Jedes Neuzeichnen (Zeile waehlen, Bearbeiten oeffnen, speichern — alle rufen
// loadPodologieBilling()) hat also einen weiteren Zuhoerer angehaengt. Nach dem
// N-ten Zeichnen loeste ein Klick auf „§302 erstellen" N Anfragen aus.
//
// Das war nicht nur Netzlast: create-podologie erzeugt pro Aufruf eine eigene
// `abrechnung`-Zeile samt DTA-Datei. Mehrfache Abrechnungsfaelle fuer dieselbe
// Verordnung waeren die Folge gewesen. Die zweite Haelfte der Absicherung sitzt
// im Backend (abrechnung.routes.js: bereits abgerechnete Verordnungen → 409).
document.addEventListener('click', async (e) => {
  if (!e.target.closest?.('#podBillingContent')) return;
  const btn = e.target.closest('.pod-abr-btn');
  if (!btn || btn.disabled) return;
  const kkIk     = btn.dataset.kkIk;
  const vordIds  = JSON.parse(btn.dataset.vordIds || '[]');
  const errEl    = document.getElementById('podAbrError');
  if (!kkIk || !vordIds.length) return;

  btn.disabled = true;
  btn.textContent = 'Wird erstellt…';
  if (errEl) errEl.style.display = 'none';

  try {
    const { data: { session } } = await ctx.supabase.auth.getSession();
    const res = await fetch('https://n8n.infinitymade.de/api/billing/abrechnung/create-podologie', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ kostentraegerIk: kkIk, verordnungIds: vordIds }),
    });
    const json = await res.json();
    if (!res.ok) {
      if (errEl) { errEl.textContent = json.error || 'Fehler beim Erstellen.'; errEl.style.display = 'block'; }
      btn.disabled = false; btn.textContent = '§302 erstellen';
      return;
    }
    ctx.showToast(`§302 DTA erstellt: ${json.rechnungsnummer} · ${json.sessionCount} Positionen ✓`);
    loadPodologieBilling();
  } catch (err) {
    if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; }
    btn.disabled = false; btn.textContent = '§302 erstellen';
  }
});

// Kostenträger-Zeile auf-/zuklappen — reines DOM-Toggle, kein Neuzeichnen:
// die Detailtabelle steht schon im Markup, `hidden` blendet sie nur aus.
document.addEventListener('click', (e) => {
  if (!e.target.closest?.('#podBillingContent')) return;
  const header = e.target.closest('.pod-kk-header');
  if (!header) return;
  const ik = header.dataset.kkToggle;
  const detail = document.querySelector(`.pod-kk-detail[data-kk-detail="${CSS.escape(ik)}"]`);
  if (!detail) return;
  detail.hidden = !detail.hidden;
  const chevron = header.querySelector('.pod-kk-chevron');
  if (chevron) chevron.style.transform = detail.hidden ? '' : 'rotate(90deg)';
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

  // ICD-Prüfregeln der Diagnosegruppen — Voraussetzung für podValidateIcd10()
  await loadDgIcdRules(ctx.supabase);

  // Load kostentraeger for billing KK selection (IK numbers required)
  if (_podKkCache.length === 0) {
    const all = await ctx.loadKkList();
    _podKkCache = all.filter(k => k.ik);
  }

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

  // Preis-/Zuzahlungsdetail für die "§302 Abrechnung bereit"-Liste vorab
  // rechnen — dieselbe Funktion, die schon in verordnung-detail.js läuft und
  // gegen den Backend-Calculator getestet ist (zuzahlung-rechnen.test.js).
  // Vorab statt inline im Render-IIFE, weil die Katalogauflösung asynchron
  // ist (podoPositionsFinder lädt die Tagespreise) und der Render weiter
  // unten synchron ein grosses Template zusammenbaut.
  const _abrechenbarVords = _podState.verordnungen.filter(v =>
    v.status === 'abrechenbar' && v.kostentraeger_ik && (v.rezeptart || 'kassen') === POD_GKV_REZEPTART);
  const _podAbrDetails = new Map();
  if (_abrechenbarVords.length) {
    const { data: allBeh } = await ctx.supabase
      .from('podologie_behandlungen')
      .select('id, verordnung_id, behandlungsdatum, hpnr_codes')
      .in('verordnung_id', _abrechenbarVords.map(v => v.id));
    const behByVordId = {};
    for (const b of (allBeh || [])) {
      (behByVordId[b.verordnung_id] ||= []).push(b);
    }
    const finde = await podoPositionsFinder(ctx.supabase, allBeh || []);
    for (const v of _abrechenbarVords) {
      _podAbrDetails.set(v.id, zuzahlungFuerPodoVerordnung(v, behByVordId[v.id] || [], finde));
    }
  }

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
              <span style="font-weight:600;color:var(--text-main);">${ctx.escapeHtml(v.patient_name || '—')}</span>${belegnummerRosette(v, { patientennummer: v.leads?.patientennummer, escapeHtml: ctx.escapeHtml, titel: 'Patientennummer-Verordnungsnummer — dieselbe Nummer steht auf Rechnung und Abrechnungsdatei' })}
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
              <button class="pod-vord-edit" data-edit-id="${v.id}" style="padding:2px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:12px;cursor:pointer;white-space:nowrap;">${ctx.t('pod_edit')}</button>
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
      <h4 style="margin:0 0 14px;color:var(--text-main);font-size:15px;">${ctx.t('pod_tagesbehandlung')} — ${ctx.escapeHtml(selectedVord.patient_name || '—')}</h4>
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

  const editVord = _podState.editVordId ? _podState.verordnungen.find(v => v.id === _podState.editVordId) : null;
  // Beim Bearbeiten steht die Diagnosegruppe schon fest — dann muss die
  // Nagelauswahl sofort sichtbar sein und nicht erst nach einem change-Event.
  const editIstUI = ['UI1', 'UI2'].includes(podDiagRoot(editVord?.diagnosegruppe || ''));

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start;">

      <!-- Links: Neue Verordnung + Liste -->
      <div>
        <div class="card" style="background:var(--bg-card);border:1px solid var(--border-subtle,var(--border));border-radius:10px;padding:18px;margin-bottom:16px;">
          <h4 style="margin:0 0 14px;color:var(--text-main);font-size:15px;">${editVord ? ctx.t('pod_edit_vord') : ctx.t('pod_new_vord')}</h4>
          <div style="display:grid;gap:10px;">
            <div>
              <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">${ctx.t('pod_patient')}</label>
              <input type="text" id="podNewPatient" placeholder="Name suchen oder eingeben…" autocomplete="off" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;">
              <input type="hidden" id="podNewLeadId">
            </div>
            <div>
              <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">Versichertennummer</label>
              <input type="text" id="podNewVsnr" placeholder="z. B. A123456789" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;">
            </div>
            <div>
              <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">Verordnender Arzt</label>
              <input type="text" id="podNewArztName" placeholder="Arztname oder LANR suchen…" autocomplete="off" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;">
              <input type="hidden" id="podNewArztId">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px;">
                <input type="text" id="podNewArztLanr" inputmode="numeric" maxlength="9" placeholder="LANR (9-stellig)" autocomplete="off" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;">
                <input type="text" id="podNewArztBsnr" inputmode="numeric" maxlength="9" placeholder="BSNR (9-stellig)" autocomplete="off" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;">
              </div>
              <div id="podArztHint" style="font-size:12px;color:var(--text-muted);margin-top:3px;display:none;"></div>
            </div>
            <div>
              <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">${ctx.t('pod_ausstelldatum')}</label>
              <input type="date" id="podNewAusstelldatum" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;">
            </div>
            <!-- Rezeptart steuert das Formular: bei allem außer 'kassen' wandern die
                 Abrechnungsfelder in den eingeklappten GKV-Block (Konsey 2026-08-10). -->
            <div>
              <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">${ctx.t('pod_rezeptart')}</label>
              <select id="podNewRezeptart" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;appearance:none;">
                <option value="kassen">Kassen-Rezept (GKV)</option>
                <option value="privat">Privat-Rezept</option>
                <option value="bg">BG-Rezept</option>
                <option value="selbstzahler">Selbstzahler</option>
              </select>
            </div>
            <div id="podBehandlungsanlassWrap" style="display:none;">
              <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">${ctx.t('pod_behandlungsanlass')}</label>
              <input type="text" id="podNewBehandlungsanlass" placeholder="${ctx.escapeHtml(POD_ANLASS_DEFAULT)}" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;">
              <div style="font-size:12px;color:var(--text-muted);margin-top:3px;">${ctx.t('pod_behandlungsanlass_hint')}</div>
            </div>
            <details id="podGkvDetails" open style="border:1px solid var(--border);border-radius:6px;padding:0;background:transparent;">
              <summary id="podGkvSummary" style="display:none;cursor:pointer;padding:8px 10px;font-size:13px;color:var(--text-muted);list-style:none;">${ctx.t('pod_gkv_angaben')}</summary>
              <div id="podGkvBody" style="display:grid;gap:10px;padding:0;">
                <div>
                  <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">Krankenkasse</label>
                  <select id="podNewKk" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;appearance:none;">
                    <option value="">— Krankenkasse wählen —</option>
                  </select>
                </div>
                <div>
                  <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">${ctx.t('pod_diagnosegruppe')}</label>
                  <select id="podNewDiag" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;appearance:none;">
                    <option value="">— Wählen —</option>
                    ${podDiagOptionsHtml()}
                  </select>
                </div>
                <div>
                  <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">${ctx.t('pod_icd10_label')}</label>
                  <input type="text" id="podNewIcd10" placeholder="z. B. E11.74" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;">
                  <div id="podIcd10Warning" style="color:var(--warning);font-size:12px;margin-top:4px;display:none;"></div>
                  <div id="podL60Hint" style="display:none;margin-top:6px;padding:8px 10px;border-radius:6px;border:1px solid var(--warning);background:var(--bg-card-solid,#1f2937);font-size:13px;color:var(--text-main);">
                    <div style="margin-bottom:6px;color:var(--warning);font-weight:500;">${ctx.escapeHtml(ctx.t('pod_l60_hint'))}</div>
                    <div style="display:flex;gap:8px;">
                      <button type="button" id="podL60UI1Btn" style="flex:1;padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:13px;cursor:pointer;">${ctx.escapeHtml(ctx.t('pod_l60_ui1'))}</button>
                      <button type="button" id="podL60UI2Btn" style="flex:1;padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:13px;cursor:pointer;">${ctx.escapeHtml(ctx.t('pod_l60_ui2'))}</button>
                    </div>
                  </div>
                </div>
                <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-main);cursor:pointer;">
                  <input type="checkbox" id="podNewZuzahlBefreit"> Zuzahlung befreit
                </label>
              </div>
            </details>
            <!-- Wagner ist klinische Dokumentation (§630f BGB), kein Abrechnungsfeld —
                 bleibt unabhängig von der Rezeptart sichtbar (Konsey 2026-08-10). -->
            <div id="podWagnerWrap" style="display:none;">
              <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">Wagner-Klassifikation</label>
              <select id="podNewWagner" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;appearance:none;">
                <option value="">— nicht angegeben —</option>
                <option value="0">Grad 0 – Risikofuß (keine offene Läsion)</option>
                <option value="1">Grad 1 – Oberflächliche Ulzeration</option>
                <option value="2">Grad 2 – Tiefes Ulkus (Sehne/Knochen)</option>
                <option value="3">Grad 3 – Tiefeninfektion / Abszess</option>
                <option value="4">Grad 4 – Begrenzte Gangrän</option>
                <option value="5">Grad 5 – Ausgedehnte Gangrän</option>
              </select>
            </div>
            <!-- Nagelspange: der behandelte Zehennagel gehoert an die VERORDNUNG,
                 nicht an die einzelne Behandlung. § 3b Satz 3-4 der
                 Aenderungsvereinbarung vom 16.06.2025: „Die Nagelspangen-
                 behandlung eines Zehennagels (Lokalisation) stellt einen
                 eigenen Verordnungsfall dar. Eine Verordnung bezieht sich
                 jeweils auf die Behandlung eines Zehennagels." Nur so laesst
                 sich die Serie ueber mehrere Verordnungen hinweg erkennen. -->
            <div id="podNagelWrap" style="display:${editIstUI ? 'block' : 'none'};">
              <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">Behandelter Zehennagel <span style="color:#ef4444;">*</span></label>
              <select id="podNewNagel" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;appearance:none;">
                <option value="">— Nagel wählen —</option>
                ${NAGEL_WERTE.map(w => `<option value="${ctx.escapeHtml(w)}">${ctx.escapeHtml(nagelLabel(w))}</option>`).join('')}
              </select>
              <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Eine Verordnung = ein Nagel. Der Nagel hält die Behandlungsserie über mehrere Verordnungen zusammen.</div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              <div>
                <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">${ctx.t('pod_einheiten')}</label>
                <input type="number" id="podNewEinheiten" min="1" max="60" placeholder="z.B. 6" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;">
              </div>
              <div>
                <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">${ctx.t('pod_frequenz')}</label>
                <select id="podNewFrequenz" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;appearance:none;">${ctx.frequenzOptionsHtml()}</select>
              </div>
            </div>
            <div id="podBeginHintEl" style="font-size:13px;color:var(--text-muted);padding:6px 10px;background:var(--bg-card-solid,#1f2937);border-radius:6px;border:1px solid var(--border);display:none;"></div>
            <div id="podHeilmittelWrap" style="display:none;">
              <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px;">${ctx.t('pod_heilmittel_g')}</label>
              <select id="podNewHeilmittel" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;appearance:none;">
                <option value="">— Wählen —</option>
                <option value="a">a) Hornhautabtragung</option>
                <option value="b">b) Nagelbearbeitung</option>
                <option value="c">c) Podologische Komplexbehandlung</option>
              </select>
              <label id="podHmGrossWrap" style="display:none;align-items:center;gap:6px;font-size:13px;color:var(--text-main);cursor:pointer;margin-top:6px;">
                <input type="checkbox" id="podHmGross"> ${ctx.t('pod_hm_gross')}
              </label>
              <div id="podLeitsymptHint" style="display:none;font-size:12px;color:var(--text-muted);margin-top:6px;padding:6px 10px;background:var(--bg-card-solid,#1f2937);border-radius:6px;border:1px solid var(--border);"></div>
            </div>
            <div>
              <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:6px;">${ctx.t('pod_heilmittel_items')}</label>
              <div id="podHeilmittelItems" style="display:flex;flex-direction:column;gap:6px;"></div>
              <button type="button" id="podAddHeilmittelBtn" style="margin-top:8px;padding:5px 12px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:13px;cursor:pointer;">+ Hinzufügen</button>
            </div>
            <div style="display:flex;gap:20px;flex-wrap:wrap;">
              <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-main);cursor:pointer;">
                <input type="checkbox" id="podNewDringend"> ${ctx.t('pod_dringend')}
              </label>
              <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-main);cursor:pointer;">
                <input type="checkbox" id="podNewHausbesuch"> ${ctx.t('pod_hausbesuch')}
              </label>
            </div>
            <div id="podNewError" style="color:#ef4444;font-size:13px;display:none;"></div>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
              <button id="podSaveVordBtn" class="btn-primary" style="width:fit-content;">${editVord ? ctx.t('pod_update') : ctx.t('pod_save')}</button>
              ${editVord ? `<button id="podCancelEditBtn" style="padding:8px 14px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;cursor:pointer;">${ctx.t('pod_cancel_edit')}</button>` : ''}
            </div>
          </div>
        </div>

        <div class="card" style="background:var(--bg-card);border:1px solid var(--border-subtle,var(--border));border-radius:10px;padding:18px;">
          <h4 style="margin:0 0 12px;color:var(--text-main);font-size:15px;">${ctx.t('pod_active_vord')}</h4>
          <div id="podVordList">${vordListHtml}</div>
        </div>

        ${(() => {
          // Nur GKV-Verordnungen sind §302-fähig. Der Server lehnt alles andere
          // ohnehin ab (abrechnung.routes.js) — hier gar nicht erst anbieten.
          // Berechnet und gefiltert wurde das schon oben (_abrechenbarVords,
          // _podAbrDetails) — vor diesem synchronen Render, weil die Preis-
          // katalogauflösung async ist.
          const abrechenbar = _abrechenbarVords;
          if (!abrechenbar.length) return '';
          // Group by KK
          const byKk = {};
          for (const v of abrechenbar) {
            if (!byKk[v.kostentraeger_ik]) byKk[v.kostentraeger_ik] = [];
            byKk[v.kostentraeger_ik].push(v);
          }
          // Name statt IK: _podKkCache ist dieselbe Liste, aus der podNewKk
          // befüllt wird — also derselbe Wortschatz wie v.kostentraeger_ik.
          const kkName = (ik) => _podKkCache.find(k => k.ik === ik)?.name || ik;
          // Zuzahlung-Status: welche Farbe die Karte zusätzlich zum Kassenanteil
          // erklärt (05.09.2026, Beta-2-Feedback — ohne diese Spalte bleibt
          // unklar, warum eine Kasse weniger als den Brutto-Betrag zahlt).
          const zuzahlungBadge = (v) => {
            if (v.zuzahlung_befreit) return { text: 'befreit', color: '#16a34a' };
            if (v.zuzahlung_kassiert_am) return { text: 'bezahlt', color: '#16a34a' };
            if (v.zuzahlung_eur > 0) return { text: 'offen', color: '#f59e0b' };
            return null;
          };
          const fmtEur = (n) => (Number(n) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
          return `<div class="card" style="background:var(--bg-card);border:1px solid #16a34a;border-radius:10px;padding:18px;margin-top:12px;">
            <h4 style="margin:0 0 12px;color:#16a34a;font-size:15px;">§302 Abrechnung bereit</h4>
            <div style="display:flex;flex-direction:column;gap:10px;">
              ${Object.entries(byKk).map(([ik, vords]) => {
                const kassenanteil = vords.reduce((a, v) => a + (_podAbrDetails.get(v.id)?.gesamt || 0), 0);
                return `
                <div style="background:var(--bg-card-solid,#1f2937);border-radius:8px;border:1px solid var(--border);overflow:hidden;">
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;">
                    <div class="pod-kk-header" data-kk-toggle="${ctx.escapeHtml(ik)}" style="cursor:pointer;flex:1;">
                      <div style="font-size:13px;font-weight:600;color:var(--text-main);">
                        <span class="pod-kk-chevron" style="display:inline-block;transition:transform .15s;margin-right:4px;">▸</span>
                        ${ctx.escapeHtml(kkName(ik))}
                      </div>
                      <div style="font-size:12px;color:var(--text-muted);margin-left:14px;">${vords.length} Verordnung${vords.length>1?'en':''} · Kassenanteil ${fmtEur(kassenanteil)}</div>
                    </div>
                    <button class="pod-abr-btn btn-primary" data-kk-ik="${ctx.escapeHtml(ik)}" data-vord-ids="${ctx.escapeHtml(JSON.stringify(vords.map(v=>v.id)))}"
                      style="font-size:13px;padding:6px 14px;white-space:nowrap;">§302 erstellen</button>
                  </div>
                  <div class="pod-kk-detail" data-kk-detail="${ctx.escapeHtml(ik)}" hidden style="border-top:1px solid var(--border);padding:10px 12px;overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;font-size:12px;">
                      <thead>
                        <tr style="color:var(--text-muted);text-align:left;">
                          <th style="padding:4px 6px;font-weight:600;">Rezeptnr.</th>
                          <th style="padding:4px 6px;font-weight:600;">Patient</th>
                          <th style="padding:4px 6px;font-weight:600;">Mittel</th>
                          <th style="padding:4px 6px;font-weight:600;">Zuzahlung</th>
                          <th style="padding:4px 6px;font-weight:600;text-align:right;">Kassenanteil</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${vords.map(v => {
                          const d = _podAbrDetails.get(v.id);
                          const badge = zuzahlungBadge(v);
                          const mittel = (d?.zeilen || []).map(z => `${ctx.escapeHtml(z.label || z.code)}${z.anzahl>1?` ×${z.anzahl}`:''}`).join(', ') || '—';
                          return `<tr style="border-top:1px solid var(--border);">
                            <td style="padding:4px 6px;color:var(--text-muted);">${ctx.escapeHtml(v.verordnungsnummer != null ? String(v.verordnungsnummer) : v.id.slice(0,8))}</td>
                            <td style="padding:4px 6px;color:var(--text-main);">${ctx.escapeHtml(v.patient_name || '—')}</td>
                            <td style="padding:4px 6px;color:var(--text-muted);">${mittel}</td>
                            <td style="padding:4px 6px;${badge ? `color:${badge.color};font-weight:600;` : 'color:var(--text-muted);'}">${badge ? badge.text : '—'}</td>
                            <td style="padding:4px 6px;text-align:right;color:var(--text-main);">${fmtEur(d?.gesamt)}</td>
                          </tr>`;
                        }).join('')}
                      </tbody>
                      <tfoot>
                        <tr style="border-top:2px solid var(--border);font-weight:600;">
                          <td colspan="4" style="padding:6px;color:var(--text-main);">Summe</td>
                          <td style="padding:6px;text-align:right;color:var(--text-main);">${fmtEur(kassenanteil)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>`;
              }).join('')}
            </div>
            <div id="podAbrError" style="color:#ef4444;font-size:13px;margin-top:8px;display:none;"></div>
          </div>`;
        })()}
      </div>

      <!-- Rechts: Tagesbehandlung -->
      <div id="podBehPanel">
        ${behandlungFormHtml}
      </div>

    </div>`;

  // ---- Event Listeners ----

  document.getElementById('podSaveVordBtn')?.addEventListener('click', async () => {
    const patient    = document.getElementById('podNewPatient').value.trim();
    const datum      = document.getElementById('podNewAusstelldatum').value;
    const diagVal    = document.getElementById('podNewDiag').value;
    const einh       = parseInt(document.getElementById('podNewEinheiten').value) || null;
    const freq       = document.getElementById('podNewFrequenz').value.trim();
    const dring      = document.getElementById('podNewDringend').checked;
    const hausb      = document.getElementById('podNewHausbesuch').checked;
    const rezeptart  = document.getElementById('podNewRezeptart')?.value || 'kassen';
    const icd10Raw   = document.getElementById('podNewIcd10')?.value || '';
    const errEl      = document.getElementById('podNewError');

    // Diagnosegruppe ist nur bei GKV Pflicht — sie stammt aus der HeilM-RL und
    // gilt ausschließlich für Verordnungen zulasten der GKV. Früher war sie
    // immer Pflicht, weshalb bei Selbstzahlern erfundene Gruppen eingetragen
    // wurden (Konsey 2026-08-10).
    const istGkv = rezeptart === POD_GKV_REZEPTART;
    if (!patient || !datum || (istGkv && !diagVal)) {
      errEl.textContent = istGkv
        ? 'Bitte Patient, Datum und Diagnosegruppe ausfüllen.'
        : 'Bitte Patient und Datum ausfüllen.';
      errEl.style.display = 'block';
      return;
    }
    errEl.style.display = 'none';

    const diagRoot = podDiagRoot(diagVal);

    // Der Nagel ist bei UI1/UI2 Pflichtangabe (Anlage 3 o2). Er entscheidet
    // spaeter, ob die Erstbefundung in dieser Serie schon abgerechnet wurde —
    // fehlt er, laeuft die Sperre ins Leere und niemand merkt es.
    const nagelRaw = document.getElementById('podNewNagel')?.value || '';
    const istNagelzweig = diagRoot === 'UI1' || diagRoot === 'UI2';
    const nagel = istNagelzweig ? nagelRaw : null;
    if (istGkv && istNagelzweig && !nagel) {
      errEl.textContent = 'Bitte den behandelten Zehennagel wählen — eine '
        + 'Nagelspangen-Verordnung bezieht sich immer auf genau einen Nagel '
        + '(§ 3b Satz 3-4, Änderungsvereinbarung vom 16.06.2025).';
      errEl.style.display = 'block';
      return;
    }

    // ICD-10: read from form input (user may have edited it)
    const icd10 = icd10Raw.split(',').map(s => s.trim()).filter(Boolean);

    // Verordnetes Heilmittel (Muster 13 Feld g). Steuert 78010 ↔ 78020 und ist
    // gleichzeitig die Leitsymptomatik — beide tragen in der HeilM-RL denselben
    // Buchstaben.
    const hmLetter = POD_HEILMITTEL_KATALOG[document.getElementById('podNewHeilmittel')?.value]
      ? document.getElementById('podNewHeilmittel').value : '';

    // Heilmittel items from dynamic rows
    const heilmittelItems = [];
    document.querySelectorAll('#podHeilmittelItems .pod-hm-row').forEach(row => {
      const code = row.querySelector('.pod-hm-code')?.value;
      const anzahl = parseInt(row.querySelector('.pod-hm-anzahl')?.value) || 1;
      if (code) heilmittelItems.push({
        code, bezeichnung: hpnrLabel(code), anzahl,
        ...(hmLetter ? { massnahme: hmLetter } : {}),
      });
    });

    // Compute beginn_spaetestens
    const beginDate = new Date(datum);
    beginDate.setDate(beginDate.getDate() + (dring ? 14 : 28));
    const beginn_spaetestens = beginDate.toISOString().split('T')[0];

    const wagnerRaw = document.getElementById('podNewWagner')?.value;
    const wagnerGrad = (wagnerRaw !== '' && wagnerRaw != null) ? parseInt(wagnerRaw) : null;
    let leadId       = document.getElementById('podNewLeadId')?.value || null;
    const vsnr       = document.getElementById('podNewVsnr')?.value.trim() || null;

    // Ohne Patientenakte ist die Verordnung nicht abrechenbar: die §302-Erzeugung
    // weist sie zurück ("kein Patient aus der Kartei verknüpft"). `lead_id` wurde
    // nur beim Klick in der Vorschlagsliste gesetzt und beim Speichern sagte das
    // niemand — alle drei bisher angelegten Verordnungen haben deshalb keins.
    // Erst nachbinden (eindeutiger Name = vergessener Klick), dann sperren.
    if (!leadId && patient) {
      const treffer = ctx.leads().filter(l => ctx.displayName(l).trim().toLowerCase() === patient.trim().toLowerCase());
      if (treffer.length === 1) leadId = treffer[0].id;
    }
    if (!leadId && istGkv) {
      ctx.showToast('Bitte den Patienten aus der Liste auswählen — ohne Patientenakte lässt sich die Verordnung später nicht abrechnen.', 'error');
      document.getElementById('podNewPatient')?.focus();
      return;
    }

    // Arzt ins Register übernehmen — auch wenn er noch nicht in der Liste
    // stand. Ohne diesen Schritt sammelte die Podologie gar keine Ärzte.
    const arztNameIn = document.getElementById('podNewArztName')?.value.trim() || '';
    const arztLanrIn = (document.getElementById('podNewArztLanr')?.value || '').replace(/\D/g, '');
    const arztBsnrIn = (document.getElementById('podNewArztBsnr')?.value || '').replace(/\D/g, '');
    let arztId = document.getElementById('podNewArztId')?.value || null;
    if (arztNameIn || /^\d{9}$/.test(arztLanrIn)) {
      const arztOut = await ctx.resolveArzt({
        name: arztNameIn,
        lanr: arztLanrIn,
        bsnr: arztBsnrIn
      }, 'verordnung');
      if (arztOut?.arzt_id) {
        arztId = arztOut.arzt_id;
        ctx.toastArztErgebnis(arztOut);
      }
    }

    const kkIk       = document.getElementById('podNewKk')?.value || null;
    const zuzahlBef  = document.getElementById('podNewZuzahlBefreit')?.checked || false;

    const anlassRaw = document.getElementById('podNewBehandlungsanlass')?.value.trim() || '';

    const _payload = {
      owner_id: ctx.getOwnerId(),
      patient_name: patient,
      ausstellungsdatum: datum,
      // podDiagRoot('') liefert einen Leerstring — leer heißt NULL.
      diagnosegruppe: diagRoot || null,
      // Buchstabe a/b/c wie im übrigen System (prescriptions führt ihn ebenso).
      // Bisher stand hier "DF-a" — die Diagnosegruppe steht schon in der Spalte
      // daneben, der Buchstabe allein ist die Leitsymptomatik.
      leitsymptomatik: hmLetter || (diagVal.match(/-([abc])$/) || [])[1] || null,
      behandlungsanlass: istGkv ? null : (anlassRaw || POD_ANLASS_DEFAULT),
      icd10,
      behandlungseinheiten: einh,
      therapiefrequenz: freq || null,
      dringend: dring,
      hausbesuch: hausb,
      rezeptart,
      beginn_spaetestens,
      heilmittel_items: heilmittelItems,
      wagner_grad: wagnerGrad,
      // Ausserhalb des Nagelzweigs hart auf null: eine umgewidmete Verordnung
      // soll ihren alten Nagel nicht behalten.
      nagel,
      lead_id: leadId,
      versichertennummer: vsnr,
      arzt_id: arztId,
      // Kostenträger und Zuzahlung gibt es nur in der GKV. Sonst hart auf
      // null/false — sonst schleppt ein vorher ausgewählter Wert aus dem
      // zugeklappten Block eine falsche Kasse in den Datensatz.
      kostentraeger_ik: istGkv ? kkIk : null,
      zuzahlung_befreit: istGkv ? zuzahlBef : false,
    };

    let _saveError;
    if (_podState.editVordId) {
      // UPDATE: status-Feld NICHT mitgeben — ein 'abrechenbar'-Datensatz darf
      // nicht auf 'aktiv' zurückfallen (Retaxation-Risiko). `inTopf()` schreibt
      // `abrechnung_status` nur, wenn `status` im Objekt steht — hier steht es
      // absichtlich nicht drin.
      const { error: ue } = await ctx.supabase
        .from(TOPF)
        .update(inTopf(_payload))
        .eq('id', _podState.editVordId)
        .eq('owner_id', ctx.getOwnerId());
      _saveError = ue;
    } else {
      // INSERT: 'aktiv' als Startstatus → abrechnung_status bleibt NULL.
      const { error: ie } = await ctx.supabase
        .from(TOPF)
        .insert({ ...inTopf(_payload), status: 'confirmed' });
      _saveError = ie;
    }

    if (_saveError) {
      errEl.textContent = _saveError.message;
      errEl.style.display = 'block';
      return;
    }
    const _toastMsg = _podState.editVordId ? 'Verordnung aktualisiert ✓' : 'Verordnung gespeichert ✓';
    _podState.editVordId = null;
    ctx.showToast(_toastMsg);
    loadPodologieBilling();
  });

  // ---- New field helpers ----

  // Rezeptart → Formular. Bei GKV bleibt alles wie bisher (Block offen, Summary
  // versteckt). Sonst klappt der Block zu — versteckt, aber mit einem Klick
  // erreichbar: der Patient bringt sein Rezept oft erst später nach.
  function podApplyRezeptart() {
    const isGkv = (document.getElementById('podNewRezeptart')?.value || POD_GKV_REZEPTART) === POD_GKV_REZEPTART;
    const details = document.getElementById('podGkvDetails');
    const summary = document.getElementById('podGkvSummary');
    const anlass  = document.getElementById('podBehandlungsanlassWrap');
    if (details) {
      details.open = isGkv;
      details.style.border = isGkv ? 'none' : '1px solid var(--border)';
    }
    if (summary) summary.style.display = isGkv ? 'none' : 'block';
    if (anlass)  anlass.style.display  = isGkv ? 'none' : 'block';
  }

  function computeBeginHint() {
    const datum = document.getElementById('podNewAusstelldatum')?.value;
    const dring = document.getElementById('podNewDringend')?.checked;
    const el = document.getElementById('podBeginHintEl');
    if (!el) return;
    if (!datum) { el.style.display = 'none'; return; }
    const d = new Date(datum);
    d.setDate(d.getDate() + (dring ? 14 : 28));
    el.textContent = `📅 Beginn spätestens: ${d.toLocaleDateString('de-DE')}`;
    el.style.display = 'block';
  }

  async function podRenderHeilmittelRow(diagRootVal, preset = '', anzahl = 1) {
    const rows = await podLoadHpnr(diagRootVal);
    const options = heilmittelOptionsHtml(rows, preset, '— HPNR —').replace(/^<option value="">.*?<\/option>/, '');
    const row = document.createElement('div');
    row.className = 'pod-hm-row';
    row.style.cssText = 'display:flex;gap:6px;align-items:center;';
    row.innerHTML = `
      <select class="pod-hm-code" style="flex:1;padding:6px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:13px;appearance:none;">
        <option value="">— HPNR —</option>
        ${options}
      </select>
      <input type="number" class="pod-hm-anzahl" min="1" max="99" value="${anzahl}" style="width:64px;padding:6px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:13px;">
      <button type="button" class="pod-hm-remove" style="padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--danger,#ef4444);font-size:14px;cursor:pointer;line-height:1;">×</button>`;
    return row;
  }

  async function podUpdateHeilmittelOptions() {
    const diagVal = document.getElementById('podNewDiag')?.value || '';
    const diagRootVal = podDiagRoot(diagVal);
    const rows = await podLoadHpnr(diagRootVal);
    document.querySelectorAll('#podHeilmittelItems .pod-hm-code').forEach(sel => {
      sel.innerHTML = heilmittelOptionsHtml(rows, sel.value, '— HPNR —');
    });
  }

  /**
   * Muster 13 Feld g (verordnetes Heilmittel) → Leitsymptomatik-Text und
   * HPNR-Zeilen vorbelegen. Alles bleibt von Hand änderbar: automatisch
   * gesetzte Zeilen tragen data-auto="1" und werden beim nächsten Lauf ersetzt;
   * sobald der Anwender eine Zeile anfasst, verliert sie die Markierung und
   * bleibt stehen.
   */
  async function podApplyHeilmittel(opts = {}) {
    const wrap      = document.getElementById('podHeilmittelWrap');
    const sel       = document.getElementById('podNewHeilmittel');
    const grossWrap = document.getElementById('podHmGrossWrap');
    const grossCb   = document.getElementById('podHmGross');
    const hintEl    = document.getElementById('podLeitsymptHint');
    const container = document.getElementById('podHeilmittelItems');
    if (!wrap || !sel || !container) return;

    const diagRootVal = podDiagRoot(document.getElementById('podNewDiag')?.value || '');
    const anwendbar   = POD_HEILMITTEL_DGS.includes(diagRootVal);
    wrap.style.display = anwendbar ? 'block' : 'none';
    if (!anwendbar) sel.value = '';

    const eintrag = POD_HEILMITTEL_KATALOG[sel.value];

    // „Behandlung groß" gibt es nur bei der Komplexbehandlung (FAK Q25).
    const grossMoeglich = !!(eintrag && eintrag.hpnrGross);
    if (grossWrap) grossWrap.style.display = grossMoeglich ? 'flex' : 'none';
    if (grossCb && !grossMoeglich) grossCb.checked = false;

    if (hintEl) {
      hintEl.textContent = eintrag
        ? `Leitsymptomatik ${sel.value}) ${eintrag.leitsymptomatik}`
        : '';
      hintEl.style.display = eintrag ? 'block' : 'none';
    }

    // Leitsymptomatik-Buchstabe in die Diagnosegruppe spiegeln — nur DF führt
    // Untergruppen im Auswahlfeld. NF/QF tragen den Buchstaben erst beim
    // Speichern (Spalte leitsymptomatik).
    if (eintrag && diagRootVal === 'DF') {
      const dgEl = document.getElementById('podNewDiag');
      const ziel = `DF-${sel.value}`;
      if (dgEl && dgEl.value !== ziel && [...dgEl.options].some(o => o.value === ziel)) {
        dgEl.value = ziel;
      }
    }

    // nurAnzeige: Im Bearbeitungsmodus nur Sichtbarkeit/Hinweis aktualisieren,
    // aber die bestehenden Heilmittel-Zeilen unangetastet lassen.
    if (opts.nurAnzeige) return;

    container.querySelectorAll('.pod-hm-row[data-auto="1"]').forEach(r => r.remove());
    if (!eintrag) return;

    const katalog   = await podLoadHpnr(diagRootVal);
    const einheiten = parseInt(document.getElementById('podNewEinheiten')?.value) || 1;
    const vorhanden = new Set(
      [...container.querySelectorAll('.pod-hm-code')].map(s => s.value).filter(Boolean));
    const codes = [
      (grossCb?.checked && eintrag.hpnrGross) ? eintrag.hpnrGross : eintrag.hpnr,
      POD_BEFUNDPAUSCHALE,
    ];

    for (const code of codes) {
      if (vorhanden.has(code)) continue;
      // Steht die Position im Katalog dieser Diagnosegruppe nicht zur Verfügung,
      // lieber gar keine Zeile als eine mit leerem Auswahlfeld.
      if (!katalog.some(r => r.code === code)) continue;
      const row = await podRenderHeilmittelRow(diagRootVal, code, einheiten);
      row.dataset.auto = '1';
      container.appendChild(row);
      vorhanden.add(code);
    }
  }

  function podValidateIcd10() {
    const diagVal = document.getElementById('podNewDiag')?.value || '';
    const diagRootVal = podDiagRoot(diagVal);
    const raw = document.getElementById('podNewIcd10')?.value || '';
    const warnEl = document.getElementById('podIcd10Warning');
    if (!warnEl) return;
    // Leeres ICD-Feld → keine Warnung (ICD ist nicht Pflicht)
    if (!raw.trim() || !diagRootVal) { warnEl.style.display = 'none'; return; }

    const rule = (_dgIcdRules || {})[diagRootVal];
    // Keine Regeln geladen (Migration noch nicht eingespielt) → still keine Warnung
    if (!rule || !rule.icd_accept || rule.icd_accept.length === 0) { warnEl.style.display = 'none'; return; }

    const codes = parseIcdList(raw);
    const result = matchIcdToDg(codes, rule);

    if (result.status === 'mismatch') {
      const isHard = rule.icd_enforcement === 'hard_before_dta';
      let msg = `${ctx.t('pod_icd_mismatch')}: ${codes.join(', ')} (${diagRootVal})`;
      if (result.hints.length > 0) msg += ` — ${result.hints.join('; ')}`;
      if (isHard) {
        msg += ' ⚠ ' + ctx.t('pod_icd_hard');
        warnEl.style.fontWeight = '600';
      } else {
        warnEl.style.fontWeight = '';
      }
      warnEl.textContent = msg;
      warnEl.style.display = 'block';
    } else {
      warnEl.style.display = 'none';
    }
  }

  // Wire up: Diagnosegruppe change (DG → ICD Gegenrichtung)
  document.getElementById('podNewDiag')?.addEventListener('change', () => {
    const diagVal = document.getElementById('podNewDiag').value;
    const diagRootVal = podDiagRoot(diagVal);
    const icd10El = document.getElementById('podNewIcd10');

    // DG → ICD: nur wenn ICD-Feld leer und genau ein Kode ableitbar (UI1/UI2 → L60.0)
    if (icd10El && !icd10El.value.trim()) {
      const rule = (_dgIcdRules || {})[diagRootVal];
      const sole = rule ? soleIcdForDg(rule) : null;
      if (sole) icd10El.value = sole;
    }

    // L60.0-Rückfrage ausblenden wenn Diagnosegruppe wechselt
    const l60hint = document.getElementById('podL60Hint');
    if (l60hint) l60hint.style.display = 'none';

    // Wagner nur bei DF
    const wagnerWrap = document.getElementById('podWagnerWrap');
    if (wagnerWrap) wagnerWrap.style.display = diagRootVal === 'DF' ? 'block' : 'none';

    // Nagel nur im Nagelzweig. Beim Wechsel WEG von UI1/UI2 die Auswahl
    // leeren — sonst schleppt eine umgewidmete Verordnung einen Nagel mit,
    // den sie gar nicht mehr hat.
    const nagelWrap = document.getElementById('podNagelWrap');
    const istUIx = diagRootVal === 'UI1' || diagRootVal === 'UI2';
    if (nagelWrap) nagelWrap.style.display = istUIx ? 'block' : 'none';
    if (!istUIx) { const n = document.getElementById('podNewNagel'); if (n) n.value = ''; }

    // Untergruppe der Diagnosegruppe (DF-a/b/c) ist derselbe Buchstabe wie das
    // Heilmittel — Auswahlfeld nachziehen, damit beide nicht auseinanderlaufen.
    const hmSel = document.getElementById('podNewHeilmittel');
    const letter = (diagVal.match(/-([abc])$/) || [])[1];
    if (hmSel && letter && hmSel.value !== letter) hmSel.value = letter;

    // Erst die Optionen der bestehenden Zeilen auf die neue Diagnosegruppe
    // umstellen, dann die automatischen Zeilen neu setzen — umgekehrt würde die
    // Umstellung die frisch gesetzte Auswahl wieder überschreiben.
    podUpdateHeilmittelOptions().then(podApplyHeilmittel);
    podValidateIcd10();
  });

  // Wire up: verordnetes Heilmittel (Muster 13 Feld g) → HPNR + Leitsymptomatik
  document.getElementById('podNewHeilmittel')?.addEventListener('change', podApplyHeilmittel);
  document.getElementById('podHmGross')?.addEventListener('change', podApplyHeilmittel);
  podApplyHeilmittel();   // Erstzustand (Feld ist bei UI1/UI2 ausgeblendet)
  document.getElementById('podNewEinheiten')?.addEventListener('change', () => {
    const einh = parseInt(document.getElementById('podNewEinheiten')?.value) || 1;
    document.querySelectorAll('#podHeilmittelItems .pod-hm-row[data-auto="1"] .pod-hm-anzahl')
      .forEach(inp => { inp.value = einh; });
  });

  // podNewIcd10 verdrahtet sich beim Fokus selbst (DIAGNOSE_FIELDS) — wichtig,
  // weil dieses Panel bei jedem loadPodologieBilling() neu gerendert wird.

  // Patientensuche — gemeinsames Modul statt <datalist>. Damit findet man hier
  // endlich auch über Geburtsdatum und Telefonnummer, und die Zuordnung hängt
  // nicht mehr daran, dass der getippte Text exakt dem Label entspricht.
  const podPatientInput = document.getElementById('podNewPatient');
  if (podPatientInput) {
    attachPatientSearch(podPatientInput, {
      loadLeads: ctx.ensureLeadsCache,   // lädt selbst nach, statt auf das Patienten-Panel zu warten
      matches:   ctx.patientMatchesQuery,
      labelOf:   ctx.displayNameWithBirth,
      onSelect:  lead => {
        const leadIdEl = document.getElementById('podNewLeadId');
        const vsnrEl   = document.getElementById('podNewVsnr');
        const podKkSel = document.getElementById('podNewKk');
        if (leadIdEl) leadIdEl.value = lead.id;
        if (vsnrEl && !vsnrEl.value.trim()) vsnrEl.value = lead.versichertennummer || '';
        if (podKkSel && !podKkSel.value && lead.krankenkasse) {
          const matchedKk = _podKkCache.find(k => k.name === lead.krankenkasse);
          if (matchedKk) podKkSel.value = matchedKk.ik;
        }
      },
    });
    // Freitext ohne Auswahl → keine Lead-Bindung
    podPatientInput.addEventListener('input', () => {
      const leadIdEl = document.getElementById('podNewLeadId');
      if (leadIdEl && !podPatientInput.value.trim()) leadIdEl.value = '';
    });
  }

  // Wire up: KK select populate
  const podKkSel = document.getElementById('podNewKk');
  if (podKkSel && _podKkCache.length) {
    podKkSel.innerHTML = '<option value="">— Krankenkasse wählen —</option>' +
      _podKkCache.map(k => `<option value="${ctx.escapeHtml(k.ik)}">${ctx.escapeHtml(k.name)}</option>`).join('');
  }

  // ---- Bearbeitungsmodus: Formular mit vorhandenen Daten füllen ----
  // Muss NACH der KK-Befüllung stehen, da podNewKk-Optionen erst jetzt existieren.
  async function podFillEditForm(v) {
    const _set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
    const _chk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };

    _set('podNewPatient',  v.patient_name || '');
    _set('podNewLeadId',   v.lead_id || '');
    _set('podNewVsnr',     v.versichertennummer || '');
    _set('podNewAusstelldatum', v.ausstellungsdatum || '');
    _set('podNewWagner',   v.wagner_grad != null ? String(v.wagner_grad) : '');
    _set('podNewNagel',    v.nagel || '');
    _set('podNewEinheiten', v.behandlungseinheiten || '');
    _set('podNewFrequenz',  v.therapiefrequenz || '');
    _chk('podNewDringend',  v.dringend);
    _chk('podNewHausbesuch', v.hausbesuch);
    _chk('podNewZuzahlBefreit', v.zuzahlung_befreit);
    _set('podNewIcd10', (v.icd10 || []).join(', '));

    // Rezeptart zuerst setzen, dann Sichtbarkeit anpassen
    _set('podNewRezeptart', v.rezeptart || 'kassen');
    podApplyRezeptart();

    // Behandlungsanlass (nur Nicht-GKV)
    _set('podNewBehandlungsanlass', v.behandlungsanlass || '');

    // Arzt aus Tabelle lesen (§ 16390 Muster)
    if (v.arzt_id) {
      const { data: arzt } = await ctx.supabase
        .from('aerzte')
        .select('arzt_name,lanr,bsnr')
        .eq('id', v.arzt_id)
        .eq('owner_id', ctx.getOwnerId())
        .maybeSingle();
      if (arzt) {
        _set('podNewArztName', arzt.arzt_name || '');
        _set('podNewArztLanr', arzt.lanr || '');
        _set('podNewArztBsnr', arzt.bsnr || '');
        _set('podNewArztId',   v.arzt_id);
      }
    }

    // Krankenkasse
    _set('podNewKk', v.kostentraeger_ik || '');

    // Diagnosegruppe + Heilmittel-Buchstabe
    const letter = podVordMassnahme(v);
    const ziel   = letter ? `${v.diagnosegruppe}-${letter}` : (v.diagnosegruppe || '');
    const dgEl   = document.getElementById('podNewDiag');
    if (dgEl) {
      const hat = [...dgEl.options].some(o => o.value === ziel);
      dgEl.value = hat ? ziel : (v.diagnosegruppe || '');
      // Automatische ICD-Vorauswahl durch _wireDgIcdPair unterdrücken
      dgEl.dataset.manualOverride = '1';
    }

    // Heilmittel-Buchstabe (Muster 13 Feld g)
    _set('podNewHeilmittel', letter);

    // Therapiezeit > 20 Min (78020)
    const grossCb = document.getElementById('podHmGross');
    if (grossCb) grossCb.checked = (v.heilmittel_items || []).some(i => i?.code === '78020');

    // Bestehende Heilmittel-Zeilen laden (ohne data-auto — dürfen nicht auto-gelöscht werden)
    const diagRootVal = podDiagRoot(dgEl?.value || '');
    const container   = document.getElementById('podHeilmittelItems');
    if (container && Array.isArray(v.heilmittel_items)) {
      container.innerHTML = '';
      for (const item of v.heilmittel_items) {
        if (!item?.code) continue;
        const row = await podRenderHeilmittelRow(diagRootVal, item.code, item.anzahl || 1);
        // data-auto NICHT setzen — diese Zeilen wurden vom Arzt eingetragen
        container.appendChild(row);
      }
    }

    computeBeginHint();
    await podApplyHeilmittel({ nurAnzeige: true });
    // Werte wurden programmatisch gesetzt — das löst kein change-Event aus,
    // also die ICD-Prüfung einmal von Hand nachziehen.
    podValidateIcd10();
  }

  // Bewusst awaited: die Felder müssen stehen, BEVOR _wireDgIcdPair() weiter
  // unten seine Automatik anhängt — sonst kann die ICD→DG-Vorauswahl die
  // gespeicherte Diagnosegruppe überschreiben.
  if (editVord) {
    await podFillEditForm(editVord);
  }

  // Wire up: Arzt-Picker + Hinweis (gemeinsames Modul, siehe wireArztFeld)
  wireArztFeld({
    name: 'podNewArztName', lanr: 'podNewArztLanr', bsnr: 'podNewArztBsnr',
    id:   'podNewArztId',   hint: 'podArztHint',
  });

  // Wire up: Rezeptart change (steuert GKV-Block + Behandlungsanlass)
  document.getElementById('podNewRezeptart')?.addEventListener('change', podApplyRezeptart);
  podApplyRezeptart();

  // Wire up: Ausstelldatum change
  document.getElementById('podNewAusstelldatum')?.addEventListener('change', computeBeginHint);

  // Wire up: Dringend change
  document.getElementById('podNewDringend')?.addEventListener('change', computeBeginHint);

  // Wire up: ICD-10 bidirektional (ICD → DG auto-select, L60.0-Rückfrage, Warnung)
  ctx._wireDgIcdPair('podNewIcd10', 'podNewDiag', 'select', 'podIcd10Warning', 'podologie');

  // Wire up: L60.0 Rückfrage-Schaltflächen (inline onclick aus ES-Modul nicht erlaubt → addEventListener)
  function _podChooseUI(dg) {
    const dgEl   = document.getElementById('podNewDiag');
    const l60hint = document.getElementById('podL60Hint');
    if (dgEl) {
      // Optionen zurücksetzen, dann Wert setzen
      Array.from(dgEl.options).forEach(opt => { opt.style.display = ''; });
      dgEl.value = dg;
      dgEl.dataset.manualOverride = '1';
      dgEl.dispatchEvent(new Event('input',  { bubbles: true }));
      dgEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (l60hint) l60hint.style.display = 'none';
  }
  document.getElementById('podL60UI1Btn')?.addEventListener('click', () => _podChooseUI('UI1'));
  document.getElementById('podL60UI2Btn')?.addEventListener('click', () => _podChooseUI('UI2'));

  // Wire up: Add heilmittel row button
  document.getElementById('podAddHeilmittelBtn')?.addEventListener('click', async () => {
    const diagVal = document.getElementById('podNewDiag')?.value || '';
    const diagRootVal = podDiagRoot(diagVal);
    const container = document.getElementById('podHeilmittelItems');
    if (container) container.appendChild(await podRenderHeilmittelRow(diagRootVal));
  });

  // Wire up: Remove heilmittel row (event delegation)
  document.getElementById('podHeilmittelItems')?.addEventListener('click', e => {
    if (e.target.classList.contains('pod-hm-remove')) {
      e.target.closest('.pod-hm-row')?.remove();
    }
  });

  // Von Hand geänderte Zeile ist nicht mehr „automatisch" — sie darf beim
  // nächsten podApplyHeilmittel() nicht weggeräumt werden.
  document.getElementById('podHeilmittelItems')?.addEventListener('change', e => {
    const row = e.target.closest('.pod-hm-row');
    if (row) delete row.dataset.auto;
  });

  document.getElementById('podCancelEditBtn')?.addEventListener('click', () => {
    _podState.editVordId = null;
    loadPodologieBilling();
  });

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
        const name = vord?.patient_name || 'diesen Patienten';
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
        const name = vord?.patient_name || 'diesen Patienten';
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
