/**
 * verordnung-einheiten.js — die verordnete Menge nachträglich korrigieren.
 *
 * Warum es das gibt
 * ─────────────────
 * Beta-1 (Podologe, beta), 31.08.2026:
 *
 *   „Wenn du angelegt hast, wenn du auf den Patienten gehst, [soll man es]
 *    noch mal sogar ändern lassen. … Dann kannst du es noch in der Akte selber
 *    ändern. Das ist dann nicht fest, sondern du sagst, es sind doch nur zwei
 *    oder so"
 *
 * Der Anlass ist fachlich, nicht Bequemlichkeit: nach der Eingangsbefundung
 * steht oft erst fest, wie viele Einheiten wirklich nötig sind. Bisher war die
 * Zahl im Moment des Anlegens festgeschrieben — wer sich vertan hatte, legte
 * eine zweite Verordnung an.
 *
 * Geltungsbereich: NUR der Podologie-Topf (`verordnungen`)
 * ───────────────────────────────────────────────────────
 * Im Physio-Topf (`prescriptions.anzahl_einheiten`) gibt es bis heute überhaupt
 * keinen Schreibweg — `saveRezept` legt nur an. Dort hängen ausserdem die
 * Sitzungszeilen an der Zahl (`module/sitzung-abgleich.js`) UND die Zuzahlung
 * rechnet über Einheiten × Satz; eine Änderung wäre also zugleich eine
 * Geldänderung und müsste über den bestehenden Korrekturweg
 * (`module/zuzahlung-korrektur.js`, Backend mit Protokollzeile in
 * `zuzahlung_korrekturen`) laufen. Das ist ein eigenes Stück Arbeit und
 * ausdrücklich NICHT hier — zwei Rechenwege für dieselbe Zuzahlung wären
 * genau der Fehler, den `module/zuzahlung-rechnen.js` gerade beseitigt hat.
 *
 * In der Podologie ist die Lage anders und deshalb hier machbar: die Zuzahlung
 * hängt nicht an der verordneten Menge, sondern an den tatsächlich
 * dokumentierten Positionen (`podologie_behandlungen` × HPNR-Codes) — dasselbe,
 * was auch das Backend beim Erzeugen der DTA-Datei abflacht. Eine Korrektur der
 * verordneten Menge ändert hier also KEINEN Betrag; sie ändert, ab wann die
 * Verordnung als ausgeschöpft gilt.
 *
 * Der Riegel
 * ──────────
 * Eine Verordnung, die schon bei der Kasse war, wird nicht mehr angefasst.
 * Gleiche Absicht wie `korrekturErlaubt` in `module/zuzahlung-rechnen.js`, aber
 * mit den Spalten dieses Topfes — deshalb hier und nicht dort: jene Datei ist
 * eine wörtliche Spiegelung des Backend-Calculators und bekommt nichts
 * hinzugedichtet, wofür es kein Gegenstück gibt.
 *
 * ⚠️ Offen und bewusst benannt: In der Datenbank hält diesen Riegel NICHTS.
 * GoBD-Trigger gibt es für `belegliste`, `invoices` und `zuzahlung_korrekturen`
 * (db/SCHEMA-RLS.sql), für `verordnungen` nicht. Der Schreibweg der
 * Podologie-Abrechnung (`podologie-abrechnung.js`, UPDATE-Zweig des Formulars)
 * prüft ebenfalls nichts. Diese Datei ist damit heute die einzige Stelle, die
 * hinsieht — ein Riegel im Browser ist eine Hilfe für den Anwender, keine
 * Sicherung. Gehört als eigene Aufgabe auf die Ops-Karte.
 */

const ABGESCHLOSSEN = ['abgerechnet', 'archiviert', 'storniert'];

/**
 * Darf die verordnete Menge dieser Verordnung noch geändert werden?
 *
 * @param {object} vord  Zeile aus `verordnungen`
 * @returns {{erlaubt:boolean, grund:string|null}}
 */
