/**
 * module/tageszentrale-logik.js — Reine Aufbereitung für das neue Dashboard (#panel-overview).
 *
 * Hält Tageszeit-Gruß, laufenden/nächsten Termin, Tagesfortschritt, buchbare freie Lücken,
 * chronologische Zeitleiste (Termine + Lücken) und priorisierten Handlungsbedarf frei von DOM-Zugriffen.
 * Keine Emojis; Zeitberechnung konsequent in Europe/Berlin.
 */

const TZ = 'Europe/Berlin';

/** @param {Date} [jetzt] */
export function berlinIsoTag(jetzt = new Date()) {
  return jetzt.toLocaleDateString('sv-SE', { timeZone: TZ });
}

/**
 * Monotoner Laufzähler (Generation-Guard) gegen überholte asynchrone Antworten
 * bei schnellen Klicks auf die Datumsnavigation (F-05).
 */
export function erstelleLaufWaechter() {
  let nr = 0;
  return {
    start() { return ++nr; },
    /** @param {number} lauf */
    istAktuell(lauf) { return lauf === nr; },
    aktuell() { return nr; },
  };
}

/**
 * Verschiebt ein Datum um `deltaTage` Kalendertage in Europe/Berlin (DST-sicher).
 * `deltaTage === 0` liefert den heutigen Berliner Kalendertag.
 * Rückgabe ist ein Date um 12:00 Uhr Ortszeit des Zieltags (kein Mitternachts-Drift).
 *
 * @param {Date|null|undefined} datum
 * @param {number} deltaTage
 * @param {Date} [heute]
 * @returns {Date}
 */
export function tagVerschiebenDatum(datum, deltaTage, heute = new Date()) {
  const basisIso = deltaTage === 0 ? berlinIsoTag(heute) : berlinIsoTag(datum || heute);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(basisIso);
  if (!m) return new Date(heute);
  const u = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + deltaTage));
  return new Date(`${u.toISOString().slice(0, 10)}T12:00:00`);
}

/**
 * Bestimmt den vorbelegten Startzeitpunkt (`YYYY-MM-DDTHH:MM`) für „Termin anlegen“
 * und „Neuer Termin“ auf dem Dashboard (F-03, Zusatz 9.4a/9.4b).
 *
 * - Heute: erste freie Lücke oder nächste freie 15-Min.-Uhrzeit in Europe/Berlin (ab 09:00).
 * - Zukunft: gewählter Tag + erste freie Lücke oder 09:00 (wie Monatsansicht).
 * - Vergangenheit: weicht auf heute + nächste freie Zeit aus und liefert einen Hinweis,
 *   damit die bestehende `bkStart.min`-Sperre erhalten bleibt.
 *
 * @param {string|null|undefined} zielIso
 * @param {{ heuteIso?: string, luecken?: Array<{ start?: string }>, jetzt?: Date }} [opts]
 * @returns {{ startIso: string, aufHeuteAusgewichen: boolean, hinweis: string | null }}
 */
export function terminStartFuerTag(zielIso, { heuteIso, luecken = [], jetzt = new Date() } = {}) {
  const heute = heuteIso || berlinIsoTag(jetzt);
  const ziel = typeof zielIso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(zielIso) ? zielIso : heute;
  const jetztMin = berlinMinuten(jetzt);
  const naechsteHeute = (offeneLuecken) => {
    const erste = Array.isArray(offeneLuecken) ? offeneLuecken.find((l) => /^\d{2}:\d{2}$/.test(String(l?.start || ''))) : null;
    if (erste?.start) return erste.start;
    if (jetztMin < 9 * 60) return '09:00';
    const aufgerundet = Math.ceil((jetztMin + 1) / 15) * 15;
    return minutenZuHhMm(aufgerundet <= 23 * 60 + 45 ? aufgerundet : jetztMin);
  };

  if (ziel < heute) {
    return {
      startIso: `${heute}T${naechsteHeute([])}`,
      aufHeuteAusgewichen: true,
      hinweis: 'Vergangener Tag gewählt – Terminbeginn wurde auf heute vorbelegt.',
    };
  }
  if (ziel === heute) {
    return {
      startIso: `${heute}T${naechsteHeute(luecken)}`,
      aufHeuteAusgewichen: false,
      hinweis: null,
    };
  }
  const erste = Array.isArray(luecken) ? luecken.find((l) => /^\d{2}:\d{2}$/.test(String(l?.start || ''))) : null;
  return {
    startIso: `${ziel}T${erste?.start || '09:00'}`,
    aufHeuteAusgewichen: false,
    hinweis: null,
  };
}

