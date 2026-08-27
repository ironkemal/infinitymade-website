/**
 * beleg-druck.js — Belege (Rechnung / Zuzahlungsrechnung) zum Drucken öffnen,
 * und zwar erst dann, wenn der Beleg auch gültig werden kann.
 *
 * Der Fehler, der das ausgelöst hat
 * ─────────────────────────────────
 * Fehlten IBAN oder Steuernummer im Praxisprofil, hat der Server den Druck
 * abgelehnt und die Ablehnung als **komplette HTML-Seite** ausgeliefert
 * (`pflichtangabenHinweisHtml`, `api-backend/billing/api/abrechnung.routes.js`).
 * Der Anwender klickte im Seitenbereich auf „Drucken", bekam einen fremden Tab
 * auf einer fremden Domain (`n8n.infinitymade.de`), las dort einen Hinweis,
 * musste den Tab schliessen, im Dashboard die Einstellungen suchen, die Angabe
 * nachtragen und den ganzen Weg noch einmal gehen. Der Hinweistext nannte
 * ausserdem eine Stelle, die es nicht gibt („Einstellungen → Praxisdaten" —
 * die Felder stehen unter Einstellungen → Finanzen → Rechnungsdaten).
 *
 * Die Regel daraus
 * ────────────────
 * **Eine Bedingung, die der Anwender im Dashboard erfüllen muss, wird im
 * Dashboard geprüft und im Dashboard gemeldet — mit dem Weg dorthin als Knopf.**
 * Ein fremder Tab kann nicht navigieren, nicht fokussieren und nichts
 * nachtragen; er kann nur ein Text sein. Serverseitige Prüfungen bleiben
 * bestehen, aber als Netz, nicht als Benutzerführung.
 *
 * Die Prüfregel ist wörtlich die des Servers (`fehlendePflichtangaben`,
 * § 14 Abs. 4 UStG): IBAN ist Pflicht, und **Steuernummer ODER USt-IdNr.**
 * genügt. Weichen die beiden Seiten voneinander ab, blockiert entweder der
 * Server einen Druck, den das Dashboard durchgelassen hat (der alte Zustand),
 * oder das Dashboard warnt grundlos — beides schlimmer als keine Prüfung.
 *
 * Warum die Angaben nicht aus `currentProfile` kommen
 * ───────────────────────────────────────────────────
 * `currentProfile` ist die Zeile des **angemeldeten** Nutzers. Bankverbindung
 * und Steuernummer gehören der Praxis, also dem Inhaber. Bei einem Mitarbeiter
 * sind sie dort leer — die Prüfung würde jeden Druck blockieren, obwohl der
 * Server ihn zulässt (der lädt sie über `owner_id` nach).
 */

/** Belegarten, die der Server als Rechnung behandelt (RECHNUNGS_TYPEN in
 *  `abrechnung.routes.js`). Für alles andere — Quittungen ohne
 *  Rechnungscharakter — gelten die Pflichtangaben nicht. */
const RECHNUNGS_TYPEN = ['rechnung_privat', 'rechnung_selbstzahler', 'rechnung_sonder', 'rechnung_bg'];

/** Die Zuzahlungsrechnung heisst „Quittung", ist aber eine Rechnung
 *  (Fälligkeit + Bankzeile) — der Server prüft sie deshalb immer. */
export function istRechnungsartig(typ) {
  return typ === 'quittung_zuzahlung' || RECHNUNGS_TYPEN.includes(typ);
}

/**
 * Pflichtangaben nach § 14 Abs. 4 UStG. Rückgabe: Liste der fehlenden Angaben
 * in Klartext, leer = alles da.
 * Identisch mit `fehlendePflichtangaben()` im Backend — beim Ändern beide.
 */
export function fehlendePflichtangaben(profil) {
  const fehlend = [];
  if (!profil?.iban) fehlend.push('Bankverbindung (IBAN)');
  if (!profil?.steuernummer && !profil?.ust_id) fehlend.push('Steuernummer oder USt-IdNr.');
  return fehlend;
}

// Modulweiter Cache: die Angaben ändern sich einmal im Jahr, der Druck wird
// zwanzigmal am Tag geöffnet. `null` = noch nie geladen.
let _profilCache = null;
let _profilCacheOwner = null;

/** Nach dem Speichern der Rechnungsdaten aufrufen, sonst blockiert der Druck
 *  weiter mit dem alten Stand. */
export function abrechnungsprofilCacheLeeren() {
  _profilCache = null;
  _profilCacheOwner = null;
}

