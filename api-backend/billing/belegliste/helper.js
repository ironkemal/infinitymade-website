/**
 * GoBD-compliant ledger helper functions.
 */

/**
 * Erlaubte Zahlarten. Muss zum CHECK-Constraint aus
 * database_v32_kassieren_zahlart.sql passen.
 */
export const ZAHLARTEN = ['bar', 'ec', 'ueberweisung', 'sonstiges'];

/**
 * Deutsche Beschriftung für den CSV-Export / die Belegliste.
 */
export const ZAHLART_LABELS = {
  bar: 'Bar',
  ec: 'EC-Karte',
  ueberweisung: 'Überweisung',
  sonstiges: 'Sonstiges',
};

/**
 * Validates a Belegliste entry's types and amount constraints.
 * GoBD cash rules:
 * - Sales and co-payments must be positive (> 0)
 * - Storno / reversals must be negative (< 0)
 * - Zahlart ist optional (Altbelege vor v32 haben keine), muss aber, wenn
 *   angegeben, einer der bekannten Werte sein.
 *
 * @param {string} type - 'zuzahlung' | 'barverkauf' | 'storno'
 * @param {number} amount - The currency amount in EUR
 * @param {string|null} [zahlart] - 'bar' | 'ec' | 'ueberweisung' | 'sonstiges'
 * @returns {{isValid: boolean, error?: string}} Validation result
 */
export function validateBelegEntry(type, amount, zahlart) {
  if (!type || !['zuzahlung', 'barverkauf', 'storno'].includes(type)) {
    return { isValid: false, error: 'Ungültiger oder fehlender Typ. Typ muss zuzahlung, barverkauf oder storno sein.' };
  }

  const numAmount = Number(amount);
  if (amount === undefined || isNaN(numAmount)) {
    return { isValid: false, error: 'Ungültiger oder fehlender Betrag.' };
  }

  if (type === 'storno') {
    if (numAmount >= 0) {
      return { isValid: false, error: 'Stornobuchungen müssen einen negativen Betrag haben.' };
    }
  } else {
    if (numAmount <= 0) {
      return { isValid: false, error: 'Zuzahlungen und Barverkäufe müssen einen positiven Betrag haben.' };
    }
  }

  if (zahlart != null && zahlart !== '' && !ZAHLARTEN.includes(zahlart)) {
    return { isValid: false, error: `Ungültige Zahlart. Erlaubt: ${ZAHLARTEN.join(', ')}.` };
  }

  return { isValid: true };
}

/**
 * Formats a list of ledger rows into a GoBD-compliant German CSV format.
 * 
 * @param {Array<object>} rows - Array of database records
 * @returns {string} CSV formatted content
 */
export function generateCsvString(rows) {
  let csv = 'sep=;\r\n';
  csv += 'Beleg-Nr;Datum;Uhrzeit;Typ;Zahlart;Betrag EUR;Referenztext\r\n';

  for (const r of (rows || [])) {
    // Treat the date in Europe/Berlin local timezone
    const d = new Date(r.created_at);
    
    // We target Europe/Berlin timezone offsets. Since standard date UTC conversions
    // could shift dates, we use Intl.DateTimeFormat parts to extract timezone-safe values
    const dtf = new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    });
    
    const parts = dtf.formatToParts(d);
    const day = parts.find(p => p.type === 'day').value;
    const month = parts.find(p => p.type === 'month').value;
    const year = parts.find(p => p.type === 'year').value;
    const hour = parts.find(p => p.type === 'hour').value;
    const minute = parts.find(p => p.type === 'minute').value;
    const second = parts.find(p => p.type === 'second').value;

    const dateStr = `${day}.${month}.${year}`;
    const timeStr = `${hour}:${minute}:${second}`;
    
    // Replace dot with comma for German currency representations
    const amountStr = Number(r.amount_eur).toFixed(2).replace('.', ',');
    
    // Double quote escape reference texts to protect CSV structure
    const escapedRef = (r.reference_text || '').replace(/"/g, '""');
    
    const zahlartStr = ZAHLART_LABELS[r.zahlart] || '';

    csv += `"${String(r.beleg_nr).padStart(6, '0')}";"${dateStr}";"${timeStr}";"${r.type}";"${zahlartStr}";"${amountStr}";"${escapedRef}"\r\n`;
  }

  return csv;
}
