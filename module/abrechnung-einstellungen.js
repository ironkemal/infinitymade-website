/**
 * abrechnung-einstellungen.js — §302-Betriebsart (test / erprobung / echt) und
 * IK-Einstellung in den Einstellungen.
 *
 * Warum es diese Datei gibt
 * ─────────────────────────
 * Der IK-Block und der Zertifikatsstatus standen unverändert in `dashboard.js`.
 * Beim Bau des Betriebsart-Schalters (§302-Echtbetrieb, Schritt 1.7,
 * 20.09.2026) kam direkt daneben ein zweiter Block dazu — und `dashboard.js`
 * darf nicht wachsen (Konsey 2026-08-13, Kapı `tools/check-dashboard-size.sh`).
 * Also ist der Nachbar mitgezogen, nach der Umzingelungsregel: was man anfasst,
 * wandert in ein Modul.
 *
 * Verhalten des migrierten Blocks unverändert. Der Umzug hat nur die stillen
 * Abhängigkeiten sichtbar gemacht — `supabase`, Profil, `showToast` und
 * `showConfirmModal` kommen jetzt als `deps` herein statt aus dem Modulrumpf
 * von `dashboard.js`.
 *
 * `deps.profile` ist eine FUNKTION, kein Objekt — und das ist kein Stilfrage.
 * `wireAbrechnungSettings()` läuft beim Laden des Moduls, also lange bevor die
 * Anmeldung durch ist; `currentProfile` ist dort noch `null` und wird später
 * NEU ZUGEWIESEN (`dashboard.js:19296`), nicht mutiert. Eine zum Bindezeitpunkt
 * eingefangene Referenz zeigte deshalb für immer auf `null`, und der erste
 * Klick auf „IK speichern" wäre mit einem TypeError gestorben — nachdem
 * `profiles` bereits geschrieben war. Deshalb wird das Profil bei jedem Zugriff
 * frisch geholt.
 *
 * Das Profilobjekt selbst wird absichtlich mutiert statt ersetzt: `dashboard.js`
 * hält dieselbe Referenz, und `currentProfile.ik_number` soll nach dem Speichern
 * sofort überall greifen, ohne dass die Seite neu lädt. Genau dasselbe tut
 * `module/ausfall-einstellungen.js`.
 *
 * Texte in dieser Datei
 * ─────────────────────
 * Die Texte sind fest auf Deutsch. Die Nachbar-Texte (`Institutionskennzeichen
 * (IK)`, `Wird von der ARGE-IK vergeben…`) stehen bereits direkt im HTML auf
 * Deutsch, und `dashboard.js`-Wörterbuch ist an der Wachstumsgrenze. Dasselbe
 * Prinzip ist in `module/podologie-abrechnung.js` dokumentiert.
 *
 * Wer darf den Betriebsart-Schalter sehen
 * ────────────────────────────────────────
 * Nur der Inhaber. Mitarbeiter dürfen die Einstellung weder lesen noch ändern —
 * die Entscheidung, von Testdateien auf echte Kassenabrechnung umzustellen,
 * ist eine Geschäftsentscheidung des Praxisinhabers, keine Bedienungsaufgabe.
 *
 * @param {object}   deps
 * @param {object}   deps.supabase
 * @param {Function} deps.profile           () => currentProfile — bewusst eine
 *                                           Funktion, siehe oben. Das gelieferte
 *                                           Objekt wird bei Erfolg mutiert.
 * @param {Function} deps.ownerId            () => uuid des Inhabers
 * @param {Function} deps.userId             () => uuid des aktuell angemeldeten
 *                                           Benutzers (für betriebsart_geaendert_von)
 * @param {string}   deps.sector             getSector()-Ergebnis
 * @param {Function} deps.isPraxisSector     (sector) => boolean
 * @param {Function} deps.showToast
 * @param {Function} deps.showConfirmModal
 */

// ===== Einstellungen > Abrechnung (Krankenkasse) =====
// IK-Eingabe + Zertifikatsstatus + §302-Betriebsart-Schalter.
// Wird jedes Mal aufgerufen, wenn die Einstellungsseite geöffnet wird
// (loadSettings in dashboard.js).

const BETRIEBSART_LABELS = {
  test:      'Testverfahren',
  erprobung: 'Erprobungsverfahren',
  echt:      'Echtbetrieb',
};

