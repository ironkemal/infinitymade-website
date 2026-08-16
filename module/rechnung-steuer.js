/**
 * rechnung-steuer.js — Umsatzsteuer auf der Patientenrechnung.
 *
 * Warum es dieses Modul gibt
 * ──────────────────────────
 * Bis zum 16.08.2026 kannte `invoices` keine einzige Steuerangabe. Das ging,
 * solange nur GKV-Zuzahlungen abgerechnet wurden — dort stellt sich die Frage
 * nicht. Mit Privat- und Selbstzahlerrechnungen stellt sie sich bei jeder
 * einzelnen Zeile.
 *
 * Die zwei Fragen, die nicht dieselbe sind
 * ────────────────────────────────────────
 *   `invoice_type`  → WER ZAHLT   (gkv | privat | selbstzahler)
 *   `ust_satz`      → WIE BESTEUERT (0 mit Befreiungsgrund | 19)
 *
 * Sie sind orthogonal (legal-de, 16.08.2026): eine kosmetische Fusspflege für
 * einen PKV-Patienten ist mit 19 % zu versteuern, eine medizinisch indizierte
 * Behandlung für einen Selbstzahler ist nach § 4 Nr. 14 a UStG steuerfrei.
 * Wer beides auf eine Spalte legt, produziert in beiden Richtungen Fehler.
 *
 * Massgeblich ist also nicht der Zahler, sondern das **therapeutische Ziel**
 * (BFH zur medizinischen Fusspflege). Deshalb fragt die Oberfläche nicht
 * „Selbstzahler?", sondern „medizinisch oder kosmetisch?" — eine Unterscheidung,
 * die der Podologe ohnehin täglich trifft (`podoloji`, 16.08.2026).
 *
 * Der Konsey-Vorbehalt bleibt gewahrt: die Software nimmt die Befreiung **nie
 * von selbst an**. Es gibt eine Vorauswahl, sie ist sichtbar, und sie wird mit
 * der Rechnung eingefroren (Konsey 2026-08-10, blinder Fleck 3).
 *
 * Preis-Semantik
 * ──────────────
 * `unit_price` ist **brutto** — der Preis, den der Podologe nennt und den der
 * Patient zahlt. Netto und Steuer werden daraus abgeleitet, nicht umgekehrt.
 * Bei steuerfreien Zeilen fallen beide zusammen, weshalb alle Altrechnungen
 * unverändert richtig bleiben.
 *
 * Gerundet wird **je Steuersatz-Gruppe**, nicht je Zeile (legal-de): zeilenweise
 * Rundung summiert sich zu Cent-Abweichungen, die in einer Prüfung erklärt
 * werden müssen.
 */

// ── Steuerstatus der Praxis (Einstellungen) ─────────────────────────────────

/** Wortlaute, die als Steuerhinweis auf die Rechnung gedruckt werden. */
export const TAX_EXEMPT_OPTIONS = {
  '§4nr14a': 'Gemäß § 4 Nr. 14a UStG sind diese Leistungen von der Umsatzsteuer befreit.',
  '§4nr14b': 'Gemäß § 4 Nr. 14b UStG sind diese Leistungen von der Umsatzsteuer befreit.',
  '§19':     'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmer).',
  '19pct':   '',
};

export const TAX_EXEMPT_HINTS = {
  '§4nr14a': 'Für Physio-, Logo-, Ergo- und Podologiepraxen — heilkundliche Leistungen.',
  '§4nr14b': 'Für Kliniken und stationäre Einrichtungen.',
  '§19':     'Gilt, wenn Jahresumsatz unter 22.000 € (Vorjahr) liegt.',
  '19pct':   'Auf der Rechnung erscheint kein Steuerhinweis.',
  'custom':  'Freitext — genau so auf der Rechnung gedruckt.',
};

/** Steuersätze und Befreiungsgründe für die Zeilen. */
export const USt_REGELSATZ = 19;
export const BEFREIUNG_HEILBEHANDLUNG = '4_14a';

// ── Steuerstatus der Praxis ermitteln ───────────────────────────────────────

