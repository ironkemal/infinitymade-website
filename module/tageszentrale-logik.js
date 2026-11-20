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
