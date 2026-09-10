/**
 * abrechnung-auswahl.js — die EINE Auswahlliste des §302-Bildschirms.
 *
 * Warum es das gibt
 * ─────────────────
 * Bis zum 09.09.2026 gab es zwei Auswahllisten für dieselbe Sache:
 *
 *   Physio/Ergo/Logo  `#panel-abrechnung`, 4-Stufen-Assistent, Häkchen je
 *                     REZEPT, immer nur eine Kasse zur Zeit, kein Hinweis
 *                     auf die entstehende Dateizahl.
 *   Podologie         `#panel-podologie-billing`, Häkchen je KASSE,
 *                     Mehrfachauswahl, Dateieinheit-Abzeichen.
 *
 * Beide lasen seit dem 04.09.2026 dieselbe Tabelle (`prescriptions`), beide
 * schrieben dieselbe Zeile in `abrechnung`. Die Trennung war historisch, nicht
 * fachlich (`ABRECHNUNG_BILDSCHIRM_PLAN.md`, Abschnitt 1). Diese Datei führt
 * beide zusammen, OHNE einer Seite etwas wegzunehmen: der Parameter
 * `granularitaet` hält den einzigen echten Unterschied fest.
 *
 *     'kasse'   Die ganze Kasse wandert als Bündel in die Datei (Podologie).
 *     'rezept'  Jedes Rezept ist einzeln an- und abwählbar (Physio/Ergo/Logo).
 *
 * Beides muss bleiben: der Podologe rechnet einmal im Monat alles ab
 * (Beta-2, 05.09.2026), der Physiotherapeut nimmt regelmässig einzelne Rezepte
 * heraus, weil ein Therapiebericht fehlt oder eine Sitzung nachgetragen wird.
 *
 * Zwei Fachbereiche, zwei Zeilen — auch bei derselben Kasse
 * ─────────────────────────────────────────────────────────
 * Gruppiert wird nach `bereich + kostentraeger_ik`, nicht nur nach IK. Grund:
 * die beiden Zweige gehen über verschiedene Endpunkte (`/abrechnung/create`
 * gegen `/abrechnung/create-podologie`) und über verschiedene Preiskataloge
 * (physiotherapeutische Positionsnummern gegen podologische 78xxx-HPNR).
 * Fachlich DÜRFTEN beide in einer Datei stehen — alle vier Heilmittel sind
 * Leistungsbereich `B`, der Abrechnungscode steht am Beleg, nicht an der Datei
 * (gkv-302 zum Plan, Abschnitt 3). Getrennt werden sie, weil die
 * Abrechnungscode-Kette zu unterschiedlichen Datenannahmestellen auflöst.
 *
 * Eine interdisziplinäre Praxis mit derselben Kasse in beiden Zweigen erzeugt
 * deshalb ZWEI Dateien und zwei Umschläge. Der Sammelhinweis zählt sie auch als
 * zwei — die Zahl der Umschläge ist die tragende Zahl, die Wortwahl
 * („2 Kassen ausgewählt") ist in diesem Sonderfall die ungenauere.
 *
 * Kassenanteil ist NICHT die Zuzahlung
 * ─────────────────────────────────────
 * Die alte Podologie-Liste beschriftete eine Spalte mit „Kassenanteil" und
 * zeigte darin `zuzahlungFuerPodoVerordnung(...).gesamt` — also den Betrag, den
 * der PATIENT zahlt. Hier steht, was `gkv-302` zum Plan (Abschnitt 3) als Soll
 * festgelegt hat: `Soll = brutto − zuzahlung` (Anlage 1 TP5 V21 §5.5.2, GES).
 * Beide Zahlen werden nebeneinander gezeigt, damit die Verwechslung nicht
 * wiederkommt.
 *
 * Texte fest verdrahtet, kein `ctx.t()`
 * ──────────────────────────────────────
 * Wie in `module/abrechnung-status.js` und `module/podologie-dateieinheit.js`:
 * jede neue Zeile im `T`-Wörterbuch von `dashboard.js` verstösst gegen die
 * Wachstumssperre (`tools/check-dashboard-size.sh`, Konsey 2026-08-13).
 * Englisch/Türkisch für dieses GKV-Vokabular ist eine spätere, eigenständige
 * Entscheidung.
 */

import { fmtEur } from './geld.js?v=20260909';
import { checkPrescriptionCompliance, istHarterRiegel, istBerichtOffen,
         frageBerichtFreigabe } from './abrechnung-freigabe.js?v=20260826';
import { zuzahlungFuerRezept, zuzahlungFuerPodoVerordnung } from './zuzahlung-rechnen.js?v=20260902';
import { podoPositionsFinder } from './podologie-positionen.js?v=20260902';
import { standortZuschnitt } from './standort-zuschnitt.js?v=20260828';
import { TOPF, PODO_SELECT, PODO_ARBEITSLISTE_OR, ausTopf } from './verordnung-topf.js?v=20260904';
import { initDateieinheit, ladeDateieinheiten, dateieinheitBadge,
         auswahlHinweis } from './podologie-dateieinheit.js?v=20260907';

// ─── Reine Rechen- und Regelteile (ohne DOM, ohne Netz — hier liegen die Tests) ───

/** Was die Kasse zahlt: Bruttobetrag abzüglich der Patienten-Zuzahlung.
 *  Anlage 1 TP5 V21 §5.5.2 (GES). Nie negativ. */
export function kassenanteil(brutto, zuzahlung) {
  const v = (Number(brutto) || 0) - (Number(zuzahlung) || 0);
  return v > 0 ? Math.round(v * 100) / 100 : 0;
}

/**
 * Die zwei harten GKV-Sperren der Podologie, exakt gespiegelt aus dem Backend
 * (`abrechnung.routes.js`, `create-podologie`). Eine Vorschau, die vom Backend
 * abweicht, ist eine Vorschau, der man nicht trauen kann — deshalb wortgleich.
 *
 * @param {object} vord          Zeile im podologischen Wortschatz (verordnung-topf.js)
 * @param {Array<string>} hpnrs  alle dokumentierten HPNR dieser Verordnung
 * @returns {Array<string>} Klartextgründe, leer = einreichbar
 */
export function podoSperren(vord, hpnrs = []) {
  const dgRoot = String(vord?.diagnosegruppe || '').replace(/\s+/g, '').toUpperCase().replace(/-[ABC]$/, '');
  if (dgRoot !== 'UI1' && dgRoot !== 'UI2') return [];
  const gruende = [];

  const kodes = (Array.isArray(vord?.icd10) ? vord.icd10 : []).join(',')
    .split(/[,;]/).map(s => s.replace(/\s+/g, '').toUpperCase()).filter(Boolean);
  if (kodes.length > 0 && !kodes.includes('L60.0')) {
    gruende.push(`Diagnosegruppe ${dgRoot} lässt ausschließlich ICD-10 L60.0 zu (angegeben: ${kodes.join(', ')}).`);
  }

  const VERBOTEN = ['78030', '68030', '88030'];
  const vorhanden = new Set((hpnrs || []).map(c => String(c).trim()));
  const treffer = VERBOTEN.filter(c => vorhanden.has(c));
  if (treffer.length) {
    gruende.push(`Befundpauschale (${treffer.join(', ')}) ist bei Nagelspangenbehandlungen (UI1/UI2) nicht abrechenbar.`);
  }
  return gruende;
}

/**
 * Keine dokumentierte Behandlung (keine HPNR) an dieser Verordnung.
 * Anders als `podoSperren()` NICHT übersteuerbar: `mapVerordnungToDtaShape()`
 * (Backend) wirft `sessions.length === 0` unbedingt — es gibt dort keine
 * `sperrenIgnoriert`-Ausnahme dafür, weil es nichts zu übersteuern gibt: eine
 * Verordnung ohne eine einzige erbrachte Leistung hat schlicht nichts, was
 * abgerechnet werden könnte. Ein „Trotzdem übernehmen"-Knopf dafür würde nur
 * denselben 422 ein zweites Mal erzeugen.
 * @param {Array<string>} hpnrs alle dokumentierten HPNR dieser Verordnung
 */
