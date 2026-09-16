import { emit } from './signal.js?v=20260813';
import { pruefeVerordnungsfortschritt } from './sitzungsfortschritt.js?v=20260914';

/**
 * termin-nicht-erschienen.js — „Patient nicht erschienen" an EINER Stelle.
 *
 * Warum es das gibt
 * ─────────────────
 * Bis zum 14.09.2026 gab es zwei Wege, einen Termin als nicht wahrgenommen zu
 * markieren, und sie taten verschiedene Dinge (Ops-Karte a8186cb8):
 *
 *   • dashboard.js `handlePatientNichtErschienen()` — schrieb status='no_show',
 *     no_show=true, den Grund, setzte die Sitzungszeile auf 'no_show' und bot
 *     die Ausfallrechnung an.
 *   • kalender.js „👻 Nicht erschienen" — schrieb NUR bookings.status. Kein
 *     no_show-Flag, kein Grund, keine Sitzungszeile, keine Ausfallrechnung.
 *     Derselbe Klick, zwei verschiedene Datenstände.
 *
 * Beide Wege hatten ausserdem denselben Kernfehler: die Sitzungszeile blieb am
 * Termin hängen (`booking_id` gesetzt). Damit galt die Einheit weiter als
 * „vergeben" — die Verordnung zeigte 3/6, obwohl nur 2 Einheiten erbracht
 * waren, und die ausgefallene Einheit tauchte nirgends wieder als buchbar auf.
 * Ein Nachholtermin liess sich nur anlegen, indem man die Zahl ignorierte.
 *
 * Die Regel jetzt (Nutzerentscheidung, 14.09.2026)
 * ───────────────────────────────────────────────
 *     bookings.status      = 'no_show'   ← die Spur, dauerhaft
 *     bookings.no_show     = true
 *     prescription_sessions.booking_id = NULL     ← Einheit ist wieder frei
 *     prescription_sessions.status     = 'planned'
 *
 * Die Einheit wurde nicht erbracht, also gehört sie zurück in den Topf. Dass
 * sie einmal ausgefallen ist, steht am TERMIN (`no_show`, `no_show_noted_at`,
 * `cancellation_reason`) und nicht an der Sitzungszeile — die Sitzungszeile ist
 * ein Zähler für erbrachte Leistung, kein Tagebuch.
 *
 * Dasselbe Muster wie die Absage (#192, 08.09.2026): auch dort wird
 * `booking_id` freigegeben und die alte Zuordnung als Momentaufnahme am Termin
 * aufbewahrt. Unterschied: die Absage macht das im DB-Trigger und legt sie in
 * `cancelled_session_links` ab — diese Spalte ist trigger-eigen, ein vom Client
 * mitgeschickter Wert wird dort überschrieben. Für no_show gibt es deshalb die
 * eigene, additive Spalte `bookings.no_show_session_links`
 * (Migration 0016), die der Client selbst füllt.
 *
 * Warum die Momentaufnahme überhaupt nötig ist
 * ────────────────────────────────────────────
 * Weil es den Rückweg gibt: `korrigiereNoShow()` (module/booking-status-
 * korrektur.js) — „der Patient war doch da / Fehlklick". Der fand seine
 * Sitzungszeile bisher über `.eq('booking_id', …)`. Sobald die Zeile freigegeben
 * ist, findet er dort nichts mehr, und die erbrachte Einheit ginge lautlos
 * verloren. Genau dafür ist `no_show_session_links` da: sie ist die
 * Rückfahrkarte, nicht Historie zum Anschauen.
 *
 * ⚠️ Deshalb ist die Freigabe an die Rückfahrkarte GEKOPPELT: lässt sich die
 *    Momentaufnahme nicht schreiben (alte Box, Migration 0016 noch nicht
 *    gelaufen), bleibt es beim alten Verhalten (Zeile bleibt am Termin,
 *    status='no_show'). Lieber die alte, bekannte Unschärfe als eine Einheit,
 *    die niemand mehr zuordnen kann.
 *
 * Nicht Aufgabe dieses Moduls: die Ausfallgebühr. `offerAusfallrechnung()` ist
 * ein eigenes Feature (module/ausfallrechnung.js) und wird vom Aufrufer nach
 * dieser Funktion aufgerufen — hier nur der Status und die Einheiten.
 */