// IK-Nummer bereits aus terapeut_zertifikat gelesen und in certStatus angezeigt?
// Wird als dataset-Flag auf dem Mount-Punkt gehalten, damit kein zweiter Select
// losgeht, wenn der Block nach einem Tab-Wechsel neu gerendert wird.
const _WIRED_FLAG = 'abrWired';

/**
 * Blendet und befüllt den Abrechnung-Bereich.
 * Liest terapeut_zertifikat (IK, Zertifikatsstatus, Betriebsart) und rendert
 * den Betriebsart-Schalter in #betriebsartMount.
 *
 * Wenn die Betriebsart-Spalten noch nicht existieren (Migration 0028 noch nicht
 * eingespielt), versteckt sich der Schalter lautlos und stört den Rest nicht.
 */
export async function renderAbrechnungSettings(deps) {
  const abrSection = document.getElementById('settingsAbrechnungSection');
  if (!abrSection) return;

  if (!deps.isPraxisSector(deps.sector)) {
    abrSection.style.display = 'none';
    return;
  }
  abrSection.style.display = '';

  // IK aus dem Profil vorbelegen
  const ikInp = document.getElementById('setIkNumber');
  if (ikInp) ikInp.value = deps.profile()?.ik_number || '';

  // terapeut_zertifikat: IK-Nummer, Zertifikatsdaten und Betriebsart in einem
  // einzigen Select — damit nicht zwei Netzwerkanfragen für dieselbe Zeile gehen.
  //
  // ⚠️ Migration 0028 ist zum Zeitpunkt dieser Zeile noch nicht überall
  //    eingespielt. Fehlen die vier Betriebsart-Spalten, scheitert der GANZE
  //    Select — nicht nur der neue Teil. Ohne den zweiten Versuch unten hätte
  //    dieses Modul also den bereits funktionierenden Zertifikatsstatus mit
  //    abgeschaltet: eine Praxis mit hinterlegtem Zertifikat läse plötzlich
  //    „Noch kein ITSG-Zertifikat hinterlegt." Neue Funktion darf alte nicht
  //    mitnehmen.
  const ALT_SPALTEN = 'ik_nummer, cert_subject, cert_valid_to';
  const NEU_SPALTEN = `${ALT_SPALTEN}, betriebsart, betriebsart_geaendert_am, zulassung_referenz, zulassung_datum`;

  let { data, error } = await deps.supabase
    .from('terapeut_zertifikat')
    .select(NEU_SPALTEN)
    .eq('owner_id', deps.ownerId())
    .maybeSingle();

  let betriebsartSpaltenFehlen = false;
  if (error && /column|does not exist|42703/i.test(String(error.message || error.code || ''))) {
    betriebsartSpaltenFehlen = true;
    ({ data, error } = await deps.supabase
      .from('terapeut_zertifikat')
      .select(ALT_SPALTEN)
      .eq('owner_id', deps.ownerId())
      .maybeSingle());
  }

  // Zertifikatsstatus anzeigen (Altverhalten aus dashboard.js, unverändert)
  const statusEl = document.getElementById('certStatus');
  if (data) {
    if (ikInp && data.ik_nummer && !ikInp.value) ikInp.value = data.ik_nummer;
    if (statusEl) {
      if (data.cert_subject) {
        const valid = data.cert_valid_to
          ? new Date(data.cert_valid_to).toLocaleDateString('de-DE')
          : '—';
        statusEl.textContent = `Zertifikat: ${data.cert_subject} · gültig bis ${valid}`;
        statusEl.style.color = '#15803d';
      } else {
        statusEl.textContent = 'Noch kein ITSG-Zertifikat hinterlegt.';
        statusEl.style.color = '';
      }
    }
  } else if (!error && statusEl) {
    statusEl.textContent = 'Noch kein ITSG-Zertifikat hinterlegt.';
    statusEl.style.color = '';
  }

  // Betriebsart-Schalter nur für den Inhaber — Angestellte sehen ihn nie.
  // Begründung: Einreichen in den Echtbetrieb ist eine Geschäftsentscheidung.
  if (deps.profile()?.role !== 'owner') {
    const mount = document.getElementById('betriebsartMount');
    if (mount) mount.innerHTML = '';
    return;
  }

  // Spalten fehlen (Migration 0028 noch nicht eingespielt): Schalter ausblenden,
  // alles andere läuft weiter. Ein Schalter, der ins Leere speichert, wäre
  // schlimmer als keiner — der Anwender glaubte dann, er sei im Echtbetrieb.
  if (betriebsartSpaltenFehlen) {
    console.warn('[abrechnung-einstellungen] Betriebsart-Spalten fehlen noch (Migration 0028 ausstehend). Schalter wird ausgeblendet.');
    const mount = document.getElementById('betriebsartMount');
    if (mount) mount.innerHTML = '';
    return;
  }

  const aktuell = data?.betriebsart || 'test';
  const geaendertAm = data?.betriebsart_geaendert_am
    ? new Date(data.betriebsart_geaendert_am).toLocaleDateString('de-DE')
    : null;
  const zulassungReferenz = data?.zulassung_referenz || '';
  const zulassungDatum = data?.zulassung_datum || '';

  _renderBetriebsartSchalter({ aktuell, geaendertAm, zulassungReferenz, zulassungDatum });
}