export function keineDokumentierteBehandlung(hpnrs) {
  return !(hpnrs && hpnrs.length);
}

/**
 * Strukturelle Blocker der Podologie, gespiegelt aus `create-podologie`
 * (`api-backend/billing/api/abrechnung.routes.js`): fehlender Patientenbezug
 * (`!np.nachname` — Name kommt IMMER aus der Patientenakte, nie aus dem
 * Freitextfeld `patient_name`), fehlender Arzt, fehlende Versichertennummer,
 * keine dokumentierte Behandlung. Anders als `podoSperren()` gibt es dafür
 * KEINEN Übersteuerungsweg im Backend — `sperrenIgnoriert` kennt nur die
 * beiden UI1/UI2-Regeln, diese Prüfungen laufen vorher und ungefragt.
 * @param {object} v      Zeile im podologischen Wortschatz (verordnung-topf.js)
 * @param {Array<string>} hpnrs alle dokumentierten HPNR dieser Verordnung
 * @returns {Array<string>} Klartextgründe, leer = strukturell in Ordnung
 */
export function podoStrukturBlocker(v, hpnrs = []) {
  const gruende = [];
  if (!v?.patient_id || !v?.leads?.last_name) {
    gruende.push('Kein Patient aus der Kartei verknüpft — der Name für die Abrechnung wird immer aus der ' +
      'Patientenakte übernommen, nie aus dem Freitextfeld. Bitte die Verordnung einem Patienten zuordnen.');
  }
  if (!v?.arzt_id) {
    gruende.push('Kein Arzt hinterlegt — bitte die Verordnung ergänzen.');
  }
  if (!v?.versichertennummer && !v?.leads?.versichertennummer) {
    gruende.push('Versichertennummer fehlt.');
  }
  if (keineDokumentierteBehandlung(hpnrs)) {
    gruende.push('Keine dokumentierte Behandlung erfasst — ohne mindestens eine Leistung (HPNR) lehnt der ' +
      'Server die gesamte Datei ab („keine Behandlungen vorhanden"). Bitte zuerst unter „Behandlungen" eine ' +
      'Leistung für diesen Patienten erfassen.');
  }
  return gruende;
}

/** Eindeutiger Schlüssel einer Gruppe. `bereich` gehört dazu — siehe Kopf. */
export function gruppenKey(bereich, ik) { return `${bereich}|${ik}`; }

/**
 * Fasst die Zeilen beider Zweige zu Kassen-Gruppen zusammen.
 * Reine Funktion: rein gehen fertig gerechnete Zeilen, raus kommt die
 * Reihenfolge, in der der Bildschirm sie zeichnet.
 *
 * @param {Array<{bereich:string, ik:string, brutto:number, zuzahlung:number, blockiert?:boolean}>} zeilen
 * @param {(ik:string)=>string} kassenName
 * @returns {Array<{key:string, bereich:string, ik:string, name:string, granularitaet:string,
 *                  zeilen:Array, brutto:number, zuzahlung:number, soll:number}>}
 */
export function baueGruppen(zeilen, kassenName = (ik) => ik) {
  const map = new Map();
  for (const z of zeilen || []) {
    const key = gruppenKey(z.bereich, z.ik);
    if (!map.has(key)) {
      map.set(key, {
        key, bereich: z.bereich, ik: z.ik,
        name: kassenName(z.ik),
        granularitaet: z.bereich === 'podo' ? 'kasse' : 'rezept',
        zeilen: [], brutto: 0, zuzahlung: 0, soll: 0,
      });
    }
    const g = map.get(key);
    g.zeilen.push(z);
    g.brutto    = Math.round((g.brutto    + (Number(z.brutto)    || 0)) * 100) / 100;
    g.zuzahlung = Math.round((g.zuzahlung + (Number(z.zuzahlung) || 0)) * 100) / 100;
    g.soll      = kassenanteil(g.brutto, g.zuzahlung);
  }
  // Podologie zuerst nur, wenn sie da ist — sonst alphabetisch nach Kassenname.
  return [...map.values()].sort((a, b) =>
    a.bereich === b.bereich ? a.name.localeCompare(b.name) : (a.bereich === 'physio' ? -1 : 1));
}

/**
 * Was steckt gerade in der Auswahl?
 *
 * `gewaehlt` enthält bei `granularitaet:'kasse'` den Gruppenschlüssel, bei
 * `'rezept'` die einzelnen Zeilen-Kennungen. Eine Gruppe gilt als gewählt,
 * sobald mindestens eine ihrer Zeilen drin ist — genau das ist die Zahl der
 * entstehenden Dateien und Umschläge.
 *
 * @returns {{gruppen:number, zeilen:number, soll:number, iks:Array<string>}}
 */
export function auswahlStand(gruppen, gewaehlt) {
  const set = gewaehlt instanceof Set ? gewaehlt : new Set(gewaehlt || []);
  let zeilen = 0, brutto = 0, zuzahlung = 0;
  const iks = [];
  for (const g of gruppen || []) {
    const drin = g.granularitaet === 'kasse'
      ? (set.has(g.key) ? g.zeilen : [])
      : g.zeilen.filter(z => set.has(z.id));
    if (!drin.length) continue;
    iks.push(g.ik);
    zeilen += drin.length;
    for (const z of drin) {
      brutto    += Number(z.brutto)    || 0;
      zuzahlung += Number(z.zuzahlung) || 0;
    }
  }
  return {
    gruppen: iks.length,
    zeilen,
    soll: kassenanteil(Math.round(brutto * 100) / 100, Math.round(zuzahlung * 100) / 100),
    iks,
  };
}

// ─── Zustand + Verdrahtung ──────────────────────────────────────────────────

let ctx = null;

const _st = {
  gruppen: [],          // Ergebnis von baueGruppen()
  gewaehlt: new Set(),  // Gruppenschlüssel (Podologie) bzw. Zeilen-Ids (Physio)
  offen: new Set(),     // aufgeklappte Gruppenschlüssel
  // Aufgeklappte EINZELNE Verordnungen (Zeilen-Id) — der Feldercheck vor dem
  // Erstellen (Ops-Wunsch 10.09.2026: "hastanın üzerine basınca abrechnung ile
  // alakalı bilgileri çıkmalı"). Zeigt, was schon geladen ist (`_st.rxRoh`) —
  // kein zusätzlicher Request, keine zweite Feldliste, die von
  // `module/verordnung-detail.js` abweichen könnte: dort steht inzwischen die
  // volle editierbare Muster-13-Maske (Singleton-DOM-Knoten, „es gibt nur
  // dieses eine Exemplar") — für eine Inline-Vorschau in einer Auswahlliste
  // ungeeignet, deshalb eine eigene, bewusst schlanke Nur-Lese-Kachel hier.
  offenZeile: new Set(),
  fehlerhaft: [],       // [{ bereich, zeile, gruende }]
  rxRoh: new Map(),     // id → rohe prescriptions-Zeile (für Freigabe + Position)
  busy: false,
  geladen: false,
  // Abrechnungszeitraum (Ops #265). Filtert nach `ausstellungsdatum`, damit ein
  // spät erfasstes Rezept nicht unbemerkt in den falschen Monatslauf rutscht:
  // die Rechnungsnummer auf dem Begleitzettel muss zu den Papier-Urbelegen
  // desselben Laufs passen (gkv-302).
  // ⚠️ Diese beiden Felder standen seit dem 05.09.2026 in
  // `podologie-abrechnung.js` — mit Eingabefeldern, aber OHNE Zuhörer. Der
  // Filter war also nie wirksam; hier ist er es. Leer = kein Filter.
  zeitraumVon: '',
  zeitraumBis: '',
  ausgefiltert: 0,      // wie viele Zeilen der Zeitraum gerade wegnimmt
  // Protokoll der letzten „Erstellen"-Aktion. Bleibt über einen Reload hinweg
  // stehen (siehe zeichne()) — ohne das verschwand eine Fehlermeldung, sobald
  // ladeAbrechnungAuswahl() nach dem Lauf automatisch neu zeichnete: das
  // #abSammelProtokoll-Element wurde mit dem ganzen Container-innerHTML
  // ersetzt, bevor jemand die Meldung lesen konnte (10.09.2026 live gemeldet).
  protokollHtml: '',
};

