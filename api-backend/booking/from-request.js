// Termine aus einer bestätigten Terminanfrage anlegen.
//
// Liegt bewusst ausserhalb von server.js: server.js laesst sich nicht importieren
// (es startet beim Import den Server und braucht echte Env-Variablen), deshalb waere
// diese Logik dort nicht testbar — und genau hier steckte der Fehler, dass in
// bookings die Spalte employee_id beschrieben wurde, die es gar nicht gibt.
//
// Wichtig fuer alle Aenderungen hier:
//   * Der Therapeut steht in bookings.user_id (NOT NULL). Eine Spalte employee_id
//     gibt es in bookings nicht — die liegt nur in booking_requests.
//   * Die Doppelbuchungs-Sperre der Datenbank lautet
//     EXCLUDE USING gist (user_id WITH =, tstzrange(start_time,end_time) WITH &&)
//     WHERE (status = 'confirmed' AND group_parent_id IS NULL)
//     Sie greift also ausschliesslich ueber user_id. Ohne user_id waere jeder
//     Termin unsichtbar fuer die Sperre.

export function createBookingsFromRequestFactory({
  supabase,
  berlinLocalToUTC,
  generateRecurringDates,
  getAvailableSlots,
}) {
  // Ist die Wunschzeit an diesem Tag beim Therapeuten wirklich frei?
  // Die DB-Sperre allein reicht nicht: ein laut Sperre "freier" Slot kann trotzdem
  // ein Feiertag, ein Urlaubstag oder ausserhalb der Arbeitszeiten liegen.
  async function slotIstFrei(empId, dateStr, timeStr, duration, serviceId) {
    const avail = await getAvailableSlots(empId, dateStr, duration, null, 0, 30, serviceId || null);
    if (avail.reason) return false;
    const slotTimes = (avail.slots || []).map(s => (typeof s === 'string' ? s : s.time || s.start || '').substring(0, 5));
    return slotTimes.includes(timeStr.substring(0, 5));
  }

  return async function createBookingsFromRequest(bookReq, ownerId, empId, patName) {
    let duration = 30;
    if (bookReq.service_id) {
      const { data: svc } = await supabase.from('services')
        .select('duration_minutes').eq('id', bookReq.service_id).maybeSingle();
      if (svc?.duration_minutes) duration = svc.duration_minutes;
    }

    const hatWunschzeit = Boolean(bookReq.preferred_date && bookReq.preferred_time);

    // Der Wunschtermin kann zwischen Anfrage und Bestaetigung an jemand anderen
    // vergeben worden sein. Vorher pruefen, damit der Praxisinhaber eine klare
    // Meldung bekommt statt eines Datenbankfehlers.
    if (hatWunschzeit) {
      const frei = await slotIstFrei(empId, bookReq.preferred_date, bookReq.preferred_time, duration, bookReq.service_id);
      if (!frei) return { conflict: true };
    }

    const startTime = hatWunschzeit
      ? berlinLocalToUTC(bookReq.preferred_date, bookReq.preferred_time).toISOString()
      : new Date().toISOString();
    const endUTC = new Date(new Date(startTime).getTime() + duration * 60000).toISOString();

    const { data: booking, error: bookErr } = await supabase.from('bookings').insert({
      user_id: empId, owner_id: ownerId, service_id: bookReq.service_id || null,
      customer_name: patName, start_time: startTime, end_time: endUTC, status: 'confirmed',
    }).select('id').single();
    // 23P01 = no_overlapping_bookings. Zwischen Pruefung und Insert kann jemand
    // schneller gewesen sein — die DB-Sperre bleibt der letzte, verlaessliche Schutz.
    if (bookErr?.code === '23P01') return { conflict: true };
    if (bookErr) throw bookErr;

    // Alle entstandenen Termine mitfuehren: booking_id allein reicht beim Stornieren
    // nicht, sonst blieben die Folgetermine einer Serie als Geistertermine stehen.
    const alleIds = [booking.id];

    // Auto-schedule remaining sessions for unambiguous frequencies (deterministic, no AI).
    // "2x/Woche" etc. need a second/third weekday we were never told, so we don't guess —
    // the owner books those manually via the existing series tool.
    let extraCreated = 0;
    let extraConflicts = 0;
    let needsManualScheduling = false;
    const sessionsTotal = bookReq.verordnung_sitzungen || 1;
    if (sessionsTotal > 1 && bookReq.preferred_date && bookReq.preferred_time) {
      const freq = bookReq.frequenz;
      if (freq === 'Täglich' || freq === '1x/Woche') {
        const recurrence = freq === 'Täglich' ? 'daily' : 'weekly';
        const remainingDates = generateRecurringDates(bookReq.preferred_date, recurrence, sessionsTotal).slice(1);
        for (const dateStr of remainingDates) {
          try {
            if (!await slotIstFrei(empId, dateStr, bookReq.preferred_time, duration, bookReq.service_id)) {
              extraConflicts++;
              continue;
            }
            const st = berlinLocalToUTC(dateStr, bookReq.preferred_time).toISOString();
            const et = new Date(new Date(st).getTime() + duration * 60000).toISOString();
            const { data: extra, error: extraErr } = await supabase.from('bookings').insert({
              user_id: empId, owner_id: ownerId, service_id: bookReq.service_id || null,
              customer_name: patName, start_time: st, end_time: et, status: 'confirmed',
            }).select('id').single();
            if (extraErr) { extraConflicts++; } else { extraCreated++; alleIds.push(extra.id); }
          } catch {
            extraConflicts++;
          }
        }
      } else {
        needsManualScheduling = true;
      }
    }

    return {
      booking_id: booking.id,
      booking_ids: alleIds,
      sessions_total: sessionsTotal,
      sessions_created: 1 + extraCreated,
      sessions_conflicts: extraConflicts,
      needs_manual_scheduling: needsManualScheduling,
    };
  };
}
