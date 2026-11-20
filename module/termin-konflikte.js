// Anzeige, Vorschläge und Freigabe lesen dieselbe Serverprüfung. Keine Patientendaten im Prüfaufruf.
let deps;
const feld = id => document.getElementById(id);
const lokal = iso => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16);
};
function maske() {
  const start = feld('bkStart')?.value;
  return {
    id: feld('bk-id')?.value || null, empId: feld('bkEmployee')?.value, roomId: feld('bkRaum')?.value || null,
    startIso: start && Number.isFinite(Date.parse(start)) ? new Date(start).toISOString() : null,
    dauer: Number(deps.getDauerMin?.()), ohneRaum: !!feld('bkHausbesuch')?.checked,
    businessId: deps.getBusinessId(), serviceIds: [...new Set(deps.getLeistungen().map(z => z.serviceId).filter(Boolean))],
  };
}

async function pruefen(termin, signal) {
  const token = await deps.getToken();
  const response = await fetch(deps.apiBase + '/booking/termin-pruefen', { method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(termin) });
  if (!response.ok) throw new Error('Verfügbarkeit konnte nicht geprüft werden. Bitte erneut versuchen.');
  return response.json();
}

function anwenden(v) {
  const [id, value] = v.startIso ? ['bkStart', lokal(v.startIso)] : v.empId ? ['bkEmployee', v.empId] : ['bkRaum', v.roomId];
  const input = feld(id);
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function zeige(host, ergebnis) {
  host.replaceChildren();
  const { konflikte, vorschlaege } = ergebnis;
  const text = document.createElement('p');
  text.textContent = konflikte.length ? konflikte.map(k => k.grund).join(' ') : 'Termin frei.';
  text.style.color = konflikte.length ? 'var(--danger)' : 'var(--success)';
  host.append(text);
  for (const v of vorschlaege) {
    const knopf = document.createElement('button');
    knopf.type = 'button'; knopf.className = 'btn-ghost';
    const label = document.createElement('strong');
    label.textContent = v.label + ' übernehmen';
    const grund = document.createElement('small');
    grund.textContent = konflikte.map(k => k.grund).join(' ');
    knopf.append(label, grund);
    knopf.addEventListener('click', () => anwenden(v));
    host.append(knopf);
  }
}

export function mountTerminKonflikte(kontext) {
  deps = kontext;
  const modal = feld('bookingModal'), host = feld('bkKonflikte');
  if (!modal || !host) return;
  let timer, controller, version = 0;
  const aktualisieren = () => {
    const aktuell = ++version;
    clearTimeout(timer);
    controller?.abort();
    host.replaceChildren();
    if (modal.hidden) return;
    timer = setTimeout(async () => {
      const termin = maske();
      if (!termin.startIso || !termin.empId || !termin.serviceIds.length || !termin.dauer) return;
      controller = new AbortController();
      try {
        const ergebnis = await pruefen(termin, controller.signal);
        if (aktuell === version) zeige(host, ergebnis);
      } catch (e) { if (aktuell === version) host.textContent = e.message; }
    }, 180);
  };
  const relevant = e => {
    if (e.target.closest('#bkLeistungExtra') || ['bkStart','bkEmployee','bkService','bkRaum','bkDurationValue','bkHausbesuch','bkMenge'].includes(e.target.id)) aktualisieren();
  };
  modal.addEventListener('input', relevant);
  modal.addEventListener('change', relevant);
  modal.addEventListener('termin:neu-pruefen', aktualisieren);
  new MutationObserver(aktualisieren).observe(modal, { attributes: true, attributeFilter: ['hidden'] });
}

export async function terminFreigabe(dauer) {
  const eingaben = maske();
  const unveraendert = () => !feld('bookingModal').hidden && JSON.stringify(eingaben) === JSON.stringify(maske());
  try {
    const ergebnis = await pruefen({ ...eingaben, dauer });
    if (!unveraendert()) return false;
    zeige(feld('bkKonflikte'), ergebnis);
    if (!ergebnis.konflikte.length) return true;
    if (ergebnis.konflikte.some(k => k.sperre)) {
      feld('bkKonflikte').scrollIntoView({ block: 'nearest' });
      deps.showToast(ergebnis.konflikte.map(k => k.grund).join(' '), 'error');
      return false;
    }
    const bestaetigt = await deps.showConfirmModal({ title: 'Hinweise zum Termin', message: ergebnis.konflikte.map(k => k.grund).join('\n'),
      confirmText: 'Trotzdem eintragen', cancelText: 'Termin ändern', variant: 'warning' });
    return bestaetigt && unveraendert();
  } catch (e) { deps.showToast(e.message, 'error'); return false; }
}

// Das Speichern wartet auf die durchgesehene Liste. Kein Datum wird still übersprungen.
export async function serieFreigabe(slots, dauer) {
  const basis = { ...maske(), dauer };
  const dialog = document.createElement('dialog');
  dialog.className = 'serie-pruefen';
  const titel = document.createElement('h3'); titel.textContent = 'Serientermine prüfen'; dialog.append(titel);
  const abbrechen = document.createElement('button'); abbrechen.type = 'button'; abbrechen.className = 'btn-ghost'; abbrechen.textContent = 'Zurück';
  const speichern = document.createElement('button'); speichern.type = 'button'; speichern.className = 'btn-primary'; speichern.textContent = 'Auswahl übernehmen'; speichern.disabled = true;
  const liste = document.createElement('div'); dialog.append(liste, abbrechen, speichern);
  document.body.append(dialog); dialog.showModal();
  const zeilen = [];
  const gueltig = () => {
    const aktiv = zeilen.filter(z => !z.skip.checked);
    const doppelt = aktiv.some((z,i) => aktiv.slice(i+1).some(w => z.empId === w.empId && Math.abs(Date.parse(z.input.value) - Date.parse(w.input.value)) < dauer * 60000));
    speichern.disabled = !aktiv.length || aktiv.some(z => !z.frei) || doppelt;
    speichern.title = doppelt ? 'Zwei Serientermine überschneiden sich.' : '';
  };
  async function pruefeZeile(z) {
    const lauf = ++z.version;
    z.frei = false; gueltig();
    z.status.textContent = 'Wird geprüft …'; z.vorschlag.hidden = true;
    try {
      const t = { ...basis, empId: z.empId, roomId: z.roomId, startIso: new Date(z.input.value).toISOString() };
      const { konflikte, vorschlaege } = await pruefen(t);
      if (lauf !== z.version || !dialog.open) return;
      z.frei = !konflikte.length;
      z.status.textContent = z.frei ? 'Frei' : konflikte.map(k => k.grund).join(' ');
      const v = vorschlaege.find(a => a.startIso) || vorschlaege[0];
      if (v) {
        z.vorschlag.hidden = false; z.vorschlag.textContent = v.label + ' übernehmen';
        z.vorschlag.onclick = () => {
          if (v.startIso) z.input.value = lokal(v.startIso);
          if (v.empId) z.empId = v.empId;
          if (v.roomId) z.roomId = v.roomId;
          pruefeZeile(z);
        };
      }
    } catch { if (lauf === z.version) z.status.textContent = 'Prüfung fehlgeschlagen. Zeit ändern oder Datum überspringen.'; }
    gueltig();
  }
  for (const slot of slots) {
    const row = document.createElement('fieldset'), legend = document.createElement('legend'); legend.textContent = slot.date;
    const input = document.createElement('input'); input.type = 'datetime-local'; input.className = 'form-input';
    input.value = slot.date + 'T' + slot.time; input.setAttribute('aria-label','Datum und Uhrzeit');
    const skip = document.createElement('input'); skip.type = 'checkbox';
    const label = document.createElement('label'); label.append(skip, ' Überspringen');
    const status = document.createElement('p'); status.setAttribute('aria-live','polite');
    const vorschlag = document.createElement('button'); vorschlag.type = 'button'; vorschlag.className = 'btn-ghost'; vorschlag.hidden = true;
    const z = { input, empId: slot.employeeId, roomId: basis.roomId, skip, status, vorschlag, version: 0, frei: false };
    row.append(legend,input,status,vorschlag,label); liste.append(row); zeilen.push(z);
    input.addEventListener('change', () => pruefeZeile(z)); skip.addEventListener('change', gueltig);
  }
  // Höchstens drei gleichzeitige Prüfungen, auch bei einer 52er-Serie.
  async function lade(ab) { for (let i = ab; i < zeilen.length && dialog.open; i += 3) await pruefeZeile(zeilen[i]); }
  for (let i = 0; i < 3; i++) void lade(i);
  return new Promise(resolve => {
    let wahl = null;
    abbrechen.onclick = () => dialog.close();
    speichern.onclick = () => {
      wahl = zeilen.filter(z => !z.skip.checked).map(z => ({ date: z.input.value.slice(0,10), time: z.input.value.slice(11,16), employeeId: z.empId, roomId: z.roomId }));
      dialog.close();
    };
    dialog.addEventListener('close', () => { dialog.remove(); resolve(wahl); }, {once:true});
  });
}