/** Liegt `datum` im gewählten Zeitraum? Ohne Datum: nur dann drin, wenn gar
 *  kein Zeitraum gesetzt ist — ein Rezept ohne Ausstellungsdatum lässt sich
 *  keinem Lauf zuordnen, und stillschweigend mitzunehmen wäre das Falsche. */
export function imZeitraum(datum, von, bis) {
  if (!von && !bis) return true;
  if (!datum) return false;
  if (von && datum < von) return false;
  if (bis && datum > bis) return false;
  return true;
}

/**
 * @param {object} deps  aus dashboard.js: supabase, apiBase, getOwnerId,
 *   escapeHtml, showToast, aktiverStandort, kassenName, ladePositionen,
 *   positionOptionsHtml, savePosition, checkPlanActive, nachErstellung
 */
export function initAbrechnungAuswahl(deps) {
  ctx = deps;
  initDateieinheit(deps);   // teilt sich den Cache mit der Podologie-Seite
  _wireEinmal();
}

/** Nur für Tests. */
export function _auswahlZustand() { return _st; }

// ─── Laden ──────────────────────────────────────────────────────────────────

/**
 * Lädt beide Töpfe und zeichnet die Auswahlliste.
 *
 * Die zwei Abfragen sind bewusst getrennt geblieben und nicht zu einer
 * verschmolzen: sie brauchen verschiedene Spalten (`prescription_sessions` für
 * die erbrachten Einheiten des Physio-Wegs, `leads!patient_id` für die
 * Patientennummer des Podologie-Wegs) und verschiedene Statusachsen
 * (`abrechnung_status='bereit'` gegen `PODO_ARBEITSLISTE_OR`).
 */
export async function ladeAbrechnungAuswahl() {
  const ownerId = ctx?.getOwnerId?.();
  const ziel = document.getElementById('abAuswahlContent');
  if (!ownerId || !ziel) return;

  ziel.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:12px 0;">Lade…</div>`;

  const [physioRes, podoRes, certsRes] = await Promise.all([
    ctx.supabase.from('prescriptions')
      .select(`
        id, patient_id, kostentraeger_ik, heilmittel, heilmittel_position, anzahl_einheiten,
        zuzahlung_eur, zuzahlung_befreit, ausstellungsdatum, icd10, is_blanko, is_lhb_bvb,
        bericht_angefordert, bericht_status, belegnummer,
        diagnosegruppe, frequenz, leitsymptomatik, arzt_id, doctor_lanr, doctor_bsnr,
        leads:patient_id(first_name,last_name,geburtsdatum,versichertenstatus,krankenkasse,versichertennummer,patientennummer),
        prescription_sessions (
          id, session_number, status, done_at,
          bookings:booking_id ( id, user_id, service_id, services:service_id (id, required_certificate) )
        )
      `)
      .eq('owner_id', ownerId)
      .eq('abrechnung_status', 'bereit')
      // ⚠️ Podologie ausgeschlossen — sie läuft über den podologischen Mapper.
      // `.or()` statt `.neq()`: Altbestand führt `therapie_bereich = NULL`,
      // und `<> 'podo'` liesse NULL-Zeilen in SQL aus dem Ergebnis fallen.
      .or('therapie_bereich.is.null,therapie_bereich.neq.podo')
      .order('ausstellungsdatum', { ascending: true }),

    ctx.supabase.from(TOPF)
      .select(PODO_SELECT)
      .eq('owner_id', ownerId)
      .eq('therapie_bereich', 'podo')
      .or(PODO_ARBEITSLISTE_OR)
      .order('created_at', { ascending: false }),

    ctx.supabase.from('therapist_certificates')
      .select('profile_id, certificate')
      .eq('owner_id', ownerId),
  ]);

  if (physioRes.error) console.error('[abrechnung-auswahl/physio]', physioRes.error);
  if (podoRes.error)   console.error('[abrechnung-auswahl/podo]',   podoRes.error);
  if (certsRes.error)  console.error('[abrechnung-auswahl/certs]',  certsRes.error);

  const certsMap = new Map();
  for (const c of certsRes.data || []) {
    if (!certsMap.has(c.profile_id)) certsMap.set(c.profile_id, new Set());
    certsMap.get(c.profile_id).add(c.certificate);
  }

  await ctx.ladePositionen?.().catch?.(() => {});
  const positionen = ctx.positionen?.() || [];

  _st.rxRoh = new Map();
  const zeilen = [];
  const fehlerhaft = [];
  let ausgefiltert = 0;

  // ── Physio/Ergo/Logo ─────────────────────────────────────────────────────
  for (const rx of physioRes.data || []) {
    if (!imZeitraum(rx.ausstellungsdatum, _st.zeitraumVon, _st.zeitraumBis)) { ausgefiltert++; continue; }
    _st.rxRoh.set(rx.id, rx);
    const pos = _findePhysioPosition(rx.heilmittel_position, positionen);
    const zz = zuzahlungFuerRezept(rx, pos);
    const issues = checkPrescriptionCompliance(rx, certsMap);
    const lead = rx.leads || {};
    const zeile = {
      bereich: 'physio',
      id: rx.id,
      ik: rx.kostentraeger_ik || '__unknown__',
      nummer: rx.belegnummer || (lead.patientennummer != null ? String(lead.patientennummer) : rx.id.slice(0, 8)),
      patient: [lead.first_name, lead.last_name].filter(Boolean).join(' ') || '—',
      mittel: rx.heilmittel || '—',
      positionCode: rx.heilmittel_position || '',
      positionBekannt: !!pos,
      einheiten: zz.einheiten,
      verordnet: zz.verordnet,
      brutto: pos ? zz.brutto : 0,
      zuzahlung: pos ? zz.gesamt : 0,
      befreit: !!rx.zuzahlung_befreit,
      // `!rx.heilmittel_position` und fehlender Patientenbezug sind wie die
      // podologischen Strukturblocker NICHT übersteuerbar — der Server wirft
      // in beiden Fällen unbedingt (mapPrescriptionToDtaShape, abrechnung.routes.js).
      blockiert: istHarterRiegel(issues) || !rx.heilmittel_position || !rx.patient_id || !lead.last_name,
      hinweise: _physioHinweise(issues, rx, lead),
    };
    zeile.soll = kassenanteil(zeile.brutto, zeile.zuzahlung);
    zeilen.push(zeile);
  }

  // ── Podologie ────────────────────────────────────────────────────────────
  const podoRoh = (podoRes.data || []).map(ausTopf);
  const zuschnitt = standortZuschnitt(podoRoh, ctx.aktiverStandort?.());
  const podoAlle = zuschnitt.zeilen.filter(v =>
    v.status === 'abrechenbar' && v.kostentraeger_ik && (v.rezeptart || 'kassen') === 'kassen');
  const podoBereit = podoAlle.filter(v => imZeitraum(v.ausstellungsdatum, _st.zeitraumVon, _st.zeitraumBis));
  ausgefiltert += podoAlle.length - podoBereit.length;

  if (podoBereit.length) {
    const { data: allBeh } = await ctx.supabase
      .from('podologie_behandlungen')
      .select('id, verordnung_id, behandlungsdatum, hpnr_codes')
      .in('verordnung_id', podoBereit.map(v => v.id));
    const behJeVord = {};
    for (const b of allBeh || []) (behJeVord[b.verordnung_id] ||= []).push(b);
    const finde = await podoPositionsFinder(ctx.supabase, allBeh || []);

    for (const v of podoBereit) {
      const behs = behJeVord[v.id] || [];
      const d = zuzahlungFuerPodoVerordnung(v, behs, finde);
      const hpnrs = behs.flatMap(b => (b.hpnr_codes || []).map(c => String(c).trim()));
      _st.rxRoh.set(v.id, v);
      const zeile = {
        bereich: 'podo',
        id: v.id,
        ik: v.kostentraeger_ik,
        nummer: v.verordnungsnummer != null ? String(v.verordnungsnummer) : v.id.slice(0, 8),
        patient: v.patient_name || '—',
        mittel: (d.zeilen || []).map(z => `${z.label || z.code}${z.anzahl > 1 ? ` ×${z.anzahl}` : ''}`).join(', ') || '—',
        positionCode: '',
        positionBekannt: !(d.unbekannt || []).length,
        einheiten: (d.zeilen || []).reduce((a, z) => a + z.anzahl, 0),
        verordnet: Number(v.behandlungseinheiten) || 0,
        brutto: d.brutto,
        zuzahlung: d.gesamt,
        befreit: !!v.zuzahlung_befreit,
        blockiert: false,
        hinweise: [],
        hpnrs,
      };
      zeile.soll = kassenanteil(zeile.brutto, zeile.zuzahlung);

      const gruende = podoSperren(v, hpnrs);
      const strukturGruende = podoStrukturBlocker(v, hpnrs);
      gruende.push(...strukturGruende);
      if (gruende.length) fehlerhaft.push({ bereich: 'podo', zeile, gruende, uebersteuerbar: !strukturGruende.length });
      else zeilen.push(zeile);
    }
  }

  _st.gruppen = baueGruppen(zeilen, (ik) => ctx.kassenName?.(ik) || (ik === '__unknown__' ? '⚠ Kostenträger fehlt' : ik));
  _st.fehlerhaft = fehlerhaft;
  _st.ausgefiltert = ausgefiltert;
  _st.geladen = true;

  // Vorauswahl: alles, was nicht hart gesperrt ist. Der Podologe will in einem
  // Durchgang fertig werden; der Physiotherapeut hakt einzeln ab.
  // ⚠️ `g.ik === '__unknown__'` gilt für BEIDE Granularitäten: bis 10.09.2026
  // fehlte die Ausnahme im 'rezept'-Zweig (Physio/Ergo/Logo) — Zeilen ohne
  // Kostenträger-IK landeten trotzdem in `_st.gewaehlt`. Der Sammel-Knopf
  // ("Ausgewählte erstellen") zählt eine Gruppe als gewählt, sobald irgendeine
  // ihrer Zeilen-Ids im Set steht (auswahlStand()), und hätte dann versucht,
  // eine Abrechnung mit `kostentraegerIk: '__unknown__'` an den Server zu
  // schicken — derselbe Fehlerkanal war für die einzelne Gruppe zwar per
  // `disabled`-Knopf gesperrt, aber nicht für den Sammel-Weg.
  _st.gewaehlt = new Set();
  for (const g of _st.gruppen) {
    if (g.ik === '__unknown__') continue;
    if (g.granularitaet === 'kasse') { _st.gewaehlt.add(g.key); }
    else for (const z of g.zeilen) if (!z.blockiert) _st.gewaehlt.add(z.id);
  }

  zeichne();
  _ladeDateieinheitenNach();
}

