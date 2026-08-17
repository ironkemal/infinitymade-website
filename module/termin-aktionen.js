/**
 * termin-aktionen.js — der Seitenbereich rechts im Terminkalender.
 *
 * Warum es das gibt
 * ─────────────────
 * Der Seitenbereich (#bkActionModal) ist der Bildschirm, auf dem die Praxis
 * den Tag verbringt: Termin anklicken → alles Wichtige zum Patienten, zur
 * Verordnung und die nächste Handlung. Gewachsen ist er aber als Anhängsel von
 * `openBookingActionModal()` in `dashboard.js` — und jede Erweiterung machte
 * diese Datei länger. Konsey 2026-08-13: `dashboard.js` wächst nicht mehr.
 * Alles, was am Seitenbereich neu dazukommt, steht hier.
 *
 * Dieses Modul beantwortet vier Fragen, die der Seitenbereich vorher nicht
 * beantworten konnte:
 *
 *   1. Um WEN geht es? — bisher stand der Name doppelt im Panel und man kam
 *      nur über einen bestehenden Termin hinein. Ein Patient ohne Termin war
 *      unerreichbar, obwohl genau der einen Termin braucht.
 *   2. Um WELCHE Verordnung geht es? — hat ein Patient zwei laufende
 *      Verordnungen, zeigte das Panel stumm die des angeklickten Termins.
 *      Jetzt blättert man mit ‹ › durch, und das ganze Panel folgt.
 *   3. Wie geht es NACH der Verordnung weiter? — die Verordnung ist
 *      aufgebraucht, der Arzt schickt eine neue mit denselben Angaben. Statt
 *      alles abzutippen: übernehmen, korrigieren, speichern.
 *   4. Was ist gerade AUSGEWÄHLT? — „Bearbeiten" und „Löschen" nannten den
 *      Termin nicht, den sie treffen.
 *
 * Das Modul rendert nicht das ganze Panel neu — es hängt sich an die
 * bestehenden Element-IDs aus `dashboard.html`. Die schwere Befüllung macht
 * weiterhin `openBookingActionModal()`.
 */

// Panelbreite (dashboard.html: #bkActionModal width) + 16 px Luft.
// Beide Werte gehören zusammen; wird einer geändert, muss der andere mit.
export const BK_PANEL_OFFSET = '456px';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

// ── Kopf: wer ist gemeint ──────────────────────────────────────────────────

/**
 * Schreibt den Patientennamen in das Suchfeld ganz oben. Das Feld ist damit
 * gleichzeitig Anzeige und Eingang — ein Element statt zwei, und man sieht
 * sofort, dass man den Patienten dort wechseln kann.
 */
export function setzeAktionsKopf({ patientName = '', dob = null } = {}) {
  const el = document.getElementById('bkActPatSearch');
  if (!el) return;
  const geb = dob ? ` · ${new Date(dob).toLocaleDateString('de-DE')}` : '';
  el.value = patientName ? patientName + geb : '';
  // Der zuletzt gesetzte Name ist der Rückfallwert: verlässt der Nutzer das
  // Feld ohne Auswahl, darf dort kein halb getippter Suchtext stehen bleiben.
  el.dataset.aktuell = el.value;
}

/**
 * Hängt die Patientensuche an den Kopf des Seitenbereichs.
 *
 * Verhalten bei Auswahl:
 *   – Patient hat kommende Termine → der nächste wird geöffnet. Das ist der
 *     erwartete Sprung: „zeig mir diesen Patienten" heisst fast immer
 *     „zeig mir seinen nächsten Termin".
 *   – Patient hat keinen kommenden Termin → `onOhneTermin(lead)`. Ohne diesen
 *     Fall wäre die Suche für genau die Patienten nutzlos, für die sie
 *     gebaut wurde.
 *
 * @param {object} deps
 * @param {object} deps.supabase
 * @param {function} deps.attachPatientSearch  aus patient-suche.js
 * @param {function} deps.ladePatienten        () => Promise<lead[]>
 * @param {function} deps.oeffneTermin         (booking) => void
 * @param {function} deps.onOhneTermin         (lead) => void
 * @param {function} [deps.toast]
 */
