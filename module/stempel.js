/**
 * stempel.js — digitaler Praxisstempel (KHS M2.4, PE-006, guvenlik S-47, legal-de F4).
 *
 * - PRIVATER Bucket `praxis-stempel`, Pfad `<owner_id>/stempel.png` (fester Name, upsert).
 * - `profiles.praxis_stempel_path` hält den PFAD, nie eine URL.
 * - Upload nur PNG/JPEG (kein SVG!), im Browser über Canvas NEU kodiert (≤ 1200 px, PNG),
 *   danach höchstens 512 KB (der Bucket erzwingt es nochmal).
 * - Belege betten den Stempel beim Bauen als Data-URL ein (`ladeStempelDataUrl`, Typ fest
 *   gesetzt, nie aus der Datei) — er steht nie als URL im Dokument.
 * - Schreiben darf nur der Owner (Bucket-Policy); Employees lesen.
 *
 * Reine Helfer sind getestet; Canvas-Kodierung (`kodiereAlsPng`) ist die einzige DOM-Stelle
 * und wird in den Tests ersetzt.
 */
import { STEMPEL_PFAD_RE } from './branding.js?v=20261006g';

export const STEMPEL_BUCKET = 'praxis-stempel';
export const STEMPEL_MAX_BYTES = 512 * 1024;
export const STEMPEL_MAX_KANTE = 1200;
const EINGANG_MAX_BYTES = 10 * 1024 * 1024;

const UUID = /^[0-9a-f-]{36}$/;

export function stempelPfad(ownerId) {
  if (!UUID.test(String(ownerId || ''))) throw new Error('Praxis-Kennung ungültig');
  return `${ownerId}/stempel.png`;
}

export function pruefeStempelDatei(datei) {
  if (!datei || !['image/png', 'image/jpeg'].includes(datei.type)) {
    return { ok: false, meldung: 'Bitte eine Bilddatei im Format PNG oder JPEG wählen.' };
  }
  if (!(datei.size > 0)) return { ok: false, meldung: 'Die Datei ist leer.' };
  if (datei.size > EINGANG_MAX_BYTES) return { ok: false, meldung: 'Die Datei ist zu groß (höchstens 10 MB).' };
  return { ok: true };
}

/** Nur verkleinern; Seitenverhältnis bleibt; nie 0. */
export function zielGroesse(w, h, max = STEMPEL_MAX_KANTE) {
  const faktor = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * faktor)), h: Math.max(1, Math.round(h * faktor)) };
}

/** Browser: Datei -> neu kodiertes PNG (Metadaten und Skripte gehen verloren). */
export async function kodiereAlsPng(datei) {
  const bmp = await createImageBitmap(datei);
  const { w, h } = zielGroesse(bmp.width, bmp.height);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Kodierung fehlgeschlagen'))), 'image/png'));
}

export async function stempelHochladen(sb, { ownerId, file }, { kodiere = kodiereAlsPng } = {}) {
  const pruef = pruefeStempelDatei(file);
  if (!pruef.ok) return pruef;
  let pfad;
  try { pfad = stempelPfad(ownerId); } catch (e) { return { ok: false, meldung: e.message }; }
  let blob;
  try { blob = await kodiere(file); } catch { return { ok: false, meldung: 'Das Bild konnte nicht gelesen werden.' }; }
  if (blob.size > STEMPEL_MAX_BYTES) return { ok: false, meldung: 'Der Stempel ist zu groß (höchstens 512 KB nach dem Verkleinern). Bitte ein einfacheres Bild wählen.' };
  const { error } = await sb.storage.from(STEMPEL_BUCKET).upload(pfad, blob, { upsert: true, contentType: 'image/png' });
  if (error) return { ok: false, meldung: 'Der Stempel konnte nicht gespeichert werden (nur die Inhaberin bzw. der Inhaber darf ihn ändern).' };
  const { data, error: pErr } = await sb.from('profiles').update({ praxis_stempel_path: pfad }).eq('id', ownerId).select('id');
  if (pErr || !(data || []).length) return { ok: false, meldung: 'Der Stempel liegt im Speicher, konnte aber nicht im Profil vermerkt werden.' };
  return { ok: true, pfad };
}

export async function stempelEntfernen(sb, { ownerId }) {
  let pfad;
  try { pfad = stempelPfad(ownerId); } catch (e) { return { ok: false, meldung: e.message }; }
  const { error } = await sb.storage.from(STEMPEL_BUCKET).remove([pfad]);
  if (error) return { ok: false, meldung: 'Der Stempel konnte nicht entfernt werden.' };
  const { data, error: pErr } = await sb.from('profiles').update({ praxis_stempel_path: null }).eq('id', ownerId).select('id');
  if (pErr || !(data || []).length) return { ok: false, meldung: 'Der Stempel wurde gelöscht, der Profil-Eintrag aber nicht.' };
  return { ok: true };
}

function alsBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return (typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64'));
}

/** Pfad -> `data:image/(png|jpeg);base64,…` oder ''. Der Typ kommt aus dem PFAD, nie aus der Datei. */
export async function ladeStempelDataUrl(sb, pfad) {
  if (!STEMPEL_PFAD_RE.test(String(pfad || ''))) return '';
  try {
    const { data, error } = await sb.storage.from(STEMPEL_BUCKET).download(pfad);
    if (error || !data) return '';
    const typ = pfad.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
    return `data:${typ};base64,${alsBase64(new Uint8Array(await data.arrayBuffer()))}`;
  } catch { return ''; }
}
