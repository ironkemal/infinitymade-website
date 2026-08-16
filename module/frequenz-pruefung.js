/**
 * frequenz-pruefung.js — passt der Termin zur verordneten Frequenz?
 *
 * Warum es das gibt
 * ─────────────────
 * Die Frequenz auf der Verordnung ist keine Empfehlung: weicht die Praxis
 * davon ab, kann die Kasse die Leistung absetzen. Und zwar in BEIDE
 * Richtungen — zu dicht behandelt ist so absetzbar wie zu selten
 * (Kemal, 16.08.2026: „haftada iki kez, üç kez gelirse … reddedecek. Nasıl ki
 * gelmediğinde … beş haftada bir kez gelince … parasını ödemiyor").
 *
 * Bis hierher prüfte nichts davon. Die Terminvergabe nahm jedes Datum an.
 *
 * Woher die Zahlen kommen
 * ───────────────────────
 * NICHT geschätzt. Quelle ist der Fragen-Antworten-Katalog Podologie
 * (`Podoloji/20230524_Podologie_FAK_bf.txt`, Stand 24.05.2023):
 *
 *   Nr. 11 — „Frequenzabweichungen bis 2 Werktage sind ohne Information des
 *   Arztes möglich. Über Frequenzabweichungen aus therapeutischen Gründen
 *   über 2 Tage ist mit dem Arzt Einvernehmen herzustellen, dies ist auf der
 *   VO zu dokumentieren. Wird die Behandlung kürzer als 12 Wochen
 *   unterbrochen (z.B. wegen Krankheit oder Urlaub), bleibt die Verordnung
 *   gültig." (vgl. § 16 Abs. 4 Satz 5 Heilmittel-Richtlinie)
 *
 *   Nr. 36 — bei den Diagnosegruppen DF, NF und QF darf der Arzt von der
 *   4–6-wöchigen Frequenz nach unten oder oben abweichen.
 *
 * Daraus die zwei Schwellen:
 *
 *   • ±2 WERKTAGE Abweichung vom Sollabstand → unbedenklich, keine Meldung.
 *     Darüber: Absprache mit dem Arzt nötig, Dokumentation auf der VO.
 *   • 12 WOCHEN Unterbrechung → die Verordnung verliert ihre Gültigkeit.
 *     Das ist die teure Schwelle, deshalb eine eigene, deutlichere Meldung.
 *
 * Werktage, nicht Kalendertage — so steht es in der Quelle. Ein Termin, der
 * über ein Wochenende rutscht, ist deshalb kein Verstoss.
 *
 * ⚠️ Der 2-Werktage-Wert stammt aus dem PODOLOGIE-Katalog. Die 12 Wochen
 * stehen in der Heilmittel-Richtlinie und gelten allgemein. Bevor die Prüfung
 * für Physio/Ergo/Logo scharf geschaltet wird, gehört der Toleranzwert von
 * `gkv-302` gegengeprüft — das ist genau die Sorte Zahl, die je Fachbereich
 * abweicht. Bis dahin ist die Vertikalen-Reihenfolge aus CLAUDE.md ohnehin
 * Podologie.
 *
 * Blockiert wird NIE. Nausad hat das am 12.08.2026 ausdrücklich so gewollt,
 * und es ist sachlich richtig: Nachholtermine, Urlaub und Krankheit sind
 * Alltag, und die Abweichung ist mit ärztlichem Einvernehmen zulässig. Die
 * Oberfläche widerspricht, die Praxis entscheidet.
 */

export const TOLERANZ_WERKTAGE = 2;
export const UNTERBRECHUNG_TAGE = 12 * 7;   // § 16 Abs. 4 Satz 5 HeilM-RL

/**
 * Sollabstand zweier Sitzungen in Kalendertagen, als Spanne.
 *
 * Eine Spanne, weil Verordnungen selten eine Zahl nennen: „1-2x wöchentlich"
 * heisst alles zwischen 3,5 und 7 Tagen. Würde man daraus einen einzigen Wert
 * machen, warnte die Hälfte aller korrekten Termine.
 *
 * @returns {{min:number, max:number, label:string}|null}
 *          null = kein verwertbarer Text → NICHT prüfen.
 */
