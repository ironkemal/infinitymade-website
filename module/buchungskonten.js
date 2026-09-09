/**
 * buchungskonten.js — der Kontenrahmen einer Praxis (SKR-Gegenkonten).
 *
 * Wofür
 * ─────
 * Beim Verbuchen eines Zahlungseingangs wird ausgewählt, WOHIN das Geld
 * geflossen ist: 1000 Kasse, 1200 Bank, 8700 Erlösschmälerung … Das ist die
 * Angabe, die der Steuerberater braucht und die einen späteren DATEV-Export
 * überhaupt erst möglich macht.
 *
 * Warum jsonb in `profiles` und keine eigene Tabelle
 * ─────────────────────────────────────────────────
 * Entscheidung von `db-ustasi` (07.09.2026), gleiches Muster wie
 * `profiles.selbstzahler_stufen` und `profiles.fussbefund_legende`: eine
 * owner-gepflegte, kurze, benannte Liste. Eine eigene Tabelle hätte Seeding per
 * Trigger, eine neue RLS-Fläche und einen Backfill gebraucht — für sechs
 * Zeilen. Owner-Einstellungen gehören ausserdem nach `profiles`, nicht nach
 * `businesses`: Einzelpraxen haben dort gar keine Zeile.
 *
 * ⚠️ Eine gebuchte Zahlung referenziert NICHT hierher.
 * ─────────────────────────────────────────────────
 * `rechnung_zahlungen` speichert `gegenkonto_code` + `gegenkonto_label` als
 * SNAPSHOT. Benennt der Owner „1200 Bank" später in „1200 Sparkasse" um, muss
 * eine Buchung von 2026 weiter das drucken, was damals gebucht wurde
 * (§ 146 Abs. 4 AO, GoBD Rz. 107 — dieselbe Begründung wie bei
 * `invoices.steuernummer_snapshot`). Deshalb gibt es hier keine Ids: der `code`
 * ist der Schlüssel, und was gebucht wurde, wird kopiert, nicht verlinkt.
 */

/**
 * Der Rahmen, mit dem jede Praxis startet, solange sie nichts eigenes pflegt.
 * Entnommen der Praxware-Demo (05.09.2026) plus die zwei Konten, die beim
 * Ausbuchen eines Restbetrags gebraucht werden.
 *
 * SKR03/SKR04 unterscheiden sich in der Nummerierung; das hier sind
 * SKR03-Nummern. Wer einen anderen Rahmen führt, benennt sie um — genau dafür
 * ist die Liste editierbar.
 */
export const STANDARD_KONTEN = Object.freeze([
  { code: '1000', label: 'Kasse',                        aktiv: true, kategorie: 'bar' },
  { code: '1100', label: 'Postbank',                     aktiv: true, kategorie: 'ueberweisung' },
  { code: '1200', label: 'Bank',                         aktiv: true, kategorie: 'ueberweisung' },
  { code: '1210', label: 'Bank 2',                       aktiv: true, kategorie: 'ueberweisung' },
  { code: '1220', label: 'Kartenzahlungen (EC/Kredit)',  aktiv: true, kategorie: 'karte' },
  { code: '1250', label: 'PayPal',                       aktiv: true, kategorie: 'paypal' },
  { code: '8700', label: 'Erlösschmälerung',             aktiv: true, kategorie: 'sonstiges' },
  { code: '4900', label: 'Teilabsetzung',                aktiv: true, kategorie: 'sonstiges' },
]);

/** Das Konto, auf das ein Restbetrag ausgebucht wird, wenn nichts anderes gewählt ist. */
export const AUSBUCHUNGSKONTO_STANDARD = '8700';

/** Bar — das einzige Konto, das zusätzlich einen Kassenbuch-Beleg erzeugt. */
export const KASSENKONTO = '1000';

/** Mehr als 30 Konten sind kein Praxis-Kontenrahmen mehr. */
export const KONTEN_MAX = 30;

const CODE_MAX = 10;
const LABEL_MAX = 40;

