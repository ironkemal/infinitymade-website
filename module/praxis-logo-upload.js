/** Shared avatars upload for practice branding and mail footers. No profile writes. */
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
export async function logoDateiAlsPng(file) {
  if (!['image/png','image/jpeg','image/webp'].includes(file?.type) || file.size > 4*1024*1024) throw new Error('Bitte PNG, JPG oder WebP bis 4 MB wählen.');
  const bitmap=await createImageBitmap(file);
  try {
    if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>40000000)throw new Error('Bildabmessungen zu groß.');
    const scale=Math.min(1,800/bitmap.width,800/bitmap.height),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)throw new Error('Bildverarbeitung fehlgeschlagen.');return blob;
  } finally {bitmap.close();}
}