/**
 * Baut den Betriebsart-Schalter in #betriebsartMount.
 * Private Funktion — nur von renderAbrechnungSettings aufgerufen.
 */
function _renderBetriebsartSchalter({ aktuell, geaendertAm, zulassungReferenz, zulassungDatum }) {
  const mount = document.getElementById('betriebsartMount');
  if (!mount) return;

  // Modustext + Erläuterung je Modus.
  // Erprobung braucht besondere Betonung: echte Daten, aber der Dateiname
  // fängt noch mit T an — das ist kontraintuitiv und sorgt für «Korrekturen».
  const beschreibungen = {
    test: 'Keine Daten werden an die Krankenkasse übermittelt. Für die Entwicklung und erste Prüfungen.',
    erprobung: '⚠ Echte Patientendaten werden an die Datenannahmestelle übermittelt — die Abrechnung gilt! Der physikalische Dateiname beginnt dennoch weiterhin mit „T" (TSOL0…), was täuschend nach Test aussieht. Bitte nicht „korrigieren".',
    echt: 'Alle erzeugten Dateien gelten als verbindliche Kassenabrechnung (ESOL0…). Nur nach schriftlicher Zulassung durch die Krankenkasse (nicht durch die Datenannahmestelle).',
  };

  // Zulassungsfelder werden nur bei Auswahl von „echt" eingeblendet.
  const zulassungFelderAnzeigen = aktuell === 'echt';

  mount.innerHTML = `
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border);">
      <div style="font-size:14px;font-weight:600;color:var(--text-main);margin-bottom:4px;">
        Betriebsart der §302-Abrechnung
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">
        Aktuell: <strong id="baModeLabel">${BETRIEBSART_LABELS[aktuell] || aktuell}</strong>
        ${geaendertAm ? `<span style="margin-left:10px;font-size:11px;color:var(--text-muted);">zuletzt umgestellt am ${geaendertAm}</span>` : ''}
      </div>
      <div id="baBeschreibung" style="font-size:12px;color:var(--text-muted);margin-bottom:12px;padding:8px 10px;background:var(--bg-card-solid,#1f2937);border-radius:6px;border:1px solid var(--border);">
        ${beschreibungen[aktuell] || ''}
      </div>
      <div class="form-group" style="margin-bottom:10px;">
        <label class="form-label" style="margin-bottom:6px;">Betriebsart wählen</label>
        <div style="display:flex;flex-direction:column;gap:6px;" id="baModeRadioGroup">
          ${['test','erprobung','echt'].map(m => `
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:8px 10px;border-radius:6px;border:1px solid ${m === aktuell ? 'var(--primary,#6366f1)' : 'var(--border)'};background:${m === aktuell ? 'var(--bg-card)' : 'transparent'};" data-ba-option="${m}">
              <input type="radio" name="betriebsart" value="${m}" ${m === aktuell ? 'checked' : ''} style="accent-color:var(--primary,#6366f1);">
              <span style="color:var(--text-main);font-weight:${m === aktuell ? '600' : '400'};">${BETRIEBSART_LABELS[m]}</span>
            </label>
          `).join('')}
        </div>
      </div>
      <div id="baZulassungFelder" style="display:${zulassungFelderAnzeigen ? '' : 'none'};margin-bottom:12px;">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;padding:8px 10px;background:var(--bg-card-solid,#1f2937);border:1px solid var(--border);border-radius:6px;">
          Für den Echtbetrieb ist eine schriftliche <strong>Zulassung zum Echtverfahren</strong> durch die
          Krankenkasse erforderlich (nicht durch die Datenannahmestelle). Bitte Referenz und Datum der
          Zulassung eintragen.
        </div>
        <div class="form-row" style="gap:10px;">
          <div class="form-group" style="flex:1;">
            <label class="form-label">Aktenzeichen / Referenz der Zulassung</label>
            <input class="form-input" id="baZulassungReferenz" type="text"
              placeholder="z. B. KK-2026/302-1234"
              value="${_escHtml(zulassungReferenz)}" />
          </div>
          <div class="form-group" style="flex:0 0 160px;">
            <label class="form-label">Datum der Zulassung</label>
            <input class="form-input" id="baZulassungDatum" type="date"
              value="${_escHtml(zulassungDatum)}" />
          </div>
        </div>
        <div id="baZulassungFehler" style="font-size:12px;color:var(--danger,#ef4444);margin-top:4px;display:none;">
          Bitte Aktenzeichen und Datum der Zulassung ausfüllen, um den Echtbetrieb zu speichern.
        </div>
      </div>
      <button class="btn-primary" id="baSpeichernBtn" style="margin-top:4px;">Betriebsart speichern</button>
    </div>
  `;
}