/** @param {Date} [jetzt] */
export function berlinMinuten(jetzt = new Date()) {
  const teile = new Intl.DateTimeFormat('de-DE', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(jetzt);
  const h = Number(teile.find((p) => p.type === 'hour')?.value || 0);
  const m = Number(teile.find((p) => p.type === 'minute')?.value || 0);
  return (h === 24 ? 0 : h) * 60 + m;
}

/** @param {string|Date} ts */
export function berlinZeitHhMm(ts) {
  const d = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(d.getTime())) return '00:00';
  return d.toLocaleTimeString('de-DE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
}

/** @param {string} hhmm */
export function hhmmZuMinuten(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** @param {number} min */
export function minutenZuHhMm(min) {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(min)));
  const h = String(Math.floor(clamped / 60)).padStart(2, '0');
  const m = String(clamped % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/** @param {number} min */
export function dauerKurzText(min) {
  const n = Math.max(0, Math.round(Number(min) || 0));
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h > 0 && m > 0) return `${h} h ${m} min`;
  if (h > 0) return `${h} h`;
  return `${m} min`;
}

/** @param {number} n */
export function terminAnzahlText(n) {
  return n === 1 ? '1 Termin' : `${n} Termine`;
}

/**
 * Liefert Pill, Titel und Meta-Text für den leeren/abgeschlossenen Hero-Zustand
 * abhängig von Zeitbezug (heute, Vergangenheit, Zukunft) und Tagesbelegung (F-06).
 *
 * @param {{
 *   istHeute?: boolean,
 *   istVergangenheit?: boolean,
 *   gesamt?: number,
 *   erledigt?: number,
 *   lueckenMin?: number,
 *   lueckenFehler?: boolean,
 * }} [opts]
 * @returns {{ pill: string, titel: string, meta: string }}
 */
export function heroLeerStatusTexte({
  istHeute = false,
  istVergangenheit = false,
  gesamt = 0,
  erledigt = 0,
  lueckenMin = 0,
  lueckenFehler = false,
} = {}) {
  const hatTermine = gesamt > 0;
  const standardMeta = !lueckenFehler && lueckenMin > 0
    ? `${dauerKurzText(lueckenMin)} buchbare Zeit verfügbar.`
    : 'Neuen Termin anlegen oder nächsten Tag prüfen.';

  if (istHeute) {
    return hatTermine
      ? { pill: 'Alle heutigen Termine erledigt', titel: 'Feierabend im Tagesplan', meta: standardMeta }
      : { pill: 'Keine offenen Termine heute', titel: 'Tag ist aktuell frei', meta: standardMeta };
  }
  if (istVergangenheit) {
    return hatTermine
      ? {
          pill: 'Alle Termine abgeschlossen',
          titel: 'Tag abgeschlossen',
          meta: erledigt === gesamt
            ? `${terminAnzahlText(gesamt)} abgeschlossen.`
            : `${erledigt} von ${gesamt} Terminen abgeschlossen.`,
        }
      : {
          pill: 'Keine Termine an diesem Tag',
          titel: 'Keine Termine dokumentiert',
          meta: 'Nächsten Tag prüfen oder neuen Termin für heute anlegen.',
        };
  }
  return hatTermine
    ? { pill: 'Alle Termine erledigt', titel: 'Keine offenen Termine', meta: standardMeta }
    : { pill: 'Keine Termine geplant', titel: 'Tag ist aktuell frei', meta: standardMeta };
}

/** @param {Date} [jetzt] */
export function tageszeitGruss(jetzt = new Date()) {
  const min = berlinMinuten(jetzt);
  if (min < 11 * 60) return 'Guten Morgen';
  if (min < 17 * 60) return 'Guten Tag';
  return 'Guten Abend';
}

/**
 * Formatiert ein Datum wie „Freitag, 20. November“.
 * @param {Date} [datum]
 */
export function datumLangDeutsch(datum = new Date()) {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(datum);
}

/**
 * Extrahiert Sitzungsfortschritt „VO 4/6“ falls am Termin eine Verordnung hängt.
 * @param {any} b
 */
function verordnungFortschritt(b) {
  const sess = Array.isArray(b?.prescription_sessions) ? b.prescription_sessions[0] : null;
  const rx = b?.prescriptions || b?.prescription || sess?.prescriptions || null;
  if (!rx || typeof rx !== 'object') return '';
  const gesamt = Number(rx.anzahl_einheiten || rx.verordnete_menge || rx.menge || 0);
  if (!Number.isFinite(gesamt) || gesamt <= 0) return rx.diagnosegruppe ? String(rx.diagnosegruppe) : '';
  const erledigt = Number(sess?.session_number) > 0
    ? Number(sess.session_number)
    : Array.isArray(rx.prescription_sessions)
      ? rx.prescription_sessions.filter((s) => s?.status === 'done').length
      : Number(rx.erledigte_einheiten || 0);
  const dg = rx.diagnosegruppe ? `${rx.diagnosegruppe} · ` : '';
  return `${dg}VO ${erledigt}/${gesamt}`;
}

/**
 * Bereitet die Buchungen eines Tages für Hero, Fortschrittsbalken und chronologischen Tagesplan auf.
 *
 * @param {Array<any>} bookings
 * @param {{ heuteIso?: string, zielIso?: string, jetzt?: Date, teamMap?: Map<string, string>, eigeneId?: string | null, istOwner?: boolean }} [opts]
 */
export function buchungenFuerTagAufbereiten(bookings, opts = {}) {
  const jetzt = opts.jetzt instanceof Date ? opts.jetzt : new Date();
  const heuteIso = opts.heuteIso || berlinIsoTag(jetzt);
  const zielIso = opts.zielIso || heuteIso;
  const istHeute = zielIso === heuteIso;
  const istVergangenheit = zielIso < heuteIso;
  const jetztMs = jetzt.getTime();
  const teamMap = opts.teamMap instanceof Map ? opts.teamMap : new Map();

  const gefiltert = (Array.isArray(bookings) ? bookings : [])
    .filter((b) => b && b.status !== 'cancelled' && !b.group_parent_id)
    .filter((b) => opts.istOwner !== false || !opts.eigeneId || b.user_id === opts.eigeneId);

  /** @type {Array<any>} */
  const eintraege = gefiltert
    .map((b) => {
      const startMs = new Date(b.start_time).getTime();
      let endMs = b.end_time ? new Date(b.end_time).getTime() : NaN;
      if (Number.isNaN(endMs) || endMs <= startMs) endMs = startMs + 30 * 60000;
      const dauerMin = Math.max(5, Math.round((endMs - startMs) / 60000));
      const startHhMm = berlinZeitHhMm(new Date(startMs));
      const endHhMm = berlinZeitHhMm(new Date(endMs));
      const startMin = hhmmZuMinuten(startHhMm) ?? 0;

      const abgeschlossen = b.status === 'completed' || b.status === 'done';
      const noShow = b.status === 'no_show';
      const laeuft = istHeute && !abgeschlossen && !noShow && startMs <= jetztMs && jetztMs < endMs;
      const vorbei = istVergangenheit || abgeschlossen || noShow || (istHeute && endMs <= jetztMs);
      const restMin = laeuft ? Math.max(1, Math.ceil((endMs - jetztMs) / 60000)) : 0;
      const inMin = istHeute && !vorbei && !laeuft ? Math.max(1, Math.ceil((startMs - jetztMs) / 60000)) : null;

      const leistung = b.services?.title || b.service_title || 'Termin';
      const patient = String(b.customer_name || '')
        .replace(/\s*·\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{4})$/, '')
        .trim() || 'Patient';
      const behandlerId = b.user_id || '';
      const behandler = teamMap.get(behandlerId) || '';
      const vo = verordnungFortschritt(b);

      return {
        id: b.id,
        raw: b,
        leadId: b.lead_id || null,
        behandlerId,
        behandler,
        patient,
        leistung,
        vo,
        hausbesuch: !!b.hausbesuch,
        startMs,
        endMs,
        startMin,
        startHhMm,
        endHhMm,
        dauerMin,
        status: b.status || 'confirmed',
        abgeschlossen,
        noShow,
        laeuft,
        vorbei,
        restMin,
        inMin,
      };
    })
    .sort((a, b) => a.startMs - b.startMs);

  const gesamt = eintraege.length;
  const erledigt = eintraege.filter((e) => e.vorbei).length;
  const offen = Math.max(0, gesamt - erledigt);
  const hausbesuche = eintraege.filter((e) => e.hausbesuch).length;
  const prozent = gesamt > 0 ? Math.round((erledigt / gesamt) * 100) : 0;

  const aktuell = eintraege.find((e) => e.laeuft) || null;
  const naechster = eintraege.find((e) => !e.vorbei && !e.laeuft) || null;

  /** @type {Map<string, { id: string, name: string, count: number }>} */
  const chipMap = new Map();
  for (const e of eintraege) {
    if (!e.behandlerId || !e.behandler) continue;
    const cur = chipMap.get(e.behandlerId) || { id: e.behandlerId, name: e.behandler, count: 0 };
    cur.count += 1;
    chipMap.set(e.behandlerId, cur);
  }
  const behandlerChips = Array.from(chipMap.values());

  return {
    alle: eintraege,
    gesamt,
    erledigt,
    offen,
    hausbesuche,
    prozent,
    aktuell,
    naechster,
    behandlerChips,
  };
}

