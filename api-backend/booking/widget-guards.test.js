import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pruefeWidgetAnfrage, pruefeOeffentlichePatientAngaben, baueWidgetNotiz, bereinigeFreitext,
  TAGE, TAGESZEITEN, ANLIEGEN, MAX_MITTEILUNG, MAX_ANMERKUNG,
} from './widget-guards.js';

const JETZT = new Date('2026-10-12T10:00:00Z');
const gut = () => ({
  payment_type: 'gkv',
  patient: { vorname: 'Erika', nachname: 'Musterfrau', geburtsdatum: '1975-04-12', telefon: '0151 1234567' },
  widget: { anliegen: 'rezept', hausbesuch: false, flexibel: false, tage: ['mo', 'mi'], tageszeiten: ['vormittag'],
    dringlichkeit: 'wochen', erstbesuch: 'ja', mitteilung: 'eingewachsener Nagel', anmerkung: 'ab 16 Uhr' },
});

test('gueltige Widget-Anfrage', () => assert.equal(pruefeWidgetAnfrage(gut(), JETZT), null));

test('jede Regel greift auch ohne Client', () => {
  const faelle = [
    [(b) => { b.patient.vorname = '<b>'; }, /Nachnamen/],
    [(b) => { b.patient.geburtsdatum = '2999-01-01'; }, /Geburtsdatum/],
    [(b) => { b.patient.geburtsdatum = '1981-02-29'; }, /Geburtsdatum/],
    [(b) => { delete b.patient.telefon; }, /E-Mail oder Telefon/],
    [(b) => { b.patient.email = 'kaputt'; }, /E-Mail/],
    [(b) => { b.patient.telefon = 'abc'; }, /Telefon/],
    [(b) => { b.payment_type = 'bar'; }, /Versicherung/],
    [(b) => { b.widget.anliegen = 'hacken'; }, /Anliegen/],
    [(b) => { b.widget.anliegen = 'ohne_rezept'; b.payment_type = 'gkv'; }, /passt nicht/],
    [(b) => { b.widget.tage = []; }, /Wochentag/],
    [(b) => { b.widget.tage = ['sa']; }, /Wochentag/],
    [(b) => { b.widget.tage = ['mo', 'mo']; }, /Wochentag/],
    [(b) => { b.widget.tageszeiten = []; }, /Tageszeit/],
    [(b) => { b.widget.tageszeiten = ['nachts']; }, /Tageszeit/],
    [(b) => { delete b.widget.flexibel; }, /Zeit/],
    [(b) => { b.widget.dringlichkeit = 'gestern'; }, /Ungültig/],
    [(b) => { b.widget.erstbesuch = 'vielleicht'; }, /Ungültig/],
    [(b) => { b.widget.mitteilung = { a: 1 }; }, /Ungültig/],
    [(b) => { delete b.widget; }, /Anliegen/],
    [(b) => { delete b.patient; }, /unvollständig/],
  ];
  for (const [mutiere, muster] of faelle) {
    const b = gut();
    mutiere(b);
    assert.match(pruefeWidgetAnfrage(b, JETZT) || '', muster, String(mutiere));
  }
});

test('flexibel braucht keine Tage/Zeiten; ohne Anliegen (andere Fachbereiche) gueltig', () => {
  const b = gut();
  b.widget = { flexibel: true };
  assert.equal(pruefeWidgetAnfrage(b, JETZT), null);
  b.widget = { anliegen: null, flexibel: false, tage: ['di'], tageszeiten: ['spaet'] };
  assert.equal(pruefeWidgetAnfrage(b, JETZT), null);
});

test('Notiz: feste Reihenfolge und Wortlaut', () => {
  assert.equal(baueWidgetNotiz(gut().widget),
    'Anliegen: Behandlung mit Rezept\nZeit: Mo, Mi · Vormittag (8–12)\nWie bald: In 2 bis 3 Wochen\nSchon da gewesen: ja\nMitteilung: eingewachsener Nagel\nErreichbarkeit: ab 16 Uhr');
  assert.equal(baueWidgetNotiz({ anliegen: 'nagelspange', hausbesuch: true, flexibel: true }),
    'Anliegen: Nagelspange — Hausbesuch\nZeit: flexibel');
  assert.equal(baueWidgetNotiz({ anliegen: null, fuerAndere: true, flexibel: true }), 'für andere Person\nZeit: flexibel');
});

test('Notiz passt im Hoechstfall in 500 Zeichen und enthaelt kein Markup', () => {
  const max = {
    anliegen: 'ohne_rezept', hausbesuch: true, fuerAndere: true, flexibel: false,
    tage: Object.keys(TAGE), tageszeiten: Object.keys(TAGESZEITEN),
    dringlichkeit: 'asap', erstbesuch: 'nein',
    mitteilung: '<b>x</b>'.repeat(60), anmerkung: 'y\n'.repeat(60),
  };
  const n = baueWidgetNotiz(max);
  assert.ok(n.length <= 500, String(n.length));
  assert.ok(!/[<>]/.test(n));
  assert.ok(n.includes('Erreichbarkeit:'));
  assert.ok(n.split('\n').every((z) => !/\r/.test(z)));
  assert.equal(bereinigeFreitext('a\r\nb\t<c>d', 50), 'a b d');
  assert.ok(MAX_MITTEILUNG + MAX_ANMERKUNG < 500);
  assert.ok(Object.keys(ANLIEGEN).length === 4);
});

test('oeffentliche Patientenangaben: Markup, Steuerzeichen und Mehrfach-Adressen abgelehnt (S-56)', () => {
  assert.equal(pruefeOeffentlichePatientAngaben(undefined), null);
  assert.equal(pruefeOeffentlichePatientAngaben({ vorname: "O'Brien", nachname: 'Müller-Lüdenscheidt', email: 'a@b.de' }), null);
  assert.notEqual(pruefeOeffentlichePatientAngaben({ vorname: '<b>x</b>', nachname: 'M' }), null);
  assert.notEqual(pruefeOeffentlichePatientAngaben({ vorname: 'A', nachname: 'M\nBcc: x' }), null);
  assert.notEqual(pruefeOeffentlichePatientAngaben({ vorname: 'A', nachname: 'M', email: 'a@x.de, b@y.de' }), null);
  assert.notEqual(pruefeOeffentlichePatientAngaben({ vorname: 'A', nachname: 'M', email: { a: 1 } }), null);
});
