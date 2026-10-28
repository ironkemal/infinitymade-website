/** Inhaber-Dokumentensuche. Bestehende Loader und Ansichten, keine Schreibwege.
 * VO-Scope: vollständige erlaubte Patientenmenge aus F10; Finance-Scope wie bizScope.
 * Suchbestand bewusst begrenzt (200 je VO-Zweig/Patientenpaket, 200 Rechnungen).
 * Keine Vollständigkeits- oder Entwarnungsaussage aus leeren Suchtreffern.
 */
import { ladeHandlungsbedarfScope } from './startseite-handlungsbedarf-karte.js?v=20261028s242';
const voLaden = async (...args) => (await import('./verordnung-uebersicht.js?v=20261028s249')).ladeAktiveVerordnungen(...args);
const voAnzeigen = async ctx => { const m = await import('./verordnung-detail.js?v=20261028s249'); if (ctx.istAktuell()) return m.zeigeVerordnungDetail(ctx); };
const rechnungAnzeigen = async (id, ctx) => { const m = await import('./rechnung-ansicht.js?v=20261028s249'); if (ctx.istAktuell()) return m.openInvView(id, ctx); };

/** Nur die Hülle ist neu. Rechnungsmarkup stammt aus vorhandener Druckansicht;
 * IDs werden lokalisiert, bestehende Panel-Handler bleiben unberührt. */
function dokumentDialog(art, schliessen) {
  const dialog = document.createElement('dialog');
  dialog.id = 'pxDokumentDialog'; dialog.className = 'px-dokument-dialog';
  dialog.setAttribute('aria-labelledby', 'pxDokumentTitel');
  const kopf = document.createElement('div'); kopf.className = 'px-dokument-kopf';
  const heading = document.createElement('h2'); heading.id = 'pxDokumentTitel';
  const titel = document.createElement('span'); titel.textContent = art === 'rechnung' ? 'Rechnung' : 'Verordnung';
  heading.append(titel, document.createTextNode(' · Leseansicht'));
  const zu = document.createElement('button'); zu.type = 'button'; zu.className = 'btn-ghost'; zu.textContent = 'Schließen';
  zu.addEventListener('click', schliessen); kopf.append(heading, zu);
  const inhalt = document.createElement('div'); inhalt.className = 'px-dokument-inhalt';
  if (art === 'rechnung') {
    const vorlage = document.getElementById('invoicePrintArea');
    if (!vorlage) throw new Error('SUCHE_ANSICHT_FEHLT');
    const kopie = vorlage.cloneNode(true);
    for (const el of [kopie, ...kopie.querySelectorAll('[id]')]) { el.dataset.pxId = el.id; el.removeAttribute('id'); }
    inhalt.append(kopie);
  }
  dialog.append(kopf, inhalt); document.body.append(dialog);
  dialog.addEventListener('cancel', e => { e.preventDefault(); schliessen(); });
  dialog.showModal(); zu.focus();
  return { titel, inhalt, element: id => inhalt.querySelector(`[data-px-id="${id}"]`), schliessen: () => {
    dialog.close(); dialog.remove(); document.querySelector('.px-suche-art:not([hidden])')?.focus({ preventScroll: true });
  } };
}

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const key = k => JSON.stringify([k?.rolle, k?.uid, k?.ownerId, k?.businessId, k?.patientsGemeinsam, k?.financeGemeinsam, k?.bereit, k?.financeBereit, k?.verordnungenErlaubt, k?.rechnungenErlaubt]);
export const dokumentScopeKey = key;
export function dokumenteErlaubt(k, art) {
  return k?.rolle === 'owner' && UUID.test(k.uid || '') && k.uid === k.ownerId
    && k.bereit === true && typeof k.patientsGemeinsam === 'boolean'
    && (k.businessId === null || UUID.test(k.businessId || ''))
    && ((art === 'verordnung' && k.verordnungenErlaubt === true) || (art === 'rechnung' && k.rechnungenErlaubt === true && k.financeBereit === true && typeof k.financeGemeinsam === 'boolean'));
}