const FELD_LINKS = 'no_show_session_links';

/**
 * Die Momentaufnahme einer Sitzungszeile — dieselben vier Felder, die #192 in
 * `cancelled_session_links` legt. Bewusst gleich, damit man beide Spalten mit
 * demselben Blick liest.
 */
export function baueSessionLinks(sitzungen = []) {
  return (sitzungen || [])
    .filter(s => s && s.id)
    .map(s => ({
      session_id: s.id,
      prescription_id: s.prescription_id ?? null,
      session_number: s.session_number ?? null,
      heilmittel_index: s.heilmittel_index ?? null,
    }));
}

/** Doppelte Einträge (mehrfaches no_show am selben Termin) einmal zählen. */
function einmalJeSitzung(links = []) {
  const gesehen = new Set();
  const raus = [];
  for (const l of links || []) {
    const id = l?.session_id;
    if (!id || gesehen.has(id)) continue;
    gesehen.add(id);
    raus.push(l);
  }
  return raus;
}

/**
 * Termin als „Patient nicht erschienen" festschreiben und seine Einheiten
 * freigeben.
 *
 * @param {{supabase:object}} ctx
 * @param {{id:string}} booking
 * @param {{grund?:string, fortschritt?:Function}} opts
 * @returns {Promise<{freigegeben:number, rezepte:string[], rueckfahrkarte:boolean}>}
 */
export async function markiereNichtErschienen(ctx, booking, opts = {}) {
  const { supabase } = ctx || {};
  const { grund = '', fortschritt = pruefeVerordnungsfortschritt } = opts;
  if (!supabase) throw new Error('Datenbankzugang fehlt.');
  if (!booking?.id) throw new Error('Termin fehlt.');

  // 1. Welche Sitzungszeilen hängen an diesem Termin? Physio/Ergo/Logo führen
  //    hier ihr Einheiten-Hauptbuch; die Podologie zählt über
  //    bookings.verordnung_id + podologie_behandlungen und liefert hier leer.
  //
  //    `cancelled` bleibt aussen vor: eine abgesagte Sitzungszeile darf ein
  //    Ausfall nicht wieder zum Leben erwecken. `done` dagegen ist dabei — wer
  //    einen abgehakten Termin nachträglich auf „nicht erschienen" stellt,
  //    korrigiert genau diese Aussage, und die Einheit gilt dann als nicht
  //    erbracht. (Das alte Verhalten schrieb sie auf 'no_show', zählte sie also
  //    ebenfalls nicht mehr als erbracht — hier ändert sich nur, dass sie
  //    zusätzlich wieder buchbar wird.)
  const { data: gefunden, error: leseErr } = await supabase
    .from('prescription_sessions')
    .select('id, prescription_id, session_number, heilmittel_index, status')
    .eq('booking_id', booking.id)
    .neq('status', 'cancelled');
  if (leseErr) throw leseErr;
  const zeilen = gefunden || [];

  // 2. Rückfahrkarte vorbereiten: bestehende Einträge lesen (angehängt wird,
  //    nie überschrieben — ein Termin kann mehrfach durch die Korrektur und
  //    zurück laufen). Schlägt schon das Lesen fehl, gibt es die Spalte nicht.
  let rueckfahrkarte = true;
  let vorher = [];
  if (zeilen.length) {
    const { data, error } = await supabase
      .from('bookings').select(FELD_LINKS).eq('id', booking.id).maybeSingle();
    if (error) {
      console.warn('[nicht-erschienen] Rückfahrkarte nicht verfügbar — Einheiten bleiben am Termin.', error.message);
      rueckfahrkarte = false;
    } else {
      vorher = Array.isArray(data?.[FELD_LINKS]) ? data[FELD_LINKS] : [];
    }
  }

  // 3. Der Termin selbst. Bewusst OHNE die Linkspalte — dieser Schreibvorgang
  //    ist der eigentliche Vorgang und darf nicht daran scheitern, dass eine
  //    Zusatzspalte fehlt.
  const payload = {
    status: 'no_show',
    no_show: true,
    no_show_noted_at: new Date().toISOString(),
  };
  if (grund && grund.trim()) payload.cancellation_reason = grund.trim();
  const { error: bkErr } = await supabase.from('bookings').update(payload).eq('id', booking.id);
  if (bkErr) throw bkErr;

  // 4. Rückfahrkarte schreiben.
  if (zeilen.length && rueckfahrkarte) {
    const { error } = await supabase
      .from('bookings')
      .update({ [FELD_LINKS]: [...vorher, ...baueSessionLinks(zeilen)] })
      .eq('id', booking.id);
    if (error) {
      console.warn('[nicht-erschienen] Rückfahrkarte nicht geschrieben — Einheiten bleiben am Termin.', error.message);
      rueckfahrkarte = false;
    }
  }

  // 5. Einheiten freigeben — oder, ohne Rückfahrkarte, das alte Verhalten.
  if (zeilen.length) {
    const neu = rueckfahrkarte
      ? { booking_id: null, status: 'planned' }
      : { status: 'no_show' };
    const { error } = await supabase
      .from('prescription_sessions').update(neu)
      .eq('booking_id', booking.id).neq('status', 'cancelled');
    if (error) throw error;
  }

  // 6. Verordnungsfortschritt nachziehen: die Zahlen der Verordnung haben sich
  //    gerade verschoben, und ein Rezept in `parsed`/`confirmed` gehört danach
  //    auf `in_therapy`. Ein fälschliches „fertig" kann dabei nicht entstehen —
  //    `erbracht` zählt nur `done`. Die Gegenrichtung (ein bereits fertiges
  //    Rezept wieder aufmachen) macht diese Funktion bewusst nicht; warum,
  //    steht in module/sitzungsfortschritt.js.
  //    Fehler hier dürfen den Vorgang nicht zurückdrehen: der Termin ist schon
  //    geschrieben, und die Prüfung läuft beim nächsten Abhaken erneut.
  const rezepte = [...new Set(zeilen.map(z => z.prescription_id).filter(Boolean))];
  for (const id of rezepte) {
    try { await fortschritt(supabase, id); }
    catch (e) { console.error('[nicht-erschienen] Fortschritt', id, e); }
  }

  if (rezepte.length) emit('verordnungen:changed', { quelle: 'no_show' });

  return { freigegeben: rueckfahrkarte ? zeilen.length : 0, rezepte, rueckfahrkarte };
}

