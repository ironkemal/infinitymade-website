import { getKiConfig, updateOwnerOptIn, setzeKiAufgaben, testeKiVerbindung, verbindungstestText, CURRENT_EINWILLIGUNG_VERSION, refreshKiControls } from './ki-client.js?v=20261124by1';
import { mountKiNutzung } from './ki-nutzung.js?v=20261127kn1';

/** @param {unknown} t */
const escapeText = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));

export async function mountKiEinstellungen(container, deps = {}) {
  if (!container) return;

  const isOwner = typeof deps.isOwner === 'function' ? deps.isOwner() : (deps.getRole?.() === 'owner');
  const showToast = deps.showToast || ((msg) => console.log(msg));

  container.innerHTML = `
    <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">Wird geladen…</div>
  `;

  async function render() {
    let cfg;
    try {
      cfg = await getKiConfig({
        apiBase: deps.apiBase,
        getToken: deps.getSessionToken,
        isOwner: () => isOwner,
        fetchImpl: deps.fetchImpl
      });
    } catch {
      cfg = {
        effective: false,
        mode: 'aus',
        operatorReady: false,
        ownerActive: false,
        mailReady: false,
        disabledReason: 'KI_UNAVAILABLE',
        disabledReasonText: 'KI-Dienst derzeit nicht erreichbar.'
      };
    }

    const isEffective = cfg.effective === true;
    const isOperatorReady = cfg.operatorReady === true;
    const isMailReady = cfg.capabilities?.mailDraft === true;
    const isOwnerActive = cfg.ownerActive === true;

    const modeLabels = {
      aus: 'Deaktiviert (aus)',
      direkt: 'Direkt',
      jeton: 'Praxura-KI (Kurzzeit-Zugang)'
    };
    // Safe enum constant mapped from mode string
    const modeLabel = modeLabels[cfg.mode] || 'aus';

    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <p class="form-hint" style="margin:0 0 4px 0;line-height:1.5;">
          Optionale KI-Unterstützung. Standardmäßig deaktiviert. Die Nutzung ist freiwillig; der Praxisinhaber schaltet sie
          für die Praxis frei.
        </p>

        <!-- Status-Übersicht -->
        <div style="background:var(--bg-card-solid);border:1px solid var(--border);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <span style="font-size:13px;font-weight:600;color:var(--text-main);">Gesamtstatus:</span>
            <span style="font-size:12px;font-weight:700;padding:4px 8px;border-radius:6px;${isEffective ? 'background:var(--bg-card-solid);color:var(--success);' : 'background:var(--bg-card-solid);color:var(--danger);'}">
              ${isEffective ? '● Aktiviert' : '○ Deaktiviert'}
            </span>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;color:var(--text-muted);border-top:1px solid var(--border);padding-top:8px;">
            <span>Betriebsmodus:</span>
            <strong style="color:var(--text-main);font-size:12px;">${modeLabel}</strong>
          </div>

          ${cfg.anbieter ? `
          <div id="kiAnbieterZeile" style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;color:var(--text-muted);border-top:1px solid var(--border);padding-top:8px;">
            <span>Anbieter &amp; Region:</span>
            <strong style="color:var(--text-main);font-size:12px;">${escapeText(cfg.anbieter.name)}${cfg.anbieter.region ? ` · ${escapeText(cfg.anbieter.region)}${cfg.anbieter.euRegion ? ' (EU)' : ' (nicht EU)'}` : ''}</strong>
          </div>` : ''}
          ${isOwner && cfg.mode === 'direkt' ? `
          <div id="kiVerbindungstest" style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;color:var(--text-muted);border-top:1px solid var(--border);padding-top:8px;">
            <span id="kiVerbindungstestErgebnis" role="status">${cfg.anbieter?.eigener ? 'Eigener Zugang, eingerichtet vom Administrator.' : 'Direkt eingerichteter Zugang.'}</span>
            <button type="button" class="btn btn-secondary" id="kiVerbindungstestBtn" style="min-height:40px;">Verbindung testen</button>
          </div>` : ''}

          <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;color:var(--text-muted);border-top:1px solid var(--border);padding-top:8px;">
            <span>Betreiber-Bereitschaft (Technik):</span>
            <span style="font-size:12px;color:${isOperatorReady ? 'var(--success)' : 'var(--warning)'};">
              ${isOperatorReady ? '✓ Technisch bereit' : '⚠ Technische Freigabe ausstehend'}
            </span>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;color:var(--text-muted);border-top:1px solid var(--border);padding-top:8px;">
            <span>E-Mail-Assistent (B2C / B2B):</span>
            <span style="font-size:12px;color:${isMailReady ? 'var(--success)' : 'var(--text-muted)'};">
              ${isMailReady ? '✓ Freigegeben' : '○ Noch nicht freigegeben'}
            </span>
          </div>
        </div>

        ${!isEffective ? `
        <!-- Box-Test 22.11.2026: Grund und „was ohne KI weiter geht“ sichtbar machen (vorher nur ○ Deaktiviert). -->
        <div id="kiAusHinweis" style="padding:10px 12px;background:var(--bg-card-solid);border:1px solid var(--border);border-radius:8px;font-size:12.5px;color:var(--text-main);line-height:1.5;">
          <strong>${escapeText(cfg.disabledReasonText || 'KI-Unterstützung ist ausgeschaltet.')}</strong><br>
          Ohne KI arbeiten weiter: Serientermine (Vorschlag nach festen Regeln), Rezept-Barcode-Scan (lokal im Browser),
          Verordnungsprüfung (regelbasiert) und alle übrigen Praxisfunktionen. Nur Mail-Assistent und Sprachdiktat brauchen die KI.
          ${cfg.mode === 'aus' ? 'Auf diesem Server ist die KI vom Betreiber ausgeschaltet — Ihre Freischaltung allein schaltet sie nicht ein.' : ''}
        </div>` : ''}

        <!-- Inhaber-Schalter -->
        <div style="background:var(--bg-card-solid);border:1px solid var(--border);border-radius:10px;padding:14px;">
          <div style="font-size:14px;font-weight:600;color:var(--text-main);margin-bottom:8px;">
            Freischaltung durch den Praxisinhaber
          </div>

          <label style="display:flex;align-items:flex-start;gap:10px;cursor:${isOwner ? 'pointer' : 'not-allowed'};margin-bottom:8px;">
            <input type="checkbox" id="kiOwnerOptInToggle" ${isOwnerActive ? 'checked' : ''} ${isOwner ? '' : 'disabled'}
              style="width:20px;height:20px;margin-top:2px;accent-color:var(--primary);flex:0 0 auto;">
            <div style="flex:1;">
              <span style="font-size:14px;font-weight:600;color:var(--text-main);">
                Optionale KI-Unterstützung für diese Praxis erlauben
              </span>
              <p style="margin:4px 0 0 0;font-size:12px;color:var(--text-muted);line-height:1.4;">
                Textversion: ${CURRENT_EINWILLIGUNG_VERSION}
                ${cfg.decidedAt ? ` &middot; Entschieden am: ${new Date(cfg.decidedAt).toLocaleString('de-DE')}` : ''}
              </p>
            </div>
          </label>

          ${!isOwner ? `
            <div style="margin-top:8px;padding:8px 10px;background:var(--bg-card-solid);border:1px solid var(--border);border-radius:6px;font-size:12px;color:var(--warning);">
              Hinweis: Nur der Praxisinhaber darf die KI freischalten oder die Freischaltung zurücknehmen.
            </div>
          ` : ''}
        </div>

        ${Array.isArray(cfg.aufgaben) && cfg.aufgaben.length ? `
        <!-- Phase 7b: Aufgaben einzeln an/aus — direkt unter der Freischaltung, damit nach erneuter Freischaltung sichtbar ist, was offen ist (onprem). -->
        <div id="kiAufgaben" style="background:var(--bg-card-solid);border:1px solid var(--border);border-radius:10px;padding:14px;">
          <div style="font-size:14px;font-weight:600;color:var(--text-main);margin-bottom:4px;">Welche Aufgaben die KI übernehmen darf</div>
          <p class="form-hint" style="margin:0 0 10px;">Ausgeschaltete Aufgaben laufen ohne KI weiter, soweit es dafür einen Weg ohne KI gibt (z. B. Serientermine nach festen Regeln).</p>
          ${cfg.aufgaben.map((a) => `
          <label style="display:flex;align-items:center;gap:10px;min-height:44px;cursor:${isOwner ? 'pointer' : 'not-allowed'};">
            <input type="checkbox" data-ki-aufgabe="${escapeText(a.id)}" ${a.gesperrt ? '' : 'checked'} ${isOwner ? '' : 'disabled'} style="width:20px;height:20px;accent-color:var(--primary);flex:0 0 auto;">
            <span style="font-size:14px;color:var(--text-main);">${escapeText(a.label)}</span>
          </label>`).join('')}
        </div>` : ''}

        <!-- Datenschutzhinweis -->
        <div style="padding:10px 12px;background:var(--bg-card-solid);border:1px solid var(--border);border-radius:8px;font-size:12px;color:var(--text-muted);line-height:1.5;">
          <strong style="color:var(--text-main);">Datenschutz &amp; Vertraulichkeit:</strong>
          Die Datenübermittlung erfolgt pseudonymisiert direkt an den jeweiligen Schnittstellen-Anbieter.
          Es existiert <strong>keine Garantie vollständiger Anonymität</strong> und <strong>kein zentrales Relay</strong>.
          KI-Vorschläge sind Entwürfe — bitte vor Verwendung prüfen. Manuelle Praxisfunktionen bleiben unabhängig nutzbar. Ihre Freischaltung ersetzt keine technische Freigabe. Die regelbasierte Rezeptprüfung nutzt keine KI. Bildübertragung zur KI ist gesperrt.
        </div>
        ${isOwner ? '<div id="kiNutzungMount"></div>' : ''}
      </div>
    `;

    // Verbindungstest (Konsey 24.11.2026, Option D): nur Inhaber, Ergebnis als Klartext, nie Anbietertext.
    const testBtn = container.querySelector('#kiVerbindungstestBtn');
    if (testBtn && isOwner) testBtn.addEventListener('click', async () => {
      const ziel = container.querySelector('#kiVerbindungstestErgebnis');
      testBtn.setAttribute('disabled', '');
      if (ziel) ziel.textContent = 'Wird geprüft …';
      const r = await testeKiVerbindung({ apiBase: deps.apiBase, getToken: deps.getSessionToken, fetchImpl: deps.fetchImpl });
      if (ziel) ziel.textContent = r.ok ? '✓ Verbindung in Ordnung.' : `✗ ${verbindungstestText(r.code)}`;
      testBtn.removeAttribute('disabled');
    });

    // Aufgaben-Schalter: Häkchen = KI darf; gespeichert wird die Liste der ausgeschalteten Gruppen.
    const aufgabenBoxen = typeof container.querySelectorAll === 'function' ? [...container.querySelectorAll('[data-ki-aufgabe]')] : [];
    if (isOwner) for (const box of aufgabenBoxen) {
      box.addEventListener('change', async () => {
        const gesperrt = aufgabenBoxen.filter((b) => !b.checked).map((b) => b.dataset.kiAufgabe);
        aufgabenBoxen.forEach((b) => { b.disabled = true; });
        try {
          await setzeKiAufgaben(gesperrt, { apiBase: deps.apiBase, getToken: deps.getSessionToken, fetchImpl: deps.fetchImpl, isOwner: () => isOwner });
          showToast(box.checked ? 'KI-Aufgabe eingeschaltet.' : 'KI-Aufgabe ausgeschaltet.', 'success');
        } catch (e) {
          showToast(/** @type {any} */ (e)?.message || 'KI-Aufgaben konnten nicht gespeichert werden.', 'error');
        }
        await render();
      });
    }

    const toggle = container.querySelector('#kiOwnerOptInToggle');
    if (toggle && isOwner) {
      toggle.addEventListener('change', async () => {
        const nextState = toggle.checked;
        toggle.disabled = true;
        try {
          await updateOwnerOptIn({
            enabled: nextState,
            informationVersion: CURRENT_EINWILLIGUNG_VERSION
          }, {
            apiBase: deps.apiBase,
            getToken: deps.getSessionToken,
            isOwner: () => isOwner,
            fetchImpl: deps.fetchImpl
          });
          showToast(nextState ? 'KI-Unterstützung freigeschaltet.' : 'Freischaltung zurückgenommen.', 'success');
        } catch (err) {
          toggle.checked = !nextState; // Rollback
          showToast('KI-Einstellung konnte nicht gespeichert werden.', 'error');
        } finally {
          toggle.disabled = false;
          await render();
          await refreshKiControls({apiBase:deps.apiBase,getToken:deps.getSessionToken,isOwner:()=>isOwner,fetchImpl:deps.fetchImpl});
        }
      });
    }

    const nutzungMount = container.querySelector('#kiNutzungMount');
    if (isOwner && nutzungMount) {
      await mountKiNutzung(nutzungMount, {
        apiBase: deps.apiBase,
        getToken: deps.getSessionToken,
        fetchImpl: deps.fetchImpl
      });
    }
  }

  await render();
}
