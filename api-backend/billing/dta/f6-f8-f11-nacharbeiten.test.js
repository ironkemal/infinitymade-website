// Tests für die Nacharbeiten zu F6 (bundeslandVkg), F11 (druckbare Umschlag-Übersichtsliste)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { bundeslandVkgFuerPlz, BUNDESLAND_ZU_VKG } from '../codes/plz-bundesland.js';
import { waehleAnnahmestelle } from '../kostentraeger/annahmestelle.js';
import { renderBegleitzettelBundle, renderUmschlagListe } from '../pdf/begleitzettel.template.js';

describe('F6: bundeslandVkgFuerPlz & waehleAnnahmestelle', () => {
  it('mappt eindeutige deutsche PLZ auf amtliche 2-stellige VKG-Bundeslandschlüssel (Anhang 3 § 8.4)', () => {
    assert.equal(bundeslandVkgFuerPlz('53721'), '05'); // Siegburg → NW = 05
    assert.equal(bundeslandVkgFuerPlz('80331'), '09'); // München → BY = 09
    assert.equal(bundeslandVkgFuerPlz('10115'), '11'); // Berlin → BE = 11
    assert.equal(bundeslandVkgFuerPlz('70173'), '08'); // Stuttgart → BW = 08
    assert.equal(bundeslandVkgFuerPlz('00000'), null); // unbekannt → kein geratener Default
    assert.equal(Object.keys(BUNDESLAND_ZU_VKG).length, 16);
  });

  it('löst landesspezifische Datenannahmestelle (z. B. AOK 105810615) mit bundeslandVkg auf', () => {
    const zeilen = [
      { partner_ik: '105810615', verknuepfungsart: '03', abrechnungscode: '71', art_datenlieferung: '07', bundesland: '05', quelle: 'AO05Q426_KE0.txt' },
      { partner_ik: '108018007', verknuepfungsart: '03', abrechnungscode: '71', art_datenlieferung: '07', bundesland: '08', quelle: 'AO05Q426_KE0.txt' },
    ];
    assert.equal(waehleAnnahmestelle(zeilen, { ketten: [['71']], bundeslandVkg: null }), null);
    const nw = waehleAnnahmestelle(zeilen, { ketten: [['71']], bundeslandVkg: '05' });
    assert.equal(nw?.partnerIk, '105810615');
    const bw = waehleAnnahmestelle(zeilen, { ketten: [['71']], bundeslandVkg: '08' });
    assert.equal(bw?.partnerIk, '108018007');
  });
});

describe('F11: Druckbare Umschlag-Übersichtsliste im Begleitzettel-Bundle', () => {
  const sampleBlaetter = [
    {
      praxis: { name: 'Praxis Test', ik: '590537440' },
      papierannahmestelle: { ik: '107436557', name: 'AZE Emmendingen', anschrift: null },
      abrechnung: { dateiname: 'TSOL0001', rechnungsnummer: 'R2026-W48-001:1', krankenkasse_ik: '108035612', krankenkasse_name: 'mhplus BKK' },
      belege: [{ belegnummer: '0000001', patient_nachname: 'Probe', patient_vorname: 'Anna', brutto: 100, zuzahlung: 10, netto: 90 }],
    },
    {
      praxis: { name: 'Praxis Test', ik: '590537440' },
      papierannahmestelle: { ik: '660510336', name: 'DDG Essen', anschrift: null },
      abrechnung: { dateiname: 'TSOL0001', rechnungsnummer: 'R2026-W48-001:2', krankenkasse_ik: '104940005', krankenkasse_name: 'BARMER' },
      belege: [{ belegnummer: '0000002', patient_nachname: 'Muster', patient_vorname: 'Bernd', brutto: 80, zuzahlung: 0, netto: 80 }],
    },
  ];

  it('rendert Umschlag-Übersicht mit Umschlag-Nr, Gesamtrechnung, Belegnummern, Einwurfeinschreiben & 9-Monate-Frist', () => {
    const html = renderBegleitzettelBundle({ blaetter: sampleBlaetter, dateiname: 'TSOL0001' });
    assert.ok(html.includes('Umschlag- &amp; Belegübersicht (Urbelege)'));
    assert.ok(html.includes('Umschlag 1 / 2'));
    assert.ok(html.includes('Umschlag 2 / 2'));
    assert.ok(html.includes('R2026-W48-001:1'));
    assert.ok(html.includes('0000001 (Probe, Anna)'));
    assert.ok(html.includes('Einwurfeinschreiben'));
    assert.ok(html.includes('9 Kalendermonate'));
    assert.equal(typeof renderUmschlagListe, 'function');
  });
});
