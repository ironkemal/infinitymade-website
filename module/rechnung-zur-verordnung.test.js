import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rechnungMenueEintrag,
  zuzahlungMenueEintraege,
  druckenMenueHtml,
  sucheRechnungZurVerordnung,
  oeffneRechnungZurVerordnung,
  bgSperreBeimSpeichern,
} from './rechnung-zur-verordnung.js';

// --- rechnungMenueEintrag ----------------------------------------------------

test('Menüeintrag leer für Kasse (kassen, gkv, null, undefined)', () => {
  assert.equal(rechnungMenueEintrag('kassen'), '');
  assert.equal(rechnungMenueEintrag('gkv'), '');
  assert.equal(rechnungMenueEintrag(null), '');
  assert.equal(rechnungMenueEintrag(undefined), '');
  assert.equal(rechnungMenueEintrag(''), '');
});

test('Menüeintrag mit data-type="rechnung" für privat/selbstzahler/bg', () => {
  const p = rechnungMenueEintrag('privat');
  assert.match(p, /data-type="rechnung"/);
  assert.match(p, /📄 Rechnung \(Privat \(PKV\/Beihilfe\)\)/);
  assert.match(p, /border-top/);

  const s = rechnungMenueEintrag('selbstzahler');
  assert.match(s, /data-type="rechnung"/);
  assert.match(s, /📄 Rechnung \(Selbstzahler\)/);

  const b = rechnungMenueEintrag('bg');
  assert.match(b, /data-type="rechnung"/);
  assert.match(b, /📄 Rechnung \(BG \/ Unfallkasse\)/);
});

// --- sucheRechnungZurVerordnung ---------------------------------------------

test('sucheRechnung: ungültige ID ruft Supabase gar nicht auf', async () => {
  let aufgerufen = false;
  const fakeSb = {
    from() {
      aufgerufen = true;
      return this;
    },
  };

  assert.equal(await sucheRechnungZurVerordnung(fakeSb, null), null);
  assert.equal(await sucheRechnungZurVerordnung(fakeSb, ''), null);
  assert.equal(await sucheRechnungZurVerordnung(fakeSb, 'not-a-uuid'), null);
  assert.equal(await sucheRechnungZurVerordnung(fakeSb, "123' OR '1'='1"), null);
  assert.equal(aufgerufen, false, 'Darf supabase.from() bei ungültiger ID nicht aufrufen');
});

test('sucheRechnung: Treffer liefert ID der jüngsten Rechnung', async () => {
  const validUuid = '11111111-2222-3333-4444-555555555555';
  let capturedTable = '';
  const capturedOrs = [];
  let capturedOrder = null;

  const fakeSb = {
    from(table) {
      capturedTable = table;
      return {
        select() { return this; },
        or(filter) { capturedOrs.push(filter); return this; },
        neq() { return this; },
        order(field, opts) { capturedOrder = { field, opts }; return this; },
        limit() {
          return Promise.resolve({ data: [{ id: 'inv-42' }], error: null });
        },
      };
    },
  };

  const id = await sucheRechnungZurVerordnung(fakeSb, validUuid);
  assert.equal(id, 'inv-42');
  assert.equal(capturedTable, 'invoices');
  assert.equal(capturedOrs[0], `prescription_id.eq.${validUuid},verordnung_id.eq.${validUuid}`);
  assert.equal(capturedOrs[1], 'invoice_type.is.null,invoice_type.neq.zuzahlung');
  assert.deepEqual(capturedOrder, { field: 'created_at', opts: { ascending: false } });
});

test('sucheRechnung: kein Treffer liefert null', async () => {
  const validUuid = '11111111-2222-3333-4444-555555555555';
  const fakeSb = {
    from() {
      return {
        select() { return this; },
        or() { return this; },
        neq() { return this; },
        order() { return this; },
        limit() { return Promise.resolve({ data: [], error: null }); },
      };
    },
  };
  const id = await sucheRechnungZurVerordnung(fakeSb, validUuid);
  assert.equal(id, null);
});