/** Generation + Scopebindung gelten auch für verspätete Adapter ohne Abort-Unterstützung. */
export function createDokumentSuche({ kontext, scopeLader = ladeHandlungsbedarfScope, voLader = voLaden,
  voOeffner = voAnzeigen, rechnungOeffner = rechnungAnzeigen, ansicht = dokumentDialog, timeoutMs = 30000 }) {
  let nr = 0, controller = null, offen = null;
  const invalide = () => {
    nr++; controller?.abort(); controller = null;
    offen?.schliessen();
    offen = null;
  };
  async function lauf(art, arbeit) {
    invalide();
    const k = kontext(), startKey = key(k), generation = nr;
    if (!dokumenteErlaubt(k, art)) return { status: 'unbekannt', zeilen: [] };
    const c = new AbortController(); controller = c;
    const aktuell = () => generation === nr && !c.signal.aborted && key(kontext()) === startKey && dokumenteErlaubt(kontext(), art);
    const timer = setTimeout(() => c.abort(), timeoutMs);
    try {
      const abbruch = new Promise((_, reject) => c.signal.addEventListener('abort', () => reject(new Error('SUCHE_ABBRUCH')), { once: true }));
      const daten = await Promise.race([arbeit(k, c.signal, aktuell, startKey), abbruch]);
      return aktuell() ? daten : { status: 'veraltet', zeilen: [] };
    } catch {
      if (generation === nr && key(kontext()) === startKey && offen?.inhalt) offen.inhalt.textContent = 'Dokument konnte nicht geladen werden. Schließen und Suche erneut laden.';
      return { status: generation === nr && key(kontext()) === startKey ? 'fehler' : 'veraltet', zeilen: [] };
    } finally { clearTimeout(timer); }
  }
  const laden = art => lauf(art, async (k, signal, istAktuell, scopeKey) => {
    let daten;
    if (art === 'verordnung') {
      const scope = await scopeLader({ supabase: k.supabase, kontext: k, signal, istAktuell });
      if (!istAktuell() || !scope) return { status: 'unbekannt', zeilen: [] };
      const pakete = scope.umfang === 'mandant' ? [undefined] : Array.from({ length: Math.ceil(scope.patientIds.length / 200) }, (_, i) => scope.patientIds.slice(i * 200, (i + 1) * 200));
      daten = [];
      for (const suchPatientIds of pakete) {
        if (!istAktuell()) return { status: 'veraltet', zeilen: [] };
        const teil = await voLader(k.supabase, { ownerId: k.ownerId, nurAktive: false, limit: 200, suchPatientIds, signal, istAktuell, nurSuchdaten: true });
        if (!istAktuell()) return { status: 'veraltet', zeilen: [] };
        if (!Array.isArray(teil) || teil.some(r => !UUID.test(r.id || '') || !UUID.test(r.leadId || '') || (suchPatientIds && !suchPatientIds.includes(r.leadId)))) throw new Error('SUCHE_SCOPE');
        daten.push(...teil);
      }
    } else {
      daten = await k.ladeRechnungen({ ownerId: k.ownerId, istAktuell, scope: q => {
        if (!istAktuell()) throw new Error('SUCHE_VERALTET');
        if (!k.financeGemeinsam && k.businessId !== null) q = q.or(`business_id.eq.${k.businessId},business_id.is.null`);
        return q.limit(200).abortSignal(signal);
      } });
      if (!istAktuell()) return { status: 'veraltet', zeilen: [] };
      if (!Array.isArray(daten) || daten.some(r => !UUID.test(r.id || '') || r.owner_id !== k.ownerId || (!k.financeGemeinsam && k.businessId !== null && r.business_id !== null && r.business_id !== k.businessId))) throw new Error('SUCHE_SCOPE');
    }
    const zeilen = daten.map(row => ({ id: `${art}:${row.id}`, originalId: row.id, art, scopeKey, row,
      label: art === 'verordnung' ? [row.nummerText, [row.vorname, row.nachname].filter(Boolean).join(' '), row.titel, row.datum].filter(Boolean).join(' · ')
        : [row.invoice_number || 'Rechnung ohne Nummer', row.patient_name, row.issued_at || row.created_at].filter(Boolean).join(' · '),
    }));
    return { status: 'ok', zeilen };
  });
  const oeffnen = treffer => {
    if (!treffer || treffer.scopeKey !== key(kontext()) || !dokumenteErlaubt(kontext(), treffer.art)) return Promise.resolve({ status: 'veraltet', zeilen: [] });
    return lauf(treffer.art, async (k, signal, aktuell) => {
      // Frischer Dokumentread mit ursprünglichem Scope; Suchzeile ist keine Berechtigung.
      let row;
      if (treffer.art === 'rechnung') {
        let q = k.supabase.from('invoices').select('*').eq('owner_id', k.ownerId).eq('id', treffer.originalId);
        if (!k.financeGemeinsam && k.businessId !== null) q = q.or(`business_id.eq.${k.businessId},business_id.is.null`);
        const r = await q.abortSignal(signal).maybeSingle();
        if (!aktuell()) return { status: 'veraltet', zeilen: [] };
        if (r.error || !r.data || r.data.id !== treffer.originalId || r.data.owner_id !== k.ownerId || (!k.financeGemeinsam && k.businessId !== null && r.data.business_id !== null && r.data.business_id !== k.businessId)) throw new Error('SUCHE_SCOPE');
        row = r.data;
      } else {
        const scope = await scopeLader({ supabase: k.supabase, kontext: k, signal, istAktuell: aktuell });
        if (!aktuell() || !scope || (scope.umfang === 'patienten' && !scope.patientIds.includes(treffer.row.leadId))) return { status: 'unbekannt', zeilen: [] };
        row = treffer.row;
      }
      if (!aktuell()) return { status: 'veraltet', zeilen: [] };
      const view = ansicht(treffer.art, invalide); offen = view;
      const istAktuell = () => aktuell() && offen === view;
      if (treffer.art === 'rechnung') await rechnungOeffner(row.id, { rechnung: row, ownerId: k.ownerId, signal, istAktuell, element: view.element });
      else await voOeffner({ supabase: k.supabase, quelle: row.quelle, verordnungId: row.id, leadId: row.leadId,
        suchOwnerId: k.ownerId, signal, istAktuell, bearbeitbar: false, escapeHtml: k.escapeHtml,
        titel: view.titel, inhalt: view.inhalt });
      return { status: istAktuell() ? 'ok' : 'veraltet', zeilen: [] };
    });
  };
  return { laden, oeffnen, invalide };
}
