/**
 * warteliste-nachruecker.js — nach einer Absage den passenden Nachrücker anbieten.
 *
 * Warum es das gibt
 * ─────────────────
 * Ein abgesagter Termin ist eine Lücke im Tag, die niemand bezahlt. Gleichzeitig
 * steht in der Warteliste jemand, der genau auf diesen Platz wartet — akute
 * Fälle landen dort, weil vorne nichts frei war.
 *
 * > „Da kommen akute Leute, dass man die in die Warteliste reinnimmt — und wenn
 * >  du was löschst oder absagst, dass du automatisch [eine] Benachrichtigung
 * >  bekommst: in deiner Warteliste wartet [eine] Person. Du hast jetzt was
 * >  abgesagt — willst du den hier nehmen?"
 * > — Kemal, 31.08.2026
 *
 * Den Abgleich (`POST /api/warteliste/match`) gibt es seit 01.06.2026, er hing
 * aber nur am „Löschen"-Knopf der Terminmaske. Der Weg, den die Praxis
 * tatsächlich geht — Termin anklicken → Seitenbereich → „Absagen" — löste ihn
 * nie aus. Aus Sicht des Anwenders gab es die Funktion also nicht.
 *
 * Was hier neu ist, ist der zweite Halbsatz der Frage: **„willst du den hier
 * nehmen?"** Bisher zeigte der Dialog nur Name und Telefonnummer; den Termin
 * musste man danach von Hand neu anlegen. Jetzt legt ein Klick ihn in genau dem
 * frei gewordenen Fenster an und setzt den Wartelisten-Eintrag auf `matched`.
 *
 * Reihenfolge, die nicht verhandelbar ist
 * ───────────────────────────────────────
 * Der Abgleich muss VOR dem Löschen laufen. `/warteliste/match` liest den Termin
 * über seine `booking_id` — ist die Zeile weg, gibt es keinen Wochentag und keine
 * Uhrzeit mehr, gegen die man filtern könnte. Deshalb: `holeNachruecker()`
 * starten, löschen, danach auf das Versprechen warten. Solange Absagen hart
 * löscht (Ops-Karte „Termin absagen loescht den Datensatz statt weich zu
 * stornieren"), ist das der einzige Weg; wird daraus ein `status = 'cancelled'`,
 * darf die Reihenfolge bleiben — sie schadet dann nur nicht mehr.
 *
 * Warum das Schreiben über die API läuft
 * ──────────────────────────────────────
 * `warteliste` hat Owner-RLS ohne Team-Zugriff (`db/SCHEMA-RLS.sql`). Sagt eine
 * angestellte Therapeutin ab, würde ein direktes `supabase.from('warteliste')`
 * still ins Leere laufen. Die Route löst den Mandanten über `owner_id` auf und
 * setzt `notified_at` gleich mit — deshalb `PATCH /api/warteliste/:id` statt
 * Client-Schreibzugriff. Der Termin selbst wird direkt geschrieben, wie überall
 * sonst auch: `bookings` erlaubt Angestellten das Anlegen.
 */

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const PRIO = {
  3: { label: 'Dringend', cls: 'badge-red' },
  2: { label: 'Hoch',     cls: 'badge-yellow' },
  1: { label: 'Normal',   cls: 'badge-gray' },
};

/** Name des wartenden Patienten aus dem mitgelieferten `leads`-Join. */
function nachrueckerName(eintrag) {
  const l = eintrag?.leads || {};
  return `${l.first_name || ''} ${l.last_name || ''}`.trim() || 'Unbekannter Patient';
}

// ── 1. Abgleich holen ──────────────────────────────────────────────────────

/**
 * Fragt die Warteliste nach Kandidaten für einen (gleich) frei werdenden Termin.
 *
 * Wird VOR dem Löschen aufgerufen und das Versprechen erst danach abgewartet —
 * siehe Kopf. Wirft bei HTTP-Fehlern; der Aufrufer behandelt das wie „keine
 * Treffer", denn eine fehlgeschlagene Zusatzhilfe darf die Absage nicht aufhalten.
 */
