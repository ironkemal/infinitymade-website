/**
 * Shared dashboard Escape behavior; cleanup remains in each modal's close path.
 *
 * @param {object} options
 * @param {Document|HTMLElement} [options.root]
 * @param {(modalId: string) => void} options.closeModal
 * @param {() => boolean} [options.istSeitenpanelOffen]
 * @returns {() => void}
 */
export function installiereModalEscape({ root = document, closeModal, istSeitenpanelOffen = () => false }) {
  /** @param {KeyboardEvent} event */
  const onKeydown = (event) => {
    if (event.key !== 'Escape') return;
    // Dialogs sit above the appointment panel. Close only the last visible one.
    const open = /** @type {HTMLElement[]} */ (Array.from(root.querySelectorAll('.modal-overlay'))).filter(modal => !modal.hidden);
    if (open.length) {
      closeModal(open[open.length - 1].id);
      return;
    }
    if (istSeitenpanelOffen()) closeModal('bkActionModal');
  };
  root.addEventListener('keydown', /** @type {EventListener} */ (onKeydown));
  return () => root.removeEventListener('keydown', /** @type {EventListener} */ (onKeydown));
}
