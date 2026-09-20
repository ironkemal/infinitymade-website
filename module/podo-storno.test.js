import { test } from 'node:test';
import assert from 'node:assert/strict';
import { darfStornieren, grundPruefen, behandlungStornieren } from './podo-storno.js';
import { MELDEPFLICHT_TEXT } from './abrechnungsstatus.js';

// ===== darfStornieren =====

test('darfStornieren: kein Objekt -> keine_zeile', () => {
  const r = darfStornieren(null);
  assert.equal(r.erlaubt, false);
  assert.equal(r.grund, 'keine_zeile');
});

test('darfStornieren: Objekt ohne id -> keine_zeile', () => {
  const r = darfStornieren({ storniert_am: null, invoice_id: null });
  assert.equal(r.erlaubt, false);
  assert.equal(r.grund, 'keine_zeile');
});

test('darfStornieren: saubere Zeile -> erlaubt', () => {
  const r = darfStornieren({ id: 'beh-1', storniert_am: null, invoice_id: null });
  assert.equal(r.erlaubt, true);
  assert.equal(r.grund, '');
});

test('darfStornieren: storniert_am gesetzt -> bereits_storniert', () => {
  const r = darfStornieren({ id: 'beh-2', storniert_am: '2026-09-20T10:00:00Z', invoice_id: null });
  assert.equal(r.erlaubt, false);
  assert.equal(r.grund, 'bereits_storniert');
});

test('darfStornieren: invoice_id gesetzt -> auf_rechnung', () => {
  const r = darfStornieren({ id: 'beh-3', storniert_am: null, invoice_id: 'inv-42' });
  assert.equal(r.erlaubt, false);
  assert.equal(r.grund, 'auf_rechnung');
});

test('darfStornieren: Reihenfolge — storniert_am hat Vorrang vor invoice_id', () => {
  // Beide gesetzt: bereits_storniert kommt zuerst, weil storniert_am vor invoice_id geprüft wird.
  const r = darfStornieren({ id: 'beh-4', storniert_am: '2026-09-20T10:00:00Z', invoice_id: 'inv-99' });
  assert.equal(r.erlaubt, false);
  assert.equal(r.grund, 'bereits_storniert');
});

// ===== grundPruefen =====

test('grundPruefen: zu kurz (< 3 Zeichen) -> null', () => {
  assert.equal(grundPruefen('ab'), null);
  assert.equal(grundPruefen(''), null);
  assert.equal(grundPruefen('  '), null); // nur Leerzeichen, trim ergibt ''
});

test('grundPruefen: genau 3 Zeichen nach trim -> gueltig', () => {
  assert.equal(grundPruefen('  abc  '), 'abc');
});

test('grundPruefen: fuehrende und abschliessende Leerzeichen werden entfernt', () => {
  assert.equal(grundPruefen('  Falsches Datum  '), 'Falsches Datum');
});

test('grundPruefen: bei 500 Zeichen Grenze wird abgeschnitten', () => {
  const lang = 'x'.repeat(600);
  const result = grundPruefen(lang);
  assert.equal(result?.length, 500);
});

test('grundPruefen: genau 500 Zeichen bleiben unveraendert', () => {
  const genau = 'a'.repeat(500);
  assert.equal(grundPruefen(genau), genau);
});

test('grundPruefen: null-Eingabe -> null (kein Absturz)', () => {
  assert.equal(grundPruefen(null), null);
});

test('grundPruefen: undefined-Eingabe -> null (kein Absturz)', () => {
  assert.equal(grundPruefen(undefined), null);
});

test('grundPruefen: Zahl als Eingabe -> null oder gueltiger String (kein Absturz)', () => {
  // String(42) = '42', trim() = '42', length 2 < 3 -> null
  assert.equal(grundPruefen(42), null);
  // String(123) = '123', length 3 -> '123'
  assert.equal(grundPruefen(123), '123');
});

// ===== behandlungStornieren =====

// Hilfsfunktion: baut einen minimalen stub-ctx auf.
// supabase-Kette wird nur dann gebaut, wenn der Test sie wirklich benötigt.
function makeCtx({ showInputModal, showToast = () => {} } = {}) {
  const aufgerufen = { update: false, modalOpts: null };
  const modalFn = async (opts) => {
    aufgerufen.modalOpts = opts;
    if (showInputModal) {
      return showInputModal(opts);
    }
    return 'Falsches Datum';
  };
  const supabase = {
    from: () => ({
      update: () => {
        aufgerufen.update = true;
        return {
          eq: () => ({ eq: () => ({ is: () => ({ select: () => Promise.resolve({ data: [{ id: 'x' }], error: null }) }) }) }),
        };
      },
    }),
  };
  return {
    ctx: {
      supabase,
      getOwnerId: () => 'owner-1',
      getSessionUserId: () => 'user-1',
      showInputModal: modalFn,
      showToast,
    },
    aufgerufen,
  };
}

