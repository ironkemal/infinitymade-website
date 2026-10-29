/** Shared dashboard Escape behavior; cleanup remains in each modal's close path. */
export function installiereModalEscape({ root = document, closeModal, istSeitenpanelOffen = () => false }) {
  const onKeydown = (event) => {
    if (event.key !== 'Escape') return;
    // Dialogs sit above the appointment panel. Close only the last visible one.
    const open = Array.from(root.querySelectorAll('.modal-overlay')).filter(modal => !modal.hidden);
    if (open.length) {
      closeModal(open[open.length - 1].id);
      return;
    }
    if (istSeitenpanelOffen()) closeModal('bkActionModal');
  };
  root.addEventListener('keydown', onKeydown);
  return () => root.removeEventListener('keydown', onKeydown);
}

/** Optional focus lifecycle for an existing modal; closing stays with its original handlers. */
export function installiereModalFokus({ root = document, id, startId, rueckfallId, Observer = globalThis.MutationObserver }) {
  const modal = root.getElementById(id);
  if (!modal || !Observer) return () => {};
  let offen = false, ausloeser = null;
  const sichtbar = el => !!el?.isConnected && !el.closest('[hidden], [inert]') && el.getClientRects().length > 0;
  const ziele = () => [...modal.querySelectorAll('button, input:not([type="hidden"]), select, textarea, a[href], [tabindex]')]
    .filter(el => !el.matches(':disabled') && el.tabIndex >= 0 && sichtbar(el));
  const taste = event => {
    if (event.key !== 'Tab' || modal.hidden) return;
    const oben = [...root.querySelectorAll('.modal-overlay')].filter(el => !el.hidden).at(-1);
    if (oben !== modal) return;
    const liste = ziele(), index = liste.indexOf(root.activeElement);
    if (!liste.length) { event.preventDefault(); return; }
    if (index < 0 || (event.shiftKey ? index === 0 : index === liste.length - 1)) {
      event.preventDefault();
      liste[event.shiftKey ? liste.length - 1 : 0].focus({ preventScroll: true });
    }
  };
  const wechsel = () => {
    if (!modal.hidden && !offen) {
      offen = true;
      ausloeser = modal.contains(root.activeElement) ? null : root.activeElement;
      const dialog = modal.querySelector('.modal');
      dialog?.setAttribute('role', 'dialog');
      dialog?.setAttribute('aria-modal', 'true');
      if (root.getElementById(id + 'Title')) dialog?.setAttribute('aria-labelledby', id + 'Title');
      const start = root.getElementById(startId);
      (sichtbar(start) && !start.matches(':disabled') ? start : ziele()[0])?.focus({ preventScroll: true });
    } else if (modal.hidden && offen) {
      offen = false;
      if (modal.contains(root.activeElement) || root.activeElement === root.body) {
        const ziel = sichtbar(ausloeser) ? ausloeser : root.getElementById(rueckfallId);
        if (sichtbar(ziel) && !ziel.matches(':disabled')) ziel.focus({ preventScroll: true });
      }
      ausloeser = null;
    }
  };
  const observer = new Observer(wechsel);
  observer.observe(modal, { attributes: true, attributeFilter: ['hidden'] });
  modal.addEventListener('keydown', taste);
  wechsel();
  return () => { observer.disconnect(); modal.removeEventListener('keydown', taste); };
}