/**
 * Bindet alle Ereignislistener im Abrechnung-Bereich.
 * Genau einmal aufrufen — kein weiterer Aufruf bei Tab-Wechsel, da der
 * dataset-Flag `_WIRED_FLAG` doppelte Registrierung verhindert.
 *
 * Hintergrund: Bei jedem loadSettings()-Aufruf rendert renderAbrechnungSettings
 * neu, aber die ikSaveBtn-Logik und der dynamisch erzeugte baSpeichernBtn leben
 * beide im Dokument. Würden wir hier nicht prüfen, stapeln sich Event-Listener
 * und jeder Klick auf „IK speichern" löst mehrfach aus — ein Fehler, der im
 * Projekt bereits einmal (§302-Knöpfe, podologie-abrechnung.js) vorgekommen ist.
 */
export function wireAbrechnungSettings(deps) {
  const abrSection = document.getElementById('settingsAbrechnungSection');
  if (!abrSection || abrSection.dataset[_WIRED_FLAG]) return;
  abrSection.dataset[_WIRED_FLAG] = '1';

  // --- IK speichern (aus dashboard.js:13169-13193 hierher verschoben) ---
  document.getElementById('ikSaveBtn')?.addEventListener('click', async () => {
    const raw = document.getElementById('setIkNumber').value.trim();
    if (raw && !/^\d{9}$/.test(raw)) {
      deps.showToast('IK muss genau 9 Ziffern enthalten.', 'error');
      return;
    }
    const ik = raw || null;
    const ownerId = deps.ownerId();

    // 1) profiles.ik_number (legacy DMRZ-Fluss)
    const { error: pErr } = await deps.supabase
      .from('profiles')
      .update({ ik_number: ik })
      .eq('id', deps.userId());
    if (pErr) { deps.showToast('Fehler: ' + pErr.message, 'error'); return; }

    // Profil mutieren, damit der Rest der Seite sofort die neue IK sieht.
    // Frisch holen: zum Bindezeitpunkt war `currentProfile` noch null (s. Kopf).
    const profil = deps.profile();
    if (profil) profil.ik_number = ik;

    // 2) terapeut_zertifikat upsert (§302-Sammelabrechnung-Route liest diese Tabelle)
    // ⚠ ik_nummer ist NOT NULL — Upsert ohne IK schlägt fehl. Genau dasselbe
    //   Problem gab es im Backend (abrechnung.routes.js, upload-signed, Z. 1188).
    if (ik) {
      const { error: zErr } = await deps.supabase
        .from('terapeut_zertifikat')
        .upsert({ owner_id: ownerId, ik_nummer: ik }, { onConflict: 'owner_id' });
      if (zErr) console.warn('[ik/zertifikat-upsert]', zErr);
    }

    deps.showToast(ik ? 'IK gespeichert ✓' : 'IK entfernt.');
  });

  // --- Betriebsart-Schalter: Radio-Gruppe, Zulassungsfelder, Speichern ---
  // Der Schalter wird bei jedem renderAbrechnungSettings neu in den DOM
  // geschrieben. Damit addEventListener nicht ins Leere läuft, verwenden wir
  // Event-Delegation auf dem stabilen abrSection-Container.
  abrSection.addEventListener('change', (e) => {
    const radio = e.target.closest('input[type="radio"][name="betriebsart"]');
    if (!radio) return;
    _aktualisiereBaAnsicht(radio.value);
  });

  abrSection.addEventListener('click', async (e) => {
    if (!e.target.closest('#baSpeichernBtn')) return;
    await _speichereBetriebsart(deps);
  });
}

