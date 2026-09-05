/**
 * ausfall-einstellungen.js — die Owner-Einstellung „Ausfallgebühr" in den
 * Einstellungen.
 *
 * Warum es diese Datei gibt
 * ─────────────────────────
 * Der Code stand unverändert in `dashboard.js`. Beim Bau der
 * Selbstzahler-Preisstufen (Ops #266, 06.09.2026) kam direkt daneben ein
 * zweiter, gleich gebauter Einstellungsblock dazu — und `dashboard.js` darf
 * nicht wachsen (Konsey 2026-08-13, Kapı `tools/check-dashboard-size.sh`).
 * Also ist der Nachbar mit umgezogen, nach der Umzingelungsregel: was man
 * anfasst, wandert in ein Modul.
 *
 * **Verhalten unverändert.** Der Umzug hat nur die vier stillen Abhängigkeiten
 * sichtbar gemacht — `supabase`, das Profil, der Konfigurations-Cache und
 * `showToast` kommen jetzt als `deps` herein statt aus dem Modulrumpf von
 * `dashboard.js`. Gerechnet, geprüft und gespeichert wird Zeile für Zeile
 * dasselbe.
 *
 * `deps.config` wird absichtlich **mutiert** statt ersetzt: `dashboard.js` hält
 * dieselbe Objektreferenz für die No-Show-Prüfung, und die soll nach dem
 * Speichern sofort greifen, ohne dass die Seite neu lädt.
 *
 * @param {object}   deps
 * @param {object}   deps.supabase
 * @param {object}   deps.profile    currentProfile — wird bei Erfolg nachgezogen
 * @param {object}   deps.config     ausfallConfig — wird bei Erfolg mutiert
 * @param {Function} deps.userId     () => id des angemeldeten Owners
 * @param {Function} deps.showToast
 */
// ===== Settings > Ausfallgebühr (No-Show-Gebühr, Owner-Einstellung) =====
// Gespeichert in profiles.ausfall_* (Owner-Level, nicht pro Standort), damit
// auch Einzelpraxen ohne businesses-Zeile die Gebühr konfigurieren können.
export function renderAusfallSettings(deps) {
  const section = document.getElementById('settingsAusfallSection');
  if (!section) return;

  const show = deps.profile?.role === 'owner';
  section.hidden = !show;
  if (!show) return;

  // Werte aus der Owner-Config lesen
  const src = deps.config || {};

  const enabled = document.getElementById('setAusfallEnabled');
  const fields  = document.getElementById('setAusfallFields');
  const mode    = document.getElementById('setAusfallMode');
  const amount  = document.getElementById('setAusfallAmount');
  const label   = document.getElementById('setAusfallAmountLabel');
  const cutoff  = document.getElementById('setAusfallCutoff');
  const hinweis = document.getElementById('setAusfallHinweis');
  if (!enabled || !fields) return;

  enabled.checked = !!src.ausfall_enabled;
  mode.value = src.ausfall_mode || 'fixed';
  amount.value = (src.ausfall_mode === 'percent'
    ? (src.ausfall_percent ?? '')
    : (src.ausfall_amount_eur ?? ''));
  cutoff.value = src.ausfall_cutoff_hours ?? 24;
  hinweis.value = src.ausfall_hinweis || '';

  const sync = () => {
    fields.hidden = !enabled.checked;
    label.textContent = mode.value === 'percent' ? 'Prozent (%)' : 'Betrag (€)';
  };
  sync();

  if (!section.dataset.wired) {
    section.dataset.wired = '1';
    enabled.addEventListener('change', sync);
    mode.addEventListener('change', sync);
    document.getElementById('setAusfallSaveBtn')?.addEventListener('click', () => saveAusfallSettings(deps));
  }
}

async function saveAusfallSettings(deps) {
  const btn = document.getElementById('setAusfallSaveBtn');
  const enabled = document.getElementById('setAusfallEnabled').checked;
  const mode = document.getElementById('setAusfallMode').value === 'percent' ? 'percent' : 'fixed';
  const val = parseFloat((document.getElementById('setAusfallAmount').value || '').replace(',', '.'));
  const cutoff = parseInt(document.getElementById('setAusfallCutoff').value, 10) || 24;
  const hinweis = (document.getElementById('setAusfallHinweis').value || '').trim() || null;

  if (enabled && !(val > 0)) {
    deps.showToast('Bitte einen Betrag bzw. Prozentsatz angeben.', 'error');
    return;
  }

  const patch = {
    ausfall_enabled: enabled,
    ausfall_mode: mode,
    ausfall_amount_eur: (mode === 'fixed' && val > 0) ? val : null,
    ausfall_percent: (mode === 'percent' && val > 0) ? val : null,
    ausfall_cutoff_hours: cutoff,
    ausfall_hinweis: hinweis,
  };

  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  try {
    // Owner-Einstellung in profiles speichern
    const { error } = await deps.supabase
      .from('profiles')
      .update(patch)
      .eq('id', deps.userId());
    if (error) throw error;

    // Lokalen Cache aktualisieren, damit die No-Show-Prüfung sofort greift
    Object.assign(deps.config, patch);
    if (deps.profile) Object.assign(deps.profile, patch);

    deps.showToast('Ausfallgebühr gespeichert ✓');
  } catch (e) {
    console.error('[saveAusfallSettings]', e);
    deps.showToast('Fehler: ' + (e.message || 'Speichern fehlgeschlagen'), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Speichern'; }
  }
}
