import test from 'node:test';
import assert from 'node:assert/strict';
import {
  exportAbrufen,
  kontoLoeschenSenden,
  dsgvoKontoLoeschen
} from './dsgvo-client.js';

test('DSGVO-Client Unit Tests', async (t) => {
  const dummyApiBase = 'https://api.example.com';
  const dummyToken = 'jwt-token-xyz-123';

  await t.test('exportAbrufen: ruft korrekte URL auf, setzt Auth-Header und enthaelt kein token= in URL', async () => {
    let capturedUrl = null;
    let capturedOptions = null;

    const mockFetch = async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return {
        ok: true,
        status: 200,
        blob: async () => ({ size: 42, type: 'application/json' })
      };
    };

    const blob = await exportAbrufen({
      apiBase: dummyApiBase,
      token: dummyToken,
      fetchImpl: mockFetch
    });

    assert.equal(capturedUrl, 'https://api.example.com/dsgvo/export');
    assert.equal(capturedUrl.includes('token='), false, 'URL darf kein ?token= oder token= enthalten');
    assert.equal(capturedOptions.method, 'GET');
    assert.equal(capturedOptions.headers['Authorization'], `Bearer ${dummyToken}`);
    assert.ok(blob, 'Blob muss zurückgegeben werden');
  });

  await t.test('exportAbrufen: wirft Fehler wenn kein Token vorhanden ist', async () => {
    await assert.rejects(
      async () => {
        await exportAbrufen({ apiBase: dummyApiBase, token: null });
      },
      /Nicht angemeldet/
    );
  });

  await t.test('kontoLoeschenSenden: sendet POST mit { confirm: "LÖSCHEN" }, Auth-Header und kein token= in URL', async () => {
    let capturedUrl = null;
    let capturedOptions = null;

    const mockFetch = async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, status: 'geloescht', message: 'Konto gelöscht' })
      };
    };

    const res = await kontoLoeschenSenden({
      apiBase: dummyApiBase,
      token: dummyToken,
      fetchImpl: mockFetch
    });

    assert.equal(capturedUrl, 'https://api.example.com/dsgvo/loeschen');
    assert.equal(capturedUrl.includes('token='), false, 'URL darf kein ?token= enthalten');
    assert.equal(capturedOptions.method, 'POST');
    assert.equal(capturedOptions.headers['Authorization'], `Bearer ${dummyToken}`);
    assert.equal(capturedOptions.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(capturedOptions.body), { confirm: 'LÖSCHEN' });
    assert.equal(res.ok, true);
    assert.equal(res.status, 200);
  });

  await t.test('dsgvoKontoLoeschen: 409 EXPORT_FEHLT führt zu Toast mit Export-Hinweis', async () => {
    const toasts = [];
    const mockToast = (msg, type) => toasts.push({ msg, type });

    const mockFetch = async () => ({
      ok: false,
      status: 409,
      json: async () => ({ error: 'Export fehlt', code: 'EXPORT_FEHLT' })
    });

    await dsgvoKontoLoeschen({
      apiBase: dummyApiBase,
      getToken: async () => dummyToken,
      showToast: mockToast,
      showConfirmModal: async () => true,
      showInputModal: async () => 'LÖSCHEN',
      signOut: async () => {},
      istKutu: false,
      fetchImpl: mockFetch
    });

    assert.equal(toasts.length, 1);
    assert.equal(toasts[0].type, 'error');
    assert.equal(toasts[0].msg, 'Bitte zuerst ‚Daten exportieren‘ ausführen.');
  });

  await t.test('dsgvoKontoLoeschen: bricht bei Box (istKutu = true) ab und ruft kein fetch auf', async () => {
    let fetchCalled = false;
    const toasts = [];

    await dsgvoKontoLoeschen({
      apiBase: dummyApiBase,
      getToken: async () => dummyToken,
      showToast: (msg, type) => toasts.push({ msg, type }),
      istKutu: true,
      fetchImpl: async () => {
        fetchCalled = true;
      }
    });

    assert.equal(fetchCalled, false, 'Fetch darf in der Box nicht aufgerufen werden');
    assert.equal(toasts.length, 1);
    assert.equal(toasts[0].type, 'info');
    assert.ok(toasts[0].msg.includes('Box'));
  });

  await t.test('dsgvoKontoLoeschen: 200 Erfolg führt zu Toast und signOut', async () => {
    const toasts = [];
    let signedOut = false;

    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        status: 'geloescht',
        message: 'Ihr Konto wurde gelöscht.\nWeitere Details...'
      })
    });

    await dsgvoKontoLoeschen({
      apiBase: dummyApiBase,
      getToken: async () => dummyToken,
      showToast: (msg) => toasts.push(msg),
      showConfirmModal: async () => true,
      showInputModal: async () => 'LÖSCHEN',
      signOut: async () => {
        signedOut = true;
      },
      istKutu: false,
      fetchImpl: mockFetch
    });

    assert.equal(toasts.length, 1);
    assert.equal(toasts[0], 'Ihr Konto wurde gelöscht.');
    assert.equal(signedOut, true, 'signOut muss nach erfolgreicher Löschung aufgerufen werden');
  });

  await t.test('dsgvoKontoLoeschen: 200 teilweise_geloescht zeigt gesperrte Unterlagen Hinweis', async () => {
    const toasts = [];
    let signedOut = false;

    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        status: 'teilweise_geloescht',
        message: 'Konto teilweise gelöscht'
      })
    });

    await dsgvoKontoLoeschen({
      apiBase: dummyApiBase,
      getToken: async () => dummyToken,
      showToast: (msg) => toasts.push(msg),
      showConfirmModal: async () => true,
      showInputModal: async () => 'LÖSCHEN',
      signOut: async () => {
        signedOut = true;
      },
      istKutu: false,
      fetchImpl: mockFetch
    });

    assert.equal(toasts.length, 1);
    assert.equal(toasts[0], 'Ihr Konto wurde gelöscht; aufbewahrungspflichtige Unterlagen bleiben gesperrt.');
    assert.equal(signedOut, true);
  });
});
