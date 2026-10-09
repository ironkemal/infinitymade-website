import test from 'node:test';
import assert from 'node:assert/strict';
import { EINWILLIGUNG_TEXTE, renderEinwilligungText, renderTerminDatenschutz } from './einwilligung-texte.js';

const basis = { praxis_name: 'Praxis Nord', praxis_adresse: 'Weg 1, 53721 Siegburg', patient_name: 'A B', patient_geburtsdatum: '01.01.1970', datum: '06.10.2026', profile: {}, optionen: [] };
const ds = (extra = {}) => renderEinwilligungText('datenschutz', { ...basis, ...extra }).text;

test('Version erhöht: v4 (Herstellername 09.10.) (der Text wurde inhaltlich geändert, der Hash dient als Nachweis)', () => {
  assert.equal(EINWILLIGUNG_TEXTE.datenschutz.version, 'datenschutz-v4-2026-10-09');
  assert.equal(EINWILLIGUNG_TEXTE.foto.version, 'foto-v2-2026-10-06');
});

test('Tippfehler „außchliesslich“ ist überall weg', () => {
  for (const typ of Object.keys(EINWILLIGUNG_TEXTE)) {
    assert.doesNotMatch(renderEinwilligungText(typ, basis).text, /außchliesslich/, typ);
  }
});

test('Kutu: Software läuft in der Praxis, Hersteller ohne Zugriff, keine „Server in Deutschland“', () => {
  const t = ds({ betrieb: 'kutu' });
  assert.match(t, /in den Räumen der Praxis betrieben/);
  assert.match(t, /Softwarehersteller hat darauf keinen Zugriff/);
  assert.doesNotMatch(t, /Server in Deutschland|Auftragsverarbeiter/);
});

test('SaaS: Anbieter als Auftragsverarbeiter nach Weisung, ohne ungeprüfte Zusätze (§-203-Halbsatz, Hosting-Ort)', () => {
  const t = ds({ betrieb: 'saas' });
  assert.match(t, /Yavuz Kemal Demir \(Siegburg\)/);
  assert.match(t, /Weisung der Praxis als Auftragsverarbeiter \(Art\. 28 DSGVO\)/);
  assert.doesNotMatch(t, /§ 203|Server in Deutschland|\[saas_hosting_satz\]/);
});

test('Standard ist SaaS (bisheriges Verhalten), unbekannter Betrieb ebenso', () => {
  assert.match(ds({}), /Yavuz Kemal Demir \(Siegburg\)/);
  assert.match(ds({ betrieb: 'quatsch' }), /Yavuz Kemal Demir \(Siegburg\)/);
});

test('Empfänger: Kasse, UV-Träger bei Unfall, Arzt, Steuerberater — und NICHT mehr „nicht an Dritte“', () => {
  const t = ds({});
  assert.match(t, /§ 302 SGB V/);
  assert.match(t, /Unfallversicherungsträger/);
  assert.match(t, /Steuerberater/);
  assert.match(t, /Andere Empfänger gibt es nur, wenn Sie eingewilligt haben oder ein Gesetz es vorschreibt/);
  assert.doesNotMatch(t, /nicht an Dritte weitergegeben/);
});

test('Pflicht zur Bereitstellung steht drin (Art. 13 Abs. 2 lit. e)', () => {
  assert.match(ds({}), /Pflicht zur Bereitstellung\n.*brauchen wir für Behandlung und Abrechnung/s);
});

test('Datenschutzbeauftragte: nur wenn benannt', () => {
  assert.doesNotMatch(ds({}), /Datenschutzbeauftragte/);
  assert.match(ds({ dsb_kontakt: 'dsb@praxis.de' }), /Datenschutzbeauftragte[^\n]*dsb@praxis\.de/);
});

test('KI-Absatz nur bei aktivem Modul; nennt Microsoft als Empfänger, „pseudonymisiert“, kein Mail-Entwurf, kein C5', () => {
  assert.doesNotMatch(ds({}), /Microsoft/);
  const t = ds({ kiAktiv: true });
  assert.match(t, /Microsoft Ireland Operations Ltd/);
  assert.match(t, /pseudonymisierte Strukturangaben/);
  assert.match(t, /Rechenzentrum in Schweden/);
  assert.doesNotMatch(t, /E-Mail-Entwürfe|Mail-Entwürfe|Terminbestätigung|C5/);
});

