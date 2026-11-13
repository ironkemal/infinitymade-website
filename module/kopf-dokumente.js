/** V2.09b Inhaber-Dokumentsuche in der Kopfleiste (nur neues Design).
 * Melih 28.10.2026 „zunächst nur Inhaber“, 13.11.2026 „ja“ (in diesen Lauf). Verkleinerter Neuschnitt des Altstands
 * aa032d91 (rettung/design-wip-20261031): keine eigene Leseansicht, keine geänderten Renderer — Treffer öffnen die
 * vorhandenen Panels (Rechnungen: openInvView, Verordnungen: verordnung-liste.js).
 * Quellen sind ausschließlich vorhandene Lader:
 *   - Verordnungen: ladeAktiveVerordnungen (owner_id, ≤ 200 je Topf) + Standortgrenze aus ladeHandlungsbedarfScope.
 *   - Rechnungen: loadRechnungen aus dashboard.js (owner_id + bizScope 'finance'), nur das Ergebnis DIESES Laufs.
 * guvenlik 13.11.2026 (kein Veto, Auflagen): Generation nach jedem await, Kontextschlüssel inkl. Sharing/Design/Leiste,
 * Fehler = „nicht verfügbar“ statt altem Cache, Teilbestand sichtbar, kein Betrag in Treffern, keine Rohzeilen in Logs,
 * Öffner nur nach erneuter Prüfung. Mitarbeiterin: keine Quelle, kein Read.
 */
import { ladeHandlungsbedarfScope } from './startseite-handlungsbedarf-karte.js?v=20261113f606';

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
// PostgREST liefert ohne Bereich höchstens 1000 Zeilen; loadRechnungen setzt kein limit.
const RECHNUNGEN_MAX = 1000;
const VO_JE_TOPF = 200;

export const DOKUMENT_ARTEN = ['verordnung', 'rechnung'];

/** Alles, was eine Suche entwerten muss: Identität, Standort, Freigaben, Design, Leisteneinträge. */
export function dokumentScopeKey(k) {
  return JSON.stringify([k?.rolle, k?.uid, k?.ownerId, k?.businessId, k?.patientsGemeinsam, k?.financeGemeinsam,
    k?.design, k?.verordnungenErlaubt, k?.rechnungenErlaubt]);
}

export function dokumenteErlaubt(k, art) {
  if (!k || k.rolle !== 'owner' || !UUID.test(k.uid || '') || k.uid !== k.ownerId || k.design !== 'neu') return false;
  if (k.businessId !== null && !UUID.test(k.businessId || '')) return false;
  if (art === 'verordnung') return k.verordnungenErlaubt === true && typeof k.patientsGemeinsam === 'boolean';
  if (art === 'rechnung') return k.rechnungenErlaubt === true && typeof k.financeGemeinsam === 'boolean';
  return false;
}