/**
 * Die Kategorie eines Kontos entscheidet, welche `zahlart` eine Buchung auf
 * diesem Konto in `belegliste` bekommt (Ops #271, 08.09.2026). Der `code`
 * bleibt der GoBD-Snapshot-Schlüssel (§ 146 Abs. 4 AO) — `kategorie` ist reine
 * Klassifikation für die automatische Belegbuchung, kein Ersatz dafür.
 */
export const KONTO_KATEGORIEN = Object.freeze(['bar', 'karte', 'ueberweisung', 'paypal', 'sonstiges']);

/**
 * Kategorie → `belegliste.zahlart`. Einzige Stelle, die die Brücke zum
 * bestehenden Zahlart-Vokabular kennt (`bar|ec|ueberweisung|sonstiges|paypal`,
 * `api-backend/billing/belegliste/helper.js:9`). Nur `karte` weicht vom
 * eigenen Namen ab — der historische Wert dafür heißt `ec`.
 */
export const ZAHLART_JE_KATEGORIE = Object.freeze({
  bar: 'bar',
  karte: 'ec',
  ueberweisung: 'ueberweisung',
  paypal: 'paypal',
  sonstiges: 'sonstiges',
});

/**
 * Zahlungskonten (Bar/Karte/Überweisung/PayPal) vs. reine Ausbuchungskonten
 * (Erlösschmälerung, Teilabsetzung — nie ein Zahlungsziel). Trennt im
 * Zahlungseingangs-Dialog das Gegenkonto-Feld vom Ausbuchungs-Feld
 * (Ops #271): Ersteres zeigt nur Zahlungskonten, Letzteres alle aktiven.
 */
export function istZahlungskategorie(kategorie) {
  return kategorie === 'bar' || kategorie === 'karte'
    || kategorie === 'ueberweisung' || kategorie === 'paypal';
}

/**
 * Bringt die rohe jsonb-Spalte in eine Form, auf die sich die Oberfläche
 * verlassen kann. Defensiv, weil die Spalte per Hand in der DB stehen kann.
 *
 * Verworfen wird, was unbrauchbar ist: ohne Code oder ohne Bezeichnung ist ein
 * Konto nicht buchbar. Doppelte Codes fliegen raus statt zusammengeführt zu
 * werden — der Code ist der Schlüssel, zwei Zeilen mit „1200" wären beim
 * Buchen nicht auseinanderzuhalten. Der erste gewinnt.
 *
 * Gibt bewusst `[]` zurück, wenn nichts Brauchbares übrig ist. Den Rückfall auf
 * `STANDARD_KONTEN` macht `kontenAusProfil()` — so kann die Speicherfunktion
 * unterscheiden zwischen „Owner hat nichts gepflegt" und „Owner hat Unsinn
 * eingegeben".
 */
export function normalisiereKonten(roh) {
  if (!Array.isArray(roh)) return [];
  const gesehen = new Set();
  const raus = [];
  for (const e of roh) {
    if (!e || typeof e !== 'object') continue;
    // Leerzeichen raus, nicht nur aussen: „12 00" wäre keine Kontonummer.
    const code = String(e.code ?? '').replace(/\s+/g, '').slice(0, CODE_MAX);
    const label = String(e.label ?? '').trim().slice(0, LABEL_MAX);
    if (!code || !label) continue;
    if (gesehen.has(code)) continue;
    gesehen.add(code);
    // Unbekannt oder fehlend -> 'sonstiges': ein per Hand in der DB gepflegtes
    // Altkonto ohne Kategorie soll weiterhin buchbar sein, nur eben nicht als
    // eigene Zahlungsart im Journal erscheinen (Ops #271, 08.09.2026).
    const kategorie = KONTO_KATEGORIEN.includes(e.kategorie) ? e.kategorie : 'sonstiges';
    raus.push({ code, label, aktiv: e.aktiv !== false, kategorie });
    if (raus.length >= KONTEN_MAX) break;
  }
  return raus;
}

