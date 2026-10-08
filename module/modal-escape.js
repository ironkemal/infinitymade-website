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
