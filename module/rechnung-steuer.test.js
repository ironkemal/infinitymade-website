/**
 * Tests für rechnung-steuer.js — die Steuerrechnung auf der Patientenrechnung.
 *
 * Ausführen: node module/rechnung-steuer.test.js
 *
 * Hier wird Geld gerechnet, das später in einer Betriebsprüfung liegt. Die
 * Fälle unten sind genau die, an denen eine gemischte Rechnung schiefgeht.
 */
import {
  berechneSteuer, steuerhinweisText, istKleinunternehmer,
  leistungsartVorschlag, zeilenSteuerVon, leistungszeitraum,
  TAX_EXEMPT_OPTIONS,
} from './rechnung-steuer.js';

let fehler = 0;
function pruefe(name, ist, soll) {
  const a = JSON.stringify(ist), b = JSON.stringify(soll);
  if (a === b) { console.log(`  ✓ ${name}`); }
  else { console.error(`  ✗ ${name}\n      erwartet: ${b}\n      bekommen: ${a}`); fehler++; }
}

console.log('\nberechneSteuer — reine Heilbehandlung (steuerfrei)');
{
  const r = berechneSteuer([{ quantity: 3, unit_price: 28.50, ust_satz: 0, ust_grund: '4_14a' }], 'regel');
  pruefe('brutto = netto, keine Steuer', [r.netto, r.steuer, r.brutto], [85.5, 0, 85.5]);
  pruefe('eine Gruppe', r.tax_summary.length, 1);
}

console.log('\nberechneSteuer — reine Kosmetik (19 %, Preis ist brutto)');
{
  const r = berechneSteuer([{ quantity: 1, unit_price: 35.00, ust_satz: 19 }], 'regel');
  // 35,00 brutto → 29,41 netto + 5,59 USt
  pruefe('netto herausgerechnet', [r.netto, r.steuer, r.brutto], [29.41, 5.59, 35]);
}

console.log('\nberechneSteuer — gemischte Rechnung (§ 14 Abs. 4 Nr. 7)');
{
  const r = berechneSteuer([
    { quantity: 1, unit_price: 45.00, ust_satz: 0, ust_grund: '4_14a' },
    { quantity: 1, unit_price: 8.00,  ust_satz: 19 },
  ], 'regel');
  pruefe('zwei getrennte Summenzeilen', r.tax_summary.length, 2);
  pruefe('steuerfreie Gruppe zuerst', r.tax_summary[0].satz, 0);
  pruefe('Gesamtbrutto stimmt', r.brutto, 53);
  pruefe('nur der 19-%-Anteil trägt Steuer', r.steuer, 1.28);
}

console.log('\nberechneSteuer — Rundung je Gruppe, nicht je Zeile');
{
  // Drei Zeilen à 0,10 € mit 19 %: zeilenweise gerundet ergäbe 3 × 0,02 = 0,06.
  // Gruppenweise: 0,30 brutto → 0,25 netto + 0,05 Steuer.
  const r = berechneSteuer([
    { quantity: 1, unit_price: 0.10, ust_satz: 19 },
    { quantity: 1, unit_price: 0.10, ust_satz: 19 },
    { quantity: 1, unit_price: 0.10, ust_satz: 19 },
  ], 'regel');
  pruefe('Gruppensumme statt Zeilensumme', [r.netto, r.steuer], [0.25, 0.05]);
}

console.log('\nberechneSteuer — Kleinunternehmer weist nie Steuer aus');
{
  const r = berechneSteuer([
    { quantity: 1, unit_price: 45.00, ust_satz: 0, ust_grund: '4_14a' },
    { quantity: 1, unit_price: 8.00,  ust_satz: 19 },
  ], 'kleinunternehmer');
  pruefe('keine Steuer trotz 19-%-Zeile', r.steuer, 0);
  pruefe('eine einzige Summenzeile', r.tax_summary.length, 1);
  pruefe('brutto unverändert', r.brutto, 53);
}

console.log('\nsteuerhinweisText');
{
  const klein = { tax_exempt_note: TAX_EXEMPT_OPTIONS['§19'] };
  pruefe('Kleinunternehmer erkannt', istKleinunternehmer(klein), true);
  pruefe('§ 19 schlägt alles', steuerhinweisText(klein, [{ satz: 19 }]), TAX_EXEMPT_OPTIONS['§19']);

  const regel = { tax_exempt_note: TAX_EXEMPT_OPTIONS['§4nr14a'] };
  pruefe('Befreiungshinweis bei steuerfreier Zeile',
    steuerhinweisText(regel, [{ satz: 0 }]), TAX_EXEMPT_OPTIONS['§4nr14a']);
  pruefe('kein Hinweis auf reiner 19-%-Rechnung',
    steuerhinweisText(regel, [{ satz: 19 }]), '');
}

console.log('\nleistungsartVorschlag — klinischer Anker entscheidet, nicht der Zahler');
{
  pruefe('Verordnung vorhanden → medizinisch',
    leistungsartVorschlag({ verordnung: { id: 'abc' } }), 'medizinisch');
  pruefe('Diagnosegruppe vorhanden → medizinisch',
    leistungsartVorschlag({ verordnung: { diagnosegruppe: 'DF' } }), 'medizinisch');
  pruefe('HPNR-Codes an der Behandlung → medizinisch',
    leistungsartVorschlag({ behandlung: { hpnr_codes: ['78001'] } }), 'medizinisch');
  pruefe('gar kein Anker → kosmetisch',
    leistungsartVorschlag({}), 'kosmetisch');
  pruefe('kosmetisch trägt den Regelsatz',
    zeilenSteuerVon('kosmetisch'), { ust_satz: 19, ust_grund: null });
  pruefe('medizinisch trägt die Befreiung',
    zeilenSteuerVon('medizinisch'), { ust_satz: 0, ust_grund: '4_14a' });
}

console.log('\nleistungszeitraum');
{
  pruefe('ein Tag', leistungszeitraum([{ leistungsdatum: '2026-08-16' }]),
    { von: '2026-08-16', bis: '2026-08-16', gleich: true });
  pruefe('über den Monatswechsel', leistungszeitraum([
    { leistungsdatum: '2026-08-03' }, { leistungsdatum: '2026-07-15' },
  ]), { von: '2026-07-15', bis: '2026-08-03', gleich: false });
  pruefe('ohne Daten', leistungszeitraum([{}]), { von: null, bis: null, gleich: true });
}

console.log(fehler === 0 ? '\n✅ alle Prüfungen bestanden\n' : `\n❌ ${fehler} Fehler\n`);
process.exit(fehler === 0 ? 0 : 1);
