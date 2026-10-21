// Serverseitige Regeln fuer Anfragen aus dem einbettbaren Widget (source === 'widget').
//
// Das Widget (widget/) und das Backend werden getrennt ausgeliefert und koennen keine Datei
// teilen. Die Listen unten sind deshalb Spiegel von module/anfrage-anliegen.js und
// widget/booking-widget.logic.js; widget/widget-listen-parity.test.js haelt sie gleich.
// Ein direkter POST darf die Client-Pruefung nicht umgehen (funktion-ustasi 11.10.2026).
//
// Der SERVER baut die Notiz aus festen Optionen — der Client schickt keinen fertigen Text.
// So landet nichts in booking_requests.notizen, was nicht aus dieser Liste oder aus den zwei
// freiwilligen, begrenzten Freitextfeldern stammt (legal-de 12.10.2026).

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;

export const ZAHLUNGSARTEN = ['gkv', 'pkv', 'selbstzahler', 'bg'];

// key -> { titel, zahlung }. Spiegel von ANLIEGEN in module/anfrage-anliegen.js.
export const ANLIEGEN = {
  rezept: { titel: 'Behandlung mit Rezept', zahlung: ['gkv', 'pkv', 'bg'] },
  nagelspange: { titel: 'Nagelspange', zahlung: ['gkv', 'pkv', 'selbstzahler'] },
  ohne_rezept: { titel: 'Ohne Rezept – Fußpflege / Beratung', zahlung: ['selbstzahler', 'pkv'] },
  unsicher: { titel: 'Etwas anderes oder ich bin unsicher', zahlung: ['gkv', 'pkv', 'selbstzahler', 'bg'] },
};
export const TAGE = { mo: 'Mo', di: 'Di', mi: 'Mi', do: 'Do', fr: 'Fr' };
export const TAGESZEITEN = {
  vormittag: 'Vormittag (8–12)',
  nachmittag: 'Nachmittag (12–16)',
  spaet: 'Später Nachmittag (ab 16 Uhr)',
};
export const DRINGLICHKEIT = { asap: 'So bald wie möglich', wochen: 'In 2 bis 3 Wochen', egal: 'Keine Eile' };
export const ERSTBESUCH = { ja: 'ja', nein: 'nein' };
export const MAX_MITTEILUNG = 140;
export const MAX_ANMERKUNG = 80;

function echtesDatum(s) {
  const m = ISO.exec(String(s || ''));
  if (!m) return null;
  const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (t.getUTCFullYear() !== +m[1] || t.getUTCMonth() !== +m[2] - 1 || t.getUTCDate() !== +m[3]) return null;
  return t;
}
const heuteBerlin = (now) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(now);
const nameOk = (w) => typeof w === 'string' && w.trim().length >= 2 && w.trim().length <= 60 && !/[<>\u0000-\u001f]/.test(w);