/**
 * Passt die Radiogruppen-Optik und die Zulassungsfelder an die gewählte
 * Betriebsart an, ohne die Seite neu zu laden.
 */
function _aktualisiereBaAnsicht(gewaehlterModus) {
  // Rahmenstärke je Option anpassen
  document.querySelectorAll('#baModeRadioGroup label[data-ba-option]').forEach(lbl => {
    const m = lbl.dataset.baOption;
    const aktiv = m === gewaehlterModus;
    lbl.style.border = `1px solid ${aktiv ? 'var(--primary,#6366f1)' : 'var(--border)'}`;
    lbl.style.background = aktiv ? 'var(--bg-card)' : 'transparent';
    const span = lbl.querySelector('span');
    if (span) span.style.fontWeight = aktiv ? '600' : '400';
  });

  // Beschreibungstext aktualisieren
  const beschreibungen = {
    test: 'Keine Daten werden an die Krankenkasse übermittelt. Für die Entwicklung und erste Prüfungen.',
    erprobung: '⚠ Echte Patientendaten werden an die Datenannahmestelle übermittelt — die Abrechnung gilt! Der physikalische Dateiname beginnt dennoch weiterhin mit „T" (TSOL0…), was täuschend nach Test aussieht. Bitte nicht „korrigieren".',
    echt: 'Alle erzeugten Dateien gelten als verbindliche Kassenabrechnung (ESOL0…). Nur nach schriftlicher Zulassung durch die Krankenkasse (nicht durch die Datenannahmestelle).',
  };
  const desc = document.getElementById('baBeschreibung');
  if (desc) desc.textContent = beschreibungen[gewaehlterModus] || '';

  // Aktuellen Modusnamen in der Kopfzeile aktualisieren
  const lbl = document.getElementById('baModeLabel');
  if (lbl) lbl.textContent = BETRIEBSART_LABELS[gewaehlterModus] || gewaehlterModus;

  // Zulassungsfelder nur bei „echt" einblenden
  const felder = document.getElementById('baZulassungFelder');
  if (felder) felder.style.display = gewaehlterModus === 'echt' ? '' : 'none';

  // Fehlerhinweis zurücksetzen
  const fehler = document.getElementById('baZulassungFehler');
  if (fehler) fehler.style.display = 'none';
}

/**
 * Speichert die gewählte Betriebsart in terapeut_zertifikat.
 *
 * Besonderheiten:
 * — ik_nummer ist NOT NULL. Bevor der Upsert losgeht, wird die IK aus der
 *   bestehenden Zeile bzw. aus profiles geholt. Fehlt sie überall, bricht
 *   die Funktion ab und erklärt, was fehlt (Backend-Pattern aus upload-signed).
 * — Wechsel nach „echt" und Wechsel von „echt" nach unten erfordern je eine
 *   eigene Bestätigungsmeldung, weil die Konsequenzen unterschiedlich sind.
 */