/**
 * Ist die Praxis Kleinunternehmer?
 *
 * § 19 schlägt auf der Rechnung alles andere: es wird kein Steuersatz und kein
 * Steuerbetrag ausgewiesen, nur der eine Hinweis (§ 34a UStDV). Ein zusätzlicher
 * § 4-Nr.-14a-Hinweis daneben wäre nicht falsch, aber verwirrend — deshalb
 * genau einer.
 *
 * Achtung, das gilt nur für den Ausdruck: buchhalterisch bleibt die
 * medizinisch/kosmetisch-Unterscheidung auch beim Kleinunternehmer relevant,
 * weil § 19 Abs. 2 UStG den steuerfreien Heilbehandlungsumsatz aus dem
 * Gesamtumsatz herausrechnet. Deshalb wird `ust_grund` auch dann pro Zeile
 * gespeichert, wenn er nicht gedruckt wird.
 */
export function istKleinunternehmer(profile) {
  const note = (profile?.tax_exempt_note || '').trim();
  return note === TAX_EXEMPT_OPTIONS['§19'];
}

export function steuerStatusVon(profile) {
  return istKleinunternehmer(profile) ? 'kleinunternehmer' : 'regel';
}

// ── Vorauswahl: medizinisch oder kosmetisch ─────────────────────────────────

/**
 * Schlägt die Leistungsart aus dem klinischen Kontext vor.
 *
 * Nicht aus dem Zahler: ein Selbstzahler mit Diabetes-Diagnose erhält eine
 * Heilbehandlung, ein PKV-Patient kann Nagellack dazukaufen. Gibt es
 * irgendeinen medizinischen Anker — eine Verordnung, eine Diagnosegruppe, einen
 * ICD, einen Wagner-Grad — lautet der Vorschlag „medizinisch"; sonst
 * „kosmetisch" mit 19 %.
 *
 * Das ist ein Vorschlag, kein Automatismus: die Auswahl steht sichtbar auf dem
 * Rechnungsformular und wird mitgespeichert.
 *
 * @returns {'medizinisch'|'kosmetisch'}
 */
export function leistungsartVorschlag({ verordnung, behandlung } = {}) {
  const v = verordnung || {};
  const b = behandlung || {};
  const hatAnker =
    !!v.id ||
    !!v.diagnosegruppe ||
    (Array.isArray(v.icd10) ? v.icd10.length > 0 : !!v.icd10) ||
    !!b.diagnosegruppe ||
    (Array.isArray(b.hpnr_codes) ? b.hpnr_codes.length > 0 : false) ||
    b.wagner_grad != null;
  return hatAnker ? 'medizinisch' : 'kosmetisch';
}

/** Steuerangaben einer Zeile aus der Leistungsart. */
export function zeilenSteuerVon(art) {
  return art === 'kosmetisch'
    ? { ust_satz: USt_REGELSATZ, ust_grund: null }
    : { ust_satz: 0, ust_grund: BEFREIUNG_HEILBEHANDLUNG };
}

// ── Berechnung ──────────────────────────────────────────────────────────────