function _findePhysioPosition(code, positionen) {
  if (!code) return null;
  const tpl = /^X\d{4}$/.test(code) ? code : (/^\d{5}$/.test(code) ? 'X' + code.slice(1) : null);
  return tpl ? (positionen || []).find(p => p.x === tpl) || null : null;
}

function _physioHinweise(issues, rx, lead = {}) {
  const out = [];
  if (issues.isReportMissing) out.push({ art: 'warn', text: `Therapiebericht ausstehend (${rx.bericht_status || 'offen'}) — Abrechnen ist möglich, die Entscheidung wird protokolliert.` });
  if (issues.missingCert)     out.push({ art: 'stop', text: `Qualifikation fehlt: '${issues.missingCertName}' für die Sitzung am ${issues.missingCertDate}.` });
  if (issues.has14DayGap)     out.push({ art: 'stop', text: `Behandlungsunterbrechung über 14 Tage (${issues.gapDays} Tage, ${issues.gapDates}).` });
  // Server lehnt beide unbedingt ab (mapPrescriptionToDtaShape) — deshalb 'stop', nicht 'warn'.
  if (!rx.heilmittel_position) out.push({ art: 'stop', text: 'Keine Heilmittelposition (X-Code) zugewiesen — der Server lehnt diese Verordnung beim Erstellen ab.' });
  if (!rx.patient_id || !lead.last_name) out.push({ art: 'stop', text: 'Kein Patient aus der Kartei verknüpft — der Name für die Abrechnung wird immer aus der Patientenakte übernommen. Bitte die Verordnung einem Patienten zuordnen.' });
  return out;
}

/** Dateieinheit-Abzeichen nachtragen. Ohne `await` beim Zeichnen: die Liste
 *  muss sofort da sein, die Zusatzinformation darf nachkommen. Der harte
 *  Riegel sitzt im Backend (412). */
function _ladeDateieinheitenNach() {
  const iks = [...new Set(_st.gruppen.map(g => g.ik).filter(ik => ik && ik !== '__unknown__'))];
  if (!iks.length) return;
  ladeDateieinheiten(iks).then(neu => {
    if (!neu) return;
    for (const slot of document.querySelectorAll('#abAuswahlContent .ab-dav-slot')) {
      slot.innerHTML = dateieinheitBadge(slot.dataset.ik, ctx.escapeHtml);
    }
    _leisteAktualisieren();
  });
}

// ─── Zeichnen ───────────────────────────────────────────────────────────────

const esc = (s) => (ctx?.escapeHtml ? ctx.escapeHtml(s) : String(s));

const BEREICH_LABEL = { physio: 'Physio · Ergo · Logo', podo: 'Podologie' };

function zeichne() {
  const ziel = document.getElementById('abAuswahlContent');
  if (!ziel) return;

  if (!_st.gruppen.length && !_st.fehlerhaft.length) {
    ziel.innerHTML = zeitraumHtml() + `<div class="table-empty" style="padding:24px;text-align:center;color:var(--text-muted);">
      ${_st.ausgefiltert
        ? `Keine Verordnung im gewählten Abrechnungszeitraum (${_st.ausgefiltert} ausgeblendet).`
        : 'Keine abrechnungsbereiten Verordnungen.'}
    </div>`;
    _einstiegAktualisieren();
    return;
  }

  const mehrereBereiche = new Set(_st.gruppen.map(g => g.bereich)).size > 1;

  ziel.innerHTML = zeitraumHtml() + `
    <div id="abSammelLeiste" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;
         padding:10px 14px;margin-bottom:12px;border:1px dashed var(--border);border-radius:8px;background:var(--bg-card);">
      <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-main);cursor:pointer;">
        <input type="checkbox" id="abAlle" style="width:16px;height:16px;cursor:pointer;">
        Alle auswählen
      </label>
      <div id="abSammelHinweis" style="flex:1;min-width:220px;font-size:12px;color:var(--text-muted);">Keine Kasse ausgewählt.</div>
      <button id="abSammelBtn" class="btn-primary" disabled style="font-size:13px;padding:6px 14px;white-space:nowrap;opacity:.5;">Ausgewählte erstellen</button>
    </div>
    <div id="abSammelProtokoll" style="display:${_st.protokollHtml ? 'block' : 'none'};font-size:12px;margin-bottom:12px;
         border:1px solid var(--border);border-radius:8px;padding:8px 12px;background:var(--bg-card);">
      ${_st.protokollHtml ? `<div style="display:flex;justify-content:flex-end;margin:-2px -2px 4px 0;">
        <button type="button" id="abProtokollSchliessen" class="btn-ghost" style="font-size:11px;padding:1px 7px;line-height:1.4;">✕</button>
      </div>${_st.protokollHtml}` : ''}
    </div>

    <div style="display:flex;flex-direction:column;gap:10px;">
      ${_st.gruppen.map(g => gruppeHtml(g, mehrereBereiche)).join('')}
    </div>

    ${fehlerhaftHtml()}
    <div id="abAuswahlError" style="color:#ef4444;font-size:13px;margin-top:10px;display:none;"></div>
  `;

  _leisteAktualisieren();
  _einstiegAktualisieren();
}