export function verdrahteAktionsPatientensuche(deps) {
  const { supabase, attachPatientSearch, ladePatienten, oeffneTermin, onOhneTermin, toast } = deps;
  const input = document.getElementById('bkActPatSearch');
  const list = document.getElementById('bkActPatList');
  if (!input || input.dataset.aktionSucheWired === '1') return;
  input.dataset.aktionSucheWired = '1';

  attachPatientSearch(input, {
    listEl: list,
    loadLeads: ladePatienten,
    labelOf: (l) => {
      const name = [l.first_name, l.last_name].filter(Boolean).join(' ').trim() || l.title || '';
      const geb = l.geburtsdatum ? ` · ${new Date(l.geburtsdatum).toLocaleDateString('de-DE')}` : '';
      return name + geb;
    },
    matches: (l, q) => {
      const hay = [l.first_name, l.last_name, l.title, l.phone].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    },
    emptyLimit: 12,
    emptyText: 'Keine Patienten gefunden',
    onSelect: async (lead) => {
      if (!lead?.id) return;
      // patient-suche schreibt den Namen bereits ins Feld — der Rückfallwert
      // muss mitziehen, sonst setzt der blur-Handler unten ihn wieder zurück.
      input.dataset.aktuell = input.value;
      // Nächster Termin ab jetzt. `pending` zählt mit: ein noch nicht
      // bestätigter Termin ist trotzdem der Termin, den die Praxis meint.
      // `completed` und `no_show` zählen NICHT: der Zeitfilter reicht eine
      // Stunde zurück, sonst öffnete ein vor 20 Minuten als „nicht erschienen"
      // gebuchter Termin sich als „nächster Termin" des Patienten. Dieselbe
      // Statusliste wie beim Terminzettel (dashboard.js).
      const { data: naechster, error } = await supabase.from('bookings')
        .select('*, services(title,color,code), prescription_sessions(id,session_number,prescriptions(id,heilmittel,heilmittel_feld_text,heilmittel_position,diagnosegruppe,anzahl_einheiten,icd10,rezept_typ,ausstellungsdatum,status,zuzahlung_befreit,zuzahlung_eur,zuzahlung_kassiert_am,zuzahlung_zahlart,patient_id,is_dringend,is_blanko,is_lhb_bvb,abrechnung_status,frequenz,arzt_id,aerzte(arzt_name,fachrichtung)))')
        .eq('lead_id', lead.id)
        .gte('start_time', new Date(Date.now() - 3600000).toISOString())
        .in('status', ['confirmed', 'pending'])
        .order('start_time', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) { toast?.('Termine konnten nicht geladen werden.', 'error'); return; }
      if (naechster) { oeffneTermin(naechster); return; }
      onOhneTermin?.(lead);
    },
  });

  // Verlässt der Nutzer das Feld ohne Auswahl, steht sonst sein Suchtext dort
  // und behauptet, das sei der Patient.
  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (list && !list.hidden) return;
      if (input.dataset.aktuell != null) input.value = input.dataset.aktuell;
    }, 150);
  });
}

// ── Patientenkarte ─────────────────────────────────────────────────────────

/**
 * Füllt die Patientenkarte im Seitenbereich.
 *
 * Sie zeigt bewusst KEINE Stammdaten mehr. Vorher stand dort ein achtzeiliges
 * Raster (Geburtsdatum, Geschlecht, Telefon, E-Mail, Kasse, Versicherten-Nr.,
 * Adresse, Status) — Angaben, die man beim Behandeln so gut wie nie braucht,
 * die aber ein Drittel der Panelhöhe verbrauchten. Sie stehen vollständig in
 * der Patientenakte, einen Knopfdruck entfernt.
 *
 * Was bleibt, ist das, was während der Behandlung zählt: wer, war er schon
 * mal nicht da, und — falls Hausbesuch — wo wohnt er.
 *
 * @param {object}   args
 * @param {object|null} args.lead
 * @param {object|null} args.booking
 * @param {function|null} args.oeffneAkte  öffnet die Patientenakte (Verlauf-Reiter)
 */