export function sollAbstand(frequenzText) {
  const txt = String(frequenzText || '').toLowerCase().trim()
    .replace(/[–—]/g, '-');           // Gedankenstrich → Bindestrich
  if (!txt) return null;

  // „alle 4-6 Wochen", „4 - 6 wöchig", „alle vier Wochen"
  const wochenSpanne = txt.match(/(?:alle\s+)?(\d+|zwei|drei|vier|fünf|sechs)\s*(?:-\s*(\d+)\s*)?(?:wochen|wöchig)/);
  if (wochenSpanne) {
    const a = zahl(wochenSpanne[1]);
    const b = zahl(wochenSpanne[2]) || a;
    if (a > 1 || b > 1) {
      return {
        min: Math.min(a, b) * 7,
        max: Math.max(a, b) * 7,
        label: a === b ? `alle ${a} Wochen` : `alle ${a}-${b} Wochen`,
      };
    }
  }

  if (/14\s*-?\s*tägig|zweiwöchentlich/.test(txt)) {
    return { min: 14, max: 14, label: '14-tägig' };
  }

  // „2x wöchentlich", „1-2x pro Woche", „2-3x wöchentl."
  const proWoche = txt.match(/(\d+)\s*(?:-\s*(\d+))?\s*x?\s*(?:mal)?\s*(?:pro\s+woche|w[oö]chentl|\/\s*woche)/);
  if (proWoche) {
    const n1 = Number(proWoche[1]) || 0;
    const n2 = Number(proWoche[2]) || n1;
    const hoch = Math.max(n1, n2);    // mehr Termine → kürzerer Abstand
    const tief = Math.min(n1, n2);
    if (tief > 0) {
      return {
        min: Math.round(7 / hoch),
        max: Math.round(7 / tief),
        label: n1 === n2 ? `${n1}× wöchentlich` : `${tief}-${hoch}× wöchentlich`,
      };
    }
  }

  // „2x monatlich"
  const proMonat = txt.match(/(\d+)\s*(?:-\s*(\d+))?\s*x?\s*(?:mal)?\s*(?:pro\s+monat|monatl)/);
  if (proMonat) {
    const n1 = Number(proMonat[1]) || 0;
    const n2 = Number(proMonat[2]) || n1;
    const hoch = Math.max(n1, n2);
    const tief = Math.min(n1, n2);
    if (tief > 0) {
      return {
        min: Math.round(30 / hoch),
        max: Math.round(30 / tief),
        label: n1 === n2 ? `${n1}× monatlich` : `${tief}-${hoch}× monatlich`,
      };
    }
  }

  // Tägliche Frequenzen und unverständlicher Freitext: nicht prüfen.
  return null;
}

function zahl(w) {
  const worte = { zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6 };
  return worte[String(w)] ?? (Number(w) || 0);
}

/**
 * Wie viele Sitzungen sieht die Verordnung pro Woche vor? Nur für Frequenzen,
 * die sich überhaupt in „N pro Woche" ausdrücken lassen — „alle 4 Wochen"
 * ergibt hier bewusst null, das plant die Serie über den Wochenabstand.
 */
export function sitzungenProWoche(frequenzText) {
  const txt = String(frequenzText || '').toLowerCase().trim().replace(/[–—]/g, '-');
  if (!txt) return null;
  // Mehrwöchige Intervalle und Monatsangaben haben keine „pro Woche"-Zahl.
  if (/alle\s|wöchig|tägig|monatl|pro\s+monat|t[äa]gl/.test(txt)) return null;

  const m = txt.match(/(\d+)\s*(?:-\s*(\d+))?\s*x?\s*(?:mal)?\s*(?:pro\s+woche|w[oö]chentl|\/\s*woche)/);
  if (!m) return null;
  // Die Zahl wird direkt gelesen, nicht über den Tagesabstand zurückgerechnet:
  // `sollAbstand` rundet auf ganze Tage, und aus 3× pro Woche (Abstand 2 Tage)
  // würden beim Zurückrechnen 3,5 → 4 Termine.
  const n = Math.max(Number(m[1]) || 0, Number(m[2]) || 0);
  return n >= 1 && n <= 5 ? n : null;
}

/**
 * Verteilt `anzahl` Termine möglichst gleichmässig über die Arbeitswoche,
 * beginnend beim Wochentag des ersten Termins.
 *
 * Warum: die Serienplanung setzte bisher immer einen Termin pro Woche, egal
 * was auf der Verordnung stand (`frequenzToSeries` gibt für alles ausser
 * „täglich"/„alle N Wochen" sieben Tage zurück). Bei „3x pro Woche" musste die
 * Praxis die Wochentage von Hand ankreuzen — tat sie es nicht, entstand eine
 * Serie, die der eigenen Frequenzprüfung widerspricht.
 *
 * Mo als Start und 3 Termine ergibt Mo/Mi/Fr — der Abstand, den auch ein
 * Mensch wählen würde.
 *
 * @param {number} startTag 0=So … 6=Sa
 * @returns {number[]} Wochentage, aufsteigend
 */