function runde(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Rechnet die Zeilen zu einer Steueraufschlüsselung zusammen.
 *
 * § 14 Abs. 4 Nr. 7 UStG verlangt das „nach Steuersätzen und einzelnen
 * Steuerbefreiungen aufgeschlüsselte Entgelt" — also je Gruppe eine eigene
 * Summenzeile, nicht nur einen Gesamtbetrag.
 *
 * Beim Kleinunternehmer entfällt die Aufschlüsselung: es gibt keinen
 * ausgewiesenen Steuerbetrag. Die Summe ist dann schlicht der Bruttobetrag.
 *
 * @param {Array}  lines  [{quantity, unit_price(brutto), ust_satz, ust_grund}]
 * @param {string} steuerStatus  'regel' | 'kleinunternehmer'
 * @returns {{tax_summary:Array, netto:number, steuer:number, brutto:number}}
 */
export function berechneSteuer(lines, steuerStatus = 'regel') {
  const zeilen = Array.isArray(lines) ? lines : [];
  const bruttoGesamt = runde(
    zeilen.reduce((s, l) => s + (Number(l.quantity) || 1) * (Number(l.unit_price) || 0), 0)
  );

  if (steuerStatus === 'kleinunternehmer') {
    return {
      tax_summary: [{ satz: 0, grund: '19_kleinunternehmer', netto: bruttoGesamt, steuer: 0, brutto: bruttoGesamt }],
      netto: bruttoGesamt,
      steuer: 0,
      brutto: bruttoGesamt,
    };
  }

  // Gruppieren: gleicher Satz + gleicher Befreiungsgrund = eine Summenzeile.
  const gruppen = new Map();
  for (const l of zeilen) {
    const satz  = Number(l.ust_satz) || 0;
    const grund = satz === 0 ? (l.ust_grund || BEFREIUNG_HEILBEHANDLUNG) : null;
    const key = `${satz}::${grund || ''}`;
    const brutto = (Number(l.quantity) || 1) * (Number(l.unit_price) || 0);
    const g = gruppen.get(key) || { satz, grund, brutto: 0 };
    g.brutto += brutto;
    gruppen.set(key, g);
  }

  const tax_summary = [];
  let netto = 0, steuer = 0, brutto = 0;
  for (const g of gruppen.values()) {
    // Erst die Gruppe summieren, dann rechnen — nicht je Zeile runden.
    const gBrutto = runde(g.brutto);
    const gNetto  = runde(gBrutto / (1 + g.satz / 100));
    const gSteuer = runde(gBrutto - gNetto);
    tax_summary.push({ satz: g.satz, grund: g.grund, netto: gNetto, steuer: gSteuer, brutto: gBrutto });
    netto += gNetto; steuer += gSteuer; brutto += gBrutto;
  }

  tax_summary.sort((a, b) => a.satz - b.satz);
  return { tax_summary, netto: runde(netto), steuer: runde(steuer), brutto: runde(brutto) };
}

/**
 * Der Wortlaut, der auf die Rechnung gedruckt und mit ihr eingefroren wird.
 *
 * Eingefroren, weil `profiles.tax_exempt_note` sich ändern kann: wer den Text in
 * den Einstellungen anpasst, darf damit nicht rückwirkend Rechnungen aus dem
 * Vorjahr verändern (§ 146 Abs. 4 AO — der ursprüngliche Inhalt muss feststellbar
 * bleiben).
 *
 * @param {object} profile        aktuelles Praxisprofil
 * @param {Array}  tax_summary    Rückgabe von berechneSteuer
 */
export function steuerhinweisText(profile, tax_summary) {
  if (istKleinunternehmer(profile)) return TAX_EXEMPT_OPTIONS['§19'];

  const hatBefreite = (tax_summary || []).some(g => Number(g.satz) === 0);
  if (!hatBefreite) return '';

  // Der Praxistext hat Vorrang — er kann bewusst abweichend formuliert sein
  // (Freitext-Option in den Einstellungen).
  const eigener = (profile?.tax_exempt_note || '').trim();
  return eigener || TAX_EXEMPT_OPTIONS['§4nr14a'];
}

// ── Leistungszeitraum ───────────────────────────────────────────────────────

/**
 * Ermittelt Leistungsdatum bzw. -zeitraum aus den Zeilen.
 *
 * § 14 Abs. 4 Nr. 6 UStG verlangt den Leistungszeitpunkt. § 31 Abs. 4 UStDV
 * lässt stattdessen den Kalendermonat zu — was aber nicht mehr trägt, wenn die
 * Behandlungen über einen Monatswechsel laufen. Deshalb steht das Datum an der
 * Zeile; von dort wird hier nur noch zusammengefasst.
 *
 * Bisher wurde der Zeitraum aus `prescription_sessions → bookings` gezogen und
 * blieb dadurch in der Podologie leer — der Bezug existierte in diesem Topf
 * nicht. Aus den Zeilen gelesen funktioniert es für beide Töpfe.
 *
 * @returns {{von:string|null, bis:string|null, gleich:boolean}}
 */
export function leistungszeitraum(lines) {
  const daten = (lines || []).map(l => l.leistungsdatum).filter(Boolean).sort();
  if (!daten.length) return { von: null, bis: null, gleich: true };
  const von = daten[0], bis = daten[daten.length - 1];
  return { von, bis, gleich: von === bis };
}

// ── Auswahl „medizinisch / kosmetisch" am Rechnungsformular ─────────────────

/**
 * Verdrahtet die Leistungsart-Auswahl und schreibt sie in die Zeilen.
 *
 * Beim Kleinunternehmer bleibt die Zeile ausgeblendet: dort wird ohnehin keine
 * Steuer ausgewiesen, die Frage wäre eine Entscheidung ohne Wirkung. Der Grund
 * (`ust_grund`) wird trotzdem gesetzt — § 19 Abs. 2 UStG rechnet den
 * steuerfreien Heilbehandlungsumsatz aus dem Gesamtumsatz heraus, und wer die
 * Grenze reisst, braucht die Unterscheidung rückwirkend.
 *
 * @param {object} opts
 * @param {object} opts.profile      Praxisprofil
 * @param {string} opts.vorschlag    'medizinisch' | 'kosmetisch'
 * @param {Function} opts.getLines   () => aktuelle Zeilen
 * @param {Function} opts.onChange   (zeilen) => void — nach dem Setzen aufgerufen
 */
export function mountLeistungsart({ profile, vorschlag, getLines, onChange }) {
  const wrap = document.getElementById('invLeistungsartWrap');
  const hint = document.getElementById('invLeistungsartHint');
  if (!wrap) return;

  const klein = istKleinunternehmer(profile);
  wrap.hidden = klein;

  const radios = wrap.querySelectorAll('input[name="invLeistungsart"]');
  const art = vorschlag || 'medizinisch';
  radios.forEach(r => { r.checked = (r.value === art); });

  const anwenden = (gewaehlt) => {
    const steuer = zeilenSteuerVon(gewaehlt);
    const zeilen = (getLines?.() || []).map(l => ({ ...l, ...steuer }));
    if (hint) {
      hint.textContent = klein ? ''
        : gewaehlt === 'kosmetisch'
          ? `→ ${USt_REGELSATZ} % USt werden berechnet`
          : '→ steuerfrei nach § 4 Nr. 14a UStG';
    }
    onChange?.(zeilen);
  };

  radios.forEach(r => {
    r.onchange = () => { if (r.checked) anwenden(r.value); };
  });
  anwenden(art);
}

// ── Einstellungen-Dropdown (aus dashboard.js hierher gezogen) ───────────────

export function initTaxExemptDropdown(savedValue) {
  const sel  = document.getElementById('setTaxExemptSelect');
  const inp  = document.getElementById('setTaxExempt');
  const hint = document.getElementById('setTaxExemptHint');
  if (!sel || !inp || !hint) return;

  const applyOption = (key) => {
    hint.textContent = TAX_EXEMPT_HINTS[key] || '';
    if (key === 'custom') { inp.style.display = ''; inp.focus(); }
    else { inp.style.display = 'none'; inp.value = TAX_EXEMPT_OPTIONS[key] ?? ''; }
  };

  let matchedKey = 'custom';
  if (!savedValue || savedValue === '') {
    // Kein gespeicherter Wert heisst „noch nicht entschieden" — dann wird die
    // Befreiung NICHT vorausgewählt (Konsey 2026-08-10: die Software nimmt die
    // Steuerbefreiung nicht von selbst an). Der Regelsatz ist der sichere Start.
    matchedKey = '19pct';
  } else {
    for (const [k, v] of Object.entries(TAX_EXEMPT_OPTIONS)) {
      if (v === savedValue) { matchedKey = k; break; }
    }
  }
  sel.value = matchedKey;
  if (matchedKey === 'custom') { inp.value = savedValue || ''; inp.style.display = ''; }
  else { inp.value = TAX_EXEMPT_OPTIONS[matchedKey]; inp.style.display = 'none'; }
  hint.textContent = TAX_EXEMPT_HINTS[matchedKey] || '';

  sel.addEventListener('change', () => applyOption(sel.value));
}

export function getTaxExemptValue() {
  const sel = document.getElementById('setTaxExemptSelect');
  const inp = document.getElementById('setTaxExempt');
  if (!sel) return '';
  if (sel.value === 'custom') return (inp?.value || '').trim();
  if (sel.value === '19pct') return '';
  return TAX_EXEMPT_OPTIONS[sel.value] || '';
}
