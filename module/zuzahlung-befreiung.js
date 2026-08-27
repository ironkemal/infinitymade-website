/**
 * zuzahlung-befreiung.js — EIN Formular für die Zuzahlungsbefreiung.
 *
 * Das Problem (Meeting 12.08.2026)
 * ────────────────────────────────
 * Kemal: „im Terminaktion, rechtes Portal, 'Befreiungsnachweis eintragen' —
 * diese Funktion ist unterschiedlich als bei Patienten."
 * Beta-2: „das sind die alten Daten, die musst du nur verknüpfen."
 *
 * Es gab drei Stellen, die in dieselbe Tabelle (`zuzahlung_befreiung`)
 * schrieben, mit jeweils anderen Feldern und anderen Vorbelegungen:
 *
 *   1. Termin-Panel  — ab · bis · Nachweis-Art · Notiz · Löschen. Kein Beleg.
 *                      „ab" war auf den 01.01. vorbelegt.
 *   2. Patientenakte — Jahr · ab · bis · Beleg-Upload. Keine Nachweis-Art,
 *                      keine Notiz. „ab" war auf heute vorbelegt.
 *   3. Rezept-Nachweis-Upload — schrieb die Zeile stillschweigend mit
 *                      Ausstellungsdatum … 31.12. (siehe dashboard.js).
 *
 * Wer also im Termin-Panel eine Befreiung ab September eintrug und später in
 * der Akte nachschaute, sah ein Formular, das die vorhandene Zeile gar nicht
 * anzeigte — und beim Speichern überschrieb.
 *
 * Diese Datei ist ab jetzt das einzige Formular. Beide Einstiege öffnen es,
 * beide sehen dieselbe Zeile, dieselben Felder.
 *
 * Wer entscheidet, ab wann befreit ist
 * ────────────────────────────────────
 * Die Datenbank, nicht das Formular. `fn_is_patient_befreit(patient, datum)`
 * prüft `befreit_ab <= datum <= befreit_bis`; zwei Trigger setzen daraufhin
 * `prescriptions.zuzahlung_befreit` — beim Anlegen eines Rezepts und nach
 * jeder Änderung an der Befreiung (nur für noch nicht abgerechnete Rezepte).
 *
 * Deshalb setzt dieses Modul das Kennzeichen NICHT selbst. Die Patientenakte
 * tat das früher von Hand:
 *
 *     UPDATE prescriptions SET zuzahlung_befreit = true, zuzahlung_eur = 0
 *     WHERE patient_id = … AND ausstellungsdatum BETWEEN 'JJJJ-01-01' AND 'JJJJ-12-31'
 *
 * Das ignorierte `befreit_ab` vollständig. Genau der Fall, den Beta-2 genannt
 * hat — „das ganze Jahr keine Befreiung und vielleicht ab September" — wurde
 * damit falsch: die Rezepte von Januar bis August verloren ihre Zuzahlung,
 * also bares Geld, und zwar auch bereits abgerechnete. Übrig bleibt hier nur
 * das Nullsetzen des Betrags für die Rezepte, die der Trigger tatsächlich als
 * befreit markiert hat.
 */

const HEUTE = () => new Date().toISOString().slice(0, 10);

/**
 * Öffnet das Formular. Auflösung: true, wenn gespeichert oder gelöscht wurde.
 *
 * @param {object} opts
 * @param {object} opts.supabase
 * @param {string} opts.patientId
 * @param {string} opts.ownerId
 * @param {string} [opts.patientName]
 * @param {object|null} [opts.existing]   Bekannte Zeile; sonst wird nachgeladen
 * @param {Function} [opts.toast]
 * @param {Function} [opts.confirm]       ({title,message,…}) => Promise<boolean>
 */