export function verteileWochentage(startTag, anzahl) {
  const woche = [1, 2, 3, 4, 5];               // Mo–Fr
  const n = Math.max(1, Math.min(5, Number(anzahl) || 1));
  // Ein Wochenend-Starttag wird auf Montag gezogen: Serien über das Wochenende
  // zu verteilen ergibt in einer Praxis keinen Sinn.
  const startIdx = Math.max(0, woche.indexOf(startTag === 0 || startTag === 6 ? 1 : startTag));
  if (n === 1) return [woche[startIdx]];

  const gewaehlt = new Set();
  const schritt = (woche.length - 1) / (n - 1);
  for (let i = 0; i < n; i++) {
    const idx = Math.round(startIdx + i * schritt) % woche.length;
    gewaehlt.add(woche[idx]);
  }
  // Rundung kann zwei Termine auf denselben Tag legen; dann von vorne auffüllen.
  for (const tag of woche) {
    if (gewaehlt.size >= n) break;
    gewaehlt.add(tag);
  }
  return [...gewaehlt].sort((a, b) => a - b);
}

/** Werktage (Mo–Fr) zwischen zwei Tagen, ohne Vorzeichen. */
export function werktageZwischen(a, b) {
  const von = new Date(Math.min(a.getTime(), b.getTime()));
  const bis = new Date(Math.max(a.getTime(), b.getTime()));
  let tage = 0;
  const lauf = new Date(Date.UTC(von.getFullYear(), von.getMonth(), von.getDate()));
  const ende = Date.UTC(bis.getFullYear(), bis.getMonth(), bis.getDate());
  while (lauf.getTime() < ende) {
    lauf.setUTCDate(lauf.getUTCDate() + 1);
    const wt = lauf.getUTCDay();
    if (wt !== 0 && wt !== 6) tage++;
  }
  return tage;
}

export function kalendertage(a, b) {
  const tagA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const tagB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((tagB - tagA) / 86400000);
}

/**
 * Bewertet EINEN Abstand gegen den Sollabstand.
 * @returns {'ok'|'zu_dicht'|'zu_selten'|'unterbrechung'}
 */
export function bewerteAbstand(abstandTage, werktage, soll) {
  if (abstandTage > UNTERBRECHUNG_TAGE) return 'unterbrechung';
  if (!soll) return 'ok';
  // Die Toleranz zählt in Werktagen (Quelle Nr. 11), der Sollabstand in
  // Kalendertagen. Verglichen wird deshalb der Werktage-Abstand gegen den
  // in Werktage umgerechneten Sollkorridor — grob, aber in dieselbe Richtung
  // konservativ: ein Wochenende macht aus einem korrekten Termin keinen Verstoss.
  const sollMinWt = Math.floor(soll.min * 5 / 7);
  const sollMaxWt = Math.ceil(soll.max * 5 / 7);
  if (werktage < sollMinWt - TOLERANZ_WERKTAGE) return 'zu_dicht';
  if (werktage > sollMaxWt + TOLERANZ_WERKTAGE) return 'zu_selten';
  return 'ok';
}

/**
 * Vollständige Prüfung eines geplanten Termins gegen seine Verordnung.
 *
 * Anders als der erste Anlauf sucht das hier den Termin DAVOR **und** den
 * Termin DANACH — genau das braucht die Praxis am Bildschirm: „vorher war der
 * 3., nachher ist der 10., du legst den 6. dazwischen".
 *
 * @returns {Promise<{ok:boolean, titel?:string, meldung?:string, befund?:object}>}
 */
