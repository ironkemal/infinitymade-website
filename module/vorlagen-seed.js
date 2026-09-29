// Standard-Vorlagen und deren Nachpflege (Reform S3.2, 29.09.2026).
// Warum eigenes Modul: seedMissingVorlagen schrieb alle fehlenden Typen in EINEM insert
// und pruefte den Fehler nicht. Ein einziger vom CHECK abgelehnter Typ
// (rechnung_ausfall, ab 12.08.) liess so ALLE Vorlagen eines neuen Kontos ausfallen.

export const DEFAULT_VORLAGE_SEEDS = [
  { name: 'Quittung Zuzahlung', vorlage_type: 'quittung_zuzahlung', is_default: true, content_json: { hinweis: 'Zuzahlung gemäß §32 Abs. 2 SGB V erhalten.', fusszeile: '' } },
  { name: 'Rechnung BG', vorlage_type: 'rechnung_bg', is_default: true, content_json: { betreff: 'Rechnung für Berufsgenossenschaft', zahlungsziel_tage: '30', fusszeile: '' } },
  { name: 'Rechnung Privat', vorlage_type: 'rechnung_privat', is_default: true, content_json: { betreff: 'Rechnung für physiotherapeutische Leistungen', zahlungsziel_tage: '14', fusszeile: '' } },
  { name: 'Rechnung Eigenanteil', vorlage_type: 'rechnung_eigenanteil', is_default: true, content_json: { hinweis: 'Eigenanteil gemäß Heilmittelrichtlinien.', fusszeile: '' } },
  { name: 'Ausfallrechnung', vorlage_type: 'rechnung_ausfall', is_default: true, content_json: { betreff: 'Ausfallrechnung', zahlungsziel_tage: '14', hinweis: '', fusszeile: '' } },
  { name: 'Rechnung Selbstzahler', vorlage_type: 'rechnung_selbstzahler', is_default: true, content_json: { betreff: 'Selbstzahler-Rechnung', zahlungsziel_tage: '14', fusszeile: '' } },
  { name: 'Rechnung Sonder', vorlage_type: 'rechnung_sonder', is_default: true, content_json: { betreff: 'Rechnung Sonderkostenträger', fusszeile: '' } },
  { name: 'Rezeptvorderseite', vorlage_type: 'rezeptvorderseite', is_default: true, content_json: { praxis_zusatz: 'Physiotherapie & Manuelle Therapie', stempel_hinweis: 'Bitte Stempel beifügen' } },
  { name: 'RZG-Quittung', vorlage_type: 'rzg_quittung', is_default: true, content_json: { unterschrift_label: 'Empfang bestätigt:', hinweis: '', fusszeile: '' } },
];

// Saubere Zeilen fuer die fehlenden Typen (reine Funktion).
export function fehlendeSeedZeilen(missingTypes, ownerId, seeds = DEFAULT_VORLAGE_SEEDS) {
  return seeds.filter(s => missingTypes.includes(s.vorlage_type)).map(s => ({ ...s, owner_id: ownerId }));
}

// Erst gesammelt einfuegen; schlaegt das fehl, Zeile fuer Zeile wiederholen, damit
// ein ungueltiger Typ die uebrigen nicht mitreisst. Gibt die fehlgeschlagenen Typen zurueck.
export async function seedeVorlagen(supabase, rows, melde = () => {}) {
  if (!rows.length) return [];
  const { error } = await supabase.from('document_vorlagen').insert(rows);
  if (!error) return [];
  const fehlgeschlagen = [];
  for (const row of rows) {
    const { error: e } = await supabase.from('document_vorlagen').insert(row);
    if (e) { fehlgeschlagen.push(row.vorlage_type); melde(row.vorlage_type, e); }
  }
  return fehlgeschlagen;
}
