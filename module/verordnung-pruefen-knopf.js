/**
 * verordnung-pruefen-knopf.js — der Knopf „Verordnung prüfen" und sein Ergebnis.
 *
 * Herkunft
 * ────────
 * Ops-Karte 76. Der Motor steht in `verordnung-pruefung.js`, die Regeln in
 * `verordnung-regeln.js`; hier steht nur, wie man an die Werte der Maske
 * kommt und wie das Urteil aussieht.
 *
 * Zwei Masken, ein Urteil
 * ───────────────────────
 * Eine Verordnung entsteht von Hand an zwei Stellen:
 *
 *   `#rezeptModal`         Muster 13, alle Fachbereiche — Felder `rz*`
 *   Podologie-Abrechnung   podologischer Schnellweg     — Felder `podNew*`
 *
 * Zwei Masken, weil zwei Arbeitsweisen — nicht, weil dahinter zwei Tabellen
 * stehen (seit dem 04.09.2026 ist es eine, s. `verordnung-topf.js`). Dieser
 * Knopf hängt deshalb an der MASKE, nicht am Speicherziel.
 *
 * Bis heute hingen die podologischen Prüfungen nur an der ersten Maske
 * (`verordnung-podo.js`): wer seine Verordnung über die Podologie-Abrechnung
 * anlegte, bekam keine einzige davon zu sehen. Beide Masken bekommen deshalb
 * denselben Motor — gleiche Eingabe, gleiches Urteil, egal wo getippt wird.
 *
 * ⚠️ Stand 03.09.2026 ist nur `muster13` eingehängt. Die Podologie-Maske wird
 *    gerade umgebaut (Topf-Zusammenlegung); ihr Aufruf
 *    `montiereVerordnungPruefen(supabase, 'podologie')` gehört ans Ende ihres
 *    Renderns und wird nachgezogen, sobald der Umbau steht.
 *
 * Warum der Knopf nichts blockiert
 * ────────────────────────────────
 * Er ist ein Angebot. Beta-1 (Podologe) braucht ihn für sich nicht, hält ihn
 * aber „für die anderen Podologen" für wertvoll. Wer weiss, was er tut, tippt
 * weiter und drückt Speichern; wer unsicher ist, drückt vorher einmal auf
 * Prüfen. Auf dem Papier steht ohnehin, was der Arzt verordnet hat — auch
 * eine fehlerhafte Verordnung muss erfassbar bleiben.
 */

import { pruefeVerordnung, zaehleBefunde, SCHWERE } from './verordnung-pruefung.js?v=20260906';
import { markiereBefunde, loescheMarkierungen } from './verordnung-feldmarker.js?v=20260906';
import { POD_KATALOG, dgWurzel } from './verordnung-regeln.js?v=20260903';
import { regelsatzLaden } from './verordnung-regelsatz-cache.js?v=20260905';

const $ = (id) => document.getElementById(id);
const wert = (id) => ($(id)?.value ?? '').toString().trim();
const haken = (id) => !!$(id)?.checked;