export async function pruefeFrequenz({ supabase, rx, neuesDatum, ausserBookingId = null }) {
  if (!supabase || !rx?.id || !neuesDatum) return { ok: true };
  const neu = new Date(neuesDatum);
  if (Number.isNaN(neu.getTime())) return { ok: true };

  const soll = sollAbstand(rx.frequenz);

  const { data: sessions, error } = await supabase
    .from('prescription_sessions')
    .select('id,session_number,booking_id,bookings(start_time,status)')
    .eq('prescription_id', rx.id)
    .not('booking_id', 'is', null);
  // Ohne Datengrundlage nicht warnen — eine unbegründete Warnung wird
  // weggeklickt und entwertet alle übrigen.
  if (error || !sessions?.length) return { ok: true };

  let vorher = null;
  let nachher = null;
  for (const s of sessions) {
    if (ausserBookingId && s.booking_id === ausserBookingId) continue;
    const bk = s.bookings;
    if (!bk?.start_time || bk.status === 'cancelled') continue;
    const d = new Date(bk.start_time);
    if (Number.isNaN(d.getTime())) continue;
    const diff = kalendertage(d, neu);
    if (diff > 0 && (!vorher || diff < kalendertage(vorher.datum, neu))) {
      vorher = { datum: d, nummer: s.session_number };
    }
    if (diff < 0 && (!nachher || diff > kalendertage(nachher.datum, neu))) {
      nachher = { datum: d, nummer: s.session_number };
    }
  }
  if (!vorher && !nachher) return { ok: true };

  const seiten = [];
  for (const [rolle, treffer] of [['vorher', vorher], ['nachher', nachher]]) {
    if (!treffer) continue;
    const kt = Math.abs(kalendertage(treffer.datum, neu));
    const wt = werktageZwischen(treffer.datum, neu);
    seiten.push({ rolle, ...treffer, kalendertage: kt, werktage: wt, urteil: bewerteAbstand(kt, wt, soll) });
  }

  const problem = seiten.find(s => s.urteil !== 'ok');
  if (!problem) return { ok: true };

  return {
    ok: false,
    titel: problem.urteil === 'unterbrechung'
      ? 'Behandlungspause über 12 Wochen'
      : 'Frequenz der Verordnung',
    meldung: baueMeldung({ soll, seiten, problem, neu }),
    befund: { soll, seiten, urteil: problem.urteil },
  };
}

function datumStr(d) {
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function baueMeldung({ soll, seiten, problem, neu }) {
  const zeilen = [];

  // Bewusst ohne Spalten-Ausrichtung: der Dialog rendert in einer
  // Proportionalschrift, aufgefüllte Leerzeichen ergäben dort ein Zickzack.
  const vor = seiten.find(s => s.rolle === 'vorher');
  const nach = seiten.find(s => s.rolle === 'nachher');
  const spanne = (s) => `${s.kalendertage} ${s.kalendertage === 1 ? 'Tag' : 'Tage'}`
    + ` (${s.werktage} ${s.werktage === 1 ? 'Werktag' : 'Werktage'})`;

  if (vor) zeilen.push(`▸ Termin davor: ${datumStr(vor.datum)} — Sitzung ${vor.nummer ?? '—'}`);
  zeilen.push(`▸ NEUER TERMIN: ${datumStr(neu)}`);
  if (nach) zeilen.push(`▸ Termin danach: ${datumStr(nach.datum)} — Sitzung ${nach.nummer ?? '—'}`);
  zeilen.push('');
  if (vor) zeilen.push(`Abstand zum vorherigen Termin: ${spanne(vor)}`);
  if (nach) zeilen.push(`Abstand zum nächsten Termin: ${spanne(nach)}`);
  zeilen.push('');

  if (soll) {
    zeilen.push(`Verordnet: ${soll.label}`
      + (soll.min === soll.max ? ` (etwa alle ${soll.min} Tage)` : ` (etwa ${soll.min}–${soll.max} Tage Abstand)`));
  }

  if (problem.urteil === 'unterbrechung') {
    zeilen.push('');
    zeilen.push(`Zwischen den Terminen liegen mehr als 12 Wochen. Damit verliert die`);
    zeilen.push(`Verordnung ihre Gültigkeit — die Kasse kann die Leistung absetzen.`);
    zeilen.push(`(§ 16 Abs. 4 Satz 5 Heilmittel-Richtlinie)`);
  } else if (problem.urteil === 'zu_dicht') {
    zeilen.push('');
    zeilen.push(`Der Termin liegt DICHTER als verordnet. Abweichungen über 2 Werktage`);
    zeilen.push(`müssen mit dem Arzt abgestimmt und auf der Verordnung dokumentiert`);
    zeilen.push(`werden — sonst kann die Kasse die Leistung absetzen.`);
  } else {
    zeilen.push('');
    zeilen.push(`Der Termin liegt SELTENER als verordnet. Abweichungen über 2 Werktage`);
    zeilen.push(`müssen mit dem Arzt abgestimmt und auf der Verordnung dokumentiert`);
    zeilen.push(`werden — sonst kann die Kasse die Leistung absetzen.`);
  }

  zeilen.push('');
  zeilen.push('Sind Sie sicher, dass Sie diesen Termin so anlegen möchten?');
  return zeilen.join('\n');
}
