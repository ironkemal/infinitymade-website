/**
 * Reusable pending guard & button state manager for asynchronous operations.
 * Closure is created once per guard instance.
 *
 * @param {Function|Object} getButton - Element getter or button element to disable during execution
 * @param {Function} [onError] - Optional error handler (called on failure without unhandled rethrow)
 * @returns {Function} Guard function accepting an async operation and arguments
 */
export function createPendingGuard(getButton, onError) {
  let pending = false;

  return async function (operation, ...args) {
    if (pending) return;
    pending = true;

    let btn;
    let prevDisabled = false;
    try {
      btn = typeof getButton === 'function' ? getButton() : getButton;
      prevDisabled = btn ? Boolean(btn.disabled) : false;
      if (btn) btn.disabled = true;
      return await operation.apply(this, args);
    } catch (err) {
      if (typeof onError === 'function') {
        return onError.call(this, err);
      }
      throw err;
    } finally {
      pending = false;
      if (btn) btn.disabled = prevDisabled;
    }
  };
}