export function setzePatientenKarte({ lead, booking, oeffneAkte }) {
  const datenBtn = document.getElementById('bkOpenPatientBtn');
  const adrWrap = document.getElementById('bkPatientAdresse');
  const adrText = document.getElementById('bkPatientAdresseText');

  // Ohne Patientenakte gibt es nichts zu öffnen — Knöpfe, die nichts tun,
  // sind schlimmer als fehlende Knöpfe.
  //
  // Es gab hier einen zweiten Knopf „Verlauf", der dieselbe Akte öffnete —
  // die Akte startet ohnehin auf dem Reiter „Verlauf" (gekommen / nicht
  // gekommen). Ein Ziel, ein Knopf.
  const hatAkte = !!(lead && oeffneAkte);
  if (datenBtn) {
    datenBtn.style.display = hatAkte ? '' : 'none';
    datenBtn.onclick = hatAkte ? oeffneAkte : null;
  }

  // Adresse: nur wenn dieser Termin ein Hausbesuch ist. In der Praxis fährt
  // niemand zum Patienten, dann ist die Anschrift nur Rauschen.
  if (adrWrap && adrText) {
    const teile = lead
      ? [lead.street, [lead.plz, lead.city].filter(Boolean).join(' ')].filter(Boolean)
      : [];
    if (booking?.hausbesuch && teile.length) {
      adrText.textContent = teile.join(', ');
      adrWrap.hidden = false;
    } else {
      adrWrap.hidden = true;
    }
  }

  if (!lead) {
    const zb = document.getElementById('bkZuzahlungBadge');
    if (zb) zb.hidden = true;
    const ins = document.getElementById('bkInsuranceBadge');
    if (ins) ins.hidden = true;
  }
}

// ── Verordnungen: blättern und übernehmen ──────────────────────────────────

// Dieselben Felder, die der Termin-Join mitbringt — sonst fehlten der
// Rezeptinfo nach dem Blättern Angaben, die vorher da waren.
const RX_FELDER = 'id,heilmittel,heilmittel_feld_text,heilmittel_position,diagnosegruppe,'
  + 'anzahl_einheiten,icd10,rezept_typ,ausstellungsdatum,status,zuzahlung_befreit,zuzahlung_eur,'
  + 'zuzahlung_kassiert_am,zuzahlung_zahlart,patient_id,is_dringend,is_blanko,is_lhb_bvb,'
  + 'abrechnung_status,frequenz,gueltig_bis,hinweise,arzt_id,aerzte(arzt_name,fachrichtung),'
  // Zusätzlich für „übernehmen": alles, was in einer Folgeverordnung wieder
  // gleich lautet und sonst abgetippt werden müsste.
  + 'leitsymptomatik,diagnose_freitext,icd10_2,ergaenzendes_heilmittel,ergaenzend_einheiten,'
  + 'vorrangig_einheiten,therapie_bereich,hausbesuch,doctor_lanr,doctor_bsnr,heilmittel_items,'
  + 'heilmittel_typ_blanko,bericht_angefordert,pat_leitsymptomatik';

/**
 * Bestimmt, welche Verordnung der Seitenbereich zeigt — und welche es sonst
 * noch gäbe.
 *
 * Ohne Wunsch (`gewuenschteRxId`) ist es die zum Termin verknüpfte; das ist
 * das bisherige Verhalten und bleibt der Normalfall. Die Liste daneben ist
 * neu: sie speist die Blätter-Pfeile.
 *
 * @returns {{rx: object|null, liste: object[], aktuelleSitzung: number}}
 */
