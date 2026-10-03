/**
 * api-backend/billing/utils/podo-empfangsnachweis.js
 *
 * Gemeinsamer Prüf-Helper für den podologischen Empfangsnachweis (§ 302 SGB V, HPNR 78040).
 *
 * HINWEIS / COMPLIANCE:
 * Bei diesem Nachweis handelt es sich um eine Bestätigung der Vollständigkeit und formellen Prüfung
 * des papierhaften Empfangsnachweises (Versichertenbestätigung auf der Verordnungsrückseite / Beleg).
 * Es handelt sich NICHT um eine qualifizierte elektronische Patientensignatur und NICHT um die
 * technische DAS-Abrechnungsquittung. Das Original-Papierrezept mit den handschriftlichen
 * Patientenunterschriften verbleibt gemäß den gesetzlichen Aufbewahrungsfristen bei der Praxis.
 */

/**
 * Prüft, ob ein HPNR-Codes-Feld die Kernposition 78040 enthält.
 * @param {string[]|string|null|undefined} codes
 * @returns {boolean}
 */
export function enthaeltHpnr78040(codes) {
  if (Array.isArray(codes)) {
    return codes.includes('78040');
  }
  return false;
}

/**
 * Validiert alle abrechnungsrelevanten podologischen Behandlungen gegen den Prüflog
 * `podologie_empfangsnachweise`.
 *
 * Vertrag & Erwartung:
 * - Der Aufrufer übergibt vorab gefilterte GKV-Podologie-Behandlungen (§ 302 SGB V).
 *   Die drei Produktiv-Aufrufer filtern bzw. weisen Privat- und Fremdbereiche vorab ab.
 * - Optionale Parameter `therapieBereich` und `rezeptart` können explizit übergeben werden:
 *   Handelt es sich nicht um GKV ('kassen') oder nicht um Podologie ('podo'/'podologie'),
 *   wird die Prüfung ohne Datenbankabfrage mit { ok: true, gepruefteIds: [] } übersprungen.
 * - Relevante 78040-Behandlungen müssen vollständig sein (ID und Behandlungsdatum Pflicht).
 *   Fehlende ID oder Behandlungsdatum führt zwingend zu Fail-Closed (Status 422).
 * - Für jede relevante 78040-Behandlung muss der neueste Eintrag (nach monotonem event_seq)
 *   den Status 'bestaetigt' tragen.
 * - Die Snapshots (owner_id, behandlung_id, hpnr_code '78040', behandlungsdatum) müssen
 *   exakt mit der aktuellen Behandlung übereinstimmen.
 * - Therapeuteninitialen müssen zwischen 1 und 16 Zeichen lang sein.
 * - Fehlend, widerrufen oder unvollständig führt zu kontrolliertem Status 422.
 * - Datenbankfehler führen zu Fail-Closed mit Status 503.
 *
 * @param {object} params
 * @param {object} params.supabase Service-Role Supabase Client
 * @param {string} params.tenantId Owner-UUID des Praxismandanten
 * @param {Array<object>} params.behandlungen Liste von Behandlungsdatensätzen
 * @param {string} [params.verordnungId] Optionale Verordnungs-ID
 * @param {string} [params.therapieBereich] Optionaler Therapiebereich ('podo' / 'podologie')
 * @param {string} [params.rezeptart] Optionale Rezeptart ('kassen')
 * @returns {Promise<{ ok: boolean, status?: number, error?: string, fehlendeBehandlungIds?: string[], gepruefteIds?: string[] }>}
 */
