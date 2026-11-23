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
import { alsISODatum, datumDe } from './datum.js?v=20261001a';

const HEUTE = () => alsISODatum(new Date());

/**
 * Prüft Jahreswechsel-Hinweise für Zuzahlungsbefreiungen (rein, unit-testbar):
 *
 * 1. Neues Jahr ohne Eintrag, aber Vorjahr war befreit →
 *    „War 2026 zuzahlungsbefreit (bis 31.12.2026) — neuen Befreiungsausweis für 2027 vorlegen lassen.“
 * 2. Dezember mit laufender Befreiung, aber Folgejahr noch nicht hinterlegt →
 *    „Befreiung 2026 läuft am 31.12.2026 aus — neuen Ausweis für 2027 bereits jetzt anfordern.“
 *
 * @param {Array<{ jahr?: number, befreit_ab?: string|null, befreit_bis?: string|null, nachweis_art?: string|null }> | null | undefined} zeilen
 * @param {string} [heuteIso]  'YYYY-MM-DD'
 * @returns {{
 *   vorjahr: number,
 *   zielJahr: number,
 *   vorjahrBis: string,
 *   nachweisArt: string,
 *   vorschlagAb: string,
 *   vorschlagBis: string,
 *   istJahresende: boolean,
 *   meldung: string,
 * } | null}
 */
export function vorjahresBefreiungHinweis(zeilen, heuteIso = HEUTE()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(heuteIso || '').trim());
  if (!m) return null;
  const aktuellesJahr = Number(m[1]);
  const monat = Number(m[2]);
  const liste = Array.isArray(zeilen) ? zeilen.filter(Boolean) : [];
  if (!liste.length) return null;

  const nachJahr = (j) => liste.find(z => Number(z.jahr) === j) || null;
  const aktRow = nachJahr(aktuellesJahr);
  const vorRow = nachJahr(aktuellesJahr - 1);
  const folgeRow = nachJahr(aktuellesJahr + 1);

  if (!aktRow && vorRow) {
    const vorjahr = aktuellesJahr - 1;
    const vorjahrBis = vorRow.befreit_bis || `${vorjahr}-12-31`;
    return {
      vorjahr,
      zielJahr: aktuellesJahr,
      vorjahrBis,
      nachweisArt: vorRow.nachweis_art || 'bescheinigung',
      vorschlagAb: `${aktuellesJahr}-01-01`,
      vorschlagBis: `${aktuellesJahr}-12-31`,
      istJahresende: false,
      meldung: `War ${vorjahr} zuzahlungsbefreit (bis ${datumDe(vorjahrBis, vorjahrBis)}) — neuen Befreiungsausweis für ${aktuellesJahr} vorlegen lassen.`,
    };
  }

  if (aktRow && monat === 12 && !folgeRow) {
    const zielJahr = aktuellesJahr + 1;
    const vorjahrBis = aktRow.befreit_bis || `${aktuellesJahr}-12-31`;
    return {
      vorjahr: aktuellesJahr,
      zielJahr,
      vorjahrBis,
      nachweisArt: aktRow.nachweis_art || 'bescheinigung',
      vorschlagAb: `${zielJahr}-01-01`,
      vorschlagBis: `${zielJahr}-12-31`,
      istJahresende: true,
      meldung: `Befreiung ${aktuellesJahr} läuft am ${datumDe(vorjahrBis, vorjahrBis)} aus — neuen Ausweis für ${zielJahr} bereits jetzt anfordern.`,
    };
  }

  return null;
}

/**
 * Lädt Vorjahr, aktuelles Jahr und Folgejahr eines Patienten in einer Abfrage
 * und liefert ggf. den Jahreswechsel-Hinweis.
 *
 * @param {any} supabase
 * @param {string} patientId
 * @param {string} [heuteIso]
 */