test('verbotene Formulierungen (legal-de 05.10.2026) kommen in keinem Text vor', () => {
  for (const typ of Object.keys(EINWILLIGUNG_TEXTE)) {
    const t = renderEinwilligungText(typ, { ...basis, kiAktiv: true, betrieb: 'kutu' }).text;
    assert.doesNotMatch(t, /anonymisiert|keine Patientendaten verlassen|keine Speicherung|Zero Data Retention/i, typ);
  }
});

test('Ungefüllte Platzhalter bleiben sichtbar [key] (nie stilles Weglassen) — außer den bedingten Blöcken', () => {
  const t = renderEinwilligungText('datenschutz', { optionen: [] }).text;
  assert.match(t, /\[praxis_name\]/);
  assert.doesNotMatch(t, /\[(software_satz|dsb_satz|ki_absatz|bereitstellung)\]/);
});

test('Steuerberater-Satz: Rechnungen ja, Befunde/Diagnosen nein, selbst zur Verschwiegenheit verpflichtet (legal-de 06.10.)', () => {
  const t = ds({});
  assert.match(t, /Rechnungen, jedoch ohne Befunde und Diagnosen/);
  assert.match(t, /Steuerberater, der ebenfalls zur Verschwiegenheit verpflichtet ist/);
  assert.doesNotMatch(t, /ohne Behandlungsinhalte/);
});

test('KI-Absatz: durchgängig Europäischer Wirtschaftsraum, nie „außerhalb der EU“', () => {
  const t = ds({ kiAktiv: true });
  assert.match(t, /Länder außerhalb des Europäischen Wirtschaftsraums ist nicht vorgesehen/);
  assert.doesNotMatch(t, /außerhalb der EU/);
});

test('Box + KI aktiv: Hersteller ist für die KI Auftragsverarbeiter; Box ohne KI und SaaS bekommen den Satz nicht', () => {
  assert.match(ds({ betrieb: 'kutu', kiAktiv: true }), /Nur für die optionale KI-Unterstützung \(siehe unten\) handelt der Softwarehersteller, Yavuz Kemal Demir \(Siegburg\), als Auftragsverarbeiter/);
  assert.doesNotMatch(ds({ betrieb: 'kutu' }), /Nur für die optionale KI-Unterstützung/);
  assert.doesNotMatch(ds({ betrieb: 'saas', kiAktiv: true }), /Nur für die optionale KI-Unterstützung \(siehe unten\) handelt/);
});

test('Kein „InfinityMade" mehr in Patiententexten (legal-de 09.10.)', () => {
  for (const b of ['saas', 'kutu']) assert.doesNotMatch(ds({ betrieb: b, kiAktiv: true }), /InfinityMade/);
});

test('Terminseite: Verantwortlicher, Rechtsgrundlagen, kein Platzhalter-Rest, keine Einwilligung', () => {
  const r = renderTerminDatenschutz({ praxis_name: 'Praxis Nord', inhaber_name: 'Eva Muster', praxis_anschrift: 'Weg 1, 53721 Siegburg' }, { betrieb: 'kutu' });
  const text = r.absaetze.map((a) => a.text).join('\n');
  assert.match(text, /^Verantwortlich für die Verarbeitung Ihrer Daten ist Praxis Nord, Inhaber\/in Eva Muster, Weg 1, 53721 Siegburg\.$/m);
  assert.match(text, /Art\. 6 Abs\. 1 lit\. b DSGVO/);
  assert.match(text, /§ 22 Abs\. 1 Nr\. 1 lit\. b BDSG/);
  assert.match(text, /keinen Zugriff/);
  assert.match(text, /der für die Praxis zuständigen Datenschutzaufsichtsbehörde/);
  assert.doesNotMatch(text, /\{\{|\[\w+\]|Widerruf|InfinityMade/);
});

test('Terminseite: Inhaber gleich Praxisname wird nicht doppelt genannt', () => {
  const r = renderTerminDatenschutz({ praxis_name: 'Eva Muster', inhaber_name: 'Eva Muster', praxis_anschrift: 'X' });
  assert.match(r.absaetze[0].text, /ist Eva Muster, X\./);
});
