/**
 * physio-befund.test.js — Tests fuer reine Funktionen des Physio-Befund UI-Moduls.
 *
 * Testet schrittWert, naechsterTestWert, befundListenZeile und escapeHtml.
 * Keine DOM-Abhaengigkeiten, keine Netzwerkaufrufe.
 */

import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  escapeHtml,
  schrittWert,
  naechsterTestWert,
  befundListenZeile,
} from './physio-befund.js';

describe('1. schrittWert (ROM-5-Grad-Stepper)', () => {
  it('erhoeht und verringert Werte um 5 Grad', () => {
    assert.equal(schrittWert(40, 5, 0, 360), 45);
    assert.equal(schrittWert(45, -5, 0, 360), 40);
    assert.equal(schrittWert('30', 5, 0, 360), 35);
  });

  it('begrenzt Werte auf min und max', () => {
    assert.equal(schrittWert(0, -5, 0, 360), 0);
    assert.equal(schrittWert(360, 5, 0, 360), 360);
    assert.equal(schrittWert(175, 10, 0, 180), 180);
    assert.equal(schrittWert(2, -5, 0, 180), 0);
  });

  it('behandelt null, undefined, Leerstring und NaN sicher', () => {
    assert.equal(schrittWert(null, 5, 0, 360), 5);
    assert.equal(schrittWert(undefined, 5, 0, 360), 5);
    assert.equal(schrittWert('', 5, 0, 360), 5);
    assert.equal(schrittWert('ungueltig', 5, 0, 360), 5);
    assert.equal(schrittWert(null, -5, 0, 360), 0);
  });
});

describe('2. naechsterTestWert (Dreifach-Schalter fuer klinische Tests)', () => {
  it('durchlaeuft den Zyklus: nicht -> plus -> minus -> nicht', () => {
    assert.equal(naechsterTestWert('nicht'), 'plus');
    assert.equal(naechsterTestWert('plus'), 'minus');
    assert.equal(naechsterTestWert('minus'), 'nicht');
  });

  it('startet bei null oder undefined mit "plus"', () => {
    assert.equal(naechsterTestWert(null), 'plus');
    assert.equal(naechsterTestWert(undefined), 'plus');
    assert.equal(naechsterTestWert(''), 'plus');
  });
});

describe('3. befundListenZeile (Zusammenfassung fuer Listenanzeige)', () => {
  it('formatiert Erstbefund mit Datum, Regionen und NRS', () => {
    const befund = {
      befundart: 'erst',
      befund_datum: '2026-11-01',
      daten: {
        bericht: {
          regionen: ['HWS', 'Schulter'],
        },
      },
      kurzNrs: 6,
    };

    const res = befundListenZeile(befund);
    assert.equal(res.artLabel, 'Erstbefund');
    assert.equal(res.datumStr, '01.11.2026');
    assert.equal(res.regionenStr, 'HWS, Schulter');
    assert.equal(res.nrsStr, 'NRS 6');
    assert.equal(res.text, 'Erstbefund · 01.11.2026 · HWS, Schulter · NRS 6');
  });

  it('liest Regionen aus daten.regionen falls daten.bericht.regionen fehlt', () => {
    const befund = {
      befundart: 'zwischen',
      befund_datum: '2026-11-15',
      daten: {
        regionen: {
          Knie: {},
          OSG: {},
        },
      },
      nrs: 3,
    };

    const res = befundListenZeile(befund);
    assert.equal(res.artLabel, 'Zwischenbefund');
    assert.equal(res.datumStr, '15.11.2026');
    assert.ok(res.regionenStr.includes('Knie'));
    assert.ok(res.regionenStr.includes('OSG/Fuß'));
    assert.equal(res.nrsStr, 'NRS 3');
  });

  it('ermittelt NRS aus messungen-Array wenn kurzNrs nicht direkt gesetzt ist', () => {
    const befund = {
      befundart: 'abschluss',
      befund_datum: '2026-12-01',
      daten: {
        bericht: {
          regionen: ['LWS'],
        },
      },
      messungen: [
        { typ: 'ROM', wert: 40 },
        { typ: 'VAS', wert: 1 },
      ],
    };

    const res = befundListenZeile(befund);
    assert.equal(res.artLabel, 'Abschlussbefund');
    assert.equal(res.nrsStr, 'NRS 1');
    assert.equal(res.text, 'Abschlussbefund · 01.12.2026 · LWS · NRS 1');
  });

  it('behandelt leere oder ungueltige Befundobjekte robust', () => {
    assert.deepEqual(befundListenZeile(null), {
      artLabel: 'Befund',
      datumStr: '—',
      regionenStr: '',
      nrsStr: '',
      text: 'Befund',
    });

    const resLeer = befundListenZeile({});
    assert.equal(resLeer.artLabel, 'Befund');
    assert.equal(resLeer.datumStr, '—');
    assert.equal(resLeer.regionenStr, '');
    assert.equal(resLeer.nrsStr, '');
  });
});

describe('4. escapeHtml', () => {
  it('escaped Sonderzeichen HTML-sicher', () => {
    assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    assert.equal(escapeHtml("Tom & Jerry's"), 'Tom &amp; Jerry&#39;s');
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
  });
});