export async function pruefePodologieEmpfangsnachweise({
  supabase,
  tenantId,
  behandlungen,
  verordnungId,
  therapieBereich,
  rezeptart,
}) {
  if (!supabase || !tenantId) {
    return {
      ok: false,
      status: 503,
      error: 'Prüfdienst nicht verfügbar (Mandant oder Datenbankverbindung fehlt)',
    };
  }

  // Optionale Bereichs- und Kassenfilter: fremde Bereiche ohne DB-Query überspringen
  if (therapieBereich !== undefined && therapieBereich !== null) {
    const tb = String(therapieBereich).trim().toLowerCase();
    if (tb !== 'podo' && tb !== 'podologie') {
      return { ok: true, gepruefteIds: [] };
    }
  }

  if (rezeptart !== undefined && rezeptart !== null) {
    const rx = String(rezeptart).trim().toLowerCase();
    if (rx !== 'kassen') {
      return { ok: true, gepruefteIds: [] };
    }
  }

  if (!Array.isArray(behandlungen)) {
    return {
      ok: false,
      status: 503,
      error: 'Empfangsnachweis-Prüfung vorübergehend nicht verfügbar (Ungültiges Behandlungsformat)',
    };
  }

  // Filter und strenge Validierung nicht-stornierter 78040-Behandlungen
  const relevanteBehs = [];
  for (const b of behandlungen) {
    if (!b || typeof b !== 'object' || Array.isArray(b)) {
      return {
        ok: false,
        status: 503,
        error: 'Empfangsnachweis-Prüfung vorübergehend nicht verfügbar (Ungültiger Behandlungsdatensatz)',
      };
    }

    if (b.storniert_am) {
      continue;
    }

    if (!Array.isArray(b.hpnr_codes) || !b.hpnr_codes.every(c => typeof c === 'string')) {
      return {
        ok: false,
        status: 503,
        error: 'Empfangsnachweis-Prüfung vorübergehend nicht verfügbar (Ungültige HPNR-Positionsdaten)',
      };
    }

    if (enthaeltHpnr78040(b.hpnr_codes)) {
      relevanteBehs.push(b);
    }
  }

  // Keine relevanten 78040-Behandlungen -> kein Read, keine Blockade
  if (relevanteBehs.length === 0) {
    return { ok: true, gepruefteIds: [] };
  }

  // Fail-Closed: Jede relevante 78040-Behandlung MUSS id und behandlungsdatum besitzen.
  // Keine Fallback-Queries, die Zeilenbestände erfinden oder annehmen.
  const unvollstaendige = relevanteBehs.filter(b => !b.id || !b.behandlungsdatum);
  if (unvollstaendige.length > 0) {
    return {
      ok: false,
      status: 422,
      error: 'Empfangsnachweis-Prüfung fehlgeschlagen: Behandlungsdatensatz unvollständig (ID oder Behandlungsdatum fehlt)',
      fehlendeBehandlungIds: unvollstaendige.map(b => b.id).filter(Boolean),
    };
  }

  const behIds = [...new Set(relevanteBehs.map(b => b.id))];

  // Mandantenspezifische, streng eingegrenzte Abfrage der Prüfereignisse
  const { data: events, error: evErr } = await supabase
    .from('podologie_empfangsnachweise')
    .select('id, event_seq, owner_id, behandlung_id, behandlungsdatum, hpnr_code, therapeuteninitialen, status')
    .eq('owner_id', tenantId)
    .in('behandlung_id', behIds)
    .order('event_seq', { ascending: false });

  if (evErr) {
    return {
      ok: false,
      status: 503,
      error: 'Empfangsnachweis-Prüfung vorübergehend nicht verfügbar (Datenbankfehler)',
    };
  }

  if (!Array.isArray(events)) {
    return {
      ok: false,
      status: 503,
      error: 'Empfangsnachweis-Prüfung vorübergehend nicht verfügbar (Ungültige Ereignisdaten)',
    };
  }

  const validEvents = [];
  for (const ev of events) {
    if (!ev || typeof ev !== 'object' || Array.isArray(ev)) {
      return {
        ok: false,
        status: 503,
        error: 'Empfangsnachweis-Prüfung vorübergehend nicht verfügbar (Ungültiges Ereignisformat)',
      };
    }

    let seqBigInt = null;
    try {
      if (typeof ev.event_seq === 'number') {
        if (Number.isSafeInteger(ev.event_seq) && ev.event_seq > 0) {
          seqBigInt = BigInt(ev.event_seq);
        }
      } else if (typeof ev.event_seq === 'string') {
        const trimmed = ev.event_seq.trim();
        if (/^[1-9]\d*$/.test(trimmed)) {
          seqBigInt = BigInt(trimmed);
        }
      }
    } catch {
      seqBigInt = null;
    }

    if (seqBigInt === null || seqBigInt <= 0n) {
      return {
        ok: false,
        status: 503,
        error: 'Empfangsnachweis-Prüfung vorübergehend nicht verfügbar (Ungültige Ereignis-Sequenz in der Datenbank)',
      };
    }

    validEvents.push({ ev, seq: seqBigInt });
  }

  // Neuestes Ereignis je Behandlung nach monotonem event_seq (BigInt descending) ermitteln
  validEvents.sort((a, b) => (b.seq > a.seq ? 1 : b.seq < a.seq ? -1 : 0));
  const latestEventByBeh = new Map();
  for (const item of validEvents) {
    if (!latestEventByBeh.has(item.ev.behandlung_id)) {
      latestEventByBeh.set(item.ev.behandlung_id, item.ev);
    }
  }

  const fehlendeIds = [];

  for (const b of relevanteBehs) {
    const latest = latestEventByBeh.get(b.id);
    if (!latest) {
      fehlendeIds.push(b.id);
      continue;
    }

    // Status muss bestätigt sein (Widerruf blockiert)
    if (latest.status !== 'bestaetigt') {
      fehlendeIds.push(b.id);
      continue;
    }

    // Mandantensnapshot prüfen
    if (latest.owner_id !== tenantId || (b.owner_id && latest.owner_id !== b.owner_id)) {
      fehlendeIds.push(b.id);
      continue;
    }

    // Behandlungssnapshot prüfen
    if (latest.behandlung_id !== b.id) {
      fehlendeIds.push(b.id);
      continue;
    }

    // Exakter HPNR-Snapshot 78040
    if (latest.hpnr_code !== '78040') {
      fehlendeIds.push(b.id);
      continue;
    }

    // Behandlungstag-Snapshot prüfen (Pflichtabgleich, kein Fail-Open bei fehlendem Nachweisdatum)
    if (!latest.behandlungsdatum || latest.behandlungsdatum !== b.behandlungsdatum) {
      fehlendeIds.push(b.id);
      continue;
    }

    // Therapeuteninitialen (1..16 Zeichen nach Trimmen)
    const initialen = typeof latest.therapeuteninitialen === 'string'
      ? latest.therapeuteninitialen.trim()
      : '';
    if (initialen.length < 1 || initialen.length > 16) {
      fehlendeIds.push(b.id);
      continue;
    }
  }

  if (fehlendeIds.length > 0) {
    return {
      ok: false,
      status: 422,
      error: `Empfangsnachweis (Papierbeleg-Prüfung HPNR 78040) fehlt oder wurde widerrufen für Behandlung(en): ${fehlendeIds.join(', ')}`,
      fehlendeBehandlungIds: fehlendeIds,
    };
  }

  return {
    ok: true,
    gepruefteIds: behIds,
  };
}
