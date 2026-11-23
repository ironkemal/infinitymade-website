/**
 * ki-aufgaben-sperre.js — der Praxisinhaber schaltet einzelne KI-Aufgaben aus (Phase 7b, KI-Stufe 1, 23.11.2026).
 *
 * Bewertet: guvenlik ✅ (nur zusätzliche Sperre, fail closed, kein logCall), onprem ✅ (Datei statt DB-Spalte,
 * frisch je Anfrage gelesen, eigenes Volume ki_freigaben wie die Freischaltung).
 * - Datei `<tenantId>.aufgaben.json` im Verzeichnis der KI-Freischaltung (KI_EINWILLIGUNG_DIR).
 *   Getrennt von `<tenantId>.json`, weil ältere Images (beta/stable parallel) einen neuen Schlüssel dort als
 *   UNKNOWN_KEY lesen und die KI ganz abschalten würden.
 * - Fehlt die Datei → nichts gesperrt. Kaputt / unbekannte Gruppe / falscher Mandant → ALLES gesperrt.
 * - Eine Aufgabe ohne Gruppe gilt als gesperrt (neue Aufgaben müssen bewusst zugeordnet werden).
 * - set() liest vorher nicht: eine kaputte Datei lässt sich so immer überschreiben (Ausweg).
 */
import { liesJsonDatei, schreibeJsonDatei } from '../lib/gehaerteter-json-store.js';

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Gruppen, wie die Praxis sie sieht. Nur Aufgaben, die über executeKiTask ein Modell rufen. */
export const AUFGABEN_GRUPPEN = Object.freeze({
  mail: Object.freeze({ label: 'E-Mail-Entwürfe (Patienten, Partner, Terminbestätigung)', aufgaben: Object.freeze(['b2c-draft', 'b2b-draft', 'appointment-confirm-draft']) }),
  serie: Object.freeze({ label: 'Serientermine vorschlagen', aufgaben: Object.freeze(['series-scheduler']) }),
  diktat: Object.freeze({ label: 'Sprachdiktat', aufgaben: Object.freeze(['transkribieren']) }),
  rezept: Object.freeze({ label: 'Verordnung aufbereiten (KI)', aufgaben: Object.freeze(['rezept-normalize', 'rezept-ocr']) }),
});

/** @param {string} task @returns {string|null} */
export function gruppeVonAufgabe(task) {
  for (const [id, g] of Object.entries(AUFGABEN_GRUPPEN)) if (g.aufgaben.includes(task)) return id;
  return null;
}

/**
 * @param {string} task
 * @param {{ alleGesperrt?: boolean, gesperrt?: string[] } | null | undefined} sperre
 */
export function aufgabeErlaubt(task, sperre) {
  const gruppe = gruppeVonAufgabe(task);
  if (!gruppe) return false;
  if (!sperre || sperre.alleGesperrt === true) return false;
  return !(sperre.gesperrt || []).includes(gruppe);
}

/** @param {unknown} liste */
export function gueltigeGruppen(liste) {
  return Array.isArray(liste) && liste.length <= Object.keys(AUFGABEN_GRUPPEN).length
    && liste.every((g) => typeof g === 'string' && Object.prototype.hasOwnProperty.call(AUFGABEN_GRUPPEN, g))
    && new Set(liste).size === liste.length;
}

function standardVerzeichnis() {
  return process.env.KI_EINWILLIGUNG_DIR || '/var/lib/praxura/ki-freigaben';
}

/**
 * @param {{ directory?: string, now?: () => number }} [o]
 */
export function createAufgabenSperreStore({ directory, now = Date.now } = {}) {
  const dir = directory || standardVerzeichnis();
  const datei = (/** @type {string} */ tenantId) => `${tenantId.toLowerCase()}.aufgaben.json`;

  /** @param {string} tenantId @returns {Promise<{ alleGesperrt: boolean, gesperrt: string[], status: string }>} */
  async function read(tenantId) {
    if (typeof tenantId !== 'string' || !RE_UUID.test(tenantId)) return { alleGesperrt: true, gesperrt: [], status: 'UNGUELTIGER_MANDANT' };
    const r = liesJsonDatei(dir, datei(tenantId));
    if (r.status === 'fehlt') return { alleGesperrt: false, gesperrt: [], status: 'keine_sperre' };
    if (r.status !== 'ok') return { alleGesperrt: true, gesperrt: [], status: r.grund };
    const d = r.data;
    const schluessel = new Set(['tenantId', 'actorId', 'gesperrt', 'geaendertAm']);
    if (!d || typeof d !== 'object' || Object.keys(d).some((k) => !schluessel.has(k))) return { alleGesperrt: true, gesperrt: [], status: 'UNBEKANNTER_SCHLUESSEL' };
    if (String(d.tenantId).toLowerCase() !== tenantId.toLowerCase() || String(d.actorId).toLowerCase() !== tenantId.toLowerCase()) return { alleGesperrt: true, gesperrt: [], status: 'MANDANT_PASST_NICHT' };
    if (!gueltigeGruppen(d.gesperrt)) return { alleGesperrt: true, gesperrt: [], status: 'UNGUELTIGE_GRUPPE' };
    return { alleGesperrt: false, gesperrt: [...d.gesperrt], status: 'ok' };
  }

  /**
   * @param {{ role: string, userId: string, tenantId: string }} auth
   * @param {{ gesperrt: string[] }} werte
   */
  async function set(auth, { gesperrt } = /** @type {any} */ ({})) {
    if (!auth || auth.role !== 'owner' || auth.userId !== auth.tenantId || !RE_UUID.test(String(auth.tenantId))) {
      const e = /** @type {any} */ (new Error('Nur der Praxisinhaber darf KI-Aufgaben ein- oder ausschalten')); e.code = 'KI_OWNER_REQUIRED'; e.status = 403; throw e;
    }
    if (!gueltigeGruppen(gesperrt)) {
      const e = /** @type {any} */ (new Error('Ungültige Aufgabenliste')); e.code = 'KI_AUFGABEN_UNGUELTIG'; e.status = 400; throw e;
    }
    const satz = { tenantId: auth.tenantId, actorId: auth.userId, gesperrt: [...gesperrt].sort(), geaendertAm: new Date(now()).toISOString() };
    schreibeJsonDatei(dir, datei(auth.tenantId), satz);
    return { ok: true, gesperrt: satz.gesperrt, geaendertAm: satz.geaendertAm };
  }

  return { read, set, directory: dir };
}

/** @type {ReturnType<typeof createAufgabenSperreStore> | null} */
let _standard = null;
export function getAufgabenSperreStore() {
  if (!_standard) _standard = createAufgabenSperreStore();
  return _standard;
}

/** Für GET /_config: Liste für die Oberfläche. @param {{ alleGesperrt: boolean, gesperrt: string[] }} sperre */
export function aufgabenListe(sperre) {
  return Object.entries(AUFGABEN_GRUPPEN).map(([id, g]) => ({ id, label: g.label, gesperrt: sperre.alleGesperrt === true || sperre.gesperrt.includes(id) }));
}