export async function waehleVerordnungFuerPanel({ supabase, booking, verknuepfteSession, gewuenschteRxId }) {
  const verknuepfteRx = verknuepfteSession?.prescriptions || null;
  const patientId = verknuepfteRx?.patient_id || booking?.lead_id || null;
  const leer = { rx: verknuepfteRx, liste: verknuepfteRx ? [verknuepfteRx] : [], aktuelleSitzung: verknuepfteSession?.session_number || 1 };
  if (!patientId) return leer;
  // Hängt an diesem Termin keine Verordnung (Selbstzahler, freier Termin) und
  // wurde auch keine angefragt, bleibt die Rezeptinfo leer — wie bisher. Sonst
  // stünde dort plötzlich irgendeine Verordnung des Patienten, die mit diesem
  // Termin nichts zu tun hat.
  if (!verknuepfteRx && !gewuenschteRxId) return leer;

  // Auch abgeschlossene Verordnungen gehören in die Liste: die abgelaufene ist
  // genau die, deren Angaben man in die Folgeverordnung übernehmen will.
  const { data: liste, error } = await supabase.from('prescriptions')
    .select(RX_FELDER)
    .eq('patient_id', patientId)
    .not('status', 'in', '("cancelled")')
    .order('ausstellungsdatum', { ascending: false, nullsFirst: false })
    .limit(12);
  if (error || !liste?.length) return leer;

  const gewaehlt = (gewuenschteRxId && liste.find(r => r.id === gewuenschteRxId))
    || liste.find(r => r.id === verknuepfteRx?.id)
    || verknuepfteRx
    || liste[0];

  // Sitzungszahl: beim verknüpften Termin ist es „diese Sitzung". Bei einer
  // anderen Verordnung gibt es keinen „diesen" Termin — dort zählt, wie viel
  // schon erbracht ist.
  let aktuelleSitzung = verknuepfteSession?.session_number || 1;
  if (gewaehlt?.id && gewaehlt.id !== verknuepfteRx?.id) {
    const { count } = await supabase.from('prescription_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('prescription_id', gewaehlt.id)
      .in('status', ['completed', 'done', 'no_show']);
    aktuelleSitzung = count || 0;
  }

  return { rx: gewaehlt, liste, aktuelleSitzung };
}

/**
 * Zeichnet ‹ 2/3 › und den Übernehmen-Knopf in die Kopfzeile der Rezeptinfo.
 * Die Pfeile erscheinen nur, wenn es etwas zu blättern gibt — ein Pfeilpaar,
 * das immer ausgegraut ist, ist nur Unruhe.
 */
export function rendereVerordnungsNavigation({ liste = [], aktuelleRxId, aufWechsel, aufUebernehmen }) {
  const wrap = document.getElementById('bkRxNav');
  if (!wrap) return;
  wrap.innerHTML = '';

  const idx = liste.findIndex(r => r.id === aktuelleRxId);
  const knopfStil = 'background:none;border:1px solid var(--border);border-radius:5px;'
    + 'color:var(--text-main);cursor:pointer;font-size:12px;line-height:1;padding:2px 6px;font-family:inherit;';

  if (liste.length > 1 && idx >= 0) {
    const zurueck = document.createElement('button');
    zurueck.type = 'button';
    zurueck.title = 'Vorherige Verordnung';
    zurueck.textContent = '‹';
    zurueck.style.cssText = knopfStil;
    zurueck.disabled = idx <= 0;
    if (zurueck.disabled) zurueck.style.opacity = '0.35';
    zurueck.onclick = () => aufWechsel?.(liste[idx - 1].id);

    const zaehler = document.createElement('span');
    zaehler.textContent = `${idx + 1}/${liste.length}`;
    zaehler.style.cssText = 'font-size:10px;color:var(--text-muted);font-variant-numeric:tabular-nums;min-width:24px;text-align:center;';

    const vor = document.createElement('button');
    vor.type = 'button';
    vor.title = 'Nächste Verordnung';
    vor.textContent = '›';
    vor.style.cssText = knopfStil;
    vor.disabled = idx >= liste.length - 1;
    if (vor.disabled) vor.style.opacity = '0.35';
    vor.onclick = () => aufWechsel?.(liste[idx + 1].id);

    wrap.append(zurueck, zaehler, vor);
  }

  // Übernehmen: die Angaben dieser Verordnung in eine neue Verordnung
  // vorschreiben. Der häufigste Fall in der Praxis — der Arzt schickt eine
  // Folgeverordnung mit denselben Heilmitteln, und bisher tippte man alles ab.
  if (aufUebernehmen) {
    const kopie = document.createElement('button');
    kopie.type = 'button';
    kopie.title = 'Angaben in eine neue Verordnung übernehmen (Folgeverordnung)';
    kopie.innerHTML = '⧉ übernehmen';
    kopie.style.cssText = knopfStil + 'font-size:11px;color:var(--accent,#b1891b);border-color:rgba(177,137,27,0.4);';
    kopie.onclick = () => aufUebernehmen();
    wrap.appendChild(kopie);
  }
}

/**
 * Übernimmt die Angaben einer Verordnung in eine NEUE Verordnung.
 *
 * Der Ablauf in der Praxis: sechs Sitzungen sind verbraucht, es reicht nicht,
 * der Arzt stellt eine Folgeverordnung aus. Auf dem Papier steht fast dasselbe
 * wie vorher — dieselbe Diagnosegruppe, dasselbe Heilmittel, dieselbe
 * Frequenz. Abgetippt wurde das bisher jedes Mal komplett neu.
 *
 * Ausdrücklich NICHT übernommen wird alles, was am neuen Papier neu ist:
 *   – Ausstellungsdatum → heute (openRezeptModal setzt das bereits)
 *   – Unterschrift, Belegnummer, Abrechnungsstand, Zuzahlungsstand
 * Und es wird NICHTS gespeichert: die Maske geht auf, die Mitarbeiterin
 * vergleicht mit dem Papier, korrigiert und drückt selbst auf Speichern.
 *
 * @param {object} rx    Vorlage-Verordnung
 * @param {object} deps  Zugriff auf die Maske aus dashboard.js
 */
export async function uebernimmVerordnung(rx, deps) {
  const { oeffneRezeptMaske, lsApply, setTherapiebereich, setHausbesuch, setFrequenz, toast } = deps;
  if (!rx) return;

  // Erst die Maske (sie setzt alle Felder zurück und lädt den Patienten),
  // danach die Vorlage darüberschreiben — die Reihenfolge ist entscheidend.
  await oeffneRezeptMaske(null, rx.patient_id || null);

  const g = (id) => document.getElementById(id);
  const setz = (id, wert) => { const el = g(id); if (el && wert != null && wert !== '') el.value = wert; };
  const haken = (id, wert) => { const el = g(id); if (el) el.checked = !!wert; };

  setz('rzArztName', rx.aerzte?.arzt_name || '');
  setz('rzLanr', rx.doctor_lanr || '');
  setz('rzBsnr', rx.doctor_bsnr || '');
  setz('rzIcd', rx.icd10 || '');
  setz('rzDiagnoseText', rx.diagnose_freitext || '');
  setz('rzDg', rx.diagnosegruppe || '');
  lsApply?.('rz', rx.leitsymptomatik || null, rx.pat_leitsymptomatik || null);
  setz('rzHm', rx.heilmittel_feld_text || rx.heilmittel || '');
  setz('rzHmPosition', rx.heilmittel_position || '');
  setz('rzAnzahl', rx.vorrangig_einheiten || rx.anzahl_einheiten || '');
  setz('rzHmErg', rx.ergaenzendes_heilmittel || '');
  setz('rzAnzahlErg', rx.ergaenzend_einheiten || '');
  setz('rzHinweise', rx.hinweise || '');
  setFrequenz?.('rzFreq', rx.frequenz || '');
  setTherapiebereich?.(rx.therapie_bereich || '');
  setHausbesuch?.(!!rx.hausbesuch);
  haken('rzDringend', rx.is_dringend);
  haken('rzBlanko', rx.is_blanko);
  haken('rzLhbBvb', rx.is_lhb_bvb);
  haken('rzBerichtAngefordert', rx.bericht_angefordert);
  // Zuzahlungsbefreiung ist eine Eigenschaft des Patienten im laufenden Jahr,
  // nicht des Papiers — sie darf mit.
  haken('rzZuzahlungBefreit', rx.zuzahlung_befreit);

  const alt = rx.ausstellungsdatum
    ? new Date(rx.ausstellungsdatum).toLocaleDateString('de-DE')
    : 'der vorherigen Verordnung';
  toast?.(`Angaben von ${alt} übernommen — bitte mit dem Papier abgleichen und speichern.`, 'info');
}

// ── Offene Einheiten als Serie ─────────────────────────────────────────────

/**
 * Vergibt alle noch offenen Einheiten einer Verordnung auf einmal.
 *
 * Bis hierher gab es dafür nur das Ziehen einzelner Einheiten auf den
 * Kalender — bei einer Verordnung über zehn Sitzungen also zehnmal ziehen,
 * jedes Mal mit der Frage, ob der Termin überhaupt frei ist.
 *
 * Neu gebaut wird hier nichts: es ist derselbe Ablauf wie direkt nach dem
 * Rezept-Scan (`openBookingFromRxPreset`) — Terminmaske vorbelegen, dann die
 * Frage nach Vormittag/Nachmittag, dann Vorschläge zum Prüfen, dann anlegen.
 *
 * Der einzige Unterschied zum Scan-Weg ist `anzahl`: es sind die noch OFFENEN
 * Einheiten, nicht die verordneten. Sonst würde eine Verordnung, von der schon
 * die Hälfte vergeben ist, ein zweites Mal komplett verplant.
 *
 * `window._physioFlow` ist die Brücke zum Abschluss: danach hängt
 * `linkBookingsToPrescriptionSessions()` die neuen Termine an genau diese
 * Verordnung — deshalb wandern sie im Panel von „Unvergebene" zu „Termine".
 */
export async function verteileOffeneSitzungen({
  rx, offen, booking, patientId, schliessePanel, starteSerienplanung, toast,
}) {
  if (!patientId) { toast?.('Kein Patient zur Verordnung gefunden.', 'error'); return; }
  if (!rx?.id) { toast?.('Keine Verordnung ausgewählt.', 'error'); return; }

  const preset = {
    prescription_id: rx.id,
    patient_id: patientId,
    anzahl: offen,
    frequenz: rx.frequenz || '',
    heilmittel: rx.heilmittel,
    heilmittel_position: rx.heilmittel_position || null,
    // Die Leistung des laufenden Termins ist die richtige Vorgabe — sie wurde
    // beim ersten Termin dieser Verordnung schon einmal richtig zugeordnet.
    service_id: booking?.service_id || null,
    hausbesuch: !!booking?.hausbesuch,
    patient_name: (booking?.customer_name || '').split('·')[0].trim(),
  };

  window._physioFlow = preset;
  schliessePanel?.();
  await starteSerienplanung(preset);
}

// ── Auswahl sichtbar machen ────────────────────────────────────────────────

/**
 * Schreibt Datum und Uhrzeit des gewählten Termins neben „Bearbeiten" und
 * „Löschen". Beide Knöpfe nannten ihr Ziel nicht — bei einem Patienten mit
 * sechs Terminen ist „Löschen" ohne Datum eine Zumutung.
 *
 * @param {object|null} booking  null → Patientenmodus, Knöpfe werden gesperrt
 */
export function setzeTerminAuswahlLabel(booking) {
  const knoepfe = ['bkActionMoveBtn', 'bkActionEditBtn', 'bkActionDeleteBtn']
    .map(id => document.getElementById(id)).filter(Boolean);
  const zeile = document.getElementById('bkActionAuswahlZeile');
  if (!knoepfe.length) return;

  if (!booking?.start_time) {
    knoepfe.forEach(b => { b.disabled = true; });
    if (zeile) { zeile.textContent = 'Kein Termin ausgewählt'; zeile.hidden = false; }
    return;
  }

  knoepfe.forEach(b => { b.disabled = false; });
  const s = new Date(booking.start_time);
  const txt = s.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' · ' + s.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (zeile) {
    zeile.innerHTML = `Ausgewählter Termin: <strong style="color:var(--text-main);">${escapeHtml(txt)}</strong>`;
    zeile.hidden = false;
  }
}
