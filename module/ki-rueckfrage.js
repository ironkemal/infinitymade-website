import { validateKiChallenge } from './ki-client.js?v=20261008m4b';
import { zeigeBestaetigungsDialog } from './bestaetigungs-dialog.js?v=20261007m3';

export async function zeigeKiRueckfrageDialog(challenge, deps = {}) {
  const doc = deps.document || globalThis.document;
  if (!doc || !validateKiChallenge(challenge)) return null;
  const modal = doc.getElementById('confirmModal');
  if (!modal) return null;
  const closeModal = deps.closeModal || (() => { modal.hidden = true; });
  const openModal = deps.openModal || (() => { modal.hidden = false; });

  const introP = doc.createElement('p');
  introP.style.cssText = 'margin:0 0 12px 0;font-size:14px;color:var(--text-main);line-height:1.5;';
  introP.textContent = 'Im Text wurden mögliche Namen oder personenbezogene Angaben erkannt. Bitte legen Sie fest, wie vor der Verarbeitung damit verfahren werden soll:';

  const candidatesList = doc.createElement('div');
  candidatesList.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-bottom:14px;max-height:240px;overflow-y:auto;';

  const candidates = Array.isArray(challenge?.candidates) ? challenge.candidates : [];
  const selectElements = [];

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const candRow = doc.createElement('div');
    candRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 10px;background:var(--bg-card-solid);border:1px solid var(--border);border-radius:8px;';

    const labelWrap = doc.createElement('div');
    labelWrap.style.cssText = 'flex:1;min-width:0;';

    const textSpan = doc.createElement('span');
    textSpan.style.cssText = 'display:block;font-weight:600;font-size:14px;color:var(--text-main);word-break:break-word;';
    textSpan.textContent = String(c.text || c.ausschnitt || `Kandidat ${i + 1}`);

    const typeSpan = doc.createElement('span');
    typeSpan.style.cssText = 'display:block;font-size:12px;color:var(--text-muted);';
    typeSpan.textContent = `Typ: ${String(c.type || c.art || 'PERSON')}`;

    labelWrap.appendChild(textSpan);
    labelWrap.appendChild(typeSpan);
    candRow.appendChild(labelWrap);

    const select = doc.createElement('select');
    select.className = 'form-select';
    select.style.cssText = 'font-size:13px;padding:6px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-input);color:var(--text-main);flex:0 0 auto;';
    select.setAttribute('data-candidate-id', c.id || `c_${i + 1}`);

    const optMask = doc.createElement('option');
    optMask.value = 'maskieren';
    optMask.textContent = 'Maskieren (empfohlen)';

    const optKeep = doc.createElement('option');
    optKeep.value = 'kein_name';
    optKeep.textContent = 'Kein Name';

    select.appendChild(optMask);
    select.appendChild(optKeep);
    select.value = 'maskieren';

    candRow.appendChild(select);
    candidatesList.appendChild(candRow);
    selectElements.push({ candidate: c, select });
  }

  const hintP = doc.createElement('p');
  hintP.style.cssText = 'margin:0;font-size:12px;color:var(--text-muted);line-height:1.4;';
  hintP.textContent = 'Hinweis: Bei Abbruch werden keine Daten an den KI-Dienst übertragen. Im Jeton-Modus ist Freitext technisch gesperrt.';

  const activeElement = doc.activeElement;

  const zeigeFn = deps.zeigeBestaetigungsDialog || zeigeBestaetigungsDialog;
  const promise = zeigeFn({
    title: 'Mögliche persönliche Angaben erkannt',
    message: '',
    confirmText: 'Bestätigen und Fortfahren',
    cancelText: 'Abbrechen',
    variant: 'primary'
  }, { ...deps, document:doc, openModal, closeModal });

  const textEl = doc.getElementById('confirmModalText');
  if (textEl) {
    textEl.textContent = '';
    textEl.appendChild(introP);
    textEl.appendChild(candidatesList);
    textEl.appendChild(hintP);
  }

  if (selectElements.length > 0) {
    selectElements[0].select.focus();
  }

  const timer = setInterval(() => {
    if (Date.now() >= challenge.expiresAt || deps.isSourceEdited?.() === true) closeModal('confirmModal');
  }, 50);
  let confirmed = false;
  try {
    confirmed = await promise;
  } finally {
    clearInterval(timer);
    if (modal.hidden && activeElement && typeof activeElement.focus === 'function') {
      activeElement.focus();
    }
  }

  if (!confirmed || Date.now() >= challenge.expiresAt || deps.isSourceEdited?.() === true) {
    return null; // Explizit abgebrochen
  }

  const choices = selectElements.map(({ candidate, select }, idx) => ({
    id: candidate.id || `c_${idx + 1}`,
    action: select.value === 'kein_name' ? 'kein_name' : 'maskieren'
  }));

  return {
    challengeId: challenge.challengeId,
    choices
  };
}