/** Abrechnungszeitraum — steht auch dann da, wenn er alles wegfiltert. Sonst
 *  sähe der Anwender eine leere Liste ohne Weg zurück. */
function zeitraumHtml() {
  const gesetzt = _st.zeitraumVon || _st.zeitraumBis;
  return `
  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 12px;margin-bottom:12px;
       border:1px solid var(--border);border-radius:8px;background:var(--bg-card);">
    <span style="font-size:12px;color:var(--text-muted);">Abrechnungszeitraum</span>
    <input type="date" id="abZeitraumVon" value="${esc(_st.zeitraumVon || '')}"
      style="padding:5px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:12px;">
    <span style="font-size:12px;color:var(--text-muted);">bis</span>
    <input type="date" id="abZeitraumBis" value="${esc(_st.zeitraumBis || '')}"
      style="padding:5px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:12px;">
    ${gesetzt ? `<button type="button" id="abZeitraumReset" class="btn-ghost" style="font-size:12px;padding:4px 10px;">Zurücksetzen</button>` : ''}
    <span style="font-size:12px;color:var(--text-muted);margin-left:auto;">
      ${_st.ausgefiltert ? `${_st.ausgefiltert} Verordnung${_st.ausgefiltert > 1 ? 'en' : ''} ausserhalb des Zeitraums` : 'Leer = alles zeigen'}
    </span>
  </div>`;
}

function gruppeHtml(g, zeigeBereich) {
  const offen = _st.offen.has(g.key);
  const unbekannt = g.ik === '__unknown__';
  const gewaehlt = g.granularitaet === 'kasse'
    ? _st.gewaehlt.has(g.key)
    : g.zeilen.some(z => _st.gewaehlt.has(z.id));

  return `
  <div class="ab-gruppe" data-key="${esc(g.key)}" style="background:var(--bg-card-solid,#1f2937);border-radius:8px;border:1px solid var(--border);overflow:hidden;">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;gap:8px;">
      <input type="checkbox" class="ab-gruppe-check" data-key="${esc(g.key)}" ${gewaehlt ? 'checked' : ''} ${unbekannt ? 'disabled' : ''}
        aria-label="${esc(g.name)} für die Abrechnung auswählen"
        style="width:16px;height:16px;flex:0 0 auto;cursor:pointer;${unbekannt ? 'opacity:.4;' : ''}">
      <div class="ab-gruppe-header" data-key="${esc(g.key)}" style="cursor:pointer;flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;color:var(--text-main);">
          <span class="ab-chevron" style="display:inline-block;transition:transform .15s;margin-right:4px;${offen ? 'transform:rotate(90deg);' : ''}">▸</span>
          ${esc(g.name)}
          ${zeigeBereich ? `<span style="font-size:11px;font-weight:500;color:var(--text-muted);border:1px solid var(--border);border-radius:4px;padding:1px 5px;margin-left:6px;">${esc(BEREICH_LABEL[g.bereich] || g.bereich)}</span>` : ''}
          <span class="ab-dav-slot" data-ik="${esc(g.ik)}">${unbekannt ? '' : dateieinheitBadge(g.ik, esc)}</span>
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-left:14px;">
          ${g.zeilen.length} Verordnung${g.zeilen.length > 1 ? 'en' : ''} · Kassenanteil ${esc(fmtEur(g.soll))}
          <span style="opacity:.75;">(Brutto ${esc(fmtEur(g.brutto))} − Zuzahlung ${esc(fmtEur(g.zuzahlung))})</span>
        </div>
      </div>
      <button class="ab-erstellen-btn btn-primary" data-key="${esc(g.key)}" ${unbekannt ? 'disabled' : ''}
        style="font-size:13px;padding:6px 14px;white-space:nowrap;${unbekannt ? 'opacity:.5;' : ''}">Erstellen</button>
    </div>
    <div class="ab-gruppe-detail" data-key="${esc(g.key)}" ${offen ? '' : 'hidden'}
         style="border-top:1px solid var(--border);padding:10px 12px;overflow-x:auto;">
      ${unbekannt ? kostentraegerFehltHtml(g) : detailTabelleHtml(g)}
    </div>
  </div>`;
}

function kostentraegerFehltHtml(g) {
  return `<div style="font-size:12px;color:#b45309;">
    ${g.zeilen.length} Verordnung${g.zeilen.length > 1 ? 'en' : ''} ohne Kostenträger-IK. Ohne IK gibt es keine
    Datenannahmestelle und keine Datei — die Krankenkasse muss zuerst in der Patientenakte hinterlegt werden.
    <ul style="margin:6px 0 0;padding-left:18px;">
      ${g.zeilen.map(z => `<li>${esc(z.patient)} · ${esc(z.mittel)}</li>`).join('')}
    </ul>
  </div>`;
}

