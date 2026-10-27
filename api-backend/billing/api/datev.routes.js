// GET /api/billing/datev/export?from=YYYY-MM-DD&to=YYYY-MM-DD
// DATEV-Buchungsstapel (EXTF) der Geldeingänge eines Zeitraums — für den Steuerberater.
// Nur Inhaber (Finanzdaten der Praxis). Keine Außenverbindung (onprem O-215).
// Datenteil und Format: api-backend/lib/datev.js.

import express from 'express';
import { requireAuth, requireOwner } from '../../ai/auth.js';
import { berlinTagesgrenzen } from '../../lib/berlin-tag.js';
import { normalisiereEinstellungen, fehlendeAngaben, buchungenAus, erzeugeExtfCsv } from '../../lib/datev.js';

const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/;

export function createDatevRouter({ supabase }) {
  const router = express.Router();

  router.get('/datev/export', requireAuth, requireOwner, async (req, res) => {
    const { from, to } = req.query || {};
    if (!ISO_TAG.test(String(from || '')) || !ISO_TAG.test(String(to || '')) || from > to) {
      return res.status(400).json({ error: 'Bitte einen gültigen Zeitraum (von ≤ bis) wählen.' });
    }
    const von = berlinTagesgrenzen(from);
    const bis = berlinTagesgrenzen(to);
    if (!von || !bis) return res.status(400).json({ error: 'Ungültiger Zeitraum.' });
    const tenantId = req.auth.tenantId;

    try {
      const { data: profil, error: pErr } = await supabase.from('profiles')
        .select('datev_einstellungen').eq('id', tenantId).maybeSingle();
      if (pErr) throw pErr;
      const e = normalisiereEinstellungen(profil?.datev_einstellungen);
      const fehlt = fehlendeAngaben(e);
      if (fehlt.length) {
        return res.status(409).json({ error: `DATEV-Angaben fehlen: ${fehlt.join(', ')}. Bitte unter Einstellungen → DATEV-Export eintragen.`, code: 'DATEV_ANGABEN_FEHLEN' });
      }

      const [belegR, gkvR] = await Promise.all([
        supabase.from('belegliste')
          .select('id, beleg_nr, type, zahlart, amount_eur, created_at, invoice_id, prescription_id, storno_von')
          .eq('owner_id', tenantId).gte('created_at', von.von).lt('created_at', bis.bisExklusiv)
          .order('beleg_nr', { ascending: true }),
        supabase.from('abrechnung_zahlung')
          .select('art, betrag_eur, datum, einzel_rechnungsnummer')
          .eq('owner_id', tenantId).gte('datum', from).lte('datum', to),
      ]);
      if (belegR.error) throw belegR.error;
      if (gkvR.error) throw gkvR.error;
      const belege = belegR.data || [];

      // Storno-Originale können vor dem Zeitraum liegen — einzeln nachladen.
      const originalIds = [...new Set(belege.filter(b => b.storno_von).map(b => b.storno_von))];
      const originale = new Map();
      if (originalIds.length) {
        const { data, error } = await supabase.from('belegliste').select('id, type, invoice_id')
          .eq('owner_id', tenantId).in('id', originalIds);
        if (error) throw error;
        for (const o of data || []) originale.set(o.id, o);
      }
      const invoiceIds = [...new Set([...belege.map(b => b.invoice_id), ...[...originale.values()].map(o => o.invoice_id)].filter(Boolean))];
      const invoiceTypen = new Map();
      const invoiceNr = new Map();
      if (invoiceIds.length) {
        const { data, error } = await supabase.from('invoices').select('id, invoice_type, invoice_number')
          .eq('owner_id', tenantId).in('id', invoiceIds);
        if (error) throw error;
        for (const i of data || []) { invoiceTypen.set(i.id, i.invoice_type); invoiceNr.set(i.id, i.invoice_number); }
      }

      const buchungen = buchungenAus({ belege, invoiceTypen, invoiceNr, originale, gkv: gkvR.data || [] }, e);
      const csv = erzeugeExtfCsv(buchungen, { einstellungen: e, von: from, bis: to, erzeugtAm: new Date() });
      const name = `EXTF_Buchungsstapel_${from}_${to}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=windows-1252');
      res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
      return res.send(csv);
    } catch (err) {
      if (err?.status === 400) return res.status(400).json({ error: err.message });
      console.error('[datev/export]', err?.code || 'Fehler');
      return res.status(500).json({ error: 'Der DATEV-Export konnte nicht erstellt werden.' });
    }
  });

  return router;
}