/**
 * Der Kontenrahmen eines Profils. Leer gepflegt = Standardrahmen, damit beim
 * ersten Zahlungseingang etwas zur Auswahl steht und niemand erst eine
 * Einstellungsseite suchen muss.
 */
export function kontenAusProfil(profile) {
  const eigene = normalisiereKonten(profile?.buchungskonten);
  return eigene.length ? eigene : STANDARD_KONTEN.map(k => ({ ...k }));
}

/** Nur die Konten, die in einem Auswahlfeld erscheinen sollen. */
export function aktiveKonten(profile) {
  return kontenAusProfil(profile).filter(k => k.aktiv);
}

/**
 * Sucht ein Konto über seinen Code. Deaktivierte werden mitgefunden: eine alte
 * Buchung darf ihr Konto weiter anzeigen, auch wenn es nicht mehr angeboten wird.
 */
export function findeKonto(profile, code) {
  const gesucht = String(code ?? '').replace(/\s+/g, '');
  if (!gesucht) return null;
  return kontenAusProfil(profile).find(k => k.code === gesucht) || null;
}

/** Anzeigeform „1000 Kasse". Code und Bezeichnung bleiben getrennt gespeichert. */
export function kontoAnzeige(konto) {
  if (!konto) return '';
  return `${konto.code} ${konto.label}`.trim();
}

// ── Einstellungen ───────────────────────────────────────────────────────────
//
// Der Entwurf ist eine Kopie: solange nicht gespeichert wurde, darf ein offener
// Zahlungsdialog nichts von der Bearbeitung mitbekommen.

let kontenEntwurf = [];

export async function renderKontenSettings(deps) {
  const section = document.getElementById('settingsKontenSection');
  if (!section) return;

  const zeigen = deps.profile?.role === 'owner';
  section.hidden = !zeigen;
  if (!zeigen) return;

  const ownerId = deps.ownerId();
  let gespeichert = kontenAusProfil(deps.profile);
  if (ownerId) {
    const { data } = await deps.supabase
      .from('profiles').select('buchungskonten').eq('id', ownerId).maybeSingle();
    if (data) {
      const eigene = normalisiereKonten(data.buchungskonten);
      gespeichert = eigene.length ? eigene : STANDARD_KONTEN.map(k => ({ ...k }));
    }
  }
  kontenEntwurf = gespeichert.map(k => ({ ...k }));
  zeichneKontenListe(deps);

  if (section.dataset.wired) return;
  section.dataset.wired = '1';

  document.getElementById('setKontenAddBtn')?.addEventListener('click', () => {
    if (kontenEntwurf.length >= KONTEN_MAX) {
      deps.showToast(`Mehr als ${KONTEN_MAX} Konten werden unübersichtlich.`, 'error');
      return;
    }
    kontenEntwurf.push({ code: '', label: '', aktiv: true });
    zeichneKontenListe(deps);
    const codes = document.querySelectorAll('#setKontenList .konto-code');
    codes[codes.length - 1]?.focus();
  });

  document.getElementById('setKontenSaveBtn')?.addEventListener('click', () => speichereKonten(deps));
}