test('behandlungStornieren: darfStornieren lehnt ab -> kein DB-Aufruf', async () => {
  // storniert_am ist gesetzt -> darfStornieren gibt bereits_storniert zurück
  const { ctx, aufgerufen } = makeCtx();
  const beh = { id: 'beh-5', storniert_am: '2026-09-20T10:00:00Z', invoice_id: null, behandlungsdatum: '2026-09-19' };

  const r = await behandlungStornieren(ctx, beh);

  assert.equal(r.ok, false);
  assert.equal(r.fehler, 'bereits_storniert');
  // Entscheidend: die DB wurde nicht berührt
  assert.equal(aufgerufen.update, false);
});

test('behandlungStornieren: Benutzer bricht Modal ab -> kein DB-Aufruf, abgebrochen: true', async () => {
  // showInputModal gibt null zurück = Abbruch
  const { ctx, aufgerufen } = makeCtx({ showInputModal: async () => null });
  const beh = { id: 'beh-6', storniert_am: null, invoice_id: null, behandlungsdatum: '2026-09-19' };

  const r = await behandlungStornieren(ctx, beh);

  assert.equal(r.ok, false);
  assert.equal(r.abgebrochen, true);
  assert.equal(aufgerufen.update, false);
});

test('behandlungStornieren: verordnungStatus ist undefined -> message ohne Zusatztexte', async () => {
  const { ctx, aufgerufen } = makeCtx();
  const beh = { id: 'beh-7', storniert_am: null, invoice_id: null, behandlungsdatum: '2026-09-19' };

  const r = await behandlungStornieren(ctx, beh);

  assert.equal(r.ok, true);
  assert.ok(aufgerufen.modalOpts);
  assert.equal(aufgerufen.modalOpts.message.includes(MELDEPFLICHT_TEXT), false);
  assert.equal(aufgerufen.modalOpts.message.includes('Zuzahlungsbetrag'), false);
  assert.ok(aufgerufen.modalOpts.message.startsWith('Behandlung vom '));
  assert.ok(aufgerufen.modalOpts.message.includes('Die Zeile bleibt in der Dokumentation sichtbar'));
});

test('behandlungStornieren: verordnungStatus = "abgerechnet" -> message enthält MELDEPFLICHT_TEXT und Zuzahlungshinweis', async () => {
  const { ctx, aufgerufen } = makeCtx();
  const beh = { id: 'beh-8', storniert_am: null, invoice_id: null, behandlungsdatum: '2026-09-19' };

  const r = await behandlungStornieren(ctx, beh, 'abgerechnet');

  assert.equal(r.ok, true);
  assert.ok(aufgerufen.modalOpts);
  assert.ok(aufgerufen.modalOpts.message.includes(MELDEPFLICHT_TEXT));
  assert.ok(aufgerufen.modalOpts.message.includes('Außerdem: Diese Behandlung ist Teil einer bereits eingereichten Rechnung.'));
  assert.ok(aufgerufen.modalOpts.message.includes('Zuzahlungsbetrag kann dadurch nicht mehr stimmen'));
  assert.ok(aufgerufen.modalOpts.message.startsWith('Behandlung vom '));
});

test('behandlungStornieren: verordnungStatus = "abgesetzt" oder "teilabsetzung" -> message enthält ebenfalls Zusatztexte', async () => {
  for (const st of ['abgesetzt', 'teilabsetzung']) {
    const { ctx, aufgerufen } = makeCtx();
    const beh = { id: `beh-st-${st}`, storniert_am: null, invoice_id: null, behandlungsdatum: '2026-09-19' };

    const r = await behandlungStornieren(ctx, beh, st);

    assert.equal(r.ok, true);
    assert.ok(aufgerufen.modalOpts.message.includes(MELDEPFLICHT_TEXT));
    assert.ok(aufgerufen.modalOpts.message.includes('Zuzahlungsbetrag'));
  }
});

test('behandlungStornieren: verordnungStatus = "aktiv" oder "abrechenbar" -> keine Zusatztexte in message', async () => {
  for (const st of ['aktiv', 'abrechenbar']) {
    const { ctx, aufgerufen } = makeCtx();
    const beh = { id: `beh-st-${st}`, storniert_am: null, invoice_id: null, behandlungsdatum: '2026-09-19' };

    const r = await behandlungStornieren(ctx, beh, st);

    assert.equal(r.ok, true);
    assert.equal(aufgerufen.modalOpts.message.includes(MELDEPFLICHT_TEXT), false);
    assert.equal(aufgerufen.modalOpts.message.includes('Zuzahlungsbetrag'), false);
    assert.ok(aufgerufen.modalOpts.message.startsWith('Behandlung vom '));
  }
});