const datumDe = d => { if (!d) return ''; const t = new Date(d); return Number.isNaN(t.getTime()) ? '' : t.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' }); };

/** Treffertext ohne Betrag (auch nicht versteckt). Escaping macht der Picker (patient-suche.js). */
export function dokumentLabel(art, row) {
  if (art === 'verordnung') {
    const name = [row.vorname, row.nachname].filter(Boolean).join(' ') || 'ohne Patient';
    return [row.nummerText || 'Verordnung ohne Nummer', name, datumDe(row.datum)].filter(Boolean).join(' · ');
  }
  return [row.invoice_number || 'Rechnung ohne Nummer', row.patient_name || 'ohne Patient', datumDe(row.issued_at || row.created_at)].filter(Boolean).join(' · ');
}

/**
 * @param {{ kontext: () => object, ladeVerordnungen: Function, ladeRechnungen: Function,
 *           oeffneVerordnung: Function, oeffneRechnung: Function, scopeLader?: Function }} deps
 */
export function createDokumentSuche({ kontext, ladeVerordnungen, ladeRechnungen, oeffneVerordnung, oeffneRechnung, scopeLader = ladeHandlungsbedarfScope, timeoutMs = 30000 }) {
  let nr = 0, controller = null;
  const invalide = () => { nr++; controller?.abort(); controller = null; };

  async function laden(art) {
    invalide();
    const k = kontext(), startKey = dokumentScopeKey(k), generation = nr;
    if (!DOKUMENT_ARTEN.includes(art) || !dokumenteErlaubt(k, art)) return { status: 'unbekannt', zeilen: [], teilbestand: false };
    const c = new AbortController(); controller = c;
    const timer = setTimeout(() => c.abort(), timeoutMs);
    // Lader ohne AbortSignal (ladeAktiveVerordnungen, loadRechnungen) hängen sonst trotz Abbruch weiter:
    // jedes await rennt gegen den Abbruch, der Lauf endet spätestens nach timeoutMs.
    const abbruch = new Promise((_, nein) => c.signal.addEventListener('abort', () => nein(Object.assign(new Error('Suche abgebrochen'), { code: 'SUCHE_ABBRUCH' })), { once: true }));
    abbruch.catch(() => {});
    const warte = p => Promise.race([p, abbruch]);
    const aktuell = () => generation === nr && !c.signal.aborted && dokumentScopeKey(kontext()) === startKey && dokumenteErlaubt(kontext(), art);
    const veraltet = { status: 'veraltet', zeilen: [], teilbestand: false };
    try {
      let zeilen = [], teilbestand = false;
      if (art === 'verordnung') {
        const scope = await warte(scopeLader({ supabase: k.supabase, kontext: { ...k, bereit: true }, signal: c.signal, istAktuell: aktuell }));
        if (!aktuell()) return veraltet;
        if (!scope || scope.ownerId !== k.ownerId || !['mandant', 'patienten'].includes(scope.umfang)) return { status: 'unbekannt', zeilen: [], teilbestand: false };
        const daten = await warte(ladeVerordnungen(k));
        if (!aktuell()) return veraltet;
        if (!Array.isArray(daten)) return { status: 'fehler', zeilen: [], teilbestand: false };
        const erlaubt = scope.umfang === 'patienten' ? new Set(scope.patientIds) : null;
        const jeTopf = {};
        for (const row of daten) {
          if (!UUID.test(row?.id || '') || !['physio', 'podologie'].includes(row.quelle)) return { status: 'fehler', zeilen: [], teilbestand: false };
          jeTopf[row.quelle] = (jeTopf[row.quelle] || 0) + 1;
          // Standortgrenze: ohne bekannte Patientenakte ist der Standort unklar → nur im Mandantenumfang zeigen.
          if (erlaubt && !(row.leadId && erlaubt.has(row.leadId))) continue;
          zeilen.push({ art, originalId: row.id, quelle: row.quelle, label: dokumentLabel(art, row) });
        }
        teilbestand = Object.values(jeTopf).some(n => n >= VO_JE_TOPF);
      } else {
        const daten = await warte(ladeRechnungen(k));
        if (!aktuell()) return veraltet;
        // loadRechnungen meldet Fehler mit null: dann nie den alten Cache durchsuchen.
        if (!Array.isArray(daten)) return { status: 'fehler', zeilen: [], teilbestand: false };
        for (const row of daten) {
          if (!UUID.test(row?.id || '') || row.owner_id !== k.ownerId
              || (!k.financeGemeinsam && k.businessId !== null && row.business_id != null && row.business_id !== k.businessId)) return { status: 'fehler', zeilen: [], teilbestand: false };
          zeilen.push({ art, originalId: row.id, label: dokumentLabel(art, row) });
        }
        teilbestand = daten.length >= RECHNUNGEN_MAX;
      }
      for (const z of zeilen) { z.id = `${art}:${z.originalId}`; z.scopeKey = startKey; z.suchtext = z.label.toLowerCase(); }
      return { status: 'ok', zeilen, teilbestand };
    } catch (e) {
      // Nur Meldung/Code, keine Zeilen, kein Suchbegriff (guvenlik 13.11.).
      console.warn('[kopf-dokumente]', e?.code || e?.message || 'fehler');
      return generation === nr ? { status: 'fehler', zeilen: [], teilbestand: false } : veraltet;
    } finally { clearTimeout(timer); if (controller === c) controller = null; }
  }

  /** Treffer ist keine Berechtigung: Kontext und Recht vor dem Öffnen erneut prüfen. */
  async function oeffnen(treffer) {
    const k = kontext();
    if (!treffer || !DOKUMENT_ARTEN.includes(treffer.art) || treffer.scopeKey !== dokumentScopeKey(k) || !dokumenteErlaubt(k, treffer.art)
        || !UUID.test(treffer.originalId || '')) return false;
    const r = treffer.art === 'rechnung' ? await oeffneRechnung(treffer.originalId) : await oeffneVerordnung(treffer.quelle, treffer.originalId);
    return r !== false;
  }

  return { laden, oeffnen, invalide };
}

/**
 * guvenlik 13.11.2026: ladeAktiveVerordnungen (gemeinsam mit dem alten Design) macht aus einem Fehler je Topf still `[]`.
 * Statt das gemeinsame Modul zu ändern (modulweiter Zustand, lange ?v=-Kaskade), bekommt der Lader hier einen Client,
 * der jede Fehlerantwort mitzählt. Die Suche wertet dann „Fehler“ statt „0 Treffer“. Andere Client-Funktionen
 * (rpc, auth …) werden unverändert durchgereicht.
 */
export function mitFehlerMelder(sb) {
  let fehler = false;
  const huelle = b => new Proxy(b, { get(t, p) {
    // Nur echte Thenables (Filter-Builder) bekommen ein `then`; der Query-Builder aus from() bleibt ohne.
    if (p === 'then') return typeof t.then === 'function' ? (ok, nein) => t.then(r => { if (r?.error) fehler = true; return r; }, e => { fehler = true; throw e; }).then(ok, nein) : undefined;
    const v = t[p];
    if (typeof v !== 'function') return v;
    return (...a) => { const r = v.apply(t, a); return r && typeof r === 'object' && typeof r.then === 'function' ? huelle(r) : r; };
  } });
  const client = new Proxy(sb, { get(t, p) {
    const v = t[p];
    if (p === 'from' && typeof v === 'function') return (...a) => huelle(v.apply(t, a));
    return typeof v === 'function' ? v.bind(t) : v;
  } });
  return { client, fehler: () => fehler };
}

/** Hinweistext unter dem Feld; nie „keine Verordnung/Rechnung“ als Vollständigkeitsaussage. */
export function dokumentHinweis(art, ergebnis) {
  const wort = art === 'verordnung' ? 'Verordnungen' : 'Rechnungen';
  if (!ergebnis || ergebnis.status === 'veraltet') return '';
  if (ergebnis.status === 'unbekannt') return art === 'verordnung' ? 'Verordnungssuche gerade nicht möglich: Standort unklar.' : 'Rechnungssuche gerade nicht möglich.';
  if (ergebnis.status === 'fehler') return `${wort} konnten nicht geladen werden. Bitte später erneut suchen.`;
  if (ergebnis.teilbestand) return `Gesucht wird in den neuesten ${wort} (Teilbestand). Fehlt eine, bitte unter „${wort}“ nachsehen.`;
  return '';
}