function zeichneKontenListe(deps) {
  const wrap = document.getElementById('setKontenList');
  if (!wrap) return;
  wrap.innerHTML = '';

  if (!kontenEntwurf.length) {
    const leer = document.createElement('p');
    leer.style.cssText = 'margin:0 0 4px;font-size:13px;color:var(--text-muted);';
    leer.textContent = 'Kein Konto angelegt — beim Speichern gilt wieder der Standardrahmen.';
    wrap.appendChild(leer);
    return;
  }

  kontenEntwurf.forEach((konto, i) => {
    const zeile = document.createElement('div');
    zeile.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:6px;';

    const code = document.createElement('input');
    code.type = 'text';
    code.className = 'konto-code';
    code.value = konto.code;
    code.placeholder = '1200';
    code.maxLength = CODE_MAX;
    code.style.cssText = 'width:90px;';
    code.addEventListener('input', () => { kontenEntwurf[i].code = code.value; });

    const label = document.createElement('input');
    label.type = 'text';
    label.className = 'konto-label';
    label.value = konto.label;
    label.placeholder = 'Bank';
    label.maxLength = LABEL_MAX;
    label.style.cssText = 'flex:1;';
    label.addEventListener('input', () => { kontenEntwurf[i].label = label.value; });

    // Entscheidet, ob und als welche Zahlart eine Buchung auf diesem Konto
    // automatisch einen Beleg im Journal erzeugt (Ops #271, 08.09.2026).
    const kategorieLabel = {
      bar: 'Bar', karte: 'Karte', ueberweisung: 'Überweisung',
      paypal: 'PayPal', sonstiges: 'Sonstiges (kein Zahlungskonto)',
    };
    const kategorie = document.createElement('select');
    kategorie.className = 'konto-kategorie';
    kategorie.style.cssText = 'width:170px;';
    kategorie.innerHTML = KONTO_KATEGORIEN
      .map(k => `<option value="${k}">${kategorieLabel[k]}</option>`).join('');
    kategorie.value = KONTO_KATEGORIEN.includes(konto.kategorie) ? konto.kategorie : 'sonstiges';
    kategorie.addEventListener('change', () => { kontenEntwurf[i].kategorie = kategorie.value; });

    const aktivWrap = document.createElement('label');
    aktivWrap.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:13px;white-space:nowrap;';
    const aktiv = document.createElement('input');
    aktiv.type = 'checkbox';
    aktiv.checked = konto.aktiv !== false;
    aktiv.addEventListener('change', () => { kontenEntwurf[i].aktiv = aktiv.checked; });
    aktivWrap.appendChild(aktiv);
    aktivWrap.appendChild(document.createTextNode('aktiv'));

    // Löschen statt Deaktivieren nur für Konten, auf die noch nichts gebucht
    // sein kann — das weiss die Oberfläche nicht. Deshalb ist „aktiv" der
    // normale Weg und Entfernen die Ausnahme.
    const weg = document.createElement('button');
    weg.type = 'button';
    weg.className = 'btn-ghost btn-sm';
    weg.textContent = '×';
    weg.title = 'Konto entfernen';
    weg.addEventListener('click', () => {
      kontenEntwurf.splice(i, 1);
      zeichneKontenListe(deps);
    });

    zeile.append(code, label, kategorie, aktivWrap, weg);
    wrap.appendChild(zeile);
  });
}

async function speichereKonten(deps) {
  const btn = document.getElementById('setKontenSaveBtn');
  const sauber = normalisiereKonten(kontenEntwurf);

  // Halb ausgefüllte oder doppelte Zeilen still zu verschlucken wäre schlimmer
  // als eine Fehlermeldung — der Owner glaubt sonst, das Konto sei angelegt.
  if (kontenEntwurf.length && sauber.length !== kontenEntwurf.length) {
    deps.showToast('Jedes Konto braucht eine eindeutige Nummer und eine Bezeichnung.', 'error');
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  const { error } = await deps.supabase
    .from('profiles')
    .update({ buchungskonten: sauber })
    .eq('id', deps.ownerId());
  if (btn) { btn.disabled = false; btn.textContent = 'Speichern'; }

  if (error) {
    console.error('[buchungskonten] speichern:', error.message);
    deps.showToast('Fehler beim Speichern: ' + error.message, 'error');
    return;
  }

  // Lokalen Profil-Cache nachziehen, damit der Zahlungsdialog die neuen Konten
  // sofort anbietet — ohne Neuladen der Seite.
  if (deps.profile) deps.profile.buchungskonten = sauber;
  kontenEntwurf = kontenAusProfil({ buchungskonten: sauber }).map(k => ({ ...k }));
  zeichneKontenListe(deps);
  deps.showToast('Buchungskonten gespeichert ✓');
}
