import test from 'node:test';
import assert from 'node:assert/strict';
import { EINWILLIGUNG_TEXTE, renderEinwilligungText } from './einwilligung-texte.js';

const basis = { praxis_name: 'Praxis Nord', praxis_adresse: 'Weg 1, 53721 Siegburg', patient_name: 'A B', patient_geburtsdatum: '01.01.1970', datum: '06.10.2026', profile: {}, optionen: [] };
const ds = (extra = {}) => renderEinwilligungText('datenschutz', { ...basis, ...extra }).text;

test('Version erhöht: v3 (der Text wurde inhaltlich geändert, der Hash dient als Nachweis)', () => {
  assert.equal(EINWILLIGUNG_TEXTE.datenschutz.version, 'datenschutz-v3-2026-10-06');
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
  assert.match(t, /InfinityMade/);
  assert.match(t, /Weisung der Praxis als Auftragsverarbeiter \(Art\. 28 DSGVO\)/);
  assert.doesNotMatch(t, /§ 203|Server in Deutschland|\[saas_hosting_satz\]/);
});

test('Standard ist SaaS (bisheriges Verhalten), unbekannter Betrieb ebenso', () => {
  assert.match(ds({}), /InfinityMade/);
  assert.match(ds({ betrieb: 'quatsch' }), /InfinityMade/);
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