export async function oeffneBefreiungsFormular({
  supabase,
  patientId,
  ownerId,
  patientName = '',
  existing = undefined,
  toast = () => {},
  confirm = null,
}) {
  if (!patientId || !ownerId) return false;

  // Vorhandene Zeile IMMER kennen, bevor das Formular aufgeht. Sonst legt der
  // zweite Einstieg eine Befreiung an, die es längst gibt, und überschreibt
  // dabei „ab September" mit „ab 01.01.".
  let row = existing;
  if (row === undefined) {
    const { data } = await supabase
      .from('zuzahlung_befreiung')
      .select('id, jahr, befreit_ab, befreit_bis, nachweis_art, notiz, beleg_url')
      .eq('patient_id', patientId)
      .eq('jahr', new Date().getFullYear())
      .maybeSingle();
    row = data || null;
  }

  return new Promise(resolve => {
    document.getElementById('_zbModal')?.remove();

    const jahr = row?.jahr || new Date().getFullYear();
    const ab = row?.befreit_ab || HEUTE();
    const bis = row?.befreit_bis || `${jahr}-12-31`;
    const art = row?.nachweis_art || 'bescheinigung';
    const notiz = row?.notiz || '';

    const overlay = document.createElement('div');
    overlay.id = '_zbModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;';

    const feld = 'width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:7px;background:var(--bg-input,var(--bg-card));color:var(--text-main);font-size:13px;font-family:inherit;';
    const label = 'margin-bottom:4px;color:var(--text-muted);font-size:12px;';

    overlay.innerHTML = `
      <div role="dialog" aria-modal="true" aria-labelledby="_zbTitle"
        style="background:var(--bg-card-solid);border:1px solid var(--border);border-radius:12px;padding:24px;max-width:420px;width:100%;color:var(--text-main);font-family:inherit;">
        <div id="_zbTitle" style="font-size:15px;font-weight:700;margin-bottom:2px;">Zuzahlungsbefreiung</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">${esc(patientName)}</div>
        <div style="display:grid;gap:12px;">
          <label style="display:block;">
            <div style="${label}">Befreit ab</div>
            <input id="_zbAb" type="date" value="${esc(ab)}" style="${feld}">
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">
              Die Befreiung muss nicht am 1. Januar beginnen. Rezepte davor bleiben zuzahlungspflichtig.
            </div>
          </label>
          <label style="display:block;">
            <div style="${label}">Befreit bis (optional)</div>
            <input id="_zbBis" type="date" value="${esc(bis)}" style="${feld}">
          </label>
          <label style="display:block;">
            <div style="${label}">Nachweis-Art</div>
            <select id="_zbArt" style="${feld}">
              <option value="bescheinigung" ${art === 'bescheinigung' ? 'selected' : ''}>KK-Bescheinigung</option>
              <option value="automatisch" ${art === 'automatisch' ? 'selected' : ''}>Automatisch (KK-Daten)</option>
              <option value="manuell" ${art === 'manuell' ? 'selected' : ''}>Manuelle Eingabe</option>
            </select>
          </label>
          <label style="display:block;">
            <div style="${label}">Bescheinigung (PDF/Bild, optional)</div>
            <input id="_zbFile" type="file" accept="image/*,application/pdf" style="${feld}">
            ${row?.beleg_url ? '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Ein Beleg ist hinterlegt. Eine neue Datei ersetzt ihn.</div>' : ''}
          </label>
          <label style="display:block;">
            <div style="${label}">Notiz (optional)</div>
            <input id="_zbNotiz" type="text" value="${esc(notiz)}" placeholder="z. B. Antrag eingereicht am…" style="${feld}">
          </label>
        </div>
        <div id="_zbErr" style="color:var(--danger,#f87171);font-size:12px;margin-top:8px;display:none;"></div>
        <div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end;">
          ${row ? '<button id="_zbDel" style="padding:8px 14px;border:1px solid var(--danger,#dc2626);border-radius:7px;background:transparent;color:var(--danger,#f87171);cursor:pointer;font-size:13px;margin-right:auto;font-family:inherit;">Löschen</button>' : ''}
          <button id="_zbCancel" style="padding:8px 16px;border:1px solid var(--border);border-radius:7px;background:transparent;color:var(--text-main);cursor:pointer;font-size:13px;font-family:inherit;">Abbrechen</button>
          <button id="_zbSave" style="padding:8px 16px;border:none;border-radius:7px;background:var(--accent,#b1891b);color:#fff;cursor:pointer;font-size:13px;font-weight:600;font-family:inherit;">Speichern</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const err = overlay.querySelector('#_zbErr');
    const zeigeFehler = (t) => { err.textContent = t; err.style.display = ''; };
    const schliessen = (ergebnis) => {
      document.removeEventListener('keydown', onEsc);
      overlay.remove();
      resolve(ergebnis);
    };
    function onEsc(e) { if (e.key === 'Escape') schliessen(false); }
    document.addEventListener('keydown', onEsc);

    overlay.querySelector('#_zbCancel').onclick = () => schliessen(false);
    overlay.onclick = e => { if (e.target === overlay) schliessen(false); };

    const delBtn = overlay.querySelector('#_zbDel');
    if (delBtn) {
      delBtn.onclick = async () => {
        const ok = confirm
          ? await confirm({
              title: 'Befreiung löschen',
              message: 'Zuzahlungsbefreiung wirklich löschen? Betroffene Rezepte werden wieder zuzahlungspflichtig.',
              confirmText: 'Löschen', cancelText: 'Abbrechen', variant: 'danger',
            })
          : window.confirm('Zuzahlungsbefreiung wirklich löschen?');
        if (!ok) return;
        delBtn.disabled = true;
        const { error } = await supabase.from('zuzahlung_befreiung').delete().eq('id', row.id);
        if (error) { delBtn.disabled = false; return zeigeFehler('Fehler: ' + error.message); }
        // Kein Nachfassen an den Rezepten nötig: der Trigger rechnet sie neu.
        toast('Befreiung gelöscht');
        schliessen(true);
      };
    }

    overlay.querySelector('#_zbSave').onclick = async () => {
      const saveBtn = overlay.querySelector('#_zbSave');
      const abVal = overlay.querySelector('#_zbAb').value;
      const bisVal = overlay.querySelector('#_zbBis').value || null;
      if (!abVal) return zeigeFehler('Bitte „Befreit ab" ausfüllen.');
      if (bisVal && bisVal < abVal) return zeigeFehler('„Befreit bis" muss nach „Befreit ab" liegen.');

      const file = overlay.querySelector('#_zbFile').files[0];
      if (file && file.size > 5 * 1024 * 1024) return zeigeFehler('Datei zu groß (max. 5 MB).');

      saveBtn.disabled = true;
      saveBtn.textContent = '…';

      // Das Jahr wird aus „befreit ab" abgeleitet, nicht getrennt eingegeben.
      // Als eigenes Feld liess es sich auf 2026 stellen, während „ab" im
      // September 2025 lag — die Zeile lag dann unter dem falschen Jahr, und
      // der eindeutige Schlüssel (patient_id, jahr) griff daneben.
      const jahrAusAb = parseInt(abVal.slice(0, 4), 10);

      let belegPfad = row?.beleg_url || null;
      if (file) {
        const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
        belegPfad = `${ownerId}/${patientId}/befreiung_${jahrAusAb}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('patient-documents')
          .upload(belegPfad, file, { contentType: file.type || 'application/octet-stream', upsert: true });
        if (upErr) {
          saveBtn.disabled = false; saveBtn.textContent = 'Speichern';
          return zeigeFehler('Upload-Fehler: ' + upErr.message);
        }
      }

      const { error } = await supabase.from('zuzahlung_befreiung').upsert({
        owner_id: ownerId,
        patient_id: patientId,
        jahr: jahrAusAb,
        befreit_ab: abVal,
        befreit_bis: bisVal,
        nachweis_art: overlay.querySelector('#_zbArt').value,
        notiz: overlay.querySelector('#_zbNotiz').value.trim() || null,
        beleg_url: belegPfad,
      }, {
        // Lebende Bedingung ist UNIQUE (patient_id, jahr) — owner_id gehört
        // NICHT dazu. Stand hier früher „owner_id,patient_id,jahr", warf
        // Postgres 42P10 und das Formular speicherte stillschweigend nichts.
        onConflict: 'patient_id,jahr',
        ignoreDuplicates: false,
      });

      if (error) {
        saveBtn.disabled = false; saveBtn.textContent = 'Speichern';
        return zeigeFehler('Fehler: ' + error.message);
      }

      await betragNullsetzen(supabase, patientId, ownerId);
      toast('Zuzahlungsbefreiung gespeichert ✓');
      schliessen(true);
    };
  });
}

/**
 * Der Trigger setzt das Kennzeichen `zuzahlung_befreit` datumsgenau. Der
 * geforderte Betrag muss danach noch auf 0 — aber ausschliesslich bei den
 * Rezepten, die der Trigger auch wirklich als befreit markiert hat, und nur
 * solange sie nicht abgerechnet sind. Eine Zeitspanne wird hier bewusst nicht
 * gerechnet; das täte eine zweite, konkurrierende Wahrheit auf.
 */
async function betragNullsetzen(supabase, patientId, ownerId) {
  const { error } = await supabase
    .from('prescriptions')
    .update({ zuzahlung_eur: 0 })
    .eq('patient_id', patientId)
    .eq('owner_id', ownerId)
    .eq('zuzahlung_befreit', true)
    .is('abrechnung_id', null)
    .gt('zuzahlung_eur', 0);
  if (error) console.warn('[befreiung] Betrag konnte nicht genullt werden:', error.message);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