function detailTabelleHtml(g) {
  const jeRezept = g.granularitaet === 'rezept';
  const positionen = ctx.positionen?.() || [];
  const kannPicker = jeRezept && positionen.length > 0;

  return `
  <table style="width:100%;border-collapse:collapse;font-size:12px;">
    <thead>
      <tr style="color:var(--text-muted);text-align:left;">
        ${jeRezept ? '<th style="padding:4px 6px;width:28px;"></th>' : ''}
        <th style="padding:4px 6px;font-weight:600;">Beleg</th>
        <th style="padding:4px 6px;font-weight:600;">Patient</th>
        <th style="padding:4px 6px;font-weight:600;">Mittel</th>
        <th style="padding:4px 6px;font-weight:600;">Einheiten</th>
        <th style="padding:4px 6px;font-weight:600;text-align:right;">Zuzahlung</th>
        <th style="padding:4px 6px;font-weight:600;text-align:right;">Kassenanteil</th>
      </tr>
    </thead>
    <tbody>
      ${g.zeilen.map(z => {
        const an = jeRezept ? _st.gewaehlt.has(z.id) : _st.gewaehlt.has(g.key);
        const einheiten = z.verordnet && z.einheiten !== z.verordnet
          ? `<span title="erbracht / verordnet">${z.einheiten} / ${z.verordnet}</span>`
          : String(z.einheiten || z.verordnet || 0);
        const zuText = z.befreit
          ? '<span style="color:#15803d;font-weight:600;">befreit</span>'
          : (z.positionBekannt ? esc(fmtEur(z.zuzahlung)) : '<span style="color:#b45309;" title="Position fehlt">— Position?</span>');
        const picker = (kannPicker && !z.blockiert)
          ? `<select class="ab-pos-select" data-id="${esc(z.id)}" data-prev="${esc(z.positionCode)}"
               style="margin-top:4px;font-size:12px;max-width:280px;width:100%;">${ctx.positionOptionsHtml(z.positionCode)}</select>`
          : '';
        const spalten = jeRezept ? 7 : 6;
        return `<tr style="border-top:1px solid var(--border);${z.blockiert ? 'opacity:.55;' : ''}">
          ${jeRezept ? `<td style="padding:4px 6px;"><input type="checkbox" class="ab-zeile-check" data-key="${esc(g.key)}" data-id="${esc(z.id)}"
              ${an ? 'checked' : ''} ${z.blockiert ? 'disabled title="Harter Riegel — siehe Hinweis"' : ''}></td>` : ''}
          <td style="padding:4px 6px;color:var(--text-muted);">${esc(z.nummer)}</td>
          <td style="padding:4px 6px;color:var(--text-main);">
            <span class="ab-zeile-oeffnen" data-id="${esc(z.id)}" title="Alle abrechnungsrelevanten Felder ansehen"
              style="cursor:pointer;text-decoration:underline dotted;text-underline-offset:2px;">${esc(z.patient)}</span>${hinweiseHtml(z)}</td>
          <td style="padding:4px 6px;color:var(--text-muted);">${esc(z.mittel)}${picker}</td>
          <td style="padding:4px 6px;color:var(--text-muted);">${einheiten}</td>
          <td style="padding:4px 6px;text-align:right;color:var(--text-muted);">${zuText}</td>
          <td style="padding:4px 6px;text-align:right;color:var(--text-main);">${esc(fmtEur(z.soll))}</td>
        </tr>
        <tr class="ab-zeile-detail-row" data-id="${esc(z.id)}" ${_st.offenZeile.has(z.id) ? '' : 'hidden'}>
          <td colspan="${spalten}" style="padding:8px 10px;background:var(--bg-card);border-top:1px dashed var(--border);">
            ${zeileDetailHtml(z)}
          </td>
        </tr>`;
      }).join('')}
    </tbody>
    <tfoot>
      <tr style="border-top:2px solid var(--border);font-weight:600;">
        <td colspan="${jeRezept ? 5 : 4}" style="padding:6px;color:var(--text-main);">Summe</td>
        <td style="padding:6px;text-align:right;color:var(--text-main);">${esc(fmtEur(g.zuzahlung))}</td>
        <td style="padding:6px;text-align:right;color:var(--text-main);">${esc(fmtEur(g.soll))}</td>
      </tr>
    </tfoot>
  </table>`;
}

/**
 * Der Feldercheck einer einzelnen Verordnung — alles, was `create` /
 * `create-podologie` tatsächlich in die DTA-Datei schreibt (Kostenträger-IK,
 * Versichertennummer, Diagnosegruppe, ICD-10, Leitsymptomatik, Frequenz,
 * Positionsnummer/HPNR, LANR/BSNR), aus bereits geladenen Daten (`_st.rxRoh`)
 * — kein zweiter Request. Ops-Wunsch 10.09.2026: ein letzter Blick auf die
 * abrechnungsrelevanten Felder, bevor „Erstellen" gedrückt wird.
 */
function zeileDetailHtml(z) {
  const roh = _st.rxRoh.get(z.id);
  if (!roh) return `<div style="font-size:12px;color:var(--text-muted);">Keine weiteren Daten geladen.</div>`;
  const lead = roh.leads || {};
  const istPodo = z.bereich === 'podo';
  const feld = (label, wert) => {
    const leer = wert === null || wert === undefined || wert === '';
    return `<div>
      <div style="font-size:10px;color:var(--text-muted);margin-bottom:1px;">${esc(label)}</div>
      <div style="font-size:12px;color:${leer ? 'var(--text-muted)' : 'var(--text-main)'};">${esc(leer ? '—' : String(wert))}</div>
    </div>`;
  };
  const icd10 = istPodo ? (Array.isArray(roh.icd10) ? roh.icd10 : []).join(', ')
                        : [roh.icd10, roh.icd10_2].filter(Boolean).join(', ');
  const frequenz = istPodo ? roh.therapiefrequenz : roh.frequenz;
  const felder = [
    feld('Kostenträger-IK', roh.kostentraeger_ik),
    feld('Versichertennummer', roh.versichertennummer || lead.versichertennummer),
    feld('Versichertenstatus', lead.versichertenstatus),
    feld('Geburtsdatum', lead.geburtsdatum),
    feld('Ausstellungsdatum', roh.ausstellungsdatum),
    feld('Diagnosegruppe', roh.diagnosegruppe),
    feld('ICD-10', icd10),
    feld('Leitsymptomatik', roh.leitsymptomatik || roh.pat_leitsymptomatik),
    feld('Frequenz', frequenz),
    istPodo ? feld('HPNR (dokumentiert)', (z.hpnrs || []).join(', ')) : feld('Heilmittelposition', roh.heilmittel_position),
    feld('LANR', roh.doctor_lanr),
    feld('BSNR', roh.doctor_bsnr),
    feld('Zuzahlung befreit', roh.zuzahlung_befreit ? 'ja' : 'nein'),
  ];
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px 14px;">${felder.join('')}</div>`;
}

function hinweiseHtml(z) {
  if (!z.hinweise?.length) return '';
  return z.hinweise.map(h => `<div style="margin-top:3px;font-size:11px;color:${h.art === 'stop' ? '#ef4444' : '#b45309'};">
    ${h.art === 'stop' ? '⛔' : '⚠'} ${esc(h.text)}</div>`).join('');
}

function fehlerhaftHtml() {
  if (!_st.fehlerhaft.length) return '';
  return `<div class="card" style="background:var(--bg-card);border:1px solid #ef4444;border-radius:10px;padding:18px;margin-top:14px;">
    <h4 style="margin:0 0 6px;color:#ef4444;font-size:15px;">Fehlerhafte Rezepte</h4>
    <p style="margin:0 0 12px;font-size:12px;color:var(--text-muted);">
      Diese Verordnungen würden vom Server abgewiesen. Sie stehen getrennt, statt zu fehlen — sonst bemerkt niemand,
      dass sie nicht in der Datei sind. „Trotzdem übernehmen" reicht eine EINZELNE Verordnung mit Begründung ein
      (GoBD-protokolliert).
    </p>
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${_st.fehlerhaft.map(({ zeile, gruende, uebersteuerbar = true }) => `
        <div class="ab-fehler-row" data-id="${esc(zeile.id)}" data-ik="${esc(zeile.ik)}"
          style="padding:10px 12px;background:var(--bg-card-solid,#1f2937);border-radius:8px;border:1px solid var(--border);">
          <div style="font-size:13px;font-weight:600;color:var(--text-main);">
            ${esc(zeile.patient)}
            <span style="font-weight:400;color:var(--text-muted);">· Beleg ${esc(zeile.nummer)} · ${esc(fmtEur(zeile.soll))}</span>
          </div>
          <ul style="margin:6px 0 8px;padding-left:18px;font-size:12px;color:var(--text-muted);">
            ${gruende.map(gr => `<li>${esc(gr)}</li>`).join('')}
          </ul>
          ${uebersteuerbar ? `
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="text" class="ab-fehler-grund" placeholder="Begründung für die Übersteuerung (Pflicht, GoBD-Protokoll)"
              style="flex:1;padding:6px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-main);font-size:12px;">
            <button class="ab-fehler-btn btn-ghost" data-id="${esc(zeile.id)}" data-ik="${esc(zeile.ik)}"
              style="font-size:12px;padding:6px 12px;white-space:nowrap;border:1px solid #ef4444;color:#ef4444;">Trotzdem übernehmen</button>
          </div>` : `
          <div style="font-size:12px;color:var(--text-muted);">
            Nicht übersteuerbar — der Server lehnt eine Verordnung ohne dokumentierte Behandlung immer ab.
          </div>`}
        </div>`).join('')}
    </div>
  </div>`;
}