/** Freitext: Steuerzeichen/Zeilenumbrueche zu Leerzeichen, <> entfernt, getrimmt, gekuerzt. */
export function bereinigeFreitext(wert, max) {
  return String(wert ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/<[^>]*>/g, '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

const nurSchluessel = (arr, erlaubt) => Array.isArray(arr) && arr.every((k) => typeof k === 'string' && Object.hasOwn(erlaubt, k));
const einmalig = (arr) => new Set(arr).size === arr.length;

/** Gibt `null` (gueltig) oder eine deutsche Fehlermeldung zurueck. */
export function pruefeWidgetAnfrage(body, now = new Date()) {
  const p = body?.patient;
  if (!p || typeof p !== 'object') return 'Patientendaten unvollständig';
  if (!nameOk(p.vorname) || !nameOk(p.nachname)) return 'Bitte prüfen Sie Vor- und Nachnamen.';
  const geb = echtesDatum(p.geburtsdatum);
  if (!geb || p.geburtsdatum < '1900-01-01' || p.geburtsdatum > heuteBerlin(now)) return 'Bitte prüfen Sie das Geburtsdatum.';
  const email = typeof p.email === 'string' ? p.email.trim() : '';
  const telefon = typeof p.telefon === 'string' ? p.telefon.trim() : '';
  if (!email && !telefon) return 'Bitte geben Sie E-Mail oder Telefon an.';
  if (email && (email.length > 120 || !EMAIL.test(email))) return 'Bitte prüfen Sie die E-Mail-Adresse.';
  if (telefon) {
    const z = telefon.replace(/\D/g, '');
    if (!/^[0-9+()\/\-.\s]+$/.test(telefon) || z.length < 6 || z.length > 15) return 'Bitte prüfen Sie die Telefonnummer.';
  }

  if (!ZAHLUNGSARTEN.includes(body.payment_type)) return 'Bitte wählen Sie Ihre Versicherung.';

  const w = body.widget;
  if (!w || typeof w !== 'object') return 'Bitte machen Sie Angaben zu Ihrem Anliegen und Ihren Zeiten.';

  if (w.anliegen != null) {
    if (typeof w.anliegen !== 'string' || !Object.hasOwn(ANLIEGEN, w.anliegen)) return 'Bitte wählen Sie Ihr Anliegen.';
    if (!ANLIEGEN[w.anliegen].zahlung.includes(body.payment_type)) return 'Die gewählte Versicherung passt nicht zu Ihrem Anliegen.';
  }
  if (w.hausbesuch != null && typeof w.hausbesuch !== 'boolean') return 'Ungültige Anfrage';
  if (w.fuerAndere != null && typeof w.fuerAndere !== 'boolean') return 'Ungültige Anfrage';
  if (typeof w.flexibel !== 'boolean') return 'Bitte geben Sie an, wann Sie Zeit haben.';

  if (!w.flexibel) {
    if (!nurSchluessel(w.tage, TAGE) || !einmalig(w.tage) || w.tage.length === 0) return 'Bitte wählen Sie mindestens einen Wochentag.';
    if (!nurSchluessel(w.tageszeiten, TAGESZEITEN) || !einmalig(w.tageszeiten) || w.tageszeiten.length === 0) {
      return 'Bitte wählen Sie mindestens eine Tageszeit.';
    }
  } else if ((w.tage != null && !nurSchluessel(w.tage, TAGE)) || (w.tageszeiten != null && !nurSchluessel(w.tageszeiten, TAGESZEITEN))) {
    return 'Ungültige Anfrage';
  }

  if (w.dringlichkeit != null && !(typeof w.dringlichkeit === 'string' && Object.hasOwn(DRINGLICHKEIT, w.dringlichkeit))) return 'Ungültige Anfrage';
  if (w.erstbesuch != null && !(typeof w.erstbesuch === 'string' && Object.hasOwn(ERSTBESUCH, w.erstbesuch))) return 'Ungültige Anfrage';
  for (const f of ['mitteilung', 'anmerkung']) {
    if (w[f] != null && typeof w[f] !== 'string') return 'Ungültige Anfrage';
  }
  return null;
}

/**
 * Notiztext in FESTER Reihenfolge (gleich der Reihenfolge der Schritte im Widget). Passt
 * rechnerisch immer in 500 Zeichen: Kopf <= 95, Zeit <= 99, Wie bald <= 35, Schon da gewesen <= 22,
 * Mitteilung <= 153, Erreichbarkeit <= 96, fuenf Zeilenumbrueche.
 */
export function baueWidgetNotiz(w) {
  const zeilen = [];
  const a = w.anliegen ? ANLIEGEN[w.anliegen] : null;
  const kopf = [];
  if (a) kopf.push(`Anliegen: ${a.titel}`);
  if (w.hausbesuch === true) kopf.push('Hausbesuch');
  if (w.fuerAndere === true) kopf.push('für andere Person');
  if (kopf.length) zeilen.push(kopf.join(' — '));

  if (w.flexibel) {
    zeilen.push('Zeit: flexibel');
  } else {
    const tage = Object.keys(TAGE).filter((k) => w.tage.includes(k)).map((k) => TAGE[k]).join(', ');
    const zeiten = Object.keys(TAGESZEITEN).filter((k) => w.tageszeiten.includes(k)).map((k) => TAGESZEITEN[k]).join(', ');
    zeilen.push(`Zeit: ${tage} · ${zeiten}`);
  }
  if (w.dringlichkeit) zeilen.push(`Wie bald: ${DRINGLICHKEIT[w.dringlichkeit]}`);
  // Die Widget-Frage lautet „Waren Sie schon einmal bei uns?“ — „ja“ heisst BEKANNTER Patient, nicht Erstbesuch.
  if (w.erstbesuch) zeilen.push(`Schon da gewesen: ${ERSTBESUCH[w.erstbesuch]}`);
  const mitteilung = bereinigeFreitext(w.mitteilung, MAX_MITTEILUNG);
  if (mitteilung) zeilen.push(`Mitteilung: ${mitteilung}`);
  const anmerkung = bereinigeFreitext(w.anmerkung, MAX_ANMERKUNG);
  if (anmerkung) zeilen.push(`Erreichbarkeit: ${anmerkung}`);
  return zeilen.join('\n').slice(0, 500);
}

/**
 * Fuer jede anonyme create-Anfrage (nicht nur Widget): Namen ohne Markup/Steuerzeichen und
 * genau EINE E-Mail-Adresse (Komma-Listen wuerden an mehrere Empfaenger gehen, S-56).
 * Gibt `null` oder eine Fehlermeldung zurueck. Ohne `patient` (Bestandspatient) nichts zu pruefen.
 */
export function pruefeOeffentlichePatientAngaben(patient) {
  if (!patient || typeof patient !== 'object') return null;
  for (const feld of ['vorname', 'nachname']) {
    const w = patient[feld];
    if (w != null && (typeof w !== 'string' || /[<>\u0000-\u001f]/.test(w) || w.length > 120)) {
      return 'Bitte prüfen Sie Vor- und Nachnamen.';
    }
  }
  const mail = patient.email;
  if (mail != null && mail !== '') {
    if (typeof mail !== 'string' || mail.length > 120 || !EMAIL.test(mail.trim())) return 'Bitte prüfen Sie die E-Mail-Adresse.';
  }
  const tel = patient.telefon;
  if (tel != null && (typeof tel !== 'string' || tel.length > 40)) return 'Bitte prüfen Sie die Telefonnummer.';
  return null;
}
