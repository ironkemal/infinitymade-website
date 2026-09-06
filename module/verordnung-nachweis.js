/**
 * verordnung-nachweis.js — die Genehmigung zum langfristigen Heilmittelbedarf.
 *
 * Warum es das gibt
 * ─────────────────
 * Kreuzt jemand „LHB / BVB" an, behauptet die Verordnung einen langfristigen
 * Heilmittelbedarf — und dafuer gibt es ein Papier von der Kasse. Ohne dieses
 * Papier ist die Behauptung im Streitfall nicht belegbar.
 *
 * Hochladen konnte man es bisher nur im Bestaetigungsfenster des Scans
 * (`rxcLhbBvbFile`). Wer die Verordnung von Hand eintippte, hatte die
 * Moeglichkeit nie. Mit der Zusammenlegung der beiden Masken (06.09.2026)
 * faellt dieses Fenster weg — der Weg fuer den Nachweis darf nicht mit ihm
 * verschwinden, sondern zieht in die Maske, wo ihn jetzt BEIDE Wege haben.
 *
 * Warum hier NICHT auch der Befreiungsnachweis steht
 * ─────────────────────────────────────────────────
 * Weil er ein Zuhause hat: `module/zuzahlung-befreiung.js` ist seit dem
 * 12.08.2026 „das einzige Formular" fuer die Zuzahlungsbefreiung und hat
 * genau diesen dritten Weg („Rezept-Nachweis-Upload — schrieb die Zeile
 * stillschweigend") bewusst eingesammelt. Ihn hier wieder aufzumachen waere
 * ein Rueckschritt hinter eine getroffene Entscheidung.
 *
 * Der Upload passiert NACH dem Speichern: vorher gibt es keine
 * `prescription_id`, an der das Dokument haengen koennte.
 */

const g = (id) => document.getElementById(id);

/** Die vorgemerkte Datei — hochgeladen wird erst nach dem Speichern. */
let _datei = null;

export function nachweisVorgemerkt() { return _datei; }
export function nachweisVerwerfen() {
  _datei = null;
  const feld = g('rzLhbDatei');
  if (feld) feld.value = '';
  zeichneStand();
}

function zeichneStand() {
  const stand = g('rzLhbStand');
  if (!stand) return;
  stand.textContent = _datei ? `${_datei.name} — wird nach dem Speichern angehängt` : '';
  const weg = g('rzLhbWeg');
  if (weg) weg.hidden = !_datei;
}

/** Sichtbar nur, wenn „LHB / BVB" angekreuzt ist — sonst bedeutet er nichts. */
function sichtbarkeitNachziehen() {
  const streifen = g('rzLhbNachweis');
  if (!streifen) return;
  const an = !!g('rzLhbBvb')?.checked;
  streifen.hidden = !an;
  // Abgehakt heisst: die Behauptung ist zurueckgenommen, der Beleg dazu auch.
  if (!an && _datei) nachweisVerwerfen();
}

/**
 * Den Upload-Streifen in die Maske haengen. Mehrfach aufrufbar — die Maske
 * wird bei jedem Oeffnen neu verdrahtet.
 */
export function verdrahteLhbNachweis() {
  const kasten = g('rzLhbBvb');
  if (!kasten) return;

  if (!g('rzLhbNachweis')) {
    const anker = kasten.closest('label')?.parentElement || kasten.parentElement;
    if (!anker) return;
    const streifen = document.createElement('div');
    streifen.id = 'rzLhbNachweis';
    streifen.hidden = true;
    streifen.style.cssText = 'margin-top:6px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
    streifen.innerHTML = `
      <button type="button" id="rzLhbKnopf" style="padding:4px 10px;border-radius:6px;
        border:1px solid var(--border);background:var(--bg-card-solid);color:var(--text-main);
        font-size:12px;cursor:pointer;">Genehmigung anhängen</button>
      <span id="rzLhbStand" style="font-size:11px;color:var(--text-muted);"></span>
      <button type="button" id="rzLhbWeg" hidden style="padding:2px 8px;border-radius:6px;
        border:1px solid var(--border);background:transparent;color:var(--text-muted);
        font-size:11px;cursor:pointer;">Entfernen</button>
      <input type="file" id="rzLhbDatei" accept="image/*,application/pdf" hidden>`;
    anker.appendChild(streifen);

    g('rzLhbKnopf').addEventListener('click', () => g('rzLhbDatei').click());
    g('rzLhbDatei').addEventListener('change', (e) => {
      _datei = e.target.files?.[0] || null;
      zeichneStand();
    });
    g('rzLhbWeg').addEventListener('click', nachweisVerwerfen);
  }

  if (!kasten.dataset.lhbNachweisWacht) {
    kasten.dataset.lhbNachweisWacht = '1';
    kasten.addEventListener('change', sichtbarkeitNachziehen);
  }
  sichtbarkeitNachziehen();
}

/**
 * Die vorgemerkte Genehmigung an die gespeicherte Verordnung haengen.
 *
 * Wirft nicht: eine gespeicherte Verordnung darf nicht daran scheitern, dass
 * eine Datei nicht durchging — der Anwender bekommt einen Hinweis und kann sie
 * in der Patientenakte nachreichen.
 *
 * @returns {Promise<{ok:boolean, fehler?:string}>}
 */
export async function ladeLhbNachweisHoch(supabase, { ownerId, patientId, prescriptionId, userId }) {
  if (!_datei) return { ok: true };
  if (!supabase || !ownerId || !patientId || !prescriptionId) {
    return { ok: false, fehler: 'Verordnung oder Patient fehlt' };
  }
  const datei = _datei;
  const endung = (datei.name.split('.').pop() || 'pdf').toLowerCase();
  const pfad = `${ownerId}/${patientId}/rezept/${prescriptionId}/lhb_genehmigung_${Date.now()}.${endung}`;

  try {
    const { error: ablageFehler } = await supabase.storage
      .from('patient-documents')
      .upload(pfad, datei, { contentType: datei.type || 'application/octet-stream', upsert: true });
    if (ablageFehler) throw ablageFehler;

    const { error: zeilenFehler } = await supabase.from('prescription_documents').insert({
      owner_id: ownerId,
      prescription_id: prescriptionId,
      patient_id: patientId,
      art: 'lhb_genehmigung',
      storage_path: pfad,
      dateiname: datei.name,
      mime_type: datei.type || 'application/octet-stream',
      groesse_bytes: datei.size,
      uploaded_by: userId || null,
    });
    // Die Datei liegt dann zwar in der Ablage, aber ohne Zeile findet sie
    // niemand wieder — deshalb ist auch das ein Fehlschlag, kein Achselzucken.
    if (zeilenFehler) throw zeilenFehler;

    nachweisVerwerfen();
    return { ok: true };
  } catch (e) {
    console.warn('[verordnung-nachweis] Upload fehlgeschlagen:', e);
    return { ok: false, fehler: e?.message || 'Unbekannter Fehler' };
  }
}
