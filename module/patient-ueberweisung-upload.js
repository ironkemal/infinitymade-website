/** File selection belongs to its original patient; leaving that context cancels it. */
export function erstelleUeberweisungUpload({ supabase, getPatientId, getOwnerId, showToast, reload, FileReader = globalThis.FileReader }) {
  let generation = 0;
  function invalidate() { generation++; }
  async function upload(file) {
    const patientId = getPatientId(), ownerId = getOwnerId(), token = generation;
    const current = () => token === generation && getPatientId() === patientId && getOwnerId() === ownerId;
    if (!file || !patientId || !ownerId) return false;
    try {
      const image = await new Promise((resolve,reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
        reader.onabort = () => reject(new Error('Dateiauswahl abgebrochen.'));
        reader.readAsDataURL(file);
      });
      if (!current()) return false;
      const { error } = await supabase.from('ueberweisungen').insert({
        owner_id: ownerId, lead_id: patientId, image_url: image, created_at: new Date().toISOString(),
      });
      if (!current()) return false;
      if (error) throw error;
      showToast('Überweisung gespeichert ✓'); await reload(patientId); return true;
    } catch (error) {
      if (current()) showToast('Fehler: ' + error.message, 'error');
      return false;
    }
  }
  return { invalidate, upload, version: () => generation };
}