test('sucheRechnung: Datenbankfehler liefert null', async () => {
  const validUuid = '11111111-2222-3333-4444-555555555555';
  const fakeSb = {
    from() {
      return {
        select() { return this; },
        or() { return this; },
        neq() { return this; },
        order() { return this; },
        limit() { return Promise.resolve({ data: null, error: new Error('DB error') }); },
      };
    },
  };
  const id = await sucheRechnungZurVerordnung(fakeSb, validUuid);
  assert.equal(id, null);
});

// --- oeffneRechnungZurVerordnung --------------------------------------------

test('oeffneRechnung: Weg 1 (vorhanden) öffnet bestehende Rechnung', async () => {
  const rxId = '11111111-2222-3333-4444-555555555555';
  const aufrufe = { switchPanel: 0, openInvEditor: 0, rechnungAusVerordnung: 0, toast: 0 };
  let geoeffneteInvId = null;

  const fakeSb = {
    from() {
      return {
        select() { return this; },
        or() { return this; },
        neq() { return this; },
        order() { return this; },
        limit() { return Promise.resolve({ data: [{ id: 'inv-existing' }], error: null }); },
      };
    },
  };

  const res = await oeffneRechnungZurVerordnung({ rxId, leadId: 'lead-1' }, {
    supabase: fakeSb,
    switchPanel(p) { aufrufe.switchPanel++; assert.equal(p, 'rechnungen'); },
    async openInvEditor(id) { aufrufe.openInvEditor++; geoeffneteInvId = id; },
    async rechnungAusVerordnung() { aufrufe.rechnungAusVerordnung++; },
    podVerordnungVorhanden() { return true; },
    toast() { aufrufe.toast++; },
  });

  assert.equal(res, 'vorhanden');
  assert.equal(aufrufe.switchPanel, 1);
  assert.equal(aufrufe.openInvEditor, 1);
  assert.equal(geoeffneteInvId, 'inv-existing');
  assert.equal(aufrufe.rechnungAusVerordnung, 0);
  assert.equal(aufrufe.toast, 0);
});

test('oeffneRechnung: Weg 2 (neu) ruft rechnungAusVerordnung auf wenn Verordnung im Speicher', async () => {
  const rxId = '11111111-2222-3333-4444-555555555555';
  const aufrufe = { switchPanel: 0, openInvEditor: 0, rechnungAusVerordnung: 0, toast: 0 };
  let uebergebeneRxId = null;

  const fakeSb = {
    from() {
      return {
        select() { return this; },
        or() { return this; },
        neq() { return this; },
        order() { return this; },
        limit() { return Promise.resolve({ data: [], error: null }); },
      };
    },
  };

  const res = await oeffneRechnungZurVerordnung({ rxId, leadId: 'lead-1' }, {
    supabase: fakeSb,
    switchPanel() { aufrufe.switchPanel++; },
    async openInvEditor() { aufrufe.openInvEditor++; },
    async rechnungAusVerordnung(id) { aufrufe.rechnungAusVerordnung++; uebergebeneRxId = id; },
    podVerordnungVorhanden(id) { return id === rxId; },
    toast() { aufrufe.toast++; },
  });

  assert.equal(res, 'neu');
  assert.equal(aufrufe.switchPanel, 0);
  assert.equal(aufrufe.openInvEditor, 0);
  assert.equal(aufrufe.rechnungAusVerordnung, 1);
  assert.equal(uebergebeneRxId, rxId);
  assert.equal(aufrufe.toast, 0);
});

