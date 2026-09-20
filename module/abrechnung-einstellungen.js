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

let _aktuellerModus = 'test';

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
        statusEl.style.color = 'var(--success, #15803d)';
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

  const mount = document.getElementById('betriebsartMount');
  if (mount && !document.getElementById('baVorgabewertMount')) {
    mount.innerHTML = `
      <div id="baVorgabewertMount"></div>
      <div id="baAusnahmenMount"></div>
    `;
  }

  _renderBetriebsartSchalter({ aktuell, geaendertAm, zulassungReferenz, zulassungDatum });
  await _renderAusnahmenBlock(deps);
}

/**
 * Baut den Betriebsart-Schalter in #betriebsartMount.
 * Private Funktion — nur von renderAbrechnungSettings aufgerufen.
 */
function _renderBetriebsartSchalter({ aktuell, geaendertAm, zulassungReferenz, zulassungDatum }) {
  const mount = document.getElementById('baVorgabewertMount') || document.getElementById('betriebsartMount');
  if (!mount) return;

  _aktuellerModus = aktuell || 'test';

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
        Betriebsart der §302-Abrechnung (Vorgabewert)
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">
        Aktuell (Vorgabewert): <strong id="baModeLabel">${BETRIEBSART_LABELS[aktuell] || aktuell}</strong>
        ${geaendertAm ? `<span style="margin-left:10px;font-size:11px;color:var(--text-muted);">zuletzt umgestellt am ${geaendertAm}</span>` : ''}
      </div>
      <div id="baBeschreibung" style="font-size:12px;color:var(--text-muted);margin-bottom:12px;padding:8px 10px;background:var(--bg-card-solid,#1f2937);border-radius:6px;border:1px solid var(--border);">
        ${beschreibungen[aktuell] || ''}
      </div>
      <div class="form-group" style="margin-bottom:10px;">
        <label class="form-label" style="margin-bottom:6px;">Vorgabewert wählen</label>
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
      <button class="btn-primary" id="baSpeichernBtn" style="margin-top:4px;">Vorgabewert speichern</button>
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

  // --- Betriebsart-Schalter: Vorgabewert & Ausnahmen je Datenannahmestelle ---
  abrSection.addEventListener('change', (e) => {
    const radio = e.target.closest('input[type="radio"][name="betriebsart"]');
    if (radio) {
      _aktualisiereBaAnsicht(radio.value);
      return;
    }
    const ausnahmeRadio = e.target.closest('input[type="radio"][name="ausnahme_betriebsart"]');
    if (ausnahmeRadio) {
      _aktualisiereAusnahmeBaAnsicht(ausnahmeRadio.value);
    }
  });

  abrSection.addEventListener('input', async (e) => {
    if (e.target.id !== 'baAusnahmeIk') return;
    const val = e.target.value.trim();
    const previewEl = document.getElementById('baAusnahmeNamePreview');
    if (!previewEl) return;
    if (!/^\d{9}$/.test(val)) {
      previewEl.textContent = val.length === 0 ? '' : (val.length < 9 ? '9-stellige IK eingeben…' : 'IK muss genau 9 Ziffern enthalten.');
      previewEl.style.color = 'var(--text-muted)';
      return;
    }
    previewEl.textContent = 'Name wird geladen…';
    previewEl.style.color = 'var(--text-muted)';
    const name = await _loeseEmpfaengerNameAuf(deps.supabase, val);
    if (document.getElementById('baAusnahmeIk')?.value.trim() === val) {
      if (name) {
        previewEl.textContent = name;
        previewEl.style.color = 'var(--text-main)';
      } else {
        previewEl.textContent = 'Name nicht gefunden (Speichern trotzdem möglich)';
        previewEl.style.color = 'var(--text-muted)';
      }
    }
  });

  abrSection.addEventListener('click', async (e) => {
    if (e.target.closest('#baSpeichernBtn')) {
      await _speichereBetriebsart(deps);
      return;
    }

    if (e.target.closest('#baAusnahmeSpeichernBtn')) {
      await _speichereAusnahme(deps);
      return;
    }

    const editBtn = e.target.closest('[data-action="edit-ausnahme"]');
    if (editBtn) {
      const ik = editBtn.dataset.ik || '';
      const mode = editBtn.dataset.mode || 'test';
      const ref = editBtn.dataset.ref || '';
      const dat = editBtn.dataset.date || '';

      const ikInp = document.getElementById('baAusnahmeIk');
      if (ikInp) {
        ikInp.value = ik;
        ikInp.focus();
      }
      const radio = document.querySelector(`input[name="ausnahme_betriebsart"][value="${mode}"]`);
      if (radio) {
        radio.checked = true;
        _aktualisiereAusnahmeBaAnsicht(mode);
      }
      const refInp = document.getElementById('baAusnahmeZulassungReferenz');
      if (refInp) refInp.value = ref;
      const datInp = document.getElementById('baAusnahmeZulassungDatum');
      if (datInp) datInp.value = dat;

      const previewEl = document.getElementById('baAusnahmeNamePreview');
      if (previewEl && ik) {
        previewEl.textContent = 'Name wird geladen…';
        previewEl.style.color = 'var(--text-muted)';
        const name = await _loeseEmpfaengerNameAuf(deps.supabase, ik);
        if (document.getElementById('baAusnahmeIk')?.value.trim() === ik) {
          if (name) {
            previewEl.textContent = name;
            previewEl.style.color = 'var(--text-main)';
          } else {
            previewEl.textContent = 'Name nicht gefunden (Speichern trotzdem möglich)';
            previewEl.style.color = 'var(--text-muted)';
          }
        }
      }
      return;
    }

    const delBtn = e.target.closest('[data-action="delete-ausnahme"]');
    if (delBtn) {
      const ik = delBtn.dataset.ik;
      if (!ik) return;
      const ok = await deps.showConfirmModal({
        title: 'Ausnahme entfernen?',
        message: `Soll die Ausnahme für die Datenannahmestelle ${ik} wirklich gelöscht werden? Anschließend gilt wieder der oben festgelegte Vorgabewert.`,
        confirmText: 'Ausnahme löschen',
        variant: 'danger',
      });
      if (!ok) return;

      const { error } = await deps.supabase
        .from('betriebsart_empfaenger')
        .delete()
        .eq('owner_id', deps.ownerId())
        .eq('empfaenger_ik', ik);

      if (error) {
        deps.showToast('Fehler beim Löschen: ' + error.message, 'error');
      } else {
        deps.showToast(`Ausnahme für Datenannahmestelle ${ik} entfernt ✓`);
        await _renderAusnahmenBlock(deps);
      }
      return;
    }
  });
}