export function einheitenAenderungErlaubt(vord) {
  if (!vord) return { erlaubt: false, grund: 'Verordnung nicht gefunden.' };

  // Die eingefrorene Belegnummer ist das härtere Signal: sie wird bei der
  // DTA-Erzeugung EINMAL vergeben und danach nie geändert (Anlage 1 TP5 V21
  // Kap. 7.3). Ein Status lässt sich zurücksetzen, diese Nummer nicht.
  if (vord.belegnummer) {
    return {
      erlaubt: false,
      grund: `Diese Verordnung wurde bereits an die Kasse übermittelt (Beleg ${vord.belegnummer}). `
           + 'Die verordnete Menge ist festgeschrieben.',
    };
  }
  if (ABGESCHLOSSEN.includes(vord.status)) {
    return {
      erlaubt: false,
      grund: `Verordnung ist „${vord.status}" — die verordnete Menge lässt sich nicht mehr ändern.`,
    };
  }
  return { erlaubt: true, grund: null };
}

/**
 * Prüft eine neue Menge, bevor geschrieben wird.
 *
 * @param {number} neu
 * @param {number} erbracht  Zahl der dokumentierten Behandlungen
 * @returns {string|null} Fehlertext oder null
 */
export function pruefeNeueMenge(neu, erbracht) {
  if (!Number.isFinite(neu) || neu < 1) return 'Mindestens 1 Behandlungseinheit.';
  if (neu > 60) return 'Mehr als 60 Einheiten je Verordnung sind nicht vorgesehen.';
  // Unter die schon erbrachten Einheiten zu gehen, würde eine Verordnung
  // erzeugen, die mehr geleistet hat als verordnet war — genau der Zustand,
  // den die Übersicht rot anzeigt, und in der Abrechnung eine Absetzung.
  if (Number.isFinite(erbracht) && erbracht > 0 && neu < erbracht) {
    return `${erbracht} Behandlung${erbracht > 1 ? 'en sind' : ' ist'} bereits dokumentiert — `
         + `weniger als ${erbracht} Einheiten sind nicht möglich.`;
  }
  return null;
}

/**
 * Die neue Menge speichern.
 *
 * Geschrieben wird AUSSCHLIESSLICH `behandlungseinheiten`. Der Status bleibt
 * bewusst unangetastet, auch wenn die Verordnung damit rechnerisch ausgeschöpft
 * ist: über Statuswechsel entscheidet der Server
 * (`PATCH /billing/verordnung/:id/abrechnungsstatus`, gespiegelt in
 * `module/abrechnungsstatus.js`), und zwei Stellen, die denselben Übergang
 * auslösen, laufen früher oder später auseinander.
 *
 * @param {object} supabase
 * @param {object} opts
 * @param {string} opts.vordId
 * @param {number} opts.neu
 * @returns {Promise<{ok:boolean, fehler?:string}>}
 */
export async function speichereEinheiten(supabase, { vordId, neu }) {
  // `.select()` ist hier kein Luxus, sondern der Fehlernachweis.
  //
  // Ein UPDATE, das die Zeilensicherheit (RLS) nicht passieren darf, wirft
  // KEINEN Fehler — PostgREST meldet Erfolg mit null betroffenen Zeilen. Ohne
  // die Rückgabe stünde in der Oberfläche „gespeichert", während in der
  // Datenbank nichts passiert ist. Genau dieser Fall wird ab jetzt real:
  // Angestellte dürfen `verordnungen` lesen, aber nicht schreiben.
  const { data, error } = await supabase
    .from('verordnungen')
    .update({ behandlungseinheiten: neu })
    .eq('id', vordId)
    .select('id, behandlungseinheiten');

  if (error) {
    console.error('[verordnung-einheiten]', error);
    return { ok: false, fehler: error.message };
  }
  if (!data || data.length === 0) {
    return {
      ok: false,
      fehler: 'Die Änderung wurde nicht gespeichert — vermutlich fehlt die Berechtigung. '
            + 'Das Ändern der verordneten Menge ist Sache der Praxisinhaberin oder des Praxisinhabers.',
    };
  }
  return { ok: true };
}
