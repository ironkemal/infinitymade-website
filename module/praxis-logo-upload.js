/**
 * Shared avatars upload for practice branding and mail footers. No profile writes.
 * @param {{ storage: { from: (bucket: string) => any } }} supabase
 * @param {string} userId
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
export async function ladePraxisLogoHoch(supabase, userId, blob) {
  if (!userId || !blob || blob.type !== 'image/png' || blob.size > 4*1024*1024) throw new Error('Ungültiges Logo (PNG, maximal 4 MB).');
  const path = `${userId}/praxis-logo-${globalThis.crypto.randomUUID()}.png`;
  const bucket = supabase.storage.from('avatars');
  const { error } = await bucket.upload(path, blob, { upsert: false, contentType: 'image/png' });
  if (error) throw new Error('Logo konnte nicht hochgeladen werden.');
  const url = bucket.getPublicUrl(path).data?.publicUrl;
  if (!url || !url.startsWith('https://')) throw new Error('Logo-Adresse fehlt.');
  return url;
}

/**
 * @param {Blob} file
 * @returns {Promise<Blob>}
 */
export async function logoDateiAlsPng(file) {
  if (!['image/png','image/jpeg','image/webp'].includes(file?.type) || file.size > 4*1024*1024) throw new Error('Bitte PNG, JPG oder WebP bis 4 MB wählen.');
  const bitmap=await createImageBitmap(file);
  try {
    if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>40000000)throw new Error('Bildabmessungen zu groß.');
    const scale=Math.min(1,800/bitmap.width,800/bitmap.height),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    canvas.getContext('2d')?.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)throw new Error('Bildverarbeitung fehlgeschlagen.');return blob;
  } finally {bitmap.close();}
}

/**
 * Profilfoto in den eigenen Ordner `avatars/<uid>/` (Phase 7b „Mein Profil“, 23.11.2026).
 * Fester Dateiname + upsert, damit kein Altbestand je Wechsel liegen bleibt; ?t= gegen Browser-Cache.
 * @param {{ storage: { from: (bucket: string) => any } }} supabase
 * @param {string} userId
 * @param {Blob} blob  JPEG aus bildAlsQuadratJpeg
 * @returns {Promise<string>}
 */
export async function ladeProfilfotoHoch(supabase, userId, blob) {
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId) || !blob || blob.type !== 'image/jpeg' || blob.size > 2*1024*1024) throw new Error('Ungültiges Foto (JPEG, maximal 2 MB).');
  const path = `${userId}/profilfoto.jpg`;
  const bucket = supabase.storage.from('avatars');
  const { error } = await bucket.upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
  if (error) throw new Error('Foto konnte nicht hochgeladen werden.');
  const url = bucket.getPublicUrl(path).data?.publicUrl;
  if (!url || !url.startsWith('https://')) throw new Error('Foto-Adresse fehlt.');
  return `${url}?t=${Date.now()}`;
}

/**
 * Quadratischer Mittelausschnitt als JPEG (Standard 400 × 400) — wie der Zuschnitt im Team-Detail.
 * @param {Blob} file @param {number} [kante]
 * @returns {Promise<Blob>}
 */
export async function bildAlsQuadratJpeg(file, kante = 400) {
  if (!['image/png','image/jpeg','image/webp'].includes(file?.type) || file.size > 8*1024*1024) throw new Error('Bitte PNG, JPG oder WebP bis 8 MB wählen.');
  const bitmap = await createImageBitmap(file);
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width*bitmap.height > 40000000) throw new Error('Bildabmessungen zu groß.');
    const seite = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas'); canvas.width = kante; canvas.height = kante;
    canvas.getContext('2d')?.drawImage(bitmap, (bitmap.width - seite) / 2, (bitmap.height - seite) / 2, seite, seite, 0, 0, kante, kante);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    if (!blob) throw new Error('Bildverarbeitung fehlgeschlagen.');
    return /** @type {Blob} */ (blob);
  } finally { bitmap.close(); }
}

/** @param {unknown} url @returns {string|null} */
export function avatarPfadAusUrl(url) {
  if (typeof url !== 'string') return null;
  try {
    const adresse = new URL(url);
    if (!['http:', 'https:'].includes(adresse.protocol)) return null;
    const treffer = adresse.pathname.match(/\/storage\/v1\/object\/public\/avatars\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\/(?:profilfoto|[0-9]+)\.jpg)$/i);
    return treffer?.[1] ?? null;
  } catch { return null; }
}

/** Entfernt das feste Profilfoto und ggf. das aktuell verknüpfte ältere Teamfoto.
 * @param {{storage: {from: (bucket: string) => any}}} supabase
 * @param {string} uid
 * @param {unknown} url
 */
export async function entferneProfilfoto(supabase, uid, url) {
  const bucket = supabase.storage.from('avatars');
  const fest = `${uid}/profilfoto.jpg`;
  const pfade = [fest];
  const alt = avatarPfadAusUrl(url);
  if (typeof url === 'string' && alt && alt !== fest && alt.startsWith(`${uid}/`)) {
    const erwartet = bucket.getPublicUrl(alt).data.publicUrl;
    if (url.split(/[?#]/, 1)[0] === erwartet) pfade.push(alt);
  }
  const { error } = await bucket.remove(pfade);
  if (error) throw new Error('Profildatei konnte nicht entfernt werden.');
}