test('oeffneRechnung: Weg 3 (leer) öffnet leeren Editor und toastet Hinweis', async () => {
  const rxId = '11111111-2222-3333-4444-555555555555';
  const aufrufe = { switchPanel: 0, openInvEditor: 0, rechnungAusVerordnung: 0, toast: 0 };
  let invIdParam = 'unset';
  let toastMsg = '';

  const fakeSb = {
    from() {
      return {
        select() { return this; },
        or() { return this; },
        neq() { return this; },
        order() { return this; },
        limit() { return Promise.resolve({ data: [], error: null }); },
      };
    },
  };

  const res = await oeffneRechnungZurVerordnung({ rxId, leadId: 'lead-1' }, {
    supabase: fakeSb,
    switchPanel(p) { aufrufe.switchPanel++; assert.equal(p, 'rechnungen'); },
    async openInvEditor(id) { aufrufe.openInvEditor++; invIdParam = id; },
    async rechnungAusVerordnung() { aufrufe.rechnungAusVerordnung++; },
    podVerordnungVorhanden() { return false; },
    toast(msg, typ) { aufrufe.toast++; toastMsg = msg; assert.equal(typ, 'info'); },
  });

  assert.equal(res, 'leer');
  assert.equal(aufrufe.switchPanel, 1);
  assert.equal(aufrufe.openInvEditor, 1);
  assert.equal(invIdParam, null);
  assert.equal(aufrufe.rechnungAusVerordnung, 0);
  assert.equal(aufrufe.toast, 1);
  assert.match(toastMsg, /Bitte im Editor die Verordnung auswählen/);
});

// --- bgSperreBeimSpeichern ---------------------------------------------------

test('bgSperre: nicht-bg liefert null', async () => {
  assert.equal(await bgSperreBeimSpeichern({ invoiceType: 'privat' }), null);
  assert.equal(await bgSperreBeimSpeichern({ invoiceType: 'selbstzahler' }), null);
  assert.equal(await bgSperreBeimSpeichern({ invoiceType: null }), null);
});

test('bgSperre: ohne prescriptionId liefert Fehlermeldung', async () => {
  const res = await bgSperreBeimSpeichern({ invoiceType: 'bg', prescriptionId: null });
  assert.match(res, /Eine BG-Rechnung braucht eine BG-Verordnung/);
});

test('bgSperre: Ladefehler liefert Fehlermeldung', async () => {
  const fakeSb = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle() { return Promise.resolve({ data: null, error: new Error('DB down') }); },
      };
    },
  };
  const res = await bgSperreBeimSpeichern({
    supabase: fakeSb,
    invoiceType: 'bg',
    prescriptionId: '11111111-2222-3333-4444-555555555555',
  });
  assert.match(res, /BG-Angaben der Verordnung konnten nicht geprüft werden/);
});

test('bgSperre: keine BG-Verordnung liefert Fehlermeldung', async () => {
  const fakeSb = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle() {
          return Promise.resolve({
            data: { rezeptart: 'privat', bg_traeger_name: 'BG', bg_traeger_anschrift: 'A', bg_unfalltag: '2026-01-01' },
            error: null,
          });
        },
      };
    },
  };
  const res = await bgSperreBeimSpeichern({
    supabase: fakeSb,
    invoiceType: 'bg',
    prescriptionId: '11111111-2222-3333-4444-555555555555',
  });
  assert.match(res, /keine BG-Verordnung — BG-Rechnung nicht möglich/);
});

test('bgSperre: Pflichtfelder fehlen liefert konkrete Feldliste', async () => {
  const fakeSb = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle() {
          return Promise.resolve({
            data: { rezeptart: 'bg', bg_traeger_name: null, bg_traeger_anschrift: 'Musterstr. 1', bg_unfalltag: null },
            error: null,
          });
        },
      };
    },
  };
  const res = await bgSperreBeimSpeichern({
    supabase: fakeSb,
    invoiceType: 'bg',
    prescriptionId: '11111111-2222-3333-4444-555555555555',
  });
  assert.match(res, /Für die BG-Rechnung fehlen Angaben in der Verordnung:/);
  assert.match(res, /UV-Träger \(Name\)/);
  assert.match(res, /Unfalltag/);
});