export async function holeNachruecker({ apiBase, token, bookingId }) {
  const res = await fetch(`${apiBase}/warteliste/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ booking_id: bookingId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { candidates = [], total = 0 } = await res.json();
  return { candidates, total };
}

// ── 2. Vorschlag zeigen ────────────────────────────────────────────────────

/**
 * Füllt `#wlMatchList` und öffnet `#wlMatchModal`.
 *
 * Mit `slot` bekommt jede Karte einen Knopf „Diesen Termin geben"; ohne `slot`
 * (Nachschlagen bei einem Termin, der noch steht) bleibt es beim reinen
 * Nachschlagen mit Kontaktdaten — dort wäre ein Vergeben-Knopf schlicht falsch,
 * der Platz ist ja nicht frei.
 *
 * `uebernehmen(eintrag)` wird mit dem gewählten Wartelisten-Eintrag aufgerufen
 * und darf asynchron sein; der Knopf sperrt sich für die Dauer selbst.
 */
export function zeigeNachrueckerModal({ candidates, slot = null, uebernehmen = null } = {}) {
  const listEl = document.getElementById('wlMatchList');
  if (!listEl) return;

  const hinweisEl = document.getElementById('wlMatchSlot');
  if (hinweisEl) {
    hinweisEl.hidden = !slot?.start_time;
    if (slot?.start_time) {
      hinweisEl.textContent = 'Frei geworden: ' + new Date(slot.start_time).toLocaleString('de-DE', {
        weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      }) + ' Uhr';
    }
  }

  listEl.innerHTML = candidates.map((c, i) => {
    const prio = PRIO[c.priority] || PRIO[1];
    const phone = c.leads?.phone || '';
    const email = c.leads?.email || '';

    const kontakt = [
      phone && `<a href="tel:${escapeHtml(phone)}" style="color:var(--primary);text-decoration:none;display:inline-flex;align-items:center;gap:6px;font-weight:500;">📞 ${escapeHtml(phone)}</a>`,
      email && `<a href="mailto:${escapeHtml(email)}" style="color:var(--primary);text-decoration:none;display:inline-flex;align-items:center;gap:6px;font-weight:500;">✉️ ${escapeHtml(email)}</a>`,
    ].filter(Boolean);

    const kontaktHtml = kontakt.length
      ? `<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:8px;">${kontakt.join('')}</div>`
      : `<div style="color:var(--text-muted);font-size:12px;margin-top:8px;">Keine Kontaktdaten vorhanden.</div>`;

    const notizHtml = c.notes
      ? `<div style="font-size:12px;color:var(--text-muted);margin-top:8px;padding-top:8px;border-top:1px dashed var(--border);word-break:break-word;">
           <strong>Notiz:</strong> ${escapeHtml(c.notes)}
         </div>`
      : '';

    const aktionHtml = slot && uebernehmen
      ? `<button class="btn-primary" data-nachruecker="${i}" style="margin-top:10px;width:100%;justify-content:center;font-size:13px;">Diesen Termin geben</button>`
      : '';

    // Farbe: --text-main, nicht --text. Letzteres gibt es in dashboard.css gar
    // nicht; der Name stand bisher in der geerbten Farbe da.
    return `
      <div class="wl-candidate-card" style="border:1px solid var(--border);background:var(--bg-card);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:4px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <strong style="font-size:14px;color:var(--text-main);">${escapeHtml(nachrueckerName(c))}</strong>
          <span class="badge ${prio.cls}">${prio.label}</span>
        </div>
        ${kontaktHtml}
        ${notizHtml}
        ${aktionHtml}
      </div>
    `;
  }).join('');

  // Ein Listener je Aufbau, delegiert: `innerHTML` hat die alten Knöpfe gerade
  // samt ihren Listenern weggeworfen, und `onclick` überschreibt sich sauber —
  // `addEventListener` würde sich bei jeder Absage erneut stapeln.
  listEl.onclick = async (e) => {
    const btn = e.target.closest('[data-nachruecker]');
    if (!btn || !uebernehmen) return;
    const eintrag = candidates[Number(btn.dataset.nachruecker)];
    if (!eintrag) return;
    btn.disabled = true;
    const vorher = btn.textContent;
    btn.textContent = 'Wird eingetragen…';
    try {
      await uebernehmen(eintrag);
    } finally {
      btn.disabled = false;
      btn.textContent = vorher;
    }
  };

  const modal = document.getElementById('wlMatchModal');
  if (modal) modal.hidden = false;
}

// ── 3. Platz vergeben ──────────────────────────────────────────────────────

/**
 * Legt den Termin für den Nachrücker im frei gewordenen Fenster an und hakt den
 * Wartelisten-Eintrag ab.
 *
 * Bewusst OHNE `prescription_sessions`-Verknüpfung: wer auf der Warteliste steht,
 * hat in aller Regel noch keine laufende Verordnung mit offenen Einheiten. Die
 * Zuordnung macht die Praxis danach im Seitenbereich — dort ist sie sichtbar,
 * hier wäre sie geraten.
 *
 * Die Leistung kommt aus dem Wartelisten-Wunsch, wenn er einen nennt; sonst aus
 * dem abgesagten Termin. Dauer und Mitarbeiter:in bleiben die des frei
 * gewordenen Fensters — sonst kollidiert der neue Termin mit dem nächsten.
 *
 * War der frei gewordene Platz ein Platz IN einer Gruppe, muss der neue Termin
 * wieder ein Gruppenkind sein. Das ist keine Kosmetik: der EXCLUDE-Riegel
 * `no_overlapping_bookings` greift nur `WHERE status='confirmed' AND
 * group_parent_id IS NULL`. Ohne den Elternbezug stünde der Nachrücker als
 * eigenständiger Termin zur selben Zeit bei derselben Person — und die
 * Datenbank würde ihn gegen den Gruppentermin selbst abweisen.
 *
 * Gibt `{ ok, bookingId, warnung, error }` zurück; gemeldet wird oben.
 */
export async function uebernimmSlot({ supabase, apiBase, token, eintrag, slot, ownerId }) {
  const payload = {
    owner_id: ownerId,
    user_id: slot.user_id,
    service_id: eintrag.service_id || slot.service_id || null,
    start_time: slot.start_time,
    end_time: slot.end_time,
    customer_name: nachrueckerName(eintrag),
    customer_phone: eintrag.leads?.phone || null,
    customer_email: eintrag.leads?.email || '',
    lead_id: eintrag.lead_id || null,
    notes: eintrag.notes || null,
    status: 'confirmed',
  };
  if (slot.group_parent_id) payload.group_parent_id = slot.group_parent_id;

  const { data, error } = await supabase.from('bookings').insert(payload).select('id').single();
  if (error) return { ok: false, error };

  // Der Termin steht — der Wartelisten-Eintrag darf ihn ab jetzt nicht mehr
  // suchen. Schlägt nur dieser Schritt fehl, bleibt der Termin trotzdem gültig:
  // ein doppelt angebotener Wartender ist ärgerlich, ein verlorener Termin wäre
  // schlimmer. Deshalb kein Rollback, nur eine Warnung nach oben.
  let warnung = null;
  try {
    const res = await fetch(`${apiBase}/warteliste/${eintrag.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: 'matched', matched_booking_id: data.id }),
    });
    if (!res.ok) warnung = `HTTP ${res.status}`;
  } catch (e) {
    warnung = e.message;
  }

  return { ok: true, bookingId: data.id, warnung };
}

/**
 * Nimmt einen vermittelten Eintrag zurück auf die Warteliste.
 *
 * Der Gegenpart zu `uebernimmSlot()`. Gebraucht wird er, weil ein Platz
 * vergeben ist, sobald jemand ihn annimmt — und Menschen danach absagen: der
 * Nachrücker meldet sich nicht, kann doch nicht, wird wieder krank. Ohne diesen
 * Weg wäre der Wartende dauerhaft aus der Liste verschwunden (`loadWarteliste`
 * zeigt nur `waiting`) und müsste neu eingetragen werden — mit neuem Datum,
 * also hinten in der Reihe, obwohl er in Wahrheit am längsten wartet.
 *
 * Den zugehörigen Termin rührt das NICHT an. Absagen ist eine eigene Handlung
 * mit eigener Frage nach dem Grund und eigener Ausfallrechnung; sie hier
 * heimlich mitzuerledigen, würde einen zweiten Absageweg aufmachen — genau den,
 * der am 03.09.2026 gerade zusammengelegt wurde.
 *
 * `matched_booking_id` wird geleert, `notified_at` bleibt stehen: dass dieser
 * Mensch schon einmal angerufen wurde, ist beim nächsten Mal die nützlichere
 * Information.
 */
export async function machtWiederWartend({ apiBase, token, eintragId }) {
  const res = await fetch(`${apiBase}/warteliste/${eintragId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status: 'waiting', matched_booking_id: null }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