async function _speichereBetriebsart(deps) {
  const radio = document.querySelector('input[name="betriebsart"]:checked');
  if (!radio) return;
  const neueModus = radio.value;

  // Zulassungsfelder prüfen — nur bei Echtbetrieb obligatorisch
  if (neueModus === 'echt') {
    const ref = (document.getElementById('baZulassungReferenz')?.value || '').trim();
    const dat = (document.getElementById('baZulassungDatum')?.value || '').trim();
    if (!ref || !dat) {
      const fehlerEl = document.getElementById('baZulassungFehler');
      if (fehlerEl) fehlerEl.style.display = '';
      return; // Speichern sperren, Grund ist sichtbar
    }
  }

  const ownerId = deps.ownerId();

  // Bestehende Betriebsart und IK aus DB lesen (IK für NOT-NULL-Pflicht nötig)
  const { data: vorhanden } = await deps.supabase
    .from('terapeut_zertifikat')
    .select('betriebsart, ik_nummer')
    .eq('owner_id', ownerId)
    .maybeSingle();

  const alterModus = vorhanden?.betriebsart || 'test';

  if (alterModus === neueModus) {
    deps.showToast('Betriebsart ist bereits auf „' + BETRIEBSART_LABELS[neueModus] + '" gesetzt.');
    return;
  }

  // IK sicherstellen — ik_nummer ist NOT NULL in der Tabelle. Dasselbe Problem
  // gab es im Backend (abrechnung.routes.js Z. 1188): Upsert ohne IK schlägt
  // lautlos oder mit Fehler fehl. Hier explizit prüfen und erklären.
  let ikNummer = vorhanden?.ik_nummer;
  if (!ikNummer) {
    const { data: profil } = await deps.supabase
      .from('profiles')
      .select('ik_number')
      .eq('id', ownerId)
      .maybeSingle();
    ikNummer = profil?.ik_number || null;
  }
  if (!ikNummer) {
    deps.showToast('Bitte zuerst die IK-Nummer eintragen, bevor die Betriebsart geändert wird.', 'error');
    return;
  }

  // Bestätigungstext je Richtung:
  // Hochstufen → Echt: scharfe Warnung, dass echte Rechnungen erzeugt werden.
  // Runterstufen → Test: Hinweis, dass laufende Abrechnungen unbeeinflusst bleiben.
  let bestaetigung;
  if (neueModus === 'echt') {
    bestaetigung = await deps.showConfirmModal({
      title: 'In den Echtbetrieb wechseln?',
      message:
        'Ab jetzt werden alle erzeugten §302-Dateien als verbindliche Kassenabrechnung behandelt ' +
        '(Dateiname beginnt mit „E"). Dieser Schritt setzt eine schriftliche Zulassung der ' +
        'Krankenkasse voraus. Fortfahren?',
      confirmText: 'Ja, Echtbetrieb aktivieren',
      variant: 'danger',
    });
  } else if (alterModus === 'echt') {
    bestaetigung = await deps.showConfirmModal({
      title: 'Echtbetrieb verlassen?',
      message:
        'Die Betriebsart wird auf „' + BETRIEBSART_LABELS[neueModus] + '" zurückgestellt. ' +
        'Bereits erzeugte Abrechnungsdateien bleiben unverändert. Fortfahren?',
      confirmText: 'Ja, zurückstellen',
      variant: 'warning',
    });
  } else {
    // test ↔ erprobung ohne Echtbetrieb-Beteiligung: kürzere Frage
    bestaetigung = await deps.showConfirmModal({
      title: 'Betriebsart ändern?',
      message:
        'Betriebsart von „' + BETRIEBSART_LABELS[alterModus] + '" auf „' +
        BETRIEBSART_LABELS[neueModus] + '" umstellen?',
      confirmText: 'Ja, umstellen',
    });
  }

  if (!bestaetigung) return; // Abbruch durch den Benutzer

  const btn = document.getElementById('baSpeichernBtn');
  if (btn) { btn.disabled = true; btn.textContent = '…'; }

  try {
    const ref = (document.getElementById('baZulassungReferenz')?.value || '').trim() || null;
    const dat = (document.getElementById('baZulassungDatum')?.value || '').trim() || null;

    const patch = {
      owner_id:                  ownerId,
      ik_nummer:                 ikNummer,
      betriebsart:               neueModus,
      betriebsart_geaendert_am:  new Date().toISOString(),
      betriebsart_geaendert_von: deps.userId(),
    };
    if (neueModus === 'echt') {
      patch.zulassung_referenz = ref;
      patch.zulassung_datum    = dat;
    }

    const { error } = await deps.supabase
      .from('terapeut_zertifikat')
      .upsert(patch, { onConflict: 'owner_id' });

    if (error) throw error;

    deps.showToast(
      'Betriebsart auf „' + BETRIEBSART_LABELS[neueModus] + '" umgestellt ✓'
    );

    // Ansicht sofort auf den neuen Modus bringen, ohne loadSettings erneut aufzurufen
    _aktualisiereBaAnsicht(neueModus);
    // Zeitstempel in der Kopfzeile nachziehen
    const lbl = document.getElementById('baModeLabel');
    const heute = new Date().toLocaleDateString('de-DE');
    const zeitEl = lbl?.parentElement?.querySelector('span');
    if (zeitEl) zeitEl.textContent = `zuletzt umgestellt am ${heute}`;

  } catch (e) {
    console.error('[abrechnung-einstellungen/betriebsart]', e);
    deps.showToast('Fehler: ' + (e.message || 'Speichern fehlgeschlagen'), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Betriebsart speichern'; }
  }
}

/** Minimales HTML-Escaping für Attributwerte. */
function _escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}