/**
 * Parst Zeitlücken (`HH:MM - HH:MM`) aus dem gerenderten `#gapsList`-Knoten und schneidet
 * für heute bereits abgelaufene Minuten sauber ab (Mindestdauer 15 Min).
 *
 * @param {Array<{ start: string, end: string }>} roheLuecken
 * @param {{ istHeute?: boolean, istVergangenheit?: boolean, jetzt?: Date, minDauer?: number }} [opts]
 */
export function lueckenFiltern(roheLuecken, opts = {}) {
  const minDauer = Number.isFinite(opts.minDauer) ? Number(opts.minDauer) : 15;
  if (opts.istVergangenheit) return { luecken: [], gesamtMin: 0 };
  const jetztMin = opts.istHeute ? berlinMinuten(opts.jetzt || new Date()) : 0;

  /** @type {Array<{ start: string, end: string, startMin: number, endMin: number, min: number }>} */
  const luecken = [];
  for (const g of Array.isArray(roheLuecken) ? roheLuecken : []) {
    const sRaw = hhmmZuMinuten(g?.start);
    const eRaw = hhmmZuMinuten(g?.end);
    if (sRaw === null || eRaw === null || eRaw <= sRaw) continue;
    let s = sRaw;
    if (opts.istHeute && s < jetztMin) {
      // Auf nächste 5 Minuten aufrunden, damit keine vergangene Minute gebucht wird
      s = Math.ceil(jetztMin / 5) * 5;
    }
    const dauer = eRaw - s;
    if (dauer < minDauer) continue;
    luecken.push({
      start: minutenZuHhMm(s),
      end: minutenZuHhMm(eRaw),
      startMin: s,
      endMin: eRaw,
      min: dauer,
    });
  }
  luecken.sort((a, b) => a.startMin - b.startMin);
  const gesamtMin = luecken.reduce((sum, g) => sum + g.min, 0);
  return { luecken, gesamtMin };
}