/**
 * Rueckfall-`prescription_id` fuer den Seitenbereich (`openBookingActionModal()`),
 * wenn der Termin no_show ist und der Live-Join (`booking.prescription_sessions`)
 * schon leer ist — `markiereNichtErschienen()` hat `booking_id` ja gerade
 * freigegeben (Schritt 5 oben). Ohne diesen Rueckfall verschwand die ganze
 * Rezeptinfo-/Sitzungsplan-Karte, sobald man einen ausgefallenen Termin ein
 * zweites Mal oeffnete — sichtbar sollte nur zusaetzlich „Status korrigieren"
 * werden, nicht das ganze Panel (Ops a8186cb8, Nachkontrolle 16.09.2026).
 *
 * Nimmt den JUENGSTEN Eintrag der Rueckfahrkarte — bei Mehrfachausfall (Ops-
 * Korrektur und erneutes no_show am selben Termin) ist das der aktuelle Stand.
 *
 * @param {{status?:string, no_show_session_links?:Array}} booking
 * @param {object|null} ps  der Live-Join, falls vorhanden (dann Vorrang, hier nichts zu tun)
 * @returns {string|null}
 */
export function rueckfahrkarteRxId(booking, ps) {
  if (ps || booking?.status !== 'no_show') return null;
  const links = booking?.no_show_session_links;
  if (!Array.isArray(links) || !links.length) return null;
  return links[links.length - 1]?.prescription_id || null;
}

