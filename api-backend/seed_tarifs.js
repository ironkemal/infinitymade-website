import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { PHYSIO_POSITIONS, resolvePositionsnummer } from './billing/codes/physio_positions.js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const bundeslands = [
  'BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH'
];

const reverseMap = {
  'X0501': 'KG',
  'X0710': 'KG-ZNS',
  'X0702': 'KG-MUKO',
  'X1201': 'MT',
  'X0205': 'MLD',
  'X0201': 'MLD-45',
  'X0202': 'MLD-60',
  'X0106': 'KMT',
  'X0107': 'BGM',
  'X0301': 'ÜB',
  'X1302': 'E',
  'X1501': 'W',
  'X1534': 'K',
  'X2001': 'D1'
};

async function seed() {
  console.log('Starting seed of heilmittel_tarif...');
  
  // Wipe existing dynamic tariffs
  const { error: deleteErr } = await supabase
    .from('heilmittel_tarif')
    .delete()
    .neq('id', 0); // delete all
  if (deleteErr) {
    console.error('Error clearing heilmittel_tarif:', deleteErr);
    return;
  }
  console.log('Existing tariffs cleared.');

  const rows = [];
  for (const bl of bundeslands) {
    for (const pos of PHYSIO_POSITIONS) {
      const resolved = resolvePositionsnummer(pos.x, '22');
      const code = reverseMap[pos.x] || null;
      rows.push({
        bundesland: bl,
        position_nr: resolved,
        heilmittel_code: code,
        preis_eur: pos.preis,
        zuzahlung_pflicht: pos.zuzahlung !== null,
        gueltig_ab: '2026-01-01',
        gueltig_bis: null
      });
    }
  }

  // Insert in batches of 100 to avoid request size limit
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from('heilmittel_tarif').insert(batch);
    if (error) {
      console.error(`Error inserting batch ${i / batchSize}:`, error);
      return;
    }
  }

  console.log(`Successfully seeded ${rows.length} tariffs!`);
}

seed();