/** Die zwei Zahlen auf dem Einstiegsbildschirm. */
function _einstiegAktualisieren() {
  const el = document.getElementById('abEinstiegNeuInfo');
  if (!el) return;
  const zeilen = _st.gruppen.reduce((a, g) => a + g.zeilen.length, 0);
  const soll = _st.gruppen.reduce((a, g) => a + g.soll, 0);
  el.textContent = zeilen
    ? `${zeilen} Verordnung${zeilen > 1 ? 'en' : ''} bereit · ${fmtEur(soll)}`
    : 'Keine abrechnungsbereiten Verordnungen';
}

function _leisteAktualisieren() {
  const stand = auswahlStand(_st.gruppen, _st.gewaehlt);
  const hinweis = document.getElementById('abSammelHinweis');
  const btn = document.getElementById('abSammelBtn');
  const alle = document.getElementById('abAlle');

  if (hinweis) {
    hinweis.textContent = stand.gruppen
      ? `${auswahlHinweis(stand.iks)} · ${stand.zeilen} Verordnung${stand.zeilen > 1 ? 'en' : ''} · ${fmtEur(stand.soll)}`
      : 'Keine Kasse ausgewählt.';
  }
  if (btn) {
    btn.disabled = stand.gruppen === 0 || _st.busy;
    btn.style.opacity = btn.disabled ? '.5' : '1';
    btn.textContent = stand.gruppen > 1 ? `${stand.gruppen} Abrechnungen erstellen` : 'Ausgewählte erstellen';
  }
  if (alle) {
    const auswaehlbar = _st.gruppen.filter(g => g.ik !== '__unknown__');
    alle.checked = auswaehlbar.length > 0 && stand.gruppen === auswaehlbar.length;
    alle.indeterminate = stand.gruppen > 0 && stand.gruppen < auswaehlbar.length;
  }

  // Gruppen-Häkchen mit den Zeilen-Häkchen gleichziehen (Physio: Dreizustand).
  for (const g of _st.gruppen) {
    const cb = document.querySelector(`#abAuswahlContent .ab-gruppe-check[data-key="${CSS.escape(g.key)}"]`);
    if (!cb) continue;
    if (g.granularitaet === 'kasse') { cb.checked = _st.gewaehlt.has(g.key); continue; }
    const wahl = g.zeilen.filter(z => _st.gewaehlt.has(z.id)).length;
    cb.checked = wahl > 0;
    cb.indeterminate = wahl > 0 && wahl < g.zeilen.filter(z => !z.blockiert).length;
  }
}

// ─── Ereignisse ─────────────────────────────────────────────────────────────

let _wired = false;

/**
 * Alle Zuhörer EINMAL auf Modulebene, delegiert über `document`.
 *
 * Warum nicht am Container: `#abAuswahlContent` steht statisch in
 * `dashboard.html`, `zeichne()` tauscht nur sein `innerHTML`. Ein Zuhörer am
 * Container hätte sich bei jedem Neuzeichnen ein weiteres Mal angehängt —
 * genau der Fehler, der am 28.08.2026 in `podologie-abrechnung.js` dazu führte,
 * dass ein Klick auf „§302 erstellen" N Anfragen auslöste und N Dateien erzeugte.
 */
function _wireEinmal() {
  if (_wired) return;
  _wired = true;

  document.addEventListener('click', (e) => {
    if (!e.target.closest?.('#abAuswahlContent')) return;

    const header = e.target.closest('.ab-gruppe-header');
    if (header) {
      const key = header.dataset.key;
      const detail = document.querySelector(`#abAuswahlContent .ab-gruppe-detail[data-key="${CSS.escape(key)}"]`);
      if (!detail) return;
      detail.hidden = !detail.hidden;
      if (detail.hidden) _st.offen.delete(key); else _st.offen.add(key);
      const chev = header.querySelector('.ab-chevron');
      if (chev) chev.style.transform = detail.hidden ? '' : 'rotate(90deg)';
      return;
    }

    const zOeffnen = e.target.closest('.ab-zeile-oeffnen');
    if (zOeffnen) {
      const id = zOeffnen.dataset.id;
      const row = document.querySelector(`#abAuswahlContent .ab-zeile-detail-row[data-id="${CSS.escape(id)}"]`);
      if (!row) return;
      row.hidden = !row.hidden;
      if (row.hidden) _st.offenZeile.delete(id); else _st.offenZeile.add(id);
      return;
    }

    const einzeln = e.target.closest('.ab-erstellen-btn');
    if (einzeln && !einzeln.disabled) { _erstelleGruppen([einzeln.dataset.key], einzeln); return; }

    const sammel = e.target.closest('#abSammelBtn');
    if (sammel && !sammel.disabled) {
      const stand = auswahlStand(_st.gruppen, _st.gewaehlt);
      if (!stand.gruppen) return;
      const keys = _st.gruppen
        .filter(g => g.granularitaet === 'kasse' ? _st.gewaehlt.has(g.key) : g.zeilen.some(z => _st.gewaehlt.has(z.id)))
        .map(g => g.key);
      _erstelleGruppen(keys, sammel);
      return;
    }

    const fehler = e.target.closest('.ab-fehler-btn');
    if (fehler && !fehler.disabled) { _uebersteuere(fehler); return; }

    if (e.target.closest('#abProtokollSchliessen')) {
      _st.protokollHtml = '';
      const p = document.getElementById('abSammelProtokoll');
      if (p) { p.style.display = 'none'; p.innerHTML = ''; }
      return;
    }

    if (e.target.closest('#abZeitraumReset')) {
      _st.zeitraumVon = ''; _st.zeitraumBis = '';
      ladeAbrechnungAuswahl();
      return;
    }
  });

  document.addEventListener('change', (e) => {
    if (!e.target.closest?.('#abAuswahlContent')) return;

    if (e.target.id === 'abZeitraumVon' || e.target.id === 'abZeitraumBis') {
      if (e.target.id === 'abZeitraumVon') _st.zeitraumVon = e.target.value || '';
      else _st.zeitraumBis = e.target.value || '';
      ladeAbrechnungAuswahl();
      return;
    }

    if (e.target.id === 'abAlle') {
      const an = e.target.checked;
      _st.gewaehlt = new Set();
      if (an) for (const g of _st.gruppen) {
        if (g.ik === '__unknown__') continue;
        if (g.granularitaet === 'kasse') _st.gewaehlt.add(g.key);
        else for (const z of g.zeilen) if (!z.blockiert) _st.gewaehlt.add(z.id);
      }
      zeichne();
      return;
    }

    if (e.target.classList?.contains('ab-gruppe-check')) {
      const g = _st.gruppen.find(x => x.key === e.target.dataset.key);
      if (!g) return;
      const an = e.target.checked;
      if (g.granularitaet === 'kasse') {
        if (an) _st.gewaehlt.add(g.key); else _st.gewaehlt.delete(g.key);
      } else {
        for (const z of g.zeilen) {
          if (an && !z.blockiert) _st.gewaehlt.add(z.id); else _st.gewaehlt.delete(z.id);
        }
        for (const cb of document.querySelectorAll(`#abAuswahlContent .ab-zeile-check[data-key="${CSS.escape(g.key)}"]`)) {
          if (!cb.disabled) cb.checked = an;
        }
      }
      _leisteAktualisieren();
      return;
    }

    if (e.target.classList?.contains('ab-zeile-check')) {
      const id = e.target.dataset.id;
      if (e.target.checked) _st.gewaehlt.add(id); else _st.gewaehlt.delete(id);
      _leisteAktualisieren();
      return;
    }

    if (e.target.classList?.contains('ab-pos-select')) {
      const sel = e.target;
      const neu = sel.value;
      if (!neu) { sel.value = sel.dataset.prev || ''; return; }
      // Speichern und danach NEU laden: der Preis der Zeile, die Zuzahlung und
      // damit die Kassenanteil-Summe der ganzen Gruppe hängen daran.
      Promise.resolve(ctx.savePosition?.(sel.dataset.id, neu, sel))
        .then(() => ladeAbrechnungAuswahl())
        .catch(err => console.error('[abrechnung-auswahl/position]', err));
    }
  });
}

