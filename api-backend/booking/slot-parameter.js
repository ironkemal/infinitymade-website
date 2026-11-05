import { isStrictInteger } from './series.js';

/** Minutenwerte für die Tages-Slots: strikt, endlich und höchstens ein Tag. */
export function slotParameter({ duration, buffer = 0, step = 15 } = {}) {
  const werte = [duration, buffer, step];
  if (werte.some(wert => !isStrictInteger(wert))) return { ok: false };
  const [dauer, puffer, schritt] = werte.map(Number);
  if (dauer < 1 || dauer > 1440 || puffer < 0 || puffer > 1440 || schritt < 1 || schritt > 1440) {
    return { ok: false };
  }
  return { ok: true, duration: dauer, buffer: puffer, step: schritt };
}