test('bgSperre: alles vorhanden liefert null', async () => {
  const fakeSb = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle() {
          return Promise.resolve({
            data: {
              rezeptart: 'bg',
              bg_traeger_name: 'BG Bau',
              bg_traeger_anschrift: 'Hauptstr. 10\n10115 Berlin',
              bg_unfalltag: '2026-05-12',
            },
            error: null,
          });
        },
      };
    },
  };
  const res = await bgSperreBeimSpeichern({
    supabase: fakeSb,
    invoiceType: 'bg',
    prescriptionId: '11111111-2222-3333-4444-555555555555',
  });
  assert.equal(res, null);
});

test('bgSperre: invoice_type zuzahlung sperrt das Speichern im Editor', async () => {
  const res = await bgSperreBeimSpeichern({
    supabase: null,
    invoiceType: 'zuzahlung',
    prescriptionId: '11111111-2222-3333-4444-555555555555',
  });
  assert.equal(res, 'Zuzahlungsbelege werden über den Druck am Rezept ausgestellt und sind nicht bearbeitbar.');
});


// --- zuzahlungMenueEintraege (gkv-302 10.10.2026, canli-test T29) ------------

test('Zuzahlungseinträge nur bei Kasse, nie bei Privat/Selbstzahler/BG', () => {
  for (const k of ['kassen', null, undefined]) {
    const h = zuzahlungMenueEintraege(k);
    assert.match(h, /data-type="quittung_zuzahlung"/);
    assert.match(h, /data-type="rzg_quittung"/);
  }
  for (const k of ['privat', 'selbstzahler', 'bg']) assert.equal(zuzahlungMenueEintraege(k), '');
});


// --- druckenMenueHtml / Nachladen (Akte-Verordnungskarte, 10.10.2026) --------

test('druckenMenueHtml: Kasse zeigt ZU + RZG, keine Rechnung; Privat umgekehrt', () => {
  const id = '11111111-2222-3333-4444-555555555555';
  const kasse = druckenMenueHtml({ id, rezeptart: 'kassen' });
  assert.match(kasse, new RegExp(`class="rx-drucken-wrap"[^>]*data-id="${id}"`));
  assert.match(kasse, /data-type="quittung_zuzahlung"/);
  assert.match(kasse, /data-type="rzg_quittung"/);
  assert.match(kasse, /data-type="rezeptvorderseite"/);
  assert.doesNotMatch(kasse, /data-type="rechnung"/);

  const privat = druckenMenueHtml({ id, rezeptart: 'privat' });
  assert.match(privat, /data-type="rechnung"/);
  assert.doesNotMatch(privat, /data-type="quittung_zuzahlung"/);
});

test('druckenMenueHtml: Kennung wird bereinigt, touch setzt 44 px', () => {
  const h = druckenMenueHtml({ id: 'ab"><script>', rezeptart: 'kassen', touch: true });
  assert.doesNotMatch(h, /<script>/);
  assert.match(h, /data-id="abscript"/);
  assert.match(h, /min-height:44px/);
  assert.doesNotMatch(druckenMenueHtml({ id: 'a', rezeptart: 'kassen' }), /min-height:44px/);
});

test('oeffneRechnung: lädt die Podo-Verordnung nach, bevor „vorhanden?" gefragt wird', async () => {
  const rxId = '11111111-2222-3333-4444-555555555555';
  const cache = new Set();
  const reihenfolge = [];
  const fakeSb = { from() { return { select() { return this; }, or() { return this; }, neq() { return this; }, order() { return this; }, limit() { return Promise.resolve({ data: [], error: null }); } }; } };

  const res = await oeffneRechnungZurVerordnung({ rxId, leadId: 'lead-1' }, {
    supabase: fakeSb,
    switchPanel() { reihenfolge.push('switchPanel'); },
    async openInvEditor() { reihenfolge.push('openInvEditor'); },
    async ladePodVerordnung(id) { reihenfolge.push('laden'); cache.add(id); },
    podVerordnungVorhanden(id) { reihenfolge.push('vorhanden'); return cache.has(id); },
    async rechnungAusVerordnung() { reihenfolge.push('vorbefuellen'); },
  });

  assert.equal(res, 'neu');
  assert.deepEqual(reihenfolge, ['laden', 'vorhanden', 'vorbefuellen']);
});