/**
 * Führt Termine und buchbare Lücken chronologisch zusammen.
 *
 * @param {Array<any>} termine
 * @param {Array<{ start: string, end: string, startMin: number, endMin: number, min: number }>} luecken
 * @param {{ behandlerFilter?: string, nurLuecken?: boolean }} [opts]
 */
export function zeitleisteZusammenfuehren(termine, luecken, opts = {}) {
  const filter = opts.behandlerFilter || 'all';
  const nurLuecken = !!opts.nurLuecken;

  /** @type {Array<{ typ: 'termin' | 'luecke', sortMin: number, daten: any }>} */
  const zeilen = [];
  if (!nurLuecken) {
    for (const t of Array.isArray(termine) ? termine : []) {
      if (filter !== 'all' && t.behandlerId !== filter) continue;
      zeilen.push({ typ: 'termin', sortMin: t.startMin, daten: t });
    }
  }
  for (const l of Array.isArray(luecken) ? luecken : []) {
    zeilen.push({ typ: 'luecke', sortMin: l.startMin, daten: l });
  }
  zeilen.sort((a, b) => {
    if (a.sortMin !== b.sortMin) return a.sortMin - b.sortMin;
    if (a.typ === b.typ) return 0;
    return a.typ === 'termin' ? -1 : 1;
  });
  return zeilen;
}

