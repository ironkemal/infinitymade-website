import { getKiConfig, updateOwnerOptIn, CURRENT_EINWILLIGUNG_VERSION, refreshKiControls } from './ki-client.js?v=20261008m4b';

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
      jeton: 'Jeton-Modus (Freitext gesperrt)'
    };
    // Safe enum constant mapped from mode string
    const modeLabel = modeLabels[cfg.mode] || 'aus';

    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <p class="form-hint" style="margin:0 0 4px 0;line-height:1.5;">
          Optionale KI-Unterstützung. Standardmäßig deaktiviert. Die Nutzung ist freiwillig und erfordert die ausdrückliche
          Einwilligung des Praxisinhabers.
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

        <!-- Inhaber-Schalter -->
        <div style="background:var(--bg-card-solid);border:1px solid var(--border);border-radius:10px;padding:14px;">
          <div style="font-size:14px;font-weight:600;color:var(--text-main);margin-bottom:8px;">
            Praxisinhaber-Einwilligung
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
              Hinweis: Nur der Praxisinhaber darf die KI-Einwilligung aktivieren oder widerrufen.
            </div>
          ` : ''}
        </div>

        <!-- Datenschutzhinweis -->
        <div style="padding:10px 12px;background:var(--bg-card-solid);border:1px solid var(--border);border-radius:8px;font-size:12px;color:var(--text-muted);line-height:1.5;">
          <strong style="color:var(--text-main);">Datenschutz &amp; Vertraulichkeit:</strong>
          Die Datenübermittlung erfolgt pseudonymisiert direkt an den jeweiligen Schnittstellen-Anbieter.
          Es existiert <strong>keine Garantie vollständiger Anonymität</strong> und <strong>kein zentrales Relay</strong>.
          Manuelle Praxisfunktionen bleiben unabhängig nutzbar. Ihre Erlaubnis ersetzt keine technische Freigabe. Die regelbasierte Rezeptprüfung nutzt keine KI. Bildübertragung zur KI ist gesperrt.
        </div>
      </div>
    `;

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
          showToast(nextState ? 'KI-Einwilligung aktiviert.' : 'KI-Einwilligung deaktiviert.', 'success');
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
  }

  await render();
}