/**
 * Rechnungsrelevante Stammdaten der Praxis (nicht des angemeldeten Nutzers).
 * @returns {Promise<object|null>} `null`, wenn nicht ladbar — dann NICHT blockieren.
 */
export async function ladePraxisAbrechnungsProfil({ supabase, ownerId }) {
  if (!ownerId) return null;
  if (_profilCache && _profilCacheOwner === ownerId) return _profilCache;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('iban, bic, bank_name, steuernummer, ust_id')
      .eq('id', ownerId)
      .maybeSingle();
    if (error || !data) return null;
    _profilCache = data;
    _profilCacheOwner = ownerId;
    return data;
  } catch {
    return null;
  }
}

/** URL des Druckbelegs. Zwei Server-Routen, eine Stelle die sie kennt. */
export function belegDruckUrl({ api, rxId, typ, token, drucken = false }) {
  const tk = encodeURIComponent(token || '');
  if (typ === 'quittung_zuzahlung') {
    return `${api}/billing/prescription/${rxId}/zuzahlungsrechnung?token=${tk}${drucken ? '&print=1' : ''}`;
  }
  return `${api}/billing/prescription/${rxId}/rechnung?type=${encodeURIComponent(typ)}&token=${tk}${drucken ? '&print=1' : ''}`;
}

function hinweisHtml(fehlend) {
  return `
    <p style="margin:0 0 12px;color:var(--text-main);line-height:1.55;">
      Für eine Rechnung sind diese Angaben gesetzlich vorgeschrieben
      (§ 14 Abs. 4 UStG), fehlen aber in Ihren Rechnungsdaten:
    </p>
    <ul style="margin:0 0 14px;padding-left:20px;color:var(--text-main);">
      ${fehlend.map(f => `<li style="margin-bottom:4px;font-weight:600;">${f}</li>`).join('')}
    </ul>
    <p style="margin:0;font-size:13px;color:var(--text-sub,#94a3b8);line-height:1.5;">
      Quittungen ohne Rechnungscharakter sind davon nicht betroffen.
    </p>`;
}

/**
 * Öffnet den Druckbeleg — nach der Vorprüfung.
 *
 * @param {object} o
 * @param {string} o.rxId
 * @param {string} [o.typ='quittung_zuzahlung']  Belegart
 * @param {boolean} [o.drucken=false]            Druckdialog gleich mit öffnen
 * @param {boolean} [o.stillBeiFehler=false]     Popup-Blocker still hinnehmen
 * @param {object} deps
 * @param {object} deps.supabase
 * @param {string} deps.api
 * @param {string} deps.ownerId
 * @param {Function} deps.showHtmlModal
 * @param {Function} deps.showToast
 * @param {Function} deps.gehZuEinstellung   (sectionId, focusId) => void
 * @param {string} [deps.popupFehlerText]
 * @returns {Promise<boolean>} ob das Fenster aufging
 */
export async function oeffneBelegDruck(
  { rxId, typ = 'quittung_zuzahlung', drucken = false, stillBeiFehler = false },
  deps
) {
  const { supabase, api, ownerId, showHtmlModal, showToast, gehZuEinstellung, popupFehlerText } = deps;

  if (istRechnungsartig(typ)) {
    const profil = await ladePraxisAbrechnungsProfil({ supabase, ownerId });
    // Nur blockieren, wenn wir das Profil tatsächlich gesehen haben. Konnten
    // wir es nicht laden, entscheidet der Server — lieber ein Hinweis zu wenig
    // als ein Druck, der ohne Grund verweigert wird.
    if (profil) {
      const fehlend = fehlendePflichtangaben(profil);
      if (fehlend.length > 0) {
        showHtmlModal({
          title: 'Rechnung kann noch nicht gedruckt werden',
          html: hinweisHtml(fehlend),
          confirmText: 'Zu den Rechnungsdaten',
          onConfirm: () => { gehZuEinstellung('settingsBillingSection', 'setIban'); },
        });
        return false;
      }
    }
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const url = belegDruckUrl({ api, rxId, typ, token: session?.access_token, drucken });
    // Kein Zugriff auf das geöffnete Fenster: das Dokument liegt auf einer
    // anderen Domain, schon das Setzen von onload kann einen SecurityError
    // werfen. Gedruckt wird im geöffneten Tab.
    if (window.open(url, '_blank')) return true;
  } catch (e) {
    console.error('[beleg-druck]', e);
  }
  if (!stillBeiFehler) showToast(popupFehlerText || 'Popup wurde blockiert.', 'error');
  return false;
}