/**
 * Baut aus vorhandenen Überblick-Ergebnissen eine priorisierte Liste (max. 4 Zeilen)
 * für die rechte Spalte „Handlungsbedarf“.
 *
 * @param {{ fristen?: Array<any>, berichte?: Array<any>, anfragen?: Array<any>, warteliste?: Array<any> }} daten
 */
export function handlungsbedarfZusammenfassen(daten = {}) {
  const fristen = Array.isArray(daten.fristen) ? daten.fristen : [];
  const berichte = Array.isArray(daten.berichte) ? daten.berichte : [];
  const anfragen = Array.isArray(daten.anfragen) ? daten.anfragen : [];
  const warteliste = Array.isArray(daten.warteliste) ? daten.warteliste : [];

  const fristenUeberfaellig = fristen.filter((f) => f.schwere === 'danger').length;
  /** @type {Array<{ kategorie: 'frist'|'anfrage'|'bericht'|'warteliste', schwere: 'danger'|'accent'|'neutral', titel: string, sub: string, cta: string, aktion: string, id: string, quelle?: string, leadId?: string }>} */
  const liste = [];

  for (const f of fristen.filter((x) => x.schwere === 'danger' || x.schwere === 'warning').slice(0, 2)) {
    const frist = f.fristLabel || f.fristText || 'Beginnfrist';
    const kontext = f.kontextMeta || f.leistung || '';
    liste.push({
      kategorie: 'frist',
      schwere: f.schwere === 'danger' ? 'danger' : 'neutral',
      titel: f.patientName || 'Verordnung',
      sub: [frist, kontext].filter(Boolean).join(' · '),
      cta: 'Rezept',
      aktion: 'rezept',
      id: String(f.rxId || ''),
      quelle: f.quelle || 'physio',
      leadId: String(f.patientId || f.leadId || ''),
    });
  }

  for (const a of anfragen.slice(0, 2)) {
    const wunsch = a.wunsch || a.wunschText || '';
    const sub = [wunsch, a.leistung, a.art].filter(Boolean).join(' · ') || 'Online-Terminanfrage';
    liste.push({
      kategorie: 'anfrage',
      schwere: 'accent',
      titel: a.name && a.name !== 'Anfrage' ? `${a.name} · Anfrage` : 'Online-Terminanfrage',
      sub,
      cta: 'Prüfen',
      aktion: 'anfrage',
      id: String(a.id || ''),
    });
  }

  for (const b of berichte.slice(0, 1)) {
    const pid = String(b.patientId || b.leadId || '');
    const rxId = String(b.rxId || '');
    const nurRezept = !pid && !!rxId;
    liste.push({
      kategorie: 'bericht',
      schwere: 'neutral',
      titel: `${b.patientName || 'Patient'} · Bericht`,
      sub: [b.kontextMeta || b.detail || 'Therapiebericht offen', 'Therapiebericht fällig'].filter(Boolean).join(' · '),
      cta: nurRezept ? 'Rezept' : 'Akte',
      aktion: nurRezept ? 'rezept' : 'patient',
      id: nurRezept ? rxId : pid,
      quelle: b.quelle || 'physio',
      leadId: pid,
    });
  }

  for (const w of warteliste.slice(0, 1)) {
    const prio = w.prioLabel && w.prioLabel !== 'Normal' ? w.prioLabel : w.prioText || '';
    liste.push({
      kategorie: 'warteliste',
      schwere: 'neutral',
      titel: `${w.name || 'Patient'} · Warteliste`,
      sub: [w.leistung, prio, w.wartetLabel].filter(Boolean).join(' · ') || 'Wartet auf freien Termin',
      cta: 'Öffnen',
      aktion: 'warteliste',
      id: String(w.id || ''),
    });
  }

  return {
    counts: {
      fristen: fristen.length,
      fristenUeberfaellig,
      anfragen: anfragen.length,
      warteliste: warteliste.length,
      berichte: berichte.length,
      gesamt: fristen.length + anfragen.length + warteliste.length + berichte.length,
    },
    eintraege: liste.slice(0, 4),
  };
}