// ─── Erstellen ──────────────────────────────────────────────────────────────

function _fehlerZeigen(text) {
  const el = document.getElementById('abAuswahlError');
  if (!el) return;
  el.textContent = text;
  el.style.display = text ? 'block' : 'none';
}

/**
 * Erzeugt je gewählter Gruppe EINE Abrechnung — nacheinander, nicht parallel.
 *
 * Jede Anfrage erzeugt eine `abrechnung`-Zeile mit eigener laufender
 * Datennummer, die aus dem Zähler der schon vorhandenen Zeilen abgeleitet wird
 * (`abrechnung.routes.js`). Parallel gestartet läsen mehrere Anfragen denselben
 * Zähler und vergäben dieselbe Nummer — zwei Dateien mit gleichem Namen, und
 * die Kasse ordnet nichts mehr zu.
 */
async function _erstelleGruppen(keys, knopf) {
  if (_st.busy) return;
  if (ctx.checkPlanActive && !ctx.checkPlanActive()) return;

  const gruppen = keys.map(k => _st.gruppen.find(g => g.key === k)).filter(Boolean);
  if (!gruppen.length) return;

  // Physio: fehlender Therapiebericht hält die Abrechnung nicht auf, verlangt
  // aber eine bewusste, protokollierte Entscheidung. Einmal für alle Gruppen
  // fragen, nicht je Kasse — sonst klickt der Anwender denselben Dialog fünfmal.
  const offeneBerichte = [];
  for (const g of gruppen) {
    if (g.granularitaet !== 'rezept') continue;
    for (const z of g.zeilen) {
      if (!_st.gewaehlt.has(z.id)) continue;
      const rx = _st.rxRoh.get(z.id);
      if (rx && istBerichtOffen(rx)) {
        offeneBerichte.push({ id: rx.id, name: z.patient, status: rx.bericht_status });
      }
    }
  }
  const freigabe = await frageBerichtFreigabe(offeneBerichte);
  if (!freigabe) return;

  _st.busy = true;
  _fehlerZeigen('');
  const altText = knopf?.textContent;
  if (knopf) { knopf.disabled = true; knopf.style.opacity = '.5'; knopf.textContent = 'Wird erstellt…'; }

  const protokoll = document.getElementById('abSammelProtokoll');
  const zeilen = [];
  // `_st.protokollHtml` wird mitgeschrieben, damit die Meldung ein
  // automatisches Neuzeichnen (ladeAbrechnungAuswahl() unten) übersteht —
  // sonst ersetzt zeichne() das ganze #abAuswahlContent-innerHTML und die
  // Fehlermeldung ist weg, bevor jemand sie lesen konnte.
  const schreibe = () => {
    _st.protokollHtml = zeilen.join('');
    if (protokoll) { protokoll.style.display = 'block'; protokoll.innerHTML = _st.protokollHtml; }
  };

  let ok = 0, fehler = 0;
  for (let i = 0; i < gruppen.length; i++) {
    const g = gruppen[i];
    zeilen.push(`<div style="padding:2px 0;color:var(--text-muted);">⏳ ${esc(g.name)} … (${i + 1}/${gruppen.length})</div>`);
    schreibe();
    try {
      const json = await _sendeGruppe(g, freigabe);
      ok++;
      zeilen[zeilen.length - 1] = `<div style="padding:2px 0;color:#16a34a;">✓ ${esc(g.name)} — ${esc(json.sammelRechnungsnummer || json.rechnungsnummer || '')}
        · ${esc(String(json.prescriptionCount ?? json.sessionCount ?? ''))} Positionen</div>`;
    } catch (err) {
      fehler++;
      zeilen[zeilen.length - 1] = `<div style="padding:2px 0;color:#ef4444;">✕ ${esc(g.name)} — ${esc(err.message || 'Fehler')}</div>`;
    }
    schreibe();
  }

  zeilen.push(`<div style="padding:6px 0 0;border-top:1px solid var(--border);margin-top:6px;color:var(--text-main);">
    <strong>${ok} von ${gruppen.length} Abrechnung${gruppen.length > 1 ? 'en' : ''} erstellt${fehler ? `, ${fehler} fehlgeschlagen` : ''}.</strong>
    ${ok ? ' Jede Datei hat einen eigenen Begleitzettel — bitte getrennt versenden. Herunterladen und signieren unter „Bisherige Abrechnungen".' : ''}</div>`);
  schreibe();

  if (ok) ctx.showToast?.(`${ok} §302-Abrechnung${ok > 1 ? 'en' : ''} erstellt ✓`);
  if (knopf) { knopf.disabled = false; knopf.style.opacity = '1'; if (altText) knopf.textContent = altText; }
  _st.busy = false;

  // Ohne einen einzigen Erfolg hat sich am Datenbestand nichts geändert — ein
  // Reload wäre nur eine Gelegenheit, das gerade geschriebene Protokoll zu
  // überschreiben, bevor es gelesen wurde. Bei mindestens einem Erfolg bleibt
  // die Meldung dank `_st.protokollHtml` (siehe schreibe() oben) trotzdem stehen.
  if (ok > 0) {
    await ctx.nachErstellung?.();
    await ladeAbrechnungAuswahl();
  }
}

async function _sendeGruppe(g, freigabe) {
  const { data: { session } } = await ctx.supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Nicht angemeldet');

  const ids = g.granularitaet === 'kasse'
    ? g.zeilen.map(z => z.id)
    : g.zeilen.filter(z => _st.gewaehlt.has(z.id)).map(z => z.id);
  if (!ids.length) throw new Error('Keine Verordnung ausgewählt.');

  const url = g.bereich === 'podo'
    ? `${ctx.apiBase}/billing/abrechnung/create-podologie`
    : `${ctx.apiBase}/billing/abrechnung/create`;

  const body = g.bereich === 'podo'
    ? { kostentraegerIk: g.ik, verordnungIds: ids }
    : {
        ownerId: ctx.getOwnerId(),
        kostentraegerIk: g.ik,
        prescriptionIds: ids,
        berichtIgnoriert: freigabe?.ids || [],
        berichtGrund: freigabe?.grund || '',
      };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

/** „Trotzdem übernehmen" — eine EINZELNE gesperrte Verordnung mit Begründung. */
async function _uebersteuere(btn) {
  const row = btn.closest('.ab-fehler-row');
  const grund = row?.querySelector('.ab-fehler-grund')?.value.trim() || '';
  if (!grund) {
    _fehlerZeigen('Bitte eine Begründung eingeben — sie wird im GoBD-Protokoll gespeichert.');
    return;
  }
  _fehlerZeigen('');
  btn.disabled = true;
  btn.textContent = 'Wird übernommen…';
  try {
    const { data: { session } } = await ctx.supabase.auth.getSession();
    const res = await fetch(`${ctx.apiBase}/billing/abrechnung/create-podologie`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({
        kostentraegerIk: btn.dataset.ik,
        verordnungIds: [btn.dataset.id],
        sperrenIgnoriert: [btn.dataset.id],
        sperrenGrund: grund,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    ctx.showToast?.(`§302 DTA erstellt (übersteuert): ${json.rechnungsnummer || ''} ✓`);
    await ctx.nachErstellung?.();
    await ladeAbrechnungAuswahl();
  } catch (err) {
    _fehlerZeigen(err.message || 'Fehler beim Übernehmen.');
    btn.disabled = false;
    btn.textContent = 'Trotzdem übernehmen';
  }
}