function schuetze(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ─── Die beiden Masken lesen ────────────────────────────────────────────────

/**
 * Muster-13-Maske (`#rezeptModal`). Ein Behandlungsbeginn wird dort nicht
 * erfasst — das Feld gibt es auf dem Formular nicht; die Frist wird deshalb
 * nur als laufende Frist gemeldet, nicht als versäumte.
 */
function lesenMuster13() {
  const ls = ['a', 'b', 'c'].filter(b => haken(`rzLs${b.toUpperCase()}`));
  return {
    bereich:            wert('rzTherapieBereich'),
    icd:                wert('rzIcd'),
    diagnosegruppe:     wert('rzDg'),
    leitsymptomatik:    ls,
    // Kästchen d) trägt keinen Katalogbuchstaben, sondern Freitext. Ohne
    // dieses Feld meldete der Motor „Keine Leitsymptomatik angekreuzt", obwohl
    // die patientenindividuelle Leitsymptomatik ausgefüllt war.
    leitsymptomatikFreitext: haken('rzLsD') ? wert('rzLsDText') : '',
    heilmittel:         wert('rzHm'),
    heilmittelPosition: wert('rzHmPosition'),
    anzahl:             wert('rzAnzahl'),
    frequenz:           wert('rzFreq'),
    ausstellungsdatum:  wert('rzAusstDate'),
    behandlungsbeginn:  '',
    dringend:           haken('rzDringend'),
    versichertennummer: wert('rzPatVersNr'),
    kasseIk:            wert('rzPatKasseIk'),
    arztLanr:           wert('rzLanr'),
    arztBsnr:           wert('rzBsnr'),
    rezeptart:          'gkv',
  };
}

/**
 * Podologie-Maske (`podNew*`). Zwei Eigenheiten gegenüber Muster 13:
 *
 * 1. `podNewHeilmittel` ist ein Auswahlfeld mit den Werten a/b/c — es trägt
 *    Leitsymptomatik UND Heilmittel in einem. Der Klartext wird deshalb aus
 *    dem Katalog abgeleitet, sonst meldete die Prüfung eine Abweichung
 *    zwischen zwei Feldern, die in Wahrheit dasselbe Feld sind.
 * 2. Die Positionsnummern stehen in eigenen Zeilen (`.pod-hm-code`), nicht in
 *    einem einzelnen versteckten Feld.
 */
function lesenPodologie() {
  const brief = wert('podNewHeilmittel');           // '' | 'a' | 'b' | 'c'
  const dg = dgWurzel(wert('podNewDiag'));
  const katalog = POD_KATALOG[dg] || {};
  const positionen = [...document.querySelectorAll('#podHeilmittelItems .pod-hm-code')]
    .map(el => (el.value || '').trim()).filter(Boolean);

  return {
    bereich:            'podologie',
    icd:                wert('podNewIcd10'),
    diagnosegruppe:     wert('podNewDiag'),
    leitsymptomatik:    brief ? [brief] : [],
    heilmittel:         brief ? (katalog[brief] || brief) : '',
    heilmittelPosition: positionen[0] || '',
    anzahl:             wert('podNewEinheiten'),
    frequenz:           wert('podNewFrequenz'),
    ausstellungsdatum:  wert('podNewAusstelldatum'),
    behandlungsbeginn:  '',
    dringend:           haken('podNewDringend'),
    versichertennummer: wert('podNewVsnr'),
    kasseIk:            wert('podNewKk'),
    arztLanr:           wert('podNewArztLanr'),
    arztBsnr:           wert('podNewArztBsnr'),
    rezeptart:          wert('podNewRezeptart') || 'kassen',
  };
}

// `wurzel` ist der Bereich, in dem die Befunde an die Felder gesetzt werden
// (module/verordnung-feldmarker.js), `formular` der Bereich, dessen Tippen das
// Urteil veralten lässt. Beide bewusst als ID und nicht per `closest()`: die
// Muster-13-Maske zieht zwischen Modal und Seite um (module/verordnung-maske.js),
// und `closest('.card')` fände dabei einmal die Karte der Seite und einmal
// nichts — zwei verschiedene Verhalten für dieselbe Maske.
const MASKEN = {
  muster13:  { anker: 'rzSaveBtn',      panel: 'rzPruefErgebnis',      knopf: 'rzPruefBtn',
               lesen: lesenMuster13,  wurzel: 'rzMaskeWrap',      formular: 'rzMaskeWrap' },
  podologie: { anker: 'podSaveVordBtn', panel: 'podNewPruefErgebnis',  knopf: 'podNewPruefBtn',
               lesen: lesenPodologie, wurzel: null,               formular: null },
};

// ─── Darstellung ────────────────────────────────────────────────────────────
//
// Die Klassen `preflight-check-item success|warning|error` gibt es bereits
// (dashboard.css:7149) und sie sind themensicher. Keine eigene CSS-Datei,
// keine festen Farben — der Preflight der §302-Abgabe sieht genauso aus, und
// das ist beabsichtigt: derselbe Befund soll überall gleich aussehen.

const KLASSE = { [SCHWERE.blocker]: 'error', [SCHWERE.warnung]: 'warning', [SCHWERE.hinweis]: 'success' };
const VORSATZ = { [SCHWERE.blocker]: 'So nicht', [SCHWERE.warnung]: 'Bitte prüfen', [SCHWERE.hinweis]: 'Hinweis' };
const RANG = { [SCHWERE.blocker]: 0, [SCHWERE.warnung]: 1, [SCHWERE.hinweis]: 2 };

function zeile(befund) {
  const quelle = befund.quelle
    ? `<div style="font-size:11px;color:var(--text-muted);margin-top:3px;">${schuetze(befund.quelle)}</div>` : '';
  return `<div class="preflight-check-item ${KLASSE[befund.schwere]}">
    <div><strong>${VORSATZ[befund.schwere]}:</strong> ${schuetze(befund.text)}${quelle}</div>
  </div>`;
}

function urteil(ergebnis) {
  const z = zaehleBefunde(ergebnis);
  if (z.blocker) return { klasse: 'error', text: `${z.blocker} Angabe${z.blocker > 1 ? 'n' : ''} stimm${z.blocker > 1 ? 'en' : 't'} so nicht.` };
  if (z.warnung) return { klasse: 'warning', text: `${z.warnung} Punkt${z.warnung > 1 ? 'e' : ''} zum Nachsehen — die Verordnung ist erfassbar.` };
  return { klasse: 'success', text: 'Die Angaben passen zusammen.' };
}

function darstellen(panel, ergebnis, wurzel) {
  if (!ergebnis) {
    if (wurzel) loescheMarkierungen(wurzel);
    panel.innerHTML = `<div class="preflight-check-item warning"><div>
      Die Regeldaten konnten nicht geladen werden — ohne sie gibt es kein Urteil.
      Bitte später erneut prüfen.</div></div>`;
    panel.style.display = 'block';
    return;
  }

  // Jeder Befund kennt sein Feld — er wird ANS FELD gesetzt, nicht nur in die
  // Liste geschrieben (Kemal, 06.09.2026: „hatalı olan yerlerin yanına ünlem
  // koysun"). Die Liste bleibt trotzdem: sie trägt die Quelle je Befund und
  // die Abdeckungszeile, und sie zeigt auch die Befunde ohne eigenes Kästchen.
  if (wurzel) markiereBefunde(ergebnis.befunde, wurzel);

  const kopf = urteil(ergebnis);
  const befunde = [...ergebnis.befunde].sort((a, b) => RANG[a.schwere] - RANG[b.schwere]);

  // Was WURDE geprüft, und was nicht. Ohne diese Zeile wäre ein grünes
  // Urteil bei Ergo oder Logopädie ein Versprechen, das die Regeldaten
  // heute nicht decken.
  const abdeckung = `<div style="font-size:11px;color:var(--text-muted);margin-top:8px;">
      Geprüft: ${schuetze(ergebnis.geprueft.join(' · ')) || '—'}
      ${ergebnis.ungeprueft.length
        ? `<br>Nicht geprüft: ${ergebnis.ungeprueft.map(schuetze).join(' ')}`
        : ''}
    </div>`;

  panel.innerHTML = `<div class="preflight-check-item ${kopf.klasse}">
      <div><strong>${schuetze(kopf.text)}</strong></div>
    </div>${befunde.map(zeile).join('')}${abdeckung}`;
  panel.style.display = 'block';
  // Merkzettel für die automatische Nachprüfung beim Weitertippen: erst wenn
  // einmal ein Urteil dastand, zieht es beim Korrigieren mit.
  panel.dataset.jeGeprueft = '1';
}

// ─── Einhängen ──────────────────────────────────────────────────────────────

/** Der Zielbereich für die Feldmarkierungen — `null`, solange es ihn nicht gibt. */
function wurzelVon(cfg) {
  return cfg.wurzel ? $(cfg.wurzel) : null;
}

/**
 * Eine Maske JETZT prüfen und das Ergebnis anzeigen — an den Feldern und in
 * der Ergebnisliste.
 *
 * Öffentlich, weil die eingebettete Maske auf der Seite „Verordnungen" das
 * Urteil beim Aufschlagen einer gespeicherten Verordnung braucht, ohne dass
 * jemand auf den Knopf drückt: dort ist die Frage „was stimmt hier nicht"
 * bereits gestellt — das Ausrufezeichen in der Liste hat sie gestellt.
 *
 * @param {object} supabase
 * @param {'muster13'|'podologie'} maskeKey
 * @returns {Promise<object|null>} das Prüfergebnis (oder `null` ohne Regeldaten)
 */
export async function pruefeMaske(supabase, maskeKey) {
  const cfg = MASKEN[maskeKey];
  const panel = cfg && $(cfg.panel);
  if (!cfg || !panel) return null;
  try {
    const vo = cfg.lesen();
    const satz = await regelsatzLaden(supabase, vo.bereich);
    const ergebnis = satz ? pruefeVerordnung(vo, satz) : null;
    darstellen(panel, ergebnis, wurzelVon(cfg));
    return ergebnis;
  } catch (e) {
    console.warn('[verordnung-pruefen]', e);
    darstellen(panel, null, wurzelVon(cfg));
    return null;
  }
}

/**
 * Knopf und Ergebnisfeld in eine Maske einhängen. Idempotent: ein zweiter
 * Aufruf für dieselbe, noch vorhandene Maske tut nichts. Die Podologie-Maske
 * wird per `innerHTML` neu gebaut, dort ist der erneute Aufruf nach jedem
 * Rendern nötig — der Knopf ist dann weg und wird neu gesetzt.
 *
 * @param {object} supabase  Client aus dashboard.js
 * @param {'muster13'|'podologie'} maskeKey
 */
export function montiereVerordnungPruefen(supabase, maskeKey) {
  const cfg = MASKEN[maskeKey];
  if (!cfg) return;
  const anker = $(cfg.anker);
  if (!anker || $(cfg.knopf)) return;

  const knopf = document.createElement('button');
  knopf.type = 'button';
  knopf.id = cfg.knopf;
  knopf.textContent = 'Verordnung prüfen';
  knopf.style.cssText = 'padding:8px 14px;border-radius:6px;border:1px solid var(--border);'
    + 'background:var(--bg-card-solid,#1f2937);color:var(--text-main);font-size:14px;cursor:pointer;';

  const panel = document.createElement('div');
  panel.id = cfg.panel;
  panel.style.cssText = 'display:none;margin-top:10px;';

  anker.insertAdjacentElement('afterend', knopf);
  (anker.parentElement || anker).insertAdjacentElement('afterend', panel);

  knopf.addEventListener('click', async () => {
    knopf.disabled = true;
    const vorher = knopf.textContent;
    knopf.textContent = 'Prüfe…';
    try { await pruefeMaske(supabase, maskeKey); }
    finally { knopf.disabled = false; knopf.textContent = vorher; }
  });

  // Weitertippen macht das angezeigte Urteil veraltet — ein altes grünes
  // Häkchen (oder eine stehengebliebene rote Umrandung) über einer inzwischen
  // geänderten Verordnung wäre die gefährlichste Anzeige von allen.
  //
  // Deshalb wird es nicht nur versteckt, sondern nach einer kurzen Pause NEU
  // gefällt: die Prüfung rechnet im Browser, sie kostet nichts, und der Grund
  // am Feld ist genau dann etwas wert, wenn er beim Korrigieren mitläuft und
  // verschwindet, sobald es stimmt. Die Regeldaten kommen dabei aus dem Cache
  // (module/verordnung-regelsatz-cache.js), es geht keine Abfrage raus.
  const formular = (cfg.formular && $(cfg.formular))
    || anker.closest('form') || anker.closest('.card') || anker.parentElement;
  let timer = null;
  const veraltet = () => {
    panel.style.display = 'none';
    const w = wurzelVon(cfg);
    if (w) loescheMarkierungen(w);
    clearTimeout(timer);
    // Nur nachprüfen, wenn vorher schon einmal geprüft wurde — ungefragt
    // aufpoppende Befunde beim Anlegen einer neuen Verordnung wären das
    // Gegenteil des „Angebots, keine Pflicht" (siehe Kopf).
    if (!panel.dataset.jeGeprueft) return;
    timer = setTimeout(() => { pruefeMaske(supabase, maskeKey); }, 700);
  };
  formular?.addEventListener('input', veraltet, true);
  formular?.addEventListener('change', veraltet, true);
}