/** Das „Aktuell"-Etikett spiegelt die DATENBANK, nicht die Auswahl im
 *  Formular. Es wird deshalb nur beim Aufbau der Ansicht und nach einem
 *  ERFOLGREICHEN Speichern gesetzt — sonst behauptet der Bildschirm einen
 *  Betriebsmodus, den der Server abgelehnt hat (z. B. „echt" ohne Zulassung). */
function _setzeAktuellLabel(modus) {
  _aktuellerModus = modus || 'test';
  const lbl = document.getElementById('baModeLabel');
  if (lbl) lbl.textContent = BETRIEBSART_LABELS[modus] || modus;
  const ung = document.getElementById('baUngespeichert');
  if (ung) ung.remove();
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

  // Zulassungsfelder nur bei „echt" einblenden
  const felder = document.getElementById('baZulassungFelder');
  if (felder) felder.style.display = gewaehlterModus === 'echt' ? '' : 'none';

  // Fehlerhinweis zurücksetzen
  const fehler = document.getElementById('baZulassungFehler');
  if (fehler) fehler.style.display = 'none';

  // Ungespeichert-Hinweis anzeigen oder entfernen
  const modeLbl = document.getElementById('baModeLabel');
  let ungEl = document.getElementById('baUngespeichert');
  if (gewaehlterModus !== _aktuellerModus) {
    if (!ungEl && modeLbl) {
      ungEl = document.createElement('span');
      ungEl.id = 'baUngespeichert';
      modeLbl.insertAdjacentElement('afterend', ungEl);
    }
    if (ungEl) {
      ungEl.style.marginLeft = '8px';
      ungEl.style.fontSize = '11px';
      ungEl.style.color = '#ea580c';
      ungEl.textContent = 'noch nicht gespeichert';
    }
  } else if (ungEl) {
    ungEl.remove();
  }
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
    deps.showToast('Vorgabewert ist bereits auf „' + BETRIEBSART_LABELS[neueModus] + '" gesetzt.');
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
      title: 'Vorgabewert: In den Echtbetrieb wechseln?',
      message:
        'Ab jetzt werden alle erzeugten §302-Dateien ohne gesonderte Ausnahme als verbindliche Kassenabrechnung ' +
        'behandelt (Dateiname beginnt mit „E"). Dieser Schritt setzt eine schriftliche Zulassung der ' +
        'Krankenkasse voraus. Fortfahren?',
      confirmText: 'Ja, Echtbetrieb aktivieren',
      variant: 'danger',
    });
  } else if (alterModus === 'echt') {
    bestaetigung = await deps.showConfirmModal({
      title: 'Vorgabewert: Echtbetrieb verlassen?',
      message:
        'Der Vorgabewert wird auf „' + BETRIEBSART_LABELS[neueModus] + '" zurückgestellt. ' +
        'Bereits erzeugte Abrechnungsdateien bleiben unverändert. Fortfahren?',
      confirmText: 'Ja, zurückstellen',
      variant: 'warning',
    });
  } else {
    // test ↔ erprobung ohne Echtbetrieb-Beteiligung: kürzere Frage
    bestaetigung = await deps.showConfirmModal({
      title: 'Vorgabewert der Betriebsart ändern?',
      message:
        'Vorgabewert von „' + BETRIEBSART_LABELS[alterModus] + '" auf „' +
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

    const { data: gespeichert, error } = await deps.supabase
      .from('terapeut_zertifikat')
      .upsert(patch, { onConflict: 'owner_id' })
      .select('betriebsart')
      .maybeSingle();

    if (error) throw error;

    const bestaetigterModus = gespeichert?.betriebsart || neueModus;

    deps.showToast(
      'Vorgabewert auf „' + (BETRIEBSART_LABELS[bestaetigterModus] || bestaetigterModus) + '" umgestellt ✓'
    );

    // Ansicht sofort auf den neuen Modus bringen, ohne loadSettings erneut aufzurufen
    _aktualisiereBaAnsicht(bestaetigterModus);
    _setzeAktuellLabel(bestaetigterModus);

    // Zeitstempel in der Kopfzeile nachziehen
    const lbl = document.getElementById('baModeLabel');
    const heute = new Date().toLocaleDateString('de-DE');
    const zeitEl = lbl?.parentElement?.querySelector('span');
    if (zeitEl) zeitEl.textContent = `zuletzt umgestellt am ${heute}`;

  } catch (e) {
    console.error('[abrechnung-einstellungen/betriebsart]', e);
    deps.showToast('Fehler: ' + (e.message || 'Speichern fehlgeschlagen'), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Vorgabewert speichern'; }
  }
}

/**
 * Löst eine 9-stellige Datenannahmestellen-IK zu einem lesbaren Kostenträger-Namen auf.
 * Reihenfolge:
 * 1. kostentraeger_annahmestellen (partner_ik = ik -> kostentraeger_ik -> Name aus kostentraeger)
 * 2. kostentraeger direkt (ik = ik -> name)
 * Findet sich nichts, liefert die Funktion null (Name ist reine Anzeige, kein Sperrgrund).
 */
async function _loeseEmpfaengerNameAuf(supabase, ik) {
  if (!ik || !/^\d{9}$/.test(ik)) return null;

  try {
    const { data: ann } = await supabase
      .from('kostentraeger_annahmestellen')
      .select('kostentraeger_ik')
      .eq('partner_ik', ik)
      .limit(1)
      .maybeSingle();

    if (ann?.kostentraeger_ik) {
      const { data: kt } = await supabase
        .from('kostentraeger')
        .select('name')
        .eq('ik', ann.kostentraeger_ik)
        .maybeSingle();
      if (kt?.name) return kt.name;
    }

    const { data: ktDirect } = await supabase
      .from('kostentraeger')
      .select('name')
      .eq('ik', ik)
      .maybeSingle();

    if (ktDirect?.name) return ktDirect.name;
  } catch (err) {
    console.warn('[abrechnung-einstellungen] Namensauflösung für IK ' + ik + ' fehlgeschlagen:', err);
  }

  return null;
}

/**
 * Rendert den Abschnitt «Ausnahmen je Datenannahmestelle» in #baAusnahmenMount.
 * Listet vorhandene Einträge aus betriebsart_empfaenger und stellt das Formular bereit.
 * Fehlt die Tabelle (Migration 0031 noch nicht eingespielt), blendet sich der Block
 * lautlos aus und loggt eine Warnung (stört den Rest der Einstellungsseite nicht).
 */
async function _renderAusnahmenBlock(deps) {
  const mount = document.getElementById('baAusnahmenMount');
  if (!mount) return;

  if (deps.profile()?.role !== 'owner') {
    mount.innerHTML = '';
    return;
  }

  let { data: ausnahmen, error } = await deps.supabase
    .from('betriebsart_empfaenger')
    .select('empfaenger_ik, betriebsart, zulassung_referenz, zulassung_datum, updated_at')
    .eq('owner_id', deps.ownerId())
    .order('empfaenger_ik');

  if (error) {
    if (/relation|column|table|does not exist|42P01|42703/i.test(String(error.message || error.code || ''))) {
      console.warn('[abrechnung-einstellungen] Tabelle betriebsart_empfaenger fehlt noch (Migration 0031 ausstehend). Ausnahmen-Abschnitt wird ausgeblendet.');
      mount.innerHTML = '';
      return;
    }
    console.error('[abrechnung-einstellungen] Fehler beim Laden von betriebsart_empfaenger:', error);
  }

  const rows = ausnahmen || [];
  const namen = await Promise.all(rows.map(r => _loeseEmpfaengerNameAuf(deps.supabase, r.empfaenger_ik)));

  mount.innerHTML = `
    <div style="margin-top:24px;padding-top:20px;border-top:1px solid var(--border);">
      <div style="font-size:14px;font-weight:600;color:var(--text-main);margin-bottom:4px;">
        Ausnahmen je Datenannahmestelle
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px;line-height:1.4;">
        Zulassung und Erprobung laufen je Absender↔Empfänger-Paar (Anlage 1 TP5 V21, Kap. 2 und 8). Für Datenannahmestellen ohne gesonderten Eintrag gilt der oben festgelegte Vorgabewert.
      </div>

      ${rows.length === 0 ? `
        <div style="font-size:12px;color:var(--text-muted);padding:10px 12px;background:var(--bg-card-solid,var(--bg-card));border:1px dashed var(--border);border-radius:6px;margin-bottom:16px;">
          Keine abweichenden Ausnahmen hinterlegt — für alle Datenannahmestellen gilt der Vorgabewert.
        </div>
      ` : `
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;" id="baAusnahmenListe">
          ${rows.map((r, i) => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--bg-card-solid,var(--bg-card));border:1px solid var(--border);border-radius:6px;gap:12px;flex-wrap:wrap;">
              <div style="display:flex;flex-direction:column;gap:3px;min-width:200px;flex:1;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="font-size:13px;font-weight:600;color:var(--text-main);font-family:monospace;">${_escHtml(r.empfaenger_ik)}</span>
                  <span style="font-size:11px;padding:2px 6px;border-radius:4px;border:1px solid var(--border);color:var(--text-main);background:var(--bg-card);font-weight:500;">${_escHtml(BETRIEBSART_LABELS[r.betriebsart] || r.betriebsart)}</span>
                </div>
                <div style="font-size:12px;color:var(--text-muted);">${_escHtml(namen[i] || 'Name nicht gefunden')}</div>
                ${r.betriebsart === 'echt' ? `
                  <div style="font-size:11px;color:var(--text-muted);">
                    Zulassung: <strong>${_escHtml(r.zulassung_referenz || '—')}</strong> · Datum: <strong>${_escHtml(r.zulassung_datum ? new Date(r.zulassung_datum).toLocaleDateString('de-DE') : '—')}</strong>
                  </div>
                ` : ''}
              </div>
              <div style="display:flex;gap:6px;align-items:center;">
                <button type="button" class="btn-secondary" data-action="edit-ausnahme" data-ik="${_escHtml(r.empfaenger_ik)}" data-mode="${_escHtml(r.betriebsart)}" data-ref="${_escHtml(r.zulassung_referenz || '')}" data-date="${_escHtml(r.zulassung_datum || '')}" style="padding:4px 8px;font-size:12px;">Bearbeiten</button>
                <button type="button" class="btn-secondary" data-action="delete-ausnahme" data-ik="${_escHtml(r.empfaenger_ik)}" style="padding:4px 8px;font-size:12px;color:var(--danger,#ef4444);">Löschen</button>
              </div>
            </div>
          `).join('')}
        </div>
      `}

      <div style="padding:12px;background:var(--bg-card-solid,var(--bg-card));border:1px solid var(--border);border-radius:6px;">
        <div style="font-size:13px;font-weight:600;color:var(--text-main);margin-bottom:10px;">
          Ausnahme anlegen oder ändern
        </div>
        <div class="form-group" style="margin-bottom:10px;">
          <label class="form-label" style="margin-bottom:4px;">Institutionskennzeichen (IK) der Datenannahmestelle</label>
          <input class="form-input" id="baAusnahmeIk" type="text" maxlength="9" placeholder="9-stellige IK, z. B. 660530010" style="max-width:240px;font-family:monospace;" />
          <div id="baAusnahmeNamePreview" style="font-size:12px;color:var(--text-muted);margin-top:4px;"></div>
        </div>

        <div class="form-group" style="margin-bottom:10px;">
          <label class="form-label" style="margin-bottom:6px;">Betriebsart für diese Datenannahmestelle</label>
          <div style="display:flex;flex-direction:column;gap:6px;" id="baAusnahmeRadioGroup">
            ${['test','erprobung','echt'].map(m => `
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:8px 10px;border-radius:6px;border:1px solid ${m === 'test' ? 'var(--primary,#6366f1)' : 'var(--border)'};background:${m === 'test' ? 'var(--bg-card)' : 'transparent'};" data-ba-option="${m}">
                <input type="radio" name="ausnahme_betriebsart" value="${m}" ${m === 'test' ? 'checked' : ''} style="accent-color:var(--primary,#6366f1);">
                <span style="color:var(--text-main);font-weight:${m === 'test' ? '600' : '400'};">${BETRIEBSART_LABELS[m]}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <div id="baAusnahmeZulassungFelder" style="display:none;margin-bottom:12px;">
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;padding:8px 10px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;">
            Für den Echtbetrieb ist eine schriftliche <strong>Zulassung zum Echtverfahren</strong> durch die Krankenkasse erforderlich (nicht durch die Datenannahmestelle). Bitte Referenz und Datum der Zulassung eintragen.
          </div>
          <div class="form-row" style="gap:10px;">
            <div class="form-group" style="flex:1;">
              <label class="form-label">Aktenzeichen / Referenz der Zulassung</label>
              <input class="form-input" id="baAusnahmeZulassungReferenz" type="text" placeholder="z. B. KK-2026/302-1234" />
            </div>
            <div class="form-group" style="flex:0 0 160px;">
              <label class="form-label">Datum der Zulassung</label>
              <input class="form-input" id="baAusnahmeZulassungDatum" type="date" />
            </div>
          </div>
          <div id="baAusnahmeZulassungFehler" style="font-size:12px;color:var(--danger,#ef4444);margin-top:4px;display:none;">
            Bitte Aktenzeichen und Datum der Zulassung ausfüllen, um den Echtbetrieb zu speichern.
          </div>
        </div>

        <button class="btn-primary" id="baAusnahmeSpeichernBtn" type="button" style="margin-top:4px;">Ausnahme speichern</button>
      </div>
    </div>
  `;
}

/**
 * Passt die Radiogruppen-Optik und Zulassungsfelder des Ausnahmen-Formulars an.
 */
function _aktualisiereAusnahmeBaAnsicht(gewaehlterModus) {
  document.querySelectorAll('#baAusnahmeRadioGroup label[data-ba-option]').forEach(lbl => {
    const m = lbl.dataset.baOption;
    const aktiv = m === gewaehlterModus;
    lbl.style.border = `1px solid ${aktiv ? 'var(--primary,#6366f1)' : 'var(--border)'}`;
    lbl.style.background = aktiv ? 'var(--bg-card)' : 'transparent';
    const span = lbl.querySelector('span');
    if (span) span.style.fontWeight = aktiv ? '600' : '400';
  });

  const felder = document.getElementById('baAusnahmeZulassungFelder');
  if (felder) felder.style.display = gewaehlterModus === 'echt' ? '' : 'none';

  const fehler = document.getElementById('baAusnahmeZulassungFehler');
  if (fehler) fehler.style.display = 'none';
}

/**
 * Speichert eine Ausnahme in betriebsart_empfaenger.
 */
async function _speichereAusnahme(deps) {
  const ikInp = document.getElementById('baAusnahmeIk');
  const ik = (ikInp?.value || '').trim();
  if (!ik || !/^\d{9}$/.test(ik)) {
    deps.showToast('IK muss genau 9 Ziffern enthalten.', 'error');
    ikInp?.focus();
    return;
  }

  const radio = document.querySelector('input[name="ausnahme_betriebsart"]:checked');
  const betriebsart = radio?.value || 'test';

  let ref = null;
  let dat = null;

  if (betriebsart === 'echt') {
    ref = (document.getElementById('baAusnahmeZulassungReferenz')?.value || '').trim();
    dat = (document.getElementById('baAusnahmeZulassungDatum')?.value || '').trim();
    if (!ref || !dat) {
      const fehlerEl = document.getElementById('baAusnahmeZulassungFehler');
      if (fehlerEl) fehlerEl.style.display = '';
      return;
    }
  }

  if (betriebsart === 'echt') {
    const ok = await deps.showConfirmModal({
      title: 'Echtbetrieb für Datenannahmestelle aktivieren?',
      message:
        `Ab jetzt werden alle §302-Dateien an die Datenannahmestelle ${ik} als verbindliche Kassenabrechnung ` +
        `behandelt (Dateiname beginnt mit „E"). Dieser Schritt setzt eine schriftliche Zulassung der ` +
        `Krankenkasse voraus. Fortfahren?`,
      confirmText: 'Ja, Ausnahme auf Echtbetrieb setzen',
      variant: 'danger',
    });
    if (!ok) return;
  }

  const btn = document.getElementById('baAusnahmeSpeichernBtn');
  if (btn) { btn.disabled = true; btn.textContent = '…'; }

  try {
    const payload = {
      owner_id:           deps.ownerId(),
      empfaenger_ik:      ik,
      betriebsart,
      zulassung_referenz: betriebsart === 'echt' ? ref : null,
      zulassung_datum:    betriebsart === 'echt' ? dat : null,
      updated_at:         new Date().toISOString(),
      updated_by:         deps.userId(),
    };

    const { error } = await deps.supabase
      .from('betriebsart_empfaenger')
      .upsert(payload, { onConflict: 'owner_id,empfaenger_ik' });

    if (error) throw error;

    deps.showToast(`Ausnahme für Datenannahmestelle ${ik} gespeichert ✓`);

    if (ikInp) ikInp.value = '';
    const previewEl = document.getElementById('baAusnahmeNamePreview');
    if (previewEl) previewEl.textContent = '';
    const refInp = document.getElementById('baAusnahmeZulassungReferenz');
    if (refInp) refInp.value = '';
    const datInp = document.getElementById('baAusnahmeZulassungDatum');
    if (datInp) datInp.value = '';
    const defaultRadio = document.querySelector('input[name="ausnahme_betriebsart"][value="test"]');
    if (defaultRadio) {
      defaultRadio.checked = true;
      _aktualisiereAusnahmeBaAnsicht('test');
    }

    await _renderAusnahmenBlock(deps);
  } catch (e) {
    console.error('[abrechnung-einstellungen/ausnahme]', e);
    deps.showToast('Fehler beim Speichern der Ausnahme: ' + (e.message || 'Unbekannter Fehler'), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Ausnahme speichern'; }
  }
}

/** Minimales HTML-Escaping für Attributwerte. */
function _escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}