export async function ladeVorjahresBefreiungHinweis(supabase, patientId, heuteIso = HEUTE()) {
  if (!supabase || !patientId) return null;
  const aktuellesJahr = Number(String(heuteIso).slice(0, 4)) || new Date().getFullYear();
  const { data, error } = await supabase
    .from('zuzahlung_befreiung')
    .select('id, jahr, befreit_ab, befreit_bis, nachweis_art, notiz, beleg_url')
    .eq('patient_id', patientId)
    .in('jahr', [aktuellesJahr - 1, aktuellesJahr, aktuellesJahr + 1]);
  if (error || !Array.isArray(data)) return null;
  return vorjahresBefreiungHinweis(data, heuteIso);
}

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
  // dabei „ab September" mit „ab 01.01.". Gleichzeitig Vorjahr + Folgejahr
  // mitladen, damit der Jahreswechsel-Hinweis (Dez/Jan) sofort erscheint.
  const heuteIso = HEUTE();
  const aktuellesJahr = Number(heuteIso.slice(0, 4)) || new Date().getFullYear();
  let alleZeilen = [];
  const { data: zeilenDaten } = await supabase
    .from('zuzahlung_befreiung')
    .select('id, jahr, befreit_ab, befreit_bis, nachweis_art, notiz, beleg_url')
    .eq('patient_id', patientId)
    .in('jahr', [aktuellesJahr - 1, aktuellesJahr, aktuellesJahr + 1]);
  if (Array.isArray(zeilenDaten)) alleZeilen = zeilenDaten;

  let row = existing;
  if (row === undefined) {
    row = alleZeilen.find(z => Number(z.jahr) === aktuellesJahr) || null;
  }
  const wechselHinweis = vorjahresBefreiungHinweis(alleZeilen, heuteIso);

  return new Promise(resolve => {
    document.getElementById('_zbModal')?.remove();

    const jahr = row?.jahr || aktuellesJahr;
    const ab = row?.befreit_ab || heuteIso;
    const bis = row?.befreit_bis || `${jahr}-12-31`;
    const art = row?.nachweis_art || 'bescheinigung';
    const notiz = row?.notiz || '';

    const overlay = document.createElement('div');
    overlay.id = '_zbModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;';

    const feld = 'width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:7px;background:var(--bg-input,var(--bg-card));color:var(--text-main);font-size:13px;font-family:inherit;';
    const label = 'margin-bottom:4px;color:var(--text-muted);font-size:12px;';
    const wechselBannerHtml = wechselHinweis ? `
      <div id="_zbVorjahrHinweis" style="margin-bottom:14px;padding:10px 12px;border:1px solid var(--warning,#d97706);border-radius:8px;background:color-mix(in srgb,var(--warning,#d97706) 10%,transparent);font-size:12px;line-height:1.45;color:var(--text-main);">
        <div>${esc(wechselHinweis.meldung)}</div>
        <button id="_zbUebernehmen" type="button" style="margin-top:8px;padding:5px 10px;border:1px solid var(--warning,#d97706);border-radius:6px;background:var(--bg-card-solid);color:var(--text-main);cursor:pointer;font-size:12px;font-weight:600;font-family:inherit;">
          Für ${wechselHinweis.zielJahr} vorbefüllen (01.01.–31.12.${wechselHinweis.zielJahr})
        </button>
      </div>` : '';

    overlay.innerHTML = `
      <div role="dialog" aria-modal="true" aria-labelledby="_zbTitle"
        style="background:var(--bg-card-solid);border:1px solid var(--border);border-radius:12px;padding:24px;max-width:420px;width:100%;color:var(--text-main);font-family:inherit;">
        <div id="_zbTitle" style="font-size:15px;font-weight:700;margin-bottom:2px;">Zuzahlungsbefreiung</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px;">${esc(patientName)}</div>
        ${wechselBannerHtml}
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

    const uebernehmenBtn = overlay.querySelector('#_zbUebernehmen');
    if (uebernehmenBtn && wechselHinweis) {
      uebernehmenBtn.onclick = () => {
        overlay.querySelector('#_zbAb').value = wechselHinweis.vorschlagAb;
        overlay.querySelector('#_zbBis').value = wechselHinweis.vorschlagBis;
        overlay.querySelector('#_zbArt').value = wechselHinweis.nachweisArt;
        // Wenn aus Dezember heraus für das Folgejahr vorbefüllt wird, nicht versehentlich
        // die aktive Zeile des laufenden Jahres löschen lassen.
        const del = overlay.querySelector('#_zbDel');
        if (del && wechselHinweis.istJahresende) del.style.display = 'none';
        uebernehmenBtn.textContent = `Für ${wechselHinweis.zielJahr} vorbefüllt — jetzt Nachweis prüfen & speichern`;
        uebernehmenBtn.disabled = true;
        overlay.querySelector('#_zbFile')?.focus();
      };
    }

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
 * Checkbox „Zuzahlungsbefreit" im Muster-13-Mask (#rezeptModal) verdrahten —
 * Ankreuzen öffnet sofort dieses Formular, dieselbe Schreibstelle wie
 * Patientenakte/Termin-Panel. Einmalig aus `wireM13Toggles()` (dashboard.js)
 * gerufen. Programmatisches `.checked`-Setzen (Vorbefüllen einer bestehenden
 * Verordnung, Reset beim Öffnen der Maske) löst kein `change` aus — das
 * Formular kommt nur bei echtem Nutzerklick.
 *
 * @param {object} cfg
 * @param {string} cfg.checkboxId
 * @param {string} cfg.patientIdId  Feld mit der `leads.id` (z.B. rzPatientId)
 * @param {string} cfg.vornameId
 * @param {string} cfg.nachnameId
 * @param {object} cfg.supabase
 * @param {Function} cfg.ownerId   () => string
 * @param {Function} cfg.toast
 * @param {Function} [cfg.confirm]
 */
export function verdrahteZuzahlungsbefreitCheckbox({ checkboxId, patientIdId, vornameId, nachnameId, supabase, ownerId, toast, confirm }) {
  const box = document.getElementById(checkboxId);
  if (!box) return;
  box.addEventListener('change', async () => {
    if (!box.checked) return;
    const leadId = document.getElementById(patientIdId)?.value;
    if (!leadId) {
      toast('Bitte zuerst Patient auswählen', 'error');
      box.checked = false;
      return;
    }
    const vorname = document.getElementById(vornameId)?.value || '';
    const nachname = document.getElementById(nachnameId)?.value || '';
    await oeffneBefreiungsFormular({
      supabase,
      patientId: leadId,
      ownerId: ownerId(),
      patientName: `${vorname} ${nachname}`.trim(),
      toast,
      confirm,
    });
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
    .is('belegnummer', null)   // festgeschriebene Zeilen (Belegnummer vergeben) nie anfassen — sonst scheitert das ganze Bulk-UPDATE
    .gt('zuzahlung_eur', 0);
  if (error) console.warn('[befreiung] Betrag konnte nicht genullt werden:', error.message);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