/**
 * Welche der offenen Einheiten sind durch einen Ausfall wieder frei geworden —
 * und wann?
 *
 * Kemal, 31.08.2026, wörtlich: „Dieser Termin, weil er nicht stattgefunden hat,
 * soll sich zu [den] unvergebenen Terminen mit einer roten Markierung bewegen,
 * dass man das auch sieht." Die Bewegung selbst macht `markiereNichtErschienen()`
 * oben. Diese Funktion liefert das, was dafür noch fehlte: die Unterscheidung
 * zwischen „noch nie vergeben" und „ausgefallen, muss nachgeholt werden". Ohne
 * sie stehen beide als dieselbe graue Zeile da, und die Praxis weiss nicht,
 * welche der neun offenen Einheiten diejenige ist, für die sie anrufen muss.
 *
 * Gelesen wird `bookings.no_show_session_links` (Migration 0016) — die
 * Rückfahrkarte, die beim Ausfall geschrieben wird. Eine eigene Spalte an der
 * Sitzungszeile wäre der zweite Ort für dieselbe Aussage; genau das vermeidet
 * die Entscheidung vom 14.09.2026 („die Sitzungszeile ist ein Zähler, kein
 * Tagebuch").
 *
 * Eine inzwischen neu vergebene Einheit taucht hier trotzdem auf — der Aufrufer
 * zeigt ohnehin nur die offenen an, und ihn das entscheiden zu lassen ist
 * billiger als hier eine zweite Abfrage zu fahren.
 *
 * Fehler sind hier folgenlos: ohne Markierung ist die Liste wie vorher.
 *
 * @returns {Promise<Map<string, string>>} session_id → ISO-Zeit des Ausfalls
 */
export async function ausgefalleneEinheiten(supabase, { leadId } = {}) {
  const leer = new Map();
  if (!supabase || !leadId) return leer;
  const { data, error } = await supabase
    .from('bookings')
    .select(`id, start_time, ${FELD_LINKS}`)
    .eq('lead_id', leadId)
    .eq('status', 'no_show');
  if (error || !data?.length) return leer;

  const raus = new Map();
  for (const b of data) {
    for (const l of einmalJeSitzung(b?.[FELD_LINKS])) {
      // Der jüngste Ausfall gewinnt: dieselbe Einheit kann mehrfach ausgefallen
      // sein, und die Praxis interessiert der letzte Termin, nicht der erste.
      const bisher = raus.get(l.session_id);
      if (!bisher || new Date(b.start_time) > new Date(bisher)) raus.set(l.session_id, b.start_time);
    }
  }
  return raus;
}

/**
 * Rückweg: die bei einem no_show freigegebenen Einheiten wieder an den Termin
 * binden und als erbracht zählen. Gegenstück zu Schritt 4/5 oben, gerufen aus
 * `korrigiereNoShow()`.
 *
 * Gebunden wird nur, was noch frei ist (`booking_id IS NULL`). Zwischen no_show
 * und Korrektur können Tage liegen — ist die Einheit inzwischen auf einen
 * Nachholtermin gebucht, gehört sie dorthin und nicht zurück. Sie wird dann
 * übersprungen, nicht überschrieben.
 *
 * @returns {Promise<{wiederverbunden:number, uebersprungen:number}>}
 */
export async function rebindeNoShowSitzungen(supabase, booking, opts = {}) {
  const { fortschritt = pruefeVerordnungsfortschritt } = opts;
  if (!supabase || !booking?.id) return { wiederverbunden: 0, uebersprungen: 0 };

  let links = Array.isArray(booking[FELD_LINKS]) ? booking[FELD_LINKS] : null;
  if (!links) {
    const { data, error } = await supabase
      .from('bookings').select(FELD_LINKS).eq('id', booking.id).maybeSingle();
    if (error) return { wiederverbunden: 0, uebersprungen: 0 };
    links = Array.isArray(data?.[FELD_LINKS]) ? data[FELD_LINKS] : [];
  }

  let wiederverbunden = 0;
  let uebersprungen = 0;
  const rezepte = new Set();
  for (const l of einmalJeSitzung(links)) {
    const { data, error } = await supabase
      .from('prescription_sessions')
      .update({ booking_id: booking.id, status: 'done' })
      .eq('id', l.session_id)
      .is('booking_id', null)
      .select('id');
    if (error || !data || !data.length) { uebersprungen++; continue; }
    wiederverbunden++;
    if (l.prescription_id) rezepte.add(l.prescription_id);
  }

  // Dieselbe Nachprüfung wie beim Setzen des no_show: die wiedergewonnene Einheit
  // kann ein Rezept fertig behandelt machen (und damit abrechnungsbereit).
  for (const id of rezepte) {
    try { await fortschritt(supabase, id); }
    catch (e) { console.error('[nicht-erschienen] Fortschritt (Korrektur)', id, e); }
  }
  if (wiederverbunden) emit('verordnungen:changed', { quelle: 'no_show-korrektur' });

  return { wiederverbunden, uebersprungen };
}
